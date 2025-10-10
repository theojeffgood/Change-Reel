export interface SingleCommitEmailInput {
  projectName: string
  commit: {
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
    ? 'Bugfix'
    : 'Feature'
  const badgeStyles = commit.type === 'bugfix'
    ? 'display:inline-block;padding:2px 8px;border-radius:9999px;font-size:11px;font-weight:600;color:#7f1d1d;background:#ecfdf5;border:1px solid #fecaca'
    : 'display:inline-block;padding:2px 8px;border-radius:9999px;font-size:11px;font-weight:600;color:#065f46;background:#fef2f2;border:1px solid #a7f3d0;'

  const html = `
  <div style="font-family:Inter,system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif;background:#f7f7f8;padding:24px;">
    <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="max-width:640px;margin:0 auto;background:#fff;border-radius:8px;box-shadow:0 1px 3px rgba(0,0,0,0.06);">
      <tr>
        <td style="padding:24px 24px 8px 24px;">
          <div style="margin:0;font-size:12px;display:flex;align-items:center;gap:8px;">
            <span style="${badgeStyles}">${changeLabel}</span>
            <br/>
            <br/>
            <span>Repo: ${escapeHtml(projectName)}</span>
          </div>
        </td>
      </tr>
      <tr>
        <td style="padding:8px 24px 16px 24px;border-bottom:1px solid #eee;">
          <div style="font-size:12px;color:#555;">By: ${escapeHtml(commit.author || 'Unknown')}</div>
          <br/>
          <div style="font-size:12px;color:#111;">${escapeHtml(commit.summary)}</div>
          <br/>
          <div style="font-size:12px;color:#555;">On: ${escapeHtml(dateStr)}</div>
          <br/>
        </td>
      </tr>
      <tr>
        <td style="padding:16px 24px 24px 24px;color:#555;font-size:12px;">
          Sent by,
          <br/>
          Change Reel
        </td>
      </tr>
    </table>
  </div>
  `

  const subject = changeLabel === 'Bugfix'
    ? `There's a Bugfix in ${projectName}`
    : `There's a New Feature in ${projectName}`

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


