import crypto from 'crypto';
import { bech32 } from 'bech32';
import * as secp256k1 from '@noble/secp256k1';
import prisma from '../lib/prisma';

const LIGHTNING_AUTH_URL = process.env.LIGHTNING_AUTH_URL || 'http://localhost:3001/api/auth/lightning';

// ============================================
// LNURL-AUTH Implementation
// https://github.com/lnurl/luds/blob/luds/04.md
// ============================================

/**
 * Generate a random k1 challenge for LNURL-auth
 */
export function generateK1(): string {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Create LNURL-auth challenge and store in database
 */
export async function createChallenge(): Promise<{ k1: string; lnurl: string; qrData: string }> {
  const k1 = generateK1();
  const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes

  // Store challenge in database
  await prisma.lightningChallenge.create({
    data: {
      k1,
      expiresAt,
    },
  });

  // Build LNURL
  const callbackUrl = `${LIGHTNING_AUTH_URL}/callback?tag=login&k1=${k1}`;
  const lnurl = encodeLnurl(callbackUrl);

  return {
    k1,
    lnurl,
    qrData: lnurl, // For QR code generation
  };
}

/**
 * Verify LNURL-auth response
 * @param k1 - The challenge
 * @param sig - The signature (hex)
 * @param key - The public key (hex)
 */
export async function verifyChallenge(
  k1: string,
  sig: string,
  key: string
): Promise<{ success: boolean; pubkey?: string; error?: string }> {
  try {
    // Find the challenge
    const challenge = await prisma.lightningChallenge.findUnique({
      where: { k1 },
    });

    if (!challenge) {
      return { success: false, error: 'Challenge not found' };
    }

    if (challenge.used) {
      return { success: false, error: 'Challenge already used' };
    }

    if (challenge.expiresAt < new Date()) {
      return { success: false, error: 'Challenge expired' };
    }

    // Verify signature
    const k1Bytes = hexToBytes(k1);
    const sigBytes = hexToBytes(sig);
    const keyBytes = hexToBytes(key);

    // LNURL-auth uses secp256k1 ECDSA with DER encoding
    const isValid = await verifySignature(k1Bytes, sigBytes, keyBytes);

    if (!isValid) {
      return { success: false, error: 'Invalid signature' };
    }

    // Mark challenge as used
    await prisma.lightningChallenge.update({
      where: { k1 },
      data: { used: true, userId: key },
    });

    return { success: true, pubkey: key };
  } catch (error) {
    console.error('Lightning auth verification error:', error);
    return { success: false, error: 'Verification failed' };
  }
}

/**
 * Check if a challenge is verified and get the pubkey
 */
export async function getChallengeStatus(k1: string): Promise<{
  verified: boolean;
  pubkey?: string;
  expired: boolean;
}> {
  const challenge = await prisma.lightningChallenge.findUnique({
    where: { k1 },
  });

  if (!challenge) {
    return { verified: false, expired: true };
  }

  const expired = challenge.expiresAt < new Date();
  
  return {
    verified: challenge.used,
    pubkey: challenge.userId || undefined,
    expired,
  };
}

/**
 * Clean up expired challenges (run periodically)
 */
export async function cleanupExpiredChallenges(): Promise<number> {
  const result = await prisma.lightningChallenge.deleteMany({
    where: {
      expiresAt: { lt: new Date() },
    },
  });
  return result.count;
}

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Encode URL to LNURL (bech32)
 */
function encodeLnurl(url: string): string {
  const words = bech32.toWords(Buffer.from(url, 'utf8'));
  return bech32.encode('lnurl', words, 1023);
}

/**
 * Decode LNURL to URL
 */
export function decodeLnurl(lnurl: string): string {
  const { prefix, words } = bech32.decode(lnurl, 1023);
  if (prefix !== 'lnurl') throw new Error('Invalid lnurl prefix');
  return Buffer.from(bech32.fromWords(words)).toString('utf8');
}

/**
 * Convert hex string to Uint8Array
 */
function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substr(i, 2), 16);
  }
  return bytes;
}

/**
 * Verify secp256k1 signature
 * LNURL-auth uses DER-encoded signatures
 */
async function verifySignature(
  message: Uint8Array,
  signature: Uint8Array,
  publicKey: Uint8Array
): Promise<boolean> {
  try {
    // The signature from LNURL-auth is DER encoded
    // We need to parse it to get r and s values
    const { r, s } = parseDerSignature(signature);
    
    // Concatenate r and s for noble/secp256k1 format (64 bytes)
    const compactSig = new Uint8Array(64);
    compactSig.set(r, 0);
    compactSig.set(s, 32);
    
    // LNURL-auth: The k1 (32 bytes) IS the message hash
    // The wallet signs sha256(k1), so we hash it for verification
    const msgHash = sha256(message);
    
    console.log('Verifying signature...');
    console.log('Message (k1) length:', message.length);
    console.log('Signature length:', compactSig.length);
    console.log('PublicKey length:', publicKey.length);
    
    // Try both: with hash and without (different wallets may behave differently)
    let result = secp256k1.verify(compactSig, msgHash, publicKey);
    if (!result) {
      // Some wallets sign the k1 directly without hashing
      result = secp256k1.verify(compactSig, message, publicKey);
      console.log('Tried direct message verification:', result);
    }
    
    console.log('Signature verification result:', result);
    return result;
  } catch (error) {
    console.error('Signature verification error:', error);
    return false;
  }
}

/**
 * Parse DER-encoded signature to extract r and s
 */
function parseDerSignature(derSig: Uint8Array): { r: Uint8Array; s: Uint8Array } {
  let offset = 0;
  
  // Check header byte (0x30 = SEQUENCE)
  if (derSig[offset++] !== 0x30) {
    throw new Error('Invalid DER signature: expected SEQUENCE');
  }
  
  // Total length (skip)
  offset++;
  
  // R value
  if (derSig[offset++] !== 0x02) {
    throw new Error('Invalid DER signature: expected INTEGER for R');
  }
  const rLen = derSig[offset++];
  const rRaw = derSig.slice(offset, offset + rLen);
  offset += rLen;
  
  // S value
  if (derSig[offset++] !== 0x02) {
    throw new Error('Invalid DER signature: expected INTEGER for S');
  }
  const sLen = derSig[offset++];
  const sRaw = derSig.slice(offset, offset + sLen);
  
  // Remove leading zeros and pad to 32 bytes
  const r = padTo32Bytes(trimLeadingZeros(new Uint8Array(rRaw)));
  const s = padTo32Bytes(trimLeadingZeros(new Uint8Array(sRaw)));
  
  return { r, s };
}

function trimLeadingZeros(arr: Uint8Array): Uint8Array {
  let start = 0;
  while (start < arr.length - 1 && arr[start] === 0) {
    start++;
  }
  return arr.slice(start);
}

function padTo32Bytes(arr: Uint8Array): Uint8Array {
  if (arr.length === 32) return new Uint8Array(arr);
  if (arr.length > 32) return new Uint8Array(arr.slice(arr.length - 32));
  const padded = new Uint8Array(32);
  padded.set(new Uint8Array(arr), 32 - arr.length);
  return padded;
}

function sha256(data: Uint8Array): Uint8Array {
  const hash = crypto.createHash('sha256');
  hash.update(data);
  return new Uint8Array(hash.digest());
}
