// Register.jsx
import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import api from '../api/axios'
import toast from 'react-hot-toast'

export function Register() {
  const [form, setForm] = useState({ name: '', owner_name: '', email: '', password: '' })
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()

  const submit = async e => {
    e.preventDefault(); setLoading(true)
    try {
      const { data } = await api.post('/auth/register', form)
      localStorage.setItem('token', data.access_token)
      localStorage.setItem('hostel_id', data.hostel_id)
      localStorage.setItem('hostel_name', data.hostel_name)
      toast.success('Hostel registered! 🎉')
      navigate('/')
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Registration failed')
    } finally { setLoading(false) }
  }

  const F = ({ label, name, type = 'text', placeholder }) => (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      <input type={type} required placeholder={placeholder}
        className="w-full border border-gray-300 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
        value={form[name]} onChange={e => setForm({...form, [name]: e.target.value})} />
    </div>
  )

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-600 to-purple-700 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-8">
        <div className="text-center mb-6">
          <div className="text-4xl mb-2">🏠</div>
          <h1 className="text-2xl font-bold text-gray-800">Register Your Hostel</h1>
        </div>
        <form onSubmit={submit} className="space-y-4">
          <F label="Hostel Name"  name="name"       placeholder="Sri Ram PG" />
          <F label="Owner Name"   name="owner_name" placeholder="Ravi Kumar" />
          <F label="Email"        name="email"      type="email" placeholder="ravi@sriram.com" />
          <F label="Password"     name="password"   type="password" placeholder="••••••••" />
          <button type="submit" disabled={loading}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 rounded-lg transition-all disabled:opacity-60">
            {loading ? 'Registering...' : 'Register Hostel'}
          </button>
        </form>
        <p className="text-center text-sm text-gray-500 mt-4">
          Already have an account?{' '}
          <Link to="/login" className="text-blue-600 font-medium hover:underline">Login</Link>
        </p>
      </div>
    </div>
  )
}

export function ForgotPassword() {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [loading, setLoading] = useState(false)

  const submit = async e => {
    e.preventDefault(); setLoading(true)
    try {
      await api.post('/auth/forgot-password', { email })
      setSent(true)
    } catch { toast.error('Something went wrong') }
    finally { setLoading(false) }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-600 to-purple-700 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-8">
        <h1 className="text-2xl font-bold text-gray-800 mb-2">Forgot Password</h1>
        {sent ? (
          <div className="text-center py-8">
            <div className="text-5xl mb-3">📧</div>
            <p className="text-gray-600">Reset link sent! Check your email.</p>
            <Link to="/login" className="text-blue-600 mt-4 block hover:underline">Back to Login</Link>
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-4 mt-4">
            <input type="email" required placeholder="your@email.com"
              className="w-full border border-gray-300 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
              value={email} onChange={e => setEmail(e.target.value)} />
            <button type="submit" disabled={loading}
              className="w-full bg-blue-600 text-white font-semibold py-3 rounded-lg disabled:opacity-60">
              {loading ? 'Sending...' : 'Send Reset Link'}
            </button>
            <Link to="/login" className="block text-center text-sm text-blue-600 hover:underline">Back to Login</Link>
          </form>
        )}
      </div>
    </div>
  )
}

export function ResetPassword() {
  const [password, setPassword] = useState('')
  const [done, setDone] = useState(false)
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()
  const token = new URLSearchParams(window.location.search).get('token')

  const submit = async e => {
    e.preventDefault(); setLoading(true)
    try {
      await api.post('/auth/reset-password', { token, new_password: password })
      setDone(true)
      setTimeout(() => navigate('/login'), 2000)
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Reset failed')
    } finally { setLoading(false) }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-600 to-purple-700 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-8">
        <h1 className="text-2xl font-bold text-gray-800 mb-4">Set New Password</h1>
        {done ? (
          <p className="text-green-600 text-center py-4">✅ Password reset! Redirecting to login...</p>
        ) : (
          <form onSubmit={submit} className="space-y-4">
            <input type="password" required placeholder="New password"
              className="w-full border border-gray-300 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
              value={password} onChange={e => setPassword(e.target.value)} />
            <button type="submit" disabled={loading}
              className="w-full bg-blue-600 text-white font-semibold py-3 rounded-lg disabled:opacity-60">
              {loading ? 'Resetting...' : 'Reset Password'}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
