/**
 * Unit tests for Meeting Parser service
 */

import { describe, it, expect } from 'vitest';
import { parseMeetingTranscript, matchParticipantsToMembers } from './meeting-parser';

describe('meeting-parser service', () => {
	describe('parseMeetingTranscript', () => {
		it('should parse a simple transcript with Next steps', () => {
			const transcript = `
Meeting summary

Quick recap
A brief recap of the meeting.

Next steps
John: Complete the project documentation
Sarah: Review the code changes
Mike: Contact the client

Summary
The team discussed project progress.
`;

			const result = parseMeetingTranscript(transcript);

			expect(result.participants.length).toBeGreaterThan(0);
			expect(result.participants.some(p => p.name === 'John')).toBe(true);
			expect(result.participants.some(p => p.name === 'Sarah')).toBe(true);
			expect(result.participants.some(p => p.name === 'Mike')).toBe(true);
		});

		it('should calculate suggested ratios that sum to 100', () => {
			const transcript = `
Next steps
Alice: Implement feature A
Bob: Implement feature B
Charlie: Write tests
`;

			const result = parseMeetingTranscript(transcript);

			const totalRatio = result.participants.reduce((sum, p) => sum + p.suggested_ratio, 0);
			expect(totalRatio).toBeCloseTo(100, 0);
		});

		it('should handle Chinese names and colons', () => {
			const transcript = `
Next steps
和融：完成 token sender 設計
胡舜元：取得 Mohammad 的評估
`;

			const result = parseMeetingTranscript(transcript);

			expect(result.participants.length).toBe(2);
			expect(result.participants.some(p => p.name === '和融')).toBe(true);
			expect(result.participants.some(p => p.name === '胡舜元')).toBe(true);
		});

		it('should handle combined names with "and"', () => {
			const transcript = `
Next steps
Saad and Sunny: Discuss the implementation details
`;

			const result = parseMeetingTranscript(transcript);

			expect(result.participants.length).toBe(2);
			expect(result.participants.some(p => p.name === 'Saad')).toBe(true);
			expect(result.participants.some(p => p.name === 'Sunny')).toBe(true);
		});

		it('should return empty participants for empty transcript', () => {
			const result = parseMeetingTranscript('');

			expect(result.participants).toHaveLength(0);
			expect(result.parse_confidence).toBe(0);
		});

		it('should calculate higher scores for implementation keywords', () => {
			const transcript = `
Next steps
Developer: Implement and build the new feature
Reviewer: Review the document
`;

			const result = parseMeetingTranscript(transcript);
			const developer = result.participants.find(p => p.name === 'Developer');
			const reviewer = result.participants.find(p => p.name === 'Reviewer');

			expect(developer).toBeDefined();
			expect(reviewer).toBeDefined();
			// Developer should have higher score due to "implement" and "build" keywords
			expect(developer!.score).toBeGreaterThan(reviewer!.score);
		});
	});

	describe('matchParticipantsToMembers', () => {
		const members = [
			{ id: 'user1', display_name: 'John Doe', email: 'john@example.com', aliases: ['Johnny'] },
			{ id: 'user2', display_name: '黃和融', email: 'sunny@example.com', aliases: ['和融', 'Sunny'] },
			{ id: 'user3', display_name: 'Alice Smith', email: 'alice@example.com' },
		];

		it('should match by exact display name', () => {
			const participants = [{ name: 'John Doe', matched_user_id: undefined, speak_count: 1, estimated_duration_seconds: 60, keywords_found: [], score: 1, suggested_ratio: 50 }];

			const result = matchParticipantsToMembers(participants, members);

			expect(result[0].matched_user_id).toBe('user1');
		});

		it('should match by alias', () => {
			const participants = [{ name: 'Johnny', matched_user_id: undefined, speak_count: 1, estimated_duration_seconds: 60, keywords_found: [], score: 1, suggested_ratio: 50 }];

			const result = matchParticipantsToMembers(participants, members);

			expect(result[0].matched_user_id).toBe('user1');
		});

		it('should match Chinese partial names', () => {
			const participants = [{ name: '和融', matched_user_id: undefined, speak_count: 1, estimated_duration_seconds: 60, keywords_found: [], score: 1, suggested_ratio: 50 }];

			const result = matchParticipantsToMembers(participants, members);

			expect(result[0].matched_user_id).toBe('user2');
		});

		it('should return undefined for unmatched participants', () => {
			const participants = [{ name: 'Unknown Person', matched_user_id: undefined, speak_count: 1, estimated_duration_seconds: 60, keywords_found: [], score: 1, suggested_ratio: 50 }];

			const result = matchParticipantsToMembers(participants, members);

			expect(result[0].matched_user_id).toBeUndefined();
		});
	});
});
