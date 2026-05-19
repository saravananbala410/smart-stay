import axios from 'axios'

const api = axios.create({ 
  // Base URL-ah backend address-oda niruthiko
  baseURL: 'http://localhost:8000' 
})

api.interceptors.request.use(cfg => {
  const token = localStorage.getItem('token')
  if (token) cfg.headers.Authorization = `Bearer ${token}`
  
  // Logic: Oru vela request URL-la /auth illana, munnadi /api sethuko
  if (!cfg.url.startsWith('/auth')) {
    cfg.url = `/api${cfg.url.startsWith('/') ? '' : '/'}${cfg.url}`;
  }
  
  return cfg
})

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