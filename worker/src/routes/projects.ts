/**
 * Projects Routes - Project and member management
 */

import { Hono } from 'hono';
import type {
	Env,
	Project,
	ProjectMember,
	CreateProjectRequest,
	UpdateProjectRequest,
	AddMemberRequest,
} from '../types';
import { verifyToken, generateId } from '../middleware/auth';

// Extended context with user info
type AuthContext = {
	Bindings: Env;
	Variables: {
		userId: string;
	};
};

const projects = new Hono<AuthContext>();

/**
 * Authentication middleware
 */
projects.use('/*', async (c, next) => {
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
 * GET /api/projects
 * List all projects the user is a member of
 */
projects.get('/', async (c) => {
	try {
		const userId = c.get('userId');

		const result = await c.env.DB.prepare(
			`SELECT p.*, pm.role as member_role
       FROM projects p
       INNER JOIN project_members pm ON p.id = pm.project_id
       WHERE pm.user_id = ?
       ORDER BY p.created_at DESC`
		).bind(userId).all();

		return c.json(result.results || []);
	} catch (error) {
		console.error('List projects error:', error);
		return c.json({ error: 'Internal server error' }, 500);
	}
});

/**
 * POST /api/projects
 * Create a new project
 */
projects.post('/', async (c) => {
	try {
		const userId = c.get('userId');
		const body = await c.req.json<CreateProjectRequest>();

		// Validate required fields
		if (!body.name || body.name.trim().length === 0) {
			return c.json({ error: 'Project name is required' }, 400);
		}

		const projectId = generateId();
		const now = new Date().toISOString();

		// Create project
		await c.env.DB.prepare(
			`INSERT INTO projects (id, name, description, owner_id, token_symbol, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, 'active', ?, ?)`
		).bind(
			projectId,
			body.name.trim(),
			body.description || null,
			userId,
			body.token_symbol || null,
			now,
			now
		).run();

		// Add owner as admin member
		await c.env.DB.prepare(
			`INSERT INTO project_members (project_id, user_id, role, joined_at)
       VALUES (?, ?, 'admin', ?)`
		).bind(projectId, userId, now).run();

		// Initialize user balance
		await c.env.DB.prepare(
			`INSERT INTO user_balances (user_id, project_id, balance, total_contributed, last_updated)
       VALUES (?, ?, 0, 0, ?)`
		).bind(userId, projectId, now).run();

		const project: Project = {
			id: projectId,
			name: body.name.trim(),
			description: body.description || null,
			owner_id: userId,
			token_symbol: body.token_symbol || null,
			status: 'active',
			created_at: now,
			updated_at: now,
		};

		return c.json(project, 201);
	} catch (error) {
		console.error('Create project error:', error);
		return c.json({ error: 'Internal server error' }, 500);
	}
});

/**
 * GET /api/projects/:id
 * Get project details with members
 */
projects.get('/:id', async (c) => {
	try {
		const userId = c.get('userId');
		const projectId = c.req.param('id');

		// Check if user is a member
		const membership = await c.env.DB.prepare(
			`SELECT role FROM project_members WHERE project_id = ? AND user_id = ?`
		).bind(projectId, userId).first<{ role: string }>();

		if (!membership) {
			return c.json({ error: 'Project not found or access denied' }, 404);
		}

		// Get project details
		const project = await c.env.DB.prepare(
			`SELECT * FROM projects WHERE id = ?`
		).bind(projectId).first<Project>();

		if (!project) {
			return c.json({ error: 'Project not found' }, 404);
		}

		// Get members
		const members = await c.env.DB.prepare(
			`SELECT u.id, u.email, u.display_name, u.avatar_url, pm.role, pm.joined_at,
              COALESCE(ub.balance, 0) as balance,
              COALESCE(ub.total_contributed, 0) as total_contributed
       FROM project_members pm
       INNER JOIN users u ON pm.user_id = u.id
       LEFT JOIN user_balances ub ON ub.user_id = u.id AND ub.project_id = pm.project_id
       WHERE pm.project_id = ?
       ORDER BY pm.joined_at ASC`
		).bind(projectId).all();

		return c.json({
			...project,
			members: members.results || [],
			current_user_role: membership.role,
		});
	} catch (error) {
		console.error('Get project error:', error);
		return c.json({ error: 'Internal server error' }, 500);
	}
});

/**
 * PUT /api/projects/:id
 * Update project details
 */
projects.put('/:id', async (c) => {
	try {
		const userId = c.get('userId');
		const projectId = c.req.param('id');
		const body = await c.req.json<UpdateProjectRequest>();

		// Check if user is admin
		const membership = await c.env.DB.prepare(
			`SELECT role FROM project_members WHERE project_id = ? AND user_id = ?`
		).bind(projectId, userId).first<{ role: string }>();

		if (!membership || membership.role !== 'admin') {
			return c.json({ error: 'Only admins can update projects' }, 403);
		}

		// Build dynamic update query
		const updates: string[] = [];
		const values: (string | null)[] = [];

		if (body.name !== undefined) {
			updates.push('name = ?');
			values.push(body.name.trim());
		}
		if (body.description !== undefined) {
			updates.push('description = ?');
			values.push(body.description);
		}
		if (body.token_symbol !== undefined) {
			updates.push('token_symbol = ?');
			values.push(body.token_symbol);
		}
		if (body.status !== undefined) {
			updates.push('status = ?');
			values.push(body.status);
		}

		if (updates.length === 0) {
			return c.json({ error: 'No fields to update' }, 400);
		}

		updates.push('updated_at = ?');
		values.push(new Date().toISOString());
		values.push(projectId);

		await c.env.DB.prepare(
			`UPDATE projects SET ${updates.join(', ')} WHERE id = ?`
		).bind(...values).run();

		// Fetch updated project
		const project = await c.env.DB.prepare(
			`SELECT * FROM projects WHERE id = ?`
		).bind(projectId).first<Project>();

		return c.json(project);
	} catch (error) {
		console.error('Update project error:', error);
		return c.json({ error: 'Internal server error' }, 500);
	}
});

/**
 * DELETE /api/projects/:id
 * Archive a project (soft delete)
 */
projects.delete('/:id', async (c) => {
	try {
		const userId = c.get('userId');
		const projectId = c.req.param('id');

		// Check if user is owner
		const project = await c.env.DB.prepare(
			`SELECT owner_id FROM projects WHERE id = ?`
		).bind(projectId).first<{ owner_id: string }>();

		if (!project) {
			return c.json({ error: 'Project not found' }, 404);
		}

		if (project.owner_id !== userId) {
			return c.json({ error: 'Only the owner can delete/archive projects' }, 403);
		}

		// Soft delete by setting status to archived
		await c.env.DB.prepare(
			`UPDATE projects SET status = 'archived', updated_at = ? WHERE id = ?`
		).bind(new Date().toISOString(), projectId).run();

		return c.json({ message: 'Project archived successfully' });
	} catch (error) {
		console.error('Delete project error:', error);
		return c.json({ error: 'Internal server error' }, 500);
	}
});

/**
 * POST /api/projects/:id/members
 * Add a member to the project
 */
projects.post('/:id/members', async (c) => {
	try {
		const userId = c.get('userId');
		const projectId = c.req.param('id');
		const body = await c.req.json<AddMemberRequest>();

		// Check if user is admin
		const membership = await c.env.DB.prepare(
			`SELECT role FROM project_members WHERE project_id = ? AND user_id = ?`
		).bind(projectId, userId).first<{ role: string }>();

		if (!membership || membership.role !== 'admin') {
			return c.json({ error: 'Only admins can add members' }, 403);
		}

		// Find target user by ID or email
		let targetUserId = body.user_id;
		if (!targetUserId && body.email) {
			const user = await c.env.DB.prepare(
				`SELECT id FROM users WHERE email = ?`
			).bind(body.email.toLowerCase()).first<{ id: string }>();

			if (!user) {
				return c.json({ error: 'User not found with that email' }, 404);
			}
			targetUserId = user.id;
		}

		if (!targetUserId) {
			return c.json({ error: 'user_id or email required' }, 400);
		}

		// Check if already a member
		const existingMember = await c.env.DB.prepare(
			`SELECT user_id FROM project_members WHERE project_id = ? AND user_id = ?`
		).bind(projectId, targetUserId).first();

		if (existingMember) {
			return c.json({ error: 'User is already a member' }, 409);
		}

		const now = new Date().toISOString();
		const role = body.role || 'member';

		// Add member
		await c.env.DB.prepare(
			`INSERT INTO project_members (project_id, user_id, role, joined_at)
       VALUES (?, ?, ?, ?)`
		).bind(projectId, targetUserId, role, now).run();

		// Initialize user balance
		await c.env.DB.prepare(
			`INSERT INTO user_balances (user_id, project_id, balance, total_contributed, last_updated)
       VALUES (?, ?, 0, 0, ?)`
		).bind(targetUserId, projectId, now).run();

		return c.json({ message: 'Member added successfully' }, 201);
	} catch (error) {
		console.error('Add member error:', error);
		return c.json({ error: 'Internal server error' }, 500);
	}
});

/**
 * DELETE /api/projects/:id/members/:userId
 * Remove a member from the project
 */
projects.delete('/:id/members/:memberId', async (c) => {
	try {
		const userId = c.get('userId');
		const projectId = c.req.param('id');
		const memberId = c.req.param('memberId');

		// Check if user is admin
		const membership = await c.env.DB.prepare(
			`SELECT role FROM project_members WHERE project_id = ? AND user_id = ?`
		).bind(projectId, userId).first<{ role: string }>();

		// Allow admins to remove others, or users to remove themselves
		if (userId !== memberId && (!membership || membership.role !== 'admin')) {
			return c.json({ error: 'Only admins can remove other members' }, 403);
		}

		// Check if target is owner
		const project = await c.env.DB.prepare(
			`SELECT owner_id FROM projects WHERE id = ?`
		).bind(projectId).first<{ owner_id: string }>();

		if (project && project.owner_id === memberId) {
			return c.json({ error: 'Cannot remove the project owner' }, 400);
		}

		// Remove member
		await c.env.DB.prepare(
			`DELETE FROM project_members WHERE project_id = ? AND user_id = ?`
		).bind(projectId, memberId).run();

		return c.json({ message: 'Member removed successfully' });
	} catch (error) {
		console.error('Remove member error:', error);
		return c.json({ error: 'Internal server error' }, 500);
	}
});

export default projects;
