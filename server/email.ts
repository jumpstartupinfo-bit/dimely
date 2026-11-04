/**
 * server/email.ts
 *
 * Booking confirmation emails sent through Resend's HTTP API.
 * Server-only: RESEND_API_KEY must never reach the browser.
 *
 * Environment variables:
 *   RESEND_API_KEY  - Resend API key (if unset, emails are skipped and nothing is marked sent)
 *   EMAIL_FROM      - Sender, for example: Dimely <bookings@mydimely.com> (domain must be verified in Resend)
 *   APP_URL         - Public site URL used in call links (falls back to FRONTEND_URL)
 */

import db from './db'

const DEFAULT_APP_URL = 'https://www.mydimely.com'

function appUrl(): string {
  const raw = process.env.APP_URL ?? process.env.FRONTEND_URL ?? DEFAULT_APP_URL
  return raw.replace(/\/+$/, '')
}

function esc(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function formatWhen(date: string, startTime: string): string {
  const d = new Date(`${date}T${startTime}:00Z`)
  if (Number.isNaN(d.getTime())) return `${date} at ${startTime} UTC`
  const day = d.toLocaleDateString('en-GB', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC',
  })
  return `${day} at ${startTime} UTC`
}

interface EmailInput {
  to: string
  subject: string
  text: string
  html: string
}

async function sendViaResend(input: EmailInput): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY
  const from = process.env.EMAIL_FROM
  if (!apiKey || !from) throw new Error('RESEND_API_KEY and EMAIL_FROM must be set')

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from, to: [input.to], subject: input.subject, text: input.text, html: input.html }),
  })
  if (!res.ok) {
    const detail = (await res.text().catch(() => '')).slice(0, 300)
    throw new Error(`Resend responded ${res.status}: ${detail}`)
  }
}

function renderEmail(opts: {
  heading: string
  intro: string
  rows: [string, string][]
  callUrl: string
}): { text: string; html: string } {
  const text = [
    opts.heading,
    '',
    opts.intro,
    '',
    ...opts.rows.map(([k, v]) => `${k}: ${v}`),
    '',
    `Join your call: ${opts.callUrl}`,
    '',
    'Dimely',
  ].join('\n')

  const rowsHtml = opts.rows
    .map(([k, v]) => `<tr><td style="padding:6px 0;color:#64748B;width:110px">${esc(k)}</td><td style="padding:6px 0;color:#0F172A;font-weight:600">${esc(v)}</td></tr>`)
    .join('')

  const html = `<!doctype html><html><body style="margin:0;background:#F8FAFC;font-family:Arial,Helvetica,sans-serif">
<div style="max-width:520px;margin:0 auto;padding:32px 20px">
  <div style="background:#ffffff;border:1px solid #E2E8F0;border-radius:16px;padding:28px">
    <h1 style="margin:0 0 8px;font-size:22px;color:#0F172A">${esc(opts.heading)}</h1>
    <p style="margin:0 0 20px;color:#64748B;font-size:15px;line-height:1.5">${esc(opts.intro)}</p>
    <table style="width:100%;border-collapse:collapse;font-size:14px;margin-bottom:24px">${rowsHtml}</table>
    <a href="${esc(opts.callUrl)}" style="display:inline-block;background:#6366F1;color:#ffffff;text-decoration:none;font-weight:700;padding:14px 24px;border-radius:12px;font-size:15px">Join your call</a>
    <p style="margin:20px 0 0;color:#64748B;font-size:12px;line-height:1.5">If the button does not work, copy this link into your browser:<br>${esc(opts.callUrl)}</p>
  </div>
  <p style="text-align:center;color:#94A3B8;font-size:12px;margin-top:16px">Dimely</p>
</div></body></html>`
  return { text, html }
}

/**
 * Send the confirmation emails for a confirmed booking, at most once per booking.
 * Never throws: an email problem must not affect payment or booking state.
 */
export async function sendBookingEmails(bookingId: string): Promise<void> {
  if (!process.env.RESEND_API_KEY || !process.env.EMAIL_FROM) {
    console.warn('Booking emails skipped: RESEND_API_KEY or EMAIL_FROM is not set')
    return
  }

  let claimed = false
  try {
    // Claim the send so a retry or a second confirmation never emails twice.
    const claim = await db.get(
      `UPDATE bookings SET confirmation_emailed_at = NOW()
       WHERE id = $1 AND confirmation_emailed_at IS NULL AND status = 'confirmed'
       RETURNING id`,
      [bookingId],
    )
    if (!claim) return
    claimed = true

    const booking = await db.get(
      `SELECT b.*, hp.name AS host_name, hu.email AS host_email
       FROM bookings b
       LEFT JOIN profiles hp ON hp.id = b.profile_id
       LEFT JOIN users hu ON hu.id = b.host_id
       WHERE b.id = $1`,
      [bookingId],
    ) as Record<string, any> | undefined
    if (!booking) throw new Error('Booking not found')

    const callUrl = `${appUrl()}/call/${encodeURIComponent(bookingId)}`
    const when = formatWhen(String(booking.date), String(booking.start_time))
    const duration = `${Number(booking.duration_mins)} minutes`
    const callType = booking.call_type === 'video' ? 'Video call' : 'Voice call'
    const topic = booking.topic ? String(booking.topic) : ''
    const guestName = String(booking.guest_name || 'your guest')
    const hostName = String(booking.host_name || 'your host')

    const sends: Promise<void>[] = []

    if (booking.guest_email) {
      const rows: [string, string][] = [['With', hostName], ['When', when], ['Length', duration], ['Type', callType]]
      if (topic) rows.push(['Topic', topic])
      const { text, html } = renderEmail({
        heading: 'Your call is confirmed',
        intro: `Your payment is held securely until the call completes. Your call with ${hostName} is booked.`,
        rows,
        callUrl,
      })
      sends.push(sendViaResend({ to: String(booking.guest_email), subject: `Your call with ${hostName} is confirmed`, text, html }))
    }

    if (booking.host_email) {
      const rows: [string, string][] = [['With', guestName], ['When', when], ['Length', duration], ['Type', callType]]
      if (topic) rows.push(['Topic', topic])
      const { text, html } = renderEmail({
        heading: 'You have a new booking',
        intro: `${guestName} has booked a call with you. Payment is held securely and released after the call.`,
        rows,
        callUrl,
      })
      sends.push(sendViaResend({ to: String(booking.host_email), subject: `New booking from ${guestName}`, text, html }))
    }

    const results = await Promise.allSettled(sends)
    const failed = results.filter((r) => r.status === 'rejected') as PromiseRejectedResult[]
    if (failed.length > 0) {
      failed.forEach((f) => console.error('Booking email failed:', f.reason))
      // Release the claim only if nothing went out, so a later attempt can retry.
      if (failed.length === results.length) {
        await db.run(`UPDATE bookings SET confirmation_emailed_at = NULL WHERE id = $1`, [bookingId])
      }
    }
  } catch (err) {
    console.error('sendBookingEmails error:', err)
    if (claimed) {
      try {
        await db.run(`UPDATE bookings SET confirmation_emailed_at = NULL WHERE id = $1`, [bookingId])
      } catch { /* ignore */ }
    }
  }
}
