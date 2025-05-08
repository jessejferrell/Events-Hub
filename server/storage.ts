import { 
  users, type User, type InsertUser, 
  events, type Event, type InsertEvent, 
  tickets, type Ticket, type InsertTicket,
  orders, type Order, type InsertOrder,
  orderItems, type OrderItem, type InsertOrderItem,
  products, type Product, type InsertProduct,
  vendorSpots, type VendorSpot, type InsertVendorSpot,
  vendorProfiles, type VendorProfile, type InsertVendorProfile,
  vendorRegistrations, type VendorRegistration, type InsertVendorRegistration,
  volunteerProfiles, type VolunteerProfile, type InsertVolunteerProfile,
  volunteerShifts, type VolunteerShift, type InsertVolunteerShift,
  volunteerAssignments, type VolunteerAssignment, type InsertVolunteerAssignment,
  adminNotes, type AdminNote, type InsertAdminNote,
  analytics, type Analytics, type InsertAnalytics,
  userOnboarding, type UserOnboarding, type InsertUserOnboarding
} from "@shared/schema";
import session from "express-session";
import connectPg from "connect-pg-simple";
import createMemoryStore from "memorystore";
import { log } from "./vite";
import { db, pool } from "./db";
import { and, asc, desc, eq, gte, ilike, inArray, or, sql } from "drizzle-orm";
import { randomBytes } from "crypto";

const PostgresSessionStore = connectPg(session);
const MemoryStore = createMemoryStore(session);

// Interface for the storage operations
export interface IStorage {
  // Onboarding operations
  getUserOnboarding(userId: number): Promise<UserOnboarding | undefined>;
  updateUserOnboarding(userId: number, data: Partial<UserOnboarding>): Promise<UserOnboarding>;
  createUserOnboarding(userId: number): Promise<UserOnboarding>;
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
  updateUserStripeCustomer(userId: number, stripeCustomerId: string): Promise<User>;
  updateUserStripeSubscription(userId: number, stripeSubscriptionId: string): Promise<User>;
  updateUserProfile(userId: number, userData: Partial<InsertUser>): Promise<User>;
  updateUserLastLogin(userId: number): Promise<User>;
  
  // Event operations
  getEvents(filters: { type?: string; location?: string; search?: string; sortBy?: string; isUpcoming?: boolean; status?: string }): Promise<Event[]>;
  getEvent(id: number): Promise<Event | undefined>;
  createEvent(event: InsertEvent): Promise<Event>;
  updateEvent(id: number, eventData: Partial<InsertEvent>): Promise<Event>;
  deleteEvent(id: number): Promise<void>;
  getEventsByOwner(ownerId: number): Promise<Event[]>;
  
  // Product operations
  getProducts(eventId: number, type?: string): Promise<Product[]>;
  getProduct(id: number): Promise<Product | undefined>;
  createProduct(product: InsertProduct): Promise<Product>;
  updateProduct(id: number, productData: Partial<InsertProduct>): Promise<Product>;
  deleteProduct(id: number): Promise<void>;
  
  // Vendor operations
  getVendorProfile(userId: number): Promise<VendorProfile | undefined>;
  createVendorProfile(profile: InsertVendorProfile): Promise<VendorProfile>;
  updateVendorProfile(id: number, profileData: Partial<InsertVendorProfile>): Promise<VendorProfile>;
  getVendorSpots(eventId: number): Promise<VendorSpot[]>;
  getVendorSpot(id: number): Promise<VendorSpot | undefined>;
  createVendorSpot(spot: InsertVendorSpot): Promise<VendorSpot>;
  updateVendorSpot(id: number, spotData: Partial<InsertVendorSpot>): Promise<VendorSpot>;
  getVendorRegistrations(filters: { eventId?: number; userId?: number; status?: string }): Promise<VendorRegistration[]>;
  getVendorRegistration(id: number): Promise<VendorRegistration | undefined>;
  createVendorRegistration(registration: InsertVendorRegistration): Promise<VendorRegistration>;
  updateVendorRegistrationStatus(id: number, status: string, reviewedBy: number): Promise<VendorRegistration>;
  
  // Volunteer operations
  getVolunteerProfile(userId: number): Promise<VolunteerProfile | undefined>;
  createVolunteerProfile(profile: InsertVolunteerProfile): Promise<VolunteerProfile>;
  updateVolunteerProfile(id: number, profileData: Partial<InsertVolunteerProfile>): Promise<VolunteerProfile>;
  getVolunteerShifts(eventId: number): Promise<VolunteerShift[]>;
  getVolunteerShift(id: number): Promise<VolunteerShift | undefined>;
  createVolunteerShift(shift: InsertVolunteerShift): Promise<VolunteerShift>;
  updateVolunteerShift(id: number, shiftData: Partial<InsertVolunteerShift>): Promise<VolunteerShift>;
  getVolunteerAssignments(filters: { eventId?: number; userId?: number; status?: string }): Promise<VolunteerAssignment[]>;
  getVolunteerAssignment(id: number): Promise<VolunteerAssignment | undefined>;
  createVolunteerAssignment(assignment: InsertVolunteerAssignment): Promise<VolunteerAssignment>;
  updateVolunteerAssignmentStatus(id: number, status: string, reviewedBy: number): Promise<VolunteerAssignment>;
  
  // Order operations
  createOrder(order: InsertOrder): Promise<Order>;
  getOrder(id: number): Promise<Order | undefined>;
  getOrderByNumber(orderNumber: string): Promise<Order | undefined>;
  getOrdersByUser(userId: number): Promise<Order[]>;
  getOrdersByEvent(eventId: number): Promise<Order[]>;
  updateOrderStatus(id: number, status: string): Promise<Order>;
  updateOrderPaymentStatus(id: number, paymentStatus: string, stripePaymentId?: string): Promise<Order>;
  
  // Order item operations
  createOrderItem(item: InsertOrderItem): Promise<OrderItem>;
  getOrderItems(orderId: number): Promise<OrderItem[]>;
  
  // Ticket operations
  createTicket(ticket: InsertTicket): Promise<Ticket>;
  getTicket(id: number): Promise<Ticket | undefined>;
  getTicketByNumber(ticketNumber: string): Promise<Ticket | undefined>;
  getTicketsByUser(userId: number): Promise<Ticket[]>;
  getTicketsByEvent(eventId: number): Promise<Ticket[]>;
  getTicketsByOrder(orderId: number): Promise<Ticket[]>;
  updateTicketStatus(id: number, status: string): Promise<Ticket>;
  checkInTicket(id: number): Promise<Ticket>;
  
  // Admin note operations
  createAdminNote(note: InsertAdminNote): Promise<AdminNote>;
  getAdminNotesByTarget(targetType: string, targetId: number): Promise<AdminNote[]>;
  updateAdminNote(id: number, note: string): Promise<AdminNote>;
  deleteAdminNote(id: number): Promise<void>;
  
  // Analytics operations
  recordAnalyticEvent(data: InsertAnalytics): Promise<Analytics>;
  getAnalyticsByMetric(metric: string, eventId?: number, timeframe?: string): Promise<Analytics[]>;
  
  // Admin stats
  getAdminStats(): Promise<{
    totalUsers: number;
    activeEvents: number;
    monthlyRevenue: number;
    ticketsSoldMTD: number;
    recentEvents: Event[];
    recentOrders: Order[];
  }>;
  
  // Search & export
  searchTransactions(query: string, filters: { userId?: number; eventId?: number; transactionType?: string; status?: string }): Promise<any[]>;
  exportTransactions(filters: { userId?: number; eventId?: number; transactionType?: string; startDate?: Date; endDate?: Date; status?: string }): Promise<any[]>;
  

}

// Database implementation of storage interface
export class DatabaseStorage implements IStorage {
  sessionStore: session.Store;

  constructor() {
    this.sessionStore = new PostgresSessionStore({ 
      pool, 
      createTableIfMissing: true,
      tableName: 'session' 
    });
    log("Database storage initialized", "storage");
  }

  // === ONBOARDING OPERATIONS ===
  
  async getUserOnboarding(userId: number): Promise<UserOnboarding | undefined> {
    const result = await db
      .select()
      .from(userOnboarding)
      .where(eq(userOnboarding.userId, userId));
    return result[0];
  }

  async updateUserOnboarding(userId: number, data: Partial<UserOnboarding>): Promise<UserOnboarding> {
    // First check if onboarding data exists
    const existingData = await this.getUserOnboarding(userId);
    
    if (!existingData) {
      // Create new onboarding record if it doesn't exist
      return this.createUserOnboarding(userId, data);
    }
    
    // Update existing record
    const result = await db
      .update(userOnboarding)
      .set({ 
        ...data, 
        updatedAt: new Date() 
      })
      .where(eq(userOnboarding.userId, userId))
      .returning();
    
    return result[0];
  }

  async createUserOnboarding(userId: number, data: Partial<UserOnboarding> = {}): Promise<UserOnboarding> {
    const result = await db
      .insert(userOnboarding)
      .values({
        userId,
        completedSteps: data.completedSteps || {},
        dismissedTooltips: data.dismissedTooltips || {},
        onboardingComplete: data.onboardingComplete || false,
        lastStep: data.lastStep || null,
      })
      .returning();
    
    return result[0];
  }

  // === USER OPERATIONS ===

  async getUser(id: number): Promise<User | undefined> {
    const result = await db.select().from(users).where(eq(users.id, id));
    return result[0];
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const result = await db.select().from(users).where(eq(users.email, email.toLowerCase()));
    return result[0];
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const result = await db.select().from(users).where(eq(users.username, username.toLowerCase()));
    return result[0];
  }

  async createUser(userData: InsertUser): Promise<User> {
    // Ensure email and username are lowercase
    const normalizedUserData = {
      ...userData,
      email: userData.email.toLowerCase(),
      username: userData.username.toLowerCase(),
    };

    const result = await db.insert(users).values(normalizedUserData).returning();
    return result[0];
  }

  async getAllUsers(): Promise<User[]> {
    return await db.select().from(users);
  }

  async updateUserRole(userId: number, role: string): Promise<User> {
    const result = await db
      .update(users)
      .set({ role, updatedAt: new Date() })
      .where(eq(users.id, userId))
      .returning();
    
    if (!result[0]) {
      throw new Error(`User not found: ${userId}`);
    }
    
    return result[0];
  }

  async updateUserPassword(userId: number, password: string): Promise<User> {
    const result = await db
      .update(users)
      .set({ password, updatedAt: new Date() })
      .where(eq(users.id, userId))
      .returning();
    
    if (!result[0]) {
      throw new Error(`User not found: ${userId}`);
    }
    
    return result[0];
  }

  async updateUserStripeAccount(userId: number, stripeAccountId: string | null): Promise<User> {
    // If we get an empty string, treat it as null
    const normalizedStripeAccountId = stripeAccountId === "" ? null : stripeAccountId;
    
    // Log what we're doing to help with debugging
    log(`Setting stripe account ID for user ${userId} to ${normalizedStripeAccountId || "NULL"}`, "storage");
    
    const result = await db
      .update(users)
      .set({ 
        stripeAccountId: normalizedStripeAccountId, 
        updatedAt: new Date() 
      })
      .where(eq(users.id, userId))
      .returning();
    
    if (!result[0]) {
      throw new Error(`User not found: ${userId}`);
    }
    
    return result[0];
  }

  async updateUserStripeCustomer(userId: number, stripeCustomerId: string): Promise<User> {
    const result = await db
      .update(users)
      .set({ stripeCustomerId, updatedAt: new Date() })
      .where(eq(users.id, userId))
      .returning();
    
    if (!result[0]) {
      throw new Error(`User not found: ${userId}`);
    }
    
    return result[0];
  }

  async updateUserStripeSubscription(userId: number, stripeSubscriptionId: string): Promise<User> {
    const result = await db
      .update(users)
      .set({ stripeSubscriptionId, updatedAt: new Date() })
      .where(eq(users.id, userId))
      .returning();
    
    if (!result[0]) {
      throw new Error(`User not found: ${userId}`);
    }
    
    return result[0];
  }

  async updateUserProfile(userId: number, userData: Partial<InsertUser>): Promise<User> {
    const result = await db
      .update(users)
      .set({ ...userData, updatedAt: new Date() })
      .where(eq(users.id, userId))
      .returning();
    
    if (!result[0]) {
      throw new Error(`User not found: ${userId}`);
    }
    
    return result[0];
  }
  
  async updateUserLastLogin(userId: number): Promise<User> {
    const result = await db
      .update(users)
      .set({ lastLogin: new Date(), updatedAt: new Date() })
      .where(eq(users.id, userId))
      .returning();
    
    if (!result[0]) {
      throw new Error(`User not found: ${userId}`);
    }
    
    return result[0];
  }

  // === EVENT OPERATIONS ===

  async getEvents(filters: { type?: string; location?: string; search?: string; sortBy?: string; isUpcoming?: boolean; status?: string } = {}): Promise<Event[]> {
    let queryBuilder = db.select().from(events);
    
    // Apply filters
    const conditions = [];
    
    if (filters.type) {
      conditions.push(eq(events.eventType, filters.type));
    }
    
    if (filters.location) {
      conditions.push(ilike(events.location, `%${filters.location}%`));
    }
    
    if (filters.search) {
      conditions.push(
        or(
          ilike(events.title, `%${filters.search}%`),
          ilike(events.description, `%${filters.search}%`)
        )
      );
    }
    
    if (filters.isUpcoming) {
      conditions.push(gte(events.endDate, new Date()));
    }
    
    // Filter by status if provided
    if (filters.status) {
      conditions.push(eq(events.status, filters.status));
    }
    
    if (conditions.length > 0) {
      queryBuilder = queryBuilder.where(and(...conditions));
    }
    
    // Apply sorting
    if (filters.sortBy === "dateAsc") {
      queryBuilder = queryBuilder.orderBy(asc(events.startDate));
    } else {
      // Default: date descending
      queryBuilder = queryBuilder.orderBy(desc(events.startDate));
    }
    
    return await queryBuilder;
  }

  async getEvent(id: number): Promise<Event | undefined> {
    const result = await db.select().from(events).where(eq(events.id, id));
    return result[0];
  }

  async createEvent(eventData: InsertEvent): Promise<Event> {
    const result = await db.insert(events).values(eventData).returning();
    return result[0];
  }

  async updateEvent(id: number, eventData: Partial<InsertEvent>): Promise<Event> {
    const result = await db
      .update(events)
      .set({ ...eventData, updatedAt: new Date() })
      .where(eq(events.id, id))
      .returning();
    
    if (!result[0]) {
      throw new Error(`Event not found: ${id}`);
    }
    
    return result[0];
  }

  async deleteEvent(id: number): Promise<void> {
    const result = await db.delete(events).where(eq(events.id, id)).returning({ id: events.id });
    if (result.length === 0) {
      throw new Error(`Event not found: ${id}`);
    }
  }

  async getEventsByOwner(ownerId: number): Promise<Event[]> {
    return await db.select().from(events).where(eq(events.ownerId, ownerId));
  }

  // === PRODUCT OPERATIONS ===

  async getProducts(eventId: number, type?: string): Promise<Product[]> {
    let queryBuilder = db.select().from(products).where(eq(products.eventId, eventId));
    
    if (type) {
      queryBuilder = queryBuilder.where(eq(products.type, type));
    }
    
    return await queryBuilder;
  }

  async getProduct(id: number): Promise<Product | undefined> {
    const result = await db.select().from(products).where(eq(products.id, id));
    return result[0];
  }

  async createProduct(productData: InsertProduct): Promise<Product> {
    const result = await db.insert(products).values(productData).returning();
    return result[0];
  }

  async updateProduct(id: number, productData: Partial<InsertProduct>): Promise<Product> {
    const result = await db
      .update(products)
      .set({ ...productData, updatedAt: new Date() })
      .where(eq(products.id, id))
      .returning();
    
    if (!result[0]) {
      throw new Error(`Product not found: ${id}`);
    }
    
    return result[0];
  }

  async deleteProduct(id: number): Promise<void> {
    const result = await db.delete(products).where(eq(products.id, id)).returning({ id: products.id });
    if (result.length === 0) {
      throw new Error(`Product not found: ${id}`);
    }
  }

  // === VENDOR OPERATIONS ===

  async getVendorProfile(userId: number): Promise<VendorProfile | undefined> {
    const result = await db.select().from(vendorProfiles).where(eq(vendorProfiles.userId, userId));
    return result[0];
  }

  async createVendorProfile(profileData: InsertVendorProfile): Promise<VendorProfile> {
    const result = await db.insert(vendorProfiles).values(profileData).returning();
    return result[0];
  }

  async updateVendorProfile(id: number, profileData: Partial<InsertVendorProfile>): Promise<VendorProfile> {
    const result = await db
      .update(vendorProfiles)
      .set({ ...profileData, updatedAt: new Date() })
      .where(eq(vendorProfiles.id, id))
      .returning();
    
    if (!result[0]) {
      throw new Error(`Vendor profile not found: ${id}`);
    }
    
    return result[0];
  }

  async getVendorSpots(eventId: number): Promise<VendorSpot[]> {
    return await db.select().from(vendorSpots).where(eq(vendorSpots.eventId, eventId));
  }

  async getVendorSpot(id: number): Promise<VendorSpot | undefined> {
    const result = await db.select().from(vendorSpots).where(eq(vendorSpots.id, id));
    return result[0];
  }

  async createVendorSpot(spotData: InsertVendorSpot): Promise<VendorSpot> {
    const result = await db.insert(vendorSpots).values(spotData).returning();
    return result[0];
  }

  async updateVendorSpot(id: number, spotData: Partial<InsertVendorSpot>): Promise<VendorSpot> {
    const result = await db
      .update(vendorSpots)
      .set({ ...spotData, updatedAt: new Date() })
      .where(eq(vendorSpots.id, id))
      .returning();
    
    if (!result[0]) {
      throw new Error(`Vendor spot not found: ${id}`);
    }
    
    return result[0];
  }

  async getVendorRegistrations(filters: { eventId?: number; userId?: number; status?: string } = {}): Promise<VendorRegistration[]> {
    let queryBuilder = db.select().from(vendorRegistrations);
    const conditions = [];
    
    if (filters.eventId) {
      conditions.push(eq(vendorRegistrations.eventId, filters.eventId));
    }
    
    if (filters.userId) {
      // First get the vendor profiles for this user
      const profiles = await db.select().from(vendorProfiles).where(eq(vendorProfiles.userId, filters.userId));
      if (profiles.length > 0) {
        // Get registrations for any of these profiles
        const profileIds = profiles.map(p => p.id);
        conditions.push(inArray(vendorRegistrations.vendorProfileId, profileIds));
      } else {
        // No vendor profiles, so no registrations
        return [];
      }
    }
    
    if (filters.status) {
      conditions.push(eq(vendorRegistrations.status, filters.status));
    }
    
    if (conditions.length > 0) {
      queryBuilder = queryBuilder.where(and(...conditions));
    }
    
    return await queryBuilder;
  }

  async getVendorRegistration(id: number): Promise<VendorRegistration | undefined> {
    const result = await db.select().from(vendorRegistrations).where(eq(vendorRegistrations.id, id));
    return result[0];
  }

  async createVendorRegistration(registrationData: InsertVendorRegistration): Promise<VendorRegistration> {
    const result = await db.insert(vendorRegistrations).values(registrationData).returning();
    return result[0];
  }

  async updateVendorRegistrationStatus(id: number, status: string, reviewedBy: number): Promise<VendorRegistration> {
    const result = await db
      .update(vendorRegistrations)
      .set({ 
        status, 
        reviewedBy, 
        reviewDate: new Date(),
        updatedAt: new Date() 
      })
      .where(eq(vendorRegistrations.id, id))
      .returning();
    
    if (!result[0]) {
      throw new Error(`Vendor registration not found: ${id}`);
    }
    
    return result[0];
  }

  // === VOLUNTEER OPERATIONS ===

  async getVolunteerProfile(userId: number): Promise<VolunteerProfile | undefined> {
    const result = await db.select().from(volunteerProfiles).where(eq(volunteerProfiles.userId, userId));
    return result[0];
  }

  async createVolunteerProfile(profileData: InsertVolunteerProfile): Promise<VolunteerProfile> {
    const result = await db.insert(volunteerProfiles).values(profileData).returning();
    return result[0];
  }

  async updateVolunteerProfile(id: number, profileData: Partial<InsertVolunteerProfile>): Promise<VolunteerProfile> {
    const result = await db
      .update(volunteerProfiles)
      .set({ ...profileData, updatedAt: new Date() })
      .where(eq(volunteerProfiles.id, id))
      .returning();
    
    if (!result[0]) {
      throw new Error(`Volunteer profile not found: ${id}`);
    }
    
    return result[0];
  }

  async getVolunteerShifts(eventId: number): Promise<VolunteerShift[]> {
    return await db.select().from(volunteerShifts).where(eq(volunteerShifts.eventId, eventId));
  }

  async getVolunteerShift(id: number): Promise<VolunteerShift | undefined> {
    const result = await db.select().from(volunteerShifts).where(eq(volunteerShifts.id, id));
    return result[0];
  }

  async createVolunteerShift(shiftData: InsertVolunteerShift): Promise<VolunteerShift> {
    const result = await db.insert(volunteerShifts).values(shiftData).returning();
    return result[0];
  }

  async updateVolunteerShift(id: number, shiftData: Partial<InsertVolunteerShift>): Promise<VolunteerShift> {
    const result = await db
      .update(volunteerShifts)
      .set({ ...shiftData, updatedAt: new Date() })
      .where(eq(volunteerShifts.id, id))
      .returning();
    
    if (!result[0]) {
      throw new Error(`Volunteer shift not found: ${id}`);
    }
    
    return result[0];
  }

  async getVolunteerAssignments(filters: { eventId?: number; userId?: number; status?: string } = {}): Promise<VolunteerAssignment[]> {
    let queryBuilder = db.select().from(volunteerAssignments);
    const conditions = [];
    
    if (filters.eventId) {
      conditions.push(eq(volunteerAssignments.eventId, filters.eventId));
    }
    
    if (filters.userId) {
      // First get the volunteer profiles for this user
      const profiles = await db.select().from(volunteerProfiles).where(eq(volunteerProfiles.userId, filters.userId));
      if (profiles.length > 0) {
        // Get assignments for any of these profiles
        const profileIds = profiles.map(p => p.id);
        conditions.push(inArray(volunteerAssignments.volunteerProfileId, profileIds));
      } else {
        // No volunteer profiles, so no assignments
        return [];
      }
    }
    
    if (filters.status) {
      conditions.push(eq(volunteerAssignments.status, filters.status));
    }
    
    if (conditions.length > 0) {
      queryBuilder = queryBuilder.where(and(...conditions));
    }
    
    return await queryBuilder;
  }

  async getVolunteerAssignment(id: number): Promise<VolunteerAssignment | undefined> {
    const result = await db.select().from(volunteerAssignments).where(eq(volunteerAssignments.id, id));
    return result[0];
  }

  async createVolunteerAssignment(assignmentData: InsertVolunteerAssignment): Promise<VolunteerAssignment> {
    const result = await db.insert(volunteerAssignments).values(assignmentData).returning();
    return result[0];
  }

  async updateVolunteerAssignmentStatus(id: number, status: string, reviewedBy: number): Promise<VolunteerAssignment> {
    const result = await db
      .update(volunteerAssignments)
      .set({ 
        status, 
        reviewedBy, 
        reviewDate: new Date(),
        updatedAt: new Date() 
      })
      .where(eq(volunteerAssignments.id, id))
      .returning();
    
    if (!result[0]) {
      throw new Error(`Volunteer assignment not found: ${id}`);
    }
    
    return result[0];
  }

  // === ORDER OPERATIONS ===

  async createOrder(orderData: InsertOrder): Promise<Order> {
    // Generate a unique order number
    const orderNumber = `ORD-${randomBytes(4).toString('hex').toUpperCase()}`;
    
    const result = await db.insert(orders).values({
      ...orderData,
      orderNumber
    }).returning();
    
    return result[0];
  }

  async getOrder(id: number): Promise<Order | undefined> {
    const result = await db.select().from(orders).where(eq(orders.id, id));
    return result[0];
  }

  async getOrderByNumber(orderNumber: string): Promise<Order | undefined> {
    const result = await db.select().from(orders).where(eq(orders.orderNumber, orderNumber));
    return result[0];
  }

  async getOrdersByUser(userId: number): Promise<Order[]> {
    return await db.select().from(orders).where(eq(orders.userId, userId));
  }

  async getOrdersByEvent(eventId: number): Promise<Order[]> {
    return await db.select().from(orders).where(eq(orders.eventId, eventId));
  }

  async updateOrderStatus(id: number, status: string): Promise<Order> {
    const result = await db
      .update(orders)
      .set({ 
        status, 
        updatedAt: new Date() 
      })
      .where(eq(orders.id, id))
      .returning();
    
    if (!result[0]) {
      throw new Error(`Order not found: ${id}`);
    }
    
    return result[0];
  }

  async updateOrderPaymentStatus(id: number, paymentStatus: string, stripePaymentId?: string): Promise<Order> {
    const updateData: any = { 
      paymentStatus, 
      updatedAt: new Date() 
    };
    
    if (stripePaymentId) {
      updateData.stripePaymentId = stripePaymentId;
    }
    
    const result = await db
      .update(orders)
      .set(updateData)
      .where(eq(orders.id, id))
      .returning();
    
    if (!result[0]) {
      throw new Error(`Order not found: ${id}`);
    }
    
    return result[0];
  }

  // === ORDER ITEM OPERATIONS ===

  async createOrderItem(itemData: InsertOrderItem): Promise<OrderItem> {
    const result = await db.insert(orderItems).values(itemData).returning();
    return result[0];
  }

  async getOrderItems(orderId: number): Promise<OrderItem[]> {
    return await db.select().from(orderItems).where(eq(orderItems.orderId, orderId));
  }

  // === TICKET OPERATIONS ===

  async createTicket(ticketData: InsertTicket): Promise<Ticket> {
    // Generate a unique ticket number
    const ticketNumber = `TIX-${randomBytes(4).toString('hex').toUpperCase()}`;
    
    const result = await db.insert(tickets).values({
      ...ticketData,
      ticketNumber
    }).returning();
    
    return result[0];
  }

  async getTicket(id: number): Promise<Ticket | undefined> {
    const result = await db.select().from(tickets).where(eq(tickets.id, id));
    return result[0];
  }

  async getTicketByNumber(ticketNumber: string): Promise<Ticket | undefined> {
    const result = await db.select().from(tickets).where(eq(tickets.ticketNumber, ticketNumber));
    return result[0];
  }

  async getTicketsByUser(userId: number): Promise<Ticket[]> {
    return await db.select().from(tickets).where(eq(tickets.userId, userId));
  }

  async getTicketsByEvent(eventId: number): Promise<Ticket[]> {
    return await db.select().from(tickets).where(eq(tickets.eventId, eventId));
  }

  async getTicketsByOrder(orderId: number): Promise<Ticket[]> {
    return await db.select().from(tickets).where(eq(tickets.orderId, orderId));
  }

  async updateTicketStatus(id: number, status: string): Promise<Ticket> {
    const result = await db
      .update(tickets)
      .set({ 
        status, 
        updatedAt: new Date() 
      })
      .where(eq(tickets.id, id))
      .returning();
    
    if (!result[0]) {
      throw new Error(`Ticket not found: ${id}`);
    }
    
    return result[0];
  }

  async checkInTicket(id: number): Promise<Ticket> {
    const result = await db
      .update(tickets)
      .set({ 
        status: 'used', 
        checkInTime: new Date(),
        updatedAt: new Date() 
      })
      .where(eq(tickets.id, id))
      .returning();
    
    if (!result[0]) {
      throw new Error(`Ticket not found: ${id}`);
    }
    
    return result[0];
  }

  // === ADMIN NOTE OPERATIONS ===

  async createAdminNote(noteData: InsertAdminNote): Promise<AdminNote> {
    const result = await db.insert(adminNotes).values(noteData).returning();
    return result[0];
  }

  async getAdminNotesByTarget(targetType: string, targetId: number): Promise<AdminNote[]> {
    return await db
      .select()
      .from(adminNotes)
      .where(
        and(
          eq(adminNotes.targetType, targetType),
          eq(adminNotes.targetId, targetId)
        )
      );
  }
  
  async updateAdminNote(id: number, note: string): Promise<AdminNote> {
    const result = await db
      .update(adminNotes)
      .set({ 
        note,
        updatedAt: new Date()
      })
      .where(eq(adminNotes.id, id))
      .returning();
    
    if (!result[0]) {
      throw new Error(`Admin note not found: ${id}`);
    }
    
    return result[0];
  }
  
  async deleteAdminNote(id: number): Promise<void> {
    const result = await db
      .delete(adminNotes)
      .where(eq(adminNotes.id, id))
      .returning({ id: adminNotes.id });
      
    if (result.length === 0) {
      throw new Error(`Admin note not found: ${id}`);
    }
  }

  // === ANALYTICS OPERATIONS ===

  async recordAnalyticEvent(data: InsertAnalytics): Promise<Analytics> {
    const result = await db.insert(analytics).values(data).returning();
    return result[0];
  }

  async getAnalyticsByMetric(metric: string, eventId?: number, timeframe?: string): Promise<Analytics[]> {
    let queryBuilder = db
      .select()
      .from(analytics)
      .where(eq(analytics.metric, metric));
    
    const conditions = [];
    
    if (eventId) {
      conditions.push(eq(analytics.eventId, eventId));
    }
    
    if (timeframe) {
      let startDate: Date;
      const now = new Date();
      
      switch (timeframe) {
        case 'today':
          startDate = new Date(now.setHours(0, 0, 0, 0));
          break;
        case 'week':
          startDate = new Date(now);
          startDate.setDate(now.getDate() - 7);
          break;
        case 'month':
          startDate = new Date(now);
          startDate.setMonth(now.getMonth() - 1);
          break;
        case 'year':
          startDate = new Date(now);
          startDate.setFullYear(now.getFullYear() - 1);
          break;
        default:
          startDate = new Date(0); // beginning of time
      }
      
      conditions.push(gte(analytics.dateTime, startDate));
    }
    
    if (conditions.length > 0) {
      queryBuilder = queryBuilder.where(and(...conditions));
    }
    
    return await queryBuilder;
  }

  // === ADMIN STATS ===

  async getAdminStats(): Promise<{
    totalUsers: number;
    activeEvents: number;
    monthlyRevenue: number;
    ticketsSoldMTD: number;
    recentEvents: Event[];
    recentOrders: Order[];
  }> {
    const now = new Date();
    const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    
    // Count users
    const userCount = await db.select({ count: sql`count(*)` }).from(users);
    const totalUsers = Number(userCount[0].count);
    
    // Get active events (not ended yet)
    const activeEventsQuery = await db
      .select({ count: sql`count(*)` })
      .from(events)
      .where(
        and(
          gte(events.endDate, now),
          eq(events.isActive, true)
        )
      );
    const activeEventsCount = Number(activeEventsQuery[0].count);
    
    // Calculate monthly revenue
    const monthlyRevenueQuery = await db
      .select({ sum: sql`coalesce(sum(total_amount), 0)` })
      .from(orders)
      .where(
        and(
          eq(orders.paymentStatus, 'paid'),
          gte(orders.createdAt, firstDayOfMonth)
        )
      );
    const monthlyRevenue = Number(monthlyRevenueQuery[0].sum) || 0;
    
    // Count tickets sold this month
    const ticketsSoldQuery = await db
      .select({ count: sql`count(*)` })
      .from(tickets)
      .where(
        and(
          eq(tickets.status, 'active'),
          gte(tickets.createdAt, firstDayOfMonth)
        )
      );
    const ticketsSoldMTD = Number(ticketsSoldQuery[0].count);
    
    // Get recent events
    const recentEvents = await db
      .select()
      .from(events)
      .where(
        and(
          gte(events.endDate, now),
          eq(events.isActive, true)
        )
      )
      .orderBy(asc(events.startDate))
      .limit(5);
    
    // Get recent orders
    const recentOrders = await db
      .select()
      .from(orders)
      .orderBy(desc(orders.createdAt))
      .limit(5);
    
    return {
      totalUsers,
      activeEvents: activeEventsCount,
      monthlyRevenue,
      ticketsSoldMTD,
      recentEvents,
      recentOrders,
    };
  }

  // === SEARCH & EXPORT ===

  async searchTransactions(query: string, filters: { 
    userId?: number; 
    eventId?: number; 
    transactionType?: string; 
    status?: string 
  } = {}): Promise<any[]> {
    // This is a comprehensive search across different transaction types
    const results: any[] = [];
    
    // Determine which tables to search based on transactionType
    const searchOrders = !filters.transactionType || filters.transactionType === 'order';
    const searchTickets = !filters.transactionType || filters.transactionType === 'ticket';
    const searchVendorRegs = !filters.transactionType || filters.transactionType === 'vendor';
    const searchVolunteerAssignments = !filters.transactionType || filters.transactionType === 'volunteer';
    
    // Build common filter conditions
    const userCondition = filters.userId ? `AND user_id = ${filters.userId}` : '';
    const eventCondition = filters.eventId ? `AND event_id = ${filters.eventId}` : '';
    const statusCondition = filters.status ? `AND status = '${filters.status}'` : '';
    const searchCondition = query ? `AND (order_number ILIKE '%${query}%' OR notes ILIKE '%${query}%')` : '';
    
    // Search orders
    if (searchOrders) {
      const orderSql = `
        SELECT 
          id, 
          'order' as type, 
          order_number as reference, 
          user_id as user_id, 
          event_id, 
          status, 
          total_amount as amount, 
          created_at,
          notes
        FROM orders
        WHERE 1=1 ${userCondition} ${eventCondition} ${statusCondition} ${searchCondition}
      `;
      
      const orderResults = await db.execute(sql.raw(orderSql));
      results.push(...orderResults.rows);
    }
    
    // Search tickets
    if (searchTickets) {
      const ticketSql = `
        SELECT 
          id, 
          'ticket' as type, 
          ticket_number as reference, 
          user_id, 
          event_id, 
          status, 
          price as amount, 
          created_at,
          NULL as notes
        FROM tickets
        WHERE 1=1 ${userCondition} ${eventCondition} ${statusCondition}
        ${query ? `AND ticket_number ILIKE '%${query}%'` : ''}
      `;
      
      const ticketResults = await db.execute(sql.raw(ticketSql));
      results.push(...ticketResults.rows);
    }
    
    // Search vendor registrations
    if (searchVendorRegs) {
      const vendorSql = `
        SELECT 
          vr.id, 
          'vendor' as type, 
          CONCAT('VR-', vr.id) as reference, 
          vp.user_id, 
          vr.event_id, 
          vr.status, 
          vs.price as amount, 
          vr.created_at,
          vr.notes
        FROM vendor_registrations vr
        JOIN vendor_profiles vp ON vr.vendor_profile_id = vp.id
        JOIN vendor_spots vs ON vr.vendor_spot_id = vs.id
        WHERE 1=1 ${eventCondition} ${statusCondition}
        ${filters.userId ? `AND vp.user_id = ${filters.userId}` : ''}
        ${query ? `AND (vr.notes ILIKE '%${query}%' OR vr.products_description ILIKE '%${query}%')` : ''}
      `;
      
      const vendorResults = await db.execute(sql.raw(vendorSql));
      results.push(...vendorResults.rows);
    }
    
    // Search volunteer assignments
    if (searchVolunteerAssignments) {
      const volunteerSql = `
        SELECT 
          va.id, 
          'volunteer' as type, 
          CONCAT('VA-', va.id) as reference, 
          vp.user_id, 
          va.event_id, 
          va.status, 
          0 as amount, 
          va.created_at,
          va.notes
        FROM volunteer_assignments va
        JOIN volunteer_profiles vp ON va.volunteer_profile_id = vp.id
        WHERE 1=1 ${eventCondition} ${statusCondition}
        ${filters.userId ? `AND vp.user_id = ${filters.userId}` : ''}
        ${query ? `AND va.notes ILIKE '%${query}%'` : ''}
      `;
      
      const volunteerResults = await db.execute(sql.raw(volunteerSql));
      results.push(...volunteerResults.rows);
    }
    
    // Sort combined results by date
    results.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    
    return results;
  }

  async exportTransactions(filters: {
    userId?: number;
    eventId?: number;
    transactionType?: string;
    startDate?: Date;
    endDate?: Date;
    status?: string;
  } = {}): Promise<any[]> {
    // Similar to searchTransactions but with more fields and CSV-friendly format
    // This method would return data in a format ready for CSV export
    
    const results = await this.searchTransactions(
      '', 
      { 
        userId: filters.userId, 
        eventId: filters.eventId, 
        transactionType: filters.transactionType,
        status: filters.status
      }
    );
    
    // Filter by date range if provided
    let filteredResults = results;
    if (filters.startDate || filters.endDate) {
      filteredResults = results.filter(item => {
        const itemDate = new Date(item.created_at);
        if (filters.startDate && itemDate < filters.startDate) return false;
        if (filters.endDate && itemDate > filters.endDate) return false;
        return true;
      });
    }
    
    // Enhance the results with additional data
    const enhancedResults = await Promise.all(
      filteredResults.map(async (item) => {
        // Get user name
        const user = await this.getUser(item.user_id);
        
        // Get event title
        const event = await this.getEvent(item.event_id);
        
        return {
          ...item,
          userName: user ? user.name || user.username : 'Unknown',
          userEmail: user ? user.email : 'Unknown',
          eventTitle: event ? event.title : 'Unknown',
          formattedDate: new Date(item.created_at).toLocaleDateString(),
          formattedAmount: `$${parseFloat(item.amount).toFixed(2)}`
        };
      })
    );
    
    return enhancedResults;
  }
}

// Export a single instance of the storage implementation
export const storage = new DatabaseStorage();
