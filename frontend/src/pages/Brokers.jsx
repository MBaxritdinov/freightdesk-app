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

// ── Badges ────────────────────────────────────────────────────────────────────

function StatusBadge({ active }) {
  return active
    ? <span className="px-2 py-0.5 rounded text-xs font-medium border bg-green-500/20 text-green-400 border-green-500/30">Active</span>
    : <span className="px-2 py-0.5 rounded text-xs font-medium border bg-slate-600/40 text-slate-400 border-slate-500/30">Inactive</span>
}

// ── Add / Edit Modal ──────────────────────────────────────────────────────────

function BrokerModal({ broker, onClose, onSaved }) {
  const isEdit = Boolean(broker)
  const [name, setName] = useState(broker?.name ?? '')
  const [isActive, setIsActive] = useState(broker?.is_active ?? true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e) {
    e.preventDefault()
    setSaving(true)
    setError('')
    try {
      if (isEdit) {
        await API.patch(`/brokers/${broker.id}`, { name: name.trim(), is_active: isActive })
      } else {
        await API.post('/brokers', { name: name.trim() })
      }
      onSaved()
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to save broker')
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
          <h2 className="text-lg font-semibold text-white">{isEdit ? 'Edit Broker' : 'Add Broker'}</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white text-2xl leading-none transition">&times;</button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className={lbl}>Name *</label>
            <input
              value={name}
              onChange={e => setName(e.target.value)}
              required
              autoFocus
              className={inp}
              placeholder="e.g. RXO"
            />
          </div>

          {isEdit && (
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setIsActive(a => !a)}
                className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none ${isActive ? 'bg-green-500' : 'bg-slate-600'}`}
              >
                <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${isActive ? 'translate-x-4' : 'translate-x-1'}`} />
              </button>
              <span className="text-sm text-slate-300">{isActive ? 'Active' : 'Inactive'}</span>
            </div>
          )}

          {error && <p className="text-red-400 text-sm">{error}</p>}

          <div className="flex justify-end gap-3 pt-1">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-slate-400 hover:text-white transition">Cancel</button>
            <button type="submit" disabled={saving} className="px-5 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-sm rounded-lg font-medium transition">
              {saving ? 'Saving…' : isEdit ? 'Save Changes' : 'Add Broker'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Delete Confirm Modal ──────────────────────────────────────────────────────

function DeleteModal({ broker, onClose, onDeleted }) {
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState('')

  async function handleDelete() {
    setDeleting(true)
    setError('')
    try {
      await API.delete(`/brokers/${broker.id}`)
      onDeleted()
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to delete broker')
      setDeleting(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-slate-800 rounded-xl border border-slate-700 w-full max-w-sm p-6">
        <h2 className="text-lg font-semibold text-white mb-1">Delete Broker</h2>
        <p className="text-slate-400 text-sm mb-5">
          Remove <span className="text-white font-medium">{broker.name}</span> permanently? This cannot be undone.
        </p>

        {error && (
          <div className="mb-4 px-3 py-2.5 bg-red-500/10 border border-red-500/30 rounded-lg">
            <p className="text-red-400 text-sm">{error}</p>
          </div>
        )}

        <div className="flex justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 text-sm text-slate-400 hover:text-white transition">Cancel</button>
          <button
            onClick={handleDelete}
            disabled={deleting}
            className="px-5 py-2 bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white text-sm rounded-lg font-medium transition"
          >
            {deleting ? 'Deleting…' : 'Delete'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function Brokers() {
  const [user, setUser] = useState(null)
  const [brokers, setBrokers] = useState([])
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
  const [editTarget, setEditTarget] = useState(null)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const navigate = useNavigate()

  useEffect(() => {
    const token = getToken()
    if (!token) { navigate('/login', { replace: true }); return }
    API.get('/auth/me')
      .then(r => setUser(r.data))
      .catch(err => {
        if (err.response?.status === 401) { clearToken(); navigate('/login', { replace: true }) }
      })
  }, [])

  useEffect(() => {
    if (!user) return
    fetchBrokers()
  }, [user])

  async function fetchBrokers() {
    setLoading(true)
    try {
      const res = await API.get('/brokers')
      setBrokers(res.data)
    } catch (err) {
      if (err.response?.status === 401) { clearToken(); navigate('/login', { replace: true }) }
    } finally {
      setLoading(false)
    }
  }

  function handleLogout() { clearToken(); navigate('/login') }

  const isDispatcher = user?.role === 'DISPATCHER'

  if (!user) {
    return <div className="min-h-screen flex items-center justify-center bg-slate-900"><p className="text-slate-400">Loading…</p></div>
  }

  return (
    <div className="min-h-screen bg-slate-900">
      <Navbar active="Brokers" user={user} onLogout={handleLogout} />

      <main className="max-w-7xl mx-auto px-6 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-white">Brokers</h2>
          {isDispatcher && (
            <button
              onClick={() => setShowAdd(true)}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm rounded-lg font-medium transition"
            >
              + Add Broker
            </button>
          )}
        </div>

        {/* Table */}
        <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-700">
                  {['Name', 'Status', 'Loads This Week', ...(isDispatcher ? ['Actions'] : [])].map(col => (
                    <th key={col} className="text-left px-4 py-3 text-xs font-medium text-slate-400 uppercase tracking-wide whitespace-nowrap">{col}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={isDispatcher ? 4 : 3} className="text-center py-14 text-slate-500">Loading…</td></tr>
                ) : brokers.length === 0 ? (
                  <tr>
                    <td colSpan={isDispatcher ? 4 : 3} className="text-center py-14 text-slate-500">No brokers yet</td>
                  </tr>
                ) : (
                  brokers.map(broker => (
                    <tr key={broker.id} className="border-b border-slate-700/50 hover:bg-slate-700/30 transition">
                      <td className="px-4 py-3 text-white font-medium">{broker.name}</td>
                      <td className="px-4 py-3"><StatusBadge active={broker.is_active} /></td>
                      <td className="px-4 py-3 text-slate-300">
                        {broker.loads_count > 0
                          ? <span className="font-mono">{broker.loads_count}</span>
                          : <span className="text-slate-600">—</span>}
                      </td>
                      {isDispatcher && (
                        <td className="px-4 py-3 whitespace-nowrap">
                          <div className="flex gap-2">
                            <button
                              onClick={() => setEditTarget(broker)}
                              className="px-2.5 py-1 bg-slate-700 hover:bg-slate-600 text-slate-300 hover:text-white text-xs rounded border border-slate-600 transition"
                            >
                              Edit
                            </button>
                            <button
                              onClick={() => setDeleteTarget(broker)}
                              className="px-2.5 py-1 bg-red-600/20 hover:bg-red-600/40 text-red-400 text-xs rounded border border-red-600/30 transition"
                            >
                              Delete
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>

      {showAdd && (
        <BrokerModal
          broker={null}
          onClose={() => setShowAdd(false)}
          onSaved={() => { setShowAdd(false); fetchBrokers() }}
        />
      )}
      {editTarget && (
        <BrokerModal
          broker={editTarget}
          onClose={() => setEditTarget(null)}
          onSaved={() => { setEditTarget(null); fetchBrokers() }}
        />
      )}
      {deleteTarget && (
        <DeleteModal
          broker={deleteTarget}
          onClose={() => setDeleteTarget(null)}
          onDeleted={() => { setDeleteTarget(null); fetchBrokers() }}
        />
      )}
    </div>
  )
}
