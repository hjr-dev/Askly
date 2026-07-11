import { stripe } from "../../../lib/stripe";
import { PAID_PLAN_IDS, PLANS } from "../../../lib/plans";
import {
  findSubscriptionByUserId,
  getUserFromAuthorization,
} from "../../../lib/subscriptions";

export const runtime = "nodejs";

export async function POST(req) {
  try {
    const { user, error } = await getUserFromAuthorization(req);

    if (error) {
      return Response.json({ error }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const planId = PAID_PLAN_IDS.includes(body?.plan) ? body.plan : "pro";
    const plan = PLANS[planId];
    const priceId = process.env[plan.priceEnvVar];

    if (!priceId) {
      return Response.json(
        { error: `Missing ${plan.priceEnvVar}` },
        { status: 500 }
      );
    }

    const appUrl = new URL(req.url).origin;
    const existingSubscription = await findSubscriptionByUserId(user.id);
    const customer = existingSubscription?.stripe_customer_id || undefined;

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${appUrl}/?checkout=success`,
      cancel_url: `${appUrl}/pricing?checkout=cancelled`,
      customer,
      customer_email: customer ? undefined : user.email,
      allow_promotion_codes: true,
      metadata: {
        user_id: user.id,
        plan: planId,
      },
      subscription_data: {
        metadata: {
          user_id: user.id,
          email: user.email || "",
          plan: planId,
        },
      },
    });

    return Response.json({ url: session.url });
  } catch (error) {
    console.error("CHECKOUT ERROR:", error);

    return Response.json({ error: error.message }, { status: 500 });
  }
}
