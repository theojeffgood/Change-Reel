export interface SingleCommitEmailInput {
  projectName: string
  commit: {
    summary: string
    author: string | null
    sha: string
    timestamp: string
  }
}

export function renderSingleCommitEmail(input: SingleCommitEmailInput): { subject: string; html: string } {
  const { projectName, commit } = input
  const date = new Date(commit.timestamp)
  const dateStr = date.toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' })

  const html = `
  <div style="font-family:Inter,system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif;background:#f7f7f8;padding:24px;">
    <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="max-width:640px;margin:0 auto;background:#fff;border-radius:8px;box-shadow:0 1px 3px rgba(0,0,0,0.06);">
      <tr>
        <td style="padding:24px 24px 8px 24px;">
          <div style="margin:0;font-size:12px;">Repo: ${escapeHtml(projectName)}</div>
        </td>
      </tr>
      <tr>
        <td style="padding:8px 24px 16px 24px;border-bottom:1px solid #eee;">
          <div style="font-size:12px;color:#555;">By: ${escapeHtml(commit.author || 'Unknown')}</div>
          <br/>
          <div style="font-size:12px;color:#111;">${escapeHtml(commit.summary)}</div>
          <br/>
          <div style="font-size:12px;color:#555;">On: ${escapeHtml(dateStr)}</div>
        </td>
      </tr>
      <tr>
        <td style="padding:16px 24px 24px 24px;color:#555;font-size:12px;">
          Sent by Change Reel
        </td>
      </tr>
    </table>
  </div>
  `

  return { subject: `We saw a change to ${projectName}`, html }
}

function escapeHtml(input: string): string {
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}


