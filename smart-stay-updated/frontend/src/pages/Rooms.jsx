import { useEffect, useMemo, useState } from 'react'
import { Plus, BedDouble, Settings, Trash2, X, IndianRupee, DoorOpen, UsersRound } from 'lucide-react'
import api from '../api/axios'
import toast from 'react-hot-toast'

const sharingTypes = ['2', '3', '4', '6']
const sharingLabel = { '2': '2 sharing', '3': '3 sharing', '4': '4 sharing', '6': '6 sharing' }
const colors = {
  '2': 'bg-indigo-50 text-indigo-700 ring-indigo-200/70',
  '3': 'bg-cyan-50 text-cyan-700 ring-cyan-200/70',
  '4': 'bg-violet-50 text-violet-700 ring-violet-200/70',
  '6': 'bg-amber-50 text-amber-700 ring-amber-200/70',
}

export default function Rooms() {
  const [rooms, setRooms] = useState([])
  const [configs, setConfigs] = useState([])
  const [showAdd, setShowAdd] = useState(false)
  const [showConfig, setShowConfig] = useState(false)
  const [form, setForm] = useState({ room_number: '', sharing_type: '2', base_rent: '', total_beds: '' })
  const [rentForm, setRentForm] = useState({ sharing_type: '2', rent_amount: '', effective_date: new Date().toISOString().split('T')[0] })

  const load = () => {
    api.get('/rooms/').then(response => setRooms(response.data)).catch(() => {})
    api.get('/rooms/rent-configuration').then(response => setConfigs(response.data)).catch(() => {})
  }
  useEffect(() => { load() }, [])

  const totals = useMemo(() => rooms.reduce((result, room) => ({
    beds: result.beds + Number(room.total_beds || 0),
    occupied: result.occupied + Number(room.occupied_beds || 0),
    vacant: result.vacant + Number(room.vacant_beds || 0),
  }), { beds: 0, occupied: 0, vacant: 0 }), [rooms])

  const addRoom = async event => {
    event.preventDefault()
    try {
      await api.post('/rooms/', { ...form, base_rent: +form.base_rent, total_beds: +form.total_beds })
      toast.success('Room added')
      setShowAdd(false)
      setForm({ room_number: '', sharing_type: '2', base_rent: '', total_beds: '' })
      load()
    } catch (error) { toast.error(error.response?.data?.detail || 'Could not add room') }
  }

  const deleteRoom = async id => {
    if (!confirm('Delete this room?')) return
    try { await api.delete(`/rooms/${id}`); toast.success('Room deleted'); load() }
    catch (error) { toast.error(error.response?.data?.detail || 'Could not delete room') }
  }

  const updateRent = async event => {
    event.preventDefault()
    try {
      const response = await api.patch(`/rooms/rent-configuration/${rentForm.sharing_type}`, { rent_amount: +rentForm.rent_amount, effective_date: rentForm.effective_date })
      toast.success(response.data.message)
      setShowConfig(false)
      load()
    } catch (error) { toast.error(error.response?.data?.detail || 'Could not update rent') }
  }

  return (
    <div className="page-shell">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div><p className="mb-2 text-[10px] font-extrabold uppercase tracking-[0.16em] text-indigo-500">Inventory</p><h1 className="page-title">Rooms & beds</h1><p className="page-subtitle">See availability, occupancy and rent at a glance.</p></div>
        <div className="grid grid-cols-2 gap-2 sm:flex">
          <button onClick={() => setShowConfig(true)} className="btn-ghost btn-sm border border-slate-200 bg-white"><Settings size={15}/>Rent setup</button>
          <button onClick={() => setShowAdd(true)} className="btn-primary btn-sm"><Plus size={15}/>Add room</button>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2 sm:gap-3">
        {[
          { label: 'Total beds', value: totals.beds, icon: BedDouble, color: 'text-indigo-600', bg: 'bg-indigo-50' },
          { label: 'Occupied', value: totals.occupied, icon: UsersRound, color: 'text-violet-600', bg: 'bg-violet-50' },
          { label: 'Available', value: totals.vacant, icon: DoorOpen, color: 'text-emerald-600', bg: 'bg-emerald-50' },
        ].map(({ label, value, icon: Icon, color, bg }) => <div key={label} className="card flex min-w-0 items-center gap-2.5 p-3 sm:gap-4 sm:p-4"><div className={`hidden h-10 w-10 flex-shrink-0 place-items-center rounded-xl sm:grid ${bg} ${color}`}><Icon size={18}/></div><div className="min-w-0"><p className="truncate text-[9px] font-extrabold uppercase tracking-[0.09em] text-slate-400 sm:text-[10px]">{label}</p><p className="mt-0.5 text-xl font-black tracking-tight text-slate-950 sm:text-2xl">{value}</p></div></div>)}
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {rooms.map(room => {
          const occupancy = room.total_beds > 0 ? Math.round((room.occupied_beds / room.total_beds) * 100) : 0
          return (
            <article key={room.room_id} className="card card-hover group relative overflow-hidden p-5">
              <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-indigo-500 via-violet-500 to-cyan-400"/>
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3"><div className="grid h-11 w-11 place-items-center rounded-2xl bg-slate-950 text-indigo-300 shadow-sm"><BedDouble size={20}/></div><div><p className="text-[10px] font-bold uppercase tracking-[0.1em] text-slate-400">Room</p><h2 className="text-lg font-black tracking-tight text-slate-950">{room.room_number}</h2></div></div>
                <button onClick={() => deleteRoom(room.room_id)} aria-label={`Delete room ${room.room_number}`} className="btn-icon min-h-9 min-w-9 text-slate-300 hover:bg-rose-50 hover:text-rose-500"><Trash2 size={15}/></button>
              </div>

              <div className="mt-5 flex items-center justify-between"><span className={`badge ring-1 ring-inset ${colors[room.sharing_type] || 'bg-slate-100 text-slate-600 ring-slate-200'}`}>{sharingLabel[room.sharing_type] || room.sharing_type}</span><p className="flex items-center gap-1 text-sm font-extrabold text-slate-900"><IndianRupee size={14}/>{Number(room.base_rent || 0).toLocaleString('en-IN')}<span className="text-[10px] font-medium text-slate-400">/mo</span></p></div>

              <div className="mt-5 rounded-2xl bg-slate-50 p-3.5 ring-1 ring-inset ring-slate-100">
                <div className="flex items-center justify-between text-xs"><span className="font-semibold text-slate-500">Occupancy</span><span className="font-extrabold text-slate-800">{room.occupied_beds} of {room.total_beds} beds</span></div>
                <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-200"><div className={`h-full rounded-full transition-all ${occupancy >= 100 ? 'bg-rose-500' : 'bg-gradient-to-r from-indigo-500 to-violet-500'}`} style={{ width: `${occupancy}%` }}/></div>
                <div className="mt-2 flex items-center justify-between text-[10px]"><span className="font-bold text-slate-400">{occupancy}% occupied</span><span className={`font-extrabold ${room.vacant_beds > 0 ? 'text-emerald-600' : 'text-rose-500'}`}>{room.vacant_beds > 0 ? `${room.vacant_beds} available` : 'Fully occupied'}</span></div>
              </div>
            </article>
          )
        })}
        {rooms.length === 0 && <div className="card col-span-full flex flex-col items-center justify-center px-5 py-16 text-center"><div className="grid h-16 w-16 place-items-center rounded-3xl bg-indigo-50 text-indigo-500"><BedDouble size={28}/></div><h2 className="mt-4 font-extrabold text-slate-900">No rooms yet</h2><p className="mt-1 text-sm text-slate-500">Add your first room to start tracking beds and rent.</p><button onClick={() => setShowAdd(true)} className="btn-primary btn-sm mt-5"><Plus size={15}/>Add first room</button></div>}
      </div>

      {showAdd && <Modal title="Add a new room" description="Set the room capacity and monthly base rent." onClose={() => setShowAdd(false)}><form onSubmit={addRoom} className="space-y-4"><Field label="Room number" value={form.room_number} onChange={value => setForm({ ...form, room_number: value })} placeholder="101"/><div><label className="label">Sharing type</label><select value={form.sharing_type} onChange={event => setForm({ ...form, sharing_type: event.target.value, total_beds: event.target.value })} className="input">{sharingTypes.map(type => <option key={type} value={type}>{sharingLabel[type]}</option>)}</select></div><div className="grid grid-cols-1 gap-3 sm:grid-cols-2"><Field label="Base rent (₹)" type="number" value={form.base_rent} onChange={value => setForm({ ...form, base_rent: value })} placeholder="5000"/><Field label="Total beds" type="number" value={form.total_beds} onChange={value => setForm({ ...form, total_beds: value })} placeholder="4"/></div><button type="submit" className="btn-primary w-full">Add room</button></form></Modal>}

      {showConfig && <Modal title="Rent configuration" description="New rent applies from the effective date you choose." onClose={() => setShowConfig(false)}><div className="mb-5 rounded-2xl bg-slate-50 p-4 ring-1 ring-inset ring-slate-100"><p className="section-eyebrow">Current monthly rent</p>{configs.length === 0 ? <p className="text-sm text-slate-400">No configurations yet</p> : configs.map(config => <div key={config.config_id} className="flex justify-between border-b border-slate-200/70 py-2 text-sm last:border-0"><span className="font-semibold text-slate-600">{sharingLabel[config.sharing_type]}</span><span className="font-extrabold text-slate-900">₹{Number(config.rent_amount).toLocaleString('en-IN')}</span></div>)}</div><form onSubmit={updateRent} className="space-y-4"><div><label className="label">Sharing type</label><select value={rentForm.sharing_type} onChange={event => setRentForm({ ...rentForm, sharing_type: event.target.value })} className="input">{sharingTypes.map(type => <option key={type} value={type}>{sharingLabel[type]}</option>)}</select></div><Field label="New rent amount (₹)" type="number" value={rentForm.rent_amount} onChange={value => setRentForm({ ...rentForm, rent_amount: value })} placeholder="6500"/><Field label="Effective from" type="date" value={rentForm.effective_date} onChange={value => setRentForm({ ...rentForm, effective_date: value })}/><button type="submit" className="btn-primary w-full">Update rent</button></form></Modal>}
    </div>
  )
}

const Modal = ({ title, description, onClose, children }) => <div className="modal-overlay"><div className="modal-box max-w-md p-5 sm:p-6"><div className="mb-5 flex items-start justify-between gap-3"><div><h2 className="text-lg font-black tracking-tight text-slate-950">{title}</h2><p className="mt-1 text-xs leading-5 text-slate-500">{description}</p></div><button onClick={onClose} className="btn-icon"><X size={19}/></button></div>{children}</div></div>

const Field = ({ label, value, onChange, type = 'text', placeholder }) => <div><label className="label">{label}</label><input type={type} required value={value} placeholder={placeholder} onChange={event => onChange(event.target.value)} className="input"/></div>
