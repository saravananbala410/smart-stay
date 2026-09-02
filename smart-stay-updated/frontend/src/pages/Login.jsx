import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowRight, LockKeyhole, Mail } from 'lucide-react'
import api from '../api/axios'
import { apiErrorMessage } from '../api/errors'
import toast from 'react-hot-toast'
import AuthShell from '../components/AuthShell'

export default function Login() {
  const [form, setForm] = useState({ email: '', password: '' })
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()

  const submit = async event => {
    event.preventDefault()
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
