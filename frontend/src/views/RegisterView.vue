<template>
  <v-container class="fill-height" fluid>
    <v-row align="center" justify="center">
      <v-col cols="12" sm="8" md="5" lg="4">
        <v-card class="pa-8">
          <div class="text-center mb-6">
            <h1 class="text-h4 font-weight-bold text-gradient mb-2">註冊</h1>
            <p class="text-body-2 text-medium-emphasis">
              建立帳號開始追蹤貢獻
            </p>
          </div>

          <v-form ref="formRef" @submit.prevent="handleRegister">
            <v-text-field
              v-model="displayName"
              label="顯示名稱"
              prepend-inner-icon="mdi-account"
              :rules="[rules.required, rules.minLength(2)]"
              :disabled="loading"
              class="mb-2"
            />

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
              :rules="[rules.required, rules.minLength(8)]"
              :disabled="loading"
              hint="至少 8 個字元"
              class="mb-2"
            />

            <v-text-field
              v-model="confirmPassword"
              label="確認密碼"
              :type="showPassword ? 'text' : 'password'"
              prepend-inner-icon="mdi-lock-check"
              :rules="[rules.required, rules.match]"
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
              註冊
            </v-btn>
          </v-form>

          <div class="text-center mt-6">
            <span class="text-medium-emphasis">已經有帳號？</span>
            <router-link to="/login" class="text-primary text-decoration-none ml-1">
              立即登入
            </router-link>
          </div>
        </v-card>
      </v-col>
    </v-row>
  </v-container>
</template>

<script setup lang="ts">
import { ref, inject } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

const router = useRouter()
const authStore = useAuthStore()
const showSnackbar = inject<(msg: string, color?: string) => void>('showSnackbar')!

const formRef = ref()
const displayName = ref('')
const email = ref('')
const password = ref('')
const confirmPassword = ref('')
const showPassword = ref(false)
const loading = ref(false)
const error = ref('')

const rules = {
  required: (v: string) => !!v || '此欄位為必填',
  email: (v: string) => /.+@.+\..+/.test(v) || 'Email 格式不正確',
  minLength: (min: number) => (v: string) =>
    v.length >= min || `至少需要 ${min} 個字元`,
  match: (v: string) => v === password.value || '密碼不一致',
}

async function handleRegister() {
  const { valid } = await formRef.value.validate()
  if (!valid) return

  loading.value = true
  error.value = ''

  try {
    await authStore.register(email.value, password.value, displayName.value)
    showSnackbar('註冊成功！', 'success')
    router.push('/dashboard')
  } catch (e: any) {
    error.value = e.message || '註冊失敗，請稍後再試'
  } finally {
    loading.value = false
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
