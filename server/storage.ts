import { users, type User, type InsertUser, events, type Event, type InsertEvent, tickets, type Ticket, type InsertTicket, payments, type Payment, type InsertPayment, adminNotes, type AdminNote, type InsertAdminNote } from "@shared/schema";
import session from "express-session";
import createMemoryStore from "memorystore";
import { log } from "./vite";

const MemoryStore = createMemoryStore(session);

// Interface for the storage operations
export interface IStorage {
  // Session store
  sessionStore: session.Store;

  // User operations
  getUser(id: number): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  getAllUsers(): Promise<User[]>;
  updateUserRole(userId: number, role: string): Promise<User>;
  updateUserPassword(userId: number, password: string): Promise<User>;
  updateUserStripeAccount(userId: number, stripeAccountId: string): Promise<User>;
  
  // Event operations
  getEvents(filters: { type?: string; location?: string; search?: string; sortBy?: string; isUpcoming?: boolean }): Promise<Event[]>;
  getEvent(id: number): Promise<Event | undefined>;
  createEvent(event: InsertEvent): Promise<Event>;
  updateEvent(id: number, eventData: Partial<InsertEvent>): Promise<Event>;
  deleteEvent(id: number): Promise<void>;
  getEventsByOwner(ownerId: number): Promise<Event[]>;
  
  // Ticket operations
  createTicket(ticket: InsertTicket): Promise<Ticket>;
  getTicket(id: number): Promise<Ticket | undefined>;
  getTicketsByUser(userId: number): Promise<Ticket[]>;
  getTicketsByEvent(eventId: number): Promise<Ticket[]>;
  updateTicketStatus(id: number, status: string): Promise<Ticket>;
  
  // Payment operations
  createPayment(payment: InsertPayment): Promise<Payment>;
  getPayment(id: number): Promise<Payment | undefined>;
  getAllPayments(): Promise<Payment[]>;
  getPaymentsByUser(userId: number): Promise<Payment[]>;
  getPaymentsByEvent(eventId: number): Promise<Payment[]>;
  updatePaymentStatus(id: number, status: string): Promise<Payment>;
  
  // Admin note operations
  createAdminNote(note: InsertAdminNote): Promise<AdminNote>;
  getAdminNotesByTarget(targetType: string, targetId: number): Promise<AdminNote[]>;
  
  // Admin stats
  getAdminStats(): Promise<{
    totalUsers: number;
    activeEvents: number;
    monthlyRevenue: number;
    ticketsSoldMTD: number;
    recentEvents: Event[];
    recentPayments: Payment[];
  }>;
}

// In-memory implementation of storage interface
export class MemStorage implements IStorage {
  private usersMap: Map<number, User>;
  private eventsMap: Map<number, Event>;
  private ticketsMap: Map<number, Ticket>;
  private paymentsMap: Map<number, Payment>;
  private adminNotesMap: Map<number, AdminNote>;
  
  sessionStore: session.Store;
  
  private userIdCounter: number;
  private eventIdCounter: number;
  private ticketIdCounter: number;
  private paymentIdCounter: number;
  private adminNoteIdCounter: number;

  constructor() {
    this.usersMap = new Map();
    this.eventsMap = new Map();
    this.ticketsMap = new Map();
    this.paymentsMap = new Map();
    this.adminNotesMap = new Map();
    
    this.userIdCounter = 1;
    this.eventIdCounter = 1;
    this.ticketIdCounter = 1;
    this.paymentIdCounter = 1;
    this.adminNoteIdCounter = 1;
    
    this.sessionStore = new MemoryStore({
      checkPeriod: 86400000, // prune expired entries every 24h
    });

    // Seed an admin user
    this.createUser({
      username: "admin",
      email: "admin@example.com",
      password: "$2b$10$ZnDJBaXE6RGxRnwA.D9N9uoW1PFOKp3X.xD1Rr7XESJmSQxRvKLyi", // "password"
      name: "Admin User",
      role: "admin",
    });

    log("Memory storage initialized", "storage");
  }

  // === USER OPERATIONS ===

  async getUser(id: number): Promise<User | undefined> {
    return this.usersMap.get(id);
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    return Array.from(this.usersMap.values()).find(
      (user) => user.email.toLowerCase() === email.toLowerCase()
    );
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.usersMap.values()).find(
      (user) => user.username.toLowerCase() === username.toLowerCase()
    );
  }

  async createUser(userData: InsertUser): Promise<User> {
    const id = this.userIdCounter++;
    const now = new Date();
    const user: User = {
      id,
      ...userData,
      createdAt: now,
      stripeAccountId: null,
      stripeCustomerId: null,
    };
    this.usersMap.set(id, user);
    return user;
  }

  async getAllUsers(): Promise<User[]> {
    return Array.from(this.usersMap.values());
  }

  async updateUserRole(userId: number, role: string): Promise<User> {
    const user = await this.getUser(userId);
    if (!user) {
      throw new Error(`User not found: ${userId}`);
    }
    
    const updatedUser = { ...user, role };
    this.usersMap.set(userId, updatedUser);
    return updatedUser;
  }

  async updateUserPassword(userId: number, password: string): Promise<User> {
    const user = await this.getUser(userId);
    if (!user) {
      throw new Error(`User not found: ${userId}`);
    }
    
    const updatedUser = { ...user, password };
    this.usersMap.set(userId, updatedUser);
    return updatedUser;
  }

  async updateUserStripeAccount(userId: number, stripeAccountId: string): Promise<User> {
    const user = await this.getUser(userId);
    if (!user) {
      throw new Error(`User not found: ${userId}`);
    }
    
    const updatedUser = { ...user, stripeAccountId };
    this.usersMap.set(userId, updatedUser);
    return updatedUser;
  }

  // === EVENT OPERATIONS ===

  async getEvents(filters: { type?: string; location?: string; search?: string; sortBy?: string; isUpcoming?: boolean } = {}): Promise<Event[]> {
    let events = Array.from(this.eventsMap.values());
    
    // Apply filters
    if (filters.type) {
      events = events.filter(event => event.eventType === filters.type);
    }
    
    if (filters.location) {
      events = events.filter(event => 
        event.location.toLowerCase().includes(filters.location!.toLowerCase())
      );
    }
    
    if (filters.search) {
      const searchLower = filters.search.toLowerCase();
      events = events.filter(event => 
        event.title.toLowerCase().includes(searchLower) || 
        event.description.toLowerCase().includes(searchLower)
      );
    }
    
    if (filters.isUpcoming) {
      const now = new Date();
      events = events.filter(event => new Date(event.endDate) >= now);
    }
    
    // Apply sorting
    if (filters.sortBy === "dateAsc") {
      events.sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime());
    } else {
      // Default sort: date descending
      events.sort((a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime());
    }
    
    return events;
  }

  async getEvent(id: number): Promise<Event | undefined> {
    return this.eventsMap.get(id);
  }

  async createEvent(eventData: InsertEvent): Promise<Event> {
    const id = this.eventIdCounter++;
    const now = new Date();
    const event: Event = {
      id,
      ...eventData,
      createdAt: now,
    };
    this.eventsMap.set(id, event);
    return event;
  }

  async updateEvent(id: number, eventData: Partial<InsertEvent>): Promise<Event> {
    const event = await this.getEvent(id);
    if (!event) {
      throw new Error(`Event not found: ${id}`);
    }
    
    const updatedEvent = { ...event, ...eventData };
    this.eventsMap.set(id, updatedEvent);
    return updatedEvent;
  }

  async deleteEvent(id: number): Promise<void> {
    if (!this.eventsMap.has(id)) {
      throw new Error(`Event not found: ${id}`);
    }
    this.eventsMap.delete(id);
  }

  async getEventsByOwner(ownerId: number): Promise<Event[]> {
    return Array.from(this.eventsMap.values()).filter(
      (event) => event.ownerId === ownerId
    );
  }

  // === TICKET OPERATIONS ===

  async createTicket(ticketData: InsertTicket): Promise<Ticket> {
    const id = this.ticketIdCounter++;
    const now = new Date();
    const ticket: Ticket = {
      id,
      ...ticketData,
      purchaseDate: now,
    };
    this.ticketsMap.set(id, ticket);
    return ticket;
  }

  async getTicket(id: number): Promise<Ticket | undefined> {
    return this.ticketsMap.get(id);
  }

  async getTicketsByUser(userId: number): Promise<Ticket[]> {
    return Array.from(this.ticketsMap.values()).filter(
      (ticket) => ticket.userId === userId
    );
  }

  async getTicketsByEvent(eventId: number): Promise<Ticket[]> {
    return Array.from(this.ticketsMap.values()).filter(
      (ticket) => ticket.eventId === eventId
    );
  }

  async updateTicketStatus(id: number, status: string): Promise<Ticket> {
    const ticket = await this.getTicket(id);
    if (!ticket) {
      throw new Error(`Ticket not found: ${id}`);
    }
    
    const updatedTicket = { ...ticket, status };
    this.ticketsMap.set(id, updatedTicket);
    return updatedTicket;
  }

  // === PAYMENT OPERATIONS ===

  async createPayment(paymentData: InsertPayment): Promise<Payment> {
    const id = this.paymentIdCounter++;
    const now = new Date();
    const payment: Payment = {
      id,
      ...paymentData,
      createdAt: now,
    };
    this.paymentsMap.set(id, payment);
    return payment;
  }

  async getPayment(id: number): Promise<Payment | undefined> {
    return this.paymentsMap.get(id);
  }

  async getAllPayments(): Promise<Payment[]> {
    return Array.from(this.paymentsMap.values());
  }

  async getPaymentsByUser(userId: number): Promise<Payment[]> {
    return Array.from(this.paymentsMap.values()).filter(
      (payment) => payment.userId === userId
    );
  }

  async getPaymentsByEvent(eventId: number): Promise<Payment[]> {
    return Array.from(this.paymentsMap.values()).filter(
      (payment) => payment.eventId === eventId
    );
  }

  async updatePaymentStatus(id: number, status: string): Promise<Payment> {
    const payment = await this.getPayment(id);
    if (!payment) {
      throw new Error(`Payment not found: ${id}`);
    }
    
    const updatedPayment = { ...payment, status };
    this.paymentsMap.set(id, updatedPayment);
    return updatedPayment;
  }

  // === ADMIN NOTE OPERATIONS ===

  async createAdminNote(noteData: InsertAdminNote): Promise<AdminNote> {
    const id = this.adminNoteIdCounter++;
    const now = new Date();
    const note: AdminNote = {
      id,
      ...noteData,
      createdAt: now,
    };
    this.adminNotesMap.set(id, note);
    return note;
  }

  async getAdminNotesByTarget(targetType: string, targetId: number): Promise<AdminNote[]> {
    return Array.from(this.adminNotesMap.values()).filter(
      (note) => note.targetType === targetType && note.targetId === targetId
    );
  }

  // === ADMIN STATS ===

  async getAdminStats(): Promise<{
    totalUsers: number;
    activeEvents: number;
    monthlyRevenue: number;
    ticketsSoldMTD: number;
    recentEvents: Event[];
    recentPayments: Payment[];
  }> {
    const now = new Date();
    const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    
    // Get active events (not ended yet)
    const activeEvents = Array.from(this.eventsMap.values()).filter(
      (event) => new Date(event.endDate) >= now && event.isActive
    );
    
    // Get payments from current month
    const monthlyPayments = Array.from(this.paymentsMap.values()).filter(
      (payment) => payment.status === "completed" && payment.createdAt >= firstDayOfMonth
    );
    
    // Calculate monthly revenue
    const monthlyRevenue = monthlyPayments.reduce(
      (total, payment) => total + payment.amount, 0
    );
    
    // Get tickets sold this month
    const ticketsSoldMTD = Array.from(this.ticketsMap.values()).filter(
      (ticket) => ticket.status === "purchased" && ticket.purchaseDate >= firstDayOfMonth
    ).length;
    
    // Get recent events
    const recentEvents = [...activeEvents]
      .sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime())
      .slice(0, 5);
    
    // Get recent payments
    const recentPayments = [...monthlyPayments]
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, 5);
    
    return {
      totalUsers: this.usersMap.size,
      activeEvents: activeEvents.length,
      monthlyRevenue,
      ticketsSoldMTD,
      recentEvents,
      recentPayments,
    };
  }
}

// Export a single instance of the storage implementation
export const storage = new MemStorage();
