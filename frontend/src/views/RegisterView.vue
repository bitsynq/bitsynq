<template>
  <v-container class="fill-height" fluid>
    <v-row align="center" justify="center">
      <v-col cols="12" sm="8" md="5" lg="4">
        <v-card class="pa-8">
          <div class="text-center mb-6">
            <h1 class="text-h4 font-weight-bold text-gradient mb-2">{{ $t('auth.registerTitle') }}</h1>
            <p class="text-body-2 text-medium-emphasis">
              {{ $t('auth.registerSubtitle') }}
            </p>
          </div>

          <v-form ref="formRef" @submit.prevent="handleRegister">
            <v-text-field
              v-model="displayName"
              :label="$t('auth.displayName')"
              prepend-inner-icon="mdi-account"
              :rules="[rules.required, rules.minLength(2)]"
              :disabled="loading"
              class="mb-2"
            />

            <v-text-field
              v-model="email"
              :label="$t('common.email')"
              type="email"
              prepend-inner-icon="mdi-email"
              :rules="[rules.required, rules.email]"
              :disabled="loading"
              class="mb-2"
            />

            <v-text-field
              v-model="password"
              :label="$t('common.password')"
              :type="showPassword ? 'text' : 'password'"
              prepend-inner-icon="mdi-lock"
              :append-inner-icon="showPassword ? 'mdi-eye' : 'mdi-eye-off'"
              @click:append-inner="showPassword = !showPassword"
              :rules="[rules.required, rules.minLength(8)]"
              :disabled="loading"
              :hint="$t('auth.passwordHint')"
              class="mb-2"
            />

            <v-text-field
              v-model="confirmPassword"
              :label="$t('auth.confirmPassword')"
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
              {{ $t('common.register') }}
            </v-btn>
          </v-form>

          <div class="text-center mt-6">
            <span class="text-medium-emphasis">{{ $t('auth.alreadyHaveAccount') }}</span>
            <router-link to="/login" class="text-primary text-decoration-none ml-1">
              {{ $t('auth.loginLink') }}
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
import { useI18n } from 'vue-i18n'

const { t } = useI18n()
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
  required: (v: string) => !!v || t('auth.rules.required'),
  email: (v: string) => /.+@.+\..+/.test(v) || t('auth.rules.email'),
  minLength: (min: number) => (v: string) =>
    v.length >= min || t('auth.rules.minLength', { min }),
  match: (v: string) => v === password.value || t('auth.rules.match'),
}

async function handleRegister() {
  const { valid } = await formRef.value.validate()
  if (!valid) return

  loading.value = true
  error.value = ''

  try {
    await authStore.register(email.value, password.value, displayName.value)
    showSnackbar(t('auth.successRegister'), 'success')
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
