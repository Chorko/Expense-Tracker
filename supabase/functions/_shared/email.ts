// Resend e-mail helper and shared HTML pieces for Ledger's reports.

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')
const FROM_EMAIL = Deno.env.get('RESEND_FROM_EMAIL') ?? 'Ledger <onboarding@resend.dev>'

/** Escapes text that goes into e-mail HTML (names, comments, categories). */
export function escapeHtml(value: unknown): string {
  return String(value ?? '').replace(/[&<>"']/g, char => {
    switch (char) {
      case '&': return '&amp;'
      case '<': return '&lt;'
      case '>': return '&gt;'
      case '"': return '&quot;'
      default: return '&#39;'
    }
  })
}

export function formatINR(amount: number): string {
  const value = Number.isFinite(amount) ? Math.round(amount) : 0
  return `₹${value.toLocaleString('en-IN')}`
}

/** Sends one e-mail via Resend. Returns an error string instead of throwing. */
export async function sendEmail(opts: {
  to: string
  subject: string
  html: string
}): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!RESEND_API_KEY) return { ok: false, error: 'RESEND_API_KEY is not set' }
  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: FROM_EMAIL, to: [opts.to], subject: opts.subject, html: opts.html }),
    })
    if (!response.ok) {
      const detail = await response.text().catch(() => '')
      return { ok: false, error: `Resend ${response.status}: ${detail.slice(0, 300)}` }
    }
    return { ok: true }
  } catch (cause) {
    return { ok: false, error: cause instanceof Error ? cause.message : String(cause) }
  }
}

/** Wraps content in the dark Ledger e-mail shell. `title` and `preheader` must be pre-escaped or plain. */
export function emailShell(opts: { title: string; preheader?: string; body: string }): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>${escapeHtml(opts.title)}</title>
</head>
<body style="margin:0;padding:0;background:#0d1117;font-family:'IBM Plex Sans',system-ui,-apple-system,sans-serif;color:#ece5d6;">
${opts.preheader ? `<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapeHtml(opts.preheader)}</div>` : ''}
<div style="max-width:600px;margin:0 auto;padding:32px 16px;">
<div style="text-align:center;margin-bottom:24px;">
<span style="display:inline-block;width:44px;height:44px;line-height:44px;border-radius:12px;background:#c9a84c;color:#0d1117;font-size:22px;font-weight:700;">&#8377;</span>
</div>
${opts.body}
<p style="margin:28px 0 0;text-align:center;font-size:11px;color:#8b8476;">
Ledger — personal finance tracker. You can turn these e-mails off in Settings.
</p>
</div>
</body>
</html>`
}

export function ctaButton(href: string, label: string): string {
  return `<div style="text-align:center;margin:24px 0 4px;">
<a href="${escapeHtml(href)}" style="display:inline-block;padding:12px 24px;background:#c9a84c;color:#0d1117;border-radius:8px;font-weight:600;text-decoration:none;font-size:14px;">${escapeHtml(label)}</a>
</div>`
}

export function card(inner: string): string {
  return `<div style="background:#161b22;border:1px solid rgba(201,168,76,0.14);border-radius:12px;padding:24px;">${inner}</div>`
}
