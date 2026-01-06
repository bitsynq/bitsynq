/**
 * Storage Service - Evidence storage using Cloudflare KV
 *
 * Stores meeting transcripts and other contribution evidence.
 * Uses KV for its simplicity and free tier (no credit card required).
 */

import { Env } from '../types';

/**
 * Metadata stored alongside each evidence item.
 */
interface EvidenceMetadata {
	uploadedAt: string;
	type: 'transcript' | 'attachment';
	meetingId: string;
}

export class StorageService {
	private kv: KVNamespace;

	constructor(env: Env) {
		this.kv = env.EVIDENCE_KV;
	}

	/**
	 * Generates a storage key for a meeting transcript.
	 * Format: meetings:{meetingId}:transcript
	 */
	private getTranscriptKey(meetingId: string): string {
		return `meetings:${meetingId}:transcript`;
	}

	/**
	 * Uploads a meeting transcript to KV storage.
	 *
	 * @param meetingId - The unique meeting identifier
	 * @param content - The raw transcript content
	 * @returns The storage key used
	 */
	async uploadTranscript(meetingId: string, content: string): Promise<string> {
		const key = this.getTranscriptKey(meetingId);

		const metadata: EvidenceMetadata = {
			uploadedAt: new Date().toISOString(),
			type: 'transcript',
			meetingId,
		};

		try {
			// KV put with metadata for future querying/debugging
			await this.kv.put(key, content, {
				metadata,
				// Optional: Set expiration if needed (e.g., expirationTtl: 60 * 60 * 24 * 365 for 1 year)
			});
			return key;
		} catch (error) {
			console.error(`Failed to upload transcript for meeting ${meetingId}:`, error);
			throw new Error(`Storage upload failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
		}
	}

	/**
	 * Retrieves a transcript from KV storage.
	 *
	 * @param key - The storage key (or meetingId if using shorthand)
	 * @returns The transcript content, or null if not found
	 */
	async getTranscript(key: string): Promise<string | null> {
		// If user passes meetingId directly, convert to full key
		const storageKey = key.startsWith('meetings:') ? key : this.getTranscriptKey(key);

		try {
			const content = await this.kv.get(storageKey, 'text');
			return content;
		} catch (error) {
			console.error(`Failed to get transcript for key ${storageKey}:`, error);
			return null;
		}
	}

	/**
	 * Deletes a transcript from KV storage.
	 * Useful when deleting a meeting.
	 *
	 * @param meetingId - The meeting identifier
	 */
	async deleteTranscript(meetingId: string): Promise<void> {
		const key = this.getTranscriptKey(meetingId);
		try {
			await this.kv.delete(key);
		} catch (error) {
			console.error(`Failed to delete transcript for meeting ${meetingId}:`, error);
			// Non-critical, log but don't throw
		}
	}
}
