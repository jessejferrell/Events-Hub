import { Express } from "express";
import Stripe from "stripe";
import { storage } from "./storage";
import { log } from "./vite";

// Initialize Stripe with the secret key
const stripeSecretKey = process.env.STRIPE_SECRET_KEY || "sk_test_example";
const stripePublicKey = process.env.VITE_STRIPE_PUBLIC_KEY || "pk_test_example";

if (stripeSecretKey === "sk_test_example" || stripePublicKey === "pk_test_example") {
  log("Using test Stripe keys. Set STRIPE_SECRET_KEY and VITE_STRIPE_PUBLIC_KEY for production", "stripe");
}

const stripe = new Stripe(stripeSecretKey, {
  apiVersion: "2023-10-16",
});

export function setupStripeRoutes(app: Express) {
  // Get Stripe public key
  app.get("/api/stripe/config", (req, res) => {
    res.json({ publishableKey: process.env.VITE_STRIPE_PUBLIC_KEY });
  });

  // Start Stripe Connect OAuth flow for event owners
  app.get("/api/stripe/connect", (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Authentication required" });
    }

    // Only users with event_owner role can connect with Stripe
    if (req.user.role !== "event_owner" && req.user.role !== "admin") {
      return res.status(403).json({ message: "Only event owners can connect with Stripe" });
    }

    // If user already has a Stripe account connected, redirect to dashboard
    if (req.user.stripeAccountId) {
      return res.json({ 
        connected: true, 
        message: "Stripe account already connected",
        accountId: req.user.stripeAccountId
      });
    }

    // Get domain from environment or request
    const domain = process.env.REPLIT_DOMAINS 
      ? `https://${process.env.REPLIT_DOMAINS.split(',')[0]}` 
      : `${req.protocol}://${req.get('host')}`;

    // We'll use Stripe Express accounts instead of OAuth as it doesn't require a client ID
    // Create an Express account onboarding link instead
    const accountParams: Stripe.AccountCreateParams = {
      type: 'express',
      capabilities: {
        card_payments: { requested: true },
        transfers: { requested: true },
      },
      business_type: 'individual',
      metadata: {
        userId: req.user.id.toString()
      }
    };
    
    try {
      // Create the account
      const account = await stripe.accounts.create(accountParams);
      
      // Save the account ID to user
      await storage.updateUserStripeAccount(req.user.id, account.id);
      
      // Create an account link
      const accountLink = await stripe.accountLinks.create({
        account: account.id,
        refresh_url: `${domain}/payment-connections?refresh=true`,
        return_url: `${domain}/payment-connections?success=true`,
        type: 'account_onboarding',
      });
      
      // Return the link to redirect to
      const connectLink = accountLink.url;
      res.json({ url: connectLink });
    } catch (error: any) {
      log(`Stripe account creation error: ${error.message}`, "stripe");
      res.status(500).json({ message: error.message || "Failed to create Stripe account" });
    }
  });

  // Endpoint to check the status of a Stripe account
  app.get("/api/stripe/account-status", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Authentication required" });
    }

    try {
      if (!req.user.stripeAccountId) {
        return res.json({ connected: false });
      }
      
      // Retrieve the account to get its current status
      const account = await stripe.accounts.retrieve(req.user.stripeAccountId);
      
      return res.json({
        connected: true,
        accountId: account.id,
        detailsSubmitted: account.details_submitted,
        chargesEnabled: account.charges_enabled,
        payoutsEnabled: account.payouts_enabled
      });
    } catch (error: any) {
      log(`Error retrieving Stripe account: ${error.message}`, "stripe");
      return res.status(500).json({ message: "Failed to retrieve Stripe account status" });
    }
  });

  // Create a checkout session for ticket purchase
  app.post("/api/create-checkout-session", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Authentication required" });
    }

    try {
      const { eventId, quantity } = req.body;
      
      // Get the event
      const event = await storage.getEvent(eventId);
      if (!event) {
        return res.status(404).json({ message: "Event not found" });
      }
      
      // Get the event owner
      const owner = await storage.getUser(event.ownerId);
      if (!owner || !owner.stripeAccountId) {
        return res.status(400).json({ message: "Event owner has not connected with Stripe" });
      }

      // Get domain from environment or request
      const domain = process.env.REPLIT_DOMAINS 
        ? process.env.REPLIT_DOMAINS.split(',')[0] 
        : `${req.protocol}://${req.get('host')}`;

      // Create a Checkout Session
      const session = await stripe.checkout.sessions.create({
        payment_method_types: ["card"],
        line_items: [
          {
            price_data: {
              currency: "usd",
              product_data: {
                name: event.title,
                description: event.description,
              },
              unit_amount: Math.round(event.price * 100), // convert to cents
            },
            quantity: quantity || 1,
          },
        ],
        mode: "payment",
        success_url: `${domain}/events/${eventId}?success=true&session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${domain}/events/${eventId}?cancelled=true`,
        // Send payment to the connected account
        payment_intent_data: {
          application_fee_amount: Math.round(event.price * 100 * (quantity || 1) * 0.1), // 10% platform fee
          transfer_data: {
            destination: owner.stripeAccountId,
          },
        },
        // Pass metadata to use in the webhook
        metadata: {
          eventId: eventId.toString(),
          userId: req.user.id.toString(),
          quantity: (quantity || 1).toString(),
        },
      });

      res.json({ id: session.id, url: session.url });
    } catch (error: any) {
      log(`Stripe checkout error: ${error.message}`, "stripe");
      res.status(500).json({ message: error.message || "Failed to create checkout session" });
    }
  });

  // Webhook endpoint to handle Stripe events
  app.post("/api/stripe/webhook", async (req, res) => {
    const sig = req.headers["stripe-signature"] as string;
    const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;

    let event;

    try {
      // Verify webhook signature
      if (endpointSecret) {
        event = stripe.webhooks.constructEvent(req.body, sig, endpointSecret);
      } else {
        // For development, just parse the JSON
        event = req.body;
      }
    } catch (err: any) {
      log(`Webhook signature verification failed: ${err.message}`, "stripe");
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    // Handle specific event types
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object;
        await handleCheckoutSessionCompleted(session);
        break;
      }
      case "payment_intent.succeeded": {
        const paymentIntent = event.data.object;
        log(`PaymentIntent succeeded: ${paymentIntent.id}`, "stripe");
        break;
      }
      // Add more event handlers as needed
    }

    res.json({ received: true });
  });

  // Helper function to handle successful checkout
  async function handleCheckoutSessionCompleted(session: any) {
    try {
      // Extract metadata
      const { eventId, userId, quantity } = session.metadata;
      
      // Get the event
      const event = await storage.getEvent(parseInt(eventId));
      if (!event) {
        log(`Event not found: ${eventId}`, "stripe");
        return;
      }
      
      // Create ticket record
      const ticket = await storage.createTicket({
        userId: parseInt(userId),
        eventId: parseInt(eventId),
        quantity: parseInt(quantity),
        status: "purchased",
        transactionId: session.payment_intent,
        amount: session.amount_total / 100, // convert from cents
      });
      
      // Create payment record
      await storage.createPayment({
        userId: parseInt(userId),
        eventId: parseInt(eventId),
        ticketId: ticket.id,
        amount: session.amount_total / 100,
        status: "completed",
        stripePaymentId: session.payment_intent,
        metadata: { session_id: session.id },
      });
      
      log(`Ticket purchased: ${ticket.id} for event ${eventId}`, "stripe");
    } catch (error: any) {
      log(`Error handling checkout completion: ${error.message}`, "stripe");
    }
  }
}
