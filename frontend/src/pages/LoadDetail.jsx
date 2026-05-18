import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import axios from 'axios'
import { getToken, clearToken } from '../auth'
import Navbar from '../components/Navbar'
import { LoadDetailSkeleton } from '../components/Skeletons'
import Tooltip from '../components/Tooltip'

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
    PENDING: 'bg-amber-500/15 text-amber-400 ring-1 ring-amber-500/30',
    APPROVED: 'bg-emerald-500/15 text-emerald-400 ring-1 ring-emerald-500/30',
    FLAGGED: 'bg-red-500/15 text-red-400 ring-1 ring-red-500/30',
  }
  return <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${cls[status] ?? ''}`}>{status}</span>
}

function PaymentBadge({ status }) {
  const cls = {
    PENDING: 'bg-slate-700/60 text-slate-400 ring-1 ring-slate-600/40',
    INVOICED: 'bg-blue-500/15 text-blue-400 ring-1 ring-blue-500/30',
    RECEIVED: 'bg-emerald-500/15 text-emerald-400 ring-1 ring-emerald-500/30',
  }
  return <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${cls[status] ?? ''}`}>{status}</span>
}

function Field({ label, children }) {
  return (
    <div>
      <p className="text-xs font-semibold text-slate-600 uppercase tracking-widest mb-1.5">{label}</p>
      <div className="text-sm text-slate-200">{children}</div>
    </div>
  )
}

// ── Pipeline Bar ──────────────────────────────────────────────────────────────

const PIPELINE_STEPS = ['NEW', 'ACCEPTED', 'DISPATCHED', 'IN_ROUTE', 'DELIVERED']
const STEP_LABELS = { NEW: 'New', ACCEPTED: 'Accepted', DISPATCHED: 'Dispatched', IN_ROUTE: 'In Route', DELIVERED: 'Delivered' }
const STEP_DESCRIPTIONS = {
  NEW: 'Load created, awaiting acceptance',
  ACCEPTED: 'Dispatcher has accepted this load',
  DISPATCHED: 'Driver has been dispatched',
  IN_ROUTE: 'Driver is currently in transit',
  DELIVERED: 'Load has been successfully delivered',
}

function PipelineBar({ currentStatus }) {
  const currentIdx = PIPELINE_STEPS.indexOf(currentStatus || 'NEW')
  return (
    <div className="bg-slate-900 ring-1 ring-white/8 rounded-xl shadow-lg p-6 mb-5">
      <div className="flex items-center">
        {PIPELINE_STEPS.map((step, i) => {
          const done = i < currentIdx
          const active = i === currentIdx
          return (
            <div key={step} className="flex items-center flex-1 last:flex-none">
              <div className="flex flex-col items-center gap-2">
                <Tooltip text={`${STEP_LABELS[step]}: ${STEP_DESCRIPTIONS[step]}`}>
                  <div className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold transition ${
                    done
                      ? 'bg-emerald-500/15 ring-1 ring-emerald-500/40 text-emerald-400'
                      : active
                        ? 'bg-blue-500/15 ring-1 ring-blue-500/40 text-blue-400'
                        : 'bg-slate-800 ring-1 ring-white/8 text-slate-600'
                  }`}>
                    {done ? '✓' : i + 1}
                  </div>
                </Tooltip>
                <span className={`text-xs font-medium whitespace-nowrap ${
                  done ? 'text-emerald-400' : active ? 'text-blue-400' : 'text-slate-600'
                }`}>
                  {STEP_LABELS[step]}
                </span>
              </div>
              {i < PIPELINE_STEPS.length - 1 && (
                <div className={`flex-1 h-px mx-3 mb-7 ${i < currentIdx ? 'bg-emerald-500/25' : 'bg-white/[0.06]'}`} />
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
      <div className="text-xs text-slate-600 px-4 py-2 ring-1 ring-white/8 rounded-lg">
        Assign a driver before dispatching
      </div>
    )
  }

  async function handleAdvance() {
    setLoading(true)
    onUpdated({ ...load, load_status: action.next })
    try {
      const r = await API.patch(`/loads/${load.id}/status`, { status: action.next })
      onUpdated(r.data)
    } catch (err) {
      onUpdated(load)
      onError(err.response?.data?.detail || 'Status update failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <button
      onClick={handleAdvance}
      disabled={loading}
      className="px-5 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-60 text-white text-sm font-medium rounded-lg shadow-sm transition-colors"
    >
      {loading ? 'Updating…' : action.label}
    </button>
  )
}

// ── Timeline ──────────────────────────────────────────────────────────────────

const EVENT_DOT = {
  CREATED: 'bg-blue-500',
  STATUS_CHANGED: 'bg-violet-500',
  APPROVED: 'bg-emerald-500',
  FLAGGED: 'bg-red-500',
  BOL_GENERATED: 'bg-slate-500',
  INVOICE_GENERATED: 'bg-slate-500',
  BOL_SIGNED: 'bg-emerald-500',
  POD_SUBMITTED: 'bg-emerald-500',
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
      <div className="bg-slate-900 ring-1 ring-white/8 rounded-xl shadow-lg p-6 mb-5">
        <h3 className="text-xs font-semibold text-slate-600 uppercase tracking-widest mb-3">Timeline</h3>
        <p className="text-sm text-slate-600">No events yet.</p>
      </div>
    )
  }

  return (
    <div className="bg-slate-900 ring-1 ring-white/8 rounded-xl shadow-lg p-6 mb-5">
      <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-widest mb-6">Timeline</h3>
      <div className="relative">
        {events.map((ev, i) => (
          <div key={ev.id} className="flex gap-4 relative">
            {i < events.length - 1 && (
              <div className="absolute left-[6px] top-3.5 bottom-0 w-px bg-white/[0.06]" />
            )}
            <div className={`w-3.5 h-3.5 rounded-full shrink-0 mt-1 ring-2 ring-[#0c1220] ${EVENT_DOT[ev.event_type] ?? 'bg-slate-600'}`} />
            <div className="pb-5 min-w-0">
              {EVENT_LABEL[ev.event_type] && (
                <p className="text-xs font-semibold text-slate-600 uppercase tracking-widest mb-0.5">
                  {EVENT_LABEL[ev.event_type]}
                </p>
              )}
              <p className="text-sm text-slate-200">{ev.description}</p>
              <p className="text-xs text-slate-600 mt-0.5">
                {ev.created_by_name ? `${ev.created_by_name} · ` : ''}{fmtTs(ev.created_at)}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function DeleteConfirmModal({ loadNumber, onClose, onConfirm, loading }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="bg-slate-900 ring-1 ring-white/10 rounded-xl shadow-2xl p-6 w-full max-w-sm mx-4">
        <h3 className="text-base font-semibold text-white mb-2">Delete Load</h3>
        <p className="text-sm text-slate-400 mb-6">
          Are you sure you want to delete load <span className="font-mono text-white">{loadNumber}</span>? This cannot be undone.
        </p>
        <div className="flex gap-3">
          <button onClick={onClose} disabled={loading} className="flex-1 px-4 py-2 bg-slate-800 hover:bg-slate-700 ring-1 ring-white/10 text-slate-300 hover:text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50">Cancel</button>
          <button onClick={onConfirm} disabled={loading} className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white text-sm font-medium rounded-lg shadow-sm transition-colors">
            {loading ? 'Deleting…' : 'Delete'}
          </button>
        </div>
      </div>
    </div>
  )
}

function FlagModal({ onClose, onConfirm }) {
  const [reason, setReason] = useState('')
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="bg-slate-900 ring-1 ring-white/10 rounded-xl shadow-2xl p-6 w-full max-w-sm mx-4">
        <h3 className="text-base font-semibold text-white mb-4">Flag Load</h3>
        <textarea
          value={reason}
          onChange={e => setReason(e.target.value)}
          placeholder="Reason (optional)"
          rows={3}
          className="w-full bg-slate-800/60 ring-1 ring-white/10 rounded-lg px-3 py-2 text-white text-sm placeholder-slate-500 resize-none focus:outline-none focus:ring-2 focus:ring-red-500/40 transition"
        />
        <div className="flex gap-3 mt-4">
          <button onClick={() => onConfirm(reason)} className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-500 text-white text-sm font-medium rounded-lg shadow-sm transition-colors">Flag</button>
          <button onClick={onClose} className="flex-1 px-4 py-2 bg-slate-800 hover:bg-slate-700 ring-1 ring-white/10 text-slate-300 hover:text-white text-sm font-medium rounded-lg transition-colors">Cancel</button>
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
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [deleteLoading, setDeleteLoading] = useState(false)
  const [editMode, setEditMode] = useState(false)
  const [editForm, setEditForm] = useState({})
  const [editSaving, setEditSaving] = useState(false)
  const [successMsg, setSuccessMsg] = useState('')
  const [brokers, setBrokers] = useState([])
  const [drivers, setDrivers] = useState([])

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
    API.get('/brokers').then(r => setBrokers(r.data)).catch(() => {})
    API.get('/drivers').then(r => setDrivers(r.data)).catch(() => {})
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

  async function handleToggle(field, value) {
    const prevLoad = load
    setLoad(l => ({ ...l, [field]: value }))
    try {
      const r = await API.patch(`/loads/${id}`, { [field]: value })
      setLoad(r.data)
      setNotes(r.data.notes ?? '')
    } catch (err) {
      setLoad(prevLoad)
      if (err.response?.status === 401) { clearToken(); navigate('/login', { replace: true }) }
      setError(err.response?.data?.detail || 'Update failed')
    }
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

  function setEF(e) {
    setEditForm(f => ({ ...f, [e.target.name]: e.target.value }))
  }

  function openEdit() {
    setEditForm({
      load_number: load.load_number,
      broker_id: load.broker_id ? String(load.broker_id) : '',
      driver_id: load.driver_id ? String(load.driver_id) : '',
      pu_date: load.pu_date ? String(load.pu_date) : '',
      del_date: load.del_date ? String(load.del_date) : '',
      pu_location: load.pu_location ?? '',
      del_location: load.del_location ?? '',
      pu_address: load.pu_address ?? '',
      del_address: load.del_address ?? '',
      pu_time_window: load.pu_time_window ?? '',
      del_time_window: load.del_time_window ?? '',
      gross_rate: load.gross_rate != null ? String(load.gross_rate) : '',
      cut_rate: load.cut_rate != null ? String(load.cut_rate) : '',
      added_rate: load.added_rate != null ? String(load.added_rate) : '',
      payment_method: load.payment_method ?? '',
      reference_number: load.reference_number ?? '',
      weight: load.weight ?? '',
      consignee_name: load.consignee_name ?? '',
      notes: load.notes ?? '',
    })
    setEditMode(true)
    setError('')
    setSuccessMsg('')
  }

  async function handleSaveEdit(e) {
    e.preventDefault()
    setEditSaving(true)
    setError('')
    try {
      const r = await API.patch(`/loads/${id}`, {
        load_number: editForm.load_number || undefined,
        broker_id: editForm.broker_id ? parseInt(editForm.broker_id) : undefined,
        driver_id: editForm.driver_id ? parseInt(editForm.driver_id) : null,
        pu_date: editForm.pu_date || null,
        del_date: editForm.del_date || null,
        pu_location: editForm.pu_location || null,
        del_location: editForm.del_location || null,
        pu_address: editForm.pu_address || null,
        del_address: editForm.del_address || null,
        pu_time_window: editForm.pu_time_window || null,
        del_time_window: editForm.del_time_window || null,
        gross_rate: editForm.gross_rate ? parseFloat(editForm.gross_rate) : undefined,
        cut_rate: parseFloat(editForm.cut_rate) || 0,
        added_rate: parseFloat(editForm.added_rate) || 0,
        payment_method: editForm.payment_method || null,
        reference_number: editForm.reference_number || null,
        weight: editForm.weight || null,
        consignee_name: editForm.consignee_name || null,
        notes: editForm.notes || null,
      })
      setLoad(r.data)
      setNotes(r.data.notes ?? '')
      setEditMode(false)
      setSuccessMsg('Load updated successfully')
      setTimeout(() => setSuccessMsg(''), 3000)
      fetchEvents()
    } catch (err) {
      if (err.response?.status === 401) { clearToken(); navigate('/login', { replace: true }) }
      setError(err.response?.data?.detail || 'Update failed')
    } finally {
      setEditSaving(false)
    }
  }

  async function handleDelete() {
    setDeleteLoading(true)
    try {
      await API.delete(`/loads/${id}`)
      navigate('/loads', { replace: true })
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to delete load')
      setShowDeleteConfirm(false)
    } finally {
      setDeleteLoading(false)
    }
  }

  function handleLogout() { clearToken(); navigate('/login') }

  if (!user) return <div className="min-h-screen bg-[#0c1220]" />
  if (!load) {
    return (
      <div className="min-h-screen bg-[#0c1220]">
        <Navbar active="Loads" user={user} onLogout={handleLogout} />
        <main className="max-w-4xl mx-auto px-6 py-10">
          <LoadDetailSkeleton />
        </main>
      </div>
    )
  }

  const isHA = user.role === 'HEAD_ACCOUNTANT'
  const isDispatcher = user.role === 'DISPATCHER'
  const inp = 'w-full bg-slate-800/60 ring-1 ring-white/10 rounded-lg px-3 py-2 text-white text-sm placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition'
  const lbl = 'block text-xs font-semibold text-slate-600 uppercase tracking-widest mb-1.5'

  return (
    <div className="min-h-screen bg-[#0c1220]">
      <Navbar active="Loads" user={user} onLogout={handleLogout} />

      <main className="max-w-4xl mx-auto px-6 py-10">
        {/* Back + header */}
        <div className="flex items-center gap-3 mb-6 flex-wrap">
          <button onClick={() => navigate('/loads')} className="text-sm text-slate-500 hover:text-white transition-colors flex items-center gap-1.5">
            <span className="text-slate-600">←</span> Loads
          </button>
          <span className="text-slate-700">/</span>
          <h2 className="text-lg font-bold text-white font-mono">{load.load_number}</h2>
          <ApprovalBadge status={load.approval_status} />
          <div className="flex-1" />
          <div className="flex items-center gap-2 flex-wrap">
            {isDispatcher && !editMode && (
              <Tooltip text="Edit load details">
                <button
                  onClick={openEdit}
                  className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 ring-1 ring-white/10 text-slate-300 hover:text-white text-xs font-medium rounded-lg transition-colors"
                >
                  Edit Load
                </button>
              </Tooltip>
            )}
            {isDispatcher && (
              <Tooltip text="Download Bill of Lading PDF">
                <button
                  onClick={handleGenerateBOL}
                  disabled={bolLoading}
                  className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 ring-1 ring-white/10 text-slate-300 hover:text-white text-xs font-medium rounded-lg transition-colors disabled:opacity-50"
                >
                  {bolLoading ? 'Generating…' : 'Download BOL'}
                </button>
              </Tooltip>
            )}
            {isHA && (
              <Tooltip text="Download Invoice PDF">
                <button
                  onClick={handleGenerateInvoice}
                  disabled={invoiceLoading}
                  className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 ring-1 ring-white/10 text-slate-300 hover:text-white text-xs font-medium rounded-lg transition-colors disabled:opacity-50"
                >
                  {invoiceLoading ? 'Generating…' : 'Generate Invoice'}
                </button>
              </Tooltip>
            )}
            <Tooltip text="Copy public tracking URL to clipboard">
              <button
                onClick={handleCopyTracking}
                className={`px-3 py-1.5 ring-1 text-xs font-medium rounded-lg transition-colors ${
                  trackCopied
                    ? 'bg-emerald-500/15 ring-emerald-500/30 text-emerald-400'
                    : 'bg-slate-800 hover:bg-slate-700 ring-white/10 text-slate-300 hover:text-white'
                }`}
              >
                {trackCopied ? '✓ Copied!' : 'Copy Tracking Link'}
              </button>
            </Tooltip>
          </div>
        </div>

        {error && (
          <div className="mb-5 px-4 py-3 bg-red-500/10 ring-1 ring-red-500/20 rounded-xl text-sm text-red-400 flex items-center justify-between">
            {error}
            <button onClick={() => setError('')} className="ml-3 text-red-400/50 hover:text-red-400 transition-colors">✕</button>
          </div>
        )}
        {successMsg && (
          <div className="mb-5 px-4 py-3 bg-emerald-500/10 ring-1 ring-emerald-500/20 rounded-xl text-sm text-emerald-400">
            {successMsg}
          </div>
        )}

        {/* Pipeline bar */}
        <PipelineBar currentStatus={load.load_status} />

        {/* Status action for dispatchers */}
        {user.role === 'DISPATCHER' && load.load_status !== 'DELIVERED' && (
          <div className="bg-slate-900 ring-1 ring-white/8 rounded-xl shadow-lg p-5 mb-5 flex items-center gap-4">
            <div className="flex-1">
              <p className="text-xs font-semibold text-slate-600 uppercase tracking-widest mb-1">Pipeline Action</p>
              <p className="text-sm text-slate-400">
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
          <div className="bg-slate-900 ring-1 ring-white/8 rounded-xl shadow-lg p-6 mb-5">
            <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-widest mb-5">Distance & ETA</h3>
            <div className="space-y-4">
              {load.distance_miles != null && (
                <div className="flex items-start gap-4">
                  <span className="text-xs font-semibold text-slate-600 uppercase tracking-widest w-36 shrink-0 mt-0.5">Distance</span>
                  <span className="text-sm text-slate-200">
                    {load.distance_miles.toLocaleString()} miles
                    <span className="text-slate-600 ml-2">· ~{fmtDuration(load.distance_miles)} drive</span>
                  </span>
                </div>
              )}
              {load.calculated_eta && (
                <div className="flex items-start gap-4">
                  <span className="text-xs font-semibold text-slate-600 uppercase tracking-widest w-36 shrink-0 mt-0.5">Calculated ETA</span>
                  <span className="text-sm text-slate-400">{fmtTs(load.calculated_eta)}</span>
                </div>
              )}
              <div className="flex items-start gap-4">
                <span className="text-xs font-semibold text-slate-600 uppercase tracking-widest w-36 shrink-0 mt-0.5">Driver ETA</span>
                {etaEdit ? (
                  <form onSubmit={handleSaveDriverEta} className="flex flex-col gap-2 flex-1">
                    <input
                      type="datetime-local"
                      value={etaForm.driver_eta}
                      onChange={e => setEtaForm(f => ({ ...f, driver_eta: e.target.value }))}
                      className="bg-slate-800/60 ring-1 ring-white/10 rounded-lg px-3 py-1.5 text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition w-56"
                    />
                    <input
                      type="text"
                      value={etaForm.eta_notes}
                      onChange={e => setEtaForm(f => ({ ...f, eta_notes: e.target.value }))}
                      placeholder="Notes (optional)…"
                      className="bg-slate-800/60 ring-1 ring-white/10 rounded-lg px-3 py-1.5 text-white text-sm placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition w-72"
                    />
                    <div className="flex gap-2">
                      <button type="submit" disabled={etaSaving} className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-xs font-medium rounded-lg shadow-sm transition-colors">
                        {etaSaving ? 'Saving…' : 'Save'}
                      </button>
                      <button type="button" onClick={() => setEtaEdit(false)} className="px-3 py-1.5 text-slate-500 hover:text-white text-xs transition-colors">Cancel</button>
                    </div>
                  </form>
                ) : (
                  <div className="flex items-center gap-3 flex-wrap">
                    <span className="text-sm text-slate-200">
                      {load.driver_eta ? fmtTs(load.driver_eta) : <span className="text-slate-700">Not set</span>}
                    </span>
                    {isDispatcher && (
                      <button onClick={openEtaEdit} className="text-xs text-blue-400 hover:text-blue-300 transition-colors">
                        {load.driver_eta ? 'Edit' : '+ Set ETA'}
                      </button>
                    )}
                  </div>
                )}
              </div>
              {load.eta_notes && !etaEdit && (
                <div className="flex items-start gap-4">
                  <span className="text-xs font-semibold text-slate-600 uppercase tracking-widest w-36 shrink-0 mt-0.5">ETA Notes</span>
                  <span className="text-sm text-slate-400">{load.eta_notes}</span>
                </div>
              )}
            </div>
          </div>
        )}

        {editMode ? (
          <form id="load-edit-form" onSubmit={handleSaveEdit} className="space-y-4 mb-5">
            {/* Load Details */}
            <div className="bg-slate-900 ring-1 ring-white/8 rounded-xl shadow-lg p-6">
              <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-widest mb-5">Load Details</h3>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <div><label className={lbl}>Load Number *</label><input name="load_number" value={editForm.load_number} onChange={setEF} required className={inp} /></div>
                <div>
                  <label className={lbl}>Broker *</label>
                  <select name="broker_id" value={editForm.broker_id} onChange={setEF} required className={inp}>
                    <option value="">Select broker…</option>
                    {brokers.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className={lbl}>Driver</label>
                  <select name="driver_id" value={editForm.driver_id} onChange={setEF} className={inp}>
                    <option value="">No driver assigned</option>
                    {drivers.filter(d => d.is_active !== false).map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                  </select>
                </div>
                <div><label className={lbl}>Pickup Date</label><input name="pu_date" value={editForm.pu_date} onChange={setEF} type="date" className={inp} /></div>
                <div><label className={lbl}>Delivery Date</label><input name="del_date" value={editForm.del_date} onChange={setEF} type="date" className={inp} /></div>
                <div>
                  <label className={lbl}>Payment Method</label>
                  <select name="payment_method" value={editForm.payment_method} onChange={setEF} className={inp}>
                    <option value="">None</option>
                    <option value="RTS">RTS</option>
                    <option value="QUICKPAY">QUICKPAY</option>
                  </select>
                </div>
                <div><label className={lbl}>Pickup Location</label><input name="pu_location" value={editForm.pu_location} onChange={setEF} className={inp} placeholder="City, ST" /></div>
                <div><label className={lbl}>Pickup Address</label><input name="pu_address" value={editForm.pu_address} onChange={setEF} className={inp} /></div>
                <div><label className={lbl}>Pickup Time Window</label><input name="pu_time_window" value={editForm.pu_time_window} onChange={setEF} className={inp} /></div>
                <div><label className={lbl}>Delivery Location</label><input name="del_location" value={editForm.del_location} onChange={setEF} className={inp} placeholder="City, ST" /></div>
                <div><label className={lbl}>Delivery Address</label><input name="del_address" value={editForm.del_address} onChange={setEF} className={inp} /></div>
                <div><label className={lbl}>Delivery Time Window</label><input name="del_time_window" value={editForm.del_time_window} onChange={setEF} className={inp} /></div>
                <div><label className={lbl}>Reference #</label><input name="reference_number" value={editForm.reference_number} onChange={setEF} className={inp} /></div>
                <div><label className={lbl}>Weight</label><input name="weight" value={editForm.weight} onChange={setEF} className={inp} /></div>
                <div><label className={lbl}>Consignee</label><input name="consignee_name" value={editForm.consignee_name} onChange={setEF} className={inp} /></div>
              </div>
            </div>
            {/* Rates */}
            <div className="bg-slate-900 ring-1 ring-white/8 rounded-xl shadow-lg p-6">
              <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-widest mb-5">Rates</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div><label className={lbl}>Gross Rate *</label><input name="gross_rate" value={editForm.gross_rate} onChange={setEF} type="number" step="0.01" required className={inp} /></div>
                <div><label className={lbl}>Cut Rate</label><input name="cut_rate" value={editForm.cut_rate} onChange={setEF} type="number" step="0.01" className={inp} /></div>
                <div><label className={lbl}>Added Rate</label><input name="added_rate" value={editForm.added_rate} onChange={setEF} type="number" step="0.01" className={inp} /></div>
                <div>
                  <label className={lbl}>Final Rate (auto)</label>
                  <div className="px-3 py-2 bg-slate-800/40 ring-1 ring-white/5 rounded-lg text-emerald-400 text-sm font-mono">
                    {fmt((parseFloat(editForm.gross_rate)||0) - (parseFloat(editForm.cut_rate)||0) + (parseFloat(editForm.added_rate)||0))}
                  </div>
                </div>
              </div>
            </div>
            {/* Notes */}
            <div className="bg-slate-900 ring-1 ring-white/8 rounded-xl shadow-lg p-6">
              <label className={lbl}>Notes</label>
              <textarea name="notes" value={editForm.notes} onChange={setEF} rows={4} className={`${inp} resize-none mt-1`} placeholder="Notes…" />
            </div>
            {/* Actions */}
            <div className="flex gap-3 justify-end">
              <button type="button" onClick={() => setEditMode(false)} className="px-5 py-2 bg-slate-800 hover:bg-slate-700 ring-1 ring-white/10 text-slate-300 hover:text-white text-sm font-medium rounded-lg transition-colors">
                Cancel
              </button>
              <button type="submit" disabled={editSaving} className="px-5 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-sm font-medium rounded-lg shadow-sm transition-colors">
                {editSaving ? 'Saving…' : 'Save Changes'}
              </button>
            </div>
          </form>
        ) : (
          <>
            {/* Main details */}
            <div className="bg-slate-900 ring-1 ring-white/8 rounded-xl shadow-lg p-6 mb-5">
              <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-widest mb-6">Load Details</h3>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-x-8 gap-y-6">
                <Field label="Load Number"><span className="font-mono">{load.load_number}</span></Field>
                <Field label="Broker">{load.broker_name}</Field>
                <Field label="Driver">{load.driver_name ?? <span className="text-slate-600">Unassigned</span>}</Field>
                <Field label="Pickup">
                  <div>{fmtDate(load.pu_date)}</div>
                  {load.pu_time_window && <div className="text-xs text-slate-600 mt-0.5">{load.pu_time_window}</div>}
                </Field>
                <Field label="Delivery">
                  <div>{fmtDate(load.del_date)}</div>
                  {load.del_time_window && <div className="text-xs text-slate-600 mt-0.5">{load.del_time_window}</div>}
                </Field>
                {!isDispatcher && <Field label="Payment Method">{load.payment_method ?? <span className="text-slate-600">—</span>}</Field>}
                <Field label="Pickup Location">
                  <div>{load.pu_location || <span className="text-slate-600">—</span>}</div>
                  {load.pu_address && <div className="text-xs text-slate-600 mt-0.5">{load.pu_address}</div>}
                </Field>
                <Field label="Delivery Location">
                  <div>{load.del_location || <span className="text-slate-600">—</span>}</div>
                  {load.del_address && <div className="text-xs text-slate-600 mt-0.5">{load.del_address}</div>}
                </Field>
                {load.consignee_name && <Field label="Consignee">{load.consignee_name}</Field>}
                {load.reference_number && <Field label="Reference #"><span className="font-mono">{load.reference_number}</span></Field>}
                {load.weight && <Field label="Weight">{load.weight}</Field>}
                {!isDispatcher && <Field label="Payment Status"><PaymentBadge status={load.payment_status} /></Field>}
              </div>
            </div>

            {/* Rates */}
            <div className="bg-slate-900 ring-1 ring-white/8 rounded-xl shadow-lg p-6 mb-5">
              <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-widest mb-6">Rates</h3>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-x-8 gap-y-6">
                <Field label="Gross Rate"><span className="text-white font-mono">{fmt(load.gross_rate)}</span></Field>
                <Field label="Cut Rate"><span className="font-mono text-red-400">{fmt(load.cut_rate)}</span></Field>
                <Field label="Added Rate"><span className="font-mono text-emerald-400">{fmt(load.added_rate)}</span></Field>
                <Field label="Final Rate"><span className="font-mono text-slate-200">{fmt(load.final_rate)}</span></Field>
                {!isDispatcher && <Field label="Quickpay Deduction"><span className="font-mono text-red-400">{fmt(load.quickpay_deduction)}</span></Field>}
                {!isDispatcher && <Field label="Net Rate"><span className="text-emerald-400 font-mono font-bold text-base">{fmt(load.net_rate)}</span></Field>}
              </div>
            </div>
          </>
        )}

        {/* Documents */}
        <div className="bg-slate-900 ring-1 ring-white/8 rounded-xl shadow-lg p-6 mb-5">
          <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-widest mb-5">Documents</h3>
          <div className="flex flex-col gap-4">
            <label className="flex items-center gap-3 cursor-pointer select-none group">
              <input type="checkbox" checked={load.bol_signed} onChange={e => handleToggle('bol_signed', e.target.checked)}
                className="w-4 h-4 rounded border-slate-600 bg-slate-800 text-blue-500 focus:ring-blue-500 focus:ring-offset-0 focus:ring-offset-transparent" />
              <span className="text-sm text-slate-300 group-hover:text-white transition-colors">BOL Signed</span>
              {load.bol_signed && <span className="text-xs text-emerald-400">✓ Signed</span>}
            </label>
            <label className="flex items-center gap-3 cursor-pointer select-none group">
              <input type="checkbox" checked={load.pod_submitted} onChange={e => handleToggle('pod_submitted', e.target.checked)}
                className="w-4 h-4 rounded border-slate-600 bg-slate-800 text-blue-500 focus:ring-blue-500 focus:ring-offset-0 focus:ring-offset-transparent" />
              <span className="text-sm text-slate-300 group-hover:text-white transition-colors">POD Submitted</span>
              {load.pod_submitted && <span className="text-xs text-emerald-400">✓ Submitted</span>}
            </label>
          </div>
        </div>

        {/* Timeline */}
        <Timeline events={events} />

        {!editMode && (
          <div className="bg-slate-900 ring-1 ring-white/8 rounded-xl shadow-lg p-6 mb-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-widest">Notes</h3>
              {saving && <span className="text-xs text-slate-600">Saving…</span>}
            </div>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              onBlur={handleNotesSave}
              placeholder="Add notes…"
              rows={4}
              className="w-full bg-slate-800/60 ring-1 ring-white/10 rounded-lg px-3 py-2.5 text-white text-sm placeholder-slate-600 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition"
            />
            <p className="text-xs text-slate-700 mt-1.5">Changes saved automatically on blur.</p>
          </div>
        )}

        {/* Approval — HA only */}
        {isHA && load.approval_status === 'PENDING' && (
          <div className="bg-slate-900 ring-1 ring-white/8 rounded-xl shadow-lg p-6">
            <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-widest mb-5">Approval</h3>
            <div className="flex gap-3">
              <button onClick={handleApprove} disabled={actionLoading} className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-60 text-white text-sm font-medium rounded-lg shadow-sm transition-colors">
                {actionLoading ? 'Processing…' : 'Approve'}
              </button>
              <button onClick={() => setShowFlag(true)} disabled={actionLoading} className="px-5 py-2 bg-red-500/15 hover:bg-red-500/25 disabled:opacity-60 text-red-400 text-sm font-medium rounded-lg ring-1 ring-red-500/30 transition-colors">
                Flag
              </button>
            </div>
          </div>
        )}

        {isHA && load.approval_status !== 'PENDING' && (
          <div className="bg-slate-900 ring-1 ring-white/8 rounded-xl shadow-lg p-6">
            <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-widest mb-4">Approval</h3>
            <div className="flex items-center gap-3">
              <ApprovalBadge status={load.approval_status} />
              <button onClick={handleApprove} disabled={actionLoading || load.approval_status === 'APPROVED'} className="px-4 py-1.5 text-xs bg-slate-800 hover:bg-slate-700 ring-1 ring-white/10 text-slate-400 hover:text-white rounded-lg transition-colors disabled:opacity-40">
                Re-approve
              </button>
              <button onClick={() => setShowFlag(true)} disabled={actionLoading || load.approval_status === 'FLAGGED'} className="px-4 py-1.5 text-xs bg-red-500/15 hover:bg-red-500/25 ring-1 ring-red-500/30 text-red-400 rounded-lg transition-colors disabled:opacity-40">
                Re-flag
              </button>
            </div>
          </div>
        )}

        {isDispatcher && !editMode && (
          <div className="mt-8 pt-5 border-t border-white/[0.05] flex justify-end">
            <Tooltip text="Permanently delete this load" position="top">
              <button
                onClick={() => setShowDeleteConfirm(true)}
                className="px-4 py-2 bg-red-500/10 hover:bg-red-500/20 ring-1 ring-red-500/25 text-red-400 hover:text-red-300 text-sm font-medium rounded-lg transition-colors"
              >
                Delete Load
              </button>
            </Tooltip>
          </div>
        )}
      </main>

      {showFlag && <FlagModal onClose={() => setShowFlag(false)} onConfirm={handleFlag} />}
      {showDeleteConfirm && (
        <DeleteConfirmModal
          loadNumber={load.load_number}
          onClose={() => setShowDeleteConfirm(false)}
          onConfirm={handleDelete}
          loading={deleteLoading}
        />
      )}
    </div>
  )
}
