// Each functionality has its own email template. Operator-scoped emails inject the
// operator's name and branding. Every template returns both a subject and HTML body.
export interface RenderedEmail {
  subject: string;
  html: string;
}
type Vars = Record<string, any>;

// ---- Design tokens (Curate-inspired: warm, editorial, high-contrast) ----
const BRAND = '#3B82F6';        // accent blue
const BRAND_DARK = '#111318';   // near-black button
const INK = '#14161c';          // headings
const BODY = '#3d434d';         // body text
const MUTED = '#8a8f99';        // secondary
const PAGE = '#ece4d8';         // warm cream page background
const CARD = '#ffffff';
const LINE = '#ece7de';
const HILITE = '#f4e6a1';       // yellow marker highlight

type BannerTone = 'blue' | 'amber' | 'green';
const BANNER: Record<BannerTone, { bg: string; tx: string }> = {
  blue: { bg: '#3B82F6', tx: '#ffffff' },
  amber: { bg: '#efd9a0', tx: '#5a4a1a' },
  green: { bg: '#b7e39a', tx: '#2c4519' },
};

/** Small uppercase eyebrow / greeting label. */
const eyebrow = (t: string): string => `<div style="font-family:'Segoe UI',Arial,sans-serif;font-size:12px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:${MUTED};margin:0 0 10px;">${t}</div>`;

/** A colored accent word for inside headlines. */
const accent = (t: string): string => `<span style="color:${BRAND};">${t}</span>`;

/** Yellow marker highlight for a run of text. */
const highlight = (t: string): string => `<span style="background:${HILITE};padding:0 4px;border-radius:2px;">${t}</span>`;

/** Icon-style bullet list (colored dots). */
const bulletList = (items: string[]): string => `
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:14px 0;">
  ${items.map((it) => `<tr><td valign="top" style="padding:6px 0;font-family:'Segoe UI',Arial,sans-serif;">
    <span style="display:inline-block;width:7px;height:7px;border-radius:50%;background:${BRAND};margin:6px 12px 0 0;vertical-align:top;"></span>
    <span style="display:inline-block;width:88%;font-size:14px;line-height:1.6;color:${BODY};">${it}</span>
  </td></tr>`).join('')}
</table>`;

/** A customer testimonial with 5 stars. */
const testimonial = (quote: string, author: string): string => `
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:22px 0 6px;">
  <tr><td style="background:#faf7f1;border:1px solid ${LINE};border-radius:12px;padding:20px 22px;font-family:'Segoe UI',Arial,sans-serif;">
    <div style="font-size:15px;font-style:italic;color:${INK};line-height:1.6;margin:0 0 10px;">&ldquo;${quote}&rdquo;</div>
    <table role="presentation" width="100%"><tr>
      <td style="font-size:12px;font-weight:700;letter-spacing:.5px;color:${MUTED};text-transform:uppercase;">&mdash; ${author}</td>
      <td align="right" style="font-size:14px;color:#f5a623;letter-spacing:2px;">&#9733;&#9733;&#9733;&#9733;&#9733;</td>
    </tr></table>
  </td></tr>
</table>`;

/** A primary call-to-action button. */
// Site base URLs for links inside emails.
//  - CUSTOMER_URL  → yoobus.com      (booking, wallet, my trips, verify, password reset)
//  - APP_URL       → app.yoobus.com  (operator/staff console: dashboard, finance, sign-in)
const CUSTOMER_URL = (process.env.FRONTEND_URL || 'https://yoobus.com').replace(/\/+$/, '');
const APP_URL = (process.env.APP_FRONTEND_URL || 'https://app.yoobus.com').replace(/\/+$/, '');

const button = (label: string, url: string): string => `
<table role="presentation" cellpadding="0" cellspacing="0" style="margin:22px 0;"><tr>
  <td style="border-radius:10px;background:${BRAND_DARK};">
    <a href="${url}" style="display:inline-block;padding:13px 30px;font-family:'Segoe UI',Arial,sans-serif;font-size:14px;font-weight:700;color:#ffffff;text-decoration:none;letter-spacing:.3px;">${label} &rarr;</a>
  </td>
</tr></table>`;

/** A labelled key/value callout card. */
const callout = (title: string, rows: Array<[string, string]>): string => `
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:18px 0;">
  <tr><td style="background:#faf7f1;border:1px solid ${LINE};border-radius:12px;padding:18px 20px;font-family:'Segoe UI',Arial,sans-serif;">
    <div style="font-size:11px;font-weight:800;letter-spacing:1.2px;text-transform:uppercase;color:${MUTED};margin:0 0 12px;">${title}</div>
    <table role="presentation" width="100%">
      ${rows.map(([k, val]) => `<tr>
        <td style="padding:5px 0;font-size:13px;color:${MUTED};width:44%;vertical-align:top;">${k}</td>
        <td style="padding:5px 0;font-size:14px;font-weight:700;color:${INK};">${val}</td>
      </tr>`).join('')}
    </table>
  </td></tr>
</table>`;

/** Eyebrow label + large headline. */
const hero = (eyebrowText: string, headline: string): string =>
  `${eyebrow(eyebrowText)}<h1 style="font-family:'Segoe UI',Arial,sans-serif;font-size:25px;line-height:1.28;font-weight:800;color:${INK};margin:0 0 14px;">${headline}</h1>`;

/**
 * Premium, email-client-safe shell (table-based, inline styles) in a warm editorial style.
 * `opts.banner` renders the colored CTA strip under the header; `opts.tone` picks its color.
 */
const wrap = (body: string, brand = 'Yoo Bus', opts: { banner?: string; tone?: BannerTone; site?: 'customer' | 'app' } = {}): string => {
  const b = BANNER[opts.tone ?? 'blue'];
  const base = opts.site === 'app' ? APP_URL : CUSTOMER_URL;
  const headCta = opts.site === 'app' ? 'Open console' : 'Book a trip';
  const navItems: Array<[string, string]> = opts.site === 'app'
    ? [['Dashboard', '/'], ['Operations', '/operations/dashboard'], ['Finance', '/finance/summary']]
    : [['Book a Trip', '/search'], ['My Trips', '/travel/trips'], ['Wallet', '/travel/wallet']];
  const footLinks = navItems
    .map(([lbl, path]) => `<a href="${base}${path}" style="color:${BODY};text-decoration:none;padding-left:16px;">${lbl}</a>`)
    .join('');
  const bannerRow = opts.banner
    ? `<tr><td style="padding:14px 34px 0;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td style="background:${b.bg};border-radius:9px;padding:10px 18px;text-align:center;font-family:'Segoe UI',Arial,sans-serif;font-size:12px;font-weight:700;color:${b.tx};letter-spacing:.6px;text-transform:uppercase;">${opts.banner}</td></tr></table></td></tr>`
    : '';
  return `
<div style="margin:0;padding:0;background:${PAGE};">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${PAGE};padding:30px 12px;">
  <tr><td align="center">
    <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:${CARD};border-radius:16px;overflow:hidden;border:1px solid ${LINE};box-shadow:0 10px 30px rgba(60,45,20,0.10);">
      <!-- accent bar -->
      <tr><td style="padding:0;font-size:0;line-height:0;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
          <td style="background:${BRAND};height:5px;font-size:0;line-height:0;">&nbsp;</td>
          <td style="background:#6366F1;height:5px;font-size:0;line-height:0;">&nbsp;</td>
          <td style="background:#22C55E;height:5px;font-size:0;line-height:0;">&nbsp;</td>
        </tr></table>
      </td></tr>
      <!-- header -->
      <tr><td style="padding:24px 34px 18px;font-family:'Segoe UI',Arial,sans-serif;">
        <table role="presentation" width="100%"><tr>
          <td style="font-size:18px;font-weight:800;color:${INK};letter-spacing:.2px;"><a href="${base}" style="text-decoration:none;color:${INK};"><span style="display:inline-block;width:30px;height:30px;line-height:30px;text-align:center;background:${BRAND};color:#ffffff;border-radius:9px;font-weight:800;font-size:15px;vertical-align:middle;margin-right:10px;">Y</span>${brand}<span style="color:${MUTED};font-weight:600;font-size:11px;letter-spacing:1.4px;"> MOBILITY</span></a></td>
          <td align="right" style="font-size:12px;font-weight:700;white-space:nowrap;">
            <a href="${base}${opts.site === 'app' ? '' : '/search'}" style="color:${MUTED};text-decoration:none;">${headCta}</a>
            &nbsp;&nbsp;<a href="${base}/sign-in" style="color:${BRAND_DARK};text-decoration:none;">Sign in &rarr;</a>
          </td>
        </tr></table>
      </td></tr>
      ${bannerRow}
      <!-- body -->
      <tr><td style="padding:32px 34px;font-family:'Segoe UI',Arial,sans-serif;font-size:15px;line-height:1.65;color:${BODY};">
        ${body}
      </td></tr>
      <!-- footer -->
      <tr><td style="background:#faf7f1;border-top:1px solid ${LINE};padding:26px 34px;font-family:'Segoe UI',Arial,sans-serif;">
        <table role="presentation" width="100%"><tr>
          <td style="font-size:15px;font-weight:800;color:${INK};vertical-align:middle;"><span style="display:inline-block;width:22px;height:22px;line-height:22px;text-align:center;background:${BRAND};color:#fff;border-radius:6px;font-size:12px;font-weight:800;vertical-align:middle;margin-right:8px;">Y</span>${brand}<span style="color:${MUTED};font-weight:600;"> Mobility</span></td>
          <td align="right" style="font-size:12px;font-weight:700;">${footLinks}<a href="mailto:support@yoobus.com" style="color:${BODY};text-decoration:none;padding-left:16px;">Support</a></td>
        </tr></table>
        <div style="height:1px;background:${LINE};margin:16px 0;font-size:0;line-height:0;">&nbsp;</div>
        <p style="margin:0 0 5px;font-size:11px;color:${MUTED};line-height:1.7;">Need help? <a href="mailto:support@yoobus.com" style="color:${BRAND_DARK};text-decoration:none;font-weight:600;">support@yoobus.com</a></p>
        <p style="margin:0;font-size:11px;color:${MUTED};line-height:1.6;">&copy; ${new Date().getFullYear()} Yoo Bus Mobility Pvt. Ltd. — intelligent, connected, digital-first transportation.<br>This is an automated message; please do not reply.</p>
      </td></tr>
    </table>
  </td></tr>
</table>
</div>`;
};

/** Bulletproof dark pill CTA with a trailing arrow. */
const btn = (label: string, url = '#'): string => `
<table role="presentation" cellpadding="0" cellspacing="0" style="margin:22px 0;"><tr>
  <td align="center" style="border-radius:999px;background:${BRAND_DARK};">
    <a href="${url}" style="display:inline-block;padding:13px 30px;font-family:'Segoe UI',Arial,sans-serif;font-size:14px;font-weight:700;color:#ffffff;text-decoration:none;border-radius:999px;">${label} &nbsp;&rarr;</a>
  </td>
</tr></table>`;

/** Large OTP code display. */
const otpBox = (code: string, expiryMin: number | string = 5): string => `
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:22px 0;"><tr>
  <td align="center" style="background:#f7f4ee;border:1px solid ${LINE};border-radius:14px;padding:26px 20px;">
    <div style="font-family:'Segoe UI',Arial,sans-serif;font-size:12px;font-weight:700;letter-spacing:2px;color:${MUTED};text-transform:uppercase;margin-bottom:12px;">Verification Code</div>
    <div style="font-family:'Courier New',monospace;font-size:38px;font-weight:800;letter-spacing:12px;color:${INK};padding-left:12px;">${code}</div>
    <div style="font-family:'Segoe UI',Arial,sans-serif;font-size:12px;color:${MUTED};margin-top:14px;">Expires in <b>${expiryMin} minutes</b></div>
  </td>
</tr></table>`;

/** Key/value detail rows. */
const detailTable = (rows: [string, string][]): string => `
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:18px 0;border:1px solid ${LINE};border-radius:12px;overflow:hidden;">
  ${rows.map(([k, val], idx) => `<tr style="background:${idx % 2 ? '#ffffff' : '#faf7f1'};">
    <td style="padding:11px 16px;font-family:'Segoe UI',Arial,sans-serif;font-size:13px;color:${MUTED};width:42%;">${k}</td>
    <td style="padding:11px 16px;font-family:'Segoe UI',Arial,sans-serif;font-size:14px;font-weight:600;color:${INK};">${val}</td>
  </tr>`).join('')}
</table>`;

/** Small note / callout. */
const note = (text: string, tone: 'info' | 'warn' = 'info'): string => {
  const c = tone === 'warn' ? { bg: '#fbf3df', bd: '#e8c974', tx: '#7a5a12' } : { bg: '#eef5ff', bd: '#a8c9f5', tx: '#1c4f92' };
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:18px 0;"><tr>
    <td style="background:${c.bg};border-left:4px solid ${c.bd};border-radius:8px;padding:12px 16px;font-family:'Segoe UI',Arial,sans-serif;font-size:13px;color:${c.tx};line-height:1.6;">${text}</td>
  </tr></table>`;
};
const h1 = (t: string): string => `<h1 style="margin:0 0 12px;font-family:'Segoe UI',Arial,sans-serif;font-size:30px;font-weight:800;line-height:1.15;color:${INK};letter-spacing:-.3px;">${t}</h1>`;
const p = (t: string): string => `<p style="margin:0 0 14px;font-family:'Segoe UI',Arial,sans-serif;font-size:15px;line-height:1.65;color:${BODY};">${t}</p>`;

export const TEMPLATES: Record<string, (v: Vars) => RenderedEmail> = {
  // ---- Passenger ----
  OTP_REGISTER: (v) => ({
    subject: 'Your Yoo Bus verification code',
    html: wrap(
      h1('Verify your email') +
      p('Welcome to Yoo Bus! Use the code below to verify your email and activate your account.') +
      otpBox(v.otp, v.expiryMin || 5) +
      note('Never share this code with anyone — Yoo Bus staff will never ask for it. If you did not request this, you can safely ignore this email.', 'warn'),
    ),
  }),
  WELCOME_USER: (v) => ({
    subject: 'Welcome to Yoo Bus',
    html: wrap(
      eyebrow(`Greetings, ${v.name}`) +
      h1(`Welcome to ${accent('Yoo Bus')}`) +
      p('Your account is ready. Here is everything you need to travel smarter \u2014 book intercity trips, track your bus live, and manage it all from one place.') +
      btn('Book your first trip', `${CUSTOMER_URL}/search`) +
      p(`<b>What you get:</b>`) +
      bulletList([
        'Live bus tracking and boarding alerts',
        'Wallet, loyalty points and referral rewards',
        'Fare freeze and price-drop alerts',
        'One-tap rebooking and seat-available alerts',
      ]) +
      p(`Over the next week we'll send you ${highlight('tips to get the most out of Yoo Bus')}.`) +
      testimonial("Booking was effortless and the live tracking is a game-changer. I'll never go back.", 'Holly Sutton, Bengaluru'),
      'Yoo Bus',
      { banner: 'Start your journey \u2014 book now', tone: 'amber' },
    ),
  }),
  BOOKING_CONFIRMED: (v) => ({
    subject: `Your ticket is confirmed — PNR ${v.pnr}`,
    html: wrap(
      h1('Your ticket is confirmed! ') +
      p(`Hi ${v.name}, your seat is booked. Here are your trip details:`) +
      detailTable([
        ['PNR', String(v.pnr)],
        ['Operator', String(v.operatorName)],
        ['Route', `${v.from} &rarr; ${v.to}`],
        ['Date & time', `${v.date} ${v.time}`],
        ['Seats', String(v.seats)],
        ['Fare', `&#8377;${v.baseFare} + GST &#8377;${v.fareGst} = <b>&#8377;${v.payable}</b>`],
      ]) +
      note('Your QR code and PDF ticket are attached — please carry the ticket while boarding.'),
      v.operatorName,
    ),
  }),
  PAYMENT_REMINDER: (v) => ({
    subject: 'Your seat is reserved — please complete payment soon',
    html: wrap(
      `<p>Hi ${v.name},</p><p>You were booking a trip from ${v.from} to ${v.to}, and your seat is still being held for you. Please complete the payment soon so you do not lose your reserved seat.</p>`,
    ),
  }),
  BOOKING_CANCELLED: (v) => ({
    subject: `Your booking has been cancelled — PNR ${v.pnr}`,
    html: wrap(
      `<p>Hi ${v.name},</p><p>Your booking with PNR ${v.pnr} has been cancelled. A refund of &#8377;${v.refund} has been initiated to your original payment method and will reflect shortly.</p>`,
      v.operatorName,
    ),
  }),
  TRIP_REMINDER: (v) => ({
    subject: `Reminder: your trip is tomorrow — PNR ${v.pnr}`,
    html: wrap(
      `<p>Hi ${v.name},</p><p>This is a friendly reminder about your upcoming trip from ${v.from} to ${v.to} on ${v.date} at ${v.time}. Your boarding point is ${v.boarding}. Please arrive at least 15 minutes early.</p>`,
      v.operatorName,
    ),
  }),
  // ---- Operator onboarding ----
  LEAD_RECEIVED: (v) => ({
    subject: 'We have received your Yoo Bus operator application',
    html: wrap(
      `${hero('Application received', `Thanks, ${v.contactName} — we&rsquo;ve got it.`)}
       <p>Your application for ${highlight(v.companyName)} has reached our onboarding team. Every detail and document you submitted has been safely recorded.</p>
       ${callout('What happens next', [['Status', 'Received &middot; pending review'], ['Typical review time', 'About 24 hours'], ['Updates', 'By email, at every step']])}
       <p style="color:${MUTED};font-size:13px;">Nothing is needed from you right now — we&rsquo;ll email you the moment your status changes.</p>`,
      'Yoo Bus', { banner: 'Application received', tone: 'blue' },
    ),
  }),
  OPERATOR_UNDER_REVIEW: (v) => ({
    subject: 'Your Yoo Bus application is under review',
    html: wrap(
      `${hero('Under review', `We&rsquo;re reviewing ${v.companyName}.`)}
       <p>Hi ${v.contactName}, our team has picked up your application and is going through your details and documents. We&rsquo;ll let you know as soon as there is an update.</p>
       ${callout('Current status', [['Status', 'Under review'], ['Next step', 'Verification &amp; decision']])}`,
      'Yoo Bus', { banner: 'Under review', tone: 'amber' },
    ),
  }),
  OPERATOR_VERIFICATION_STARTED: (v) => ({
    subject: 'Your documents are being verified',
    html: wrap(
      `${hero('Verification started', `We&rsquo;re verifying your documents.`)}
       <p>Hi ${v.contactName}, your submitted documents are now under verification. This usually takes about 24 hours, and we&rsquo;ll email you the moment the review is complete.</p>
       ${callout('Current status', [['Status', 'Verification in progress'], ['Typical time', '~24 hours']])}`,
      'Yoo Bus', { banner: 'Verification in progress', tone: 'amber' },
    ),
  }),
  OPERATOR_APPROVED: (v) => ({
    subject: 'Your Yoo Bus operator account is now active',
    html: wrap(
      `${hero('Approved', `Welcome aboard, ${v.contactName}!`)}
       <p>${highlight(v.companyName)} is now live on Yoo Bus. Here are your admin login credentials &mdash; please keep them safe.</p>
       ${callout('Your login credentials', [['Login email', v.adminEmail], ['Temporary password', v.tempPassword], ['Operator code', `#${v.operatorCode}`]])}
       ${button('Sign in to your dashboard', `${APP_URL}/sign-in`)}
       ${callout('Your commercial terms', [['Commission', `${(v.commissionRate * 100).toFixed(2)}% per seat`], ['Setup fee', `&#8377;${v.setupFee} per bus`]])}
       <p style="color:${MUTED};font-size:13px;">For your security, please sign in and change your password right away.</p>`,
      v.companyName, { banner: 'Account activated', tone: 'green', site: 'app' },
    ),
  }),
  OPERATOR_REJECTED: (v) => ({
    subject: 'Update on your Yoo Bus application',
    html: wrap(
      `${hero('Application update', `An update on your application, ${v.contactName}.`)}
       <p>Thank you for applying to Yoo Bus. After a careful review, we are unable to approve your application at this time.</p>
       ${callout('Reason', [['Details', v.reason]])}
       <p>You&rsquo;re welcome to address the points above and apply again &mdash; we&rsquo;d be glad to take another look.</p>`,
      'Yoo Bus', { banner: 'Application update', tone: 'amber' },
    ),
  }),
  // ---- Operator staff ----
  STAFF_CREATED: (v) => ({
    subject: `${v.operatorName} — your ${v.role} account has been created`,
    html: wrap(
      `<p>Hi ${v.name},</p><p>${v.operatorName} has created a ${v.role} account for you on Yoo Bus.</p><p><b>Login:</b> ${v.email}<br/><b>Temporary password:</b> ${v.tempPassword}</p><p>Please log in and change your password right away.</p>`,
      v.operatorName,
    ),
  }),
  DRIVER_DUTY_ASSIGNED: (v) => ({
    subject: `Duty assigned for ${v.date}`,
    html: wrap(
      `<p>Hi ${v.name},</p><p>You have been assigned to bus ${v.busReg} on route ${v.routeName}, departing ${v.date} at ${v.time}. Please report on time and have a safe trip.</p>`,
      v.operatorName,
    ),
  }),
  // ---- Billing ----
  SETUP_INVOICE: (v) => ({
    subject: `Setup invoice ${v.invoiceNumber} — &#8377;${v.amount}`,
    html: wrap(
      `<p>Hi ${v.operatorName},</p><p>An invoice has been generated for the setup of bus ${v.busReg}. Invoice ${v.invoiceNumber}: <b>&#8377;${v.amount}</b>.</p>`,
      v.operatorName,
    ),
  }),
  // ---- Platform maintenance ----
  MAINTENANCE_SCHEDULED: (v) => ({
    subject: `Scheduled maintenance — ${new Date(v.startAt).toUTCString()}`,
    html: wrap(
      `<p>Hi ${v.operatorName},</p>
       <p>Yoo Bus has scheduled platform maintenance during the window below.</p>
       <p><b>From:</b> ${new Date(v.startAt).toUTCString()}<br/><b>To:</b> ${new Date(v.endAt).toUTCString()}</p>
       <p>During this window, dashboard changes will be temporarily disabled. <b>Passenger bookings will continue to work as usual.</b></p>
       <p>${v.message || ''}</p>`,
      v.operatorName,
    ),
  }),
  MAINTENANCE_REMINDER: (v) => ({
    subject: `Reminder: scheduled maintenance in ${v.daysBefore} day(s)`,
    html: wrap(
      `<p>Hi ${v.operatorName},</p>
       <p>This is a reminder that platform maintenance is scheduled in <b>${v.daysBefore} day(s)</b>.</p>
       <p><b>From:</b> ${new Date(v.startAt).toUTCString()}<br/><b>To:</b> ${new Date(v.endAt).toUTCString()}</p>
       <p>Dashboard changes will be paused during this window, while passenger bookings continue normally.</p>
       <p>${v.message || ''}</p>`,
      v.operatorName,
    ),
  }),
  // ---- Authentication ----
  OTP_LOGIN: (v) => ({
    subject: 'Your Yoo Bus login code',
    html: wrap(
      h1('Your login code') +
      p('Use the one-time code below to sign in to your Yoo Bus account.') +
      otpBox(v.otp, v.expiryMin || 5) +
      note('If this was not you, please secure your account. Never share this code with anyone.', 'warn'),
    ),
  }),
  PASSWORD_RESET: (v) => ({
    subject: 'Reset your Yoo Bus password',
    html: wrap(
      `<p>Hi ${v.fullName ?? v.name ?? 'there'},</p>` +
      `<p>We received a request to reset the password for your Yoo Bus account. ` +
      `Click the button below to choose a new password. This link expires in ${v.expiryMinutes ?? 30} minutes and can be used once.</p>` +
      `<p style="text-align:center;margin:24px 0">` +
      `<a href="${CUSTOMER_URL}/reset-password?token=${v.resetToken}" ` +
      `style="background:#1f6feb;color:#fff;padding:12px 28px;border-radius:6px;text-decoration:none;font-weight:bold">Reset password</a></p>` +
      `<p style="font-size:13px;color:#555">If the button does not work, copy this link into your browser:<br>` +
      `<span style="word-break:break-all">https://app.yoobus.com/reset-password?token=${v.resetToken}</span></p>` +
      `<p>If you did not request this, you can safely ignore this email — your password will remain unchanged.</p>`,
    ),
  }),
  // ---- Payments & refunds ----
  PAYMENT_SUCCESS: (v) => ({
    subject: `Payment received — PNR ${v.pnr}`,
    html: wrap(
      `<p>Hi ${v.name},</p><p>We have successfully received your payment of <b>&#8377;${v.amount}</b> for booking ${v.pnr}. Your ticket is confirmed and attached.</p>`,
      v.operatorName,
    ),
  }),
  PAYMENT_FAILED: (v) => ({
    subject: 'Your payment could not be completed',
    html: wrap(
      `<p>Hi ${v.name},</p><p>Unfortunately, your payment for booking ${v.pnr} did not go through. Your seats are held for a short time, so please try paying again soon to avoid losing them.</p>`,
      v.operatorName,
    ),
  }),
  REFUND_PROCESSED: (v) => ({
    subject: `Refund processed — PNR ${v.pnr}`,
    html: wrap(
      `<p>Hi ${v.name},</p><p>A refund of <b>&#8377;${v.refundAmount}</b> for booking ${v.pnr} has been credited to your Yoo Bus wallet. A cancellation charge of &#8377;${v.cancellationCharge} was applied as per the cancellation policy.</p>`,
      v.operatorName,
    ),
  }),
  BOOKING_RESCHEDULED: (v) => ({
    subject: `Your booking has been rescheduled — PNR ${v.pnr}`,
    html: wrap(
      `<p>Hi ${v.name},</p><p>Your booking ${v.pnr} has been successfully moved to a new trip on ${v.date} at ${v.time}. ${v.fareDifference ? 'A fare difference of &#8377;' + v.fareDifference + ' was settled through your wallet.' : ''}</p>`,
      v.operatorName,
    ),
  }),
  // ---- Wallet & loyalty ----


  REVIEW_REQUEST: (v) => ({
    subject: 'How was your trip?',
    html: wrap(
      `<p>Hi ${v.name},</p><p>We hope you enjoyed your recent trip with ${v.operatorName}. We would love to hear your feedback — it only takes a minute and helps other travelers.</p>`,
      v.operatorName,
    ),
  }),
  // ---- Trips ----
  TRIP_CANCELLED: (v) => ({
    subject: `Trip cancelled — PNR ${v.pnr}`,
    html: wrap(
      `<p>Hi ${v.name},</p><p>We are sorry to inform you that your trip from ${v.from} to ${v.to} on ${v.date} has been cancelled by the operator. A full refund of &#8377;${v.refund} has been initiated to your original payment method.</p>`,
      v.operatorName,
    ),
  }),
  // ---- Operator account lifecycle ----
  OPERATOR_SUSPENDED: (v) => ({
    subject: 'Your Yoo Bus operator account has been suspended',
    html: wrap(
      `<p>Hi ${v.operatorName},</p><p>Your operator account has been temporarily suspended. ${v.reason ? 'Reason: ' + v.reason + '.' : ''} New bookings on your storefront are paused while existing bookings are honored. Please contact the Yoo Bus team for assistance.</p>`,
      v.operatorName,
    ),
  }),
  OPERATOR_REACTIVATED: (v) => ({
    subject: 'Your Yoo Bus operator account is active again',
    html: wrap(
      `<p>Hi ${v.operatorName},</p><p>Good news — your operator account has been reactivated and your storefront is live again. Welcome back.</p>`,
      v.operatorName,
    ),
  }),
  COMMISSION_UPDATED: (v) => ({
    subject: 'Your commission rate has been updated',
    html: wrap(
      `<p>Hi ${v.operatorName},</p><p>Your per-seat commission rate has been updated to <b>${(v.commissionRate * 100).toFixed(2)}%</b>, effective for new bookings. Existing bookings keep the rate that applied at the time of sale.</p>`,
      v.operatorName,
    ),
  }),
  DOMAIN_VERIFIED: (v) => ({
    subject: 'Your custom domain is verified',
    html: wrap(
      `<p>Hi ${v.operatorName},</p><p>Your domain <b>${v.host}</b> has been verified and is now mapped to your Yoo Bus storefront.</p>`,
      v.operatorName,
    ),
  }),
  // ---- Settlement ----
  SETTLEMENT_PAID: (v) => ({
    subject: `Settlement paid — &#8377;${v.payout}`,
    html: wrap(
      `<p>Hi ${v.operatorName},</p><p>Your settlement for the period ${v.periodFrom} to ${v.periodTo} has been paid. <b>Net payout: &#8377;${v.payout}</b>. A detailed statement is available in your billing dashboard.</p>`,
      v.operatorName,
    ),
  }),
  LOW_RATING_ALERT: (v) => ({
    subject: 'A traveler left a low rating',
    html: wrap(
      `<p>Hi ${v.operatorName},</p><p>A passenger recently rated a trip <b>${v.rating}/5</b>. We recommend reviewing the feedback in your dashboard to keep your service quality high.</p>`,
      v.operatorName,
    ),
  }),
  PASSWORD_CHANGED: (v) => ({
    subject: 'Your Yoo Bus password was changed',
    html: wrap(
      h1('Password updated') +
      p(`Hi ${v.fullName ?? 'there'}, this confirms that the password for your Yoo Bus account was just changed.`) +
      `<p>If you made this change, no action is needed. If you did <strong>not</strong> change your password, ` +
      `please <a href="${CUSTOMER_URL}/forgot-password">reset it now</a> and contact support right away.</p>` +
      `<p style="font-size:13px;color:#555">For your security, all devices have been signed out.</p>`,
    ),
  }),
  // ---- Approval workflow ----
  APPROVAL_REQUESTED: (v) => ({
    subject: `Approval needed: ${v.type} request`,
    html: wrap(
      `<p>Hi ${v.approverName ?? 'there'},</p>` +
      `<p><strong>${v.requesterName ?? 'A team member'}</strong> has raised a <strong>${v.type}</strong> request that needs your approval.</p>` +
      `<table style="width:100%;border-collapse:collapse;margin:12px 0">` +
      `<tr><td style="padding:6px 0;color:#555">Reason</td><td style="padding:6px 0"><b>${v.reason ?? '-'}</b></td></tr>` +
      (v.amount ? `<tr><td style="padding:6px 0;color:#555">Amount</td><td style="padding:6px 0"><b>&#8377;${v.amount}</b></td></tr>` : '') +
      `</table>` +
      `<p style="text-align:center;margin:20px 0"><a href="https://app.yoobus.com/approvals/${v.requestId}" style="background:#1f6feb;color:#fff;padding:12px 28px;border-radius:6px;text-decoration:none;font-weight:bold">Review request</a></p>` +
      `<p style="font-size:13px;color:#555">You are receiving this because you are an approver for ${v.operatorName ?? 'your operator'}.</p>`,
      v.operatorName,
    ),
  }),
  APPROVAL_APPROVED: (v) => ({
    subject: `Your ${v.type} request was approved`,
    html: wrap(
      `<p>Hi ${v.requesterName ?? 'there'},</p>` +
      `<p>Good news — your <strong>${v.type}</strong> request has been <strong style="color:#137333">approved</strong>` +
      `${v.decidedByName ? ` by ${v.decidedByName}` : ''}.</p>` +
      (v.note ? `<p style="color:#555">Note: ${v.note}</p>` : '') +
      `<p>No further action is needed from you.</p>`,
      v.operatorName,
    ),
  }),
  APPROVAL_REJECTED: (v) => ({
    subject: `Your ${v.type} request was not approved`,
    html: wrap(
      `<p>Hi ${v.requesterName ?? 'there'},</p>` +
      `<p>Your <strong>${v.type}</strong> request was <strong style="color:#c5221f">not approved</strong>` +
      `${v.decidedByName ? ` by ${v.decidedByName}` : ''}.</p>` +
      (v.note ? `<p style="color:#555">Reason: ${v.note}</p>` : '') +
      `<p>If you believe this needs another look, please raise a new request with more detail or contact your manager.</p>`,
      v.operatorName,
    ),
  }),
  // ---- Support & operations ----
  SUPPORT_TICKET_CREATED: (v) => ({
    subject: `We received your request — ticket #${v.ticketId}`,
    html: wrap(
      `<p>Hi ${v.name ?? 'there'},</p>` +
      `<p>Thanks for reaching out. We have logged your request and our support team is on it.</p>` +
      `<table style="width:100%;border-collapse:collapse;margin:12px 0">` +
      `<tr><td style="padding:6px 0;color:#555">Ticket</td><td style="padding:6px 0"><b>#${v.ticketId}</b></td></tr>` +
      `<tr><td style="padding:6px 0;color:#555">Subject</td><td style="padding:6px 0"><b>${v.subject ?? '-'}</b></td></tr></table>` +
      `<p>We typically respond within one business day. You can reply to this ticket from your account at any time.</p>`,
      v.operatorName,
    ),
  }),
  SUPPORT_TICKET_RESOLVED: (v) => ({
    subject: `Your request has been resolved — ticket #${v.ticketId}`,
    html: wrap(
      `<p>Hi ${v.name ?? 'there'},</p>` +
      `<p>Your support ticket <b>#${v.ticketId}</b> has been marked as resolved.</p>` +
      (v.resolution ? `<p style="color:#555">${v.resolution}</p>` : '') +
      `<p>If your issue is not fully resolved, simply reply and we will reopen the ticket for you.</p>`,
      v.operatorName,
    ),
  }),
  TRIP_DISRUPTION: (v) => ({
    subject: `Important update about your trip — PNR ${v.pnr}`,
    html: wrap(
      `<p>Hi ${v.name ?? 'there'},</p>` +
      `<p>We want to let you know about a change affecting your upcoming trip (PNR <b>${v.pnr}</b>).</p>` +
      `<p style="background:#fff8e1;border-left:4px solid #f9a825;padding:10px 14px">${v.message ?? 'Your service is experiencing a disruption. Our team is actively working on it.'}</p>` +
      `<p>${v.action ?? 'No action is needed right now — we will keep you posted. We are sorry for the inconvenience.'}</p>`,
      v.operatorName,
    ),
  }),
  SEAT_UPGRADE_OFFER: (v) => ({
    subject: `Upgrade your seat to ${v.toCategory} — PNR ${v.pnr}`,
    html: wrap(
      `<p>Hi ${v.name ?? 'there'},</p>` +
      `<p>An upgrade is available for your booking <b>${v.pnr}</b>: move from <b>${v.fromCategory}</b> to <b>${v.toCategory}</b>` +
      `${Number(v.fareDifference) > 0 ? ` for just <b>&#8377;${v.fareDifference}</b> more` : ' at no extra cost'}.</p>` +
      `<p style="text-align:center;margin:20px 0"><a href="${CUSTOMER_URL}/travel/trips" style="background:${BRAND_DARK};color:#fff;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:bold">View upgrade</a></p>` +
      `<p style="font-size:13px;color:#555">Offer subject to availability.</p>`,
      v.operatorName,
    ),
  }),
  PASSENGER_TRANSFER_DONE: (v) => ({
    subject: `Your booking was moved — new PNR ${v.newPnr}`,
    html: wrap(
      `<p>Hi ${v.name ?? 'there'},</p>` +
      `<p>Your booking has been transferred to a different service. Your new ticket details are below and a fresh ticket is attached.</p>` +
      `<table style="width:100%;border-collapse:collapse;margin:12px 0">` +
      `<tr><td style="padding:6px 0;color:#555">New PNR</td><td style="padding:6px 0"><b>${v.newPnr}</b></td></tr></table>` +
      `<p>Please use the new ticket for boarding. Your previous ticket is no longer valid.</p>`,
      v.operatorName,
    ),
  }),
  // ---- Operator daily statement ----
  OPERATOR_DAILY_STATEMENT: (v) => ({
    subject: `Daily statement — ${v.date} — ${v.operatorName}`,
    html: wrap(
      h1('Daily Statement') +
      p(`Hi ${v.operatorName}, here is your booking and finance summary for <b>${v.date}</b>.`) +
      `<p style="margin:22px 0 8px;font-size:13px;font-weight:700;letter-spacing:1px;color:#5b6675;text-transform:uppercase;">Booking activity</p>` +
      detailTable([
        ['Confirmed bookings', String(v.confirmedCount)],
        ['Cancelled bookings', String(v.cancelledCount)],
        ['Pending (awaiting payment)', String(v.pendingCount)],
        ['Total bookings', `<b>${v.totalBookings}</b>`],
        ['Gross confirmed sales', `&#8377;${v.grossSales}`],
      ]) +
      `<p style="margin:22px 0 8px;font-size:13px;font-weight:700;letter-spacing:1px;color:#5b6675;text-transform:uppercase;">Payments &amp; refunds</p>` +
      detailTable([
        ['Payments received', `${v.paymentsCount} &nbsp;&bull;&nbsp; &#8377;${v.paymentsAmount}`],
        ['Refunds to source', `${v.refundsCount} &nbsp;&bull;&nbsp; &#8377;${v.refundsAmount}`],
      ]) +
      `<p style="margin:22px 0 8px;font-size:13px;font-weight:700;letter-spacing:1px;color:#5b6675;text-transform:uppercase;">Platform bill (GST compliant)</p>` +
      detailTable([
        ['Commission (base)', `&#8377;${v.commissionBase}`],
        ['Commission GST (18%)', `&#8377;${v.commissionGst}`],
        ['TCS (1%)', `&#8377;${v.tcs}`],
        ['TDS (0.1%)', `&#8377;${v.tds}`],
        ['Total platform charge', `<b>&#8377;${v.platformCharge}</b>`],
        ['Your net settlement', `<b style="color:#0a6b45;">&#8377;${v.operatorNet}</b>`],
      ]) +
      note('This is an automated end-of-day statement. Figures are provisional until settlement is finalized. Taxes shown per Indian GST norms (CGST/SGST/IGST as applicable), TCS and TDS.'),
      v.operatorName,
    ),
  }),
  // ---- Seat available again (back-in-stock alert) ----
  SEAT_AVAILABLE_ALERT: (v) => ({
    subject: `Seats just opened up — ${v.from} to ${v.to}!`,
    html: wrap(
      h1('A seat just opened up! ') +
      p(`Hi ${v.name ?? 'there'}, great news — the bus you were checking (<b>${v.from} &rarr; ${v.to}</b> on <b>${v.date}</b>) was full, but a seat just became available.`) +
      note(`Seats can get booked again quickly — grab yours now.`, 'warn') +
      btn('Book now', v.bookUrl ?? `${CUSTOMER_URL}/search`) +
      p(`Operator: <b>${v.operatorName ?? 'Yoo Bus'}</b>${v.availableCount ? ` &bull; ${v.availableCount} seat(s) available` : ''}.`),
      v.operatorName,
    ),
  }),
  // ---- Wallet & loyalty ----
  WALLET_CREDITED: (v) => ({
    subject: `\u20b9${v.amount} added to your Yoo Bus wallet`,
    html: wrap(
      h1('Wallet credited') +
      p(`Hi ${v.name ?? 'there'}, <b>&#8377;${v.amount}</b> has been added to your Yoo Bus wallet${v.reason ? ` (${v.reason})` : ''}.`) +
      detailTable([['Amount', `&#8377;${v.amount}`], ['New balance', `&#8377;${v.balance ?? '-'}`]]) +
      note('Use your wallet balance to pay for your next trip in a tap.'),
      'Yoo Bus',
    ),
  }),
  FARE_FROZEN: (v) => ({
    subject: `Your fare is locked \u2014 book within ${v.hours ?? 6}h`,
    html: wrap(
      h1('Fare locked ') +
      p(`Hi ${v.name ?? 'there'}, we've locked your fare of <b>&#8377;${v.lockedFarePerSeat}</b> per seat.`) +
      detailTable([['Locked fare/seat', `&#8377;${v.lockedFarePerSeat}`], ['Valid until', String(v.expiresAt ?? '-')]]) +
      note('Use your freeze token at checkout before it expires \u2014 the price won\u2019t change even if fares rise.', 'warn'),
      'Yoo Bus',
    ),
  }),
  // ---- Account security ----
  EMAIL_VERIFY: (v) => ({
    subject: 'Verify your Yoo Bus email',
    html: wrap(
      h1('Confirm your email') +
      p(`Hi ${v.name ?? 'there'}, please confirm your email address to secure your Yoo Bus account.`) +
      btn('Verify email', v.verifyUrl ?? (v.token ? `${CUSTOMER_URL}/verify-email?token=${v.token}` : `${CUSTOMER_URL}/account`)) +
      note('This link expires in 24 hours. If you didn\u2019t create this account, you can ignore this email.'),
      'Yoo Bus',
    ),
  }),
  NEW_DEVICE_LOGIN: (v) => ({
    subject: 'New sign-in to your Yoo Bus account',
    html: wrap(
      h1('New device sign-in') +
      p(`Hi ${v.name ?? 'there'}, your Yoo Bus account was just accessed from a new device.`) +
      detailTable([['Device', String(v.device ?? 'Unknown')], ['IP address', String(v.ip ?? 'Unknown')], ['Time', String(v.time ?? '')]]) +
      note('If this was you, no action is needed. If not, please reset your password immediately.', 'warn'),
      'Yoo Bus',
    ),
  }),
};

export function renderTemplate(name: string, vars: Vars): RenderedEmail {
  const fn = TEMPLATES[name];
  // Never throw from here: an unknown/typo template or a template that trips on a missing var
  // must not be able to break the operation that triggered the email. Fall back to a generic mail.
  if (!fn) return { subject: 'Yoo Bus notification', html: wrap('<p>You have a new notification from Yoo Bus.</p>') };
  try {
    return fn(vars);
  } catch {
    return { subject: 'Yoo Bus notification', html: wrap('<p>You have a new notification from Yoo Bus.</p>') };
  }
}
