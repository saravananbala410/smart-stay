import { Fragment, useEffect, useState } from 'react'
import { Plus, X, Zap, Droplets, Receipt, FileText, ChevronDown, ChevronUp, AlertCircle, CheckCircle2, Clock, QrCode, Send, ShieldCheck, Download, Copy, ExternalLink, CircleX } from 'lucide-react'
import api, { API_ORIGIN, apiAssetUrl, openExternal } from '../api/axios'
import toast from 'react-hot-toast'

function Modal({ title, onClose, children }) {
  return (
    <div className="modal-overlay">
      <div className="modal-box max-w-md p-0">
        <div className="flex items-center justify-between px-4 py-4 sm:px-6 border-b border-slate-100">
          <h2 className="font-bold text-slate-900">{title}</h2>
          <button onClick={onClose} className="btn-icon"><X size={18}/></button>
        </div>
        <div className="px-4 py-5 sm:px-6">{children}</div>
      </div>
    </div>
  )
}

const fmt = value => Number(value || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

function BalancePill({ balance, credit = 0, carried = 0 }) {
  if (carried > 0) return <span className="badge-slate"><Clock size={11}/> ₹{fmt(carried)} moved to next month</span>
  if (credit > 0) return <span className="badge-blue"><CheckCircle2 size={11}/> ₹{fmt(credit)} credit</span>
  return balance === 0
    ? <span className="badge-green"><CheckCircle2 size={11}/> Paid</span>
    : <span className="badge-red"><AlertCircle size={11}/> ₹{fmt(balance)} left</span>
}

function SummaryBar({ payments }) {
  const collected = payments.reduce((s, p) => s + p.amount_paid, 0)
  const pending   = payments.reduce((s, p) => s + p.balance, 0)
  const payable   = payments.reduce((s, p) => s + p.payable, 0)
  const items = [
    { label: 'Total payable', value: payable,   color: 'text-slate-900',   bg: 'bg-white border border-slate-200' },
    { label: 'Money received', value: collected, color: 'text-emerald-700', bg: 'bg-emerald-50' },
    { label: 'Still remaining', value: pending, color: 'text-rose-600', bg: 'bg-rose-50' },
    { label: 'Tenant bills', value: payments.length, color: 'text-blue-800', bg: 'bg-blue-50', raw: true },
  ]
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      {items.map(i => (
        <div key={i.label} className={`${i.bg} rounded-2xl p-4`}>
          <p className="text-xs font-semibold text-slate-500 mb-1">{i.label}</p>
          <p className={`text-xl font-bold text-money ${i.color}`}>
            {i.raw ? i.value : `₹${fmt(i.value)}`}
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
  const [requests,     setRequests]     = useState([])
  const [month,        setMonth]        = useState(new Date().toISOString().slice(0, 7))
  const [tab,          setTab]          = useState('ledger')   // 'ledger' | 'txlog' | 'charges'
  const [showAdd,      setShowAdd]      = useState(false)
  const [showElec,     setShowElec]     = useState(false)
  const [showCharge,   setShowCharge]   = useState(false)
  const [expandedRow,  setExpandedRow]  = useState(null)
  const [activeRequest,setActiveRequest]= useState(null)
  const [reminderBatch,setReminderBatch]= useState(null)

  const [payForm,    setPayForm]    = useState({ tenant_id: '', amount_paid: '', month_year: '', transaction_id: '', note: '', is_advance: false })
  const [elecForm,   setElecForm]   = useState({ room_number: '', total_amount: '', month_year: '' })
  const [chargeForm, setChargeForm] = useState({ charge_name: '', total_amount: '', month_year: '', room_number: '' })

  const load = () => {
    api.get(`/payments/?month_year=${month}`).then(r => setPayments(r.data)).catch(() => {})
    api.get(`/payments/transactions?month_year=${month}`).then(r => setTxns(r.data)).catch(() => {})
    api.get(`/charges/electricity?month_year=${month}`).then(r => setElecBills(r.data)).catch(() => {})
    api.get(`/charges/additional?month_year=${month}`).then(r => setAddCharges(r.data)).catch(() => {})
    api.get(`/payments/payment-requests?month_year=${month}`).then(r => setRequests(r.data)).catch(() => {})
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
      toast.success(res.data.balance > 0 ? `Saved · ₹${fmt(res.data.balance)} remaining` : 'Payment complete · receipt is ready')
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
      const { data } = await api.get(`/invoice/token/${p.tenant_id}?month_year=${p.month_year}`)
      openExternal(`${API_ORIGIN}/api/invoice/view/${data.hostel_id}/${p.tenant_id}/${p.month_year}?token=${data.token}&expires=${data.expires}`)
    } catch { toast.error('Could not open invoice') }
  }

  const downloadReceipt = async p => {
    try {
      const { data } = await api.get(`/invoice/token/${p.tenant_id}?month_year=${p.month_year}`)
      openExternal(`${API_ORIGIN}/api/invoice/download/${data.hostel_id}/${p.tenant_id}/${p.month_year}?token=${data.token}&expires=${data.expires}`)
    } catch { toast.error('Could not download receipt') }
  }

  const createQr = async p => {
    try {
      const { data } = await api.post('/payments/payment-requests', { tenant_id: p.tenant_id, month_year: p.month_year, amount: p.balance })
      setActiveRequest(data)
      load()
    } catch (err) { toast.error(err.response?.data?.detail || 'Could not create payment QR') }
  }

  const prepareReminders = async () => {
    try {
      const { data } = await api.post(`/payments/reminders/${month}`)
      setReminderBatch(data)
      toast.success(`${data.count} WhatsApp reminders ready`)
    } catch (err) { toast.error(err.response?.data?.detail || 'Could not prepare reminders') }
  }

  const reviewRequest = async (requestId, status) => {
    try {
      await api.patch(`/payments/payment-requests/${requestId}/review`, { status })
      toast.success(status === 'VERIFIED' ? 'Payment verified · receipt created' : 'Payment marked failed')
      load()
    } catch (err) { toast.error(err.response?.data?.detail || 'Could not update payment') }
  }

  const copyText = async text => {
    await navigator.clipboard.writeText(text)
    toast.success('Copied')
  }

  const TABS = [
    { key: 'ledger',  icon: FileText, label: 'Monthly Ledger'  },
    { key: 'txlog',   icon: Clock,    label: 'Transaction Log' },
    { key: 'charges', icon: Zap,      label: 'Charges'         },
    { key: 'requests',icon: ShieldCheck, label: 'UPI status'   },
  ]

  return (
    <div className="page-shell">

      {/* Header */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <p className="mb-2 text-[10px] font-extrabold uppercase tracking-[0.16em] text-indigo-500">Revenue operations</p>
          <h1 className="page-title">Bills & payments</h1>
          <p className="page-subtitle">See exactly what was billed, paid and still remaining.</p>
        </div>
        <div className="grid w-full grid-cols-1 gap-2 sm:w-auto sm:flex sm:flex-wrap sm:items-center">
          <input type="month" value={month} onChange={e => setMonth(e.target.value)}
            className="input !w-full sm:!w-auto text-sm font-semibold" />
          <button onClick={generateBills} className="btn-ghost btn-sm w-full sm:w-auto">Generate Bills</button>
          <button onClick={prepareReminders} className="btn-success btn-sm w-full sm:w-auto"><Send size={13}/> WhatsApp</button>
          <button onClick={openElecModal}  className="btn-amber btn-sm w-full sm:w-auto"><Zap size={13}/> Electricity</button>
          <button onClick={openChargeModal} className="btn-ghost btn-sm border border-slate-200 w-full sm:w-auto"><Droplets size={13}/> Add Charge</button>
          <button onClick={openPayModal}   className="btn-primary btn-sm w-full sm:w-auto"><Plus size={13}/> Record Payment</button>
        </div>
      </div>

      {/* Summary cards */}
      <SummaryBar payments={payments} />

      {/* Tabs */}
      <div className="flex overflow-x-auto border-b border-slate-200 gap-0">
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
            {t.key === 'requests' && requests.length > 0 && <span className="ml-1 bg-blue-100 text-blue-700 text-xs font-bold px-1.5 py-0.5 rounded-full">{requests.length}</span>}
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
            <>
            <div className="space-y-3 p-3 md:hidden">
              {payments.map(p => (
                <article key={p.payment_id} className="rounded-2xl border border-slate-200 bg-white p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate font-bold text-slate-900">{p.tenant_name}</p>
                      <p className="mt-0.5 text-xs text-slate-400">Room {p.room_number || '—'} · Due {new Date(`${p.due_date}T00:00:00`).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}{p.is_overdue ? ' · Overdue' : ''}</p>
                    </div>
                    <BalancePill balance={p.balance} credit={p.credit} carried={p.carried_forward}/>
                  </div>
                  <div className="mt-4 grid grid-cols-3 gap-2 rounded-xl bg-[#f7f7f3] p-3 text-center">
                    <div><p className="text-[10px] font-bold uppercase text-slate-400">Payable</p><p className="mt-1 text-sm font-bold text-money">₹{fmt(p.payable)}</p></div>
                    <div><p className="text-[10px] font-bold uppercase text-slate-400">Paid</p><p className="mt-1 text-sm font-bold text-money text-emerald-700">₹{fmt(p.amount_paid)}</p></div>
                    <div><p className="text-[10px] font-bold uppercase text-slate-400">Left</p><p className="mt-1 text-sm font-bold text-money text-rose-600">₹{fmt(p.balance)}</p></div>
                  </div>
                  <p className="mt-3 text-xs text-slate-500">Rent ₹{fmt(p.due_amount)} + Electricity ₹{fmt(p.electricity_amount)} + Other ₹{fmt(p.additional_amount)}{p.arrears > 0 ? ` + Previous ₹${fmt(p.arrears)}` : ''}{p.opening_credit > 0 ? ` − Credit ₹${fmt(p.opening_credit)}` : ''}</p>
                  <div className="mt-4 grid grid-cols-3 gap-2">
                    {p.balance > 0 && <button onClick={() => createQr(p)} className="btn-primary btn-sm px-2"><QrCode size={14}/> Pay QR</button>}
                    <button onClick={() => openInvoice(p)} className="btn-ghost btn-sm border border-slate-200 px-2"><Receipt size={14}/> View</button>
                    <button onClick={() => downloadReceipt(p)} className="btn-ghost btn-sm border border-slate-200 px-2"><Download size={14}/> PDF</button>
                  </div>
                </article>
              ))}
            </div>
            <div className="table-scroll hidden md:block">
            <table className="data-table min-w-[920px]">
              <thead>
                <tr>
                  <th>Tenant</th>
                  <th className="text-right">Rent</th>
                  <th className="text-right">Elec</th>
                  <th className="text-right">Other</th>
                  <th className="text-right">Payable</th>
                  <th className="text-right">Paid</th>
                  <th>Status</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {payments.map(p => (
                  <Fragment key={p.payment_id}>
                    <tr key={p.payment_id}
                      className="cursor-pointer"
                      onClick={() => setExpandedRow(expandedRow === p.payment_id ? null : p.payment_id)}>
                      <td>
                        <span className="font-semibold text-slate-800">{p.tenant_name}</span>
                        {p.arrears > 0 && <span className="ml-2 badge-amber text-[10px]">+₹{fmt(p.arrears)} previous</span>}
                      </td>
                      <td className="text-right text-money text-slate-700">₹{p.due_amount.toLocaleString('en-IN')}</td>
                      <td className="text-right text-money text-amber-600">
                        {p.electricity_amount > 0 ? `₹${p.electricity_amount.toLocaleString('en-IN')}` : <span className="text-slate-300">—</span>}
                      </td>
                      <td className="text-right text-money text-violet-600">
                        {p.additional_amount > 0 ? `₹${p.additional_amount.toLocaleString('en-IN')}` : <span className="text-slate-300">—</span>}
                      </td>
                      <td className="text-right text-money font-semibold text-slate-900">₹{fmt(p.payable)}</td>
                      <td className="text-right text-money text-emerald-600 font-semibold">₹{p.amount_paid.toLocaleString('en-IN')}</td>
                      <td><BalancePill balance={p.balance} credit={p.credit} carried={p.carried_forward}/></td>
                      <td>
                        <div className="flex items-center gap-1">
                          <button onClick={e => { e.stopPropagation(); openInvoice(p) }}
                            title="Open invoice" className="btn-icon btn-sm text-blue-400 hover:text-blue-700">
                            <Receipt size={14}/>
                          </button>
                          {p.balance > 0 && <button onClick={e => { e.stopPropagation(); createQr(p) }} title="Create tenant payment QR" className="btn-icon btn-sm text-blue-600"><QrCode size={14}/></button>}
                          <button onClick={e => { e.stopPropagation(); downloadReceipt(p) }} title="Download PDF receipt" className="btn-icon btn-sm text-slate-500"><Download size={14}/></button>
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
                              { label: 'Previous balance', val: `₹${fmt(p.arrears)}`, c: 'text-orange-500' },
                              { label: 'Opening credit', val: `₹${fmt(p.opening_credit)}`, c: 'text-blue-700' },
                              { label: 'Total payable', val: `₹${fmt(p.payable)}`, c: 'text-slate-900' },
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
                  </Fragment>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-slate-50 font-bold text-sm">
                  <td className="px-4 py-3 text-slate-500">TOTAL — {payments.length} tenants</td>
                  <td className="px-4 py-3 text-right text-money">{/* rent sum */}</td>
                  <td colSpan={2}></td>
                  <td className="px-4 py-3 text-right text-money text-slate-900">
                    ₹{fmt(payments.reduce((s,p) => s + p.payable, 0))}
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
            </div>
            </>
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
            <div className="table-scroll">
            <table className="data-table min-w-[820px]">
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
            </div>
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
              <div className="table-scroll">
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
                      <td className="text-right text-slate-500">{b.tenant_count}</td>
                      <td className="text-right text-money font-bold text-amber-600">₹{b.per_tenant.toLocaleString('en-IN')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              </div>
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
              <div className="table-scroll">
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
              </div>
            )}
          </div>
        </div>
      )}

      {tab === 'requests' && (
        <div className="card overflow-hidden">
          <div className="border-b border-slate-100 px-4 py-4 sm:px-5">
            <p className="font-bold text-slate-900">UPI payment status</p>
            <p className="mt-1 text-xs text-slate-500">Tenant submission is never counted as received until an admin verifies the UPI reference.</p>
          </div>
          {requests.length === 0 ? (
            <div className="py-14 text-center text-sm text-slate-400">No QR payment requests for {month}.</div>
          ) : (
            <div className="divide-y divide-slate-100">
              {requests.map(request => (
                <div key={request.request_id} className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:px-5">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-bold text-slate-900">{request.tenant_name}</p>
                      <span className={`badge ${request.status === 'VERIFIED' ? 'bg-emerald-50 text-emerald-700' : request.status === 'FAILED' ? 'bg-rose-50 text-rose-700' : request.status === 'SUBMITTED' ? 'bg-amber-50 text-amber-700' : 'bg-slate-100 text-slate-600'}`}>{request.status}</span>
                    </div>
                    <p className="mt-1 text-xs text-slate-500">{request.tenant_phone} · Room {request.room_number || '—'} · ₹{fmt(request.amount)}</p>
                    {request.payer_reference && <p className="mt-1 text-xs font-semibold text-slate-700">UPI ref: {request.payer_reference}</p>}
                    {request.failure_reason && <p className="mt-1 text-xs text-rose-600">{request.failure_reason}</p>}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button onClick={() => setActiveRequest(request)} className="btn-ghost btn-sm border border-slate-200"><QrCode size={14}/> QR</button>
                    {request.status === 'SUBMITTED' && <>
                      <button onClick={() => reviewRequest(request.request_id, 'VERIFIED')} className="btn-success btn-sm"><ShieldCheck size={14}/> Verify received</button>
                      <button onClick={() => reviewRequest(request.request_id, 'FAILED')} className="btn-danger btn-sm"><CircleX size={14}/> Mark failed</button>
                    </>}
                    {request.receipt_url && <a href={apiAssetUrl(request.receipt_url)} className="btn-primary btn-sm"><Download size={14}/> Receipt</a>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ─── MODALS ─── */}

      {activeRequest && (
        <Modal title="Tenant payment QR" onClose={() => setActiveRequest(null)}>
          <div className="space-y-4 text-center">
            <div className="relative overflow-hidden rounded-2xl bg-slate-950 p-4 text-white">
              <div className="pointer-events-none absolute -right-8 -top-12 h-32 w-32 rounded-full bg-violet-500/40 blur-2xl"/>
              <p className="text-xs font-semibold text-emerald-100/70">PAYING FOR</p>
              <p className="mt-1 text-lg font-bold">{activeRequest.tenant_name}</p>
              <p className="text-sm text-emerald-100">{activeRequest.tenant_phone} · Room {activeRequest.room_number || '—'}</p>
              <p className="mt-3 text-3xl font-bold text-money">₹{fmt(activeRequest.amount)}</p>
              <p className="mt-1 text-xs text-emerald-100/70">Billing month {activeRequest.month_year}</p>
            </div>
            {activeRequest.upi_configured ? (
              <>
                <div className="mx-auto w-fit rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
                  <img src={apiAssetUrl(activeRequest.qr_image_url)} alt={`UPI QR for ${activeRequest.tenant_name}`} className="h-56 w-56 max-w-full"/>
                </div>
                <p className="text-xs leading-5 text-slate-500">Before paying, confirm the QR shows this tenant name, phone number and ₹{fmt(activeRequest.amount)}.</p>
                <a href={activeRequest.upi_url} className="btn-primary w-full"><ExternalLink size={15}/> Open UPI app</a>
              </>
            ) : (
              <div className="rounded-xl bg-amber-50 p-4 text-left text-sm text-amber-800"><strong>UPI ID not configured.</strong><br/>Go to Home → Edit hostel info and add the receiving UPI ID.</div>
            )}
            <button onClick={() => copyText(activeRequest.public_url)} className="btn-ghost w-full border border-slate-200"><Copy size={15}/> Copy tenant payment link</button>
          </div>
        </Modal>
      )}

      {reminderBatch && (
        <Modal title={`WhatsApp reminders · ${reminderBatch.month_year}`} onClose={() => setReminderBatch(null)}>
          <p className="mb-4 text-sm text-slate-500">{reminderBatch.count} tenants have a remaining balance. Open each message to review and send it with the payment link and QR.</p>
          <div className="max-h-[55vh] space-y-2 overflow-y-auto">
            {reminderBatch.reminders.map(reminder => (
              <a key={reminder.request_id} href={reminder.whatsapp_url} target="_blank" rel="noreferrer" className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 p-3 text-left hover:bg-blue-50">
                <span><strong className="block text-sm text-slate-900">{reminder.tenant_name}</strong><span className="text-xs text-slate-500">{reminder.tenant_phone} · ₹{fmt(reminder.amount)}</span></span>
                <ExternalLink size={16} className="text-blue-700"/>
              </a>
            ))}
            {reminderBatch.count === 0 && <p className="py-8 text-center text-sm text-emerald-700">Everyone is fully paid for this month.</p>}
          </div>
        </Modal>
      )}

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
                  : <><AlertCircle size={16}/> Still remaining: ₹{fmt(selectedBalance)}</>}
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
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
