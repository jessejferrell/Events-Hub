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

    // Check if we have a Stripe client ID
    const stripeClientId = process.env.STRIPE_CLIENT_ID;
    if (!stripeClientId) {
      return res.status(500).json({ 
        message: "Stripe Connect is not properly configured. Missing STRIPE_CLIENT_ID." 
      });
    }
    
    // Log the client ID (first 8 chars only for security)
    const idPrefix = stripeClientId.substring(0, 8);
    log(`Using Stripe Client ID starting with: ${idPrefix}...`, "stripe");

    // Use the correct domains as specified by the client
    const domain = "https://events.mosspointmainstreet.org";
    const replitAppDomain = "https://events-manager.replit.app";
    
    // For local development, use one of the published domains instead of localhost
    // This ensures Stripe can properly redirect back
    const effectiveDomain = process.env.NODE_ENV === 'production' ? domain : replitAppDomain;
    
    log(`Using domain for redirect: ${effectiveDomain}`, "stripe");
    
    // Generate OAuth URL
    const state = Math.random().toString(36).substring(2, 15);
    
    // Use a simpler redirect URI that will be easier to configure in Stripe
    // We'll also have route handlers for both paths
    // Use the same domain that we're connecting from to avoid redirect URI mismatch
    const redirectUri = `${effectiveDomain}/stripe-callback`;
    
    log(`Using redirect URI: ${redirectUri}`, "stripe");
    
    // Use standard OAuth flow with authorization code
    const oauthUrl = new URL('https://connect.stripe.com/oauth/authorize');
    oauthUrl.searchParams.append('response_type', 'code');
    oauthUrl.searchParams.append('client_id', stripeClientId);
    
    // Explicitly specify these parameters to work around the gated access error
    oauthUrl.searchParams.append('scope', 'read_write');
    oauthUrl.searchParams.append('stripe_user[business_type]', 'company');
    oauthUrl.searchParams.append('stripe_user[country]', 'US');
    
    // Always include the redirect_uri parameter to ensure consistency
    oauthUrl.searchParams.append('redirect_uri', redirectUri);
    log(`Using redirect URI: ${redirectUri}`, "stripe");
    
    oauthUrl.searchParams.append('state', state);
    
    // Additional logging for debugging
    log(`Final OAuth URL: ${oauthUrl.toString()}`, "stripe");
    
    // Store state for verification when user returns
    // This is optional but recommended for security
    // You could store this in the session if needed

    // Return the URL for frontend to redirect
    res.json({ url: oauthUrl.toString() });
  });
  
  // Route for the simplified callback URL
  app.get("/stripe-callback", async (req, res) => {
    log(`Stripe callback received at /stripe-callback: ${JSON.stringify(req.query)}`, "stripe");
    
    try {
      const { code, state } = req.query;
      
      if (!code) {
        log(`No code in callback: ${JSON.stringify(req.query)}`, "stripe");
        return res.redirect('/payment-connections?error=true&message=' + encodeURIComponent('Authorization failed or was denied'));
      }
      
      // Exchange the authorization code for an access token
      const response = await stripe.oauth.token({
        grant_type: 'authorization_code',
        code: code as string,
      });
      
      log(`OAuth token response: ${JSON.stringify(response)}`, "stripe");
      
      // Extract the connected account ID
      const connectedAccountId = response.stripe_user_id as string;
      
      // Store the connected account ID in the session temporarily
      // This way we can retrieve it even if the user needs to log in again
      (req.session as any).stripeAccountId = connectedAccountId;
      
      if (!req.isAuthenticated()) {
        // If user needs to log in, store the account ID in session and redirect to login
        return res.redirect('/auth?message=' + encodeURIComponent('Please login to complete Stripe connection'));
      }
      
      // Save the account ID to the user's record
      await storage.updateUserStripeAccount(req.user.id, connectedAccountId);
      
      // Redirect back to payment connections page with success
      res.redirect('/payment-connections?success=true');
    } catch (error: any) {
      log(`Stripe callback error: ${error.message}`, "stripe");
      console.error("Full OAuth error:", error);
      res.redirect('/payment-connections?error=true&message=' + encodeURIComponent(error.message || 'Failed to connect Stripe account'));
    }
  });
  
  // Keep original callback endpoint for backward compatibility
  app.get("/api/stripe/oauth/callback", async (req, res) => {
    try {
      log(`OAuth callback received: ${JSON.stringify(req.query)}`, "stripe");
      const { code, state } = req.query;
      
      if (!code) {
        // If there's an error or denial, Stripe redirects with error information instead of a code
        const error = req.query.error;
        const errorDescription = req.query.error_description;
        log(`OAuth error: ${error} - ${errorDescription}`, "stripe");
        
        // Redirect to payment connections page with error
        return res.redirect('/payment-connections?error=true&message=' + encodeURIComponent(errorDescription as string || 'Authorization denied'));
      }
      
      log(`Attempting to exchange authorization code for access token...`, "stripe");
      
      // Exchange the authorization code for an access token
      const response = await stripe.oauth.token({
        grant_type: 'authorization_code',
        code: code as string,
      });
      
      log(`OAuth token response received: ${JSON.stringify(response)}`, "stripe");
      
      // Extract the connected account ID
      const connectedAccountId = response.stripe_user_id as string;
      
      if (!req.isAuthenticated()) {
        // If user's session expired during OAuth flow, redirect them to login
        log(`User not authenticated during OAuth callback`, "stripe");
        // Store in session for later use
        (req.session as any).stripeAccountId = connectedAccountId;
        return res.redirect('/auth?message=' + encodeURIComponent('Please login to complete Stripe connection'));
      }
      
      log(`Saving Stripe account ID ${connectedAccountId} for user ${req.user.id}`, "stripe");
      
      // Save the account ID to the user record
      await storage.updateUserStripeAccount(req.user.id, connectedAccountId);
      
      log(`Successfully connected Stripe account for user ${req.user.id}`, "stripe");
      
      // Redirect back to the payment connections page with success
      res.redirect('/payment-connections?success=true');
    } catch (error: any) {
      log(`OAuth callback error: ${error.message}`, "stripe");
      console.error("Full OAuth error:", error);
      res.redirect('/payment-connections?error=true&message=' + encodeURIComponent(error.message || 'Failed to connect Stripe account'));
    }
  });

  // Allow admins to manually register their Stripe account ID
  app.post("/api/stripe/register-account", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Authentication required" });
    }
    
    // Only users with event_owner role can connect with Stripe
    if (req.user.role !== "event_owner" && req.user.role !== "admin") {
      return res.status(403).json({ message: "Only event owners can connect with Stripe" });
    }
    
    try {
      const { stripeAccountId } = req.body;
      
      if (!stripeAccountId || typeof stripeAccountId !== 'string') {
        return res.status(400).json({ message: "Valid Stripe account ID is required" });
      }
      
      // Validate the account ID with Stripe
      try {
        await stripe.accounts.retrieve(stripeAccountId);
      } catch (error) {
        return res.status(400).json({ message: "Invalid Stripe account ID. Please check and try again." });
      }
      
      // Save the account ID to the user record
      await storage.updateUserStripeAccount(req.user.id, stripeAccountId);
      
      res.json({ 
        success: true, 
        message: "Stripe account successfully connected",
        accountId: stripeAccountId
      });
    } catch (error: any) {
      log(`Error registering Stripe account: ${error.message}`, "stripe");
      res.status(500).json({ message: error.message || "Failed to register Stripe account" });
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

      // Use the correct domains as specified by the client
      const domain = "https://events.mosspointmainstreet.org";
      const replitAppDomain = "https://events-manager.replit.app";
      
      // For local development, use one of the published domains instead of localhost
      const effectiveDomain = process.env.NODE_ENV === 'production' ? domain : replitAppDomain;

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
        success_url: `${effectiveDomain}/events/${eventId}?success=true&session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${effectiveDomain}/events/${eventId}?cancelled=true`,
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
