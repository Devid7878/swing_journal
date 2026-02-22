'use client'

import { useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

export default function SignupPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [loading, setLoading] = useState(false)

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (password !== confirm) { setError('Passwords do not match'); return }
    if (password.length < 6) { setError('Password must be at least 6 characters'); return }

    setLoading(true)
    const supabase = createClient()
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
    })
    setLoading(false)
    if (error) setError(error.message)
    else setSuccess(true)
  }

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: '#0a0b0f', fontFamily: 'Syne, sans-serif', padding: 20,
    }}>
      <div className="auth-card">
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div style={{
            width: 48, height: 48, background: 'linear-gradient(135deg,#00e5a0,#0097ff)',
            borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 22, fontWeight: 800, color: '#0a0b0f', margin: '0 auto 14px',
          }}>S</div>
          <div style={{ fontWeight: 800, fontSize: 22, color: '#e8e6e0', letterSpacing: '-0.03em' }}>SwingJournal</div>
          <div style={{ fontSize: 12, color: '#444', marginTop: 4 }}>Create your free account</div>
        </div>

        {success ? (
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 40, marginBottom: 14 }}>📬</div>
            <div style={{ fontWeight: 800, fontSize: 16, color: '#e8e6e0', marginBottom: 8 }}>Check your email!</div>
            <div style={{ fontSize: 13, color: '#555', lineHeight: 1.6, marginBottom: 20 }}>
              We sent a confirmation link to <strong style={{ color: '#e8e6e0' }}>{email}</strong>.
              Click it to activate your account, then sign in.
            </div>
            <Link href="/login" style={{ color: '#00e5a0', fontWeight: 700, fontSize: 13, textDecoration: 'none' }}>
              ← Back to Sign In
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSignup}>
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
                className="fi" type="password" placeholder="Min. 6 characters"
                value={password} onChange={e => setPassword(e.target.value)} required
              />
            </div>
            <div className="auth-input-group">
              <label className="fl">Confirm Password</label>
              <input
                className="fi" type="password" placeholder="Repeat password"
                value={confirm} onChange={e => setConfirm(e.target.value)} required
              />
            </div>

            {error && <div className="err-msg">{error}</div>}

            <button className="bp" type="submit" disabled={loading} style={{ width: '100%', marginTop: 4 }}>
              {loading ? 'Creating account…' : 'Create Account →'}
            </button>

            <div className="auth-divider"><span>or</span></div>

            <div style={{ textAlign: 'center', fontSize: 13, color: '#555' }}>
              Already have an account?{' '}
              <Link href="/login" style={{ color: '#00e5a0', fontWeight: 700, textDecoration: 'none' }}>
                Sign in
              </Link>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
