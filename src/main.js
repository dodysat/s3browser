import './assets/main.css'

import { createApp } from 'vue'
import { createPinia } from 'pinia'
import piniaPluginPersistedstate from "pinia-plugin-persistedstate"

import App from './App.vue'
import router from './router'

import { useAuthStore } from "@/stores/auth"
import { useFileTreeStore } from "@/stores/file_tree"

const app = createApp(App)
const pinia = createPinia()
pinia.use(piniaPluginPersistedstate)
app.use(pinia)
useAuthStore()
useFileTreeStore()

app.use(router)

app.mount('#app')
