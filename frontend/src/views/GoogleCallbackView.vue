<template>
  <v-container class="fill-height" fluid>
    <v-row align="center" justify="center">
      <v-col cols="12" sm="8" md="5" lg="4">
        <v-card class="pa-8 text-center">
          <v-progress-circular
            v-if="loading"
            indeterminate
            color="primary"
            size="64"
            class="mb-4"
          />

          <template v-if="loading">
            <h2 class="text-h5 mb-2">正在登入...</h2>
            <p class="text-body-2 text-medium-emphasis">
              請稍候，正在處理 Google 登入
            </p>
          </template>

          <template v-else-if="error">
            <v-icon icon="mdi-alert-circle" size="64" color="error" class="mb-4" />
            <h2 class="text-h5 mb-2">登入失敗</h2>
            <p class="text-body-2 text-medium-emphasis mb-4">{{ error }}</p>
            <v-btn color="primary" to="/login">返回登入頁</v-btn>
          </template>
        </v-card>
      </v-col>
    </v-row>
  </v-container>
</template>

<script setup lang="ts">
import { ref, onMounted, inject } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { api, type AuthResponse } from '@/services/api'
import { useAuthStore } from '@/stores/auth'

const router = useRouter()
const route = useRoute()
const authStore = useAuthStore()
const showSnackbar = inject<(msg: string, color?: string) => void>('showSnackbar')!

const loading = ref(true)
const error = ref('')

onMounted(async () => {
  // Get authorization code from URL
  const code = route.query.code as string

  if (!code) {
    error.value = '未收到授權碼'
    loading.value = false
    return
  }

  try {
    // Exchange code for token via store action (updates state consistently)
    await authStore.loginWithGoogle(code)

    showSnackbar('Google 登入成功！', 'success')

    // Redirect to dashboard
    router.push('/dashboard')
  } catch (e: any) {
    error.value = e.message || 'Google 登入失敗'
    loading.value = false
  }
})
</script>
