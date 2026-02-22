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

  const trades = await prisma.trade.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: 'desc' },
  })
  return NextResponse.json(serialize(trades))
}

export async function POST(req: NextRequest) {
  const user = await getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const b = await req.json()
  const fields = {
    symbol:    b.symbol,
    sector:    b.sector     ?? 'Technology',
    status:    b.status     ?? 'Running',
    buyPrice:  b.buy_price,
    qty:       b.qty,
    sl:        b.sl,
    target:    b.target     ?? null,
    buyDate:   new Date(b.buy_date),
    reason:    b.reason     ?? null,
    timing:    b.timing     ?? null,
    imageUrl:  b.image_url  ?? null,
    chartLink: b.chart_link ?? null,
    tags:      b.tags       ?? null,
    exitPrice: b.exit_price ?? null,
    exitDate:  b.exit_date  ? new Date(b.exit_date) : null,
    deployed:  b.deployed   ?? null,
  }
  const trade = await prisma.trade.upsert({
    where:  { id: BigInt(b.id) },
    update: fields,
    create: { id: BigInt(b.id), userId: user.id, ...fields },
  })
  return NextResponse.json(serialize(trade))
}

export async function DELETE(req: NextRequest) {
  const user = await getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await req.json()
  await prisma.trade.deleteMany({ where: { id: BigInt(id), userId: user.id } })
  return NextResponse.json({ success: true })
}
