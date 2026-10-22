import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import Admin from './Admin'
import './styles.css'

const isAdminRoute = window.location.pathname.replace(/\/$/, '') === '/admin'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {isAdminRoute ? <Admin /> : <App />}
  </StrictMode>,
)
