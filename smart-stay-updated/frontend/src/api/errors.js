export function apiErrorMessage(error, fallback = 'Something went wrong') {
  const detail = error?.response?.data?.detail
  if (typeof detail === 'string' && detail.trim()) return detail
  if (Array.isArray(detail)) {
    const messages = detail.map(item => item?.msg).filter(Boolean)
    if (messages.length) return messages.join(' · ')
  }
  if (!error?.response) return 'Could not reach the server. Check your connection and try again.'
  return fallback
}
