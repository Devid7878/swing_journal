# SwingJournal – Deployment Guide

## Stack
- **Next.js 14** (App Router, TypeScript)
- **Supabase** (Auth + PostgreSQL database)
- **Prisma** (ORM — tables are created/migrated automatically)
- **Vercel** (hosting, free tier)

> ✅ **No manual SQL needed.** Prisma creates all tables automatically on first deploy.

---

## Step 1 — Create a Supabase Project

1. Go to https://supabase.com → Sign up / Log in
2. Click **New Project** → name it, set a DB password, pick a region
3. Wait ~1 minute for provisioning

---

## Step 2 — Get Your Database Connection Strings

Prisma needs **two** URLs from Supabase (to work correctly with connection pooling):

1. In your Supabase project → **Project Settings → Database**
2. Scroll to **Connection string** section
3. Copy the **Transaction pooler** URI (port 6543) → this is your DATABASE_URL
4. Copy the **Session pooler** URI (port 5432) → this is your DIRECT_URL

Add ?pgbouncer=true to DATABASE_URL — the .env.example already shows the correct format.

---

## Step 3 — Get Supabase Auth Keys

1. **Project Settings → API**
2. Copy Project URL → NEXT_PUBLIC_SUPABASE_URL
3. Copy anon public key → NEXT_PUBLIC_SUPABASE_ANON_KEY

---

## Step 4 — Configure Auth Redirect URLs

1. Supabase → **Authentication → URL Configuration**
2. Set **Site URL** to your Vercel URL: https://your-app.vercel.app
3. Add **Redirect URLs**: https://your-app.vercel.app/auth/callback
4. Also add http://localhost:3000/auth/callback for local dev

---

## Step 5 — Run Locally First (Recommended)

```bash
npm install
cp .env.example .env.local
# Fill in all 4 values in .env.local

npx prisma migrate dev --name init
# Creates all tables in Supabase + generates Prisma Client

npm run dev
# Open http://localhost:3000
```

---

## Step 6 — Deploy to Vercel

Push to GitHub:
```bash
git init && git add . && git commit -m "Initial commit"
git remote add origin https://github.com/YOUR_USERNAME/swingjournal.git
git push -u origin main
```

Then in Vercel dashboard:
1. New Project → Import your repo
2. Add all 4 Environment Variables:
   - NEXT_PUBLIC_SUPABASE_URL
   - NEXT_PUBLIC_SUPABASE_ANON_KEY
   - DATABASE_URL  (Transaction pooler, port 6543, with ?pgbouncer=true)
   - DIRECT_URL    (Session pooler, port 5432)
3. Click Deploy

On every deploy the build script runs:
  prisma generate && prisma migrate deploy && next build

This applies all migrations automatically — tables are created on first deploy, zero manual SQL.

---

## Adding New Fields Later

1. Edit prisma/schema.prisma
2. Run: npx prisma migrate dev --name describe_your_change
3. Commit and push — Vercel applies it automatically on next deploy

---

## Environment Variables

| Variable                    | Required | Notes                                     |
|-----------------------------|----------|-------------------------------------------|
| NEXT_PUBLIC_SUPABASE_URL    | Yes      | For Auth (client-side)                    |
| NEXT_PUBLIC_SUPABASE_ANON_KEY | Yes    | For Auth (client-side)                    |
| DATABASE_URL                | Yes      | Prisma runtime (Transaction pooler, 6543) |
| DIRECT_URL                  | Yes      | Prisma migrations (Session pooler, 5432)  |
