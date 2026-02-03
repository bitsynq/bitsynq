import axios from 'axios'
import type { AxiosInstance } from 'axios'

// Types
export interface User {
  id: string
  email: string
  display_name: string
  wallet_address: string | null
  avatar_url: string | null
  created_at: string
  has_custodial_wallet?: boolean
  aliases?: string[]
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
  members?: ProjectMember[]
  current_user_role?: 'admin' | 'member' // Added this
}

export interface ProjectMember {
  id: string // User ID
  display_name: string
  email: string
  role: 'admin' | 'member'
  joined_at: string
  avatar_url?: string | null
  wallet_address?: string | null
  balance?: number // Added this
}

export interface Meeting {
  id: string
  project_id: string
  title: string | null
  meeting_date: string | null
  status: 'pending' | 'processed'
  created_at: string
  created_by?: string
  content_hash?: string
  anchor_tx_hash?: string
  anchored_at?: string
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

export interface ParsedMeetingData {
  participants: ParsedParticipant[]
  meeting_title?: string
  meeting_date?: string
  total_duration_seconds: number
  parse_confidence: number
}

export interface Contribution {
  id: string
  project_id: string
  user_id: string
  ratio: number
  source_type: 'meeting' | 'manual' | 'import'
  source_id: string | null
  description: string | null
  created_at: string
  user_display_name?: string
  user?: {
    display_name: string
    avatar_url: string | null
  }
}

export interface UserBalance {
  user_id: string
  balance: number
  total_contributed: number
  last_updated: string
  user?: {
    display_name: string
    avatar_url: string | null
  }
}

export interface TokenDistribution {
  id: string
  project_id: string
  milestone_name: string | null
  total_tokens: number
  distribution_data: string | null
  tx_hash: string | null
  status: 'pending' | 'confirmed'
  created_by: string
  created_at: string
  created_by_name?: string
  on_chain?: boolean
}

// Transaction Logs
export interface TransactionLog {
  id: string
  project_id: string
  tx_hash: string | null
  tx_type: 'mint' | 'transfer' | 'batch_transfer'
  from_address: string
  to_address: string
  amount: string
  token_symbol: string
  status: 'pending' | 'submitted' | 'confirmed' | 'failed'
  created_at: string
  updated_at: string
  confirmed_at: string | null
  error_message?: string
  milestone_name?: string
  from_display_name?: string
  to_display_name?: string
}

export interface TransactionResponse {
  transactions: TransactionLog[]
  pagination: {
    limit: number
    next_cursor?: string
    has_more: boolean
  }
}

export interface AuthResponse {
  token: string
  user: User
}

export interface DistributionPreview {
  allocations: Array<{
    user_id: string
    display_name: string
    current_ratio: number
    amount: number
  }>
  total_tokens: number
}

// API Service
class ApiService {
  private client: AxiosInstance
  private token: string | null = null

  constructor() {
    this.client = axios.create({
      baseURL: import.meta.env.VITE_API_URL || 'http://localhost:8787/api',
      headers: {
        'Content-Type': 'application/json',
      },
    })

    // Load token from storage
    const storedToken = localStorage.getItem('bitsynq_token')
    if (storedToken) {
      this.setToken(storedToken)
    }
  }

  setToken(token: string) {
    this.token = token
    this.client.defaults.headers.common['Authorization'] = `Bearer ${token}`
    localStorage.setItem('bitsynq_token', token)
  }

  clearToken() {
    this.token = null
    delete this.client.defaults.headers.common['Authorization']
    localStorage.removeItem('bitsynq_token')
  }

  // Auth
  auth = {
    register: (data: any) => this.client.post<AuthResponse>('/auth/register', data).then(r => r.data),
    login: (data: any) => this.client.post<AuthResponse>('/auth/login', data).then(r => r.data),
    getProfile: () => this.client.get<User>('/auth/me').then(r => r.data),
    googleUrl: () => this.client.get<{ url: string }>('/auth/google/url').then(r => r.data),
    googleCallback: (code: string) => this.client.post<AuthResponse>('/auth/google/callback', { code }).then(r => r.data),
  }

  // Users
  users = {
    updateProfile: (data: any) => this.client.put<User>('/users/me', data).then(r => r.data),
    generateWallet: () => this.client.post<{ wallet_address: string }>('/users/me/wallet').then(r => r.data),
    getPrivateKey: () => this.client.get<{ private_key: string }>('/users/me/wallet/private-key').then(r => r.data),
  }

  // Projects
  projects = {
    list: () => this.client.get<Project[]>('/projects').then(r => r.data),
    create: (data: any) => this.client.post<Project>('/projects', data).then(r => r.data),
    get: (id: string) => this.client.get<Project>(`/projects/${id}`).then(r => r.data),
    getMembers: (id: string) => this.client.get<ProjectMember[]>(`/projects/${id}/members`).then(r => r.data),
    addMember: (id: string, data: any) => this.client.post(`/projects/${id}/members`, data).then(r => r.data),
    getBalances: (id: string) => this.client.get<UserBalance[]>(`/projects/${id}/balances`).then(r => r.data),
  }

  // Meetings
  meetings = {
    list: (projectId: string) => this.client.get<Meeting[]>(`/projects/${projectId}/meetings`).then(r => r.data),
    create: (projectId: string, data: any) => 
      this.client.post<{ id: string; parsed_data: ParsedMeetingData }>(`/projects/${projectId}/meetings`, data).then(r => r.data),
    anchor: (projectId: string, meetingId: string) => this.client.post(`/projects/${projectId}/meetings/${meetingId}/anchor`).then(r => r.data),
    process: (projectId: string, meetingId: string, contributions: any[]) =>
      this.client.post(`/projects/${projectId}/meetings/${meetingId}/process`, { contributions }).then(r => r.data),
    delete: (projectId: string, meetingId: string) =>
      this.client.delete(`/projects/${projectId}/meetings/${meetingId}`).then(r => r.data),
  }

  // Contributions
  contributions = {
    list: (projectId: string) => this.client.get<{ contributions: Contribution[] }>(`/projects/${projectId}/contributions`).then(r => r.data),
    summary: (projectId: string) => this.client.get<{ summary: any[]; grand_total: number }>(`/projects/${projectId}/contributions/summary`).then(r => r.data),
  }

  // Tokens
  tokens = {
    preview: (projectId: string, totalTokens: number) =>
      this.client.post<DistributionPreview>(`/projects/${projectId}/distributions/preview`, { total_tokens: totalTokens }).then(r => r.data),
    distribute: (projectId: string, data: any) =>
      this.client.post(`/projects/${projectId}/distribute`, data).then(r => r.data),
    distributions: (projectId: string) =>
      this.client.get<TokenDistribution[]>(`/projects/${projectId}/distributions`).then(r => r.data),
  }

  // Transactions
  transactions = {
    list: (projectId: string, params?: any) =>
      this.client.get<TransactionResponse>(`/projects/${projectId}/transactions`, { params }).then(r => r.data), // Fix route to match worker
    get: (projectId: string, txId: string) =>
      this.client.get(`/projects/${projectId}/transactions/${txId}`).then(r => r.data),
    retry: (projectId: string, txId: string) =>
      this.client.post(`/projects/${projectId}/transactions/${txId}/retry`).then(r => r.data),
  }
}

export const api = new ApiService()
// Append anchor method to meetings
// I'll rewrite the meetings object using sed or just append it before 'process'
