import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupAuth } from "./auth";
import { setupStripeRoutes } from "./stripe";
import { z } from "zod";
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
  insertAnalyticsSchema
} from "@shared/schema";

// Helper function to check authentication
function requireAuth(req: Request, res: Response, next: Function) {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ message: "Authentication required" });
  }
  next();
}

// Helper function to check admin role
function requireAdmin(req: Request, res: Response, next: Function) {
  if (!req.isAuthenticated() || req.user.role !== "admin") {
    return res.status(403).json({ message: "Admin access required" });
  }
  next();
}

// Helper function to check owner/admin role
function requireOwnerOrAdmin(req: Request, res: Response, next: Function) {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ message: "Authentication required" });
  }
  
  if (req.user.role !== "admin" && req.user.role !== "event_owner") {
    return res.status(403).json({ message: "Not authorized" });
  }
  
  next();
}

export async function registerRoutes(app: Express): Promise<Server> {
  // Set up authentication routes
  setupAuth(app);
  
  // Set up Stripe routes
  setupStripeRoutes(app);

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
      const { type, location, search, sortBy, isUpcoming } = req.query;
      const events = await storage.getEvents({
        type: type as string,
        location: location as string,
        search: search as string,
        sortBy: sortBy as string,
        isUpcoming: isUpcoming === "true",
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

  // Create event (protected, event owner/admin only)
  app.post("/api/events", requireOwnerOrAdmin, async (req, res) => {
    try {
      const validatedData = insertEventSchema.parse({
        ...req.body,
        ownerId: req.user.id,
      });
      
      const event = await storage.createEvent(validatedData);
      res.status(201).json(event);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid event data", errors: error.errors });
      }
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
      if (req.user.role !== "admin" && event.ownerId !== req.user.id) {
        return res.status(403).json({ message: "Not authorized to update this event" });
      }
      
      const validatedData = insertEventSchema.partial().parse(req.body);
      const updatedEvent = await storage.updateEvent(eventId, validatedData);
      res.json(updatedEvent);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid event data", errors: error.errors });
      }
      res.status(500).json({ message: error.message || "Failed to update event" });
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

  // === ORDERS API ===
  
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
      
      if (!["user", "event_owner", "vendor", "volunteer", "admin"].includes(role)) {
        return res.status(400).json({ message: "Invalid role" });
      }
      
      const updatedUser = await storage.updateUserRole(userId, role);
      // Remove password from response
      const { password, ...userWithoutPassword } = updatedUser;
      res.json(userWithoutPassword);
    } catch (error: any) {
      res.status(500).json({ message: error.message || "Failed to update user role" });
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
  
  // Get analytics (admin/event owner only)
  app.get("/api/analytics/:metric", requireAuth, async (req, res) => {
    try {
      const metric = req.params.metric;
      const eventId = req.query.eventId ? parseInt(req.query.eventId as string) : undefined;
      const timeframe = req.query.timeframe as string;
      
      // If eventId is provided, check permissions
      if (eventId) {
        const event = await storage.getEvent(eventId);
        if (req.user.role !== "admin" && event.ownerId !== req.user.id) {
          return res.status(403).json({ message: "Not authorized to view analytics for this event" });
        }
      } else if (req.user.role !== "admin") {
        // If no eventId and not admin, return 403
        return res.status(403).json({ message: "Not authorized to view global analytics" });
      }
      
      const results = await storage.getAnalyticsByMetric(metric, eventId, timeframe);
      res.json(results);
    } catch (error: any) {
      res.status(500).json({ message: error.message || "Failed to fetch analytics" });
    }
  });

  // Create HTTP server
  const httpServer = createServer(app);
  return httpServer;
}
