<template>
  <v-container class="py-8">
    <div class="d-flex align-center gap-2 mb-6">
      <v-btn icon size="small" variant="text" @click="$router.back()">
        <v-icon>mdi-arrow-left</v-icon>
      </v-btn>
      <h1 class="text-h4 font-weight-bold">個人檔案</h1>
    </div>

    <v-row justify="center">
      <v-col cols="12" md="8">
        <v-card :loading="loading" class="pa-6">
          <div class="d-flex justify-center mb-6">
            <v-avatar size="100" color="primary" class="text-h3">
              <v-img v-if="user.avatar_url" :src="user.avatar_url" />
              <span v-else>{{ user.display_name?.charAt(0).toUpperCase() }}</span>
            </v-avatar>
          </div>

          <v-form ref="form" @submit.prevent="saveProfile">
            <v-text-field
              v-model="user.email"
              label="Email"
              readonly
              variant="filled"
              prepend-icon="mdi-email"
              class="mb-4"
            />

            <v-text-field
              v-model="user.display_name"
              label="顯示名稱"
              :rules="[v => !!v || '名稱為必填']"
              prepend-icon="mdi-account"
              class="mb-4"
            />

            <v-combobox
              v-model="user.aliases"
              label="名稱別名 (Aliases)"
              chips
              multiple
              closable-chips
              hint="輸入您的其他常用名稱（如英文名、中文名），按 Enter 新增。系統解析會議記錄時會自動識別這些名稱。"
              persistent-hint
              prepend-icon="mdi-tag-multiple"
              class="mb-6"
            />

            <v-text-field
              v-model="user.wallet_address"
              label="錢包地址 (ERC-20)"
              prepend-icon="mdi-wallet"
              placeholder="0x..."
              class="mb-6"
            />

            <div class="d-flex justify-end gap-2">
              <v-btn
                color="primary"
                size="large"
                type="submit"
                :loading="saving"
              >
                儲存變更
              </v-btn>
            </div>
          </v-form>
        </v-card>
      </v-col>
    </v-row>
  </v-container>
</template>

<script setup lang="ts">
import { ref, onMounted, inject } from 'vue'
import { api, type User } from '@/services/api'

const showSnackbar = inject<(msg: string, color?: string) => void>('showSnackbar')!

const loading = ref(true)
const saving = ref(false)
const user = ref<Partial<User>>({
  email: '',
  display_name: '',
  aliases: [],
  wallet_address: '',
  avatar_url: '',
})

async function loadProfile() {
  loading.value = true
  try {
    const data = await api.users.me()
    user.value = {
      ...data,
      aliases: data.aliases || [],
    }
  } catch (e: any) {
    showSnackbar(e.message || '載入失敗', 'error')
  } finally {
    loading.value = false
  }
}

async function saveProfile() {
  saving.value = true
  try {
    await api.users.update({
      display_name: user.value.display_name,
      aliases: user.value.aliases,
      wallet_address: user.value.wallet_address || undefined,
      avatar_url: user.value.avatar_url || undefined,
    })
    showSnackbar('個人檔案已更新', 'success')
  } catch (e: any) {
    showSnackbar(e.message || '儲存失敗', 'error')
  } finally {
    saving.value = false
  }
}

onMounted(() => {
  loadProfile()
})
</script>
