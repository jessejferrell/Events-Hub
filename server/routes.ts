import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupAuth } from "./auth";
import { setupStripeRoutes } from "./stripe";
import { z } from "zod";
import { insertEventSchema, insertTicketSchema, insertAdminNoteSchema } from "@shared/schema";

export async function registerRoutes(app: Express): Promise<Server> {
  // Set up authentication routes
  setupAuth(app);
  
  // Set up Stripe routes
  setupStripeRoutes(app);

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
      res.json(event);
    } catch (error: any) {
      res.status(500).json({ message: error.message || "Failed to fetch event" });
    }
  });

  // Create event (protected, event owner/admin only)
  app.post("/api/events", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Authentication required" });
    }

    if (req.user.role !== "event_owner" && req.user.role !== "admin") {
      return res.status(403).json({ message: "Not authorized to create events" });
    }

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
  app.put("/api/events/:id", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Authentication required" });
    }

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
  app.delete("/api/events/:id", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Authentication required" });
    }

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
  app.get("/api/my-events", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Authentication required" });
    }

    try {
      const events = await storage.getEventsByOwner(req.user.id);
      res.json(events);
    } catch (error: any) {
      res.status(500).json({ message: error.message || "Failed to fetch events" });
    }
  });

  // === TICKETS API ===

  // Purchase ticket (protected)
  app.post("/api/tickets", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Authentication required" });
    }

    try {
      const validatedData = insertTicketSchema.parse({
        ...req.body,
        userId: req.user.id,
      });
      
      const event = await storage.getEvent(validatedData.eventId);
      if (!event) {
        return res.status(404).json({ message: "Event not found" });
      }
      
      if (!event.isActive) {
        return res.status(400).json({ message: "This event is no longer active" });
      }
      
      const ticket = await storage.createTicket(validatedData);
      res.status(201).json(ticket);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid ticket data", errors: error.errors });
      }
      res.status(500).json({ message: error.message || "Failed to purchase ticket" });
    }
  });

  // Get user tickets (protected)
  app.get("/api/my-tickets", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Authentication required" });
    }

    try {
      const tickets = await storage.getTicketsByUser(req.user.id);
      res.json(tickets);
    } catch (error: any) {
      res.status(500).json({ message: error.message || "Failed to fetch tickets" });
    }
  });

  // Update ticket status (protected, admin only)
  app.put("/api/tickets/:id/status", async (req, res) => {
    if (!req.isAuthenticated() || req.user.role !== "admin") {
      return res.status(403).json({ message: "Admin access required" });
    }

    try {
      const ticketId = parseInt(req.params.id);
      const { status } = req.body;
      
      if (!["purchased", "cancelled", "refunded"].includes(status)) {
        return res.status(400).json({ message: "Invalid status" });
      }
      
      const updatedTicket = await storage.updateTicketStatus(ticketId, status);
      res.json(updatedTicket);
    } catch (error: any) {
      res.status(500).json({ message: error.message || "Failed to update ticket status" });
    }
  });

  // === ADMIN ROUTES ===

  // Get all users (admin only)
  app.get("/api/admin/users", async (req, res) => {
    if (!req.isAuthenticated() || req.user.role !== "admin") {
      return res.status(403).json({ message: "Admin access required" });
    }

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
  app.put("/api/admin/users/:id/role", async (req, res) => {
    if (!req.isAuthenticated() || req.user.role !== "admin") {
      return res.status(403).json({ message: "Admin access required" });
    }

    try {
      const userId = parseInt(req.params.id);
      const { role } = req.body;
      
      if (!["user", "event_owner", "admin"].includes(role)) {
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

  // Get all payments (admin only)
  app.get("/api/admin/payments", async (req, res) => {
    if (!req.isAuthenticated() || req.user.role !== "admin") {
      return res.status(403).json({ message: "Admin access required" });
    }

    try {
      const payments = await storage.getAllPayments();
      res.json(payments);
    } catch (error: any) {
      res.status(500).json({ message: error.message || "Failed to fetch payments" });
    }
  });

  // Update payment status (admin only)
  app.put("/api/admin/payments/:id/status", async (req, res) => {
    if (!req.isAuthenticated() || req.user.role !== "admin") {
      return res.status(403).json({ message: "Admin access required" });
    }

    try {
      const paymentId = parseInt(req.params.id);
      const { status } = req.body;
      
      if (!["completed", "refunded", "cancelled"].includes(status)) {
        return res.status(400).json({ message: "Invalid status" });
      }
      
      const updatedPayment = await storage.updatePaymentStatus(paymentId, status);
      res.json(updatedPayment);
    } catch (error: any) {
      res.status(500).json({ message: error.message || "Failed to update payment status" });
    }
  });

  // Add admin note (admin only)
  app.post("/api/admin/notes", async (req, res) => {
    if (!req.isAuthenticated() || req.user.role !== "admin") {
      return res.status(403).json({ message: "Admin access required" });
    }

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

  // Get admin dashboard stats
  app.get("/api/admin/stats", async (req, res) => {
    if (!req.isAuthenticated() || req.user.role !== "admin") {
      return res.status(403).json({ message: "Admin access required" });
    }

    try {
      const stats = await storage.getAdminStats();
      res.json(stats);
    } catch (error: any) {
      res.status(500).json({ message: error.message || "Failed to fetch admin stats" });
    }
  });

  // Create HTTP server
  const httpServer = createServer(app);
  return httpServer;
}
