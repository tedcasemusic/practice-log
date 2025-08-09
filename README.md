# Practice Log — PWA + Supabase (Starter)

A streamlined violin practice tracker you can install on your iPhone and Mac. Local-first with sync and Tuesday push reminders.

## Quick Start

### 0) Prereqs
- Node 18+ and pnpm or npm
- Supabase account + project
- Vercel account (for hosting)
- iOS 16.4+ to receive web push (install to Home Screen)

### 1) Clone & install
```bash
pnpm install
# or: npm install
```

### 2) Environment
Copy `.env.example` → `.env.local` and fill:
```
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
VITE_VAPID_PUBLIC_KEY=your_base64url_vapid_public_key
```

### 3) Supabase schema & policies
In Supabase SQL editor, paste `supabase/sql/schema.sql` and run.

### 4) Edge function + secrets (for push)
- Generate VAPID keys locally:
```bash
npx web-push generate-vapid-keys
```
- Save **PUBLIC KEY** to `.env.local` as `VITE_VAPID_PUBLIC_KEY`.
- In Supabase project settings → Functions → Secrets, set:
  - `SUPABASE_URL`
  - `SUPABASE_SERVICE_ROLE_KEY` (service role key)
  - `VAPID_PUBLIC_KEY`
  - `VAPID_PRIVATE_KEY`
- Deploy function (via Supabase CLI or dashboard) and add a cron:
  - Cron: `0 9 * * 2` (Tuesdays 09:00)
  - Invoke: `/functions/v1/notify`

### 5) Dev
```bash
pnpm dev
# or: npm run dev
```
Visit http://localhost:5173, log in with email (magic link).

### 6) Install as PWA
- In Safari (iOS): Share → Add to Home Screen
- In desktop browsers: Install app (address bar icon)

### 7) Enable push (one-time)
- After login, the app will ask for notification permission.
- Accept; a subscription is saved in Supabase.

### 8) Deploy (Vercel)
- Create a GitHub repo and push this project.
- Import the repo in Vercel → set environment variables from `.env.local`.
- Deploy. Open the live URL on iPhone → Add to Home Screen → log in → accept push.

## Notes
- Icons in `public/icons/` are placeholders. Replace with real PNGs.
- Fonts: add your Now/Montserrat files and reference them in CSS.
- History/plan UIs are stubbed; extend as needed.
