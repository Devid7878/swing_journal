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

  const capital = await prisma.capital.upsert({
    where:  { userId: user.id },
    update: {},
    create: { userId: user.id, total: 500000 },
  })
  return NextResponse.json(serialize(capital))
}

export async function POST(req: NextRequest) {
  const user = await getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { total } = await req.json()
  const capital = await prisma.capital.upsert({
    where:  { userId: user.id },
    update: { total },
    create: { userId: user.id, total },
  })
  return NextResponse.json(serialize(capital))
}
