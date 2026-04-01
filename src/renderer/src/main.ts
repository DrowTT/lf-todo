import './styles/global.scss'
import './assets/main.css'

import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import { createAppRuntime, installAppRuntime } from './app/runtime'

window.addEventListener('error', (event) => {
  console.error('[renderer] window error', {
    message: event.message,
    filename: event.filename,
    lineno: event.lineno,
    colno: event.colno,
    error: event.error instanceof Error ? (event.error.stack ?? event.error.message) : event.error
  })
})

window.addEventListener('unhandledrejection', (event) => {
  console.error('[renderer] unhandled rejection', event.reason)
})

const vueApp = createApp(App)
const runtime = createAppRuntime(window.api)

vueApp.config.errorHandler = (error, _instance, info) => {
  console.error('[renderer] vue error', {
    info,
    error: error instanceof Error ? (error.stack ?? error.message) : error
  })
}

installAppRuntime(vueApp, runtime)
vueApp.use(createPinia()).mount('#app')
