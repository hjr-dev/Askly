import {
  findSubscriptionByUserId,
  getUserFromAuthorization,
} from "../../../lib/subscriptions";

export const runtime = "nodejs";

export async function GET(req) {
  try {
    const { user, error } = await getUserFromAuthorization(req);

    if (error) {
      return Response.json({ active: false, error }, { status: 401 });
    }

    const subscription = await findSubscriptionByUserId(user.id);
    const active = subscription?.status === "active";

    return Response.json({
      active,
      subscription: subscription
        ? {
            plan: subscription.plan,
            status: subscription.status,
            current_period_end: subscription.current_period_end,
            cancel_at_period_end: subscription.cancel_at_period_end,
          }
        : null,
    });
  } catch (error) {
    console.error("SUBSCRIPTION STATUS ERROR:", error);
    return Response.json({ active: false, error: error.message }, { status: 500 });
  }
}
