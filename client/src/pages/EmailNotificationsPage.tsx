import React, { useState, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Navbar } from '@/components/Navbar';
import { Footer } from '@/components/Footer';
import { useToast } from '@/hooks/use-toast';
import { apiRequest, queryClient } from '@/lib/queryClient';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
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
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import {
  CheckCircle,
  Trash,
  Edit,
  Copy,
  Send,
  Mail,
  Users,
  FileText,
  AlertCircle,
  Search,
  Filter,
  RefreshCw,
  Clock,
  CheckCircle2, 
  X
} from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useAuth } from '@/hooks/use-auth';

// Define types
interface EmailTemplate {
  id: string;
  name: string;
  subject: string;
  body: string;
  description: string;
  audience: 'all' | 'tickets' | 'vendors' | 'volunteers' | 'custom';
}

interface Recipient {
  userId: number;
  email: string;
  name: string;
}

interface Event {
  id: number;
  title: string;
  startDate: string;
  endDate: string;
  location: string;
}

// Email sending form schema
const emailFormSchema = z.object({
  eventId: z.string().min(1, 'Please select an event'),
  templateId: z.string().optional(),
  subject: z.string().min(1, 'Subject is required'),
  body: z.string().min(1, 'Email content is required'),
  audienceType: z.string().min(1, 'Please select an audience'),
  individualizeContent: z.boolean().default(true),
  testEmail: z.string().email('Invalid email address').optional(),
});

type EmailFormValues = z.infer<typeof emailFormSchema>;

export default function EmailNotificationsPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [selectedEvent, setSelectedEvent] = useState<string>('');
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('');
  const [selectedAudience, setSelectedAudience] = useState<string>('all');
  const [showRecipientPreview, setShowRecipientPreview] = useState(false);
  const [filteredStatus, setFilteredStatus] = useState<string>('approved');
  const [previewHtml, setPreviewHtml] = useState<string>('');

  // Form handling
  const form = useForm<EmailFormValues>({
    resolver: zodResolver(emailFormSchema),
    defaultValues: {
      eventId: '',
      templateId: '',
      subject: '',
      body: '',
      audienceType: 'all',
      individualizeContent: true,
      testEmail: user?.email || '',
    },
  });

  // Fetch events
  const { 
    data: events,
    isLoading: isLoadingEvents
  } = useQuery<Event[]>({
    queryKey: ['/api/events'],
    queryFn: async () => {
      const res = await apiRequest('GET', '/api/events');
      return res.json();
    },
  });

  // Fetch email templates
  const {
    data: templates,
    isLoading: isLoadingTemplates
  } = useQuery<EmailTemplate[]>({
    queryKey: ['/api/admin/email/templates'],
    queryFn: async () => {
      const res = await apiRequest('GET', '/api/admin/email/templates');
      return res.json();
    },
  });

  // Fetch recipients
  const {
    data: recipients,
    isLoading: isLoadingRecipients,
    refetch: refetchRecipients
  } = useQuery<{ count: number; recipients: Recipient[] }>({
    queryKey: ['/api/admin/email/recipients', selectedEvent, selectedAudience, filteredStatus],
    queryFn: async () => {
      if (!selectedEvent) return { count: 0, recipients: [] };
      const res = await apiRequest('GET', `/api/admin/email/recipients?eventId=${selectedEvent}&audienceType=${selectedAudience}&registrationStatus=${filteredStatus}`);
      return res.json();
    },
    enabled: !!selectedEvent && showRecipientPreview,
  });

  // Send test email
  const sendTestMutation = useMutation({
    mutationFn: async (data: { recipient: string; subject: string; body: string }) => {
      const res = await apiRequest('POST', '/api/admin/email/test', data);
      return res.json();
    },
    onSuccess: () => {
      toast({
        title: 'Test email sent',
        description: 'Check your inbox to see how your email will look',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Failed to send test email',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  // Send bulk email
  const sendEmailMutation = useMutation({
    mutationFn: async (data: EmailFormValues) => {
      const payload = {
        subject: data.subject,
        body: data.body,
        eventId: Number(data.eventId),
        audienceType: data.audienceType,
        additionalFilters: {
          registrationStatus: filteredStatus
        },
        individualizeContent: data.individualizeContent
      };
      const res = await apiRequest('POST', '/api/admin/email/send', payload);
      return res.json();
    },
    onSuccess: (data) => {
      toast({
        title: 'Emails sent successfully',
        description: `${data.success} emails sent, ${data.failed} failed`,
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Failed to send emails',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  // Update form values when template is selected
  useEffect(() => {
    if (selectedTemplateId && templates) {
      const template = templates.find(t => t.id === selectedTemplateId);
      if (template) {
        form.setValue('subject', template.subject);
        form.setValue('body', template.body);
        form.setValue('audienceType', template.audience);
        setSelectedAudience(template.audience);
        setPreviewHtml(template.body);
      }
    }
  }, [selectedTemplateId, templates, form]);

  // Handle form submission
  const onSubmit = (data: EmailFormValues) => {
    sendEmailMutation.mutate(data);
  };

  // Handle test email
  const handleSendTest = () => {
    const subject = form.getValues('subject');
    const body = form.getValues('body');
    const testEmail = form.getValues('testEmail');
    
    if (!testEmail) {
      toast({
        title: 'Test email required',
        description: 'Please enter a valid email address to send a test to',
        variant: 'destructive',
      });
      return;
    }
    
    sendTestMutation.mutate({
      recipient: testEmail,
      subject,
      body
    });
  };

  // Update preview when form changes
  const handleEmailContentChange = (content: string) => {
    form.setValue('body', content);
    setPreviewHtml(content);
  };

  // Toggle recipient preview
  const toggleRecipientPreview = () => {
    setShowRecipientPreview(!showRecipientPreview);
    if (!showRecipientPreview && selectedEvent) {
      refetchRecipients();
    }
  };

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      
      <main className="flex-grow container mx-auto px-4 py-6">
        <div className="mb-6">
          <h1 className="text-2xl font-bold flex items-center">
            <Mail className="h-6 w-6 mr-2" />
            Email Notifications
          </h1>
          <p className="text-muted-foreground mt-1">
            Send targeted emails to event participants
          </p>
        </div>
        
        <Tabs defaultValue="compose">
          <TabsList className="mb-4">
            <TabsTrigger value="compose" className="flex items-center">
              <FileText className="h-4 w-4 mr-2" />
              Compose Email
            </TabsTrigger>
            <TabsTrigger value="templates" className="flex items-center">
              <Copy className="h-4 w-4 mr-2" />
              Email Templates
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="compose">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Compose Form */}
              <Card className="md:col-span-2">
                <CardHeader>
                  <CardTitle>Compose Email</CardTitle>
                  <CardDescription>
                    Create and send emails to your event participants
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <FormField
                          control={form.control}
                          name="eventId"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Select Event</FormLabel>
                              <Select 
                                onValueChange={(value) => {
                                  field.onChange(value);
                                  setSelectedEvent(value);
                                }} 
                                defaultValue={field.value}
                              >
                                <FormControl>
                                  <SelectTrigger>
                                    <SelectValue placeholder="Select an event" />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  {events?.map((event) => (
                                    <SelectItem key={event.id} value={event.id.toString()}>
                                      {event.title}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        
                        <FormField
                          control={form.control}
                          name="templateId"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Email Template</FormLabel>
                              <Select 
                                onValueChange={(value) => {
                                  field.onChange(value);
                                  setSelectedTemplateId(value);
                                }} 
                                defaultValue={field.value}
                              >
                                <FormControl>
                                  <SelectTrigger>
                                    <SelectValue placeholder="Select a template or start from scratch" />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  <SelectItem value="">Start from scratch</SelectItem>
                                  {templates?.map((template) => (
                                    <SelectItem key={template.id} value={template.id}>
                                      {template.name}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                      
                      <FormField
                        control={form.control}
                        name="audienceType"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Recipient Group</FormLabel>
                            <Select 
                              onValueChange={(value) => {
                                field.onChange(value);
                                setSelectedAudience(value);
                              }} 
                              defaultValue={field.value}
                            >
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Select recipient group" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="all">All Participants</SelectItem>
                                <SelectItem value="tickets">Ticket Holders Only</SelectItem>
                                <SelectItem value="vendors">Vendors Only</SelectItem>
                                <SelectItem value="volunteers">Volunteers Only</SelectItem>
                              </SelectContent>
                            </Select>
                            <FormDescription>
                              Choose who should receive this email
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      
                      {selectedAudience !== 'all' && (
                        <div className="flex items-center space-x-4">
                          <Label className="text-sm font-medium">Filter by Status:</Label>
                          <Select
                            value={filteredStatus}
                            onValueChange={setFilteredStatus}
                          >
                            <SelectTrigger className="w-40">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="all">All Statuses</SelectItem>
                              <SelectItem value="pending">Pending</SelectItem>
                              <SelectItem value="approved">Approved</SelectItem>
                              <SelectItem value="rejected">Rejected</SelectItem>
                            </SelectContent>
                          </Select>
                          
                          <Button 
                            type="button" 
                            variant="outline" 
                            onClick={toggleRecipientPreview}
                            className="ml-auto"
                            size="sm"
                          >
                            <Users className="h-4 w-4 mr-2" />
                            {showRecipientPreview ? 'Hide Recipients' : 'Preview Recipients'}
                          </Button>
                        </div>
                      )}
                      
                      {showRecipientPreview && (
                        <div className="border rounded-md p-4 mt-2 bg-muted/30">
                          <div className="flex justify-between items-center mb-2">
                            <h3 className="text-sm font-medium">Recipients Preview</h3>
                            <Badge variant="outline" className="font-normal">
                              {isLoadingRecipients ? (
                                <span className="flex items-center">
                                  <RefreshCw className="h-3 w-3 mr-1 animate-spin" />
                                  Loading...
                                </span>
                              ) : (
                                <span>{recipients?.count || 0} recipients</span>
                              )}
                            </Badge>
                          </div>
                          
                          {recipients?.recipients && recipients.recipients.length > 0 ? (
                            <ScrollArea className="h-24 rounded-md border">
                              <div className="p-4">
                                {recipients.recipients.map((recipient) => (
                                  <div key={recipient.userId} className="text-sm py-1 flex justify-between">
                                    <span>{recipient.name}</span>
                                    <span className="text-muted-foreground">{recipient.email}</span>
                                  </div>
                                ))}
                              </div>
                            </ScrollArea>
                          ) : !isLoadingRecipients && (
                            <div className="flex flex-col items-center justify-center h-24 text-muted-foreground">
                              <Users className="h-8 w-8 mb-2 opacity-30" />
                              <p className="text-sm">No recipients found with the selected criteria</p>
                            </div>
                          )}
                        </div>
                      )}
                      
                      <FormField
                        control={form.control}
                        name="subject"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Email Subject</FormLabel>
                            <FormControl>
                              <Input placeholder="Enter email subject" {...field} />
                            </FormControl>
                            <FormDescription>
                              Use {{eventName}} and other template variables if needed
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      
                      <FormField
                        control={form.control}
                        name="body"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Email Content</FormLabel>
                            <FormControl>
                              <Textarea 
                                placeholder="Enter your email content here. HTML is supported."
                                className="min-h-32 font-mono text-sm"
                                value={field.value}
                                onChange={(e) => handleEmailContentChange(e.target.value)}
                              />
                            </FormControl>
                            <FormDescription>
                              You can use HTML and template variables like {{recipientName}}, {{eventName}}, etc.
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      
                      <FormField
                        control={form.control}
                        name="individualizeContent"
                        render={({ field }) => (
                          <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
                            <FormControl>
                              <Checkbox
                                checked={field.value}
                                onCheckedChange={field.onChange}
                              />
                            </FormControl>
                            <div className="space-y-1 leading-none">
                              <FormLabel>Personalize emails</FormLabel>
                              <FormDescription>
                                Replace template variables with recipient-specific information
                              </FormDescription>
                            </div>
                          </FormItem>
                        )}
                      />

                      <Separator />
                      
                      <FormField
                        control={form.control}
                        name="testEmail"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Test Email Address</FormLabel>
                            <div className="flex space-x-2">
                              <FormControl>
                                <Input placeholder="Enter email for testing" {...field} />
                              </FormControl>
                              <Button 
                                type="button" 
                                variant="secondary"
                                onClick={handleSendTest}
                                disabled={sendTestMutation.isPending}
                              >
                                {sendTestMutation.isPending ? (
                                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                                ) : (
                                  <Send className="h-4 w-4 mr-2" />
                                )}
                                Send Test
                              </Button>
                            </div>
                            <FormDescription>
                              Send a test email to verify how it will look
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <div className="flex justify-between items-center pt-4">
                        <div className="text-sm text-muted-foreground">
                          {selectedEvent && recipients ? (
                            <span className="flex items-center">
                              <Users className="h-4 w-4 mr-1" />
                              {recipients.count} recipients selected
                            </span>
                          ) : (
                            <span className="flex items-center">
                              <AlertCircle className="h-4 w-4 mr-1" />
                              Select an event to see recipient count
                            </span>
                          )}
                        </div>
                        
                        <Button 
                          type="submit" 
                          disabled={sendEmailMutation.isPending || !selectedEvent || (recipients && recipients.count === 0)}
                          className="bg-primary"
                        >
                          {sendEmailMutation.isPending ? (
                            <>
                              <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                              Sending...
                            </>
                          ) : (
                            <>
                              <Send className="h-4 w-4 mr-2" />
                              Send Email
                            </>
                          )}
                        </Button>
                      </div>
                    </form>
                  </Form>
                </CardContent>
              </Card>
              
              {/* Preview & Help Card */}
              <Card>
                <CardHeader>
                  <CardTitle>Email Preview</CardTitle>
                  <CardDescription>
                    Preview how your email will look
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="border rounded-md mx-4 overflow-hidden">
                    <div className="bg-slate-100 px-4 py-2 border-b">
                      <div className="text-sm font-medium truncate">
                        {form.watch('subject') || 'Email Subject'}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        From: {process.env.SMTP_FROM_EMAIL || 'events@mosspointmainstreet.org'}
                      </div>
                    </div>
                    <div className="p-4 bg-white max-h-[500px] overflow-auto">
                      {previewHtml ? (
                        <div dangerouslySetInnerHTML={{ __html: previewHtml }} />
                      ) : (
                        <div className="text-muted-foreground text-center py-8">
                          Email preview will appear here
                        </div>
                      )}
                    </div>
                  </div>
                </CardContent>
                <CardFooter className="flex flex-col items-start">
                  <p className="text-sm font-medium mb-2">Available Template Variables:</p>
                  <div className="text-sm text-muted-foreground space-y-1">
                    <p><code>{'{{recipientName}}'}</code> - Recipient's full name</p>
                    <p><code>{'{{eventName}}'}</code> - Event title</p>
                    <p><code>{'{{eventDate}}'}</code> - Event date</p>
                    <p><code>{'{{eventTime}}'}</code> - Event time</p>
                    <p><code>{'{{eventLocation}}'}</code> - Event location</p>
                  </div>
                </CardFooter>
              </Card>
            </div>
          </TabsContent>
          
          <TabsContent value="templates">
            <div className="grid grid-cols-1 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>Email Templates</CardTitle>
                  <CardDescription>
                    Pre-designed email templates for common scenarios
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {isLoadingTemplates ? (
                    <div className="py-8 flex justify-center">
                      <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full"></div>
                    </div>
                  ) : (
                    <Accordion type="single" collapsible className="w-full">
                      {templates?.map((template) => (
                        <AccordionItem key={template.id} value={template.id}>
                          <AccordionTrigger className="hover:no-underline">
                            <div className="flex items-center">
                              <span>{template.name}</span>
                              <Badge className="ml-2" variant="outline">
                                {template.audience === 'all' ? 'All' : 
                                 template.audience === 'tickets' ? 'Tickets' : 
                                 template.audience === 'vendors' ? 'Vendors' : 
                                 'Volunteers'}
                              </Badge>
                            </div>
                          </AccordionTrigger>
                          <AccordionContent>
                            <div className="space-y-4">
                              <p className="text-sm text-muted-foreground">{template.description}</p>
                              <div className="grid grid-cols-1 gap-4">
                                <div>
                                  <Label className="text-xs text-muted-foreground">Subject</Label>
                                  <div className="text-sm border rounded-md p-2 bg-muted/20 mt-1">
                                    {template.subject}
                                  </div>
                                </div>
                                <div>
                                  <Label className="text-xs text-muted-foreground">Content Preview</Label>
                                  <div className="text-sm border rounded-md p-2 bg-muted/20 mt-1 h-24 overflow-y-auto">
                                    <div dangerouslySetInnerHTML={{ __html: template.body }} />
                                  </div>
                                </div>
                              </div>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  setSelectedTemplateId(template.id);
                                  form.setValue('templateId', template.id);
                                  form.setValue('subject', template.subject);
                                  form.setValue('body', template.body);
                                  form.setValue('audienceType', template.audience);
                                  setSelectedAudience(template.audience);
                                }}
                              >
                                <Copy className="h-4 w-4 mr-2" />
                                Use This Template
                              </Button>
                            </div>
                          </AccordionContent>
                        </AccordionItem>
                      ))}
                    </Accordion>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </main>
      
      <Footer />
    </div>
  );
}