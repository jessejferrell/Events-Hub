import { db } from './db';
import { analytics, events, users } from '@shared/schema';
import { sql } from 'drizzle-orm';

// Seed analytics data for testing
export async function seedAnalyticsData() {
  console.log('Seeding analytics data...');
  
  try {
    // First, check if we already have analytics data
    const existingAnalytics = await db.select({ count: sql`count(*)` }).from(analytics);
    const count = parseInt(existingAnalytics[0].count.toString());
    
    if (count > 0) {
      console.log(`Analytics data already exists (${count} records). Skipping seed.`);
      return;
    }
    
    // Get existing events for reference
    const allEvents = await db.select().from(events);
    if (allEvents.length === 0) {
      console.log('No events found. Please create events first.');
      return;
    }
    
    // Get existing users for reference
    const allUsers = await db.select().from(users);
    if (allUsers.length === 0) {
      console.log('No users found. Please create users first.');
      return;
    }
    
    const analyticsData = [];
    const now = new Date();
    
    // Generate revenue data
    for (let i = 0; i < 50; i++) {
      const eventId = allEvents[Math.floor(Math.random() * allEvents.length)].id;
      const date = new Date(now);
      date.setDate(date.getDate() - Math.floor(Math.random() * 30)); // Random date in last 30 days
      
      analyticsData.push({
        eventId,
        metric: 'revenue',
        value: Math.floor(Math.random() * 10000) / 100, // Random amount between 0 and 100
        dimension: 'product_type',
        dimensionValue: ['ticket', 'merchandise', 'vendor', 'volunteer'][Math.floor(Math.random() * 4)],
        dateTime: date
      });
    }
    
    // Generate ticket sale data
    for (let i = 0; i < 100; i++) {
      const eventId = allEvents[Math.floor(Math.random() * allEvents.length)].id;
      const date = new Date(now);
      date.setDate(date.getDate() - Math.floor(Math.random() * 30)); // Random date in last 30 days
      
      analyticsData.push({
        eventId,
        metric: 'ticket_sale',
        value: Math.floor(Math.random() * 5) + 1, // Random quantity between 1 and 5
        dimension: 'ticket_type',
        dimensionValue: ['general', 'vip', 'early_bird'][Math.floor(Math.random() * 3)],
        dateTime: date
      });
    }
    
    // Generate user data
    for (let i = 0; i < 30; i++) {
      const date = new Date(now);
      date.setDate(date.getDate() - Math.floor(Math.random() * 30)); // Random date in last 30 days
      
      analyticsData.push({
        metric: 'new_user',
        value: 1,
        dimension: 'source',
        dimensionValue: ['direct', 'social', 'search', 'referral'][Math.floor(Math.random() * 4)],
        dateTime: date
      });
    }
    
    // Generate event data
    for (let i = 0; i < 10; i++) {
      const date = new Date(now);
      date.setDate(date.getDate() - Math.floor(Math.random() * 30)); // Random date in last 30 days
      
      analyticsData.push({
        metric: 'new_event',
        value: 1,
        dimension: 'event_type',
        dimensionValue: ['festival', 'concert', 'exhibition', 'conference', 'other'][Math.floor(Math.random() * 5)],
        dateTime: date
      });
    }
    
    // Generate page view data
    for (let i = 0; i < 500; i++) {
      const eventId = allEvents[Math.floor(Math.random() * allEvents.length)].id;
      const date = new Date(now);
      date.setDate(date.getDate() - Math.floor(Math.random() * 30)); // Random date in last 30 days
      
      analyticsData.push({
        eventId,
        metric: 'page_view',
        value: 1,
        dimension: 'user_type',
        dimensionValue: ['anonymous', 'user', 'admin'][Math.floor(Math.random() * 3)],
        dateTime: date
      });
    }
    
    // Insert all analytics data
    console.log(`Inserting ${analyticsData.length} analytics records...`);
    await db.insert(analytics).values(analyticsData);
    
    console.log('Analytics data seeded successfully!');
  } catch (error) {
    console.error('Error seeding analytics data:', error);
  }
}