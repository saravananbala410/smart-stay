import axios from 'axios'

const api = axios.create({ 
  // Live Vercel build-la config variable edukkum, system-la localhost-ku fallback aagum
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:8000' 
})

// Request Interceptor: Request gilli maari kilambுறதுக்கு munnadi intercept pannum
api.interceptors.request.use(cfg => {
  const token = localStorage.getItem('token')
  if (token) {
    cfg.headers.Authorization = `Bearer ${token}`
  }
  
  // Logic: Request URL-la /auth illana, backend standards-padi munnadi /api sethuko
  if (!cfg.url.startsWith('/auth')) {
    cfg.url = `/api${cfg.url.startsWith('/') ? '' : '/'}${cfg.url}`;
  }
  
  return cfg
}, err => {
  return Promise.reject(err)
})

// Response Interceptor: Backend-la irundhu data thirumbi varumbodhu check pannum
api.interceptors.response.use(
  r => r,
  err => {
    // Session expire aayitta (401 Unauthorized), automatic-ah log out pannidum
    if (err.response?.status === 401) {
      localStorage.clear()
      // Oru vela page redirect pannanum na, window.location.href = '/login' kooda panniadalam
    }
    return Promise.reject(err)
  }
)

export default api