import { Express } from "express";
import Stripe from "stripe";
import { storage } from "./storage";
import { log } from "./vite";

// Helper function to create Stripe instance with proper typing
function createStripeInstance(key: string) {
  return new Stripe(key, {
    apiVersion: "2023-10-16" as any, // Force type to avoid version mismatch with Stripe types
  });
}

// Initialize Stripe with the secret key
const stripeSecretKey = process.env.STRIPE_SECRET_KEY || "sk_test_example";
const stripePublicKey = process.env.VITE_STRIPE_PUBLIC_KEY || "pk_test_example";

if (stripeSecretKey === "sk_test_example" || stripePublicKey === "pk_test_example") {
  log("Using test Stripe keys. Set STRIPE_SECRET_KEY and VITE_STRIPE_PUBLIC_KEY for production", "stripe");
}

// Create a function to get a Stripe instance with the latest key
function getStripe() {
  // Always use the current environment variable, not the cached value
  const currentKey = process.env.STRIPE_SECRET_KEY || stripeSecretKey;
  return createStripeInstance(currentKey);
}

// Create a singleton instance for regular use
const stripe = getStripe();

export function setupStripeRoutes(app: Express) {
  // Log all stripe routes being registered
  log("Setting up Stripe routes", "stripe");
  
  // List all available env vars for debugging (without revealing secrets)
  const envVarKeys = Object.keys(process.env).filter(key => key.includes('STRIPE'));
  log(`Available Stripe env vars: ${envVarKeys.join(', ')}`, "stripe");
  // Removed API test endpoint for production
  
  // Removed OAuth test endpoint for production
  
  // Get Stripe public key and configuration
  app.get("/api/stripe/config", (req, res) => {
    try {

      // redirect url should be in .env
      //  add validation if prod if yes use the url else redirect_dev_stripe_oauth_callback
      const redirectUrl = process.env.NODE_ENV === 'production'
        ? process.env.STRIPE_OAUTH_CALLBACK_URL 
        : process.env.REDIRECT_DEV_STRIPE_OAUTH_CALLBACK_URL;

      res.json({
        publishableKey: process.env.VITE_STRIPE_PUBLIC_KEY,
        clientId: process.env.STRIPE_CLIENT_ID,
        // Generate redirect URIs based on environment
        redirectUri: process.env.NODE_ENV !== 'production' 
          ? "https://events-manager.replit.app/api/stripe/oauth-callback"
          : "https://events.mosspointmainstreet.org/api/stripe/oauth-callback",
        // Include version info for diagnostics
        version: {
          apiVersion: "2023-10-16",
          app: "city-event-hub-1.0"
        }
      });
    } catch (error) {
      console.error("Error in Stripe config endpoint:", error);
      res.status(500).json({ error: "Failed to get Stripe configuration" });
    }
  });
  
  // Diagnostic endpoint for troubleshooting
  app.get("/api/stripe/diagnostics", async (req, res) => {
    // Only allow admins to access this endpoint
    if (!req.user || req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Unauthorized' });
    }
    
    try {
      const diagnostics: Record<string, any> = {};
      
      // Server environment information
      diagnostics.environment = {
        nodeEnv: process.env.NODE_ENV || 'development',
        timestamp: new Date().toISOString(),
        hostname: req.hostname,
        protocol: req.protocol,
        stripeClientIdExists: !!process.env.STRIPE_CLIENT_ID,
        stripeClientIdPrefix: process.env.STRIPE_CLIENT_ID?.substring(0, 8),
        stripeSecretKeyExists: !!process.env.STRIPE_SECRET_KEY,
        stripeSecretKeyPrefix: process.env.STRIPE_SECRET_KEY?.substring(0, 7),
        stripeWebhookSecretExists: !!process.env.STRIPE_WEBHOOK_SECRET,
        stripeOAuthKeyExists: !!process.env.STRIPE_OAUTH_KEY,
        stripeOAuthKeyPrefix: process.env.STRIPE_OAUTH_KEY?.substring(0, 7),
        isProduction: req.hostname.includes('mosspointmainstreet.org'),
        apiVersion: "2023-10-16",
      };
      
      // Test Stripe connection
      const stripeTest: Record<string, any> = {};
      
      // Check Stripe connection
      try {
        const stripe = getStripe();
        const balance = await stripe.balance.retrieve();
        stripeTest.connectionSuccessful = true;
        stripeTest.balanceAvailable = balance.available.map(b => ({
          amount: b.amount,
          currency: b.currency,
        }));
      } catch (error) {
        stripeTest.connectionSuccessful = false;
        stripeTest.connectionError = error instanceof Error ? error.message : String(error);
      }
      
      diagnostics.stripeTest = stripeTest;
      
      // User Stripe accounts count
      try {
        const usersWithStripeAccounts = await storage.countUsersWithStripeAccounts();
        diagnostics.userStats = {
          usersWithStripeAccounts,
        };
      } catch (error) {
        diagnostics.userStats = {
          error: error instanceof Error ? error.message : String(error)
        };
      }
      
      res.json(diagnostics);
    } catch (error) {
      console.error('Error generating diagnostics:', error);
      res.status(500).json({ error: 'Failed to generate diagnostic information' });
    }
  });
  
  // Removed debug settings endpoint for production

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

      // Use different URLs for OAuth redirect vs webhooks
      let redirectUri = process.env.REDIRECT_OAUTH_CALLBACK_URL || "https://events-manager.replit.app/api/stripe/oauth-callback";
      
      // In development on Replit, use events-manager.replit.app
      if (process.env.NODE_ENV !== 'production') {
        // OAuth redirect URL (different from webhook)
        redirectUri = process.env.REDIRECT_DEV_STRIPE_OAUTH_CALLBACK_URL || "https://events-manager.replit.app/api/stripe/oauth-callback";
        log(`Using development redirect URL: ${redirectUri}`, "stripe");
      }  
      
      // Log a clear message about URLs
      log(`Using appropriate OAuth redirect URLs (separate from webhook endpoints)`, "stripe");
      
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
      } catch (fsErr: unknown) {
        const errorMessage = fsErr instanceof Error ? fsErr.message : String(fsErr);
        log(`Warning: Failed to back up state to filesystem: ${errorMessage}`, "stripe");
        // Continue anyway as this is just a backup
      }
      
      // We already have our redirect URI set above
      log(`Final redirect URI: ${redirectUri}`, "stripe");
      
      // Create a direct Connect link with your Stripe client ID
      const directConnectUrl = new URL('https://dashboard.stripe.com/oauth/authorize');
      directConnectUrl.searchParams.append('response_type', 'code');
      directConnectUrl.searchParams.append('client_id', stripeClientId);
      directConnectUrl.searchParams.append('scope', 'read_write');
      directConnectUrl.searchParams.append('redirect_uri', redirectUri);
      directConnectUrl.searchParams.append('state', stateValue);
      
      // Store state in the session as well
      (req.session as any).stripeConnectState = stateValue;
      await new Promise<void>((resolve) => {
        req.session.save(() => {
          log(`Saved Stripe connect state to session: ${stateValue}`, "stripe");
          resolve();
        });
      });
      
      // Also store in a cookie (backup method, 10 minute expiry)
      res.cookie('stripe_connect_state', stateValue, {
        maxAge: 10 * 60 * 1000, // 10 minutes
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax'
      });
      
      log(`Final OAuth URL: ${directConnectUrl.toString()}`, "stripe");
      
      // Return the URL for frontend to redirect
      res.json({ url: directConnectUrl.toString() });
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      log(`Error generating Stripe OAuth URL: ${errorMessage}`, "stripe");
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
      
      // Validate state parameter if provided for CSRF protection
      if (state) {
        // Try multiple methods to retrieve the original state
        let originalState = null;
        
        // 1. First check session (primary storage)
        const sessionState = (req.session as any).stripeConnectState;
        if (sessionState) {
          log(`Found state in session: ${sessionState}`, "stripe");
          originalState = sessionState;
        }
        
        // 2. Next check cookie (secondary storage)
        if (!originalState) {
          const cookieState = req.cookies?.stripe_connect_state;
          if (cookieState) {
            log(`Found state in cookie: ${cookieState}`, "stripe");
            originalState = cookieState;
          }
        }
        
        // 3. Finally check file (tertiary backup)
        if (!originalState) {
          try {
            const fs = require('fs');
            if (fs.existsSync('./stripe-connect-state.txt')) {
              originalState = fs.readFileSync('./stripe-connect-state.txt', 'utf8').trim();
              log(`Found state in filesystem: ${originalState}`, "stripe");
            }
          } catch (err: unknown) {
            const errorMessage = err instanceof Error ? err.message : String(err);
            log(`Error reading state from file: ${errorMessage}`, "stripe");
          }
        }
        
        // If we have original state and it doesn't match, reject the request
        if (originalState && originalState !== state) {
          log(`State validation failed. Expected: ${originalState}, Received: ${state}`, "stripe");
          return res.redirect('/payment-connections?error=true&message=' + encodeURIComponent('Security verification failed. Please try again.'));
        }
        
        // Clean up state from storage
        if (sessionState) {
          delete (req.session as any).stripeConnectState;
          req.session.save();
        }
        
        if (req.cookies?.stripe_connect_state) {
          res.clearCookie('stripe_connect_state');
        }
        
        try {
          const fs = require('fs');
          if (fs.existsSync('./stripe-connect-state.txt')) {
            fs.unlinkSync('./stripe-connect-state.txt');
          }
        } catch (err) {
          // Ignore file deletion errors
        }
      }
      
      // Exchange the code for a Stripe account ID using the Stripe SDK
      let response;
      try {
        log(`Exchanging authorization code for access token using Stripe SDK...`, "stripe");
        
        // Get credentials
        const secretKey = process.env.STRIPE_SECRET_KEY;
        
        if (!secretKey) {
          log(`Missing required Stripe credentials`, "stripe");
          return res.redirect('/payment-connections?error=true&message=' + 
            encodeURIComponent('Server configuration error. Please contact support.'));
        }
        
        // Log some diagnostic information (first few chars only)
        log(`Using Stripe secret_key starting with: ${secretKey.substring(0, 8)}...`, "stripe");
        
        // Create a fresh Stripe instance with latest key
        const freshStripe = createStripeInstance(secretKey);
        
        log(`Created fresh Stripe instance for token exchange`, "stripe");
        
        // Use Stripe SDK to exchange the authorization code for an access token
        try {
          // SDK handles all the authentication and request formatting for us
          const tokenResponse = await freshStripe.oauth.token({
            grant_type: 'authorization_code',
            code: code as string,
          });
          
          // Success! Store the response
          log(`SDK token exchange succeeded: ${JSON.stringify(tokenResponse)}`, "stripe");
          response = tokenResponse;
        } catch (sdkError: any) {
          log(`SDK token exchange failed: ${sdkError.message}`, "stripe");
          
          // Handle specific error types from Stripe error object
          if (sdkError.code === 'invalid_grant') {
            return res.redirect('/payment-connections?error=true&message=' + 
              encodeURIComponent('Invalid authorization code. It may have expired or already been used.'));
          }
          
          if (sdkError.code === 'invalid_client') {
            return res.redirect('/payment-connections?error=true&message=' + 
              encodeURIComponent('Authentication failed. Please contact support.'));
          }
          
          return res.redirect('/payment-connections?error=true&message=' + 
            encodeURIComponent(sdkError.message || 'Failed to connect with Stripe. Please try again.'));
        }
      } catch (exchangeError: any) {
        log(`Critical error during token exchange: ${exchangeError.message}`, "stripe");
        return res.redirect('/payment-connections?error=true&message=' + 
          encodeURIComponent('Error connecting to Stripe. Please try again.'));
      }
      
      console.error(`OAuth token response: ${JSON.stringify(response)}`);
      log(`OAuth token response received`, "stripe");
      
      // Important: Verify we actually have a Stripe user ID in the response
      if (!response.stripe_user_id) {
        console.error("Missing stripe_user_id in OAuth response:", response);
        return res.redirect('/payment-connections?error=true&message=' + 
          encodeURIComponent('Invalid response from Stripe. The account ID was missing.'));
      }
      
      // Extract the connected account ID
      const connectedAccountId = response.stripe_user_id as string;
      console.error(`Connected account ID: ${connectedAccountId}`);
      
      // Store the account ID in multiple places for greater reliability
      
      // 1. Session storage (primary)
      (req.session as any).stripeAccountId = connectedAccountId;
      req.session.save();
      console.error(`Saved account ID to session: ${connectedAccountId}`);
      
      // 2. Cookie (backup)
      res.cookie('stripe_account_id', connectedAccountId, { 
        maxAge: 5 * 60 * 1000, // 5 minutes
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax'
      });
      console.error(`Saved account ID to cookie: ${connectedAccountId}`);
      
      // 3. File system (tertiary backup)
      try {
        // Don't use require in async contexts, it causes issues
        const { writeFileSync } = await import('fs');
        writeFileSync('recover-connection.txt', connectedAccountId);
        console.error(`Saved account ID to file: ${connectedAccountId}`);
      } catch (err) {
        // Ignore file write errors
        console.error("Could not write recovery file:", err);
      }
      
      if (!req.isAuthenticated()) {
        // If user needs to log in, store the account ID in session and redirect to login
        console.error("User not authenticated, redirecting to login");
        return res.redirect('/auth?message=' + encodeURIComponent('Please login to complete Stripe connection'));
      }
      
      console.error(`User authenticated, updating Stripe account for user ${req.user.id}`);
      
      try {
        // Save the account ID to the user's record
        await storage.updateUserStripeAccount(req.user.id, connectedAccountId);
        console.error(`Successfully updated user record with Stripe account ID`);
        
        // Redirect back to payment connections page with success
        res.redirect('/payment-connections?success=true');
      } catch (dbError: any) {
        console.error("Database error saving Stripe account:", dbError);
        return res.redirect('/payment-connections?error=true&message=' + 
          encodeURIComponent('Database error saving your Stripe account: ' + dbError.message));
      }
    } catch (error: any) {
      log(`Stripe callback error: ${error.message}`, "stripe");
      console.error("Full OAuth error:", error);
      res.redirect('/payment-connections?error=true&message=' + encodeURIComponent(error.message || 'Failed to connect Stripe account'));
    }
  });
  
  // Add the specific OAuth callback route we're setting as redirect_uri
  app.get("/api/stripe/oauth-callback", async (req, res) => {
    log(`OAuth callback received at /api/stripe/oauth-callback: ${JSON.stringify(req.query)}`, "stripe");
    
    // Extract the code and state
    const { code, state } = req.query;
    
    if (!code) {
      return res.redirect('/payment-connections?error=true&message=' + 
        encodeURIComponent('Authorization failed or was denied'));
    }
    
    // Exchange the code for an account ID
    try {
      // First try to use a restricted key for OAuth if available
      const oauthKey = process.env.STRIPE_OAUTH_KEY || process.env.STRIPE_SECRET_KEY;
      if (!oauthKey) {
        return res.redirect('/payment-connections?error=true&message=' + 
          encodeURIComponent('Server configuration error. Missing API key.'));
      }
      
      log(`Using OAuth key: ${oauthKey.substring(0, 7)}...`, "stripe");
      
      // Create a fresh Stripe instance with the OAuth key
      const freshStripe = createStripeInstance(oauthKey);
      
      // Exchange the code for a token
      const tokenResponse = await freshStripe.oauth.token({
        grant_type: 'authorization_code',
        code: code as string,
      });
      
      if (!tokenResponse.stripe_user_id) {
        return res.redirect('/payment-connections?error=true&message=' + 
          encodeURIComponent('Invalid response from Stripe. The account ID was missing.'));
      }
      
      const connectedAccountId = tokenResponse.stripe_user_id;
      
      // Save the account ID to the user
      if (req.isAuthenticated()) {
        await storage.updateUserStripeAccount(req.user.id, connectedAccountId);
        return res.redirect('/payment-connections?success=true');
      } else {
        // Not authenticated, save to session and redirect to login
        (req.session as any).pendingStripeAccountId = connectedAccountId;
        req.session.save();
        return res.redirect('/auth?message=' + 
          encodeURIComponent('Please login to complete Stripe connection'));
      }
    } catch (error: any) {
      log(`Error in OAuth callback: ${error.message}`, "stripe");
      return res.redirect('/payment-connections?error=true&message=' + 
        encodeURIComponent(error.message || 'Failed to connect Stripe account'));
    }
  });
  
  // LEGACY: Old broader debug endpoint
  app.get("/api/stripe/oauth/callback", async (req, res) => {
    // First, write everything to a file to ensure we capture it
    log(`STRIPE OAUTH CALLBACK RECEIVED: ${new Date().toISOString()}`, "stripe");
    
    try {
      // Write to multiple logs to ensure we catch this
      console.log("STRIPE OAUTH CALLBACK RECEIVED");
      console.error("STRIPE OAUTH CALLBACK RECEIVED");
      
      const fs = require('fs');
      fs.writeFileSync('stripe-callback-debug.txt', 
        `TIME: ${new Date().toISOString()}\n` +
        `QUERY: ${JSON.stringify(req.query)}\n` +
        `SESSION: ${req.sessionID}\n` +
        `AUTH: ${req.isAuthenticated()}\n` +
        `USER: ${req.isAuthenticated() ? JSON.stringify(req.user.id) : 'not-authenticated'}\n` +
        `HEADERS: ${JSON.stringify(req.headers)}\n` +
        `PATH: ${req.path}\n` +
        `URL: ${req.url}\n` +
        `PROTOCOL: ${req.protocol}\n` +
        `HOSTNAME: ${req.hostname}\n`
      );
      
      log(`Stripe callback debug info written to file`, "stripe");
    } catch (logErr) {
      // Continue even if logging fails
      log(`Error writing callback debug info: ${logErr}`, "stripe");
    }
  
    try {
      // Use console.error to ensure messages appear in logs
      console.error("====== STRIPE OAUTH CALLBACK ======");
      console.error("Query params:", JSON.stringify(req.query, null, 2));
      console.error("Headers host:", JSON.stringify(req.headers["host"], null, 2));
      console.error("Headers origin:", JSON.stringify(req.headers["origin"], null, 2));
      console.error("Headers referer:", JSON.stringify(req.headers["referer"], null, 2));
      console.error("Authenticated:", req.isAuthenticated());
      console.error("Session ID:", req.sessionID);
      if (req.isAuthenticated()) {
        console.error("User ID:", req.user.id);
        console.error("User role:", req.user.role);
      } else {
        console.error("WARNING: USER NOT AUTHENTICATED DURING CALLBACK");
      }
      console.error("================================");
      
      const { code, error, error_description, state } = req.query;
      
      // Handle Stripe errors
      if (error) {
        console.error("ERROR FROM STRIPE:", error, error_description);
        // Write error to specific file
        try {
          const fs = require('fs');
          fs.writeFileSync('stripe-error.txt', 
            `TIME: ${new Date().toISOString()}\n` +
            `ERROR: ${error}\n` +
            `DESCRIPTION: ${error_description}\n`
          );
        } catch (logErr) {
          // Continue even if logging fails
        }
        return res.redirect(`/payment-connections?error=true&message=${encodeURIComponent(error_description as string || 'Stripe authorization was denied')}`);
      }
      
      if (!code) {
        console.error("NO CODE PROVIDED");
        return res.redirect('/payment-connections?error=true&message=Missing+authorization+code');
      }
      
      console.error("Got code:", code);
      console.error("Got state:", state);
      
      // Try to recover user ID from state if user is not authenticated
      let userId = null;
      if (!req.isAuthenticated()) {
        try {
          // Parse state parameter which has format userId-timestamp-randomsuffix
          if (state && typeof state === 'string') {
            const stateparts = state.split('-');
            if (stateparts.length >= 3) {
              userId = parseInt(stateparts[0]);
              console.error("RECOVERED USER ID FROM STATE:", userId);
            }
          }
          
          // Check file system backup
          if (!userId) {
            const fs = require('fs');
            if (fs.existsSync('./stripe-connect-user.txt')) {
              userId = parseInt(fs.readFileSync('./stripe-connect-user.txt', 'utf8').trim());
              console.error("RECOVERED USER ID FROM FILE:", userId);
            }
          }
        } catch (stateError) {
          console.error("Failed to recover user ID:", stateError);
        }
      }
      
      // Get credentials for API call
      const clientId = process.env.STRIPE_CLIENT_ID;
      // First try to use a restricted key for OAuth if available
      const oauthKey = process.env.STRIPE_OAUTH_KEY || process.env.STRIPE_SECRET_KEY;
      
      if (!clientId || !oauthKey) {
        console.error("MISSING CREDENTIALS");
        return res.redirect('/payment-connections?error=true&message=Server+configuration+error');
      }
      
      console.error("Credentials OK, proceeding with token exchange");
      
      try {
        // Get a completely fresh Stripe instance with the latest key
        const freshStripe = createStripeInstance(oauthKey);
        
        console.error("Created fresh Stripe instance with key format:", 
          oauthKey.substring(0, 7) + "..." + oauthKey.substring(oauthKey.length - 4));
        
        // IMPORTANT: Use the Stripe SDK directly for OAuth token exchange
        // This bypasses any issues with fetch and ensures the correct authentication method
        console.error("Making token request using Stripe SDK directly");
        
        // Use the SDK's OAuth.token method to get the connected account ID
        const tokenResponse = await freshStripe.oauth.token({
          grant_type: 'authorization_code',
          code: code as string,
        });
        
        console.error("OAuth token response received:", JSON.stringify(tokenResponse, null, 2));
        
        // The Stripe SDK response is different from the direct API:
        // - direct API (fetch): responseData.stripe_user_id
        // - SDK: responseData.stripe_user_id OR responseData.access_token depending on response
        
        // Stripe SDK handles parsing, errors and retries automatically
        
        // Extract account ID - could be in either stripe_user_id or access_token fields
        const connectedAccountId = tokenResponse.stripe_user_id || 
                                  (tokenResponse.access_token?.startsWith('sk_') ? tokenResponse.stripe_user_id : null);
        
        if (!connectedAccountId) {
          console.error("No account ID in response:", tokenResponse);
          return res.redirect('/payment-connections?error=true&message=Missing+account+ID+in+Stripe+response');
        }
        
        console.log("SUCCESS! Connected account ID:", connectedAccountId);
        
        // Save account ID to recovery file
        try {
          const { writeFileSync } = await import('fs');
          writeFileSync('recover-connection.txt', connectedAccountId);
          console.log("Wrote account ID to recovery file");
        } catch (writeError) {
          console.error("Failed to write recovery file:", writeError);
        }
        
        // Check authentication status
        if (req.isAuthenticated()) {
          console.log("User is authenticated, updating account");
          try {
            await storage.updateUserStripeAccount(req.user.id, connectedAccountId);
            console.log("Successfully updated user's Stripe account ID");
            return res.redirect('/payment-connections?success=true');
          } catch (dbError) {
            console.error("Database error when updating user:", dbError);
            return res.redirect('/payment-connections?error=true&message=Database+error');
          }
        } else {
          console.log("User is NOT authenticated, storing ID for later and redirecting to login");
          // Store the account ID in a cookie that will be checked after login
          res.cookie('pending_stripe_account_id', connectedAccountId, {
            maxAge: 30 * 60 * 1000, // 30 minutes
            httpOnly: true,
            secure: true,
            sameSite: 'lax'
          });
          return res.redirect('/auth?redirect=/payment-connections&pendingStripeConnection=true');
        }
      } catch (exchangeError) {
        console.error("CRITICAL ERROR during token exchange:", exchangeError);
        return res.redirect('/payment-connections?error=true&message=Network+error+connecting+to+Stripe');
      }
    } catch (outerError) {
      console.error("UNCAUGHT EXCEPTION in OAuth callback:", outerError);
      return res.redirect('/payment-connections?error=true&message=Internal+server+error');
    }
  });

  // Direct endpoint for the form post from OAuth callback
  app.post("/api/stripe/manual-connect", async (req, res) => {
    try {
      console.log("**************************");
      console.log("STRIPE MANUAL CONNECT ENDPOINT HIT");
      console.log("Request body:", JSON.stringify(req.body));
      console.log("Headers:", JSON.stringify(req.headers, null, 2));
      console.log("User authenticated:", req.isAuthenticated());
      if (req.isAuthenticated()) {
        console.log("User ID:", req.user.id);
      }
      console.log("**************************");
      
      // Allow two ways: either direct account ID or authorization code
      const { stripeAccountId, authCode } = req.body;
      
      // APPROACH 1: Direct account ID
      if (stripeAccountId) {
        if (!stripeAccountId.startsWith('acct_')) {
          return res.redirect('/payment-connections?error=true&message=' + encodeURIComponent('Invalid Stripe account ID format'));
        }
        
        // Validate the account ID with Stripe
        try {
          await stripe.accounts.retrieve(stripeAccountId);
        } catch (error) {
          return res.redirect('/payment-connections?error=true&message=' + encodeURIComponent('Invalid Stripe account ID. Please try again.'));
        }
        
        // Account ID is valid, proceed to save it
        console.log("Valid Stripe account ID:", stripeAccountId);
      }
      // APPROACH 2: Authorization code
      else if (authCode) {
        console.log("Authorization code provided, attempting to exchange...");
        
        try {
          // Get a completely fresh Stripe instance with the latest key
          // First try to use a restricted key for OAuth if available
          const oauthKey = process.env.STRIPE_OAUTH_KEY || process.env.STRIPE_SECRET_KEY;
          if (!oauthKey) {
            return res.redirect('/payment-connections?error=true&message=' + encodeURIComponent('Missing Stripe secret key'));
          }
          
          console.log("Using key format:", oauthKey.substring(0, 7) + "..." + oauthKey.substring(oauthKey.length - 4));
          
          const freshStripe = createStripeInstance(oauthKey);
          
          // Exchange the code for an account ID
          console.log("Exchanging code using Stripe SDK...");
          const tokenResponse = await freshStripe.oauth.token({
            grant_type: 'authorization_code',
            code: authCode,
          });
          
          console.log("Token response:", JSON.stringify(tokenResponse));
          
          // Extract the account ID from the response
          if (!tokenResponse.stripe_user_id) {
            console.error("No stripe_user_id in response:", tokenResponse);
            return res.status(400).json({
              success: false,
              error: "Missing account ID in token response"
            });
          }
          
          // We got the account ID! Set it for further processing
          const connectedAccountId = tokenResponse.stripe_user_id;
          console.log("Successfully exchanged code for account ID:", connectedAccountId);
          
          // Update req.body for the rest of the function to use
          req.body.stripeAccountId = connectedAccountId;
        } catch (exchangeError: unknown) {
          console.error("Error exchanging code:", exchangeError);
          return res.status(400).json({
            success: false,
            error: exchangeError instanceof Error ? exchangeError.message : "Failed to exchange code for token"
          });
        }
      } else {
        return res.status(400).json({
          success: false,
          error: "Either stripeAccountId or authCode must be provided"
        });
      }
      
      // At this point, req.body.stripeAccountId should be set
      // Either it was provided directly or we got it from the code exchange
      const finalAccountId = req.body.stripeAccountId;
      
      if (!finalAccountId) {
        return res.status(500).json({
          success: false,
          error: "No account ID available after processing" 
        });
      }
      
      // Store the account ID in a cookie that lasts 5 minutes
      res.cookie('stripe_account_id', finalAccountId, { 
        maxAge: 5 * 60 * 1000, // 5 minutes
        httpOnly: true,
        secure: true,
        sameSite: 'lax'
      });
      
      // Also save to file for backup
      try {
        // Don't use require in async contexts, it causes issues
        const { writeFileSync } = await import('fs');
        writeFileSync('recover-connection.txt', finalAccountId);
      } catch (err) {
        console.error("Failed to write to file:", err);
        // Continue anyway
      }
      
      // Check if user is authenticated
      if (!req.isAuthenticated()) {
        return res.redirect('/auth?message=' + encodeURIComponent('Please log in to complete your Stripe connection'));
      }
      
      // User is authenticated, connect the account
      await storage.updateUserStripeAccount(req.user.id, finalAccountId);
      
      // Clear the cookie since we've stored the value
      res.clearCookie('stripe_account_id');
      
      // If this was a JSON request, return JSON
      if (req.headers['content-type']?.includes('application/json')) {
        return res.json({
          success: true,
          accountId: finalAccountId,
          message: "Successfully connected Stripe account"
        });
      }
      
      // Otherwise redirect
      return res.redirect('/payment-connections?success=true');
    } catch (error: any) {
      log(`Error in manual connect: ${error.message}`, "stripe");
      
      // If this was a JSON request, return JSON error
      if (req.headers['content-type']?.includes('application/json')) {
        return res.status(500).json({
          success: false,
          error: error.message || "Unknown error"
        });
      }
      
      // Otherwise redirect with error
      return res.redirect('/payment-connections?error=true&message=' + encodeURIComponent('Error connecting Stripe account. Please try again.'));
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
  // Add endpoint to disconnect a Stripe account
  app.post("/api/stripe/disconnect", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ 
        success: false,
        message: "Not authenticated" 
      });
    }
    
    try {
      const user = req.user;
      
      if (!user.stripeAccountId) {
        return res.status(400).json({
          success: false,
          message: "No Stripe account connected"
        });
      }
      
      // Store the accountId before disconnecting for logging purposes
      const accountId = user.stripeAccountId;
      
      // Remove the connection in our database
      // Pass empty string instead of null since the method signature requires a string
      await storage.updateUserStripeAccount(user.id, "");
      
      log(`User ${user.id} disconnected Stripe account ${accountId}`, "stripe");
      
      return res.json({
        success: true,
        message: "Successfully disconnected Stripe account"
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      log(`Error disconnecting Stripe account: ${errorMessage}`, "stripe");
      return res.status(500).json({
        success: false,
        message: "Failed to disconnect account",
        error: errorMessage
      });
    }
  });

  app.get("/api/stripe/account-status", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Authentication required" });
    }

    try {
      if (!req.user.stripeAccountId) {
        log(`User ${req.user.id} has no Stripe account ID`, "stripe");
        return res.json({ connected: false });
      }
      
      log(`Checking Stripe account status for user ${req.user.id} with account ID ${req.user.stripeAccountId}`, "stripe");
      
      // Create a fresh Stripe instance with latest key to ensure we're using valid credentials
      const freshStripe = createStripeInstance(process.env.STRIPE_SECRET_KEY || stripeSecretKey);
      
      try {
        // Retrieve the account to get its current status
        const account = await freshStripe.accounts.retrieve(req.user.stripeAccountId);
        
        log(`Successfully retrieved Stripe account ${account.id} for user ${req.user.id}`, "stripe");
        
        return res.json({
          connected: true,
          accountId: account.id,
          detailsSubmitted: account.details_submitted,
          chargesEnabled: account.charges_enabled,
          payoutsEnabled: account.payouts_enabled
        });
      } catch (stripeError: any) {
        // Handle case where account may not exist anymore or is invalid
        log(`Stripe API error retrieving account ${req.user.stripeAccountId}: ${stripeError.message}`, "stripe");
        
        if (stripeError.code === 'account_invalid' || stripeError.code === 'resource_missing') {
          // The account no longer exists or is invalid
          log(`Marking invalid Stripe account ${req.user.stripeAccountId} as disconnected`, "stripe");
          
          // Update user record to remove the invalid account ID
          await storage.updateUserStripeAccount(req.user.id, "");
          
          return res.json({ 
            connected: false, 
            error: "Account no longer valid",
            message: "Your Stripe account is no longer valid or available. Please reconnect."
          });
        }
        
        // For other errors, return a generic error
        return res.status(500).json({ 
          connected: false,
          message: "Failed to retrieve Stripe account status",
          error: stripeError.message
        });
      }
    } catch (error: any) {
      log(`Error in account status endpoint: ${error.message}`, "stripe");
      return res.status(500).json({ 
        connected: false,
        message: "Failed to retrieve Stripe account status",
        error: error.message
      });
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
        // Don't use require or dynamic imports in Express handler code
        // Use synchronous file methods with full path to avoid path resolution issues
        const fs = await import('fs');
        const path = await import('path');
        const filePath = path.resolve('./recover-connection.txt');
        
        if (fs.existsSync(filePath)) {
          const savedAccountId = fs.readFileSync(filePath, 'utf8').trim();
          
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

      // Create order first
      const orderData = {
        userId: req.user.id,
        eventId: eventId,
        totalAmount: event.price * (quantity || 1),
        paymentMethod: 'stripe',
        status: 'pending',
        paymentStatus: 'pending'
      };
      
      const order = await storage.createOrder(orderData);
      
      // Create order item for the ticket
      await storage.createOrderItem({
        orderId: order.id,
        itemId: eventId,
        itemType: "ticket",
        name: `${event.title} - Ticket`,
        description: "Event ticket",
        quantity: quantity || 1,
        unitPrice: event.price,
        totalPrice: event.price * (quantity || 1),
        metadata: null
      });

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
          orderId: order.id.toString(),
          userId: req.user.id.toString(),
          eventId: eventId.toString(),
        },
      });

      res.json({ id: session.id, url: session.url });
    } catch (error: any) {
      log(`Stripe checkout error: ${error.message}`, "stripe");
      res.status(500).json({ message: error.message || "Failed to create checkout session" });
    }
  });

  // THIS ENDPOINT HANDLES BOTH WEBHOOK EVENTS AND OAUTH CALLBACKS
  // In Stripe Dashboard, this path must be registered for BOTH webhook events AND OAuth redirects
  app.all("/api/stripe/webhook", async (req, res) => {
    log(`Request to /api/stripe/webhook - Method: ${req.method}`, "stripe");
    
    // Handle GET requests (OAuth callbacks)
    if (req.method === 'GET') {
      const { code, state } = req.query;
      log(`OAuth callback received: code=${code ? 'present' : 'missing'}, state=${state ? 'present' : 'missing'}`, "stripe");
      
      if (!code) {
        log(`No authorization code in OAuth callback`, "stripe");
        return res.redirect('/payment-connections?error=true&message=' + encodeURIComponent('Authorization failed or was denied'));
      }
      
      // Validate state parameter if provided
      if (state) {
        // Get original state from session
        const sessionState = (req.session as any).stripeConnectState;
        
        if (sessionState && sessionState !== state) {
          log(`State validation failed. Expected: ${sessionState}, Received: ${state}`, "stripe");
          return res.redirect('/payment-connections?error=true&message=' + encodeURIComponent('Security verification failed'));
        }
        
        // Clear state from session
        if (sessionState) {
          delete (req.session as any).stripeConnectState;
          await new Promise<void>((resolve) => {
            req.session.save(() => resolve());
          });
        }
      }
      
      try {
        // Exchange code for access token
        const secretKey = process.env.STRIPE_SECRET_KEY;
        const clientId = process.env.STRIPE_CLIENT_ID;
        
        if (!secretKey || !clientId) {
          log(`Missing Stripe credentials`, "stripe");
          return res.redirect('/payment-connections?error=true&message=' + encodeURIComponent('Server configuration error'));
        }
        
        // The OAuth token exchange endpoint
        const tokenUrl = 'https://connect.stripe.com/oauth/token';
        
        // Direct fetch method - most reliable approach
        const fetchResponse = await fetch(tokenUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: new URLSearchParams({
            client_secret: secretKey,
            client_id: clientId,
            code: code as string,
            grant_type: 'authorization_code'
          }).toString()
        });
        
        if (!fetchResponse.ok) {
          const errorText = await fetchResponse.text();
          log(`Token exchange failed: ${fetchResponse.status} ${errorText}`, "stripe");
          return res.redirect('/payment-connections?error=true&message=' + encodeURIComponent(`Token exchange failed: ${errorText}`));
        }
        
        const tokenData = await fetchResponse.json();
        
        if (!tokenData.stripe_user_id) {
          log(`Missing stripe_user_id in response: ${JSON.stringify(tokenData)}`, "stripe"); 
          return res.redirect('/payment-connections?error=true&message=' + encodeURIComponent('Invalid response from Stripe: missing account ID'));
        }
        
        const stripeAccountId = tokenData.stripe_user_id;
        log(`Successfully obtained Stripe account ID: ${stripeAccountId}`, "stripe");
        
        // If user is logged in, save to their profile
        if (req.isAuthenticated()) {
          log(`Updating user ${req.user.id} with Stripe account ID ${stripeAccountId}`, "stripe");
          
          try {
            await storage.updateUserStripeAccount(req.user.id, stripeAccountId);
            return res.redirect('/payment-connections?success=true');
          } catch (dbError: any) {
            log(`Database error: ${dbError.message}`, "stripe");
            return res.redirect('/payment-connections?error=true&message=' + encodeURIComponent('Database error: ' + dbError.message));
          }
        } else {
          // Store the account ID in session and redirect to login
          log(`User not authenticated, storing account ID in session`, "stripe");
          (req.session as any).pendingStripeAccountId = stripeAccountId;
          
          await new Promise<void>((resolve) => {
            req.session.save(() => resolve());
          });
          
          return res.redirect('/auth?message=' + encodeURIComponent('Please log in to complete your Stripe connection'));
        }
      } catch (error: any) {
        log(`OAuth error: ${error.message}`, "stripe");
        return res.redirect('/payment-connections?error=true&message=' + encodeURIComponent(error.message || 'An error occurred'));
      }
    }
    // Handle POST requests (webhook events)
    else if (req.method === 'POST') {
      const sig = req.headers["stripe-signature"] as string;
      
      // Get the appropriate webhook secret based on host/domain
      const mainWebhookSecret = process.env.STRIPE_WEBHOOK_SECRET; // Primary domain (mosspointmainstreet.org)
      const replitWebhookSecret = process.env.STRIPE_REPLIT_WEBHOOK_SECRET; // Replit domain
      
      if (!mainWebhookSecret || !replitWebhookSecret) {
        log(`Missing webhook secrets. Main: ${Boolean(mainWebhookSecret)}, Replit: ${Boolean(replitWebhookSecret)}`, "stripe");
        return res.status(500).json({ 
          success: false,
          error: "Server configuration error: Missing webhook secrets"
        });
      }
      
      // Determine which secret to use based on the host header or Forwarded header
      const host = req.get('host') || '';
      const forwardedHost = req.get('X-Forwarded-Host') || '';
      const effectiveHost = forwardedHost || host;
      
      log(`Webhook received from host: ${effectiveHost}`, "stripe");
      
      // Select the appropriate webhook secret
      let webhookSecret = mainWebhookSecret;
      const isReplitDomain = effectiveHost.includes('replit.app');
      
      if (isReplitDomain) {
        log(`Using Replit-specific webhook secret for domain: ${effectiveHost}`, "stripe");
        webhookSecret = replitWebhookSecret;
      } else {
        log(`Using main domain webhook secret for domain: ${effectiveHost}`, "stripe");
      }

      let event;

      try {
        // Verify webhook signature with the appropriate secret
        if (!sig) {
          log(`Missing Stripe signature in webhook request`, "stripe");
          return res.status(400).json({
            received: false,
            error: "Missing Stripe signature",
            domain: effectiveHost
          });
        }

        if (webhookSecret) {
          try {
            // First try with the primary secret (selected based on domain)
            event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
            log(`Webhook verified with primary secret for domain: ${effectiveHost}`, "stripe");
          } catch (primaryErr: unknown) {
            const primaryErrorMessage = primaryErr instanceof Error ? primaryErr.message : String(primaryErr);
            log(`Primary webhook verification failed: ${primaryErrorMessage}`, "stripe");
            
            // Try the alternative secret as a fallback
            const fallbackSecret = isReplitDomain ? mainWebhookSecret : replitWebhookSecret;
            
            try {
              log(`Attempting verification with fallback webhook secret...`, "stripe");
              event = stripe.webhooks.constructEvent(req.body, sig, fallbackSecret);
              log(`Fallback webhook verification succeeded!`, "stripe");
            } catch (fallbackErr: unknown) {
              const fallbackErrorMessage = fallbackErr instanceof Error ? fallbackErr.message : String(fallbackErr);
              log(`Fallback webhook verification also failed: ${fallbackErrorMessage}`, "stripe");
              return res.status(400).json({
                received: false,
                error: "Webhook signature verification failed with both secrets",
                primaryError: primaryErrorMessage,
                fallbackError: fallbackErrorMessage,
                domain: effectiveHost
              });
            }
          }
        } else {
          // This should never happen due to our earlier check, but just in case
          log(`ERROR: No webhook secret available for verification`, "stripe");
          return res.status(500).json({ 
            received: false,
            error: "Server configuration error: No webhook secret available",
            domain: effectiveHost
          });
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
            
            // Store detailed payment information
            try {
              // Extract metadata if available
              const metadata = paymentIntent.metadata || {};
              const userId = metadata.userId ? parseInt(metadata.userId) : null;
              const eventId = metadata.eventId ? parseInt(metadata.eventId) : null;
              
              if (userId && eventId) {
                // Record transaction details in analytics
                await storage.recordAnalyticEvent({
                  metric: "payment_success",
                  value: paymentIntent.amount / 100, // Convert from cents
                  eventId,
                  dimension: "payment_type",
                  dimensionValue: metadata.paymentType || "standard",
                  metadata: {
                    userId, // Store userId in metadata as it's not in the schema
                    paymentId: paymentIntent.id,
                    paymentMethod: paymentIntent.payment_method_types?.[0] || "card",
                    currency: paymentIntent.currency,
                    // PaymentIntent type doesn't have amount_refunded, use 0 as default
                    amountRefunded: 0,
                    receiptEmail: paymentIntent.receipt_email || null,
                    description: paymentIntent.description || null,
                    status: paymentIntent.status,
                    timestamp: new Date().toISOString()
                    // Don't store fullData to avoid bloating the database
                  }
                });
                
                log(`Recorded detailed payment analytics for user ${userId}, event ${eventId}`, "stripe");
                
                // Create admin note about payment
                await storage.createAdminNote({
                  adminId: 1, // System admin ID
                  targetType: "event",
                  targetId: eventId,
                  note: `Payment of ${(paymentIntent.amount / 100).toFixed(2)} ${paymentIntent.currency.toUpperCase()} received from user #${userId}`
                });
              } else {
                log(`PaymentIntent ${paymentIntent.id} has no user/event metadata, can't associate with records`, "stripe");
              }
            } catch (error: unknown) {
              const errorMessage = error instanceof Error ? error.message : String(error);
              log(`Error processing payment_intent.succeeded: ${errorMessage}`, "stripe");
            }
            break;
          }
          
          // New handlers for Connect account verification
          case "account.updated": {
            // A connected account was updated, check verification status
            const account = event.data.object;
            log(`Connected Stripe account updated: ${account.id}`, "stripe");
            await handleAccountUpdated(account);
            break;
          }
          
          case "account.application.deauthorized": {
            // A user has deauthorized your application
            const account = event.data.object;
            log(`Stripe account deauthorized: ${account.id}`, "stripe");
            await handleAccountDeauthorized(account);
            break;
          }
          
          case "account.external_account.created": {
            // A bank account or card was added to a connected account
            const externalAccount = event.data.object;
            log(`External account added: ${externalAccount.id}`, "stripe");
            break;
          }
          
          case "account.external_account.updated": {
            // A bank account or card was updated on a connected account
            const externalAccount = event.data.object;
            log(`External account updated: ${externalAccount.id}`, "stripe");
            break;
          }
        }

        res.json({ received: true });
      } catch (err: unknown) {
        const errorMessage = err instanceof Error ? err.message : String(err);
        log(`Unexpected error during webhook processing: ${errorMessage}`, "stripe");
        return res.status(500).json({
          received: false, 
          error: `Webhook processing error: ${errorMessage}`,
          domain: effectiveHost
        });
      }
    } else {
      // Method not allowed
      return res.status(405).json({ 
        error: "Method not allowed",
        allowedMethods: ["GET", "POST"]
      });
    }
  });

  // Helper function to handle successful checkout
  async function handleCheckoutSessionCompleted(session: Stripe.Checkout.Session) {
    try {
      const metadata = session.metadata as Record<string, string> || {};
      const orderId = metadata.orderId;
      const userId = metadata.userId;
      const eventId = metadata.eventId;
      
      if (!orderId || !userId || !eventId) {
        log(`Missing required metadata in session: ${JSON.stringify(metadata)}`, "stripe");
        return;
      }
      
      try {
        // Get the order that was created during checkout
        const orderIdInt = parseInt(orderId);
        
        // Update the order status to completed and add payment details
        const paymentIntent = session.payment_intent as string;
        await storage.updateOrderStatus(orderIdInt, "completed");
        await storage.updateOrderPaymentStatus(orderIdInt, "paid", paymentIntent);
        
        log(`Order ${orderIdInt} updated with payment details`, "stripe");
        
        // Get all order items to decrease slots
        const orderItems = await storage.getOrderItems(orderIdInt);
        
        // Process each order item and decrease slots
        for (const item of orderItems) {
          // Decrease slots for the purchased item
          await decreaseSlots(item.itemType, item.itemId, item.quantity);
          
          log(`Slots decreased for order item: ${item.itemType} ${item.itemId} (qty: ${item.quantity})`, "stripe");
        }
        
        log(`Payment processing completed for order: ${orderIdInt}`, "stripe");
      } catch (orderError: unknown) {
        const errorMessage = orderError instanceof Error ? orderError.message : String(orderError);
        log(`Error processing checkout: ${errorMessage}`, "stripe");
      }
      
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      log(`Error handling checkout completion: ${errorMessage}`, "stripe");
    }
  }

  // Helper function to decrease slots based on item type
  async function decreaseSlots(itemType: string, itemId: number, quantity: number) {
    try {
      switch (itemType) {
        case "ticket":
          await storage.decreaseEventTicketSlots(itemId, quantity);
          break;
        case "product":
        case "merchandise":
          await storage.decreaseProductQuantity(itemId, quantity);
          break;
        case "vendor_spot":
          await storage.decreaseVendorSpotSlots(itemId, quantity);
          break;
        case "volunteer_shift":
          await storage.decreaseVolunteerShiftSlots(itemId, quantity);
          break;
        default:
          log(`Unknown item type for slot decrease: ${itemType}`, "stripe");
      }
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      log(`Error decreasing slots for ${itemType} ${itemId}: ${errorMessage}`, "stripe");
      throw error; // Re-throw to handle at higher level
    }
  }
  
  // Handle account.updated webhook events to track verification status
  async function handleAccountUpdated(account: any) {
    try {
      // Find the user with this Stripe account
      const user = await findUserByStripeAccountId(account.id);
      
      if (!user) {
        log(`No user found for Stripe account: ${account.id}`, "stripe");
        return;
      }
      
      log(`Processing account update for user ${user.id} (${user.username})`, "stripe");
      
      // Check the verification requirements
      const requirements = account.requirements;
      
      // Create comprehensive status object with all account details
      const status = {
        accountId: account.id,
        detailsSubmitted: account.details_submitted,
        chargesEnabled: account.charges_enabled,
        payoutsEnabled: account.payouts_enabled,
        requirements: {
          currentlyDue: requirements?.currently_due || [],
          eventuallyDue: requirements?.eventually_due || [],
          pastDue: requirements?.past_due || []
        },
        capabilities: account.capabilities || {},
        business_type: account.business_type,
        business_profile: account.business_profile,
        settings: account.settings,
        tos_acceptance: account.tos_acceptance,
        future_requirements: account.future_requirements,
        payouts_enabled: account.payouts_enabled,
        timestamp: new Date().toISOString()
      };
      
      // Store complete verification status in database
      try {
        // Store the detailed status in a new analytics record
        await storage.recordAnalyticEvent({
          metric: "stripe_account_update",
          value: 1,
          eventId: null, // Not tied to a specific event
          dimension: "account_status",
          dimensionValue: account.charges_enabled ? "verified" : "pending",
          metadata: {
            userId: user.id, // Store userId in metadata since it's not in schema
            ...status // Store the full status object
          }
        });
        
        // Update user record with latest verification status
        await storage.updateUserStripeAccount(user.id, account.id);
        
        // Store verification status in analytics instead of user record
        // since our schema might not have these fields
        
        log(`Updated Stripe account status for user ${user.id}`, "stripe");
      } catch (dbError: unknown) {
        const errorMessage = dbError instanceof Error ? dbError.message : String(dbError);
        log(`Error storing account status: ${errorMessage}`, "stripe");
      }
      
      // Notify the user about required actions if needed
      if (requirements?.currently_due?.length > 0) {
        log(`User ${user.id} has pending Stripe requirements: ${requirements.currently_due.join(', ')}`, "stripe");
        
        try {
          // Create admin notification for pending requirements
          await storage.createAdminNote({
            adminId: 1, // System admin ID
            targetType: "user",
            targetId: user.id,
            note: `Stripe account has pending requirements: ${requirements.currently_due.join(', ')}`
          });
          
          // Here we could trigger an email notification
          // emailService.sendVerificationReminder(user.email, {
          //   accountId: account.id,
          //   requirements: requirements.currently_due
          // });
        } catch (noteError: unknown) {
          const errorMessage = noteError instanceof Error ? noteError.message : String(noteError);
          log(`Error creating admin note: ${errorMessage}`, "stripe");
        }
      }
      
      // When the account becomes fully verified
      if (account.charges_enabled) {
        log(`User ${user.id} Stripe account is now fully verified and can process payments`, "stripe");
        
        try {
          // Create admin note about verification
          await storage.createAdminNote({
            adminId: 1, // System admin ID
            targetType: "user",
            targetId: user.id,
            note: `Stripe account is now fully verified and can process payments.`
          });
          
          // Update user verification status if we have such a field
          // await storage.updateUserVerificationStatus(user.id, true);
        } catch (updateError: unknown) {
          const errorMessage = updateError instanceof Error ? updateError.message : String(updateError);
          log(`Error updating verification status: ${errorMessage}`, "stripe");
        }
      }
      
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      log(`Error handling account update: ${errorMessage}`, "stripe");
    }
  }
  
  // Handle account deauthorization
  async function handleAccountDeauthorized(account: any) {
    try {
      // Find user with this Stripe account
      const user = await findUserByStripeAccountId(account.id);
      
      if (!user) {
        log(`No user found for deauthorized Stripe account: ${account.id}`, "stripe");
        return;
      }
      
      log(`User ${user.id} (${user.username}) has deauthorized their Stripe account`, "stripe");
      
      // Update user record to remove the Stripe account connection
      try {
        // Passing empty string instead of null to avoid TypeScript error
        // The type expects a string, but the database can handle empty string as disconnected
        await storage.updateUserStripeAccount(user.id, "");
        
        // You might want to notify the user or take other actions
        // emailService.sendAccountDisconnectNotification(user.email);
        
      } catch (updateError: unknown) {
        const errorMessage = updateError instanceof Error ? updateError.message : String(updateError);
        log(`Error updating user after Stripe deauthorization: ${errorMessage}`, "stripe");
      }
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      log(`Error handling account deauthorization: ${errorMessage}`, "stripe");
    }
  }
  
  // Direct API endpoint for token exchange - maximum debug
  app.post("/api/stripe/direct-token-exchange", async (req, res) => {
    try {
      const { code } = req.body;
      
      if (!code) {
        return res.status(400).json({ error: "Authorization code is required" });
      }
      
      // Log the request details for debugging
      console.log("==== DIRECT TOKEN EXCHANGE REQUEST ====");
      console.log("Authorization Code:", code);
      console.log("======================================");
      
      // Get credentials
      const clientId = process.env.STRIPE_CLIENT_ID;
      const secretKey = process.env.STRIPE_SECRET_KEY;
      
      if (!clientId || !secretKey) {
        return res.status(500).json({ error: "Missing required Stripe credentials" });
      }
      
      // Try multiple methods to get the token
      
      // First method: SDK approach
      try {
        console.log("Attempting token exchange using Stripe SDK...");
        const freshStripe = createStripeInstance(secretKey);
        
        const tokenResponse = await freshStripe.oauth.token({
          grant_type: 'authorization_code',
          code: code,
        });
        
        console.log("SDK token response:", JSON.stringify(tokenResponse, null, 2));
        
        const connectedAccountId = tokenResponse.stripe_user_id;
        
        if (!connectedAccountId) {
          console.error("No stripe_user_id in SDK response:", tokenResponse);
          // Continue to next method instead of failing
        } else {
          // Success! Return the account ID
          console.log("SDK approach successful - account ID:", connectedAccountId);
          return res.json({
            success: true,
            method: "sdk",
            accountId: connectedAccountId,
            message: "Successfully retrieved Stripe account ID using SDK"
          });
        }
      } catch (sdkError) {
        console.log("SDK approach failed:", sdkError);
        // Continue to next method instead of failing
      }
      
      // Second method: Direct API approach using node-fetch
      try {
        console.log("Attempting token exchange using direct API...");
        
        // The OAuth token exchange endpoint
        const tokenUrl = 'https://connect.stripe.com/oauth/token';
        
        // Data for the token request
        const params = new URLSearchParams();
        params.append('client_secret', secretKey);
        params.append('grant_type', 'authorization_code');
        params.append('code', code);
        
        console.log("Request URL:", tokenUrl);
        console.log("Using key starting with:", secretKey.substring(0, 6) + "...");
        
        // Use fetch to make the request
        const response = await fetch(tokenUrl, {
          method: 'POST',
          body: params,
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Authorization': `Bearer ${secretKey}`,
          },
        });
        
        console.log("Raw response status:", response.status);
        const responseText = await response.text();
        console.log("Raw response text:", responseText);
        
        let responseData;
        try {
          responseData = JSON.parse(responseText);
        } catch (parseError) {
          console.error("Failed to parse response:", parseError);
          responseData = { parse_error: true };
        }
        
        if (!response.ok) {
          console.error("Direct API approach failed with status:", response.status);
          console.error("Response data:", responseData);
          // Continue to next method instead of failing
        } else {
          // Extract the account ID from response
          const connectedAccountId = responseData.stripe_user_id;
          
          if (!connectedAccountId) {
            console.error("No stripe_user_id in direct API response:", responseData);
            // Continue to next method
          } else {
            // Success! Return the account ID
            console.log("Direct API approach successful - account ID:", connectedAccountId);
            return res.json({
              success: true,
              method: "direct_api",
              accountId: connectedAccountId,
              message: "Successfully retrieved Stripe account ID using direct API"
            });
          }
        }
      } catch (directApiError) {
        console.error("Direct API approach threw exception:", directApiError);
        // Continue to next method
      }
      
      // Third method: Another direct API call with different configuration
      try {
        console.log("Attempting token exchange using third approach...");
        
        // Create a new URL search params for the request
        const params = new URLSearchParams();
        params.append('client_secret', secretKey);
        params.append('grant_type', 'authorization_code');
        params.append('code', code as string);
        
        // Make a direct HTTP request - no shell commands needed
        const response = await fetch('https://connect.stripe.com/oauth/token', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
          },
          body: params
        });
        
        if (!response.ok) {
          console.error("Third approach failed with status:", response.status);
          throw new Error(`API request failed with status: ${response.status}`);
        }
        
        const responseData = await response.json();
        console.log("Third approach raw response received");
        
        const connectedAccountId = responseData.stripe_user_id;
        
        if (!connectedAccountId) {
          console.error("No stripe_user_id in third approach response");
          throw new Error("Missing stripe_user_id in response");
        }
        
        // Success! Return the account ID
        console.log("Third approach successful - account ID:", connectedAccountId);
        return res.json({
          success: true,
          method: "third_approach",
          accountId: connectedAccountId,
          message: "Successfully retrieved Stripe account ID using third approach"
        });
      } catch (thirdApproachError) {
        console.error("Third approach failed:", thirdApproachError);
      }
      
      // If we get here, all methods failed
      return res.status(500).json({
        error: "All token exchange methods failed",
        message: "Failed to exchange code for token using multiple approaches"
      });
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      console.error(`Error in direct token exchange: ${errorMessage}`, error);
      return res.status(500).json({ error: errorMessage });
    }
  });
  
  // Helper function to find a user by stripe account ID
  async function findUserByStripeAccountId(stripeAccountId: string) {
    try {
      // Get all users
      const allUsers = await storage.getAllUsers();
      
      // Find the user with this account ID
      return allUsers.find(user => user.stripeAccountId === stripeAccountId);
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      log(`Error finding user by Stripe account ID: ${errorMessage}`, "stripe");
      return null;
    }
  }
}
