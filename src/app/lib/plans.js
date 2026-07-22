// Fuente única de verdad para los planes de Askly. Añadir un plan nuevo es
// añadir una entrada aquí (más su price ID de Stripe en env) — el resto de
// la UI (Sidebar, Home, UpgradeButton, pricing) lee de esta tabla.
//
// dailyMessageLimit se aplica en el backend (ver lib/conversations.js +
// /api/conversations/messages), no solo en el cliente, para que el gating
// del plan Gratis sea real y no un contador de sesión que se resetea al recargar.
export const PLANS = {
  free: {
    id: "free",
    label: "Gratis",
    accent: "#2DD4BF", // teal: mismo acento de marca para todos los planes
    accentSoft: "rgba(45, 212, 191, 0.12)",
    dailyMessageLimit: 20,
    priceEnvVar: null,
    features: ["20 mensajes al día", "IA básica", "Soporte de la comunidad"],
    ctaLabel: "Mejorar plan",
  },
  pro: {
    id: "pro",
    label: "Pro",
    accent: "#2DD4BF",
    accentSoft: "rgba(45, 212, 191, 0.12)",
    dailyMessageLimit: Infinity,
    priceEnvVar: "NEXT_PUBLIC_STRIPE_PRO_PRICE_ID",
    features: [
      "Chats ilimitados",
      "IA premium",
      "Respuestas más rápidas",
      "Historial de conversaciones",
      "Soporte prioritario",
    ],
    ctaLabel: "Gestionar suscripción",
  },
  team: {
    id: "team",
    label: "Equipos",
    accent: "#2DD4BF",
    accentSoft: "rgba(45, 212, 191, 0.12)",
    dailyMessageLimit: Infinity,
    priceEnvVar: "NEXT_PUBLIC_STRIPE_TEAM_PRICE_ID",
    features: [
      "Todo lo de Pro",
      "Espacio de trabajo de equipo",
      "Conversaciones compartidas",
      "Facturación centralizada",
      "Herramientas de administración",
    ],
    ctaLabel: "Gestionar suscripción",
  },
};

export const PAID_PLAN_IDS = ["pro", "team"];

export function getPlanById(planId) {
  return PLANS[planId] || PLANS.free;
}

// A partir del estado de suscripción que devuelve /api/subscription/status.
export function getPlanFromSubscription(subscription) {
  if (!subscription || subscription.status !== "active") return PLANS.free;
  return getPlanById(subscription.plan);
}
