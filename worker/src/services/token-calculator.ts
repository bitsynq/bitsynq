/**
 * Token Calculator Service
 *
 * Calculates token distribution based on contribution ratios
 */

export interface ContributorBalance {
	userId: string;
	totalRatio: number;
	percentage: number;
	tokenAmount: number;
}

/**
 * Calculate token distribution based on contribution ratios
 *
 * @param contributions - Array of contribution records with user_id and ratio
 * @param totalTokens - Total tokens to distribute
 * @returns Distribution map keyed by user_id
 */
export function calculateTokenDistribution(
	contributions: Array<{ user_id: string; ratio: number }>,
	totalTokens: number
): Map<string, ContributorBalance> {
	const userTotals = new Map<string, number>();

	// Sum up ratios per user
	for (const contrib of contributions) {
		const current = userTotals.get(contrib.user_id) || 0;
		userTotals.set(contrib.user_id, current + contrib.ratio);
	}

	// Calculate grand total
	let grandTotal = 0;
	for (const total of userTotals.values()) {
		grandTotal += total;
	}

	// Calculate distribution
	const distribution = new Map<string, ContributorBalance>();

	for (const [userId, totalRatio] of userTotals) {
		const percentage = grandTotal > 0 ? (totalRatio / grandTotal) * 100 : 0;
		const tokenAmount = Math.floor((percentage / 100) * totalTokens);

		distribution.set(userId, {
			userId,
			totalRatio,
			percentage: parseFloat(percentage.toFixed(4)),
			tokenAmount,
		});
	}

	return distribution;
}

/**
 * Calculate fair distribution ensuring all tokens are allocated
 * (handles rounding by giving remainder to top contributors)
 *
 * @param distribution - Initial distribution from calculateTokenDistribution
 * @param totalTokens - Total tokens to distribute
 * @returns Updated distribution with exact token allocation
 */
export function fairDistribution(
	distribution: Map<string, ContributorBalance>,
	totalTokens: number
): Map<string, ContributorBalance> {
	const entries = Array.from(distribution.values());

	// Calculate allocated tokens
	let allocated = entries.reduce((sum, entry) => sum + entry.tokenAmount, 0);
	let remainder = totalTokens - allocated;

	// Sort by percentage (descending) to give remainder to top contributors
	entries.sort((a, b) => b.percentage - a.percentage);

	// Distribute remainder
	let i = 0;
	while (remainder > 0 && i < entries.length) {
		entries[i].tokenAmount += 1;
		remainder -= 1;
		i++;
		if (i >= entries.length) i = 0; // Wrap around if needed
	}

	// Rebuild map
	const result = new Map<string, ContributorBalance>();
	for (const entry of entries) {
		result.set(entry.userId, entry);
	}

	return result;
}

/**
 * Serialize distribution to JSON for storage
 */
export function serializeDistribution(
	distribution: Map<string, ContributorBalance>
): string {
	const obj: Record<string, ContributorBalance> = {};
	for (const [userId, balance] of distribution) {
		obj[userId] = balance;
	}
	return JSON.stringify(obj);
}

/**
 * Deserialize distribution from JSON
 */
export function deserializeDistribution(
	json: string
): Map<string, ContributorBalance> {
	const obj = JSON.parse(json) as Record<string, ContributorBalance>;
	const distribution = new Map<string, ContributorBalance>();
	for (const [userId, balance] of Object.entries(obj)) {
		distribution.set(userId, balance);
	}
	return distribution;
}
