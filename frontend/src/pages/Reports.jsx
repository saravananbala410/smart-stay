import { useEffect, useState } from 'react'
import { FileText, Download, Building2, Zap, Droplets, Home, IndianRupee } from 'lucide-react'
import api from '../api/axios'

export default function Reports() {
  const [month, setMonth]           = useState(new Date().toISOString().slice(0, 7))
  const [payments, setPayments]     = useState([])
  const [elecBills, setElecBills]   = useState([])
  const [addCharges, setAddCharges] = useState([])
  const [stats, setStats]           = useState(null)
  const [loading, setLoading]       = useState(false)

  const load = async () => {
    setLoading(true)
    try {
      const [pRes, eRes, aRes, sRes] = await Promise.all([
        api.get(`/payments/?month_year=${month}`),
        api.get(`/charges/electricity?month_year=${month}`),
        api.get(`/charges/additional?month_year=${month}`),
        api.get('/dashboard/stats')
      ])
      setPayments(pRes.data)
      setElecBills(eRes.data)
      setAddCharges(aRes.data)
      setStats(sRes.data)
    } catch {}
    setLoading(false)
  }

  useEffect(() => { load() }, [month])

  const printBill = () => window.print()

  const totalCollected = payments.reduce((s, p) => s + p.amount_paid, 0)
  const totalPending   = payments.reduce((s, p) => s + p.balance, 0)
  const totalElec      = elecBills.reduce((s, b) => s + b.total_amount, 0)
  const totalAdd       = addCharges.reduce((s, c) => s + c.total_amount, 0)

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3 no-print">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Reports & Bills</h1>
          <p className="text-gray-500 text-sm">Monthly financial summary</p>
        </div>
        <div className="flex gap-2">
          <input type="month" value={month} onChange={e => setMonth(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm" />
          <button onClick={printBill}
            className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-indigo-700">
            <Download size={14} /> Print / Export PDF
          </button>
        </div>
      </div>

      {/* ── PRINTABLE BILL AREA ── */}
      <div id="bill-area" className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 space-y-6">

        {/* Header */}
        <div className="text-center border-b border-gray-200 pb-5">
          <div className="flex items-center justify-center gap-3 mb-2">
            <Building2 size={28} className="text-indigo-600" />
            <h2 className="text-2xl font-bold text-gray-800">{stats?.hostel_name || 'Hostel'}</h2>
          </div>
          {stats?.hostel_address && (
            <p className="text-gray-500 text-sm">{stats.hostel_address}</p>
          )}
          <p className="text-indigo-600 font-semibold mt-2 text-lg">
            Monthly Bill Report — {new Date(month + '-01').toLocaleString('en-IN', { month: 'long', year: 'numeric' })}
          </p>
          <p className="text-gray-400 text-xs mt-1">Generated on {new Date().toLocaleDateString('en-IN')}</p>
        </div>

        {/* Summary row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: 'Total Tenants', value: payments.length, icon: <Home size={14}/>, color: 'bg-indigo-50 text-indigo-700' },
            { label: 'Collected',     value: `₹${totalCollected.toLocaleString('en-IN')}`, icon: <IndianRupee size={14}/>, color: 'bg-green-50 text-green-700' },
            { label: 'Pending',       value: `₹${totalPending.toLocaleString('en-IN')}`,   icon: <IndianRupee size={14}/>, color: 'bg-red-50 text-red-700' },
            { label: 'Elec + Other',  value: `₹${(totalElec + totalAdd).toLocaleString('en-IN')}`, icon: <Zap size={14}/>, color: 'bg-yellow-50 text-yellow-700' },
          ].map(c => (
            <div key={c.label} className={`rounded-lg p-3 ${c.color}`}>
              <div className="flex items-center gap-1 text-xs mb-1 opacity-70">{c.icon} {c.label}</div>
              <p className="font-bold text-lg">{c.value}</p>
            </div>
          ))}
        </div>

        {/* Electricity Bills Section */}
        {elecBills.length > 0 && (
          <div>
            <h3 className="font-semibold text-gray-700 mb-3 flex items-center gap-2">
              <Zap size={15} className="text-yellow-500"/> Electricity Bills
            </h3>
            <table className="w-full text-sm border border-gray-100 rounded-lg overflow-hidden">
              <thead className="bg-yellow-50">
                <tr>
                  {['Room', 'Total Bill', 'Active Tenants', 'Per Tenant'].map(h => (
                    <th key={h} className="text-left px-4 py-2 text-yellow-700 font-medium text-xs">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {elecBills.map(b => (
                  <tr key={b.bill_id}>
                    <td className="px-4 py-2 font-medium">Room {b.room_number}</td>
                    <td className="px-4 py-2">₹{b.total_amount}</td>
                    <td className="px-4 py-2 text-gray-500">{Math.round(b.total_amount / b.per_tenant)}</td>
                    <td className="px-4 py-2 text-yellow-600 font-medium">₹{b.per_tenant}</td>
                  </tr>
                ))}
                <tr className="bg-yellow-50 font-semibold">
                  <td className="px-4 py-2">Total</td>
                  <td className="px-4 py-2 text-yellow-700">₹{totalElec.toLocaleString('en-IN')}</td>
                  <td></td><td></td>
                </tr>
              </tbody>
            </table>
          </div>
        )}

        {/* Additional Charges Section */}
        {addCharges.length > 0 && (
          <div>
            <h3 className="font-semibold text-gray-700 mb-3 flex items-center gap-2">
              <Droplets size={15} className="text-blue-500"/> Additional Charges
            </h3>
            <table className="w-full text-sm border border-gray-100 rounded-lg overflow-hidden">
              <thead className="bg-blue-50">
                <tr>
                  {['Charge', 'Total Amount', 'Per Tenant'].map(h => (
                    <th key={h} className="text-left px-4 py-2 text-blue-700 font-medium text-xs">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {addCharges.map(c => (
                  <tr key={c.charge_id}>
                    <td className="px-4 py-2 font-medium">{c.charge_name}</td>
                    <td className="px-4 py-2">₹{c.total_amount}</td>
                    <td className="px-4 py-2 text-blue-600 font-medium">₹{c.per_tenant}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Per-Tenant Payment Table */}
        <div>
          <h3 className="font-semibold text-gray-700 mb-3 flex items-center gap-2">
            <FileText size={15} className="text-indigo-500"/> Tenant-wise Payments
          </h3>
          {loading ? (
            <p className="text-center text-gray-400 py-8">Loading...</p>
          ) : payments.length === 0 ? (
            <p className="text-center text-gray-400 py-8">No payment records for {month}</p>
          ) : (
            <table className="w-full text-sm border border-gray-100 rounded-lg overflow-hidden">
              <thead className="bg-gray-50">
                <tr>
                  {['#', 'Tenant Name', 'Rent', 'Electricity', 'Other', 'Arrears', 'Total Due', 'Paid', 'Balance', 'Status', 'Paid On'].map(h => (
                    <th key={h} className="text-left px-3 py-2.5 text-gray-500 font-medium text-xs">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {payments.map((p, i) => (
                  <tr key={p.payment_id} className={p.balance > 0 ? 'bg-red-50/30' : ''}>
                    <td className="px-3 py-2.5 text-gray-400 text-xs">{i + 1}</td>
                    <td className="px-3 py-2.5 font-medium text-gray-800">{p.tenant_name}</td>
                    <td className="px-3 py-2.5 text-gray-600">₹{p.due_amount}</td>
                    <td className="px-3 py-2.5 text-yellow-600">{p.electricity_amount > 0 ? `₹${p.electricity_amount}` : '—'}</td>
                    <td className="px-3 py-2.5 text-blue-600">{p.additional_amount > 0 ? `₹${p.additional_amount}` : '—'}</td>
                    <td className="px-3 py-2.5 text-orange-500">{p.arrears > 0 ? `₹${p.arrears}` : '—'}</td>
                    <td className="px-3 py-2.5 font-semibold text-gray-800">₹{p.total_due + p.arrears}</td>
                    <td className="px-3 py-2.5 text-green-600 font-medium">₹{p.amount_paid}</td>
                    <td className="px-3 py-2.5">
                      <span className={`text-xs font-medium ${p.balance > 0 ? 'text-red-600' : 'text-green-600'}`}>
                        {p.balance > 0 ? `₹${p.balance}` : '—'}
                      </span>
                    </td>
                    <td className="px-3 py-2.5">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${p.balance === 0 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'}`}>
                        {p.balance === 0 ? '✓ Paid' : 'Pending'}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-gray-400 text-xs">
                      {p.payment_date ? new Date(p.payment_date).toLocaleDateString('en-IN') : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-gray-100 font-semibold">
                <tr>
                  <td colSpan={6} className="px-3 py-2.5 text-gray-700">TOTAL</td>
                  <td className="px-3 py-2.5">₹{payments.reduce((s,p)=>s+p.total_due+p.arrears,0).toLocaleString('en-IN')}</td>
                  <td className="px-3 py-2.5 text-green-700">₹{totalCollected.toLocaleString('en-IN')}</td>
                  <td className="px-3 py-2.5 text-red-600">₹{totalPending.toLocaleString('en-IN')}</td>
                  <td colSpan={2}></td>
                </tr>
              </tfoot>
            </table>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-gray-200 pt-4 text-center text-xs text-gray-400">
          <p>{stats?.hostel_name} · {stats?.hostel_address} · Generated by Smart-Stay</p>
        </div>
      </div>

      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { background: white; }
          #bill-area { box-shadow: none; border: none; }
        }
      `}</style>
    </div>
  )
}
