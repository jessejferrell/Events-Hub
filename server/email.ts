import nodemailer from 'nodemailer';
import type { Express, Request, Response } from 'express';
import { db } from './db';
import { eq, and, inArray } from 'drizzle-orm';
import { users, tickets, products, vendorRegistrations, volunteerAssignments, events } from '@shared/schema';
import { storage } from './storage';

// Create the transporter using environment variables
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: parseInt(process.env.SMTP_PORT || '587', 10),
  secure: process.env.SMTP_PORT === '465', // true for 465, false for other ports
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASSWORD,
  },
});

// Templates data
interface EmailTemplate {
  id: string;
  name: string;
  subject: string;
  body: string;
  description: string;
  audience: 'all' | 'tickets' | 'vendors' | 'volunteers' | 'custom';
}

// Email templates - these will be stored in the database in a real implementation
const emailTemplates: EmailTemplate[] = [
  {
    id: 'welcome',
    name: 'Welcome',
    subject: 'Welcome to {{eventName}}',
    body: `<h1>Welcome to {{eventName}}!</h1>
<p>Dear {{recipientName}},</p>
<p>Thank you for registering for {{eventName}}. We're excited to have you join us!</p>
<p>Event Details:</p>
<ul>
  <li><strong>Date:</strong> {{eventDate}}</li>
  <li><strong>Time:</strong> {{eventTime}}</li>
  <li><strong>Location:</strong> {{eventLocation}}</li>
</ul>
<p>Your ticket information is attached to this email. Please present it at the entrance on the day of the event.</p>
<p>If you have any questions, please don't hesitate to contact us.</p>
<p>Looking forward to seeing you!</p>
<p>Best regards,<br>The {{eventName}} Team</p>`,
    description: 'Welcome email sent after registration',
    audience: 'all'
  },
  {
    id: 'event_update',
    name: 'Event Update',
    subject: 'Important Update: {{eventName}}',
    body: `<h1>Important Update: {{eventName}}</h1>
<p>Dear {{recipientName}},</p>
<p>We're reaching out with an important update regarding {{eventName}}.</p>
<p>{{updateDetails}}</p>
<p>What This Means For You:</p>
<p>{{impactDetails}}</p>
<p>If you have any questions or concerns, please don't hesitate to contact us.</p>
<p>Thank you for your understanding.</p>
<p>Best regards,<br>The {{eventName}} Team</p>`,
    description: 'Notify participants about event changes or updates',
    audience: 'all'
  },
  {
    id: 'vendor_instructions',
    name: 'Vendor Instructions',
    subject: 'Vendor Instructions for {{eventName}}',
    body: `<h1>Vendor Instructions for {{eventName}}</h1>
<p>Dear {{recipientName}},</p>
<p>We're looking forward to having you as a vendor at {{eventName}}. Here are the details for your booth:</p>
<ul>
  <li><strong>Booth Number:</strong> {{boothNumber}}</li>
  <li><strong>Setup Time:</strong> {{setupTime}}</li>
  <li><strong>Breakdown Time:</strong> {{breakdownTime}}</li>
</ul>
<h2>Setup Instructions</h2>
<p>{{setupInstructions}}</p>
<h2>Important Vendor Rules</h2>
<p>{{vendorRules}}</p>
<p>If you have any questions, please don't hesitate to contact our vendor coordinator.</p>
<p>Looking forward to a successful event!</p>
<p>Best regards,<br>The {{eventName}} Team</p>`,
    description: 'Send booth information and setup instructions to vendors',
    audience: 'vendors'
  },
  {
    id: 'volunteer_schedule',
    name: 'Volunteer Schedule',
    subject: 'Your Volunteer Schedule for {{eventName}}',
    body: `<h1>Your Volunteer Schedule for {{eventName}}</h1>
<p>Dear {{recipientName}},</p>
<p>Thank you for volunteering for {{eventName}}. We greatly appreciate your support!</p>
<p>Here is your assigned schedule:</p>
<ul>
  <li><strong>Position:</strong> {{volunteerPosition}}</li>
  <li><strong>Date:</strong> {{volunteerDate}}</li>
  <li><strong>Time:</strong> {{volunteerTime}}</li>
  <li><strong>Location:</strong> {{volunteerLocation}}</li>
  <li><strong>Supervisor:</strong> {{supervisorName}}</li>
</ul>
<h2>Important Information</h2>
<p>{{volunteerInstructions}}</p>
<p>If you have any questions or need to make changes to your schedule, please contact our volunteer coordinator as soon as possible.</p>
<p>Thank you again for your support!</p>
<p>Best regards,<br>The {{eventName}} Team</p>`,
    description: 'Send schedule information to volunteers',
    audience: 'volunteers'
  },
  {
    id: 'reminder',
    name: 'Event Reminder',
    subject: 'Reminder: {{eventName}} Is Coming Up!',
    body: `<h1>Reminder: {{eventName}} Is Coming Up!</h1>
<p>Dear {{recipientName}},</p>
<p>This is a friendly reminder that {{eventName}} is just around the corner!</p>
<p>Event Details:</p>
<ul>
  <li><strong>Date:</strong> {{eventDate}}</li>
  <li><strong>Time:</strong> {{eventTime}}</li>
  <li><strong>Location:</strong> {{eventLocation}}</li>
</ul>
<p>Don't forget to bring your ticket with you. We're looking forward to seeing you there!</p>
<p>Best regards,<br>The {{eventName}} Team</p>`,
    description: 'Send a reminder closer to the event date',
    audience: 'tickets'
  },
  {
    id: 'venue_change',
    name: 'Venue Change',
    subject: 'IMPORTANT: Venue Change for {{eventName}}',
    body: `<h1>IMPORTANT: Venue Change for {{eventName}}</h1>
<p>Dear {{recipientName}},</p>
<p>We want to inform you about an important change regarding {{eventName}}.</p>
<p><strong>The event venue has been changed.</strong></p>
<p><strong>New Location:</strong> {{newLocation}}</p>
<p><strong>Reason for Change:</strong> {{reasonForChange}}</p>
<p>All other event details remain the same. We apologize for any inconvenience this may cause.</p>
<p>If you have any questions or concerns, please don't hesitate to contact us.</p>
<p>Thank you for your understanding.</p>
<p>Best regards,<br>The {{eventName}} Team</p>`,
    description: 'Notify participants about a venue change',
    audience: 'all'
  },
  {
    id: 'weather_update',
    name: 'Weather Update',
    subject: 'Weather Update for {{eventName}}',
    body: `<h1>Weather Update for {{eventName}}</h1>
<p>Dear {{recipientName}},</p>
<p>We're writing to provide you with an important weather update for {{eventName}}.</p>
<p><strong>Current Forecast:</strong> {{weatherForecast}}</p>
<h2>Weather Plan</h2>
<p>{{weatherPlan}}</p>
<p>We recommend:</p>
<ul>
  <li>{{weatherRecommendation1}}</li>
  <li>{{weatherRecommendation2}}</li>
  <li>{{weatherRecommendation3}}</li>
</ul>
<p>We'll continue to monitor the weather and provide updates as needed.</p>
<p>Thank you for your understanding.</p>
<p>Best regards,<br>The {{eventName}} Team</p>`,
    description: 'Provide weather updates and recommendations',
    audience: 'all'
  },
  {
    id: 'parking_instructions',
    name: 'Parking Instructions',
    subject: 'Parking Information for {{eventName}}',
    body: `<h1>Parking Information for {{eventName}}</h1>
<p>Dear {{recipientName}},</p>
<p>We want to provide you with important parking information for {{eventName}}.</p>
<h2>Parking Options</h2>
<p>{{parkingOptions}}</p>
<h2>Directions</h2>
<p>{{parkingDirections}}</p>
<h2>Additional Transportation Options</h2>
<p>{{transportationOptions}}</p>
<p>If you have any questions, please don't hesitate to contact us.</p>
<p>We look forward to seeing you at the event!</p>
<p>Best regards,<br>The {{eventName}} Team</p>`,
    description: 'Provide parking and transportation details',
    audience: 'all'
  },
  {
    id: 'post_event',
    name: 'Post-Event Thank You',
    subject: 'Thank You for Attending {{eventName}}',
    body: `<h1>Thank You for Attending {{eventName}}</h1>
<p>Dear {{recipientName}},</p>
<p>Thank you for attending {{eventName}}! We hope you had a wonderful time.</p>
<p>We appreciate your support and participation in making this event a success.</p>
<p>{{eventRecap}}</p>
<p>We would love to hear your feedback! Please take a moment to complete our short survey: [Survey Link]</p>
<p>Photos from the event will be available soon on our website and social media channels.</p>
<p>We hope to see you at our future events!</p>
<p>Best regards,<br>The {{eventName}} Team</p>`,
    description: 'Thank attendees after the event',
    audience: 'all'
  },
  {
    id: 'schedule_change',
    name: 'Schedule Change',
    subject: 'Schedule Change for {{eventName}}',
    body: `<h1>Schedule Change for {{eventName}}</h1>
<p>Dear {{recipientName}},</p>
<p>We're writing to inform you about a change in the schedule for {{eventName}}.</p>
<p><strong>Updated Schedule:</strong></p>
<p>{{scheduleChanges}}</p>
<p><strong>Reason for Change:</strong> {{reasonForScheduleChange}}</p>
<p>We apologize for any inconvenience this may cause.</p>
<p>If you have any questions or concerns, please don't hesitate to contact us.</p>
<p>Thank you for your understanding.</p>
<p>Best regards,<br>The {{eventName}} Team</p>`,
    description: 'Notify participants about schedule changes',
    audience: 'all'
  }
];

// Helper function to replace template placeholders with actual values
function replaceTemplatePlaceholders(template: string, replacements: Record<string, string>): string {
  let result = template;
  for (const [key, value] of Object.entries(replacements)) {
    result = result.replace(new RegExp(`{{${key}}}`, 'g'), value);
  }
  return result;
}

// Get recipients based on filters
async function getRecipients(
  eventId: number,
  audienceType: string,
  additionalFilters: { registrationStatus?: string; productType?: string } = {}
) {
  const { registrationStatus, productType } = additionalFilters;
  
  // Get the event details
  const event = await storage.getEvent(eventId);
  if (!event) {
    throw new Error('Event not found');
  }

  // Base recipient list
  let recipients: { userId: number; email: string; username: string; firstName?: string; lastName?: string }[] = [];

  // Get all event participants based on audience type
  if (audienceType === 'all' || audienceType === 'tickets') {
    // Get ticket holders
    const ticketHolders = await storage.getTicketsByEvent(eventId);
    
    for (const ticket of ticketHolders) {
      const user = await storage.getUser(ticket.userId);
      if (user && user.email) {
        recipients.push({
          userId: user.id,
          email: user.email,
          username: user.username,
          firstName: user.firstName,
          lastName: user.lastName
        });
      }
    }
  }
  
  if (audienceType === 'all' || audienceType === 'vendors') {
    // Get vendors
    const vendorRegs = await storage.getVendorRegistrations({ eventId, status: registrationStatus });
    
    for (const reg of vendorRegs) {
      const user = await storage.getUser(reg.userId);
      if (user && user.email) {
        recipients.push({
          userId: user.id,
          email: user.email,
          username: user.username,
          firstName: user.firstName,
          lastName: user.lastName
        });
      }
    }
  }
  
  if (audienceType === 'all' || audienceType === 'volunteers') {
    // Get volunteers
    const volunteerAssignments = await storage.getVolunteerAssignments({ eventId, status: registrationStatus });
    
    for (const assignment of volunteerAssignments) {
      const user = await storage.getUser(assignment.userId);
      if (user && user.email) {
        recipients.push({
          userId: user.id,
          email: user.email,
          username: user.username,
          firstName: user.firstName,
          lastName: user.lastName
        });
      }
    }
  }
  
  // Remove duplicates (a user might be both a ticket holder and a vendor)
  const uniqueRecipients = Array.from(new Map(recipients.map(item => [item.userId, item])).values());
  
  return uniqueRecipients;
}

// Send email to a list of recipients
async function sendBulkEmail(
  subject: string,
  body: string,
  recipients: { email: string; username: string; firstName?: string; lastName?: string }[],
  eventId?: number,
  individualizeContent: boolean = false
) {
  const event = eventId ? await storage.getEvent(eventId) : null;
  
  const results = {
    success: 0,
    failed: 0,
    failures: [] as { email: string; error: string }[]
  };
  
  for (const recipient of recipients) {
    try {
      // Create personalized content if requested
      let personalizedBody = body;
      let personalizedSubject = subject;
      
      if (individualizeContent) {
        const recipientName = recipient.firstName && recipient.lastName 
          ? `${recipient.firstName} ${recipient.lastName}`
          : recipient.username;
          
        const replacements: Record<string, string> = {
          recipientName,
          eventName: event?.title || 'Our Event',
          eventDate: event ? new Date(event.startDate).toLocaleDateString() : 'TBD',
          eventTime: event ? new Date(event.startDate).toLocaleTimeString() : 'TBD',
          eventLocation: event?.location || 'TBD'
        };
        
        personalizedBody = replaceTemplatePlaceholders(body, replacements);
        personalizedSubject = replaceTemplatePlaceholders(subject, replacements);
      }
      
      // Send the email
      await transporter.sendMail({
        from: process.env.SMTP_FROM_EMAIL,
        to: recipient.email,
        subject: personalizedSubject,
        html: personalizedBody
      });
      
      results.success++;
    } catch (error: any) {
      results.failed++;
      results.failures.push({
        email: recipient.email,
        error: error.message
      });
    }
  }
  
  return results;
}

// Register the API routes
export function setupEmailRoutes(app: Express) {
  // Get email templates
  app.get('/api/admin/email/templates', requireAdmin, (req: Request, res: Response) => {
    res.json(emailTemplates);
  });
  
  // Get specific template
  app.get('/api/admin/email/templates/:id', requireAdmin, (req: Request, res: Response) => {
    const template = emailTemplates.find(t => t.id === req.params.id);
    if (!template) {
      return res.status(404).json({ message: 'Template not found' });
    }
    res.json(template);
  });
  
  // Get email recipients based on filters
  app.get('/api/admin/email/recipients', requireAdmin, async (req: Request, res: Response) => {
    try {
      const eventId = req.query.eventId ? Number(req.query.eventId) : undefined;
      if (!eventId) {
        return res.status(400).json({ message: 'Event ID is required' });
      }
      
      const audienceType = req.query.audienceType as string || 'all';
      const additionalFilters = {
        registrationStatus: req.query.registrationStatus as string,
        productType: req.query.productType as string
      };
      
      const recipients = await getRecipients(eventId, audienceType, additionalFilters);
      
      res.json({
        count: recipients.length,
        recipients: recipients.map(r => ({
          userId: r.userId,
          email: r.email,
          name: r.firstName && r.lastName ? `${r.firstName} ${r.lastName}` : r.username
        }))
      });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });
  
  // Send emails
  app.post('/api/admin/email/send', requireAdmin, async (req: Request, res: Response) => {
    try {
      const { subject, body, eventId, audienceType, additionalFilters, individualizeContent } = req.body;
      
      if (!subject || !body) {
        return res.status(400).json({ message: 'Subject and body are required' });
      }
      
      if (!eventId) {
        return res.status(400).json({ message: 'Event ID is required' });
      }
      
      const recipients = await getRecipients(eventId, audienceType || 'all', additionalFilters || {});
      
      if (recipients.length === 0) {
        return res.status(400).json({ message: 'No recipients found matching the criteria' });
      }
      
      const results = await sendBulkEmail(
        subject,
        body,
        recipients,
        eventId,
        individualizeContent
      );
      
      res.json({
        success: results.success,
        failed: results.failed,
        failures: results.failures,
        totalRecipients: recipients.length
      });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });
  
  // Test email sending
  app.post('/api/admin/email/test', requireAdmin, async (req: Request, res: Response) => {
    try {
      const { recipient, subject, body } = req.body;
      
      if (!recipient || !subject || !body) {
        return res.status(400).json({ message: 'Recipient, subject, and body are required' });
      }
      
      // Send test email
      await transporter.sendMail({
        from: process.env.SMTP_FROM_EMAIL,
        to: recipient,
        subject,
        html: body
      });
      
      res.json({ success: true, message: 'Test email sent successfully' });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });
}

// Middleware to verify admin status
function requireAdmin(req: Request, res: Response, next: Function) {
  if (!req.isAuthenticated() || !req.user) {
    return res.status(401).json({ message: 'Unauthorized' });
  }
  
  if (req.user.role !== 'admin' && req.user.role !== 'super_admin') {
    return res.status(403).json({ message: 'Forbidden' });
  }
  
  next();
}

// Export the email service functions
export const emailService = {
  getTemplates: () => emailTemplates,
  getTemplateById: (id: string) => emailTemplates.find(t => t.id === id),
  getRecipients,
  sendBulkEmail
};