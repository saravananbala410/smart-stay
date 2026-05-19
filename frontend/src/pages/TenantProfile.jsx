import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Phone, Calendar, Home, Zap, Droplets, IndianRupee } from 'lucide-react'
import api from '../api/axios'
import toast from 'react-hot-toast'

const BASE_URL = 'http://localhost:8000'

function getImageUrl(path) {
  if (!path) return null
  if (path.startsWith('http')) return path
  const cleanPath = path.startsWith('uploads/') ? path : `uploads/${path}`
  return `${BASE_URL}/${cleanPath}`
}

export function TenantProfile() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [tenant, setTenant]   = useState(null)
  const [payments, setPayments] = useState(null)

  useEffect(() => {
    api.get(`/tenants/${id}`)
      .then(r => setTenant(r.data))
      .catch(() => navigate('/tenants'))
    api.get(`/tenants/${id}/payments`)
      .then(r => setPayments(r.data))
      .catch(() => {})
  }, [id, navigate])

  const markVacated = async () => {
    if (!confirm('Mark this tenant as Vacated?')) return
    try {
      await api.patch(`/tenants/${id}`, { status: 'Vacated' })
      toast.success('Tenant marked as vacated')
      navigate('/tenants')
    } catch {
      toast.error('Failed to update status')
    }
  }

  if (!tenant) return <div className="text-center py-16 text-gray-400">Loading profile...</div>

  // Calculate months since joining
  const joiningDate  = new Date(tenant.joining_date)
  const today        = new Date()
  const monthsActive = (today.getFullYear() - joiningDate.getFullYear()) * 12 + (today.getMonth() - joiningDate.getMonth()) + 1
  const expectedTotal = tenant.room ? (tenant.room.base_rent * monthsActive) : 0

  return (
    <div className="space-y-5 max-w-2xl">
      <button onClick={() => navigate('/tenants')} className="flex items-center gap-2 text-gray-500 hover:text-gray-700 text-sm">
        <ArrowLeft size={16} /> Back to Tenants
      </button>

      {/* Profile card */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        <div className="flex items-start gap-5">
          {/* FIX: Proper photo with initial fallback */}
          <div className="relative w-20 h-20">
            {tenant.photo_url ? (
              <img
                src={getImageUrl(tenant.photo_url)}
                alt={tenant.name}
                className="w-20 h-20 rounded-xl object-cover border border-gray-100"
                onError={e => {
                  e.target.style.display = 'none'
                  e.target.nextSibling.style.display = 'flex'
                }}
              />
            ) : null}
            <div
              className="w-20 h-20 rounded-xl bg-indigo-100 items-center justify-center text-indigo-600 text-3xl font-bold"
              style={{ display: tenant.photo_url ? 'none' : 'flex' }}>
              {tenant.name.charAt(0).toUpperCase()}
            </div>
          </div>

          <div className="flex-1">
            <div className="flex items-start justify-between">
              <div>
                <h1 className="text-xl font-bold text-gray-800">{tenant.name}</h1>
                <span className={`text-xs px-2 py-1 rounded-full font-medium mt-1 inline-block ${
                  tenant.status === 'Active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                }`}>
                  {tenant.status}
                </span>
              </div>
              {tenant.status === 'Active' && (
                <button onClick={markVacated} className="text-xs text-red-500 border border-red-200 px-3 py-1.5 rounded-lg hover:bg-red-50">
                  Mark Vacated
                </button>
              )}
            </div>
            <div className="mt-3 space-y-1.5 text-sm text-gray-600">
              <p className="flex items-center gap-2"><Phone size={14} /> {tenant.phone}</p>
              <p className="flex items-center gap-2"><Calendar size={14} /> Joined {new Date(tenant.joining_date).toLocaleDateString('en-IN')}</p>
              {tenant.vacated_date && (
                <p className="flex items-center gap-2 text-red-500"><Calendar size={14} /> Vacated {new Date(tenant.vacated_date).toLocaleDateString('en-IN')}</p>
              )}
              {tenant.room && (
                <p className="flex items-center gap-2"><Home size={14} /> Room {tenant.room.room_number} ({tenant.room.sharing_type}-sharing) · ₹{tenant.room.base_rent}/mo</p>
              )}
            </div>
          </div>
        </div>

        <div className="mt-4 pt-4 border-t border-gray-100 grid grid-cols-2 gap-3 text-sm">
          <div><span className="text-gray-500">Aadhaar:</span> <span className="font-medium">{tenant.aadhaar_number}</span></div>
          {tenant.emergency_contact && <div><span className="text-gray-500">Emergency:</span> <span className="font-medium">{tenant.emergency_contact}</span></div>}
        </div>

        {tenant.aadhaar_pdf_url && (
          <div className="mt-4 pt-4 border-t border-gray-100">
            <p className="text-sm text-gray-500 mb-2">Aadhaar Document</p>
            <a href={getImageUrl(tenant.aadhaar_pdf_url)} target="_blank" rel="noreferrer"
              className="inline-flex items-center gap-2 text-sm text-indigo-600 hover:underline border border-indigo-200 px-3 py-2 rounded-lg">
              📄 View Aadhaar PDF
            </a>
          </div>
        )}
      </div>

      {/* FIX: Payment summary showing correct amounts */}
      {payments && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
          <h2 className="font-semibold text-gray-800 mb-4 flex items-center gap-2">
            <IndianRupee size={16} className="text-indigo-600" /> Payment History
          </h2>

          {/* Summary cards */}
          <div className="grid grid-cols-3 gap-3 mb-4">
            {[
              { label: 'Total Paid',    value: `₹${payments.total_paid?.toLocaleString('en-IN')}`,    color: 'text-green-600' },
              { label: 'Total Billed',  value: `₹${payments.total_due?.toLocaleString('en-IN')}`,     color: 'text-gray-800' },
              { label: 'Pending',       value: `₹${payments.total_pending?.toLocaleString('en-IN')}`, color: 'text-red-500' },
            ].map(({ label, value, color }) => (
              <div key={label} className="text-center p-3 bg-gray-50 rounded-lg">
                <p className="text-xs text-gray-500">{label}</p>
                <p className={`font-bold text-lg ${color}`}>{value}</p>
              </div>
            ))}
          </div>

          {/* Per-month payment rows */}
          <div className="space-y-2">
            {payments.payments?.map(p => (
              <div key={p.payment_id} className="p-3 border border-gray-100 rounded-lg text-sm">
                <div className="flex items-center justify-between mb-2">
                  <p className="font-semibold text-gray-700">{p.month_year}</p>
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                    p.balance === 0 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'
                  }`}>
                    {p.balance === 0 ? '✓ Cleared' : `₹${p.balance} pending`}
                  </span>
                </div>

                {/* Breakdown */}
                <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 text-xs text-gray-500">
                  <span className="flex items-center gap-1"><Home size={10}/> Rent</span>
                  <span className="text-right">₹{p.due_amount}</span>

                  {p.electricity_amount > 0 && <>
                    <span className="flex items-center gap-1"><Zap size={10} className="text-yellow-500"/> Electricity</span>
                    <span className="text-right text-yellow-600">₹{p.electricity_amount}</span>
                  </>}

                  {p.additional_amount > 0 && <>
                    <span className="flex items-center gap-1"><Droplets size={10} className="text-blue-500"/> Other charges</span>
                    <span className="text-right text-blue-600">₹{p.additional_amount}</span>
                  </>}

                  {p.arrears > 0 && <>
                    <span className="text-orange-500">Previous arrears</span>
                    <span className="text-right text-orange-500">₹{p.arrears}</span>
                  </>}

                  <span className="font-semibold text-gray-700 pt-1 border-t border-gray-100 mt-1">Total Due</span>
                  <span className="text-right font-semibold text-gray-700 pt-1 border-t border-gray-100 mt-1">₹{p.total_due + p.arrears}</span>

                  <span className="text-green-600 font-medium">Paid</span>
                  <span className="text-right text-green-600 font-medium">₹{p.amount_paid}</span>
                </div>

                {p.payment_date && (
                  <p className="text-xs text-gray-400 mt-2">
                    Paid on {new Date(p.payment_date).toLocaleDateString('en-IN')}
                    {p.transaction_id && ` · Ref: ${p.transaction_id}`}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
export default TenantProfile
