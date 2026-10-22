import { useCallback, useEffect, useMemo, useState } from 'react'
import type { FormEvent, ReactNode } from 'react'
import {
  Activity, ArrowDownLeft, ArrowLeftRight, ArrowUpRight, Bell, Check, ChevronDown,
  CircleHelp, CreditCard, Eye, EyeOff, LayoutDashboard, LogOut, Menu, Plus, Search,
  Settings2, ShieldCheck, Sparkles, Wallet, X, LockKeyhole, LoaderCircle, RefreshCw, HandCoins, TrendingUp,
} from 'lucide-react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from './lib/supabase'

type Page = 'Overview' | 'Accounts' | 'Transfer' | 'Cards' | 'Transactions' | 'Loans' | 'Invest' | 'Settings' | 'Analytics' | 'Add funds' | 'Notifications' | 'Help center'
type Account = { id: string; account_number: string; routing_number: string | null; iban: string | null; swift_bic: string | null; display_name: string; currency: string; status: string; is_demo: boolean }
type Entry = { id: string; amount_minor: number; currency: string; created_at: string; account_id: string; ledger_transactions: { description: string; status: string; posted_at: string | null } | null }
type Notice = { kind: 'success' | 'error' | 'info'; text: string }

const navigation: { label: Page; icon: typeof LayoutDashboard }[] = [
  { label: 'Overview', icon: LayoutDashboard },
  { label: 'Accounts', icon: Wallet },
  { label: 'Transfer', icon: ArrowLeftRight },
  { label: 'Cards', icon: CreditCard },
  { label: 'Transactions', icon: Activity },
  { label: 'Loans', icon: HandCoins },
  { label: 'Invest', icon: TrendingUp },
  { label: 'Settings', icon: Settings2 },
]
const money = (minor: number, currency = 'USD') => new Intl.NumberFormat('en-NG', { style: 'currency', currency, minimumFractionDigits: 2 }).format(minor / 100)
const dateLabel = (value: string) => new Date(value).toLocaleString('en-NG', { dateStyle: 'medium', timeStyle: 'short' })

function App() {
  const [page, setPage] = useState<Page>('Overview')
  const [session, setSession] = useState<Session | null>(null)
  const [authReady, setAuthReady] = useState(!supabase)
  const [menuOpen, setMenuOpen] = useState(false)
  const [showBalance, setShowBalance] = useState(true)
  const [accountModalOpen, setAccountModalOpen] = useState(false)
  const [accounts, setAccounts] = useState<Account[]>([])
  const [entries, setEntries] = useState<Entry[]>([])
  const [profileName, setProfileName] = useState('')
  const [loading, setLoading] = useState(false)
  const [notice, setNotice] = useState<Notice | null>(null)
  const [search, setSearch] = useState('')
  const [authMode, setAuthMode] = useState<'signin' | 'signup' | 'reset' | 'update-password'>('signin')
  const [authEmail, setAuthEmail] = useState('')
  const [authPassword, setAuthPassword] = useState('')
  const [authName, setAuthName] = useState('')
  const [transferAccount, setTransferAccount] = useState('')
  const [transferAmount, setTransferAmount] = useState('')
  const [transferNote, setTransferNote] = useState('')
  const [fundAmount, setFundAmount] = useState('250')
  const [profileDraft, setProfileDraft] = useState('')
  const [saving, setSaving] = useState(false)

  const announce = (kind: Notice['kind'], text: string) => {
    setNotice({ kind, text })
    if (kind !== 'error') window.setTimeout(() => setNotice(null), 5000)
  }

  useEffect(() => {
    if (!supabase) return
    supabase.auth.getSession().then(({ data, error }) => {
      if (error) announce('error', error.message)
      setSession(data.session)
      setAuthReady(true)
    })
    const { data } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession)
      if (_event === 'PASSWORD_RECOVERY') setAuthMode('update-password')
      setAuthReady(true)
    })
    return () => data.subscription.unsubscribe()
  }, [])

  const loadData = useCallback(async () => {
    if (!supabase || !session?.user) return
    setLoading(true)
    const [profileResult, accountResult, entryResult] = await Promise.all([
      supabase.from('profiles').select('full_name').eq('id', session.user.id).maybeSingle(),
      supabase.from('accounts').select('id,account_number,routing_number,iban,swift_bic,display_name,currency,status,is_demo').order('created_at', { ascending: true }),
      supabase.from('ledger_entries').select('id,amount_minor,currency,created_at,account_id,ledger_transactions(description,status,posted_at)').order('created_at', { ascending: false }).limit(100),
    ])
    if (profileResult.error) announce('error', profileResult.error.message)
    if (accountResult.error) announce('error', accountResult.error.message)
    if (entryResult.error) announce('error', entryResult.error.message)
    setProfileName(profileResult.data?.full_name || session.user.user_metadata?.full_name || session.user.email?.split('@')[0] || 'Customer')
    setProfileDraft(profileResult.data?.full_name || session.user.user_metadata?.full_name || '')
    setAccounts(accountResult.data || [])
    setEntries((entryResult.data || []) as unknown as Entry[])
    setLoading(false)
  }, [session])

  useEffect(() => { void loadData() }, [loadData])

  const balances = useMemo(() => accounts.map(account => ({
    ...account,
    balance: entries.filter(entry => entry.account_id === account.id).reduce((sum, entry) => sum + Number(entry.amount_minor), 0),
  })), [accounts, entries])
  const totalBalance = balances.reduce((sum, account) => sum + account.balance, 0)
  const moneyIn = entries.filter(entry => Number(entry.amount_minor) > 0).reduce((sum, entry) => sum + Number(entry.amount_minor), 0)
  const moneyOut = Math.abs(entries.filter(entry => Number(entry.amount_minor) < 0).reduce((sum, entry) => sum + Number(entry.amount_minor), 0))
  const filteredEntries = entries.filter(entry => {
    const description = entry.ledger_transactions?.description || 'Account activity'
    return description.toLowerCase().includes(search.toLowerCase())
  })
  const activeAccount = balances[0]

  const doAuth = async (event: FormEvent) => {
    event.preventDefault()
    if (!supabase) return announce('error', 'Add your Supabase URL and publishable key to .env.local first.')
    setSaving(true)
    let error: { message: string } | null = null
    if (authMode === 'signup') {
      const result = await supabase.auth.signUp({ email: authEmail, password: authPassword, options: { data: { full_name: authName }, emailRedirectTo: window.location.origin } })
      error = result.error
      if (!error && !result.data.session) announce('success', 'Account created. Check your email to confirm your address, then sign in.')
    } else if (authMode === 'reset') {
      const result = await supabase.auth.resetPasswordForEmail(authEmail, { redirectTo: window.location.origin })
      error = result.error
      if (!error) announce('success', 'Password reset instructions have been sent if that email is registered.')
    } else if (authMode === 'update-password') {
      const result = await supabase.auth.updateUser({ password: authPassword })
      error = result.error
      if (!error) { announce('success', 'Password updated successfully.'); setAuthMode('signin'); setAuthPassword('') }
    } else {
      const result = await supabase.auth.signInWithPassword({ email: authEmail, password: authPassword })
      error = result.error
    }
    if (error) announce('error', error.message)
    setSaving(false)
  }

  const sendTransfer = async (event: FormEvent) => {
    event.preventDefault()
    if (!supabase || !activeAccount) return announce('error', 'No account is available. Sign in and refresh your account data.')
    const amount = Number(transferAmount)
    if (!Number.isFinite(amount) || amount <= 0 || Math.round(amount * 100) <= 0) return announce('error', 'Enter a valid transfer amount greater than $0.')
    if (!transferAccount.trim()) return announce('error', 'Enter the recipient account number.')
    setSaving(true)
    const { error } = await supabase.rpc('send_demo_transfer', {
      p_source_account_id: activeAccount.id,
      p_destination_account_number: transferAccount.trim(),
      p_amount_minor: Math.round(amount * 100),
      p_description: transferNote.trim() || 'Demo transfer',
      p_idempotency_key: crypto.randomUUID(),
    })
    setSaving(false)
    if (error) return announce('error', error.message)
    announce('success', 'Demo transfer completed successfully.')
    setTransferAmount(''); setTransferAccount(''); setTransferNote('')
    await loadData()
    setPage('Transactions')
  }

  const addFunds = async (event: FormEvent) => {
    event.preventDefault()
    if (!supabase || !activeAccount) return announce('error', 'Sign in and open an account before adding demo funds.')
    const amount = Number(fundAmount)
    if (!Number.isFinite(amount) || amount < 1 || amount > 10000) return announce('error', 'Enter an amount between $1 and $10,000.')
    setSaving(true)
    const { error } = await supabase.rpc('add_demo_funds', { p_account_id: activeAccount.id, p_amount_minor: Math.round(amount * 100) })
    setSaving(false)
    if (error) return announce('error', error.message)
    announce('success', 'Demo funds added. No real payment was processed.')
    await loadData()
    setPage('Overview')
  }

  const saveProfile = async (event: FormEvent) => {
    event.preventDefault()
    if (!supabase || !session) return
    setSaving(true)
    const { error } = await supabase.from('profiles').update({ full_name: profileDraft.trim() }).eq('id', session.user.id)
    setSaving(false)
    if (error) return announce('error', error.message)
    setProfileName(profileDraft.trim())
    announce('success', 'Profile updated.')
  }

  const signOut = async () => {
    if (!supabase) return announce('info', 'Supabase is not configured yet.')
    const { error } = await supabase.auth.signOut()
    if (error) announce('error', error.message)
    else { setAccounts([]); setEntries([]); setPage('Overview'); announce('success', 'You have signed out.') }
  }

  const go = (next: Page) => { setPage(next); setAccountModalOpen(next === 'Accounts'); setMenuOpen(false); setNotice(null) }

  if (!authReady) return <div className="loading-screen"><LoaderCircle className="spin" size={30} /><p>Connecting securely…</p></div>

  if (!session || authMode === 'update-password') return (
    <div className="auth-shell">
      <section className="auth-brand-panel">
        <a className="brand auth-brand" href="#signin"><span className="brand-mark"><span /></span><span className="brand-name">america<span>online</span><small>PRO</small></span></a>
        <div className="auth-pitch"><span className="section-kicker">YOUR MONEY, IN MOTION</span><h1>Move with<br />confidence<span>.</span></h1><p>A clean, simple place to understand your money. This is a simulation environment — no real money or payments are involved.</p><div className="auth-assurance"><ShieldCheck size={17} /> Private by design. Secured by Supabase.</div></div>
        <div className="auth-panel-foot">© 2026 America Online Pro · Simulation only</div>
      </section>
      <section className="auth-form-panel"><div className="auth-form-wrap">
        <div className="auth-mobile-brand"><span className="brand-mark"><span /></span><strong>america<span>online</span> PRO</strong></div>
        <span className="section-kicker">{authMode === 'signup' ? 'GET STARTED' : authMode === 'reset' || authMode === 'update-password' ? 'ACCOUNT RECOVERY' : 'WELCOME BACK'}</span>
        <h2>{authMode === 'signup' ? 'Create your account' : authMode === 'reset' ? 'Reset your password' : authMode === 'update-password' ? 'Choose a new password' : 'Sign in to your account'}</h2>
        <p className="auth-description">{authMode === 'signup' ? 'Set up your demo banking workspace in a moment.' : authMode === 'reset' ? 'We’ll email you a secure password reset link.' : authMode === 'update-password' ? 'Choose a strong password to secure your account.' : 'Your finances, all in one place.'}</p>
        <form className="auth-form" onSubmit={doAuth}>
          {authMode === 'signup' && <label>Full name<input value={authName} onChange={e => setAuthName(e.target.value)} autoComplete="name" required minLength={2} placeholder="Your full name" /></label>}
          <label>Email address<input type="email" value={authEmail} onChange={e => setAuthEmail(e.target.value)} autoComplete="email" required placeholder="you@example.com" /></label>
          {authMode !== 'reset' && <label>{authMode === 'update-password' ? 'New password' : 'Password'}<input type="password" value={authPassword} onChange={e => setAuthPassword(e.target.value)} autoComplete={authMode === 'signin' ? 'current-password' : 'new-password'} required minLength={authMode === 'signup' || authMode === 'update-password' ? 8 : 1} placeholder={authMode === 'signup' || authMode === 'update-password' ? 'At least 8 characters' : 'Your password'} /></label>}
          {authMode === 'signin' && <button type="button" className="auth-inline-link" onClick={() => setAuthMode('reset')}>Forgot password?</button>}
          <button className="primary-button auth-submit" disabled={saving}>{saving && <LoaderCircle size={16} className="spin" />}{authMode === 'signup' ? 'Create account' : authMode === 'reset' ? 'Send reset link' : authMode === 'update-password' ? 'Update password' : 'Sign in'} <ArrowUpRight size={16} /></button>
        </form>
        {(authMode === 'signin' || authMode === 'signup') && <p className="auth-switch">{authMode === 'signup' ? 'Already registered?' : 'New to America Online Pro?'} <button onClick={() => setAuthMode(authMode === 'signup' ? 'signin' : 'signup')}>{authMode === 'signup' ? 'Sign in' : 'Create an account'}</button></p>}
        {(authMode === 'reset' || authMode === 'update-password') && <button className="auth-inline-link" onClick={() => setAuthMode('signin')}>Back to sign in</button>}
        {!supabase && <p className="config-warning">Supabase is not connected. Configure <code>.env.local</code> to enable authentication and database features.</p>}
      </div></section>
      {notice && <NoticeToast notice={notice} onClose={() => setNotice(null)} />}
    </div>
  )

  const greeting = profileName.split(' ')[0] || 'there'
  return <div className="app-shell">
    <aside className={`sidebar ${menuOpen ? 'sidebar-open' : ''}`}>
      <a className="brand" href="#overview" onClick={e => { e.preventDefault(); go('Overview') }} aria-label="America Online Pro home"><span className="brand-mark"><span /></span><span className="brand-name">america<span>online</span><small>PRO</small></span><button className="icon-button sidebar-close" aria-label="Close navigation" onClick={e => { e.preventDefault(); setMenuOpen(false) }}><X size={19} /></button></a>
      <div className="workspace-label">WORKSPACE</div>
      <nav className="main-nav" aria-label="Main navigation">{navigation.map(({ label, icon: Icon }) => <button key={label} className={`nav-link ${page === label ? 'nav-link-active' : ''}`} onClick={() => go(label)}><Icon size={18} strokeWidth={1.8} /><span>{label}</span>{label === 'Transfer' && <span className="nav-dot" />}</button>)}</nav>
      <div className="sidebar-spacer" />
      <div className="help-card"><div className="help-icon"><CircleHelp size={18} /></div><strong>Need a hand?</strong><p>Browse answers to common questions.</p><button onClick={() => go('Help center')}>Visit help center <ArrowUpRight size={14} /></button></div>
      <nav className="bottom-nav" aria-label="Account navigation"><button className={`nav-link ${page === 'Notifications' ? 'nav-link-active' : ''}`} onClick={() => go('Notifications')}><Bell size={18} /><span>Notifications</span></button><button className="nav-link" onClick={() => void signOut()}><LogOut size={18} /><span>Sign out</span></button></nav>
      <div className="profile-row"><div className="avatar">{profileName.split(' ').map(x => x[0]).join('').slice(0,2).toUpperCase()}</div><div className="profile-copy"><strong>{profileName || 'Customer'}</strong><span>{session.user.email}</span></div><ChevronDown size={16} className="profile-chevron" /></div>
    </aside>
    <main className="main-content">
      <header className="topbar"><button className="icon-button mobile-menu" aria-label="Open navigation" onClick={() => setMenuOpen(true)}><Menu size={21} /></button><div className="breadcrumb"><span>Workspace</span><span className="breadcrumb-slash">/</span><strong>{page}</strong></div><div className="topbar-actions"><label className="search-button search-input"><Search size={17} /><input aria-label="Search transactions" placeholder="Search transactions" value={search} onChange={e => { setSearch(e.target.value); if (e.target.value) setPage('Transactions') }} /><kbd>/</kbd></label><button className="icon-button notification-button" aria-label="Notifications" onClick={() => go('Notifications')}><Bell size={19} /></button><div className="top-avatar">{profileName.split(' ').map(x => x[0]).join('').slice(0,2).toUpperCase()}</div></div></header>
      <div className="page-content">
        {loading && <div className="loading-strip"><LoaderCircle size={14} className="spin" /> Updating account data…</div>}
        {page === 'Overview' && <><div className="welcome-row"><div><div className="eyebrow"><span className="status-pulse" /> YOUR MONEY, IN MOTION</div><h1>Good morning, {greeting}<span className="wave">.</span></h1><p className="page-subtitle">Here’s your financial overview.</p></div><button className="date-button" onClick={() => void loadData()}><RefreshCw size={14} /> Refresh data</button></div>
          <section className="balance-grid"><article className="balance-card"><div className="balance-card-top"><span className="balance-label">TOTAL AVAILABLE BALANCE</span><button className="balance-toggle" onClick={() => setShowBalance(!showBalance)}>{showBalance ? <><EyeOff size={13} /> Hide balance</> : <><Eye size={13} /> Show balance</>}</button></div><div className="balance-amount">{showBalance ? money(totalBalance) : '••••••••'} </div><div className="balance-foot"><span className="balance-account"><Wallet size={15} /> {(activeAccount?.display_name || 'No account yet').replace(/\s*demo\b/ig, '')} {activeAccount ? `···· ${activeAccount.account_number.slice(-4)}` : ''}</span><span className="balance-change"><ShieldCheck size={14} /> Available funds</span></div><div className="balance-decoration decoration-one" /><div className="balance-decoration decoration-two" /></article>
          <article className="quick-card"><div className="quick-card-heading"><div><span className="section-kicker">QUICK ACTIONS</span><h2>Make a move</h2></div><span className="quick-spark"><Sparkles size={17} /></span></div><div className="quick-actions"><button onClick={() => go('Transfer')}><span className="action-icon action-primary"><ArrowUpRight size={19} /></span><span>Send money</span></button><button onClick={() => go('Add funds')}><span className="action-icon"><ArrowDownLeft size={19} /></span><span>Add funds</span></button><button onClick={() => go('Accounts')}><span className="action-icon"><Plus size={19} /></span><span>My account</span></button></div></article></section>
          <div className="section-heading"><div><span className="section-kicker">YOUR OVERVIEW</span><h2>Financial snapshot</h2></div><button className="text-button" onClick={() => go('Analytics')}>View insights <ArrowUpRight size={15} /></button></div>
          <section className="stats-grid"><StatCard title="Money in" value={showBalance ? money(moneyIn) : '••••••'} detail="Total credited" icon={<ArrowDownLeft size={17} />} tone="green" /><StatCard title="Money out" value={showBalance ? money(moneyOut) : '••••••'} detail="Total debited" icon={<ArrowUpRight size={17} />} tone="orange" /><StatCard title="Accounts" value={String(accounts.length)} detail="Total accounts" icon={<Wallet size={17} />} tone="purple" /></section>
          <section className="activity-section"><div className="section-heading activity-heading"><div><span className="section-kicker">THE LATEST</span><h2>Recent activity</h2></div><button className="filter-button" onClick={() => go('Transactions')}>All transactions <ArrowUpRight size={15} /></button></div><TransactionTable entries={filteredEntries.slice(0,5).map(entry => entry.ledger_transactions?.description?.toLowerCase().includes('demo balance') ? { ...entry, ledger_transactions: { ...entry.ledger_transactions, description: 'Opening balance' } } : entry)} onSelect={() => go('Transactions')} /></section></>}

        {page === 'Accounts' && accountModalOpen && <div className="account-modal-backdrop" role="presentation" onClick={event => { if (event.target === event.currentTarget) go('Overview') }}><section className="account-modal" role="dialog" aria-modal="true" aria-labelledby="account-modal-title"><div className="account-modal-header"><div><span className="section-kicker">ACCOUNT DETAILS</span><h1 id="account-modal-title">Receive funds</h1><p>Share your account details to receive a transfer.</p></div><button className="icon-button" aria-label="Close account details" onClick={() => go('Overview')}><X size={19} /></button></div>{activeAccount ? <><div className="account-modal-balance"><span>Available balance</span><strong>{showBalance ? money(activeAccount.balance, activeAccount.currency) : '••••••••'}</strong></div><div className="account-detail-list">{[{label:'Account Number',value:activeAccount.account_number},{label:'Routing Number',value:activeAccount.routing_number || 'Not assigned'},{label:'IBAN',value:activeAccount.iban || 'Not assigned'},{label:'SWIFT/BIC',value:activeAccount.swift_bic || 'Not assigned'}].map(item => <div className="account-detail-row" key={item.label}><div><span>{item.label}</span><strong>{item.value}</strong></div><button className="copy-detail-button" disabled={item.value === 'Not assigned'} aria-label={`Copy ${item.label}`} onClick={() => { void navigator.clipboard.writeText(item.value).then(() => announce('success', `${item.label} copied.`)).catch(() => announce('error', 'Could not copy to clipboard.')) }}><span>{item.value === 'Not assigned' ? 'Unavailable' : 'Copy'}</span><Plus size={14} /></button></div>)}</div><button className="primary-button account-receive-button" onClick={() => go('Add funds')}><ArrowDownLeft size={17} /> Receive funds</button></> : <div className="account-modal-empty"><p>No account details are available yet.</p><button className="secondary-button" onClick={() => { void loadData() }}><RefreshCw size={14} /> Refresh account</button></div>}</section></div>}

        {page === 'Transfer' && <PageHeader kicker="MOVE MONEY" title="Transfer" subtitle="Transfer simulated funds to another America Online Pro demo account."><div className="form-layout"><form className="content-card app-form" onSubmit={sendTransfer}><div className="form-notice"><ShieldCheck size={17} /><span>Demo transfers only. No real bank or payment network is connected.</span></div><label>From account<select required value={activeAccount?.id || ''} disabled={!activeAccount} onChange={() => {}}>{activeAccount ? <option value={activeAccount.id}>{activeAccount.display_name} · {activeAccount.account_number} · {money(activeAccount.balance)}</option> : <option value="">No account available</option>}</select></label><label>Recipient account number<input required value={transferAccount} onChange={e => setTransferAccount(e.target.value)} placeholder="Paste a demo account number" /></label><label>Amount (USD)<div className="currency-input"><span>$</span><input type="number" min="1" step="0.01" required value={transferAmount} onChange={e => setTransferAmount(e.target.value)} placeholder="0.00" /></div></label><label>Description (optional)<input value={transferNote} onChange={e => setTransferNote(e.target.value)} maxLength={120} placeholder="What is this transfer for?" /></label><button className="primary-button" disabled={saving || !activeAccount}>{saving ? <LoaderCircle className="spin" size={16} /> : <ArrowUpRight size={16} />} Review and send transfer</button></form><aside className="content-card side-note"><div className="note-icon"><LockKeyhole size={19} /></div><h3>Built for safer demos</h3><p>Transfers are validated by the database. The server checks account ownership, account status, available balance, and duplicate requests before posting ledger entries.</p><div className="note-divider" /><p><strong>Available balance</strong><br />{activeAccount ? money(activeAccount.balance) : 'No account'}</p></aside></div></PageHeader>}

        {page === 'Add funds' && <PageHeader kicker="DEMO WALLET" title="Add demo funds" subtitle="Increase your simulated balance for testing. This does not charge a card or move real money."><div className="form-layout"><form className="content-card app-form" onSubmit={addFunds}><div className="form-notice"><ShieldCheck size={17} /><span>Simulation only — no payment gateway is involved.</span></div><label>Credit to<select value={activeAccount?.id || ''} disabled><option>{activeAccount ? `${activeAccount.display_name} · ${activeAccount.account_number}` : 'No account available'}</option></select></label><label>Amount (USD)<div className="currency-input"><span>$</span><input type="number" min="1" max="10000" step="1" required value={fundAmount} onChange={e => setFundAmount(e.target.value)} /></div></label><div className="amount-presets">{['100','250','500','1000'].map(value => <button type="button" key={value} className={fundAmount === value ? 'preset-active' : ''} onClick={() => setFundAmount(value)}>${Number(value).toLocaleString('en-US')}</button>)}</div><button className="primary-button" disabled={saving || !activeAccount}>{saving ? <LoaderCircle className="spin" size={16} /> : <Plus size={16} />} Add simulated funds</button></form><aside className="content-card side-note"><div className="note-icon"><Wallet size={19} /></div><h3>Test without risk</h3><p>You can add between $1 and $10,000 per request. The database records every credit in the ledger so your account history stays consistent.</p></aside></div></PageHeader>}

        {page === 'Transactions' && <PageHeader kicker="ACCOUNT ACTIVITY" title="Transactions" subtitle="Search and review posted ledger activity." action={<button className="secondary-button" onClick={() => void loadData()}><RefreshCw size={14} /> Refresh</button>}><div className="content-card transaction-page"><label className="table-search"><Search size={16} /><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Filter by transaction description…" /></label><TransactionTable entries={filteredEntries} onSelect={() => {}} /><p className="table-footnote">Showing {filteredEntries.length} ledger entr{filteredEntries.length === 1 ? 'y' : 'ies'}. Entries are read from your Supabase database.</p></div></PageHeader>}

        {page === 'Loans' && <PageHeader kicker="BORROWING" title="Loans" subtitle="Explore the loan tools planned for this demo workspace. No credit checks or real lending are available."><div className="account-grid"><article className="content-card"><div className="note-icon"><HandCoins size={19} /></div><h3>Personal loan</h3><p className="muted-text">A future demo flow for reviewing a sample loan amount, illustrative repayment schedule, and estimated interest.</p><span className="pill pill-green">Coming soon</span></article><article className="content-card"><div className="note-icon"><ShieldCheck size={19} /></div><h3>Loan eligibility</h3><p className="muted-text">Eligibility checks are not connected. This preview does not submit an application or access credit data.</p><span className="pill pill-green">Preview only</span></article></div></PageHeader>}

        {page === 'Invest' && <PageHeader kicker="WEALTH TOOLS" title="Invest" subtitle="A preview of investment tracking tools for this simulated account. No investments can be purchased here."><div className="account-grid"><article className="content-card"><div className="note-icon"><TrendingUp size={19} /></div><h3>Portfolio overview</h3><p className="muted-text">Portfolio allocation, performance charts, and holdings will appear here when the demo investment module is implemented.</p><span className="pill pill-green">Coming soon</span></article><article className="content-card"><div className="note-icon"><Activity size={19} /></div><h3>Market watchlist</h3><p className="muted-text">A place to follow sample assets and learn about market movements without placing trades.</p><span className="pill pill-green">Preview only</span></article></div></PageHeader>}

        {page === 'Cards' && <PageHeader kicker="PAYMENT TOOLS" title="Demo cards" subtitle="A visual-only card area for the portfolio simulation. No real card details are issued."><div className="cards-layout"><article className="demo-card-visual"><div className="demo-card-top"><span className="brand-name">america<span>online</span><small>PRO</small></span><span className="card-chip" /></div><span className="card-number">•••• &nbsp; •••• &nbsp; •••• &nbsp; 2841</span><div className="demo-card-bottom"><div><small>DEMO CARDHOLDER</small><strong>{profileName.toUpperCase()}</strong></div><div><small>STATUS</small><strong>NOT ISSUED</strong></div><span className="card-network">VISA*</span></div></article><div className="content-card card-explainer"><div className="note-icon"><CreditCard size={19} /></div><h3>Preview only</h3><p>This card is a UI preview. It is not a payment card and cannot be used to make purchases. Card issuance, PANs, CVVs and payment-network integration are intentionally not implemented.</p><button className="secondary-button" onClick={() => go('Help center')}><CircleHelp size={15} /> Learn more</button></div></div></PageHeader>}

        {page === 'Analytics' && <PageHeader kicker="SPENDING INSIGHTS" title="Analytics" subtitle="A live summary calculated from your ledger entries."><section className="stats-grid analytics-stats"><StatCard title="Total credited" value={money(moneyIn)} detail="All positive ledger entries" icon={<ArrowDownLeft size={17} />} tone="green" /><StatCard title="Total debited" value={money(moneyOut)} detail="All negative ledger entries" icon={<ArrowUpRight size={17} />} tone="orange" /><StatCard title="Net movement" value={money(moneyIn-moneyOut)} detail="Credits minus debits" icon={<Activity size={17} />} tone="purple" /></section><div className="content-card analytics-card"><h3>Account activity</h3><p className="muted-text">Credits and debits from your available ledger history.</p><div className="analytics-bars"><div><span>Money in</span><div className="bar-track"><i style={{width: `${Math.max(moneyIn,moneyOut) ? moneyIn/Math.max(moneyIn,moneyOut)*100 : 0}%`}} /></div><strong>{money(moneyIn)}</strong></div><div><span>Money out</span><div className="bar-track debit-bar"><i style={{width: `${Math.max(moneyIn,moneyOut) ? moneyOut/Math.max(moneyIn,moneyOut)*100 : 0}%`}} /></div><strong>{money(moneyOut)}</strong></div></div><p className="table-footnote">Insights use all ledger entries currently returned by the database (up to the latest 100).</p></div></PageHeader>}

        {page === 'Settings' && <PageHeader kicker="PREFERENCES" title="Account settings" subtitle="Update your profile and manage your session."><div className="settings-grid"><form className="content-card app-form" onSubmit={saveProfile}><h3>Personal profile</h3><p className="muted-text">Your name is displayed in the dashboard and account area.</p><label>Full name<input required minLength={2} maxLength={100} value={profileDraft} onChange={e => setProfileDraft(e.target.value)} /></label><label>Email address<input value={session.user.email || ''} readOnly /></label><button className="primary-button" disabled={saving || !profileDraft.trim()}>{saving ? <LoaderCircle size={16} className="spin" /> : <Check size={16} />} Save changes</button></form><div className="content-card settings-security"><div className="note-icon"><ShieldCheck size={19} /></div><h3>Security and session</h3><p className="muted-text">Signed in as {session.user.email}. Supabase manages your authentication session.</p><button className="secondary-button" onClick={() => go('Notifications')}><Bell size={15} /> Notification centre</button><button className="danger-button" onClick={() => void signOut()}><LogOut size={15} /> Sign out of this device</button></div></div></PageHeader>}

        {page === 'Notifications' && <PageHeader kicker="UPDATES" title="Notifications" subtitle="Recent activity and account information."><div className="content-card notifications-list"><div className="notification-item"><span className="notification-item-icon"><ShieldCheck size={17} /></span><div><strong>Demo environment active</strong><p>This account uses simulated funds. No real money is held or transferred.</p><small>Account information</small></div></div>{entries.slice(0,10).map(entry => <div className="notification-item" key={entry.id}><span className="notification-item-icon"><Activity size={17} /></span><div><strong>{entry.ledger_transactions?.description || 'Account activity'}</strong><p>{Number(entry.amount_minor) >= 0 ? 'Credit' : 'Debit'} of {money(Math.abs(Number(entry.amount_minor)), entry.currency)} · {entry.ledger_transactions?.status || 'posted'}</p><small>{dateLabel(entry.created_at)}</small></div><span className="notification-amount">{Number(entry.amount_minor) >= 0 ? '+' : '−'}{money(Math.abs(Number(entry.amount_minor)), entry.currency)}</span></div>)}</div></PageHeader>}

        {page === 'Help center' && <PageHeader kicker="SUPPORT" title="Help center" subtitle="Answers about the America Online Pro simulation."><div className="faq-list">{[{q:'Is this a real bank?',a:'No. America Online Pro is a portfolio simulation. It does not hold deposits, connect to payment networks, or move real money.'},{q:'How do I add funds?',a:'Open Add funds, select one of the preset amounts or enter an amount from $1 to $10,000, then confirm. This creates a simulated ledger credit.'},{q:'How do transfers work?',a:'Transfers are allowed only between demo accounts in this project. The database checks the recipient, source ownership, available balance, and duplicate requests before posting.'},{q:'Why can’t I see my account?',a:'Confirm your email if signup confirmation is enabled, sign in again, and refresh Accounts. New demo accounts are created by a database trigger.'},{q:'Can I use the demo card to pay?',a:'No. The card view is illustrative only. No actual card number, CVV, or payment capability is provided.'}].map(item => <details className="content-card faq-item" key={item.q}><summary>{item.q}<ChevronDown size={16} /></summary><p>{item.a}</p></details>)}<div className="content-card support-contact"><CircleHelp size={20} /><div><strong>Still need help?</strong><p>Contact the project maintainer about bugs or demo issues.</p><a href="mailto:support@america-online-pro.example?subject=America%20Online%20Pro%20support">Prepare support email <ArrowUpRight size={14} /></a></div></div></div></PageHeader>}
        <footer className="page-footer"><span>© 2026 America Online Pro</span>{page !== 'Overview' && <><span className="demo-disclaimer"><ShieldCheck size={14} /> DEMO ENVIRONMENT · NO REAL MONEY</span><span>Built for learning and demonstration.</span></>}</footer>
      </div>
    </main>
    {menuOpen && <button className="mobile-overlay" aria-label="Close navigation overlay" onClick={() => setMenuOpen(false)} />}
    {notice && <NoticeToast notice={notice} onClose={() => setNotice(null)} />}
  </div>
}

function PageHeader({ kicker, title, subtitle, action, children }: { kicker: string; title: string; subtitle: string; action?: ReactNode; children: ReactNode }) {
  return <><div className="subpage-header"><div><span className="section-kicker">{kicker}</span><h1>{title}</h1><p className="page-subtitle">{subtitle}</p></div>{action}</div>{children}</>
}
function StatCard({ title, value, detail, icon, tone }: { title: string; value: string; detail: string; icon: ReactNode; tone: string }) {
  return <article className="stat-card"><div className="stat-top"><span>{title}</span><span className={`stat-icon stat-icon-${tone}`}>{icon}</span></div><div className="stat-value">{value}</div><div className="stat-foot">{detail}</div></article>
}
function TransactionTable({ entries, onSelect }: { entries: Entry[]; onSelect: () => void }) {
  if (!entries.length) return <EmptyState title="No transactions yet" text="Once your account has ledger activity, it will appear here." />
  return <div className="activity-table"><div className="activity-table-head"><span>TRANSACTION</span><span>DATE</span><span>AMOUNT</span><span>STATUS</span></div>{entries.map(entry => { const amount = Number(entry.amount_minor); const description = entry.ledger_transactions?.description || 'Account activity'; return <button type="button" className="activity-row transaction-button-row" key={entry.id} onClick={onSelect}><div className="transaction-name"><span className={`transaction-avatar ${amount >= 0 ? 'credit' : 'debit'}`}>{amount >= 0 ? <ArrowDownLeft size={16} /> : <ArrowUpRight size={16} />}</span><strong>{description}</strong></div><span className="transaction-category">{dateLabel(entry.created_at)}</span><strong className={`transaction-amount ${amount >= 0 ? 'credit' : 'debit'}`}>{amount >= 0 ? '+' : '−'}{money(Math.abs(amount), entry.currency)}</strong><span className="transaction-status"><i /> {entry.ledger_transactions?.status || 'posted'}</span></button> })}</div>
}
function EmptyState({ title, text, action }: { title: string; text: string; action?: ReactNode }) {
  return <div className="empty-state"><span><Wallet size={21} /></span><strong>{title}</strong><p>{text}</p>{action}</div>
}
function NoticeToast({ notice, onClose }: { notice: Notice; onClose: () => void }) {
  return <div role="status" className={`notice-toast notice-${notice.kind}`}><span>{notice.kind === 'success' ? <Check size={17} /> : notice.kind === 'error' ? <X size={17} /> : <Bell size={17} />}</span><p>{notice.text}</p><button aria-label="Dismiss message" onClick={onClose}><X size={15} /></button></div>
}

export default App
