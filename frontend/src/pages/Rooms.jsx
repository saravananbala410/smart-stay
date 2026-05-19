import { useEffect, useState } from 'react'
import { Plus, BedDouble, Settings, Trash2, X } from 'lucide-react'
import api from '../api/axios'
import toast from 'react-hot-toast'

const sharingTypes = ['2', '3', '4', '6']
const sharingLabel = { '2': '2 Sharing', '3': '3 Sharing', '4': '4 Sharing', '6': '6 Sharing' }
const colors = { '2': 'bg-blue-100 text-blue-700', '3': 'bg-green-100 text-green-700', '4': 'bg-orange-100 text-orange-700', '6': 'bg-purple-100 text-purple-700' }

export default function Rooms() {
  const [rooms, setRooms] = useState([])
  const [configs, setConfigs] = useState([])
  const [showAdd, setShowAdd] = useState(false)
  const [showConfig, setShowConfig] = useState(false)
  const [form, setForm] = useState({ room_number: '', sharing_type: '2', base_rent: '', total_beds: '' })
  const [rentForm, setRentForm] = useState({ sharing_type: '2', rent_amount: '', effective_date: new Date().toISOString().split('T')[0] })

  const load = () => {
    api.get('/rooms/').then(r => setRooms(r.data)).catch(() => {})
    api.get('/rooms/rent-configuration').then(r => setConfigs(r.data)).catch(() => {})
  }

  useEffect(() => { load() }, [])

  const addRoom = async e => {
    e.preventDefault()
    try {
      await api.post('/rooms/', { ...form, base_rent: +form.base_rent, total_beds: +form.total_beds })
      toast.success('Room added!')
      setShowAdd(false)
      setForm({ room_number: '', sharing_type: '2', base_rent: '', total_beds: '' })
      load()
    } catch (err) { toast.error(err.response?.data?.detail || 'Failed') }
  }

  const deleteRoom = async id => {
    if (!confirm('Delete this room?')) return
    try {
      await api.delete(`/rooms/${id}`)
      toast.success('Room deleted')
      load()
    } catch (err) { toast.error(err.response?.data?.detail || 'Failed') }
  }

  const updateRent = async e => {
    e.preventDefault()
    try {
      const res = await api.patch(`/rooms/rent-configuration/${rentForm.sharing_type}`, {
        rent_amount: +rentForm.rent_amount,
        effective_date: rentForm.effective_date
      })
      toast.success(res.data.message)
      setShowConfig(false)
      load()
    } catch (err) { toast.error(err.response?.data?.detail || 'Failed') }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Rooms</h1>
          <p className="text-gray-500 text-sm">{rooms.length} rooms configured</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setShowConfig(true)}
            className="flex items-center gap-1 text-sm border border-indigo-300 text-indigo-700 px-3 py-2 rounded-lg hover:bg-indigo-50">
            <Settings size={14} /> Rent Config
          </button>
          <button onClick={() => setShowAdd(true)}
            className="flex items-center gap-1 text-sm bg-indigo-600 text-white px-3 py-2 rounded-lg hover:bg-indigo-700">
            <Plus size={14} /> Add Room
          </button>
        </div>
      </div>

      {/* Rooms grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {rooms.map(r => (
          <div key={r.room_id} className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <BedDouble size={18} className="text-indigo-500" />
                  <span className="font-semibold text-gray-800">Room {r.room_number}</span>
                </div>
                <span className={`text-xs px-2 py-1 rounded-full font-medium ${colors[r.sharing_type] || 'bg-gray-100 text-gray-600'}`}>
                  {sharingLabel[r.sharing_type] || r.sharing_type}
                </span>
              </div>
              <button onClick={() => deleteRoom(r.room_id)} className="text-red-400 hover:text-red-600"><Trash2 size={14} /></button>
            </div>
            <div className="mt-4 space-y-1 text-sm text-gray-600">
              <div className="flex justify-between"><span>Rent</span><span className="font-medium text-gray-800">₹{r.base_rent.toLocaleString('en-IN')}/mo</span></div>
              <div className="flex justify-between"><span>Beds</span><span>{r.occupied_beds}/{r.total_beds} occupied</span></div>
              <div className="flex justify-between"><span>Vacant</span><span className={`font-medium ${r.vacant_beds > 0 ? 'text-green-600' : 'text-red-500'}`}>{r.vacant_beds} beds</span></div>
            </div>
            {/* Occupancy bar */}
            <div className="mt-3 h-2 bg-gray-100 rounded-full overflow-hidden">
              <div className="h-full bg-indigo-500 rounded-full transition-all"
                style={{ width: `${r.total_beds > 0 ? (r.occupied_beds / r.total_beds) * 100 : 0}%` }} />
            </div>
          </div>
        ))}
        {rooms.length === 0 && (
          <div className="col-span-3 text-center py-16 text-gray-400">
            <BedDouble size={40} className="mx-auto mb-3 opacity-30" />
            <p>No rooms added yet.</p>
          </div>
        )}
      </div>

      {/* Add Room Modal */}
      {showAdd && (
        <Modal title="Add New Room" onClose={() => setShowAdd(false)}>
          <form onSubmit={addRoom} className="space-y-4">
            <Field label="Room Number" value={form.room_number} onChange={v => setForm({...form, room_number: v})} placeholder="101" />
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Sharing Type</label>
              <select value={form.sharing_type} onChange={e => setForm({...form, sharing_type: e.target.value, total_beds: e.target.value})}
                className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400">
                {sharingTypes.map(t => <option key={t} value={t}>{sharingLabel[t]}</option>)}
              </select>
            </div>
            <Field label="Base Rent (₹)" type="number" value={form.base_rent} onChange={v => setForm({...form, base_rent: v})} placeholder="5000" />
            <Field label="Total Beds" type="number" value={form.total_beds} onChange={v => setForm({...form, total_beds: v})} placeholder="4" />
            <button type="submit" className="w-full bg-indigo-600 text-white py-2.5 rounded-lg font-medium hover:bg-indigo-700">Add Room</button>
          </form>
        </Modal>
      )}

      {/* Rent Config Modal */}
      {showConfig && (
        <Modal title="Update Rent Configuration" onClose={() => setShowConfig(false)}>
          <div className="mb-4">
            <p className="text-sm text-gray-500 mb-3">Current configurations:</p>
            {configs.length === 0 ? <p className="text-gray-400 text-sm">No configs yet</p> : configs.map(c => (
              <div key={c.config_id} className="flex justify-between text-sm py-1 border-b border-gray-100">
                <span>{sharingLabel[c.sharing_type]}</span>
                <span className="font-medium">₹{c.rent_amount}/mo</span>
              </div>
            ))}
          </div>
          <form onSubmit={updateRent} className="space-y-4 border-t pt-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Sharing Type</label>
              <select value={rentForm.sharing_type} onChange={e => setRentForm({...rentForm, sharing_type: e.target.value})}
                className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400">
                {sharingTypes.map(t => <option key={t} value={t}>{sharingLabel[t]}</option>)}
              </select>
            </div>
            <Field label="New Rent Amount (₹)" type="number" value={rentForm.rent_amount} onChange={v => setRentForm({...rentForm, rent_amount: v})} placeholder="6500" />
            <Field label="Effective From" type="date" value={rentForm.effective_date} onChange={v => setRentForm({...rentForm, effective_date: v})} />
            <button type="submit" className="w-full bg-indigo-600 text-white py-2.5 rounded-lg font-medium hover:bg-indigo-700">Update Rent</button>
          </form>
        </Modal>
      )}
    </div>
  )
}

const Modal = ({ title, onClose, children }) => (
  <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
    <div className="bg-white rounded-2xl w-full max-w-md p-6 shadow-2xl">
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-lg font-semibold text-gray-800">{title}</h2>
        <button onClick={onClose}><X size={20} className="text-gray-400 hover:text-gray-700" /></button>
      </div>
      {children}
    </div>
  </div>
)

const Field = ({ label, value, onChange, type = 'text', placeholder }) => (
  <div>
    <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
    <input type={type} required value={value} placeholder={placeholder}
      onChange={e => onChange(e.target.value)}
      className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400" />
  </div>
)
