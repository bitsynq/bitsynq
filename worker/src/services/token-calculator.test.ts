/**
 * Unit tests for Token Calculator service
 */

import { describe, it, expect } from 'vitest';
import {
	calculateTokenDistribution,
	fairDistribution,
	serializeDistribution,
	deserializeDistribution,
} from './token-calculator';

describe('token-calculator service', () => {
	describe('calculateTokenDistribution', () => {
		it('should calculate distribution for single contributor', () => {
			const contributions = [{ user_id: 'user1', ratio: 100 }];
			const distribution = calculateTokenDistribution(contributions, 1000);

			expect(distribution.size).toBe(1);
			expect(distribution.get('user1')?.tokenAmount).toBe(1000);
			expect(distribution.get('user1')?.percentage).toBe(100);
		});

		it('should calculate distribution for multiple contributors', () => {
			const contributions = [
				{ user_id: 'user1', ratio: 50 },
				{ user_id: 'user2', ratio: 30 },
				{ user_id: 'user3', ratio: 20 },
			];
			const distribution = calculateTokenDistribution(contributions, 1000);

			expect(distribution.size).toBe(3);
			expect(distribution.get('user1')?.tokenAmount).toBe(500);
			expect(distribution.get('user2')?.tokenAmount).toBe(300);
			expect(distribution.get('user3')?.tokenAmount).toBe(200);
		});

		it('should aggregate multiple contributions from same user', () => {
			const contributions = [
				{ user_id: 'user1', ratio: 30 },
				{ user_id: 'user1', ratio: 20 },
				{ user_id: 'user2', ratio: 50 },
			];
			const distribution = calculateTokenDistribution(contributions, 1000);

			expect(distribution.size).toBe(2);
			expect(distribution.get('user1')?.totalRatio).toBe(50);
			expect(distribution.get('user1')?.tokenAmount).toBe(500);
		});

		it('should handle uneven divisions with floor', () => {
			const contributions = [
				{ user_id: 'user1', ratio: 33.33 },
				{ user_id: 'user2', ratio: 33.33 },
				{ user_id: 'user3', ratio: 33.34 },
			];
			const distribution = calculateTokenDistribution(contributions, 100);

			// Due to floor, sum might be less than 100
			const total = Array.from(distribution.values()).reduce(
				(sum, e) => sum + e.tokenAmount,
				0
			);
			expect(total).toBeLessThanOrEqual(100);
		});
	});

	describe('fairDistribution', () => {
		it('should distribute remainder to top contributors', () => {
			const contributions = [
				{ user_id: 'user1', ratio: 33.33 },
				{ user_id: 'user2', ratio: 33.33 },
				{ user_id: 'user3', ratio: 33.34 },
			];
			const rawDistribution = calculateTokenDistribution(contributions, 100);
			const fairDist = fairDistribution(rawDistribution, 100);

			const total = Array.from(fairDist.values()).reduce(
				(sum, e) => sum + e.tokenAmount,
				0
			);
			expect(total).toBe(100);
		});

		it('should handle edge case with 1 token', () => {
			const contributions = [
				{ user_id: 'user1', ratio: 50 },
				{ user_id: 'user2', ratio: 50 },
			];
			const rawDistribution = calculateTokenDistribution(contributions, 1);
			const fairDist = fairDistribution(rawDistribution, 1);

			const total = Array.from(fairDist.values()).reduce(
				(sum, e) => sum + e.tokenAmount,
				0
			);
			expect(total).toBe(1);
		});
	});

	describe('serialization', () => {
		it('should serialize and deserialize distribution correctly', () => {
			const contributions = [
				{ user_id: 'user1', ratio: 60 },
				{ user_id: 'user2', ratio: 40 },
			];
			const distribution = calculateTokenDistribution(contributions, 1000);

			const serialized = serializeDistribution(distribution);
			expect(typeof serialized).toBe('string');

			const deserialized = deserializeDistribution(serialized);
			expect(deserialized.size).toBe(2);
			expect(deserialized.get('user1')?.tokenAmount).toBe(600);
		});
	});
});
