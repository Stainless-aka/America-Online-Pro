import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import App from './App'

describe('America Online Pro dashboard', () => {
  it('renders the brand and customer overview', () => {
    render(<App />)
    expect(screen.getByRole('link', { name: /america online pro home/i })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /good morning, godwin/i })).toBeInTheDocument()
    expect(screen.getByText(/demo environment · no real money/i)).toBeInTheDocument()
  })

  it('allows the demo balance to be hidden', async () => {
    const user = userEvent.setup()
    render(<App />)
    await user.click(screen.getByRole('button', { name: /hide balance/i }))
    expect(screen.getByText('••••••••••')).toBeInTheDocument()
  })
})
