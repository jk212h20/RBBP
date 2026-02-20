/**
 * Telegram Notification Service
 *
 * Sends DMs to admin users who have:
 *  1. A telegramUsername set on their Profile
 *  2. The specific notification type enabled in their notificationPrefs
 *  3. Started a conversation with the bot (Telegram requirement for DMs)
 *
 * Falls back to TELEGRAM_CHAT_ID env var for backwards compatibility.
 *
 * Notification types:
 *   newUser          – someone registers an account
 *   withdrawal       – a withdrawal is processed (sats sent)
 *   venueApplication – a new venue application is submitted
 */

import prisma from '../lib/prisma';

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;

// ============================================
// TYPES
// ============================================

export type NotificationEventType = 'newUser' | 'withdrawal' | 'venueApplication';

export interface NotificationPrefs {
  newUser?: boolean;
  withdrawal?: boolean;
  venueApplication?: boolean;
}

// ============================================
// CORE SEND FUNCTION
// ============================================

/**
 * Send a message to a single Telegram chat/user.
 * chatId can be a numeric chat ID (e.g. "123456789") or @username.
 */
async function sendTelegramMessage(chatId: string, text: string): Promise<boolean> {
  if (!BOT_TOKEN) {
    console.warn('[Telegram] BOT_TOKEN not configured — skipping notification');
    return false;
  }

  try {
    const response = await fetch(
      `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML' }),
      }
    );

    const data = await response.json() as any;

    if (!data.ok) {
      console.warn(`[Telegram] Failed to send to ${chatId}: ${data.description}`);
      return false;
    }

    return true;
  } catch (err) {
    console.error(`[Telegram] Error sending to ${chatId}:`, err);
    return false;
  }
}

// ============================================
// RECIPIENT LOOKUP
// ============================================

/**
 * Get all admin users who want to be notified for a given event type.
 * Returns their telegramUsername values (without @).
 */
async function getAdminRecipientsForEvent(eventType: NotificationEventType): Promise<string[]> {
  const admins = await prisma.user.findMany({
    where: {
      role: 'ADMIN',
      isActive: true,
    },
    include: {
      profile: {
        select: { telegramUsername: true },
      },
    },
  });

  const recipients: string[] = [];

  for (const admin of admins) {
    const username = admin.profile?.telegramUsername;
    if (!username) continue;

    const prefs = (admin.notificationPrefs as NotificationPrefs | null) ?? {};
    const enabled = prefs[eventType];

    // Default to true for all types if prefs haven't been set yet
    // (backwards compat: existing admins get all notifications until they opt out)
    if (enabled !== false) {
      recipients.push(username);
    }
  }

  return recipients;
}

/**
 * Fan out a message to all subscribed admin recipients.
 * Also sends to TELEGRAM_CHAT_ID env var as a fallback/catch-all if set.
 */
async function fanOutNotification(eventType: NotificationEventType, message: string): Promise<void> {
  const recipients = await getAdminRecipientsForEvent(eventType);

  // Track which IDs we've already sent to (avoid duplicates if env var matches a username)
  const sentTo = new Set<string>();

  for (const username of recipients) {
    const chatId = `@${username}`;
    if (!sentTo.has(chatId)) {
      await sendTelegramMessage(chatId, message);
      sentTo.add(chatId);
    }
  }

  // Fallback: also send to hardcoded TELEGRAM_CHAT_ID if set and not already sent
  const fallbackChatId = process.env.TELEGRAM_CHAT_ID;
  if (fallbackChatId && !sentTo.has(fallbackChatId)) {
    await sendTelegramMessage(fallbackChatId, message);
  }

  if (sentTo.size === 0 && !fallbackChatId) {
    console.warn(`[Telegram] No recipients configured for event type: ${eventType}`);
  }
}

// ============================================
// NOTIFICATION FUNCTIONS
// ============================================

/**
 * Notify admins when a new user registers.
 */
export async function notifyNewUser(params: {
  name: string;
  email: string | null;
  telegramUsername?: string;
  authProvider: string;
}): Promise<void> {
  const { name, email, telegramUsername, authProvider } = params;

  const providerEmoji =
    authProvider === 'GOOGLE' ? '🔵 Google' :
    authProvider === 'LIGHTNING' ? '⚡ Lightning' :
    '✉️ Email';

  let msg = `🎉 <b>New user registered!</b>\n\n`;
  msg += `👤 <b>Name:</b> ${name}\n`;
  if (email) msg += `📧 <b>Email:</b> ${email}\n`;
  if (telegramUsername) msg += `💬 <b>Telegram:</b> @${telegramUsername}\n`;
  msg += `🔑 <b>Auth:</b> ${providerEmoji}`;

  await fanOutNotification('newUser', msg);
}

/**
 * Notify admins when a withdrawal is successfully processed (sats sent).
 */
export async function notifyWithdrawalProcessed(params: {
  userName: string;
  userEmail: string | null;
  amountSats: number;
  description?: string | null;
}): Promise<void> {
  const { userName, userEmail, amountSats, description } = params;

  let msg = `💸 <b>Withdrawal Processed!</b>\n\n`;
  msg += `👤 <b>Player:</b> ${userName}\n`;
  if (userEmail) msg += `📧 <b>Email:</b> ${userEmail}\n`;
  msg += `⚡ <b>Amount:</b> ${amountSats.toLocaleString()} sats\n`;
  if (description) msg += `📝 <b>Description:</b> ${description}`;

  await fanOutNotification('withdrawal', msg);
}

/**
 * Notify admins when a new venue application is submitted.
 */
export async function notifyVenueApplication(params: {
  venueName: string;
  contactName: string;
  contactEmail?: string | null;
  address: string;
}): Promise<void> {
  const { venueName, contactName, contactEmail, address } = params;

  let msg = `🏢 <b>New Venue Application!</b>\n\n`;
  msg += `🏠 <b>Venue:</b> ${venueName}\n`;
  msg += `📍 <b>Address:</b> ${address}\n`;
  msg += `👤 <b>Contact:</b> ${contactName}\n`;
  if (contactEmail) msg += `📧 <b>Email:</b> ${contactEmail}\n`;
  msg += `\n<i>Review in the admin panel → Applications tab</i>`;

  await fanOutNotification('venueApplication', msg);
}

// ============================================
// TELEGRAM VERIFICATION (User DM test)
// ============================================

/**
 * Send a test DM to a Telegram username to verify the user has started
 * the bot and the username is correct. On success, marks telegramVerified=true
 * on their profile.
 *
 * Returns { success: boolean; error?: string }
 */
export async function verifyTelegramUsername(
  userId: string,
  telegramUsername: string
): Promise<{ success: boolean; error?: string }> {
  if (!BOT_TOKEN) {
    return { success: false, error: 'Telegram bot not configured' };
  }

  const cleaned = telegramUsername.replace(/^@/, '').trim();
  if (!cleaned) {
    return { success: false, error: 'No Telegram username provided' };
  }

  const text =
    `✅ <b>Telegram verified!</b>\n\nYour Roatan Poker account is now linked to this Telegram account. You'll receive notifications here when events happen.`;

  const ok = await sendTelegramMessage(`@${cleaned}`, text);

  if (ok) {
    // Mark profile as verified
    await prisma.profile.upsert({
      where: { userId },
      update: { telegramVerified: true },
      create: { userId, telegramVerified: true },
    });
    return { success: true };
  } else {
    return {
      success: false,
      error:
        'Could not send message. Make sure you have started a conversation with the bot first.',
    };
  }
}

// ============================================
// ADMIN PREFERENCE MANAGEMENT
// ============================================

/**
 * Update notification preferences for an admin user.
 */
export async function updateAdminNotificationPrefs(
  userId: string,
  prefs: NotificationPrefs
): Promise<NotificationPrefs> {
  const updated = await prisma.user.update({
    where: { id: userId },
    data: { notificationPrefs: prefs as any },
    select: { notificationPrefs: true },
  });

  return (updated.notificationPrefs as NotificationPrefs) ?? {};
}

/**
 * Get notification preferences for an admin user.
 * Defaults all to true if not yet set.
 */
export async function getAdminNotificationPrefs(userId: string): Promise<NotificationPrefs> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { notificationPrefs: true },
  });

  const prefs = (user?.notificationPrefs as NotificationPrefs | null) ?? {};

  // Return with defaults (true if unset)
  return {
    newUser: prefs.newUser !== false,
    withdrawal: prefs.withdrawal !== false,
    venueApplication: prefs.venueApplication !== false,
  };
}
