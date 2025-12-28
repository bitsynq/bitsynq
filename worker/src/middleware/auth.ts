/**
 * JWT Authentication utilities for Bitsynq
 * Uses SubtleCrypto for HMAC-SHA256 signing (Cloudflare Workers compatible)
 */

import type { JWTPayload } from '../types';

// Base64URL encoding/decoding helpers
function base64UrlEncode(data: Uint8Array): string {
	return btoa(String.fromCharCode(...data))
		.replace(/\+/g, '-')
		.replace(/\//g, '_')
		.replace(/=+$/, '');
}

function base64UrlDecode(str: string): Uint8Array {
	// Add padding if needed
	const padded = str + '='.repeat((4 - (str.length % 4)) % 4);
	const binary = atob(padded.replace(/-/g, '+').replace(/_/g, '/'));
	return Uint8Array.from(binary, (c) => c.charCodeAt(0));
}

/**
 * Create HMAC key from secret string
 */
async function createHmacKey(secret: string): Promise<CryptoKey> {
	const encoder = new TextEncoder();
	return crypto.subtle.importKey(
		'raw',
		encoder.encode(secret),
		{ name: 'HMAC', hash: 'SHA-256' },
		false,
		['sign', 'verify']
	);
}

/**
 * Sign data with HMAC-SHA256
 */
async function signHmac(data: string, key: CryptoKey): Promise<string> {
	const encoder = new TextEncoder();
	const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(data));
	return base64UrlEncode(new Uint8Array(signature));
}

/**
 * Create a JWT token
 * @param payload - The JWT payload (without exp/iat)
 * @param secret - The secret key for signing
 * @param expiresInSeconds - Token expiration time (default 7 days)
 */
export async function createToken(
	payload: Omit<JWTPayload, 'exp' | 'iat'>,
	secret: string,
	expiresInSeconds: number = 7 * 24 * 60 * 60  // 7 days
): Promise<string> {
	const now = Math.floor(Date.now() / 1000);
	const fullPayload: JWTPayload = {
		...payload,
		iat: now,
		exp: now + expiresInSeconds,
	};

	// JWT Header
	const header = { alg: 'HS256', typ: 'JWT' };
	const encoder = new TextEncoder();

	const headerB64 = base64UrlEncode(encoder.encode(JSON.stringify(header)));
	const payloadB64 = base64UrlEncode(encoder.encode(JSON.stringify(fullPayload)));

	const key = await createHmacKey(secret);
	const signature = await signHmac(`${headerB64}.${payloadB64}`, key);

	return `${headerB64}.${payloadB64}.${signature}`;
}

/**
 * Verify and decode a JWT token
 * @param token - The JWT token to verify
 * @param secret - The secret key for verification
 * @returns The decoded payload, or null if invalid
 */
export async function verifyToken(
	token: string,
	secret: string
): Promise<JWTPayload | null> {
	try {
		const parts = token.split('.');
		if (parts.length !== 3) {
			return null;
		}

		const [headerB64, payloadB64, signatureB64] = parts;

		// Verify signature
		const key = await createHmacKey(secret);
		const expectedSig = await signHmac(`${headerB64}.${payloadB64}`, key);

		if (signatureB64 !== expectedSig) {
			return null; // Invalid signature
		}

		// Decode payload
		const payloadJson = new TextDecoder().decode(base64UrlDecode(payloadB64));
		const payload: JWTPayload = JSON.parse(payloadJson);

		// Check expiration
		const now = Math.floor(Date.now() / 1000);
		if (payload.exp && payload.exp < now) {
			return null; // Token expired
		}

		return payload;
	} catch {
		return null;
	}
}

/**
 * Hash a password using SHA-256 with salt
 * Note: For production, consider using bcrypt or argon2 via a library
 * This is a simplified version for Cloudflare Workers
 */
export async function hashPassword(password: string): Promise<string> {
	// Generate a random salt
	const salt = crypto.getRandomValues(new Uint8Array(16));
	const saltB64 = base64UrlEncode(salt);

	// Hash password with salt
	const encoder = new TextEncoder();
	const data = encoder.encode(saltB64 + password);
	const hashBuffer = await crypto.subtle.digest('SHA-256', data);
	const hashB64 = base64UrlEncode(new Uint8Array(hashBuffer));

	// Return salt:hash format
	return `${saltB64}:${hashB64}`;
}

/**
 * Verify a password against a stored hash
 */
export async function verifyPassword(
	password: string,
	storedHash: string
): Promise<boolean> {
	try {
		const [saltB64, expectedHashB64] = storedHash.split(':');
		if (!saltB64 || !expectedHashB64) {
			return false;
		}

		// Hash the input password with the same salt
		const encoder = new TextEncoder();
		const data = encoder.encode(saltB64 + password);
		const hashBuffer = await crypto.subtle.digest('SHA-256', data);
		const hashB64 = base64UrlEncode(new Uint8Array(hashBuffer));

		return hashB64 === expectedHashB64;
	} catch {
		return false;
	}
}

/**
 * Generate a random UUID
 */
export function generateId(): string {
	return crypto.randomUUID();
}
