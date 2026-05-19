import { useEffect, useState } from 'react'
import { Plus, Search, UserCircle, X, Users, UserX } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import api from '../api/axios'
import toast from 'react-hot-toast'

const BASE_URL = 'http://localhost:8000'

function getImageUrl(path) {
  if (!path) return null
  if (path.startsWith('http')) return path
  const cleanPath = path.startsWith('uploads/') ? path : `uploads/${path}`
  return `${BASE_URL}/${cleanPath}`
}

export default function Tenants() {
  const [tenants, setTenants] = useState([])
  const [rooms, setRooms] = useState([])
  const [search, setSearch] = useState('')
  const [tab, setTab] = useState('Active')   // 'Active' | 'Vacated'
  const [showAdd, setShowAdd] = useState(false)
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()

  const [form, setForm] = useState({
    room_id: '', name: '', phone: '', aadhaar_number: '',
    emergency_contact: '', joining_date: new Date().toISOString().split('T')[0]
  })
  const [photo, setPhoto] = useState(null)
  const [aadhaarPdf, setAadhaarPdf] = useState(null)

  const load = (q = '', status = tab) => {
    let url = `/tenants/?status=${status}`
    if (q) url += `&search=${q}`
    api.get(url).then(r => setTenants(r.data)).catch(() => {})
  }

  useEffect(() => {
    load('', tab)
    api.get('/rooms/').then(r => setRooms(r.data.filter(r => r.vacant_beds > 0))).catch(() => {})
  }, [tab])

  useEffect(() => {
    const t = setTimeout(() => load(search, tab), 400)
    return () => clearTimeout(t)
  }, [search])

  const addTenant = async e => {
    e.preventDefault()
    setLoading(true)
    try {
      const fd = new FormData()
      Object.entries(form).forEach(([k, v]) => fd.append(k, v))
      if (photo)      fd.append('photo', photo)
      if (aadhaarPdf) fd.append('aadhaar_pdf', aadhaarPdf)
      await api.post('/tenants/', fd, { headers: { 'Content-Type': 'multipart/form-data' } })
      toast.success('Tenant added! ✅')
      setShowAdd(false)
      load()
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to add tenant')
    } finally {
      setLoading(false)
    }
  }

  const statusColor = s => s === 'Active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Tenants</h1>
          <p className="text-gray-500 text-sm">{tenants.length} {tab.toLowerCase()} tenants</p>
        </div>
        <button onClick={() => setShowAdd(true)}
          className="flex items-center gap-1 text-sm bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700">
          <Plus size={14} /> Add Tenant
        </button>
      </div>

      {/* Tab switcher: Active / Vacated */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-lg w-fit">
        {['Active', 'Vacated'].map(t => (
          <button key={t} onClick={() => { setTab(t); setSearch('') }}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${
              tab === t ? 'bg-white text-indigo-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'
            }`}>
            {t === 'Active' ? <><Users size={12} className="inline mr-1"/>Active</> : <><UserX size={12} className="inline mr-1"/>Vacated</>}
          </button>
        ))}
      </div>

      <div className="relative">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input placeholder="Search by name or phone..."
          className="w-full pl-9 pr-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
          value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        {tenants.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <UserCircle size={40} className="mx-auto mb-3 opacity-30" />
            <p>No {tab.toLowerCase()} tenants found.</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            {tenants.map(t => (
              <div key={t.tenant_id}
                onClick={() => navigate(`/tenants/${t.tenant_id}`)}
                className="flex items-center gap-4 px-5 py-4 hover:bg-indigo-50 cursor-pointer transition-all">

                {/* FIX: Photo shows correctly; falls back to initial letter (not RA) */}
                {t.photo_url ? (
                  <img
                    src={getImageUrl(t.photo_url)}
                    alt={t.name}
                    className="w-10 h-10 rounded-full object-cover border border-gray-200"
                    onError={e => {
                      e.target.onerror = null
                      e.target.style.display = 'none'
                      e.target.nextSibling.style.display = 'flex'
                    }}
                  />
                ) : null}
                <div
                  className="w-10 h-10 rounded-full bg-indigo-100 items-center justify-center text-indigo-600 font-bold text-sm"
                  style={{ display: t.photo_url ? 'none' : 'flex' }}>
                  {t.name.charAt(0).toUpperCase()}
                </div>

                <div className="flex-1 min-w-0">
                  <p className="font-medium text-gray-800 text-sm truncate">{t.name}</p>
                  <p className="text-gray-500 text-xs">
                    {t.phone}
                    {t.room ? ` · Room ${t.room.room_number}` : ''}
                    {t.vacated_date ? ` · Vacated ${new Date(t.vacated_date).toLocaleDateString('en-IN')}` : ''}
                  </p>
                </div>
                <span className={`text-xs px-2 py-1 rounded-full font-medium ${statusColor(t.status)}`}>{t.status}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {showAdd && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-start justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl w-full max-w-lg p-6 shadow-2xl my-4">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-semibold text-gray-800">Add New Tenant</h2>
              <button onClick={() => setShowAdd(false)}><X size={20} className="text-gray-400" /></button>
            </div>
            <form onSubmit={addTenant} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Room</label>
                <select required value={form.room_id} onChange={e => setForm({...form, room_id: e.target.value})}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400">
                  <option value="">Select a room...</option>
                  {rooms.map(r => (
                    <option key={r.room_id} value={r.room_id}>
                      Room {r.room_number} ({r.sharing_type}-sharing) — {r.vacant_beds} vacant
                    </option>
                  ))}
                </select>
              </div>
              {[
                { label: 'Full Name',         key: 'name',              placeholder: 'Karthik R' },
                { label: 'Phone',             key: 'phone',             placeholder: '9876543210' },
                { label: 'Aadhaar Number',    key: 'aadhaar_number',    placeholder: '1234 5678 9012' },
                { label: 'Emergency Contact', key: 'emergency_contact', placeholder: '9876500000', req: false },
              ].map(({ label, key, placeholder, req = true }) => (
                <div key={key}>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
                  <input type="text" required={req} placeholder={placeholder} value={form[key]}
                    onChange={e => setForm({...form, [key]: e.target.value})}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400" />
                </div>
              ))}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Joining Date</label>
                <input type="date" required value={form.joining_date}
                  onChange={e => setForm({...form, joining_date: e.target.value})}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Photo</label>
                <input type="file" accept="image/*" onChange={e => setPhoto(e.target.files[0])}
                  className="w-full text-sm text-gray-500 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-sm file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Aadhaar PDF</label>
                <input type="file" accept=".pdf" onChange={e => setAadhaarPdf(e.target.files[0])}
                  className="w-full text-sm text-gray-500 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-sm file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100" />
              </div>
              <button type="submit" disabled={loading}
                className="w-full bg-indigo-600 text-white py-2.5 rounded-lg font-medium hover:bg-indigo-700 disabled:opacity-60">
                {loading ? 'Adding...' : 'Add Tenant'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
