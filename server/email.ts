import type { Express, Request, Response } from "express";
import nodemailer from "nodemailer";
import { storage } from "./storage";
import { log } from "./vite";

// Define the email template interface
interface EmailTemplate {
  id: string;
  name: string;
  subject: string;
  body: string;
  description: string;
  audience: 'all' | 'tickets' | 'vendors' | 'volunteers' | 'custom';
}

// Pre-defined email templates
const emailTemplates: EmailTemplate[] = [
  {
    id: 'event-reminder',
    name: 'Event Reminder',
    subject: 'Your Event is Coming Up: {{eventName}}',
    body: `<p>Hello {{recipientName}},</p>
<p>This is a friendly reminder that the event <strong>{{eventName}}</strong> is coming up on <strong>{{eventDate}}</strong> at <strong>{{eventLocation}}</strong>.</p>
<p>We're looking forward to seeing you there!</p>
<p>Best regards,<br>The {{organizationName}} Team</p>`,
    description: 'Send reminders to ticket holders about upcoming events',
    audience: 'tickets'
  },
  {
    id: 'vendor-confirmation',
    name: 'Vendor Registration Confirmation',
    subject: 'Your Vendor Application for {{eventName}} Has Been Approved',
    body: `<p>Hello {{recipientName}},</p>
<p>We're pleased to inform you that your vendor application for <strong>{{eventName}}</strong> has been approved!</p>
<p>Event Details:</p>
<ul>
  <li>Date: {{eventDate}}</li>
  <li>Location: {{eventLocation}}</li>
  <li>Your Booth Number: {{boothNumber}}</li>
  <li>Setup Time: {{setupTime}}</li>
</ul>
<p>Please review the vendor guidelines attached to this email.</p>
<p>If you have any questions, please don't hesitate to contact us.</p>
<p>Best regards,<br>The {{organizationName}} Team</p>`,
    description: 'Send confirmation to approved vendors',
    audience: 'vendors'
  },
  {
    id: 'volunteer-assignment',
    name: 'Volunteer Assignment Notification',
    subject: 'Your Volunteer Assignment for {{eventName}}',
    body: `<p>Hello {{recipientName}},</p>
<p>Thank you for volunteering for <strong>{{eventName}}</strong>! We appreciate your willingness to help make this event a success.</p>
<p>Your volunteer assignment details:</p>
<ul>
  <li>Role: {{volunteerRole}}</li>
  <li>Date: {{shiftDate}}</li>
  <li>Time: {{shiftTime}}</li>
  <li>Location: {{eventLocation}}</li>
  <li>Supervisor: {{supervisorName}}</li>
</ul>
<p>Please arrive 15 minutes before your shift begins for a brief orientation.</p>
<p>If you have any questions or need to make changes to your assignment, please contact us as soon as possible.</p>
<p>Best regards,<br>The {{organizationName}} Team</p>`,
    description: 'Notify volunteers of their assignments',
    audience: 'volunteers'
  },
  {
    id: 'event-cancellation',
    name: 'Event Cancellation Notice',
    subject: 'Important Notice: {{eventName}} Has Been Cancelled',
    body: `<p>Hello {{recipientName}},</p>
<p>We regret to inform you that <strong>{{eventName}}</strong> scheduled for <strong>{{eventDate}}</strong> has been cancelled due to unforeseen circumstances.</p>
<p>If you purchased tickets for this event, a refund will be processed automatically within 5-7 business days.</p>
<p>We sincerely apologize for any inconvenience this may cause and appreciate your understanding.</p>
<p>Best regards,<br>The {{organizationName}} Team</p>`,
    description: 'Notify all participants about event cancellations',
    audience: 'all'
  },
  {
    id: 'custom-announcement',
    name: 'Custom Announcement',
    subject: '{{subject}}',
    body: `<p>Hello {{recipientName}},</p>
<p>{{messageContent}}</p>
<p>Best regards,<br>The {{organizationName}} Team</p>`,
    description: 'Custom announcement template for general communications',
    audience: 'custom'
  }
];

// Function to replace placeholders in email templates
function replaceTemplatePlaceholders(template: string, replacements: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (match, key) => {
    return replacements[key] || match;
  });
}

// Function to get recipients based on audience type and filters
async function getRecipients(
  audience: string,
  eventId?: number,
  customFilters?: {
    role?: string;
    status?: string;
    registrationType?: string;
  }
): Promise<Array<{ userId: number; email: string; name: string }>> {
  try {
    const recipients: Array<{ userId: number; email: string; name: string }> = [];
    
    // Get all users
    if (audience === 'all' && eventId) {
      // Get all users related to an event (ticket holders, vendors, volunteers)
      const tickets = await storage.getTicketsByEvent(eventId);
      const vendorRegs = await storage.getVendorRegistrations({ eventId, status: 'approved' });
      const volunteerAssignments = await storage.getVolunteerAssignments({ eventId, status: 'approved' });
      
      // Collect unique users from tickets
      for (const ticket of tickets) {
        const user = await storage.getUser(ticket.userId);
        if (user && user.email) {
          const existing = recipients.find(r => r.userId === user.id);
          if (!existing) {
            recipients.push({
              userId: user.id,
              email: user.email,
              name: user.name || user.username
            });
          }
        }
      }
      
      // Collect unique users from vendor registrations
      for (const reg of vendorRegs) {
        const vendorProfile = await storage.getVendorProfile(reg.vendorProfileId);
        if (vendorProfile) {
          const user = await storage.getUser(vendorProfile.userId);
          if (user && user.email) {
            const existing = recipients.find(r => r.userId === user.id);
            if (!existing) {
              recipients.push({
                userId: user.id,
                email: user.email,
                name: user.name || user.username
              });
            }
          }
        }
      }
      
      // Collect unique users from volunteer assignments
      for (const assignment of volunteerAssignments) {
        const volunteerProfile = await storage.getVolunteerProfile(assignment.volunteerProfileId);
        if (volunteerProfile) {
          const user = await storage.getUser(volunteerProfile.userId);
          if (user && user.email) {
            const existing = recipients.find(r => r.userId === user.id);
            if (!existing) {
              recipients.push({
                userId: user.id,
                email: user.email,
                name: user.name || user.username
              });
            }
          }
        }
      }
    } 
    // Get ticket holders for a specific event
    else if (audience === 'tickets' && eventId) {
      const tickets = await storage.getTicketsByEvent(eventId);
      
      for (const ticket of tickets) {
        const user = await storage.getUser(ticket.userId);
        if (user && user.email) {
          const existing = recipients.find(r => r.userId === user.id);
          if (!existing) {
            recipients.push({
              userId: user.id,
              email: user.email,
              name: user.name || user.username
            });
          }
        }
      }
    } 
    // Get vendors for a specific event
    else if (audience === 'vendors' && eventId) {
      const vendorRegs = await storage.getVendorRegistrations({ 
        eventId, 
        status: customFilters?.status || 'approved' 
      });
      
      for (const reg of vendorRegs) {
        const vendorProfile = await storage.getVendorProfile(reg.vendorProfileId);
        if (vendorProfile) {
          const user = await storage.getUser(vendorProfile.userId);
          if (user && user.email) {
            const existing = recipients.find(r => r.userId === user.id);
            if (!existing) {
              recipients.push({
                userId: user.id,
                email: user.email,
                name: user.name || user.username
              });
            }
          }
        }
      }
    } 
    // Get volunteers for a specific event
    else if (audience === 'volunteers' && eventId) {
      const volunteerAssignments = await storage.getVolunteerAssignments({ 
        eventId, 
        status: customFilters?.status || 'approved' 
      });
      
      for (const assignment of volunteerAssignments) {
        const volunteerProfile = await storage.getVolunteerProfile(assignment.volunteerProfileId);
        if (volunteerProfile) {
          const user = await storage.getUser(volunteerProfile.userId);
          if (user && user.email) {
            const existing = recipients.find(r => r.userId === user.id);
            if (!existing) {
              recipients.push({
                userId: user.id,
                email: user.email,
                name: user.name || user.username
              });
            }
          }
        }
      }
    } 
    // Get users by role (for system-wide announcements)
    else if (audience === 'custom' && customFilters?.role) {
      const allUsers = await storage.getAllUsers();
      const filteredUsers = allUsers.filter(user => {
        if (customFilters.role === 'all') return true;
        return user.role === customFilters.role;
      });
      
      for (const user of filteredUsers) {
        if (user.email) {
          recipients.push({
            userId: user.id,
            email: user.email,
            name: user.name || user.username
          });
        }
      }
    }
    
    return recipients;
  } catch (error) {
    console.error('Error getting email recipients:', error);
    return [];
  }
}

// Function to send emails in bulk to recipients
async function sendBulkEmail(
  subject: string,
  htmlContent: string,
  recipients: Array<{ email: string; name: string }>,
  testMode: boolean = false
): Promise<{ 
  success: boolean; 
  sent: number; 
  errors: Array<{ email: string; error: string }>;
  systemError?: string;
}> {
  try {
    // Check for SMTP settings - they're absolutely required
    if (!process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASSWORD) {
      log('ERROR: Missing SMTP configuration - cannot send emails', 'email');
      return {
        success: false,
        sent: 0,
        errors: recipients.map(r => ({ email: r.email, error: 'Missing SMTP configuration' })),
        systemError: 'SMTP configuration missing. Cannot send emails without proper settings.'
      };
    }
    
    // Make sure we have recipients
    if (!recipients || recipients.length === 0) {
      return {
        success: false,
        sent: 0,
        errors: [],
        systemError: 'No recipients provided'
      };
    }
    
    // Limit recipients count in test mode
    const targetRecipients = testMode 
      ? recipients.slice(0, 1)  // Only send to the first recipient in test mode
      : recipients;
    
    // Connect to mail.events.mosspointmainstreet.org mail server
    process.env.SMTP_HOST = 'mail.events.mosspointmainstreet.org';
    log(`Connecting to SMTP server: ${process.env.SMTP_HOST}:${process.env.SMTP_PORT}`, 'email');
    
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: process.env.SMTP_PORT === '465', // true for port 465, false for others
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASSWORD,
      },
      tls: {
        // Do not fail on invalid certs
        rejectUnauthorized: false
      },
      // Longer timeouts for slower servers
      connectionTimeout: 10000,  // 10 seconds connection timeout
      greetingTimeout: 10000,    // 10 seconds for SMTP greeting
      socketTimeout: 15000       // 15 seconds socket timeout
    });
    
    // This log is now redundant as we're logging above with the actual host used
    
    // Track successful and failed emails
    let finalSent = 0;
    const finalErrors: Array<{ email: string; error: string }> = [];
    
    // For each recipient, attempt to send the email
    for (const recipient of targetRecipients) {
      try {
        // Send the email
        const info = await transporter.sendMail({
          from: `"Moss Point Main Street" <${process.env.SMTP_FROM_EMAIL || 'info@mosspointmainstreet.org'}>`,
          to: recipient.email,
          subject: subject,
          html: htmlContent,
        });
        
        log(`Email sent to ${recipient.email}: ${info.messageId}`, 'email');
        finalSent++;
      } catch (error: any) {
        log(`Failed to send email to ${recipient.email}: ${error.message}`, 'email');
        finalErrors.push({ 
          email: recipient.email, 
          error: error.message || 'Unknown error'
        });
      }
    }
    
    // If we get here, return the success/error counts
    return {
      success: finalErrors.length === 0 && finalSent > 0,
      sent: finalSent,
      errors: finalErrors,
      systemError: finalErrors.length > 0 ? "Some emails failed to send. Please check SMTP settings." : undefined
    };
  } catch (error: any) {
    log(`Critical error in email sending: ${error.message}`, 'email');
    return {
      success: false,
      sent: 0,
      errors: [],
      systemError: `Critical error: ${error.message}`
    };
  }
}



// Set up email notification routes for the API
export function setupEmailRoutes(app: Express) {
  // Middleware to check if user is admin
  function requireAdmin(req: Request, res: Response, next: Function) {
    if (!req.isAuthenticated() || req.user.role !== "admin") {
      return res.status(403).json({ message: "Admin access required" });
    }
    next();
  }
  
  // Get all email templates
  app.get('/api/admin/email/templates', requireAdmin, (req: Request, res: Response) => {
    res.json(emailTemplates);
  });
  
  // Get a specific email template by ID
  app.get('/api/admin/email/templates/:id', requireAdmin, (req: Request, res: Response) => {
    const template = emailTemplates.find(t => t.id === req.params.id);
    
    if (!template) {
      return res.status(404).json({ message: "Email template not found" });
    }
    
    res.json(template);
  });
  
  // Get potential recipients for an email based on audience and filters
  app.get('/api/admin/email/recipients', requireAdmin, async (req: Request, res: Response) => {
    try {
      const { audience, eventId, role, status } = req.query;
      
      const recipients = await getRecipients(
        audience as string,
        eventId ? parseInt(eventId as string) : undefined,
        {
          role: role as string,
          status: status as string,
        }
      );
      
      res.json({
        count: recipients.length,
        recipients: recipients.map(r => ({
          email: r.email,
          name: r.name
        }))
      });
    } catch (error: any) {
      res.status(500).json({ message: error.message || "Failed to retrieve recipients" });
    }
  });
  
  // Get email preview content without sending
  app.post('/api/admin/email/preview', requireAdmin, async (req: Request, res: Response) => {
    try {
      const { 
        templateId, 
        eventId, 
        audience,
        subject,
        customMessage,
        replacements,
      } = req.body;
      
      // Find the template
      let template = emailTemplates.find(t => t.id === templateId);
      
      if (!template) {
        return res.status(404).json({ message: "Email template not found" });
      }
      
      // Get event details if eventId is provided
      let eventDetails = null;
      if (eventId) {
        eventDetails = await storage.getEvent(parseInt(eventId));
        if (!eventDetails) {
          return res.status(404).json({ message: "Event not found" });
        }
      }
      
      // Create standard replacements with organization info
      const standardReplacements: Record<string, string> = {
        organizationName: "Moss Point Main Street",
        organizationEmail: process.env.SMTP_FROM_EMAIL || "info@mosspointmainstreet.org",
        organizationPhone: "(228) 219-1713",
        organizationWebsite: "https://mosspointmainstreet.org",
        applicationUrl: "https://events.mosspointmainstreet.org",
        currentYear: new Date().getFullYear().toString(),
        recipientName: "Sample Recipient",
        ...replacements
      };
      
      // Add event details to replacements if available
      if (eventDetails) {
        standardReplacements.eventName = eventDetails.title;
        standardReplacements.eventDate = new Date(eventDetails.startDate).toLocaleDateString();
        standardReplacements.eventLocation = eventDetails.location;
      }
      
      // If it's a custom message template, use the provided subject and message
      let finalSubject = template.subject;
      let finalBody = template.body;
      
      if (template.id === 'custom-announcement' || customMessage) {
        finalSubject = subject || template.subject;
        
        // If there's a custom message, replace the messageContent placeholder
        if (customMessage) {
          standardReplacements.messageContent = customMessage;
          standardReplacements.subject = subject || '';
        }
      }
      
      // Replace placeholders in the subject and body
      const processedSubject = replaceTemplatePlaceholders(finalSubject, standardReplacements);
      const processedBody = replaceTemplatePlaceholders(finalBody, standardReplacements);
      
      // Return the preview content
      res.json({
        success: true,
        subject: processedSubject,
        html: processedBody
      });
      
    } catch (error: any) {
      console.error("Email preview error:", error);
      res.status(500).json({ message: error.message || "Failed to generate email preview" });
    }
  });
  
  // Send bulk email to recipients
  app.post('/api/admin/email/send', requireAdmin, async (req: Request, res: Response) => {
    try {
      const { 
        templateId, 
        eventId, 
        audience,
        subject,
        customMessage,
        replacements,
        customRecipients,
        role,
        status
      } = req.body;
      
      // Find the template
      let template = emailTemplates.find(t => t.id === templateId);
      
      if (!template) {
        return res.status(404).json({ message: "Email template not found" });
      }
      
      // Get event details if eventId is provided
      let eventDetails = null;
      if (eventId) {
        eventDetails = await storage.getEvent(parseInt(eventId));
        if (!eventDetails) {
          return res.status(404).json({ message: "Event not found" });
        }
      }
      
      // Get recipients
      let recipients: Array<{ userId: number; email: string; name: string }> = [];
      
      // If custom recipients are provided, use them
      if (customRecipients && Array.isArray(customRecipients) && customRecipients.length > 0) {
        recipients = customRecipients.map(r => ({
          userId: r.userId || 0,
          email: r.email,
          name: r.name || r.email.split('@')[0]
        }));
      } else {
        // Otherwise get recipients based on audience and filters
        recipients = await getRecipients(
          audience || template.audience,
          eventId ? parseInt(eventId) : undefined,
          {
            role: role,
            status: status,
          }
        );
      }
      
      if (recipients.length === 0) {
        return res.status(400).json({ message: "No recipients found matching the criteria" });
      }
      
      // Create standard replacements with organization info
      const standardReplacements: Record<string, string> = {
        organizationName: "Moss Point Main Street",
        organizationEmail: process.env.SMTP_FROM_EMAIL || "info@mosspointmainstreet.org",
        organizationPhone: "(228) 219-1713",
        organizationWebsite: "https://mosspointmainstreet.org",
        applicationUrl: "https://events.mosspointmainstreet.org",
        currentYear: new Date().getFullYear().toString(),
        ...replacements
      };
      
      // Add event details to replacements if available
      if (eventDetails) {
        standardReplacements.eventName = eventDetails.title;
        standardReplacements.eventDate = new Date(eventDetails.startDate).toLocaleDateString();
        standardReplacements.eventLocation = eventDetails.location;
      }
      
      // If it's a custom message template, use the provided subject and message
      let finalSubject = template.subject;
      let finalBody = template.body;
      
      if (template.id === 'custom-announcement' || customMessage) {
        finalSubject = subject || template.subject;
        
        // If there's a custom message, replace the messageContent placeholder
        if (customMessage) {
          standardReplacements.messageContent = customMessage;
          standardReplacements.subject = subject || '';
        }
      }
      
      // Replace placeholders in the subject
      const processedSubject = replaceTemplatePlaceholders(finalSubject, standardReplacements);
      
      // Send the email to all recipients
      const result = await sendBulkEmail(
        processedSubject,
        replaceTemplatePlaceholders(finalBody, standardReplacements),
        recipients.map(r => ({ email: r.email, name: r.name }))
      );
      
      // Return the result
      res.json({
        success: result.success,
        message: `Email sent to ${result.sent} recipients.`,
        errors: result.errors,
        totalRecipients: recipients.length
      });
    } catch (error: any) {
      console.error("Email sending error:", error);
      res.status(500).json({ message: error.message || "Failed to send email" });
    }
  });
  
  // Test email to a single recipient (admin only)
  app.post('/api/admin/email/test', requireAdmin, async (req: Request, res: Response) => {
    try {
      const { 
        templateId, 
        eventId, 
        subject,
        customMessage,
        replacements,
        testEmail
      } = req.body;
      
      // Validate test email
      if (!testEmail) {
        return res.status(400).json({ message: "Test email address is required" });
      }
      
      // Find the template
      let template = emailTemplates.find(t => t.id === templateId);
      
      if (!template) {
        return res.status(404).json({ message: "Email template not found" });
      }
      
      // Get event details if eventId is provided
      let eventDetails = null;
      if (eventId) {
        eventDetails = await storage.getEvent(parseInt(eventId));
        if (!eventDetails) {
          return res.status(404).json({ message: "Event not found" });
        }
      }
      
      // Create standard replacements with organization info
      const standardReplacements: Record<string, string> = {
        organizationName: "Moss Point Main Street",
        organizationEmail: process.env.SMTP_FROM_EMAIL || "info@mosspointmainstreet.org",
        organizationPhone: "(228) 219-1713",
        organizationWebsite: "https://mosspointmainstreet.org",
        applicationUrl: "https://events.mosspointmainstreet.org", 
        currentYear: new Date().getFullYear().toString(),
        recipientName: "Test Recipient",
        ...replacements
      };
      
      // Add event details to replacements if available
      if (eventDetails) {
        standardReplacements.eventName = eventDetails.title;
        standardReplacements.eventDate = new Date(eventDetails.startDate).toLocaleDateString();
        standardReplacements.eventLocation = eventDetails.location;
      }
      
      // If it's a custom message template, use the provided subject and message
      let finalSubject = template.subject;
      let finalBody = template.body;
      
      if (template.id === 'custom-announcement' || customMessage) {
        finalSubject = subject || template.subject;
        
        // If there's a custom message, replace the messageContent placeholder
        if (customMessage) {
          standardReplacements.messageContent = customMessage;
          standardReplacements.subject = subject || '';
        }
      }
      
      // Replace placeholders in the subject
      const processedSubject = replaceTemplatePlaceholders(finalSubject, standardReplacements);
      
      // Add [TEST] prefix to subject
      const testSubject = `[TEST] ${processedSubject}`;
      
      // Send the test email
      const result = await sendBulkEmail(
        testSubject,
        replaceTemplatePlaceholders(finalBody, standardReplacements),
        [{ email: testEmail, name: "Test Recipient" }],
        true // Test mode
      );
      
      // Return the result
      res.json({
        success: result.success,
        message: result.success 
          ? `Test email sent to ${testEmail}` 
          : `Failed to send test email: ${result.errors[0]?.error}`,
        errors: result.errors
      });
    } catch (error: any) {
      console.error("Test email error:", error);
      res.status(500).json({ message: error.message || "Failed to send test email" });
    }
  });
}

// Export the email service for use in other modules
export const emailService = {
  getTemplates: () => emailTemplates,
  getTemplate: (id: string) => emailTemplates.find(t => t.id === id),
  getRecipients,
  sendBulkEmail,
  replaceTemplatePlaceholders
};