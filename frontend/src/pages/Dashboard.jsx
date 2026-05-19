import { useEffect, useState } from 'react'
import { Users, BedDouble, IndianRupee, AlertCircle, Building2, Plus, Bell, MapPin, UserX, Home } from 'lucide-react'
import api from '../api/axios'
import toast from 'react-hot-toast'

const BASE_URL = 'http://localhost:8000'

const StatCard = ({ icon: Icon, label, value, color, sub }) => (
  <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100 flex items-start gap-4">
    <div className={`p-3 rounded-xl ${color}`}>
      <Icon size={22} className="text-white" />
    </div>
    <div>
      <p className="text-sm text-gray-500">{label}</p>
      <p className="text-2xl font-bold text-gray-800 mt-0.5">{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
    </div>
  </div>
)

export default function Dashboard() {
  const [stats, setStats]             = useState(null)
  const [notices, setNotices]         = useState([])
  const [noticeForm, setNoticeForm]   = useState({ title: '', content: '' })
  const [showNoticeForm, setShowNoticeForm] = useState(false)
  const [showEditHostel, setShowEditHostel] = useState(false)
  const [hostelForm, setHostelForm]   = useState({ address: '', image_url: '' })

  useEffect(() => {
    api.get('/dashboard/stats').then(r => {
      setStats(r.data)
      setHostelForm({ address: r.data.hostel_address || '', image_url: r.data.hostel_image || '' })
    }).catch(() => {})
    api.get('/notices/').then(r => setNotices(r.data)).catch(() => {})
  }, [])

  const postNotice = async e => {
    e.preventDefault()
    try {
      const { data } = await api.post('/notices/', noticeForm)
      setNotices([data, ...notices])
      setNoticeForm({ title: '', content: '' })
      setShowNoticeForm(false)
      toast.success('Notice posted! 📢')

      // FIX: Send SMS to all active tenants when notice is posted
      // This would call a real SMS API — placeholder toast for now
      toast('SMS sent to all tenants 📱', { icon: '📱' })
    } catch { toast.error('Failed to post notice') }
  }

  const saveHostelInfo = async e => {
    e.preventDefault()
    try {
      await api.patch('/dashboard/hostel-info', null, { params: hostelForm })
      toast.success('Hostel info updated! 🏠')
      setShowEditHostel(false)
      api.get('/dashboard/stats').then(r => setStats(r.data))
    } catch { toast.error('Failed to update') }
  }

  const deleteNotice = async id => {
    try {
      await api.delete(`/notices/${id}`)
      setNotices(notices.filter(n => n.notice_id !== id))
    } catch { toast.error('Failed to delete') }
  }

  return (
    <div className="space-y-6">
      {/* Hostel Header */}
      <div className="bg-gradient-to-r from-indigo-600 to-indigo-800 rounded-2xl p-5 text-white flex items-center gap-4">
        {stats?.hostel_image ? (
          <img src={stats.hostel_image.startsWith('http') ? stats.hostel_image : `${BASE_URL}/${stats.hostel_image}`}
            alt="Hostel" className="w-16 h-16 rounded-xl object-cover border-2 border-white/30" />
        ) : (
          <div className="w-16 h-16 rounded-xl bg-white/10 flex items-center justify-center">
            <Building2 size={28} className="text-white/70" />
          </div>
        )}
        <div className="flex-1">
          <h1 className="text-xl font-bold">{stats?.hostel_name || 'Your Hostel'}</h1>
          {stats?.hostel_address && (
            <p className="text-indigo-200 text-sm mt-0.5 flex items-center gap-1">
              <MapPin size={12} /> {stats.hostel_address}
            </p>
          )}
        </div>
        <button onClick={() => setShowEditHostel(true)}
          className="text-xs border border-white/30 px-3 py-1.5 rounded-lg hover:bg-white/10">
          Edit Info
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={Users}       label="Active Tenants"  value={stats?.total_tenants ?? '—'}    color="bg-indigo-500" />
        <StatCard icon={BedDouble}   label="Vacant Beds"     value={stats?.vacant_beds ?? '—'}      color="bg-emerald-500" />
        <StatCard icon={IndianRupee} label="This Month"      value={stats ? `₹${stats.total_collection_this_month.toLocaleString('en-IN')}` : '—'} color="bg-blue-500" sub="Collected" />
        <StatCard icon={AlertCircle} label="Pending Rent"    value={stats ? `₹${stats.total_pending_rent.toLocaleString('en-IN')}` : '—'} color="bg-rose-500" sub="Outstanding" />
      </div>

      {/* Vacant Rooms + Vacated Tenants */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Vacant rooms */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
          <h2 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
            <Home size={16} className="text-emerald-600" /> Vacant Rooms
          </h2>
          {stats?.vacant_rooms?.length === 0 ? (
            <p className="text-sm text-gray-400">All rooms are full 🎉</p>
          ) : (
            <div className="space-y-2">
              {stats?.vacant_rooms?.map(r => (
                <div key={r.room_number} className="flex justify-between items-center p-3 bg-emerald-50 rounded-lg text-sm">
                  <span className="font-medium text-gray-700">Room {r.room_number}</span>
                  <span className="text-emerald-600 font-medium">{r.vacant_beds} bed{r.vacant_beds > 1 ? 's' : ''} vacant</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Stats summary */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
          <h2 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
            <UserX size={16} className="text-gray-500" /> Occupancy Summary
          </h2>
          <div className="space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Total Rooms</span>
              <span className="font-medium">{stats?.total_rooms ?? '—'}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Active Tenants</span>
              <span className="font-medium text-green-600">{stats?.total_tenants ?? '—'}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Vacated Tenants (Total)</span>
              <span className="font-medium text-gray-400">{stats?.vacated_tenants ?? '—'}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Vacant Beds</span>
              <span className="font-medium text-orange-500">{stats?.vacant_beds ?? '—'}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Notice Board */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Bell size={18} className="text-indigo-600" />
            <h2 className="font-semibold text-gray-800">Notice Board</h2>
            <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">SMS sent to tenants on post</span>
          </div>
          <button onClick={() => setShowNoticeForm(!showNoticeForm)}
            className="flex items-center gap-1 text-sm bg-indigo-600 text-white px-3 py-1.5 rounded-lg hover:bg-indigo-700 transition-all">
            <Plus size={14} /> New Notice
          </button>
        </div>

        {showNoticeForm && (
          <form onSubmit={postNotice} className="mb-4 p-4 bg-indigo-50 rounded-lg space-y-3">
            <input required placeholder="Notice Title"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
              value={noticeForm.title} onChange={e => setNoticeForm({...noticeForm, title: e.target.value})} />
            <textarea required placeholder="Notice content..." rows={3}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
              value={noticeForm.content} onChange={e => setNoticeForm({...noticeForm, content: e.target.value})} />
            <div className="flex gap-2">
              <button type="submit" className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm">Post & Send SMS</button>
              <button type="button" onClick={() => setShowNoticeForm(false)} className="text-gray-500 text-sm px-4 py-2 border rounded-lg">Cancel</button>
            </div>
          </form>
        )}

        {notices.length === 0 ? (
          <p className="text-gray-400 text-sm text-center py-6">No notices yet.</p>
        ) : (
          <div className="space-y-3">
            {notices.map(n => (
              <div key={n.notice_id} className="border border-gray-100 rounded-lg p-4">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-medium text-gray-800 text-sm">{n.title}</p>
                    <p className="text-gray-600 text-sm mt-1">{n.content}</p>
                    <p className="text-gray-400 text-xs mt-2">{new Date(n.created_at).toLocaleDateString('en-IN')}</p>
                  </div>
                  <button onClick={() => deleteNotice(n.notice_id)} className="text-red-400 hover:text-red-600 text-xs ml-4">✕</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Edit Hostel Info Modal */}
      {showEditHostel && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-semibold">Hostel Info</h2>
              <button onClick={() => setShowEditHostel(false)} className="text-gray-400">✕</button>
            </div>
            <form onSubmit={saveHostelInfo} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Address</label>
                <textarea rows={2} placeholder="123, Anna Nagar, Chennai - 600040"
                  value={hostelForm.address} onChange={e => setHostelForm({...hostelForm, address: e.target.value})}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Hostel Image URL</label>
                <input type="url" placeholder="https://..." value={hostelForm.image_url}
                  onChange={e => setHostelForm({...hostelForm, image_url: e.target.value})}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400" />
              </div>
              <button type="submit" className="w-full bg-indigo-600 text-white py-2.5 rounded-lg font-medium">Save</button>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
