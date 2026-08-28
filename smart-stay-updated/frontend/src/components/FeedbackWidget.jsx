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
        className="fixed bottom-20 right-4 md:bottom-5 md:right-5 z-50 w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-blue-600 text-white shadow-lg flex items-center justify-center hover:bg-blue-700 active:scale-95 transition-all"
      >
        <MessageCircle size={24} />
      </button>

      {/* Modal */}
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={close} />
          <div className="relative z-10 w-full max-w-sm bg-white rounded-2xl shadow-xl p-5 animate-in">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-slate-900 text-base">Share your feedback</h3>
              <button onClick={close} className="p-1 rounded-lg text-slate-400 hover:bg-slate-100">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={submit} className="space-y-3">
              <div>
                <label className="text-xs font-medium text-slate-500">Your name</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Enter your name"
                  className="mt-1 w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-500">Your feedback</label>
                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Tell us what you think..."
                  rows={4}
                  className="mt-1 w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full flex items-center justify-center gap-2 bg-blue-600 text-white text-sm font-medium py-2.5 rounded-xl hover:bg-blue-700 disabled:opacity-60 transition-all"
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
