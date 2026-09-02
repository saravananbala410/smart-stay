import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowLeft, ArrowRight, CheckCircle2, LockKeyhole, Mail } from 'lucide-react'
import api from '../api/axios'
import { apiErrorMessage } from '../api/errors'
import toast from 'react-hot-toast'
import AuthShell from '../components/AuthShell'

export function ForgotPassword() {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [submittedEmail, setSubmittedEmail] = useState('')
  const [loading, setLoading] = useState(false)

  const submit = async event => {
    event.preventDefault(); setLoading(true)
    try {
      const normalizedEmail = email.trim().toLowerCase()
      await api.post('/auth/forgot-password', { email: normalizedEmail })
      setSubmittedEmail(normalizedEmail)
      setSent(true)
    }
    catch (error) { toast.error(apiErrorMessage(error, 'Could not send the reset link')) }
    finally { setLoading(false) }
  }

  return (
    <AuthShell kicker="Account recovery" title={sent ? 'Check your inbox' : 'Reset your password'} subtitle={sent ? `If ${submittedEmail} is registered, a reset link will arrive shortly.` : 'Enter the exact email used when you registered your Smart Stay account.'}>
      {sent ? (
        <div className="text-center">
          <div className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-emerald-50 text-emerald-600 ring-1 ring-inset ring-emerald-200"><CheckCircle2 size={30}/></div>
          <p className="mt-4 text-sm leading-6 text-slate-500">Use the same email you entered during registration. Also check the Spam or Promotions folder.</p>
          <button type="button" onClick={() => setSent(false)} className="btn-secondary mt-5 w-full">Try another email</button>
          <Link to="/login" className="btn-primary mt-3 w-full"><ArrowLeft size={16}/>Back to sign in</Link>
        </div>
      ) : (
        <form onSubmit={submit} className="space-y-4"><div><label className="label">Email address</label><div className="relative"><Mail size={17} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"/><input type="email" required autoComplete="email" className="input pl-10" placeholder="you@example.com" value={email} onChange={event => setEmail(event.target.value)}/></div></div><button type="submit" disabled={loading} className="btn-primary w-full">{loading ? 'Sending…' : <><span>Send reset link</span><ArrowRight size={16}/></>}</button><Link to="/login" className="btn-ghost w-full"><ArrowLeft size={16}/>Back to sign in</Link></form>
      )}
    </AuthShell>
  )
}

export function ResetPassword() {
  const [password, setPassword] = useState('')
  const [done, setDone] = useState(false)
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()
  const token = new URLSearchParams(window.location.search).get('token')

  const submit = async event => {
    event.preventDefault(); setLoading(true)
    try { await api.post('/auth/reset-password', { token, new_password: password }); setDone(true); setTimeout(() => navigate('/login'), 2000) }
    catch (error) { toast.error(apiErrorMessage(error, 'Password reset failed')) }
    finally { setLoading(false) }
  }

  return (
    <AuthShell kicker="Secure your account" title={done ? 'Password updated' : 'Choose a new password'} subtitle={done ? 'Your new password is ready. Redirecting you to sign in…' : 'Use a strong, unique password for your Smart Stay workspace.'}>
      {done ? <div className="py-3 text-center"><CheckCircle2 size={52} className="mx-auto text-emerald-500"/></div> : <form onSubmit={submit} className="space-y-4"><div><label className="label">New password</label><div className="relative"><LockKeyhole size={17} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"/><input type="password" required minLength={8} maxLength={128} autoComplete="new-password" className="input pl-10" placeholder="Minimum 8 characters" value={password} onChange={event => setPassword(event.target.value)}/></div><p className="mt-1.5 text-[11px] text-slate-400">Use at least 8 characters.</p></div><button type="submit" disabled={loading} className="btn-primary w-full">{loading ? 'Updating…' : 'Update password'}</button></form>}
    </AuthShell>
  )
}
