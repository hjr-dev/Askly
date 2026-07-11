import { stripe } from "@/app/lib/stripe";
import { findSubscriptionByUserId, getUserFromAuthorization } from "@/app/lib/subscriptions";

export const runtime = "nodejs";

export async function POST(req) {
  try {
    const { user, error } = await getUserFromAuthorization(req);

    if (error) {
      return Response.json({ error }, { status: 401 });
    }

    const subscription = await findSubscriptionByUserId(user.id);

    if (!subscription?.stripe_customer_id) {
      return Response.json(
        { error: "No hay una suscripción de Stripe asociada a este usuario" },
        { status: 404 }
      );
    }

    const appUrl = new URL(req.url).origin;

    const portalSession = await stripe.billingPortal.sessions.create({
      customer: subscription.stripe_customer_id,
      return_url: `${appUrl}/`,
    });

    return Response.json({ url: portalSession.url });
  } catch (error) {
    console.error("BILLING PORTAL ERROR:", error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}
