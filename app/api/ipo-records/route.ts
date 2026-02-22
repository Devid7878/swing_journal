import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { createClient } from '@/lib/supabase/server'

const serialize = (v: unknown): unknown =>
  JSON.parse(JSON.stringify(v, (_k, val) => (typeof val === 'bigint' ? Number(val) : val)))

async function getUser() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  return user
}

export async function GET() {
  const user = await getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const records = await prisma.ipoRecord.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: 'desc' },
  })
  return NextResponse.json(serialize(records))
}

export async function POST(req: NextRequest) {
  const user = await getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const b = await req.json()
  const fields = {
    companyName:       b.company_name,
    symbol:            b.symbol            ?? null,
    year:              b.year              ?? String(new Date().getFullYear()),
    exchange:          b.exchange          ?? 'NSE + BSE',
    sector:            b.sector            ?? 'Technology',
    ipoPrice:          b.ipo_price,
    lotSize:           b.lot_size          ?? null,
    lotsApplied:       b.lots_applied      ?? null,
    allotted:          b.allotted          ?? 'Yes',
    qtyAllotted:       b.qty_allotted      ?? null,
    amountApplied:     b.amount_applied    ?? null,
    amountPaid:        b.amount_paid       ?? null,
    listingDate:       b.listing_date      ? new Date(b.listing_date) : null,
    listingPrice:      b.listing_price     ?? null,
    sellingPrice:      b.selling_price     ?? null,
    sellingDate:       b.selling_date      ? new Date(b.selling_date) : null,
    status:            b.status            ?? 'Sold on Listing',
    accountId:         b.account_id        ? BigInt(b.account_id) : null,
    notes:             b.notes             ?? null,
    gmpAtApply:        b.gmp_at_apply      ?? null,
    subscriptionTimes: b.subscription_times ?? null,
  }
  const record = await prisma.ipoRecord.upsert({
    where:  { id: BigInt(b.id) },
    update: fields,
    create: { id: BigInt(b.id), userId: user.id, ...fields },
  })
  return NextResponse.json(serialize(record))
}

export async function DELETE(req: NextRequest) {
  const user = await getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await req.json()
  await prisma.ipoRecord.deleteMany({ where: { id: BigInt(id), userId: user.id } })
  return NextResponse.json({ success: true })
}
