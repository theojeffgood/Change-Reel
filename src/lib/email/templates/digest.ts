import { DigestTemplateData } from '../types'

export function renderDailyDigestHtml(data: DigestTemplateData): string {
  const items = data.commits.map(c => {
    const date = new Date(c.timestamp).toLocaleString()
    return `
      <tr>
        <td style="padding:8px;border-bottom:1px solid #eee;">
          <div style="font-weight:600;color:#111;">${escapeHtml(c.summary || 'Update')}</div>
          <div style="font-size:12px;color:#555;">${escapeHtml(c.author || 'Unknown')} • ${escapeHtml(c.sha.substring(0,7))} • ${escapeHtml(date)}</div>
        </td>
      </tr>
    `
  }).join('')

  return `
  <div style="font-family:Inter,system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif;background:#f7f7f8;padding:24px;">
    <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="max-width:640px;margin:0 auto;background:#fff;border-radius:8px;box-shadow:0 1px 3px rgba(0,0,0,0.06);">
      <tr>
        <td style="padding:24px 24px 8px 24px;">
          <h1 style="margin:0;font-size:20px;">${escapeHtml(data.projectName)} • Daily Changelog</h1>
          <p style="margin:8px 0 0 0;color:#555;font-size:14px;">${escapeHtml(new Date().toDateString())}</p>
        </td>
      </tr>
      ${items}
      <tr>
        <td style="padding:16px 24px 24px 24px;color:#777;font-size:12px;">
          Sent by Change Reel
        </td>
      </tr>
    </table>
  </div>
  `
}

function escapeHtml(input: string): string {
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}


