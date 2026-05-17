import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import axios from 'axios'

const API = axios.create({ baseURL: import.meta.env.VITE_API_URL || 'http://localhost:8000' })

const PIPELINE_STEPS = ['NEW', 'ACCEPTED', 'DISPATCHED', 'IN_ROUTE', 'DELIVERED']
const STEP_LABELS = { NEW: 'New', ACCEPTED: 'Accepted', DISPATCHED: 'Dispatched', IN_ROUTE: 'In Route', DELIVERED: 'Delivered' }

function fmtDate(iso) {
  if (!iso) return '—'
  return new Date(iso + 'T00:00:00').toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
}

function PipelineBar({ currentStatus }) {
  const currentIdx = PIPELINE_STEPS.indexOf(currentStatus || 'NEW')
  return (
    <div className="w-full">
      <div className="flex items-center">
        {PIPELINE_STEPS.map((step, i) => {
          const done = i < currentIdx
          const active = i === currentIdx
          return (
            <div key={step} className="flex items-center flex-1 last:flex-none">
              <div className="flex flex-col items-center gap-2">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold border-2 transition ${
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
                <div className={`flex-1 h-0.5 mx-2 mb-6 ${i < currentIdx ? 'bg-green-500/50' : 'bg-slate-700'}`} />
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

function InfoRow({ label, value }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-xs text-slate-500 uppercase tracking-wide">{label}</span>
      <span className="text-sm text-white">{value || <span className="text-slate-500">—</span>}</span>
    </div>
  )
}

export default function TrackingPage() {
  const { loadNumber } = useParams()
  const [load, setLoad] = useState(null)
  const [notFound, setNotFound] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    API.get(`/track/${loadNumber}`)
      .then(r => setLoad(r.data))
      .catch(err => {
        if (err.response?.status === 404) setNotFound(true)
      })
      .finally(() => setLoading(false))
  }, [loadNumber])

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col">
      {/* Minimal header */}
      <header className="bg-slate-800 border-b border-slate-700 px-6 py-4">
        <div className="max-w-3xl mx-auto flex items-center gap-3">
          <h1 className="text-lg font-bold text-white">FreightDesk</h1>
          <span className="text-slate-600">·</span>
          <span className="text-sm text-slate-400">Load Tracking</span>
        </div>
      </header>

      <main className="flex-1 max-w-3xl mx-auto w-full px-6 py-10">
        {loading && (
          <div className="flex items-center justify-center py-24">
            <div className="flex flex-col items-center gap-4">
              <svg className="animate-spin h-8 w-8 text-blue-500" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
              </svg>
              <p className="text-slate-400">Looking up load…</p>
            </div>
          </div>
        )}

        {notFound && (
          <div className="flex flex-col items-center justify-center py-24 gap-5">
            <svg className="w-16 h-16 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div className="text-center">
              <p className="text-white font-semibold text-xl">Load not found</p>
              <p className="text-slate-400 text-sm mt-2">No load matches <span className="font-mono text-slate-300">{loadNumber}</span>. Please verify the load number and try again.</p>
            </div>
          </div>
        )}

        {load && (
          <div className="space-y-6">
            {/* Header card */}
            <div className="bg-slate-800 rounded-xl border border-slate-700 p-6">
              <div className="flex items-start justify-between gap-4 mb-1">
                <div>
                  <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">Load Number</p>
                  <h2 className="text-2xl font-bold text-white font-mono">{load.load_number}</h2>
                </div>
                <div className={`px-3 py-1.5 rounded-full text-sm font-medium border ${
                  load.load_status === 'DELIVERED'
                    ? 'bg-green-500/20 text-green-400 border-green-500/30'
                    : load.load_status === 'IN_ROUTE'
                      ? 'bg-orange-500/20 text-orange-400 border-orange-500/30'
                      : load.load_status === 'DISPATCHED'
                        ? 'bg-blue-500/20 text-blue-400 border-blue-500/30'
                        : 'bg-slate-600/40 text-slate-400 border-slate-500/30'
                }`}>
                  {STEP_LABELS[load.load_status] ?? load.load_status}
                </div>
              </div>
              {load.broker_name && (
                <p className="text-sm text-slate-400">Broker: <span className="text-slate-200">{load.broker_name}</span></p>
              )}
            </div>

            {/* Pipeline */}
            <div className="bg-slate-800 rounded-xl border border-slate-700 p-6">
              <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wide mb-6">Shipment Progress</h3>
              <PipelineBar currentStatus={load.load_status} />
            </div>

            {/* Route details */}
            <div className="bg-slate-800 rounded-xl border border-slate-700 p-6">
              <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wide mb-5">Route Details</h3>
              <div className="grid grid-cols-2 gap-x-8 gap-y-5">
                <InfoRow label="Pickup Location" value={load.pu_location} />
                <InfoRow label="Delivery Location" value={load.del_location} />
                <InfoRow label="Pickup Date" value={fmtDate(load.pu_date)} />
                <InfoRow label="Delivery Date" value={fmtDate(load.del_date)} />
                {load.driver_name && <InfoRow label="Driver" value={load.driver_name} />}
              </div>
            </div>

            <p className="text-center text-xs text-slate-600">
              Powered by FreightDesk · Real-time load visibility
            </p>
          </div>
        )}
      </main>
    </div>
  )
}
