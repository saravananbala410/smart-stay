import axios from 'axios'

const configuredApiUrl = import.meta.env.VITE_API_URL?.replace(/\/+$/, '')

export const API_ORIGIN = configuredApiUrl || window.location.origin

export function apiAssetUrl(path) {
  if (!path) return null
  if (/^https?:\/\//i.test(path)) return path
  const cleanPath = path.replace(/^\/+/, '')
  return `${API_ORIGIN}/${cleanPath}`
}

const api = axios.create({
  baseURL: configuredApiUrl || '',
})

api.interceptors.request.use(cfg => {
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
      localStorage.clear()
    }
    return Promise.reject(err)
  }
)

export default api
