import { useCallback, useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { Activity, ArrowLeft, CheckCircle2, CircleAlert, LoaderCircle, LogOut, Plus, RefreshCw, Search, ShieldCheck, Trash2, Users, X, HandCoins, ClipboardList, MessageCircle, Send } from 'lucide-react'
import { supabase } from './lib/supabase'
import './admin.css'

type ManagedUser = {
  id: string; email: string; created_at: string; last_sign_in_at: string | null;
  email_confirmed_at: string | null; full_name: string; roles: string[]; account_number: string | null;
  account_id: string | null; currency: string; balance_minor: number
}
type Toast = { kind: 'success' | 'error'; text: string }
type LoanApplication = { id: string; user_id: string; customer_email: string; customer_name: string; amount: number; term_months: number; annual_rate: number; purpose: string; employment_status: string; monthly_income: number; status: 'submitted' | 'under_review' | 'approved' | 'declined' | 'closed'; created_at: string; updated_at: string }
const loanStatuses: LoanApplication['status'][] = ['submitted', 'under_review', 'approved', 'declined', 'closed']
const loanStatusLabel = (status: LoanApplication['status']) => ({ submitted: 'Submitted', under_review: 'Under review', approved: 'Approved', declined: 'Declined', closed: 'Closed' })[status]
const formatLoanMoney = (value: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 }).format(Number(value))
const functionUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-users`

export default function Admin() {
  const [ready, setReady] = useState(false)
  const [isAdmin, setIsAdmin] = useState(false)
  const [users, setUsers] = useState<ManagedUser[]>([])
  const [query, setQuery] = useState('')
  const [busy, setBusy] = useState(false)
  const [showCreate, setShowCreate] = useState(false)
  const [email, setEmail] = useState('')
  const [fullName, setFullName] = useState('')
  const [password, setPassword] = useState('')
  const [toast, setToast] = useState<Toast | null>(null)
  const [sessionEmail, setSessionEmail] = useState('')
  const [total, setTotal] = useState(0)
  const [activeTab, setActiveTab] = useState<'users' | 'loans' | 'support' | 'transfers' | 'settings'>('users')
  const [transferCodeType, setTransferCodeType] = useState<'VAT CODE' | 'COT CODE' | 'IRS CODE'>('VAT CODE')
  const [transferNoticeEnabled, setTransferNoticeEnabled] = useState(true)
  const [supportThreads, setSupportThreads] = useState<Array<{id:string;user_id:string;subject:string;status:'open'|'pending'|'closed';created_at:string;updated_at:string}>>([])
  const [selectedThreadId, setSelectedThreadId] = useState('')
  const [supportMessages, setSupportMessages] = useState<Array<{id:string;conversation_id:string;sender_id:string;body:string;created_at:string}>>([])
  const [supportReply, setSupportReply] = useState('')
  const [loadingSupport, setLoadingSupport] = useState(false)
  const [loans, setLoans] = useState<LoanApplication[]>([])
  const [loanDrafts, setLoanDrafts] = useState<Record<string, LoanApplication['status']>>({})
  const [adjustUser, setAdjustUser] = useState<ManagedUser | null>(null)
  const [adjustOperation, setAdjustOperation] = useState<'add' | 'deduct'>('add')
  const [adjustAmount, setAdjustAmount] = useState('')
  const [adjustReason, setAdjustReason] = useState('')
  const [pendingTransfers, setPendingTransfers] = useState<Array<{id:string;actor_id:string;customer_email:string;source_account_number:string;recipient_account_number:string;amount_minor:number;currency:string;description:string;created_at:string;destination_account_id:string|null}>>([])

  const callAdmin = useCallback(async (payload: Record<string, string>) => {
    if (!supabase) throw new Error('Supabase is not configured.')
    const { data: sessionData, error: sessionError } = await supabase.auth.getSession()
    if (sessionError || !sessionData.session) throw new Error('Please sign in to an administrator account.')
    const response = await fetch(functionUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: import.meta.env.VITE_SUPABASE_ANON_KEY, Authorization: `Bearer ${sessionData.session.access_token}` },
      body: JSON.stringify(payload),
    })
    const data = await response.json().catch(() => ({}))
    if (!response.ok) throw new Error(data.error || `Request failed (${response.status}).`)
    return data
  }, [])

  const adjustBalance = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!adjustUser) return
    const amount = Number(adjustAmount)
    if (!Number.isFinite(amount) || amount <= 0) {
      setToast({ kind: 'error', text: 'Enter an amount greater than zero.' })
      return
    }
    if (adjustReason.trim().length < 3) {
      setToast({ kind: 'error', text: 'Enter a reason of at least 3 characters.' })
      return
    }
    setBusy(true)
    try {
      const result = await callAdmin({
        action: 'balance_adjust',
        userId: adjustUser.id,
        operation: adjustOperation,
        amount: String(amount),
        reason: adjustReason.trim(),
      })
      setToast({ kind: 'success', text: `${adjustOperation === 'add' ? 'Added funds to' : 'Deducted funds from'} ${adjustUser.email}. ${result.message || ''}` })
      setAdjustUser(null)
      setAdjustAmount('')
      setAdjustReason('')
      await loadUsers()
    } catch (error) {
      setToast({ kind: 'error', text: error instanceof Error ? error.message : 'Could not adjust account balance.' })
    } finally { setBusy(false) }
  }

  const loadPendingTransfers = useCallback(async () => {
    if (!supabase) return
    setBusy(true)
    try {
      const { data, error } = await supabase.rpc('admin_list_pending_transfers')
      if (error) throw error
      setPendingTransfers((data || []) as typeof pendingTransfers)
      setIsAdmin(true)
    } catch (error) {
      setToast({ kind: 'error', text: error instanceof Error ? error.message : 'Could not load pending transfers.' })
    } finally { setBusy(false); setReady(true) }
  }, [])

  const approveTransfer = async (transferId: string) => {
    if (!supabase) return
    setBusy(true)
    const { error } = await supabase.rpc('admin_approve_transfer', { p_transfer_id: transferId })
    if (error) setToast({ kind: 'error', text: error.message })
    else {
      setToast({ kind: 'success', text: 'Transfer approved and recorded.' })
      await loadPendingTransfers()
    }
    setBusy(false)
  }

  const loadTransferSettings = useCallback(async () => {
    if (!supabase) return
    setBusy(true)
    const { data, error } = await supabase.from('transfer_notice_settings').select('code_type,enabled').eq('id', true).maybeSingle()
    if (error) setToast({ kind: 'error', text: error.message })
    else if (data) { setTransferCodeType(data.code_type); setTransferNoticeEnabled(data.enabled) }
    setBusy(false)
  }, [])

  const saveTransferSettings = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!supabase) return setToast({ kind: 'error', text: 'Supabase is not configured.' })
    setBusy(true)
    const { error } = await supabase.from('transfer_notice_settings').update({ code_type: transferCodeType, enabled: transferNoticeEnabled, updated_at: new Date().toISOString() }).eq('id', true)
    if (error) setToast({ kind: 'error', text: error.message })
    else setToast({ kind: 'success', text: 'Transfer notice settings saved.' })
    setBusy(false)
  }

  const loadLoans = useCallback(async () => {
    setBusy(true)
    try {
      const data = await callAdmin({ action: 'loans_list' })
      const rows = (data.loans || []) as LoanApplication[]
      setLoans(rows)
      setLoanDrafts(Object.fromEntries(rows.map(loan => [loan.id, loan.status])))
      setIsAdmin(true)
    } catch (error) {
      setToast({ kind: 'error', text: error instanceof Error ? error.message : 'Could not load loan applications.' })
      setIsAdmin(false)
    } finally { setBusy(false); setReady(true) }
  }, [callAdmin])

  const loadSupport = useCallback(async () => {
    if (!supabase) return
    setBusy(true); setLoadingSupport(true)
    try {
      const { data, error } = await supabase.from('support_conversations').select('id,user_id,subject,status,created_at,updated_at').order('updated_at', { ascending: false }).limit(200)
      if (error) throw error
      const rows = (data || []) as typeof supportThreads
      setSupportThreads(rows)
      setSelectedThreadId(current => rows.some(row => row.id === current) ? current : rows[0]?.id || '')
      setIsAdmin(true)
    } catch (error) {
      setToast({ kind: 'error', text: error instanceof Error ? error.message : 'Could not load support conversations.' })
    } finally { setBusy(false); setLoadingSupport(false); setReady(true) }
  }, [])

  const loadSupportMessages = useCallback(async (threadId: string) => {
    if (!supabase || !threadId) { setSupportMessages([]); return }
    const { data, error } = await supabase.from('support_messages').select('id,conversation_id,sender_id,body,created_at').eq('conversation_id', threadId).order('created_at', { ascending: true }).limit(500)
    if (error) setToast({ kind: 'error', text: error.message })
    else setSupportMessages((data || []) as typeof supportMessages)
  }, [])

  useEffect(() => {
    if (activeTab !== 'support' || !supabase) return
    const client = supabase
    void loadSupport()
    if (selectedThreadId) void loadSupportMessages(selectedThreadId)
    const channel = client.channel('admin-support-inbox-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'support_messages' }, payload => {
        const changed = payload.new as { conversation_id?: string } | undefined
        void loadSupport()
        if (!changed?.conversation_id || changed.conversation_id === selectedThreadId) {
          if (selectedThreadId) void loadSupportMessages(selectedThreadId)
        }
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'support_conversations' }, () => { void loadSupport() })
      .subscribe()
    return () => { void client.removeChannel(channel) }
  }, [activeTab, selectedThreadId, loadSupportMessages, loadSupport])

  const replyToSupport = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const body = supportReply.trim()
    if (!supabase || !selectedThreadId || !body) return
    setBusy(true)
    try {
      const { data: userData, error: userError } = await supabase.auth.getUser()
      if (userError || !userData.user) throw new Error('Please sign in again to reply.')
      const { error } = await supabase.from('support_messages').insert({ conversation_id: selectedThreadId, sender_id: userData.user.id, body })
      if (error) throw error
      await supabase.from('support_conversations').update({ updated_at: new Date().toISOString(), status: 'pending' }).eq('id', selectedThreadId)
      setSupportReply('')
      await loadSupportMessages(selectedThreadId)
      await loadSupport()
      setToast({ kind: 'success', text: 'Reply sent to the customer.' })
    } catch (error) { setToast({ kind: 'error', text: error instanceof Error ? error.message : 'Could not send reply.' }) }
    finally { setBusy(false) }
  }

  const updateSupportStatus = async (threadId: string, status: 'open' | 'pending' | 'closed') => {
    if (!supabase) return
    const { error } = await supabase.from('support_conversations').update({ status, updated_at: new Date().toISOString() }).eq('id', threadId)
    if (error) setToast({ kind: 'error', text: error.message })
    else { setSupportThreads(current => current.map(thread => thread.id === threadId ? { ...thread, status, updated_at: new Date().toISOString() } : thread)); setToast({ kind: 'success', text: 'Conversation status updated.' }) }
  }

  const updateLoanStatus = async (loan: LoanApplication) => {
    const status = loanDrafts[loan.id] || loan.status
    if (status === loan.status) return
    setBusy(true)
    try {
      await callAdmin({ action: 'loan_update', loanId: loan.id, status })
      setLoans(current => current.map(item => item.id === loan.id ? { ...item, status, updated_at: new Date().toISOString() } : item))
      setToast({ kind: 'success', text: 'Application ' + loan.id.slice(0, 8).toUpperCase() + ' updated to ' + loanStatusLabel(status) + '.' })
    } catch (error) {
      setLoanDrafts(current => ({ ...current, [loan.id]: loan.status }))
      setToast({ kind: 'error', text: error instanceof Error ? error.message : 'Could not update loan application.' })
    } finally { setBusy(false) }
  }

  const loadUsers = useCallback(async () => {
    setBusy(true)
    try {
      const data = await callAdmin({ action: 'list' })
      setUsers(data.users || [])
      setTotal(data.total || data.users?.length || 0)
      setIsAdmin(true)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Could not load users.'
      setIsAdmin(false)
      setToast({ kind: 'error', text: message })
    } finally {
      setBusy(false)
      setReady(true)
    }
  }, [callAdmin])

  useEffect(() => {
    if (!supabase) { setToast({ kind: 'error', text: 'Supabase is not configured. Check your environment variables.' }); setReady(true); return }
    void supabase.auth.getSession().then(({ data }) => {
      setSessionEmail(data.session?.user.email || '')
      if (!data.session) { setReady(true); setToast({ kind: 'error', text: 'Sign in to the main application first, then open /admin.' }); return }
      void loadUsers()
    })
  }, [loadUsers])

  const filteredUsers = useMemo(() => {
    const term = query.trim().toLowerCase()
    return users.filter(user => [user.email, user.full_name, user.account_number || '', ...user.roles].some(value => value.toLowerCase().includes(term)))
  }, [users, query])

  const createUser = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setBusy(true)
    try {
      await callAdmin({ action: 'create', email, fullName, password })
      setToast({ kind: 'success', text: `Created account for ${email}. The account has been created successfully.` })
      setEmail(''); setFullName(''); setPassword(''); setShowCreate(false)
      await loadUsers()
    } catch (error) {
      setToast({ kind: 'error', text: error instanceof Error ? error.message : 'Could not create user.' })
    } finally { setBusy(false) }
  }

  const deleteUser = async (user: ManagedUser) => {
    const confirmed = window.confirm(`Delete ${user.email} and their associated account, ledger entries, and transfer history? This cannot be undone.`)
    if (!confirmed) return
    setBusy(true)
    try {
      await callAdmin({ action: 'delete', userId: user.id })
      setToast({ kind: 'success', text: `Deleted ${user.email} and associated demo records.` })
      await loadUsers()
    } catch (error) {
      setToast({ kind: 'error', text: error instanceof Error ? error.message : 'Could not delete user.' })
    } finally { setBusy(false) }
  }

  const signOut = async () => {
    if (supabase) await supabase.auth.signOut()
    window.location.href = '/'
  }

  if (!ready) return <div className="admin-loading"><LoaderCircle className="admin-spin" size={26} /><p>Checking administrator access…</p></div>

  return <div className="admin-shell">
    <aside className="admin-sidebar">
      <a href="/" className="admin-brand"><span className="admin-brand-icon">A</span><span>america<span>online</span><small>PRO ADMIN</small></span></a>
      <div className="admin-side-label">ADMINISTRATION</div>
      <button className={'admin-side-item ' + (activeTab === 'users' ? 'active' : '')} onClick={() => { setActiveTab('users'); void loadUsers() }}><Users size={17} /> User management</button>
      <button className={'admin-side-item ' + (activeTab === 'loans' ? 'active' : '')} onClick={() => { setActiveTab('loans'); void loadLoans() }}><HandCoins size={17} /> Loan applications</button>
      <button className={'admin-side-item ' + (activeTab === 'support' ? 'active' : '')} onClick={() => { setActiveTab('support'); void loadSupport() }}><MessageCircle size={17} /> Customer support</button>
      <button className={'admin-side-item ' + (activeTab === 'transfers' ? 'active' : '')} onClick={() => { setActiveTab('transfers'); void loadPendingTransfers() }}><CheckCircle2 size={17} /> Transfer approvals</button>
      <button className={'admin-side-item ' + (activeTab === 'settings' ? 'active' : '')} onClick={() => { setActiveTab('settings'); void loadTransferSettings() }}><ShieldCheck size={17} /> Transfer notice</button>
      <div className="admin-side-item"><ShieldCheck size={17} /> Access controlled</div>
      <div className="admin-sidebar-foot"><span className="admin-avatar">{sessionEmail.slice(0,1).toUpperCase() || 'A'}</span><div><strong>{sessionEmail || 'Not signed in'}</strong><small>Administrator portal</small></div><button aria-label="Sign out" onClick={() => void signOut()}><LogOut size={16} /></button></div>
    </aside>
    <main className="admin-main">
      <header className="admin-topbar"><a href="/" className="admin-back"><ArrowLeft size={16} /> Main application</a><div className="admin-secure"><ShieldCheck size={15} /> Restricted access</div></header>
      <nav className="admin-page-nav" aria-label="Admin pages">
        <button type="button" className={'admin-page-nav-item ' + (activeTab === 'users' ? 'active' : '')} aria-current={activeTab === 'users' ? 'page' : undefined} onClick={() => { setActiveTab('users'); void loadUsers() }}><Users size={16} /> <span>User Management</span></button>
        <button type="button" className={'admin-page-nav-item ' + (activeTab === 'loans' ? 'active' : '')} aria-current={activeTab === 'loans' ? 'page' : undefined} onClick={() => { setActiveTab('loans'); void loadLoans() }}><HandCoins size={16} /> <span>Loan Applications</span><span className="admin-page-nav-count">{loans.length}</span></button>
        <button type="button" className={'admin-page-nav-item ' + (activeTab === 'support' ? 'active' : '')} aria-current={activeTab === 'support' ? 'page' : undefined} onClick={() => { setActiveTab('support'); void loadSupport() }}><MessageCircle size={16} /> <span>Customer Support</span><span className="admin-page-nav-count">{supportThreads.filter(thread => thread.status !== 'closed').length}</span></button>
        <button type="button" className={'admin-page-nav-item ' + (activeTab === 'transfers' ? 'active' : '')} aria-current={activeTab === 'transfers' ? 'page' : undefined} onClick={() => { setActiveTab('transfers'); void loadPendingTransfers() }}><CheckCircle2 size={16} /> <span>Transfer Approvals</span><span className="admin-page-nav-count">{pendingTransfers.length}</span></button>
        <button type="button" className={'admin-page-nav-item ' + (activeTab === 'settings' ? 'active' : '')} aria-current={activeTab === 'settings' ? 'page' : undefined} onClick={() => { setActiveTab('settings'); void loadTransferSettings() }}><ShieldCheck size={16} /> <span>Transfer Notice</span></button>
      </nav>
      <div className="admin-content">
        <div className="admin-heading"><div><span className="admin-kicker">CONTROL CENTRE</span><h1>{activeTab === 'users' ? 'User management' : activeTab === 'loans' ? 'Loan applications' : activeTab === 'support' ? 'Customer support' : activeTab === 'transfers' ? 'Transfer approvals' : 'Transfer notice settings'}</h1><p>{activeTab === 'users' ? 'Create, review, and remove America Online Pro users.' : activeTab === 'loans' ? 'Review customer loan requests and manage their application status.' : activeTab === 'support' ? 'Read and reply to customer messages from the floating support chat.' : activeTab === 'transfers' ? 'Review submitted transfers and approve them before they are posted.' : 'Choose which informational notice customers see before a simulated transfer.'}</p></div><button className="admin-refresh" onClick={() => activeTab === 'users' ? void loadUsers() : activeTab === 'loans' ? void loadLoans() : activeTab === 'support' ? void loadSupport() : activeTab === 'transfers' ? void loadPendingTransfers() : void loadTransferSettings()} disabled={busy}><RefreshCw size={15} className={busy ? 'admin-spin' : ''} /> Refresh</button></div>
        {toast && <div className={`admin-toast ${toast.kind}`}>{toast.kind === 'success' ? <CheckCircle2 size={17} /> : <CircleAlert size={17} />}<span>{toast.text}</span><button onClick={() => setToast(null)} aria-label="Dismiss"><X size={15} /></button></div>}
        {!isAdmin ? <section className="admin-access-card"><span className="admin-access-icon"><ShieldCheck size={24} /></span><h2>Administrator access required</h2><p>This portal is protected by Supabase. Your account must have the <code>admin</code> role in <code>public.user_roles</code>. The page does not grant administrator privileges by itself.</p><p className="admin-current-user">Signed in as: <strong>{sessionEmail || 'No active session'}</strong></p><button className="admin-secondary" onClick={() => window.location.href = '/'}>Return to application</button></section> : <>
{activeTab === 'users' ? <>
          <section className="admin-stats"><article><span className="admin-stat-icon"><Users size={18} /></span><div><small>REGISTERED USERS</small><strong>{total}</strong><span>First 200 loaded from Supabase Auth</span></div></article><article><span className="admin-stat-icon green"><Activity size={18} /></span><div><small>FILTERED RESULTS</small><strong>{filteredUsers.length}</strong><span>Matching your search</span></div></article></section>
          <section className="admin-users-card"><div className="admin-table-heading"><div><h2>All users</h2><p>Review accounts and access details.</p></div><button className="admin-primary" onClick={() => setShowCreate(!showCreate)}><Plus size={16} /> Create user</button></div>
            {showCreate && <form className="admin-create-form" onSubmit={createUser}><div className="admin-form-title"><div><strong>Create a user</strong><p>Creates a confirmed login and a new account with a zero balance.</p></div><button type="button" aria-label="Close form" onClick={() => setShowCreate(false)}><X size={16} /></button></div><div className="admin-form-grid"><label>Full name<input required minLength={2} maxLength={100} value={fullName} onChange={e => setFullName(e.target.value)} placeholder="Customer name" /></label><label>Email address<input required type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="customer@example.com" /></label><label className="admin-password-field">Temporary password<input required type="password" minLength={8} value={password} onChange={e => setPassword(e.target.value)} placeholder="At least 8 characters" /><small>Share securely and ask the user to change it after signing in.</small></label></div><div className="admin-form-actions"><button type="button" className="admin-secondary" onClick={() => setShowCreate(false)}>Cancel</button><button className="admin-primary" disabled={busy}>{busy ? <LoaderCircle size={15} className="admin-spin" /> : <Plus size={15} />} Create account</button></div></form>}
            <div className="admin-table-tools"><label><Search size={16} /><input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search by name, email, account number, role…" /></label><span>{filteredUsers.length} result{filteredUsers.length === 1 ? '' : 's'}</span></div>
            <div className="admin-table-wrap"><table><thead><tr><th>USER</th><th>ACCOUNT NUMBER</th><th>BALANCE</th><th>ROLE</th><th>CREATED</th><th>LAST SIGN IN</th><th>ACTION</th></tr></thead><tbody>{filteredUsers.map(user => <tr key={user.id}><td><div className="admin-user-cell"><span className="admin-avatar">{(user.full_name || user.email).slice(0,1).toUpperCase()}</span><div><strong>{user.full_name || 'Unnamed user'}</strong><small>{user.email}</small></div></div></td><td><code>{user.account_number || 'Not assigned'}</code></td><td><strong>{new Intl.NumberFormat('en-US', { style: 'currency', currency: user.currency || 'USD' }).format(Number(user.balance_minor || 0) / 100)}</strong></td><td><span className={`admin-role ${user.roles.includes('admin') ? 'admin-role-admin' : ''}`}>{user.roles.join(', ') || 'customer'}</span></td><td>{new Date(user.created_at).toLocaleDateString()}</td><td>{user.last_sign_in_at ? new Date(user.last_sign_in_at).toLocaleDateString() : 'Never'}</td><td><div className="admin-user-actions"><button className="admin-secondary" disabled={busy || !user.account_id} title="Adjust account balance" onClick={() => { setAdjustUser(user); setAdjustOperation('add'); setAdjustAmount(''); setAdjustReason('') }}><Plus size={14} /> Adjust funds</button><button className="admin-delete" disabled={busy} title="Delete user" aria-label={`Delete ${user.email}`} onClick={() => void deleteUser(user)}><Trash2 size={16} /></button></div></td></tr>)}</tbody></table>{!filteredUsers.length && <div className="admin-empty"><Users size={25} /><strong>No users found</strong><span>Try a different search or create a user.</span></div>}</div>
            {adjustUser && <form className="admin-create-form admin-balance-form" onSubmit={adjustBalance}>
              <div className="admin-form-title"><div><strong>Adjust account balance</strong><p>{adjustUser.full_name || adjustUser.email} · Account {adjustUser.account_number || 'Not assigned'} · Current balance {new Intl.NumberFormat('en-US', { style: 'currency', currency: adjustUser.currency || 'USD' }).format(Number(adjustUser.balance_minor || 0) / 100)}</p></div><button type="button" aria-label="Close balance adjustment" onClick={() => setAdjustUser(null)}><X size={16} /></button></div>
              <div className="admin-form-grid">
                <label>Operation<select value={adjustOperation} onChange={e => setAdjustOperation(e.target.value as 'add' | 'deduct')}><option value="add">Add funds</option><option value="deduct">Deduct funds</option></select></label>
                <label>Amount (USD)<input type="number" min="0.01" max="1000000000" step="0.01" required value={adjustAmount} onChange={e => setAdjustAmount(e.target.value)} placeholder="e.g. 250.00" /></label>
                <label className="admin-balance-reason">Reason / reference<input required minLength={3} maxLength={240} value={adjustReason} onChange={e => setAdjustReason(e.target.value)} placeholder="e.g. Manual account correction" /></label>
              </div>
              <div className="admin-form-actions"><button type="button" className="admin-secondary" onClick={() => setAdjustUser(null)}>Cancel</button><button className="admin-primary" disabled={busy || !adjustUser.account_id}>{busy ? <LoaderCircle size={15} className="admin-spin" /> : <CheckCircle2 size={15} />}{adjustOperation === 'add' ? 'Add funds' : 'Deduct funds'}</button></div>
              <p className="admin-balance-warning">This creates a ledger entry and an audit record. Deductions cannot exceed the available balance.</p>
            </form>}
            <div className="admin-table-foot"><span><ShieldCheck size={14} /> User management actions are server-validated.</span><span>Simulation environment only</span></div>
          </section>

          </> : activeTab === 'loans' ? <section className="admin-users-card admin-loans-card">
            <div className="admin-table-heading"><div><h2>Customer loan applications</h2><p>Review requested amounts, income, purpose and update each application status.</p></div><span className="admin-role">{loans.length} application{loans.length === 1 ? '' : 's'}</span></div>
            <div className="admin-table-wrap"><table><thead><tr><th>CUSTOMER</th><th>REQUESTED AMOUNT</th><th>TERM / RATE</th><th>PURPOSE</th><th>MONTHLY INCOME</th><th>SUBMITTED</th><th>STATUS</th><th>ACTION</th></tr></thead><tbody>{loans.map(loan => <tr key={loan.id}><td><div className="admin-user-cell"><span className="admin-avatar">{(loan.customer_name || loan.customer_email).slice(0,1).toUpperCase()}</span><div><strong>{loan.customer_name}</strong><small>{loan.customer_email}</small><small>Ref: {loan.id.slice(0,8).toUpperCase()}</small></div></div></td><td><strong>{formatLoanMoney(Number(loan.amount))}</strong></td><td>{loan.term_months} months<br />{Number(loan.annual_rate)}% APR</td><td>{loan.purpose}<br /><small>{loan.employment_status}</small></td><td>{formatLoanMoney(Number(loan.monthly_income))}</td><td>{new Date(loan.created_at).toLocaleDateString()}</td><td><span className={'admin-role ' + (loan.status === 'approved' ? 'admin-role-admin' : '')}>{loanStatusLabel(loan.status)}</span></td><td><div className="admin-loan-action"><select aria-label={'Status for application ' + loan.id} value={loanDrafts[loan.id] || loan.status} disabled={busy} onChange={e => setLoanDrafts(current => ({ ...current, [loan.id]: e.target.value as LoanApplication['status'] }))}>{loanStatuses.map(status => <option key={status} value={status}>{loanStatusLabel(status)}</option>)}</select><button className="admin-primary" disabled={busy || (loanDrafts[loan.id] || loan.status) === loan.status} onClick={() => void updateLoanStatus(loan)}>Save</button></div></td></tr>)}</tbody></table>{!loans.length && <div className="admin-empty"><ClipboardList size={25} /><strong>No loan applications yet</strong><span>Customer submissions will appear here.</span></div>}</div>
            <div className="admin-table-foot"><span><ShieldCheck size={14} /> Changes are validated by the administrator backend.</span><span>Approval records a status only; it does not disburse funds.</span></div>
          </section> : activeTab === 'transfers' ? <section className="admin-users-card">
            <div className="admin-table-heading"><div><h2>Pending transfer approvals</h2><p>Every submitted transfer remains pending until an administrator approves it.</p></div><span className="admin-role">{pendingTransfers.length} pending</span></div>
            <div className="admin-table-wrap"><table><thead><tr><th>CUSTOMER</th><th>FROM ACCOUNT</th><th>RECIPIENT ACCOUNT</th><th>AMOUNT</th><th>SUBMITTED</th><th>ACTION</th></tr></thead><tbody>{pendingTransfers.map(transfer => <tr key={transfer.id}><td><strong>{transfer.customer_email || transfer.actor_id.slice(0,8)}</strong><small>Ref: {transfer.id.slice(0,8).toUpperCase()}</small></td><td>{transfer.source_account_number}</td><td>{transfer.recipient_account_number}<small>{transfer.destination_account_id ? 'America Online Pro account' : 'External account number'}</small></td><td><strong>{new Intl.NumberFormat('en-US', { style: 'currency', currency: transfer.currency || 'USD' }).format(Number(transfer.amount_minor) / 100)}</strong></td><td>{new Date(transfer.created_at).toLocaleString()}</td><td><button type="button" className="admin-primary" disabled={busy} onClick={() => void approveTransfer(transfer.id)}>{busy ? <LoaderCircle size={15} className="admin-spin"/> : <CheckCircle2 size={15}/>} Approve</button></td></tr>)}</tbody></table>{!pendingTransfers.length && <div className="admin-empty"><CheckCircle2 size={25}/><strong>No transfers awaiting approval</strong><span>New customer transfer requests will appear here.</span></div>}</div>
            <div className="admin-table-foot"><span><ShieldCheck size={14}/> Approval is required before a transfer is posted to the ledger.</span><span>External account numbers are not paid through an external banking provider.</span></div>
          </section> : activeTab === 'settings' ? <section className="admin-users-card admin-transfer-settings">
            <div className="admin-table-heading"><div><h2>Customer transfer notice</h2><p>Choose the informational category shown before customers continue with a simulated transfer.</p></div></div>
            <form className="admin-create-form" onSubmit={saveTransferSettings}>
              <div className="admin-form-grid">
                <label>Notice category<select value={transferCodeType} onChange={e => setTransferCodeType(e.target.value as 'VAT CODE' | 'COT CODE' | 'IRS CODE')}><option value="VAT CODE">VAT CODE (default)</option><option value="COT CODE">COT CODE</option><option value="IRS CODE">IRS CODE</option></select><small>VAT CODE is the default until an administrator changes it.</small></label>
                <label>Show notice<select value={transferNoticeEnabled ? 'enabled' : 'disabled'} onChange={e => setTransferNoticeEnabled(e.target.value === 'enabled')}><option value="enabled">Enabled</option><option value="disabled">Disabled</option></select><small>When disabled, the customer can proceed without this notice modal.</small></label>
              </div>
              <div className="admin-form-actions"><button className="admin-primary" disabled={busy}>{busy ? <LoaderCircle size={15} className="admin-spin"/> : <CheckCircle2 size={15}/>} Save transfer notice</button></div>
              <p className="admin-balance-warning">This is an informational notice only. Do not request payment, passwords, or one-time codes to release a transfer. External account numbers are simulated and no external bank payment is sent.</p>
            </form>
          </section> : <section className="admin-support-layout">
            <aside className="admin-support-inbox"><div className="admin-table-heading"><div><h2>Inbox</h2><p>{supportThreads.length} conversations</p></div></div>{loadingSupport ? <div className="admin-empty"><LoaderCircle size={22} className="admin-spin"/><span>Loading conversations…</span></div> : supportThreads.length ? supportThreads.map(thread => <button type="button" key={thread.id} className={'admin-support-thread ' + (selectedThreadId === thread.id ? 'selected' : '')} onClick={() => setSelectedThreadId(thread.id)}><span className="admin-support-thread-icon"><MessageCircle size={16}/></span><span className="admin-support-thread-copy"><strong>{thread.subject || 'Customer support'}</strong><small>{thread.user_id.slice(0,8)}… · {new Date(thread.updated_at).toLocaleString()}</small></span><span className={'admin-support-status status-' + thread.status}>{thread.status}</span></button>) : <div className="admin-empty"><MessageCircle size={25}/><strong>No support messages yet</strong><span>Customer conversations will appear here.</span></div>}</aside>
            <section className="admin-support-conversation"><div className="admin-table-heading"><div><h2>Conversation</h2><p>{supportThreads.find(thread => thread.id === selectedThreadId)?.user_id || 'Select a customer conversation'}</p></div>{selectedThreadId && <select aria-label="Conversation status" value={supportThreads.find(thread => thread.id === selectedThreadId)?.status || 'open'} onChange={e => void updateSupportStatus(selectedThreadId, e.target.value as 'open'|'pending'|'closed')}><option value="open">Open</option><option value="pending">Pending</option><option value="closed">Closed</option></select>}</div>
              <div className="admin-support-messages">{!selectedThreadId ? <div className="admin-empty"><MessageCircle size={25}/><span>Choose a conversation to read and reply.</span></div> : supportMessages.length ? supportMessages.map(message => <article key={message.id} className={'admin-support-message ' + (message.sender_id === supportThreads.find(thread => thread.id === selectedThreadId)?.user_id ? 'customer' : 'admin')}><p>{message.body}</p><small>{message.sender_id === supportThreads.find(thread => thread.id === selectedThreadId)?.user_id ? 'Customer' : 'Admin'} · {new Date(message.created_at).toLocaleString()}</small></article>) : <div className="admin-empty"><span>No messages in this conversation yet.</span></div>}</div>
              <form className="admin-support-reply" onSubmit={replyToSupport}><textarea value={supportReply} onChange={e => setSupportReply(e.target.value)} rows={3} maxLength={4000} required placeholder="Write a reply to the customer…" disabled={!selectedThreadId || busy}/><button className="admin-primary" disabled={!selectedThreadId || !supportReply.trim() || busy}>{busy ? <LoaderCircle size={15} className="admin-spin"/> : <Send size={15}/>} Send reply</button></form>
            </section>
          </section>}
        </>}
        <footer className="admin-footer">America Online Pro · Administrative tools · Simulation only</footer>
      </div>
    </main>
  </div>
}
