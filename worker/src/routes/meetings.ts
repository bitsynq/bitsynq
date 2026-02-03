/**
 * Meetings Routes - Meeting transcript management and parsing
 */

import { Hono } from 'hono';
import type { Env, Meeting, CreateMeetingRequest, ProcessMeetingRequest } from '../types';
import { verifyToken, generateId } from '../middleware/auth';
import { parseMeetingTranscript, matchParticipantsToMembers } from '../services/meeting-parser';
import { StorageService } from '../services/storage';
import { anchorHash } from '../services/ethereum';

// Extended context with user info
type AuthContext = {
	Bindings: Env;
	Variables: {
		userId: string;
	};
};

const meetings = new Hono<AuthContext>();

/**
 * Helper: Calculate SHA-256 Hash
 */
async function calculateHash(text: string): Promise<string> {
	const msgBuffer = new TextEncoder().encode(text);
	const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
	const hashArray = Array.from(new Uint8Array(hashBuffer));
	return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Authentication middleware
 */
meetings.use('/*', async (c, next) => {
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
 * Helper: Check membership and get role
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
 * GET /api/projects/:projectId/meetings
 * List all meetings for a project
 */
meetings.get('/:projectId/meetings', async (c) => {
	try {
		const userId = c.get('userId');
		const projectId = c.req.param('projectId');

		// Check membership
		const membership = await checkMembership(c.env.DB, projectId, userId);
		if (!membership) {
			return c.json({ error: 'Project not found or access denied' }, 404);
		}

		const result = await c.env.DB.prepare(
			`SELECT id, project_id, title, meeting_date, status, created_by, created_at, content_hash, anchor_tx_hash, anchored_at
       FROM meetings
       WHERE project_id = ?
       ORDER BY created_at DESC`
		).bind(projectId).all();

		return c.json(result.results || []);
	} catch (error) {
		console.error('List meetings error:', error);
		return c.json({ error: 'Internal server error' }, 500);
	}
});

/**
 * POST /api/projects/:projectId/meetings
 * Upload a new meeting transcript
 */
meetings.post('/:projectId/meetings', async (c) => {
	try {
		const userId = c.get('userId');
		const projectId = c.req.param('projectId');
		const body = await c.req.json<CreateMeetingRequest>();

		// Check membership
		const membership = await checkMembership(c.env.DB, projectId, userId);
		if (!membership) {
			return c.json({ error: 'Project not found or access denied' }, 403);
		}

		// Validate input
		if (!body.raw_transcript || body.raw_transcript.trim().length === 0) {
			return c.json({ error: 'raw_transcript is required' }, 400);
		}

		// Parse the transcript
		const parsedData = parseMeetingTranscript(body.raw_transcript);

		// Get project members for matching
		const membersResult = await c.env.DB.prepare(
			`SELECT u.id, u.display_name, u.email, u.aliases
       FROM project_members pm
       INNER JOIN users u ON pm.user_id = u.id
       WHERE pm.project_id = ?`
		).bind(projectId).all<{ id: string; display_name: string; email: string; aliases: string }>();

		// Match participants to members
		const matchedParticipants = matchParticipantsToMembers(
			parsedData.participants,
			membersResult.results || []
		);
		parsedData.participants = matchedParticipants;

		const meetingId = generateId();
		const now = new Date().toISOString();
		
		// Calculate content hash (Digital Fingerprint)
		const contentHash = await calculateHash(body.raw_transcript);

		// Create meeting record
		await c.env.DB.prepare(
			`INSERT INTO meetings (id, project_id, title, meeting_date, raw_transcript, parsed_data, status, created_by, created_at, content_hash)
       VALUES (?, ?, ?, ?, ?, ?, 'pending', ?, ?, ?)`
		).bind(
			meetingId,
			projectId,
			body.title || parsedData.meeting_title || null,
			body.meeting_date || parsedData.meeting_date || null,
			body.raw_transcript,
			JSON.stringify(parsedData),
			userId,
			now,
			contentHash
		).run();

		// Upload transcript to R2 (Evidence Storage)
		const storage = new StorageService(c.env);
		try {
			await storage.uploadTranscript(meetingId, body.raw_transcript);
		} catch (e) {
			console.error(`Failed to upload transcript evidence for meeting ${meetingId}:`, e);
		}

		return c.json({
			id: meetingId,
			project_id: projectId,
			title: body.title || parsedData.meeting_title,
			meeting_date: body.meeting_date || parsedData.meeting_date,
			status: 'pending',
			created_by: userId,
			created_at: now,
			parsed_data: parsedData,
			content_hash: contentHash
		}, 201);
	} catch (error) {
		console.error('Create meeting error:', error);
		return c.json({ error: 'Internal server error' }, 500);
	}
});

/**
 * GET /api/projects/:projectId/meetings/:meetingId
 * Get meeting details including parsed data
 */
meetings.get('/:projectId/meetings/:meetingId', async (c) => {
	try {
		const userId = c.get('userId');
		const projectId = c.req.param('projectId');
		const meetingId = c.req.param('meetingId');

		// Check membership
		const membership = await checkMembership(c.env.DB, projectId, userId);
		if (!membership) {
			return c.json({ error: 'Project not found or access denied' }, 404);
		}

		const meeting = await c.env.DB.prepare(
			`SELECT * FROM meetings WHERE id = ? AND project_id = ?`
		).bind(meetingId, projectId).first<Meeting>();

		if (!meeting) {
			return c.json({ error: 'Meeting not found' }, 404);
		}

		// Parse the JSON fields
		const response = {
			...meeting,
			parsed_data: meeting.parsed_data ? JSON.parse(meeting.parsed_data) : null,
		};

		return c.json(response);
	} catch (error) {
		console.error('Get meeting error:', error);
		return c.json({ error: 'Internal server error' }, 500);
	}
});

/**
 * POST /api/projects/:projectId/meetings/:meetingId/anchor
 * Anchor meeting content hash to blockchain (Proof of Existence)
 */
meetings.post('/:projectId/meetings/:meetingId/anchor', async (c) => {
	try {
		const userId = c.get('userId');
		const projectId = c.req.param('projectId');
		const meetingId = c.req.param('meetingId');

		// Check admin access (only admin can spend gas to anchor?)
		// Or allow any member? Let's say admin for now to save gas.
		const membership = await checkMembership(c.env.DB, projectId, userId);
		if (!membership || membership.role !== 'admin') {
			return c.json({ error: 'Only admins can anchor evidence' }, 403);
		}

		const meeting = await c.env.DB.prepare(
			`SELECT content_hash, anchor_tx_hash FROM meetings WHERE id = ? AND project_id = ?`
		).bind(meetingId, projectId).first<{ content_hash: string; anchor_tx_hash: string }>();

		if (!meeting) {
			return c.json({ error: 'Meeting not found' }, 404);
		}

		if (!meeting.content_hash) {
			return c.json({ error: 'Meeting content hash missing' }, 400);
		}

		if (meeting.anchor_tx_hash) {
			return c.json({ error: 'Meeting already anchored', txHash: meeting.anchor_tx_hash }, 400);
		}

		// Execute On-Chain Anchoring
		if (!c.env.ETH_PRIVATE_KEY) {
			return c.json({ error: 'Server ETH wallet not configured' }, 500);
		}

		const result = await anchorHash(
			c.env.ETH_PRIVATE_KEY,
			c.env.ETH_RPC_URL,
			meeting.content_hash
		);

		if (!result.success || !result.txHash) {
			return c.json({ error: 'Blockchain transaction failed: ' + result.error }, 500);
		}

		// Update DB
		const now = new Date().toISOString();
		await c.env.DB.prepare(
			`UPDATE meetings SET anchor_tx_hash = ?, anchored_at = ? WHERE id = ?`
		).bind(result.txHash, now, meetingId).run();

		return c.json({ 
			message: 'Evidence anchored successfully', 
			txHash: result.txHash,
			anchoredAt: now
		});

	} catch (error) {
		console.error('Anchor meeting error:', error);
		return c.json({ error: 'Internal server error' }, 500);
	}
});

/**
 * POST /api/projects/:projectId/meetings/:meetingId/process
 * Process meeting and create contribution records
 */
meetings.post('/:projectId/meetings/:meetingId/process', async (c) => {
	try {
		const userId = c.get('userId');
		const projectId = c.req.param('projectId');
		const meetingId = c.req.param('meetingId');
		const body = await c.req.json<ProcessMeetingRequest>();

		// Check if user is admin
		const membership = await checkMembership(c.env.DB, projectId, userId);
		if (!membership || membership.role !== 'admin') {
			return c.json({ error: 'Only admins can process meetings' }, 403);
		}

		// Check meeting exists and is pending
		const meeting = await c.env.DB.prepare(
			`SELECT * FROM meetings WHERE id = ? AND project_id = ?`
		).bind(meetingId, projectId).first<Meeting>();

		if (!meeting) {
			return c.json({ error: 'Meeting not found' }, 404);
		}

		if (meeting.status === 'processed') {
			return c.json({ error: 'Meeting has already been processed' }, 400);
		}

		// Validate contributions
		if (!body.contributions || body.contributions.length === 0) {
			return c.json({ error: 'contributions array is required' }, 400);
		}

		// Validate total ratio (should be close to 100)
		const totalRatio = body.contributions.reduce((sum, c) => sum + c.ratio, 0);
		if (totalRatio < 99 || totalRatio > 101) {
			return c.json({
				error: `Total ratio should be approximately 100%, got ${totalRatio.toFixed(2)}%`
			}, 400);
		}

		const now = new Date().toISOString();
		const createdContributions = [];

		// Create contribution records
		for (const contrib of body.contributions) {
			// Verify user is a member
			const memberCheck = await checkMembership(c.env.DB, projectId, contrib.user_id);
			if (!memberCheck) {
				return c.json({
					error: `User ${contrib.user_id} is not a project member`
				}, 400);
			}

			const contributionId = generateId();

			await c.env.DB.prepare(
				`INSERT INTO contributions (id, project_id, user_id, ratio, source_type, source_id, description, created_by, created_at)
         VALUES (?, ?, ?, ?, 'meeting', ?, ?, ?, ?)`
			).bind(
				contributionId,
				projectId,
				contrib.user_id,
				contrib.ratio,
				meetingId,
				contrib.description || `From meeting: ${meeting.title || meetingId}`,
				userId,
				now
			).run();

			// Update user balance
			await c.env.DB.prepare(
				`UPDATE user_balances
         SET total_contributed = total_contributed + ?, last_updated = ?
         WHERE user_id = ? AND project_id = ?`
			).bind(contrib.ratio, now, contrib.user_id, projectId).run();

			createdContributions.push({
				id: contributionId,
				user_id: contrib.user_id,
				ratio: contrib.ratio,
			});
		}

		// Mark meeting as processed
		await c.env.DB.prepare(
			`UPDATE meetings SET status = 'processed' WHERE id = ?`
		).bind(meetingId).run();

		return c.json({
			message: 'Meeting processed successfully',
			contributions_created: createdContributions.length,
			contributions: createdContributions,
		});
	} catch (error) {
		console.error('Process meeting error:', error);
		return c.json({ error: 'Internal server error' }, 500);
	}
});

/**
 * DELETE /api/projects/:projectId/meetings/:meetingId
 * Delete a meeting (only if not processed)
 */
meetings.delete('/:projectId/meetings/:meetingId', async (c) => {
	try {
		const userId = c.get('userId');
		const projectId = c.req.param('projectId');
		const meetingId = c.req.param('meetingId');

		// Check membership
		const membership = await checkMembership(c.env.DB, projectId, userId);
		if (!membership) {
			return c.json({ error: 'Project not found or access denied' }, 403);
		}

		// Check meeting status and ownership
		const meeting = await c.env.DB.prepare(
			`SELECT status, created_by FROM meetings WHERE id = ? AND project_id = ?`
		).bind(meetingId, projectId).first<{ status: string; created_by: string }>();

		if (!meeting) {
			return c.json({ error: 'Meeting not found' }, 404);
		}

		// Only admin or creator can delete
		if (membership.role !== 'admin' && meeting.created_by !== userId) {
			return c.json({ error: 'Only admins or the creator can delete meetings' }, 403);
		}

		if (meeting.status === 'processed') {
			return c.json({ error: 'Cannot delete a processed meeting' }, 400);
		}

		await c.env.DB.prepare(
			`DELETE FROM meetings WHERE id = ?`
		).bind(meetingId).run();

		return c.json({ message: 'Meeting deleted successfully' });
	} catch (error) {
		console.error('Delete meeting error:', error);
		return c.json({ error: 'Internal server error' }, 500);
	}
});

export default meetings;
