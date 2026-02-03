/**
 * Vue Router Configuration
 */

import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

const router = createRouter({
	history: createWebHistory(),
	routes: [
		{
			path: '/',
			name: 'home',
			component: () => import('@/views/HomeView.vue'),
		},
		{
			path: '/login',
			name: 'login',
			component: () => import('@/views/LoginView.vue'),
			meta: { guest: true },
		},
		{
			path: '/register',
			name: 'register',
			component: () => import('@/views/RegisterView.vue'),
			meta: { guest: true },
		},
		{
			path: '/dashboard',
			name: 'dashboard',
			component: () => import('@/views/DashboardView.vue'),
			meta: { requiresAuth: true },
		},
		{
			path: '/projects/:id',
			name: 'project',
			component: () => import('@/views/ProjectView.vue'),
			meta: { requiresAuth: true },
		},
		{
			path: '/projects/:id/meetings/new',
			name: 'new-meeting',
			component: () => import('@/views/NewMeetingView.vue'),
			meta: { requiresAuth: true },
		},
		{
			path: '/projects/:id/meetings/:meetingId/edit',
			name: 'edit-meeting',
			component: () => import('@/views/EditMeetingView.vue'),
			meta: { requiresAuth: true },
		},
		{
			path: '/projects/:id/distribute',
			name: 'distribute',
			component: () => import('@/views/DistributeView.vue'),
			meta: { requiresAuth: true },
		},
		{
			path: '/auth/google/callback',
			name: 'google-callback',
			component: () => import('@/views/GoogleCallbackView.vue'),
			meta: { guest: true },
		},
		{
			path: '/profile',
			name: 'profile',
			component: () => import('@/views/ProfileView.vue'),
			meta: { requiresAuth: true },
		},
	],
})

// Navigation guard for authentication
router.beforeEach(async (to, from, next) => {
	const authStore = useAuthStore()

	// Check if route requires authentication
	if (to.meta.requiresAuth && !authStore.isAuthenticated) {
		return next({ name: 'login', query: { redirect: to.fullPath } })
	}

	// Redirect authenticated users away from guest-only pages
	if (to.meta.guest && authStore.isAuthenticated) {
		return next({ name: 'dashboard' })
	}

	next()
})

export default router
