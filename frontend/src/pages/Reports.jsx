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

function fmt(v) {
  return '$' + Number(v).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function StatCard({ label, value }) {
  return (
    <div className="bg-slate-800 rounded-xl border border-slate-700 p-5">
      <p className="text-xs text-slate-400 uppercase tracking-wide mb-1">{label}</p>
      <p className="text-2xl font-bold text-white">{value}</p>
    </div>
  )
}

export default function Reports() {
  const [user, setUser] = useState(null)
  const [report, setReport] = useState(null)
  const [exporting, setExporting] = useState(false)
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
    API.get('/reports/weekly')
      .then(r => setReport(r.data))
      .catch(err => {
        if (err.response?.status === 401) { clearToken(); navigate('/login', { replace: true }) }
      })
  }, [user])

  async function handleExport() {
    setExporting(true)
    try {
      const token = getToken()
      const res = await fetch((import.meta.env.VITE_API_URL || 'http://localhost:8000') + '/reports/export', {
        headers: { Authorization: `Bearer ${token}` },
      })
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      const cd = res.headers.get('content-disposition') || ''
      const match = cd.match(/filename=(.+)/)
      a.href = url
      a.download = match ? match[1] : 'freightdesk_report.csv'
      a.click()
      URL.revokeObjectURL(url)
    } finally {
      setExporting(false)
    }
  }

  function handleLogout() {
    clearToken()
    navigate('/login')
  }

  if (!user || !report) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-900">
        <p className="text-slate-400">Loading…</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-900">
      <Navbar active="Reports" user={user} onLogout={handleLogout} />

      <main className="max-w-7xl mx-auto px-6 py-8">
        {/* Header */}
        <div className="flex items-start justify-between mb-6">
          <div>
            <h2 className="text-2xl font-bold text-white">Reports</h2>
            <p className="text-sm text-slate-400 mt-1">
              Week of {new Date(report.week_start + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
              {' – '}
              {new Date(report.week_end + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
            </p>
          </div>
          <button
            onClick={handleExport}
            disabled={exporting}
            className="px-4 py-2 bg-slate-700 hover:bg-slate-600 disabled:opacity-60 text-white text-sm rounded-lg border border-slate-600 transition flex items-center gap-2"
          >
            {exporting ? 'Exporting…' : 'Export CSV'}
          </button>
        </div>

        {/* Empty state */}
        {report.total_loads === 0 && (
          <div className="flex flex-col items-center justify-center py-16 gap-5 bg-slate-800 rounded-xl border border-slate-700 mb-8">
            <svg className="w-16 h-16 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <div className="text-center">
              <p className="text-white font-semibold text-lg">No data for this week yet</p>
              <p className="text-slate-400 text-sm mt-1">Add or approve loads to see reports here.</p>
            </div>
          </div>
        )}

        {/* Summary cards */}
        <div className="grid grid-cols-3 gap-4 mb-8">
          <StatCard label="Total Loads" value={report.total_loads} />
          <StatCard label="Gross Revenue" value={fmt(report.total_gross)} />
          <StatCard label="Net Revenue" value={fmt(report.total_net)} />
        </div>

        {/* Driver P&L table */}
        <div className="bg-slate-800 rounded-xl border border-slate-700 mb-6">
          <div className="px-5 py-4 border-b border-slate-700">
            <h3 className="text-sm font-semibold text-white">Driver P&amp;L</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-700">
                  {['Driver', 'Loads', 'Gross Revenue', 'Net Revenue'].map(h => (
                    <th key={h} className="px-5 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wide whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {report.driver_pnl.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="text-center py-10 text-slate-500">No loads this week</td>
                  </tr>
                ) : (
                  report.driver_pnl.map((d, i) => (
                    <tr key={d.driver_id ?? i} className="border-b border-slate-700/50">
                      <td className="px-5 py-3 text-white">
                        {d.driver_name}
                        {!d.driver_id && (
                          <span className="ml-2 text-xs text-slate-500">(unassigned)</span>
                        )}
                      </td>
                      <td className="px-5 py-3 text-slate-300">{d.loads}</td>
                      <td className="px-5 py-3 font-mono text-white">{fmt(d.gross)}</td>
                      <td className="px-5 py-3 font-mono text-green-400">{fmt(d.net)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Broker performance table */}
        <div className="bg-slate-800 rounded-xl border border-slate-700">
          <div className="px-5 py-4 border-b border-slate-700">
            <h3 className="text-sm font-semibold text-white">Broker Performance</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-700">
                  {['Broker', 'Loads', 'Total Gross', 'Avg Rate'].map(h => (
                    <th key={h} className="px-5 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wide whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {report.broker_performance.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="text-center py-10 text-slate-500">No loads this week</td>
                  </tr>
                ) : (
                  report.broker_performance.map((b, i) => (
                    <tr key={b.broker_id ?? i} className="border-b border-slate-700/50">
                      <td className="px-5 py-3 text-white">{b.broker_name}</td>
                      <td className="px-5 py-3 text-slate-300">{b.loads}</td>
                      <td className="px-5 py-3 font-mono text-white">{fmt(b.gross)}</td>
                      <td className="px-5 py-3 font-mono text-slate-300">{fmt(b.avg_rate)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  )
}
