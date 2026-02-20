/**
 * Telegram Notification Service
 * Sends admin notifications via CoraTelegramBot
 * Requires env vars: TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID
 */

const TELEGRAM_API_BASE = 'https://api.telegram.org';

async function sendTelegramMessage(text: string): Promise<void> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;

  if (!token || !chatId) {
    console.warn('[Telegram] TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID not set — skipping notification');
    return;
  }

  try {
    const url = `${TELEGRAM_API_BASE}/bot${token}/sendMessage`;
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: 'HTML',
      }),
    });

    if (!response.ok) {
      const body = await response.text();
      console.error('[Telegram] Failed to send message:', response.status, body);
    }
  } catch (err) {
    console.error('[Telegram] Error sending message:', err);
  }
}

/**
 * Notify admin when a new user joins the site
 */
export async function notifyNewUser(params: {
  name: string;
  email?: string | null;
  telegramUsername?: string | null;
  authProvider: 'EMAIL' | 'GOOGLE' | 'LIGHTNING';
}): Promise<void> {
  const { name, email, telegramUsername, authProvider } = params;

  const authEmoji = authProvider === 'LIGHTNING' ? '⚡' : authProvider === 'GOOGLE' ? '🔵' : '✉️';

  const lines = [
    `🆕 <b>New user joined!</b>`,
    `👤 Name: ${name}`,
    `📧 Email: ${email || '—'}`,
    `💬 Telegram: ${telegramUsername ? `@${telegramUsername}` : 'not provided'}`,
    `${authEmoji} Auth: ${authProvider}`,
  ];

  await sendTelegramMessage(lines.join('\n'));
}
