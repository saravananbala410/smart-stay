import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowRight, LockKeyhole, Mail, Server } from 'lucide-react'
import api, { getServerUrl, isNativeApp, needsServerSetup, setServerUrl } from '../api/axios'
import { apiErrorMessage } from '../api/errors'
import toast from 'react-hot-toast'
import AuthShell from '../components/AuthShell'

export default function Login() {
  const [form, setForm] = useState({ email: '', password: '' })
  const [loading, setLoading] = useState(false)
  const [showServer, setShowServer] = useState(needsServerSetup())
  const [server, setServer] = useState(getServerUrl())
  const [checking, setChecking] = useState(false)
  const navigate = useNavigate()

  const saveServer = async event => {
    event.preventDefault()
    setChecking(true)
    try {
      setServerUrl(server)
      await api.get(`${getServerUrl()}/health`, { timeout: 8000 })
      toast.success('Server connected')
      setShowServer(false)
    } catch (error) {
      toast.error(error.message?.startsWith('Server URL') ? error.message : 'Cannot reach server. Check the address and that phone + computer are on the same WiFi.')
    } finally { setChecking(false) }
  }

  const submit = async event => {
    event.preventDefault()
    if (needsServerSetup()) { setShowServer(true); return }
    setLoading(true)
    try {
      const { data } = await api.post('/auth/login', { ...form, email: form.email.trim().toLowerCase() })
      localStorage.setItem('token', data.access_token)
      localStorage.setItem('hostel_id', data.hostel_id)
      localStorage.setItem('hostel_name', data.hostel_name)
      toast.success('Welcome back!')
      navigate('/')
    } catch (error) {
      toast.error(apiErrorMessage(error, 'Login failed'))
    } finally { setLoading(false) }
  }

  return (
    <AuthShell
      kicker="Welcome back"
      title="Sign in to your workspace"
      subtitle="Manage tenants, collections and your daily property operations."
      footer={<>New to Smart Stay? <Link to="/register" className="font-bold text-indigo-600 hover:text-indigo-700">Create your property</Link></>}
    >
      {showServer ? (
        <form onSubmit={saveServer} className="mb-6 space-y-3 rounded-2xl border border-indigo-100 bg-indigo-50/50 p-4">
          <label className="label">Server address</label>
          <div className="relative"><Server size={17} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"/><input type="url" required inputMode="url" autoCapitalize="none" className="input pl-10" placeholder="http://192.168.1.10:8000" value={server} onChange={event => setServer(event.target.value)}/></div>
          <p className="text-[11px] text-slate-500">Backend URL — your computer's WiFi IP with port 8000, or your hosted server.</p>
          <button type="submit" disabled={checking} className="btn-primary w-full">{checking ? 'Checking…' : 'Save & connect'}</button>
        </form>
      ) : (isNativeApp || getServerUrl()) && (
        <button type="button" onClick={() => setShowServer(true)} className="mb-4 flex w-full items-center justify-center gap-2 text-xs font-bold text-indigo-600"><Server size={13}/>Server: {getServerUrl() || 'not set'} · change</button>
      )}
      <form onSubmit={submit} className="space-y-4">
        <div>
          <label className="label">Email address</label>
          <div className="relative"><Mail size={17} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"/><input type="email" required autoComplete="email" className="input pl-10" placeholder="admin@myhostel.com" value={form.email} onChange={event => setForm({ ...form, email: event.target.value })}/></div>
        </div>
        <div>
          <div className="flex items-center justify-between"><label className="label">Password</label><Link to="/forgot-password" className="mb-1.5 text-xs font-bold text-indigo-600 hover:text-indigo-700">Forgot password?</Link></div>
          <div className="relative"><LockKeyhole size={17} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"/><input type="password" required autoComplete="current-password" className="input pl-10" placeholder="Enter your password" value={form.password} onChange={event => setForm({ ...form, password: event.target.value })}/></div>
        </div>
        <button type="submit" disabled={loading} className="btn-primary mt-2 w-full">
          {loading ? 'Signing in…' : <><span>Sign in securely</span><ArrowRight size={16}/></>}
        </button>
      </form>
      <p className="mt-4 flex items-center justify-center gap-2 text-[11px] text-slate-400"><LockKeyhole size={12}/>Your session is securely encrypted</p>
    </AuthShell>
  )
}
