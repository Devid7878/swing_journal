'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    const supabase = createClient()
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      setError(error.message)
      setLoading(false)
    } else {
      router.push('/')
      router.refresh()
    }
  }

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: '#0a0b0f', fontFamily: 'Syne, sans-serif', padding: 20,
    }}>
      <div className="auth-card">
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div style={{
            width: 48, height: 48, background: 'linear-gradient(135deg,#00e5a0,#0097ff)',
            borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 22, fontWeight: 800, color: '#0a0b0f', margin: '0 auto 14px',
          }}>S</div>
          <div style={{ fontWeight: 800, fontSize: 22, color: '#e8e6e0', letterSpacing: '-0.03em' }}>SwingJournal</div>
          <div style={{ fontSize: 12, color: '#444', marginTop: 4 }}>Sign in to your account</div>
        </div>

        <form onSubmit={handleLogin}>
          <div className="auth-input-group">
            <label className="fl">Email</label>
            <input
              className="fi" type="email" placeholder="you@example.com"
              value={email} onChange={e => setEmail(e.target.value)} required autoFocus
            />
          </div>
          <div className="auth-input-group">
            <label className="fl">Password</label>
            <input
              className="fi" type="password" placeholder="••••••••"
              value={password} onChange={e => setPassword(e.target.value)} required
            />
          </div>

          {error && <div className="err-msg">{error}</div>}

          <button className="bp" type="submit" disabled={loading} style={{ width: '100%', marginTop: 4 }}>
            {loading ? 'Signing in…' : 'Sign In →'}
          </button>
        </form>

        <div className="auth-divider"><span>or</span></div>

        <div style={{ textAlign: 'center', fontSize: 13, color: '#555' }}>
          Don&apos;t have an account?{' '}
          <Link href="/signup" style={{ color: '#00e5a0', fontWeight: 700, textDecoration: 'none' }}>
            Sign up free
          </Link>
        </div>
      </div>
    </div>
  )
}
