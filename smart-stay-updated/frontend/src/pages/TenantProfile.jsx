import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Phone, Calendar, Home, Receipt, Clock, RefreshCw, UserX, ShieldCheck, CreditCard, AlertCircle, CheckCircle2 } from 'lucide-react'
import api from '../api/axios'
import toast from 'react-hot-toast'

const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'

function fmt(n) { return Number(n || 0).toLocaleString('en-IN') }

function resolvePhoto(url) {
  if (!url) return null
  if (url.startsWith('http')) return url
  let c = url.replace(/^\//, '')
  if (!c.startsWith('uploads/')) c = `uploads/${c}`
  return `${BASE_URL}/${c}`
}

export default function TenantProfile() {
  const { id }   = useParams()
  const navigate = useNavigate()
  const [tenant,   setTenant]    = useState(null)
  const [payments, setPayments]  = useState(null)
  const [imgErr,   setImgErr]    = useState(false)
  const [tab,      setTab]       = useState('ledger')  // 'ledger' | 'txlog'

  const reload = () => {
    api.get(`/tenants/${id}`).then(r => { setTenant(r.data); setImgErr(false) }).catch(() => navigate('/tenants'))
    api.get(`/tenants/${id}/payments`).then(r => setPayments(r.data)).catch(() => {})
  }
  useEffect(() => { reload() }, [id])

  const markVacated = async () => {
    if (!confirm('Mark as Vacated? Their bed will be freed.')) return
    try { await api.patch(`/tenants/${id}`, { status: 'Vacated' }); toast.success('Tenant vacated'); reload() }
    catch { toast.error('Failed') }
  }
  const reActivate = async () => {
    if (!confirm('Re-activate this tenant?')) return
    try { await api.patch(`/tenants/${id}`, { status: 'Active' }); toast.success('Tenant re-activated ✅'); reload() }
    catch { toast.error('Failed') }
  }
  const openInvoice = async (monthYear) => {
    try {
      const { data } = await api.get(`/invoice/token/${id}`)
      window.open(`${BASE_URL}/api/invoice/view/${data.hostel_id}/${id}/${monthYear}?token=${data.token}`, '_blank')
    } catch { toast.error('Could not open invoice') }
  }

  if (!tenant) return (
    <div className="flex items-center justify-center py-24 text-slate-300">
      <div className="text-center"><div className="animate-spin text-4xl mb-3">⏳</div><p className="text-sm">Loading profile…</p></div>
    </div>
  )

  const photoUrl  = resolvePhoto(tenant.photo_url)
  const isActive  = tenant.status === 'Active'

  return (
    <div className="space-y-5 max-w-3xl">
      <button onClick={() => navigate('/tenants')}
        className="flex items-center gap-1.5 text-sm text-slate-400 hover:text-slate-700 transition-colors font-medium">
        <ArrowLeft size={15}/> Back to Tenants
      </button>

      {/* ─── PROFILE CARD ─── */}
      <div className="card p-6">
        <div className="flex items-start gap-5">

          {/* Avatar */}
          <div className="w-20 h-20 flex-shrink-0">
            {photoUrl && !imgErr
              ? <img src={photoUrl} alt={tenant.name} onError={() => setImgErr(true)}
                  className="w-20 h-20 rounded-2xl object-cover ring-2 ring-slate-100"/>
              : <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-blue-100 to-blue-200 flex items-center justify-center text-blue-700 text-2xl font-bold">
                  {tenant.name.charAt(0).toUpperCase()}
                </div>
            }
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-3 flex-wrap">
              <div>
                <h1 className="text-xl font-bold text-slate-900">{tenant.name}</h1>
                <span className={`badge mt-1 ${isActive ? 'badge-green' : 'badge-slate'}`}>
                  {isActive ? <><ShieldCheck size={11}/>Active</> : <><UserX size={11}/>Vacated</>}
                </span>
              </div>
              <div className="flex gap-2">
                {isActive
                  ? <button onClick={markVacated} className="btn-danger btn-sm"><UserX size={12}/> Mark Vacated</button>
                  : <button onClick={reActivate}  className="btn-success btn-sm"><RefreshCw size={12}/> Re-activate</button>
                }
              </div>
            </div>

            <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1.5 text-sm text-slate-500">
              <span className="flex items-center gap-2"><Phone size={13} className="text-slate-300"/> {tenant.phone}</span>
              <span className="flex items-center gap-2"><Calendar size={13} className="text-slate-300"/> Joined {new Date(tenant.joining_date).toLocaleDateString('en-IN')}</span>
              {tenant.vacated_date && <span className="flex items-center gap-2 text-orange-500"><Calendar size={13}/> Vacated {new Date(tenant.vacated_date).toLocaleDateString('en-IN')}</span>}
              {tenant.room && <span className="flex items-center gap-2"><Home size={13} className="text-slate-300"/> Room {tenant.room.room_number} · {tenant.room.sharing_type}-sharing · ₹{fmt(tenant.room.base_rent)}/mo</span>}
            </div>
          </div>
        </div>

        {/* Meta row */}
        <div className="mt-5 pt-5 border-t border-slate-100 flex flex-wrap gap-x-8 gap-y-2 text-sm">
          <div><span className="text-slate-400 text-xs font-semibold uppercase tracking-wide">Aadhaar</span><p className="font-mono font-medium text-slate-700 mt-0.5">{tenant.aadhaar_number}</p></div>
          {tenant.emergency_contact && <div><span className="text-slate-400 text-xs font-semibold uppercase tracking-wide">Emergency</span><p className="font-medium text-slate-700 mt-0.5">{tenant.emergency_contact}</p></div>}
          {tenant.aadhaar_pdf_url && (
            <div className="ml-auto">
              <a href={tenant.aadhaar_pdf_url} target="_blank" rel="noreferrer"
                className="btn-ghost btn-sm border border-slate-200">📄 Aadhaar PDF</a>
            </div>
          )}
        </div>
      </div>

      {/* ─── LEDGER SECTION ─── */}
      {payments && (
        <div className="card overflow-hidden">

          {/* Outstanding banner */}
          <div className={`px-6 py-4 border-b border-slate-100 flex items-center justify-between gap-4 flex-wrap
            ${payments.outstanding_balance > 0 ? 'bg-rose-50' : 'bg-emerald-50'}`}>
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-1">
                Cumulative Outstanding (joining date → today)
              </p>
              <p className={`text-lg font-bold ${payments.outstanding_balance > 0 ? 'text-rose-700' : 'text-emerald-700'}`}>
                {payments.ledger_summary}
              </p>
            </div>
            <div className="flex gap-3 text-xs text-slate-500 flex-wrap">
              <div className="text-center"><p className="font-bold text-base text-money text-slate-700">{payments.months_active}</p><p>months active</p></div>
              <div className="w-px bg-slate-200"/>
              <div className="text-center"><p className="font-bold text-base text-money text-slate-700">₹{fmt(payments.monthly_rent)}</p><p>monthly rent</p></div>
              <div className="w-px bg-slate-200"/>
              <div className="text-center"><p className="font-bold text-base text-money text-slate-700">₹{fmt(payments.cumulative_rent_due)}</p><p>cumulative due</p></div>
            </div>
          </div>

          {/* 3 KPIs */}
          <div className="grid grid-cols-3 divide-x divide-slate-100 border-b border-slate-100">
            {[
              { label: 'Total Paid',    val: `₹${fmt(payments.total_paid)}`,          color: 'text-emerald-600', bg: '' },
              { label: 'Total Billed',  val: `₹${fmt(payments.total_due)}`,            color: 'text-slate-800',   bg: '' },
              { label: 'Outstanding',   val: `₹${fmt(payments.outstanding_balance)}`,  color: 'text-rose-600',    bg: '' },
            ].map(k => (
              <div key={k.label} className={`text-center py-4 ${k.bg}`}>
                <p className="text-xs text-slate-400 font-semibold uppercase tracking-wide mb-1">{k.label}</p>
                <p className={`text-xl font-bold text-money ${k.color}`}>{k.val}</p>
              </div>
            ))}
          </div>

          {/* Tabs */}
          <div className="flex border-b border-slate-100 px-5 pt-1 gap-0">
            {[['ledger','Monthly Breakdown'],['txlog','Transaction Log']].map(([k,l]) => (
              <button key={k} onClick={() => setTab(k)}
                className={`flex items-center gap-1.5 px-3 py-2.5 text-xs font-bold uppercase tracking-wide border-b-2 transition-colors ${
                  tab === k ? 'border-blue-600 text-blue-700' : 'border-transparent text-slate-400 hover:text-slate-600'
                }`}>
                {k === 'ledger' ? <CreditCard size={12}/> : <Clock size={12}/>} {l}
                {k === 'txlog' && payments.transactions?.length > 0 &&
                  <span className="ml-1 bg-blue-100 text-blue-600 text-[10px] font-bold px-1.5 py-0.5 rounded-full">{payments.transactions.length}</span>}
              </button>
            ))}
          </div>

          {/* ── Monthly breakdown ── */}
          {tab === 'ledger' && (
            <>
              {payments.payments?.length === 0 ? (
                <p className="text-center text-slate-400 text-sm py-8">No bills generated yet.</p>
              ) : (
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Month</th>
                      <th className="text-right">Rent</th>
                      <th className="text-right">Elec</th>
                      <th className="text-right">Other</th>
                      <th className="text-right">Paid</th>
                      <th>Status</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {payments.payments.map(p => (
                      <tr key={p.payment_id}>
                        <td className="font-bold text-slate-800">{p.month_year}</td>
                        <td className="text-right text-money">₹{fmt(p.due_amount)}</td>
                        <td className="text-right text-money text-amber-600">
                          {p.electricity_amount > 0 ? `₹${fmt(p.electricity_amount)}` : <span className="text-slate-200">—</span>}
                        </td>
                        <td className="text-right text-money text-violet-600">
                          {p.additional_amount > 0 ? `₹${fmt(p.additional_amount)}` : <span className="text-slate-200">—</span>}
                        </td>
                        <td className="text-right text-money font-bold text-emerald-600">₹{fmt(p.amount_paid)}</td>
                        <td>
                          {p.balance === 0
                            ? <span className="badge-green"><CheckCircle2 size={11}/> Cleared</span>
                            : <span className="badge-red"><AlertCircle size={11}/> ₹{fmt(p.balance)} due</span>}
                        </td>
                        <td>
                          <button onClick={() => openInvoice(p.month_year)}
                            title="Open invoice" className="btn-icon text-blue-400 hover:text-blue-700">
                            <Receipt size={14}/>
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </>
          )}

          {/* ── Transaction log ── */}
          {tab === 'txlog' && (
            <>
              {payments.transactions?.length === 0 ? (
                <p className="text-center text-slate-400 text-sm py-8">No payment transactions recorded yet.</p>
              ) : (
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>#</th>
                      <th className="text-right">Amount</th>
                      <th>Month</th>
                      <th>Date & Time</th>
                      <th>Reference / Note</th>
                    </tr>
                  </thead>
                  <tbody>
                    {payments.transactions.map(t => (
                      <tr key={t.txn_id}>
                        <td className="text-slate-300 font-mono text-xs">#{t.txn_id}</td>
                        <td className="text-right text-money font-bold text-emerald-600">₹{fmt(t.amount)}</td>
                        <td><span className="badge-blue text-[10px]">{t.month_year}</span></td>
                        <td className="text-slate-500 text-xs">
                          {t.paid_at ? new Date(t.paid_at).toLocaleString('en-IN', {
                            day:'2-digit', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit'
                          }) : '—'}
                        </td>
                        <td className="text-slate-400 text-xs">{t.transaction_id || t.note || <span className="text-slate-200">—</span>}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </>
          )}
        </div>
      )}
    </div>
  )
}
