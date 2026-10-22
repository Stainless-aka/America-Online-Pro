import { useState } from 'react'
import {
  ArrowDownLeft,
  ArrowLeftRight,
  ArrowUpRight,
  Bell,
  ChevronDown,
  CircleHelp,
  CreditCard,
  LayoutDashboard,
  LogOut,
  Menu,
  Plus,
  Search,
  Settings2,
  ShieldCheck,
  Sparkles,
  Wallet,
  X,
} from 'lucide-react'

const activity = [
  { initials: 'GS', name: 'Green Basket Market', category: 'Shopping · Today, 10:42 AM', amount: '−₦18,500.00', kind: 'debit' },
  { initials: 'SL', name: 'Salary payment', category: 'Income · Yesterday, 9:15 AM', amount: '+₦350,000.00', kind: 'credit' },
  { initials: 'NT', name: 'Internet subscription', category: 'Utilities · 20 Oct, 6:20 PM', amount: '−₦12,000.00', kind: 'debit' },
  { initials: 'JM', name: 'Transfer from Jordan', category: 'Transfer · 19 Oct, 2:08 PM', amount: '+₦25,000.00', kind: 'credit' },
]

function App() {
  const [active, setActive] = useState('Overview')
  const [menuOpen, setMenuOpen] = useState(false)
  const [showBalance, setShowBalance] = useState(true)

  const navItems = [
    { label: 'Overview', icon: LayoutDashboard },
    { label: 'My accounts', icon: Wallet },
    { label: 'Transfers', icon: ArrowLeftRight },
    { label: 'Cards', icon: CreditCard },
  ]

  return (
    <div className="app-shell">
      <aside className={`sidebar ${menuOpen ? 'sidebar-open' : ''}`}>
        <a className="brand" href="#overview" aria-label="America Online Pro home">
          <span className="brand-mark"><span /></span>
          <span className="brand-name">america<span>online</span><small>PRO</small></span>
          <button className="icon-button sidebar-close" aria-label="Close navigation" onClick={() => setMenuOpen(false)}><X size={19} /></button>
        </a>
        <div className="workspace-label">WORKSPACE</div>
        <nav className="main-nav" aria-label="Main navigation">
          {navItems.map(({ label, icon: Icon }) => (
            <button key={label} className={`nav-link ${active === label ? 'nav-link-active' : ''}`} onClick={() => { setActive(label); setMenuOpen(false) }}>
              <Icon size={18} strokeWidth={1.8} /><span>{label}</span>{label === 'Transfers' && <span className="nav-dot" />}
            </button>
          ))}
        </nav>
        <div className="sidebar-spacer" />
        <div className="help-card"><div className="help-icon"><CircleHelp size={18} /></div><strong>Need a hand?</strong><p>Our support team is here to help you.</p><button onClick={() => setActive('Help center')}>Visit help center <ArrowUpRight size={14} /></button></div>
        <nav className="bottom-nav" aria-label="Account navigation">
          <button className={`nav-link ${active === 'Settings' ? 'nav-link-active' : ''}`} onClick={() => setActive('Settings')}><Settings2 size={18} /><span>Settings</span></button>
          <button className="nav-link" onClick={() => setActive('Sign out')}><LogOut size={18} /><span>Sign out</span></button>
        </nav>
        <div className="profile-row"><div className="avatar">GA</div><div className="profile-copy"><strong>Godwin Ayuba</strong><span>Personal account</span></div><ChevronDown size={16} className="profile-chevron" /></div>
      </aside>

      <main className="main-content" id="overview">
        <header className="topbar">
          <button className="icon-button mobile-menu" aria-label="Open navigation" onClick={() => setMenuOpen(true)}><Menu size={21} /></button>
          <div className="breadcrumb"><span>Workspace</span><span className="breadcrumb-slash">/</span><strong>{active}</strong></div>
          <div className="topbar-actions"><button className="search-button"><Search size={17} /><span>Search anything</span><kbd>⌘ K</kbd></button><button className="icon-button notification-button" aria-label="Notifications"><Bell size={19} /><i /></button><div className="top-avatar">GA</div></div>
        </header>

        <div className="page-content">
          <div className="welcome-row"><div><div className="eyebrow"><span className="status-pulse" /> YOUR MONEY, IN MOTION</div><h1>Good morning, Godwin<span className="wave">.</span></h1><p className="page-subtitle">Here’s what’s happening with your finances today.</p></div><button className="date-button">October 22, 2026 <ChevronDown size={15} /></button></div>

          <section className="balance-grid" aria-label="Account summary">
            <article className="balance-card"><div className="balance-card-top"><span className="balance-label">TOTAL AVAILABLE BALANCE</span><button className="balance-toggle" onClick={() => setShowBalance(!showBalance)}>{showBalance ? 'Hide balance' : 'Show balance'}</button></div><div className="balance-amount">{showBalance ? '₦2,485,600' : '••••••••••'}<span>{showBalance ? '.00' : ''}</span></div><div className="balance-foot"><span className="balance-account"><Wallet size={15} /> Primary account ···· 2841</span><span className="balance-change"><ArrowUpRight size={14} /> 8.2% <span>this month</span></span></div><div className="balance-decoration decoration-one" /><div className="balance-decoration decoration-two" /></article>
            <article className="quick-card"><div className="quick-card-heading"><div><span className="section-kicker">QUICK ACTIONS</span><h2>Make a move</h2></div><span className="quick-spark"><Sparkles size={17} /></span></div><div className="quick-actions"><button onClick={() => setActive('Transfers')}><span className="action-icon action-primary"><ArrowUpRight size={19} /></span><span>Send money</span></button><button onClick={() => setActive('Add funds')}><span className="action-icon"><ArrowDownLeft size={19} /></span><span>Add funds</span></button><button onClick={() => setActive('Accounts')}><span className="action-icon"><Plus size={19} /></span><span>New account</span></button></div></article>
          </section>

          <div className="section-heading"><div><span className="section-kicker">YOUR OVERVIEW</span><h2>Financial snapshot</h2></div><button className="text-button" onClick={() => setActive('Analytics')}>View insights <ArrowUpRight size={15} /></button></div>
          <section className="stats-grid" aria-label="Financial snapshot"><article className="stat-card"><div className="stat-top"><span>Money in</span><span className="stat-icon stat-icon-green"><ArrowDownLeft size={17} /></span></div><div className="stat-value">₦485,000<span>.00</span></div><div className="stat-foot"><span className="trend-positive">↑ 12.8%</span><span>vs last month</span></div><div className="mini-bars bars-green"><i /><i /><i /><i /><i /><i /><i /><i /><i /><i /><i /><i /></div></article><article className="stat-card"><div className="stat-top"><span>Money out</span><span className="stat-icon stat-icon-orange"><ArrowUpRight size={17} /></span></div><div className="stat-value">₦126,500<span>.00</span></div><div className="stat-foot"><span className="trend-neutral">↓ 4.3%</span><span>vs last month</span></div><div className="mini-bars bars-orange"><i /><i /><i /><i /><i /><i /><i /><i /><i /><i /><i /><i /></div></article><article className="stat-card stat-card-goal"><div className="stat-top"><span>Savings goal</span><span className="stat-icon stat-icon-purple"><Sparkles size={17} /></span></div><div className="stat-value">₦720,000<span>.00</span></div><div className="goal-caption">of ₦1,000,000 target</div><div className="progress-track"><span /></div><div className="stat-foot"><span className="trend-positive">72% complete</span><span>₦280k to go</span></div></article></section>

          <section className="activity-section"><div className="section-heading activity-heading"><div><span className="section-kicker">THE LATEST</span><h2>Recent activity</h2></div><button className="filter-button" onClick={() => setActive('Transactions')}>All transactions <ArrowUpRight size={15} /></button></div><div className="activity-table"><div className="activity-table-head"><span>TRANSACTION</span><span>CATEGORY</span><span>AMOUNT</span><span>STATUS</span></div>{activity.map((item) => <div className="activity-row" key={item.name}><div className="transaction-name"><span className={`transaction-avatar ${item.kind}`}>{item.initials}</span><strong>{item.name}</strong></div><span className="transaction-category">{item.category}</span><strong className={`transaction-amount ${item.kind}`}>{item.amount}</strong><span className="transaction-status"><i /> Completed</span></div>)}</div><button className="mobile-view-all" onClick={() => setActive('Transactions')}>View all transactions <ArrowUpRight size={15} /></button></section>
          <footer className="page-footer"><span>© 2026 America Online Pro</span><span className="demo-disclaimer"><ShieldCheck size={14} /> DEMO ENVIRONMENT · NO REAL MONEY</span><span>Built with care, for your financial future.</span></footer>
        </div>
      </main>
      {menuOpen && <button className="mobile-overlay" aria-label="Close navigation overlay" onClick={() => setMenuOpen(false)} />}
    </div>
  )
}

export default App
