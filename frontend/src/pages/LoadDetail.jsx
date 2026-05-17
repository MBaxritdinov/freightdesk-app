import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import axios from 'axios'
import { getToken, clearToken } from '../auth'
import Navbar from '../components/Navbar'

const API = axios.create({ baseURL: import.meta.env.VITE_API_URL || 'http://localhost:8000' })
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

function fmtTs(iso) {
  if (!iso) return null
  return new Date(iso).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}

function fmtDuration(miles) {
  const hrs = miles / 55
  const h = Math.floor(hrs)
  const m = Math.round((hrs - h) * 60)
  return m > 0 ? `${h}h ${m}min` : `${h}h`
}

function ApprovalBadge({ status }) {
  const cls = {
    PENDING: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
    APPROVED: 'bg-green-500/20 text-green-400 border-green-500/30',
    FLAGGED: 'bg-red-500/20 text-red-400 border-red-500/30',
  }
  return <span className={`px-2.5 py-1 rounded-full text-xs font-medium border ${cls[status] ?? ''}`}>{status}</span>
}

function PaymentBadge({ status }) {
  const cls = {
    PENDING: 'bg-slate-600/40 text-slate-300 border-slate-500/30',
    INVOICED: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
    RECEIVED: 'bg-green-500/20 text-green-400 border-green-500/30',
  }
  return <span className={`px-2.5 py-1 rounded-full text-xs font-medium border ${cls[status] ?? ''}`}>{status}</span>
}

function Field({ label, children }) {
  return (
    <div>
      <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">{label}</p>
      <div className="text-sm text-white">{children}</div>
    </div>
  )
}

// ── Pipeline Bar ──────────────────────────────────────────────────────────────

const PIPELINE_STEPS = ['NEW', 'ACCEPTED', 'DISPATCHED', 'IN_ROUTE', 'DELIVERED']
const STEP_LABELS = { NEW: 'New', ACCEPTED: 'Accepted', DISPATCHED: 'Dispatched', IN_ROUTE: 'In Route', DELIVERED: 'Delivered' }

function PipelineBar({ currentStatus }) {
  const currentIdx = PIPELINE_STEPS.indexOf(currentStatus || 'NEW')
  return (
    <div className="bg-slate-800 rounded-xl border border-slate-700 p-5 mb-4">
      <div className="flex items-center">
        {PIPELINE_STEPS.map((step, i) => {
          const done = i < currentIdx
          const active = i === currentIdx
          return (
            <div key={step} className="flex items-center flex-1 last:flex-none">
              <div className="flex flex-col items-center gap-1.5">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold border-2 transition ${
                  done
                    ? 'bg-green-500/20 border-green-500 text-green-400'
                    : active
                      ? 'bg-blue-500/20 border-blue-500 text-blue-400'
                      : 'bg-slate-700 border-slate-600 text-slate-500'
                }`}>
                  {done ? '✓' : i + 1}
                </div>
                <span className={`text-xs font-medium whitespace-nowrap ${
                  done ? 'text-green-400' : active ? 'text-blue-400' : 'text-slate-500'
                }`}>
                  {STEP_LABELS[step]}
                </span>
              </div>
              {i < PIPELINE_STEPS.length - 1 && (
                <div className={`flex-1 h-px mx-2 mb-5 ${i < currentIdx ? 'bg-green-500/40' : 'bg-slate-700'}`} />
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── Status Action Button ──────────────────────────────────────────────────────

const NEXT_ACTION = {
  NEW: { label: 'Accept Load', next: 'ACCEPTED' },
  ACCEPTED: { label: 'Dispatch', next: 'DISPATCHED' },
  DISPATCHED: { label: 'Mark In Route', next: 'IN_ROUTE' },
  IN_ROUTE: { label: 'Confirm Delivery', next: 'DELIVERED' },
}

function StatusActionButton({ load, user, onUpdated, onError }) {
  const [loading, setLoading] = useState(false)
  const action = NEXT_ACTION[load.load_status]
  if (!action || load.load_status === 'DELIVERED') return null
  if (user.role !== 'DISPATCHER') return null

  if (action.next === 'DISPATCHED' && !load.driver_id) {
    return (
      <div className="text-xs text-slate-500 px-4 py-2 border border-slate-700 rounded-lg">
        Assign a driver before dispatching
      </div>
    )
  }

  async function handleAdvance() {
    setLoading(true)
    try {
      const r = await API.patch(`/loads/${load.id}/status`, { status: action.next })
      onUpdated(r.data)
    } catch (err) {
      onError(err.response?.data?.detail || 'Status update failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <button
      onClick={handleAdvance}
      disabled={loading}
      className="px-5 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-60 text-white text-sm rounded-lg font-medium transition"
    >
      {loading ? 'Updating…' : action.label}
    </button>
  )
}

// ── Timeline ──────────────────────────────────────────────────────────────────

const EVENT_DOT = {
  CREATED: 'bg-blue-500',
  STATUS_CHANGED: 'bg-purple-500',
  APPROVED: 'bg-green-500',
  FLAGGED: 'bg-red-500',
  BOL_GENERATED: 'bg-slate-500',
  INVOICE_GENERATED: 'bg-slate-500',
  BOL_SIGNED: 'bg-green-500',
  POD_SUBMITTED: 'bg-green-500',
}
const EVENT_LABEL = {
  CREATED: 'Load Created',
  STATUS_CHANGED: 'Status Changed',
  APPROVED: 'Approved',
  FLAGGED: 'Flagged',
  BOL_GENERATED: 'BOL Generated',
  INVOICE_GENERATED: 'Invoice Generated',
  BOL_SIGNED: 'BOL Signed',
  POD_SUBMITTED: 'POD Submitted',
  NOTE_ADDED: 'Note Added',
}

function Timeline({ events }) {
  if (!events || events.length === 0) {
    return (
      <div className="bg-slate-800 rounded-xl border border-slate-700 p-6 mb-4">
        <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wide mb-3">Timeline</h3>
        <p className="text-sm text-slate-500">No events yet.</p>
      </div>
    )
  }

  return (
    <div className="bg-slate-800 rounded-xl border border-slate-700 p-6 mb-4">
      <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wide mb-5">Timeline</h3>
      <div className="relative">
        {events.map((ev, i) => (
          <div key={ev.id} className="flex gap-4 relative">
            {i < events.length - 1 && (
              <div className="absolute left-[6px] top-3.5 bottom-0 w-px bg-slate-700" />
            )}
            <div className={`w-3.5 h-3.5 rounded-full shrink-0 mt-1 ring-2 ring-slate-800 ${EVENT_DOT[ev.event_type] ?? 'bg-slate-500'}`} />
            <div className="pb-5 min-w-0">
              {EVENT_LABEL[ev.event_type] && (
                <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-0.5">
                  {EVENT_LABEL[ev.event_type]}
                </p>
              )}
              <p className="text-sm text-white">{ev.description}</p>
              <p className="text-xs text-slate-500 mt-0.5">
                {ev.created_by_name ? `${ev.created_by_name} · ` : ''}{fmtTs(ev.created_at)}
              </p>
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
          <button onClick={() => onConfirm(reason)} className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-500 text-white text-sm rounded-lg font-medium transition">Flag</button>
          <button onClick={onClose} className="flex-1 px-4 py-2 border border-slate-600 hover:border-slate-500 text-slate-300 hover:text-white text-sm rounded-lg transition">Cancel</button>
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
  const [events, setEvents] = useState([])
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [actionLoading, setActionLoading] = useState(false)
  const [showFlag, setShowFlag] = useState(false)
  const [error, setError] = useState('')
  const [bolLoading, setBolLoading] = useState(false)
  const [invoiceLoading, setInvoiceLoading] = useState(false)
  const [trackCopied, setTrackCopied] = useState(false)
  const [etaEdit, setEtaEdit] = useState(false)
  const [etaForm, setEtaForm] = useState({ driver_eta: '', eta_notes: '' })
  const [etaSaving, setEtaSaving] = useState(false)

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
    fetchEvents()
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

  async function fetchEvents() {
    try {
      const r = await API.get(`/loads/${id}/events`)
      setEvents(r.data)
    } catch {}
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

  async function handleToggle(field, value) { await patch({ [field]: value }) }

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

  async function handleGenerateBOL() {
    setBolLoading(true)
    try {
      const r = await API.get(`/loads/${id}/bol`, { responseType: 'blob' })
      const url = URL.createObjectURL(r.data)
      const a = document.createElement('a')
      a.href = url
      a.download = `BOL-${load.load_number}.pdf`
      a.click()
      URL.revokeObjectURL(url)
      fetchEvents()
    } catch {
      setError('Failed to generate BOL')
    } finally {
      setBolLoading(false)
    }
  }

  async function handleGenerateInvoice() {
    setInvoiceLoading(true)
    try {
      const r = await API.get(`/loads/${id}/invoice`, { responseType: 'blob' })
      const url = URL.createObjectURL(r.data)
      const a = document.createElement('a')
      a.href = url
      a.download = `INV-${load.load_number}.pdf`
      a.click()
      URL.revokeObjectURL(url)
      fetchEvents()
    } catch {
      setError('Failed to generate invoice')
    } finally {
      setInvoiceLoading(false)
    }
  }

  function openEtaEdit() {
    setEtaForm({
      driver_eta: load.driver_eta ? new Date(load.driver_eta).toISOString().slice(0, 16) : '',
      eta_notes: load.eta_notes ?? '',
    })
    setEtaEdit(true)
  }

  async function handleSaveDriverEta(e) {
    e.preventDefault()
    setEtaSaving(true)
    try {
      const r = await API.patch(`/loads/${id}/driver-eta`, {
        driver_eta: etaForm.driver_eta || null,
        eta_notes: etaForm.eta_notes || null,
      })
      setLoad(r.data)
      setEtaEdit(false)
      fetchEvents()
    } catch (err) {
      setError(err.response?.data?.detail || 'ETA update failed')
    } finally {
      setEtaSaving(false)
    }
  }

  function handleCopyTracking() {
    const url = `${window.location.origin}/track/${load.load_number}`
    navigator.clipboard.writeText(url).then(() => {
      setTrackCopied(true)
      setTimeout(() => setTrackCopied(false), 2000)
    })
  }

  function handleLogout() { clearToken(); navigate('/login') }

  if (!user || !load) {
    return <div className="min-h-screen flex items-center justify-center bg-slate-900"><p className="text-slate-400">Loading…</p></div>
  }

  const isHA = user.role === 'HEAD_ACCOUNTANT'
  const isDispatcher = user.role === 'DISPATCHER'

  return (
    <div className="min-h-screen bg-slate-900">
      <Navbar active="Loads" user={user} onLogout={handleLogout} />

      <main className="max-w-4xl mx-auto px-6 py-8">
        {/* Back + header */}
        <div className="flex items-center gap-3 mb-4 flex-wrap">
          <button onClick={() => navigate('/loads')} className="text-sm text-slate-400 hover:text-white transition flex items-center gap-1">
            ← Loads
          </button>
          <span className="text-slate-600">/</span>
          <h2 className="text-lg font-bold text-white font-mono">{load.load_number}</h2>
          <ApprovalBadge status={load.approval_status} />
          <div className="flex-1" />
          <div className="flex items-center gap-2 flex-wrap">
            {isDispatcher && (
              <button
                onClick={handleGenerateBOL}
                disabled={bolLoading}
                className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 border border-slate-600 text-white text-xs rounded-lg font-medium transition disabled:opacity-50"
              >
                {bolLoading ? 'Generating…' : 'Download BOL'}
              </button>
            )}
            {isHA && (
              <button
                onClick={handleGenerateInvoice}
                disabled={invoiceLoading}
                className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 border border-slate-600 text-white text-xs rounded-lg font-medium transition disabled:opacity-50"
              >
                {invoiceLoading ? 'Generating…' : 'Generate Invoice'}
              </button>
            )}
            <button
              onClick={handleCopyTracking}
              className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 border border-slate-600 text-xs rounded-lg font-medium transition text-slate-300 hover:text-white"
            >
              {trackCopied ? '✓ Copied!' : 'Copy Tracking Link'}
            </button>
          </div>
        </div>

        {error && (
          <div className="mb-4 px-4 py-3 bg-red-500/10 border border-red-500/20 rounded-lg text-sm text-red-400">
            {error}
            <button onClick={() => setError('')} className="ml-3 text-red-400/70 hover:text-red-400">✕</button>
          </div>
        )}

        {/* Pipeline bar */}
        <PipelineBar currentStatus={load.load_status} />

        {/* Status action for dispatchers */}
        {user.role === 'DISPATCHER' && load.load_status !== 'DELIVERED' && (
          <div className="bg-slate-800 rounded-xl border border-slate-700 p-5 mb-4 flex items-center gap-4">
            <div className="flex-1">
              <p className="text-xs text-slate-400 uppercase tracking-wide mb-0.5">Pipeline Action</p>
              <p className="text-sm text-slate-300">
                Current status: <span className="text-white font-medium">{STEP_LABELS[load.load_status] || load.load_status}</span>
              </p>
            </div>
            <StatusActionButton
              load={load}
              user={user}
              onUpdated={updated => { setLoad(updated); fetchEvents() }}
              onError={setError}
            />
          </div>
        )}

        {/* Distance & ETA */}
        {(load.distance_miles || load.calculated_eta || load.driver_eta) && (
          <div className="bg-slate-800 rounded-xl border border-slate-700 p-6 mb-4">
            <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wide mb-5">Distance & ETA</h3>
            <div className="space-y-4">
              {load.distance_miles != null && (
                <div className="flex items-start gap-3">
                  <span className="text-xs text-slate-500 uppercase tracking-wide w-36 shrink-0 mt-0.5">Distance</span>
                  <span className="text-sm text-white">
                    {load.distance_miles.toLocaleString()} miles
                    <span className="text-slate-500 ml-2">· ~{fmtDuration(load.distance_miles)} drive</span>
                  </span>
                </div>
              )}
              {load.calculated_eta && (
                <div className="flex items-start gap-3">
                  <span className="text-xs text-slate-500 uppercase tracking-wide w-36 shrink-0 mt-0.5">Calculated ETA</span>
                  <span className="text-sm text-slate-300">{fmtTs(load.calculated_eta)}</span>
                </div>
              )}
              <div className="flex items-start gap-3">
                <span className="text-xs text-slate-500 uppercase tracking-wide w-36 shrink-0 mt-0.5">Driver ETA</span>
                {etaEdit ? (
                  <form onSubmit={handleSaveDriverEta} className="flex flex-col gap-2 flex-1">
                    <input
                      type="datetime-local"
                      value={etaForm.driver_eta}
                      onChange={e => setEtaForm(f => ({ ...f, driver_eta: e.target.value }))}
                      className="bg-slate-700 border border-slate-600 rounded px-3 py-1.5 text-white text-sm focus:outline-none focus:border-blue-500 transition w-56"
                    />
                    <input
                      type="text"
                      value={etaForm.eta_notes}
                      onChange={e => setEtaForm(f => ({ ...f, eta_notes: e.target.value }))}
                      placeholder="Notes (optional)…"
                      className="bg-slate-700 border border-slate-600 rounded px-3 py-1.5 text-white text-sm focus:outline-none focus:border-blue-500 transition w-72"
                    />
                    <div className="flex gap-2">
                      <button type="submit" disabled={etaSaving} className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-xs rounded-lg font-medium transition">
                        {etaSaving ? 'Saving…' : 'Save'}
                      </button>
                      <button type="button" onClick={() => setEtaEdit(false)} className="px-3 py-1.5 text-slate-400 hover:text-white text-xs transition">Cancel</button>
                    </div>
                  </form>
                ) : (
                  <div className="flex items-center gap-3 flex-wrap">
                    <span className="text-sm text-white">
                      {load.driver_eta ? fmtTs(load.driver_eta) : <span className="text-slate-600">Not set</span>}
                    </span>
                    {isDispatcher && (
                      <button onClick={openEtaEdit} className="text-xs text-blue-400 hover:text-blue-300 transition">
                        {load.driver_eta ? 'Edit' : '+ Set ETA'}
                      </button>
                    )}
                  </div>
                )}
              </div>
              {load.eta_notes && !etaEdit && (
                <div className="flex items-start gap-3">
                  <span className="text-xs text-slate-500 uppercase tracking-wide w-36 shrink-0 mt-0.5">ETA Notes</span>
                  <span className="text-sm text-slate-300">{load.eta_notes}</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Main details */}
        <div className="bg-slate-800 rounded-xl border border-slate-700 p-6 mb-4">
          <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wide mb-5">Load Details</h3>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-x-8 gap-y-5">
            <Field label="Load Number"><span className="font-mono">{load.load_number}</span></Field>
            <Field label="Broker">{load.broker_name}</Field>
            <Field label="Driver">{load.driver_name ?? <span className="text-slate-500">Unassigned</span>}</Field>
            <Field label="Pickup">
              <div>{fmtDate(load.pu_date)}</div>
              {load.pu_time_window && <div className="text-xs text-slate-500 mt-0.5">{load.pu_time_window}</div>}
            </Field>
            <Field label="Delivery">
              <div>{fmtDate(load.del_date)}</div>
              {load.del_time_window && <div className="text-xs text-slate-500 mt-0.5">{load.del_time_window}</div>}
            </Field>
            {!isDispatcher && <Field label="Payment Method">{load.payment_method ?? <span className="text-slate-500">—</span>}</Field>}
            <Field label="Pickup Location">
              <div>{load.pu_location ?? <span className="text-slate-500">—</span>}</div>
              {load.pu_address && <div className="text-xs text-slate-500 mt-0.5">{load.pu_address}</div>}
            </Field>
            <Field label="Delivery Location">
              <div>{load.del_location ?? <span className="text-slate-500">—</span>}</div>
              {load.del_address && <div className="text-xs text-slate-500 mt-0.5">{load.del_address}</div>}
            </Field>
            {load.consignee_name && <Field label="Consignee">{load.consignee_name}</Field>}
            {load.reference_number && <Field label="Reference #"><span className="font-mono">{load.reference_number}</span></Field>}
            {load.weight && <Field label="Weight">{load.weight}</Field>}
            {!isDispatcher && <Field label="Payment Status"><PaymentBadge status={load.payment_status} /></Field>}
          </div>
        </div>

        {/* Rates */}
        <div className="bg-slate-800 rounded-xl border border-slate-700 p-6 mb-4">
          <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wide mb-5">Rates</h3>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-x-8 gap-y-5">
            <Field label="Gross Rate"><span className="text-white font-mono">{fmt(load.gross_rate)}</span></Field>
            <Field label="Cut Rate"><span className="font-mono text-red-400">{fmt(load.cut_rate)}</span></Field>
            <Field label="Added Rate"><span className="font-mono text-green-400">{fmt(load.added_rate)}</span></Field>
            <Field label="Final Rate"><span className="font-mono">{fmt(load.final_rate)}</span></Field>
            {!isDispatcher && <Field label="Quickpay Deduction"><span className="font-mono text-red-400">{fmt(load.quickpay_deduction)}</span></Field>}
            {!isDispatcher && <Field label="Net Rate"><span className="text-green-400 font-mono font-semibold text-base">{fmt(load.net_rate)}</span></Field>}
          </div>
        </div>

        {/* Documents */}
        <div className="bg-slate-800 rounded-xl border border-slate-700 p-6 mb-4">
          <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wide mb-5">Documents</h3>
          <div className="flex flex-col gap-4">
            <label className="flex items-center gap-3 cursor-pointer select-none">
              <input type="checkbox" checked={load.bol_signed} onChange={e => handleToggle('bol_signed', e.target.checked)}
                className="w-4 h-4 rounded border-slate-500 bg-slate-700 text-blue-500 focus:ring-blue-500 focus:ring-offset-slate-800" />
              <span className="text-sm text-white">BOL Signed</span>
              {load.bol_signed && <span className="text-xs text-green-400">✓ Signed</span>}
            </label>
            <label className="flex items-center gap-3 cursor-pointer select-none">
              <input type="checkbox" checked={load.pod_submitted} onChange={e => handleToggle('pod_submitted', e.target.checked)}
                className="w-4 h-4 rounded border-slate-500 bg-slate-700 text-blue-500 focus:ring-blue-500 focus:ring-offset-slate-800" />
              <span className="text-sm text-white">POD Submitted</span>
              {load.pod_submitted && <span className="text-xs text-green-400">✓ Submitted</span>}
            </label>
          </div>
        </div>

        {/* Timeline from events */}
        <Timeline events={events} />

        {/* Notes */}
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

        {/* Approval — HA only */}
        {isHA && load.approval_status === 'PENDING' && (
          <div className="bg-slate-800 rounded-xl border border-slate-700 p-6">
            <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wide mb-4">Approval</h3>
            <div className="flex gap-3">
              <button onClick={handleApprove} disabled={actionLoading} className="px-5 py-2 bg-green-600 hover:bg-green-500 disabled:opacity-60 text-white text-sm rounded-lg font-medium transition">
                {actionLoading ? 'Processing…' : 'Approve'}
              </button>
              <button onClick={() => setShowFlag(true)} disabled={actionLoading} className="px-5 py-2 bg-red-600/20 hover:bg-red-600/40 disabled:opacity-60 text-red-400 text-sm rounded-lg font-medium border border-red-600/30 transition">
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
              <button onClick={handleApprove} disabled={actionLoading || load.approval_status === 'APPROVED'} className="px-4 py-1.5 text-xs border border-slate-600 hover:border-slate-500 text-slate-400 hover:text-white rounded-lg transition disabled:opacity-40">
                Re-approve
              </button>
              <button onClick={() => setShowFlag(true)} disabled={actionLoading || load.approval_status === 'FLAGGED'} className="px-4 py-1.5 text-xs border border-red-600/30 hover:border-red-500/50 text-red-400 rounded-lg transition disabled:opacity-40">
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
