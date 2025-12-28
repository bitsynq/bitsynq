<template>
  <v-container class="fill-height" fluid>
    <v-row align="center" justify="center">
      <v-col cols="12" sm="8" md="5" lg="4">
        <v-card class="pa-8">
          <div class="text-center mb-6">
            <h1 class="text-h4 font-weight-bold text-gradient mb-2">登入</h1>
            <p class="text-body-2 text-medium-emphasis">
              歡迎回來！請選擇登入方式
            </p>
          </div>

          <!-- Google Login Button -->
          <v-btn
            color="white"
            size="large"
            block
            class="mb-4"
            :loading="googleLoading"
            @click="handleGoogleLogin"
          >
            <v-icon class="mr-2" color="red">mdi-google</v-icon>
            使用 Google 登入
          </v-btn>

          <v-divider class="my-6">
            <span class="text-body-2 text-medium-emphasis px-4">或使用 Email</span>
          </v-divider>

          <v-form ref="formRef" @submit.prevent="handleLogin">
            <v-text-field
              v-model="email"
              label="Email"
              type="email"
              prepend-inner-icon="mdi-email"
              :rules="[rules.required, rules.email]"
              :disabled="loading"
              class="mb-2"
            />

            <v-text-field
              v-model="password"
              label="密碼"
              :type="showPassword ? 'text' : 'password'"
              prepend-inner-icon="mdi-lock"
              :append-inner-icon="showPassword ? 'mdi-eye' : 'mdi-eye-off'"
              @click:append-inner="showPassword = !showPassword"
              :rules="[rules.required]"
              :disabled="loading"
              class="mb-4"
            />

            <v-alert
              v-if="error"
              type="error"
              variant="tonal"
              class="mb-4"
              closable
              @click:close="error = ''"
            >
              {{ error }}
            </v-alert>

            <v-btn
              type="submit"
              color="primary"
              size="large"
              block
              :loading="loading"
            >
              登入
            </v-btn>
          </v-form>

          <div class="text-center mt-6">
            <span class="text-medium-emphasis">還沒有帳號？</span>
            <router-link to="/register" class="text-primary text-decoration-none ml-1">
              立即註冊
            </router-link>
          </div>
        </v-card>
      </v-col>
    </v-row>
  </v-container>
</template>

<script setup lang="ts">
import { ref, inject } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { api } from '@/services/api'

const router = useRouter()
const route = useRoute()
const authStore = useAuthStore()
const showSnackbar = inject<(msg: string, color?: string) => void>('showSnackbar')!

const formRef = ref()
const email = ref('')
const password = ref('')
const showPassword = ref(false)
const loading = ref(false)
const googleLoading = ref(false)
const error = ref('')

const rules = {
  required: (v: string) => !!v || '此欄位為必填',
  email: (v: string) => /.+@.+\..+/.test(v) || 'Email 格式不正確',
}

async function handleLogin() {
  const { valid } = await formRef.value.validate()
  if (!valid) return

  loading.value = true
  error.value = ''

  try {
    await authStore.login(email.value, password.value)
    showSnackbar('登入成功！', 'success')

    // Redirect to intended page or dashboard
    const redirect = route.query.redirect as string
    router.push(redirect || '/dashboard')
  } catch (e: any) {
    error.value = e.message || '登入失敗，請檢查帳號密碼'
  } finally {
    loading.value = false
  }
}

async function handleGoogleLogin() {
  googleLoading.value = true
  error.value = ''

  try {
    const { url } = await api.auth.googleUrl()
    // Redirect to Google OAuth consent screen
    window.location.href = url
  } catch (e: any) {
    error.value = e.message || 'Google 登入失敗'
    googleLoading.value = false
  }
}
</script>

<style scoped>
.text-gradient {
  background: linear-gradient(135deg, #7C4DFF, #00BFA5);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}
</style>
