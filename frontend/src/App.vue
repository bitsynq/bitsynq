<template>
  <v-app>
    <!-- Navigation Bar -->
    <v-app-bar v-if="authStore.isAuthenticated" flat color="surface">
      <v-app-bar-nav-icon @click="drawer = !drawer" class="d-md-none" />

      <v-toolbar-title>
        <router-link to="/dashboard" class="text-decoration-none">
          <span class="text-gradient font-weight-bold">Bitsynq</span>
        </router-link>
      </v-toolbar-title>

      <v-spacer />

      <v-btn
        v-if="authStore.currentUser"
        variant="text"
        class="text-none mr-2"
        prepend-icon="mdi-account-circle"
      >
        {{ authStore.currentUser.display_name }}
      </v-btn>

      <v-btn icon @click="toggleTheme">
        <v-icon>{{ isDark ? 'mdi-weather-sunny' : 'mdi-weather-night' }}</v-icon>
      </v-btn>

      <v-btn icon @click="handleLogout">
        <v-icon>mdi-logout</v-icon>
      </v-btn>
    </v-app-bar>

    <!-- Navigation Drawer (Mobile) -->
    <v-navigation-drawer
      v-if="authStore.isAuthenticated"
      v-model="drawer"
      temporary
      class="d-md-none"
    >
      <v-list>
        <v-list-item
          prepend-icon="mdi-view-dashboard"
          title="Dashboard"
          to="/dashboard"
        />
      </v-list>
    </v-navigation-drawer>

    <!-- Main Content -->
    <v-main>
      <router-view v-slot="{ Component }">
        <transition name="fade" mode="out-in">
          <component :is="Component" />
        </transition>
      </router-view>
    </v-main>

    <!-- Global Snackbar for notifications -->
    <v-snackbar
      v-model="snackbar.show"
      :color="snackbar.color"
      :timeout="3000"
      location="bottom right"
    >
      {{ snackbar.message }}
    </v-snackbar>
  </v-app>
</template>

<script setup lang="ts">
import { ref, provide, reactive } from 'vue'
import { useRouter } from 'vue-router'
import { useTheme } from 'vuetify'
import { useAuthStore } from '@/stores/auth'

const router = useRouter()
const theme = useTheme()
const authStore = useAuthStore()

const drawer = ref(false)
const isDark = ref(theme.global.current.value.dark)

// Global snackbar state
const snackbar = reactive({
  show: false,
  message: '',
  color: 'primary',
})

function showSnackbar(message: string, color = 'primary') {
  snackbar.message = message
  snackbar.color = color
  snackbar.show = true
}

// Provide snackbar function to child components
provide('showSnackbar', showSnackbar)

function toggleTheme() {
  theme.global.name.value = isDark.value ? 'light' : 'dark'
  isDark.value = !isDark.value
}

async function handleLogout() {
  await authStore.logout()
  router.push('/login')
  showSnackbar('已登出', 'info')
}
</script>

<style scoped>
.text-gradient {
  background: linear-gradient(135deg, #7C4DFF, #00BFA5);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  font-size: 1.3rem;
}
</style>
