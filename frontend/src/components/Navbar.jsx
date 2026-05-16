import { useState, useEffect, useRef, useCallback } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import axios from 'axios'
import { getToken, clearToken } from '../auth'

const API = axios.create({ baseURL: import.meta.env.VITE_API_URL || 'http://localhost:8000' })
API.interceptors.request.use(config => {
  const token = getToken()
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

const LINKS = [
  { to: '/dashboard', label: 'Dashboard' },
  { to: '/loads', label: 'Loads' },
  { to: '/drivers', label: 'Drivers' },
  { to: '/brokers', label: 'Brokers' },
  { to: '/users', label: 'Users', haOnly: true },
  { to: '/reports', label: 'Reports' },
  { to: '/settings', label: 'Settings' },
]

function fmtRelTime(iso) {
  if (!iso) return ''
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

// ── Global Search ─────────────────────────────────────────────────────────────

function SearchBar({ navigate }) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState(null)
  const [open, setOpen] = useState(false)
  const [searching, setSearching] = useState(false)
  const containerRef = useRef(null)
  const timerRef = useRef(null)

  const search = useCallback(async (q) => {
    if (q.trim().length < 2) { setResults(null); setOpen(false); return }
    setSearching(true)
    try {
      const res = await API.get('/search', { params: { q: q.trim() } })
      setResults(res.data)
      setOpen(true)
    } catch {
      setResults(null)
    } finally {
      setSearching(false)
    }
  }, [])

  function handleChange(e) {
    const val = e.target.value
    setQuery(val)
    clearTimeout(timerRef.current)
    if (val.trim().length < 2) { setResults(null); setOpen(false); return }
    timerRef.current = setTimeout(() => search(val), 300)
  }

  function handleKeyDown(e) {
    if (e.key === 'Escape') { setOpen(false); setQuery('') }
  }

  function handleNavigate(path) {
    setOpen(false)
    setQuery('')
    setResults(null)
    navigate(path)
  }

  useEffect(() => {
    function handleClick(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  const hasResults = results && (results.loads.length > 0 || results.drivers.length > 0 || results.brokers.length > 0)

  return (
    <div ref={containerRef} className="relative w-64">
      <div className="relative">
        <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        <input
          value={query}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          onFocus={() => { if (results && query.length >= 2) setOpen(true) }}
          placeholder="Search loads, drivers…"
          className="w-full pl-9 pr-3 py-1.5 bg-slate-700 border border-slate-600 rounded-lg text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 transition"
        />
        {searching && (
          <svg className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin h-3 w-3 text-slate-400" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
          </svg>
        )}
      </div>

      {open && (
        <div className="absolute top-full mt-2 left-0 right-0 bg-slate-800 border border-slate-700 rounded-xl shadow-2xl z-50 overflow-hidden">
          {!hasResults ? (
            <p className="text-sm text-slate-500 text-center py-6">No results found</p>
          ) : (
            <div className="max-h-80 overflow-y-auto">
              {results.loads.length > 0 && (
                <div>
                  <p className="text-xs text-slate-500 uppercase tracking-wide px-4 pt-3 pb-1">Loads</p>
                  {results.loads.map(l => (
                    <button
                      key={l.id}
                      onClick={() => handleNavigate(`/loads/${l.id}`)}
                      className="w-full text-left px-4 py-2.5 hover:bg-slate-700/50 transition flex items-center gap-3"
                    >
                      <span className="text-white font-mono text-xs font-semibold shrink-0">{l.load_number}</span>
                      <span className="text-slate-400 text-xs truncate">
                        {l.broker_name}
                        {(l.pu_location || l.del_location) && ` · ${l.pu_location ?? ''}${l.pu_location && l.del_location ? ' → ' : ''}${l.del_location ?? ''}`}
                      </span>
                    </button>
                  ))}
                </div>
              )}
              {results.drivers.length > 0 && (
                <div>
                  <p className="text-xs text-slate-500 uppercase tracking-wide px-4 pt-3 pb-1">Drivers</p>
                  {results.drivers.map(d => (
                    <button
                      key={d.id}
                      onClick={() => handleNavigate('/drivers')}
                      className="w-full text-left px-4 py-2.5 hover:bg-slate-700/50 transition"
                    >
                      <span className="text-white text-sm">👤 {d.name}</span>
                    </button>
                  ))}
                </div>
              )}
              {results.brokers.length > 0 && (
                <div>
                  <p className="text-xs text-slate-500 uppercase tracking-wide px-4 pt-3 pb-1">Brokers</p>
                  {results.brokers.map(b => (
                    <button
                      key={b.id}
                      onClick={() => handleNavigate(`/loads?broker=${b.id}`)}
                      className="w-full text-left px-4 py-2.5 hover:bg-slate-700/50 transition"
                    >
                      <span className="text-white text-sm">🏢 {b.name}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── Navbar ────────────────────────────────────────────────────────────────────

export default function Navbar({ active, user, onLogout }) {
  const roleLabel = user?.role?.replace('_', ' ')
  const [notifs, setNotifs] = useState([])
  const [open, setOpen] = useState(false)
  const dropdownRef = useRef(null)
  const navigate = useNavigate()

  useEffect(() => {
    if (!user) return
    fetchNotifs()
    const interval = setInterval(fetchNotifs, 30000)
    return () => clearInterval(interval)
  }, [user])

  useEffect(() => {
    if (!open) return
    function handleClickOutside(e) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [open])

  async function fetchNotifs() {
    try {
      const res = await API.get('/notifications')
      setNotifs(res.data)
    } catch {}
  }

  async function handleMarkRead() {
    try {
      await API.post('/notifications/read')
      setNotifs(ns => ns.map(n => ({ ...n, is_read: true })))
    } catch {}
  }

  function handleNotifClick(notif) {
    setOpen(false)
    if (notif.link) navigate(notif.link)
  }

  const unread = notifs.filter(n => !n.is_read).length
  const visibleLinks = LINKS.filter(l => !l.haOnly || user?.role === 'HEAD_ACCOUNTANT')

  return (
    <nav className="bg-slate-800 border-b border-slate-700">
      <div className="max-w-7xl mx-auto px-6 py-3 flex items-center gap-4">
        {/* Left: logo + nav links */}
        <div className="flex items-center gap-4 shrink-0">
          <h1 className="text-lg font-bold text-white">FreightDesk</h1>
          <div className="flex items-center gap-1">
            {visibleLinks.map(({ to, label }) => (
              <Link
                key={to}
                to={to}
                className={`px-3 py-1.5 text-sm rounded-md transition ${
                  active === label ? 'text-white bg-slate-700' : 'text-slate-400 hover:text-white hover:bg-slate-700'
                }`}
              >
                {label}
              </Link>
            ))}
          </div>
        </div>

        {/* Center: search */}
        <div className="flex-1 flex justify-center">
          <SearchBar navigate={navigate} />
        </div>

        {/* Right: bell + user + logout */}
        <div className="flex items-center gap-3 shrink-0">
          <div className="relative" ref={dropdownRef}>
            <button
              onClick={() => setOpen(o => !o)}
              className="relative p-1.5 rounded-md text-slate-400 hover:text-white hover:bg-slate-700 transition"
              aria-label="Notifications"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
              </svg>
              {unread > 0 && (
                <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-4 h-4 flex items-center justify-center font-bold leading-none">
                  {unread > 9 ? '9+' : unread}
                </span>
              )}
            </button>

            {open && (
              <div className="absolute right-0 top-full mt-2 w-80 bg-slate-800 border border-slate-700 rounded-xl shadow-2xl z-50 overflow-hidden">
                <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700">
                  <span className="text-sm font-semibold text-white">Notifications</span>
                  {unread > 0 && (
                    <button onClick={handleMarkRead} className="text-xs text-blue-400 hover:text-blue-300 transition">Mark all read</button>
                  )}
                </div>
                <div className="max-h-80 overflow-y-auto divide-y divide-slate-700/50">
                  {notifs.length === 0 ? (
                    <p className="text-sm text-slate-500 text-center py-8">No notifications yet</p>
                  ) : (
                    notifs.slice(0, 10).map(n => (
                      <button
                        key={n.id}
                        onClick={() => handleNotifClick(n)}
                        className={`w-full text-left px-4 py-3 hover:bg-slate-700/40 transition flex gap-3 items-start ${!n.is_read ? 'bg-slate-700/20' : ''}`}
                      >
                        <span className={`mt-1.5 w-2 h-2 rounded-full shrink-0 ${n.is_read ? 'bg-slate-600' : 'bg-blue-400'}`} />
                        <div className="min-w-0">
                          <p className={`text-xs leading-snug ${n.is_read ? 'text-slate-400' : 'text-white'}`}>{n.message}</p>
                          <p className="text-xs text-slate-600 mt-0.5">{fmtRelTime(n.created_at)}</p>
                        </div>
                      </button>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>

          {user && (
            <span className="text-sm text-slate-400">
              {user.name} &middot; <span className="text-blue-400">{roleLabel}</span>
            </span>
          )}
          <button onClick={onLogout} className="text-sm text-slate-400 hover:text-white transition">Logout</button>
        </div>
      </div>
    </nav>
  )
}
