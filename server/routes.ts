import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupAuth } from "./auth";
import { setupStripeRoutes } from "./stripe";
import { setupEmailRoutes } from "./email";
import { upload } from "./uploads";
import { log } from "./vite";
import { z } from "zod";
import Stripe from "stripe";
import fs from "fs";
import { createObjectCsvWriter } from "csv-writer";
import { and, eq, gte, lte, like, or, sql, desc } from "drizzle-orm";
import { db } from "./db";
import * as schema from "@shared/schema";
import { generateICalendar } from "./icalendar";

// Helper function to determine fiscal quarter from date
function getFiscalQuarter(date: Date): string {
  const month = date.getMonth();
  const year = date.getFullYear();
  
  // Fiscal quarters (assuming standard calendar quarters)
  if (month >= 0 && month <= 2) return `Q1 ${year}`;
  if (month >= 3 && month <= 5) return `Q2 ${year}`;
  if (month >= 6 && month <= 8) return `Q3 ${year}`;
  return `Q4 ${year}`;
}

// Helper function to determine reporting category from transaction type
function getReportingCategory(type: string): string {
  switch (type) {
    case 'ticket':
      return 'Ticket Sales';
    case 'order':
      return 'Merchandise Sales';
    case 'vendor':
      return 'Vendor Registration';
    case 'volunteer':
      return 'Volunteer';
    default:
      return 'Other Revenue';
  }
}
import { 
  insertEventSchema, 
  insertTicketSchema, 
  insertAdminNoteSchema, 
  insertProductSchema,
  insertOrderSchema,
  insertOrderItemSchema,
  insertVendorProfileSchema,
  insertVendorSpotSchema,
  insertVendorRegistrationSchema,
  insertVolunteerProfileSchema,
  insertVolunteerShiftSchema,
  insertVolunteerAssignmentSchema,
  insertAnalyticsSchema,
  // Table imports for delete operations
  tickets,
  orderItems,
  orders,
  vendorRegistrations,
  volunteerAssignments
} from "@shared/schema";

// Helper function to generate time series data for charts
function generateTimeSeriesData(metrics: any[], timeframe: string, valueType: string = 'revenue') {
  // Default data points for different timeframes
  const defaultDataPoints: { [key: string]: { count: number; format: string } } = {
    'today': { count: 24, format: 'hour' },
    'week': { count: 7, format: 'day' },
    'month': { count: 30, format: 'day' },
    'year': { count: 12, format: 'month' },
    'all': { count: 12, format: 'month' }
  };
  
  const config = defaultDataPoints[timeframe] || defaultDataPoints.month;
  const result = [];
  
  // Group metrics by time period
  const groupedData: { [key: string]: number } = {};
  
  // Create empty data structure with all time periods
  const now = new Date();
  for (let i = 0; i < config.count; i++) {
    let label;
    if (config.format === 'hour') {
      label = `${i}:00`;
    } else if (config.format === 'day') {
      const date = new Date(now);
      date.setDate(now.getDate() - i);
      label = date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    } else if (config.format === 'month') {
      const date = new Date(now);
      date.setMonth(now.getMonth() - i);
      label = date.toLocaleDateString(undefined, { month: 'short' });
    }
    groupedData[label!] = 0;
  }
  
  // Fill in actual data
  metrics.forEach(metric => {
    const date = new Date(metric.dateTime);
    let period;
    
    if (config.format === 'hour') {
      period = `${date.getHours()}:00`;
    } else if (config.format === 'day') {
      period = date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    } else if (config.format === 'month') {
      period = date.toLocaleDateString(undefined, { month: 'short' });
    }
    
    if (period && period in groupedData) {
      // For revenue, we want to sum the values
      if (valueType === 'revenue') {
        groupedData[period] += parseFloat(metric.value as string) || 0;
      } else {
        // For counts (users, events), we want to increment
        groupedData[period] += 1;
      }
    }
  });
  
  // Convert to array of objects for Recharts
  Object.entries(groupedData).forEach(([date, value]) => {
    result.push({
      date,
      [valueType === 'revenue' ? 'amount' : 'events']: value
    });
  });
  
  // Sort by date 
  return result.sort((a, b) => {
    if (a.date < b.date) return -1;
    if (a.date > b.date) return 1;
    return 0;
  });
}

// Helper function to generate recent activity for the analytics dashboard
// This function is no longer used for generating mock data
// Instead, we fetch real activity data directly from the database
async function generateRecentActivity() {
  return []; // Empty array as this is replaced with real data
}

// Helper function to check authentication
function requireAuth(req: Request, res: Response, next: Function) {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ message: "Authentication required" });
  }
  next();
}

// Helper function to check admin role
function requireAdmin(req: Request, res: Response, next: Function) {
  if (!req.isAuthenticated() || (req.user.role !== "admin" && req.user.role !== "super_admin")) {
    return res.status(403).json({ message: "Admin access required" });
  }
  next();
}

// Helper function to check owner/admin role
function requireOwnerOrAdmin(req: Request, res: Response, next: Function) {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ message: "Authentication required" });
  }
  
  if (req.user.role !== "admin" && req.user.role !== "super_admin" && req.user.role !== "event_owner") {
    return res.status(403).json({ message: "Not authorized" });
  }
  
  next();
}

export async function registerRoutes(app: Express): Promise<Server> {
  // Redirect any Stripe callback to our API
  app.get("/stripe-callback", (req, res) => {
    log(`Stripe callback at root detected, redirecting to API handler`, "stripe");
    // Forward to our handler
    res.redirect(`/api/stripe/oauth/callback${req.url.includes('?') ? req.url.substring(req.url.indexOf('?')) : ''}`);
  });
  
  // Debug endpoint for Stripe redirect URI
  app.get("/api/stripe/debug", (req, res) => {
    // Use the correct domains as specified by the client
    const productionDomain = "https://events.mosspointmainstreet.org";
    const replitAppDomain = "https://events-manager.replit.app";
    
    // For development, we use the replit app domain
    const effectiveDomain = process.env.NODE_ENV === 'production' 
      ? productionDomain 
      : replitAppDomain;
      
    // Get the actual replit domain as well for debugging
    const currentDomain = process.env.REPLIT_DOMAINS 
      ? `https://${process.env.REPLIT_DOMAINS.split(',')[0]}`
      : `${req.protocol}://${req.get('host')}`;
    
    // List all possible redirect URIs
    const redirectUris = [
      `${productionDomain}/stripe-callback`,
      `${productionDomain}/api/stripe/oauth/callback`,
      `${replitAppDomain}/stripe-callback`,
      `${replitAppDomain}/api/stripe/oauth/callback`
    ];
    
    res.json({
      productionDomain,
      replitAppDomain,
      effectiveDomain,
      currentDomain,
      replit_domains: process.env.REPLIT_DOMAINS,
      redirectUris,
      clientId: process.env.STRIPE_CLIENT_ID ? "Available" : "Missing"
    });
  });
  
  // Set up authentication routes
  setupAuth(app);
  
  // Set up Stripe routes
  setupStripeRoutes(app);
  
  // Set up Email notification routes
  setupEmailRoutes(app);
  
  // === FILE UPLOAD API ===
  
  // Handle image uploads
  app.post("/api/upload", requireAuth, upload.single('image'), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: "No image file provided" });
      }
      
      // Return the path to the uploaded file
      const imageUrl = `/uploads/${req.file.filename}`;
      res.status(201).json({ imageUrl });
    } catch (error: any) {
      console.error("Error uploading image:", error);
      res.status(500).json({ message: error.message || "Failed to upload image" });
    }
  });

  // === USER PROFILE API ===
  
  // Update user profile (protected)
  app.put("/api/profile", requireAuth, async (req, res) => {
    try {
      const userId = req.user.id;
      const updatedUser = await storage.updateUserProfile(userId, req.body);
      
      // Remove password from response
      const { password, ...userWithoutPassword } = updatedUser;
      res.json(userWithoutPassword);
    } catch (error: any) {
      res.status(500).json({ message: error.message || "Failed to update profile" });
    }
  });

  // === EVENTS API ===
  
  // Get all events (public)
  app.get("/api/events", async (req, res) => {
    try {
      const { type, location, search, sortBy, isUpcoming, status } = req.query;
      const events = await storage.getEvents({
        type: type as string,
        location: location as string,
        search: search as string,
        sortBy: sortBy as string,
        isUpcoming: isUpcoming === "true",
        status: status as string,
      });
      res.json(events);
    } catch (error: any) {
      res.status(500).json({ message: error.message || "Failed to fetch events" });
    }
  });

  // Get single event by ID (public)
  app.get("/api/events/:id", async (req, res) => {
    try {
      const event = await storage.getEvent(parseInt(req.params.id));
      if (!event) {
        return res.status(404).json({ message: "Event not found" });
      }
      
      // Record analytics for page view
      if (req.isAuthenticated()) {
        await storage.recordAnalyticEvent({
          eventId: event.id,
          metric: "page_views",
          value: 1,
          dimension: "user_type",
          dimensionValue: req.user.role,
        });
      } else {
        await storage.recordAnalyticEvent({
          eventId: event.id,
          metric: "page_views",
          value: 1,
          dimension: "user_type",
          dimensionValue: "anonymous",
        });
      }
      
      res.json(event);
    } catch (error: any) {
      res.status(500).json({ message: error.message || "Failed to fetch event" });
    }
  });
  
  // Get iCalendar file for an event (public)
  app.get("/api/events/:id/calendar", async (req, res) => {
    try {
      const eventId = parseInt(req.params.id);
      const reminderMinutes = req.query.reminders ? 
        (req.query.reminders as string).split(',').map(r => parseInt(r.trim())) :
        [15, 60, 1440]; // Default reminders: 15min, 1hr, 1day
      
      const event = await storage.getEvent(eventId);
      if (!event) {
        return res.status(404).json({ message: "Event not found" });
      }
      
      // Generate iCalendar content
      const icsContent = await generateICalendar(event, reminderMinutes);
      
      // Set headers for file download
      res.setHeader('Content-Type', 'text/calendar');
      res.setHeader('Content-Disposition', `attachment; filename="${event.title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.ics"`);
      
      // Send the file
      res.send(icsContent);
      
      // Track calendar downloads
      await storage.recordAnalyticEvent({
        eventId: event.id,
        metric: "calendar_download",
        value: 1,
        dimension: "reminder_count",
        dimensionValue: reminderMinutes.length.toString(),
      });
    } catch (error: any) {
      console.error("Error generating calendar file:", error);
      res.status(500).json({ message: error.message || "Failed to generate calendar file" });
    }
  });

  // Create event (protected, event owner/admin only)
  app.post("/api/events", requireOwnerOrAdmin, async (req, res) => {
    try {
      console.log("Creating event with data:", req.body);
      
      // Create a modified schema for initial validation that accepts string dates
      const temporarySchema = insertEventSchema.extend({
        startDate: z.string().or(z.date()),
        endDate: z.string().or(z.date()),
      });
      
      // First validate with the temporary schema
      const initialData = temporarySchema.parse({
        ...req.body,
        ownerId: req.user!.id,
      });
      
      // Then convert dates and validate with the original schema
      const processedData = {
        ...initialData,
        startDate: typeof initialData.startDate === 'string' 
          ? new Date(initialData.startDate) 
          : initialData.startDate,
        endDate: typeof initialData.endDate === 'string' 
          ? new Date(initialData.endDate) 
          : initialData.endDate,
      };
      
      console.log("Processed event data:", processedData);
      
      // Validate once more with the original schema to ensure the dates are properly formatted
      const validatedData = insertEventSchema.parse(processedData);
      
      console.log("Validated event data:", validatedData);
      
      const event = await storage.createEvent(validatedData);
      res.status(201).json(event);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        console.error("Validation error:", JSON.stringify(error.errors, null, 2));
        return res.status(400).json({ message: "Invalid event data", errors: error.errors });
      }
      console.error("Error creating event:", error.message);
      res.status(500).json({ message: error.message || "Failed to create event" });
    }
  });

  // Update event (protected, owner/admin only)
  app.put("/api/events/:id", requireAuth, async (req, res) => {
    try {
      const eventId = parseInt(req.params.id);
      const event = await storage.getEvent(eventId);
      
      if (!event) {
        return res.status(404).json({ message: "Event not found" });
      }
      
      // Check permissions
      if (req.user!.role !== "admin" && event.ownerId !== req.user!.id) {
        return res.status(403).json({ message: "Not authorized to update this event" });
      }
      
      // Create a modified schema for initial validation that accepts string dates
      const temporarySchema = insertEventSchema.partial().extend({
        startDate: z.string().or(z.date()).optional(),
        endDate: z.string().or(z.date()).optional(),
      });
      
      // First validate with the temporary schema
      const initialData = temporarySchema.parse(req.body);
      
      // Then convert dates if they exist
      const processedData = { ...initialData };
      
      if (typeof initialData.startDate === 'string') {
        processedData.startDate = new Date(initialData.startDate);
      }
      
      if (typeof initialData.endDate === 'string') {
        processedData.endDate = new Date(initialData.endDate);
      }
      
      // Validate with the original schema to ensure the dates are properly formatted
      const validatedData = insertEventSchema.partial().parse(processedData);
      const updatedEvent = await storage.updateEvent(eventId, validatedData);
      res.json(updatedEvent);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        console.error("Validation error:", JSON.stringify(error.errors, null, 2));
        return res.status(400).json({ message: "Invalid event data", errors: error.errors });
      }
      console.error("Error updating event:", error.message);
      res.status(500).json({ message: error.message || "Failed to update event" });
    }
  });
  
  // Toggle event status (protected, admin/owner only)
  app.put("/api/events/:id/toggle-status", requireAuth, async (req, res) => {
    try {
      const eventId = parseInt(req.params.id);
      const newStatus = req.body.status;
      
      const event = await storage.getEvent(eventId);
      if (!event) {
        return res.status(404).json({ message: "Event not found" });
      }
      
      // Check permissions
      if (req.user!.role !== "admin" && event.ownerId !== req.user!.id) {
        return res.status(403).json({ message: "Not authorized to update this event" });
      }
      
      // Determine the new status if not provided
      let statusToSet = newStatus;
      if (!statusToSet) {
        // Cycle through statuses: draft -> upcoming -> active -> completed -> draft
        switch (event.status || "draft") {
          case "draft":
            statusToSet = "upcoming";
            break;
          case "upcoming":
            statusToSet = "active";
            break;
          case "active":
            statusToSet = "completed";
            break;
          case "completed":
          case "cancelled":
            statusToSet = "draft";
            break;
          default:
            statusToSet = "draft";
        }
      }
      
      const updatedEvent = await storage.updateEvent(eventId, { 
        status: statusToSet,
        isActive: statusToSet !== "draft" // Keep isActive for backward compatibility
      });
      
      res.json(updatedEvent);
    } catch (error: any) {
      res.status(500).json({ message: error.message || "Failed to toggle event status" });
    }
  });

  // Delete event (protected, owner/admin only)
  app.delete("/api/events/:id", requireAuth, async (req, res) => {
    try {
      const eventId = parseInt(req.params.id);
      const event = await storage.getEvent(eventId);
      
      if (!event) {
        return res.status(404).json({ message: "Event not found" });
      }
      
      // Check permissions
      if (req.user.role !== "admin" && event.ownerId !== req.user.id) {
        return res.status(403).json({ message: "Not authorized to delete this event" });
      }
      
      await storage.deleteEvent(eventId);
      res.status(204).send();
    } catch (error: any) {
      res.status(500).json({ message: error.message || "Failed to delete event" });
    }
  });
  
  // Duplicate event (protected, owner/admin only)
  app.post("/api/events/:id/duplicate", requireAuth, async (req, res) => {
    try {
      const sourceEventId = parseInt(req.params.id);
      const sourceEvent = await storage.getEvent(sourceEventId);
      
      if (!sourceEvent) {
        return res.status(404).json({ message: "Source event not found" });
      }
      
      // Check permissions
      if (req.user.role !== "admin" && sourceEvent.ownerId !== req.user.id) {
        return res.status(403).json({ message: "Not authorized to duplicate this event" });
      }

      // Create new event based on the source event
      const { id, createdAt, updatedAt, ...eventData } = sourceEvent;
      
      // Modify the title to indicate it's a copy
      const newTitle = req.body.title || `${sourceEvent.title} (Copy)`;
      
      // Create the new event with default draft status
      const newEvent = await storage.createEvent({
        ...eventData,
        title: newTitle,
        status: "draft",
        isActive: false,
        ownerId: req.user.id,
      });
      
      // Get products (tickets, merchandise, etc.) associated with the source event
      const products = await storage.getProducts(sourceEventId);
      
      // Duplicate all products for the new event
      for (const product of products) {
        const { id, createdAt, updatedAt, eventId, ...productData } = product;
        await storage.createProduct({
          ...productData,
          eventId: newEvent.id
        });
      }
      
      // Get vendor spots associated with the source event
      const vendorSpots = await storage.getVendorSpots(sourceEventId);
      
      // Duplicate all vendor spots for the new event
      for (const spot of vendorSpots) {
        const { id, createdAt, updatedAt, eventId, ...spotData } = spot;
        await storage.createVendorSpot({
          ...spotData,
          eventId: newEvent.id
        });
      }
      
      // Get volunteer shifts associated with the source event
      const volunteerShifts = await storage.getVolunteerShifts(sourceEventId);
      
      // Duplicate all volunteer shifts for the new event
      for (const shift of volunteerShifts) {
        const { id, createdAt, updatedAt, eventId, ...shiftData } = shift;
        await storage.createVolunteerShift({
          ...shiftData,
          eventId: newEvent.id
        });
      }
      
      // Record analytics for event duplication
      await storage.recordAnalyticEvent({
        eventId: newEvent.id,
        metric: "event_duplication",
        value: 1,
        dimension: "source_event",
        dimensionValue: sourceEventId.toString(),
      });
      
      res.status(201).json(newEvent);
    } catch (error: any) {
      console.error("Error duplicating event:", error);
      res.status(500).json({ message: error.message || "Failed to duplicate event" });
    }
  });

  // Get events by owner (protected)
  app.get("/api/my-events", requireAuth, async (req, res) => {
    try {
      const events = await storage.getEventsByOwner(req.user.id);
      res.json(events);
    } catch (error: any) {
      res.status(500).json({ message: error.message || "Failed to fetch events" });
    }
  });

  // === PRODUCTS API (Merchandise & Addons) ===
  
  // Get products for an event (via event ID param)
  app.get("/api/events/:eventId/products", async (req, res) => {
    try {
      const eventId = parseInt(req.params.eventId);
      const type = req.query.type as string;
      
      const products = await storage.getProducts(eventId, type);
      res.json(products);
    } catch (error: any) {
      res.status(500).json({ message: error.message || "Failed to fetch products" });
    }
  });
  
  // Get products by eventId (via query param) - for product manager component
  app.get("/api/products", async (req, res) => {
    try {
      const eventId = req.query.eventId ? parseInt(req.query.eventId as string) : undefined;
      const type = req.query.type as string;
      
      if (!eventId) {
        return res.status(400).json({ message: "Event ID is required" });
      }
      
      const products = await storage.getProducts(eventId, type);
      res.json(products);
    } catch (error: any) {
      res.status(500).json({ message: error.message || "Failed to fetch products" });
    }
  });
  
  // Get single product by ID
  app.get("/api/products/:id", async (req, res) => {
    try {
      const productId = parseInt(req.params.id);
      const product = await storage.getProduct(productId);
      
      if (!product) {
        return res.status(404).json({ message: "Product not found" });
      }
      
      res.json(product);
    } catch (error: any) {
      res.status(500).json({ message: error.message || "Failed to fetch product" });
    }
  });
  
  // Create product (protected, event owner/admin only)
  app.post("/api/events/:eventId/products", requireAuth, async (req, res) => {
    try {
      const eventId = parseInt(req.params.eventId);
      const event = await storage.getEvent(eventId);
      
      if (!event) {
        return res.status(404).json({ message: "Event not found" });
      }
      
      // Check permissions
      if (req.user.role !== "admin" && event.ownerId !== req.user.id) {
        return res.status(403).json({ message: "Not authorized to add products to this event" });
      }
      
      const validatedData = insertProductSchema.parse({
        ...req.body,
        eventId,
      });
      
      const product = await storage.createProduct(validatedData);
      
      // Update event to indicate it has merchandise or addons
      if (validatedData.type === "merchandise" && !event.hasMerchandise) {
        await storage.updateEvent(eventId, { hasMerchandise: true });
      } else if (validatedData.type === "addon" && !event.hasAddons) {
        await storage.updateEvent(eventId, { hasAddons: true });
      }
      
      res.status(201).json(product);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid product data", errors: error.errors });
      }
      res.status(500).json({ message: error.message || "Failed to create product" });
    }
  });
  
  // Update product (protected, event owner/admin only)
  app.put("/api/products/:id", requireAuth, async (req, res) => {
    try {
      const productId = parseInt(req.params.id);
      const product = await storage.getProduct(productId);
      
      if (!product) {
        return res.status(404).json({ message: "Product not found" });
      }
      
      const event = await storage.getEvent(product.eventId);
      
      // Check permissions
      if (req.user.role !== "admin" && event.ownerId !== req.user.id) {
        return res.status(403).json({ message: "Not authorized to update this product" });
      }
      
      const validatedData = insertProductSchema.partial().parse(req.body);
      const updatedProduct = await storage.updateProduct(productId, validatedData);
      res.json(updatedProduct);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid product data", errors: error.errors });
      }
      res.status(500).json({ message: error.message || "Failed to update product" });
    }
  });
  
  // Update product via PATCH (protected, event owner/admin only)
  app.patch("/api/products/:id", requireAuth, async (req, res) => {
    try {
      const productId = parseInt(req.params.id);
      const product = await storage.getProduct(productId);
      
      if (!product) {
        return res.status(404).json({ message: "Product not found" });
      }
      
      const event = await storage.getEvent(product.eventId);
      
      // Check permissions
      if (req.user.role !== "admin" && event.ownerId !== req.user.id) {
        return res.status(403).json({ message: "Not authorized to update this product" });
      }
      
      const validatedData = insertProductSchema.partial().parse(req.body);
      const updatedProduct = await storage.updateProduct(productId, validatedData);
      res.json(updatedProduct);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid product data", errors: error.errors });
      }
      res.status(500).json({ message: error.message || "Failed to update product" });
    }
  });
  
  // Direct product creation endpoint (for product manager component)
  app.post("/api/products", requireAuth, async (req, res) => {
    try {
      const eventId = req.body.eventId;
      if (!eventId) {
        return res.status(400).json({ message: "Event ID is required" });
      }
      
      const event = await storage.getEvent(eventId);
      if (!event) {
        return res.status(404).json({ message: "Event not found" });
      }
      
      // Check permissions
      if (req.user.role !== "admin" && event.ownerId !== req.user.id) {
        return res.status(403).json({ message: "Not authorized to add products to this event" });
      }
      
      const validatedData = insertProductSchema.parse(req.body);
      const product = await storage.createProduct(validatedData);
      
      // Update event to indicate appropriate product type
      if (validatedData.type === "merchandise" && !event.hasMerchandise) {
        await storage.updateEvent(eventId, { hasMerchandise: true });
      } else if (validatedData.type === "addon" && !event.hasAddons) {
        await storage.updateEvent(eventId, { hasAddons: true });
      } else if (validatedData.type === "vendor_spot" && !event.vendorOptions) {
        await storage.updateEvent(eventId, { vendorOptions: true });
      } else if (validatedData.type === "volunteer_shift" && !event.volunteerOptions) {
        await storage.updateEvent(eventId, { volunteerOptions: true });
      }
      
      res.status(201).json(product);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid product data", errors: error.errors });
      }
      res.status(500).json({ message: error.message || "Failed to create product" });
    }
  });

  // Delete product (protected, event owner/admin only)
  app.delete("/api/products/:id", requireAuth, async (req, res) => {
    try {
      const productId = parseInt(req.params.id);
      const product = await storage.getProduct(productId);
      
      if (!product) {
        return res.status(404).json({ message: "Product not found" });
      }
      
      const event = await storage.getEvent(product.eventId);
      
      // Check permissions
      if (req.user.role !== "admin" && event.ownerId !== req.user.id) {
        return res.status(403).json({ message: "Not authorized to delete this product" });
      }
      
      await storage.deleteProduct(productId);
      res.status(204).send();
    } catch (error: any) {
      res.status(500).json({ message: error.message || "Failed to delete product" });
    }
  });

  // === VENDOR API ===
  
  // Get vendor profile (protected)
  app.get("/api/vendor-profile", requireAuth, async (req, res) => {
    try {
      const vendorProfile = await storage.getVendorProfile(req.user.id);
      res.json(vendorProfile || null);
    } catch (error: any) {
      res.status(500).json({ message: error.message || "Failed to fetch vendor profile" });
    }
  });
  
  // Create/update vendor profile (protected)
  app.post("/api/vendor-profile", requireAuth, async (req, res) => {
    try {
      const existingProfile = await storage.getVendorProfile(req.user.id);
      
      if (existingProfile) {
        // Update existing profile
        const updatedProfile = await storage.updateVendorProfile(existingProfile.id, req.body);
        return res.json(updatedProfile);
      }
      
      // Create new profile
      const validatedData = insertVendorProfileSchema.parse({
        ...req.body,
        userId: req.user.id,
      });
      
      const newProfile = await storage.createVendorProfile(validatedData);
      res.status(201).json(newProfile);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid profile data", errors: error.errors });
      }
      res.status(500).json({ message: error.message || "Failed to save vendor profile" });
    }
  });
  
  // Get vendor spots for an event
  app.get("/api/events/:eventId/vendor-spots", async (req, res) => {
    try {
      const eventId = parseInt(req.params.eventId);
      const vendorSpots = await storage.getVendorSpots(eventId);
      res.json(vendorSpots);
    } catch (error: any) {
      res.status(500).json({ message: error.message || "Failed to fetch vendor spots" });
    }
  });
  
  // Create vendor spot (protected, event owner/admin only)
  app.post("/api/events/:eventId/vendor-spots", requireAuth, async (req, res) => {
    try {
      const eventId = parseInt(req.params.eventId);
      const event = await storage.getEvent(eventId);
      
      if (!event) {
        return res.status(404).json({ message: "Event not found" });
      }
      
      // Check permissions
      if (req.user.role !== "admin" && event.ownerId !== req.user.id) {
        return res.status(403).json({ message: "Not authorized to create vendor spots for this event" });
      }
      
      const validatedData = insertVendorSpotSchema.parse({
        ...req.body,
        eventId,
        availableSpots: req.body.capacity || 1,
      });
      
      const vendorSpot = await storage.createVendorSpot(validatedData);
      
      // Update event to indicate it has vendor options
      if (!event.vendorOptions) {
        await storage.updateEvent(eventId, { vendorOptions: true });
      }
      
      res.status(201).json(vendorSpot);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid vendor spot data", errors: error.errors });
      }
      res.status(500).json({ message: error.message || "Failed to create vendor spot" });
    }
  });
  
  // Get my vendor registrations (protected)
  app.get("/api/my-vendor-registrations", requireAuth, async (req, res) => {
    try {
      const vendorRegistrations = await storage.getVendorRegistrations({
        userId: req.user.id
      });
      res.json(vendorRegistrations);
    } catch (error: any) {
      res.status(500).json({ message: error.message || "Failed to fetch vendor registrations" });
    }
  });
  
  // Get vendor registrations for an event (protected, event owner/admin only)
  app.get("/api/events/:eventId/vendor-registrations", requireAuth, async (req, res) => {
    try {
      const eventId = parseInt(req.params.eventId);
      const event = await storage.getEvent(eventId);
      
      if (!event) {
        return res.status(404).json({ message: "Event not found" });
      }
      
      // Check permissions
      if (req.user.role !== "admin" && event.ownerId !== req.user.id) {
        return res.status(403).json({ message: "Not authorized to view registrations for this event" });
      }
      
      const vendorRegistrations = await storage.getVendorRegistrations({
        eventId
      });
      res.json(vendorRegistrations);
    } catch (error: any) {
      res.status(500).json({ message: error.message || "Failed to fetch vendor registrations" });
    }
  });
  
  // Update vendor registration status (protected, event owner/admin only)
  app.put("/api/vendor-registrations/:id/status", requireAuth, async (req, res) => {
    try {
      const registrationId = parseInt(req.params.id);
      const { status } = req.body;
      
      if (!["pending", "approved", "rejected", "cancelled"].includes(status)) {
        return res.status(400).json({ message: "Invalid status" });
      }
      
      // Get the registration
      const registration = await storage.getVendorRegistration(registrationId);
      if (!registration) {
        return res.status(404).json({ message: "Registration not found" });
      }
      
      // Check permissions
      const event = await storage.getEvent(registration.eventId);
      if (req.user.role !== "admin" && event.ownerId !== req.user.id) {
        return res.status(403).json({ message: "Not authorized to update this registration" });
      }
      
      const updatedRegistration = await storage.updateVendorRegistrationStatus(
        registrationId, 
        status,
        req.user.id
      );
      
      res.json(updatedRegistration);
    } catch (error: any) {
      res.status(500).json({ message: error.message || "Failed to update registration status" });
    }
  });

  // === VOLUNTEER API ===
  
  // Get volunteer profile (protected)
  app.get("/api/volunteer-profile", requireAuth, async (req, res) => {
    try {
      const volunteerProfile = await storage.getVolunteerProfile(req.user.id);
      res.json(volunteerProfile || null);
    } catch (error: any) {
      res.status(500).json({ message: error.message || "Failed to fetch volunteer profile" });
    }
  });
  
  // Create/update volunteer profile (protected)
  app.post("/api/volunteer-profile", requireAuth, async (req, res) => {
    try {
      const existingProfile = await storage.getVolunteerProfile(req.user.id);
      
      if (existingProfile) {
        // Update existing profile
        const updatedProfile = await storage.updateVolunteerProfile(existingProfile.id, req.body);
        return res.json(updatedProfile);
      }
      
      // Create new profile
      const validatedData = insertVolunteerProfileSchema.parse({
        ...req.body,
        userId: req.user.id,
      });
      
      const newProfile = await storage.createVolunteerProfile(validatedData);
      res.status(201).json(newProfile);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid profile data", errors: error.errors });
      }
      res.status(500).json({ message: error.message || "Failed to save volunteer profile" });
    }
  });
  
  // Get volunteer shifts for an event
  app.get("/api/events/:eventId/volunteer-shifts", async (req, res) => {
    try {
      const eventId = parseInt(req.params.eventId);
      const volunteerShifts = await storage.getVolunteerShifts(eventId);
      res.json(volunteerShifts);
    } catch (error: any) {
      res.status(500).json({ message: error.message || "Failed to fetch volunteer shifts" });
    }
  });
  
  // Create volunteer shift (protected, event owner/admin only)
  app.post("/api/events/:eventId/volunteer-shifts", requireAuth, async (req, res) => {
    try {
      const eventId = parseInt(req.params.eventId);
      const event = await storage.getEvent(eventId);
      
      if (!event) {
        return res.status(404).json({ message: "Event not found" });
      }
      
      // Check permissions
      if (req.user.role !== "admin" && event.ownerId !== req.user.id) {
        return res.status(403).json({ message: "Not authorized to create volunteer shifts for this event" });
      }
      
      const validatedData = insertVolunteerShiftSchema.parse({
        ...req.body,
        eventId,
        availableSpots: req.body.capacity,
      });
      
      const volunteerShift = await storage.createVolunteerShift(validatedData);
      
      // Update event to indicate it has volunteer options
      if (!event.volunteerOptions) {
        await storage.updateEvent(eventId, { volunteerOptions: true });
      }
      
      res.status(201).json(volunteerShift);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid volunteer shift data", errors: error.errors });
      }
      res.status(500).json({ message: error.message || "Failed to create volunteer shift" });
    }
  });
  
  // Get my volunteer assignments (protected)
  app.get("/api/my-volunteer-assignments", requireAuth, async (req, res) => {
    try {
      const volunteerAssignments = await storage.getVolunteerAssignments({
        userId: req.user.id
      });
      res.json(volunteerAssignments);
    } catch (error: any) {
      res.status(500).json({ message: error.message || "Failed to fetch volunteer assignments" });
    }
  });
  
  // Get volunteer assignments for an event (protected, event owner/admin only)
  app.get("/api/events/:eventId/volunteer-assignments", requireAuth, async (req, res) => {
    try {
      const eventId = parseInt(req.params.eventId);
      const event = await storage.getEvent(eventId);
      
      if (!event) {
        return res.status(404).json({ message: "Event not found" });
      }
      
      // Check permissions
      if (req.user.role !== "admin" && event.ownerId !== req.user.id) {
        return res.status(403).json({ message: "Not authorized to view assignments for this event" });
      }
      
      const volunteerAssignments = await storage.getVolunteerAssignments({
        eventId
      });
      res.json(volunteerAssignments);
    } catch (error: any) {
      res.status(500).json({ message: error.message || "Failed to fetch volunteer assignments" });
    }
  });
  
  // Update volunteer assignment status (protected, event owner/admin only)
  app.put("/api/volunteer-assignments/:id/status", requireAuth, async (req, res) => {
    try {
      const assignmentId = parseInt(req.params.id);
      const { status } = req.body;
      
      if (!["pending", "approved", "rejected", "cancelled", "completed"].includes(status)) {
        return res.status(400).json({ message: "Invalid status" });
      }
      
      // Get the assignment
      const assignment = await storage.getVolunteerAssignment(assignmentId);
      if (!assignment) {
        return res.status(404).json({ message: "Assignment not found" });
      }
      
      // Check permissions
      const event = await storage.getEvent(assignment.eventId);
      if (req.user.role !== "admin" && event.ownerId !== req.user.id) {
        return res.status(403).json({ message: "Not authorized to update this assignment" });
      }
      
      const updatedAssignment = await storage.updateVolunteerAssignmentStatus(
        assignmentId, 
        status,
        req.user.id
      );
      
      res.json(updatedAssignment);
    } catch (error: any) {
      res.status(500).json({ message: error.message || "Failed to update assignment status" });
    }
  });

  // === CHECKOUT & ORDERS API ===

  // Checkout endpoint (protected)
  app.post("/api/checkout", requireAuth, async (req, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ message: "Authentication required" });
      }

      const { items } = req.body;
      
      if (!items || !items.length) {
        return res.status(400).json({ message: "No items provided for checkout" });
      }
      
      // Extract product data first to get eventId
      let totalAmount = 0;
      let products = [];
      let eventIds = new Set();
      
      for (const item of items) {
        const product = await storage.getProduct(item.productId);
        if (!product) {
          return res.status(404).json({ message: `Product ${item.productId} not found` });
        }
        
        products.push(product);
        eventIds.add(product.eventId);
        
        // Add to total
        totalAmount += product.price * item.quantity;
      }
      
      if (eventIds.size === 0) {
        return res.status(400).json({ message: "No valid products found" });
      }
      
      // Get the primary event for this order
      const eventId = Array.from(eventIds)[0];
      
      // Step 1: Create an order
      const order = await storage.createOrder({
        userId: req.user.id,
        eventId: eventId,
        status: "pending",
        paymentStatus: "pending",
        totalAmount: totalAmount,
        paymentMethod: "stripe"
      });
      
      // Step 2: Create order items
      for (const item of items) {
        const product = products.find(p => p.id === item.productId);
        
        // Create order item
        await storage.createOrderItem({
          orderId: order.id,
          itemId: product.id,
          itemType: product.type,
          name: product.name,
          description: product.description,
          quantity: item.quantity,
          unitPrice: product.price,
          totalPrice: product.price * item.quantity,
          metadata: item.registrationData || null
        });
      }
      
      // Update order total
      await storage.updateOrderStatus(order.id, "pending");
      const updatedOrder = await storage.updateOrderPaymentStatus(order.id, "pending");
      
      // Step 3: Get event owner's Stripe account
      const event = await storage.getEvent(eventId);
      
      if (!event) {
        await storage.updateOrderStatus(order.id, "cancelled");
        return res.status(404).json({ message: "Event not found" });
      }
      
      const owner = await storage.getUser(event.ownerId);
      
      if (!owner || !owner.stripeAccountId) {
        await storage.updateOrderStatus(order.id, "cancelled");
        return res.status(400).json({ message: "Event owner has not connected with Stripe" });
      }
      
      // Step 4: Create Stripe checkout session
      const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
        apiVersion: "2023-10-16",
      });
      
      // Get domain from environment or request
      const domain = process.env.REPLIT_DOMAINS 
        ? process.env.REPLIT_DOMAINS.split(',')[0] 
        : `${req.protocol}://${req.get('host')}`;
      
      // Create line items for Stripe Checkout
      const lineItems = products.map(product => {
        const item = items.find(i => i.productId === product.id);
        return {
          price_data: {
            currency: "usd",
            product_data: {
              name: product.name,
              description: product.description || undefined,
            },
            unit_amount: Math.round(product.price * 100), // convert to cents
          },
          quantity: item.quantity,
        };
      });
      
      // Create a Checkout Session
      const session = await stripe.checkout.sessions.create({
        payment_method_types: ["card"],
        line_items: lineItems,
        mode: "payment",
        success_url: `${domain}/checkout/success?order_id=${order.id}&session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${domain}/checkout/cancel?order_id=${order.id}`,
        
        // Send payment to the connected account
        payment_intent_data: {
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
      
      // Return the checkout session ID and URL to the client
      res.status(200).json({
        orderId: order.id,
        checkoutUrl: session.url,
        clientSecret: session.client_secret,
      });
    } catch (error: any) {
      console.error("Checkout error:", error);
      res.status(500).json({ message: error.message || "Failed to process checkout" });
    }
  });
  
  // Get user orders (protected)
  app.get("/api/my-orders", requireAuth, async (req, res) => {
    try {
      const orders = await storage.getOrdersByUser(req.user.id);
      res.json(orders);
    } catch (error: any) {
      res.status(500).json({ message: error.message || "Failed to fetch orders" });
    }
  });
  
  // Get order details (protected)
  app.get("/api/orders/:id", requireAuth, async (req, res) => {
    try {
      const orderId = parseInt(req.params.id);
      const order = await storage.getOrder(orderId);
      
      if (!order) {
        return res.status(404).json({ message: "Order not found" });
      }
      
      // Check permissions (user's own order or admin)
      if (req.user.role !== "admin" && order.userId !== req.user.id) {
        return res.status(403).json({ message: "Not authorized to view this order" });
      }
      
      // Get order items
      const orderItems = await storage.getOrderItems(orderId);
      
      // Get tickets if any
      const tickets = await storage.getTicketsByOrder(orderId);
      
      res.json({
        order,
        items: orderItems,
        tickets,
      });
    } catch (error: any) {
      res.status(500).json({ message: error.message || "Failed to fetch order details" });
    }
  });
  
  // Update order status (admin only)
  app.put("/api/orders/:id/status", requireAdmin, async (req, res) => {
    try {
      const orderId = parseInt(req.params.id);
      const { status } = req.body;
      
      if (!["pending", "completed", "cancelled", "refunded"].includes(status)) {
        return res.status(400).json({ message: "Invalid status" });
      }
      
      const updatedOrder = await storage.updateOrderStatus(orderId, status);
      res.json(updatedOrder);
    } catch (error: any) {
      res.status(500).json({ message: error.message || "Failed to update order status" });
    }
  });

  // === TICKETS API ===

  // Get tickets for an event (protected, event owner/admin only)
  app.get("/api/events/:eventId/tickets", requireAuth, async (req, res) => {
    try {
      const eventId = parseInt(req.params.eventId);
      const event = await storage.getEvent(eventId);
      
      if (!event) {
        return res.status(404).json({ message: "Event not found" });
      }
      
      // Check permissions
      if (req.user.role !== "admin" && event.ownerId !== req.user.id) {
        return res.status(403).json({ message: "Not authorized to view tickets for this event" });
      }
      
      const tickets = await storage.getTicketsByEvent(eventId);
      res.json(tickets);
    } catch (error: any) {
      res.status(500).json({ message: error.message || "Failed to fetch tickets" });
    }
  });

  // Get user tickets (protected)
  app.get("/api/my-tickets", requireAuth, async (req, res) => {
    try {
      const tickets = await storage.getTicketsByUser(req.user.id);
      res.json(tickets);
    } catch (error: any) {
      res.status(500).json({ message: error.message || "Failed to fetch tickets" });
    }
  });

  // Update ticket status (protected, admin only)
  app.put("/api/tickets/:id/status", requireAdmin, async (req, res) => {
    try {
      const ticketId = parseInt(req.params.id);
      const { status } = req.body;
      
      if (!["active", "used", "cancelled", "refunded"].includes(status)) {
        return res.status(400).json({ message: "Invalid status" });
      }
      
      const updatedTicket = await storage.updateTicketStatus(ticketId, status);
      res.json(updatedTicket);
    } catch (error: any) {
      res.status(500).json({ message: error.message || "Failed to update ticket status" });
    }
  });
  
  // Check in ticket (protected, event owner/admin only)
  app.post("/api/tickets/:id/check-in", requireAuth, async (req, res) => {
    try {
      const ticketId = parseInt(req.params.id);
      const ticket = await storage.getTicket(ticketId);
      
      if (!ticket) {
        return res.status(404).json({ message: "Ticket not found" });
      }
      
      // Check if ticket is already used
      if (ticket.status === "used") {
        return res.status(400).json({ message: "Ticket already used" });
      }
      
      // Check if ticket is valid
      if (ticket.status !== "active") {
        return res.status(400).json({ message: `Ticket status is ${ticket.status}` });
      }
      
      // Check permissions
      const event = await storage.getEvent(ticket.eventId);
      if (req.user.role !== "admin" && event.ownerId !== req.user.id) {
        return res.status(403).json({ message: "Not authorized to check in tickets for this event" });
      }
      
      const updatedTicket = await storage.checkInTicket(ticketId);
      
      // Record analytics for check-in
      await storage.recordAnalyticEvent({
        eventId: ticket.eventId,
        metric: "check_ins",
        value: 1,
        dimension: "ticket_type",
        dimensionValue: ticket.ticketType,
      });
      
      res.json(updatedTicket);
    } catch (error: any) {
      res.status(500).json({ message: error.message || "Failed to check in ticket" });
    }
  });
  
  // Verify ticket by number (protected, event owner/admin only)
  app.get("/api/tickets/verify/:ticketNumber", requireAuth, async (req, res) => {
    try {
      const ticketNumber = req.params.ticketNumber;
      const ticket = await storage.getTicketByNumber(ticketNumber);
      
      if (!ticket) {
        return res.status(404).json({ message: "Ticket not found" });
      }
      
      // Check permissions
      const event = await storage.getEvent(ticket.eventId);
      if (req.user.role !== "admin" && event.ownerId !== req.user.id) {
        return res.status(403).json({ message: "Not authorized to verify tickets for this event" });
      }
      
      res.json(ticket);
    } catch (error: any) {
      res.status(500).json({ message: error.message || "Failed to verify ticket" });
    }
  });

  // === ADMIN API ===

  // Add admin note (admin only)
  app.post("/api/admin/notes", requireAdmin, async (req, res) => {
    try {
      const validatedData = insertAdminNoteSchema.parse({
        ...req.body,
        adminId: req.user.id,
      });
      
      const note = await storage.createAdminNote(validatedData);
      res.status(201).json(note);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid note data", errors: error.errors });
      }
      res.status(500).json({ message: error.message || "Failed to create note" });
    }
  });
  
  // Get admin notes for a target (admin only)
  app.get("/api/admin/notes/:targetType/:targetId", requireAdmin, async (req, res) => {
    try {
      const targetType = req.params.targetType;
      const targetId = parseInt(req.params.targetId);
      
      if (!["user", "event", "order", "ticket", "vendor_registration", "volunteer_assignment"].includes(targetType)) {
        return res.status(400).json({ message: "Invalid target type" });
      }
      
      const notes = await storage.getAdminNotesByTarget(targetType, targetId);
      res.json(notes);
    } catch (error: any) {
      res.status(500).json({ message: error.message || "Failed to fetch admin notes" });
    }
  });

  // Get all users (admin only)
  app.get("/api/admin/users", requireAdmin, async (req, res) => {
    try {
      const users = await storage.getAllUsers();
      // Remove passwords from response
      const sanitizedUsers = users.map(user => {
        const { password, ...userWithoutPassword } = user;
        return userWithoutPassword;
      });
      res.json(sanitizedUsers);
    } catch (error: any) {
      res.status(500).json({ message: error.message || "Failed to fetch users" });
    }
  });

  // Update user role (admin only)
  app.put("/api/admin/users/:id/role", requireAdmin, async (req, res) => {
    try {
      const userId = parseInt(req.params.id);
      const { role } = req.body;
      
      // Get user to update
      const userToUpdate = await storage.getUser(userId);
      if (!userToUpdate) {
        return res.status(404).json({ message: "User not found" });
      }
      
      // Validate role
      if (!["user", "event_owner", "vendor", "volunteer", "admin", "super_admin"].includes(role)) {
        return res.status(400).json({ message: "Invalid role" });
      }
      
      // Check permissions with strong typing for super admin
      const isSuperAdmin = req.user?.email === 'jessejferrell@gmail.com' || req.user?.role === 'super_admin';
      
      // Restricted operations that only super_admin can perform:
      const isRestrictedOperation = 
        role === "super_admin" || // Creating another super_admin
        userToUpdate.role === "admin" || // Modifying an admin's role
        userToUpdate.role === "super_admin"; // Modifying a super_admin's role
      
      if (isRestrictedOperation && !isSuperAdmin) {
        return res.status(403).json({
          message: "Only super admins can create/modify admin and super admin roles"
        });
      }
      
      // Self-protection: prevent admins from downgrading themselves
      if (userId === req.user?.id && role !== "admin" && role !== "super_admin") {
        return res.status(403).json({
          message: "You cannot downgrade your own admin role"
        });
      }
      
      // Perform the update
      const updatedUser = await storage.updateUserRole(userId, role);
      
      // Create admin note to track role changes
      await storage.createAdminNote({
        adminId: req.user?.id || 1,
        targetType: "user",
        targetId: userId,
        note: `User role changed from "${userToUpdate.role}" to "${role}" by ${req.user?.username || 'system'}`
      });
      
      // Remove password from response
      const { password, ...userWithoutPassword } = updatedUser;
      res.json(userWithoutPassword);
    } catch (error: any) {
      res.status(500).json({ message: error.message || "Failed to update user role" });
    }
  });
  
  // Update user profile (admin only, with permission checks)
  app.put("/api/admin/users/:id", requireAuth, async (req, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ message: "Not authenticated" });
      }
      
      const userId = parseInt(req.params.id);
      const userData = req.body;
      
      // Check permissions
      const isSuperAdmin = req.user.email === 'jessejferrell@gmail.com' || req.user.role === 'super_admin';
      const isAdmin = req.user.role === 'admin';
      
      // Get user to edit
      const userToEdit = await storage.getUser(userId);
      if (!userToEdit) {
        return res.status(404).json({ message: "User not found" });
      }
      
      // Super admin can edit anyone, regular admins can only edit non-admin users
      const canEdit = isSuperAdmin || (isAdmin && userToEdit.role !== 'admin' && userToEdit.role !== 'super_admin');
      
      if (!canEdit) {
        return res.status(403).json({ message: "Not authorized to edit this user" });
      }
      
      // Perform the update
      const updatedUser = await storage.updateUserProfile(userId, userData);
      // Remove password from response
      const { password, ...userWithoutPassword } = updatedUser;
      res.json(userWithoutPassword);
    } catch (error: any) {
      res.status(500).json({ message: error.message || "Failed to update user" });
    }
  });

  // Get admin dashboard stats
  app.get("/api/admin/stats", requireAdmin, async (req, res) => {
    try {
      const stats = await storage.getAdminStats();
      res.json(stats);
    } catch (error: any) {
      res.status(500).json({ message: error.message || "Failed to fetch admin stats" });
    }
  });
  
  // Get analytics data (admin only)
  app.get("/api/admin/analytics", requireAdmin, async (req, res) => {
    try {
      const { timeframe } = req.query;
      
      // Generate dates based on timeframe
      const now = new Date();
      let startDate: Date;
      let previousStartDate: Date;
      let previousEndDate: Date;
      
      switch (timeframe as string) {
        case 'today':
          startDate = new Date(now);
          startDate.setHours(0, 0, 0, 0);
          
          previousStartDate = new Date(startDate);
          previousStartDate.setDate(previousStartDate.getDate() - 1);
          previousEndDate = new Date(startDate);
          break;
          
        case 'week':
          startDate = new Date(now);
          startDate.setDate(now.getDate() - 7);
          
          previousStartDate = new Date(startDate);
          previousStartDate.setDate(previousStartDate.getDate() - 7);
          previousEndDate = new Date(startDate);
          break;
          
        case 'month':
          startDate = new Date(now);
          startDate.setMonth(now.getMonth() - 1);
          
          previousStartDate = new Date(startDate);
          previousStartDate.setMonth(previousStartDate.getMonth() - 1);
          previousEndDate = new Date(startDate);
          break;
          
        case 'year':
          startDate = new Date(now);
          startDate.setFullYear(now.getFullYear() - 1);
          
          previousStartDate = new Date(startDate);
          previousStartDate.setFullYear(previousStartDate.getFullYear() - 1);
          previousEndDate = new Date(startDate);
          break;
          
        default: // all time or 'all'
          startDate = new Date(0); // beginning of time
          previousStartDate = new Date(0);
          previousEndDate = new Date(0);
      }
      
      // Get actual revenue from orders
      const ordersRevenue = await db
        .select({ sum: sql`COALESCE(SUM(total_amount), 0)` })
        .from(schema.orders)
        .where(
          and(
            eq(schema.orders.paymentStatus, 'paid'),
            gte(schema.orders.createdAt, startDate)
          )
        );
      
      // Get actual ticket sales count
      const ticketsSold = await db
        .select({ count: sql`COUNT(*)` })
        .from(schema.tickets)
        .where(gte(schema.tickets.createdAt, startDate));
      
      // Get new users count
      const newUsers = await db
        .select({ count: sql`COUNT(*)` })
        .from(schema.users)
        .where(gte(schema.users.createdAt, startDate));
      
      // Get new events count
      const newEvents = await db
        .select({ count: sql`COUNT(*)` })
        .from(schema.events)
        .where(gte(schema.events.createdAt, startDate));
      
      // Calculate actual revenue totals
      const currentRevenueTotal = Number(ordersRevenue[0].sum) || 0;
      const previousRevenueTotal = 0; // We'll use 0 for now as we don't have previous data
      
      // Create empty time series data for charts (no mock data)
      const revenueData = [];
      const userGrowthData = [];
      const eventGrowthData = [];
      
      // Get real event and product type data from the database
      const events = await db.select().from(schema.events);
      const eventTypes = events.reduce((acc, event) => {
        const type = event.type || 'Other';
        acc[type] = (acc[type] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);
      
      // Build revenue by event type from actual data
      const revenueByEventType = Object.entries(eventTypes).map(([name, count]) => {
        return { 
          name, 
          value: Math.round(currentRevenueTotal * (count / events.length)) 
        };
      });
      
      // Get product types from database
      const products = await db.select().from(schema.products);
      const productTypes = products.reduce((acc, product) => {
        const type = product.type || 'Other';
        acc[type] = (acc[type] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);
      
      // Build revenue by product type from actual data
      const revenueByProductType = Object.entries(productTypes).map(([name, count]) => {
        return { 
          name, 
          value: Math.round(currentRevenueTotal * (count / products.length)) 
        };
      });
      
      // Get real user data
      const users = await db.select().from(schema.users);
      const userTypes = users.reduce((acc, user) => {
        const type = user.role || 'standard';
        acc[type] = (acc[type] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);
      
      // Build user type data from actual user records
      const userTypeData = Object.entries(userTypes).map(([name, count]) => {
        return { 
          name, 
          value: Math.round((count / users.length) * 100) 
        };
      });
      
      // Build event type data from actual events
      const eventTypeData = Object.entries(eventTypes).map(([name, count]) => {
        return { 
          name, 
          value: Math.round((count / events.length) * 100) 
        };
      });
      
      // Get orders to calculate event performance
      const orders = await db.select().from(schema.orders);
      
      // Group orders by event
      const eventPerformance = orders.reduce((acc, order) => {
        if (!order.eventId) return acc;
        
        if (!acc[order.eventId]) {
          acc[order.eventId] = {
            eventId: order.eventId,
            revenue: 0,
            orderCount: 0
          };
        }
        
        acc[order.eventId].revenue += order.totalAmount || 0;
        acc[order.eventId].orderCount += 1;
        
        return acc;
      }, {} as Record<number, {eventId: number, revenue: number, orderCount: number}>);
      
      // Get the top 5 events by revenue
      const topEventIds = Object.values(eventPerformance)
        .sort((a, b) => b.revenue - a.revenue)
        .slice(0, 5)
        .map(e => e.eventId);
      
      // Get event details for top events
      const topEventDetails = await Promise.all(
        topEventIds.map(async id => {
          const event = await storage.getEvent(id);
          return event ? {
            name: event.title,
            value: eventPerformance[id].revenue
          } : null;
        })
      );
      
      // Filter out null values
      const topEvents = topEventDetails.filter(e => e !== null) as {name: string, value: number}[];
      
      // For user segments, location data, etc., we'll calculate from real data if possible
      // or provide empty placeholder structures
      const topUserSegments = [];
      const eventPerformanceData = [];
      const eventLocationData = [];
      
      // Revenue analysis from real data
      const revenueAnalysis = [
        { name: "Gross Revenue", value: currentRevenueTotal },
        { name: "Net Revenue", value: currentRevenueTotal } // Without mock data, just use the actual revenue
      ];
      
      // Get real recent activity from database
      const recentOrders = await db.select().from(schema.orders).orderBy(desc(schema.orders.createdAt)).limit(10);
      
      // Map orders to activity format
      const recentActivity = await Promise.all(recentOrders.map(async order => {
        const user = await storage.getUser(order.userId);
        const event = await storage.getEvent(order.eventId);
        return {
          id: order.id,
          type: 'order',
          title: `Order #${order.orderNumber}`,
          description: `${user?.username || 'A user'} placed an order for ${event?.title || 'an event'}`,
          amount: order.totalAmount,
          date: order.createdAt,
          status: order.status
        };
      }));
      
      // Calculate realistic growth percentages based on available data
      const revenueChange = previousRevenueTotal > 0 ? 
        ((currentRevenueTotal - previousRevenueTotal) / previousRevenueTotal * 100) : 0;
      
      // Calculate ticket change from real data if possible
      const ticketsCount = await db.select({ count: sql`count(*)` }).from(schema.tickets);
      const ticketsSoldCount = parseInt(ticketsCount[0].count.toString());
      
      // Get users created in the last period
      const newUsersCount = Number(newUsers[0].count) || 0;
      
      // Get active events
      const activeEventsCount = await db.select({ count: sql`count(*)` })
        .from(schema.events)
        .where(eq(schema.events.isActive, true));
      const activeEventsTotal = parseInt(activeEventsCount[0].count.toString());
      
      // Compose response with real data
      const analyticsData = {
        // Summary metrics from real data
        revenue: currentRevenueTotal,
        revenueChange,
        ticketsSold: ticketsSoldCount,
        ticketsChange: 0, // No mock data
        newUsers: newUsersCount,
        usersChange: 0, // No mock data
        activeEvents: activeEventsTotal,
        eventsChange: 0, // No mock data
        
        // Detailed metrics from real data
        recentActivity,
        conversionRate: {
          ticket: 0,
          vendor: 0,
          volunteer: 0,
          merchandise: 0
        },
        userEngagement: {
          eventParticipation: 0,
          multiTicket: 0,
          returnRate: 0,
          volunteerRate: 0
        },
        
        // Chart data
        revenueData,
        revenueByEventType,
        revenueByProductType,
        topEvents,
        revenueAnalysis,
        userGrowthData,
        userTypeData,
        topUserSegments,
        eventGrowthData,
        eventTypeData,
        eventPerformanceData,
        eventLocationData
      };
      
      res.json(analyticsData);
    } catch (error: any) {
      console.error("Analytics error:", error);
      res.status(500).json({ message: error.message || "Failed to fetch analytics data" });
    }
  });
  
  // Export analytics data (admin only)
  app.get("/api/admin/analytics/export", requireAdmin, async (req, res) => {
    try {
      const { timeframe } = req.query;
      
      // Create a CSV writer
      const csvWriter = createObjectCsvWriter({
        path: 'temp/analytics-export.csv',
        header: [
          { id: 'metric', title: 'Metric' },
          { id: 'value', title: 'Value' },
          { id: 'date', title: 'Date' },
          { id: 'eventId', title: 'Event ID' },
          { id: 'userId', title: 'User ID' }
        ]
      });
      
      // Get analytics data for the given timeframe
      const allMetrics = [
        ...(await storage.getAnalyticsByMetric('revenue', undefined, timeframe as string)),
        ...(await storage.getAnalyticsByMetric('ticket_sale', undefined, timeframe as string)),
        ...(await storage.getAnalyticsByMetric('new_user', undefined, timeframe as string)),
        ...(await storage.getAnalyticsByMetric('new_event', undefined, timeframe as string)),
        ...(await storage.getAnalyticsByMetric('page_view', undefined, timeframe as string))
      ];
      
      // Format the data for CSV export
      const records = allMetrics.map(metric => ({
        metric: metric.metric,
        value: metric.value,
        date: new Date(metric.dateTime).toISOString(),
        eventId: metric.eventId || '',
        userId: metric.userId || ''
      }));
      
      // Write to CSV file
      await csvWriter.writeRecords(records);
      
      // Send the file
      res.download('temp/analytics-export.csv', 'event-hub-analytics.csv', (err) => {
        if (err) {
          console.error('Error downloading file:', err);
        }
        
        // Delete the file after sending
        fs.unlink('temp/analytics-export.csv', (unlinkErr) => {
          if (unlinkErr) {
            console.error('Error deleting temporary file:', unlinkErr);
          }
        });
      });
    } catch (error: any) {
      console.error("Analytics export error:", error);
      res.status(500).json({ message: error.message || "Failed to export analytics data" });
    }
  });
  
  // Search transactions (admin only)
  app.get("/api/admin/search", requireAdmin, async (req, res) => {
    try {
      const { q, userId, eventId, type, status } = req.query;
      
      const results = await storage.searchTransactions(
        q as string,
        {
          userId: userId ? parseInt(userId as string) : undefined,
          eventId: eventId ? parseInt(eventId as string) : undefined,
          transactionType: type as string,
          status: status as string,
        }
      );
      
      res.json(results);
    } catch (error: any) {
      res.status(500).json({ message: error.message || "Failed to search transactions" });
    }
  });
  
  // Delete order (admin only)
  app.delete("/api/admin/orders/:id", requireAdmin, async (req, res) => {
    try {
      const orderId = parseInt(req.params.id);
      console.log(`Admin PERMANENTLY deleting order: ${orderId}`);
      
      // First check if order exists
      const order = await storage.getOrder(orderId);
      if (!order) {
        return res.status(404).json({ message: "Order not found" });
      }
      
      // Get all order items associated with this order
      const orderItems = await storage.getOrderItems(orderId);
      
      // Get all tickets associated with this order
      const tickets = await storage.getTicketsByOrder(orderId);
      
      // PERMANENTLY DELETE all tickets associated with the order
      for (const ticket of tickets) {
        await db.delete(schema.tickets).where(eq(schema.tickets.id, ticket.id));
      }
      
      // PERMANENTLY DELETE all order items associated with the order
      for (const item of orderItems) {
        await db.delete(schema.orderItems).where(eq(schema.orderItems.id, item.id));
      }
      
      // PERMANENTLY DELETE the order itself
      await db.delete(schema.orders).where(eq(schema.orders.id, orderId));
      
      // Return success
      res.status(200).json({ success: true, message: "Order permanently deleted" });
    } catch (error: any) {
      console.error("Error deleting order:", error);
      res.status(500).json({ message: error.message || "Failed to delete order" });
    }
  });
  
  // Delete ticket (admin only)
  app.delete("/api/admin/tickets/:id", requireAdmin, async (req, res) => {
    try {
      const ticketId = parseInt(req.params.id);
      console.log(`Admin PERMANENTLY deleting ticket: ${ticketId}`);
      
      // First check if ticket exists
      const ticket = await storage.getTicket(ticketId);
      if (!ticket) {
        return res.status(404).json({ message: "Ticket not found" });
      }
      
      // Delete the ticket from the database
      await db.delete(schema.tickets).where(eq(schema.tickets.id, ticketId));
      
      // Return success
      res.status(200).json({ success: true, message: "Ticket permanently deleted" });
    } catch (error: any) {
      console.error("Error deleting ticket:", error);
      res.status(500).json({ message: error.message || "Failed to delete ticket" });
    }
  });
  
  // Delete vendor registration (admin only)
  app.delete("/api/admin/vendors/:id", requireAdmin, async (req, res) => {
    try {
      const registrationId = parseInt(req.params.id);
      console.log(`Admin PERMANENTLY deleting vendor registration: ${registrationId}`);
      
      // First check if registration exists
      const registration = await storage.getVendorRegistration(registrationId);
      if (!registration) {
        return res.status(404).json({ message: "Vendor registration not found" });
      }
      
      // Delete the vendor registration from the database
      await db.delete(schema.vendorRegistrations).where(eq(schema.vendorRegistrations.id, registrationId));
      
      // Return success
      res.status(200).json({ success: true, message: "Vendor registration permanently deleted" });
    } catch (error: any) {
      console.error("Error deleting vendor registration:", error);
      res.status(500).json({ message: error.message || "Failed to delete vendor registration" });
    }
  });
  
  // Delete volunteer assignment (admin only)
  app.delete("/api/admin/volunteers/:id", requireAdmin, async (req, res) => {
    try {
      const assignmentId = parseInt(req.params.id);
      console.log(`Admin PERMANENTLY deleting volunteer assignment: ${assignmentId}`);
      
      // First check if assignment exists
      const assignment = await storage.getVolunteerAssignment(assignmentId);
      if (!assignment) {
        return res.status(404).json({ message: "Volunteer assignment not found" });
      }
      
      // Delete the volunteer assignment from the database
      await db.delete(schema.volunteerAssignments).where(eq(schema.volunteerAssignments.id, assignmentId));
      
      // Return success
      res.status(200).json({ success: true, message: "Volunteer assignment permanently deleted" });
    } catch (error: any) {
      console.error("Error deleting volunteer assignment:", error);
      res.status(500).json({ message: error.message || "Failed to delete volunteer assignment" });
    }
  });
  
  // Export transactions (admin only)
  app.get("/api/admin/export", requireAdmin, async (req, res) => {
    try {
      const { userId, eventId, type, status, startDate, endDate } = req.query;
      
      const results = await storage.exportTransactions({
        userId: userId ? parseInt(userId as string) : undefined,
        eventId: eventId ? parseInt(eventId as string) : undefined,
        transactionType: type as string,
        status: status as string,
        startDate: startDate ? new Date(startDate as string) : undefined,
        endDate: endDate ? new Date(endDate as string) : undefined,
      });
      
      // Convert data to CSV using csv-writer
      const { createObjectCsvStringifier } = require('csv-writer');
      
      if (results.length === 0) {
        return res.status(404).json({ message: "No transactions found matching your criteria" });
      }
      
      // Define CSV headers based on data fields
      const headers = Object.keys(results[0]).map(key => ({
        id: key,
        title: key
          .replace(/([A-Z])/g, ' $1')
          .replace(/^./, str => str.toUpperCase())
          .trim()
      }));
      
      const csvStringifier = createObjectCsvStringifier({
        header: headers
      });
      
      const csvString = csvStringifier.getHeaderString() + csvStringifier.stringifyRecords(results);
      
      // Set headers for file download
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename=transactions-export-${new Date().toISOString().slice(0, 10)}.csv`);
      
      // Send CSV data
      res.send(csvString);
    } catch (error: any) {
      res.status(500).json({ message: error.message || "Failed to export transactions" });
    }
  });
  
  // Get transactions for a specific event
  app.get('/api/admin/events/:eventId/transactions', requireAdmin, async (req, res) => {
    try {
      const eventId = parseInt(req.params.eventId);
      
      // Validate event exists
      const event = await storage.getEvent(eventId);
      if (!event) {
        return res.status(404).json({ message: "Event not found" });
      }
      
      // Get all transactions associated with this event
      const orders = await storage.getOrdersByEvent(eventId);
      
      // Get all ticket purchases for the event
      const tickets = await storage.getTicketsByEvent(eventId);
      
      // Get all vendor registrations for the event
      const vendorRegistrations = await storage.getVendorRegistrations({ eventId });
      
      // Get all volunteer assignments for the event
      const volunteerAssignments = await storage.getVolunteerAssignments({ eventId });
      
      // Get analytics data specifically for this event
      const analytics = await storage.getAnalyticsByMetric('payment_success', eventId);
      
      // Build a comprehensive transaction history
      const transactions = {
        orders,
        tickets,
        vendorRegistrations,
        volunteerAssignments,
        analytics,
        eventDetails: event
      };
      
      res.json(transactions);
    } catch (error: any) {
      res.status(500).json({ message: `Error retrieving event transactions: ${error.message}` });
    }
  });
  
  // Get transactions for a specific user
  app.get('/api/admin/users/:userId/transactions', requireAdmin, async (req, res) => {
    try {
      const userId = parseInt(req.params.userId);
      
      // Validate user exists
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      
      // Get all orders by this user
      const orders = await storage.getOrdersByUser(userId);
      
      // Get all tickets purchased by this user
      const tickets = await storage.getTicketsByUser(userId);
      
      // Get vendor profile and registrations
      const vendorProfile = await storage.getVendorProfile(userId);
      const vendorRegistrations = vendorProfile 
        ? await storage.getVendorRegistrations({ userId }) 
        : [];
      
      // Get volunteer profile and assignments
      const volunteerProfile = await storage.getVolunteerProfile(userId);
      const volunteerAssignments = volunteerProfile 
        ? await storage.getVolunteerAssignments({ userId }) 
        : [];
      
      // Get Stripe account status if it exists
      let stripeAccountStatus = null;
      if (user.stripeAccountId) {
        const analytics = await storage.getAnalyticsByMetric('stripe_account_update');
        
        // Find the most recent analytics entry for this user's Stripe account
        const userAccountAnalytics = analytics
          .filter(entry => entry.userId === userId)
          .sort((a, b) => new Date(b.dateTime).getTime() - new Date(a.dateTime).getTime());
          
        if (userAccountAnalytics.length > 0) {
          stripeAccountStatus = userAccountAnalytics[0].metadata;
        }
      }
      
      // Build comprehensive user transaction history
      const transactions = {
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          name: user.name,
          role: user.role,
          stripeAccountId: user.stripeAccountId,
          stripeCustomerId: user.stripeCustomerId
        },
        orders,
        tickets,
        vendorProfile,
        vendorRegistrations,
        volunteerProfile,
        volunteerAssignments,
        stripeAccountStatus
      };
      
      res.json(transactions);
    } catch (error: any) {
      res.status(500).json({ message: `Error retrieving user transactions: ${error.message}` });
    }
  });
  
  // Get all connected Stripe accounts and their verification status
  app.get('/api/admin/stripe/connected-accounts', requireAdmin, async (req, res) => {
    try {
      // Get all users with Stripe accounts
      const allUsers = await storage.getAllUsers();
      const connectedUsers = allUsers.filter(user => user.stripeAccountId);
      
      if (connectedUsers.length === 0) {
        return res.json({ accounts: [] });
      }
      
      // Get analytics data for Stripe account updates
      const analytics = await storage.getAnalyticsByMetric('stripe_account_update');
      
      // Build account status report with latest status for each account
      const accounts = connectedUsers.map(user => {
        // Find the most recent analytics entry for this user's Stripe account
        const userAccountAnalytics = analytics
          .filter(entry => entry.userId === user.id)
          .sort((a, b) => new Date(b.dateTime).getTime() - new Date(a.dateTime).getTime());
        
        // Extract status details or provide defaults
        const statusDetails = userAccountAnalytics.length > 0 
          ? userAccountAnalytics[0].metadata
          : {
              detailsSubmitted: false,
              chargesEnabled: false,
              payoutsEnabled: false,
              requirements: {
                currentlyDue: [],
                eventuallyDue: [],
                pastDue: []
              }
            };
        
        return {
          userId: user.id,
          username: user.username,
          email: user.email,
          name: user.name,
          stripeAccountId: user.stripeAccountId,
          lastUpdated: userAccountAnalytics.length > 0 
            ? userAccountAnalytics[0].dateTime 
            : null,
          status: statusDetails
        };
      });
      
      res.json({ accounts });
    } catch (error: any) {
      res.status(500).json({ message: `Error retrieving Stripe account status: ${error.message}` });
    }
  });
  
  // Export financial report (admin only)
  app.get("/api/admin/financial-report", requireAdmin, async (req, res) => {
    try {
      const { eventId, startDate, endDate, reportType } = req.query;
      
      // Get the base transaction data
      const results = await storage.exportTransactions({
        eventId: eventId ? parseInt(eventId as string) : undefined,
        startDate: startDate ? new Date(startDate as string) : undefined,
        endDate: endDate ? new Date(endDate as string) : undefined,
      });
      
      if (results.length === 0) {
        return res.status(404).json({ message: "No financial data found matching your criteria" });
      }
      
      // Enhanced financial report data
      const financialData = results.map(transaction => {
        // Add financial-specific fields
        return {
          ...transaction,
          revenueType: transaction.type,
          taxAmount: 0, // If tax data is available, calculate it here
          netAmount: transaction.amount,
          paymentMethod: transaction.stripePaymentId ? 'Stripe' : 'Other',
          reportingCategory: getReportingCategory(transaction.type),
          fiscalQuarter: getFiscalQuarter(new Date(transaction.created_at)),
          fiscalYear: new Date(transaction.created_at).getFullYear()
        };
      });
      
      // If summary report is requested, generate summary data
      let exportData = financialData;
      if (reportType === 'summary') {
        // Group by category and sum amounts
        const summaryData = [];
        const categories = {};
        
        financialData.forEach(item => {
          const category = item.reportingCategory;
          if (!categories[category]) {
            categories[category] = {
              reportingCategory: category,
              totalTransactions: 0,
              totalAmount: 0,
              startDate: startDate ? new Date(startDate as string).toLocaleDateString() : 'All time',
              endDate: endDate ? new Date(endDate as string).toLocaleDateString() : 'Present',
              eventTitle: item.eventTitle || 'All events'
            };
          }
          
          categories[category].totalTransactions++;
          categories[category].totalAmount += parseFloat(item.amount);
        });
        
        // Convert to array
        for (const category in categories) {
          categories[category].totalAmount = categories[category].totalAmount.toFixed(2);
          summaryData.push(categories[category]);
        }
        
        exportData = summaryData;
      }
      
      // Convert data to CSV
      const { createObjectCsvStringifier } = require('csv-writer');
      
      // Define CSV headers based on data fields
      const headers = Object.keys(exportData[0]).map(key => ({
        id: key,
        title: key
          .replace(/([A-Z])/g, ' $1')
          .replace(/^./, str => str.toUpperCase())
          .trim()
      }));
      
      const csvStringifier = createObjectCsvStringifier({
        header: headers
      });
      
      const csvString = csvStringifier.getHeaderString() + csvStringifier.stringifyRecords(exportData);
      
      // Set headers for file download
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename=financial-report-${reportType || 'detailed'}-${new Date().toISOString().slice(0, 10)}.csv`);
      
      // Send CSV data
      res.send(csvString);
    } catch (error: any) {
      console.error("Financial report export error:", error);
      res.status(500).json({ message: error.message || "Failed to export financial report" });
    }
  });
  
  // Get analytics (admin/event owner only)
  app.get("/api/analytics/:metric", requireAuth, async (req, res) => {
    try {
      const metric = req.params.metric;
      const eventId = req.query.eventId ? parseInt(req.query.eventId as string) : undefined;
      const timeframe = req.query.timeframe as string;
      
      // If eventId is provided, check permissions
      if (eventId) {
        const event = await storage.getEvent(eventId);
        if (req.user!.role !== "admin" && event!.ownerId !== req.user!.id) {
          return res.status(403).json({ message: "Not authorized to view analytics for this event" });
        }
      } else if (req.user!.role !== "admin") {
        // If no eventId and not admin, return 403
        return res.status(403).json({ message: "Not authorized to view global analytics" });
      }
      
      const results = await storage.getAnalyticsByMetric(metric, eventId, timeframe);
      res.json(results);
    } catch (error: any) {
      res.status(500).json({ message: error.message || "Failed to fetch analytics" });
    }
  });
  
  // Fetch comprehensive user details for admin dashboard
  app.get("/api/admin/users/:id/details", requireAdmin, async (req, res) => {
    try {
      const userId = parseInt(req.params.id);
      const user = await storage.getUser(userId);
      
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      
      // Fetch vendor profile if exists
      const vendorProfile = await storage.getVendorProfile(userId);
      
      // Fetch volunteer profile if exists
      const volunteerProfile = await storage.getVolunteerProfile(userId);
      
      // Construct comprehensive user data
      const userDetails = {
        ...user,
        vendorProfile: vendorProfile || null,
        volunteerProfile: volunteerProfile || null
      };
      
      res.json(userDetails);
    } catch (error) {
      console.error('Error fetching user details:', error);
      res.status(500).json({ message: 'Failed to fetch user details' });
    }
  });
  
  // Fetch user orders
  app.get("/api/admin/users/:id/orders", requireAdmin, async (req, res) => {
    try {
      const userId = parseInt(req.params.id);
      const orders = await storage.getOrdersByUser(userId);
      
      // Fetch event titles for each order
      const ordersWithEventTitles = await Promise.all(orders.map(async (order) => {
        let eventTitle = 'Unknown';
        if (order.eventId) {
          const event = await storage.getEvent(order.eventId);
          if (event) {
            eventTitle = event.title;
          }
        }
        return { ...order, eventTitle };
      }));
      
      res.json(ordersWithEventTitles);
    } catch (error) {
      console.error('Error fetching user orders:', error);
      res.status(500).json({ message: 'Failed to fetch user orders' });
    }
  });
  
  // Fetch user vendor registrations
  app.get("/api/admin/users/:id/vendor-registrations", requireAdmin, async (req, res) => {
    try {
      const userId = parseInt(req.params.id);
      const registrations = await storage.getVendorRegistrations({ userId });
      
      // Fetch event titles and spot names for each registration
      const enhancedRegistrations = await Promise.all(registrations.map(async (registration) => {
        let eventTitle = 'Unknown';
        let spotName = 'Unknown';
        
        if (registration.eventId) {
          const event = await storage.getEvent(registration.eventId);
          if (event) {
            eventTitle = event.title;
          }
        }
        
        if (registration.spotId) {
          const spot = await storage.getVendorSpot(registration.spotId);
          if (spot) {
            spotName = spot.name;
          }
        }
        
        return { ...registration, eventTitle, spotName };
      }));
      
      res.json(enhancedRegistrations);
    } catch (error) {
      console.error('Error fetching user vendor registrations:', error);
      res.status(500).json({ message: 'Failed to fetch user vendor registrations' });
    }
  });
  
  // Fetch user volunteer assignments
  app.get("/api/admin/users/:id/volunteer-assignments", requireAdmin, async (req, res) => {
    try {
      const userId = parseInt(req.params.id);
      const assignments = await storage.getVolunteerAssignments({ userId });
      
      // Fetch event titles and shift names for each assignment
      const enhancedAssignments = await Promise.all(assignments.map(async (assignment) => {
        let eventTitle = 'Unknown';
        let shiftName = 'Unknown';
        
        if (assignment.eventId) {
          const event = await storage.getEvent(assignment.eventId);
          if (event) {
            eventTitle = event.title;
          }
        }
        
        if (assignment.shiftId) {
          const shift = await storage.getVolunteerShift(assignment.shiftId);
          if (shift) {
            shiftName = shift.name;
          }
        }
        
        return { ...assignment, eventTitle, shiftName };
      }));
      
      res.json(enhancedAssignments);
    } catch (error) {
      console.error('Error fetching user volunteer assignments:', error);
      res.status(500).json({ message: 'Failed to fetch user volunteer assignments' });
    }
  });
  
  // Create HTTP server
  const httpServer = createServer(app);
  return httpServer;
}
