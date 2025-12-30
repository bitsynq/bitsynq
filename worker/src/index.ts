/**
 * Bitsynq API - Main Entry Point
 *
 * Cloudflare Worker with Hono framework
 * Provides RESTful API for contribution tracking and token distribution
 */

import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import type { Env } from './types';

// Import route handlers
import authRoutes from './routes/auth';
import googleAuthRoutes from './routes/google-auth';
import usersRoutes from './routes/users';
import projectsRoutes from './routes/projects';
import contributionsRoutes from './routes/contributions';
import meetingsRoutes from './routes/meetings';
import tokensRoutes from './routes/tokens';

const app = new Hono<{ Bindings: Env }>();

// =============================================================================
// MIDDLEWARE
// =============================================================================

// Enable CORS for frontend access
app.use('/*', cors({
	origin: (origin, c) => {
		// In production, you should restrict this to your frontend domain
		const allowedOrigin = c.env.CORS_ORIGIN || '*';
		if (allowedOrigin === '*') return '*';
		return origin;
	},
	allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
	allowHeaders: ['Content-Type', 'Authorization'],
	exposeHeaders: ['Content-Length'],
	maxAge: 600,
	credentials: true,
}));

// Request logging (disabled in production for performance)
// app.use('/*', logger());

// =============================================================================
// HEALTH CHECK
// =============================================================================

app.get('/', (c) => {
	return c.json({
		name: 'Bitsynq API',
		version: '1.0.0',
		status: 'healthy',
		timestamp: new Date().toISOString(),
	});
});

app.get('/api/health', (c) => {
	return c.json({
		status: 'ok',
		timestamp: new Date().toISOString(),
	});
});

// =============================================================================
// API ROUTES
// =============================================================================

// Auth routes (no prefix, they define their own paths)
app.route('/api/auth', authRoutes);

// Google OAuth routes
app.route('/api/auth', googleAuthRoutes);

// User routes
app.route('/api/users', usersRoutes);

// Project routes
app.route('/api/projects', projectsRoutes);

// Contribution routes (nested under projects)
app.route('/api/projects', contributionsRoutes);

// Meeting routes (nested under projects)
app.route('/api/projects', meetingsRoutes);

// Token routes (nested under projects)
app.route('/api/projects', tokensRoutes);




// =============================================================================
// ERROR HANDLING
// =============================================================================

// 404 handler
app.notFound((c) => {
	return c.json({
		error: 'Not Found',
		message: `Route ${c.req.method} ${c.req.path} not found`,
	}, 404);
});

// Global error handler
app.onError((err, c) => {
	console.error('Unhandled error:', err);
	return c.json({
		error: 'Internal Server Error',
		message: process.env.NODE_ENV === 'development' ? err.message : 'An unexpected error occurred',
	}, 500);
});

// =============================================================================
// EXPORT
// =============================================================================

export default app;
