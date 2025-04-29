import { pgTable, text, serial, integer, boolean, timestamp, doublePrecision, json, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { relations } from "drizzle-orm";

// User model
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  email: text("email").notNull().unique(),
  password: text("password").notNull(),
  name: text("name"),
  role: text("role").default("user").notNull(), // "user", "event_owner", "vendor", "volunteer", "admin"
  phoneNumber: text("phone_number"),
  address: text("address"),
  city: text("city"),
  state: text("state"),
  zipCode: text("zip_code"),
  profileImage: text("profile_image"),
  stripeAccountId: text("stripe_account_id"),
  stripeCustomerId: text("stripe_customer_id"),
  stripeSubscriptionId: text("stripe_subscription_id"),
  lastLogin: timestamp("last_login"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const userRelations = relations(users, ({ many }) => ({
  tickets: many(tickets),
  vendorProfiles: many(vendorProfiles),
  volunteerProfiles: many(volunteerProfiles),
  orders: many(orders),
  adminNotes: many(adminNotes, { relationName: "userNotes" }),
  createdNotes: many(adminNotes, { relationName: "adminCreatedNotes" }),
}));

export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
  stripeAccountId: true,
  stripeCustomerId: true,
  stripeSubscriptionId: true,
  lastLogin: true,
  createdAt: true,
  updatedAt: true,
});

// Event model
export const events = pgTable("events", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  description: text("description").notNull(),
  location: text("location").notNull(),
  startDate: timestamp("start_date").notNull(),
  endDate: timestamp("end_date").notNull(),
  imageUrl: text("image_url"),
  eventType: text("event_type").notNull(), // concert, festival, conference, etc.
  ownerId: integer("owner_id").notNull(),
  isActive: boolean("is_active").default(true).notNull(),
  isPublic: boolean("is_public").default(true).notNull(),
  capacity: integer("capacity"),
  ticketsAvailable: integer("tickets_available"),
  price: doublePrecision("price").default(0).notNull(),
  metadata: jsonb("metadata"), // Additional configurable fields
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const eventRelations = relations(events, ({ one, many }) => ({
  owner: one(users, {
    fields: [events.ownerId],
    references: [users.id],
  }),
  tickets: many(tickets),
  vendorSpots: many(vendorSpots),
  volunteerShifts: many(volunteerShifts),
  products: many(products),
  orders: many(orders),
  adminNotes: many(adminNotes),
}));

export const insertEventSchema = createInsertSchema(events).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// Product model (for merchandise, addons, etc.)
export const products = pgTable("products", {
  id: serial("id").primaryKey(),
  eventId: integer("event_id").notNull(),
  name: text("name").notNull(),
  description: text("description"),
  type: text("type").notNull(), // "merchandise", "addon", etc.
  price: doublePrecision("price").notNull(),
  imageUrl: text("image_url"),
  quantity: integer("quantity").default(0), // Available quantity, null for unlimited
  isActive: boolean("is_active").default(true).notNull(),
  metadata: jsonb("metadata"), // Additional configurable fields
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const productRelations = relations(products, ({ one, many }) => ({
  event: one(events, {
    fields: [products.eventId],
    references: [events.id],
  }),
  orderItems: many(orderItems),
}));

export const insertProductSchema = createInsertSchema(products).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// Vendor Spots model
export const vendorSpots = pgTable("vendor_spots", {
  id: serial("id").primaryKey(),
  eventId: integer("event_id").notNull(),
  name: text("name").notNull(),
  description: text("description"),
  price: doublePrecision("price").notNull(),
  capacity: integer("capacity").default(1).notNull(), // Number of spots available
  availableSpots: integer("available_spots"),
  requirements: text("requirements"),
  metadata: jsonb("metadata"), // Additional configurable fields
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const vendorSpotRelations = relations(vendorSpots, ({ one, many }) => ({
  event: one(events, {
    fields: [vendorSpots.eventId],
    references: [events.id],
  }),
  vendorRegistrations: many(vendorRegistrations),
}));

export const insertVendorSpotSchema = createInsertSchema(vendorSpots).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// Vendor Profiles
export const vendorProfiles = pgTable("vendor_profiles", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  businessName: text("business_name").notNull(),
  description: text("description"),
  website: text("website"),
  socialMedia: jsonb("social_media"),
  logo: text("logo"),
  taxId: text("tax_id"),
  phoneNumber: text("phone_number"),
  address: text("address"),
  city: text("city"),
  state: text("state"),
  zipCode: text("zip_code"),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const vendorProfileRelations = relations(vendorProfiles, ({ one, many }) => ({
  user: one(users, {
    fields: [vendorProfiles.userId],
    references: [users.id],
  }),
  registrations: many(vendorRegistrations),
}));

export const insertVendorProfileSchema = createInsertSchema(vendorProfiles).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// Vendor Registrations
export const vendorRegistrations = pgTable("vendor_registrations", {
  id: serial("id").primaryKey(),
  vendorProfileId: integer("vendor_profile_id").notNull(),
  vendorSpotId: integer("vendor_spot_id").notNull(),
  eventId: integer("event_id").notNull(),
  orderId: integer("order_id"), // Linked to payment
  status: text("status").default("pending").notNull(), // "pending", "approved", "rejected", "cancelled"
  productsDescription: text("products_description"),
  specialRequests: text("special_requests"),
  notes: text("notes"),
  reviewedBy: integer("reviewed_by"), // Admin user ID
  reviewDate: timestamp("review_date"),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const vendorRegistrationRelations = relations(vendorRegistrations, ({ one }) => ({
  vendorProfile: one(vendorProfiles, {
    fields: [vendorRegistrations.vendorProfileId],
    references: [vendorProfiles.id],
  }),
  vendorSpot: one(vendorSpots, {
    fields: [vendorRegistrations.vendorSpotId],
    references: [vendorSpots.id],
  }),
  event: one(events, {
    fields: [vendorRegistrations.eventId],
    references: [events.id],
  }),
  order: one(orders, {
    fields: [vendorRegistrations.orderId],
    references: [orders.id],
  }),
  reviewer: one(users, {
    fields: [vendorRegistrations.reviewedBy],
    references: [users.id],
  }),
}));

export const insertVendorRegistrationSchema = createInsertSchema(vendorRegistrations).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  reviewDate: true,
});

// Volunteer Profiles
export const volunteerProfiles = pgTable("volunteer_profiles", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  skills: jsonb("skills"),
  experience: text("experience"),
  availability: jsonb("availability"),
  emergencyContact: text("emergency_contact"),
  emergencyPhone: text("emergency_phone"),
  tshirtSize: text("tshirt_size"),
  dietaryRestrictions: text("dietary_restrictions"),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const volunteerProfileRelations = relations(volunteerProfiles, ({ one, many }) => ({
  user: one(users, {
    fields: [volunteerProfiles.userId],
    references: [users.id],
  }),
  assignments: many(volunteerAssignments),
}));

export const insertVolunteerProfileSchema = createInsertSchema(volunteerProfiles).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// Volunteer Shifts
export const volunteerShifts = pgTable("volunteer_shifts", {
  id: serial("id").primaryKey(),
  eventId: integer("event_id").notNull(),
  name: text("name").notNull(),
  description: text("description"),
  startTime: timestamp("start_time").notNull(),
  endTime: timestamp("end_time").notNull(),
  location: text("location"),
  requiredSkills: jsonb("required_skills"),
  capacity: integer("capacity").notNull(),
  availableSpots: integer("available_spots"),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const volunteerShiftRelations = relations(volunteerShifts, ({ one, many }) => ({
  event: one(events, {
    fields: [volunteerShifts.eventId],
    references: [events.id],
  }),
  assignments: many(volunteerAssignments),
}));

export const insertVolunteerShiftSchema = createInsertSchema(volunteerShifts).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// Volunteer Assignments
export const volunteerAssignments = pgTable("volunteer_assignments", {
  id: serial("id").primaryKey(),
  volunteerProfileId: integer("volunteer_profile_id").notNull(),
  shiftId: integer("shift_id").notNull(),
  eventId: integer("event_id").notNull(),
  status: text("status").default("pending").notNull(), // "pending", "approved", "rejected", "cancelled", "completed"
  checkInTime: timestamp("check_in_time"),
  checkOutTime: timestamp("check_out_time"),
  notes: text("notes"),
  reviewedBy: integer("reviewed_by"), // Admin user ID
  reviewDate: timestamp("review_date"),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const volunteerAssignmentRelations = relations(volunteerAssignments, ({ one }) => ({
  volunteerProfile: one(volunteerProfiles, {
    fields: [volunteerAssignments.volunteerProfileId],
    references: [volunteerProfiles.id],
  }),
  shift: one(volunteerShifts, {
    fields: [volunteerAssignments.shiftId],
    references: [volunteerShifts.id],
  }),
  event: one(events, {
    fields: [volunteerAssignments.eventId],
    references: [events.id],
  }),
  reviewer: one(users, {
    fields: [volunteerAssignments.reviewedBy],
    references: [users.id],
  }),
}));

export const insertVolunteerAssignmentSchema = createInsertSchema(volunteerAssignments).omit({
  id: true,
  checkInTime: true,
  checkOutTime: true,
  reviewDate: true,
  createdAt: true,
  updatedAt: true,
});

// Orders (master table for all purchases)
export const orders = pgTable("orders", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  eventId: integer("event_id").notNull(),
  orderNumber: text("order_number").notNull().unique(),
  status: text("status").default("pending").notNull(), // "pending", "completed", "cancelled", "refunded"
  totalAmount: doublePrecision("total_amount").notNull(),
  paymentMethod: text("payment_method").notNull(), // "stripe", "cash", "free", etc.
  paymentStatus: text("payment_status").default("pending").notNull(), // "pending", "paid", "failed", "refunded"
  stripePaymentId: text("stripe_payment_id"),
  stripeSessionId: text("stripe_session_id"),
  emailSent: boolean("email_sent").default(false),
  notes: text("notes"),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const orderRelations = relations(orders, ({ one, many }) => ({
  user: one(users, {
    fields: [orders.userId],
    references: [users.id],
  }),
  event: one(events, {
    fields: [orders.eventId],
    references: [events.id],
  }),
  items: many(orderItems),
  tickets: many(tickets),
  vendorRegistrations: many(vendorRegistrations),
  adminNotes: many(adminNotes),
}));

export const insertOrderSchema = createInsertSchema(orders).omit({
  id: true,
  orderNumber: true,
  createdAt: true,
  updatedAt: true,
});

// Order Items (all items in an order)
export const orderItems = pgTable("order_items", {
  id: serial("id").primaryKey(),
  orderId: integer("order_id").notNull(),
  itemType: text("item_type").notNull(), // "ticket", "product", "vendor_spot", "volunteer_shift"
  itemId: integer("item_id").notNull(), // ID of the ticket/product/etc.
  name: text("name").notNull(),
  description: text("description"),
  quantity: integer("quantity").default(1).notNull(),
  unitPrice: doublePrecision("unit_price").notNull(),
  totalPrice: doublePrecision("total_price").notNull(),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const orderItemRelations = relations(orderItems, ({ one }) => ({
  order: one(orders, {
    fields: [orderItems.orderId],
    references: [orders.id],
  }),
  product: one(products, {
    fields: [orderItems.itemId],
    references: [products.id],
    relationName: "productOrderItems"
  }),
}));

export const insertOrderItemSchema = createInsertSchema(orderItems).omit({
  id: true,
  createdAt: true,
});

// Ticket model
export const tickets = pgTable("tickets", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  eventId: integer("event_id").notNull(),
  orderId: integer("order_id").notNull(),
  ticketType: text("ticket_type").default("standard").notNull(), // "standard", "vip", "early-bird", etc.
  ticketNumber: text("ticket_number").notNull().unique(),
  status: text("status").default("active").notNull(), // "active", "used", "cancelled", "refunded"
  price: doublePrecision("price").notNull(),
  checkInTime: timestamp("check_in_time"),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const ticketRelations = relations(tickets, ({ one, many }) => ({
  user: one(users, {
    fields: [tickets.userId],
    references: [users.id],
  }),
  event: one(events, {
    fields: [tickets.eventId],
    references: [events.id],
  }),
  order: one(orders, {
    fields: [tickets.orderId],
    references: [orders.id],
  }),
  adminNotes: many(adminNotes),
}));

export const insertTicketSchema = createInsertSchema(tickets).omit({
  id: true,
  ticketNumber: true,
  checkInTime: true,
  createdAt: true,
  updatedAt: true,
});

// Admin note model
export const adminNotes = pgTable("admin_notes", {
  id: serial("id").primaryKey(),
  adminId: integer("admin_id").notNull(),
  targetType: text("target_type").notNull(), // "user", "event", "order", "ticket", etc.
  targetId: integer("target_id").notNull(),
  note: text("note").notNull(),
  isInternal: boolean("is_internal").default(true).notNull(), // Whether the note is visible to users
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const adminNoteRelations = relations(adminNotes, ({ one }) => ({
  admin: one(users, {
    fields: [adminNotes.adminId],
    references: [users.id],
    relationName: "adminCreatedNotes"
  }),
  user: one(users, {
    fields: [adminNotes.targetId],
    references: [users.id],
    relationName: "userNotes"
  }),
  event: one(events, {
    fields: [adminNotes.targetId],
    references: [events.id],
  }),
  order: one(orders, {
    fields: [adminNotes.targetId],
    references: [orders.id],
  }),
  ticket: one(tickets, {
    fields: [adminNotes.targetId],
    references: [tickets.id],
  }),
}));

export const insertAdminNoteSchema = createInsertSchema(adminNotes).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// Analytical data for dashboard
export const analytics = pgTable("analytics", {
  id: serial("id").primaryKey(),
  eventId: integer("event_id"),
  metric: text("metric").notNull(), // "page_views", "ticket_sales", "revenue", etc.
  value: doublePrecision("value").notNull(),
  dimension: text("dimension"), // e.g., "date", "user_type", "ticket_type"
  dimensionValue: text("dimension_value"),
  dateTime: timestamp("date_time").defaultNow().notNull(),
  metadata: jsonb("metadata"),
});

export const analyticsRelations = relations(analytics, ({ one }) => ({
  event: one(events, {
    fields: [analytics.eventId],
    references: [events.id],
  }),
}));

export const insertAnalyticsSchema = createInsertSchema(analytics).omit({
  id: true,
  dateTime: true,
});

// Type exports
export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;

export type Event = typeof events.$inferSelect;
export type InsertEvent = z.infer<typeof insertEventSchema>;

export type Product = typeof products.$inferSelect;
export type InsertProduct = z.infer<typeof insertProductSchema>;

export type VendorSpot = typeof vendorSpots.$inferSelect;
export type InsertVendorSpot = z.infer<typeof insertVendorSpotSchema>;

export type VendorProfile = typeof vendorProfiles.$inferSelect;
export type InsertVendorProfile = z.infer<typeof insertVendorProfileSchema>;

export type VendorRegistration = typeof vendorRegistrations.$inferSelect;
export type InsertVendorRegistration = z.infer<typeof insertVendorRegistrationSchema>;

export type VolunteerProfile = typeof volunteerProfiles.$inferSelect;
export type InsertVolunteerProfile = z.infer<typeof insertVolunteerProfileSchema>;

export type VolunteerShift = typeof volunteerShifts.$inferSelect;
export type InsertVolunteerShift = z.infer<typeof insertVolunteerShiftSchema>;

export type VolunteerAssignment = typeof volunteerAssignments.$inferSelect;
export type InsertVolunteerAssignment = z.infer<typeof insertVolunteerAssignmentSchema>;

export type Order = typeof orders.$inferSelect;
export type InsertOrder = z.infer<typeof insertOrderSchema>;

export type OrderItem = typeof orderItems.$inferSelect;
export type InsertOrderItem = z.infer<typeof insertOrderItemSchema>;

export type Ticket = typeof tickets.$inferSelect;
export type InsertTicket = z.infer<typeof insertTicketSchema>;

export type AdminNote = typeof adminNotes.$inferSelect;
export type InsertAdminNote = z.infer<typeof insertAdminNoteSchema>;

export type Analytics = typeof analytics.$inferSelect;
export type InsertAnalytics = z.infer<typeof insertAnalyticsSchema>;

// System Settings model
export const systemSettings = pgTable("system_settings", {
  id: serial("id").primaryKey(),
  key: text("key").notNull().unique(),
  value: jsonb("value"),
  category: text("category").notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  updatedBy: integer("updated_by").references(() => users.id),
});

export const systemSettingsRelations = relations(systemSettings, ({ one }) => ({
  updatedByUser: one(users, {
    fields: [systemSettings.updatedBy],
    references: [users.id],
  }),
}));

export const insertSystemSettingsSchema = createInsertSchema(systemSettings).omit({
  id: true,
  updatedAt: true,
});

export type SystemSetting = typeof systemSettings.$inferSelect;
export type InsertSystemSetting = z.infer<typeof insertSystemSettingsSchema>;
