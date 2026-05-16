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

function fmtTime(iso) {
  if (!iso) return null
  return new Date(iso).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}

function ChangePasswordCard() {
  const [form, setForm] = useState({ current_password: '', new_password: '', confirm_password: '' })
  const [saving, setSaving] = useState(false)
  const [result, setResult] = useState(null)
  const navigate = useNavigate()

  function set(e) { setForm(f => ({ ...f, [e.target.name]: e.target.value })); setResult(null) }

  async function handleSubmit(e) {
    e.preventDefault()
    if (form.new_password !== form.confirm_password) { setResult({ error: 'New passwords do not match' }); return }
    setSaving(true)
    setResult(null)
    try {
      await API.post('/auth/change-password', { current_password: form.current_password, new_password: form.new_password })
      setResult({ success: true })
      setForm({ current_password: '', new_password: '', confirm_password: '' })
    } catch (err) {
      redirectOnUnauth(err, navigate)
      setResult({ error: err.response?.data?.detail || 'Failed to change password' })
    } finally {
      setSaving(false)
    }
  }

  const inp = 'w-full bg-slate-700 border border-slate-600 rounded px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500 transition'
  const lbl = 'block text-xs text-slate-400 mb-1'

  return (
    <div className="bg-slate-800 rounded-xl border border-slate-700 p-6 mt-4">
      <h3 className="text-base font-semibold text-white mb-1">Account Security</h3>
      <p className="text-sm text-slate-400 mb-5">Change your login password.</p>
      <form onSubmit={handleSubmit} className="space-y-4 max-w-sm">
        <div><label className={lbl}>Current Password</label><input name="current_password" type="password" value={form.current_password} onChange={set} required className={inp} /></div>
        <div><label className={lbl}>New Password</label><input name="new_password" type="password" value={form.new_password} onChange={set} required minLength={6} className={inp} placeholder="Min. 6 characters" /></div>
        <div><label className={lbl}>Confirm New Password</label><input name="confirm_password" type="password" value={form.confirm_password} onChange={set} required className={inp} /></div>
        {result && <p className={`text-sm ${result.error ? 'text-red-400' : 'text-green-400'}`}>{result.error ?? '✓ Password changed successfully'}</p>}
        <button type="submit" disabled={saving} className="px-5 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-sm rounded-lg font-medium transition">
          {saving ? 'Saving…' : 'Change Password'}
        </button>
      </form>
    </div>
  )
}

function GmailWhitelistCard({ isHA }) {
  const [entries, setEntries] = useState([])
  const [loading, setLoading] = useState(true)
  const [newPattern, setNewPattern] = useState('')
  const [adding, setAdding] = useState(false)
  const [addError, setAddError] = useState('')
  const navigate = useNavigate()

  useEffect(() => { fetchEntries() }, [])

  async function fetchEntries() {
    setLoading(true)
    try {
      const res = await API.get('/gmail/whitelist')
      setEntries(res.data)
    } catch (err) {
      redirectOnUnauth(err, navigate)
    } finally {
      setLoading(false)
    }
  }

  async function handleAdd(e) {
    e.preventDefault()
    if (!newPattern.trim()) return
    setAdding(true)
    setAddError('')
    try {
      await API.post('/gmail/whitelist', { email_pattern: newPattern.trim() })
      setNewPattern('')
      await fetchEntries()
    } catch (err) {
      redirectOnUnauth(err, navigate)
      setAddError(err.response?.data?.detail || 'Failed to add pattern')
    } finally {
      setAdding(false)
    }
  }

  async function handleDelete(id) {
    try {
      await API.delete(`/gmail/whitelist/${id}`)
      setEntries(es => es.filter(e => e.id !== id))
    } catch (err) {
      redirectOnUnauth(err, navigate)
    }
  }

  return (
    <div className="bg-slate-800 rounded-xl border border-slate-700 p-6 mt-4">
      <h3 className="text-base font-semibold text-white mb-1">Gmail Sender Whitelist</h3>
      <p className="text-sm text-slate-400 mb-5">
        Only process emails from these senders. Leave empty to process all emails.
      </p>

      {loading ? (
        <div className="flex items-center gap-2 text-slate-500 text-sm"><Spinner /><span>Loading…</span></div>
      ) : (
        <>
          {entries.length === 0 ? (
            <p className="text-sm text-slate-500 mb-4">No whitelist entries — all senders are processed.</p>
          ) : (
            <div className="space-y-2 mb-4">
              {entries.map(entry => (
                <div key={entry.id} className="flex items-center justify-between px-3 py-2 bg-slate-700/50 rounded-lg border border-slate-600/50">
                  <span className="text-sm text-white font-mono">{entry.email_pattern}</span>
                  {isHA && (
                    <button
                      onClick={() => handleDelete(entry.id)}
                      className="text-xs text-red-400 hover:text-red-300 transition px-2 py-0.5 rounded hover:bg-red-500/10"
                    >
                      Remove
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}

          {isHA && (
            <form onSubmit={handleAdd} className="flex gap-2">
              <input
                value={newPattern}
                onChange={e => { setNewPattern(e.target.value); setAddError('') }}
                placeholder="e.g. loads@rxo.com or @bbi.com"
                className="flex-1 bg-slate-700 border border-slate-600 rounded px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500 transition"
              />
              <button
                type="submit"
                disabled={adding || !newPattern.trim()}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-sm rounded-lg font-medium transition shrink-0"
              >
                {adding ? '…' : 'Add'}
              </button>
            </form>
          )}
          {addError && <p className="text-red-400 text-sm mt-2">{addError}</p>}
        </>
      )}
    </div>
  )
}

export default function Settings() {
  const [user, setUser] = useState(null)
  const [gmailStatus, setGmailStatus] = useState(null)
  const [connecting, setConnecting] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [connectError, setConnectError] = useState('')
  const [syncResult, setSyncResult] = useState(null)
  const [tgStatus, setTgStatus] = useState(null)
  const [testChatId, setTestChatId] = useState('')
  const [testSending, setTestSending] = useState(false)
  const [testResult, setTestResult] = useState(null)
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
    }, 200)
  }, [])

  useEffect(() => {
    if (!user) return
    fetchStatus()
    fetchTgStatus()
  }, [user])

  async function fetchStatus() {
    try {
      const res = await API.get('/gmail/status')
      setGmailStatus(res.data)
    } catch (err) { redirectOnUnauth(err, navigate) }
  }

  async function fetchTgStatus() {
    try {
      const res = await API.get('/telegram/status')
      setTgStatus(res.data)
    } catch (err) { redirectOnUnauth(err, navigate) }
  }

  async function handleConnect() {
    setConnecting(true)
    setConnectError('')
    try {
      await API.post('/gmail/connect')
      await fetchStatus()
    } catch (err) {
      redirectOnUnauth(err, navigate)
      setConnectError(err.response?.data?.detail || 'Connection failed')
    } finally {
      setConnecting(false)
    }
  }

  async function handleSync() {
    setSyncing(true)
    setSyncResult(null)
    try {
      const res = await API.post('/gmail/poll')
      setSyncResult(res.data)
      await fetchStatus()
    } catch (err) {
      redirectOnUnauth(err, navigate)
      setSyncResult({ error: err.response?.data?.detail || 'Sync failed' })
    } finally {
      setSyncing(false)
    }
  }

  async function handleTestMessage() {
    setTestSending(true)
    setTestResult(null)
    try {
      await API.post('/telegram/test', { chat_id: testChatId.trim() })
      setTestResult({ success: true })
    } catch (err) {
      redirectOnUnauth(err, navigate)
      setTestResult({ error: err.response?.data?.detail || 'Send failed' })
    } finally {
      setTestSending(false)
    }
  }

  function handleLogout() { clearToken(); navigate('/login') }

  if (!user) {
    return <div className="min-h-screen flex items-center justify-center bg-slate-900"><p className="text-slate-400">Loading…</p></div>
  }

  const isHA = user.role === 'HEAD_ACCOUNTANT'
  const connected = gmailStatus?.connected ?? false

  return (
    <div className="min-h-screen bg-slate-900">
      <Navbar active="Settings" user={user} onLogout={handleLogout} />

      <main className="max-w-3xl mx-auto px-6 py-8">
        <h2 className="text-2xl font-bold text-white mb-6">Settings</h2>

        {/* Gmail Integration */}
        <div className="bg-slate-800 rounded-xl border border-slate-700 p-6">
          <div className="flex items-start justify-between gap-4 mb-1">
            <div>
              <h3 className="text-base font-semibold text-white">Gmail Integration</h3>
              <p className="text-sm text-slate-400 mt-1">Connect a Gmail inbox to automatically parse broker rate confirmation emails and create loads.</p>
            </div>
            {gmailStatus && (
              connected
                ? <span className="shrink-0 px-2.5 py-1 rounded-full text-xs font-medium bg-green-500/20 text-green-400 border border-green-500/30">Connected</span>
                : <span className="shrink-0 px-2.5 py-1 rounded-full text-xs font-medium bg-red-500/20 text-red-400 border border-red-500/30">Not connected</span>
            )}
          </div>

          <div className="mt-5 space-y-4">
            {gmailStatus === null ? (
              <p className="text-sm text-slate-500">Checking status…</p>
            ) : (
              <>
                {connected && gmailStatus.email && (
                  <div className="flex items-center gap-3">
                    <span className="text-sm text-slate-400 w-28 shrink-0">Connected as</span>
                    <span className="text-sm text-white font-medium">{gmailStatus.email}</span>
                  </div>
                )}
                {gmailStatus.last_poll && (
                  <div className="flex items-center gap-3">
                    <span className="text-sm text-slate-400 w-28 shrink-0">Last synced</span>
                    <span className="text-sm text-white">{fmtTime(gmailStatus.last_poll)}</span>
                  </div>
                )}
                {isHA && (
                  <div className="flex items-center gap-3 pt-1">
                    {!connected && (
                      <button onClick={handleConnect} disabled={connecting} className="px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-60 text-white text-sm rounded-lg font-medium transition flex items-center gap-2">
                        {connecting && <Spinner />}
                        {connecting ? 'Waiting for browser auth…' : 'Connect Gmail'}
                      </button>
                    )}
                    {connected && (
                      <>
                        <button onClick={handleSync} disabled={syncing} className="px-4 py-2 bg-slate-700 hover:bg-slate-600 disabled:opacity-60 text-white text-sm rounded-lg font-medium border border-slate-600 transition flex items-center gap-2">
                          {syncing && <Spinner />}
                          {syncing ? 'Syncing…' : 'Sync Now'}
                        </button>
                        <button onClick={handleConnect} disabled={connecting} className="px-4 py-2 text-sm text-slate-400 hover:text-white border border-slate-600 hover:border-slate-500 rounded-lg transition flex items-center gap-2">
                          {connecting && <Spinner />}
                          {connecting ? 'Reconnecting…' : 'Reconnect'}
                        </button>
                      </>
                    )}
                  </div>
                )}
                {connecting && (
                  <div className="flex items-start gap-2 px-3 py-2.5 bg-blue-500/10 border border-blue-500/20 rounded-lg">
                    <p className="text-xs text-blue-300">A browser window has opened for Google authorization. Sign in and grant access to continue.</p>
                  </div>
                )}
                {connectError && <p className="text-sm text-red-400">{connectError}</p>}
                {syncResult && (
                  <div className={`px-3 py-2.5 rounded-lg border text-sm ${syncResult.error ? 'bg-red-500/10 border-red-500/20 text-red-400' : 'bg-slate-700/50 border-slate-600 text-slate-300'}`}>
                    {syncResult.error ? syncResult.error : syncResult.skipped && syncResult.reason ? (
                      <span className="text-slate-400">{syncResult.reason}</span>
                    ) : (
                      <>Sync complete — <span className="text-green-400">{syncResult.created ?? 0} load{syncResult.created !== 1 ? 's' : ''} created</span>, <span className="text-slate-400">{syncResult.skipped ?? 0} skipped</span>{syncResult.errors > 0 && <>, <span className="text-red-400">{syncResult.errors} errors</span></>}</>
                    )}
                  </div>
                )}
                {!isHA && !connected && <p className="text-sm text-slate-500">Ask your Head Accountant to connect a Gmail inbox.</p>}
              </>
            )}
          </div>
        </div>

        {/* Gmail Sender Whitelist */}
        <GmailWhitelistCard isHA={isHA} />

        {/* Telegram Bot */}
        <div className="bg-slate-800 rounded-xl border border-slate-700 p-6 mt-4">
          <div className="flex items-start justify-between gap-4 mb-1">
            <div>
              <h3 className="text-base font-semibold text-white">Telegram Bot</h3>
              <p className="text-sm text-slate-400 mt-1">Send weekly settlement summaries to drivers via Telegram.</p>
            </div>
            {tgStatus && (
              tgStatus.configured
                ? <span className="shrink-0 px-2.5 py-1 rounded-full text-xs font-medium bg-green-500/20 text-green-400 border border-green-500/30">Configured</span>
                : <span className="shrink-0 px-2.5 py-1 rounded-full text-xs font-medium bg-slate-600/40 text-slate-400 border border-slate-500/30">Not configured</span>
            )}
          </div>

          <div className="mt-5 space-y-4">
            {tgStatus === null ? (
              <p className="text-sm text-slate-500">Checking status…</p>
            ) : !tgStatus.configured ? (
              <div className="space-y-3">
                <p className="text-sm text-slate-400">Set <code className="text-blue-400 text-xs bg-slate-700 px-1.5 py-0.5 rounded">TELEGRAM_BOT_TOKEN</code> in <code className="text-blue-400 text-xs bg-slate-700 px-1.5 py-0.5 rounded">backend/.env</code> and restart the server.</p>
                <div className="px-3 py-2.5 bg-slate-700/50 rounded-lg border border-slate-600 text-xs text-slate-400 space-y-1">
                  <p className="font-medium text-slate-300">Setup instructions:</p>
                  <p>1. Open Telegram and search for <span className="text-white">@BotFather</span></p>
                  <p>2. Send <code className="text-blue-400">/newbot</code> and follow the prompts</p>
                  <p>3. Copy the token and add to <code className="text-blue-400">backend/.env</code></p>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <span className="text-sm text-slate-400 w-28 shrink-0">Bot username</span>
                  <span className="text-sm text-white font-medium">@{tgStatus.bot_username}</span>
                </div>
                {isHA && (
                  <div className="space-y-2">
                    <p className="text-xs text-slate-400 uppercase tracking-wide">Send test message</p>
                    <div className="flex gap-2">
                      <input
                        value={testChatId}
                        onChange={e => { setTestChatId(e.target.value); setTestResult(null) }}
                        placeholder="Chat ID to test (e.g. 123456789)"
                        className="flex-1 bg-slate-700 border border-slate-600 rounded px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500 transition"
                      />
                      <button
                        onClick={handleTestMessage}
                        disabled={testSending || !testChatId.trim()}
                        className="px-3 py-2 bg-slate-600 hover:bg-slate-500 disabled:opacity-50 text-white text-sm rounded border border-slate-500 transition flex items-center gap-2 shrink-0"
                      >
                        {testSending && <Spinner />}
                        {testSending ? '…' : 'Send Test'}
                      </button>
                    </div>
                    {testResult && <p className={`text-sm ${testResult.error ? 'text-red-400' : 'text-green-400'}`}>{testResult.error || '✓ Test message sent successfully'}</p>}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Change Password */}
        <ChangePasswordCard />
      </main>
    </div>
  )
}
