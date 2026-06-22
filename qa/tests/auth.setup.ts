import { test as setup } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

/**
 * Logs in the disposable QA account via the live API and produces a Playwright
 * storageState that injects the `token` into localStorage for www.rbbp.fun.
 * Authenticated specs reuse this state.
 *
 * Creds are read from /tmp/rbbp-qa/creds.json (written when the account was
 * created) or from env QA_EMAIL / QA_PASSWORD / QA_API_BASE.
 */
const CREDS_FILE = process.env.QA_CREDS || '/tmp/rbbp-qa/creds.json';
const STATE_FILE = path.join(process.cwd(), '.auth', 'state.json');

setup('authenticate QA account', async ({ request }) => {
  let email = process.env.QA_EMAIL;
  let password = process.env.QA_PASSWORD;
  let apiBase = process.env.QA_API_BASE;
  let site = process.env.QA_BASE_URL || 'https://www.rbbp.fun';

  if ((!email || !password || !apiBase) && fs.existsSync(CREDS_FILE)) {
    const c = JSON.parse(fs.readFileSync(CREDS_FILE, 'utf8'));
    email = email || c.email;
    password = password || c.password;
    apiBase = apiBase || c.apiBase;
    site = c.site || site;
  }

  if (!email || !password || !apiBase) {
    throw new Error('Missing QA credentials. Set QA_EMAIL/QA_PASSWORD/QA_API_BASE or provide creds.json');
  }

  const resp = await request.post(`${apiBase}/auth/login`, {
    data: { email, password },
    headers: { Origin: site },
  });
  if (!resp.ok()) {
    throw new Error(`QA login failed: ${resp.status()} ${await resp.text()}`);
  }
  const body = await resp.json();
  const token = body.token;
  if (!token) throw new Error('No token in login response');

  const origin = new URL(site).origin;
  const state = {
    cookies: [],
    origins: [
      {
        origin,
        localStorage: [{ name: 'token', value: token }],
      },
    ],
  };
  fs.mkdirSync(path.dirname(STATE_FILE), { recursive: true });
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
});
