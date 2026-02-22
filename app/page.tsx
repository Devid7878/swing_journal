'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { User } from '@supabase/supabase-js'
import type { Trade, IpoAccount, IpoRecord, Capital } from '@/lib/types'

// ─── CONSTANTS ───
const NSE_SYMBOLS = [
  { symbol: 'RELIANCE', name: 'Reliance Industries Ltd', sector: 'Energy' },
  { symbol: 'TCS', name: 'Tata Consultancy Services Ltd', sector: 'Technology' },
  { symbol: 'HDFCBANK', name: 'HDFC Bank Ltd', sector: 'Finance' },
  { symbol: 'INFY', name: 'Infosys Ltd', sector: 'Technology' },
  { symbol: 'ICICIBANK', name: 'ICICI Bank Ltd', sector: 'Finance' },
  { symbol: 'HINDUNILVR', name: 'Hindustan Unilever Ltd', sector: 'FMCG' },
  { symbol: 'ITC', name: 'ITC Ltd', sector: 'FMCG' },
  { symbol: 'SBIN', name: 'State Bank of India', sector: 'Finance' },
  { symbol: 'BHARTIARTL', name: 'Bharti Airtel Ltd', sector: 'Technology' },
  { symbol: 'KOTAKBANK', name: 'Kotak Mahindra Bank Ltd', sector: 'Finance' },
  { symbol: 'LT', name: 'Larsen & Toubro Ltd', sector: 'Other' },
  { symbol: 'AXISBANK', name: 'Axis Bank Ltd', sector: 'Finance' },
  { symbol: 'BAJFINANCE', name: 'Bajaj Finance Ltd', sector: 'Finance' },
  { symbol: 'MARUTI', name: 'Maruti Suzuki India Ltd', sector: 'Auto' },
  { symbol: 'SUNPHARMA', name: 'Sun Pharmaceutical Industries Ltd', sector: 'Pharma' },
  { symbol: 'WIPRO', name: 'Wipro Ltd', sector: 'Technology' },
  { symbol: 'TITAN', name: 'Titan Company Ltd', sector: 'Other' },
  { symbol: 'ZOMATO', name: 'Zomato Ltd', sector: 'Technology' },
  { symbol: 'PAYTM', name: 'One97 Communications Ltd', sector: 'Technology' },
  { symbol: 'NYKAA', name: 'FSN E-Commerce Ventures Ltd', sector: 'Technology' },
  { symbol: 'IRCTC', name: 'Indian Railway Catering & Tourism Ltd', sector: 'Other' },
  { symbol: 'HAL', name: 'Hindustan Aeronautics Ltd', sector: 'Other' },
  { symbol: 'TATAMOTORS', name: 'Tata Motors Ltd', sector: 'Auto' },
  { symbol: 'TATASTEEL', name: 'Tata Steel Ltd', sector: 'Metal' },
  { symbol: 'ADANIENT', name: 'Adani Enterprises Ltd', sector: 'Other' },
  { symbol: 'ZYDUSLIFE', name: 'Zydus Lifesciences Ltd', sector: 'Pharma' },
  { symbol: 'DRREDDY', name: "Dr Reddy's Laboratories Ltd", sector: 'Pharma' },
  { symbol: 'CIPLA', name: 'Cipla Ltd', sector: 'Pharma' },
  { symbol: 'HCLTECH', name: 'HCL Technologies Ltd', sector: 'Technology' },
  { symbol: 'DLF', name: 'DLF Ltd', sector: 'Realty' },
]

const STATUS_COLORS: Record<string, string> = { Running: '#00e5a0', Exited: '#888', 'Stop Hit': '#ff4f4f' }
const SECTORS = ['Technology', 'Finance', 'Pharma', 'Energy', 'FMCG', 'Auto', 'Metal', 'Realty', 'Other']
const YEARS = Array.from({ length: 8 }, (_, i) => String(2018 + i))
const DEMAT_PROVIDERS = ['Zerodha', 'Groww', 'Upstox', 'Angel One', 'ICICI Direct', 'HDFC Securities', 'Kotak Securities', '5Paisa', 'Motilal Oswal', 'SBI Securities', 'Other']
const IPO_CATEGORIES = ['Retail', 'HNI / NII', 'QIB', 'Employee', 'Shareholder']
const LISTING_EXCHANGES = ['NSE', 'BSE', 'NSE + BSE']

// ─── HELPERS ───
const fmt = (n: number | undefined | null, dec = 2) =>
  typeof n === 'number' ? n.toLocaleString('en-IN', { minimumFractionDigits: dec, maximumFractionDigits: dec }) : '—'
const fmtL = (n: number) =>
  Math.abs(n) >= 100000 ? `₹${(n / 100000).toFixed(2)}L` : `₹${Math.abs(n).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`
const strVal = (v: unknown) => (v === undefined || v === null ? '' : String(v))

function useWindowWidth() {
  const [w, setW] = useState(1200)
  useEffect(() => {
    setW(window.innerWidth)
    const h = () => setW(window.innerWidth)
    window.addEventListener('resize', h)
    return () => window.removeEventListener('resize', h)
  }, [])
  return w
}

async function apiGet(path: string) {
  const res = await fetch(path)
  if (!res.ok) throw new Error(`GET ${path} failed`)
  return res.json()
}
async function apiPost(path: string, body: unknown) {
  const res = await fetch(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
  if (!res.ok) throw new Error(`POST ${path} failed`)
  return res.json()
}
async function apiDelete(path: string, body: unknown) {
  const res = await fetch(path, { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
  if (!res.ok) throw new Error(`DELETE ${path} failed`)
  return res.json()
}

// ─── STOCK SEARCH ───
interface LiveData { price: number; changePct: number; dayHigh: number; dayLow: number; error?: boolean }

function StockSearchInput({ value, onChange, onSelect, onUsePrice }: {
  value: string; onChange: (v: string) => void
  onSelect: (s: { symbol: string; name: string; sector: string }) => void
  onUsePrice: (p: number) => void
}) {
  const [query, setQuery] = useState(value || '')
  const [results, setResults] = useState<typeof NSE_SYMBOLS>([])
  const [loading, setLoading] = useState(false)
  const [liveData, setLiveData] = useState<LiveData | null>(null)
  const [open, setOpen] = useState(false)
  const [selectedSymbol, setSelectedSymbol] = useState('')
  const dropRef = useRef<HTMLDivElement>(null)
  const debRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const localSearch = (q: string) => {
    if (!q) return []
    const u = q.toUpperCase()
    return NSE_SYMBOLS.filter(s => s.symbol.startsWith(u) || s.name.toUpperCase().includes(u)).slice(0, 8)
  }

  async function fetchLive(symbol: string) {
    setLoading(true); setLiveData(null)
    try {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514', max_tokens: 400,
          tools: [{ type: 'web_search_20250305', name: 'web_search' }],
          system: 'Return ONLY valid JSON: {"price":1234.50,"change":12.30,"changePct":1.05,"dayHigh":1250.00,"dayLow":1220.00}',
          messages: [{ role: 'user', content: `Current NSE stock price for ${symbol}` }],
        }),
      })
      const data = await res.json()
      const text = (data.content || []).filter((b: { type: string }) => b.type === 'text').map((b: { text: string }) => b.text).join('')
      const m = text.match(/\{[\s\S]*\}/)
      if (m) setLiveData(JSON.parse(m[0]))
      else setLiveData({ error: true } as LiveData)
    } catch { setLiveData({ error: true } as LiveData) }
    setLoading(false)
  }

  const handleInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const q = e.target.value; setQuery(q); onChange(q.toUpperCase()); setLiveData(null); setSelectedSymbol('')
    if (debRef.current) clearTimeout(debRef.current)
    debRef.current = setTimeout(() => { const r = localSearch(q); setResults(r); setOpen(r.length > 0) }, 120)
  }
  const handleSelect = (stock: typeof NSE_SYMBOLS[number]) => {
    setQuery(stock.symbol); setOpen(false); setResults([]); setSelectedSymbol(stock.symbol)
    onSelect(stock); fetchLive(stock.symbol)
  }

  useEffect(() => {
    const h = (e: MouseEvent) => { if (dropRef.current && !dropRef.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [])

  return (
    <div ref={dropRef} style={{ position: 'relative' }}>
      <div style={{ position: 'relative' }}>
        <input className="fi" value={query} onChange={handleInput} onFocus={() => results.length > 0 && setOpen(true)}
          placeholder="Symbol or company name..." autoComplete="off"
          style={{ paddingRight: 40, textTransform: 'uppercase', fontWeight: 600 }} />
        <div style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)' }}>
          {loading ? <div className="spin-sm" /> : '🔍'}
        </div>
      </div>
      {open && results.length > 0 && (
        <div style={{ position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0, zIndex: 1000, background: '#0f1014', border: '1px solid #252830', borderRadius: 12, overflow: 'hidden', boxShadow: '0 24px 80px rgba(0,0,0,0.8)' }}>
          {results.map((s, i) => (
            <div key={s.symbol} onClick={() => handleSelect(s)}
              style={{ padding: '11px 14px', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: i < results.length - 1 ? '1px solid #13141a' : 'none' }}
              onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.background = '#1a1b20' }}
              onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.background = 'transparent' }}>
              <div>
                <div style={{ fontFamily: 'JetBrains Mono', fontSize: 14, fontWeight: 700, color: '#00e5a0' }}>{s.symbol}</div>
                <div style={{ fontSize: 11, color: '#555', marginTop: 1 }}>{s.name}</div>
              </div>
              <div style={{ fontSize: 9, background: 'rgba(255,255,255,0.04)', color: '#444', padding: '2px 8px', borderRadius: 20 }}>{s.sector}</div>
            </div>
          ))}
        </div>
      )}
      {selectedSymbol && (loading || liveData) && (
        <div style={{ marginTop: 10, background: '#0d0e12', border: '1px solid #1e2028', borderRadius: 12, overflow: 'hidden' }}>
          <div style={{ padding: '10px 14px', background: '#111318', borderBottom: '1px solid #1a1b20', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ fontFamily: 'JetBrains Mono', fontSize: 13, fontWeight: 700, color: '#00e5a0' }}>{selectedSymbol}</div>
            <div style={{ fontSize: 9, color: '#333', letterSpacing: '0.1em' }}>LIVE · NSE</div>
          </div>
          {loading && <div style={{ padding: 16, display: 'flex', alignItems: 'center', gap: 10, color: '#444' }}><div className="spin-sm" /><span style={{ fontSize: 12 }}>Fetching live price...</span></div>}
          {liveData && !loading && !liveData.error && (
            <div style={{ padding: 14 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 12 }}>
                <div><div style={{ fontSize: 9, color: '#444', textTransform: 'uppercase', marginBottom: 4 }}>LTP</div><div style={{ fontFamily: 'JetBrains Mono', fontSize: 18, fontWeight: 800 }}>₹{fmt(liveData.price)}</div></div>
                <div><div style={{ fontSize: 9, color: '#444', textTransform: 'uppercase', marginBottom: 4 }}>Chg</div><div style={{ fontFamily: 'JetBrains Mono', fontSize: 13, fontWeight: 700, color: liveData.changePct >= 0 ? '#00e5a0' : '#ff4f4f' }}>{liveData.changePct >= 0 ? '▲' : '▼'} {Math.abs(liveData.changePct)}%</div></div>
                <div><div style={{ fontSize: 9, color: '#444', textTransform: 'uppercase', marginBottom: 4 }}>Range</div><div style={{ fontFamily: 'JetBrains Mono', fontSize: 10, color: '#666' }}>H:{fmt(liveData.dayHigh)}<br />L:{fmt(liveData.dayLow)}</div></div>
              </div>
              <button onClick={() => onUsePrice(liveData.price)} style={{ width: '100%', background: 'linear-gradient(135deg,#00e5a0,#00c080)', color: '#0a0b0f', border: 'none', borderRadius: 8, padding: 10, fontWeight: 800, fontSize: 13, cursor: 'pointer', fontFamily: 'Syne,sans-serif' }}>
                ✓ Use ₹{fmt(liveData.price)} as Buy Price
              </button>
            </div>
          )}
          {liveData?.error && !loading && <div style={{ padding: 14, fontSize: 12, color: '#555' }}>Could not fetch price. Enter manually.</div>}
        </div>
      )}
    </div>
  )
}

// ─── ACCOUNT MODAL ───
const emptyAccount = { id: null as number | null, holder_name: '', pan: '', demat_name: '', demat_provider: 'Zerodha', demat_id: '', bank: '', upi_id: '', phone: '', email: '', category: 'Retail', notes: '' }
type AccountForm = typeof emptyAccount

function AccountModal({ account, onSave, onClose }: { account: IpoAccount | null; onSave: (a: IpoAccount) => void; onClose: () => void }) {
  const [form, setForm] = useState<AccountForm>(account ? { ...account } : emptyAccount)
  const chg = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setForm(f => ({ ...f, [e.target.name]: e.target.value }))
  const w = useWindowWidth(); const isMob = w < 600
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.88)', zIndex: 2000, display: 'flex', alignItems: 'flex-end', justifyContent: 'center', padding: isMob ? 0 : 20 }} onClick={onClose}>
      <div style={{ background: '#111318', border: '1px solid #1e2028', borderRadius: isMob ? '18px 18px 0 0' : 18, width: '100%', maxWidth: 620, maxHeight: '92vh', overflowY: 'auto', padding: isMob ? '24px 16px' : 28 }} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <h3 style={{ fontSize: 18, fontWeight: 800 }}>{form.id ? 'Edit Account' : 'Add Demat Account'}</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#555', fontSize: 22, cursor: 'pointer', padding: '4px 8px' }}>✕</button>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: isMob ? '1fr' : '1fr 1fr', gap: 12 }}>
          {[
            { label: 'Holder Name *', name: 'holder_name', placeholder: 'Full name as per PAN', full: true },
            { label: 'PAN Number', name: 'pan', placeholder: 'ABCDE1234F' },
            { label: 'Demat Name', name: 'demat_name', placeholder: 'Name on demat' },
            { label: 'Demat ID / BO ID', name: 'demat_id', placeholder: '1234567890123456' },
            { label: 'Bank Name', name: 'bank', placeholder: 'HDFC Bank, SBI...' },
            { label: 'UPI ID', name: 'upi_id', placeholder: 'name@upi' },
            { label: 'Phone', name: 'phone', placeholder: '9XXXXXXXXX' },
            { label: 'Email', name: 'email', placeholder: 'email@example.com' },
          ].map(f => (
            <div key={f.name} style={{ gridColumn: (f.full && !isMob) ? '1/-1' : undefined }}>
              <label className="fl">{f.label}</label>
              <input className="fi" name={f.name} value={strVal((form as Record<string, unknown>)[f.name])} onChange={chg} placeholder={f.placeholder} style={{ textTransform: f.name === 'pan' ? 'uppercase' : 'none' }} />
            </div>
          ))}
          <div><label className="fl">Demat Provider</label><select className="fi" name="demat_provider" value={form.demat_provider} onChange={chg}>{DEMAT_PROVIDERS.map(d => <option key={d}>{d}</option>)}</select></div>
          <div><label className="fl">IPO Category</label><select className="fi" name="category" value={form.category} onChange={chg}>{IPO_CATEGORIES.map(c => <option key={c}>{c}</option>)}</select></div>
          <div style={{ gridColumn: !isMob ? '1/-1' : undefined }}>
            <label className="fl">Notes</label>
            <textarea className="fi" name="notes" value={strVal(form.notes)} onChange={chg} rows={2} style={{ resize: 'vertical' }} />
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
          <button className="bp" onClick={() => onSave({ ...form, id: form.id || Date.now(), user_id: '' } as IpoAccount)} style={{ flex: 1 }}>{form.id ? '✓ Update' : '＋ Save Account'}</button>
          <button className="bg" onClick={onClose}>Cancel</button>
        </div>
      </div>
    </div>
  )
}

// ─── IPO MODAL ───
const emptyIpo = {
  id: null as number | null, company_name: '', symbol: '', year: String(new Date().getFullYear()),
  exchange: 'NSE + BSE', sector: 'Technology', ipo_price: '' as unknown as number,
  lot_size: '', lots_applied: '', allotted: 'Yes' as 'Yes' | 'No',
  qty_allotted: '', amount_applied: '', amount_paid: '', listing_date: '',
  listing_price: '', selling_price: '', selling_date: '', status: 'Sold on Listing',
  account_id: '', notes: '', gmp_at_apply: '', subscription_times: '',
}
type IpoForm = typeof emptyIpo

function IPOModal({ ipo, accounts, onSave, onClose }: { ipo: IpoRecord | null; accounts: IpoAccount[]; onSave: (r: IpoRecord) => void; onClose: () => void }) {
  const [form, setForm] = useState<IpoForm>(ipo ? { ...ipo, id: ipo.id, lot_size: strVal(ipo.lot_size), lots_applied: strVal(ipo.lots_applied), qty_allotted: strVal(ipo.qty_allotted), amount_applied: strVal(ipo.amount_applied), amount_paid: strVal(ipo.amount_paid), listing_date: strVal(ipo.listing_date), listing_price: strVal(ipo.listing_price), selling_price: strVal(ipo.selling_price), selling_date: strVal(ipo.selling_date), account_id: strVal(ipo.account_id), gmp_at_apply: strVal(ipo.gmp_at_apply), subscription_times: strVal(ipo.subscription_times) } : emptyIpo)
  const chg = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setForm(f => ({ ...f, [e.target.name]: e.target.value }))
  const w = useWindowWidth(); const isMob = w < 600

  const ipoP = parseFloat(String(form.ipo_price)) || 0
  const qty = parseFloat(String(form.qty_allotted)) || 0
  const sellP = parseFloat(String(form.selling_price)) || 0
  const listP = parseFloat(String(form.listing_price)) || 0
  const profit = qty > 0 && sellP > 0 ? (sellP - ipoP) * qty : null
  const profitPct = ipoP > 0 && sellP > 0 ? ((sellP - ipoP) / ipoP * 100) : null
  const listingGain = qty > 0 && listP > 0 ? (listP - ipoP) * qty : null

  const ss: React.CSSProperties = { background: '#0d0e12', borderRadius: 10, padding: isMob ? 14 : 16, marginBottom: 14, border: '1px solid #1a1b20' }
  const sl: React.CSSProperties = { fontSize: 10, color: '#444', textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: 12, display: 'block', fontWeight: 700 }

  const handleSave = () => {
    const out: IpoRecord = {
      ...form, id: form.id || Date.now(), user_id: '',
      ipo_price: parseFloat(String(form.ipo_price)) || 0,
      lot_size: form.lot_size ? parseFloat(String(form.lot_size)) : undefined,
      lots_applied: form.lots_applied ? parseFloat(String(form.lots_applied)) : undefined,
      qty_allotted: form.qty_allotted ? parseFloat(String(form.qty_allotted)) : undefined,
      amount_applied: form.amount_applied ? parseFloat(String(form.amount_applied)) : undefined,
      amount_paid: form.amount_paid ? parseFloat(String(form.amount_paid)) : undefined,
      listing_price: form.listing_price ? parseFloat(String(form.listing_price)) : undefined,
      selling_price: form.selling_price ? parseFloat(String(form.selling_price)) : undefined,
      gmp_at_apply: form.gmp_at_apply ? parseFloat(String(form.gmp_at_apply)) : undefined,
      subscription_times: form.subscription_times ? parseFloat(String(form.subscription_times)) : undefined,
      account_id: form.account_id ? parseInt(String(form.account_id)) : undefined,
      listing_date: form.listing_date || undefined,
      selling_date: form.selling_date || undefined,
    }
    onSave(out)
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.9)', zIndex: 2000, display: 'flex', alignItems: 'flex-end', justifyContent: 'center', padding: isMob ? 0 : 20 }} onClick={onClose}>
      <div style={{ background: '#111318', border: '1px solid #1e2028', borderRadius: isMob ? '18px 18px 0 0' : 18, width: '100%', maxWidth: 760, maxHeight: '94vh', overflowY: 'auto', padding: isMob ? '24px 16px 32px' : 28 }} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <h3 style={{ fontSize: 18, fontWeight: 800 }}>{form.id ? 'Edit IPO' : 'Log New IPO'}</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#555', fontSize: 22, cursor: 'pointer', padding: '4px 8px' }}>✕</button>
        </div>

        <div style={ss}>
          <span style={sl}>🏢 Company Details</span>
          <div style={{ marginBottom: 10 }}><label className="fl">Company Name *</label><input className="fi" name="company_name" value={form.company_name} onChange={chg} placeholder="e.g. Hyundai India Ltd" /></div>
          <div style={{ display: 'grid', gridTemplateColumns: isMob ? '1fr 1fr' : '1fr 1fr 1fr 1fr', gap: 10 }}>
            <div><label className="fl">Symbol</label><input className="fi" name="symbol" value={strVal(form.symbol)} onChange={chg} placeholder="HYUNDAI" style={{ textTransform: 'uppercase' }} /></div>
            <div><label className="fl">Year</label><select className="fi" name="year" value={form.year} onChange={chg}>{YEARS.map(y => <option key={y}>{y}</option>)}</select></div>
            <div><label className="fl">Exchange</label><select className="fi" name="exchange" value={form.exchange} onChange={chg}>{LISTING_EXCHANGES.map(e => <option key={e}>{e}</option>)}</select></div>
            <div><label className="fl">Sector</label><select className="fi" name="sector" value={form.sector} onChange={chg}>{SECTORS.map(s => <option key={s}>{s}</option>)}</select></div>
            <div style={{ gridColumn: isMob ? '1/-1' : undefined }}><label className="fl">Demat Account</label><select className="fi" name="account_id" value={strVal(form.account_id)} onChange={chg}><option value="">— Select —</option>{accounts.map(a => <option key={a.id} value={a.id}>{a.holder_name} ({a.demat_provider})</option>)}</select></div>
            <div><label className="fl">Subscription (×)</label><input className="fi" name="subscription_times" type="number" value={strVal(form.subscription_times)} onChange={chg} placeholder="67.8" /></div>
          </div>
        </div>

        <div style={ss}>
          <span style={sl}>📋 Application Details</span>
          <div style={{ display: 'grid', gridTemplateColumns: isMob ? '1fr 1fr' : 'repeat(4,1fr)', gap: 10 }}>
            <div><label className="fl">IPO Price (₹) *</label><input className="fi" name="ipo_price" type="number" value={strVal(form.ipo_price)} onChange={chg} placeholder="250" /></div>
            <div><label className="fl">Lot Size</label><input className="fi" name="lot_size" type="number" value={strVal(form.lot_size)} onChange={chg} placeholder="72" /></div>
            <div><label className="fl">Lots Applied</label><input className="fi" name="lots_applied" type="number" value={strVal(form.lots_applied)} onChange={chg} placeholder="1" /></div>
            <div><label className="fl">GMP at Apply (₹)</label><input className="fi" name="gmp_at_apply" type="number" value={strVal(form.gmp_at_apply)} onChange={chg} placeholder="80" /></div>
            <div><label className="fl">Amount Applied</label><input className="fi" name="amount_applied" type="number" value={strVal(form.amount_applied)} onChange={chg} placeholder="18000" /></div>
            <div><label className="fl">Amount Blocked</label><input className="fi" name="amount_paid" type="number" value={strVal(form.amount_paid)} onChange={chg} placeholder="14400" /></div>
            <div><label className="fl">Allotted?</label><select className="fi" name="allotted" value={form.allotted} onChange={chg}><option>Yes</option><option>No</option></select></div>
            <div><label className="fl">Qty Allotted</label><input className="fi" name="qty_allotted" type="number" value={strVal(form.qty_allotted)} onChange={chg} placeholder="72" disabled={form.allotted === 'No'} /></div>
          </div>
        </div>

        <div style={ss}>
          <span style={sl}>📈 Listing & Exit</span>
          <div style={{ display: 'grid', gridTemplateColumns: isMob ? '1fr 1fr' : '1fr 1fr 1fr', gap: 10 }}>
            <div><label className="fl">Listing Date</label><input className="fi" name="listing_date" type="date" value={strVal(form.listing_date)} onChange={chg} /></div>
            <div><label className="fl">Listing Price (₹)</label><input className="fi" name="listing_price" type="number" value={strVal(form.listing_price)} onChange={chg} placeholder="310" /></div>
            <div><label className="fl">Selling Price (₹)</label><input className="fi" name="selling_price" type="number" value={strVal(form.selling_price)} onChange={chg} placeholder="320" /></div>
            <div><label className="fl">Selling Date</label><input className="fi" name="selling_date" type="date" value={strVal(form.selling_date)} onChange={chg} /></div>
            <div style={{ gridColumn: isMob ? '1/-1' : undefined }}><label className="fl">Status</label><select className="fi" name="status" value={form.status} onChange={chg}>{['Sold on Listing', 'Holding', 'Sold Later', 'Not Allotted', 'Listed - Pending Sale'].map(s => <option key={s}>{s}</option>)}</select></div>
            <div style={{ gridColumn: isMob ? '1/-1' : undefined }}><label className="fl">Notes</label><input className="fi" name="notes" value={strVal(form.notes)} onChange={chg} placeholder="Remarks..." /></div>
          </div>
        </div>

        {form.allotted === 'Yes' && qty > 0 && ipoP > 0 && (
          <div style={{ background: 'linear-gradient(135deg,rgba(0,229,160,0.05),rgba(0,151,255,0.05))', border: '1px solid rgba(0,229,160,0.15)', borderRadius: 12, padding: 14, marginBottom: 16 }}>
            <div style={{ fontSize: 10, color: '#00e5a0', textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: 12, fontWeight: 700 }}>⚡ P&L Preview</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div><div style={{ fontSize: 9, color: '#444', textTransform: 'uppercase', marginBottom: 4 }}>Cost</div><div style={{ fontFamily: 'JetBrains Mono', fontSize: 15, fontWeight: 800 }}>{fmtL(ipoP * qty)}</div></div>
              {listP > 0 && listingGain !== null && <div><div style={{ fontSize: 9, color: '#444', textTransform: 'uppercase', marginBottom: 4 }}>Listing Gain</div><div style={{ fontFamily: 'JetBrains Mono', fontSize: 15, fontWeight: 800, color: listingGain >= 0 ? '#00e5a0' : '#ff4f4f' }}>{listingGain >= 0 ? '+' : ''}{fmtL(listingGain)}</div></div>}
              {sellP > 0 && profit !== null && <div><div style={{ fontSize: 9, color: '#444', textTransform: 'uppercase', marginBottom: 4 }}>P&L</div><div style={{ fontFamily: 'JetBrains Mono', fontSize: 15, fontWeight: 800, color: profit >= 0 ? '#00e5a0' : '#ff4f4f' }}>{profit >= 0 ? '+' : ''}{fmtL(profit)}</div></div>}
              {profitPct !== null && <div><div style={{ fontSize: 9, color: '#444', textTransform: 'uppercase', marginBottom: 4 }}>Return %</div><div style={{ fontFamily: 'JetBrains Mono', fontSize: 15, fontWeight: 800, color: profitPct >= 0 ? '#00e5a0' : '#ff4f4f' }}>{profitPct >= 0 ? '+' : ''}{profitPct.toFixed(2)}%</div></div>}
            </div>
          </div>
        )}
        <div style={{ display: 'flex', gap: 10 }}>
          <button className="bp" onClick={handleSave} style={{ flex: 1 }}>{form.id ? '✓ Update IPO' : '＋ Log IPO'}</button>
          <button className="bg" onClick={onClose}>Cancel</button>
        </div>
      </div>
    </div>
  )
}

// ─── MAIN APP ───
type Page = 'journal' | 'ipo' | 'dashboard' | 'add'
interface TradeForm { symbol: string; sector: string; status: string; buyPrice: string; qty: string; sl: string; target: string; buyDate: string; reason: string; timing: string; imageUrl: string; chartLink: string; tags: string; exitPrice: string; exitDate: string }

export default function Home() {
  const router = useRouter()
  const supabase = createClient()
  const [user, setUser] = useState<User | null>(null)
  const [page, setPage] = useState<Page>('journal')
  const [trades, setTrades] = useState<Trade[]>([])
  const [capital, setCapital] = useState<Capital>({ user_id: '', total: 500000 })
  const [editId, setEditId] = useState<number | null>(null)
  const [filter, setFilter] = useState('All')
  const [calcInputs, setCalcInputs] = useState({ overallCapital: '', riskPct: '1', sl: '' })
  const [stockPrice, setStockPrice] = useState('')
  const [qtyResult, setQtyResult] = useState('')
  const [form, setForm] = useState<TradeForm | null>(null)
  const [ipoRecords, setIpoRecords] = useState<IpoRecord[]>([])
  const [ipoAccounts, setIpoAccounts] = useState<IpoAccount[]>([])
  const [showIPOModal, setShowIPOModal] = useState(false)
  const [editIPO, setEditIPO] = useState<IpoRecord | null>(null)
  const [showAccountModal, setShowAccountModal] = useState(false)
  const [editAccount, setEditAccount] = useState<IpoAccount | null>(null)
  const [ipoFilter, setIpoFilter] = useState('All')
  const [ipoYearFilter, setIpoYearFilter] = useState('All')
  const [ipoAccountFilter, setIpoAccountFilter] = useState('All')
  const [dataLoading, setDataLoading] = useState(true)
  const [showUserMenu, setShowUserMenu] = useState(false)
  const w = useWindowWidth(); const isMob = w < 640

  const emptyForm: TradeForm = { symbol: '', sector: 'Technology', status: 'Running', buyPrice: '', qty: '', sl: '', target: '', buyDate: new Date().toISOString().split('T')[0], reason: '', timing: '', imageUrl: '', chartLink: '', tags: '', exitPrice: '', exitDate: '' }

  // Get current user on mount
  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => setUser(user))
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => {
      setUser(session?.user ?? null)
      if (!session) router.push('/login')
    })
    return () => subscription.unsubscribe()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const loadData = useCallback(async () => {
    setDataLoading(true)
    try {
      const [t, ir, ia, c] = await Promise.all([apiGet('/api/trades'), apiGet('/api/ipo-records'), apiGet('/api/ipo-accounts'), apiGet('/api/capital')])
      setTrades(t || []); setIpoRecords(ir || []); setIpoAccounts(ia || []); setCapital(c || { user_id: '', total: 500000 })
    } catch (e) { console.error('Load failed', e) }
    setDataLoading(false)
  }, [])

  useEffect(() => { if (user) loadData() }, [user, loadData])

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/login')
  }

  const hFormChg = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setForm(f => f ? { ...f, [e.target.name]: e.target.value } : f)

  const handleSubmit = async () => {
    if (!form?.symbol || !form.buyPrice || !form.qty || !form.sl) { alert('Fill Symbol, Buy Price, Qty, SL.'); return }
    const deployed = (parseFloat(form.buyPrice) || 0) * (parseFloat(form.qty) || 0)
    const trade: Partial<Trade> = {
      id: editId || Date.now(), symbol: form.symbol, sector: form.sector, status: form.status as Trade['status'],
      buy_price: parseFloat(form.buyPrice), qty: parseFloat(form.qty), sl: parseFloat(form.sl),
      target: form.target ? parseFloat(form.target) : undefined, buy_date: form.buyDate,
      reason: form.reason, timing: form.timing, image_url: form.imageUrl, chart_link: form.chartLink,
      tags: form.tags, exit_price: form.exitPrice ? parseFloat(form.exitPrice) : undefined,
      exit_date: form.exitDate || undefined, deployed,
    }
    await apiPost('/api/trades', trade)
    await loadData(); setPage('journal'); setForm(null)
  }

  const deleteTrade = async (id: number) => { await apiDelete('/api/trades', { id }); await loadData(); setPage('journal') }
  const handleSaveIPO = async (ipo: IpoRecord) => { await apiPost('/api/ipo-records', ipo); await loadData(); setShowIPOModal(false); setEditIPO(null) }
  const handleSaveAccount = async (acct: IpoAccount) => { await apiPost('/api/ipo-accounts', acct); await loadData(); setShowAccountModal(false); setEditAccount(null) }
  const handleCapitalChange = async (val: number) => { setCapital(c => ({ ...c, total: val })); await apiPost('/api/capital', { total: val }) }

  // ─── Derived stats ───
  const filteredTrades = filter === 'All' ? trades : trades.filter(t => t.status === filter)
  const totalDeployed = trades.filter(t => t.status === 'Running').reduce((a, t) => a + (t.deployed || 0), 0)
  const exitedTrades = trades.filter(t => t.exit_price && t.qty)
  const winTrades = exitedTrades.filter(t => (t.exit_price || 0) > t.buy_price)
  const lossTrades = exitedTrades.filter(t => (t.exit_price || 0) <= t.buy_price)
  const pnl = exitedTrades.reduce((a, t) => a + ((t.exit_price || 0) - t.buy_price) * t.qty, 0)
  const calc = calcInputs.overallCapital && calcInputs.riskPct && calcInputs.sl ? (() => { const rA = (parseFloat(calcInputs.overallCapital) * parseFloat(calcInputs.riskPct)) / 100; return { riskAmount: rA, positionSize: rA / (parseFloat(calcInputs.sl) / 100) } })() : null
  const ipoAllotted = ipoRecords.filter(r => r.allotted === 'Yes')
  const ipoSold = ipoAllotted.filter(r => r.selling_price && r.qty_allotted)
  const totalIPOProfit = ipoSold.reduce((a, r) => a + (((r.selling_price || 0) - r.ipo_price) * (r.qty_allotted || 0)), 0)
  const ipoWins = ipoSold.filter(r => (r.selling_price || 0) > r.ipo_price).length
  const totalIPOInvested = ipoAllotted.reduce((a, r) => a + (r.ipo_price * (r.qty_allotted || 0)), 0)
  const ipoByYear = ipoRecords.reduce<Record<string, { applied: number; allotted: number; profit: number; invested: number }>>((a, r) => {
    if (!a[r.year]) a[r.year] = { applied: 0, allotted: 0, profit: 0, invested: 0 }
    a[r.year].applied++
    if (r.allotted === 'Yes') { a[r.year].allotted++; a[r.year].invested += r.ipo_price * (r.qty_allotted || 0); if (r.selling_price && r.qty_allotted) a[r.year].profit += (r.selling_price - r.ipo_price) * r.qty_allotted }
    return a
  }, {})
  const filteredIPO = ipoRecords.filter(r => {
    const sOk = ipoFilter === 'All' || r.status === ipoFilter || (ipoFilter === 'Allotted' && r.allotted === 'Yes') || (ipoFilter === 'Not Allotted' && r.allotted === 'No')
    return sOk && (ipoYearFilter === 'All' || r.year === ipoYearFilter) && (ipoAccountFilter === 'All' || String(r.account_id) === ipoAccountFilter)
  })
  const ipoAccountMap = Object.fromEntries(ipoAccounts.map(a => [a.id, a]))
  const navItems = [{ id: 'journal', label: 'Journal', icon: '📋' }, { id: 'ipo', label: 'IPO', icon: '🚀' }, { id: 'dashboard', label: 'Dashboard', icon: '📊' }]

  const BottomNav = () => (
    <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, background: 'rgba(10,11,15,0.97)', borderTop: '1px solid #1a1b20', backdropFilter: 'blur(20px)', display: 'flex', zIndex: 300, paddingBottom: 'env(safe-area-inset-bottom,0px)' }}>
      {navItems.map(n => (
        <button key={n.id} onClick={() => setPage(n.id as Page)} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, padding: '10px 4px', background: 'none', border: 'none', cursor: 'pointer', color: page === n.id ? '#00e5a0' : '#444', fontFamily: 'Syne,sans-serif', fontSize: 9, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', transition: 'color 0.2s' }}>
          <span style={{ fontSize: 20 }}>{n.icon}</span>{n.label}
        </button>
      ))}
    </div>
  )

  return (
    <div style={{ fontFamily: "'Syne',sans-serif", background: '#0a0b0f', minHeight: '100vh', color: '#e8e6e0' }}>
      {showIPOModal && <IPOModal ipo={editIPO} accounts={ipoAccounts} onSave={handleSaveIPO} onClose={() => { setShowIPOModal(false); setEditIPO(null) }} />}
      {showAccountModal && <AccountModal account={editAccount} onSave={handleSaveAccount} onClose={() => { setShowAccountModal(false); setEditAccount(null) }} />}

      {/* ── HEADER ── */}
      <header style={{ borderBottom: '1px solid #111318', padding: isMob ? '0 16px' : '0 28px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 56, position: 'sticky', top: 0, background: 'rgba(10,11,15,0.97)', backdropFilter: 'blur(20px)', zIndex: 200 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 30, height: 30, background: 'linear-gradient(135deg,#00e5a0,#0097ff)', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15, fontWeight: 800, color: '#0a0b0f', flexShrink: 0 }}>S</div>
          <div>
            <div style={{ fontWeight: 800, fontSize: isMob ? 13 : 15, letterSpacing: '-0.03em' }}>SwingJournal</div>
            {!isMob && <div style={{ fontSize: 9, color: '#2a2a2a', letterSpacing: '0.2em', textTransform: 'uppercase' }}>NSE · IPO · LIVE</div>}
          </div>
        </div>
        {!isMob && (
          <nav style={{ display: 'flex', gap: 2 }}>
            {navItems.map(n => <button key={n.id} className={`nb ${page === n.id ? 'on' : ''}`} onClick={() => setPage(n.id as Page)}>{n.icon} {n.label}</button>)}
          </nav>
        )}
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          {page === 'ipo' && !isMob && <button className="bg" style={{ fontSize: 11, padding: '7px 12px' }} onClick={() => { setEditAccount(null); setShowAccountModal(true) }}>👤 Account</button>}
          {page === 'ipo' && <button className="bp" style={{ fontSize: 11, padding: '8px 14px' }} onClick={() => { setEditIPO(null); setShowIPOModal(true) }}>🚀 {isMob ? '' : 'Log IPO'}</button>}
          {page === 'journal' && <button className="bp" style={{ fontSize: 11, padding: '8px 14px' }} onClick={() => { setForm(emptyForm); setEditId(null); setPage('add') }}>＋ {isMob ? '' : 'Add Trade'}</button>}
          {/* User avatar / menu */}
          <div style={{ position: 'relative' }}>
            <button onClick={() => setShowUserMenu(v => !v)} style={{ width: 32, height: 32, borderRadius: '50%', background: 'linear-gradient(135deg,#1a1b20,#252830)', border: '1px solid #2a2d36', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, color: '#888', flexShrink: 0 }}>
              {user?.email?.[0]?.toUpperCase() || '?'}
            </button>
            {showUserMenu && (
              <div style={{ position: 'absolute', top: 'calc(100% + 8px)', right: 0, background: '#111318', border: '1px solid #1e2028', borderRadius: 12, minWidth: 200, zIndex: 500, overflow: 'hidden', boxShadow: '0 16px 48px rgba(0,0,0,0.6)' }} onClick={() => setShowUserMenu(false)}>
                <div style={{ padding: '12px 14px', borderBottom: '1px solid #1a1b20' }}>
                  <div style={{ fontSize: 10, color: '#444', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 3 }}>Signed in as</div>
                  <div style={{ fontSize: 12, color: '#888', wordBreak: 'break-all' }}>{user?.email}</div>
                </div>
                <button onClick={handleLogout} style={{ width: '100%', padding: '12px 14px', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', fontSize: 13, color: '#ff4f4f', fontFamily: 'Syne,sans-serif', fontWeight: 700 }}>
                  ⎋ Sign Out
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      <main style={{ maxWidth: 1280, margin: '0 auto', padding: isMob ? '16px 12px 80px' : '24px 24px 40px' }}>
        {dataLoading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '60px 0', color: '#444', gap: 12, alignItems: 'center' }}>
            <div className="spin-sm" style={{ width: 20, height: 20 }} /><span style={{ fontSize: 13 }}>Loading...</span>
          </div>
        ) : (
          <>
            {/* ═══ JOURNAL ═══ */}
            {page === 'journal' && (
              <div className="fu">
                <div style={{ display: 'grid', gridTemplateColumns: isMob ? 'repeat(2,1fr)' : 'repeat(5,1fr)', gap: 8, marginBottom: 16 }}>
                  {[
                    { val: trades.length, lbl: 'Total', icon: '📋' },
                    { val: trades.filter(t => t.status === 'Running').length, lbl: 'Open', color: '#00e5a0', icon: '🟢' },
                    { val: winTrades.length, lbl: 'Winners', color: '#00e5a0', icon: '✅' },
                    { val: lossTrades.length, lbl: 'Losers', color: '#ff4f4f', icon: '❌' },
                    { val: `${pnl >= 0 ? '+' : ''}${fmtL(pnl)}`, lbl: 'P&L', color: pnl >= 0 ? '#00e5a0' : '#ff4f4f', icon: '📈', full: isMob },
                  ].map((s, i) => (
                    <div key={i} className="card" style={{ textAlign: 'center', padding: '12px 8px', gridColumn: s.full ? '1/-1' : undefined }}>
                      <div style={{ fontSize: 18, marginBottom: 4 }}>{s.icon}</div>
                      <div style={{ fontFamily: 'JetBrains Mono', fontSize: isMob ? 18 : 20, fontWeight: 800, color: s.color || '#e8e6e0' }}>{s.val}</div>
                      <div style={{ fontSize: 9, color: '#444', textTransform: 'uppercase', letterSpacing: '0.1em', marginTop: 3 }}>{s.lbl}</div>
                    </div>
                  ))}
                </div>
                <div className="sb" style={{ display: 'flex', gap: 6, marginBottom: 16 }}>
                  {['All', 'Running', 'Exited', 'Stop Hit'].map(f => <button key={f} className={`fb ${filter === f ? 'on' : ''}`} onClick={() => setFilter(f)}>{f}</button>)}
                </div>
                {filteredTrades.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '60px 0' }}>
                    <div style={{ fontSize: 50, marginBottom: 14 }}>📊</div>
                    <div style={{ fontWeight: 800, fontSize: 18, color: '#222' }}>No trades yet</div>
                    <button className="bp" onClick={() => { setForm(emptyForm); setEditId(null); setPage('add') }} style={{ marginTop: 16 }}>＋ Add First Trade</button>
                  </div>
                ) : (
                  <div style={{ display: 'grid', gridTemplateColumns: isMob ? '1fr' : 'repeat(auto-fill,minmax(340px,1fr))', gap: 12 }}>
                    {filteredTrades.map(trade => {
                      const cpnl = trade.exit_price ? ((trade.exit_price - trade.buy_price) * trade.qty) : null
                      const pPct = trade.exit_price ? ((trade.exit_price - trade.buy_price) / trade.buy_price * 100) : null
                      const slPct = trade.sl && trade.buy_price ? (((trade.buy_price - trade.sl) / trade.buy_price) * 100).toFixed(1) : null
                      const tPct = trade.target && trade.buy_price ? (((trade.target - trade.buy_price) / trade.buy_price) * 100).toFixed(1) : null
                      const rr = slPct && tPct ? (parseFloat(tPct) / parseFloat(slPct)).toFixed(1) : null
                      const sc = STATUS_COLORS[trade.status]
                      return (
                        <div key={trade.id} className="tc" onClick={() => { setForm({ symbol: trade.symbol, sector: trade.sector, status: trade.status, buyPrice: String(trade.buy_price), qty: String(trade.qty), sl: String(trade.sl), target: String(trade.target || ''), buyDate: trade.buy_date, reason: trade.reason || '', timing: trade.timing || '', imageUrl: trade.image_url || '', chartLink: trade.chart_link || '', tags: trade.tags || '', exitPrice: String(trade.exit_price || ''), exitDate: trade.exit_date || '' }); setEditId(trade.id); setPage('add') }}>
                          {trade.image_url && (
                            <div style={{ height: 120, overflow: 'hidden', position: 'relative' }}>
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img src={trade.image_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={e => { (e.target as HTMLImageElement).parentElement!.style.display = 'none' }} />
                              <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to bottom,transparent 30%,#111318 100%)' }} />
                              <div style={{ position: 'absolute', bottom: 10, left: 14, right: 14, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
                                <div style={{ fontWeight: 800, fontSize: 16 }}>{trade.symbol}</div>
                                <span className="pill" style={{ background: `${sc}20`, color: sc, border: `1px solid ${sc}40` }}>{trade.status}</span>
                              </div>
                            </div>
                          )}
                          <div style={{ padding: 14 }}>
                            {!trade.image_url && (
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                                <div><div style={{ fontSize: 17, fontWeight: 800 }}>{trade.symbol}</div><div style={{ fontSize: 10, color: '#444', marginTop: 1 }}>{trade.sector} · {trade.buy_date}</div></div>
                                <span className="pill" style={{ background: `${sc}18`, color: sc, border: `1px solid ${sc}30` }}>{trade.status}</span>
                              </div>
                            )}
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6, marginBottom: 8, background: '#0d0e12', borderRadius: 8, padding: 10 }}>
                              <div><div style={{ fontSize: 9, color: '#333', textTransform: 'uppercase', marginBottom: 2 }}>Buy</div><div style={{ fontFamily: 'JetBrains Mono', fontSize: 12, fontWeight: 600 }}>₹{trade.buy_price.toLocaleString('en-IN')}</div></div>
                              <div><div style={{ fontSize: 9, color: '#333', textTransform: 'uppercase', marginBottom: 2 }}>SL {slPct && <span style={{ color: '#ff4f4f' }}>-{slPct}%</span>}</div><div style={{ fontFamily: 'JetBrains Mono', fontSize: 12, color: '#ff6b6b' }}>₹{trade.sl || '—'}</div></div>
                              <div><div style={{ fontSize: 9, color: '#333', textTransform: 'uppercase', marginBottom: 2 }}>Tgt {tPct && <span style={{ color: '#00e5a0' }}>+{tPct}%</span>}</div><div style={{ fontFamily: 'JetBrains Mono', fontSize: 12, color: '#00e5a0' }}>₹{trade.target || '—'}</div></div>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 4 }}>
                              <div style={{ fontSize: 11, color: '#444' }}>{trade.qty.toLocaleString()} qty{rr && <span style={{ marginLeft: 6, color: '#0097ff' }}>R:R 1:{rr}</span>}</div>
                              {cpnl !== null && pPct !== null && <div style={{ fontFamily: 'JetBrains Mono', fontSize: 12, fontWeight: 700, color: cpnl >= 0 ? '#00e5a0' : '#ff4f4f' }}>{cpnl >= 0 ? '+' : ''}{fmtL(cpnl)} ({pPct >= 0 ? '+' : ''}{pPct.toFixed(1)}%)</div>}
                            </div>
                            {trade.reason && <div style={{ fontSize: 11, color: '#555', lineHeight: 1.6, marginTop: 8, borderLeft: '2px solid #1a1b20', paddingLeft: 8 }}>{trade.reason.slice(0, 80)}{trade.reason.length > 80 ? '…' : ''}</div>}
                            {trade.tags && <div style={{ marginTop: 6 }}>{trade.tags.split(',').map(t => t.trim()).filter(Boolean).map(t => <span key={t} className="tag">{t}</span>)}</div>}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )}

            {/* ═══ IPO ═══ */}
            {page === 'ipo' && (
              <div className="fu">
                <div style={{ display: 'grid', gridTemplateColumns: isMob ? 'repeat(2,1fr)' : 'repeat(5,1fr)', gap: 8, marginBottom: 16 }}>
                  {[
                    { val: ipoRecords.length, lbl: 'Applied', icon: '📋' },
                    { val: ipoAllotted.length, lbl: 'Allotted', color: '#00e5a0', icon: '✅' },
                    { val: ipoRecords.length - ipoAllotted.length, lbl: 'Missed', color: '#888', icon: '❌' },
                    { val: ipoRecords.length > 0 ? `${((ipoAllotted.length / ipoRecords.length) * 100).toFixed(0)}%` : '—', lbl: 'Success', color: '#0097ff', icon: '🎯' },
                    { val: `${totalIPOProfit >= 0 ? '+' : ''}${fmtL(totalIPOProfit)}`, lbl: 'P&L', color: totalIPOProfit >= 0 ? '#00e5a0' : '#ff4f4f', icon: '📈', full: isMob },
                  ].map((s, i) => (
                    <div key={i} className="card" style={{ textAlign: 'center', padding: '12px 8px', gridColumn: s.full ? '1/-1' : undefined }}>
                      <div style={{ fontSize: 18, marginBottom: 4 }}>{s.icon}</div>
                      <div style={{ fontFamily: 'JetBrains Mono', fontSize: isMob ? 16 : 18, fontWeight: 800, color: s.color || '#e8e6e0' }}>{s.val}</div>
                      <div style={{ fontSize: 9, color: '#444', textTransform: 'uppercase', letterSpacing: '0.1em', marginTop: 3 }}>{s.lbl}</div>
                    </div>
                  ))}
                </div>

                {Object.keys(ipoByYear).length > 0 && (
                  <div className="card" style={{ marginBottom: 16 }}>
                    <div style={{ fontSize: 10, color: '#444', textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: 14, fontWeight: 700 }}>📅 Year-on-Year Returns</div>
                    <div className="sb">
                      <table style={{ width: '100%', fontSize: isMob ? 11 : 13, minWidth: isMob ? 480 : 'auto' }}>
                        <thead><tr style={{ borderBottom: '1px solid #1e2028' }}>{['Year', 'Applied', 'Allotted', 'Invested', 'P&L', 'Return%', 'W/L'].map(h => <th key={h} style={{ padding: '6px 10px', textAlign: 'left', fontSize: 9, color: '#444', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 700, whiteSpace: 'nowrap' }}>{h}</th>)}</tr></thead>
                        <tbody>
                          {Object.entries(ipoByYear).sort((a, b) => Number(b[0]) - Number(a[0])).map(([yr, d]) => {
                            const rPct = d.invested > 0 ? (d.profit / d.invested * 100) : 0
                            const sold = ipoRecords.filter(r => r.year === yr && r.allotted === 'Yes' && r.selling_price).length
                            const wins = ipoRecords.filter(r => r.year === yr && r.allotted === 'Yes' && r.selling_price && (r.selling_price > r.ipo_price)).length
                            return (
                              <tr key={yr} style={{ borderBottom: '1px solid #111318' }}>
                                <td style={{ padding: '10px 10px', fontFamily: 'JetBrains Mono', fontWeight: 700, color: '#00e5a0' }}>{yr}</td>
                                <td style={{ padding: '10px 10px', color: '#888' }}>{d.applied}</td>
                                <td style={{ padding: '10px 10px' }}>{d.allotted}</td>
                                <td style={{ padding: '10px 10px', fontFamily: 'JetBrains Mono', fontSize: 11, color: '#888' }}>{d.invested > 0 ? fmtL(d.invested) : '—'}</td>
                                <td style={{ padding: '10px 10px', fontFamily: 'JetBrains Mono', fontWeight: 700, color: d.profit >= 0 ? '#00e5a0' : '#ff4f4f' }}>{d.profit !== 0 ? `${d.profit >= 0 ? '+' : ''}${fmtL(d.profit)}` : '—'}</td>
                                <td style={{ padding: '10px 10px' }}>{rPct !== 0 && <span style={{ fontFamily: 'JetBrains Mono', fontWeight: 700, color: rPct >= 0 ? '#00e5a0' : '#ff4f4f', background: rPct >= 0 ? 'rgba(0,229,160,0.08)' : 'rgba(255,79,79,0.08)', padding: '2px 7px', borderRadius: 6, fontSize: 11 }}>{rPct >= 0 ? '+' : ''}{rPct.toFixed(1)}%</span>}</td>
                                <td style={{ padding: '10px 10px', color: '#888' }}>{sold > 0 ? `${wins}/${sold}` : '—'}</td>
                              </tr>
                            )
                          })}
                          <tr style={{ borderTop: '2px solid #1e2028', background: '#0d0e12' }}>
                            <td style={{ padding: '10px 10px', fontFamily: 'JetBrains Mono', fontWeight: 800 }}>TOTAL</td>
                            <td style={{ padding: '10px 10px', fontWeight: 700 }}>{ipoRecords.length}</td>
                            <td style={{ padding: '10px 10px', fontWeight: 700 }}>{ipoAllotted.length}</td>
                            <td style={{ padding: '10px 10px', fontFamily: 'JetBrains Mono', fontSize: 11 }}>{totalIPOInvested > 0 ? fmtL(totalIPOInvested) : '—'}</td>
                            <td style={{ padding: '10px 10px', fontFamily: 'JetBrains Mono', fontWeight: 800, color: totalIPOProfit >= 0 ? '#00e5a0' : '#ff4f4f' }}>{totalIPOProfit !== 0 ? `${totalIPOProfit >= 0 ? '+' : ''}${fmtL(totalIPOProfit)}` : '—'}</td>
                            <td style={{ padding: '10px 10px' }}>{totalIPOInvested > 0 && <span style={{ fontFamily: 'JetBrains Mono', fontWeight: 800, color: totalIPOProfit >= 0 ? '#00e5a0' : '#ff4f4f', background: totalIPOProfit >= 0 ? 'rgba(0,229,160,0.1)' : 'rgba(255,79,79,0.1)', padding: '3px 8px', borderRadius: 6, fontSize: 11 }}>{(totalIPOProfit / totalIPOInvested * 100) >= 0 ? '+' : ''}{(totalIPOProfit / totalIPOInvested * 100).toFixed(1)}%</span>}</td>
                            <td style={{ padding: '10px 10px', fontWeight: 700, color: '#888' }}>{ipoSold.length > 0 ? `${ipoWins}/${ipoSold.length}` : '—'}</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {ipoAccounts.length > 0 && (
                  <div className="card" style={{ marginBottom: 16 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                      <div style={{ fontSize: 10, color: '#444', textTransform: 'uppercase', letterSpacing: '0.12em', fontWeight: 700 }}>👤 Accounts ({ipoAccounts.length})</div>
                      <button className="bg" style={{ fontSize: 11, padding: '5px 10px' }} onClick={() => { setEditAccount(null); setShowAccountModal(true) }}>＋ Add</button>
                    </div>
                    <div className="sb" style={{ display: 'flex', gap: 10, paddingBottom: 6 }}>
                      {ipoAccounts.map(a => (
                        <div key={a.id} style={{ background: '#0d0e12', border: '1px solid #1e2028', borderRadius: 10, padding: '12px 14px', minWidth: 160, flexShrink: 0, cursor: 'pointer' }} onClick={() => { setEditAccount(a); setShowAccountModal(true) }}>
                          <div style={{ fontWeight: 700, fontSize: 13 }}>{a.holder_name}</div>
                          <div style={{ fontSize: 10, color: '#555', marginBottom: 6 }}>PAN: <span style={{ fontFamily: 'JetBrains Mono', color: '#888' }}>{a.pan || '—'}</span></div>
                          <div><span style={{ fontSize: 9, background: 'rgba(0,151,255,0.08)', color: '#0097ff', padding: '2px 7px', borderRadius: 10, border: '1px solid rgba(0,151,255,0.15)' }}>{a.demat_provider}</span></div>
                          <div style={{ marginTop: 6, fontSize: 10, color: '#333' }}>{ipoRecords.filter(r => String(r.account_id) === String(a.id)).length} IPOs · {ipoRecords.filter(r => String(r.account_id) === String(a.id) && r.allotted === 'Yes').length} allotted</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div style={{ marginBottom: 14 }}>
                  <div className="sb" style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
                    {['All', 'Allotted', 'Not Allotted', 'Sold on Listing', 'Holding', 'Sold Later'].map(f => <button key={f} className={`fb ${ipoFilter === f ? 'on' : ''}`} onClick={() => setIpoFilter(f)}>{f}</button>)}
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <select className="fi" value={ipoYearFilter} onChange={e => setIpoYearFilter(e.target.value)} style={{ flex: 1, padding: '7px 10px', fontSize: 12 }}>
                      <option value="All">All Years</option>{YEARS.map(y => <option key={y}>{y}</option>)}
                    </select>
                    <select className="fi" value={ipoAccountFilter} onChange={e => setIpoAccountFilter(e.target.value)} style={{ flex: 1, padding: '7px 10px', fontSize: 12 }}>
                      <option value="All">All Accounts</option>{ipoAccounts.map(a => <option key={a.id} value={a.id}>{a.holder_name}</option>)}
                    </select>
                  </div>
                </div>

                {filteredIPO.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '60px 0' }}>
                    <div style={{ fontSize: 50, marginBottom: 14 }}>🚀</div>
                    <div style={{ fontWeight: 800, fontSize: 18, color: '#222' }}>No IPOs logged yet</div>
                    <button className="bp" onClick={() => { setEditIPO(null); setShowIPOModal(true) }} style={{ marginTop: 16 }}>🚀 Log First IPO</button>
                  </div>
                ) : (
                  <div style={{ display: 'grid', gridTemplateColumns: isMob ? '1fr' : 'repeat(auto-fill,minmax(320px,1fr))', gap: 12 }}>
                    {filteredIPO.map(r => {
                      const iP = r.ipo_price; const qty = r.qty_allotted || 0; const sP = r.selling_price || 0; const lP = r.listing_price || 0
                      const profit = qty > 0 && sP > 0 ? (sP - iP) * qty : null
                      const profitPct = iP > 0 && sP > 0 ? ((sP - iP) / iP * 100) : null
                      const lGainPct = iP > 0 && lP > 0 ? ((lP - iP) / iP * 100) : null
                      const acct = r.account_id ? ipoAccountMap[r.account_id] : null
                      const scMap: Record<string, string> = { 'Sold on Listing': '#00e5a0', 'Holding': '#ffa500', 'Sold Later': '#0097ff', 'Not Allotted': '#555', 'Listed - Pending Sale': '#ffd700' }
                      const statusColor = scMap[r.status] || '#888'
                      return (
                        <div key={r.id} className={`ic ${profit !== null && profit > 0 ? 'iw' : profit !== null && profit < 0 ? 'il' : ''}`} onClick={() => { setEditIPO(r); setShowIPOModal(true) }}>
                          <div style={{ padding: 14 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                              <div style={{ flex: 1, marginRight: 8 }}>
                                <div style={{ fontWeight: 800, fontSize: 15 }}>{r.company_name}</div>
                                {r.symbol && <div style={{ fontFamily: 'JetBrains Mono', fontSize: 10, color: '#00e5a0', marginTop: 1 }}>{r.symbol} · {r.exchange}</div>}
                                <div style={{ fontSize: 10, color: '#444', marginTop: 2 }}>{r.sector} · {r.year}</div>
                              </div>
                              <div style={{ display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'flex-end', flexShrink: 0 }}>
                                <span className="pill" style={{ background: `${statusColor}18`, color: statusColor, border: `1px solid ${statusColor}30`, fontSize: 9 }}>{r.status}</span>
                                <span className="pill" style={{ background: r.allotted === 'Yes' ? 'rgba(0,229,160,0.08)' : 'rgba(136,136,136,0.08)', color: r.allotted === 'Yes' ? '#00e5a0' : '#555', border: `1px solid ${r.allotted === 'Yes' ? 'rgba(0,229,160,0.2)' : '#1e2028'}`, fontSize: 9 }}>{r.allotted === 'Yes' ? '✓ Got' : '✗ Missed'}</span>
                              </div>
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6, background: '#0d0e12', borderRadius: 8, padding: 10, marginBottom: 8 }}>
                              <div><div style={{ fontSize: 9, color: '#333', textTransform: 'uppercase', marginBottom: 2 }}>IPO</div><div style={{ fontFamily: 'JetBrains Mono', fontSize: 12, fontWeight: 700 }}>₹{r.ipo_price || '—'}</div></div>
                              <div><div style={{ fontSize: 9, color: '#333', textTransform: 'uppercase', marginBottom: 2 }}>List {lGainPct !== null && <span style={{ color: lGainPct >= 0 ? '#00e5a0' : '#ff4f4f' }}>{lGainPct >= 0 ? '▲' : '▼'}{Math.abs(lGainPct).toFixed(0)}%</span>}</div><div style={{ fontFamily: 'JetBrains Mono', fontSize: 12, color: '#888' }}>₹{r.listing_price || '—'}</div></div>
                              <div><div style={{ fontSize: 9, color: '#333', textTransform: 'uppercase', marginBottom: 2 }}>Sold</div><div style={{ fontFamily: 'JetBrains Mono', fontSize: 12, color: sP > iP ? '#00e5a0' : sP < iP && sP > 0 ? '#ff4f4f' : '#888' }}>₹{r.selling_price || '—'}</div></div>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 6 }}>
                              <div style={{ display: 'flex', gap: 5 }}>
                                {r.subscription_times && <span style={{ fontSize: 9, color: '#444', background: '#0a0b0f', border: '1px solid #1a1b20', padding: '2px 6px', borderRadius: 6 }}>🔥 {r.subscription_times}×</span>}
                                {r.gmp_at_apply && <span style={{ fontSize: 9, color: '#ffa500', background: 'rgba(255,165,0,0.06)', border: '1px solid rgba(255,165,0,0.15)', padding: '2px 6px', borderRadius: 6 }}>GMP ₹{r.gmp_at_apply}</span>}
                                {acct && <span style={{ fontSize: 9, color: '#444' }}>👤 {acct.holder_name}</span>}
                              </div>
                              {profit !== null && profitPct !== null && (
                                <div style={{ fontFamily: 'JetBrains Mono', fontSize: 12, fontWeight: 800, color: profit >= 0 ? '#00e5a0' : '#ff4f4f' }}>
                                  {profit >= 0 ? '+' : ''}{fmtL(profit)} ({profitPct >= 0 ? '+' : ''}{profitPct.toFixed(1)}%)
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )}

            {/* ═══ DASHBOARD ═══ */}
            {page === 'dashboard' && (
              <div className="fu">
                <h2 style={{ fontSize: isMob ? 18 : 22, fontWeight: 800, marginBottom: 18, letterSpacing: '-0.03em' }}>Dashboard</h2>
                <div style={{ display: 'grid', gridTemplateColumns: isMob ? '1fr' : '1fr 1fr', gap: 14 }}>
                  <div className="card">
                    <h3 style={{ fontSize: 10, color: '#444', textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: 16, fontWeight: 700 }}>🧮 Position Sizer</h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                      {[{ label: 'Capital (₹)', name: 'overallCapital', placeholder: '500000' }, { label: 'Risk %', name: 'riskPct', placeholder: '1' }, { label: 'SL Distance %', name: 'sl', placeholder: '5' }].map(f => (
                        <div key={f.name}><label className="fl">{f.label}</label><input className="fi" type="number" name={f.name} placeholder={f.placeholder} value={calcInputs[f.name as keyof typeof calcInputs]} onChange={e => setCalcInputs(c => ({ ...c, [e.target.name]: e.target.value }))} /></div>
                      ))}
                    </div>
                    {calc && (
                      <div style={{ marginTop: 14, background: '#0d0e12', borderRadius: 10, padding: 14, border: '1px solid #1e2028' }}>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                          <div><div style={{ fontSize: 9, color: '#444', textTransform: 'uppercase', marginBottom: 6 }}>Risk Amount</div><div style={{ fontFamily: 'JetBrains Mono', fontSize: 20, fontWeight: 800, color: '#ff6b6b' }}>₹{calc.riskAmount.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</div></div>
                          <div><div style={{ fontSize: 9, color: '#444', textTransform: 'uppercase', marginBottom: 6 }}>Max Position</div><div style={{ fontFamily: 'JetBrains Mono', fontSize: 20, fontWeight: 800, color: '#00e5a0' }}>₹{calc.positionSize.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</div></div>
                        </div>
                      </div>
                    )}
                    {calc && (
                      <div style={{ marginTop: 12 }}>
                        <label className="fl">CMP → Qty</label>
                        <input className="fi" type="number" placeholder="Enter stock price" value={stockPrice} onChange={e => { setStockPrice(e.target.value); const p = parseFloat(e.target.value); if (p > 0) { const q = Math.floor(calc.positionSize / p); setQtyResult(`${q.toLocaleString()} shares @ ₹${p} = ₹${(q * p).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`) } else setQtyResult('') }} />
                        {qtyResult && <div style={{ marginTop: 8, fontFamily: 'JetBrains Mono', fontSize: 12, color: '#00e5a0', background: 'rgba(0,229,160,0.06)', padding: '10px 12px', borderRadius: 8, border: '1px solid rgba(0,229,160,0.1)' }}>📦 {qtyResult}</div>}
                      </div>
                    )}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    <div className="card">
                      <h3 style={{ fontSize: 10, color: '#444', textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: 12, fontWeight: 700 }}>💼 Portfolio</h3>
                      <div style={{ marginBottom: 12 }}><label className="fl">Total Capital (₹)</label><input className="fi" type="number" value={capital.total} onChange={e => handleCapitalChange(parseFloat(e.target.value) || 0)} /></div>
                      {[
                        { lbl: 'Total Capital', val: fmtL(capital.total), color: '#e8e6e0' },
                        { lbl: 'Deployed (Open)', val: fmtL(totalDeployed), color: '#ffa500' },
                        { lbl: 'Free Capital', val: fmtL(capital.total - totalDeployed), color: '#00e5a0' },
                        { lbl: 'Deployment %', val: `${capital.total > 0 ? ((totalDeployed / capital.total) * 100).toFixed(1) : 0}%`, color: '#0097ff' },
                        { lbl: 'IPO P&L', val: `${totalIPOProfit >= 0 ? '+' : ''}${fmtL(totalIPOProfit)}`, color: totalIPOProfit >= 0 ? '#00e5a0' : '#ff4f4f' },
                      ].map((s, i) => (
                        <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: i < 4 ? '1px solid #111318' : 'none' }}>
                          <span style={{ fontSize: 12, color: '#555' }}>{s.lbl}</span>
                          <span style={{ fontFamily: 'JetBrains Mono', fontSize: 13, fontWeight: 700, color: s.color }}>{s.val}</span>
                        </div>
                      ))}
                      <div style={{ marginTop: 12, height: 4, background: '#1a1b20', borderRadius: 2, overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${Math.min(100, capital.total > 0 ? (totalDeployed / capital.total) * 100 : 0)}%`, background: 'linear-gradient(90deg,#00e5a0,#0097ff)', borderRadius: 2, transition: 'width 0.6s ease' }} />
                      </div>
                    </div>
                    <div className="card">
                      <h3 style={{ fontSize: 10, color: '#444', textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: 12, fontWeight: 700 }}>📊 Performance</h3>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                        {[
                          { lbl: 'Swing Win Rate', val: exitedTrades.length > 0 ? `${((winTrades.length / exitedTrades.length) * 100).toFixed(0)}%` : '—', color: '#00e5a0' },
                          { lbl: 'Swing P&L', val: `${pnl >= 0 ? '+' : ''}${fmtL(pnl)}`, color: pnl >= 0 ? '#00e5a0' : '#ff4f4f' },
                          { lbl: 'IPO Success', val: ipoRecords.length > 0 ? `${((ipoAllotted.length / ipoRecords.length) * 100).toFixed(0)}%` : '—', color: '#0097ff' },
                          { lbl: 'IPO P&L', val: `${totalIPOProfit >= 0 ? '+' : ''}${fmtL(totalIPOProfit)}`, color: totalIPOProfit >= 0 ? '#00e5a0' : '#ff4f4f' },
                        ].map((s, i) => (
                          <div key={i} style={{ background: '#0d0e12', borderRadius: 8, padding: 12, textAlign: 'center' }}>
                            <div style={{ fontFamily: 'JetBrains Mono', fontSize: 16, fontWeight: 800, color: s.color }}>{s.val}</div>
                            <div style={{ fontSize: 9, color: '#444', marginTop: 4, textTransform: 'uppercase', letterSpacing: '0.08em' }}>{s.lbl}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ═══ ADD/EDIT TRADE ═══ */}
            {page === 'add' && form && (
              <div className="fu" style={{ maxWidth: 720, margin: '0 auto' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
                  <button className="bg" style={{ padding: '8px 12px' }} onClick={() => { setPage('journal'); setForm(null) }}>← Back</button>
                  <h2 style={{ fontSize: isMob ? 16 : 20, fontWeight: 800, flex: 1 }}>{editId ? 'Edit Trade' : 'Log Trade'}</h2>
                  {editId && <button onClick={() => deleteTrade(editId)} style={{ background: 'rgba(255,79,79,0.07)', border: '1px solid rgba(255,79,79,0.2)', color: '#ff4f4f', borderRadius: 8, padding: '8px 12px', cursor: 'pointer', fontFamily: 'Syne', fontSize: 12, fontWeight: 700 }}>🗑</button>}
                </div>
                <div className="card" style={{ marginBottom: 12 }}>
                  <h4 style={{ fontSize: 10, color: '#444', textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: 12, fontWeight: 700 }}>🔍 Stock Search</h4>
                  <div style={{ marginBottom: 12 }}>
                    <label className="fl">Search Symbol or Name</label>
                    <StockSearchInput value={form.symbol} onChange={val => setForm(f => f ? { ...f, symbol: val } : f)} onSelect={stock => setForm(f => f ? { ...f, symbol: stock.symbol, sector: stock.sector } : f)} onUsePrice={price => setForm(f => f ? { ...f, buyPrice: price.toFixed(2) } : f)} />
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                    <div><label className="fl">Sector</label><select className="fi" name="sector" value={form.sector} onChange={hFormChg}>{SECTORS.map(s => <option key={s}>{s}</option>)}</select></div>
                    <div><label className="fl">Status</label><select className="fi" name="status" value={form.status} onChange={hFormChg}>{['Running', 'Exited', 'Stop Hit'].map(s => <option key={s}>{s}</option>)}</select></div>
                  </div>
                </div>
                <div className="card" style={{ marginBottom: 12 }}>
                  <h4 style={{ fontSize: 10, color: '#444', textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: 12, fontWeight: 700 }}>💰 Trade Details</h4>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                    <div><label className="fl">Buy Price (₹) *</label><input className="fi" type="number" name="buyPrice" value={form.buyPrice} onChange={hFormChg} /></div>
                    <div><label className="fl">Quantity *</label><input className="fi" type="number" name="qty" value={form.qty} onChange={hFormChg} /></div>
                    <div><label className="fl">Stop Loss (₹) *</label><input className="fi" type="number" name="sl" value={form.sl} onChange={hFormChg} /></div>
                    <div><label className="fl">Target (₹)</label><input className="fi" type="number" name="target" value={form.target} onChange={hFormChg} /></div>
                    <div><label className="fl">Buy Date</label><input className="fi" type="date" name="buyDate" value={form.buyDate} onChange={hFormChg} /></div>
                    <div><label className="fl">Exit Price (₹)</label><input className="fi" type="number" name="exitPrice" value={form.exitPrice} onChange={hFormChg} /></div>
                    <div style={{ gridColumn: '1/-1' }}><label className="fl">Exit Date</label><input className="fi" type="date" name="exitDate" value={form.exitDate} onChange={hFormChg} /></div>
                  </div>
                  {form.buyPrice && form.qty && form.sl && (
                    <div style={{ marginTop: 12, background: '#0d0e12', borderRadius: 8, padding: 12, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                      <div><div style={{ fontSize: 9, color: '#444', textTransform: 'uppercase', marginBottom: 2 }}>Deployed</div><div style={{ fontFamily: 'JetBrains Mono', color: '#ffa500', fontSize: 13, fontWeight: 700 }}>₹{((parseFloat(form.buyPrice) * parseFloat(form.qty)) / 100000).toFixed(2)}L</div></div>
                      <div><div style={{ fontSize: 9, color: '#444', textTransform: 'uppercase', marginBottom: 2 }}>SL %</div><div style={{ fontFamily: 'JetBrains Mono', color: '#ff6b6b', fontSize: 13, fontWeight: 700 }}>{(((parseFloat(form.buyPrice) - parseFloat(form.sl)) / parseFloat(form.buyPrice)) * 100).toFixed(1)}%</div></div>
                      <div><div style={{ fontSize: 9, color: '#444', textTransform: 'uppercase', marginBottom: 2 }}>Risk ₹</div><div style={{ fontFamily: 'JetBrains Mono', color: '#ff4f4f', fontSize: 13, fontWeight: 700 }}>₹{((parseFloat(form.buyPrice) - parseFloat(form.sl)) * parseFloat(form.qty)).toLocaleString('en-IN', { maximumFractionDigits: 0 })}</div></div>
                      {form.target && <div><div style={{ fontSize: 9, color: '#444', textTransform: 'uppercase', marginBottom: 2 }}>R:R</div><div style={{ fontFamily: 'JetBrains Mono', color: '#00e5a0', fontSize: 13, fontWeight: 700 }}>1:{(Math.abs(parseFloat(form.target) - parseFloat(form.buyPrice)) / Math.abs(parseFloat(form.buyPrice) - parseFloat(form.sl))).toFixed(2)}</div></div>}
                    </div>
                  )}
                </div>
                <div className="card" style={{ marginBottom: 16 }}>
                  <h4 style={{ fontSize: 10, color: '#444', textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: 12, fontWeight: 700 }}>📝 Notes</h4>
                  <div style={{ marginBottom: 10 }}><label className="fl">Reason for Entry</label><textarea className="fi" name="reason" value={form.reason} onChange={hFormChg} rows={3} placeholder="Setup, pattern, catalyst..." style={{ resize: 'vertical' }} /></div>
                  <div style={{ marginBottom: 10 }}><label className="fl">Market Context</label><textarea className="fi" name="timing" value={form.timing} onChange={hFormChg} rows={2} style={{ resize: 'vertical' }} /></div>
                  <div style={{ display: 'grid', gridTemplateColumns: isMob ? '1fr' : '1fr 1fr', gap: 10 }}>
                    <div><label className="fl">Chart Image URL</label><input className="fi" name="imageUrl" value={form.imageUrl} onChange={hFormChg} placeholder="https://..." /></div>
                    <div><label className="fl">Chart Link</label><input className="fi" name="chartLink" value={form.chartLink} onChange={hFormChg} placeholder="https://tradingview.com/..." /></div>
                  </div>
                  <div style={{ marginTop: 10 }}><label className="fl">Tags</label><input className="fi" name="tags" value={form.tags} onChange={hFormChg} placeholder="breakout, momentum..." /></div>
                </div>
                <div style={{ display: 'flex', gap: 10 }}>
                  <button className="bp" onClick={handleSubmit} style={{ flex: 1 }}>{editId ? '✓ Update Trade' : '＋ Log Trade'}</button>
                  <button className="bg" onClick={() => { setPage('journal'); setForm(null) }}>Cancel</button>
                </div>
              </div>
            )}
          </>
        )}
      </main>
      {isMob && <BottomNav />}
    </div>
  )
}
