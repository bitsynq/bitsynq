/**
 * Auth Routes - User registration and login
 */

import { Hono } from 'hono';
import type { Env, RegisterRequest, LoginRequest, AuthResponse, User } from '../types';
import { createToken, hashPassword, verifyPassword, generateId } from '../middleware/auth';

const auth = new Hono<{ Bindings: Env }>();

/**
 * POST /api/auth/register
 * Register a new user account
 */
auth.post('/register', async (c) => {
	try {
		const body = await c.req.json<RegisterRequest>();

		// Validate required fields
		if (!body.email || !body.password || !body.display_name) {
			return c.json({ error: 'Missing required fields: email, password, display_name' }, 400);
		}

		// Validate email format
		const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
		if (!emailRegex.test(body.email)) {
			return c.json({ error: 'Invalid email format' }, 400);
		}

		// Validate password length
		if (body.password.length < 8) {
			return c.json({ error: 'Password must be at least 8 characters' }, 400);
		}

		// Check if email already exists
		const existingUser = await c.env.DB.prepare(
			'SELECT id FROM users WHERE email = ?'
		).bind(body.email.toLowerCase()).first();

		if (existingUser) {
			return c.json({ error: 'Email already registered' }, 409);
		}

		// Create new user
		const userId = generateId();
		const passwordHash = await hashPassword(body.password);
		const now = new Date().toISOString();

		await c.env.DB.prepare(
			`INSERT INTO users (id, email, password_hash, display_name, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?)`
		).bind(
			userId,
			body.email.toLowerCase(),
			passwordHash,
			body.display_name,
			now,
			now
		).run();

		// Generate JWT token
		const token = await createToken(
			{ sub: userId, email: body.email.toLowerCase() },
			c.env.JWT_SECRET
		);

		// Return user data (without password_hash)
		const response: AuthResponse = {
			token,
			user: {
				id: userId,
				email: body.email.toLowerCase(),
				display_name: body.display_name,
				wallet_address: null,
				avatar_url: null,
				created_at: now,
				updated_at: now,
			},
		};

		return c.json(response, 201);
	} catch (error) {
		console.error('Register error:', error);
		return c.json({ error: 'Internal server error' }, 500);
	}
});

/**
 * POST /api/auth/login
 * Login with email and password
 */
auth.post('/login', async (c) => {
	try {
		const body = await c.req.json<LoginRequest>();

		// Validate required fields
		if (!body.email || !body.password) {
			return c.json({ error: 'Missing required fields: email, password' }, 400);
		}

		// Find user by email
		const user = await c.env.DB.prepare(
			'SELECT * FROM users WHERE email = ?'
		).bind(body.email.toLowerCase()).first<User>();

		if (!user) {
			return c.json({ error: 'Invalid email or password' }, 401);
		}

		// Verify password
		const passwordValid = await verifyPassword(body.password, user.password_hash);
		if (!passwordValid) {
			return c.json({ error: 'Invalid email or password' }, 401);
		}

		// Generate JWT token
		const token = await createToken(
			{ sub: user.id, email: user.email },
			c.env.JWT_SECRET
		);

		// Return user data (without password_hash)
		const { password_hash, ...userWithoutPassword } = user;
		const response: AuthResponse = {
			token,
			user: userWithoutPassword,
		};

		return c.json(response);
	} catch (error) {
		console.error('Login error:', error);
		return c.json({ error: 'Internal server error' }, 500);
	}
});

/**
 * POST /api/auth/logout
 * Logout (invalidate token - for future KV-based session management)
 */
auth.post('/logout', async (c) => {
	// For JWT, logout is handled client-side by removing the token
	// In the future, we could add token blacklisting via KV
	return c.json({ message: 'Logged out successfully' });
});

export default auth;
