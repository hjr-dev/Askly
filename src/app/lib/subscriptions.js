import { supabaseAdmin } from "@/app/lib/supabaseAdmin";
import { PAID_PLAN_IDS, PLANS } from "@/app/lib/plans";

const ACTIVE_STATUSES = new Set(["active", "trialing"]);

// Mapa price_id de Stripe -> id de plan interno, construido a partir de
// PLANS (lib/plans.js) para que solo haya que tocar un sitio al añadir planes.
const PRICE_TO_PLAN = Object.fromEntries(
  PAID_PLAN_IDS.map((planId) => [
    process.env[PLANS[planId].priceEnvVar],
    planId,
  ]).filter(([priceId]) => Boolean(priceId))
);

export function planFromPriceId(priceId) {
  return PRICE_TO_PLAN[priceId] || "pro";
}

function isMissingSubscriptionsTable(error) {
  return (
    error?.code === "PGRST205" ||
    error?.code === "42P01" ||
    error?.message?.includes("public.subscriptions") ||
    error?.message?.includes("Could not find the table")
  );
}

export function normalizeSubscriptionStatus(status) {
  if (status === "trialing") return "active";
  if (status === "canceled" || status === "incomplete_expired") return "canceled";
  if (status === "past_due" || status === "unpaid") return "past_due";

  // "incomplete" (primer pago aún sin confirmar, p.ej. requiere 3DS) se deja
  // tal cual a propósito: no es "active" todavía, pero tampoco es un fallo
  // definitivo como "canceled".
  return status || "canceled";
}

export function subscriptionIsActive(subscription) {
  return ACTIVE_STATUSES.has(subscription?.status);
}

export function getCurrentPeriodEnd(subscription) {
  const unix =
    subscription?.current_period_end ||
    subscription?.items?.data?.[0]?.current_period_end ||
    null;

  return unix ? new Date(unix * 1000).toISOString() : null;
}

export async function getUserFromAuthorization(req) {
  const authHeader = req.headers.get("authorization") || "";
  const token = authHeader.replace(/^Bearer\s+/i, "").trim();

  if (!token) {
    return { user: null, error: "Missing authorization token" };
  }

  const { data, error } = await supabaseAdmin.auth.getUser(token);

  if (error || !data?.user) {
    return { user: null, error: "Invalid authorization token" };
  }

  return { user: data.user, error: null };
}

export async function findSubscriptionByUserId(userId) {
  const { data, error } = await supabaseAdmin
    .from("subscriptions")
    .select("*")
    .eq("user_id", userId)
    .order("current_period_end", { ascending: false, nullsFirst: false })
    .limit(1)
    .maybeSingle();

  if (isMissingSubscriptionsTable(error)) {
    console.warn(
      "Supabase table public.subscriptions is missing. Run supabase/subscriptions.sql."
    );
    return null;
  }

  if (error) throw error;
  return data;
}

export async function saveSubscription(subscription, fallbackUserId = null) {
  const userId = subscription?.metadata?.user_id || fallbackUserId;

  const customerId =
    typeof subscription?.customer === "string"
      ? subscription.customer
      : subscription?.customer?.id;

  if (!userId || !subscription?.id || !customerId) {
    throw new Error(
      "Cannot sync subscription without user, customer, and subscription ids"
    );
  }

  const priceId = subscription?.items?.data?.[0]?.price?.id || null;

  const payload = {
    user_id: userId,
    stripe_customer_id: customerId,
    stripe_subscription_id: subscription.id,
    stripe_price_id: priceId,
    plan: planFromPriceId(priceId),
    status: normalizeSubscriptionStatus(subscription.status),
    cancel_at_period_end: Boolean(subscription.cancel_at_period_end),
    current_period_end: getCurrentPeriodEnd(subscription),
  };

  const { error } = await supabaseAdmin
    .from("subscriptions")
    .upsert(payload, {
      onConflict: "user_id",
    });

  if (isMissingSubscriptionsTable(error)) {
    throw new Error(
      "Missing Supabase table public.subscriptions. Run supabase/subscriptions.sql in Supabase SQL Editor."
    );
  }

  if (error) throw error;

  return payload;
}

export async function markSubscriptionDeleted(subscription) {
  const userId = subscription?.metadata?.user_id;
  const subscriptionId = subscription?.id;

  if (!subscriptionId && !userId) {
    throw new Error(
      "Cannot cancel subscription without a subscription id or user id"
    );
  }

  const payload = {
    status: "canceled",
    cancel_at_period_end: false,
    current_period_end: getCurrentPeriodEnd(subscription),
  };

  let query = supabaseAdmin
    .from("subscriptions")
    .update(payload);

  query = userId
    ? query.eq("user_id", userId)
    : query.eq("stripe_subscription_id", subscriptionId);

  const { error } = await query;

  if (isMissingSubscriptionsTable(error)) {
    throw new Error(
      "Missing Supabase table public.subscriptions. Run supabase/subscriptions.sql in Supabase SQL Editor."
    );
  }

  if (error) throw error;

  return payload;
}