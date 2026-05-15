import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import axios from 'axios'
import { getToken, clearToken } from '../auth'
import Navbar from '../components/Navbar'

const API = axios.create({ baseURL: 'http://localhost:8000' })
API.interceptors.request.use(config => {
  const token = getToken()
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

function fmt(v) {
  if (v == null) return '—'
  return '$' + Number(v).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function fmtDate(d) {
  if (!d) return '—'
  return new Date(d + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function ApprovalBadge({ status }) {
  const cls = {
    PENDING: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
    APPROVED: 'bg-green-500/20 text-green-400 border-green-500/30',
    FLAGGED: 'bg-red-500/20 text-red-400 border-red-500/30',
  }
  return (
    <span className={`px-2.5 py-1 rounded-full text-xs font-medium border ${cls[status] ?? ''}`}>
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
    <span className={`px-2.5 py-1 rounded-full text-xs font-medium border ${cls[status] ?? ''}`}>
      {status}
    </span>
  )
}

function Field({ label, children }) {
  return (
    <div>
      <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">{label}</p>
      <div className="text-sm text-white">{children}</div>
    </div>
  )
}

function fmtTs(iso) {
  if (!iso) return null
  return new Date(iso).toLocaleString('en-US', {
    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
  })
}

function Timeline({ load }) {
  const events = []

  events.push({ color: 'blue', label: 'Created', time: fmtTs(load.created_at) })

  if (load.email_source_id) {
    events.push({ color: 'blue', label: 'Parsed from email', time: null })
  }

  if (load.approval_status === 'APPROVED') {
    events.push({
      color: 'green',
      label: `Approved${load.approved_by_name ? ` by ${load.approved_by_name}` : ''}`,
      time: null,
    })
  } else if (load.approval_status === 'FLAGGED') {
    events.push({ color: 'red', label: 'Flagged', time: null })
  }

  if (load.bol_signed) {
    events.push({ color: 'green', label: 'BOL Signed', time: null })
  }

  if (load.pod_submitted) {
    events.push({ color: 'green', label: 'POD Submitted', time: null })
  }

  const dotCls = { green: 'bg-green-500', red: 'bg-red-500', blue: 'bg-blue-500' }

  return (
    <div className="bg-slate-800 rounded-xl border border-slate-700 p-6 mb-4">
      <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wide mb-5">Timeline</h3>
      <div className="relative">
        {events.map((ev, i) => (
          <div key={i} className="flex gap-4 relative">
            {i < events.length - 1 && (
              <div className="absolute left-[6px] top-3.5 bottom-0 w-px bg-slate-700" />
            )}
            <div className={`w-3.5 h-3.5 rounded-full shrink-0 mt-0.5 ring-2 ring-slate-800 ${dotCls[ev.color]}`} />
            <div className="pb-5 min-w-0">
              <p className="text-sm text-white">{ev.label}</p>
              {ev.time && <p className="text-xs text-slate-500 mt-0.5">{ev.time}</p>}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function FlagModal({ onClose, onConfirm }) {
  const [reason, setReason] = useState('')
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="bg-slate-800 rounded-xl border border-slate-700 p-6 w-full max-w-sm mx-4">
        <h3 className="text-base font-semibold text-white mb-4">Flag Load</h3>
        <textarea
          value={reason}
          onChange={e => setReason(e.target.value)}
          placeholder="Reason (optional)"
          rows={3}
          className="w-full bg-slate-700 border border-slate-600 rounded px-3 py-2 text-white text-sm resize-none focus:outline-none focus:border-red-500"
        />
        <div className="flex gap-3 mt-4">
          <button
            onClick={() => onConfirm(reason)}
            className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-500 text-white text-sm rounded-lg font-medium transition"
          >
            Flag
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

export default function LoadDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [user, setUser] = useState(null)
  const [load, setLoad] = useState(null)
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [actionLoading, setActionLoading] = useState(false)
  const [showFlag, setShowFlag] = useState(false)
  const [error, setError] = useState('')

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
    fetchLoad()
  }, [user])

  async function fetchLoad() {
    try {
      const r = await API.get(`/loads/${id}`)
      setLoad(r.data)
      setNotes(r.data.notes ?? '')
    } catch (err) {
      if (err.response?.status === 401) { clearToken(); navigate('/login', { replace: true }) }
      if (err.response?.status === 404) { navigate('/loads', { replace: true }) }
    }
  }

  async function patch(fields) {
    try {
      const r = await API.patch(`/loads/${id}`, fields)
      setLoad(r.data)
      setNotes(r.data.notes ?? '')
    } catch (err) {
      if (err.response?.status === 401) { clearToken(); navigate('/login', { replace: true }) }
      setError(err.response?.data?.detail || 'Update failed')
    }
  }

  async function handleToggle(field, value) {
    await patch({ [field]: value })
  }

  async function handleNotesSave() {
    if (notes === (load?.notes ?? '')) return
    setSaving(true)
    await patch({ notes })
    setSaving(false)
  }

  async function handleApprove() {
    setActionLoading(true)
    try {
      const r = await API.patch(`/loads/${id}/approve`)
      setLoad(r.data)
    } catch (err) {
      setError(err.response?.data?.detail || 'Approve failed')
    } finally {
      setActionLoading(false)
    }
  }

  async function handleFlag(reason) {
    setShowFlag(false)
    setActionLoading(true)
    try {
      const r = await API.patch(`/loads/${id}/flag`, { reason })
      setLoad(r.data)
    } catch (err) {
      setError(err.response?.data?.detail || 'Flag failed')
    } finally {
      setActionLoading(false)
    }
  }

  function handleLogout() {
    clearToken()
    navigate('/login')
  }

  if (!user || !load) {
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

      <main className="max-w-4xl mx-auto px-6 py-8">
        {/* Back + header */}
        <div className="flex items-center gap-3 mb-6">
          <button
            onClick={() => navigate('/loads')}
            className="text-sm text-slate-400 hover:text-white transition flex items-center gap-1"
          >
            ← Loads
          </button>
          <span className="text-slate-600">/</span>
          <h2 className="text-lg font-bold text-white font-mono">{load.load_number}</h2>
          <ApprovalBadge status={load.approval_status} />
        </div>

        {error && (
          <div className="mb-4 px-4 py-3 bg-red-500/10 border border-red-500/20 rounded-lg text-sm text-red-400">
            {error}
            <button onClick={() => setError('')} className="ml-3 text-red-400/70 hover:text-red-400">✕</button>
          </div>
        )}

        {/* Main details card */}
        <div className="bg-slate-800 rounded-xl border border-slate-700 p-6 mb-4">
          <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wide mb-5">Load Details</h3>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-x-8 gap-y-5">
            <Field label="Load Number">
              <span className="font-mono">{load.load_number}</span>
            </Field>
            <Field label="Broker">{load.broker_name}</Field>
            <Field label="Driver">
              {load.driver_name ?? <span className="text-slate-500">Unassigned</span>}
            </Field>
            <Field label="Pickup Date">{fmtDate(load.pu_date)}</Field>
            <Field label="Delivery Date">{fmtDate(load.del_date)}</Field>
            <Field label="Payment Method">
              {load.payment_method ?? <span className="text-slate-500">—</span>}
            </Field>
            <Field label="Pickup Location">
              {load.pu_location ?? <span className="text-slate-500">—</span>}
            </Field>
            <Field label="Delivery Location">
              {load.del_location ?? <span className="text-slate-500">—</span>}
            </Field>
            <Field label="Payment Status">
              <PaymentBadge status={load.payment_status} />
            </Field>
          </div>
        </div>

        {/* Rates card */}
        <div className="bg-slate-800 rounded-xl border border-slate-700 p-6 mb-4">
          <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wide mb-5">Rates</h3>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-x-8 gap-y-5">
            <Field label="Gross Rate"><span className="text-white font-mono">{fmt(load.gross_rate)}</span></Field>
            <Field label="Cut Rate"><span className="font-mono text-red-400">{fmt(load.cut_rate)}</span></Field>
            <Field label="Added Rate"><span className="font-mono text-green-400">{fmt(load.added_rate)}</span></Field>
            <Field label="Final Rate"><span className="font-mono">{fmt(load.final_rate)}</span></Field>
            <Field label="Quickpay Deduction"><span className="font-mono text-red-400">{fmt(load.quickpay_deduction)}</span></Field>
            <Field label="Net Rate"><span className="text-green-400 font-mono font-semibold text-base">{fmt(load.net_rate)}</span></Field>
          </div>
        </div>

        {/* Documents card */}
        <div className="bg-slate-800 rounded-xl border border-slate-700 p-6 mb-4">
          <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wide mb-5">Documents</h3>
          <div className="flex flex-col gap-4">
            <label className="flex items-center gap-3 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={load.bol_signed}
                onChange={e => handleToggle('bol_signed', e.target.checked)}
                className="w-4 h-4 rounded border-slate-500 bg-slate-700 text-blue-500 focus:ring-blue-500 focus:ring-offset-slate-800"
              />
              <span className="text-sm text-white">BOL Signed</span>
              {load.bol_signed && (
                <span className="text-xs text-green-400">✓ Signed</span>
              )}
            </label>
            <label className="flex items-center gap-3 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={load.pod_submitted}
                onChange={e => handleToggle('pod_submitted', e.target.checked)}
                className="w-4 h-4 rounded border-slate-500 bg-slate-700 text-blue-500 focus:ring-blue-500 focus:ring-offset-slate-800"
              />
              <span className="text-sm text-white">POD Submitted</span>
              {load.pod_submitted && (
                <span className="text-xs text-green-400">✓ Submitted</span>
              )}
            </label>
          </div>
        </div>

        {/* Timeline */}
        <Timeline load={load} />

        {/* Notes card */}
        <div className="bg-slate-800 rounded-xl border border-slate-700 p-6 mb-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wide">Notes</h3>
            {saving && <span className="text-xs text-slate-500">Saving…</span>}
          </div>
          <textarea
            value={notes}
            onChange={e => setNotes(e.target.value)}
            onBlur={handleNotesSave}
            placeholder="Add notes…"
            rows={4}
            className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2.5 text-white text-sm resize-none focus:outline-none focus:border-blue-500 transition"
          />
          <p className="text-xs text-slate-500 mt-1.5">Changes saved automatically on blur.</p>
        </div>

        {/* Approval actions — HA only */}
        {isHA && load.approval_status === 'PENDING' && (
          <div className="bg-slate-800 rounded-xl border border-slate-700 p-6">
            <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wide mb-4">Approval</h3>
            <div className="flex gap-3">
              <button
                onClick={handleApprove}
                disabled={actionLoading}
                className="px-5 py-2 bg-green-600 hover:bg-green-500 disabled:opacity-60 text-white text-sm rounded-lg font-medium transition"
              >
                {actionLoading ? 'Processing…' : 'Approve'}
              </button>
              <button
                onClick={() => setShowFlag(true)}
                disabled={actionLoading}
                className="px-5 py-2 bg-red-600/20 hover:bg-red-600/40 disabled:opacity-60 text-red-400 text-sm rounded-lg font-medium border border-red-600/30 transition"
              >
                Flag
              </button>
            </div>
          </div>
        )}

        {isHA && load.approval_status !== 'PENDING' && (
          <div className="bg-slate-800 rounded-xl border border-slate-700 p-6">
            <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wide mb-3">Approval</h3>
            <div className="flex items-center gap-3">
              <ApprovalBadge status={load.approval_status} />
              <button
                onClick={handleApprove}
                disabled={actionLoading || load.approval_status === 'APPROVED'}
                className="px-4 py-1.5 text-xs border border-slate-600 hover:border-slate-500 text-slate-400 hover:text-white rounded-lg transition disabled:opacity-40"
              >
                Re-approve
              </button>
              <button
                onClick={() => setShowFlag(true)}
                disabled={actionLoading || load.approval_status === 'FLAGGED'}
                className="px-4 py-1.5 text-xs border border-red-600/30 hover:border-red-500/50 text-red-400 rounded-lg transition disabled:opacity-40"
              >
                Re-flag
              </button>
            </div>
          </div>
        )}
      </main>

      {showFlag && <FlagModal onClose={() => setShowFlag(false)} onConfirm={handleFlag} />}
    </div>
  )
}
