import { render, screen } from '@testing-library/react'
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
    render(<App />)
    screen.getByRole('button', { name: /hide balance/i }).click()
    expect(screen.getByText('••••••••••')).toBeInTheDocument()
  })
})
