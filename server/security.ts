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
