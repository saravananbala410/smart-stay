import { useEffect, useState } from 'react'
import { Users, BedDouble, IndianRupee, AlertTriangle, Building2, Plus, Bell, MapPin, UserMinus, DoorOpen, X, Pencil } from 'lucide-react'
import api, { apiAssetUrl } from '../api/axios'
import toast from 'react-hot-toast'

const fmt = n => Number(n || 0).toLocaleString('en-IN')

function KpiCard({ icon: Icon, label, value, sub, iconBg, iconColor }) {
  return (
    <div className="stat-card group">
      <div className="absolute -right-8 -top-8 h-24 w-24 rounded-full bg-indigo-100/35 transition-transform duration-300 group-hover:scale-125"/>
      <div className={`relative p-3 rounded-2xl flex-shrink-0 ring-1 ring-inset ring-black/[0.035] ${iconBg}`}>
        <Icon size={20} strokeWidth={2.2} className={iconColor}/>
      </div>
      <div className="relative min-w-0">
        <p className="text-[10px] font-extrabold text-slate-500 uppercase tracking-[0.1em]">{label}</p>
        <p className="mt-1 truncate text-2xl font-black tracking-[-0.04em] text-slate-950 text-money">{value}</p>
        {sub && <p className="mt-1 text-[11px] font-medium text-slate-400">{sub}</p>}
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
  const [hostelForm,    setHostelForm]    = useState({ address: '', image_url: '', upi_id: '', payment_due_day: 5 })

  const loadStats = () =>
    api.get('/dashboard/stats').then(r => {
      setStats(r.data)
      setHostelForm({
        address: r.data.hostel_address || '', image_url: r.data.hostel_image || '',
        upi_id: r.data.upi_id || '', payment_due_day: r.data.payment_due_day || 5,
      })
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

  const hostelImg = apiAssetUrl(stats?.hostel_image)

  return (
    <div className="page-shell">

      {/* ─── HOSTEL BANNER ─── */}
      <div className="relative overflow-hidden rounded-[26px] bg-slate-950 shadow-[0_24px_55px_-30px_rgba(15,23,42,0.75)]">
        <div className="pointer-events-none absolute -right-10 -top-24 h-64 w-64 rounded-full bg-violet-500/35 blur-3xl"/>
        <div className="pointer-events-none absolute bottom-0 left-1/3 h-32 w-64 rounded-full bg-cyan-500/15 blur-3xl"/>
        <div className="relative flex flex-col gap-4 px-5 py-6 sm:flex-row sm:items-center sm:px-7 sm:py-7">
          {hostelImg
            ? <img src={hostelImg} alt="Hostel" className="h-16 w-16 flex-shrink-0 rounded-2xl object-cover ring-2 ring-white/20"/>
            : <div className="grid h-16 w-16 flex-shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-indigo-500/30 to-violet-500/20 text-indigo-200 ring-1 ring-inset ring-white/10">
                <Building2 size={25}/>
              </div>
          }
          <div className="flex-1 min-w-0">
            <div className="mb-1.5 flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_10px_#34d399]"/><p className="text-[10px] font-extrabold uppercase tracking-[0.15em] text-emerald-300">Property command center</p></div>
            <h1 className="truncate text-2xl font-black tracking-[-0.04em] text-white">{stats?.hostel_name || 'Your Property'}</h1>
            {stats?.hostel_address
              ? <p className="mt-1.5 flex items-center gap-1.5 truncate text-sm text-slate-400"><MapPin size={13}/>{stats.hostel_address}</p>
              : <p className="mt-1.5 text-xs text-slate-500">Add your property address from Edit Info</p>
            }
          </div>
          <button onClick={() => setShowEditHostel(true)}
            className="flex min-h-11 w-full flex-shrink-0 items-center justify-center gap-2 rounded-xl border border-white/15 bg-white/10 px-4 text-xs font-bold text-white backdrop-blur transition-colors hover:bg-white/15 sm:w-auto">
            <Pencil size={14}/> Edit property
          </button>
        </div>
      </div>

      {/* ─── KPIs ─── */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard icon={Users}       label="Active Tenants"  value={stats?.total_tenants ?? '—'}  iconBg="bg-blue-50"    iconColor="text-blue-600"/>
        <KpiCard icon={BedDouble}   label="Vacant Beds"     value={stats?.vacant_beds ?? '—'}    iconBg="bg-emerald-50" iconColor="text-emerald-600"/>
        <KpiCard icon={IndianRupee} label="Collected (Month)" value={stats ? `₹${fmt(stats.total_collection_this_month)}` : '—'} sub="This month" iconBg="bg-violet-50" iconColor="text-violet-600"/>
        <KpiCard icon={AlertTriangle} label="Still to collect" value={stats ? `₹${fmt(stats.total_pending_rent)}` : '—'} sub="Current bill balance" iconBg="bg-rose-50" iconColor="text-rose-500"/>
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
                    <span>{stats.occupancy_rate ?? 0}%</span>
                  </div>
                  <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div className="h-full bg-gradient-to-r from-blue-400 to-blue-600 rounded-full"
                      style={{ width: `${Math.min(100, stats.occupancy_rate ?? 0)}%` }}/>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* ─── NOTICE BOARD ─── */}
      <div className="card overflow-hidden">
        <div className="px-4 py-4 sm:px-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-amber-100 rounded-lg"><Bell size={14} className="text-amber-600"/></div>
            <div>
              <p className="font-bold text-slate-900 text-sm">Notice Board</p>
              <p className="text-xs text-slate-400">SMS sent to all tenants on each post</p>
            </div>
          </div>
          <button onClick={() => setShowNotice(true)} className="btn-primary btn-sm w-full sm:w-auto"><Plus size={13}/> Post Notice</button>
        </div>

        {notices.length === 0 ? (
          <div className="text-center py-10 text-slate-300">
            <Bell size={32} strokeWidth={1} className="mx-auto mb-2"/>
            <p className="text-sm">No notices yet. Post one to notify all tenants.</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-50">
            {notices.map(n => (
              <div key={n.notice_id} className="flex items-start gap-3 sm:gap-4 px-4 py-4 sm:px-5 group">
                <div className="w-8 h-8 rounded-xl bg-amber-50 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <Bell size={14} className="text-amber-500"/>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-slate-800 text-sm">{n.title}</p>
                  <p className="text-slate-500 text-xs mt-0.5 line-clamp-2">{n.content}</p>
                  <p className="text-slate-300 text-xs mt-1">{new Date(n.created_at).toLocaleString('en-IN')}</p>
                </div>
                <button onClick={() => deleteNotice(n.notice_id)}
                  className="btn-icon opacity-100 sm:opacity-0 sm:group-hover:opacity-100 text-rose-400 hover:text-rose-600">
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
            <div className="flex items-center justify-between px-4 py-4 sm:px-6 border-b border-slate-100">
              <h2 className="font-bold text-slate-900">Post Notice</h2>
              <button onClick={() => setShowNotice(false)} className="btn-icon"><X size={18}/></button>
            </div>
            <form onSubmit={postNotice} className="px-4 py-5 sm:px-6 space-y-4">
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
            <div className="flex items-center justify-between px-4 py-4 sm:px-6 border-b border-slate-100">
              <h2 className="font-bold text-slate-900">Edit Hostel Info</h2>
              <button onClick={() => setShowEditHostel(false)} className="btn-icon"><X size={18}/></button>
            </div>
            <form onSubmit={saveHostelInfo} className="px-4 py-5 sm:px-6 space-y-4">
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
              <div>
                <label className="label">Receiving UPI ID</label>
                <input className="input" placeholder="yourhostel@bank" value={hostelForm.upi_id}
                  onChange={e => setHostelForm({...hostelForm, upi_id: e.target.value})}/>
                <p className="mt-1 text-xs text-slate-400">Tenant-specific QR payments will reach this UPI ID.</p>
              </div>
              <div>
                <label className="label">Monthly payment due day</label>
                <input type="number" min="1" max="28" className="input" value={hostelForm.payment_due_day}
                  onChange={e => setHostelForm({...hostelForm, payment_due_day: +e.target.value})}/>
              </div>
              <button type="submit" className="btn-primary w-full justify-center py-2.5">Save Info</button>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
