import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import axios from 'axios'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
  PieChart, Pie, Legend,
} from 'recharts'
import { getToken, clearToken } from '../auth'
import Navbar from '../components/Navbar'
import { StatCardSkeleton, TableRowSkeleton } from '../components/Skeletons'

const API = axios.create({ baseURL: import.meta.env.VITE_API_URL || 'http://localhost:8000' })
API.interceptors.request.use(config => {
  const token = getToken()
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

const STATUS_COLORS = { PENDING: '#f59e0b', APPROVED: '#10b981', FLAGGED: '#ef4444' }
const PIPELINE_LABELS = { NEW: 'New', ACCEPTED: 'Accepted', DISPATCHED: 'Dispatched', IN_ROUTE: 'In Route', DELIVERED: 'Delivered' }

function fmt(v) {
  return '$' + Number(v).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
}

function fmtDate(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function StatCard({ label, value, sub, accent, topColor, onClick }) {
  return (
    <div
      onClick={onClick}
      className={`relative bg-slate-900 ring-1 ring-white/8 rounded-xl shadow-lg overflow-hidden transition-all duration-150 ${
        onClick ? 'cursor-pointer hover:ring-white/15 hover:shadow-xl' : ''
      }`}
    >
      {topColor && <div className={`absolute top-0 inset-x-0 h-0.5 ${topColor}`} />}
      <div className="p-6 pt-5">
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-widest mb-3">{label}</p>
        <p className={`text-3xl font-bold tracking-tight ${accent || 'text-white'}`}>{value}</p>
        {sub && <p className="text-xs text-slate-500 mt-2">{sub}</p>}
      </div>
    </div>
  )
}

function ApprovalBadge({ status }) {
  const cls = {
    PENDING: 'bg-amber-500/15 text-amber-400 ring-1 ring-amber-500/30',
    APPROVED: 'bg-emerald-500/15 text-emerald-400 ring-1 ring-emerald-500/30',
    FLAGGED: 'bg-red-500/15 text-red-400 ring-1 ring-red-500/30',
  }
  return <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${cls[status] ?? ''}`}>{status}</span>
}

function PipelineBadge({ status }) {
  const cls = {
    NEW: 'bg-slate-700/60 text-slate-400 ring-1 ring-slate-600/40',
    ACCEPTED: 'bg-cyan-500/15 text-cyan-400 ring-1 ring-cyan-500/30',
    DISPATCHED: 'bg-blue-500/15 text-blue-400 ring-1 ring-blue-500/30',
    IN_ROUTE: 'bg-orange-500/15 text-orange-400 ring-1 ring-orange-500/30',
    DELIVERED: 'bg-emerald-500/15 text-emerald-400 ring-1 ring-emerald-500/30',
  }
  return <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${cls[status] ?? ''}`}>{PIPELINE_LABELS[status] ?? status}</span>
}

// ── DISPATCHER Dashboard ──────────────────────────────────────────────────────

function DispatcherDashboard({ stats, navigate }) {
  return (
    <>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard label="Total Active Loads" value={stats.active_loads_count ?? 0} sub="not yet delivered" topColor="bg-blue-500" onClick={() => navigate('/loads')} />
        <StatCard label="In Route" value={stats.in_route_count ?? 0} sub="currently in transit" accent="text-orange-400" topColor="bg-orange-500" onClick={() => navigate('/loads?load_status=IN_ROUTE')} />
        <StatCard label="Delivered This Week" value={stats.delivered_week_count ?? 0} sub="completed this week" accent="text-emerald-400" topColor="bg-emerald-500" onClick={() => navigate('/loads?load_status=DELIVERED')} />
        <StatCard label="Needs Acceptance" value={stats.new_loads_count ?? 0} sub="awaiting dispatcher action" accent="text-amber-400" topColor="bg-amber-500" onClick={() => navigate('/loads?load_status=NEW')} />
      </div>

      <div className="bg-slate-900 ring-1 ring-white/8 rounded-xl shadow-lg overflow-hidden">
        <div className="px-6 py-4 border-b border-white/[0.06]">
          <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-widest">Recent Loads</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-800/40 border-b border-white/[0.06]">
                {['Load #', 'Broker', 'Driver', 'Route', 'Status', 'Created'].map(h => (
                  <th key={h} className="px-5 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.04]">
              {stats.recent_loads.length === 0 ? (
                <tr><td colSpan={6} className="text-center py-12 text-slate-600">No loads yet</td></tr>
              ) : (
                stats.recent_loads.map((l, i) => (
                  <tr key={l.id} onClick={() => navigate('/loads/' + l.id)}
                    className={`hover:bg-white/[0.03] cursor-pointer transition-colors ${i % 2 === 1 ? 'bg-slate-800/20' : ''}`}>
                    <td className="px-5 py-3 font-mono text-sm text-white whitespace-nowrap">{l.load_number}</td>
                    <td className="px-5 py-3 text-slate-300 text-sm whitespace-nowrap">{l.broker_name}</td>
                    <td className="px-5 py-3 text-slate-400 text-sm whitespace-nowrap">{l.driver_name ?? <span className="text-slate-600">—</span>}</td>
                    <td className="px-5 py-3 text-slate-500 text-xs whitespace-nowrap">
                      {l.pu_location && l.del_location
                        ? <>{l.pu_location} <span className="text-slate-700 mx-1">→</span> {l.del_location}</>
                        : <span className="text-slate-700">—</span>}
                    </td>
                    <td className="px-5 py-3 whitespace-nowrap"><PipelineBadge status={l.load_status} /></td>
                    <td className="px-5 py-3 text-slate-500 text-xs whitespace-nowrap">{fmtDate(l.created_at)}</td>
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

// ── HEAD_ACCOUNTANT Dashboard ─────────────────────────────────────────────────

function HADashboard({ stats, navigate }) {
  return (
    <>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard label="Loads This Week" value={stats.total_loads_week} sub="created this week" topColor="bg-blue-500" onClick={() => navigate('/loads')} />
        <StatCard label="Gross Revenue" value={fmt(stats.gross_revenue_week)} sub="this week" topColor="bg-slate-600" />
        <StatCard label="Net Revenue" value={fmt(stats.net_revenue_week)} sub="after deductions" accent="text-emerald-400" topColor="bg-emerald-500" />
        <StatCard label="Pending Approval" value={stats.pending_count} sub={stats.pending_count === 1 ? 'load needs review' : 'loads need review'} accent="text-amber-400" topColor="bg-amber-500" onClick={() => navigate('/loads?approval_status=PENDING')} />
      </div>

      {stats.total_loads_week === 0 && (
        <div className="flex flex-col items-center justify-center py-16 gap-5 bg-slate-900 ring-1 ring-white/8 rounded-xl shadow-lg mb-8">
          <svg className="w-14 h-14 text-slate-700" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 17a2 2 0 11-4 0 2 2 0 014 0zM19 17a2 2 0 11-4 0 2 2 0 014 0z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M13 16V6a1 1 0 00-1-1H4a1 1 0 00-1 1v10l2 1h7l1-1zM13 16l2-3h4l2 3H13z" />
          </svg>
          <div className="text-center">
            <p className="text-white font-semibold text-lg">No loads this week yet</p>
            <p className="text-slate-500 text-sm mt-1">Connect Gmail to auto-import or add loads manually.</p>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={() => navigate('/settings')} className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium rounded-lg shadow-sm transition-colors">Connect Gmail</button>
            <button onClick={() => navigate('/loads')} className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-medium rounded-lg ring-1 ring-white/10 transition-colors">Add Load Manually</button>
          </div>
        </div>
      )}

      {stats.total_loads_week > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-8">
          <div className="lg:col-span-2 bg-slate-900 ring-1 ring-white/8 rounded-xl shadow-lg p-6">
            <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-widest mb-5">Loads by Day</h3>
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={stats.loads_by_day} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                <XAxis dataKey="day" tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} />
                <Tooltip contentStyle={{ background: '#0f172a', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8 }} labelStyle={{ color: '#f1f5f9' }} itemStyle={{ color: '#60a5fa' }} cursor={{ fill: 'rgba(255,255,255,0.03)' }} />
                <Bar dataKey="count" name="Loads" fill="#3b82f6" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="bg-slate-900 ring-1 ring-white/8 rounded-xl shadow-lg p-6">
            <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-widest mb-5">By Approval Status</h3>
            <ResponsiveContainer width="100%" height={180}>
              <PieChart>
                <Pie data={stats.loads_by_status.filter(s => s.count > 0)} dataKey="count" nameKey="status" cx="50%" cy="50%" outerRadius={64} innerRadius={36}>
                  {stats.loads_by_status.filter(s => s.count > 0).map(entry => (
                    <Cell key={entry.status} fill={STATUS_COLORS[entry.status] ?? '#475569'} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ background: '#0f172a', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8 }} itemStyle={{ color: '#f1f5f9' }} />
                <Legend formatter={value => <span style={{ color: '#64748b', fontSize: 11 }}>{value}</span>} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      <div className="bg-slate-900 ring-1 ring-white/8 rounded-xl shadow-lg overflow-hidden">
        <div className="px-6 py-4 border-b border-white/[0.06]">
          <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-widest">Recent Loads</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-800/40 border-b border-white/[0.06]">
                {['Load #', 'Broker', 'Driver', 'Route', 'Gross', 'Status', 'Created'].map(h => (
                  <th key={h} className="px-5 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.04]">
              {stats.recent_loads.length === 0 ? (
                <tr><td colSpan={7} className="text-center py-12 text-slate-600">No loads yet</td></tr>
              ) : (
                stats.recent_loads.map((l, i) => (
                  <tr key={l.id} onClick={() => navigate('/loads/' + l.id)}
                    className={`hover:bg-white/[0.03] cursor-pointer transition-colors ${i % 2 === 1 ? 'bg-slate-800/20' : ''}`}>
                    <td className="px-5 py-3 font-mono text-sm text-white whitespace-nowrap">{l.load_number}</td>
                    <td className="px-5 py-3 text-slate-300 text-sm whitespace-nowrap">{l.broker_name}</td>
                    <td className="px-5 py-3 text-slate-400 text-sm whitespace-nowrap">{l.driver_name ?? <span className="text-slate-600">—</span>}</td>
                    <td className="px-5 py-3 text-slate-500 text-xs whitespace-nowrap">
                      {l.pu_location && l.del_location
                        ? <>{l.pu_location} <span className="text-slate-700 mx-1">→</span> {l.del_location}</>
                        : <span className="text-slate-700">—</span>}
                    </td>
                    <td className="px-5 py-3 text-white font-mono text-sm whitespace-nowrap">{'$' + Number(l.gross_rate).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                    <td className="px-5 py-3 whitespace-nowrap"><ApprovalBadge status={l.approval_status} /></td>
                    <td className="px-5 py-3 text-slate-500 text-xs whitespace-nowrap">{fmtDate(l.created_at)}</td>
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

  if (!user) return <div className="min-h-screen bg-[#0c1220]" />

  return (
    <div className="min-h-screen bg-[#0c1220]">
      <Navbar active="Dashboard" user={user} onLogout={handleLogout} />

      <main className="max-w-7xl mx-auto px-6 py-10">
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-white tracking-tight">Dashboard</h2>
          {stats && (
            <p className="text-sm text-slate-500 mt-1">
              {`Week of ${new Date(stats.week_start + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} – ${new Date(stats.week_end + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`}
            </p>
          )}
        </div>

        {!stats ? (
          <>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
              {[0,1,2,3].map(i => <StatCardSkeleton key={i} />)}
            </div>
            <div className="bg-slate-900 ring-1 ring-white/8 rounded-xl shadow-lg overflow-hidden">
              <div className="px-6 py-4 border-b border-white/[0.06]">
                <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-widest">Recent Loads</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <tbody className="divide-y divide-white/[0.04]">
                    {[0,1,2,3,4].map(i => <TableRowSkeleton key={i} cols={6} />)}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        ) : user.role === 'HEAD_ACCOUNTANT' ? (
          <HADashboard stats={stats} navigate={navigate} />
        ) : (
          <DispatcherDashboard stats={stats} navigate={navigate} />
        )}
      </main>
    </div>
  )
}
