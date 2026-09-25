/**
 * Security & Cryptographic Utilities for Ship Asaan
 * Secure password hashing, cryptographic token generation, and OTP hashing.
 */

import crypto from 'crypto';

/**
 * Hash a password using PBKDF2 with a 512-bit output and 100,000 iterations
 */
export function hashPassword(password: string): { hash: string; salt: string } {
  const salt = crypto.randomBytes(32).toString('hex');
  const hash = crypto.pbkdf2Sync(password, salt, 100000, 64, 'sha512').toString('hex');
  return { hash, salt };
}

/**
 * Verify a password against its stored hash and salt
 */
export function verifyPassword(password: string, storedHash: string, storedSalt: string): boolean {
  try {
    if (!storedHash || !storedSalt) return false;
    const calculatedHash = crypto.pbkdf2Sync(password, storedSalt, 100000, 64, 'sha512').toString('hex');
    const bufCalc = Buffer.from(calculatedHash, 'hex');
    const bufStored = Buffer.from(storedHash, 'hex');
    if (bufCalc.length !== bufStored.length) {
      return false;
    }
    return crypto.timingSafeEqual(bufCalc, bufStored);
  } catch {
    return false;
  }
}

const JWT_SECRET =
  process.env.SESSION_SECRET ||
  process.env.JWT_SECRET ||
  'ship_asaan_production_jwt_master_secret_2026_secure';

export interface TokenPayload {
  userId: string;
  email: string;
  roleId: string;
  createdAt: number;
  expiresAt: number;
}

/**
 * Generate a tamper-proof cryptographically signed stateless token (HMAC-SHA256)
 */
export function createSignedToken(
  payload: Omit<TokenPayload, 'createdAt' | 'expiresAt'>,
  expiresInMs = 7 * 24 * 60 * 60 * 1000 // 7 days
): string {
  const now = Date.now();
  const fullPayload: TokenPayload = {
    ...payload,
    createdAt: now,
    expiresAt: now + expiresInMs
  };
  const body = Buffer.from(JSON.stringify(fullPayload)).toString('base64url');
  const signature = crypto.createHmac('sha256', JWT_SECRET).update(body).digest('base64url');
  return `${body}.${signature}`;
}

/**
 * Verify a tamper-proof cryptographically signed token
 */
export function verifySignedToken(token: string): TokenPayload | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 2) return null;
    const [body, signature] = parts;
    const expectedSig = crypto.createHmac('sha256', JWT_SECRET).update(body).digest('base64url');
    const sigBuf = Buffer.from(signature);
    const expBuf = Buffer.from(expectedSig);
    if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
      return null;
    }
    const payload: TokenPayload = JSON.parse(Buffer.from(body, 'base64url').toString('utf-8'));
    if (Date.now() > payload.expiresAt) {
      return null;
    }
    return payload;
  } catch {
    return null;
  }
}

/**
 * Generate a cryptographically secure random session token
 */
export function generateSessionToken(): string {
  return crypto.randomBytes(48).toString('base64url');
}

/**
 * Generate a cryptographically secure numeric 6-digit OTP
 */
export function generateSecureOtp(): string {
  const num = crypto.randomInt(100000, 999999);
  return num.toString();
}

/**
 * Hash an OTP for secure storage
 */
export function hashOtp(otp: string): string {
  return crypto.createHash('sha256').update(otp).digest('hex');
}

/**
 * Generate a unique ID with an optional prefix
 */
export function generateId(prefix: string = 'id'): string {
  const unique = crypto.randomBytes(8).toString('hex');
  return `${prefix}_${Date.now().toString(36)}_${unique}`;
}
