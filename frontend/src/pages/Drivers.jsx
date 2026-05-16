import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import axios from 'axios'
import { getToken, clearToken } from '../auth'
import Navbar from '../components/Navbar'

const API = axios.create({ baseURL: import.meta.env.VITE_API_URL || 'http://localhost:8000' })

API.interceptors.request.use(config => {
  const token = getToken()
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

function redirectOnUnauth(err, navigate) {
  if (err.response?.status === 401) {
    clearToken()
    navigate('/login', { replace: true })
  }
}

function Spinner() {
  return (
    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
    </svg>
  )
}

function fmt(v) {
  return '$' + Number(v).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function TypeBadge({ type }) {
  const cls =
    type === 'COMPANY'
      ? 'bg-blue-500/20 text-blue-400 border-blue-500/30'
      : 'bg-purple-500/20 text-purple-400 border-purple-500/30'
  const label = type === 'COMPANY' ? 'Company' : 'Owner Op'
  return (
    <span className={`px-2 py-0.5 rounded text-xs font-medium border ${cls}`}>{label}</span>
  )
}

// ── Settlement Modal ──────────────────────────────────────────────────────────

function SettlementModal({ driver, onClose, onDriverUpdated }) {
  const [summary, setSummary] = useState(null)
  const [summaryLoading, setSummaryLoading] = useState(true)
  const [summaryError, setSummaryError] = useState('')
  const [chatId, setChatId] = useState(driver.telegram_chat_id || '')
  const [savingId, setSavingId] = useState(false)
  const [idSaved, setIdSaved] = useState(false)
  const [sending, setSending] = useState(false)
  const [sendResult, setSendResult] = useState(null)
  const navigate = useNavigate()

  useEffect(() => { fetchSummary() }, [])

  async function fetchSummary() {
    setSummaryLoading(true)
    setSummaryError('')
    try {
      const res = await API.get(`/settlements/summary/${driver.id}`)
      setSummary(res.data)
    } catch (err) {
      redirectOnUnauth(err, navigate)
      setSummaryError(err.response?.data?.detail || 'Failed to load summary')
    } finally {
      setSummaryLoading(false)
    }
  }

  async function handleSaveId() {
    setSavingId(true)
    setIdSaved(false)
    try {
      await API.patch(`/drivers/${driver.id}/telegram`, { telegram_chat_id: chatId.trim() || null })
      setIdSaved(true)
      onDriverUpdated()
    } catch (err) {
      redirectOnUnauth(err, navigate)
    } finally {
      setSavingId(false)
    }
  }

  async function handleSend() {
    setSending(true)
    setSendResult(null)
    try {
      const currentSaved = driver.telegram_chat_id || ''
      if (chatId.trim() !== currentSaved) {
        await API.patch(`/drivers/${driver.id}/telegram`, { telegram_chat_id: chatId.trim() || null })
        onDriverUpdated()
      }
      const res = await API.post(`/settlements/send/${driver.id}`)
      setSendResult({ success: true, ...res.data })
    } catch (err) {
      redirectOnUnauth(err, navigate)
      setSendResult({ error: err.response?.data?.detail || 'Send failed' })
    } finally {
      setSending(false)
    }
  }

  const inp = 'flex-1 bg-slate-700 border border-slate-600 rounded px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500 transition'

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-slate-800 rounded-xl border border-slate-700 w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-slate-700">
          <div>
            <h2 className="text-lg font-semibold text-white">Weekly Settlement</h2>
            <p className="text-sm text-slate-400 mt-0.5">{driver.name}</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white text-2xl leading-none transition">&times;</button>
        </div>

        <div className="p-6 space-y-5">
          {summaryLoading ? (
            <div className="flex items-center gap-2 text-slate-500 text-sm"><Spinner /><span>Loading summary…</span></div>
          ) : summaryError ? (
            <p className="text-red-400 text-sm">{summaryError}</p>
          ) : summary && (
            <>
              <div className="flex items-center justify-between text-xs text-slate-400 uppercase tracking-wide mb-0.5">
                <span>Week</span>
                <span className="text-slate-300 normal-case tracking-normal">{summary.week_start} – {summary.week_end}</span>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-slate-700/50 rounded-lg p-3 border border-slate-600/50 text-center">
                  <p className="text-xs text-slate-400 mb-1">Loads</p>
                  <p className="text-2xl font-bold text-white">{summary.load_count}</p>
                </div>
                <div className="bg-slate-700/50 rounded-lg p-3 border border-slate-600/50 text-center">
                  <p className="text-xs text-slate-400 mb-1">Gross</p>
                  <p className="text-base font-bold text-white">{fmt(summary.total_gross)}</p>
                </div>
                <div className="bg-slate-700/50 rounded-lg p-3 border border-slate-600/50 text-center">
                  <p className="text-xs text-slate-400 mb-1">Net</p>
                  <p className="text-base font-bold text-green-400">{fmt(summary.total_net)}</p>
                </div>
              </div>
              {summary.loads.length > 0 ? (
                <div>
                  <p className="text-xs text-slate-400 uppercase tracking-wide mb-2">Loads this week</p>
                  <div className="space-y-1.5 max-h-44 overflow-y-auto pr-1">
                    {summary.loads.map(l => (
                      <div key={l.load_number} className="flex items-center justify-between text-sm px-3 py-2 bg-slate-700/30 rounded border border-slate-600/30">
                        <span className="text-white font-mono text-xs">{l.load_number}</span>
                        <div className="flex items-center gap-3">
                          <span className="text-slate-400 text-xs">{l.broker_name}</span>
                          <span className="text-slate-300 text-xs">{fmt(l.gross_rate)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <p className="text-sm text-slate-500">No loads this week.</p>
              )}
            </>
          )}

          <div className="border-t border-slate-700 pt-4 space-y-3">
            <p className="text-sm font-medium text-white">Send via Telegram</p>
            <div>
              <label className="block text-xs text-slate-400 mb-1.5">Driver's Telegram Chat ID</label>
              <div className="flex gap-2">
                <input
                  value={chatId}
                  onChange={e => { setChatId(e.target.value); setIdSaved(false) }}
                  placeholder="e.g. 123456789"
                  className={inp}
                />
                <button
                  onClick={handleSaveId}
                  disabled={savingId}
                  className="px-3 py-2 bg-slate-600 hover:bg-slate-500 disabled:opacity-50 text-white text-sm rounded border border-slate-500 transition shrink-0"
                >
                  {savingId ? '…' : idSaved ? '✓ Saved' : 'Save'}
                </button>
              </div>
            </div>
            <button
              onClick={handleSend}
              disabled={sending || !chatId.trim()}
              className="w-full px-4 py-2.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white text-sm rounded-lg font-medium transition flex items-center justify-center gap-2"
            >
              {sending && <Spinner />}
              {sending ? 'Sending…' : 'Send Settlement via Telegram'}
            </button>
            {sendResult && (
              <div className={`px-3 py-2.5 rounded-lg border text-sm ${sendResult.error ? 'bg-red-500/10 border-red-500/20 text-red-400' : 'bg-green-500/10 border-green-500/20 text-green-400'}`}>
                {sendResult.error ? sendResult.error : `Sent! Summary for ${sendResult.load_count} load${sendResult.load_count !== 1 ? 's' : ''} delivered.`}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Add/Edit Driver Modal ─────────────────────────────────────────────────────

function DriverModal({ driver, onClose, onSaved }) {
  const isEdit = !!driver
  const [form, setForm] = useState({ name: driver?.name ?? '', driver_type: driver?.driver_type ?? 'COMPANY' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const navigate = useNavigate()

  function set(e) { setForm(f => ({ ...f, [e.target.name]: e.target.value })) }

  async function handleSubmit(e) {
    e.preventDefault()
    setSaving(true)
    setError('')
    try {
      if (isEdit) {
        await API.patch(`/drivers/${driver.id}`, { name: form.name, driver_type: form.driver_type })
      } else {
        await API.post('/drivers', { name: form.name, driver_type: form.driver_type })
      }
      onSaved()
    } catch (err) {
      redirectOnUnauth(err, navigate)
      setError(err.response?.data?.detail || 'Failed to save driver')
    } finally {
      setSaving(false)
    }
  }

  const inp = 'w-full bg-slate-700 border border-slate-600 rounded px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500 transition'
  const lbl = 'block text-xs text-slate-400 mb-1'

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-slate-800 rounded-xl border border-slate-700 w-full max-w-sm">
        <div className="flex items-center justify-between p-6 border-b border-slate-700">
          <h2 className="text-lg font-semibold text-white">{isEdit ? 'Edit Driver' : 'Add Driver'}</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white text-2xl leading-none transition">&times;</button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className={lbl}>Name *</label>
            <input name="name" value={form.name} onChange={set} required className={inp} placeholder="Driver name" />
          </div>
          <div>
            <label className={lbl}>Type</label>
            <select name="driver_type" value={form.driver_type} onChange={set} className={inp}>
              <option value="COMPANY">Company</option>
              <option value="OWNER_OPERATOR">Owner Operator</option>
            </select>
          </div>
          {error && <p className="text-red-400 text-sm">{error}</p>}
          <div className="flex justify-end gap-3 pt-1">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-slate-400 hover:text-white transition">Cancel</button>
            <button type="submit" disabled={saving} className="px-5 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-sm rounded-lg font-medium transition">
              {saving ? 'Saving…' : isEdit ? 'Save Changes' : 'Add Driver'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Delete Confirm Modal ──────────────────────────────────────────────────────

function DeleteConfirmModal({ driver, onClose, onDeleted }) {
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState('')
  const navigate = useNavigate()

  async function handleDelete() {
    setDeleting(true)
    setError('')
    try {
      await API.delete(`/drivers/${driver.id}`)
      onDeleted()
    } catch (err) {
      redirectOnUnauth(err, navigate)
      setError(err.response?.data?.detail || 'Failed to delete driver')
      setDeleting(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-slate-800 rounded-xl border border-slate-700 w-full max-w-sm p-6">
        <h2 className="text-base font-semibold text-white mb-2">Delete Driver</h2>
        <p className="text-sm text-slate-400 mb-1">
          Are you sure you want to permanently delete <span className="text-white font-medium">{driver.name}</span>?
        </p>
        <p className="text-xs text-slate-500 mb-5">This cannot be undone. Drivers with assigned loads cannot be deleted.</p>
        {error && <p className="text-red-400 text-sm mb-4">{error}</p>}
        <div className="flex gap-3">
          <button
            onClick={handleDelete}
            disabled={deleting}
            className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-500 disabled:opacity-60 text-white text-sm rounded-lg font-medium transition"
          >
            {deleting ? 'Deleting…' : 'Delete'}
          </button>
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 border border-slate-600 hover:border-slate-500 text-slate-300 hover:text-white text-sm rounded-lg transition"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function Drivers() {
  const [user, setUser] = useState(null)
  const [drivers, setDrivers] = useState([])
  const [loading, setLoading] = useState(false)
  const [showAdd, setShowAdd] = useState(false)
  const [editDriver, setEditDriver] = useState(null)
  const [settlementDriver, setSettlementDriver] = useState(null)
  const [deleteDriver, setDeleteDriver] = useState(null)
  const navigate = useNavigate()

  useEffect(() => {
    const token = getToken()
    if (!token) { navigate('/login', { replace: true }); return }
    setTimeout(() => {
      API.get('/auth/me')
        .then(r => setUser(r.data))
        .catch(err => {
          if (err.response?.status === 401) { clearToken(); navigate('/login', { replace: true }) }
        })
    }, 100)
  }, [])

  useEffect(() => {
    if (!user) return
    fetchDrivers()
  }, [user])

  async function fetchDrivers() {
    setLoading(true)
    try {
      const res = await API.get('/drivers')
      setDrivers(res.data)
    } catch (err) {
      redirectOnUnauth(err, navigate)
    } finally {
      setLoading(false)
    }
  }

  function handleLogout() {
    clearToken()
    navigate('/login')
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-900">
        <p className="text-slate-400">Loading…</p>
      </div>
    )
  }

  const isHA = user.role === 'HEAD_ACCOUNTANT'

  return (
    <div className="min-h-screen bg-slate-900">
      <Navbar active="Drivers" user={user} onLogout={handleLogout} />

      <main className="max-w-7xl mx-auto px-6 py-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl font-bold text-white">Drivers</h2>
            {drivers.length > 0 && (
              <p className="text-sm text-slate-500 mt-0.5">{drivers.length} driver{drivers.length !== 1 ? 's' : ''}</p>
            )}
          </div>
          <button
            onClick={() => setShowAdd(true)}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm rounded-lg font-medium transition"
          >
            + Add Driver
          </button>
        </div>

        {loading ? (
          <div className="text-center py-20 text-slate-500">Loading…</div>
        ) : drivers.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 gap-5">
            <svg className="w-16 h-16 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
            <div className="text-center">
              <p className="text-white font-semibold text-lg">No drivers yet</p>
              <p className="text-slate-400 text-sm mt-1">Add your first driver to get started.</p>
            </div>
            <button onClick={() => setShowAdd(true)} className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm rounded-lg font-medium transition">
              Add First Driver
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {drivers.map(driver => (
              <div key={driver.id} className="bg-slate-800 rounded-xl border border-slate-700 p-5 flex flex-col gap-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-white font-semibold text-base leading-tight truncate">{driver.name}</p>
                    {driver.telegram_chat_id && (
                      <p className="text-xs text-slate-500 mt-0.5 flex items-center gap-1">
                        <span>📨</span>
                        <span className="font-mono">{driver.telegram_chat_id}</span>
                      </p>
                    )}
                  </div>
                  <button
                    onClick={() => setEditDriver(driver)}
                    className="text-xs text-slate-400 hover:text-white px-2 py-1 rounded border border-slate-600 hover:border-slate-500 transition shrink-0"
                  >
                    Edit
                  </button>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  <TypeBadge type={driver.driver_type} />
                </div>

                <div className="mt-auto flex flex-col gap-2">
                  {isHA && (
                    <button
                      onClick={() => setSettlementDriver(driver)}
                      className="text-xs px-3 py-1.5 rounded border transition bg-indigo-600/10 hover:bg-indigo-600/20 text-indigo-400 border-indigo-600/30"
                    >
                      Settlement
                    </button>
                  )}
                  {isHA && (
                    <button
                      onClick={() => setDeleteDriver(driver)}
                      className="text-xs px-3 py-1.5 rounded border transition bg-red-600/10 hover:bg-red-600/20 text-red-400 border-red-600/30"
                    >
                      Delete
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {showAdd && (
        <DriverModal driver={null} onClose={() => setShowAdd(false)} onSaved={() => { setShowAdd(false); fetchDrivers() }} />
      )}
      {editDriver && (
        <DriverModal driver={editDriver} onClose={() => setEditDriver(null)} onSaved={() => { setEditDriver(null); fetchDrivers() }} />
      )}
      {settlementDriver && (
        <SettlementModal driver={settlementDriver} onClose={() => setSettlementDriver(null)} onDriverUpdated={fetchDrivers} />
      )}
      {deleteDriver && (
        <DeleteConfirmModal
          driver={deleteDriver}
          onClose={() => setDeleteDriver(null)}
          onDeleted={() => { setDeleteDriver(null); fetchDrivers() }}
        />
      )}
    </div>
  )
}
