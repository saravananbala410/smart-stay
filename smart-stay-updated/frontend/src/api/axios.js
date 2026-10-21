import axios from 'axios'

const SERVER_KEY = 'server_url'
const AUTH_KEYS = ['token', 'hostel_id', 'hostel_name']

// Inside the Android app the page is served from the device itself, so the
// backend address cannot be guessed from window.location.
export const isNativeApp = Boolean(window.Capacitor?.isNativePlatform?.())

const clean = url => (url || '').trim().replace(/\/+$/, '')

function readStoredServer() {
  try { return clean(localStorage.getItem(SERVER_KEY)) } catch { return '' }
}

export function getServerUrl() {
  return readStoredServer() || clean(import.meta.env.VITE_API_URL)
}

export function setServerUrl(url) {
  const value = clean(url)
  if (value && !/^https?:\/\//i.test(value)) throw new Error('Server URL must start with http:// or https://')
  try {
    if (value) localStorage.setItem(SERVER_KEY, value)
    else localStorage.removeItem(SERVER_KEY)
  } catch { /* storage unavailable */ }
  api.defaults.baseURL = value || clean(import.meta.env.VITE_API_URL)
}

export const needsServerSetup = () => isNativeApp && !getServerUrl()

export const API_ORIGIN_FN = () => getServerUrl() || window.location.origin

// Kept as a live getter so existing `${API_ORIGIN}` usages follow setting changes.
export let API_ORIGIN = API_ORIGIN_FN()

export function apiAssetUrl(path) {
  if (!path) return null
  if (/^https?:\/\//i.test(path)) return path
  const cleanPath = path.replace(/^\/+/, '')
  return `${API_ORIGIN_FN()}/${cleanPath}`
}

export function clearAuth() {
  AUTH_KEYS.forEach(key => { try { localStorage.removeItem(key) } catch { /* ignore */ } })
}

const api = axios.create({
  baseURL: getServerUrl(),
  timeout: 20000,
})

api.interceptors.request.use(cfg => {
  API_ORIGIN = API_ORIGIN_FN()
  cfg.baseURL = getServerUrl()
  const token = localStorage.getItem('token')
  if (token) {
    cfg.headers.Authorization = `Bearer ${token}`
  }

  const url = cfg.url || ''
  if (!/^https?:\/\//i.test(url) && !url.startsWith('/auth') && !url.startsWith('/api')) {
    cfg.url = `/api${url.startsWith('/') ? '' : '/'}${url}`
  }

  return cfg
}, err => Promise.reject(err))

api.interceptors.response.use(
  r => r,
  err => {
    if (err.response?.status === 401) {
      // Only drop the login session; keep the saved server address.
      clearAuth()
      if (!window.location.pathname.startsWith('/login') && !window.location.pathname.startsWith('/pay/')) {
        window.location.assign('/login')
      }
    }
    return Promise.reject(err)
  }
)

export default api

// The Android WebView cannot open popup windows; navigating to an external
// URL makes Capacitor hand it to the phone's browser / PDF viewer instead.
export function openExternal(url) {
  if (isNativeApp) window.location.href = url
  else window.open(url, '_blank', 'noopener,noreferrer')
}
