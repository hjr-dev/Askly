import { NextResponse } from "next/server";
import { stripe } from "@/app/lib/stripe";
import { saveSubscription, markSubscriptionDeleted } from "@/app/lib/subscriptions";

export const runtime = "nodejs";

const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

export async function POST(request) {
  // Stripe firma el cuerpo exacto en bytes: hay que verificarlo como texto plano,
  // no como JSON, o la firma dejaría de coincidir.
  const payload = await request.text();
  const signature = request.headers.get("stripe-signature");
  
  let event;
  try {
    event = stripe.webhooks.constructEvent(payload, signature, webhookSecret);
  } catch (err) {
    console.error(`Webhook signature verification failed: ${err.message}`);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object;

        if (session.mode === "subscription" && session.subscription) {
          const subscription = await stripe.subscriptions.retrieve(session.subscription);
          await saveSubscription(subscription, session.metadata?.user_id);
        }
        break;
      }

      case "customer.subscription.created":
      case "customer.subscription.updated": {
        await saveSubscription(event.data.object);
        break;
      }

      case "customer.subscription.deleted": {
        await markSubscriptionDeleted(event.data.object);
        break;
      }

      default:
        break;
    }
  } catch (err) {
    console.error("Error al sincronizar la suscripción:", err);
    return NextResponse.json({ error: "Webhook handler failed" }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}