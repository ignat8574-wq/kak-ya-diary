const webpush = require("web-push");
const { createClient } = require("@supabase/supabase-js");

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY;
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY;
const VAPID_SUBJECT = process.env.VAPID_SUBJECT || "mailto:hello@example.com";

if (VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
}

function batumiDayRangeUtc() {
  const now = new Date();
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tbilisi",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(now);

  const y = parts.find(p => p.type === "year").value;
  const m = parts.find(p => p.type === "month").value;
  const d = parts.find(p => p.type === "day").value;

  const start = new Date(`${y}-${m}-${d}T00:00:00+04:00`);
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
  return { start: start.toISOString(), end: end.toISOString() };
}

function messageForMoment(moment, hasEntryToday) {
  const messages = {
    morning: hasEntryToday
      ? "Классно, запись уже есть. Как настроение с утра?"
      : "Доброе утро. Как ты себя чувствуешь? Оставь короткую заметку.",
    day: hasEntryToday
      ? "Классно, ты уже сделал запись. Что изменилось днём?"
      : "Как день? Какие мысли сейчас и какое настроение?",
    evening: hasEntryToday
      ? "Классно, запись уже есть. Хочешь добавить итог дня?"
      : "Вечерняя заметка: что произошло, как настроение и самочувствие?"
  };

  return messages[moment] || "Как настроение? Оставь короткую заметку.";
}

async function sendReminder(moment) {
  console.log(`[push] start moment=${moment}`);

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
    console.error("[push] missing env vars", {
      hasUrl: !!SUPABASE_URL,
      hasServiceKey: !!SUPABASE_SERVICE_ROLE_KEY,
      hasPublicKey: !!VAPID_PUBLIC_KEY,
      hasPrivateKey: !!VAPID_PRIVATE_KEY
    });
    throw new Error("Missing env vars");
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  const { data: subs, error } = await supabase
    .from("push_subscriptions")
    .select("id,user_id,endpoint,subscription,enabled")
    .eq("enabled", true);

  if (error) {
    console.error("[push] supabase subscriptions error", error);
    throw error;
  }

  console.log(`[push] subscriptions=${(subs || []).length}`);

  const { start, end } = batumiDayRangeUtc();
  let sent = 0;
  let failed = 0;
  let disabled = 0;

  for (const sub of subs || []) {
    try {
      const { count, error: countError } = await supabase
        .from("diary_entries")
        .select("id", { count: "exact", head: true })
        .eq("user_id", sub.user_id)
        .gte("created_at", start)
        .lt("created_at", end);

      if (countError) {
        console.warn("[push] count diary_entries error", sub.id, countError.message);
      }

      const hasEntryToday = !countError && Number(count || 0) > 0;

      const payload = JSON.stringify({
        title: "Как настроение?",
        body: messageForMoment(moment, hasEntryToday),
        url: "/",
        tag: `kak-ya-${moment}-${new Date().toISOString().slice(0, 10)}`
      });

      await webpush.sendNotification(sub.subscription, payload);
      sent += 1;
      console.log(`[push] sent subscription=${sub.id}`);
    } catch (pushError) {
      failed += 1;
      const status = pushError.statusCode || pushError.status;
      console.error("[push] send error", {
        subscriptionId: sub.id,
        status,
        message: pushError.message,
        body: pushError.body
      });

      if (status === 404 || status === 410) {
        disabled += 1;
        await supabase
          .from("push_subscriptions")
          .update({ enabled: false, updated_at: new Date().toISOString() })
          .eq("id", sub.id);
        console.log(`[push] disabled expired subscription=${sub.id}`);
      }
    }
  }

  const result = { ok: true, moment, subscriptions: (subs || []).length, sent, failed, disabled };
  console.log("[push] done", result);
  return result;
}

exports.sendReminder = sendReminder;
