/**
 * API Service
 * Handles all API communication with the backend
 */

// =============================================================================
// TYPES
// =============================================================================

export interface User {
	id: string
	email: string
	display_name: string
	aliases?: string[]
	wallet_address: string | null
	avatar_url: string | null
	created_at: string
	updated_at: string
}

export interface AuthResponse {
	token: string
	user: User
}

export interface Project {
	id: string
	name: string
	description: string | null
	owner_id: string
	token_symbol: string | null
	status: 'active' | 'archived'
	created_at: string
	updated_at: string
	member_role?: string
	members?: ProjectMember[]
	current_user_role?: string
}

export interface ProjectMember {
	id: string
	email: string
	display_name: string
	avatar_url: string | null
	role: 'admin' | 'member'
	joined_at: string
	balance: number
	total_contributed: number
}

export interface Contribution {
	id: string
	project_id: string
	user_id: string
	ratio: number
	source_type: 'meeting' | 'manual' | 'import'
	source_id: string | null
	description: string | null
	created_by: string
	created_at: string
	user_display_name?: string
	user_avatar_url?: string
}

export interface Meeting {
	id: string
	project_id: string
	title: string | null
	meeting_date: string | null
	status: 'pending' | 'processed'
	created_by: string
	created_at: string
	parsed_data?: ParsedMeetingData
}

export interface ParsedMeetingData {
	participants: ParsedParticipant[]
	meeting_title?: string
	meeting_date?: string
	total_duration_seconds: number
	parse_confidence: number
}

export interface ParsedParticipant {
	name: string
	matched_user_id?: string
	speak_count: number
	estimated_duration_seconds: number
	keywords_found: string[]
	score: number
	suggested_ratio: number
}

export interface TokenDistribution {
	id: string
	project_id: string
	milestone_name: string | null
	total_tokens: number
	distribution_data: Record<string, DistributionEntry>
	status: 'pending' | 'confirmed'
	created_by: string
	created_at: string
	created_by_name?: string
	tx_hash?: string | null
	on_chain?: boolean
}

export interface DistributionEntry {
	userId: string
	totalRatio: number
	percentage: number
	tokenAmount: number
}

export interface DistributionPreview {
	milestone_name?: string
	total_tokens: number
	distribution: Array<{
		user_id: string
		display_name: string
		avatar_url?: string
		total_ratio: number
		percentage: number
		token_amount: number
	}>
}

// =============================================================================
// API CLIENT
// =============================================================================

class ApiClient {
	private baseUrl: string = import.meta.env.VITE_API_BASE_URL || '/api'
	private token: string | null = null

	setToken(token: string | null): void {
		this.token = token
	}

	private async request<T>(
		method: string,
		path: string,
		body?: unknown
	): Promise<T> {
		const headers: Record<string, string> = {
			'Content-Type': 'application/json',
		}

		if (this.token) {
			headers['Authorization'] = `Bearer ${this.token}`
		}

		const response = await fetch(`${this.baseUrl}${path}`, {
			method,
			headers,
			body: body ? JSON.stringify(body) : undefined,
		})

		const data = await response.json()

		if (!response.ok) {
			throw new ApiError(data.error || 'Request failed', response.status)
		}

		return data
	}

	// Auth endpoints
	auth = {
		register: (data: {
			email: string
			password: string
			display_name: string
		}): Promise<AuthResponse> => this.request('POST', '/auth/register', data),

		login: (data: { email: string; password: string }): Promise<AuthResponse> =>
			this.request('POST', '/auth/login', data),

		logout: (): Promise<void> => this.request('POST', '/auth/logout'),

		// Google OAuth
		googleUrl: (): Promise<{ url: string }> =>
			this.request('GET', '/auth/google/url'),

		googleCallback: (code: string): Promise<AuthResponse> =>
			this.request('POST', '/auth/google/callback', { code }),
	}

	// User endpoints
	users = {
		me: (): Promise<User> => this.request('GET', '/users/me'),

		update: (data: {
			display_name?: string
			aliases?: string[]
			wallet_address?: string
			avatar_url?: string
		}): Promise<User> => this.request('PUT', '/users/me', data),

		search: (email: string): Promise<User[]> =>
			this.request('GET', `/users/search?email=${encodeURIComponent(email)}`),
	}

	// Project endpoints
	projects = {
		list: (): Promise<Project[]> => this.request('GET', '/projects'),

		create: (data: {
			name: string
			description?: string
			token_symbol?: string
		}): Promise<Project> => this.request('POST', '/projects', data),

		get: (id: string): Promise<Project> =>
			this.request('GET', `/projects/${id}`),

		update: (
			id: string,
			data: {
				name?: string
				description?: string
				token_symbol?: string
				status?: 'active' | 'archived'
			}
		): Promise<Project> => this.request('PUT', `/projects/${id}`, data),

		delete: (id: string): Promise<void> =>
			this.request('DELETE', `/projects/${id}`),

		addMember: (
			projectId: string,
			data: { email?: string; user_id?: string; role?: string }
		): Promise<void> =>
			this.request('POST', `/projects/${projectId}/members`, data),

		removeMember: (projectId: string, userId: string): Promise<void> =>
			this.request('DELETE', `/projects/${projectId}/members/${userId}`),
	}

	// Contribution endpoints
	contributions = {
		list: (
			projectId: string,
			page = 1,
			limit = 50
		): Promise<{
			contributions: Contribution[]
			pagination: { page: number; limit: number; total: number; total_pages: number }
		}> =>
			this.request(
				'GET',
				`/projects/${projectId}/contributions?page=${page}&limit=${limit}`
			),

		create: (
			projectId: string,
			data: { user_id: string; ratio: number; description?: string }
		): Promise<Contribution> =>
			this.request('POST', `/projects/${projectId}/contributions`, data),

		summary: (
			projectId: string
		): Promise<{
			summary: Array<{
				user_id: string
				display_name: string
				avatar_url?: string
				total_ratio: number
				contribution_count: number
				percentage: string
			}>
			grand_total: number
		}> => this.request('GET', `/projects/${projectId}/contributions/summary`),

		delete: (projectId: string, contributionId: string): Promise<void> =>
			this.request(
				'DELETE',
				`/projects/${projectId}/contributions/${contributionId}`
			),
	}

	// Meeting endpoints
	meetings = {
		list: (projectId: string): Promise<Meeting[]> =>
			this.request('GET', `/projects/${projectId}/meetings`),

		create: (
			projectId: string,
			data: { title?: string; meeting_date?: string; raw_transcript: string }
		): Promise<Meeting> =>
			this.request('POST', `/projects/${projectId}/meetings`, data),

		get: (projectId: string, meetingId: string): Promise<Meeting> =>
			this.request('GET', `/projects/${projectId}/meetings/${meetingId}`),

		process: (
			projectId: string,
			meetingId: string,
			contributions: Array<{
				user_id: string
				ratio: number
				description?: string
			}>
		): Promise<{ message: string; contributions_created: number }> =>
			this.request(
				'POST',
				`/projects/${projectId}/meetings/${meetingId}/process`,
				{ contributions }
			),

		delete: (projectId: string, meetingId: string): Promise<void> =>
			this.request('DELETE', `/projects/${projectId}/meetings/${meetingId}`),
	}

	// Token endpoints
	tokens = {
		balances: (
			projectId: string
		): Promise<{
			balances: Array<ProjectMember & { balance: number; total_contributed: number }>
			total_tokens_distributed: number
		}> => this.request('GET', `/projects/${projectId}/balances`),

		myBalance: (
			projectId: string
		): Promise<{
			user_id: string
			project_id: string
			balance: number
			total_contributed: number
		}> => this.request('GET', `/projects/${projectId}/my-balance`),

		distributions: (projectId: string): Promise<TokenDistribution[]> =>
			this.request('GET', `/projects/${projectId}/distributions`),

		preview: (
			projectId: string,
			data: { milestone_name?: string; total_tokens: number }
		): Promise<DistributionPreview> =>
			this.request('POST', `/projects/${projectId}/distributions/preview`, data),

		distribute: (
			projectId: string,
			data: { milestone_name?: string; total_tokens: number; on_chain?: boolean }
		): Promise<{ id: string; message: string; total_tokens: number; tx_hash?: string }> =>
			this.request('POST', `/projects/${projectId}/distribute`, data),
	}
}

// Custom error class for API errors
export class ApiError extends Error {
	constructor(
		message: string,
		public status: number
	) {
		super(message)
		this.name = 'ApiError'
	}
}

// Export singleton instance
export const api = new ApiClient()
