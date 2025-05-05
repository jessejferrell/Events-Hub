import { useState, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { queryClient } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, Send, CheckCircle, AlertCircle, Users, Mail } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';

// Define interface for email templates
interface EmailTemplate {
  id: string;
  name: string;
  subject: string;
  body: string;
  description: string;
  audience: 'all' | 'tickets' | 'vendors' | 'volunteers' | 'custom';
}

// Define interface for recipients
interface Recipient {
  userId: number;
  email: string;
  name: string;
}

// Define interface for events
interface Event {
  id: number;
  title: string;
  startDate: string;
  endDate: string;
  location: string;
}

// Define form validation schema
const emailFormSchema = z.object({
  templateId: z.string({
    required_error: "Please select a template.",
  }),
  eventId: z.string().optional(),
  audience: z.string().optional(),
  subject: z.string().optional(),
  customMessage: z.string().optional(),
  testEmail: z.string().email("Please enter a valid email address").optional(),
  role: z.string().optional(),
  status: z.string().optional(),
});

// Define form values type
type EmailFormValues = z.infer<typeof emailFormSchema>;

export default function EmailNotificationsPage() {
  const [activeTab, setActiveTab] = useState<string>('compose');
  const [selectedTemplate, setSelectedTemplate] = useState<EmailTemplate | null>(null);
  const [isPreviewMode, setIsPreviewMode] = useState<boolean>(false);
  const [previewSubject, setPreviewSubject] = useState<string>('');
  const [previewContent, setPreviewContent] = useState<string>('');
  const [recipientCount, setRecipientCount] = useState<number>(0);
  const { toast } = useToast();

  // Form definition using react-hook-form
  const form = useForm<EmailFormValues>({
    resolver: zodResolver(emailFormSchema),
    defaultValues: {
      templateId: '',
      eventId: '',
      audience: '',
      subject: '',
      customMessage: '',
      testEmail: '',
      role: '',
      status: '',
    },
  });

  // Query to fetch email templates
  const { data: templates, isLoading: isLoadingTemplates } = useQuery<EmailTemplate[]>({
    queryKey: ['/api/admin/email/templates'],
    queryFn: async () => {
      const res = await fetch('/api/admin/email/templates');
      if (!res.ok) throw new Error('Failed to fetch email templates');
      return res.json();
    },
  });

  // Query to fetch events
  const { data: events, isLoading: isLoadingEvents } = useQuery<Event[]>({
    queryKey: ['/api/events'],
    queryFn: async () => {
      const res = await fetch('/api/events');
      if (!res.ok) throw new Error('Failed to fetch events');
      return res.json();
    },
  });

  // Query to fetch recipients count based on form values
  const { refetch: refetchRecipients, isLoading: isLoadingRecipients } = useQuery<{ count: number; recipients: any[] }>({
    queryKey: ['/api/admin/email/recipients', form.watch('eventId'), form.watch('audience'), form.watch('role'), form.watch('status')],
    queryFn: async () => {
      const eventId = form.getValues('eventId');
      const audience = form.getValues('audience') || (selectedTemplate?.audience || 'all');
      const role = form.getValues('role');
      const status = form.getValues('status');

      if (!eventId && audience !== 'custom') {
        return { count: 0, recipients: [] };
      }

      const queryParams = new URLSearchParams();
      if (eventId) queryParams.append('eventId', eventId);
      if (audience) queryParams.append('audience', audience);
      if (role) queryParams.append('role', role);
      if (status) queryParams.append('status', status);

      const res = await fetch(`/api/admin/email/recipients?${queryParams.toString()}`);
      if (!res.ok) throw new Error('Failed to fetch recipients');
      return res.json();
    },
    enabled: false,
  });

  // Mutation to send test email
  const testEmailMutation = useMutation({
    mutationFn: async (data: EmailFormValues) => {
      const res = await fetch('/api/admin/email/test', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });
      
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.message || 'Failed to send test email');
      }
      
      return res.json();
    },
    onSuccess: () => {
      toast({
        title: 'Test Email Sent',
        description: 'The test email was sent successfully.',
        variant: 'default',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  // Mutation to send email
  const sendEmailMutation = useMutation({
    mutationFn: async (data: EmailFormValues) => {
      const res = await fetch('/api/admin/email/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });
      
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.message || 'Failed to send email');
      }
      
      return res.json();
    },
    onSuccess: (data) => {
      toast({
        title: 'Email Sent',
        description: `Successfully sent to ${data.sent} recipients.`,
        variant: 'default',
      });
      form.reset();
      setSelectedTemplate(null);
      setIsPreviewMode(false);
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  // Handle form submission
  const onSubmit = (data: EmailFormValues) => {
    sendEmailMutation.mutate(data);
  };

  // Handle test email
  const handleTestEmail = () => {
    const values = form.getValues();
    if (!values.testEmail) {
      toast({
        title: 'Error',
        description: 'Please enter a test email address',
        variant: 'destructive',
      });
      return;
    }
    testEmailMutation.mutate(values);
  };

  // Update selected template when templateId changes
  useEffect(() => {
    const templateId = form.watch('templateId');
    if (templateId && templates) {
      const template = templates.find(t => t.id === templateId) || null;
      setSelectedTemplate(template);
      
      // Set audience based on template if not already set
      if (template && !form.getValues('audience')) {
        form.setValue('audience', template.audience);
      }
      
      // If it's a custom template, make the subject editable
      if (template && template.id === 'custom-announcement') {
        form.setValue('subject', 'Custom Announcement');
      }
    } else {
      setSelectedTemplate(null);
    }
  }, [form.watch('templateId'), templates]);

  // Update recipient count when relevant form fields change
  useEffect(() => {
    const subscription = form.watch((value, { name }) => {
      if (['eventId', 'audience', 'role', 'status'].includes(name as string)) {
        refetchRecipients().then((result) => {
          if (result.data) {
            setRecipientCount(result.data.count);
          }
        });
      }
    });
    
    return () => subscription.unsubscribe();
  }, [form.watch, refetchRecipients]);

  // Generate preview content
  const generatePreview = () => {
    if (!selectedTemplate) return;
    
    // Get event details
    const eventId = form.getValues('eventId');
    const selectedEvent = events?.find(e => e.id.toString() === eventId);
    
    // Define replacements
    const replacements: Record<string, string> = {
      recipientName: 'John Doe',
      organizationName: 'City Event Hub',
      eventName: selectedEvent?.title || 'Sample Event',
      eventDate: selectedEvent ? new Date(selectedEvent.startDate).toLocaleDateString() : 'January 1, 2023',
      eventLocation: selectedEvent?.location || 'Downtown Convention Center',
      boothNumber: 'A-12',
      setupTime: '8:00 AM',
      volunteerRole: 'Registration Desk Assistant',
      shiftDate: selectedEvent ? new Date(selectedEvent.startDate).toLocaleDateString() : 'January 1, 2023',
      shiftTime: '9:00 AM - 12:00 PM',
      supervisorName: 'Jane Smith',
    };
    
    // Replace custom message content if provided
    const customMessage = form.getValues('customMessage');
    if (customMessage) {
      replacements.messageContent = customMessage;
    }
    
    // Replace custom subject if provided
    const subject = form.getValues('subject');
    if (subject) {
      replacements.subject = subject;
    }
    
    // Replace placeholders in subject
    let previewSubjectText = selectedTemplate.subject;
    previewSubjectText = previewSubjectText.replace(/\{\{(\w+)\}\}/g, (match, key) => {
      return replacements[key] || match;
    });
    
    // Replace placeholders in body
    let previewBodyText = selectedTemplate.body;
    previewBodyText = previewBodyText.replace(/\{\{(\w+)\}\}/g, (match, key) => {
      return replacements[key] || match;
    });
    
    setPreviewSubject(previewSubjectText);
    setPreviewContent(previewBodyText);
    setIsPreviewMode(true);
  };

  return (
    <div className="container mx-auto py-8">
      <header className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Email Notifications</h1>
        <p className="text-muted-foreground">
          Send targeted emails to event participants and users
        </p>
      </header>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-2 mb-8">
          <TabsTrigger value="compose">
            <Mail className="h-4 w-4 mr-2" />
            Compose Email
          </TabsTrigger>
          <TabsTrigger value="history">
            <CheckCircle className="h-4 w-4 mr-2" />
            Sent History
          </TabsTrigger>
        </TabsList>

        <TabsContent value="compose" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Email composition form */}
            <div className="md:col-span-2">
              <Card>
                <CardHeader>
                  <CardTitle>Compose Email</CardTitle>
                  <CardDescription>
                    Create and send emails to event participants
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {isPreviewMode ? (
                    <div className="space-y-4">
                      <div className="pb-4 border-b">
                        <Button 
                          variant="outline" 
                          onClick={() => setIsPreviewMode(false)}
                          className="mb-4"
                        >
                          Back to Edit
                        </Button>
                        <div className="bg-muted p-4 rounded-md">
                          <h3 className="font-semibold text-lg mb-2">Subject: {previewSubject}</h3>
                          <Separator className="my-2" />
                          <div className="mt-2 prose prose-sm max-w-none" dangerouslySetInnerHTML={{ __html: previewContent }} />
                        </div>
                      </div>
                      
                      <div className="flex justify-between items-center">
                        <div>
                          <span className="text-sm text-muted-foreground">Recipients: </span>
                          <Badge variant="secondary" className="ml-2">
                            <Users className="h-3 w-3 mr-1" />
                            {recipientCount}
                          </Badge>
                        </div>
                        <div className="space-x-2">
                          <Button 
                            variant="outline" 
                            disabled={!form.getValues('testEmail')}
                            onClick={handleTestEmail}
                          >
                            {testEmailMutation.isPending ? (
                              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            ) : "Send Test"}
                          </Button>
                          <Button 
                            type="button" 
                            onClick={() => onSubmit(form.getValues())}
                            disabled={sendEmailMutation.isPending || recipientCount === 0}
                          >
                            {sendEmailMutation.isPending ? (
                              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            ) : (
                              <Send className="h-4 w-4 mr-2" />
                            )}
                            Send Email
                          </Button>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <Form {...form}>
                      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                        <FormField
                          control={form.control}
                          name="templateId"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Email Template</FormLabel>
                              <Select
                                onValueChange={field.onChange}
                                defaultValue={field.value}
                              >
                                <FormControl>
                                  <SelectTrigger>
                                    <SelectValue placeholder="Select a template" />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  {isLoadingTemplates ? (
                                    <div className="flex items-center justify-center p-4">
                                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                                      Loading templates...
                                    </div>
                                  ) : (
                                    templates?.map((template) => (
                                      <SelectItem key={template.id} value={template.id}>
                                        {template.name}
                                      </SelectItem>
                                    ))
                                  )}
                                </SelectContent>
                              </Select>
                              <FormDescription>
                                {selectedTemplate?.description || "Choose a template for your email"}
                              </FormDescription>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        {selectedTemplate && (
                          <>
                            <FormField
                              control={form.control}
                              name="eventId"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Event</FormLabel>
                                  <Select
                                    onValueChange={field.onChange}
                                    defaultValue={field.value}
                                  >
                                    <FormControl>
                                      <SelectTrigger>
                                        <SelectValue placeholder="Select an event" />
                                      </SelectTrigger>
                                    </FormControl>
                                    <SelectContent>
                                      {isLoadingEvents ? (
                                        <div className="flex items-center justify-center p-4">
                                          <Loader2 className="h-4 w-4 animate-spin mr-2" />
                                          Loading events...
                                        </div>
                                      ) : (
                                        events?.map((event) => (
                                          <SelectItem key={event.id} value={event.id.toString()}>
                                            {event.title}
                                          </SelectItem>
                                        ))
                                      )}
                                    </SelectContent>
                                  </Select>
                                  <FormDescription>
                                    Select the event related to this email
                                  </FormDescription>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />

                            <FormField
                              control={form.control}
                              name="audience"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Recipient Group</FormLabel>
                                  <Select
                                    onValueChange={field.onChange}
                                    defaultValue={field.value || selectedTemplate.audience}
                                  >
                                    <FormControl>
                                      <SelectTrigger>
                                        <SelectValue placeholder="Select audience" />
                                      </SelectTrigger>
                                    </FormControl>
                                    <SelectContent>
                                      <SelectItem value="all">All Event Participants</SelectItem>
                                      <SelectItem value="tickets">Ticket Holders</SelectItem>
                                      <SelectItem value="vendors">Vendors</SelectItem>
                                      <SelectItem value="volunteers">Volunteers</SelectItem>
                                      <SelectItem value="custom">Custom Selection</SelectItem>
                                    </SelectContent>
                                  </Select>
                                  <FormDescription>
                                    Choose which group of people will receive this email
                                  </FormDescription>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />

                            {form.watch('audience') === 'custom' && (
                              <FormField
                                control={form.control}
                                name="role"
                                render={({ field }) => (
                                  <FormItem>
                                    <FormLabel>User Role</FormLabel>
                                    <Select
                                      onValueChange={field.onChange}
                                      defaultValue={field.value}
                                    >
                                      <FormControl>
                                        <SelectTrigger>
                                          <SelectValue placeholder="Select user role" />
                                        </SelectTrigger>
                                      </FormControl>
                                      <SelectContent>
                                        <SelectItem value="all">All Users</SelectItem>
                                        <SelectItem value="admin">Administrators</SelectItem>
                                        <SelectItem value="event_owner">Event Organizers</SelectItem>
                                        <SelectItem value="user">Regular Users</SelectItem>
                                      </SelectContent>
                                    </Select>
                                    <FormDescription>
                                      Filter recipients by their role
                                    </FormDescription>
                                    <FormMessage />
                                  </FormItem>
                                )}
                              />
                            )}

                            {['vendors', 'volunteers'].includes(form.watch('audience') || '') && (
                              <FormField
                                control={form.control}
                                name="status"
                                render={({ field }) => (
                                  <FormItem>
                                    <FormLabel>Registration Status</FormLabel>
                                    <Select
                                      onValueChange={field.onChange}
                                      defaultValue={field.value || 'approved'}
                                    >
                                      <FormControl>
                                        <SelectTrigger>
                                          <SelectValue placeholder="Select status" />
                                        </SelectTrigger>
                                      </FormControl>
                                      <SelectContent>
                                        <SelectItem value="all">All Statuses</SelectItem>
                                        <SelectItem value="pending">Pending</SelectItem>
                                        <SelectItem value="approved">Approved</SelectItem>
                                        <SelectItem value="rejected">Rejected</SelectItem>
                                      </SelectContent>
                                    </Select>
                                    <FormDescription>
                                      Filter recipients by their registration status
                                    </FormDescription>
                                    <FormMessage />
                                  </FormItem>
                                )}
                              />
                            )}

                            {selectedTemplate.id === 'custom-announcement' && (
                              <FormField
                                control={form.control}
                                name="subject"
                                render={({ field }) => (
                                  <FormItem>
                                    <FormLabel>Email Subject</FormLabel>
                                    <FormControl>
                                      <Input placeholder="Enter email subject" {...field} />
                                    </FormControl>
                                    <FormMessage />
                                  </FormItem>
                                )}
                              />
                            )}

                            {(selectedTemplate.id === 'custom-announcement' || selectedTemplate.audience === 'custom') && (
                              <FormField
                                control={form.control}
                                name="customMessage"
                                render={({ field }) => (
                                  <FormItem>
                                    <FormLabel>Message Content</FormLabel>
                                    <FormControl>
                                      <Textarea
                                        placeholder="Enter your message here"
                                        className="min-h-[200px]"
                                        {...field}
                                      />
                                    </FormControl>
                                    <FormDescription>
                                      This will replace the {"{{messageContent}}"} placeholder in the template
                                    </FormDescription>
                                    <FormMessage />
                                  </FormItem>
                                )}
                              />
                            )}

                            <FormField
                              control={form.control}
                              name="testEmail"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Test Email Address</FormLabel>
                                  <FormControl>
                                    <Input placeholder="your@email.com" {...field} />
                                  </FormControl>
                                  <FormDescription>
                                    Enter an email address to send a test email
                                  </FormDescription>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />

                            <div className="flex justify-between pt-4">
                              <Button
                                type="button"
                                variant="outline"
                                onClick={() => form.reset()}
                              >
                                Clear Form
                              </Button>
                              <div className="space-x-2">
                                <Button
                                  type="button"
                                  variant="secondary"
                                  onClick={generatePreview}
                                  disabled={!form.getValues('templateId')}
                                >
                                  Preview
                                </Button>
                              </div>
                            </div>
                          </>
                        )}
                      </form>
                    </Form>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Help and information panel */}
            <div className="md:col-span-1">
              <Card>
                <CardHeader>
                  <CardTitle>Information</CardTitle>
                  <CardDescription>
                    Tips and guidelines for sending emails
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <Alert>
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>Recipient Count</AlertTitle>
                    <AlertDescription>
                      Currently selected: <Badge variant="outline">{recipientCount}</Badge> recipients
                    </AlertDescription>
                  </Alert>
                  
                  <Accordion type="single" collapsible className="w-full">
                    <AccordionItem value="templates">
                      <AccordionTrigger>Email Templates</AccordionTrigger>
                      <AccordionContent>
                        <p className="text-sm text-muted-foreground mb-2">
                          Choose from pre-defined templates for common communications:
                        </p>
                        <ul className="text-sm space-y-2">
                          <li><Badge variant="outline">Event Reminder</Badge> - Remind ticket holders about upcoming events</li>
                          <li><Badge variant="outline">Vendor Confirmation</Badge> - Confirm vendor registrations</li>
                          <li><Badge variant="outline">Volunteer Assignment</Badge> - Notify volunteers of their assignments</li>
                          <li><Badge variant="outline">Event Cancellation</Badge> - Inform all participants about cancellations</li>
                          <li><Badge variant="outline">Custom Announcement</Badge> - Create a custom message</li>
                        </ul>
                      </AccordionContent>
                    </AccordionItem>
                    
                    <AccordionItem value="placeholders">
                      <AccordionTrigger>Template Placeholders</AccordionTrigger>
                      <AccordionContent>
                        <p className="text-sm text-muted-foreground mb-2">
                          You can use these placeholders in your templates:
                        </p>
                        <ul className="text-sm space-y-1">
                          <li><Badge variant="outline">{"{{recipientName}}"}</Badge> - Recipient's name</li>
                          <li><Badge variant="outline">{"{{eventName}}"}</Badge> - Event name</li>
                          <li><Badge variant="outline">{"{{eventDate}}"}</Badge> - Event date</li>
                          <li><Badge variant="outline">{"{{eventLocation}}"}</Badge> - Event location</li>
                          <li><Badge variant="outline">{"{{organizationName}}"}</Badge> - Your organization name</li>
                        </ul>
                      </AccordionContent>
                    </AccordionItem>
                    
                    <AccordionItem value="best-practices">
                      <AccordionTrigger>Email Best Practices</AccordionTrigger>
                      <AccordionContent>
                        <ul className="text-sm space-y-2">
                          <li>Always send a test email before sending to all recipients</li>
                          <li>Use clear and concise subject lines</li>
                          <li>Include essential information in the first paragraph</li>
                          <li>Check recipient count before sending</li>
                          <li>Avoid sending too many emails in a short period</li>
                        </ul>
                      </AccordionContent>
                    </AccordionItem>
                  </Accordion>
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="history">
          <Card>
            <CardHeader>
              <CardTitle>Email History</CardTitle>
              <CardDescription>
                Record of previously sent email campaigns
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8">
                <Mail className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium mb-2">Email History Coming Soon</h3>
                <p className="text-muted-foreground">
                  This feature is under development and will be available in a future update.
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}