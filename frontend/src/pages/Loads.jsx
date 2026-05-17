import { useEffect, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
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
  if (err.response?.status === 401) { clearToken(); navigate('/login', { replace: true }) }
}

function Spinner() {
  return (
    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
    </svg>
  )
}

// ── Badges ──────────────────────────────────────────────────────────────────

function ApprovalBadge({ status }) {
  const cls = {
    PENDING: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
    APPROVED: 'bg-green-500/20 text-green-400 border-green-500/30',
    FLAGGED: 'bg-red-500/20 text-red-400 border-red-500/30',
  }
  return <span className={`px-2 py-0.5 rounded text-xs font-medium border ${cls[status] ?? ''}`}>{status}</span>
}

function PaymentBadge({ status }) {
  const cls = {
    PENDING: 'bg-slate-600/40 text-slate-300 border-slate-500/30',
    INVOICED: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
    RECEIVED: 'bg-green-500/20 text-green-400 border-green-500/30',
  }
  return <span className={`px-2 py-0.5 rounded text-xs font-medium border ${cls[status] ?? ''}`}>{status}</span>
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function fmt(val) {
  if (val == null) return '—'
  return '$' + Number(val).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function fmtDate(d) {
  if (!d) return '—'
  return new Date(d + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

// ── Upload Load Confirmation Modal ───────────────────────────────────────────

function UploadRateConModal({ onClose, onParsed }) {
  const [dragging, setDragging] = useState(false)
  const [parsing, setParsing] = useState(false)
  const [error, setError] = useState('')
  const inputRef = useRef()

  async function handleFile(file) {
    if (!file) return
    const allowed = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png', 'image/webp']
    if (!allowed.includes(file.type)) {
      setError('Unsupported file type. Use PDF, JPG, PNG, or WEBP.')
      return
    }
    setParsing(true)
    setError('')
    try {
      const form = new FormData()
      form.append('file', file)
      const res = await API.post('/documents/parse', form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      onParsed(res.data)
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to parse document')
      setParsing(false)
    }
  }

  function onDrop(e) {
    e.preventDefault()
    setDragging(false)
    const file = e.dataTransfer.files[0]
    handleFile(file)
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-slate-800 rounded-xl border border-slate-700 w-full max-w-md">
        <div className="flex items-center justify-between p-6 border-b border-slate-700">
          <h2 className="text-lg font-semibold text-white">Upload Load Confirmation</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white text-2xl leading-none transition">&times;</button>
        </div>

        <div className="p-6">
          {parsing ? (
            <div className="flex flex-col items-center gap-4 py-10">
              <Spinner />
              <p className="text-sm text-slate-400">Reading document…</p>
            </div>
          ) : (
            <>
              <div
                onDragOver={e => { e.preventDefault(); setDragging(true) }}
                onDragLeave={() => setDragging(false)}
                onDrop={onDrop}
                onClick={() => inputRef.current?.click()}
                className={`border-2 border-dashed rounded-xl p-10 flex flex-col items-center gap-3 cursor-pointer transition ${
                  dragging ? 'border-blue-500 bg-blue-500/5' : 'border-slate-600 hover:border-slate-500 bg-slate-700/20'
                }`}
              >
                <svg className="w-10 h-10 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                </svg>
                <div className="text-center">
                  <p className="text-sm text-white font-medium">Drop file here or click to browse</p>
                  <p className="text-xs text-slate-500 mt-1">PDF, JPG, PNG, WEBP</p>
                </div>
              </div>
              <input
                ref={inputRef}
                type="file"
                accept=".pdf,.jpg,.jpeg,.png,.webp"
                className="hidden"
                onChange={e => handleFile(e.target.files[0])}
              />
              {error && <p className="text-red-400 text-sm mt-4">{error}</p>}
            </>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Add Load Modal ────────────────────────────────────────────────────────────

function AddLoadModal({ brokers, drivers, onClose, onCreated, onBrokerAdded, prefill, isDispatcher }) {
  const [form, setForm] = useState({
    load_number: prefill?.load_number ?? '',
    broker_id: prefill?.broker_id != null ? String(prefill.broker_id) : '',
    driver_id: '',
    gross_rate: prefill?.gross_rate != null ? String(prefill.gross_rate) : '',
    cut_rate: '', added_rate: '',
    payment_method: prefill?.payment_method ?? '',
    quickpay_deduction: '',
    pu_date: prefill?.pu_date ?? '',
    del_date: prefill?.del_date ?? '',
    pu_location: prefill?.pu_location ?? '',
    del_location: prefill?.del_location ?? '',
    notes: '',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [addingBroker, setAddingBroker] = useState(false)
  const [brokerAdded, setBrokerAdded] = useState(false)
  const [rateHistory, setRateHistory] = useState([])
  const [rateHistoryLoading, setRateHistoryLoading] = useState(false)
  const [dupWarn, setDupWarn] = useState('')
  const navigate = useNavigate()

  async function checkDuplicate(val) {
    if (!val.trim()) { setDupWarn(''); return }
    try {
      const res = await API.get('/loads', { params: { load_number: val.trim(), limit: 1 } })
      setDupWarn(res.data.total > 0 ? `⚠ Load ${val.trim()} already exists` : '')
    } catch {
      setDupWarn('')
    }
  }

  useEffect(() => {
    if (!isDispatcher) return
    const pu = form.pu_location?.trim() ?? ''
    const del = form.del_location?.trim() ?? ''
    const brokerId = form.broker_id
    if (pu.length < 2 || del.length < 2 || !brokerId) { setRateHistory([]); return }
    const timer = setTimeout(async () => {
      setRateHistoryLoading(true)
      try {
        const res = await API.get('/loads/rate-history', {
          params: { pu_location: pu, del_location: del, broker_id: parseInt(brokerId) },
        })
        setRateHistory(res.data)
      } catch {
        setRateHistory([])
      } finally {
        setRateHistoryLoading(false)
      }
    }, 400)
    return () => clearTimeout(timer)
  }, [form.pu_location, form.del_location, form.broker_id, isDispatcher])

  const brokerUnmatched = prefill != null && prefill.broker_id == null && !brokerAdded

  async function handleAddBroker() {
    setAddingBroker(true)
    try {
      const res = await API.post('/brokers', { name: prefill.broker_name })
      onBrokerAdded(res.data)
      setForm(f => ({ ...f, broker_id: String(res.data.id) }))
      setBrokerAdded(true)
    } catch {
      // fall through — user can still select manually
    } finally {
      setAddingBroker(false)
    }
  }

  const gross = parseFloat(form.gross_rate) || 0
  const cut = parseFloat(form.cut_rate) || 0
  const added = parseFloat(form.added_rate) || 0
  const qp = parseFloat(form.quickpay_deduction) || 0
  const finalRate = gross - cut + added
  const netRate = finalRate - qp

  function set(e) { setForm(f => ({ ...f, [e.target.name]: e.target.value })) }

  async function handleSubmit(e) {
    e.preventDefault()
    setSaving(true)
    setError('')
    if (!form.driver_id) {
      setError('Please assign a driver before saving')
      setSaving(false)
      return
    }
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
          <h2 className="text-lg font-semibold text-white">
            {prefill ? 'Add Load — Pre-filled from Load Confirmation' : 'Add Load'}
          </h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white text-2xl leading-none transition">&times;</button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={lbl}>Load Number *</label>
              <input name="load_number" value={form.load_number} onChange={e => { set(e); setDupWarn('') }} onBlur={e => checkDuplicate(e.target.value)} required className={inp} placeholder="e.g. BBI-12345" />
              {dupWarn && <p className="text-amber-400 text-xs mt-1">{dupWarn}</p>}
            </div>
            <div>
              <label className={lbl}>Broker *</label>
              <select name="broker_id" value={form.broker_id} onChange={set} required className={inp}>
                <option value="">Select broker…</option>
                {brokers.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
              {brokerUnmatched && (
                <div className="flex items-center gap-2 mt-1 flex-wrap">
                  <p className="text-xs text-amber-400">Broker not recognized — please select manually</p>
                  <button
                    type="button"
                    onClick={handleAddBroker}
                    disabled={addingBroker}
                    className="text-xs text-blue-400 hover:text-blue-300 disabled:opacity-50 transition"
                  >
                    {addingBroker ? 'Adding…' : 'Add as new broker'}
                  </button>
                </div>
              )}
              {brokerAdded && (
                <p className="text-xs text-green-400 mt-1">Broker added!</p>
              )}
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

          <div className="grid grid-cols-2 gap-4">
            <div><label className={lbl}>Pickup Date</label><input name="pu_date" value={form.pu_date} onChange={set} type="date" className={inp} /></div>
            <div><label className={lbl}>Delivery Date</label><input name="del_date" value={form.del_date} onChange={set} type="date" className={inp} /></div>
            <div><label className={lbl}>Pickup Location</label><input name="pu_location" value={form.pu_location} onChange={set} className={inp} placeholder="City, ST" /></div>
            <div><label className={lbl}>Delivery Location</label><input name="del_location" value={form.del_location} onChange={set} className={inp} placeholder="City, ST" /></div>
          </div>

          {isDispatcher && (rateHistoryLoading || rateHistory.length > 0) && (
            <div className="p-3 bg-slate-700/40 rounded-lg border border-slate-600">
              <p className="text-xs text-slate-400 uppercase tracking-wide mb-2">
                Rate History — Similar Routes
                {rateHistoryLoading && <span className="ml-2 text-slate-500">Loading…</span>}
              </p>
              {!rateHistoryLoading && rateHistory.length > 0 && (
                <div className="space-y-1.5">
                  {rateHistory.map((r, i) => (
                    <div key={i} className="flex items-center justify-between text-xs gap-4">
                      <span className="font-mono text-slate-400 shrink-0">{r.load_number}</span>
                      <span className="text-slate-600 truncate">{r.del_date ? new Date(r.del_date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'}</span>
                      <span className="font-mono text-green-400 font-semibold shrink-0">${Number(r.gross_rate).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

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

// ── Flag Modal ────────────────────────────────────────────────────────────────

function FlagModal({ onClose, onConfirm }) {
  const [reason, setReason] = useState('')
  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-slate-800 rounded-xl border border-slate-700 w-full max-w-sm p-6">
        <h2 className="text-lg font-semibold text-white mb-1">Flag Load</h2>
        <p className="text-slate-400 text-sm mb-4">Optionally provide a reason for flagging:</p>
        <textarea value={reason} onChange={e => setReason(e.target.value)} rows={3}
          className="w-full bg-slate-700 border border-slate-600 rounded px-3 py-2 text-white text-sm focus:outline-none focus:border-red-500 transition"
          placeholder="Reason for flagging…" />
        <div className="flex justify-end gap-3 mt-4">
          <button onClick={onClose} className="px-4 py-2 text-sm text-slate-400 hover:text-white transition">Cancel</button>
          <button onClick={() => onConfirm(reason)} className="px-5 py-2 bg-red-600 hover:bg-red-500 text-white text-sm rounded-lg font-medium transition">Flag Load</button>
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
  const [searchParams] = useSearchParams()
  const [statusFilter, setStatusFilter] = useState('ALL')
  const [paymentFilter, setPaymentFilter] = useState('ALL')
  const [loadingTable, setLoadingTable] = useState(false)
  const [showAdd, setShowAdd] = useState(false)
  const [showUpload, setShowUpload] = useState(false)
  const [prefillData, setPrefillData] = useState(null)
  const [flagTarget, setFlagTarget] = useState(null)
  const [brokers, setBrokers] = useState([])
  const [drivers, setDrivers] = useState([])
  const navigate = useNavigate()

  useEffect(() => {
    const ap = searchParams.get('approval_status')
    if (ap && ['PENDING', 'APPROVED', 'FLAGGED'].includes(ap)) {
      setStatusFilter(ap)
      setPaymentFilter('ALL')
    }
  }, [])

  useEffect(() => {
    const token = getToken()
    if (!token) { navigate('/login', { replace: true }); return }
    setTimeout(() => {
      API.get('/auth/me')
        .then(r => setUser(r.data))
        .catch(err => {
          if (err.response?.status === 401) { clearToken(); navigate('/login', { replace: true }) }
        })
      Promise.all([API.get('/brokers'), API.get('/drivers')])
        .then(([br, dr]) => { setBrokers(br.data); setDrivers(dr.data) })
        .catch(() => {})
    }, 100)
  }, [])

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
      const res = await API.get('/loads', { params })
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
    } catch (err) { redirectOnUnauth(err, navigate) }
  }

  async function handleFlag(id, reason) {
    try {
      await API.patch(`/loads/${id}/flag`, { reason: reason || null })
      setFlagTarget(null)
      fetchLoads()
    } catch (err) { redirectOnUnauth(err, navigate) }
  }

  function handleLogout() { clearToken(); navigate('/login') }
  function changeStatus(s) { setStatusFilter(s); setPage(1) }
  function changePayment(s) { setPaymentFilter(s); setPage(1) }

  function handleParsed(data) {
    setShowUpload(false)
    setPrefillData(data)
    setShowAdd(true)
  }

  if (!user) {
    return <div className="min-h-screen flex items-center justify-center bg-slate-900"><p className="text-slate-400">Loading…</p></div>
  }

  const isHA = user.role === 'HEAD_ACCOUNTANT'
  const isDispatcher = user.role === 'DISPATCHER'
  const cols = ['Load #', 'Broker', 'Driver', 'Route', 'Dates', 'Gross', 'Net', 'Dist.', ...(isDispatcher ? [] : ['Method', 'Payment']), 'BOL / POD', 'Status', 'Actions']

  return (
    <div className="min-h-screen bg-slate-900">
      <Navbar active="Loads" user={user} onLogout={handleLogout} />

      <main className="max-w-7xl mx-auto px-6 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-white">Loads</h2>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowUpload(true)}
              className="px-4 py-2 bg-slate-700 hover:bg-slate-600 border border-slate-600 text-white text-sm rounded-lg font-medium transition flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
              </svg>
              Upload Load Confirmation
            </button>
            <button
              onClick={() => { setPrefillData(null); setShowAdd(true) }}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm rounded-lg font-medium transition"
            >
              + Add Load
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3 mb-5">
          {/* Approval status */}
          <div className="flex items-center gap-1 bg-slate-800 rounded-lg p-1 border border-slate-700">
            {STATUS_TABS.map(s => (
              <button key={s} onClick={() => changeStatus(s)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition ${statusFilter === s ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'}`}>
                {s === 'ALL' ? 'All' : s.charAt(0) + s.slice(1).toLowerCase()}
              </button>
            ))}
          </div>

          {/* Payment status — accountant only */}
          {!isDispatcher && (
            <div className="flex items-center gap-1 bg-slate-800 rounded-lg p-1 border border-slate-700">
              {PAYMENT_TABS.map(s => (
                <button key={s} onClick={() => changePayment(s)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md transition ${paymentFilter === s ? 'bg-slate-600 text-white' : 'text-slate-400 hover:text-white'}`}>
                  {s === 'ALL' ? 'All Payments' : s.charAt(0) + s.slice(1).toLowerCase()}
                </button>
              ))}
            </div>
          )}

          {total > 0 && <span className="text-sm text-slate-500 ml-1">{total} load{total !== 1 ? 's' : ''}</span>}
        </div>

        {/* Table */}
        <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-700">
                  {cols.map(col => (
                    <th key={col} className="text-left px-4 py-3 text-xs font-medium text-slate-400 uppercase tracking-wide whitespace-nowrap">{col}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loadingTable ? (
                  <tr><td colSpan={cols.length} className="text-center py-14 text-slate-500">Loading…</td></tr>
                ) : loads.length === 0 ? (
                  <tr>
                    <td colSpan={cols.length}>
                      <div className="flex flex-col items-center justify-center py-16 gap-4">
                        <svg className="w-14 h-14 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M9 17a2 2 0 11-4 0 2 2 0 014 0zM19 17a2 2 0 11-4 0 2 2 0 014 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" d="M13 16V6a1 1 0 00-1-1H4a1 1 0 00-1 1v10l2 1h7l1-1zM13 16l2-3h4l2 3H13z" />
                        </svg>
                        <div className="text-center">
                          <p className="text-white font-semibold">No loads found</p>
                          <p className="text-slate-400 text-sm mt-1">Add your first load or sync Gmail to import automatically.</p>
                        </div>
                        <button onClick={() => navigate('/settings')} className="px-4 py-2 bg-slate-700 hover:bg-slate-600 border border-slate-600 text-white text-sm rounded-lg font-medium transition">
                          Sync Gmail
                        </button>
                      </div>
                    </td>
                  </tr>
                ) : (
                  loads.map(load => (
                    <tr key={load.id} onClick={() => navigate('/loads/' + load.id)}
                      className="border-b border-slate-700/50 hover:bg-slate-700/40 cursor-pointer transition">
                      <td className="px-4 py-3 font-mono text-white whitespace-nowrap">{load.load_number}</td>
                      <td className="px-4 py-3 text-slate-300 whitespace-nowrap">{load.broker_name}</td>
                      <td className="px-4 py-3 text-slate-300 whitespace-nowrap">{load.driver_name ?? <span className="text-slate-600">—</span>}</td>
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
                      <td className="px-4 py-3 text-slate-400 text-xs whitespace-nowrap">
                        {load.distance_miles ? `${Math.round(load.distance_miles)} mi` : <span className="text-slate-600">—</span>}
                      </td>
                      {!isDispatcher && <td className="px-4 py-3 text-slate-400 text-xs whitespace-nowrap">{load.payment_method ?? '—'}</td>}
                      {!isDispatcher && <td className="px-4 py-3 whitespace-nowrap"><PaymentBadge status={load.payment_status} /></td>}
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className={`inline-block w-2.5 h-2.5 rounded-full mr-1.5 ${load.bol_signed ? 'bg-green-500' : 'bg-slate-600'}`} title={`BOL: ${load.bol_signed ? 'Signed' : 'Not signed'}`} />
                        <span className={`inline-block w-2.5 h-2.5 rounded-full ${load.pod_submitted ? 'bg-green-500' : 'bg-slate-600'}`} title={`POD: ${load.pod_submitted ? 'Submitted' : 'Not submitted'}`} />
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap"><ApprovalBadge status={load.approval_status} /></td>
                      <td className="px-4 py-3 whitespace-nowrap" onClick={e => e.stopPropagation()}>
                        {isHA && load.approval_status === 'PENDING' && (
                          <div className="flex gap-2">
                            <button onClick={() => handleApprove(load.id)} className="px-2.5 py-1 bg-green-600/20 hover:bg-green-600/40 text-green-400 text-xs rounded border border-green-600/30 transition">Approve</button>
                            <button onClick={() => setFlagTarget(load)} className="px-2.5 py-1 bg-red-600/20 hover:bg-red-600/40 text-red-400 text-xs rounded border border-red-600/30 transition">Flag</button>
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
            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="px-4 py-2 text-sm text-slate-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition">← Prev</button>
            <span className="text-sm text-slate-500">Page {page} of {totalPages}</span>
            <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="px-4 py-2 text-sm text-slate-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition">Next →</button>
          </div>
        )}
      </main>

      {showUpload && <UploadRateConModal onClose={() => setShowUpload(false)} onParsed={handleParsed} />}
      {showAdd && (
        <AddLoadModal
          brokers={brokers}
          drivers={drivers}
          prefill={prefillData}
          isDispatcher={isDispatcher}
          onClose={() => { setShowAdd(false); setPrefillData(null) }}
          onCreated={() => { setShowAdd(false); setPrefillData(null); fetchLoads() }}
          onBrokerAdded={broker => setBrokers(prev => [...prev, broker])}
        />
      )}
      {flagTarget && (
        <FlagModal onClose={() => setFlagTarget(null)} onConfirm={reason => handleFlag(flagTarget.id, reason)} />
      )}
    </div>
  )
}
