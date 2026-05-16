import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import axios from 'axios'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
  PieChart, Pie, Legend,
} from 'recharts'
import { getToken, clearToken } from '../auth'
import Navbar from '../components/Navbar'

const API = axios.create({ baseURL: import.meta.env.VITE_API_URL || 'http://localhost:8000' })
API.interceptors.request.use(config => {
  const token = getToken()
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

const STATUS_COLORS = { PENDING: '#eab308', APPROVED: '#22c55e', FLAGGED: '#ef4444' }


function fmt(v) {
  return '$' + Number(v).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
}

function fmtDate(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function StatCard({ label, value, sub, accent }) {
  return (
    <div className="bg-slate-800 rounded-xl border border-slate-700 p-5">
      <p className="text-xs text-slate-400 uppercase tracking-wide mb-1">{label}</p>
      <p className={`text-2xl font-bold ${accent || 'text-white'}`}>{value}</p>
      {sub && <p className="text-xs text-slate-500 mt-1">{sub}</p>}
    </div>
  )
}

function ApprovalBadge({ status }) {
  const cls = {
    PENDING: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
    APPROVED: 'bg-green-500/20 text-green-400 border-green-500/30',
    FLAGGED: 'bg-red-500/20 text-red-400 border-red-500/30',
  }
  return <span className={`px-2 py-0.5 rounded text-xs font-medium border ${cls[status] ?? ''}`}>{status}</span>
}

function PipelineBadge({ status }) {
  const cls = {
    NEW: 'bg-slate-600/40 text-slate-400 border-slate-500/30',
    ACCEPTED: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30',
    DISPATCHED: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
    IN_ROUTE: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
    DELIVERED: 'bg-green-500/20 text-green-400 border-green-500/30',
  }
  return <span className={`px-2 py-0.5 rounded text-xs font-medium border ${cls[status] ?? ''}`}>{PIPELINE_LABELS[status] ?? status}</span>
}

// ── HEAD_ACCOUNTANT Dashboard ─────────────────────────────────────────────────

function HADashboard({ stats, navigate }) {
  return (
    <>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard label="Loads This Week" value={stats.total_loads_week} sub="created this week" />
        <StatCard label="Gross Revenue" value={fmt(stats.gross_revenue_week)} sub="this week" />
        <StatCard label="Net Revenue" value={fmt(stats.net_revenue_week)} sub="after deductions" />
        <StatCard label="Pending Approval" value={stats.pending_count} sub={stats.pending_count === 1 ? 'load needs review' : 'loads need review'} />
      </div>

      {stats.total_loads_week === 0 && (
        <div className="flex flex-col items-center justify-center py-16 gap-5 bg-slate-800 rounded-xl border border-slate-700 mb-8">
          <svg className="w-16 h-16 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 17a2 2 0 11-4 0 2 2 0 014 0zM19 17a2 2 0 11-4 0 2 2 0 014 0z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M13 16V6a1 1 0 00-1-1H4a1 1 0 00-1 1v10l2 1h7l1-1zM13 16l2-3h4l2 3H13z" />
          </svg>
          <div className="text-center">
            <p className="text-white font-semibold text-lg">No loads this week yet</p>
            <p className="text-slate-400 text-sm mt-1">Connect Gmail to auto-import or add loads manually.</p>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={() => navigate('/settings')} className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm rounded-lg font-medium transition">Connect Gmail</button>
            <button onClick={() => navigate('/loads')} className="px-4 py-2 bg-slate-700 hover:bg-slate-600 border border-slate-600 text-white text-sm rounded-lg font-medium transition">Add Load Manually</button>
          </div>
        </div>
      )}

      {stats.total_loads_week > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-8">
          <div className="lg:col-span-2 bg-slate-800 rounded-xl border border-slate-700 p-5">
            <h3 className="text-sm font-semibold text-white mb-4">Loads by Day</h3>
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={stats.loads_by_day} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                <XAxis dataKey="day" tick={{ fill: '#94a3b8', fontSize: 12 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: '#94a3b8', fontSize: 12 }} axisLine={false} tickLine={false} allowDecimals={false} />
                <Tooltip contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 8 }} labelStyle={{ color: '#f1f5f9' }} itemStyle={{ color: '#60a5fa' }} cursor={{ fill: 'rgba(148,163,184,0.08)' }} />
                <Bar dataKey="count" name="Loads" fill="#3b82f6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="bg-slate-800 rounded-xl border border-slate-700 p-5">
            <h3 className="text-sm font-semibold text-white mb-4">By Approval Status</h3>
            <ResponsiveContainer width="100%" height={180}>
              <PieChart>
                <Pie data={stats.loads_by_status.filter(s => s.count > 0)} dataKey="count" nameKey="status" cx="50%" cy="50%" outerRadius={64} innerRadius={36}>
                  {stats.loads_by_status.filter(s => s.count > 0).map(entry => (
                    <Cell key={entry.status} fill={STATUS_COLORS[entry.status] ?? '#64748b'} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 8 }} itemStyle={{ color: '#f1f5f9' }} />
                <Legend formatter={value => <span style={{ color: '#94a3b8', fontSize: 12 }}>{value}</span>} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      <div className="bg-slate-800 rounded-xl border border-slate-700">
        <div className="px-5 py-4 border-b border-slate-700">
          <h3 className="text-sm font-semibold text-white">Recent Loads</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-700">
                {['Load #', 'Broker', 'Driver', 'Route', 'Gross', 'Status', 'Created'].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wide whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {stats.recent_loads.length === 0 ? (
                <tr><td colSpan={7} className="text-center py-10 text-slate-500">No loads yet</td></tr>
              ) : (
                stats.recent_loads.map(l => (
                  <tr key={l.id} onClick={() => navigate('/loads/' + l.id)}
                    className="border-b border-slate-700/50 hover:bg-slate-700/40 cursor-pointer transition">
                    <td className="px-4 py-3 font-mono text-white whitespace-nowrap">{l.load_number}</td>
                    <td className="px-4 py-3 text-slate-300 whitespace-nowrap">{l.broker_name}</td>
                    <td className="px-4 py-3 text-slate-300 whitespace-nowrap">{l.driver_name ?? <span className="text-slate-600">—</span>}</td>
                    <td className="px-4 py-3 text-slate-400 text-xs whitespace-nowrap">
                      {l.pu_location && l.del_location
                        ? <>{l.pu_location} <span className="text-slate-600 mx-1">→</span> {l.del_location}</>
                        : <span className="text-slate-600">—</span>}
                    </td>
                    <td className="px-4 py-3 text-white font-mono whitespace-nowrap">{'$' + Number(l.gross_rate).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                    <td className="px-4 py-3 whitespace-nowrap"><ApprovalBadge status={l.approval_status} /></td>
                    <td className="px-4 py-3 text-slate-400 text-xs whitespace-nowrap">{fmtDate(l.created_at)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function Dashboard() {
  const [user, setUser] = useState(null)
  const [stats, setStats] = useState(null)
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
    API.get('/dashboard/stats')
      .then(r => setStats(r.data))
      .catch(err => {
        if (err.response?.status === 401) { clearToken(); navigate('/login', { replace: true }) }
      })
  }, [user])

  function handleLogout() { clearToken(); navigate('/login') }

  if (!user || !stats) {
    return <div className="min-h-screen flex items-center justify-center bg-slate-900"><p className="text-slate-400">Loading…</p></div>
  }

  return (
    <div className="min-h-screen bg-slate-900">
      <Navbar active="Dashboard" user={user} onLogout={handleLogout} />

      <main className="max-w-7xl mx-auto px-6 py-8">
        <div className="mb-6">
          <h2 className="text-2xl font-bold text-white">Dashboard</h2>
          <p className="text-sm text-slate-400 mt-1">
            {`Week of ${new Date(stats.week_start + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} – ${new Date(stats.week_end + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`}
          </p>
        </div>

        <HADashboard stats={stats} navigate={navigate} />
      </main>
    </div>
  )
}
