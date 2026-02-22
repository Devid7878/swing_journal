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

  const accounts = await prisma.ipoAccount.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: 'desc' },
  })
  return NextResponse.json(serialize(accounts))
}

export async function POST(req: NextRequest) {
  const user = await getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const b = await req.json()
  const fields = {
    holderName:    b.holder_name,
    pan:           b.pan            ?? null,
    dematName:     b.demat_name     ?? null,
    dematProvider: b.demat_provider ?? 'Zerodha',
    dematId:       b.demat_id       ?? null,
    bank:          b.bank           ?? null,
    upiId:         b.upi_id         ?? null,
    phone:         b.phone          ?? null,
    email:         b.email          ?? null,
    category:      b.category       ?? 'Retail',
    notes:         b.notes          ?? null,
  }
  const account = await prisma.ipoAccount.upsert({
    where:  { id: BigInt(b.id) },
    update: fields,
    create: { id: BigInt(b.id), userId: user.id, ...fields },
  })
  return NextResponse.json(serialize(account))
}

export async function DELETE(req: NextRequest) {
  const user = await getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await req.json()
  await prisma.ipoAccount.deleteMany({ where: { id: BigInt(id), userId: user.id } })
  return NextResponse.json({ success: true })
}
