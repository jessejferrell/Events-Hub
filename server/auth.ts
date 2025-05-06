import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import { Express } from "express";
import session from "express-session";
import { scrypt, randomBytes, timingSafeEqual } from "crypto";
import { promisify } from "util";
import { storage } from "./storage";
import { User as SelectUser } from "@shared/schema";
import { log } from "./vite";

declare global {
  namespace Express {
    interface User extends SelectUser {}
  }
}

const scryptAsync = promisify(scrypt);

export async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const buf = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${buf.toString("hex")}.${salt}`;
}

export async function comparePasswords(supplied: string, stored: string) {
  if (!stored || !stored.includes(".")) {
    return false;
  }
  
  const [hashed, salt] = stored.split(".");
  if (!hashed || !salt) {
    return false;
  }
  
  try {
    const hashedBuf = Buffer.from(hashed, "hex");
    const suppliedBuf = (await scryptAsync(supplied, salt, 64)) as Buffer;
    return timingSafeEqual(hashedBuf, suppliedBuf);
  } catch (error) {
    console.error("Password comparison error:", error);
    return false;
  }
}

export function setupAuth(app: Express) {
  // Use environment variable for session secret or fallback to a random string
  const sessionSecret = process.env.SESSION_SECRET || randomBytes(32).toString("hex");
  log(`Session configured with ${sessionSecret.substring(0, 4)}... secret`, "auth");

  const sessionSettings: session.SessionOptions = {
    secret: sessionSecret,
    resave: false,
    saveUninitialized: false,
    store: storage.sessionStore,
    cookie: {
      httpOnly: true,
      secure: app.get("env") === "production",
      maxAge: 7 * 24 * 60 * 60 * 1000, // 1 week
      sameSite: 'none', // Allow cross-site requests
    },
  };

  app.set("trust proxy", 1);
  app.use(session(sessionSettings));
  app.use(passport.initialize());
  app.use(passport.session());

  // Set up rate limiting for login attempts
  const loginAttempts = new Map<string, { count: number; resetTime: number }>();
  const MAX_LOGIN_ATTEMPTS = 5;
  const LOGIN_TIMEOUT = 15 * 60 * 1000; // 15 minutes

  // Configure local strategy for username/password authentication
  passport.use(
    new LocalStrategy(
      {
        usernameField: "email", // Use email as the username field
      },
      async (email, password, done) => {
        try {
          // Check for rate limiting
          const ipKey = email.toLowerCase();
          const now = Date.now();
          const attemptData = loginAttempts.get(ipKey) || { count: 0, resetTime: now + LOGIN_TIMEOUT };
          
          // Reset count if the timeout has expired
          if (attemptData.resetTime < now) {
            attemptData.count = 0;
            attemptData.resetTime = now + LOGIN_TIMEOUT;
          }
          
          // Check if max attempts exceeded
          if (attemptData.count >= MAX_LOGIN_ATTEMPTS) {
            return done(null, false, { message: "Too many login attempts. Please try again later." });
          }
          
          // Increment attempt count
          attemptData.count++;
          loginAttempts.set(ipKey, attemptData);

          // Look up user by email
          const user = await storage.getUserByEmail(email);
          if (!user || !(await comparePasswords(password, user.password))) {
            return done(null, false, { message: "Invalid email or password" });
          }
          
          // Reset attempts on successful login
          loginAttempts.delete(ipKey);
          return done(null, user);
        } catch (error) {
          return done(error);
        }
      },
    ),
  );

  passport.serializeUser((user, done) => {
    done(null, user.id);
  });

  passport.deserializeUser(async (id: number, done) => {
    try {
      const user = await storage.getUser(id);
      done(null, user);
    } catch (error) {
      done(error);
    }
  });

  // Registration endpoint
  app.post("/api/register", async (req, res, next) => {
    try {
      // Check for existing user with same email
      const existingUser = await storage.getUserByEmail(req.body.email);
      if (existingUser) {
        return res.status(400).json({ message: "Email is already registered" });
      }

      // Validate password strength
      const password = req.body.password;
      if (password.length < 8) {
        return res.status(400).json({ message: "Password must be at least 8 characters long" });
      }

      // Hash password and create user
      const hashedPassword = await hashPassword(password);
      const user = await storage.createUser({
        ...req.body,
        password: hashedPassword,
      });

      // Log the user in after registration
      req.login(user, (err) => {
        if (err) return next(err);
        // Remove password from response
        const { password, ...userWithoutPassword } = user;
        res.status(201).json(userWithoutPassword);
      });
    } catch (error: any) {
      res.status(500).json({ message: error.message || "Registration failed" });
    }
  });

  // Login endpoint
  app.post("/api/login", (req, res, next) => {
    passport.authenticate("local", (err, user, info) => {
      if (err) return next(err);
      if (!user) {
        return res.status(401).json({ message: info?.message || "Invalid credentials" });
      }
      req.login(user, async (loginErr) => {
        if (loginErr) return next(loginErr);
        
        // Check if there's a pending Stripe account ID in the session to apply
        const pendingStripeAccountId = (req.session as any).pendingStripeAccountId;
        if (pendingStripeAccountId) {
          try {
            // Update the user's account with the pending Stripe account ID
            log(`Found pending Stripe account ID in session after login: ${pendingStripeAccountId}`, "auth");
            await storage.updateUserStripeAccount(user.id, pendingStripeAccountId);
            
            // Clear the pending ID from the session
            delete (req.session as any).pendingStripeAccountId;
            await new Promise<void>((resolve) => {
              req.session.save(() => {
                log(`Applied pending Stripe account ID to user ${user.id}`, "auth");
                resolve();
              });
            });
            
            // Get the updated user 
            const updatedUser = await storage.getUser(user.id);
            const { password, ...updatedUserWithoutPassword } = updatedUser;
            return res.status(200).json(updatedUserWithoutPassword);
          } catch (error: any) {
            log(`Error applying pending Stripe account ID: ${error.message}`, "auth");
            // Continue with the original user object if there was an error
          }
        }
        
        // Remove password from response
        const { password, ...userWithoutPassword } = user;
        return res.status(200).json(userWithoutPassword);
      });
    })(req, res, next);
  });

  // Logout endpoint
  app.post("/api/logout", (req, res, next) => {
    req.logout((err) => {
      if (err) return next(err);
      res.status(200).json({ message: "Logged out successfully" });
    });
  });

  // Get current user endpoint
  app.get("/api/user", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Not authenticated" });
    }
    
    // Check if there's a pending Stripe account ID in the session
    const pendingStripeAccountId = (req.session as any).pendingStripeAccountId;
    if (pendingStripeAccountId) {
      try {
        // Update the user's account with the pending Stripe account ID
        log(`Found pending Stripe account ID in session on /api/user: ${pendingStripeAccountId}`, "auth");
        await storage.updateUserStripeAccount(req.user.id, pendingStripeAccountId);
        
        // Clear the pending ID from the session
        delete (req.session as any).pendingStripeAccountId;
        await new Promise<void>((resolve) => {
          req.session.save(() => {
            log(`Applied pending Stripe account ID to user ${req.user.id}`, "auth");
            resolve();
          });
        });
        
        // Return the updated user
        const updatedUser = await storage.getUser(req.user.id);
        const { password, ...updatedUserWithoutPassword } = updatedUser;
        return res.json(updatedUserWithoutPassword);
      } catch (error: any) {
        log(`Error applying pending Stripe account ID: ${error.message}`, "auth");
        // Continue with the original user object if there was an error
      }
    }
    
    // Remove password from response
    const { password, ...userWithoutPassword } = req.user;
    res.json(userWithoutPassword);
  });

  // Password reset request endpoint (would email reset link in production)
  app.post("/api/reset-password-request", async (req, res) => {
    try {
      const { email } = req.body;
      const user = await storage.getUserByEmail(email);
      
      if (!user) {
        // Still return success to prevent email enumeration
        return res.status(200).json({ message: "If your email is in our system, you will receive reset instructions" });
      }
      
      // In a real app, generate a reset token and send email
      // Here we're just returning success
      res.status(200).json({ message: "If your email is in our system, you will receive reset instructions" });
    } catch (error: any) {
      res.status(500).json({ message: error.message || "Failed to process password reset request" });
    }
  });

  // Update user password (protected)
  app.post("/api/update-password", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Not authenticated" });
    }

    try {
      const { currentPassword, newPassword } = req.body;
      
      // Verify current password
      if (!(await comparePasswords(currentPassword, req.user.password))) {
        return res.status(400).json({ message: "Current password is incorrect" });
      }
      
      // Validate new password
      if (newPassword.length < 8) {
        return res.status(400).json({ message: "New password must be at least 8 characters long" });
      }
      
      // Update password
      const hashedPassword = await hashPassword(newPassword);
      await storage.updateUserPassword(req.user.id, hashedPassword);
      
      res.status(200).json({ message: "Password updated successfully" });
    } catch (error: any) {
      res.status(500).json({ message: error.message || "Failed to update password" });
    }
  });
}
