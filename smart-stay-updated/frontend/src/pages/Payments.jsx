import { useEffect, useState } from 'react'
import { Plus, X, Zap, Droplets, Receipt, List, FileText, ChevronDown, ChevronUp, AlertCircle, CheckCircle2, Clock } from 'lucide-react'
import api from '../api/axios'
import toast from 'react-hot-toast'

const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'

function Modal({ title, onClose, children }) {
  return (
    <div className="modal-overlay">
      <div className="modal-box max-w-md p-0">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <h2 className="font-bold text-slate-900">{title}</h2>
          <button onClick={onClose} className="btn-icon"><X size={18}/></button>
        </div>
        <div className="px-6 py-5">{children}</div>
      </div>
    </div>
  )
}

function BalancePill({ balance }) {
  return balance === 0
    ? <span className="badge-green"><CheckCircle2 size={11}/> Cleared</span>
    : <span className="badge-red"><AlertCircle size={11}/> ₹{balance.toLocaleString('en-IN')} due</span>
}

function SummaryBar({ payments }) {
  const collected = payments.reduce((s, p) => s + p.amount_paid, 0)
  const pending   = payments.reduce((s, p) => s + p.balance, 0)
  const items = [
    { label: 'Collected',    value: collected, color: 'text-emerald-600', bg: 'bg-emerald-50' },
    { label: 'Outstanding',  value: pending,   color: 'text-rose-600',    bg: 'bg-rose-50'    },
    { label: 'Tenants',      value: payments.length, color: 'text-blue-700', bg: 'bg-blue-50', raw: true },
  ]
  return (
    <div className="grid grid-cols-3 gap-3">
      {items.map(i => (
        <div key={i.label} className={`${i.bg} rounded-2xl p-4`}>
          <p className="text-xs font-semibold text-slate-500 mb-1">{i.label}</p>
          <p className={`text-xl font-bold text-money ${i.color}`}>
            {i.raw ? i.value : `₹${i.value.toLocaleString('en-IN')}`}
          </p>
        </div>
      ))}
    </div>
  )
}

export default function Payments() {
  const [payments,     setPayments]     = useState([])
  const [transactions, setTxns]         = useState([])
  const [tenants,      setTenants]      = useState([])
  const [rooms,        setRooms]        = useState([])
  const [elecBills,    setElecBills]    = useState([])
  const [addCharges,   setAddCharges]   = useState([])
  const [month,        setMonth]        = useState(new Date().toISOString().slice(0, 7))
  const [tab,          setTab]          = useState('ledger')   // 'ledger' | 'txlog' | 'charges'
  const [showAdd,      setShowAdd]      = useState(false)
  const [showElec,     setShowElec]     = useState(false)
  const [showCharge,   setShowCharge]   = useState(false)
  const [expandedRow,  setExpandedRow]  = useState(null)

  const [payForm,    setPayForm]    = useState({ tenant_id: '', amount_paid: '', month_year: '', transaction_id: '', note: '', is_advance: false })
  const [elecForm,   setElecForm]   = useState({ room_number: '', total_amount: '', month_year: '' })
  const [chargeForm, setChargeForm] = useState({ charge_name: '', total_amount: '', month_year: '', room_number: '' })

  const load = () => {
    api.get(`/payments/?month_year=${month}`).then(r => setPayments(r.data)).catch(() => {})
    api.get(`/payments/transactions?month_year=${month}`).then(r => setTxns(r.data)).catch(() => {})
    api.get(`/charges/electricity?month_year=${month}`).then(r => setElecBills(r.data)).catch(() => {})
    api.get(`/charges/additional?month_year=${month}`).then(r => setAddCharges(r.data)).catch(() => {})
  }

  useEffect(() => { load() }, [month])
  useEffect(() => {
    api.get('/tenants/?status=Active').then(r => setTenants(r.data)).catch(() => {})
    api.get('/rooms/').then(r => setRooms(r.data)).catch(() => {})
  }, [])

  // Auto-fill month when modal opens
  const openPayModal   = () => { setPayForm(f => ({...f, month_year: month})); setShowAdd(true) }
  const openElecModal  = () => { setElecForm(f => ({...f, month_year: month})); setShowElec(true) }
  const openChargeModal= () => { setChargeForm(f => ({...f, month_year: month})); setShowCharge(true) }

  const selectedBalance = payForm.tenant_id
    ? payments.find(p => p.tenant_id === +payForm.tenant_id)?.balance
    : null

  const recordPayment = async e => {
    e.preventDefault()
    try {
      const res = await api.post('/payments/', { ...payForm, tenant_id: +payForm.tenant_id, amount_paid: +payForm.amount_paid })
      toast.success(`Payment saved — ₹${res.data.balance} remaining`)
      setShowAdd(false); load()
    } catch (err) { toast.error(err.response?.data?.detail || 'Failed to save') }
  }

  const submitElec = async e => {
    e.preventDefault()
    try {
      const res = await api.post('/charges/electricity', { ...elecForm, total_amount: +elecForm.total_amount })
      toast.success(`Room ${elecForm.room_number}: ₹${res.data.per_tenant} per tenant`)
      setShowElec(false); load()
    } catch (err) { toast.error(err.response?.data?.detail || 'Failed') }
  }

  const submitCharge = async e => {
    e.preventDefault()
    try {
      const payload = { ...chargeForm, total_amount: +chargeForm.total_amount }
      if (!payload.room_number) delete payload.room_number
      const res = await api.post('/charges/additional', payload)
      toast.success(`${chargeForm.charge_name}: ₹${res.data.per_tenant} per tenant`)
      setShowCharge(false); load()
    } catch (err) { toast.error(err.response?.data?.detail || 'Failed') }
  }

  const generateBills = async () => {
    if (!confirm(`Generate bills for all active tenants — ${month}?`)) return
    try {
      const res = await api.post(`/payments/generate-monthly?month_year=${month}`)
      toast.success(res.data.message); load()
    } catch (err) { toast.error(err.response?.data?.detail || 'Failed') }
  }

  const openInvoice = async (p) => {
    try {
      const { data } = await api.get(`/invoice/token/${p.tenant_id}`)
      window.open(`${BASE_URL}/api/invoice/view/${data.hostel_id}/${p.tenant_id}/${p.month_year}?token=${data.token}`, '_blank')
    } catch { toast.error('Could not open invoice') }
  }

  const TABS = [
    { key: 'ledger',  icon: FileText, label: 'Monthly Ledger'  },
    { key: 'txlog',   icon: Clock,    label: 'Transaction Log' },
    { key: 'charges', icon: Zap,      label: 'Charges'         },
  ]

  return (
    <div className="space-y-5 max-w-5xl">

      {/* Header */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Payments</h1>
          <p className="text-slate-400 text-sm mt-0.5">Rent collection & billing</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <input type="month" value={month} onChange={e => setMonth(e.target.value)}
            className="input !w-auto text-sm font-semibold" />
          <button onClick={generateBills} className="btn-ghost btn-sm">Generate Bills</button>
          <button onClick={openElecModal}  className="btn-amber btn-sm"><Zap size={13}/> Electricity</button>
          <button onClick={openChargeModal} className="btn-ghost btn-sm border border-slate-200"><Droplets size={13}/> Add Charge</button>
          <button onClick={openPayModal}   className="btn-primary btn-sm"><Plus size={13}/> Record Payment</button>
        </div>
      </div>

      {/* Summary cards */}
      <SummaryBar payments={payments} />

      {/* Tabs */}
      <div className="flex border-b border-slate-200 gap-0">
        {TABS.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-semibold border-b-2 transition-colors ${
              tab === t.key
                ? 'border-blue-600 text-blue-700'
                : 'border-transparent text-slate-400 hover:text-slate-700'
            }`}>
            <t.icon size={14}/>{t.label}
            {t.key === 'ledger'  && payments.length > 0   && <span className="ml-1 bg-slate-100 text-slate-500 text-xs font-bold px-1.5 py-0.5 rounded-full">{payments.length}</span>}
            {t.key === 'txlog'   && transactions.length > 0 && <span className="ml-1 bg-blue-100 text-blue-600 text-xs font-bold px-1.5 py-0.5 rounded-full">{transactions.length}</span>}
            {t.key === 'charges' && (elecBills.length + addCharges.length) > 0 && <span className="ml-1 bg-amber-100 text-amber-600 text-xs font-bold px-1.5 py-0.5 rounded-full">{elecBills.length + addCharges.length}</span>}
          </button>
        ))}
      </div>

      {/* ── TAB: MONTHLY LEDGER ── */}
      {tab === 'ledger' && (
        <div className="card overflow-hidden">
          {payments.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-slate-300">
              <FileText size={40} strokeWidth={1}/>
              <p className="mt-3 text-sm font-medium text-slate-400">No bills for {month}.</p>
              <p className="text-xs text-slate-300 mt-1">Click "Generate Bills" to create entries for all active tenants.</p>
            </div>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Tenant</th>
                  <th className="text-right">Rent</th>
                  <th className="text-right">Elec</th>
                  <th className="text-right">Other</th>
                  <th className="text-right">Total Due</th>
                  <th className="text-right">Paid</th>
                  <th>Status</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {payments.map(p => (
                  <>
                    <tr key={p.payment_id}
                      className="cursor-pointer"
                      onClick={() => setExpandedRow(expandedRow === p.payment_id ? null : p.payment_id)}>
                      <td>
                        <span className="font-semibold text-slate-800">{p.tenant_name}</span>
                        {p.arrears > 0 && <span className="ml-2 badge-amber text-[10px]">+₹{p.arrears} arrears</span>}
                      </td>
                      <td className="text-right text-money text-slate-700">₹{p.due_amount.toLocaleString('en-IN')}</td>
                      <td className="text-right text-money text-amber-600">
                        {p.electricity_amount > 0 ? `₹${p.electricity_amount.toLocaleString('en-IN')}` : <span className="text-slate-300">—</span>}
                      </td>
                      <td className="text-right text-money text-violet-600">
                        {p.additional_amount > 0 ? `₹${p.additional_amount.toLocaleString('en-IN')}` : <span className="text-slate-300">—</span>}
                      </td>
                      <td className="text-right text-money font-semibold text-slate-900">₹{(p.total_due + (p.arrears||0)).toLocaleString('en-IN')}</td>
                      <td className="text-right text-money text-emerald-600 font-semibold">₹{p.amount_paid.toLocaleString('en-IN')}</td>
                      <td><BalancePill balance={p.balance}/></td>
                      <td>
                        <div className="flex items-center gap-1">
                          <button onClick={e => { e.stopPropagation(); openInvoice(p) }}
                            title="Open invoice" className="btn-icon btn-sm text-blue-400 hover:text-blue-700">
                            <Receipt size={14}/>
                          </button>
                          {expandedRow === p.payment_id
                            ? <ChevronUp size={14} className="text-slate-300"/>
                            : <ChevronDown size={14} className="text-slate-300"/>}
                        </div>
                      </td>
                    </tr>
                    {expandedRow === p.payment_id && (
                      <tr key={`${p.payment_id}-exp`} className="!bg-slate-50/80">
                        <td colSpan={8} className="px-5 py-4">
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                            {[
                              { label: 'Base Rent',    val: `₹${p.due_amount}`,         c: 'text-slate-700' },
                              { label: 'Electricity',  val: `₹${p.electricity_amount}`,  c: 'text-amber-600' },
                              { label: 'Other Charges',val: `₹${p.additional_amount}`,   c: 'text-violet-600' },
                              { label: 'Arrears',      val: `₹${p.arrears||0}`,          c: 'text-orange-500' },
                              { label: 'Amount Paid',  val: `₹${p.amount_paid}`,         c: 'text-emerald-600' },
                              { label: 'Balance Left', val: `₹${p.balance}`,             c: p.balance > 0 ? 'text-rose-600' : 'text-emerald-600' },
                              { label: 'Payment Date', val: p.payment_date ? new Date(p.payment_date).toLocaleDateString('en-IN') : 'Not yet', c: 'text-slate-500' },
                              { label: 'Ref',          val: p.transaction_id || '—',     c: 'text-slate-400' },
                            ].map(row => (
                              <div key={row.label} className="bg-white rounded-lg p-3 border border-slate-100">
                                <p className="text-slate-400 font-medium mb-0.5">{row.label}</p>
                                <p className={`font-bold text-sm text-money ${row.c}`}>{row.val}</p>
                              </div>
                            ))}
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-slate-50 font-bold text-sm">
                  <td className="px-4 py-3 text-slate-500">TOTAL — {payments.length} tenants</td>
                  <td className="px-4 py-3 text-right text-money">{/* rent sum */}</td>
                  <td colSpan={2}></td>
                  <td className="px-4 py-3 text-right text-money text-slate-900">
                    ₹{payments.reduce((s,p) => s + p.total_due + (p.arrears||0), 0).toLocaleString('en-IN')}
                  </td>
                  <td className="px-4 py-3 text-right text-money text-emerald-700">
                    ₹{payments.reduce((s,p) => s + p.amount_paid, 0).toLocaleString('en-IN')}
                  </td>
                  <td className="px-4 py-3">
                    <span className="badge-red">
                      ₹{payments.reduce((s,p) => s + p.balance, 0).toLocaleString('en-IN')} outstanding
                    </span>
                  </td>
                  <td></td>
                </tr>
              </tfoot>
            </table>
          )}
        </div>
      )}

      {/* ── TAB: TRANSACTION LOG ── */}
      {tab === 'txlog' && (
        <div className="card overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
            <div>
              <p className="font-bold text-slate-900 text-sm">Every individual payment entry</p>
              <p className="text-xs text-slate-400 mt-0.5">Each row = one cash transaction with exact timestamp</p>
            </div>
          </div>
          {transactions.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-slate-300">
              <Clock size={40} strokeWidth={1}/>
              <p className="mt-3 text-sm text-slate-400">No transactions for {month}.</p>
            </div>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Tenant</th>
                  <th className="text-right">Amount</th>
                  <th>Month</th>
                  <th>Date & Time</th>
                  <th>Reference / Note</th>
                </tr>
              </thead>
              <tbody>
                {transactions.map((t, i) => (
                  <tr key={t.txn_id}>
                    <td className="text-slate-300 text-xs font-mono">#{t.txn_id}</td>
                    <td className="font-semibold text-slate-800">{t.tenant_name}</td>
                    <td className="text-right text-money font-bold text-emerald-600">
                      ₹{t.amount?.toLocaleString('en-IN')}
                    </td>
                    <td><span className="badge-blue">{t.month_year}</span></td>
                    <td className="text-slate-500 text-xs">
                      {t.paid_at
                        ? new Date(t.paid_at).toLocaleString('en-IN', { day:'2-digit', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit' })
                        : '—'}
                    </td>
                    <td className="text-slate-400 text-xs">{t.transaction_id || t.note || <span className="text-slate-200">—</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* ── TAB: CHARGES ── */}
      {tab === 'charges' && (
        <div className="space-y-4">
          {/* Electricity */}
          <div className="card overflow-hidden">
            <div className="px-5 py-3.5 border-b border-slate-100 flex items-center gap-2">
              <div className="p-1.5 bg-amber-100 rounded-lg"><Zap size={14} className="text-amber-600"/></div>
              <p className="font-bold text-slate-900 text-sm">Electricity Bills — {month}</p>
            </div>
            {elecBills.length === 0 ? (
              <div className="py-10 text-center text-slate-300 text-sm">
                No electricity bills for {month}.
                <button onClick={openElecModal} className="block mx-auto mt-2 btn-amber btn-sm">Add electricity bill</button>
              </div>
            ) : (
              <table className="data-table">
                <thead><tr>
                  <th>Room</th><th className="text-right">Total Bill</th>
                  <th className="text-right">No. of Tenants</th><th className="text-right">Per Tenant</th>
                </tr></thead>
                <tbody>
                  {elecBills.map(b => (
                    <tr key={b.bill_id}>
                      <td className="font-semibold">Room {b.room_number}</td>
                      <td className="text-right text-money">₹{b.total_amount.toLocaleString('en-IN')}</td>
                      <td className="text-right text-slate-500">{Math.round(b.total_amount / b.per_tenant)}</td>
                      <td className="text-right text-money font-bold text-amber-600">₹{b.per_tenant.toLocaleString('en-IN')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* Additional charges */}
          <div className="card overflow-hidden">
            <div className="px-5 py-3.5 border-b border-slate-100 flex items-center gap-2">
              <div className="p-1.5 bg-violet-100 rounded-lg"><Droplets size={14} className="text-violet-600"/></div>
              <p className="font-bold text-slate-900 text-sm">Custom Charges — {month}</p>
            </div>
            {addCharges.length === 0 ? (
              <div className="py-10 text-center text-slate-300 text-sm">
                No custom charges for {month}.
                <button onClick={openChargeModal} className="block mx-auto mt-2 btn-ghost btn-sm border border-slate-200">Add custom charge</button>
              </div>
            ) : (
              <table className="data-table">
                <thead><tr>
                  <th>Charge</th><th>Scope</th>
                  <th className="text-right">Total</th><th className="text-right">Per Tenant</th>
                </tr></thead>
                <tbody>
                  {addCharges.map(c => (
                    <tr key={c.charge_id}>
                      <td className="font-semibold">{c.charge_name}</td>
                      <td><span className="badge-slate">{c.scope || 'Hostel-wide'}</span></td>
                      <td className="text-right text-money">₹{c.total_amount.toLocaleString('en-IN')}</td>
                      <td className="text-right text-money font-bold text-violet-600">₹{c.per_tenant.toLocaleString('en-IN')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* ─── MODALS ─── */}

      {showAdd && (
        <Modal title="Record Payment" onClose={() => setShowAdd(false)}>
          <form onSubmit={recordPayment} className="space-y-4">
            <div>
              <label className="label">Tenant</label>
              <select required value={payForm.tenant_id}
                onChange={e => setPayForm({...payForm, tenant_id: e.target.value})} className="input">
                <option value="">Select tenant…</option>
                {tenants.map(t => <option key={t.tenant_id} value={t.tenant_id}>{t.name} — Room {t.room?.room_number || '?'}</option>)}
              </select>
            </div>
            {selectedBalance !== null && (
              <div className={`flex items-center gap-2 px-4 py-3 rounded-xl text-sm font-semibold ${selectedBalance === 0 ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'}`}>
                {selectedBalance === 0
                  ? <><CheckCircle2 size={16}/> This tenant has no outstanding balance.</>
                  : <><AlertCircle size={16}/> Outstanding: ₹{selectedBalance.toLocaleString('en-IN')}</>}
              </div>
            )}
            <div>
              <label className="label">Billing Month</label>
              <input type="month" required value={payForm.month_year}
                onChange={e => setPayForm({...payForm, month_year: e.target.value})} className="input"/>
            </div>
            <div>
              <label className="label">Amount Received (₹)</label>
              <input type="number" min="1" required placeholder="7000"
                value={payForm.amount_paid}
                onChange={e => setPayForm({...payForm, amount_paid: e.target.value})} className="input"/>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Transaction / UPI Ref</label>
                <input type="text" placeholder="UPI ref / cash" value={payForm.transaction_id}
                  onChange={e => setPayForm({...payForm, transaction_id: e.target.value})} className="input"/>
              </div>
              <div>
                <label className="label">Note (optional)</label>
                <input type="text" placeholder="e.g. Partial" value={payForm.note}
                  onChange={e => setPayForm({...payForm, note: e.target.value})} className="input"/>
              </div>
            </div>
            <button type="submit" className="btn-primary w-full justify-center py-2.5">Save Payment</button>
          </form>
        </Modal>
      )}

      {showElec && (
        <Modal title="Set Electricity Bill" onClose={() => setShowElec(false)}>
          <form onSubmit={submitElec} className="space-y-4">
            <p className="text-sm text-slate-500">Enter the total electricity bill for a room. It will be split equally among all active tenants in that room.</p>
            <div>
              <label className="label">Room</label>
              <select required value={elecForm.room_number}
                onChange={e => setElecForm({...elecForm, room_number: e.target.value})} className="input">
                <option value="">Select room…</option>
                {rooms.map(r => <option key={r.room_id} value={r.room_number}>Room {r.room_number} ({r.occupied_beds} active tenants)</option>)}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Total Bill (₹)</label>
                <input type="number" min="1" required placeholder="3000"
                  value={elecForm.total_amount}
                  onChange={e => setElecForm({...elecForm, total_amount: e.target.value})} className="input"/>
              </div>
              <div>
                <label className="label">Month</label>
                <input type="month" required value={elecForm.month_year}
                  onChange={e => setElecForm({...elecForm, month_year: e.target.value})} className="input"/>
              </div>
            </div>
            <button type="submit" className="btn-amber w-full justify-center py-2.5"><Zap size={15}/> Set Bill & Split</button>
          </form>
        </Modal>
      )}

      {showCharge && (
        <Modal title="Add Custom Charge" onClose={() => setShowCharge(false)}>
          <form onSubmit={submitCharge} className="space-y-4">
            <p className="text-sm text-slate-500">Create a custom expense (Water, Wi-Fi, Maintenance…) and split it across tenants.</p>
            <div>
              <label className="label">Charge Name</label>
              <input type="text" required placeholder="Water charges, Wi-Fi, Maintenance…"
                value={chargeForm.charge_name}
                onChange={e => setChargeForm({...chargeForm, charge_name: e.target.value})} className="input"/>
            </div>
            <div>
              <label className="label">Split across</label>
              <select value={chargeForm.room_number}
                onChange={e => setChargeForm({...chargeForm, room_number: e.target.value})} className="input">
                <option value="">All tenants in the hostel</option>
                {rooms.map(r => <option key={r.room_id} value={r.room_number}>Room {r.room_number} only</option>)}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Total Amount (₹)</label>
                <input type="number" min="1" required placeholder="500"
                  value={chargeForm.total_amount}
                  onChange={e => setChargeForm({...chargeForm, total_amount: e.target.value})} className="input"/>
              </div>
              <div>
                <label className="label">Month</label>
                <input type="month" required value={chargeForm.month_year}
                  onChange={e => setChargeForm({...chargeForm, month_year: e.target.value})} className="input"/>
              </div>
            </div>
            <button type="submit" className="btn-primary w-full justify-center py-2.5">Add & Split Charge</button>
          </form>
        </Modal>
      )}
    </div>
  )
}
