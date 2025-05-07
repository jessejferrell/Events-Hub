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
  app.get("/api/stripe/connect", async (req, res) => {
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

    try {
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

      // Use the verified domains as specified by the client
      const domain = "https://events.mosspointmainstreet.org";
      const replitAppDomain = "https://events-manager.replit.app";
      
      // Use the appropriate domain based on the request origin
      const effectiveDomain = req.headers.origin ? 
                              req.headers.origin.replace(/\/$/, '') : 
                              (process.env.NODE_ENV === 'production' ? domain : replitAppDomain);
      
      // Generate a unique identifier based on user ID and timestamp
      // This will be stored to disk as a fallback mechanism
      const userId = req.user.id;
      const timestamp = Date.now();
      const randomSuffix = Math.random().toString(36).substring(2, 10);
      const stateValue = `${userId}-${timestamp}-${randomSuffix}`;
      
      // Store user information alongside the state parameter in a file
      // This is a critical fallback for when sessions fail
      try {
        const fs = require('fs');
        fs.writeFileSync('stripe-connect-state.txt', stateValue);
        fs.writeFileSync('stripe-connect-user.txt', userId.toString());
        log(`Backed up connection state to filesystem for user ${userId}`, "stripe");
      } catch (fsErr) {
        log(`Warning: Failed to back up state to filesystem: ${fsErr.message}`, "stripe");
        // Continue anyway as this is just a backup
      }
      
      // Use the exact redirect URI that is configured in Stripe Dashboard
      const redirectUri = `${effectiveDomain}/api/stripe/oauth/callback`;
      log(`Using redirect URI: ${redirectUri}`, "stripe");
      
      // Create a direct Connect link with your Stripe client ID
      const directConnectUrl = new URL('https://dashboard.stripe.com/oauth/authorize');
      directConnectUrl.searchParams.append('response_type', 'code');
      directConnectUrl.searchParams.append('client_id', stripeClientId);
      directConnectUrl.searchParams.append('scope', 'read_write');
      directConnectUrl.searchParams.append('redirect_uri', redirectUri);
      directConnectUrl.searchParams.append('state', stateValue);
      
      log(`Final OAuth URL: ${directConnectUrl.toString()}`, "stripe");
      
      // Return the URL for frontend to redirect
      res.json({ url: directConnectUrl.toString() });
    } catch (error) {
      log(`Error generating Stripe OAuth URL: ${error.message}`, "stripe");
      res.status(500).json({ message: "Failed to initiate Stripe connection" });
    }
  });
  
  // Keep this route just for backward compatibility, though we're now using the standard callback path
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
  
  // Main Stripe OAuth callback endpoint
  app.get("/api/stripe/oauth/callback", async (req, res) => {
    try {
      log(`OAuth callback received: ${JSON.stringify(req.query)}`, "stripe");
      const { code, state } = req.query;
      
      // Log authentication status
      log(`Authentication Status: ${req.isAuthenticated()}`, "stripe");
      
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
      
      log(`OAuth token response received successfully`, "stripe");
      
      // Extract the connected account ID
      const connectedAccountId = response.stripe_user_id as string;
      log(`Connected Account ID: ${connectedAccountId}`, "stripe");
      
      // Critical: Store this account ID to a file for recovery
      try {
        const fs = require('fs');
        fs.writeFileSync('recover-connection.txt', connectedAccountId);
        log(`Saved Stripe account ID to filesystem: ${connectedAccountId}`, "stripe");
        
        // Also try to recover user ID from the state parameter or file
        let userId = null;
        
        // First try to parse user ID from state if available
        if (state && typeof state === 'string') {
          const stateStr = state as string;
          const parts = stateStr.split('-');
          if (parts.length >= 2) {
            userId = parseInt(parts[0]);
            log(`Recovered user ID from state: ${userId}`, "stripe");
          }
        }
        
        // If no user ID yet, try to read from file
        if (!userId && fs.existsSync('stripe-connect-user.txt')) {
          try {
            userId = parseInt(fs.readFileSync('stripe-connect-user.txt', 'utf8').trim());
            log(`Recovered user ID from file: ${userId}`, "stripe");
          } catch (readErr) {
            log(`Error reading user ID from file: ${readErr.message}`, "stripe");
          }
        }
        
        // If we found a user ID and it's not the same as the authenticated user (or no user authenticated),
        // store it for later
        if (userId) {
          fs.writeFileSync('stripe-connect-user-id.txt', userId.toString());
        }
      } catch (fsErr) {
        log(`Error saving account ID to file: ${fsErr.message}`, "stripe");
        // Continue anyway, this is just a fallback
      }
      
      // Also store in session as a backup
      (req.session as any).pendingStripeAccountId = connectedAccountId;
      req.session.save();
      
      // Handle the authentication scenarios
      if (!req.isAuthenticated()) {
        log(`User not authenticated during OAuth callback - redirecting to login`, "stripe");
        return res.redirect('/auth?message=' + encodeURIComponent('Please login to complete Stripe connection'));
      }
      
      // If we get here, user is authenticated, so save the account ID
      try {
        log(`User is authenticated: ${req.user.id}, username: ${req.user.username}`, "stripe");
        log(`Saving Stripe account ID ${connectedAccountId} for user ${req.user.id}`, "stripe");
        
        // Save the account ID to the user record
        await storage.updateUserStripeAccount(req.user.id, connectedAccountId);
        
        log(`Successfully connected Stripe account for user ${req.user.id}`, "stripe");
        
        // Redirect back to the payment connections page with success
        return res.redirect('/payment-connections?success=true');
      } catch (error: any) {
        log(`Error updating user record: ${error.message}`, "stripe");
        return res.redirect('/payment-connections?error=true&message=' + encodeURIComponent('Database error. Please try the recovery option.'));
      }
    } catch (error: any) {
      log(`OAuth callback error: ${error.message}`, "stripe");
      console.error("Full OAuth error:", error);
      
      // Special case for handling session errors more gracefully
      if (error.message && error.message.includes('session')) {
        return res.redirect('/payment-connections?warning=true&message=' + 
          encodeURIComponent('Session error occurred. Please try the recovery option.'));
      }
      
      return res.redirect('/payment-connections?error=true&message=' + 
        encodeURIComponent('Connection error. Please try the recovery option.'));
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

  // Endpoint to check for and recover a pending Stripe account connection
  app.get("/api/stripe/recover-connection", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Authentication required" });
    }
    
    try {
      const user = req.user;
      
      // Check if the user already has a connected account
      if (user.stripeAccountId) {
        return res.json({ 
          recovered: false, 
          message: "User already has a connected Stripe account", 
          alreadyConnected: true 
        });
      }
      
      // PRIORITY 1: Check the filesystem for a saved Stripe account ID
      // This is the most reliable method
      try {
        const fs = require('fs');
        if (fs.existsSync('./recover-connection.txt')) {
          const savedAccountId = fs.readFileSync('./recover-connection.txt', 'utf8').trim();
          
          if (savedAccountId && savedAccountId.startsWith('acct_')) {
            log(`Found saved account ID in recovery file: ${savedAccountId}`, "stripe");
            
            // Verify the account with Stripe
            try {
              const account = await stripe.accounts.retrieve(savedAccountId);
              log(`Successfully verified account with Stripe: ${account.id}`, "stripe");
              
              // Update the user's account with this ID
              await storage.updateUserStripeAccount(user.id, savedAccountId);
              
              // Optionally, delete the recovery file after successful recovery
              // But we'll keep it for now as an extra backup
              
              return res.json({
                recovered: true,
                message: "Successfully recovered Stripe connection from saved file",
                accountId: savedAccountId
              });
            } catch (accountError: any) {
              log(`Error verifying account with Stripe: ${accountError.message}`, "stripe");
              // Continue to next recovery method instead of failing
            }
          } else {
            log(`Invalid account ID format in recovery file: ${savedAccountId}`, "stripe");
          }
        } else {
          log(`No recovery file found`, "stripe");
        }
      } catch (fileError: any) {
        log(`Error processing recovery file: ${fileError.message}`, "stripe");
        // Continue to next recovery method
      }
      
      // PRIORITY 2: Check for pending account ID in session
      const pendingAccountId = (req.session as any).pendingStripeAccountId;
      if (pendingAccountId) {
        log(`Found pending Stripe account ${pendingAccountId} in session for user ${user.id}`, "stripe");
        
        try {
          // Verify the account with Stripe
          const account = await stripe.accounts.retrieve(pendingAccountId);
          
          // Save to user record
          await storage.updateUserStripeAccount(user.id, pendingAccountId);
          
          // Clear from session
          (req.session as any).pendingStripeAccountId = null;
          req.session.save();
          
          return res.json({
            recovered: true,
            message: "Successfully recovered Stripe connection from session",
            accountId: pendingAccountId
          });
        } catch (sessionError: any) {
          log(`Error recovering from session: ${sessionError.message}`, "stripe");
          // Continue to next method
        }
      }
      
      // PRIORITY 3: Try to match based on recent accounts
      try {
        // Get the 10 most recently created Stripe accounts
        const accounts = await stripe.accounts.list({ limit: 10 });
        
        // Find the most recently created account (less than 5 minutes old)
        const now = Date.now();
        for (const account of accounts.data) {
          if (account.created) {
            const accountCreated = new Date(account.created * 1000);
            const ageInMinutes = (now - accountCreated.getTime()) / (1000 * 60);
            
            // If account was created in the last 5 minutes, it's likely the one we want
            if (ageInMinutes < 5) {
              log(`Found recent account ${account.id} created ${ageInMinutes.toFixed(1)} minutes ago`, "stripe");
              
              // Save to user record
              await storage.updateUserStripeAccount(user.id, account.id);
              
              return res.json({
                recovered: true,
                message: "Successfully recovered from recently created account",
                accountId: account.id
              });
            }
          }
        }
      } catch (listError: any) {
        log(`Error listing Stripe accounts: ${listError.message}`, "stripe");
        // Continue to final response
      }
      
      // If all methods failed, provide a helpful response
      return res.json({ 
        recovered: false, 
        message: "No pending Stripe account could be recovered. Please try connecting again or enter your account ID manually." 
      });
    } catch (error: any) {
      log(`Error recovering Stripe connection: ${error.message}`, "stripe");
      return res.status(500).json({
        recovered: false,
        message: "Error during recovery process. Please try again or connect manually.",
        error: error.message
      });
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
      
      // Use the appropriate domain based on the request origin
      // This ensures we always use the actual domain the user is accessing from
      const effectiveDomain = req.headers.origin ? 
                             req.headers.origin.replace(/\/$/, '') : 
                             (process.env.NODE_ENV === 'production' ? domain : replitAppDomain);

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
          application_fee_amount: 0, // No platform fee as per client directive
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
