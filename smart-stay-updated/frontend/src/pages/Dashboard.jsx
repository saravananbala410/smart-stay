import { useEffect, useState } from 'react'
import { Users, BedDouble, IndianRupee, AlertTriangle, Building2, Plus, Bell, MapPin, UserMinus, DoorOpen, X, Pencil } from 'lucide-react'
import api from '../api/axios'
import toast from 'react-hot-toast'

const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'
const fmt = n => Number(n || 0).toLocaleString('en-IN')

function KpiCard({ icon: Icon, label, value, sub, iconBg, iconColor }) {
  return (
    <div className="card p-5 flex items-center gap-4">
      <div className={`p-3 rounded-2xl flex-shrink-0 ${iconBg}`}>
        <Icon size={20} className={iconColor}/>
      </div>
      <div className="min-w-0">
        <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">{label}</p>
        <p className="text-2xl font-bold text-slate-900 mt-0.5 text-money truncate">{value}</p>
        {sub && <p className="text-xs text-slate-400 mt-0.5">{sub}</p>}
      </div>
    </div>
  )
}

export default function Dashboard() {
  const [stats,         setStats]         = useState(null)
  const [notices,       setNotices]       = useState([])
  const [noticeForm,    setNoticeForm]    = useState({ title: '', content: '' })
  const [showNotice,    setShowNotice]    = useState(false)
  const [showEditHostel,setShowEditHostel]= useState(false)
  const [hostelForm,    setHostelForm]    = useState({ address: '', image_url: '' })

  const loadStats = () =>
    api.get('/dashboard/stats').then(r => {
      setStats(r.data)
      setHostelForm({ address: r.data.hostel_address || '', image_url: r.data.hostel_image || '' })
    }).catch(() => {})

  useEffect(() => {
    loadStats()
    api.get('/notices/').then(r => setNotices(r.data)).catch(() => {})
  }, [])

  const postNotice = async e => {
    e.preventDefault()
    try {
      const { data } = await api.post('/notices/', noticeForm)
      setNotices([data, ...notices])
      setNoticeForm({ title: '', content: '' })
      setShowNotice(false)
      toast.success('Notice posted 📢')
      toast('SMS sent to tenants 📱', { icon: '📱' })
    } catch { toast.error('Failed to post notice') }
  }

  const deleteNotice = async id => {
    try { await api.delete(`/notices/${id}`); setNotices(notices.filter(n => n.notice_id !== id)) }
    catch { toast.error('Failed to delete') }
  }

  const saveHostelInfo = async e => {
    e.preventDefault()
    try {
      await api.patch('/dashboard/hostel-info', null, { params: hostelForm })
      toast.success('Hostel info saved ✅')
      setShowEditHostel(false); loadStats()
    } catch { toast.error('Failed to save') }
  }

  const hostelImg = stats?.hostel_image
    ? stats.hostel_image.startsWith('http') ? stats.hostel_image : `${BASE_URL}/${stats.hostel_image}`
    : null

  return (
    <div className="space-y-5 max-w-5xl">

      {/* ─── HOSTEL BANNER ─── */}
      <div className="card overflow-hidden">
        <div className="bg-gradient-to-r from-blue-600 to-blue-800 px-6 py-5 flex items-center gap-4">
          {hostelImg
            ? <img src={hostelImg} alt="Hostel" className="w-14 h-14 rounded-xl object-cover ring-2 ring-white/30 flex-shrink-0"/>
            : <div className="w-14 h-14 rounded-xl bg-white/10 flex items-center justify-center flex-shrink-0">
                <Building2 size={24} className="text-white/60"/>
              </div>
          }
          <div className="flex-1 min-w-0">
            <h1 className="text-xl font-bold text-white truncate">{stats?.hostel_name || 'Your Hostel'}</h1>
            {stats?.hostel_address
              ? <p className="text-blue-200 text-sm mt-0.5 flex items-center gap-1 truncate"><MapPin size={12}/>{stats.hostel_address}</p>
              : <p className="text-blue-300 text-xs mt-0.5">No address set — click Edit Info</p>
            }
          </div>
          <button onClick={() => setShowEditHostel(true)}
            className="flex-shrink-0 flex items-center gap-1.5 text-xs border border-white/30 text-white/80 px-3 py-2 rounded-lg hover:bg-white/10 transition-colors">
            <Pencil size={12}/> Edit Info
          </button>
        </div>
      </div>

      {/* ─── KPIs ─── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard icon={Users}       label="Active Tenants"  value={stats?.total_tenants ?? '—'}  iconBg="bg-blue-50"    iconColor="text-blue-600"/>
        <KpiCard icon={BedDouble}   label="Vacant Beds"     value={stats?.vacant_beds ?? '—'}    iconBg="bg-emerald-50" iconColor="text-emerald-600"/>
        <KpiCard icon={IndianRupee} label="Collected (Month)" value={stats ? `₹${fmt(stats.total_collection_this_month)}` : '—'} sub="This month" iconBg="bg-violet-50" iconColor="text-violet-600"/>
        <KpiCard icon={AlertTriangle} label="Pending Rent" value={stats ? `₹${fmt(stats.total_pending_rent)}` : '—'} sub="Outstanding" iconBg="bg-rose-50" iconColor="text-rose-500"/>
      </div>

      {/* ─── VACANT ROOMS + OCCUPANCY ─── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="card p-5">
          <p className="section-eyebrow flex items-center gap-1.5"><DoorOpen size={12}/> Vacant Rooms</p>
          {!stats?.vacant_rooms?.length ? (
            <div className="text-center py-6">
              <p className="text-2xl">🎉</p>
              <p className="text-sm text-slate-400 mt-1">All rooms are fully occupied</p>
            </div>
          ) : (
            <div className="space-y-2">
              {stats.vacant_rooms.map(r => (
                <div key={r.room_number} className="flex items-center justify-between p-3 bg-emerald-50 rounded-xl">
                  <span className="font-semibold text-sm text-slate-700">Room {r.room_number}</span>
                  <span className="badge-green">{r.vacant_beds} bed{r.vacant_beds > 1 ? 's' : ''} free</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="card p-5">
          <p className="section-eyebrow flex items-center gap-1.5"><Building2 size={12}/> Occupancy Summary</p>
          <div className="space-y-3">
            {[
              { label: 'Total Rooms',     value: stats?.total_rooms,      color: 'text-slate-700' },
              { label: 'Active Tenants',  value: stats?.total_tenants,    color: 'text-emerald-600' },
              { label: 'Vacated (ever)',  value: stats?.vacated_tenants,  color: 'text-slate-400' },
              { label: 'Vacant Beds',     value: stats?.vacant_beds,      color: 'text-orange-500' },
            ].map(row => (
              <div key={row.label} className="flex items-center justify-between text-sm">
                <span className="text-slate-500">{row.label}</span>
                <span className={`font-bold text-money ${row.color}`}>{row.value ?? '—'}</span>
              </div>
            ))}
            {stats && (
              <>
                <div className="pt-2 border-t border-slate-100">
                  <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
                    <span>Occupancy rate</span>
                    <span>{stats.total_rooms > 0
                      ? Math.round(((stats.total_tenants) / (stats.total_rooms * 4)) * 100)
                      : 0}%</span>
                  </div>
                  <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div className="h-full bg-gradient-to-r from-blue-400 to-blue-600 rounded-full"
                      style={{ width: `${stats.total_rooms > 0 ? Math.min(100, Math.round((stats.total_tenants / (stats.total_rooms * 4)) * 100)) : 0}%` }}/>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* ─── NOTICE BOARD ─── */}
      <div className="card overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-amber-100 rounded-lg"><Bell size={14} className="text-amber-600"/></div>
            <div>
              <p className="font-bold text-slate-900 text-sm">Notice Board</p>
              <p className="text-xs text-slate-400">SMS sent to all tenants on each post</p>
            </div>
          </div>
          <button onClick={() => setShowNotice(true)} className="btn-primary btn-sm"><Plus size={13}/> Post Notice</button>
        </div>

        {notices.length === 0 ? (
          <div className="text-center py-10 text-slate-300">
            <Bell size={32} strokeWidth={1} className="mx-auto mb-2"/>
            <p className="text-sm">No notices yet. Post one to notify all tenants.</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-50">
            {notices.map(n => (
              <div key={n.notice_id} className="flex items-start gap-4 px-5 py-4 group">
                <div className="w-8 h-8 rounded-xl bg-amber-50 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <Bell size={14} className="text-amber-500"/>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-slate-800 text-sm">{n.title}</p>
                  <p className="text-slate-500 text-xs mt-0.5 line-clamp-2">{n.content}</p>
                  <p className="text-slate-300 text-xs mt-1">{new Date(n.created_at).toLocaleString('en-IN')}</p>
                </div>
                <button onClick={() => deleteNotice(n.notice_id)}
                  className="btn-icon opacity-0 group-hover:opacity-100 text-rose-400 hover:text-rose-600">
                  <X size={14}/>
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ─── MODALS ─── */}

      {showNotice && (
        <div className="modal-overlay">
          <div className="modal-box max-w-md p-0">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <h2 className="font-bold text-slate-900">Post Notice</h2>
              <button onClick={() => setShowNotice(false)} className="btn-icon"><X size={18}/></button>
            </div>
            <form onSubmit={postNotice} className="px-6 py-5 space-y-4">
              <div>
                <label className="label">Title</label>
                <input className="input" required placeholder="e.g. Water outage on Sunday" value={noticeForm.title}
                  onChange={e => setNoticeForm({...noticeForm, title: e.target.value})}/>
              </div>
              <div>
                <label className="label">Message</label>
                <textarea className="input min-h-[80px] resize-none" required placeholder="Type the notice content…"
                  value={noticeForm.content}
                  onChange={e => setNoticeForm({...noticeForm, content: e.target.value})}/>
              </div>
              <p className="text-xs text-slate-400 flex items-center gap-1"><Bell size={11}/> This will SMS all active tenants.</p>
              <button type="submit" className="btn-primary w-full justify-center py-2.5">Post & Send SMS</button>
            </form>
          </div>
        </div>
      )}

      {showEditHostel && (
        <div className="modal-overlay">
          <div className="modal-box max-w-md p-0">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <h2 className="font-bold text-slate-900">Edit Hostel Info</h2>
              <button onClick={() => setShowEditHostel(false)} className="btn-icon"><X size={18}/></button>
            </div>
            <form onSubmit={saveHostelInfo} className="px-6 py-5 space-y-4">
              <div>
                <label className="label">Address</label>
                <input className="input" placeholder="12, Gandhi Nagar, Chennai 600001" value={hostelForm.address}
                  onChange={e => setHostelForm({...hostelForm, address: e.target.value})}/>
              </div>
              <div>
                <label className="label">Hostel Image URL</label>
                <input className="input" placeholder="https://… or /uploads/…" value={hostelForm.image_url}
                  onChange={e => setHostelForm({...hostelForm, image_url: e.target.value})}/>
                <p className="text-xs text-slate-400 mt-1">Paste a direct image URL or Cloudinary link.</p>
              </div>
              <button type="submit" className="btn-primary w-full justify-center py-2.5">Save Info</button>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
