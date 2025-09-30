/*
 Backfill projects for all installations in the database.

 Requirements (env):
 - NEXT_PUBLIC_SUPABASE_URL
 - SUPABASE_SERVICE_ROLE_KEY
 - GITHUB_APP_ID
 - GITHUB_APP_PRIVATE_KEY (PEM; supports \n literals)

 Run: node scripts/backfill-projects.js
*/

const { createClient } = require('@supabase/supabase-js')
const crypto = require('crypto')

function getEnv(name) {
  const v = process.env[name]
  if (!v || !String(v).trim()) throw new Error(`Missing ${name}`)
  return v
}

function normalizePrivateKey(raw) {
  return raw.includes('-----BEGIN') ? raw : raw.replace(/\\n/g, '\n')
}

function base64UrlEncode(input) {
  return Buffer.from(input)
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
}

function createAppJwt() {
  const appId = getEnv('GITHUB_APP_ID')
  const privateKey = normalizePrivateKey(getEnv('GITHUB_APP_PRIVATE_KEY'))

  const now = Math.floor(Date.now() / 1000)
  const payload = { iat: now - 60, exp: now + 9 * 60, iss: appId }
  const header = { alg: 'RS256', typ: 'JWT' }
  const encodedHeader = base64UrlEncode(JSON.stringify(header))
  const encodedPayload = base64UrlEncode(JSON.stringify(payload))
  const unsigned = `${encodedHeader}.${encodedPayload}`
  const signer = crypto.createSign('RSA-SHA256')
  signer.update(unsigned)
  const signature = signer.sign(privateKey)
  const encodedSignature = base64UrlEncode(signature)
  return `${unsigned}.${encodedSignature}`
}

async function createInstallationAccessToken(installationId) {
  const jwt = createAppJwt()
  const res = await fetch(`https://api.github.com/app/installations/${installationId}/access_tokens`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${jwt}`,
      Accept: 'application/vnd.github.v3+json',
      'User-Agent': 'change-reel/backfill'
    },
  })
  const data = await res.json()
  if (!res.ok) {
    throw new Error(`token ${res.status} ${data?.message || ''}`)
  }
  return { token: data.token, expiresAt: data.expires_at }
}

async function listInstallationRepositories(installationId) {
  const { token } = await createInstallationAccessToken(installationId)
  const res = await fetch('https://api.github.com/installation/repositories?per_page=100', {
    headers: {
      Authorization: `token ${token}`,
      Accept: 'application/vnd.github.v3+json',
      'User-Agent': 'change-reel/backfill'
    },
  })
  const data = await res.json()
  if (!res.ok) {
    throw new Error(`list repos ${res.status} ${data?.message || ''}`)
  }
  return data.repositories || []
}

async function main() {
  const url = getEnv('NEXT_PUBLIC_SUPABASE_URL')
  const key = getEnv('SUPABASE_SERVICE_ROLE_KEY')
  const supa = createClient(url, key)

  const { data: installs, error: instErr } = await supa
    .from('installations')
    .select('installation_id, user_id')

  if (instErr) throw new Error(instErr.message)
  if (!installs || installs.length === 0) {
    console.log('No installations found. Seed from projects first if needed.')
    return
  }

  let created = 0
  for (const inst of installs) {
    const installationId = Number(inst.installation_id)
    const userId = inst.user_id
    console.log(`[backfill] installation ${installationId}`)
    try {
      const repos = await listInstallationRepositories(installationId)
      for (const r of repos) {
        const full = r.full_name
        const { data: rows, error: selErr } = await supa
          .from('projects')
          .select('id')
          .eq('repo_name', full)
          .limit(1)

        if (selErr) {
          console.warn(`[backfill] lookup failed ${full}: ${selErr.message}`)
          continue
        }

        const exists = Array.isArray(rows) && rows.length > 0
        if (!exists) {
          const { error: insErr } = await supa.from('projects').insert({
            user_id: userId,
            name: full,
            repo_name: full,
            provider: 'github',
            installation_id: installationId,
            email_distribution_list: [],
          })
          if (insErr) {
            console.warn(`[backfill] insert failed ${full}: ${insErr.message}`)
          } else {
            created += 1
            console.log(`[backfill] created project: ${full}`)
          }
        }
      }
    } catch (e) {
      console.warn(`[backfill] repo listing failed for ${installationId}: ${e?.message || e}`)
    }
  }
  console.log(`[backfill] done. projects created: ${created}`)
}

main().catch((err) => {
  console.error('[backfill] fatal:', err)
  process.exit(1)
})

