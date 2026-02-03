/**
 * Type definitions for Bitsynq API
 */

// =============================================================================
// DATABASE ENTITY TYPES
// =============================================================================

export interface User {
	id: string;
	email: string;
	password_hash: string;
	display_name: string;
	aliases?: string[];
	wallet_address: string | null;
	has_custodial_wallet?: boolean;
	encrypted_private_key?: string | null;
	avatar_url: string | null;
	created_at: string;
	updated_at: string;
}

export interface Project {
	id: string;
	name: string;
	description: string | null;
	owner_id: string;
	token_symbol: string | null;
	status: 'active' | 'archived';
	created_at: string;
	updated_at: string;
}

export interface ProjectMember {
	project_id: string;
	user_id: string;
	role: 'admin' | 'member';
	joined_at: string;
}

export interface Meeting {
	id: string;
	project_id: string;
	title: string | null;
	meeting_date: string | null;
	raw_transcript: string | null;
	parsed_data: string | null;
	content_hash?: string | null;
	anchor_tx_hash?: string | null;
	anchored_at?: string | null;
	status: 'pending' | 'processed';
	created_by: string;
	created_at: string;
}

export interface Contribution {
	id: string;
	project_id: string;
	user_id: string;
	ratio: number;
	source_type: 'meeting' | 'manual' | 'import';
	source_id: string | null;
	description: string | null;
	created_by: string;
	created_at: string;
}

export interface TokenDistribution {
	id: string;
	project_id: string;
	milestone_name: string | null;
	total_tokens: number;
	distribution_data: string | null;
	tx_hash: string | null;
	status: 'pending' | 'confirmed';
	created_by: string;
	created_at: string;
}

export interface UserBalance {
	user_id: string;
	project_id: string;
	balance: number;
	total_contributed: number;
	last_updated: string;
}

// =============================================================================
// API REQUEST/RESPONSE TYPES
// =============================================================================

export interface RegisterRequest {
	email: string;
	password: string;
	display_name: string;
}

export interface LoginRequest {
	email: string;
	password: string;
}

export interface AuthResponse {
	token: string;
	user: Omit<User, 'password_hash'>;
}

export interface CreateProjectRequest {
	name: string;
	description?: string;
	token_symbol?: string;
}

export interface UpdateProjectRequest {
	name?: string;
	description?: string;
	token_symbol?: string;
	status?: 'active' | 'archived';
}

export interface AddMemberRequest {
	user_id?: string;
	email?: string;
	role?: 'admin' | 'member';
}

export interface CreateContributionRequest {
	user_id: string;
	ratio: number;
	description?: string;
}

export interface CreateMeetingRequest {
	title?: string;
	meeting_date?: string;
	raw_transcript: string;
}

export interface ProcessMeetingRequest {
	contributions: Array<{
		user_id: string;
		ratio: number;
		description?: string;
	}>;
}

export interface DistributeTokensRequest {
	milestone_name?: string;
	total_tokens: number;
	on_chain?: boolean;
}

export interface ParsedParticipant {
	name: string;
	matched_user_id?: string;
	speak_count: number;
	estimated_duration_seconds: number;
	keywords_found: string[];
	score: number;
	suggested_ratio: number;
}

export interface ParsedMeetingData {
	participants: ParsedParticipant[];
	meeting_title?: string;
	meeting_date?: string;
	total_duration_seconds: number;
	parse_confidence: number;
}

export interface Env {
	DB: D1Database;
	SESSION_KV: KVNamespace;
	EVIDENCE_KV: KVNamespace;
	JWT_SECRET: string;
	CORS_ORIGIN: string;
	GOOGLE_CLIENT_ID: string;
	GOOGLE_CLIENT_SECRET: string;
	GOOGLE_REDIRECT_URI: string;
	ETH_RPC_URL: string;
	ETH_PRIVATE_KEY: string;
	ETH_TOKEN_CONTRACT: string;
	ETH_BATCH_DISTRIBUTOR: string;
	ENCRYPTION_SECRET: string;
}

export interface JWTPayload {
	sub: string;
	email: string;
	exp: number;
	iat: number;
}
// Append logic manually or just sed replace. 
// I'll use sed to insert the fields into Meeting interface
