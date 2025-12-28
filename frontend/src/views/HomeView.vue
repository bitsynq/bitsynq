<template>
  <v-container class="fill-height" fluid>
    <v-row align="center" justify="center">
      <v-col cols="12" sm="10" md="8" lg="6">
        <!-- Hero Section -->
        <div class="text-center mb-12">
          <h1 class="text-h2 font-weight-bold mb-4">
            <span class="text-gradient">Bitsynq</span>
          </h1>
          <p class="text-h6 text-medium-emphasis mb-8">
            將會議貢獻轉化為可追蹤的價值
          </p>

          <div class="d-flex justify-center gap-4">
            <template v-if="authStore.isAuthenticated">
              <v-btn
                color="primary"
                size="large"
                to="/dashboard"
                prepend-icon="mdi-view-dashboard"
              >
                前往儀表板
              </v-btn>
            </template>
            <template v-else>
              <v-btn
                color="primary"
                size="large"
                to="/register"
                prepend-icon="mdi-account-plus"
              >
                開始使用
              </v-btn>
              <v-btn
                variant="outlined"
                color="primary"
                size="large"
                to="/login"
                prepend-icon="mdi-login"
              >
                登入
              </v-btn>
            </template>
          </div>
        </div>

        <!-- Features Section -->
        <v-row class="mt-12">
          <v-col v-for="feature in features" :key="feature.title" cols="12" md="4">
            <v-card class="pa-6 text-center h-100" variant="tonal">
              <v-icon :icon="feature.icon" size="48" color="primary" class="mb-4" />
              <h3 class="text-h6 mb-2">{{ feature.title }}</h3>
              <p class="text-body-2 text-medium-emphasis">{{ feature.description }}</p>
            </v-card>
          </v-col>
        </v-row>
      </v-col>
    </v-row>
  </v-container>
</template>

<script setup lang="ts">
import { useAuthStore } from '@/stores/auth'

const authStore = useAuthStore()

const features = [
  {
    icon: 'mdi-upload',
    title: '上傳會議紀錄',
    description: '貼上 Zoom 會議摘要，自動解析參與者貢獻',
  },
  {
    icon: 'mdi-chart-pie',
    title: '追蹤貢獻',
    description: '以比例記錄每個人的貢獻度，清晰透明',
  },
  {
    icon: 'mdi-coin',
    title: 'Token 發放',
    description: '根據貢獻比例自動計算並發放 Token 獎勵',
  },
]
</script>

<style scoped>
.text-gradient {
  background: linear-gradient(135deg, #7C4DFF, #00BFA5);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}
</style>
