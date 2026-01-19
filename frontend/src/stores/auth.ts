/**
 * Authentication Store
 * Manages user authentication state
 */

import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { api } from '@/services/api'
import type { User, AuthResponse } from '@/services/api'

export const useAuthStore = defineStore('auth', () => {
	// State
	const user = ref<User | null>(null)
	const token = ref<string | null>(localStorage.getItem('token'))

	// Getters
	const isAuthenticated = computed(() => !!token.value)
	const currentUser = computed(() => user.value)

	// Actions
	async function login(email: string, password: string): Promise<void> {
		const response = await api.auth.login({ email, password })
		setAuth(response)
	}

	async function register(
		email: string,
		password: string,
		displayName: string
	): Promise<void> {
		const response = await api.auth.register({
			email,
			password,
			display_name: displayName,
		})
		setAuth(response)
	}

	async function loginWithGoogle(code: string): Promise<void> {
		const response = await api.auth.googleCallback(code)
		setAuth(response)
	}

	function setAuth(response: AuthResponse): void {
		token.value = response.token
		user.value = response.user
		localStorage.setItem('token', response.token)
		api.setToken(response.token)
	}

	async function logout(): Promise<void> {
		// JWT is stateless, just clear local state
		token.value = null
		user.value = null
		localStorage.removeItem('token')
		api.clearToken()
	}

	async function fetchCurrentUser(): Promise<void> {
		if (!token.value) return
		try {
			api.setToken(token.value)
			user.value = await api.auth.getProfile()
		} catch (error) {
			// Token might be invalid, logout
			logout()
		}
	}

	// Initialize: restore token from localStorage
	if (token.value) {
		api.setToken(token.value)
		fetchCurrentUser()
	}

	return {
		user,
		token,
		isAuthenticated,
		currentUser,
		login,
		register,
		loginWithGoogle,
		logout,
		fetchCurrentUser,
	}
})
