import React, { useState, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';

// Icons
import {
  Mail,
  Send,
  CheckCircle,
  User,
  Users,
  Calendar,
  Store,
  Heart,
  FileText,
  ChevronRight,
  Clock,
  AlertCircle,
  Loader2,
  Eye,
  ArrowLeft,
  ArchiveIcon,
  UserCog,
  Ticket,
  Info,
  Edit,
} from 'lucide-react';

// UI Components
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
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Switch } from '@/components/ui/switch';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

// Interfaces
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

// Email history entry
interface EmailHistoryEntry {
  id: string;
  date: string;
  subject: string;
  recipients: number;
  audience: string;
  status: 'sent' | 'failed' | 'pending';
}

// Validation schema
const emailFormSchema = z.object({
  templateId: z.string({
    required_error: "Please select an email template",
  }),
  eventId: z.number().optional(),
  audience: z.string({
    required_error: "Please select an audience",
  }),
  subject: z.string().min(5, {
    message: "Subject must be at least 5 characters long",
  }),
  customMessage: z.string().optional(),
  role: z.string().optional(),
  status: z.string().optional(),
  testEmail: z.string().email("Please enter a valid email address").optional(),
});

type EmailFormValues = z.infer<typeof emailFormSchema>;

// Get appropriate icon for each template type
const getTemplateIcon = (templateId: string) => {
  const iconMap: Record<string, JSX.Element> = {
    'event-reminder': <Calendar className="h-10 w-10 text-blue-500" />,
    'vendor-confirmation': <Store className="h-10 w-10 text-indigo-500" />,
    'volunteer-assignment': <Heart className="h-10 w-10 text-rose-500" />,
    'event-cancellation': <AlertCircle className="h-10 w-10 text-amber-500" />,
    'custom-announcement': <FileText className="h-10 w-10 text-emerald-500" />,
    'fully-custom': <Edit className="h-10 w-10 text-purple-500" />,
  };
  
  return iconMap[templateId] || <Mail className="h-10 w-10 text-primary" />;
};

// Get appropriate icon for each audience type
const getAudienceIcon = (audience: string) => {
  const iconMap: Record<string, JSX.Element> = {
    'all': <Users className="h-5 w-5 text-slate-600" />,
    'tickets': <Ticket className="h-5 w-5 text-emerald-500" />,
    'vendors': <Store className="h-5 w-5 text-indigo-500" />,
    'volunteers': <Heart className="h-5 w-5 text-rose-500" />,
    'custom': <UserCog className="h-5 w-5 text-amber-500" />,
  };
  
  return iconMap[audience] || <Users className="h-5 w-5" />;
};

// Get audience name from key
const getAudienceName = (audience: string) => {
  const audienceMap: Record<string, string> = {
    'all': 'All Participants',
    'tickets': 'Ticket Holders',
    'vendors': 'Vendors',
    'volunteers': 'Volunteers',
    'custom': 'Custom Group',
  };
  
  return audienceMap[audience] || 'Unknown';
};

// Email history data will be fetched from the server eventually
// For now, we just show an empty state
const emailHistory: EmailHistoryEntry[] = [];

export default function EmailNotificationsPage() {
  // State variables
  const [selectedTemplate, setSelectedTemplate] = useState<EmailTemplate | null>(null);
  const [previewHtml, setPreviewHtml] = useState<string>('');
  const [previewSubject, setPreviewSubject] = useState<string>('');
  const [recipientCount, setRecipientCount] = useState<number>(0);
  const [currentStep, setCurrentStep] = useState<number>(1);
  const [isSendingTest, setIsSendingTest] = useState<boolean>(false);
  const [isShowingPreview, setIsShowingPreview] = useState<boolean>(false);
  const [placeholderValues, setPlaceholderValues] = useState<Record<string, string>>({});
  const { toast } = useToast();

  // Initialize form
  const form = useForm<EmailFormValues>({
    resolver: zodResolver(emailFormSchema),
    defaultValues: {
      templateId: '',
      audience: '',
      subject: '',
      customMessage: '',
      testEmail: '',
    },
  });

  // Watch form values
  const watchedTemplateId = form.watch('templateId');
  const watchedEventId = form.watch('eventId');
  const watchedAudience = form.watch('audience');
  const watchedSubject = form.watch('subject');
  const watchedCustomMessage = form.watch('customMessage');
  const watchedRole = form.watch('role');
  const watchedStatus = form.watch('status');

  // Fetch email templates
  const { data: templates = [], isLoading: isLoadingTemplates } = useQuery({
    queryKey: ['/api/admin/email/templates'],
    queryFn: async () => {
      const res = await fetch('/api/admin/email/templates');
      if (!res.ok) throw new Error('Failed to fetch templates');
      return res.json();
    },
  });

  // Fetch events
  const { data: events = [], isLoading: isLoadingEvents } = useQuery({
    queryKey: ['/api/events'],
    queryFn: async () => {
      const res = await fetch('/api/events');
      if (!res.ok) throw new Error('Failed to fetch events');
      return res.json();
    },
  });

  // Update selected template when template ID changes
  useEffect(() => {
    if (watchedTemplateId && templates.length > 0) {
      const template = templates.find((t: EmailTemplate) => t.id === watchedTemplateId);
      if (template) {
        setSelectedTemplate(template);
        form.setValue('subject', template.subject);
        form.setValue('audience', template.audience);
        
        // Don't auto-advance anymore to allow going back and forth between steps
      } else {
        setSelectedTemplate(null);
      }
    }
  }, [watchedTemplateId, templates, form]);

  // Fetch recipients count when relevant form fields change
  useEffect(() => {
    const fetchRecipients = async () => {
      try {
        if (!watchedAudience) return;
        
        const params = new URLSearchParams();
        params.append('audience', watchedAudience);
        
        if (watchedEventId) {
          params.append('eventId', watchedEventId.toString());
        }
        
        if (watchedStatus) {
          params.append('status', watchedStatus);
        }
        
        if (watchedAudience === 'custom' && watchedRole) {
          params.append('role', watchedRole);
        }
        
        const response = await fetch(`/api/admin/email/recipients?${params.toString()}`);
        const data = await response.json();
        
        setRecipientCount(data.count || 0);
      } catch (error) {
        console.error('Error fetching recipients:', error);
        setRecipientCount(0);
      }
    };

    if (watchedAudience && (watchedAudience !== 'custom' || watchedRole)) {
      fetchRecipients();
    }
  }, [watchedEventId, watchedAudience, watchedRole, watchedStatus]);

  // Update preview whenever relevant fields change
  useEffect(() => {
    if (selectedTemplate && (watchedSubject || watchedCustomMessage || watchedEventId)) {
      clientSidePreview(); // Use client-side preview for live updates as typing
    }
  }, [watchedSubject, watchedCustomMessage, watchedEventId, selectedTemplate]);

  // Generate email preview using the server API
  const generatePreview = async () => {
    if (!selectedTemplate) return;
    
    try {
      const values = form.getValues();
      
      // Convert placeholder values to actual values for API
      if (typeof values.eventId === 'string' && values.eventId === 'any_event') {
        values.eventId = undefined;
      } else if (values.eventId && typeof values.eventId === 'string') {
        values.eventId = parseInt(values.eventId);
      }
      
      // Call the preview API endpoint
      const response = await apiRequest('POST', '/api/admin/email/preview', {
        templateId: values.templateId,
        eventId: values.eventId,
        audience: values.audience,
        subject: values.subject,
        customMessage: values.customMessage,
        replacements: {}
      });
      
      const previewData = await response.json();
      
      if (previewData.success) {
        setPreviewSubject(previewData.subject);
        setPreviewHtml(previewData.html);
      } else {
        // If there's an error, fall back to client-side preview
        clientSidePreview();
      }
      
    } catch (error) {
      console.error("Preview generation error:", error);
      // Fall back to client-side preview if the API call fails
      clientSidePreview();
    }
  };
  
  // Client-side preview generation as fallback
  const clientSidePreview = () => {
    if (!selectedTemplate) return;
    
    // Get the event details if any
    const selectedEvent = watchedEventId ? 
      events.find((e: Event) => e.id === watchedEventId) : null;
    
    // Create placeholder values with all possible placeholders
    const placeholders: Record<string, string> = {
      // Organization info
      organizationName: 'Moss Point Main Street',
      organizationEmail: 'info@mosspointmainstreet.org',
      organizationPhone: '(228) 219-1713',
      organizationWebsite: 'https://mosspointmainstreet.org',
      applicationUrl: 'https://events.mosspointmainstreet.org',
      currentYear: new Date().getFullYear().toString(),
      
      // Recipient info
      recipientName: 'Jane Doe',
      recipientEmail: 'recipient@example.com',
      firstName: 'Jane',
      lastName: 'Doe',
      
      // Custom message placeholder
      messageContent: watchedCustomMessage || 'No custom message provided.',
      subject: watchedSubject || 'Untitled Email',
      
      // Event info
      eventName: selectedEvent?.title || 'Sample Event',
      eventDate: selectedEvent ? new Date(selectedEvent.startDate).toLocaleDateString() : 'January 1, 2023',
      eventLocation: selectedEvent?.location || 'City Convention Center',
      eventDescription: selectedEvent?.description || 'Sample event description',
      eventStartTime: selectedEvent ? new Date(selectedEvent.startDate).toLocaleTimeString() : '10:00 AM',
      eventEndTime: selectedEvent ? new Date(selectedEvent.endDate).toLocaleTimeString() : '4:00 PM',
      
      // Ticket info
      ticketPrice: '$25.00',
      ticketType: 'General Admission',
      ticketQuantity: '2',
    };
    
    setPlaceholderValues(placeholders);
    
    // Replace placeholders in subject
    let subject = watchedSubject || selectedTemplate.subject;
    Object.entries(placeholders).forEach(([key, value]) => {
      subject = subject.replace(new RegExp(`{{${key}}}`, 'g'), value);
    });
    
    // Replace placeholders in body
    let html = selectedTemplate.body;
    Object.entries(placeholders).forEach(([key, value]) => {
      html = html.replace(new RegExp(`{{${key}}}`, 'g'), value);
    });
    
    setPreviewSubject(subject);
    setPreviewHtml(html);
  };

  // Send test email mutation
  const testEmailMutation = useMutation({
    mutationFn: async (data: EmailFormValues) => {
      setIsSendingTest(true);
      const res = await apiRequest('POST', '/api/admin/email/test', data);
      return await res.json();
    },
    onSuccess: (data) => {
      setIsSendingTest(false);
      toast({
        title: 'Test Email Sent',
        description: 'Check your inbox for the test email',
        variant: 'default',
      });
    },
    onError: (error: Error) => {
      setIsSendingTest(false);
      toast({
        title: 'Failed to Send Test',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  // Send email campaign mutation
  const sendEmailMutation = useMutation({
    mutationFn: async (data: EmailFormValues) => {
      const res = await apiRequest('POST', '/api/admin/email/send', data);
      return await res.json();
    },
    onSuccess: (data) => {
      toast({
        title: 'Email Campaign Sent',
        description: `Successfully sent to ${data.sent} recipients`,
        variant: 'default',
      });
      form.reset();
      setSelectedTemplate(null);
      setCurrentStep(1);
      setIsShowingPreview(false);
    },
    onError: (error: Error) => {
      toast({
        title: 'Failed to Send Campaign',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  // Send a test email
  const sendTestEmail = async () => {
    const testEmail = form.getValues('testEmail');
    
    if (!testEmail) {
      toast({
        title: 'Test Email Required',
        description: 'Please enter a valid email address for the test',
        variant: 'destructive',
      });
      return;
    }
    
    const values = form.getValues();
    // Convert placeholder values to actual values for API
    if (typeof values.eventId === 'string' && values.eventId === 'any_event') {
      values.eventId = undefined;
    } else if (values.eventId && typeof values.eventId === 'string') {
      values.eventId = parseInt(values.eventId);
    }
    
    if (values.status === 'any_status') {
      values.status = '';
    }
    
    try {
      const result = await testEmailMutation.mutateAsync(values);
      
      if (result.success) {
        toast({
          title: 'Test Email Sent',
          description: `Test email sent successfully to ${testEmail}`,
        });
      } else {
        toast({
          title: 'Test Email Failed',
          description: result.message || 'Unable to send test email. Please check SMTP settings.',
          variant: 'destructive',
        });
      }
    } catch (error: any) {
      toast({
        title: 'Test Email Failed',
        description: error.message || 'Unable to connect to email server. Please check SMTP settings.',
        variant: 'destructive',
      });
    }
  };

  // Preview and confirm before sending
  const previewEmail = async () => {
    await generatePreview();
    setIsShowingPreview(true);
  };

  // Send email to all recipients
  const confirmAndSendEmail = async () => {
    const values = form.getValues();
    
    // Convert placeholder values to actual values for API
    if (typeof values.eventId === 'string' && values.eventId === 'any_event') {
      values.eventId = undefined;
    } else if (values.eventId && typeof values.eventId === 'string') {
      values.eventId = parseInt(values.eventId);
    }
    
    if (values.status === 'any_status') {
      values.status = '';
    }
    
    await sendEmailMutation.mutateAsync(values);
  };
  
  // Handle form submission
  const onSubmit = async (data: EmailFormValues) => {
    if (currentStep < 3) {
      // Move to next step
      setCurrentStep(currentStep + 1);
    } else {
      // Preview email before sending
      await previewEmail();
    }
  };

  // Go back to previous step
  const goToPreviousStep = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  // Render the email wizard based on current step
  const renderEmailWizard = () => {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Email Composer</CardTitle>
              <CardDescription>Create and send emails to your event participants</CardDescription>
            </div>
            <div className="flex items-center space-x-1 text-sm text-muted-foreground">
              <div className={`flex items-center ${currentStep >= 1 ? 'text-primary font-medium' : ''}`}>
                <div className={`w-6 h-6 rounded-full flex items-center justify-center mr-2 ${
                  currentStep >= 1 ? 'bg-primary text-white' : 'bg-muted'
                }`}>
                  1
                </div>
                <span className="hidden sm:inline">Template</span>
              </div>
              <ChevronRight className="w-4 h-4 mx-1" />
              <div className={`flex items-center ${currentStep >= 2 ? 'text-primary font-medium' : ''}`}>
                <div className={`w-6 h-6 rounded-full flex items-center justify-center mr-2 ${
                  currentStep >= 2 ? 'bg-primary text-white' : 'bg-muted'
                }`}>
                  2
                </div>
                <span className="hidden sm:inline">Recipients</span>
              </div>
              <ChevronRight className="w-4 h-4 mx-1" />
              <div className={`flex items-center ${currentStep >= 3 ? 'text-primary font-medium' : ''}`}>
                <div className={`w-6 h-6 rounded-full flex items-center justify-center mr-2 ${
                  currentStep >= 3 ? 'bg-primary text-white' : 'bg-muted'
                }`}>
                  3
                </div>
                <span className="hidden sm:inline">Compose</span>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              {/* Step 1: Select Email Template */}
              {currentStep === 1 && (
                <div className="space-y-6">
                  <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                    {isLoadingTemplates ? (
                      <div className="col-span-full flex justify-center py-12">
                        <Loader2 className="h-8 w-8 animate-spin text-primary" />
                      </div>
                    ) : (
                      templates.map((template: EmailTemplate) => (
                        <div
                          key={template.id}
                          className={`relative rounded-lg border p-4 hover:border-primary cursor-pointer transition-all ${
                            watchedTemplateId === template.id
                              ? "border-primary bg-primary/5"
                              : ""
                          }`}
                          onClick={() => form.setValue("templateId", template.id)}
                        >
                          <div className="mb-3">{getTemplateIcon(template.id)}</div>
                          <h3 className="font-medium mb-1">{template.name}</h3>
                          <p className="text-sm text-muted-foreground">
                            {template.description}
                          </p>
                          {watchedTemplateId === template.id && (
                            <div className="absolute top-3 right-3 text-primary">
                              <CheckCircle className="h-5 w-5" />
                            </div>
                          )}
                        </div>
                      ))
                    )}
                  </div>

                  <div className="flex justify-end">
                    <Button
                      type="button"
                      onClick={() => setCurrentStep(2)}
                      disabled={!watchedTemplateId}
                    >
                      Continue to Recipients
                      <ChevronRight className="ml-2 h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}

              {/* Step 2: Select Recipients */}
              {currentStep === 2 && (
                <div className="space-y-6">
                  <div className="grid gap-6 sm:grid-cols-2">
                    {/* Audience Selection */}
                    <FormField
                      control={form.control}
                      name="audience"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Recipient Audience</FormLabel>
                          <Select
                            value={field.value}
                            onValueChange={field.onChange}
                          >
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select audience" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="all">All Participants</SelectItem>
                              <SelectItem value="tickets">Ticket Holders</SelectItem>
                              <SelectItem value="vendors">Vendors</SelectItem>
                              <SelectItem value="volunteers">Volunteers</SelectItem>
                              <SelectItem value="custom">Custom Group</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormDescription>
                            Choose who will receive this email
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    {/* Event Selection */}
                    <FormField
                      control={form.control}
                      name="eventId"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Related Event (Optional)</FormLabel>
                          <Select
                            value={field.value?.toString() || ''}
                            onValueChange={(value) => field.onChange(value ? parseInt(value) : undefined)}
                          >
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select event" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="any_event">Any Event</SelectItem>
                              {events.map((event: Event) => (
                                <SelectItem key={event.id} value={event.id.toString()}>
                                  {event.title}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormDescription>
                            Limit recipients to a specific event
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    {/* Custom filters when audience is "custom" */}
                    {watchedAudience === 'custom' && (
                      <>
                        <FormField
                          control={form.control}
                          name="role"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>User Role</FormLabel>
                              <Select
                                value={field.value || ''}
                                onValueChange={field.onChange}
                              >
                                <FormControl>
                                  <SelectTrigger>
                                    <SelectValue placeholder="Select role" />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  <SelectItem value="admin">Administrators</SelectItem>
                                  <SelectItem value="event_owner">Event Organizers</SelectItem>
                                  <SelectItem value="user">Regular Users</SelectItem>
                                </SelectContent>
                              </Select>
                              <FormDescription>
                                Filter by user role
                              </FormDescription>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </>
                    )}
                    
                    {/* Additional filters for tickets/vendors/volunteers */}
                    {['tickets', 'vendors', 'volunteers'].includes(watchedAudience) && (
                      <FormField
                        control={form.control}
                        name="status"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Status</FormLabel>
                            <Select
                              value={field.value || ''}
                              onValueChange={field.onChange}
                            >
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Any status" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="any_status">Any Status</SelectItem>
                                {watchedAudience === 'tickets' && (
                                  <>
                                    <SelectItem value="active">Active Tickets</SelectItem>
                                    <SelectItem value="used">Used Tickets</SelectItem>
                                    <SelectItem value="refunded">Refunded Tickets</SelectItem>
                                  </>
                                )}
                                {watchedAudience === 'vendors' && (
                                  <>
                                    <SelectItem value="pending">Pending Applications</SelectItem>
                                    <SelectItem value="approved">Approved Vendors</SelectItem>
                                    <SelectItem value="rejected">Rejected Applications</SelectItem>
                                  </>
                                )}
                                {watchedAudience === 'volunteers' && (
                                  <>
                                    <SelectItem value="pending">Pending Applications</SelectItem>
                                    <SelectItem value="scheduled">Scheduled Volunteers</SelectItem>
                                    <SelectItem value="completed">Completed Shifts</SelectItem>
                                  </>
                                )}
                              </SelectContent>
                            </Select>
                            <FormDescription>
                              Filter by {watchedAudience} status
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    )}
                  </div>

                  {recipientCount > 0 ? (
                    <Alert className="bg-green-50 text-green-800 border-green-200">
                      <CheckCircle className="h-4 w-4" />
                      <AlertTitle>Recipients Found</AlertTitle>
                      <AlertDescription>
                        This email will be sent to {recipientCount} {getAudienceName(watchedAudience).toLowerCase()}.
                      </AlertDescription>
                    </Alert>
                  ) : watchedAudience ? (
                    <Alert className="bg-amber-50 text-amber-800 border-amber-200">
                      <AlertCircle className="h-4 w-4" />
                      <AlertTitle>No Recipients Found</AlertTitle>
                      <AlertDescription>
                        No recipients match your selected criteria. Try adjusting your filters.
                      </AlertDescription>
                    </Alert>
                  ) : null}

                  <div className="flex justify-between">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={goToPreviousStep}
                    >
                      <ArrowLeft className="mr-2 h-4 w-4" />
                      Back to Templates
                    </Button>
                    <Button
                      type="button"
                      onClick={() => setCurrentStep(3)}
                      disabled={!watchedAudience || recipientCount === 0}
                    >
                      Continue to Compose
                      <ChevronRight className="ml-2 h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}

              {/* Step 3: Compose Email */}
              {currentStep === 3 && (
                <div className="space-y-6">
                  <div className="grid gap-6 sm:grid-cols-2">
                    <div className="sm:col-span-2">
                      <FormField
                        control={form.control}
                        name="subject"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Email Subject</FormLabel>
                            <FormControl>
                              <Input placeholder="Enter subject line" {...field} />
                            </FormControl>
                            <FormDescription>
                              An effective subject line improves open rates
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                    
                    <div className="sm:col-span-2">
                      <FormField
                        control={form.control}
                        name="customMessage"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Custom Message (Optional)</FormLabel>
                            <FormControl>
                              <Textarea 
                                placeholder="Add your personal message here..."
                                className="min-h-[150px]"
                                {...field}
                              />
                            </FormControl>
                            <FormDescription>
                              This text will replace the message content placeholder in the template
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                    
                    <Card className="sm:col-span-2 bg-slate-50 border">
                      <CardHeader className="pb-3">
                        <CardTitle className="text-lg">Available Placeholders</CardTitle>
                        <CardDescription>
                          These tags will be replaced with actual content
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
                          <div className="flex justify-between py-1 px-2 rounded bg-white">
                            <code className="text-pink-600">{'{{recipientName}}'}</code>
                            <span className="text-muted-foreground">Recipient's full name</span>
                          </div>
                          <div className="flex justify-between py-1 px-2 rounded bg-white">
                            <code className="text-pink-600">{'{{eventName}}'}</code>
                            <span className="text-muted-foreground">Event title</span>
                          </div>
                          <div className="flex justify-between py-1 px-2 rounded bg-white">
                            <code className="text-pink-600">{'{{eventDate}}'}</code>
                            <span className="text-muted-foreground">Event date</span>
                          </div>
                          <div className="flex justify-between py-1 px-2 rounded bg-white">
                            <code className="text-pink-600">{'{{eventLocation}}'}</code>
                            <span className="text-muted-foreground">Event venue</span>
                          </div>
                          <div className="flex justify-between py-1 px-2 rounded bg-white">
                            <code className="text-pink-600">{'{{organizationName}}'}</code>
                            <span className="text-muted-foreground">Your organization</span>
                          </div>
                          <div className="flex justify-between py-1 px-2 rounded bg-white">
                            <code className="text-pink-600">{'{{customMessage}}'}</code>
                            <span className="text-muted-foreground">Your custom message</span>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                    
                    <div className="sm:col-span-2">
                      <FormField
                        control={form.control}
                        name="testEmail"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Send Test Email (Optional)</FormLabel>
                            <div className="flex space-x-2">
                              <FormControl>
                                <Input type="email" placeholder="your@email.com" {...field} />
                              </FormControl>
                              <Button 
                                type="button" 
                                variant="outline" 
                                onClick={sendTestEmail}
                                disabled={isSendingTest || !field.value}
                              >
                                {isSendingTest ? (
                                  <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Sending...
                                  </>
                                ) : (
                                  <>
                                    Send Test
                                  </>
                                )}
                              </Button>
                              <Button
                                type="button"
                                variant="outline"
                                onClick={() => {
                                  generatePreview();
                                  setIsShowingPreview(true);
                                }}
                              >
                                <Eye className="mr-2 h-4 w-4" />
                                Preview
                              </Button>
                            </div>
                            <FormDescription>
                              Send yourself a test email to verify the content
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  </div>

                  <div className="flex justify-between">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={goToPreviousStep}
                    >
                      <ArrowLeft className="mr-2 h-4 w-4" />
                      Back to Recipients
                    </Button>
                    <Button
                      type="button"
                      onClick={previewEmail}
                      disabled={!watchedTemplateId || !watchedAudience || (recipientCount === 0 && watchedAudience !== 'custom')}
                    >
                      Preview Email
                      <Eye className="ml-2 h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </form>
          </Form>
        </CardContent>
      </Card>
    );
  };

  // Render sent history
  const renderSentHistory = () => {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Email History</CardTitle>
          <CardDescription>Track your previous email campaigns</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="border rounded-md overflow-hidden">
            {emailHistory.length === 0 ? (
              <div className="py-12 text-center">
                <Mail className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
                <h3 className="text-lg font-medium mb-1">No Email History</h3>
                <p className="text-muted-foreground">You haven't sent any emails yet</p>
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-muted">
                  <tr>
                    <th className="text-left p-3">Date</th>
                    <th className="text-left p-3">Subject</th>
                    <th className="text-left p-3">Audience</th>
                    <th className="text-left p-3">Recipients</th>
                    <th className="text-left p-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {emailHistory.map((email: EmailHistoryEntry) => (
                    <tr key={email.id} className="hover:bg-muted/50 transition-colors">
                      <td className="p-3">{email.date}</td>
                      <td className="p-3 max-w-[200px] truncate">{email.subject}</td>
                      <td className="p-3">
                        <div className="flex items-center">
                          {getAudienceIcon(email.audience)}
                          <span className="ml-2">{getAudienceName(email.audience)}</span>
                        </div>
                      </td>
                      <td className="p-3">{email.recipients}</td>
                      <td className="p-3">
                        <Badge variant={email.status === 'sent' ? 'default' : (email.status === 'pending' ? 'outline' : 'destructive')}>
                          {email.status}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <main className="flex-grow">
        <div className="container mx-auto py-6">
          <div className="flex justify-between items-center mb-6">
            <div>
              <h1 className="text-3xl font-bold mb-1">Email Campaigns</h1>
              <p className="text-muted-foreground">
                Create, send, and manage email campaigns to your event participants
              </p>
            </div>
            {recipientCount > 0 && (
              <Badge variant="secondary" className="text-base py-1 px-3">
                <Users className="mr-2 h-4 w-4" />
                {recipientCount} Recipients
              </Badge>
            )}
          </div>

          <Tabs defaultValue="compose" className="space-y-4">
            <TabsList className="grid w-full max-w-md grid-cols-2">
              <TabsTrigger value="compose" className="flex items-center">
                <Mail className="mr-2 h-4 w-4" />
                <span>Create Campaign</span>
              </TabsTrigger>
              <TabsTrigger value="history" className="flex items-center">
                <ArchiveIcon className="mr-2 h-4 w-4" />
                <span>Campaign History</span>
              </TabsTrigger>
            </TabsList>

            <TabsContent value="compose" className="space-y-4">
              {renderEmailWizard()}
            </TabsContent>

            <TabsContent value="history" className="space-y-4">
              {renderSentHistory()}
            </TabsContent>
          </Tabs>

          {/* Email Preview Modal */}
          {isShowingPreview && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 overflow-y-auto">
              <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
                <div className="p-6 border-b">
                  <div className="flex justify-between items-center mb-2">
                    <h2 className="text-2xl font-bold">Email Preview</h2>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="h-8 w-8 p-0" 
                      onClick={() => setIsShowingPreview(false)}
                    >
                      ✕
                    </Button>
                  </div>
                  <p className="text-muted-foreground">
                    Review how your email will appear to recipients
                  </p>
                </div>

                <div className="grid md:grid-cols-3 gap-6 p-6">
                  <div className="md:col-span-2">
                    <div className="border rounded-xl overflow-hidden">
                      <div className="bg-slate-50 p-4 border-b">
                        <div className="font-medium">Subject:</div>
                        <div className="text-lg">{previewSubject}</div>
                      </div>
                      <div className="bg-white p-6 prose max-w-none" dangerouslySetInnerHTML={{ __html: previewHtml }} />
                    </div>
                  </div>

                  <div>
                    <div className="bg-slate-50 rounded-xl border p-4 mb-4">
                      <h3 className="font-medium text-lg mb-4">Campaign Summary</h3>
                      <div className="space-y-4">
                        <div>
                          <div className="text-sm text-muted-foreground">Template</div>
                          <div className="font-medium">{selectedTemplate?.name}</div>
                        </div>
                        <div>
                          <div className="text-sm text-muted-foreground">Recipients</div>
                          <div className="font-medium">{recipientCount} {getAudienceName(watchedAudience).toLowerCase()}</div>
                        </div>
                        {watchedEventId && (
                          <div>
                            <div className="text-sm text-muted-foreground">Event</div>
                            <div className="font-medium">
                              {events.find((e: Event) => e.id === watchedEventId)?.title}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    <Alert className="bg-amber-50 text-amber-800 border-amber-200">
                      <AlertCircle className="h-4 w-4" />
                      <AlertTitle>Ready to Send?</AlertTitle>
                      <AlertDescription>
                        <p>This email will be sent to {recipientCount} recipients. 
                        This action cannot be undone.</p>
                        
                        <p className="mt-2 text-sm italic">
                          Note: Sending requires a valid SMTP connection. If you're just 
                          testing the system, you can view the email preview without sending.
                        </p>
                      </AlertDescription>
                    </Alert>

                    <div className="mt-4 flex flex-col space-y-2">
                      <Button 
                        variant="outline"
                        className="w-full" 
                        onClick={() => setIsShowingPreview(false)}
                      >
                        Back to Edit
                      </Button>
                      <Button 
                        className="w-full" 
                        onClick={async () => {
                          try {
                            await confirmAndSendEmail();
                            setIsShowingPreview(false);
                            toast({
                              title: 'Email Campaign Sent',
                              description: `Email sent successfully to ${recipientCount} recipients`,
                            });
                          } catch (error: any) {
                            toast({
                              title: 'Email Sending Failed',
                              description: error.message || 'Unable to connect to email server. Please check SMTP settings.',
                              variant: 'destructive',
                            });
                          }
                        }}
                        disabled={sendEmailMutation.isPending}
                      >
                        {sendEmailMutation.isPending ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Sending...
                          </>
                        ) : (
                          <>
                            <Send className="mr-2 h-4 w-4" />
                            Send to {recipientCount} Recipients
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>
      <Footer />
    </div>
  );
}