export interface Trade {
  id: number
  user_id: string
  symbol: string
  sector: string
  status: 'Running' | 'Exited' | 'Stop Hit'
  buy_price: number
  qty: number
  sl: number
  target?: number
  buy_date: string
  reason?: string
  timing?: string
  image_url?: string
  chart_link?: string
  tags?: string
  exit_price?: number
  exit_date?: string
  deployed?: number
  created_at?: string
}

export interface IpoAccount {
  id: number
  user_id: string
  holder_name: string
  pan?: string
  demat_name?: string
  demat_provider: string
  demat_id?: string
  bank?: string
  upi_id?: string
  phone?: string
  email?: string
  category: string
  notes?: string
  created_at?: string
}

export interface IpoRecord {
  id: number
  user_id: string
  company_name: string
  symbol?: string
  year: string
  exchange: string
  sector: string
  ipo_price: number
  lot_size?: number
  lots_applied?: number
  allotted: 'Yes' | 'No'
  qty_allotted?: number
  amount_applied?: number
  amount_paid?: number
  listing_date?: string
  listing_price?: number
  selling_price?: number
  selling_date?: string
  status: string
  account_id?: number
  notes?: string
  gmp_at_apply?: number
  subscription_times?: number
  created_at?: string
}

export interface Capital {
  user_id: string
  total: number
  updated_at?: string
}
