import { Router, type Request, type Response } from "express";
import { supabase } from "../lib/supabase.js";

export const billingRouter = Router();

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let stripe: any = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const Stripe = require("stripe");
  stripe = new Stripe(process.env.STRIPE_SECRET_KEY ?? "", { apiVersion: "2026-03-25.dahlia" });
} catch {
  console.log("[billing] Stripe not installed — run: npm install stripe");
}

const PLANS: Record<string, { priceId: string; name: string; monthly: number }> = {
  basic: { priceId: process.env.STRIPE_BASIC_PRICE ?? "", name: "Basic", monthly: 49 },
  pro:   { priceId: process.env.STRIPE_PRO_PRICE ?? "",   name: "Pro",   monthly: 99 },
  elite: { priceId: process.env.STRIPE_ELITE_PRICE ?? "", name: "Elite", monthly: 199 },
};

// POST /api/billing/checkout — create Stripe checkout session
billingRouter.post("/checkout", async (req: Request, res: Response) => {
  if (!stripe) { res.status(503).json({ error: "Billing not configured" }); return; }

  const { clientId, tier } = req.body as { clientId: string; tier: string };
  const plan = PLANS[tier];
  if (!plan) { res.status(400).json({ error: "Invalid tier" }); return; }

  const { data: client } = await supabase.from("clients").select("email, name").eq("id", clientId).single();
  if (!client) { res.status(404).json({ error: "Client not found" }); return; }

  const session = await stripe.checkout.sessions.create({
    payment_method_types: ["card"],
    mode: "subscription",
    line_items: [{ price: plan.priceId, quantity: 1 }],
    customer_email: client.email,
    metadata: { clientId, tier },
    success_url: `${process.env.SERVER_URL}/billing/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${process.env.SERVER_URL}/billing/cancel`,
  });

  res.json({ url: session.url });
});

// POST /api/billing/webhook — Stripe webhook
billingRouter.post("/webhook", async (req: Request, res: Response) => {
  if (!stripe) { res.status(503).end(); return; }

  const sig = req.headers["stripe-signature"] as string;
  let event;
  try {
    event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET ?? "");
  } catch (e) {
    res.status(400).send(`Webhook error: ${(e as Error).message}`); return;
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as { metadata?: { clientId?: string; tier?: string }; subscription?: string };
    const { clientId, tier } = session.metadata ?? {};
    if (clientId && tier) {
      await supabase.from("clients").update({
        subscription_tier: tier,
        voice_to_voice_enabled: tier === "pro" || tier === "elite",
      }).eq("id", clientId);
      console.log(`[billing] ${clientId} upgraded to ${tier}`);
    }
  }

  if (event.type === "customer.subscription.deleted") {
    // Downgrade to basic on cancellation
    const sub = event.data.object as { metadata?: { clientId?: string } };
    const clientId = sub.metadata?.clientId;
    if (clientId) {
      await supabase.from("clients").update({ subscription_tier: "basic", voice_to_voice_enabled: false }).eq("id", clientId);
    }
  }

  res.json({ received: true });
});

// GET /api/billing/plans — return plan info
billingRouter.get("/plans", (_req: Request, res: Response) => {
  res.json(PLANS);
});

// POST /api/billing/invoice-link — create a Stripe Payment Link for an invoice
billingRouter.post("/invoice-link", async (req: Request, res: Response) => {
  const { amount, description, clientName } = req.body as { amount: number; description: string; clientName: string };
  if (!amount || amount <= 0) { res.status(400).json({ error: "Invalid amount" }); return; }

  if (!stripe) {
    // Stripe not installed — return a pre-filled mailto: link instead
    const subject = encodeURIComponent(`Invoice: ${description}`);
    const body = encodeURIComponent(`Hi ${clientName},\n\nPlease find your invoice below:\n\nService: ${description}\nAmount: $${amount.toFixed(2)}\n\nPlease reply to arrange payment.\n\nThank you!`);
    res.json({ paymentUrl: `mailto:?subject=${subject}&body=${body}`, type: "mailto" });
    return;
  }

  try {
    // Create a one-time Stripe price
    const price = await stripe.prices.create({
      unit_amount: Math.round(amount * 100),
      currency: "usd",
      product_data: { name: description || "Invoice Payment" },
    });

    // Create a Payment Link
    const link = await stripe.paymentLinks.create({
      line_items: [{ price: price.id, quantity: 1 }],
      metadata: { clientName, description },
    });

    res.json({ paymentUrl: link.url, type: "stripe" });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});
