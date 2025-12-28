/**
 * Google OAuth Routes
 *
 * Implements OAuth 2.0 authorization code flow for Google Sign-In
 * https://developers.google.com/identity/protocols/oauth2/web-server
 */

import { Hono } from 'hono';
import type { Env, User, AuthResponse } from '../types';
import { createToken, generateId } from '../middleware/auth';

const googleAuth = new Hono<{ Bindings: Env }>();

// Google OAuth endpoints
const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const GOOGLE_USERINFO_URL = 'https://www.googleapis.com/oauth2/v2/userinfo';

/**
 * GET /api/auth/google
 * Redirect to Google OAuth consent screen
 */
googleAuth.get('/google', (c) => {
	const params = new URLSearchParams({
		client_id: c.env.GOOGLE_CLIENT_ID,
		redirect_uri: c.env.GOOGLE_REDIRECT_URI,
		response_type: 'code',
		scope: 'openid email profile',
		access_type: 'offline',
		prompt: 'consent',
	});

	const authUrl = `${GOOGLE_AUTH_URL}?${params.toString()}`;
	return c.redirect(authUrl);
});

/**
 * GET /api/auth/google/url
 * Get the Google OAuth URL (for SPA to handle redirect itself)
 */
googleAuth.get('/google/url', (c) => {
	const params = new URLSearchParams({
		client_id: c.env.GOOGLE_CLIENT_ID,
		redirect_uri: c.env.GOOGLE_REDIRECT_URI,
		response_type: 'code',
		scope: 'openid email profile',
		access_type: 'offline',
		prompt: 'consent',
	});

	const authUrl = `${GOOGLE_AUTH_URL}?${params.toString()}`;
	return c.json({ url: authUrl });
});

/**
 * POST /api/auth/google/callback
 * Exchange authorization code for tokens and create/login user
 */
googleAuth.post('/google/callback', async (c) => {
	try {
		const { code } = await c.req.json<{ code: string }>();

		if (!code) {
			return c.json({ error: 'Authorization code is required' }, 400);
		}

		// Exchange code for tokens
		const tokenResponse = await fetch(GOOGLE_TOKEN_URL, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/x-www-form-urlencoded',
			},
			body: new URLSearchParams({
				code,
				client_id: c.env.GOOGLE_CLIENT_ID,
				client_secret: c.env.GOOGLE_CLIENT_SECRET,
				redirect_uri: c.env.GOOGLE_REDIRECT_URI,
				grant_type: 'authorization_code',
			}),
		});

		if (!tokenResponse.ok) {
			const errorText = await tokenResponse.text();
			console.error('Token exchange error:', errorText);
			return c.json({ error: 'Failed to exchange authorization code', details: errorText }, 400);
		}

		const tokens = await tokenResponse.json<{
			access_token: string;
			id_token: string;
			refresh_token?: string;
		}>();

		// Get user info from Google
		const userInfoResponse = await fetch(GOOGLE_USERINFO_URL, {
			headers: {
				Authorization: `Bearer ${tokens.access_token}`,
			},
		});

		if (!userInfoResponse.ok) {
			return c.json({ error: 'Failed to get user info from Google' }, 400);
		}

		const googleUser = await userInfoResponse.json<{
			id: string;
			email: string;
			name: string;
			picture: string;
		}>();

		// Check if user exists
		let user = await c.env.DB.prepare(
			'SELECT * FROM users WHERE email = ?'
		).bind(googleUser.email.toLowerCase()).first<User>();

		const now = new Date().toISOString();

		if (!user) {
			// Create new user from Google account
			const userId = generateId();

			await c.env.DB.prepare(
				`INSERT INTO users (id, email, password_hash, display_name, avatar_url, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
			).bind(
				userId,
				googleUser.email.toLowerCase(),
				'GOOGLE_OAUTH', // Special marker for OAuth users (no password)
				googleUser.name,
				googleUser.picture,
				now,
				now
			).run();

			user = {
				id: userId,
				email: googleUser.email.toLowerCase(),
				password_hash: 'GOOGLE_OAUTH',
				display_name: googleUser.name,
				wallet_address: null,
				avatar_url: googleUser.picture,
				created_at: now,
				updated_at: now,
			};
		} else {
			// Update existing user's avatar if changed
			if (googleUser.picture && googleUser.picture !== user.avatar_url) {
				await c.env.DB.prepare(
					'UPDATE users SET avatar_url = ?, updated_at = ? WHERE id = ?'
				).bind(googleUser.picture, now, user.id).run();
				user.avatar_url = googleUser.picture;
			}
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
		console.error('Google OAuth error:', error);
		return c.json({ error: 'Internal server error' }, 500);
	}
});

export default googleAuth;
