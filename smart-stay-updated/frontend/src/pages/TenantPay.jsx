import { useCallback, useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { Building2, CheckCircle2, Clock3, Download, ExternalLink, ShieldCheck, TriangleAlert } from 'lucide-react'
import api, { apiAssetUrl } from '../api/axios'
import toast from 'react-hot-toast'

const fmt = value => Number(value || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

export default function TenantPay() {
  const { token } = useParams()
  const [request, setRequest] = useState(null)
  const [reference, setReference] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    try {
      const { data } = await api.get(`/payments/payment-request/${token}`)
      setRequest(data)
      setError('')
    } catch (err) {
      setError(err.response?.data?.detail || 'This payment link is invalid or unavailable.')
    } finally { setLoading(false) }
  }, [token])

  useEffect(() => { load() }, [load])
  useEffect(() => {
    if (!request || !['PENDING', 'SUBMITTED'].includes(request.status)) return
    const timer = setInterval(load, 15000)
    return () => clearInterval(timer)
  }, [request?.status, load])

  const submitReference = async event => {
    event.preventDefault()
    try {
      const { data } = await api.post(`/payments/payment-request/${token}/submit`, { payer_reference: reference })
      setRequest(data)
      toast.success('Reference sent to admin for verification')
    } catch (err) { toast.error(err.response?.data?.detail || 'Could not submit reference') }
  }

  if (loading) return <div className="grid min-h-screen place-items-center bg-[#f6f5ef] text-sm text-slate-500">Loading secure payment…</div>
  if (error) return <div className="grid min-h-screen place-items-center bg-[#f6f5ef] p-5"><div className="card max-w-md p-6 text-center"><TriangleAlert className="mx-auto text-rose-500"/><h1 className="mt-3 font-bold">Payment link unavailable</h1><p className="mt-2 text-sm text-slate-500">{error}</p></div></div>

  const status = request.status
  return (
    <main className="min-h-screen bg-[#f6f5ef] px-4 py-6 sm:py-10">
      <div className="mx-auto max-w-md space-y-4">
        <header className="flex items-center justify-center gap-3 py-2">
          <div className="grid h-11 w-11 place-items-center rounded-2xl bg-[#073c34] text-[#f0b35a]"><Building2 size={20}/></div>
          <div><p className="text-xs font-bold uppercase tracking-[.16em] text-blue-800">Smart Stay</p><h1 className="font-bold text-slate-900">{request.hostel_name}</h1></div>
        </header>

        <section className="card overflow-hidden">
          <div className="bg-[#073c34] p-5 text-center text-white">
            <p className="text-xs font-bold uppercase tracking-wide text-emerald-100/70">Payment for</p>
            <h2 className="mt-1 text-xl font-bold">{request.tenant_name}</h2>
            <p className="mt-1 text-sm text-emerald-100">{request.tenant_phone} · Room {request.room_number || '—'}</p>
            <p className="mt-5 text-4xl font-bold text-money">₹{fmt(request.amount)}</p>
            <p className="mt-1 text-xs text-emerald-100/70">Rent bill · {request.month_year} · Due {new Date(`${request.due_date}T00:00:00`).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}</p>
          </div>

          <div className="p-5">
            {status === 'VERIFIED' ? (
              <div className="text-center">
                <CheckCircle2 size={50} className="mx-auto text-emerald-600"/>
                <h3 className="mt-3 text-lg font-bold text-emerald-800">Payment received</h3>
                <p className="mt-1 text-sm text-slate-500">Admin verified your payment. Your receipt is ready.</p>
                <a href={apiAssetUrl(request.receipt_url)} className="btn-primary mt-5 w-full"><Download size={16}/> Download PDF receipt</a>
              </div>
            ) : status === 'FAILED' ? (
              <div className="rounded-2xl bg-rose-50 p-4 text-center"><TriangleAlert className="mx-auto text-rose-500"/><h3 className="mt-2 font-bold text-rose-800">Payment verification failed</h3><p className="mt-1 text-sm text-rose-700">{request.failure_reason || 'Please contact your hostel admin before trying again.'}</p></div>
            ) : (
              <>
                {request.upi_configured ? (
                  <>
                    <div className="mx-auto w-fit rounded-2xl border border-slate-200 bg-white p-3"><img src={apiAssetUrl(request.qr_image_url)} alt="Tenant-specific UPI payment QR" className="h-60 w-60 max-w-full"/></div>
                    <div className="mt-3 rounded-xl bg-blue-50 p-3 text-center text-xs leading-5 text-blue-900">Check the payment app shows <strong>{request.tenant_name}</strong>, <strong>{request.tenant_phone}</strong> and <strong>₹{fmt(request.amount)}</strong>.</div>
                    <a href={request.upi_url} className="btn-primary mt-3 w-full"><ExternalLink size={16}/> Pay with UPI app</a>
                  </>
                ) : <div className="rounded-xl bg-amber-50 p-4 text-sm text-amber-800">Online UPI is not configured. Please contact the hostel admin.</div>}

                <div className="my-5 flex items-center gap-3"><div className="h-px flex-1 bg-slate-200"/><span className="text-[11px] font-bold uppercase text-slate-400">After payment</span><div className="h-px flex-1 bg-slate-200"/></div>
                {status === 'SUBMITTED' ? (
                  <div className="rounded-2xl bg-amber-50 p-4 text-center"><Clock3 className="mx-auto text-amber-600"/><h3 className="mt-2 font-bold text-amber-800">Waiting for admin verification</h3><p className="mt-1 text-xs text-amber-700">Reference {request.payer_reference}. This page checks status automatically.</p></div>
                ) : (
                  <form onSubmit={submitReference}>
                    <label className="label" htmlFor="upi-reference">UPI transaction reference</label>
                    <input id="upi-reference" className="input" required minLength={4} maxLength={100} value={reference} onChange={e => setReference(e.target.value)} placeholder="Enter 12-digit UPI reference"/>
                    <button className="btn-success mt-3 w-full"><ShieldCheck size={16}/> Send for verification</button>
                  </form>
                )}
              </>
            )}
          </div>
        </section>
        <p className="px-4 text-center text-xs leading-5 text-slate-400">Submitting a reference does not mark the bill paid. The receipt appears only after the hostel admin verifies the money received.</p>
      </div>
    </main>
  )
}
