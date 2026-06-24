import { useEffect, useState } from 'react'
import { Download, Zap, Droplets, TrendingUp, TrendingDown, Users, Printer } from 'lucide-react'
import api from '../api/axios'

function fmt(n) { return Number(n).toLocaleString('en-IN') }

export default function Reports() {
  const [month,      setMonth]      = useState(new Date().toISOString().slice(0, 7))
  const [payments,   setPayments]   = useState([])
  const [elecBills,  setElecBills]  = useState([])
  const [addCharges, setAddCharges] = useState([])
  const [stats,      setStats]      = useState(null)
  const [loading,    setLoading]    = useState(false)

  const load = async () => {
    setLoading(true)
    try {
      const [pR, eR, aR, sR] = await Promise.all([
        api.get(`/payments/?month_year=${month}`),
        api.get(`/charges/electricity?month_year=${month}`),
        api.get(`/charges/additional?month_year=${month}`),
        api.get('/dashboard/stats'),
      ])
      setPayments(pR.data); setElecBills(eR.data)
      setAddCharges(aR.data); setStats(sR.data)
    } catch {}
    setLoading(false)
  }

  useEffect(() => { load() }, [month])

  const totalCollected = payments.reduce((s, p) => s + p.amount_paid, 0)
  const totalPending   = payments.reduce((s, p) => s + p.balance, 0)
  const totalDue       = payments.reduce((s, p) => s + p.total_due + (p.arrears||0), 0)
  const collectionPct  = totalDue > 0 ? Math.round((totalCollected / totalDue) * 100) : 0
  const monthLabel     = new Date(month + '-01').toLocaleString('en-IN', { month: 'long', year: 'numeric' })

  return (
    <div className="space-y-5 max-w-5xl">

      {/* Header */}
      <div className="flex items-start justify-between gap-3 flex-wrap no-print">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Reports</h1>
          <p className="text-slate-400 text-sm mt-0.5">Monthly financial summary & export</p>
        </div>
        <div className="flex gap-2">
          <input type="month" value={month} onChange={e => setMonth(e.target.value)}
            className="input !w-auto text-sm font-semibold"/>
          <button onClick={() => window.print()}
            className="btn-primary btn-sm"><Printer size={13}/> Print / PDF</button>
        </div>
      </div>

      {loading ? (
        <div className="card-pad text-center py-16 text-slate-300">Loading report…</div>
      ) : (
        <>
          {/* ─── PRINT HEADER (hidden on screen) ─── */}
          <div className="hidden print:block text-center mb-6">
            <h1 className="text-2xl font-bold">{stats?.hostel_name}</h1>
            {stats?.hostel_address && <p className="text-slate-500 text-sm">{stats.hostel_address}</p>}
            <p className="text-blue-700 font-semibold mt-1">Monthly Report — {monthLabel}</p>
            <p className="text-slate-400 text-xs">Generated {new Date().toLocaleDateString('en-IN')}</p>
          </div>

          {/* ─── KPI CARDS ─── */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { label: 'Total Billed',  value: `₹${fmt(totalDue)}`,        sub: `${payments.length} tenants`, icon: Users,        bg: 'bg-blue-50',    text: 'text-blue-700'   },
              { label: 'Collected',     value: `₹${fmt(totalCollected)}`,   sub: `${collectionPct}% rate`,     icon: TrendingUp,   bg: 'bg-emerald-50', text: 'text-emerald-700' },
              { label: 'Outstanding',   value: `₹${fmt(totalPending)}`,     sub: `${payments.filter(p=>p.balance>0).length} tenants`, icon: TrendingDown, bg: 'bg-rose-50', text: 'text-rose-700' },
              { label: 'Utilities',     value: `₹${fmt(elecBills.reduce((s,b)=>s+b.total_amount,0) + addCharges.reduce((s,c)=>s+c.total_amount,0))}`, sub: `${elecBills.length} elec + ${addCharges.length} other`, icon: Zap, bg: 'bg-amber-50', text: 'text-amber-700' },
            ].map(c => (
              <div key={c.label} className={`${c.bg} rounded-2xl p-4`}>
                <div className="flex items-center gap-2 mb-2">
                  <c.icon size={14} className={c.text}/>
                  <p className="text-xs font-semibold text-slate-500">{c.label}</p>
                </div>
                <p className={`text-xl font-bold text-money ${c.text}`}>{c.value}</p>
                <p className="text-xs text-slate-400 mt-0.5">{c.sub}</p>
              </div>
            ))}
          </div>

          {/* ─── COLLECTION PROGRESS BAR ─── */}
          {totalDue > 0 && (
            <div className="card-pad">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-semibold text-slate-700">Collection Progress — {monthLabel}</p>
                <p className="text-sm font-bold text-money text-emerald-600">{collectionPct}% collected</p>
              </div>
              <div className="w-full bg-slate-100 rounded-full h-3 overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-emerald-400 to-emerald-600 rounded-full transition-all duration-500"
                  style={{ width: `${collectionPct}%` }}/>
              </div>
              <div className="flex justify-between mt-1.5 text-xs text-slate-400">
                <span>₹{fmt(totalCollected)} paid</span>
                <span>₹{fmt(totalPending)} pending</span>
              </div>
            </div>
          )}

          {/* ─── ELECTRICITY BILLS ─── */}
          {elecBills.length > 0 && (
            <div className="card overflow-hidden">
              <div className="px-5 py-3.5 border-b border-slate-100 flex items-center gap-2">
                <div className="p-1.5 bg-amber-100 rounded-lg"><Zap size={14} className="text-amber-600"/></div>
                <p className="font-bold text-slate-900 text-sm">Electricity Bills — {monthLabel}</p>
              </div>
              <table className="data-table">
                <thead><tr>
                  <th>Room</th><th className="text-right">Total Bill</th>
                  <th className="text-right">Tenants</th><th className="text-right">Per Tenant</th>
                </tr></thead>
                <tbody>
                  {elecBills.map(b => (
                    <tr key={b.bill_id}>
                      <td className="font-semibold">Room {b.room_number}</td>
                      <td className="text-right text-money">₹{fmt(b.total_amount)}</td>
                      <td className="text-right text-slate-500">{Math.round(b.total_amount/b.per_tenant)}</td>
                      <td className="text-right text-money font-bold text-amber-600">₹{fmt(b.per_tenant)}</td>
                    </tr>
                  ))}
                  <tr className="bg-amber-50/50 font-bold">
                    <td className="px-4 py-2.5 text-slate-600">Total Electricity</td>
                    <td className="px-4 py-2.5 text-right text-money text-amber-700">₹{fmt(elecBills.reduce((s,b)=>s+b.total_amount,0))}</td>
                    <td colSpan={2}></td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}

          {/* ─── CUSTOM CHARGES ─── */}
          {addCharges.length > 0 && (
            <div className="card overflow-hidden">
              <div className="px-5 py-3.5 border-b border-slate-100 flex items-center gap-2">
                <div className="p-1.5 bg-violet-100 rounded-lg"><Droplets size={14} className="text-violet-600"/></div>
                <p className="font-bold text-slate-900 text-sm">Additional Charges — {monthLabel}</p>
              </div>
              <table className="data-table">
                <thead><tr>
                  <th>Charge</th><th>Scope</th>
                  <th className="text-right">Total</th><th className="text-right">Per Tenant</th>
                </tr></thead>
                <tbody>
                  {addCharges.map(c => (
                    <tr key={c.charge_id}>
                      <td className="font-semibold">{c.charge_name}</td>
                      <td><span className="badge-slate text-xs">{c.scope || 'Hostel-wide'}</span></td>
                      <td className="text-right text-money">₹{fmt(c.total_amount)}</td>
                      <td className="text-right text-money font-bold text-violet-600">₹{fmt(c.per_tenant)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* ─── TENANT-WISE PAYMENT TABLE ─── */}
          <div className="card overflow-hidden">
            <div className="px-5 py-3.5 border-b border-slate-100">
              <p className="font-bold text-slate-900 text-sm">Tenant-wise Payments — {monthLabel}</p>
              <p className="text-xs text-slate-400 mt-0.5">Full breakdown per tenant for the month</p>
            </div>
            {payments.length === 0 ? (
              <div className="py-12 text-center text-slate-400 text-sm">No payment records for {month}.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="data-table min-w-[900px]">
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Tenant</th>
                      <th className="text-right">Rent</th>
                      <th className="text-right">Electricity</th>
                      <th className="text-right">Other</th>
                      <th className="text-right">Arrears</th>
                      <th className="text-right">Total Due</th>
                      <th className="text-right">Paid</th>
                      <th className="text-right">Balance</th>
                      <th>Status</th>
                      <th>Paid On</th>
                    </tr>
                  </thead>
                  <tbody>
                    {payments.map((p, i) => (
                      <tr key={p.payment_id} className={p.balance > 0 ? 'bg-rose-50/30' : ''}>
                        <td className="text-slate-300 text-xs">{i + 1}</td>
                        <td className="font-semibold text-slate-800">{p.tenant_name}</td>
                        <td className="text-right text-money">₹{fmt(p.due_amount)}</td>
                        <td className="text-right text-money text-amber-600">
                          {p.electricity_amount > 0 ? `₹${fmt(p.electricity_amount)}` : <span className="text-slate-200">—</span>}
                        </td>
                        <td className="text-right text-money text-violet-600">
                          {p.additional_amount > 0 ? `₹${fmt(p.additional_amount)}` : <span className="text-slate-200">—</span>}
                        </td>
                        <td className="text-right text-money text-orange-500">
                          {(p.arrears||0) > 0 ? `₹${fmt(p.arrears)}` : <span className="text-slate-200">—</span>}
                        </td>
                        <td className="text-right text-money font-bold text-slate-900">₹{fmt(p.total_due + (p.arrears||0))}</td>
                        <td className="text-right text-money font-bold text-emerald-600">₹{fmt(p.amount_paid)}</td>
                        <td className="text-right text-money font-bold">
                          <span className={p.balance > 0 ? 'text-rose-600' : 'text-emerald-600'}>
                            {p.balance > 0 ? `₹${fmt(p.balance)}` : '—'}
                          </span>
                        </td>
                        <td>
                          {p.balance === 0
                            ? <span className="badge-green text-[10px]">✓ Paid</span>
                            : <span className="badge-red text-[10px]">Pending</span>}
                        </td>
                        <td className="text-slate-400 text-xs">
                          {p.payment_date ? new Date(p.payment_date).toLocaleDateString('en-IN') : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="bg-slate-50 font-bold border-t-2 border-slate-200">
                      <td colSpan={6} className="px-4 py-3 text-slate-600 text-sm">TOTAL</td>
                      <td className="px-4 py-3 text-right text-money text-slate-900">₹{fmt(totalDue)}</td>
                      <td className="px-4 py-3 text-right text-money text-emerald-700">₹{fmt(totalCollected)}</td>
                      <td className="px-4 py-3 text-right text-money text-rose-600">₹{fmt(totalPending)}</td>
                      <td colSpan={2}></td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </div>

          {/* ─── PRINT FOOTER ─── */}
          <div className="hidden print:block text-center text-xs text-slate-400 border-t pt-4 mt-4">
            {stats?.hostel_name} · {stats?.hostel_address} · Generated by Smart-Stay
          </div>
        </>
      )}

      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { background: white !important; }
          .card { box-shadow: none !important; border: 1px solid #e2e8f0 !important; }
        }
      `}</style>
    </div>
  )
}
