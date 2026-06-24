import { useEffect, useState } from 'react'
import { Plus, Search, Users, UserX, X, Camera } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import api from '../api/axios'
import toast from 'react-hot-toast'

const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'

function resolvePhoto(url) {
  if (!url) return null
  if (url.startsWith('http')) return url
  let c = url.replace(/^\//, '')
  if (!c.startsWith('uploads/')) c = `uploads/${c}`
  return `${BASE_URL}/${c}`
}

function Avatar({ name, photoUrl, size = 10 }) {
  const [err, setErr] = useState(false)
  const src = resolvePhoto(photoUrl)
  const cls = `w-${size} h-${size} rounded-xl object-cover flex-shrink-0`
  if (src && !err)
    return <img src={src} alt={name} className={cls} onError={() => setErr(true)}/>
  return (
    <div className={`w-${size} h-${size} rounded-xl bg-gradient-to-br from-blue-100 to-blue-200 flex items-center justify-center text-blue-700 font-bold text-sm flex-shrink-0`}>
      {name.charAt(0).toUpperCase()}
    </div>
  )
}

export default function Tenants() {
  const [tenants,  setTenants]  = useState([])
  const [rooms,    setRooms]    = useState([])
  const [search,   setSearch]   = useState('')
  const [tab,      setTab]      = useState('Active')
  const [showAdd,  setShowAdd]  = useState(false)
  const [loading,  setLoading]  = useState(false)
  const navigate = useNavigate()

  const [form, setForm] = useState({
    room_id: '', name: '', phone: '', aadhaar_number: '',
    emergency_contact: '', joining_date: new Date().toISOString().split('T')[0]
  })
  const [photo,      setPhoto]      = useState(null)
  const [aadhaarPdf, setAadhaarPdf] = useState(null)

  const load = (q = '', status = tab) => {
    let url = `/tenants/?status=${status}`
    if (q) url += `&search=${encodeURIComponent(q)}`
    api.get(url).then(r => setTenants(r.data)).catch(() => {})
  }

  useEffect(() => { load('', tab) }, [tab])
  useEffect(() => {
    api.get('/rooms/').then(r => setRooms(r.data.filter(r => r.vacant_beds > 0))).catch(() => {})
  }, [])
  useEffect(() => {
    const t = setTimeout(() => load(search, tab), 350)
    return () => clearTimeout(t)
  }, [search])

  const addTenant = async e => {
    e.preventDefault(); setLoading(true)
    try {
      const fd = new FormData()
      Object.entries(form).forEach(([k,v]) => fd.append(k, v))
      if (photo)      fd.append('photo', photo)
      if (aadhaarPdf) fd.append('aadhaar_pdf', aadhaarPdf)
      await api.post('/tenants/', fd, { headers: { 'Content-Type': 'multipart/form-data' } })
      toast.success('Tenant added ✅')
      setShowAdd(false); setPhoto(null); setAadhaarPdf(null)
      setForm({ room_id: '', name: '', phone: '', aadhaar_number: '', emergency_contact: '', joining_date: new Date().toISOString().split('T')[0] })
      load()
    } catch (err) { toast.error(err.response?.data?.detail || 'Failed') }
    setLoading(false)
  }

  return (
    <div className="space-y-5 max-w-3xl">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Tenants</h1>
          <p className="text-slate-400 text-sm mt-0.5">{tenants.length} {tab.toLowerCase()} tenant{tenants.length !== 1 ? 's' : ''}</p>
        </div>
        <button onClick={() => setShowAdd(true)} className="btn-primary btn-sm">
          <Plus size={13}/> Add Tenant
        </button>
      </div>

      {/* Tab toggle */}
      <div className="flex gap-0 bg-slate-100 p-1 rounded-xl w-fit">
        {[['Active', Users, 'text-emerald-600'], ['Vacated', UserX, 'text-slate-400']].map(([t, Icon, ic]) => (
          <button key={t} onClick={() => { setTab(t); setSearch('') }}
            className={`flex items-center gap-1.5 px-5 py-2 rounded-lg text-sm font-semibold transition-all ${
              tab === t ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-400 hover:text-slate-600'
            }`}>
            <Icon size={13} className={tab === t ? ic : ''}/>
            {t}
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="relative">
        <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-300"/>
        <input className="input pl-9" placeholder="Search by name or phone…"
          value={search} onChange={e => setSearch(e.target.value)}/>
      </div>

      {/* List */}
      <div className="card overflow-hidden">
        {tenants.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-slate-300">
            <Users size={40} strokeWidth={1}/>
            <p className="mt-3 text-sm text-slate-400">No {tab.toLowerCase()} tenants found.</p>
            {tab === 'Active' && (
              <button onClick={() => setShowAdd(true)} className="mt-3 btn-primary btn-sm">Add first tenant</button>
            )}
          </div>
        ) : (
          <div className="divide-y divide-slate-50">
            {tenants.map(t => (
              <div key={t.tenant_id} onClick={() => navigate(`/tenants/${t.tenant_id}`)}
                className="flex items-center gap-4 px-5 py-3.5 hover:bg-slate-50/80 cursor-pointer transition-colors">
                <Avatar name={t.name} photoUrl={t.photo_url} size={10}/>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-slate-800 text-sm">{t.name}</p>
                  <p className="text-slate-400 text-xs mt-0.5">
                    {t.phone}
                    {t.room ? ` · Room ${t.room.room_number}` : ''}
                    {t.vacated_date ? ` · Vacated ${new Date(t.vacated_date).toLocaleDateString('en-IN')}` : ''}
                  </p>
                </div>
                <span className={`badge flex-shrink-0 ${t.status === 'Active' ? 'badge-green' : 'badge-slate'}`}>
                  {t.status}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add Tenant Modal */}
      {showAdd && (
        <div className="modal-overlay">
          <div className="modal-box max-w-lg p-0">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <h2 className="font-bold text-slate-900">Add New Tenant</h2>
              <button onClick={() => setShowAdd(false)} className="btn-icon"><X size={18}/></button>
            </div>
            <form onSubmit={addTenant} className="px-6 py-5 space-y-4">
              <div>
                <label className="label">Room</label>
                <select required value={form.room_id} onChange={e => setForm({...form, room_id: e.target.value})} className="input">
                  <option value="">Select a room…</option>
                  {rooms.map(r => (
                    <option key={r.room_id} value={r.room_id}>
                      Room {r.room_number} ({r.sharing_type}-sharing) — {r.vacant_beds} bed{r.vacant_beds>1?'s':''} free
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: 'Full Name',      key: 'name',              ph: 'Karthik R',    type: 'text'   },
                  { label: 'Phone',          key: 'phone',             ph: '9876543210',   type: 'tel'    },
                  { label: 'Aadhaar Number', key: 'aadhaar_number',    ph: '1234 5678 9012', type: 'text' },
                  { label: 'Emergency No.',  key: 'emergency_contact', ph: '9876500000',   type: 'tel', req: false },
                ].map(({ label, key, ph, type, req = true }) => (
                  <div key={key}>
                    <label className="label">{label}</label>
                    <input type={type} required={req} placeholder={ph} value={form[key]}
                      onChange={e => setForm({...form, [key]: e.target.value})} className="input"/>
                  </div>
                ))}
              </div>
              <div>
                <label className="label">Joining Date</label>
                <input type="date" required value={form.joining_date}
                  onChange={e => setForm({...form, joining_date: e.target.value})} className="input"/>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label flex items-center gap-1"><Camera size={11}/> Photo</label>
                  <input type="file" accept="image/*" onChange={e => setPhoto(e.target.files[0])}
                    className="text-sm text-slate-500 w-full file:mr-2 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"/>
                </div>
                <div>
                  <label className="label">Aadhaar PDF</label>
                  <input type="file" accept=".pdf" onChange={e => setAadhaarPdf(e.target.files[0])}
                    className="text-sm text-slate-500 w-full file:mr-2 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"/>
                </div>
              </div>
              <button type="submit" disabled={loading} className="btn-primary w-full justify-center py-2.5">
                {loading ? 'Adding…' : 'Add Tenant'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
