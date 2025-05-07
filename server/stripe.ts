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
  apiVersion: "2019-02-19",
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

      // IMPORTANT: Use only the EXACT redirect URI registered in the Stripe Dashboard
      // For this app, we've registered https://events.mosspointmainstreet.org/api/stripe/oauth/callback
      const registeredRedirectUri = "https://events.mosspointmainstreet.org/api/stripe/oauth/callback";
      
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
      
      // Always use the exact redirect URI registered in Stripe Dashboard
      const redirectUri = registeredRedirectUri;
      log(`Using FIXED redirect URI: ${redirectUri}`, "stripe");
      log(`Using redirect URI: ${redirectUri}`, "stripe");
      
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
      
      // Exchange the code for a Stripe account ID using direct fetch for more control
      let response;
      try {
        // Use fetch API for direct control over the request
        log(`Directly exchanging authorization code for access token...`, "stripe");
        
        // Get credentials
        const clientId = process.env.STRIPE_CLIENT_ID;
        const secretKey = process.env.STRIPE_SECRET_KEY;
        
        // Construct the request body according to Stripe's API specification
        const params = new URLSearchParams();
        params.append("grant_type", "authorization_code");
        params.append("code", code as string);
        // For API version 2019-02-19, client_id and client_secret should be in the body
        params.append("client_id", clientId || "");
        params.append("client_secret", secretKey || "");
        
        if (!clientId || !secretKey) {
          log(`Missing required Stripe credentials`, "stripe");
          return res.redirect('/payment-connections?error=true&message=' + 
            encodeURIComponent('Server configuration error. Please contact support.'));
        }
        
        // Log some diagnostic information (first few characters only)
        log(`Using Stripe client_id starting with: ${clientId.substring(0, 8)}...`, "stripe");
        log(`Using Stripe secret_key starting with: ${secretKey.substring(0, 8)}...`, "stripe");
        
        // NOTE: We already added these to the params above, don't add them twice
        
        // Make direct request to Stripe's OAuth token endpoint
        const tokenResponse = await fetch("https://connect.stripe.com/oauth/token", {
          method: "POST",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded"
          },
          body: params.toString()
        });
        
        // Parse the response
        const responseData = await tokenResponse.json();
        
        // Check if the response contains an error
        if (!tokenResponse.ok) {
          log(`Token exchange failed with status ${tokenResponse.status}: ${JSON.stringify(responseData)}`, "stripe");
          
          // Handle specific error types
          if (responseData.error === 'invalid_grant') {
            return res.redirect('/payment-connections?error=true&message=' + 
              encodeURIComponent('Invalid authorization code. It may have expired or already been used.'));
          }
          
          if (responseData.error === 'invalid_client') {
            return res.redirect('/payment-connections?error=true&message=' + 
              encodeURIComponent('Authentication failed. Please contact support.'));
          }
          
          return res.redirect('/payment-connections?error=true&message=' + 
            encodeURIComponent(responseData.error_description || 'Failed to connect with Stripe. Please try again.'));
        }
        
        // Success - store the response
        response = responseData;
        log(`Successfully exchanged code for access token`, "stripe");
      } catch (exchangeError: any) {
        log(`Token exchange error: ${exchangeError.message}`, "stripe");
        return res.redirect('/payment-connections?error=true&message=' + 
          encodeURIComponent('Network error when connecting to Stripe. Please try again.'));
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
  
  // DIRECT APPROACH: Ultra-simplified Stripe OAuth callback endpoint
  app.get("/api/stripe/oauth/callback", async (req, res) => {
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
      const secretKey = process.env.STRIPE_SECRET_KEY;
      
      if (!clientId || !secretKey) {
        console.error("MISSING CREDENTIALS");
        return res.redirect('/payment-connections?error=true&message=Server+configuration+error');
      }
      
      console.error("Credentials OK, proceeding with token exchange");
      
      try {
        // MINIMAL DIRECT API CALL APPROACH
        const params = new URLSearchParams();
        params.append('grant_type', 'authorization_code');
        params.append('code', code as string);
        params.append('client_id', clientId);
        params.append('client_secret', secretKey);
        
        console.error("Making token request with params (without secret):", 
          params.toString().replace(secretKey, '[REDACTED]'));
        
        const tokenResponse = await fetch('https://connect.stripe.com/oauth/token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: params.toString()
        });
        
        console.error("Response status:", tokenResponse.status);
        
        const responseText = await tokenResponse.text();
        console.error("FULL RESPONSE TEXT:", responseText);
        
        // Try to parse JSON response
        let responseData;
        try {
          responseData = JSON.parse(responseText);
          console.error("Parsed response data:", JSON.stringify(responseData, null, 2));
        } catch (parseError) {
          console.error("Failed to parse response as JSON:", parseError);
          return res.redirect('/payment-connections?error=true&message=Invalid+response+from+Stripe');
        }
        
        // Check for error response
        if (responseData.error) {
          console.error("Stripe API returned an error:", responseData.error);
          return res.redirect(`/payment-connections?error=true&message=${encodeURIComponent(responseData.error_description || 'Error connecting with Stripe')}`);
        }
        
        // Extract account ID
        const connectedAccountId = responseData.stripe_user_id;
        if (!connectedAccountId) {
          console.error("No account ID in response");
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
      
      const { stripeAccountId } = req.body;
      
      if (!stripeAccountId || typeof stripeAccountId !== 'string' || !stripeAccountId.startsWith('acct_')) {
        return res.redirect('/payment-connections?error=true&message=' + encodeURIComponent('Invalid Stripe account ID format'));
      }
      
      // Validate the account ID with Stripe
      try {
        await stripe.accounts.retrieve(stripeAccountId);
      } catch (error) {
        return res.redirect('/payment-connections?error=true&message=' + encodeURIComponent('Invalid Stripe account ID. Please try again.'));
      }
      
      // Store the account ID in a cookie that lasts 5 minutes
      res.cookie('stripe_account_id', stripeAccountId, { 
        maxAge: 5 * 60 * 1000, // 5 minutes
        httpOnly: true,
        secure: true,
        sameSite: 'lax'
      });
      
      // Also save to file for backup
      try {
        // Don't use require in async contexts, it causes issues
        const { writeFileSync } = await import('fs');
        writeFileSync('recover-connection.txt', stripeAccountId);
      } catch (err) {
        console.error("Failed to write to file:", err);
        // Continue anyway
      }
      
      // Check if user is authenticated
      if (!req.isAuthenticated()) {
        return res.redirect('/auth?message=' + encodeURIComponent('Please log in to complete your Stripe connection'));
      }
      
      // User is authenticated, connect the account
      await storage.updateUserStripeAccount(req.user.id, stripeAccountId);
      
      // Clear the cookie since we've stored the value
      res.clearCookie('stripe_account_id');
      
      return res.redirect('/payment-connections?success=true');
    } catch (error: any) {
      log(`Error in manual connect: ${error.message}`, "stripe");
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
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      log(`Unexpected error during webhook processing: ${errorMessage}`, "stripe");
      return res.status(500).json({
        received: false, 
        error: `Webhook processing error: ${errorMessage}`,
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
  });

  // Helper function to handle successful checkout
  async function handleCheckoutSessionCompleted(session: Stripe.Checkout.Session) {
    try {
      const metadata = session.metadata as Record<string, string> || {};
      const eventId = metadata.eventId;
      const userId = metadata.userId;
      const quantity = metadata.quantity || '1';
      
      if (!eventId || !userId) {
        log(`Missing required metadata in session: ${JSON.stringify(metadata)}`, "stripe");
        return;
      }
      
      // Get the event
      const event = await storage.getEvent(parseInt(eventId));
      if (!event) {
        log(`Event not found: ${eventId}`, "stripe");
        return;
      }
      
      // Create an order first
      try {
        const paymentIntent = session.payment_intent as string;
        const orderData = {
          userId: parseInt(userId),
          eventId: parseInt(eventId),
          totalAmount: (session.amount_total || 0) / 100, // convert from cents
          paymentMethod: 'stripe',
          status: "completed",
          paymentStatus: "paid",
          stripePaymentId: paymentIntent,
          stripeSessionId: session.id,
          metadata: { 
            checkoutSessionId: session.id,
            quantity: parseInt(quantity)
          }
        };
        
        const order = await storage.createOrder(orderData);
        log(`Order created: ${order.id} for event ${eventId}`, "stripe");
        
        // Now create the ticket record
        const ticket = await storage.createTicket({
          userId: parseInt(userId),
          eventId: parseInt(eventId),
          orderId: order.id,
          status: "confirmed",
          price: (session.amount_total || 0) / 100, // convert from cents
          ticketType: 'standard',
          metadata: { 
            quantity: parseInt(quantity),
            checkoutSessionId: session.id
          }
        });
        
        log(`Ticket purchased: ${ticket.id} for event ${eventId}`, "stripe");
      } catch (orderError: unknown) {
        const errorMessage = orderError instanceof Error ? orderError.message : String(orderError);
        log(`Error processing checkout: ${errorMessage}`, "stripe");
      }
      
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      log(`Error handling checkout completion: ${errorMessage}`, "stripe");
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
