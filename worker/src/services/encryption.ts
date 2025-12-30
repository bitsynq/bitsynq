/**
 * Encryption Service
 * Uses Web Crypto API (AES-GCM) to encrypt/decrypt sensitive data
 */

// Convert string to Uint8Array
function str2ab(str: string): Uint8Array {
	return new TextEncoder().encode(str);
}

// Convert ArrayBuffer/Uint8Array to string
function ab2str(buf: BufferSource): string {
	return new TextDecoder().decode(buf);
}

// Convert ArrayBuffer/Uint8Array to Base64 string
function ab2base64(buf: BufferSource): string {
	// btoa needs a binary string.
	// If buf is ArrayBuffer, view it as Uint8Array.
	const arr = buf instanceof ArrayBuffer ? new Uint8Array(buf) : new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength);
	return btoa(String.fromCharCode(...arr));
}

// Convert Base64 string to Uint8Array
function base642ab(base64: string): Uint8Array {
	return Uint8Array.from(atob(base64), c => c.charCodeAt(0));
}

// Import key from secret string
async function importKey(secret: string): Promise<CryptoKey> {
	// Hash the secret to get a consistent 256-bit key
	const secretBuf = str2ab(secret);
	const hash = await crypto.subtle.digest('SHA-256', secretBuf);

	return crypto.subtle.importKey(
		'raw',
		hash,
		{ name: 'AES-GCM' },
		false,
		['encrypt', 'decrypt']
	);
}

/**
 * Encrypt text using AES-GCM
 * Returns format: "iv_base64:ciphertext_base64"
 */
export async function encrypt(text: string, secret: string): Promise<string> {
	const key = await importKey(secret);
	const iv = crypto.getRandomValues(new Uint8Array(12)); // 96-bit IV
	const encoded = str2ab(text);

	const ciphertext = await crypto.subtle.encrypt(
		{
			name: 'AES-GCM',
			iv: iv,
		},
		key,
		encoded
	);

	return `${ab2base64(iv)}:${ab2base64(ciphertext)}`;
}

/**
 * Decrypt text using AES-GCM
 * Input format: "iv_base64:ciphertext_base64"
 */
export async function decrypt(encryptedText: string, secret: string): Promise<string> {
	const [ivBase64, ciphertextBase64] = encryptedText.split(':');
	if (!ivBase64 || !ciphertextBase64) {
		throw new Error('Invalid encrypted format');
	}

	const key = await importKey(secret);
	const iv = base642ab(ivBase64);
	const ciphertext = base642ab(ciphertextBase64);

	const decrypted = await crypto.subtle.decrypt(
		{
			name: 'AES-GCM',
			iv: iv,
		},
		key,
		ciphertext
	);

	return ab2str(decrypted);
}
