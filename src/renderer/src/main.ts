import './styles/global.scss'
import './assets/main.css'

import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import QuickAddApp from './QuickAddApp.vue'
import { createAppRuntime, installAppRuntime } from './app/runtime'
import { useAppSessionStore } from './store/appSession'

const rendererMode = new URLSearchParams(window.location.search).get('mode')
const RootComponent = rendererMode === 'quick-add' ? QuickAddApp : App

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

const vueApp = createApp(RootComponent)
const runtime = createAppRuntime(window.api)
const pinia = createPinia()

vueApp.config.errorHandler = (error, _instance, info) => {
  console.error('[renderer] vue error', {
    info,
    error: error instanceof Error ? (error.stack ?? error.message) : error
  })
}

installAppRuntime(vueApp, runtime)
vueApp.use(pinia)

if (rendererMode !== 'quick-add') {
  // Recover sync session state before the first render so view selection and drafts
  // are consistent from the moment route-level components mount.
  useAppSessionStore(pinia).hydrate()
}

vueApp.mount('#app')
