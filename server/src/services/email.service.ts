/**
 * Email Service — Resend
 *
 * Handles all transactional emails for the Roatan Poker League.
 * Uses Resend API for reliable delivery with good inbox placement.
 *
 * Email types:
 *   - Welcome (new registration)
 *   - Event signup confirmation
 *   - Event reminder (day before)
 *   - Withdrawal ready (sats available to withdraw)
 *   - Guest claim link
 *
 * All emails are non-blocking (fire-and-forget with error logging).
 * Gracefully degrades when RESEND_API_KEY is not set.
 *
 * Templates are admin-configurable via the email_templates DB table.
 * If no DB template exists for a type, hardcoded defaults are used.
 */

import { Resend } from 'resend';
import prisma from '../lib/prisma';

// ============================================
// CONFIG
// ============================================

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const EMAIL_FROM = process.env.EMAIL_FROM || 'Roatan Poker <noreply@roatanpoker.com>';
const CLIENT_URL = process.env.CLIENT_URL || 'https://client-production-41b3.up.railway.app';

let resend: Resend | null = null;

if (RESEND_API_KEY) {
  resend = new Resend(RESEND_API_KEY);
  console.log('[Email] Resend configured ✅');
} else {
  console.warn('[Email] RESEND_API_KEY not set — email sending disabled');
}

// ============================================
// TEMPLATE TYPES & DEFAULTS
// ============================================

export type EmailTemplateType = 'welcome' | 'event_signup' | 'event_reminder' | 'withdrawal_ready' | 'claim_link';

interface TemplateDefault {
  subject: string;
  body: string;
  sendRules: Record<string, any> | null;
  variableHelp: string[];  // Help text for admin UI
}

/**
 * Default templates — used when no DB template exists for a given type.
 * Body uses {{variable}} placeholders that get replaced at send time.
 */
const DEFAULT_TEMPLATES: Record<EmailTemplateType, TemplateDefault> = {
  welcome: {
    subject: 'Welcome to Roatan Poker League, {{firstName}}! ♠',
    body: `<h2 style="margin:0 0 16px;color:#ffffff;font-size:20px;">Welcome to the League, {{firstName}}! 🎰</h2>
<p style="margin:0 0 12px;">
  You're now part of the <strong style="color:#e94560;">Roatan Poker League</strong> — the island's premier poker community.
</p>
<p style="margin:0 0 12px;">Here's what you can do:</p>
<ul style="margin:0 0 20px;padding-left:20px;color:#ccc;">
  <li style="margin-bottom:8px;">📅 <strong>Browse & sign up</strong> for upcoming tournaments</li>
  <li style="margin-bottom:8px;">🏆 <strong>Climb the leaderboard</strong> — earn points at every event</li>
  <li style="margin-bottom:8px;">⚡ <strong>Win sats</strong> — prizes paid via Lightning Network</li>
  <li style="margin-bottom:8px;">👤 <strong>Build your profile</strong> — track your poker stats</li>
</ul>
{{button:View Upcoming Events:{{clientUrl}}/events}}
<p style="margin:0;color:#999;font-size:13px;">
  See you at the tables! 🃏
</p>`,
    sendRules: null,
    variableHelp: ['{{firstName}}', '{{name}}', '{{email}}', '{{clientUrl}}'],
  },
  event_signup: {
    subject: "You're registered for {{eventName}} 🎯",
    body: `<h2 style="margin:0 0 16px;color:#ffffff;font-size:20px;">You're Registered! ✅</h2>
<p style="margin:0 0 20px;">
  {{firstName}}, you're locked in for the next tournament:
</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#0f3460;border-radius:8px;margin:0 0 20px;">
  <tr>
    <td style="padding:20px;">
      <p style="margin:0 0 8px;font-size:18px;font-weight:700;color:#e94560;">{{eventName}}</p>
      <p style="margin:0 0 4px;color:#ccc;">📅 {{eventDate}}</p>
      <p style="margin:0 0 4px;color:#ccc;">🕐 {{eventTime}}</p>
      <p style="margin:0;color:#ccc;">📍 {{venueName}}</p>
    </td>
  </tr>
</table>
<p style="margin:0 0 12px;color:#ccc;">
  Arrive on time to secure your seat. Late arrivals may lose their spot to the waitlist.
</p>
{{button:View Event Details:{{clientUrl}}/events/{{eventId}}}}`,
    sendRules: null,
    variableHelp: ['{{firstName}}', '{{eventName}}', '{{eventDate}}', '{{eventTime}}', '{{venueName}}', '{{eventId}}', '{{clientUrl}}'],
  },
  event_reminder: {
    subject: '🔔 Reminder: {{eventName}} is tomorrow!',
    body: `<h2 style="margin:0 0 16px;color:#ffffff;font-size:20px;">Tournament Tomorrow! 🔔</h2>
<p style="margin:0 0 20px;">
  {{firstName}}, just a reminder — you're registered for tomorrow's game:
</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#0f3460;border-radius:8px;margin:0 0 20px;">
  <tr>
    <td style="padding:20px;">
      <p style="margin:0 0 8px;font-size:18px;font-weight:700;color:#e94560;">{{eventName}}</p>
      <p style="margin:0 0 4px;color:#ccc;">🕐 {{eventTime}}</p>
      <p style="margin:0;color:#ccc;">📍 {{venueName}}</p>
    </td>
  </tr>
</table>
<p style="margin:0 0 12px;color:#ccc;">
  Can't make it? Cancel your registration so someone on the waitlist can take your spot.
</p>
{{button:View Event:{{clientUrl}}/events/{{eventId}}}}`,
    sendRules: { reminderHoursBefore: 24 },
    variableHelp: ['{{firstName}}', '{{eventName}}', '{{eventTime}}', '{{venueName}}', '{{eventId}}', '{{clientUrl}}'],
  },
  withdrawal_ready: {
    subject: '⚡ {{amountSats}} sats ready to withdraw!',
    body: `<h2 style="margin:0 0 16px;color:#ffffff;font-size:20px;">Sats Ready to Withdraw! ⚡</h2>
<p style="margin:0 0 20px;">
  {{firstName}}, you have a Lightning withdrawal waiting for you:
</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#0f3460;border-radius:8px;margin:0 0 20px;">
  <tr>
    <td style="padding:20px;text-align:center;">
      <p style="margin:0 0 4px;color:#999;font-size:13px;text-transform:uppercase;letter-spacing:1px;">Amount</p>
      <p style="margin:0;font-size:28px;font-weight:700;color:#f0c040;">
        ⚡ {{amountSats}} sats
      </p>
      {{#description}}<p style="margin:8px 0 0;color:#ccc;font-size:13px;">{{description}}</p>{{/description}}
    </td>
  </tr>
</table>
<p style="margin:0 0 12px;color:#ccc;">
  Open your profile to scan the withdrawal QR code with any Lightning wallet (Phoenix, Zeus, Alby, etc.).
</p>
{{button:Withdraw Now:{{clientUrl}}/profile}}`,
    sendRules: null,
    variableHelp: ['{{firstName}}', '{{amountSats}}', '{{description}}', '{{clientUrl}}'],
  },
  claim_link: {
    subject: 'Claim your Roatan Poker League account ♠',
    body: `<h2 style="margin:0 0 16px;color:#ffffff;font-size:20px;">Claim Your Account 🎯</h2>
<p style="margin:0 0 12px;">
  Hey {{guestName}}! A guest account has been created for you in the 
  <strong style="color:#e94560;">Roatan Poker League</strong>.
</p>
<p style="margin:0 0 12px;">
  Click below to set your email and password and claim your poker stats, 
  points, and tournament history.
</p>
{{button:Claim My Account:{{claimUrl}}}}
<p style="margin:0;color:#999;font-size:13px;">
  This link expires in 7 days. If it doesn't work, ask the tournament director for a new one.
</p>`,
    sendRules: null,
    variableHelp: ['{{guestName}}', '{{claimUrl}}', '{{clientUrl}}'],
  },
};

// ============================================
// TEMPLATE HELPERS
// ============================================

/**
 * Get a template from DB, falling back to defaults.
 */
async function getTemplate(type: EmailTemplateType): Promise<{
  subject: string;
  body: string;
  enabled: boolean;
  sendRules: Record<string, any> | null;
}> {
  try {
    const dbTemplate = await prisma.emailTemplate.findUnique({
      where: { type },
    });

    if (dbTemplate) {
      return {
        subject: dbTemplate.subject,
        body: dbTemplate.body,
        enabled: dbTemplate.enabled,
        sendRules: dbTemplate.sendRules as Record<string, any> | null,
      };
    }
  } catch (err) {
    // DB not ready or table doesn't exist yet — use defaults silently
    console.warn(`[Email] Could not read template "${type}" from DB, using default`);
  }

  const def = DEFAULT_TEMPLATES[type];
  return {
    subject: def.subject,
    body: def.body,
    enabled: true,
    sendRules: def.sendRules,
  };
}

/**
 * Replace {{variable}} placeholders in a string.
 */
function replaceVariables(template: string, vars: Record<string, string>): string {
  let result = template;
  for (const [key, value] of Object.entries(vars)) {
    result = result.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), value);
  }
  // Handle conditional blocks: {{#key}}...{{/key}} — show only if key has value
  result = result.replace(/\{\{#(\w+)\}\}([\s\S]*?)\{\{\/\1\}\}/g, (_, key, content) => {
    return vars[key] ? content : '';
  });
  // Process button shorthand: {{button:Text:URL}}
  result = result.replace(/\{\{button:([^:]+):([^}]+)\}\}/g, (_, text, url) => {
    return buttonHtml(text, url);
  });
  return result;
}

// ============================================
// BASE TEMPLATE
// ============================================

function wrapInLayout(content: string, preheader?: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Roatan Poker League</title>
  ${preheader ? `<span style="display:none;font-size:1px;color:#ffffff;max-height:0;overflow:hidden;">${preheader}</span>` : ''}
</head>
<body style="margin:0;padding:0;background-color:#1a1a2e;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Oxygen,Ubuntu,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#1a1a2e;">
    <tr>
      <td align="center" style="padding:24px 16px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background-color:#16213e;border-radius:12px;overflow:hidden;border:1px solid #0f3460;">

          <!-- Header -->
          <tr>
            <td style="background:linear-gradient(135deg,#0f3460,#533483);padding:28px 32px;text-align:center;">
              <h1 style="margin:0;font-size:24px;font-weight:700;color:#e94560;letter-spacing:1px;">
                ♠ ROATAN POKER LEAGUE ♣
              </h1>
            </td>
          </tr>

          <!-- Content -->
          <tr>
            <td style="padding:32px;color:#e0e0e0;font-size:15px;line-height:1.6;">
              ${content}
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:20px 32px;border-top:1px solid #0f3460;text-align:center;color:#888;font-size:12px;">
              <a href="${CLIENT_URL}" style="color:#e94560;text-decoration:none;">roatanpoker.com</a>
              <br>
              <span style="color:#666;">Roatan, Honduras 🇭🇳</span>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function buttonHtml(text: string, url: string): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:24px auto;">
  <tr>
    <td style="background:#e94560;border-radius:8px;">
      <a href="${url}" style="display:inline-block;padding:14px 32px;color:#ffffff;font-size:15px;font-weight:600;text-decoration:none;letter-spacing:0.5px;">
        ${text}
      </a>
    </td>
  </tr>
</table>`;
}

// ============================================
// SEND HELPER
// ============================================

async function sendEmail(params: {
  to: string;
  subject: string;
  html: string;
}): Promise<boolean> {
  if (!resend) {
    console.warn('[Email] Skipping send (no API key) →', params.subject);
    return false;
  }

  try {
    const { data, error } = await resend.emails.send({
      from: EMAIL_FROM,
      to: params.to,
      subject: params.subject,
      html: params.html,
    });

    if (error) {
      console.error('[Email] Send failed:', error);
      return false;
    }

    console.log(`[Email] Sent "${params.subject}" to ${params.to} (id: ${data?.id})`);
    return true;
  } catch (err) {
    console.error('[Email] Error:', err);
    return false;
  }
}

// ============================================
// EMAIL FUNCTIONS
// ============================================

/**
 * Welcome email sent after registration (email/password signup).
 */
export async function sendWelcomeEmail(params: {
  to: string;
  name: string;
}): Promise<void> {
  const { to, name } = params;
  const firstName = name.split(' ')[0];

  const template = await getTemplate('welcome');
  if (!template.enabled) {
    console.log('[Email] Welcome email disabled by admin — skipping');
    return;
  }

  const vars: Record<string, string> = {
    firstName,
    name,
    email: to,
    clientUrl: CLIENT_URL,
  };

  const subject = replaceVariables(template.subject, vars);
  const body = replaceVariables(template.body, vars);
  const html = wrapInLayout(body, `Welcome to Roatan Poker League, ${firstName}!`);

  await sendEmail({ to, subject, html });
}

/**
 * Event signup confirmation email.
 */
export async function sendEventSignupEmail(params: {
  to: string;
  playerName: string;
  eventName: string;
  eventDate: Date;
  venueName: string;
  eventId: string;
}): Promise<void> {
  const { to, playerName, eventName, eventDate, venueName, eventId } = params;
  const firstName = playerName.split(' ')[0];

  const template = await getTemplate('event_signup');
  if (!template.enabled) {
    console.log('[Email] Event signup email disabled by admin — skipping');
    return;
  }

  const dateStr = eventDate.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
  const timeStr = eventDate.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });

  const vars: Record<string, string> = {
    firstName,
    playerName,
    eventName,
    eventDate: dateStr,
    eventTime: timeStr,
    venueName,
    eventId,
    clientUrl: CLIENT_URL,
  };

  const subject = replaceVariables(template.subject, vars);
  const body = replaceVariables(template.body, vars);
  const html = wrapInLayout(body, `You're registered for ${eventName}`);

  await sendEmail({ to, subject, html });
}

/**
 * Withdrawal ready notification — tells the player they have sats to collect.
 */
export async function sendWithdrawalReadyEmail(params: {
  to: string;
  playerName: string;
  amountSats: number;
  description?: string | null;
}): Promise<void> {
  const { to, playerName, amountSats, description } = params;
  const firstName = playerName.split(' ')[0];

  const template = await getTemplate('withdrawal_ready');
  if (!template.enabled) {
    console.log('[Email] Withdrawal ready email disabled by admin — skipping');
    return;
  }

  const vars: Record<string, string> = {
    firstName,
    playerName,
    amountSats: amountSats.toLocaleString(),
    description: description || '',
    clientUrl: CLIENT_URL,
  };

  const subject = replaceVariables(template.subject, vars);
  const body = replaceVariables(template.body, vars);
  const html = wrapInLayout(body, `You have ${amountSats.toLocaleString()} sats to withdraw!`);

  await sendEmail({ to, subject, html });
}

/**
 * Guest claim link — sent (or displayed) when an admin creates a claim link for a guest player.
 */
export async function sendClaimLinkEmail(params: {
  to: string;
  guestName: string;
  claimToken: string;
}): Promise<void> {
  const { to, guestName, claimToken } = params;

  const claimUrl = `${CLIENT_URL}/claim/${claimToken}`;

  const template = await getTemplate('claim_link');
  if (!template.enabled) {
    console.log('[Email] Claim link email disabled by admin — skipping');
    return;
  }

  const vars: Record<string, string> = {
    guestName,
    claimUrl,
    clientUrl: CLIENT_URL,
  };

  const subject = replaceVariables(template.subject, vars);
  const body = replaceVariables(template.body, vars);
  const html = wrapInLayout(body, `Claim your Roatan Poker League account`);

  await sendEmail({ to, subject, html });
}

/**
 * Event reminder — sent the day before an event to registered players.
 */
export async function sendEventReminderEmail(params: {
  to: string;
  playerName: string;
  eventName: string;
  eventDate: Date;
  venueName: string;
  eventId: string;
}): Promise<void> {
  const { to, playerName, eventName, eventDate, venueName, eventId } = params;
  const firstName = playerName.split(' ')[0];

  const template = await getTemplate('event_reminder');
  if (!template.enabled) {
    console.log('[Email] Event reminder email disabled by admin — skipping');
    return;
  }

  const timeStr = eventDate.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });

  const vars: Record<string, string> = {
    firstName,
    playerName,
    eventName,
    eventTime: timeStr,
    venueName,
    eventId,
    clientUrl: CLIENT_URL,
  };

  const subject = replaceVariables(template.subject, vars);
  const body = replaceVariables(template.body, vars);
  const html = wrapInLayout(body, `Reminder: ${eventName} is tomorrow!`);

  await sendEmail({ to, subject, html });
}

// ============================================
// ADMIN TEMPLATE MANAGEMENT
// ============================================

/**
 * Get all email templates (DB + defaults for any missing types).
 */
export async function getAllEmailTemplates() {
  const allTypes: EmailTemplateType[] = ['welcome', 'event_signup', 'event_reminder', 'withdrawal_ready', 'claim_link'];

  let dbTemplates: any[] = [];
  try {
    dbTemplates = await prisma.emailTemplate.findMany();
  } catch {
    // Table might not exist yet
  }

  const dbMap = new Map(dbTemplates.map((t: any) => [t.type, t]));

  return allTypes.map((type) => {
    const dbT = dbMap.get(type);
    const def = DEFAULT_TEMPLATES[type];

    if (dbT) {
      return {
        id: dbT.id,
        type: dbT.type,
        subject: dbT.subject,
        body: dbT.body,
        enabled: dbT.enabled,
        sendRules: dbT.sendRules,
        updatedAt: dbT.updatedAt,
        isCustomized: true,
        variableHelp: def.variableHelp,
        defaultSubject: def.subject,
        defaultBody: def.body,
      };
    }

    return {
      id: null,
      type,
      subject: def.subject,
      body: def.body,
      enabled: true,
      sendRules: def.sendRules,
      updatedAt: null,
      isCustomized: false,
      variableHelp: def.variableHelp,
      defaultSubject: def.subject,
      defaultBody: def.body,
    };
  });
}

/**
 * Get a single email template by type.
 */
export async function getEmailTemplate(type: EmailTemplateType) {
  const all = await getAllEmailTemplates();
  return all.find(t => t.type === type) || null;
}

/**
 * Update (or create) an email template.
 */
export async function updateEmailTemplate(type: EmailTemplateType, data: {
  subject?: string;
  body?: string;
  enabled?: boolean;
  sendRules?: Record<string, any> | null;
}) {
  const def = DEFAULT_TEMPLATES[type];
  if (!def) {
    throw new Error(`Unknown email template type: ${type}`);
  }

  const existing = await prisma.emailTemplate.findUnique({ where: { type } });

  if (existing) {
    return prisma.emailTemplate.update({
      where: { type },
      data: {
        subject: data.subject !== undefined ? data.subject : existing.subject,
        body: data.body !== undefined ? data.body : existing.body,
        enabled: data.enabled !== undefined ? data.enabled : existing.enabled,
        sendRules: data.sendRules !== undefined ? data.sendRules : existing.sendRules,
      },
    });
  }

  // Create from defaults + overrides
  return prisma.emailTemplate.create({
    data: {
      type,
      subject: data.subject ?? def.subject,
      body: data.body ?? def.body,
      enabled: data.enabled ?? true,
      sendRules: data.sendRules !== undefined ? data.sendRules : def.sendRules,
    },
  });
}

/**
 * Reset a template to its default values.
 */
export async function resetEmailTemplate(type: EmailTemplateType) {
  const def = DEFAULT_TEMPLATES[type];
  if (!def) {
    throw new Error(`Unknown email template type: ${type}`);
  }

  // Delete the DB record so it falls back to defaults
  try {
    await prisma.emailTemplate.delete({ where: { type } });
  } catch {
    // Didn't exist — that's fine
  }

  return {
    type,
    subject: def.subject,
    body: def.body,
    enabled: true,
    sendRules: def.sendRules,
    isCustomized: false,
    variableHelp: def.variableHelp,
  };
}

/**
 * Send a test email to a specific address using a template.
 */
export async function sendTestEmail(type: EmailTemplateType, toEmail: string) {
  const template = await getTemplate(type);

  // Use sample data for the test
  const sampleVars: Record<string, string> = {
    firstName: 'TestUser',
    name: 'TestUser Player',
    email: toEmail,
    clientUrl: CLIENT_URL,
    eventName: 'Friday Night Poker #42',
    eventDate: 'Friday, March 14, 2026',
    eventTime: '7:00 PM',
    venueName: 'Blue Marlin Beach Bar',
    eventId: 'sample-event-id',
    amountSats: '50,000',
    description: '1st Place Prize',
    guestName: 'TestGuest',
    claimUrl: `${CLIENT_URL}/claim/sample-token`,
    playerName: 'TestUser Player',
  };

  const subject = replaceVariables(template.subject, sampleVars);
  const body = replaceVariables(template.body, sampleVars);
  const html = wrapInLayout(body, `Test email: ${type}`);

  return sendEmail({ to: toEmail, subject: `[TEST] ${subject}`, html });
}

// ============================================
// UTILITY
// ============================================

/**
 * Check if email sending is configured.
 */
export function isEmailConfigured(): boolean {
  return resend !== null;
}

/**
 * Get the send rules for the event reminder (used by cron/scheduler).
 */
export async function getEventReminderRules(): Promise<{ reminderHoursBefore: number }> {
  const template = await getTemplate('event_reminder');
  const rules = template.sendRules as any;
  return {
    reminderHoursBefore: rules?.reminderHoursBefore ?? 24,
  };
}
