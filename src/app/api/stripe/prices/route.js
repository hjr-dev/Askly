import { stripe } from "@/app/lib/stripe";
import { PAID_PLAN_IDS, PLANS } from "@/app/lib/plans";

export const runtime = "nodejs";

// Los precios se leen en vivo desde Stripe en vez de repetirlos a mano en el
// front (evita que la página de precios muestre una cifra distinta a la que
// realmente se cobra).
export async function GET() {
  try {
    const entries = await Promise.all(
      PAID_PLAN_IDS.map(async (planId) => {
        const priceId = process.env[PLANS[planId].priceEnvVar];
        if (!priceId) return [planId, null];

        const price = await stripe.prices.retrieve(priceId);
        return [
          planId,
          {
            amount: price.unit_amount,
            currency: price.currency,
            interval: price.recurring?.interval || "month",
          },
        ];
      })
    );

    return Response.json({ prices: Object.fromEntries(entries) });
  } catch (error) {
    console.error("STRIPE PRICES ERROR:", error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}
