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

  if (loading) return <div className="grid min-h-screen place-items-center bg-[#f5f7fc] text-sm font-semibold text-slate-500">Loading secure payment…</div>
  if (error) return <div className="grid min-h-screen place-items-center bg-[#f5f7fc] p-5"><div className="card max-w-md p-7 text-center"><div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-rose-50"><TriangleAlert className="text-rose-500"/></div><h1 className="mt-4 text-lg font-black tracking-tight">Payment link unavailable</h1><p className="mt-2 text-sm leading-6 text-slate-500">{error}</p></div></div>

  const status = request.status
  return (
    <main className="relative min-h-screen overflow-hidden bg-[#f5f7fc] px-4 py-6 sm:py-10">
      <div className="pointer-events-none absolute -right-32 -top-32 h-96 w-96 rounded-full bg-violet-200/40 blur-3xl"/>
      <div className="pointer-events-none absolute -bottom-40 -left-32 h-96 w-96 rounded-full bg-cyan-100/50 blur-3xl"/>
      <div className="mx-auto max-w-md space-y-4">
        <header className="relative flex items-center justify-center gap-3 py-2">
          <div className="grid h-11 w-11 place-items-center rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 text-white shadow-lg shadow-indigo-200"><Building2 size={20}/></div>
          <div><p className="text-xs font-black uppercase tracking-[.16em] text-indigo-600">Smart Stay</p><h1 className="font-extrabold text-slate-950">{request.hostel_name}</h1></div>
        </header>

        <section className="card relative overflow-hidden">
          <div className="relative overflow-hidden bg-slate-950 p-6 text-center text-white">
            <div className="pointer-events-none absolute -right-16 -top-20 h-48 w-48 rounded-full bg-violet-500/40 blur-3xl"/>
            <div className="relative"><p className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-indigo-300">Secure payment for</p>
            <h2 className="mt-1.5 text-xl font-black tracking-tight">{request.tenant_name}</h2>
            <p className="mt-1 text-sm text-slate-400">{request.tenant_phone} · Room {request.room_number || '—'}</p>
            <p className="mt-5 text-4xl font-black tracking-[-0.055em] text-money">₹{fmt(request.amount)}</p>
            <p className="mt-1.5 text-xs font-medium text-slate-400">Rent bill · {request.month_year} · Due {new Date(`${request.due_date}T00:00:00`).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}</p></div>
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
                    <div className="mx-auto w-fit rounded-[22px] border border-indigo-100 bg-white p-3 shadow-[0_16px_35px_-22px_rgba(79,70,229,0.45)]"><img src={apiAssetUrl(request.qr_image_url)} alt="Tenant-specific UPI payment QR" className="h-60 w-60 max-w-full rounded-xl"/></div>
                    <div className="mt-3 rounded-xl bg-indigo-50 p-3 text-center text-xs leading-5 text-indigo-900 ring-1 ring-inset ring-indigo-100">Confirm the payment app shows <strong>{request.tenant_name}</strong>, <strong>{request.tenant_phone}</strong> and <strong>₹{fmt(request.amount)}</strong>.</div>
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
