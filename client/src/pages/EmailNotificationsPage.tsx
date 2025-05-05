import React, { useState, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';

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

// Email history data (mock for now)
const mockEmailHistory: EmailHistoryEntry[] = [
  {
    id: '1',
    date: new Date(Date.now() - 86400000 * 2).toLocaleDateString(),
    subject: 'Event Reminder: Upcoming River Festival',
    recipients: 134,
    audience: 'tickets',
    status: 'sent',
  },
  {
    id: '2',
    date: new Date(Date.now() - 86400000 * 5).toLocaleDateString(),
    subject: 'Vendor Setup Information',
    recipients: 28,
    audience: 'vendors',
    status: 'sent',
  },
  {
    id: '3',
    date: new Date(Date.now() - 86400000 * 7).toLocaleDateString(),
    subject: 'Volunteer Schedule Update',
    recipients: 42,
    audience: 'volunteers',
    status: 'sent',
  },
];

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
        
        // Auto-advance to step 2 if on step 1
        if (currentStep === 1) {
          setCurrentStep(2);
        }
      } else {
        setSelectedTemplate(null);
      }
    }
  }, [watchedTemplateId, templates, form, currentStep]);

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
      generatePreview();
    }
  }, [watchedSubject, watchedCustomMessage, watchedEventId, selectedTemplate]);

  // Generate email preview
  const generatePreview = () => {
    if (!selectedTemplate) return;
    
    // Get the event details if any
    const selectedEvent = watchedEventId ? 
      events.find((e: Event) => e.id === watchedEventId) : null;
    
    // Create placeholder values
    const placeholders: Record<string, string> = {
      recipientName: 'Jane Doe',
      organizationName: 'City Event Hub',
      messageContent: watchedCustomMessage || 'No custom message provided.',
      eventName: selectedEvent?.title || 'Sample Event',
      eventDate: selectedEvent ? new Date(selectedEvent.startDate).toLocaleDateString() : 'January 1, 2023',
      eventLocation: selectedEvent?.location || 'City Convention Center',
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
  const handleSendTest = () => {
    const testEmail = form.getValues('testEmail');
    if (!testEmail) {
      toast({
        title: 'Test Email Required',
        description: 'Please enter an email address to send a test to',
        variant: 'destructive',
      });
      return;
    }
    
    testEmailMutation.mutate(form.getValues());
  };

  // Handle form submission for main email campaign
  const onSubmit = (data: EmailFormValues) => {
    if (recipientCount === 0) {
      toast({
        title: 'No Recipients',
        description: 'There are no recipients matching your criteria',
        variant: 'destructive',
      });
      return;
    }
    
    // Show preview first
    setIsShowingPreview(true);
  };

  // Confirm and send email after preview
  const confirmAndSendEmail = () => {
    setIsShowingPreview(false);
    sendEmailMutation.mutate(form.getValues());
  };

  // Check if current step is complete
  const isStepComplete = (step: number): boolean => {
    switch (step) {
      case 1:
        return !!watchedTemplateId;
      case 2:
        return !!watchedAudience && (watchedAudience !== 'custom' || !!watchedRole);
      case 3:
        return !!watchedSubject && (selectedTemplate?.id !== 'custom-announcement' || !!watchedCustomMessage);
      default:
        return false;
    }
  };

  // Navigation handlers
  const handleNextStep = () => {
    if (currentStep < 3 && isStepComplete(currentStep)) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handlePrevStep = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  // Render the Compose Email Wizard
  const renderEmailWizard = () => {
    return (
      <div className="space-y-8">
        {/* Progress Bar */}
        <div className="w-full">
          <div className="flex justify-between mb-2">
            <div className="w-full">
              <Progress value={currentStep * 33.33} className="h-2" />
            </div>
          </div>
          <div className="flex justify-between">
            <div className={`text-center ${currentStep >= 1 ? 'text-primary' : 'text-muted-foreground'}`}>
              <div className="mx-auto rounded-full w-8 h-8 flex items-center justify-center mb-1 border-2 border-primary bg-background">
                {currentStep > 1 ? <CheckCircle className="h-5 w-5 text-primary" /> : <Mail className="h-5 w-5" />}
              </div>
              <div className="text-sm font-medium">Template</div>
            </div>
            <div className={`text-center ${currentStep >= 2 ? 'text-primary' : 'text-muted-foreground'}`}>
              <div className="mx-auto rounded-full w-8 h-8 flex items-center justify-center mb-1 border-2 border-primary bg-background">
                {currentStep > 2 ? <CheckCircle className="h-5 w-5 text-primary" /> : <Users className="h-5 w-5" />}
              </div>
              <div className="text-sm font-medium">Recipients</div>
            </div>
            <div className={`text-center ${currentStep >= 3 ? 'text-primary' : 'text-muted-foreground'}`}>
              <div className="mx-auto rounded-full w-8 h-8 flex items-center justify-center mb-1 border-2 border-primary bg-background">
                <FileText className="h-5 w-5" />
              </div>
              <div className="text-sm font-medium">Compose</div>
            </div>
          </div>
        </div>

        {/* Step 1: Choose Template */}
        {currentStep === 1 && (
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center text-xl">
                  <Mail className="mr-2 h-5 w-5 text-primary" />
                  Step 1: Choose Email Template
                </CardTitle>
                <CardDescription>
                  Select the type of email you want to send
                </CardDescription>
              </CardHeader>
              <CardContent>
                {isLoadingTemplates ? (
                  <div className="flex justify-center items-center py-8">
                    <Loader2 className="mr-2 h-6 w-6 animate-spin" />
                    <span>Loading templates...</span>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {templates.map((template: EmailTemplate) => (
                      <div
                        key={template.id}
                        className={`border rounded-lg p-4 cursor-pointer transition-all hover:shadow-md ${
                          watchedTemplateId === template.id
                            ? "border-primary bg-primary/5"
                            : "border-border hover:border-primary/50"
                        }`}
                        onClick={() => form.setValue("templateId", template.id)}
                      >
                        <div className="flex items-center mb-2">
                          {getTemplateIcon(template.id)}
                          <div className="ml-4">
                            <h3 className="font-medium text-lg">{template.name}</h3>
                            <Badge variant="outline" className="mt-1">
                              {getAudienceName(template.audience)}
                            </Badge>
                          </div>
                          {watchedTemplateId === template.id && (
                            <CheckCircle className="ml-auto h-5 w-5 text-primary" />
                          )}
                        </div>
                        <p className="text-muted-foreground text-sm mt-2">
                          {template.description}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
              <CardFooter className="flex justify-end border-t p-4">
                <Button
                  onClick={handleNextStep}
                  disabled={!isStepComplete(1)}
                >
                  Next: Choose Recipients
                  <ChevronRight className="ml-2 h-4 w-4" />
                </Button>
              </CardFooter>
            </Card>
          </div>
        )}

        {/* Step 2: Choose Recipients */}
        {currentStep === 2 && (
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center text-xl">
                  <Users className="mr-2 h-5 w-5 text-primary" />
                  Step 2: Choose Recipients
                </CardTitle>
                <CardDescription>
                  Select who will receive this email
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Form {...form}>
                  <form className="space-y-6">
                    <FormField
                      control={form.control}
                      name="eventId"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="flex items-center">
                            <Calendar className="mr-2 h-4 w-4 text-primary" />
                            Related Event
                          </FormLabel>
                          <Select
                            onValueChange={(value) => field.onChange(parseInt(value))}
                            value={field.value?.toString()}
                          >
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select an event (optional)" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {isLoadingEvents ? (
                                <div className="flex items-center justify-center p-2">
                                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                  <span>Loading events...</span>
                                </div>
                              ) : (
                                events.map((event: Event) => (
                                  <SelectItem key={event.id} value={event.id.toString()}>
                                    {event.title}
                                  </SelectItem>
                                ))
                              )}
                            </SelectContent>
                          </Select>
                          <FormDescription>
                            Selecting an event will filter recipients and include event details in the email
                          </FormDescription>
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="audience"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="flex items-center">
                            <Users className="mr-2 h-4 w-4 text-primary" />
                            Recipient Group
                          </FormLabel>
                          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3">
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <div
                                    className={`border rounded-lg p-3 cursor-pointer transition-all text-center ${
                                      field.value === 'all'
                                        ? "border-primary bg-primary/5"
                                        : "border-border hover:border-primary/50"
                                    }`}
                                    onClick={() => field.onChange('all')}
                                  >
                                    <Users className="h-8 w-8 mx-auto mb-1 text-slate-600" />
                                    <div className="font-medium">All Users</div>
                                    {field.value === 'all' && (
                                      <CheckCircle className="h-4 w-4 absolute top-2 right-2 text-primary" />
                                    )}
                                  </div>
                                </TooltipTrigger>
                                <TooltipContent>
                                  Send to all users in the system
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>

                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <div
                                    className={`border rounded-lg p-3 cursor-pointer transition-all text-center ${
                                      field.value === 'tickets'
                                        ? "border-primary bg-primary/5"
                                        : "border-border hover:border-primary/50"
                                    }`}
                                    onClick={() => field.onChange('tickets')}
                                  >
                                    <Ticket className="h-8 w-8 mx-auto mb-1 text-emerald-500" />
                                    <div className="font-medium">Ticket Holders</div>
                                    {field.value === 'tickets' && (
                                      <CheckCircle className="h-4 w-4 absolute top-2 right-2 text-primary" />
                                    )}
                                  </div>
                                </TooltipTrigger>
                                <TooltipContent>
                                  Only users who have purchased tickets
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>

                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <div
                                    className={`border rounded-lg p-3 cursor-pointer transition-all text-center ${
                                      field.value === 'vendors'
                                        ? "border-primary bg-primary/5"
                                        : "border-border hover:border-primary/50"
                                    }`}
                                    onClick={() => field.onChange('vendors')}
                                  >
                                    <Store className="h-8 w-8 mx-auto mb-1 text-indigo-500" />
                                    <div className="font-medium">Vendors</div>
                                    {field.value === 'vendors' && (
                                      <CheckCircle className="h-4 w-4 absolute top-2 right-2 text-primary" />
                                    )}
                                  </div>
                                </TooltipTrigger>
                                <TooltipContent>
                                  Registered vendors and exhibitors
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>

                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <div
                                    className={`border rounded-lg p-3 cursor-pointer transition-all text-center ${
                                      field.value === 'volunteers'
                                        ? "border-primary bg-primary/5"
                                        : "border-border hover:border-primary/50"
                                    }`}
                                    onClick={() => field.onChange('volunteers')}
                                  >
                                    <Heart className="h-8 w-8 mx-auto mb-1 text-rose-500" />
                                    <div className="font-medium">Volunteers</div>
                                    {field.value === 'volunteers' && (
                                      <CheckCircle className="h-4 w-4 absolute top-2 right-2 text-primary" />
                                    )}
                                  </div>
                                </TooltipTrigger>
                                <TooltipContent>
                                  Volunteers who have signed up
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>

                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <div
                                    className={`border rounded-lg p-3 cursor-pointer transition-all text-center ${
                                      field.value === 'custom'
                                        ? "border-primary bg-primary/5"
                                        : "border-border hover:border-primary/50"
                                    }`}
                                    onClick={() => field.onChange('custom')}
                                  >
                                    <UserCog className="h-8 w-8 mx-auto mb-1 text-amber-500" />
                                    <div className="font-medium">Custom</div>
                                    {field.value === 'custom' && (
                                      <CheckCircle className="h-4 w-4 absolute top-2 right-2 text-primary" />
                                    )}
                                  </div>
                                </TooltipTrigger>
                                <TooltipContent>
                                  Create a custom recipient group
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          </div>
                        </FormItem>
                      )}
                    />

                    {watchedAudience === 'custom' && (
                      <FormField
                        control={form.control}
                        name="role"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>User Role</FormLabel>
                            <Select
                              onValueChange={field.onChange}
                              value={field.value}
                            >
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Select user role" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="all">All Roles</SelectItem>
                                <SelectItem value="user">Regular Users</SelectItem>
                                <SelectItem value="admin">Administrators</SelectItem>
                                <SelectItem value="event_owner">Event Organizers</SelectItem>
                                <SelectItem value="vendor">Vendors</SelectItem>
                                <SelectItem value="volunteer">Volunteers</SelectItem>
                              </SelectContent>
                            </Select>
                          </FormItem>
                        )}
                      />
                    )}

                    {(watchedAudience === 'vendors' || watchedAudience === 'volunteers') && (
                      <FormField
                        control={form.control}
                        name="status"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Registration Status</FormLabel>
                            <Select
                              onValueChange={field.onChange}
                              value={field.value}
                              defaultValue="all"
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
                          </FormItem>
                        )}
                      />
                    )}

                    <Alert
                      className={recipientCount > 0 ? 'bg-primary/10 border-primary/20' : 'bg-amber-50 border-amber-200'}
                    >
                      <Users className="h-4 w-4" />
                      <AlertTitle>Recipient Summary</AlertTitle>
                      <AlertDescription>
                        {recipientCount > 0 ? (
                          <span>This email will be sent to <strong>{recipientCount} recipients</strong></span>
                        ) : (
                          <span>No recipients match your selected criteria</span>
                        )}
                      </AlertDescription>
                    </Alert>
                  </form>
                </Form>
              </CardContent>
              <CardFooter className="flex justify-between border-t p-4">
                <Button variant="outline" onClick={handlePrevStep}>
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Back to Templates
                </Button>
                <Button
                  onClick={handleNextStep}
                  disabled={!isStepComplete(2) || recipientCount === 0}
                >
                  Next: Compose Email
                  <ChevronRight className="ml-2 h-4 w-4" />
                </Button>
              </CardFooter>
            </Card>
          </div>
        )}

        {/* Step 3: Compose Email */}
        {currentStep === 3 && (
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center text-xl">
                  <FileText className="mr-2 h-5 w-5 text-primary" />
                  Step 3: Compose Email
                </CardTitle>
                <CardDescription>
                  Customize your email content and preview before sending
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Form {...form}>
                  <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                    <div className="bg-muted/30 rounded-lg p-4 border mb-6">
                      <div className="flex items-start">
                        {selectedTemplate && getTemplateIcon(selectedTemplate.id)}
                        <div className="ml-4">
                          <h3 className="text-lg font-medium">{selectedTemplate?.name}</h3>
                          <div className="flex flex-wrap items-center text-sm text-muted-foreground mt-1 space-x-4">
                            <span className="flex items-center">
                              {getAudienceIcon(watchedAudience)}
                              <span className="ml-1">{getAudienceName(watchedAudience)}</span>
                            </span>
                            <span className="flex items-center">
                              <Users className="h-4 w-4 mr-1" />
                              <span>{recipientCount} recipients</span>
                            </span>
                            {watchedEventId && (
                              <span className="flex items-center">
                                <Calendar className="h-4 w-4 mr-1" />
                                <span>
                                  {events.find((e: Event) => e.id === watchedEventId)?.title}
                                </span>
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>

                    <FormField
                      control={form.control}
                      name="subject"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="flex items-center text-base">
                            <Mail className="mr-2 h-4 w-4 text-primary" />
                            Email Subject
                          </FormLabel>
                          <FormControl>
                            <Input 
                              placeholder="Enter email subject" 
                              className="text-base"
                              {...field} 
                            />
                          </FormControl>
                          <FormDescription>
                            A clear subject line increases open rates
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    {selectedTemplate?.id === 'custom-announcement' && (
                      <FormField
                        control={form.control}
                        name="customMessage"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="flex items-center text-base">
                              <FileText className="mr-2 h-4 w-4 text-primary" />
                              Custom Message
                            </FormLabel>
                            <FormControl>
                              <Textarea
                                placeholder="Enter your custom message content"
                                className="min-h-[200px] text-base"
                                {...field}
                              />
                            </FormControl>
                            <FormDescription>
                              This content will replace the <code className="bg-muted px-1 py-0.5 rounded">{"{{messageContent}}"}</code> placeholder in the template
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    )}

                    <div className="bg-muted/20 rounded-lg p-4 border">
                      <Label className="flex items-center text-base mb-3">
                        <Eye className="mr-2 h-4 w-4 text-primary" />
                        Email Preview & Testing
                      </Label>
                      
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <Button
                            type="button"
                            variant="outline"
                            className="w-full"
                            onClick={() => setIsShowingPreview(true)}
                          >
                            <Eye className="mr-2 h-4 w-4" />
                            Preview Email
                          </Button>
                        </div>
                        
                        <div className="flex space-x-2">
                          <FormField
                            control={form.control}
                            name="testEmail"
                            render={({ field }) => (
                              <FormControl>
                                <Input 
                                  placeholder="your@email.com" 
                                  className="flex-1"
                                  {...field} 
                                />
                              </FormControl>
                            )}
                          />
                          <Button 
                            type="button"
                            variant="secondary"
                            onClick={handleSendTest}
                            disabled={isSendingTest || !form.getValues('testEmail')}
                          >
                            {isSendingTest ? (
                              <Loader2 className="h-4 w-4 animate-spin mr-2" />
                            ) : (
                              <Send className="h-4 w-4 mr-2" />
                            )}
                            Test
                          </Button>
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                      <Card className="bg-muted/10">
                        <CardHeader className="pb-2">
                          <CardTitle className="text-sm">Available Placeholders</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="flex flex-wrap gap-2">
                            <Badge variant="outline" className="bg-white">
                              <code>{"{{recipientName}}"}</code>
                            </Badge>
                            <Badge variant="outline" className="bg-white">
                              <code>{"{{eventName}}"}</code>
                            </Badge>
                            <Badge variant="outline" className="bg-white">
                              <code>{"{{eventDate}}"}</code>
                            </Badge>
                            <Badge variant="outline" className="bg-white">
                              <code>{"{{eventLocation}}"}</code>
                            </Badge>
                            <Badge variant="outline" className="bg-white">
                              <code>{"{{organizationName}}"}</code>
                            </Badge>
                          </div>
                        </CardContent>
                      </Card>
                      
                      <Card className="bg-muted/10">
                        <CardHeader className="pb-2">
                          <CardTitle className="text-sm">Placeholder Values</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-1 text-sm">
                          {Object.entries(placeholderValues).map(([key, value]) => (
                            <div key={key} className="flex justify-between">
                              <span className="text-muted-foreground"><code>{`{{${key}}}`}</code></span>
                              <span className="font-medium truncate max-w-[150px]">{value}</span>
                            </div>
                          ))}
                        </CardContent>
                      </Card>
                    </div>
                  </form>
                </Form>
              </CardContent>
              <CardFooter className="flex justify-between border-t p-4">
                <Button variant="outline" onClick={handlePrevStep}>
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Back to Recipients
                </Button>
                <Button
                  type="submit"
                  onClick={form.handleSubmit(onSubmit)}
                  disabled={!isStepComplete(3) || recipientCount === 0}
                >
                  <Send className="mr-2 h-4 w-4" />
                  Send Email Campaign
                </Button>
              </CardFooter>
            </Card>
          </div>
        )}
      </div>
    );
  };

  // Render Sent History view
  const renderSentHistory = () => {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <ArchiveIcon className="mr-2 h-5 w-5 text-primary" />
            Email Campaign History
          </CardTitle>
          <CardDescription>
            View details of previously sent email campaigns
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted">
                <tr>
                  <th className="text-left p-3 font-medium">Date</th>
                  <th className="text-left p-3 font-medium">Subject</th>
                  <th className="text-left p-3 font-medium">Audience</th>
                  <th className="text-left p-3 font-medium">Recipients</th>
                  <th className="text-left p-3 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {mockEmailHistory.map((email, i) => (
                  <tr key={email.id} className={i % 2 === 0 ? 'bg-background' : 'bg-muted/30'}>
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
          </div>
        </CardContent>
      </Card>
    );
  };

  return (
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
                    This email will be sent to {recipientCount} recipients. 
                    This action cannot be undone.
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
                    onClick={confirmAndSendEmail}
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
  );
}