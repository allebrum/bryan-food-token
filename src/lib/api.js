const KEY = 'foodtoken.userId'

export const session = {
  get: () => {
    try { return localStorage.getItem(KEY) } catch { return null }
  },
  set: (id) => {
    try { localStorage.setItem(KEY, id) } catch { /* private mode */ }
  },
  clear: () => {
    try { localStorage.removeItem(KEY) } catch { /* private mode */ }
  },
}

export class ApiError extends Error {
  constructor(message, status) {
    super(message)
    this.status = status
  }
}

export async function api(path, { method = 'GET', body } = {}) {
  const headers = { 'content-type': 'application/json' }
  const id = session.get()
  if (id) headers['x-user-id'] = id
  const res = await fetch(`/api${path}`, { method, headers, body: body ? JSON.stringify(body) : undefined })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new ApiError(data.error || 'Something went wrong. Please try again.', res.status)
  return data
}
