import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowRight, Building2, LockKeyhole, Mail, UserRound } from 'lucide-react'
import api from '../api/axios'
import { apiErrorMessage } from '../api/errors'
import toast from 'react-hot-toast'
import AuthShell from '../components/AuthShell'

export default function Register() {
  const [form, setForm] = useState({ name: '', owner_name: '', email: '', password: '' })
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()

  const submit = async event => {
    event.preventDefault()
    setLoading(true)
    try {
      await api.post('/auth/register', {
        ...form,
        name: form.name.trim(),
        owner_name: form.owner_name.trim(),
        email: form.email.trim().toLowerCase(),
      })
      toast.success('Property registered successfully!')
      navigate('/login')
    } catch (error) {
      toast.error(apiErrorMessage(error, 'Registration failed'))
    } finally { setLoading(false) }
  }

  const fields = [
    { key: 'name', label: 'Property name', placeholder: 'Sunrise Living', icon: Building2, type: 'text', autoComplete: 'organization' },
    { key: 'owner_name', label: 'Owner name', placeholder: 'Ravi Kumar', icon: UserRound, type: 'text', autoComplete: 'name' },
    { key: 'email', label: 'Work email', placeholder: 'ravi@sunrise.com', icon: Mail, type: 'email', autoComplete: 'email' },
    { key: 'password', label: 'Create password', placeholder: 'Minimum 8 characters', icon: LockKeyhole, type: 'password', autoComplete: 'new-password' },
  ]

  return (
    <AuthShell
      kicker="Start your workspace"
      title="Bring your property online"
      subtitle="Create your secure admin account. You can configure rooms and rent next."
      footer={<>Already using Smart Stay? <Link to="/login" className="font-bold text-indigo-600 hover:text-indigo-700">Sign in</Link></>}
    >
      <form onSubmit={submit} className="space-y-3.5">
        {fields.map(({ key, label, placeholder, icon: Icon, type, autoComplete }) => (
          <div key={key}>
            <label className="label">{label}</label>
            <div className="relative"><Icon size={17} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"/><input required type={type} minLength={key === 'password' ? 8 : key === 'name' || key === 'owner_name' ? 2 : undefined} maxLength={key === 'password' ? 128 : undefined} autoComplete={autoComplete} placeholder={placeholder} className="input pl-10" value={form[key]} onChange={event => setForm({ ...form, [key]: event.target.value })}/></div>
            {key === 'password' && <p className="mt-1.5 text-[11px] text-slate-400">Use at least 8 characters.</p>}
          </div>
        ))}
        <button type="submit" disabled={loading} className="btn-primary mt-2 w-full">
          {loading ? 'Creating workspace…' : <><span>Create my workspace</span><ArrowRight size={16}/></>}
        </button>
      </form>
      <p className="mt-4 text-center text-[11px] leading-5 text-slate-400">By continuing, you agree to keep tenant information secure and use it only for property operations.</p>
    </AuthShell>
  )
}
