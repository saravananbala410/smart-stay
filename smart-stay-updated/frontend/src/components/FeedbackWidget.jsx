import { useState } from 'react'
import { MessageCircle, X, Send } from 'lucide-react'
import toast from 'react-hot-toast'
import api from '../api/axios'

export default function FeedbackWidget() {
  const [open, setOpen]       = useState(false)
  const [name, setName]       = useState('')
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)

  const close = () => {
    setOpen(false)
    setName('')
    setMessage('')
  }

  const submit = async (e) => {
    e.preventDefault()
    if (!name.trim() || !message.trim()) {
      toast.error('Please enter your name and feedback')
      return
    }
    setLoading(true)
    try {
      await api.post('/feedback', { name: name.trim(), message: message.trim() })
      toast.success(`Thank you for your valuable feedback by "${name.trim()}"`)
      close()
    } catch (err) {
      toast.error('Could not submit feedback. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      {/* Floating icon button — visible on every screen, any device */}
      <button
        onClick={() => setOpen(true)}
        aria-label="Give feedback"
        className="fixed bottom-[92px] right-4 z-50 flex h-12 w-12 items-center justify-center rounded-2xl border border-white/20 bg-gradient-to-br from-indigo-500 to-violet-600 text-white shadow-[0_16px_32px_-12px_rgba(79,70,229,0.7)] transition-all hover:-translate-y-0.5 hover:shadow-[0_20px_36px_-12px_rgba(79,70,229,0.8)] active:scale-95 md:bottom-5 md:right-5 sm:h-14 sm:w-14"
      >
        <MessageCircle size={24} />
      </button>

      {/* Modal */}
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-950/55 backdrop-blur-[6px]" onClick={close} />
          <div className="card relative z-10 w-full max-w-sm rounded-[24px] p-5 shadow-[0_30px_90px_-25px_rgba(15,23,42,0.5)] animate-in sm:p-6">
            <div className="flex items-center justify-between mb-4">
              <div><p className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-indigo-500">Help us improve</p><h3 className="mt-1 text-lg font-black tracking-tight text-slate-950">Share your feedback</h3></div>
              <button onClick={close} className="btn-icon">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={submit} className="space-y-3">
              <div>
                <label className="label">Your name</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Enter your name"
                  className="input"
                />
              </div>
              <div>
                <label className="label">Your feedback</label>
                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Tell us what you think..."
                  rows={4}
                  className="input min-h-28 resize-none"
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="btn-primary w-full"
              >
                <Send size={15} />
                {loading ? 'Submitting...' : 'Submit feedback'}
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  )
}
