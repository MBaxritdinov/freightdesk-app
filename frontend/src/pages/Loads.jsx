import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import axios from 'axios'
import { getToken, clearToken } from '../auth'
import Navbar from '../components/Navbar'

const API = axios.create({ baseURL: import.meta.env.VITE_API_URL || 'http://localhost:8000' })

// Auto-attach token to every request � fixes race condition after login
API.interceptors.request.use(config => {
  const token = getToken()
  console.log('Interceptor firing, token:', token ? 'EXISTS' : 'NULL', config.url)
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

function authHeaders() {
  return { Authorization: `Bearer ${localStorage.getItem('token')}` }
}

function redirectOnUnauth(err, navigate) {
  if (err.response?.status === 401) {
    clearToken()
    navigate('/login', { replace: true })
  }
}

// ── Badges ──────────────────────────────────────────────────────────────────

function ApprovalBadge({ status }) {
  const cls = {
    PENDING: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
    APPROVED: 'bg-green-500/20 text-green-400 border-green-500/30',
    FLAGGED: 'bg-red-500/20 text-red-400 border-red-500/30',
  }
  return (
    <span className={`px-2 py-0.5 rounded text-xs font-medium border ${cls[status] ?? ''}`}>
      {status}
    </span>
  )
}

function PaymentBadge({ status }) {
  const cls = {
    PENDING: 'bg-slate-600/40 text-slate-300 border-slate-500/30',
    INVOICED: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
    RECEIVED: 'bg-green-500/20 text-green-400 border-green-500/30',
  }
  return (
    <span className={`px-2 py-0.5 rounded text-xs font-medium border ${cls[status] ?? ''}`}>
      {status}
    </span>
  )
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function fmt(val) {
  if (val == null) return '—'
  return '$' + Number(val).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function fmtDate(d) {
  if (!d) return '—'
  return new Date(d + 'T00:00:00').toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  })
}

// ── Add Load Modal ────────────────────────────────────────────────────────────

function AddLoadModal({ brokers, drivers, onClose, onCreated }) {
  const [form, setForm] = useState({
    load_number: '', broker_id: '', driver_id: '',
    gross_rate: '', cut_rate: '', added_rate: '',
    payment_method: '', quickpay_deduction: '',
    pu_date: '', del_date: '', pu_location: '', del_location: '', notes: '',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const navigate = useNavigate()

  const gross = parseFloat(form.gross_rate) || 0
  const cut = parseFloat(form.cut_rate) || 0
  const added = parseFloat(form.added_rate) || 0
  const qp = parseFloat(form.quickpay_deduction) || 0
  const finalRate = gross - cut + added
  const netRate = finalRate - qp

  function set(e) {
    setForm(f => ({ ...f, [e.target.name]: e.target.value }))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setSaving(true)
    setError('')
    try {
      await API.post('/loads', {
        load_number: form.load_number,
        broker_id: parseInt(form.broker_id),
        driver_id: form.driver_id ? parseInt(form.driver_id) : null,
        gross_rate: parseFloat(form.gross_rate),
        cut_rate: parseFloat(form.cut_rate) || 0,
        added_rate: parseFloat(form.added_rate) || 0,
        payment_method: form.payment_method || null,
        quickpay_deduction: parseFloat(form.quickpay_deduction) || 0,
        pu_date: form.pu_date || null,
        del_date: form.del_date || null,
        pu_location: form.pu_location || null,
        del_location: form.del_location || null,
        notes: form.notes || null,
      })
      onCreated()
    } catch (err) {
      redirectOnUnauth(err, navigate)
      setError(err.response?.data?.detail || 'Failed to create load')
    } finally {
      setSaving(false)
    }
  }

  const inp = 'w-full bg-slate-700 border border-slate-600 rounded px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500 transition'
  const lbl = 'block text-xs text-slate-400 mb-1'

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-slate-800 rounded-xl border border-slate-700 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-slate-700">
          <h2 className="text-lg font-semibold text-white">Add Load</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white text-2xl leading-none transition">&times;</button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {/* Row 1 */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={lbl}>Load Number *</label>
              <input name="load_number" value={form.load_number} onChange={set} required className={inp} placeholder="e.g. BBI-12345" />
            </div>
            <div>
              <label className={lbl}>Broker *</label>
              <select name="broker_id" value={form.broker_id} onChange={set} required className={inp}>
                <option value="">Select broker…</option>
                {brokers.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            </div>
            <div>
              <label className={lbl}>Driver</label>
              <select name="driver_id" value={form.driver_id} onChange={set} className={inp}>
                <option value="">No driver assigned</option>
                {drivers.filter(d => d.is_active !== false).map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </div>
            <div>
              <label className={lbl}>Payment Method</label>
              <select name="payment_method" value={form.payment_method} onChange={set} className={inp}>
                <option value="">Select…</option>
                <option value="RTS">RTS</option>
                <option value="QUICKPAY">QUICKPAY</option>
              </select>
            </div>
          </div>

          {/* Rates */}
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className={lbl}>Gross Rate *</label>
              <input name="gross_rate" value={form.gross_rate} onChange={set} type="number" step="0.01" required className={inp} placeholder="0.00" />
            </div>
            <div>
              <label className={lbl}>Cut Rate</label>
              <input name="cut_rate" value={form.cut_rate} onChange={set} type="number" step="0.01" className={inp} placeholder="0.00" />
            </div>
            <div>
              <label className={lbl}>Added Rate</label>
              <input name="added_rate" value={form.added_rate} onChange={set} type="number" step="0.01" className={inp} placeholder="0.00" />
            </div>
            <div>
              <label className={lbl}>Quickpay Deduction</label>
              <input name="quickpay_deduction" value={form.quickpay_deduction} onChange={set} type="number" step="0.01" className={inp} placeholder="0.00" />
            </div>
            <div>
              <label className={lbl}>Final Rate (auto)</label>
              <div className="px-3 py-2 bg-slate-700/50 rounded border border-slate-600 text-green-400 text-sm font-mono">{fmt(finalRate)}</div>
            </div>
            <div>
              <label className={lbl}>Net Rate (auto)</label>
              <div className="px-3 py-2 bg-slate-700/50 rounded border border-slate-600 text-green-400 text-sm font-mono">{fmt(netRate)}</div>
            </div>
          </div>

          {/* Dates & locations */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={lbl}>Pickup Date</label>
              <input name="pu_date" value={form.pu_date} onChange={set} type="date" className={inp} />
            </div>
            <div>
              <label className={lbl}>Delivery Date</label>
              <input name="del_date" value={form.del_date} onChange={set} type="date" className={inp} />
            </div>
            <div>
              <label className={lbl}>Pickup Location</label>
              <input name="pu_location" value={form.pu_location} onChange={set} className={inp} placeholder="City, ST" />
            </div>
            <div>
              <label className={lbl}>Delivery Location</label>
              <input name="del_location" value={form.del_location} onChange={set} className={inp} placeholder="City, ST" />
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className={lbl}>Notes</label>
            <textarea name="notes" value={form.notes} onChange={set} rows={3} className={inp} placeholder="Optional notes…" />
          </div>

          {error && <p className="text-red-400 text-sm">{error}</p>}

          <div className="flex justify-end gap-3 pt-1">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-slate-400 hover:text-white transition">Cancel</button>
            <button type="submit" disabled={saving} className="px-5 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-sm rounded-lg font-medium transition">
              {saving ? 'Creating…' : 'Create Load'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Detail Modal ──────────────────────────────────────────────────────────────

function DetailModal({ load, onClose }) {
  if (!load) return null
  const rows = [
    ['Load Number', load.load_number],
    ['Broker', load.broker_name],
    ['Driver', load.driver_name || '—'],
    ['Pickup', load.pu_location || '—'],
    ['Delivery', load.del_location || '—'],
    ['Pickup Date', fmtDate(load.pu_date)],
    ['Delivery Date', fmtDate(load.del_date)],
    ['Gross Rate', fmt(load.gross_rate)],
    ['Cut Rate', fmt(load.cut_rate)],
    ['Added Rate', fmt(load.added_rate)],
    ['Final Rate', fmt(load.final_rate)],
    ['Quickpay Deduction', fmt(load.quickpay_deduction)],
    ['Net Rate', fmt(load.net_rate)],
    ['Payment Method', load.payment_method || '—'],
    ['Payment Status', load.payment_status],
    ['Approval Status', load.approval_status],
    ['BOL Signed', load.bol_signed ? 'Yes' : 'No'],
    ['POD Submitted', load.pod_submitted ? 'Yes' : 'No'],
    ['Notes', load.notes || '—'],
  ]
  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-slate-800 rounded-xl border border-slate-700 w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-slate-700">
          <h2 className="text-lg font-semibold text-white">Load #{load.load_number}</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white text-2xl leading-none transition">&times;</button>
        </div>
        <div className="p-6 space-y-3">
          {rows.map(([label, value]) => (
            <div key={label} className="flex items-start gap-4">
              <span className="text-slate-400 text-sm w-40 shrink-0">{label}</span>
              <span className="text-white text-sm break-all">{value}</span>
            </div>
          ))}
        </div>
        <div className="p-6 pt-0">
          <button onClick={onClose} className="w-full py-2 text-sm text-slate-400 hover:text-white border border-slate-700 rounded-lg transition">Close</button>
        </div>
      </div>
    </div>
  )
}

// ── Flag Modal ────────────────────────────────────────────────────────────────

function FlagModal({ onClose, onConfirm }) {
  const [reason, setReason] = useState('')
  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-slate-800 rounded-xl border border-slate-700 w-full max-w-sm p-6">
        <h2 className="text-lg font-semibold text-white mb-1">Flag Load</h2>
        <p className="text-slate-400 text-sm mb-4">Optionally provide a reason for flagging:</p>
        <textarea
          value={reason}
          onChange={e => setReason(e.target.value)}
          rows={3}
          className="w-full bg-slate-700 border border-slate-600 rounded px-3 py-2 text-white text-sm focus:outline-none focus:border-red-500 transition"
          placeholder="Reason for flagging…"
        />
        <div className="flex justify-end gap-3 mt-4">
          <button onClick={onClose} className="px-4 py-2 text-sm text-slate-400 hover:text-white transition">Cancel</button>
          <button onClick={() => onConfirm(reason)} className="px-5 py-2 bg-red-600 hover:bg-red-500 text-white text-sm rounded-lg font-medium transition">
            Flag Load
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────

const STATUS_TABS = ['ALL', 'PENDING', 'APPROVED', 'FLAGGED']
const PAYMENT_TABS = ['ALL', 'PENDING', 'INVOICED', 'RECEIVED']

export default function Loads() {
  const [user, setUser] = useState(null)
  const [loads, setLoads] = useState([])
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [total, setTotal] = useState(0)
  const [statusFilter, setStatusFilter] = useState('ALL')
  const [paymentFilter, setPaymentFilter] = useState('ALL')
  const [loadingTable, setLoadingTable] = useState(false)
  const [showAdd, setShowAdd] = useState(false)
  const [flagTarget, setFlagTarget] = useState(null)
  const [brokers, setBrokers] = useState([])
  const [drivers, setDrivers] = useState([])
  const navigate = useNavigate()

  // Init: load user + dropdown data
  useEffect(() => {
    const token = getToken()
    if (!token) { navigate('/login', { replace: true }); return }

    // Small delay to ensure interceptor has the token before firing
    setTimeout(() => {
      API.get('/auth/me')
        .then(r => setUser(r.data))
        .catch(err => {
          if (err.response?.status === 401) {
            clearToken()
            navigate('/login', { replace: true })
          }
        })

      Promise.all([
        API.get('/brokers'),
        API.get('/drivers'),
      ]).then(([br, dr]) => {
        setBrokers(br.data)
        setDrivers(dr.data)
      }).catch(() => {})
    }, 100)
  }, [])

  // Reload table when filters / page change � wait for user to be set first
  useEffect(() => {
    if (!user) return
    fetchLoads()
  }, [page, statusFilter, paymentFilter, user])

  async function fetchLoads() {
    setLoadingTable(true)
    try {
      const params = { page, limit: 20 }
      if (statusFilter !== 'ALL') params.status = statusFilter
      if (paymentFilter !== 'ALL') params.payment_status = paymentFilter
      const res = await API.get('/loads', { params, headers: authHeaders() })
      setLoads(res.data.items)
      setTotalPages(res.data.pages)
      setTotal(res.data.total)
    } catch (err) {
      redirectOnUnauth(err, navigate)
    } finally {
      setLoadingTable(false)
    }
  }

  async function handleApprove(id) {
    try {
      await API.patch(`/loads/${id}/approve`, {})
      fetchLoads()
    } catch (err) {
      redirectOnUnauth(err, navigate)
    }
  }

  async function handleFlag(id, reason) {
    try {
      await API.patch(`/loads/${id}/flag`, { reason: reason || null })
      setFlagTarget(null)
      fetchLoads()
    } catch (err) {
      redirectOnUnauth(err, navigate)
    }
  }

  function handleLogout() {
    clearToken()
    navigate('/login')
  }

  function changeStatus(s) { setStatusFilter(s); setPage(1) }
  function changePayment(s) { setPaymentFilter(s); setPage(1) }

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
      <Navbar active="Loads" user={user} onLogout={handleLogout} />

      <main className="max-w-7xl mx-auto px-6 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-white">Loads</h2>
          <button
            onClick={() => setShowAdd(true)}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm rounded-lg font-medium transition"
          >
            + Add Load
          </button>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3 mb-5">
          {/* Approval status tabs */}
          <div className="flex items-center gap-1 bg-slate-800 rounded-lg p-1 border border-slate-700">
            {STATUS_TABS.map(s => (
              <button
                key={s}
                onClick={() => changeStatus(s)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition ${
                  statusFilter === s ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'
                }`}
              >
                {s === 'ALL' ? 'All' : s.charAt(0) + s.slice(1).toLowerCase()}
              </button>
            ))}
          </div>

          {/* Payment status tabs */}
          <div className="flex items-center gap-1 bg-slate-800 rounded-lg p-1 border border-slate-700">
            {PAYMENT_TABS.map(s => (
              <button
                key={s}
                onClick={() => changePayment(s)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition ${
                  paymentFilter === s ? 'bg-slate-600 text-white' : 'text-slate-400 hover:text-white'
                }`}
              >
                {s === 'ALL' ? 'All Payments' : s.charAt(0) + s.slice(1).toLowerCase()}
              </button>
            ))}
          </div>

          {total > 0 && (
            <span className="text-sm text-slate-500 ml-1">{total} load{total !== 1 ? 's' : ''}</span>
          )}
        </div>

        {/* Table */}
        <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-700">
                  {['Load #', 'Broker', 'Driver', 'Route', 'Dates', 'Gross', 'Net', 'Method', 'Payment', 'BOL / POD', 'Status', 'Actions'].map(col => (
                    <th key={col} className="text-left px-4 py-3 text-xs font-medium text-slate-400 uppercase tracking-wide whitespace-nowrap">
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loadingTable ? (
                  <tr>
                    <td colSpan={12} className="text-center py-14 text-slate-500">Loading…</td>
                  </tr>
                ) : loads.length === 0 ? (
                  <tr>
                    <td colSpan={12}>
                      <div className="flex flex-col items-center justify-center py-16 gap-4">
                        <svg className="w-14 h-14 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M9 17a2 2 0 11-4 0 2 2 0 014 0zM19 17a2 2 0 11-4 0 2 2 0 014 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" d="M13 16V6a1 1 0 00-1-1H4a1 1 0 00-1 1v10l2 1h7l1-1zM13 16l2-3h4l2 3H13z" />
                        </svg>
                        <div className="text-center">
                          <p className="text-white font-semibold">No loads found</p>
                          <p className="text-slate-400 text-sm mt-1">Add your first load or sync Gmail to import automatically.</p>
                        </div>
                        <div className="flex items-center gap-3">
                          <button
                            onClick={() => navigate('/settings')}
                            className="px-4 py-2 bg-slate-700 hover:bg-slate-600 border border-slate-600 text-white text-sm rounded-lg font-medium transition"
                          >
                            Sync Gmail
                          </button>
                        </div>
                      </div>
                    </td>
                  </tr>
                ) : (
                  loads.map(load => (
                    <tr
                      key={load.id}
                      onClick={() => navigate('/loads/' + load.id)}
                      className="border-b border-slate-700/50 hover:bg-slate-700/40 cursor-pointer transition"
                    >
                      <td className="px-4 py-3 font-mono text-white whitespace-nowrap">{load.load_number}</td>
                      <td className="px-4 py-3 text-slate-300 whitespace-nowrap">{load.broker_name}</td>
                      <td className="px-4 py-3 text-slate-300 whitespace-nowrap">
                        {load.driver_name ?? <span className="text-slate-600">—</span>}
                      </td>
                      <td className="px-4 py-3 text-slate-300 text-xs whitespace-nowrap">
                        {load.pu_location && load.del_location
                          ? <>{load.pu_location} <span className="text-slate-600 mx-1">→</span> {load.del_location}</>
                          : <span className="text-slate-600">—</span>}
                      </td>
                      <td className="px-4 py-3 text-slate-400 text-xs whitespace-nowrap">
                        {load.pu_date || load.del_date
                          ? <>{fmtDate(load.pu_date)}{load.pu_date && load.del_date && <span className="mx-1 text-slate-600">–</span>}{load.del_date ? fmtDate(load.del_date) : ''}</>
                          : '—'}
                      </td>
                      <td className="px-4 py-3 text-white font-mono whitespace-nowrap">{fmt(load.gross_rate)}</td>
                      <td className="px-4 py-3 text-green-400 font-mono whitespace-nowrap">{fmt(load.net_rate)}</td>
                      <td className="px-4 py-3 text-slate-400 text-xs whitespace-nowrap">{load.payment_method ?? '—'}</td>
                      <td className="px-4 py-3 whitespace-nowrap"><PaymentBadge status={load.payment_status} /></td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span
                          className={`inline-block w-2.5 h-2.5 rounded-full mr-1.5 ${load.bol_signed ? 'bg-green-500' : 'bg-slate-600'}`}
                          title={`BOL: ${load.bol_signed ? 'Signed' : 'Not signed'}`}
                        />
                        <span
                          className={`inline-block w-2.5 h-2.5 rounded-full ${load.pod_submitted ? 'bg-green-500' : 'bg-slate-600'}`}
                          title={`POD: ${load.pod_submitted ? 'Submitted' : 'Not submitted'}`}
                        />
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap"><ApprovalBadge status={load.approval_status} /></td>
                      {/* Stop click propagation so row-detail doesn't fire */}
                      <td className="px-4 py-3 whitespace-nowrap" onClick={e => e.stopPropagation()}>
                        {isHA && load.approval_status === 'PENDING' && (
                          <div className="flex gap-2">
                            <button
                              onClick={() => handleApprove(load.id)}
                              className="px-2.5 py-1 bg-green-600/20 hover:bg-green-600/40 text-green-400 text-xs rounded border border-green-600/30 transition"
                            >
                              Approve
                            </button>
                            <button
                              onClick={() => setFlagTarget(load)}
                              className="px-2.5 py-1 bg-red-600/20 hover:bg-red-600/40 text-red-400 text-xs rounded border border-red-600/30 transition"
                            >
                              Flag
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between mt-4 px-1">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
              className="px-4 py-2 text-sm text-slate-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition"
            >
              ← Prev
            </button>
            <span className="text-sm text-slate-500">Page {page} of {totalPages}</span>
            <button
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="px-4 py-2 text-sm text-slate-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition"
            >
              Next →
            </button>
          </div>
        )}
      </main>

      {/* Modals */}
      {showAdd && (
        <AddLoadModal
          brokers={brokers}
          drivers={drivers}
          onClose={() => setShowAdd(false)}
          onCreated={() => { setShowAdd(false); fetchLoads() }}
        />
      )}
      {flagTarget && (
        <FlagModal
          onClose={() => setFlagTarget(null)}
          onConfirm={reason => handleFlag(flagTarget.id, reason)}
        />
      )}
    </div>
  )
}
