/**
 * Users Routes - User profile management
 */

import { Hono } from 'hono';
import type { Env, User } from '../types';
import { verifyToken } from '../middleware/auth';

// Extended context with user info
type AuthContext = {
	Bindings: Env;
	Variables: {
		userId: string;
		userEmail: string;
	};
};

const users = new Hono<AuthContext>();

/**
 * Authentication middleware
 * Verifies JWT token and sets user info in context
 */
users.use('/*', async (c, next) => {
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
	c.set('userEmail', payload.email);
	await next();
});

/**
 * GET /api/users/me
 * Get current user profile
 */
users.get('/me', async (c) => {
	try {
		const userId = c.get('userId');

		const user = await c.env.DB.prepare(
			`SELECT id, email, display_name, wallet_address, avatar_url, created_at, updated_at
       FROM users WHERE id = ?`
		).bind(userId).first<Omit<User, 'password_hash'>>();

		if (!user) {
			return c.json({ error: 'User not found' }, 404);
		}

		return c.json(user);
	} catch (error) {
		console.error('Get user error:', error);
		return c.json({ error: 'Internal server error' }, 500);
	}
});

/**
 * PUT /api/users/me
 * Update current user profile
 */
users.put('/me', async (c) => {
	try {
		const userId = c.get('userId');
		const body = await c.req.json<{
			display_name?: string;
			wallet_address?: string;
			avatar_url?: string;
		}>();

		// Build dynamic update query
		const updates: string[] = [];
		const values: (string | null)[] = [];

		if (body.display_name !== undefined) {
			updates.push('display_name = ?');
			values.push(body.display_name);
		}
		if (body.wallet_address !== undefined) {
			updates.push('wallet_address = ?');
			values.push(body.wallet_address);
		}
		if (body.avatar_url !== undefined) {
			updates.push('avatar_url = ?');
			values.push(body.avatar_url);
		}

		if (updates.length === 0) {
			return c.json({ error: 'No fields to update' }, 400);
		}

		updates.push('updated_at = ?');
		values.push(new Date().toISOString());
		values.push(userId);

		await c.env.DB.prepare(
			`UPDATE users SET ${updates.join(', ')} WHERE id = ?`
		).bind(...values).run();

		// Fetch and return updated user
		const user = await c.env.DB.prepare(
			`SELECT id, email, display_name, wallet_address, avatar_url, created_at, updated_at
       FROM users WHERE id = ?`
		).bind(userId).first<Omit<User, 'password_hash'>>();

		return c.json(user);
	} catch (error) {
		console.error('Update user error:', error);
		return c.json({ error: 'Internal server error' }, 500);
	}
});

/**
 * GET /api/users/:id
 * Get public user profile by ID
 */
users.get('/:id', async (c) => {
	try {
		const userId = c.req.param('id');

		// Only return public fields
		const user = await c.env.DB.prepare(
			`SELECT id, display_name, avatar_url, created_at
       FROM users WHERE id = ?`
		).bind(userId).first();

		if (!user) {
			return c.json({ error: 'User not found' }, 404);
		}

		return c.json(user);
	} catch (error) {
		console.error('Get user by ID error:', error);
		return c.json({ error: 'Internal server error' }, 500);
	}
});

/**
 * GET /api/users/search
 * Search users by email (for adding project members)
 */
users.get('/search', async (c) => {
	try {
		const email = c.req.query('email');
		if (!email) {
			return c.json({ error: 'Email query parameter required' }, 400);
		}

		const users = await c.env.DB.prepare(
			`SELECT id, email, display_name, avatar_url
       FROM users WHERE email LIKE ? LIMIT 10`
		).bind(`%${email}%`).all();

		return c.json(users.results || []);
	} catch (error) {
		console.error('Search users error:', error);
		return c.json({ error: 'Internal server error' }, 500);
	}
});

export default users;
