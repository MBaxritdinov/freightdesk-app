// Single source of truth for the auth token
// Holds it in memory so there's no localStorage timing issue

let _token = localStorage.getItem('token') || null

export function getToken() {
  return _token
}

export function setToken(token) {
  _token = token
  localStorage.setItem('token', token)
}

export function clearToken() {
  _token = null
  localStorage.removeItem('token')
}
