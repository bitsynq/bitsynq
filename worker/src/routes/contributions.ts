/**
 * Contributions Routes - Contribution record management
 */

import { Hono } from 'hono';
import type { Env, Contribution, CreateContributionRequest } from '../types';
import { verifyToken, generateId } from '../middleware/auth';

// Extended context with user info
type AuthContext = {
	Bindings: Env;
	Variables: {
		userId: string;
	};
};

const contributions = new Hono<AuthContext>();

/**
 * Authentication middleware
 */
contributions.use('/*', async (c, next) => {
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
 * Helper: Check if user is project member
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
 * GET /api/projects/:projectId/contributions
 * List all contributions for a project
 */
contributions.get('/:projectId/contributions', async (c) => {
	try {
		const userId = c.get('userId');
		const projectId = c.req.param('projectId');

		// Check membership
		const membership = await checkMembership(c.env.DB, projectId, userId);
		if (!membership) {
			return c.json({ error: 'Project not found or access denied' }, 404);
		}

		// Get query parameters for pagination
		const page = parseInt(c.req.query('page') || '1');
		const limit = Math.min(parseInt(c.req.query('limit') || '50'), 100);
		const offset = (page - 1) * limit;

		// Get contributions with user info
		const result = await c.env.DB.prepare(
			`SELECT c.*, u.display_name as user_display_name, u.avatar_url as user_avatar_url
       FROM contributions c
       INNER JOIN users u ON c.user_id = u.id
       WHERE c.project_id = ?
       ORDER BY c.created_at DESC
       LIMIT ? OFFSET ?`
		).bind(projectId, limit, offset).all();

		// Get total count
		const countResult = await c.env.DB.prepare(
			`SELECT COUNT(*) as total FROM contributions WHERE project_id = ?`
		).bind(projectId).first<{ total: number }>();

		return c.json({
			contributions: result.results || [],
			pagination: {
				page,
				limit,
				total: countResult?.total || 0,
				total_pages: Math.ceil((countResult?.total || 0) / limit),
			},
		});
	} catch (error) {
		console.error('List contributions error:', error);
		return c.json({ error: 'Internal server error' }, 500);
	}
});

/**
 * POST /api/projects/:projectId/contributions
 * Manually add a contribution record
 */
contributions.post('/:projectId/contributions', async (c) => {
	try {
		const userId = c.get('userId');
		const projectId = c.req.param('projectId');
		const body = await c.req.json<CreateContributionRequest>();

		// Check if user is admin
		const membership = await checkMembership(c.env.DB, projectId, userId);
		if (!membership || membership.role !== 'admin') {
			return c.json({ error: 'Only admins can add contributions' }, 403);
		}

		// Validate input
		if (!body.user_id) {
			return c.json({ error: 'user_id is required' }, 400);
		}
		if (typeof body.ratio !== 'number' || body.ratio < 0 || body.ratio > 100) {
			return c.json({ error: 'ratio must be a number between 0 and 100' }, 400);
		}

		// Check if target user is a member
		const targetMembership = await checkMembership(c.env.DB, projectId, body.user_id);
		if (!targetMembership) {
			return c.json({ error: 'Target user is not a project member' }, 400);
		}

		const contributionId = generateId();
		const now = new Date().toISOString();

		// Create contribution record
		await c.env.DB.prepare(
			`INSERT INTO contributions (id, project_id, user_id, ratio, source_type, source_id, description, created_by, created_at)
       VALUES (?, ?, ?, ?, 'manual', NULL, ?, ?, ?)`
		).bind(
			contributionId,
			projectId,
			body.user_id,
			body.ratio,
			body.description || null,
			userId,
			now
		).run();

		// Update user's total contributed
		await c.env.DB.prepare(
			`UPDATE user_balances
       SET total_contributed = total_contributed + ?, last_updated = ?
       WHERE user_id = ? AND project_id = ?`
		).bind(body.ratio, now, body.user_id, projectId).run();

		const contribution: Contribution = {
			id: contributionId,
			project_id: projectId,
			user_id: body.user_id,
			ratio: body.ratio,
			source_type: 'manual',
			source_id: null,
			description: body.description || null,
			created_by: userId,
			created_at: now,
		};

		return c.json(contribution, 201);
	} catch (error) {
		console.error('Create contribution error:', error);
		return c.json({ error: 'Internal server error' }, 500);
	}
});

/**
 * GET /api/projects/:projectId/contributions/summary
 * Get contribution summary by user
 */
contributions.get('/:projectId/contributions/summary', async (c) => {
	try {
		const userId = c.get('userId');
		const projectId = c.req.param('projectId');

		// Check membership
		const membership = await checkMembership(c.env.DB, projectId, userId);
		if (!membership) {
			return c.json({ error: 'Project not found or access denied' }, 404);
		}

		// Get summary grouped by user
		const summary = await c.env.DB.prepare(
			`SELECT
         c.user_id,
         u.display_name,
         u.avatar_url,
         SUM(c.ratio) as total_ratio,
         COUNT(*) as contribution_count,
         MAX(c.created_at) as last_contribution
       FROM contributions c
       INNER JOIN users u ON c.user_id = u.id
       WHERE c.project_id = ?
       GROUP BY c.user_id
       ORDER BY total_ratio DESC`
		).bind(projectId).all();

		// Calculate percentages
		const results = summary.results || [];
		const grandTotal = results.reduce((sum: number, r: any) => sum + (r.total_ratio || 0), 0);

		const summaryWithPercentage = results.map((r: any) => ({
			...r,
			percentage: grandTotal > 0 ? ((r.total_ratio / grandTotal) * 100).toFixed(2) : 0,
		}));

		return c.json({
			summary: summaryWithPercentage,
			grand_total: grandTotal,
		});
	} catch (error) {
		console.error('Get contribution summary error:', error);
		return c.json({ error: 'Internal server error' }, 500);
	}
});

/**
 * DELETE /api/projects/:projectId/contributions/:contributionId
 * Delete a contribution record
 */
contributions.delete('/:projectId/contributions/:contributionId', async (c) => {
	try {
		const userId = c.get('userId');
		const projectId = c.req.param('projectId');
		const contributionId = c.req.param('contributionId');

		// Check if user is admin
		const membership = await checkMembership(c.env.DB, projectId, userId);
		if (!membership || membership.role !== 'admin') {
			return c.json({ error: 'Only admins can delete contributions' }, 403);
		}

		// Get contribution to restore balance
		const contribution = await c.env.DB.prepare(
			`SELECT user_id, ratio FROM contributions WHERE id = ? AND project_id = ?`
		).bind(contributionId, projectId).first<{ user_id: string; ratio: number }>();

		if (!contribution) {
			return c.json({ error: 'Contribution not found' }, 404);
		}

		const now = new Date().toISOString();

		// Delete contribution
		await c.env.DB.prepare(
			`DELETE FROM contributions WHERE id = ?`
		).bind(contributionId).run();

		// Restore user's total contributed
		await c.env.DB.prepare(
			`UPDATE user_balances
       SET total_contributed = total_contributed - ?, last_updated = ?
       WHERE user_id = ? AND project_id = ?`
		).bind(contribution.ratio, now, contribution.user_id, projectId).run();

		return c.json({ message: 'Contribution deleted successfully' });
	} catch (error) {
		console.error('Delete contribution error:', error);
		return c.json({ error: 'Internal server error' }, 500);
	}
});

export default contributions;
