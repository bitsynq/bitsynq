/**
 * Tokens Routes - Token distribution and balance management
 */

import { Hono } from 'hono';
import type { Env, DistributeTokensRequest, Contribution } from '../types';
import { verifyToken, generateId } from '../middleware/auth';
import {
	calculateTokenDistribution,
	fairDistribution,
	serializeDistribution
} from '../services/token-calculator';
import {
	getAdminWallet,
	getTokenBalance,
	getTokenInfo,
	transferTokens,
	batchTransferTokens,
	parseTokenAmount,
	formatTokenAmount,
	isValidAddress,
	getEthBalance
} from '../services/ethereum';

// Extended context with user info
type AuthContext = {
	Bindings: Env;
	Variables: {
		userId: string;
	};
};

const tokens = new Hono<AuthContext>();

/**
 * Authentication middleware
 */
tokens.use('/*', async (c, next) => {
	const authHeader = c.req.header('Authorization');
	if (!authHeader || !authHeader.startsWith('Bearer ')) {
		return c.json({ error: 'Missing or invalid authorization header' }, 401);
	}

	const token = authHeader.substring(7);
	const payload = await verifyToken(token, c.env.JWT_SECRET);

	if (!payload) {
		return c.json({ error: 'Invalid or expired token' }, 401);
	}

	c.set('userId', payload.sub);
	await next();
});

/**
 * Helper: Check membership
 */
async function checkMembership(
	db: D1Database,
	projectId: string,
	userId: string
): Promise<{ role: string } | null> {
	return db.prepare(
		`SELECT role FROM project_members WHERE project_id = ? AND user_id = ?`
	).bind(projectId, userId).first<{ role: string }>();
}

/**
 * GET /api/projects/:projectId/balances
 * Get token balances for all project members
 */
tokens.get('/:projectId/balances', async (c) => {
	try {
		const userId = c.get('userId');
		const projectId = c.req.param('projectId');

		// Check membership
		const membership = await checkMembership(c.env.DB, projectId, userId);
		if (!membership) {
			return c.json({ error: 'Project not found or access denied' }, 404);
		}

		const balances = await c.env.DB.prepare(
			`SELECT ub.*, u.display_name, u.avatar_url
       FROM user_balances ub
       INNER JOIN users u ON ub.user_id = u.id
       WHERE ub.project_id = ?
       ORDER BY ub.balance DESC`
		).bind(projectId).all();

		// Calculate total tokens distributed
		const totalResult = await c.env.DB.prepare(
			`SELECT COALESCE(SUM(total_tokens), 0) as total
       FROM token_distributions
       WHERE project_id = ? AND status = 'confirmed'`
		).bind(projectId).first<{ total: number }>();

		return c.json({
			balances: balances.results || [],
			total_tokens_distributed: totalResult?.total || 0,
		});
	} catch (error) {
		console.error('Get balances error:', error);
		return c.json({ error: 'Internal server error' }, 500);
	}
});

/**
 * GET /api/projects/:projectId/distributions
 * Get token distribution history
 */
tokens.get('/:projectId/distributions', async (c) => {
	try {
		const userId = c.get('userId');
		const projectId = c.req.param('projectId');

		// Check membership
		const membership = await checkMembership(c.env.DB, projectId, userId);
		if (!membership) {
			return c.json({ error: 'Project not found or access denied' }, 404);
		}

		const distributions = await c.env.DB.prepare(
			`SELECT td.*, u.display_name as created_by_name
       FROM token_distributions td
       INNER JOIN users u ON td.created_by = u.id
       WHERE td.project_id = ?
       ORDER BY td.created_at DESC`
		).bind(projectId).all();

		// Parse distribution_data JSON for each record
		const results = (distributions.results || []).map((d: any) => ({
			...d,
			distribution_data: d.distribution_data ? JSON.parse(d.distribution_data) : null,
		}));

		return c.json(results);
	} catch (error) {
		console.error('Get distributions error:', error);
		return c.json({ error: 'Internal server error' }, 500);
	}
});

/**
 * POST /api/projects/:projectId/distributions/preview
 * Preview token distribution before confirming
 */
tokens.post('/:projectId/distributions/preview', async (c) => {
	try {
		const userId = c.get('userId');
		const projectId = c.req.param('projectId');
		const body = await c.req.json<DistributeTokensRequest>();

		// Check if user is admin
		const membership = await checkMembership(c.env.DB, projectId, userId);
		if (!membership || membership.role !== 'admin') {
			return c.json({ error: 'Only admins can distribute tokens' }, 403);
		}

		// Validate input
		if (!body.total_tokens || body.total_tokens <= 0) {
			return c.json({ error: 'total_tokens must be a positive integer' }, 400);
		}

		// Get all contributions for this project
		const contributions = await c.env.DB.prepare(
			`SELECT user_id, ratio FROM contributions WHERE project_id = ?`
		).bind(projectId).all<{ user_id: string; ratio: number }>();

		if (!contributions.results || contributions.results.length === 0) {
			return c.json({ error: 'No contributions found for this project' }, 400);
		}

		// Calculate distribution
		const rawDistribution = calculateTokenDistribution(
			contributions.results,
			body.total_tokens
		);
		const finalDistribution = fairDistribution(rawDistribution, body.total_tokens);

		// Get user details
		const userIds = Array.from(finalDistribution.keys());
		const usersResult = await c.env.DB.prepare(
			`SELECT id, display_name, avatar_url FROM users WHERE id IN (${userIds.map(() => '?').join(',')})`
		).bind(...userIds).all<{ id: string; display_name: string; avatar_url: string }>();

		const userMap = new Map(
			(usersResult.results || []).map(u => [u.id, u])
		);

		// Build preview response
		const preview = Array.from(finalDistribution.values()).map(entry => ({
			user_id: entry.userId,
			display_name: userMap.get(entry.userId)?.display_name || 'Unknown',
			avatar_url: userMap.get(entry.userId)?.avatar_url,
			total_ratio: entry.totalRatio,
			percentage: entry.percentage,
			token_amount: entry.tokenAmount,
		}));

		preview.sort((a, b) => b.token_amount - a.token_amount);

		return c.json({
			milestone_name: body.milestone_name,
			total_tokens: body.total_tokens,
			distribution: preview,
		});
	} catch (error) {
		console.error('Preview distribution error:', error);
		return c.json({ error: 'Internal server error' }, 500);
	}
});

/**
 * POST /api/projects/:projectId/distribute
 * Distribute tokens to project members based on contributions
 */
tokens.post('/:projectId/distribute', async (c) => {
	try {
		const userId = c.get('userId');
		const projectId = c.req.param('projectId');
		const body = await c.req.json<DistributeTokensRequest>();

		// Check if user is admin
		const membership = await checkMembership(c.env.DB, projectId, userId);
		if (!membership || membership.role !== 'admin') {
			return c.json({ error: 'Only admins can distribute tokens' }, 403);
		}

		// Validate input
		if (!body.total_tokens || body.total_tokens <= 0) {
			return c.json({ error: 'total_tokens must be a positive integer' }, 400);
		}

		// Get all contributions for this project
		const contributions = await c.env.DB.prepare(
			`SELECT user_id, ratio FROM contributions WHERE project_id = ?`
		).bind(projectId).all<{ user_id: string; ratio: number }>();

		if (!contributions.results || contributions.results.length === 0) {
			return c.json({ error: 'No contributions found for this project' }, 400);
		}

		// Calculate distribution
		const rawDistribution = calculateTokenDistribution(
			contributions.results,
			body.total_tokens
		);
		const finalDistribution = fairDistribution(rawDistribution, body.total_tokens);

		const distributionId = generateId();
		const now = new Date().toISOString();

		// Handle on-chain transfer if requested
		let txHash: string | null = null;
		if (body.on_chain) {
			// Validate Ethereum configuration
			if (!c.env.ETH_PRIVATE_KEY || !c.env.ETH_TOKEN_CONTRACT || !c.env.ETH_BATCH_DISTRIBUTOR || !c.env.ETH_RPC_URL) {
				return c.json({ error: 'Ethereum configuration not set. Missing ETH_BATCH_DISTRIBUTOR or other keys.' }, 500);
			}

			// Get user wallet addresses and validate
			const userIds = Array.from(finalDistribution.keys());
			const usersResult = await c.env.DB.prepare(
				`SELECT id, wallet_address FROM users WHERE id IN (${userIds.map(() => '?').join(',')})`
			).bind(...userIds).all<{ id: string; wallet_address: string | null }>();

			const userWallets = new Map(
				(usersResult.results || []).map(u => [u.id, u.wallet_address])
			);

			// Check all users have wallet addresses
			const missingWallets: string[] = [];
			const batchTransfers: Array<{ to: string; amount: bigint }> = [];
			const tokenDecimals = 18;

			for (const [userIdKey, entry] of finalDistribution) {
				const wallet = userWallets.get(userIdKey);
				if (!wallet || !isValidAddress(wallet)) {
					missingWallets.push(userIdKey);
				} else {
					batchTransfers.push({
						to: wallet,
						amount: parseTokenAmount(entry.tokenAmount.toString(), tokenDecimals)
					});
				}
			}

			if (missingWallets.length > 0) {
				return c.json({
					error: 'Some users do not have valid wallet addresses',
					missing_users: missingWallets,
				}, 400);
			}

			// Execute Batch Transfer
			const result = await batchTransferTokens(
				c.env.ETH_BATCH_DISTRIBUTOR,
				c.env.ETH_TOKEN_CONTRACT,
				c.env.ETH_PRIVATE_KEY,
				c.env.ETH_RPC_URL,
				batchTransfers
			);

			if (!result.success || !result.txHash) {
				console.error('Batch transfer failed:', result.error);
				return c.json({
					error: 'Blockchain batch transfer failed',
					details: result.error,
				}, 500);
			}

			txHash = result.txHash;
			console.log(`On-chain batch distribution completed. Tx: ${txHash}`);
		}

		// Create distribution record (with tx_hash if on-chain)
		await c.env.DB.prepare(
			`INSERT INTO token_distributions (id, project_id, milestone_name, total_tokens, distribution_data, tx_hash, status, created_by, created_at)
       VALUES (?, ?, ?, ?, ?, ?, 'confirmed', ?, ?)`
		).bind(
			distributionId,
			projectId,
			body.milestone_name || null,
			body.total_tokens,
			serializeDistribution(finalDistribution),
			txHash,
			userId,
			now
		).run();

		// Update user balances
		for (const [userIdKey, entry] of finalDistribution) {
			await c.env.DB.prepare(
				`UPDATE user_balances
         SET balance = balance + ?, last_updated = ?
         WHERE user_id = ? AND project_id = ?`
			).bind(entry.tokenAmount, now, userIdKey, projectId).run();
		}

		// Build response
		const distributionList = Array.from(finalDistribution.values()).map(entry => ({
			user_id: entry.userId,
			token_amount: entry.tokenAmount,
			percentage: entry.percentage,
		}));

		return c.json({
			id: distributionId,
			message: 'Tokens distributed successfully',
			milestone_name: body.milestone_name,
			total_tokens: body.total_tokens,
			distribution: distributionList,
			tx_hash: txHash,
			on_chain: !!body.on_chain,
		}, 201);
	} catch (error) {
		console.error('Distribute tokens error:', error);
		return c.json({ error: 'Internal server error' }, 500);
	}
});

/**
 * GET /api/projects/:projectId/my-balance
 * Get current user's token balance for a project
 */
tokens.get('/:projectId/my-balance', async (c) => {
	try {
		const userId = c.get('userId');
		const projectId = c.req.param('projectId');

		// Check membership
		const membership = await checkMembership(c.env.DB, projectId, userId);
		if (!membership) {
			return c.json({ error: 'Project not found or access denied' }, 404);
		}

		const balance = await c.env.DB.prepare(
			`SELECT * FROM user_balances WHERE user_id = ? AND project_id = ?`
		).bind(userId, projectId).first();

		if (!balance) {
			return c.json({
				user_id: userId,
				project_id: projectId,
				balance: 0,
				total_contributed: 0,
			});
		}

		return c.json(balance);
	} catch (error) {
		console.error('Get my balance error:', error);
		return c.json({ error: 'Internal server error' }, 500);
	}
});

/**
 * GET /api/tokens/admin-wallet
 * Get admin wallet info (for funding with testnet ETH)
 */
tokens.get('/admin-wallet', async (c) => {
	try {
		if (!c.env.ETH_PRIVATE_KEY || !c.env.ETH_RPC_URL) {
			return c.json({ error: 'Ethereum not configured' }, 500);
		}

		const wallet = getAdminWallet(c.env.ETH_PRIVATE_KEY, c.env.ETH_RPC_URL);
		const ethBalance = await getEthBalance(wallet.address, c.env.ETH_RPC_URL);

		let tokenBalance = '0';
		let tokenInfo = null;
		if (c.env.ETH_TOKEN_CONTRACT) {
			try {
				tokenInfo = await getTokenInfo(c.env.ETH_TOKEN_CONTRACT, c.env.ETH_RPC_URL);
				const rawBalance = await getTokenBalance(c.env.ETH_TOKEN_CONTRACT, wallet.address, c.env.ETH_RPC_URL);
				tokenBalance = formatTokenAmount(rawBalance, tokenInfo.decimals);
			} catch (e) {
				console.error('Failed to get token info:', e);
			}
		}

		return c.json({
			address: wallet.address,
			eth_balance: ethBalance,
			token_balance: tokenBalance,
			token_info: tokenInfo,
			network: 'sepolia',
			faucet_url: 'https://sepoliafaucet.com',
		});
	} catch (error) {
		console.error('Get admin wallet error:', error);
		return c.json({ error: 'Internal server error' }, 500);
	}
});

export default tokens;

