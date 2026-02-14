#!/usr/bin/env npx ts-node
// @ts-nocheck
/**
 * Lightning Login Test Script
 * 
 * Tests the full LNURL-auth flow against local or production server.
 * Simulates what a Lightning wallet does when scanning the QR code.
 * 
 * Usage:
 *   npx ts-node scripts/test-lightning-login.ts              # test against local
 *   npx ts-node scripts/test-lightning-login.ts --production  # test against production
 *   npx ts-node scripts/test-lightning-login.ts --url https://your-server.com/api
 */

const nodeCrypto = require('crypto');
const secp256k1 = require('@noble/secp256k1');
const { bech32 } = require('bech32');

// ============================================
// Configuration
// ============================================

const args = process.argv.slice(2);
const isProduction = args.includes('--production') || args.includes('-p');
const customUrl = args.find((a: string) => a.startsWith('--url='))?.split('=')[1] 
  || (args.includes('--url') ? args[args.indexOf('--url') + 1] : null);

const API_URL = customUrl 
  || (isProduction ? 'https://rbbp-production.up.railway.app/api' : 'http://localhost:3001/api');

console.log('='.repeat(60));
console.log('⚡ Lightning Login Test');
console.log('='.repeat(60));
console.log(`Target: ${API_URL}`);
console.log(`Mode: ${isProduction ? 'PRODUCTION' : customUrl ? 'CUSTOM' : 'LOCAL'}`);
console.log('');

// ============================================
// Helper Functions
// ============================================

function decodeLnurl(lnurl: string): string {
  const { prefix, words } = bech32.decode(lnurl, 1023);
  if (prefix !== 'lnurl') throw new Error('Invalid lnurl prefix');
  return Buffer.from(bech32.fromWords(words)).toString('utf8');
}

function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substr(i, 2), 16);
  }
  return bytes;
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
}

function sha256(data: Uint8Array): Uint8Array {
  const hash = nodeCrypto.createHash('sha256');
  hash.update(data);
  return new Uint8Array(hash.digest());
}

async function fetchJSON(url: string): Promise<any> {
  const response = await fetch(url);
  const text = await response.text();
  
  if (!response.ok) {
    console.log(`  ❌ HTTP ${response.status}: ${text.substring(0, 200)}`);
  }
  
  try {
    return JSON.parse(text);
  } catch {
    return { _raw: text, _status: response.status };
  }
}

// ============================================
// Test Steps
// ============================================

async function testLightningLogin() {
  let passed = 0;
  let failed = 0;
  
  function pass(msg: string) { console.log(`  ✅ ${msg}`); passed++; }
  function fail(msg: string, detail?: any) { 
    console.log(`  ❌ ${msg}`); 
    if (detail) console.log(`     Detail:`, typeof detail === 'string' ? detail : JSON.stringify(detail, null, 2));
    failed++; 
  }

  // ── Step 1: Get Challenge ──
  console.log('\n📋 Step 1: Request Lightning Challenge');
  console.log(`  GET ${API_URL}/auth/lightning/challenge`);
  
  let challenge: any;
  try {
    challenge = await fetchJSON(`${API_URL}/auth/lightning/challenge`);
  } catch (err: any) {
    fail('Failed to connect to server', err.message);
    console.log('\n💡 Is the server running? Try: cd server && npm run dev');
    return { passed, failed };
  }
  
  if (challenge.k1 && challenge.lnurl && challenge.qrCode) {
    pass(`Got challenge: k1=${challenge.k1.substring(0, 16)}...`);
  } else {
    fail('Missing fields in challenge response', challenge);
    return { passed, failed };
  }
  
  if (challenge.k1.length === 64 && /^[0-9a-f]+$/i.test(challenge.k1)) {
    pass('k1 is valid 64-char hex');
  } else {
    fail(`k1 format invalid: length=${challenge.k1.length}`);
  }

  // ── Step 2: Decode LNURL ──
  console.log('\n📋 Step 2: Decode LNURL');
  
  let callbackUrl: string;
  try {
    callbackUrl = decodeLnurl(challenge.lnurl);
    pass(`Decoded LNURL → ${callbackUrl}`);
  } catch (err: any) {
    fail('Failed to decode LNURL', err.message);
    return { passed, failed };
  }
  
  // Parse the callback URL
  const url = new URL(callbackUrl);
  const tag = url.searchParams.get('tag');
  const k1FromUrl = url.searchParams.get('k1');
  
  if (tag === 'login') {
    pass('tag=login ✓');
  } else {
    fail(`Expected tag=login, got tag=${tag}`);
  }
  
  if (k1FromUrl === challenge.k1) {
    pass('k1 in URL matches challenge k1 ✓');
  } else {
    fail(`k1 mismatch: URL has ${k1FromUrl}, challenge has ${challenge.k1}`);
  }

  // Check if callback URL points to the right server
  console.log(`\n  📡 Callback URL host: ${url.origin}`);
  console.log(`  📡 API URL: ${API_URL}`);
  
  const expectedOrigin = new URL(API_URL).origin;
  if (url.origin === expectedOrigin) {
    pass('Callback URL origin matches API origin');
  } else {
    fail(`Callback URL origin mismatch! Callback goes to ${url.origin} but API is at ${expectedOrigin}`);
    console.log('  ⚠️  This means the wallet will call a DIFFERENT server than where the challenge was created!');
    console.log('  ⚠️  Check LIGHTNING_AUTH_URL or LNURL_BASE_URL env vars on the server.');
  }

  // ── Step 3: Check Initial Status ──
  console.log('\n📋 Step 3: Check Initial Status (should be pending)');
  console.log(`  GET ${API_URL}/auth/lightning/status/${challenge.k1}`);
  
  const initialStatus = await fetchJSON(`${API_URL}/auth/lightning/status/${challenge.k1}`);
  
  if (initialStatus.status === 'pending') {
    pass('Initial status is "pending"');
  } else {
    fail(`Expected "pending", got "${initialStatus.status}"`, initialStatus);
  }

  // ── Step 4: Simulate Wallet Callback ──
  console.log('\n📋 Step 4: Simulate Lightning Wallet Callback');
  
  // Generate a test keypair (simulating a Lightning wallet)
  const privateKey = secp256k1.utils.randomPrivateKey();
  const publicKey = secp256k1.getPublicKey(privateKey, true); // compressed
  const pubkeyHex = bytesToHex(publicKey);
  
  console.log(`  Generated test pubkey: ${pubkeyHex.substring(0, 20)}...`);
  
  // Sign the k1 challenge - secp256k1.sign returns DER-encoded Uint8Array
  const k1Bytes = hexToBytes(challenge.k1);
  const msgHash = sha256(k1Bytes);
  
  // @noble/secp256k1 v1.x sign() returns DER-encoded signature directly
  const derSig: Uint8Array = await secp256k1.sign(msgHash, privateKey);
  const sigHex = bytesToHex(derSig);
  
  console.log(`  Signature (DER): ${sigHex.substring(0, 40)}... (${derSig.length} bytes)`);
  
  // Build the callback URL the wallet would call
  const walletCallbackUrl = `${callbackUrl}&sig=${sigHex}&key=${pubkeyHex}`;
  console.log(`\n  GET ${walletCallbackUrl.substring(0, 80)}...`);
  
  const callbackResult = await fetchJSON(walletCallbackUrl);
  console.log(`  Response:`, JSON.stringify(callbackResult));
  
  if (callbackResult.status === 'OK') {
    pass('Wallet callback returned status=OK');
  } else {
    fail(`Wallet callback failed: ${callbackResult.status} - ${callbackResult.reason}`, callbackResult);
    
    // If signature verification failed, try signing k1 directly (without sha256)
    if (callbackResult.reason?.includes('signature') || callbackResult.reason?.includes('Verification')) {
      console.log('\n  🔄 Trying alternative: sign k1 directly (without sha256)...');
      const derSig2: Uint8Array = await secp256k1.sign(k1Bytes, privateKey);
      const sigHex2 = bytesToHex(derSig2);
      
      const altUrl = `${callbackUrl}&sig=${sigHex2}&key=${pubkeyHex}`;
      const altResult = await fetchJSON(altUrl);
      console.log(`  Alt response:`, JSON.stringify(altResult));
      
      if (altResult.status === 'OK') {
        pass('Alternative signing method worked (sign k1 directly)');
      } else {
        fail('Alternative signing also failed', altResult);
      }
    }
    
    return { passed, failed };
  }

  // ── Step 5: Check Status After Wallet Callback ──
  console.log('\n📋 Step 5: Check Status After Wallet Callback (should be verified)');
  console.log(`  GET ${API_URL}/auth/lightning/status/${challenge.k1}`);
  
  const verifiedStatus = await fetchJSON(`${API_URL}/auth/lightning/status/${challenge.k1}`);
  console.log(`  Response:`, JSON.stringify(verifiedStatus, null, 2));
  
  if (verifiedStatus.status === 'verified') {
    pass('Status is "verified"');
  } else {
    fail(`Expected "verified", got "${verifiedStatus.status}"`, verifiedStatus);
  }
  
  if (verifiedStatus.token) {
    pass(`Got JWT token: ${verifiedStatus.token.substring(0, 30)}...`);
  } else {
    fail('No JWT token in verified response');
  }
  
  if (verifiedStatus.user) {
    pass(`Got user: id=${verifiedStatus.user.id}, name=${verifiedStatus.user.name}`);
  } else {
    fail('No user object in verified response');
  }

  // ── Step 6: Verify JWT Token Works ──
  if (verifiedStatus.token) {
    console.log('\n📋 Step 6: Verify JWT Token Works');
    console.log(`  GET ${API_URL}/auth/me`);
    
    const meResponse = await fetch(`${API_URL}/auth/me`, {
      headers: { 'Authorization': `Bearer ${verifiedStatus.token}` }
    });
    const meData = await meResponse.json();
    
    if (meResponse.ok && meData.user) {
      pass(`Token works! User: ${meData.user.name} (${meData.user.email || 'no email'})`);
      pass(`Lightning pubkey: ${meData.user.lightningPubkey?.substring(0, 20)}...`);
    } else {
      fail('JWT token rejected by /auth/me', meData);
    }
  }

  // ── Step 7: Test Polling Behavior (what the frontend does) ──
  console.log('\n📋 Step 7: Test Rapid Polling (simulating frontend)');
  
  // Get a fresh challenge
  const challenge2 = await fetchJSON(`${API_URL}/auth/lightning/challenge`);
  
  // Poll 3 times quickly (should all be pending)
  let allPending = true;
  for (let i = 0; i < 3; i++) {
    const s = await fetchJSON(`${API_URL}/auth/lightning/status/${challenge2.k1}`);
    if (s.status !== 'pending') {
      allPending = false;
      fail(`Poll ${i+1}: Expected pending, got ${s.status}`);
    }
    await new Promise(r => setTimeout(r, 500));
  }
  if (allPending) pass('3 rapid polls all returned "pending"');
  
  // Now sign it
  const k1Bytes2 = hexToBytes(challenge2.k1);
  const msgHash2 = sha256(k1Bytes2);
  const derSig2: Uint8Array = await secp256k1.sign(msgHash2, privateKey);
  const callbackUrl2 = decodeLnurl(challenge2.lnurl);
  
  const cbResult2 = await fetchJSON(`${callbackUrl2}&sig=${bytesToHex(derSig2)}&key=${pubkeyHex}`);
  if (cbResult2.status === 'OK') {
    pass('Second challenge signed successfully');
  } else {
    fail('Second challenge callback failed', cbResult2);
  }
  
  // Poll again - should now be verified
  const finalStatus = await fetchJSON(`${API_URL}/auth/lightning/status/${challenge2.k1}`);
  if (finalStatus.status === 'verified' && finalStatus.token) {
    pass('After signing, poll returns "verified" with token');
  } else {
    fail('After signing, poll did not return verified', finalStatus);
  }
  
  // Poll AGAIN - should still be verified (not deleted)
  const finalStatus2 = await fetchJSON(`${API_URL}/auth/lightning/status/${challenge2.k1}`);
  if (finalStatus2.status === 'verified' && finalStatus2.token) {
    pass('Second poll after signing still returns "verified" (not prematurely deleted)');
  } else {
    fail('Second poll after signing failed - challenge may have been deleted too early!', finalStatus2);
  }

  return { passed, failed };
}

// ============================================
// Run Tests
// ============================================

(async () => {
  try {
    const { passed, failed } = await testLightningLogin();
    
    console.log('\n' + '='.repeat(60));
    console.log(`Results: ${passed} passed, ${failed} failed`);
    console.log('='.repeat(60));
    
    if (failed > 0) {
      console.log('\n💡 Troubleshooting tips:');
      console.log('  - Check server logs for errors');
      console.log('  - Verify LIGHTNING_AUTH_URL or LNURL_BASE_URL env vars');
      console.log('  - Ensure the callback URL is publicly accessible');
      console.log('  - Check that @noble/secp256k1 is installed');
      process.exit(1);
    } else {
      console.log('\n🎉 All tests passed! Lightning login is working correctly.');
      process.exit(0);
    }
  } catch (err) {
    console.error('\n💥 Unexpected error:', err);
    process.exit(1);
  }
})();
