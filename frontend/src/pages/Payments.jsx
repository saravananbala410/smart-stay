import { useEffect, useState } from 'react'
import { Plus, X, Zap, Droplets } from 'lucide-react'
import api from '../api/axios'
import toast from 'react-hot-toast'

export default function Payments() {
  const [payments, setPayments]     = useState([])
  const [tenants, setTenants]       = useState([])
  const [rooms, setRooms]           = useState([])
  const [elecBills, setElecBills]   = useState([])
  const [addCharges, setAddCharges] = useState([])
  const [showAdd, setShowAdd]       = useState(false)
  const [showElec, setShowElec]     = useState(false)
  const [showAddCharge, setShowAddCharge] = useState(false)
  const [month, setMonth]           = useState(new Date().toISOString().slice(0, 7))

  const [form, setForm]       = useState({ tenant_id: '', amount_paid: '', month_year: new Date().toISOString().slice(0, 7), transaction_id: '', is_advance: false })
  const [elecForm, setElecForm]     = useState({ room_number: '', total_amount: '', month_year: new Date().toISOString().slice(0, 7) })
  const [chargeForm, setChargeForm] = useState({ charge_name: '', total_amount: '', month_year: new Date().toISOString().slice(0, 7) })

  const load = () => {
    api.get(`/payments/?month_year=${month}`).then(r => setPayments(r.data)).catch(() => {})
    api.get(`/charges/electricity?month_year=${month}`).then(r => setElecBills(r.data)).catch(() => {})
    api.get(`/charges/additional?month_year=${month}`).then(r => setAddCharges(r.data)).catch(() => {})
  }

  useEffect(() => { load() }, [month])
  useEffect(() => {
    api.get('/tenants/?status=Active').then(r => setTenants(r.data)).catch(() => {})
    api.get('/rooms/').then(r => setRooms(r.data)).catch(() => {})
  }, [])

  // FIX: Show selected tenant's balance before recording payment
  const selectedTenantPayment = form.tenant_id
    ? payments.find(p => p.tenant_id === +form.tenant_id)
    : null

  const record = async e => {
    e.preventDefault()
    try {
      const res = await api.post('/payments/', { ...form, tenant_id: +form.tenant_id, amount_paid: +form.amount_paid })
      toast.success(`✅ Payment recorded! Balance: ₹${res.data.balance}`)
      setShowAdd(false)
      load()
    } catch (err) { toast.error(err.response?.data?.detail || 'Failed') }
  }

  const submitElec = async e => {
    e.preventDefault()
    try {
      const res = await api.post('/charges/electricity', { ...elecForm, total_amount: +elecForm.total_amount })
      toast.success(`⚡ Room ${elecForm.room_number}: ₹${res.data.per_tenant}/tenant`)
      setShowElec(false)
      load()
    } catch (err) { toast.error(err.response?.data?.detail || 'Failed') }
  }

  const submitAddCharge = async e => {
    e.preventDefault()
    try {
      const res = await api.post('/charges/additional', { ...chargeForm, total_amount: +chargeForm.total_amount })
      toast.success(`✅ ${chargeForm.charge_name}: ₹${res.data.per_tenant}/tenant`)
      setShowAddCharge(false)
      load()
    } catch (err) { toast.error(err.response?.data?.detail || 'Failed') }
  }

  const generateBills = async () => {
    if (!confirm(`Generate bills for ${month}?`)) return
    try {
      const res = await api.post(`/payments/generate-monthly?month_year=${month}`)
      toast.success(res.data.message)
      load()
    } catch (err) { toast.error(err.response?.data?.detail || 'Failed') }
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Payments</h1>
          <p className="text-gray-500 text-sm">{payments.length} records for {month}</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <input type="month" value={month} onChange={e => setMonth(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400" />
          <button onClick={generateBills}
            className="text-sm border border-indigo-300 text-indigo-700 px-3 py-2 rounded-lg hover:bg-indigo-50">
            🔄 Generate Bills
          </button>
          <button onClick={() => setShowElec(true)}
            className="flex items-center gap-1 text-sm border border-yellow-300 text-yellow-700 px-3 py-2 rounded-lg hover:bg-yellow-50">
            <Zap size={13} /> Electricity
          </button>
          <button onClick={() => setShowAddCharge(true)}
            className="flex items-center gap-1 text-sm border border-blue-300 text-blue-700 px-3 py-2 rounded-lg hover:bg-blue-50">
            <Droplets size={13} /> Add Charge
          </button>
          <button onClick={() => setShowAdd(true)}
            className="flex items-center gap-1 text-sm bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700">
            <Plus size={14} /> Record Payment
          </button>
        </div>
      </div>

      {/* Electricity summary for this month */}
      {(elecBills.length > 0 || addCharges.length > 0) && (
        <div className="grid grid-cols-2 gap-3">
          {elecBills.length > 0 && (
            <div className="bg-yellow-50 border border-yellow-100 rounded-xl p-4">
              <p className="text-xs font-semibold text-yellow-700 mb-2 flex items-center gap-1"><Zap size={12}/>Electricity Bills — {month}</p>
              {elecBills.map(b => (
                <div key={b.bill_id} className="flex justify-between text-xs text-yellow-800 py-0.5">
                  <span>Room {b.room_number}</span>
                  <span>₹{b.total_amount} → ₹{b.per_tenant}/tenant</span>
                </div>
              ))}
            </div>
          )}
          {addCharges.length > 0 && (
            <div className="bg-blue-50 border border-blue-100 rounded-xl p-4">
              <p className="text-xs font-semibold text-blue-700 mb-2 flex items-center gap-1"><Droplets size={12}/>Additional Charges — {month}</p>
              {addCharges.map(c => (
                <div key={c.charge_id} className="flex justify-between text-xs text-blue-800 py-0.5">
                  <span>{c.charge_name}</span>
                  <span>₹{c.total_amount} → ₹{c.per_tenant}/tenant</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Payments Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        {payments.length === 0 ? (
          <div className="text-center py-16 text-gray-400">No payments for this month.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  {['Tenant', 'Rent', 'Electricity', 'Other', 'Arrears', 'Total Due', 'Paid', 'Balance', 'Date'].map(h => (
                    <th key={h} className="text-left px-4 py-3 text-gray-500 font-medium text-xs">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {payments.map(p => {
                  const balance = p.balance
                  return (
                    <tr key={p.payment_id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-medium text-gray-800">{p.tenant_name}</td>
                      <td className="px-4 py-3 text-gray-600">₹{p.due_amount}</td>
                      <td className="px-4 py-3 text-yellow-600">{p.electricity_amount > 0 ? `₹${p.electricity_amount}` : '—'}</td>
                      <td className="px-4 py-3 text-blue-600">{p.additional_amount > 0 ? `₹${p.additional_amount}` : '—'}</td>
                      <td className="px-4 py-3 text-orange-500">{p.arrears > 0 ? `₹${p.arrears}` : '—'}</td>
                      <td className="px-4 py-3 font-semibold text-gray-800">₹{p.total_due}</td>
                      <td className="px-4 py-3 text-green-600 font-medium">₹{p.amount_paid}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${balance === 0 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'}`}>
                          {balance === 0 ? '✓ Paid' : `₹${balance} due`}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-400 text-xs">{p.payment_date ? new Date(p.payment_date).toLocaleDateString('en-IN') : '—'}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Record Payment Modal */}
      {showAdd && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-md p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-semibold">Record Payment</h2>
              <button onClick={() => setShowAdd(false)}><X size={20} className="text-gray-400" /></button>
            </div>

            {selectedTenantPayment && (
              <div className="mb-4 p-3 bg-indigo-50 rounded-lg text-sm">
                <p className="font-medium text-indigo-800">{selectedTenantPayment.tenant_name} — {month}</p>
                <div className="mt-1 space-y-0.5 text-xs text-indigo-600">
                  <p>Rent: ₹{selectedTenantPayment.due_amount} + Elec: ₹{selectedTenantPayment.electricity_amount} + Other: ₹{selectedTenantPayment.additional_amount}</p>
                  {selectedTenantPayment.arrears > 0 && <p>Previous arrears: ₹{selectedTenantPayment.arrears}</p>}
                  <p className="font-semibold text-indigo-800">Balance due: ₹{selectedTenantPayment.balance}</p>
                </div>
              </div>
            )}

            <form onSubmit={record} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Tenant</label>
                <select required value={form.tenant_id} onChange={e => setForm({...form, tenant_id: e.target.value})}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400">
                  <option value="">Select tenant...</option>
                  {tenants.map(t => <option key={t.tenant_id} value={t.tenant_id}>{t.name} ({t.phone})</option>)}
                </select>
              </div>
              {[
                { label: 'Amount Paid (₹)', key: 'amount_paid', type: 'number', placeholder: '5000' },
                { label: 'Month', key: 'month_year', type: 'month' },
                { label: 'Transaction ID (optional)', key: 'transaction_id', placeholder: 'UPI/NEFT ref' },
              ].map(({ label, key, type = 'text', placeholder }) => (
                <div key={key}>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
                  <input type={type} required={key !== 'transaction_id'} placeholder={placeholder} value={form[key]}
                    onChange={e => setForm({...form, [key]: e.target.value})}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400" />
                </div>
              ))}
              <label className="flex items-center gap-2 text-sm text-gray-700">
                <input type="checkbox" checked={form.is_advance} onChange={e => setForm({...form, is_advance: e.target.checked})} />
                This is an advance payment
              </label>
              <button type="submit" className="w-full bg-indigo-600 text-white py-2.5 rounded-lg font-medium hover:bg-indigo-700">
                Record Payment
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Electricity Bill Modal */}
      {showElec && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-semibold flex items-center gap-2"><Zap size={16} className="text-yellow-500"/>Electricity Bill</h2>
              <button onClick={() => setShowElec(false)}><X size={20} className="text-gray-400" /></button>
            </div>
            <form onSubmit={submitElec} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Room Number</label>
                <select required value={elecForm.room_number} onChange={e => setElecForm({...elecForm, room_number: e.target.value})}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400">
                  <option value="">Select room...</option>
                  {rooms.map(r => <option key={r.room_id} value={r.room_number}>Room {r.room_number}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Total Bill (₹)</label>
                <input type="number" required placeholder="3000" value={elecForm.total_amount}
                  onChange={e => setElecForm({...elecForm, total_amount: e.target.value})}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Month</label>
                <input type="month" required value={elecForm.month_year}
                  onChange={e => setElecForm({...elecForm, month_year: e.target.value})}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400" />
              </div>
              <p className="text-xs text-gray-500">Amount will be split equally among active tenants in this room</p>
              <button type="submit" className="w-full bg-yellow-500 text-white py-2.5 rounded-lg font-medium hover:bg-yellow-600">
                Set Electricity Bill
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Additional Charge Modal */}
      {showAddCharge && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-semibold flex items-center gap-2"><Droplets size={16} className="text-blue-500"/>Add Charge</h2>
              <button onClick={() => setShowAddCharge(false)}><X size={20} className="text-gray-400" /></button>
            </div>
            <form onSubmit={submitAddCharge} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Charge Name</label>
                <input type="text" required placeholder="e.g. Water, Internet, Maintenance" value={chargeForm.charge_name}
                  onChange={e => setChargeForm({...chargeForm, charge_name: e.target.value})}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Total Amount (₹)</label>
                <input type="number" required placeholder="1000" value={chargeForm.total_amount}
                  onChange={e => setChargeForm({...chargeForm, total_amount: e.target.value})}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Month</label>
                <input type="month" required value={chargeForm.month_year}
                  onChange={e => setChargeForm({...chargeForm, month_year: e.target.value})}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400" />
              </div>
              <p className="text-xs text-gray-500">Amount will be split equally among ALL active tenants in the hostel</p>
              <button type="submit" className="w-full bg-blue-500 text-white py-2.5 rounded-lg font-medium hover:bg-blue-600">
                Add Charge
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
