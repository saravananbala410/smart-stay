import { useEffect, useState } from 'react'
import { MessageSquarePlus, Send, X, UserRound } from 'lucide-react'
import toast from 'react-hot-toast'
import api from '../api/axios'

const THANK_YOU = 'Thank you for your valuable feedback by Saro'

export default function FeedbackWidget() {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [feedbacks, setFeedbacks] = useState([])
  const [form, setForm] = useState({ name: '', message: '' })
  const [thankYou, setThankYou] = useState(false)

  const loadFeedbacks = async () => {
    setLoading(true)
    try {
      const { data } = await api.get('/feedback/')
      setFeedbacks(data)
    } catch {
      toast.error('Failed to load feedback')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (open) loadFeedbacks()
  }, [open])

  const submitFeedback = async e => {
    e.preventDefault()
    const name = form.name.trim()
    const message = form.message.trim()
    if (!name || !message) {
      toast.error('Name and feedback are required')
      return
    }

    setSubmitting(true)
    setThankYou(false)

    try {
      const { data } = await api.post('/feedback/', {
        name,
        message,
        device: navigator.userAgent
      })
      setFeedbacks([data, ...feedbacks])
      setForm({ name: '', message: '' })
      setThankYou(true)
      toast.success(THANK_YOU)
    } catch {
      toast.error('Failed to submit feedback')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        title="Feedback"
        aria-label="Open feedback"
        className="fixed bottom-5 right-5 z-30 h-12 w-12 rounded-full bg-blue-600 text-white shadow-lg shadow-blue-900/20 flex items-center justify-center hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-all"
      >
        <MessageSquarePlus size={21} />
      </button>

      {open && (
        <div className="modal-overlay">
          <div className="modal-box max-w-lg p-0">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-blue-50 rounded-lg">
                  <MessageSquarePlus size={15} className="text-blue-600" />
                </div>
                <h2 className="font-bold text-slate-900 text-sm">Feedback</h2>
              </div>
              <button onClick={() => setOpen(false)} className="btn-icon" aria-label="Close feedback">
                <X size={18} />
              </button>
            </div>

            <div className="px-5 py-4 space-y-4">
              {thankYou && (
                <div className="rounded-xl border border-emerald-100 bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-700">
                  {THANK_YOU}
                </div>
              )}

              <form onSubmit={submitFeedback} className="space-y-3">
                <div>
                  <label className="label">Your name</label>
                  <input
                    className="input"
                    required
                    maxLength={100}
                    placeholder="Enter name"
                    value={form.name}
                    onChange={e => setForm({ ...form, name: e.target.value })}
                  />
                </div>
                <div>
                  <label className="label">Feedback</label>
                  <textarea
                    className="input min-h-[96px] resize-none"
                    required
                    placeholder="Type feedback"
                    value={form.message}
                    onChange={e => setForm({ ...form, message: e.target.value })}
                  />
                </div>
                <button
                  type="submit"
                  disabled={submitting}
                  className="btn-primary w-full justify-center py-2.5"
                >
                  <Send size={14} /> {submitting ? 'Submitting...' : 'Submit Feedback'}
                </button>
              </form>

              <div className="border-t border-slate-100 pt-4">
                <p className="section-eyebrow mb-2">Feedback section</p>
                {loading ? (
                  <div className="py-6 text-center text-sm text-slate-300">Loading feedback...</div>
                ) : feedbacks.length === 0 ? (
                  <div className="py-6 text-center text-sm text-slate-300">No feedback yet.</div>
                ) : (
                  <div className="max-h-64 space-y-2 overflow-y-auto pr-1">
                    {feedbacks.map(item => (
                      <div key={item.feedback_id} className="rounded-xl border border-slate-100 bg-slate-50/70 p-3">
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex min-w-0 items-center gap-2">
                            <div className="h-7 w-7 rounded-full bg-white flex items-center justify-center text-slate-400">
                              <UserRound size={14} />
                            </div>
                            <p className="truncate text-sm font-semibold text-slate-800">{item.name}</p>
                          </div>
                          <span className="flex-shrink-0 text-[11px] text-slate-400">
                            {new Date(item.created_at).toLocaleDateString('en-IN')}
                          </span>
                        </div>
                        <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-5 text-slate-600">
                          {item.message}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
