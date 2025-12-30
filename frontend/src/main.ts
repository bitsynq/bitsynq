/**
 * Bitsynq Frontend - Main Entry Point
 */

import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import router from './router'
import vuetify from './plugins/vuetify'

// Import global styles
import '@mdi/font/css/materialdesignicons.css'
import './assets/main.css'

import { i18n } from './i18n'

const app = createApp(App)

app.use(createPinia())
app.use(router)
app.use(vuetify)
app.use(i18n)

app.mount('#app')
