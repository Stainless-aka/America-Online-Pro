import { ArrowRight, ArrowUpRight, Check, ChevronRight, CircleDollarSign, CreditCard, LockKeyhole, Menu, ShieldCheck, Sparkles, Wallet, X } from 'lucide-react'
import { useState } from 'react'
import './landing.css'

const features = [
  { icon: Wallet, title: 'One clear overview', copy: 'See your account balance, recent activity, and account details in one considered workspace.' },
  { icon: ArrowRight, title: 'Transfers, thoughtfully designed', copy: 'Explore a clean transfer workflow in an isolated portfolio environment.' },
  { icon: CreditCard, title: 'Your account at a glance', copy: 'Keep account identifiers and profile information easy to find.' },
]

export default function Landing() {
  const [menuOpen, setMenuOpen] = useState(false)
  return <main className="landing">
    <header className="landing-nav">
      <a className="landing-brand" href="/" aria-label="America Online Pro home">
        <span className="landing-brand-mark"><span /></span>
        <span>america<span className="landing-brand-light">online</span><b>PRO</b></span>
      </a>
      <button className="landing-menu-toggle" aria-label={menuOpen ? 'Close menu' : 'Open menu'} onClick={() => setMenuOpen(v => !v)}>{menuOpen ? <X size={21}/> : <Menu size={21}/>}</button>
      <nav className={menuOpen ? 'landing-links landing-links-open' : 'landing-links'}>
        <a href="#features" onClick={() => setMenuOpen(false)}>Features</a>
        <a href="#how-it-works" onClick={() => setMenuOpen(false)}>How it works</a>
        <a href="#security" onClick={() => setMenuOpen(false)}>Security</a>
        <a className="landing-signin" href="/app" onClick={() => setMenuOpen(false)}>Sign in</a>
        <a className="landing-cta landing-nav-cta" href="/app?mode=signup" onClick={() => setMenuOpen(false)}>Get started <ArrowUpRight size={16}/></a>
      </nav>
    </header>

    <section className="landing-hero">
      <div className="landing-hero-copy">
        <div className="landing-eyebrow"><span className="landing-eyebrow-dot"/> A clearer way to explore digital banking</div>
        <h1>Money tools,<br/><span>without the noise.</span></h1>
        <p className="landing-hero-description">Meet a calmer banking experience built around clarity. Explore your account, review activity, and get familiar with everyday money tools in one simple place.</p>
        <div className="landing-hero-actions">
          <a className="landing-cta" href="/app?mode=signup">Create your account <ArrowRight size={17}/></a>
          <a className="landing-secondary-link" href="#features">Explore the platform <ChevronRight size={17}/></a>
        </div>
        <div className="landing-trust-row">
          <span><ShieldCheck size={16}/> Account-aware experience</span>
          <span><LockKeyhole size={15}/> Secure sign-in</span>
        </div>
      </div>

      <div className="landing-visual" aria-label="Illustration of a digital account overview">
        <div className="landing-orbit landing-orbit-one"/><div className="landing-orbit landing-orbit-two"/>
        <div className="landing-floating-chip"><span className="landing-chip-icon"><Check size={15}/></span><span><b>Account ready</b><small>Profile overview</small></span></div>
        <div className="landing-preview-card">
          <div className="landing-preview-top"><span className="landing-preview-label">TOTAL BALANCE</span><span className="landing-preview-status"><i/> ACCOUNT VIEW</span></div>
          <div className="landing-preview-balance">$0.00</div>
          <div className="landing-preview-sub">USD account overview</div>
          <div className="landing-preview-rule"/>
          <div className="landing-preview-bottom"><span><i className="landing-mini-icon"><Wallet size={16}/></i><span><b>Everyday account</b><small>Account details</small></span></span><span className="landing-preview-arrow"><ArrowUpRight size={17}/></span></div>
          <div className="landing-preview-bars"><span/><span/><span/><span/><span/><span/><span/><span/><span/><span/><span/><span/><span/><span/><span/><span/><span/><span/><span/><span/><span/><span/><span/><span/></div>
        </div>
        <div className="landing-float-stat"><span className="landing-stat-icon"><CircleDollarSign size={18}/></span><span><small>Currency</small><b>US Dollar (USD)</b></span></div>
      </div>
    </section>

    <section className="landing-proof-strip">
      <div><span className="landing-proof-icon"><Wallet size={18}/></span><span><b>Account overview</b><small>Your details in one place</small></span></div>
      <div><span className="landing-proof-icon"><ActivityIcon/></span><span><b>Activity history</b><small>Review account activity</small></span></div>
      <div><span className="landing-proof-icon"><LockKeyhole size={18}/></span><span><b>Private workspace</b><small>Sign in to access your view</small></span></div>
    </section>

    <section className="landing-features" id="features">
      <div className="landing-section-heading"><span className="landing-section-kicker">MADE FOR CLARITY</span><h2>The essentials, <span>beautifully organized.</span></h2><p>A straightforward interface for exploring the core pieces of a modern digital banking experience.</p></div>
      <div className="landing-feature-grid">{features.map(({icon: Icon, title, copy}, index) => <article className="landing-feature-card" key={title}><span className="landing-feature-icon"><Icon size={21}/></span><span className="landing-feature-index">0{index + 1}</span><h3>{title}</h3><p>{copy}</p><a href="/app">Explore workspace <ArrowUpRight size={15}/></a></article>)}</div>
    </section>

    <section className="landing-how" id="how-it-works">
      <div className="landing-how-copy"><span className="landing-section-kicker">A SIMPLE START</span><h2>Get to your financial workspace in three steps.</h2><p>Designed to feel familiar from the first visit, whether you are creating an account or returning to your dashboard.</p><a className="landing-cta" href="/app?mode=signup">Get started <ArrowRight size={16}/></a></div>
      <div className="landing-steps">
        <article><span>01</span><div><h3>Create an account</h3><p>Register with your email and set up your sign-in credentials.</p></div><Check size={18}/></article>
        <article><span>02</span><div><h3>Open your overview</h3><p>View your profile and account details in your private workspace.</p></div><Check size={18}/></article>
        <article><span>03</span><div><h3>Explore the tools</h3><p>Review activity and explore available account features.</p></div><Check size={18}/></article>
      </div>
    </section>

    <section className="landing-security" id="security"><div className="landing-security-icon"><ShieldCheck size={23}/></div><div><span className="landing-section-kicker">BUILT WITH CARE</span><h2>Your account deserves a thoughtful experience.</h2><p>Sign-in protects access to your personal workspace. Keep your password private and only use account details within the application.</p></div><a href="/app">Go to sign in <ArrowUpRight size={16}/></a></section>

    <section className="landing-final-cta"><div className="landing-final-glow"/><span className="landing-section-kicker">YOUR WORKSPACE AWAITS</span><h2>A better view starts here.</h2><p>Create your account to explore the America Online Pro interface.</p><a className="landing-cta" href="/app?mode=signup">Create an account <ArrowRight size={17}/></a></section>

    <footer className="landing-footer"><a className="landing-brand" href="/"><span className="landing-brand-mark"><span/></span><span>america<span className="landing-brand-light">online</span><b>PRO</b></span></a><p>© {new Date().getFullYear()} America Online Pro. All rights reserved.</p></footer>
  </main>
}

function ActivityIcon() {
  return <Sparkles size={18}/>
}
