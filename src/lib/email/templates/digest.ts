export interface SingleCommitEmailInput {
  projectName: string
  commit: {
    header?: string
    summary: string
    author: string | null
    // sha: string
    timestamp: string
    type?: 'feature' | 'bugfix'
  }
}

export function renderSingleCommitEmail(input: SingleCommitEmailInput): { subject: string; html: string } {
  const { projectName, commit } = input
  const date = new Date(commit.timestamp)
  const dateStr = date.toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' })
  const changeLabel = commit.type === 'bugfix'
    ? '🪲 Bugfix'
    : '🆕 Feature'

  // Derive a headline from explicit header or from the first line of the summary
  const firstLineOfSummary = (commit.summary || '').split('\n')[0]?.trim() || ''
  const headline = (commit.header && commit.header.trim()) || firstLineOfSummary || `${changeLabel}: Update in ${projectName}`

  // Precompute summary HTML: headline once, bullets as list if present
  const lines = (commit.summary || '').split('\n').map(l => l.trim()).filter(Boolean)
  const headerLine = lines[0] || ''
  const bulletLines = lines.slice(1)
  const headerHtml = headerLine
    ? '<div style="font-size:15px;color:#111;font-weight:700;margin-bottom:8px;line-height:1.4;">' + escapeHtml(headerLine) + '</div>'
    : ''
  const bulletsHtml = bulletLines.length
    ? '<ul style="margin:0 0 8px 0;padding-left:18px;list-style:disc;">' + bulletLines.map(line => (
        '<li style="font-size:13px;color:#111;line-height:1.6;margin-bottom:6px;">' + escapeHtml(line) + '</li>'
      )).join('') + '</ul>'
    : '<div style="font-size:13px;color:#111;line-height:1.6;">' + escapeHtml(commit.summary) + '</div>'
  const summaryHtml = headerHtml + bulletsHtml

  const appUrl = 'https://changereel.com/admin'
  const logoUrl = 'https://changereel.com/favicon.ico'
  const html = `
  <div style="font-family:Inter,system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif;background:#ffffff;padding:24px;">
    <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="width:100%;margin:0 auto;border-collapse:collapse;">
      <tr>
        <td align="center">
          <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="width:100%;max-width:500px;margin:0 auto;background:#fff;">
            <tr>
              <td style="padding:20px 24px;" align="center">
                <a href="${escapeHtml(appUrl)}" style="text-decoration:none;color:#111;display:inline-flex;align-items:center;gap:8px;">
                  <img src="${escapeHtml(logoUrl)}" width="32" height="32" alt="Change Reel" style="display:block;border-radius:6px;" />
                  <span style="font-size:17px;font-weight:500;letter-spacing:0.2px;">Change Reel</span>
                </a>
              </td>
            </tr>
      <tr>
        <td style="padding:16px 0px 10px 0px;">
          <div style="margin:0;font-size:12px;display:flex;align-items:center;gap:8px;color:#555;">
            <span style="display:inline-block;padding:2px 8px;border-radius:9999px;font-size:12px;font-weight:600;color:#111;">${escapeHtml(changeLabel)}</span>
          </div>
        </td>
      </tr>
      <tr>
        <td style="padding:12px 24px 16px 24px;border-bottom:1px solid #eee;">
          <br/>
          ${summaryHtml}
          <div style="font-size:12px;color:#555;">${escapeHtml(projectName)}</div>
          <div style="font-size:12px;color:#555;">On: ${escapeHtml(dateStr)}</div>
          <div style="font-size:12px;color:#555;">By: ${escapeHtml(commit.author ? extractDisplayName(commit.author) : 'Unknown')}</div>
          <br/>
        </td>
      </tr>
      <tr>
        <td style="padding:16px 24px 8px 24px;" align="center">
          <a href="${escapeHtml(appUrl)}" style="display:inline-block;padding:10px 16px;border:1px solid #111;border-radius:8px;color:#111;text-decoration:none;font-size:13px;font-weight:600;">See in Change Reel</a>
        </td>
      </tr>      
      <tr>
        <td style="padding:16px 24px 24px 24px;color:#555;font-size:12px;">
          Sent by,
          <br/>
          Change Reel
        </td>
      </tr>
      <tr>
        <td style="padding:8px 24px 24px 24px;color:#777;font-size:11px;" align="center">
          You’re receiving this because you enabled change alerts.
        </td>
      </tr>
          </table>
        </td>
      </tr>
    </table>
  </div>
  `

  const subject = `${headline}`

  return { subject, html }
}

function escapeHtml(input: string): string {
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}


function extractDisplayName(author: string): string {
  // Handles formats like "Name <email@domain>" or just "Name"
  const angleIndex = author.indexOf('<')
  const name = angleIndex > -1 ? author.slice(0, angleIndex).trim() : author.trim()
  return name || 'Unknown'
}


