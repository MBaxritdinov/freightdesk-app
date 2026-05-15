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

function RoleBadge({ role }) {
  const styles = {
    HEAD_ACCOUNTANT: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
    DISPATCHER: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  }
  const labels = {
    HEAD_ACCOUNTANT: 'Head Accountant',
    DISPATCHER: 'Dispatcher',
    ACCOUNTANT: 'Accountant',
  }
  return (
    <span className={`px-2 py-0.5 rounded text-xs font-medium border ${styles[role] ?? 'bg-slate-600/40 text-slate-400 border-slate-500/30'}`}>
      {labels[role] ?? role}
    </span>
  )
}

function StatusBadge({ active }) {
  const cls = active
    ? 'bg-green-500/20 text-green-400 border-green-500/30'
    : 'bg-slate-600/40 text-slate-400 border-slate-500/30'
  return (
    <span className={`px-2 py-0.5 rounded text-xs font-medium border ${cls}`}>
      {active ? 'Active' : 'Inactive'}
    </span>
  )
}

function fmtDate(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

// ── User Modal ────────────────────────────────────────────────────────────────

function UserModal({ editUser, onClose, onSaved }) {
  const isEdit = !!editUser
  const [form, setForm] = useState({
    name: editUser?.name ?? '',
    email: editUser?.email ?? '',
    password: '',
    role: editUser?.role ?? 'DISPATCHER',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const navigate = useNavigate()

  function set(e) {
    setForm(f => ({ ...f, [e.target.name]: e.target.value }))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setSaving(true)
    setError('')
    try {
      if (isEdit) {
        await API.patch(`/users/${editUser.id}`, {
          name: form.name,
          email: form.email,
          role: form.role,
        })
      } else {
        await API.post('/users', {
          name: form.name,
          email: form.email,
          password: form.password,
          role: form.role,
        })
      }
      onSaved()
    } catch (err) {
      redirectOnUnauth(err, navigate)
      setError(err.response?.data?.detail || 'Failed to save user')
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
          <h2 className="text-lg font-semibold text-white">{isEdit ? 'Edit User' : 'Add User'}</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white text-2xl leading-none transition">
            &times;
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className={lbl}>Name *</label>
            <input name="name" value={form.name} onChange={set} required className={inp} placeholder="Full name" />
          </div>
          <div>
            <label className={lbl}>Email *</label>
            <input name="email" type="email" value={form.email} onChange={set} required className={inp} placeholder="user@company.com" />
          </div>
          {!isEdit && (
            <div>
              <label className={lbl}>Password *</label>
              <input
                name="password"
                type="password"
                value={form.password}
                onChange={set}
                required
                minLength={6}
                className={inp}
                placeholder="Min. 6 characters"
              />
            </div>
          )}
          <div>
            <label className={lbl}>Role</label>
            <select name="role" value={form.role} onChange={set} className={inp}>
              <option value="DISPATCHER">Dispatcher</option>
              <option value="HEAD_ACCOUNTANT">Head Accountant</option>
            </select>
          </div>
          {error && <p className="text-red-400 text-sm">{error}</p>}
          <div className="flex justify-end gap-3 pt-1">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-slate-400 hover:text-white transition">
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-5 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-sm rounded-lg font-medium transition"
            >
              {saving ? 'Saving…' : isEdit ? 'Save Changes' : 'Add User'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Empty State ───────────────────────────────────────────────────────────────

function EmptyUsers({ onAdd }) {
  return (
    <div className="flex flex-col items-center justify-center py-24 gap-5">
      <svg className="w-16 h-16 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
      <div className="text-center">
        <p className="text-white font-semibold text-lg">No users yet</p>
        <p className="text-slate-400 text-sm mt-1">Add team members to manage access and permissions.</p>
      </div>
      <button
        onClick={onAdd}
        className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm rounded-lg font-medium transition"
      >
        Add First User
      </button>
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function Users() {
  const [user, setUser] = useState(null)
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(false)
  const [showAdd, setShowAdd] = useState(false)
  const [editUser, setEditUser] = useState(null)
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
    if (user.role !== 'HEAD_ACCOUNTANT') {
      navigate('/dashboard', { replace: true })
      return
    }
    fetchUsers()
  }, [user])

  async function fetchUsers() {
    setLoading(true)
    try {
      const res = await API.get('/users')
      setUsers(res.data)
    } catch (err) {
      redirectOnUnauth(err, navigate)
    } finally {
      setLoading(false)
    }
  }

  async function handleToggle(u) {
    try {
      const ep = u.is_active ? `/users/${u.id}/deactivate` : `/users/${u.id}/activate`
      await API.patch(ep, {})
      fetchUsers()
    } catch (err) {
      redirectOnUnauth(err, navigate)
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

  return (
    <div className="min-h-screen bg-slate-900">
      <Navbar active="Users" user={user} onLogout={handleLogout} />

      <main className="max-w-7xl mx-auto px-6 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl font-bold text-white">Users</h2>
            {users.length > 0 && (
              <p className="text-sm text-slate-500 mt-0.5">
                {users.length} member{users.length !== 1 ? 's' : ''}
              </p>
            )}
          </div>
          <button
            onClick={() => setShowAdd(true)}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm rounded-lg font-medium transition"
          >
            + Add User
          </button>
        </div>

        {/* Table */}
        {loading ? (
          <div className="text-center py-20 text-slate-500">Loading…</div>
        ) : users.length === 0 ? (
          <EmptyUsers onAdd={() => setShowAdd(true)} />
        ) : (
          <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-700">
                    {['Name', 'Email', 'Role', 'Status', 'Created', 'Actions'].map(h => (
                      <th
                        key={h}
                        className="text-left px-5 py-3 text-xs font-medium text-slate-400 uppercase tracking-wide whitespace-nowrap"
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {users.map(u => (
                    <tr key={u.id} className="border-b border-slate-700/50 hover:bg-slate-700/20 transition">
                      <td className="px-5 py-3 text-white font-medium">
                        {u.name}
                        {u.id === user.id && (
                          <span className="ml-2 text-xs text-slate-500">(you)</span>
                        )}
                      </td>
                      <td className="px-5 py-3 text-slate-300">{u.email}</td>
                      <td className="px-5 py-3">
                        <RoleBadge role={u.role} />
                      </td>
                      <td className="px-5 py-3">
                        <StatusBadge active={u.is_active} />
                      </td>
                      <td className="px-5 py-3 text-slate-400 text-xs whitespace-nowrap">
                        {fmtDate(u.created_at)}
                      </td>
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => setEditUser(u)}
                            className="text-xs px-3 py-1 rounded border border-slate-600 hover:border-slate-500 text-slate-400 hover:text-white transition"
                          >
                            Edit
                          </button>
                          {u.id !== user.id && (
                            <button
                              onClick={() => handleToggle(u)}
                              className={`text-xs px-3 py-1 rounded border transition ${
                                u.is_active
                                  ? 'bg-red-600/10 hover:bg-red-600/20 text-red-400 border-red-600/30'
                                  : 'bg-green-600/10 hover:bg-green-600/20 text-green-400 border-green-600/30'
                              }`}
                            >
                              {u.is_active ? 'Deactivate' : 'Activate'}
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>

      {showAdd && (
        <UserModal
          editUser={null}
          onClose={() => setShowAdd(false)}
          onSaved={() => { setShowAdd(false); fetchUsers() }}
        />
      )}
      {editUser && (
        <UserModal
          editUser={editUser}
          onClose={() => setEditUser(null)}
          onSaved={() => { setEditUser(null); fetchUsers() }}
        />
      )}
    </div>
  )
}
