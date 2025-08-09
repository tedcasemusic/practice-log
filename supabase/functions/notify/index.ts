// deno-lint-ignore-file no-explicit-any
import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
// @deno-types="npm:@types/web-push@3"
import webpush from "npm:web-push@3.6.7"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const VAPID_PUBLIC_KEY = Deno.env.get('VAPID_PUBLIC_KEY')!
const VAPID_PRIVATE_KEY = Deno.env.get('VAPID_PRIVATE_KEY')!

webpush.setVapidDetails(
  'mailto:notifications@practice-log.app',
  VAPID_PUBLIC_KEY,
  VAPID_PRIVATE_KEY
)

export const handler = async (req: Request): Promise<Response> => {
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

  // Optional: only allow cron to call
  const cronHeader = req.headers.get('x-supabase-signature')
  // You can validate if you set a secret; skipping for brevity

  const { data: subs, error } = await supabase
    .from('push_subscriptions')
    .select('id, user_id, endpoint, p256dh, auth')

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 })
  }

  let sent = 0, failed = 0
  await Promise.all((subs ?? []).map(async (s: any) => {
    const sub = {
      endpoint: s.endpoint,
      keys: { p256dh: s.p256dh, auth: s.auth }
    }
    try {
      await webpush.sendNotification(sub as any, JSON.stringify({
        title: "Practice Log",
        body: "Tuesday check-in: review or update your weekly practice goals.",
        icon: "/icons/icon-192.png",
        badge: "/icons/icon-192.png",
      }))
      sent++
    } catch (e) {
      failed++
      // Optionally: delete invalid subscriptions here
    }
  }))

  return new Response(JSON.stringify({ sent, failed }), { headers: { 'content-type': 'application/json' } })
}

Deno.serve(handler)
