import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import Admin from './Admin'
import Landing from './Landing'
import './styles.css'

const path = window.location.pathname.replace(/\/$/, '') || '/'
const isAdminRoute = path === '/admin'
const isAppRoute = path === '/app' || path === '/login' || path === '/signup'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {isAdminRoute ? <Admin /> : isAppRoute ? <App /> : <Landing />}
  </StrictMode>,
)
