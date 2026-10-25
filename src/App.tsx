import { useCallback, useEffect, useMemo, useState } from 'react'
import type { FormEvent, ReactNode } from 'react'
import {
  Activity, ArrowDownLeft, ArrowLeftRight, ArrowUpRight, Bell, Check, ChevronDown,
  CircleHelp, CreditCard, Eye, EyeOff, LayoutDashboard, LogOut, Menu, Plus, Search, MessageCircle, Send,
  Settings2, ShieldCheck, Sparkles, Wallet, X, LockKeyhole, LoaderCircle, RefreshCw, HandCoins, TrendingUp,
} from 'lucide-react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from './lib/supabase'

type Page = 'Overview' | 'Accounts' | 'Transfer' | 'Cards' | 'Transactions' | 'Loans' | 'Invest' | 'Settings' | 'Analytics' | 'Add funds' | 'Notifications' | 'Help center'
type Account = { id: string; account_number: string; routing_number: string | null; iban: string | null; swift_bic: string | null; display_name: string; currency: string; status: string; is_demo: boolean }
type Entry = { id: string; amount_minor: number; currency: string; created_at: string; account_id: string; ledger_transactions: { description: string; status: string; posted_at: string | null } | null }
type Notice = { kind: 'success' | 'error' | 'info'; text: string }

function displayTransactionDescription(value: string | null | undefined) {
  const description = (value || 'Account activity').trim()
  const normalized = description.toLowerCase()
  if (normalized.includes('demo transfer')) return 'Account transfer'
  if (normalized.includes('demo funds added') || normalized.includes('demo funds')) return 'Funds added'
  if (normalized === 'welcome demo balance' || normalized === 'demo opening balance') return 'Opening balance'
  return description.replace(/\bdemo\b/gi, '').replace(/\s{2,}/g, ' ').trim() || 'Account activity'
}

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
const money = (minor: number, currency = 'USD') => new Intl.NumberFormat('en-US', { style: 'currency', currency, minimumFractionDigits: 2 }).format(minor / 100)
const dateLabel = (value: string) => new Date(value).toLocaleString('en-NG', { dateStyle: 'medium', timeStyle: 'short' })


type MarketQuote = { symbol: string; price: number | null; change: number | null; changePercent: number | null; currency: string | null; marketState: string; quoteTime?: string; error?: string }
type InvestmentHolding = { id: string; symbol: string; quantity: number; average_cost: number; created_at: string }

function InvestPage({ userId }: { userId: string }) {
  const [holdings, setHoldings] = useState<InvestmentHolding[]>([])
  const [quotes, setQuotes] = useState<Record<string, MarketQuote>>({})
  const [symbol, setSymbol] = useState('AAPL')
  const [quantity, setQuantity] = useState('1')
  const [averageCost, setAverageCost] = useState('')
  const [loadingHoldings, setLoadingHoldings] = useState(true)
  const [refreshingQuotes, setRefreshingQuotes] = useState(false)
  const [savingHolding, setSavingHolding] = useState(false)
  const [investMessage, setInvestMessage] = useState('')
  const [lastUpdated, setLastUpdated] = useState<string | null>(null)
  const watchSymbols = ['AAPL', 'MSFT', 'GOOGL', 'AMZN', 'NVDA', 'SPY', 'GLD', 'TLT']
  const allSymbols = [...new Set([...watchSymbols, ...holdings.map(item => item.symbol)])]

  const loadHoldings = useCallback(async () => {
    if (!supabase || !userId) { setHoldings([]); setLoadingHoldings(false); return }
    const { data, error } = await supabase.from('investment_holdings')
      .select('id,symbol,quantity,average_cost,created_at').eq('user_id', userId).order('created_at', { ascending: false })
    if (error) setInvestMessage('Could not load holdings: ' + error.message)
    else setHoldings((data || []) as InvestmentHolding[])
    setLoadingHoldings(false)
  }, [userId])

  const loadQuotes = useCallback(async () => {
    if (!supabase) { setInvestMessage('Supabase is not configured.'); return }
    setRefreshingQuotes(true)
    const { data, error } = await supabase.functions.invoke('market-quotes?symbols=' + encodeURIComponent(allSymbols.join(',')), { method: 'GET' })
    if (error) {
      setInvestMessage('Live quotes unavailable right now. ' + error.message)
    } else {
      const list = (data?.quotes || []) as MarketQuote[]
      setQuotes(Object.fromEntries(list.map(item => [item.symbol, item])))
      setLastUpdated(data?.fetchedAt || new Date().toISOString())
      setInvestMessage('')
    }
    setRefreshingQuotes(false)
  }, [allSymbols.join(',')])

  useEffect(() => { void loadHoldings() }, [loadHoldings])
  useEffect(() => { void loadQuotes(); const timer = window.setInterval(() => void loadQuotes(), 60000); return () => window.clearInterval(timer) }, [loadQuotes])

  const addHolding = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const ticker = symbol.trim().toUpperCase()
    const units = Number(quantity)
    const cost = Number(averageCost)
    if (!/^[A-Z0-9.^=-]{1,15}$/.test(ticker)) { setInvestMessage('Enter a valid ticker symbol.'); return }
    if (!Number.isFinite(units) || units <= 0 || !Number.isFinite(cost) || cost < 0) { setInvestMessage('Enter a positive quantity and a valid average purchase cost.'); return }
    if (!supabase || !userId) { setInvestMessage('Sign in before adding a holding.'); return }
    setSavingHolding(true); setInvestMessage('')
    const { error } = await supabase.from('investment_holdings').upsert(
      { user_id: userId, symbol: ticker, quantity: units, average_cost: cost, updated_at: new Date().toISOString() },
      { onConflict: 'user_id,symbol' },
    )
    setSavingHolding(false)
    if (error) { setInvestMessage('Could not save holding: ' + error.message); return }
    setSymbol('AAPL'); setQuantity('1'); setAverageCost('')
    await loadHoldings(); await loadQuotes()
    setInvestMessage('Holding saved to your account.')
  }

  const removeHolding = async (id: string) => {
    if (!supabase) return
    const { error } = await supabase.from('investment_holdings').delete().eq('id', id).eq('user_id', userId)
    if (error) { setInvestMessage('Could not remove holding: ' + error.message); return }
    await loadHoldings()
  }

  const usd = (value: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 }).format(value)
  const portfolioValue = holdings.reduce((sum, item) => sum + (quotes[item.symbol]?.price ?? 0) * Number(item.quantity), 0)
  const costBasis = holdings.reduce((sum, item) => sum + Number(item.average_cost) * Number(item.quantity), 0)
  const gainLoss = portfolioValue - costBasis

  return <PageHeader kicker="LIVE MARKET DATA" title="Invest" subtitle="Track market quotes and maintain a personal holdings watchlist. Quotes are informational; this app does not execute trades.">
    <div className="invest-live-page">
      
      <section className="invest-live-summary">
        <article className="invest-live-summary-card invest-live-summary-main"><span>ESTIMATED HOLDINGS VALUE</span><strong>{usd(portfolioValue)}</strong><small>Based on latest available quotes for saved holdings</small></article>
        <article className="invest-live-summary-card"><span>RECORDED COST BASIS</span><strong>{usd(costBasis)}</strong><small>Quantity × your average purchase cost</small></article>
        <article className="invest-live-summary-card"><span>UNREALIZED GAIN / LOSS</span><strong className={gainLoss >= 0 ? 'invest-positive' : 'invest-negative'}>{gainLoss >= 0 ? '+' : '−'}{usd(Math.abs(gainLoss))}</strong><small>Estimate only; excludes fees and taxes</small></article>
      </section>
      <div className="invest-live-section-head"><div><span className="section-kicker">MARKET WATCH</span><h2>Live quotes</h2><p>Common US-listed market symbols. Refreshes automatically every 60 seconds.</p></div><button className="secondary-button" onClick={() => void loadQuotes()} disabled={refreshingQuotes}>{refreshingQuotes ? <LoaderCircle size={14} className="spin"/> : <RefreshCw size={14}/>} Refresh quotes</button></div>
      <section className="content-card invest-quotes-card">
        <div className="invest-quotes-table-wrap"><table className="invest-quotes-table"><thead><tr><th>Symbol</th><th>Last price</th><th>Change</th><th>Market status</th><th>Action</th></tr></thead><tbody>{allSymbols.map(ticker => { const quote = quotes[ticker]; return <tr key={ticker}><td><strong>{ticker}</strong><small>{ticker === 'SPY' ? 'S&P 500 ETF' : ticker === 'GLD' ? 'Gold ETF' : ticker === 'TLT' ? 'Treasury bond ETF' : 'US market'}</small></td><td>{quote?.price != null ? usd(quote.price) : '—'}</td><td className={quote?.change != null && quote.change < 0 ? 'invest-negative' : 'invest-positive'}>{quote?.change != null ? (quote.change >= 0 ? '+' : '−') + usd(Math.abs(quote.change)) + (quote.changePercent != null ? ' (' + quote.changePercent.toFixed(2) + '%)' : '') : quote?.error || 'Waiting for quote'}</td><td><span className="invest-market-state">{quote?.marketState || 'Loading'}</span></td><td><button className="invest-watch-action" onClick={() => { setSymbol(ticker); document.getElementById('invest-holding-symbol')?.focus() }}>Track</button></td></tr> })}</tbody></table></div>
        <div className="invest-quotes-footer">{lastUpdated ? 'Last fetched ' + new Date(lastUpdated).toLocaleString() : 'Waiting for market data provider'} · Source: Yahoo Finance</div>
      </section>
      <div className="invest-live-section-head"><div><span className="section-kicker">YOUR PORTFOLIO</span><h2>Holdings tracker</h2><p>Record positions you already own to estimate market value and unrealized performance.</p></div></div>
      <section className="invest-holdings-layout">
        <form className="content-card invest-holding-form" onSubmit={addHolding}><span className="section-kicker">ADD OR UPDATE POSITION</span><label htmlFor="invest-holding-symbol">Ticker symbol</label><input id="invest-holding-symbol" value={symbol} onChange={e => setSymbol(e.target.value.toUpperCase())} required maxLength={15} placeholder="e.g. AAPL"/><label htmlFor="invest-holding-quantity">Quantity / shares</label><input id="invest-holding-quantity" type="number" min="0.00000001" step="any" value={quantity} onChange={e => setQuantity(e.target.value)} required/><label htmlFor="invest-holding-cost">Average purchase price (USD)</label><input id="invest-holding-cost" type="number" min="0" step="0.000001" value={averageCost} onChange={e => setAverageCost(e.target.value)} required placeholder="e.g. 175.50"/><small>Saving an existing symbol updates its quantity and average cost.</small><button className="primary-button" disabled={savingHolding}>{savingHolding ? <LoaderCircle size={15} className="spin"/> : <Plus size={15}/>} Save holding</button>{investMessage && <p className="invest-feedback" role="status">{investMessage}</p>}</form>
        <section className="content-card invest-holdings-card"><div className="invest-holdings-heading"><div><span className="section-kicker">SAVED POSITIONS</span><h3>Your holdings</h3></div><button className="text-button" onClick={() => void loadHoldings()} disabled={loadingHoldings}><RefreshCw size={14}/> Refresh</button></div>{loadingHoldings ? <div className="empty-state"><LoaderCircle className="spin" size={22}/><p>Loading holdings…</p></div> : holdings.length === 0 ? <div className="empty-state"><Wallet size={23}/><strong>No holdings recorded</strong><p>Add a position you already own to calculate its estimated value. This will not buy the asset.</p></div> : <div className="invest-saved-list">{holdings.map(item => { const quote = quotes[item.symbol]; const marketValue = (quote?.price ?? 0) * Number(item.quantity); const basis = Number(item.average_cost) * Number(item.quantity); return <article className="invest-saved-row" key={item.id}><div><strong>{item.symbol}</strong><small>{Number(item.quantity).toLocaleString()} units · Cost {usd(basis)}</small></div><div><strong>{quote?.price != null ? usd(marketValue) : 'Quote pending'}</strong><small className={(marketValue - basis) >= 0 ? 'invest-positive' : 'invest-negative'}>{quote?.price != null ? ((marketValue - basis) >= 0 ? '+' : '−') + usd(Math.abs(marketValue - basis)) : 'Not yet valued'}</small></div><button className="invest-remove-button" aria-label={'Remove ' + item.symbol} onClick={() => void removeHolding(item.id)}><X size={15}/></button></article> })}</div>}</section>
      </section>
      <p className="invest-live-disclaimer"><ShieldCheck size={15}/> Informational market data only, not investment advice. Quotes can be delayed or incorrect. This portfolio tracker does not connect to a broker and cannot place orders, custody assets, or verify ownership of recorded holdings.</p>
    </div>
  </PageHeader>
}

function App() {
  const [page, setPage] = useState<Page>('Overview')
  const [session, setSession] = useState<Session | null>(null)
  const [authReady, setAuthReady] = useState(!supabase)
  const [menuOpen, setMenuOpen] = useState(false)
  const [showBalance, setShowBalance] = useState(true)
  const [showCardDetails, setShowCardDetails] = useState(false)
  const [accountModalOpen, setAccountModalOpen] = useState(false)
  const [accounts, setAccounts] = useState<Account[]>([])
  const [entries, setEntries] = useState<Entry[]>([])
  const [profileName, setProfileName] = useState('')
  const [loading, setLoading] = useState(false)
  const [notice, setNotice] = useState<Notice | null>(null)
  const [search, setSearch] = useState('')
  const [authMode, setAuthMode] = useState<'signin' | 'signup' | 'reset' | 'update-password'>(() => new URLSearchParams(window.location.search).get('mode') === 'signup' ? 'signup' : 'signin')
  const [authEmail, setAuthEmail] = useState('')
  const [authPassword, setAuthPassword] = useState('')
  const [showAuthPassword, setShowAuthPassword] = useState(false)
  const [authName, setAuthName] = useState('')
  const [transferAccount, setTransferAccount] = useState('')
  const [recipientLegalName, setRecipientLegalName] = useState('')
  const [recipientAddress, setRecipientAddress] = useState('')
  const [recipientBankName, setRecipientBankName] = useState('')
  const [recipientSwiftBic, setRecipientSwiftBic] = useState('')
  const [recipientRoutingNumber, setRecipientRoutingNumber] = useState('')
  const [recipientIban, setRecipientIban] = useState('')
  const [recipientBankAddress, setRecipientBankAddress] = useState('')
  const [recipientPhone, setRecipientPhone] = useState('')
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

  useEffect(() => {
    void loadData()
    if (!supabase || !session?.user) return
    const client = supabase
    const channel = client.channel('account-notifications-' + session.user.id)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'ledger_entries' }, () => { void loadData() })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'ledger_transactions' }, () => { void loadData() })
      .subscribe()
    return () => { void client.removeChannel(channel) }
  }, [loadData, session?.user?.id])

  const balances = useMemo(() => accounts.map(account => ({
    ...account,
    balance: entries.filter(entry => entry.account_id === account.id).reduce((sum, entry) => sum + Number(entry.amount_minor), 0),
  })), [accounts, entries])
  const totalBalance = balances.reduce((sum, account) => sum + account.balance, 0)
  const moneyIn = entries.filter(entry => Number(entry.amount_minor) > 0).reduce((sum, entry) => sum + Number(entry.amount_minor), 0)
  const moneyOut = Math.abs(entries.filter(entry => Number(entry.amount_minor) < 0).reduce((sum, entry) => sum + Number(entry.amount_minor), 0))
  const filteredEntries = entries.filter(entry => {
    const description = displayTransactionDescription(entry.ledger_transactions?.description)
    return description.toLowerCase().includes(search.toLowerCase())
  })
  const activeAccount = balances[0]

  const doAuth = async (event: FormEvent) => {
    event.preventDefault()
    if (!supabase) return announce('error', 'Add your Supabase URL and publishable key to .env.local first.')
    setSaving(true)
    let error: { message: string } | null = null
    if (authMode === 'signup') {
      const result = await supabase.auth.signUp({ email: authEmail, password: authPassword, options: { data: { full_name: authName }, emailRedirectTo: window.location.origin + '/app' } })
      error = result.error
      if (!error && !result.data.session) announce('success', 'Account created. Check your email to confirm your address, then sign in.')
    } else if (authMode === 'reset') {
      const result = await supabase.auth.resetPasswordForEmail(authEmail, { redirectTo: window.location.origin + '/app' })
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
      p_description: transferNote.trim() || 'Account transfer',
      p_idempotency_key: crypto.randomUUID(),
    })
    setSaving(false)
    if (error) return announce('error', error.message)
    announce('success', 'Transfer completed successfully.')
    setTransferAmount(''); setTransferAccount(''); setTransferNote(''); setRecipientLegalName(''); setRecipientAddress(''); setRecipientBankName(''); setRecipientSwiftBic(''); setRecipientRoutingNumber(''); setRecipientIban(''); setRecipientBankAddress(''); setRecipientPhone('')
    await loadData()
    setPage('Transactions')
  }

  const addFunds = async (event: FormEvent) => {
    event.preventDefault()
    if (!supabase || !activeAccount) return announce('error', 'Sign in and open an account before adding funds.')
    const amount = Number(fundAmount)
    if (!Number.isFinite(amount) || amount < 1 || amount > 10000) return announce('error', 'Enter an amount between $1 and $10,000.')
    setSaving(true)
    const { error } = await supabase.rpc('add_demo_funds', { p_account_id: activeAccount.id, p_amount_minor: Math.round(amount * 100) })
    setSaving(false)
    if (error) return announce('error', error.message)
    announce('success', 'Funds added successfully.')
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
        <div className="auth-pitch"><span className="section-kicker">YOUR MONEY, IN MOTION</span><h1>Move with<br />confidence<span>.</span></h1><p>A clean, simple place to understand your money. Manage your account with a clear, simple digital banking experience.</p><div className="auth-assurance"><ShieldCheck size={17} /> Private by design. Built with care.</div></div>
        <div className="auth-panel-foot">© 2026 America Online Pro. All rights reserved.</div>
      </section>
      <section className="auth-form-panel"><div className="auth-form-wrap">
        <div className="auth-mobile-brand"><span className="brand-mark"><span /></span><strong>america<span>online</span> PRO</strong></div>
        <span className="section-kicker">{authMode === 'signup' ? 'GET STARTED' : authMode === 'reset' || authMode === 'update-password' ? 'ACCOUNT RECOVERY' : 'WELCOME BACK'}</span>
        <h2>{authMode === 'signup' ? 'Create your account' : authMode === 'reset' ? 'Reset your password' : authMode === 'update-password' ? 'Choose a new password' : 'Sign in to your account'}</h2>
        <p className="auth-description">{authMode === 'signup' ? 'Create your account to get started.' : authMode === 'reset' ? 'We’ll email you a secure password reset link.' : authMode === 'update-password' ? 'Choose a strong password to secure your account.' : 'Your finances, all in one place.'}</p>
        <form className="auth-form" onSubmit={doAuth}>
          {authMode === 'signup' && <label>Full name<input value={authName} onChange={e => setAuthName(e.target.value)} autoComplete="name" required minLength={2} placeholder="Your full name" /></label>}
          <label>Email address<input type="email" value={authEmail} onChange={e => setAuthEmail(e.target.value)} autoComplete="email" required placeholder="you@example.com" /></label>
          {authMode !== 'reset' && <label>{authMode === 'update-password' ? 'New password' : 'Password'}<span className="auth-password-wrap"><input type={showAuthPassword ? 'text' : 'password'} value={authPassword} onChange={e => setAuthPassword(e.target.value)} autoComplete={authMode === 'signin' ? 'current-password' : 'new-password'} required minLength={authMode === 'signup' || authMode === 'update-password' ? 8 : 1} placeholder={authMode === 'signup' || authMode === 'update-password' ? 'At least 8 characters' : 'Your password'} /><button type="button" className="auth-password-toggle" aria-label={showAuthPassword ? 'Hide password' : 'Show password'} onClick={() => setShowAuthPassword(value => !value)}>{showAuthPassword ? <EyeOff size={16} /> : <Eye size={16} />}</button></span></label>}
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
          <section className="activity-section"><div className="section-heading activity-heading"><div><span className="section-kicker">THE LATEST</span><h2>Recent activity</h2></div><button className="filter-button" onClick={() => go('Transactions')}>All transactions <ArrowUpRight size={15} /></button></div><TransactionTable entries={filteredEntries.slice(0,5)} onSelect={() => go('Transactions')} /></section></>}

        {page === 'Accounts' && accountModalOpen && <div className="account-modal-backdrop" role="presentation" onClick={event => { if (event.target === event.currentTarget) go('Overview') }}><section className="account-modal" role="dialog" aria-modal="true" aria-labelledby="account-modal-title"><div className="account-modal-header"><div><span className="section-kicker">ACCOUNT DETAILS</span><h1 id="account-modal-title">Receive funds</h1><p>Share your account details to receive a transfer.</p></div><button className="icon-button" aria-label="Close account details" onClick={() => go('Overview')}><X size={19} /></button></div>{activeAccount ? <><div className="account-modal-balance"><span>Available balance</span><strong>{showBalance ? money(activeAccount.balance, activeAccount.currency) : '••••••••'}</strong></div><div className="account-detail-list">{[{label:'Account Number',value:activeAccount.account_number},{label:'Routing Number',value:activeAccount.routing_number || 'Not assigned'},{label:'IBAN',value:activeAccount.iban || 'Not assigned'},{label:'SWIFT/BIC',value:activeAccount.swift_bic || 'Not assigned'}].map(item => <div className="account-detail-row" key={item.label}><div><span>{item.label}</span><strong>{item.value}</strong></div><button className="copy-detail-button" disabled={item.value === 'Not assigned'} aria-label={`Copy ${item.label}`} onClick={() => { void navigator.clipboard.writeText(item.value).then(() => announce('success', `${item.label} copied.`)).catch(() => announce('error', 'Could not copy to clipboard.')) }}><span>{item.value === 'Not assigned' ? 'Unavailable' : 'Copy'}</span><Plus size={14} /></button></div>)}</div><button className="primary-button account-receive-button" onClick={() => go('Add funds')}><ArrowDownLeft size={17} /> Receive funds</button></> : <div className="account-modal-empty"><p>No account details are available yet.</p><button className="secondary-button" onClick={() => { void loadData() }}><RefreshCw size={14} /> Refresh account</button></div>}</section></div>}

        {page === 'Transfer' && <PageHeader kicker="MOVE MONEY" title="Transfer" subtitle="Transfer funds to another America Online Pro account."><div className="form-layout"><form className="content-card app-form" onSubmit={sendTransfer}><label>From account<select required value={activeAccount?.id || ''} disabled={!activeAccount} onChange={() => {}}>{activeAccount ? <option value={activeAccount.id}>{activeAccount.display_name} · {activeAccount.account_number} · {money(activeAccount.balance)}</option> : <option value="">No account available</option>}</select></label><h3 className="form-section-title">Recipient details</h3><label>Full Legal Name<input required autoComplete="name" value={recipientLegalName} onChange={e => setRecipientLegalName(e.target.value)} maxLength={120} placeholder="Recipient's full legal name" /></label><label>Full Address<input required autoComplete="street-address" value={recipientAddress} onChange={e => setRecipientAddress(e.target.value)} maxLength={240} placeholder="Street, city, state/province, postal code, country" /></label><label>Bank Name<input required value={recipientBankName} onChange={e => setRecipientBankName(e.target.value)} maxLength={120} placeholder="Recipient's bank name" /></label><label>Account Number<input required autoComplete="off" value={transferAccount} onChange={e => setTransferAccount(e.target.value)} maxLength={64} placeholder="Enter recipient account number" /></label><label>SWIFT/BIC Code (optional)<input value={recipientSwiftBic} onChange={e => setRecipientSwiftBic(e.target.value.toUpperCase())} maxLength={20} placeholder="e.g. ABCDUS33" /></label><label>Routing Number / ABA (optional)<input inputMode="numeric" value={recipientRoutingNumber} onChange={e => setRecipientRoutingNumber(e.target.value)} maxLength={20} placeholder="Bank routing number" /></label><label>IBAN (optional)<input autoComplete="off" value={recipientIban} onChange={e => setRecipientIban(e.target.value.toUpperCase().replace(/\\s/g, ''))} maxLength={34} placeholder="International bank account number" /></label><label>Bank Address<input required value={recipientBankAddress} onChange={e => setRecipientBankAddress(e.target.value)} maxLength={240} placeholder="Bank branch address" /></label><label>Phone Number<input required type="tel" autoComplete="tel" value={recipientPhone} onChange={e => setRecipientPhone(e.target.value)} maxLength={32} placeholder="Recipient's contact number" /></label><label>Reason for transfer (optional)<input value={transferNote} onChange={e => setTransferNote(e.target.value)} maxLength={120} placeholder="Purpose of this transfer" /></label><label>Amount (USD)<div className="currency-input"><span>$</span><input type="number" min="1" step="0.01" required value={transferAmount} onChange={e => setTransferAmount(e.target.value)} placeholder="0.00" /></div></label><button className="primary-button" disabled={saving || !activeAccount}>{saving ? <LoaderCircle className="spin" size={16} /> : <ArrowUpRight size={16} />} Review and send transfer</button></form><aside className="content-card side-note"><div className="note-icon"><LockKeyhole size={19} /></div><h3>Transfer security</h3><p>The current database transfer service validates the source account, recipient account number, available balance, and duplicate requests. Bank name, routing, SWIFT/BIC and IBAN details do not initiate an external wire transfer.</p><div className="note-divider" /><p><strong>Available balance</strong><br />{activeAccount ? money(activeAccount.balance) : 'No account'}</p></aside></div></PageHeader>}

        {page === 'Add funds' && <PageHeader kicker="ACCOUNT SERVICES" title="Add funds" subtitle="Add funds to your account balance."><div className="form-layout"><form className="content-card app-form" onSubmit={addFunds}><div className="form-notice"><ShieldCheck size={17} /><span>Funds are credited according to the platform’s account rules.</span></div><label>Credit to<select value={activeAccount?.id || ''} disabled><option>{activeAccount ? `${activeAccount.display_name} · ${activeAccount.account_number}` : 'No account available'}</option></select></label><label>Amount (USD)<div className="currency-input"><span>$</span><input type="number" min="1" max="10000" step="1" required value={fundAmount} onChange={e => setFundAmount(e.target.value)} /></div></label><div className="amount-presets">{['100','250','500','1000'].map(value => <button type="button" key={value} className={fundAmount === value ? 'preset-active' : ''} onClick={() => setFundAmount(value)}>${Number(value).toLocaleString('en-US')}</button>)}</div><button className="primary-button" disabled={saving || !activeAccount}>{saving ? <LoaderCircle className="spin" size={16} /> : <Plus size={16} />} Add funds</button></form><aside className="content-card side-note"><div className="note-icon"><Wallet size={19} /></div><h3>Account information</h3><p>You can add between $1 and $10,000 per request. The database records every credit in the ledger so your account history stays consistent.</p></aside></div></PageHeader>}

        {page === 'Transactions' && <PageHeader kicker="ACCOUNT ACTIVITY" title="Transactions" subtitle="Search and review posted ledger activity." action={<button className="secondary-button" onClick={() => void loadData()}><RefreshCw size={14} /> Refresh</button>}><div className="content-card transaction-page"><label className="table-search"><Search size={16} /><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Filter by transaction description…" /></label><TransactionTable entries={filteredEntries} onSelect={() => {}} /><p className="table-footnote">Showing {filteredEntries.length} ledger entr{filteredEntries.length === 1 ? 'y' : 'ies'}. Your account activity and transaction history.</p></div></PageHeader>}

        {page === 'Loans' && <LoansPage userId={session?.user.id || ''} />}

        {page === 'Invest' && <InvestPage userId={session.user.id} />}

        {page === 'Cards' && <PageHeader kicker="PAYMENT TOOLS" title="Cards" subtitle="View your profile and linked account details in one place."><div className="cards-layout"><div className="cards-primary-column"><article className="demo-card-visual account-linked-card"><div className="demo-card-top"><span className="brand-name">america<span>online</span><small>PRO</small></span><span className="card-chip" /></div><div className="linked-card-account"><small>LINKED ACCOUNT</small><strong>{showCardDetails ? (activeAccount?.account_number || 'No account linked') : activeAccount ? `•••• •••• •••• ${activeAccount.account_number.slice(-4)}` : 'No account linked'}</strong></div><div className="demo-card-bottom"><div><small>ACCOUNT HOLDER</small><strong>{profileName.toUpperCase()}</strong></div><div><small>ACCOUNT STATUS</small><strong>{(activeAccount?.status || 'UNAVAILABLE').toUpperCase()}</strong></div><span className="card-network">{activeAccount?.currency || '—'}</span></div></article><div className="card-controls"><button className="secondary-button" onClick={() => setShowCardDetails(value => !value)}>{showCardDetails ? <EyeOff size={15} /> : <Eye size={15} />}{showCardDetails ? 'Hide details' : 'Show details'}</button><button className="secondary-button" disabled={!activeAccount?.account_number} onClick={() => { if (!activeAccount?.account_number) return; void navigator.clipboard.writeText(activeAccount.account_number).then(() => announce('success', 'Linked account number copied.')).catch(() => announce('error', 'Could not copy account number.')) }}><Check size={15} /> Copy account number</button></div><section className="content-card card-details-panel"><div className="card-details-heading"><div><span className="section-kicker">ACCOUNT INFORMATION</span><h3>Linked account details</h3></div><span className={`pill ${activeAccount?.status === 'active' ? 'pill-green' : ''}`}>{activeAccount?.status || 'No account'}</span></div>{[{label:'Full name',value:profileName || 'Not provided'},{label:'Email address',value:session.user.email || 'Not provided'},{label:'Account name',value:activeAccount?.display_name?.replace(/\s*demo\b/ig, '') || 'No account linked'},{label:'Account number',value:activeAccount ? (showCardDetails ? activeAccount.account_number : `••••••••${activeAccount.account_number.slice(-4)}`) : 'No account linked'},{label:'Currency',value:activeAccount?.currency || 'Not assigned'}].map(item => <div className="card-detail-row" key={item.label}><span>{item.label}</span><strong>{item.value}</strong></div>)}</section></div><div className="content-card card-explainer"><div className="note-icon"><CreditCard size={19} /></div><h3>Card preview</h3><p>Your profile and linked account details are shown here for convenience. This is a card preview, not an issued payment card. No real card number, CVV or payment capability exists.</p><div className="form-notice"><ShieldCheck size={17} /><span>Account details are shown only to the signed-in user. Use Show details to reveal or hide the linked account number.</span></div><button className="secondary-button" onClick={() => go('Accounts')}><Wallet size={15} /> View account details</button><button className="secondary-button card-help-button" onClick={() => go('Help center')}><CircleHelp size={15} /> Learn more</button></div></div></PageHeader>}

        {page === 'Analytics' && <PageHeader kicker="SPENDING INSIGHTS" title="Analytics" subtitle="A live summary calculated from your ledger entries."><section className="stats-grid analytics-stats"><StatCard title="Total credited" value={money(moneyIn)} detail="All positive ledger entries" icon={<ArrowDownLeft size={17} />} tone="green" /><StatCard title="Total debited" value={money(moneyOut)} detail="All negative ledger entries" icon={<ArrowUpRight size={17} />} tone="orange" /><StatCard title="Net movement" value={money(moneyIn-moneyOut)} detail="Credits minus debits" icon={<Activity size={17} />} tone="purple" /></section><div className="content-card analytics-card"><h3>Account activity</h3><p className="muted-text">Credits and debits from your available ledger history.</p><div className="analytics-bars"><div><span>Money in</span><div className="bar-track"><i style={{width: `${Math.max(moneyIn,moneyOut) ? moneyIn/Math.max(moneyIn,moneyOut)*100 : 0}%`}} /></div><strong>{money(moneyIn)}</strong></div><div><span>Money out</span><div className="bar-track debit-bar"><i style={{width: `${Math.max(moneyIn,moneyOut) ? moneyOut/Math.max(moneyIn,moneyOut)*100 : 0}%`}} /></div><strong>{money(moneyOut)}</strong></div></div><p className="table-footnote">Insights use all ledger entries currently returned by the database (up to the latest 100).</p></div></PageHeader>}

        {page === 'Settings' && <PageHeader kicker="PREFERENCES" title="Account settings" subtitle="Update your profile and manage your session."><div className="settings-grid"><form className="content-card app-form" onSubmit={saveProfile}><h3>Personal profile</h3><p className="muted-text">Your name is displayed in the dashboard and account area.</p><label>Full name<input required minLength={2} maxLength={100} value={profileDraft} onChange={e => setProfileDraft(e.target.value)} /></label><label>Email address<input value={session.user.email || ''} readOnly /></label><button className="primary-button" disabled={saving || !profileDraft.trim()}>{saving ? <LoaderCircle size={16} className="spin" /> : <Check size={16} />} Save changes</button></form><div className="content-card settings-security"><div className="note-icon"><ShieldCheck size={19} /></div><h3>Security and session</h3><p className="muted-text">Signed in as {session.user.email}. Your sign-in session is securely managed by the application.</p><button className="secondary-button" onClick={() => go('Notifications')}><Bell size={15} /> Notification centre</button><button className="danger-button" onClick={() => void signOut()}><LogOut size={15} /> Sign out of this device</button></div></div></PageHeader>}

        {page === 'Notifications' && <PageHeader kicker="UPDATES" title="Notifications" subtitle="Recent activity and account information."><div className="content-card notifications-list"><div className="notification-item"><span className="notification-item-icon"><ShieldCheck size={17} /></span><div><strong>Account services active</strong><p>This account uses simulated funds. No real money is held or transferred.</p><small>Account information</small></div></div>{entries.slice(0,10).map(entry => <div className="notification-item" key={entry.id}><span className="notification-item-icon"><Activity size={17} /></span><div><strong>{displayTransactionDescription(entry.ledger_transactions?.description)}</strong><p>{Number(entry.amount_minor) >= 0 ? 'Credit' : 'Debit'} of {money(Math.abs(Number(entry.amount_minor)), entry.currency)} · {entry.ledger_transactions?.status || 'posted'}</p><small>{dateLabel(entry.created_at)}</small></div><span className="notification-amount">{Number(entry.amount_minor) >= 0 ? '+' : '−'}{money(Math.abs(Number(entry.amount_minor)), entry.currency)}</span></div>)}</div></PageHeader>}

        {page === 'Help center' && <PageHeader kicker="SUPPORT" title="Help center" subtitle="Answers about the America Online Pro simulation."><div className="faq-list">{[{q:'Is this a real bank?',a:'No. America Online Pro is a portfolio simulation. It does not hold deposits, connect to payment networks, or move real money.'},{q:'How do I add funds?',a:'Open Add funds, select one of the preset amounts or enter an amount from $1 to $10,000, then confirm. This creates a simulated ledger credit.'},{q:'How do transfers work?',a:'Transfers are allowed only between accounts in this project. The database checks the recipient, source ownership, available balance, and duplicate requests before posting.'},{q:'Why can’t I see my account?',a:'Confirm your email if signup confirmation is enabled, sign in again, and refresh Accounts. New accounts are created automatically.'},{q:'Can I use the demo card to pay?',a:'No. The card view is illustrative only. No actual card number, CVV, or payment capability is provided.'}].map(item => <details className="content-card faq-item" key={item.q}><summary>{item.q}<ChevronDown size={16} /></summary><p>{item.a}</p></details>)}<div className="content-card support-contact"><CircleHelp size={20} /><div><strong>Still need help?</strong><p>Contact the project maintainer about bugs or account issues.</p><a href="mailto:support@america-online-pro.example?subject=America%20Online%20Pro%20support">Prepare support email <ArrowUpRight size={14} /></a></div></div></div></PageHeader>}
        <footer className="page-footer"><span>© 2026 America Online Pro</span>{page !== 'Overview' && <><span></span></>}</footer>
      </div>
    </main>
    {menuOpen && <button className="mobile-overlay" aria-label="Close navigation overlay" onClick={() => setMenuOpen(false)} />}
    {session?.user && <SupportChatWidget userId={session.user.id} />}
    {notice && <NoticeToast notice={notice} onClose={() => setNotice(null)} />}
  </div>
}


type SupportMessage = { id: string; conversation_id: string; sender_id: string; body: string; created_at: string }
type SupportConversation = { id: string; user_id: string; subject: string; status: 'open' | 'pending' | 'closed'; created_at: string; updated_at: string }

function SupportChatWidget({ userId }: { userId: string }) {
  const [open, setOpen] = useState(false)
  const [conversation, setConversation] = useState<SupportConversation | null>(null)
  const [messages, setMessages] = useState<SupportMessage[]>([])
  const [draft, setDraft] = useState('')
  const [loadingChat, setLoadingChat] = useState(false)
  const [sending, setSending] = useState(false)
  const [chatError, setChatError] = useState('')

  const loadChat = useCallback(async (createIfMissing = false) => {
    if (!supabase || !userId) return
    setLoadingChat(true)
    let { data: rows, error } = await supabase.from('support_conversations').select('id,user_id,subject,status,created_at,updated_at').eq('user_id', userId).neq('status', 'closed').order('updated_at', { ascending: false }).limit(1)
    if (error) { setChatError(error.message); setLoadingChat(false); return }
    let found = (rows || [])[0] as SupportConversation | undefined
    if (!found && createIfMissing) {
      const created = await supabase.from('support_conversations').insert({ user_id: userId, subject: 'Customer support' }).select('id,user_id,subject,status,created_at,updated_at').single()
      if (created.error) { setChatError(created.error.message); setLoadingChat(false); return }
      found = created.data as SupportConversation
    }
    setConversation(found || null)
    if (found) {
      const result = await supabase.from('support_messages').select('id,conversation_id,sender_id,body,created_at').eq('conversation_id', found.id).order('created_at', { ascending: true }).limit(200)
      if (result.error) setChatError(result.error.message)
      else { setMessages((result.data || []) as SupportMessage[]); setChatError('') }
    } else setMessages([])
    setLoadingChat(false)
  }, [userId])

  useEffect(() => {
    if (!open || !supabase) return
    void loadChat(true)
    const channel = supabase.channel('customer-support-chat-' + userId)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'support_messages' }, payload => {
        const changed = payload.new as Partial<SupportMessage>
        if (!changed.conversation_id || changed.conversation_id === conversation?.id) void loadChat(false)
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'support_conversations', filter: 'user_id=eq.' + userId }, () => { void loadChat(false) })
      .subscribe()
    return () => { void supabase.removeChannel(channel) }
  }, [open, loadChat, userId, conversation?.id])

  const startNewChat = async () => {
    if (!supabase || !userId || loadingChat || sending) return
    setLoadingChat(true); setChatError('')
    const { data, error } = await supabase.from('support_conversations')
      .insert({ user_id: userId, subject: 'Customer support' })
      .select('id,user_id,subject,status,created_at,updated_at').single()
    if (error) {
      setChatError(error.message)
    } else {
      setConversation(data as SupportConversation)
      setMessages([])
      setDraft('')
    }
    setLoadingChat(false)
  }

  const sendMessage = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const body = draft.trim()
    if (!supabase || !conversation || !body || sending) return
    setSending(true); setChatError('')
    const { error } = await supabase.from('support_messages').insert({ conversation_id: conversation.id, sender_id: userId, body })
    if (error) setChatError(error.message)
    else { setDraft(''); await supabase.from('support_conversations').update({ updated_at: new Date().toISOString(), status: 'open' }).eq('id', conversation.id); await loadChat(false) }
    setSending(false)
  }

  return <div className="support-chat-widget">
    {open && <section className="support-chat-panel" aria-label="Customer support chat"><header className="support-chat-header"><span className="support-chat-mark"><MessageCircle size={19}/></span><div><strong>Customer support</strong><small><i/> Chat with our team</small></div><button type="button" className="support-chat-new" onClick={() => void startNewChat()} disabled={loadingChat || sending}><Plus size={14}/> New chat</button><button type="button" aria-label="Close support chat" onClick={() => setOpen(false)}><X size={18}/></button></header>
      <div className="support-chat-messages">{loadingChat && !messages.length ? <p className="support-chat-empty">Connecting to support…</p> : !messages.length ? <><p className="support-chat-empty">Hi! Choose a quick question or write your own message. Our team will reply here.</p><div className="support-chat-quick-actions"><span>QUICK QUESTIONS</span>{['I need help with a transfer','I have a question about my account','I need help with a card','I have a question about a loan','I want to report a problem'].map(question => <button key={question} type="button" onClick={() => setDraft(question)}>{question}<ChevronDown size={13}/></button>)}</div></> : messages.map(message => <div key={message.id} className={'support-chat-bubble ' + (message.sender_id === userId ? 'mine' : 'theirs')}><p>{message.body}</p><small>{new Date(message.created_at).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}</small></div>)}{chatError && <p className="support-chat-error">{chatError}</p>}</div>
      <form className="support-chat-compose" onSubmit={sendMessage}><textarea value={draft} onChange={e => setDraft(e.target.value)} maxLength={4000} rows={2} placeholder="Write your message…" aria-label="Message to support" required/><button type="submit" disabled={sending || !draft.trim() || !conversation} aria-label="Send message">{sending ? <LoaderCircle size={17} className="spin"/> : <Send size={17}/>}</button></form>
    </section>}
    <button className="support-chat-launcher" type="button" onClick={() => setOpen(value => !value)} aria-label={open ? 'Close support chat' : 'Contact customer support'}><span>{open ? <X size={22}/> : <MessageCircle size={22}/>}</span>{!open && <span className="support-chat-launcher-label">Need help?</span>}</button>
  </div>
}


type LoanApplication = {
  id: string
  amount: number
  term_months: number
  annual_rate: number
  purpose: string
  employment_status: string
  monthly_income: number
  status: 'submitted' | 'under_review' | 'declined' | 'closed'
  created_at: string
}

function LoansPage({ userId }: { userId: string }) {
  const [amount, setAmount] = useState(5000)
  const [term, setTerm] = useState(24)
  const [rate, setRate] = useState(10)
  const [purpose, setPurpose] = useState('Personal expenses')
  const [employment, setEmployment] = useState('Employed')
  const [monthlyIncome, setMonthlyIncome] = useState('')
  const [applications, setApplications] = useState<LoanApplication[]>([])
  const [showForm, setShowForm] = useState(false)
  const [feedback, setFeedback] = useState('')
  const [loadingApplications, setLoadingApplications] = useState(true)
  const [savingApplication, setSavingApplication] = useState(false)

  const loadApplications = useCallback(async () => {
    if (!supabase || !userId) {
      setApplications([])
      setLoadingApplications(false)
      setFeedback('Sign in with a configured account to access loan applications.')
      return
    }

    setLoadingApplications(true)
    const { data, error } = await supabase
      .from('loan_applications')
      .select('id,amount,term_months,annual_rate,purpose,employment_status,monthly_income,status,created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })

    if (error) {
      setFeedback(`Could not load applications: ${error.message}`)
    } else {
      setApplications((data || []) as LoanApplication[])
      setFeedback('')
    }
    setLoadingApplications(false)
  }, [userId])

  useEffect(() => {
    void loadApplications()
  }, [loadApplications])

  const monthlyRate = rate / 1200
  const monthlyPayment = monthlyRate === 0
    ? amount / term
    : amount * monthlyRate / (1 - Math.pow(1 + monthlyRate, -term))
  const totalRepayment = monthlyPayment * term
  const totalInterest = Math.max(0, totalRepayment - amount)

  const formatUsd = (value: number) =>
    new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 2,
    }).format(value)

  const statusLabel = (status: LoanApplication['status']) => ({
    submitted: 'Submitted',
    under_review: 'Under review',
    declined: 'Declined',
    closed: 'Closed',
  })[status] || status

  const submitApplication = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!supabase || !userId) {
      setFeedback('Please sign in before submitting an application.')
      return
    }

    const income = Number(monthlyIncome)
    if (!Number.isFinite(income) || income <= 0) {
      setFeedback('Enter a valid monthly income greater than zero.')
      return
    }

    setSavingApplication(true)
    setFeedback('')

    const { error } = await supabase.from('loan_applications').insert({
      user_id: userId,
      amount,
      term_months: term,
      annual_rate: rate,
      purpose,
      employment_status: employment,
      monthly_income: income,
    })

    setSavingApplication(false)

    if (error) {
      setFeedback(`Application could not be saved: ${error.message}`)
      return
    }

    setShowForm(false)
    setMonthlyIncome('')
    setFeedback('Your application has been saved.')
    await loadApplications()
  }

  return (
    <PageHeader
      kicker="LENDING SERVICES"
      title="Loans & repayments"
      subtitle="Calculate potential repayments, submit an application, and track your application history."
      action={<button className="secondary-button" onClick={() => void loadApplications()} disabled={loadingApplications}><RefreshCw size={14} /> Refresh</button>}
    >
      <div className="loan-disclosure">
        <ShieldCheck size={18} />
        <div>
          <strong>Application information</strong>
          <p>Repayments are estimates, not loan offers. This platform does not perform credit checks, issue lending decisions, or disburse funds.</p>
        </div>
      </div>

      <section className="loan-summary-grid">
        <article className="loan-summary-card loan-summary-featured">
          <span>ESTIMATED MONTHLY PAYMENT</span>
          <strong>{formatUsd(monthlyPayment)}</strong>
          <small>{term} monthly payments · {rate}% annual rate used for this estimate</small>
        </article>
        <article className="loan-summary-card">
          <span>REQUESTED AMOUNT</span>
          <strong>{formatUsd(amount)}</strong>
          <small>Adjust the amount in the calculator</small>
        </article>
        <article className="loan-summary-card">
          <span>YOUR APPLICATIONS</span>
          <strong>{applications.length}</strong>
          <small>Records retrieved from your account</small>
        </article>
      </section>

      <div className="loan-main-grid">
        <section className="content-card loan-calculator">
          <div className="loan-section-heading">
            <div>
              <span className="section-kicker">PLAN AHEAD</span>
              <h2>Loan calculator</h2>
              <p>Adjust the amount, term, and annual rate to estimate repayments.</p>
            </div>
            <span className="loan-icon"><HandCoins size={20} /></span>
          </div>

          <div className="loan-control">
            <div className="loan-control-heading">
              <label htmlFor="loan-amount">Requested amount</label>
              <strong>{formatUsd(amount)}</strong>
            </div>
            <input id="loan-amount" className="loan-range" type="range" min="500" max="25000" step="500" value={amount} onChange={event => setAmount(Number(event.target.value))} />
            <div className="loan-range-labels"><span>$500</span><span>$25,000</span></div>
          </div>

          <div className="loan-control">
            <label htmlFor="loan-term">Repayment term</label>
            <select id="loan-term" value={term} onChange={event => setTerm(Number(event.target.value))}>
              <option value={12}>12 months</option>
              <option value={24}>24 months</option>
              <option value={36}>36 months</option>
              <option value={48}>48 months</option>
            </select>
          </div>

          <div className="loan-control">
            <div className="loan-control-heading">
              <label htmlFor="loan-rate">Annual interest rate used for estimate</label>
              <strong>{rate}%</strong>
            </div>
            <input id="loan-rate" className="loan-range" type="range" min="0" max="30" step="1" value={rate} onChange={event => setRate(Number(event.target.value))} />
            <div className="loan-range-labels"><span>0%</span><span>30%</span></div>
          </div>

          <div className="loan-results">
            <span>Estimated monthly repayment</span>
            <strong>{formatUsd(monthlyPayment)}</strong>
            <div><span>Total repayment</span><b>{formatUsd(totalRepayment)}</b></div>
            <div><span>Estimated interest</span><b>{formatUsd(totalInterest)}</b></div>
            <small>Calculator results are estimates and are not a loan offer.</small>
          </div>

          <button className="primary-button loan-apply-button" onClick={() => { setShowForm(value => !value); setFeedback('') }}>
            <HandCoins size={16} />
            {showForm ? 'Close application form' : 'Start an application'}
          </button>
        </section>

        <aside className="content-card loan-side-panel">
          <div className="loan-side-icon"><Activity size={20} /></div>
          <span className="section-kicker">APPLICATION TRACKER</span>
          <h2>Track your progress</h2>
          <p>View the latest status saved for each application.</p>
          <div className="loan-status-steps">
            <div><span>1</span><p><strong>Submitted</strong><small>Application received</small></p></div>
            <div><span>2</span><p><strong>Under review</strong><small>Status depends on authorised updates</small></p></div>
            <div><span>3</span><p><strong>Final status</strong><small>Check your application record</small></p></div>
          </div>
        </aside>
      </div>

      {showForm && (
        <section className="content-card loan-application-card">
          <div className="loan-section-heading">
            <div>
              <span className="section-kicker">APPLICATION FORM</span>
              <h2>Application details</h2>
              <p>Submit your details to save an application to your account.</p>
            </div>
          </div>
          <form className="app-form loan-form" onSubmit={submitApplication}>
            <div className="loan-form-grid">
              <label>Loan purpose
                <select value={purpose} onChange={event => setPurpose(event.target.value)}>
                  <option>Personal expenses</option>
                  <option>Education</option>
                  <option>Home improvement</option>
                  <option>Vehicle expenses</option>
                  <option>Debt consolidation</option>
                  <option>Other</option>
                </select>
              </label>
              <label>Employment status
                <select value={employment} onChange={event => setEmployment(event.target.value)}>
                  <option>Employed</option>
                  <option>Self-employed</option>
                  <option>Student</option>
                  <option>Unemployed</option>
                  <option>Other</option>
                </select>
              </label>
              <label>Monthly income (USD)
                <div className="currency-input"><span>$</span><input type="number" min="0.01" step="0.01" required value={monthlyIncome} onChange={event => setMonthlyIncome(event.target.value)} placeholder="e.g. 3500" /></div>
              </label>
              <label>Requested loan amount
                <input value={formatUsd(amount)} readOnly />
              </label>
            </div>
            <div className="form-notice">
              <ShieldCheck size={17} />
              <span>Your application details are saved to your signed-in account. Submission does not constitute approval or a commitment to lend.</span>
            </div>
            <button className="primary-button" type="submit" disabled={savingApplication || !supabase || !userId}>
              {savingApplication ? <LoaderCircle size={16} className="spin" /> : <Check size={16} />}
              {savingApplication ? 'Submitting…' : 'Submit application'}
            </button>
          </form>
        </section>
      )}

      {feedback && <div className="loan-feedback" role="status">{feedback}</div>}

      <section className="loan-history-section">
        <div className="section-heading loan-history-heading">
          <div><span className="section-kicker">APPLICATION ACTIVITY</span><h2>Loan history</h2></div>
          <span className="loan-history-count">{applications.length} {applications.length === 1 ? 'application' : 'applications'}</span>
        </div>

        {loadingApplications ? (
          <div className="content-card loan-empty-state"><LoaderCircle size={22} className="spin" /><p>Loading your applications…</p></div>
        ) : applications.length === 0 ? (
          <div className="content-card loan-empty-state">
            <span className="loan-icon"><HandCoins size={22} /></span>
            <strong>No applications yet</strong>
            <p>Your submitted applications will appear here.</p>
            <button className="secondary-button" onClick={() => setShowForm(true)}>Start an application</button>
          </div>
        ) : (
          <div className="content-card loan-history-list">
            {applications.map(application => (
              <article className="loan-history-row" key={application.id}>
                <span className="loan-history-icon"><HandCoins size={18} /></span>
                <div className="loan-history-details">
                  <strong>{application.purpose}</strong>
                  <span>{application.id.slice(0, 8).toUpperCase()} · {new Date(application.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}</span>
                  <small>{application.term_months} months · {application.annual_rate}% annual rate</small>
                </div>
                <strong className="loan-history-amount">{formatUsd(Number(application.amount))}</strong>
                <span className="loan-history-status">{statusLabel(application.status)}</span>
              </article>
            ))}
          </div>
        )}
      </section>
    </PageHeader>
  )
}

function PageHeader({ kicker, title, subtitle, action, children }: { kicker: string; title: string; subtitle: string; action?: ReactNode; children: ReactNode }) {
  return <><div className="subpage-header"><div><span className="section-kicker">{kicker}</span><h1>{title}</h1><p className="page-subtitle">{subtitle}</p></div>{action}</div>{children}</>
}
function StatCard({ title, value, detail, icon, tone }: { title: string; value: string; detail: string; icon: ReactNode; tone: string }) {
  return <article className="stat-card"><div className="stat-top"><span>{title}</span><span className={`stat-icon stat-icon-${tone}`}>{icon}</span></div><div className="stat-value">{value}</div><div className="stat-foot">{detail}</div></article>
}
function TransactionTable({ entries, onSelect }: { entries: Entry[]; onSelect: () => void }) {
  if (!entries.length) return <EmptyState title="No transactions yet" text="Once your account has ledger activity, it will appear here." />
  return <div className="activity-table"><div className="activity-table-head"><span>TRANSACTION</span><span>DATE</span><span>AMOUNT</span><span>STATUS</span></div>{entries.map(entry => { const amount = Number(entry.amount_minor); const description = displayTransactionDescription(entry.ledger_transactions?.description); return <button type="button" className="activity-row transaction-button-row" key={entry.id} onClick={onSelect}><div className="transaction-name"><span className={`transaction-avatar ${amount >= 0 ? 'credit' : 'debit'}`}>{amount >= 0 ? <ArrowDownLeft size={16} /> : <ArrowUpRight size={16} />}</span><strong>{description}</strong></div><span className="transaction-category">{dateLabel(entry.created_at)}</span><strong className={`transaction-amount ${amount >= 0 ? 'credit' : 'debit'}`}>{amount >= 0 ? '+' : '−'}{money(Math.abs(amount), entry.currency)}</strong><span className="transaction-status"><i /> {entry.ledger_transactions?.status || 'posted'}</span></button> })}</div>
}
function EmptyState({ title, text, action }: { title: string; text: string; action?: ReactNode }) {
  return <div className="empty-state"><span><Wallet size={21} /></span><strong>{title}</strong><p>{text}</p>{action}</div>
}
function NoticeToast({ notice, onClose }: { notice: Notice; onClose: () => void }) {
  return <div role="status" className={`notice-toast notice-${notice.kind}`}><span>{notice.kind === 'success' ? <Check size={17} /> : notice.kind === 'error' ? <X size={17} /> : <Bell size={17} />}</span><p>{notice.text}</p><button aria-label="Dismiss message" onClick={onClose}><X size={15} /></button></div>
}

export default App
