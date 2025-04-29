import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Event, insertEventSchema } from "@shared/schema";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertCircle, CalendarIcon, Check, ChevronLeft, ChevronRight } from "lucide-react";
import { format } from "date-fns";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import ProductManager from "@/components/ui/product-manager";

// Create a more detailed event schema for the form
const eventFormSchema = z.object({
  title: z.string().min(3, "Title must be at least 3 characters"),
  description: z.string().min(10, "Description must be at least 10 characters"),
  location: z.string().min(3, "Location must be at least 3 characters"),
  startDate: z.date(),
  endDate: z.date(),
  imageUrl: z.string().optional(),
  eventType: z.string().min(1, "Event type is required"),
  price: z.coerce.number().min(0, "Price must be a positive number or zero"),
  isActive: z.boolean().default(true),
}).refine((data) => {
  return data.endDate >= data.startDate;
}, {
  message: "End date must be after or equal to start date",
  path: ["endDate"],
});

type EventFormValues = z.infer<typeof eventFormSchema>;

interface EventFormProps {
  event?: Event;
  onSuccess?: () => void;
}

export default function EventForm({ event, onSuccess }: EventFormProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [formStartDate, setFormStartDate] = useState<Date | undefined>(
    event ? new Date(event.startDate) : new Date()
  );
  const [formEndDate, setFormEndDate] = useState<Date | undefined>(
    event ? new Date(event.endDate) : new Date()
  );
  const [currentStep, setCurrentStep] = useState(1);
  const [newEventId, setNewEventId] = useState<number | null>(null);

  // Event types options
  const eventTypes = [
    { value: "concert", label: "Concert" },
    { value: "festival", label: "Festival" },
    { value: "workshop", label: "Workshop" },
    { value: "community", label: "Community" },
    { value: "sports", label: "Sports" },
    { value: "conference", label: "Conference" },
    { value: "networking", label: "Networking" },
    { value: "other", label: "Other" },
  ];

  // Form default values
  const defaultValues: Partial<EventFormValues> = {
    title: event?.title || "",
    description: event?.description || "",
    location: event?.location || "",
    startDate: event ? new Date(event.startDate) : new Date(),
    endDate: event ? new Date(event.endDate) : new Date(),
    imageUrl: event?.imageUrl || "",
    eventType: event?.eventType || "",
    price: event?.price || 0,
    isActive: event?.isActive ?? true,
  };

  // Create form
  const form = useForm<EventFormValues>({
    resolver: zodResolver(eventFormSchema),
    defaultValues,
  });

  // Create event mutation
  const createEventMutation = useMutation({
    mutationFn: async (data: EventFormValues) => {
      const res = await apiRequest("POST", "/api/events", data);
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || "Failed to create event");
      }
      return await res.json();
    },
    onSuccess: (data) => {
      toast({ title: "Success", description: "Event details saved! Now you can add products." });
      // Store the new event ID and advance to the next step
      setNewEventId(data.id);
      setCurrentStep(2);
      // Invalidate event queries
      queryClient.invalidateQueries({ queryKey: ["/api/events"] });
      queryClient.invalidateQueries({ queryKey: ["/api/my-events"] });
    },
    onError: (error: Error) => {
      toast({ 
        title: "Error", 
        description: error.message || "Failed to create event", 
        variant: "destructive" 
      });
    },
  });

  // Update event mutation
  const updateEventMutation = useMutation({
    mutationFn: async (data: EventFormValues & { id: number }) => {
      const { id, ...eventData } = data;
      const res = await apiRequest("PUT", `/api/events/${id}`, eventData);
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || "Failed to update event");
      }
      return await res.json();
    },
    onSuccess: (data) => {
      if (currentStep === 1) {
        toast({ title: "Success", description: "Event details updated! Now you can manage products." });
        setCurrentStep(2);
      } else {
        toast({ title: "Success", description: "Event updated successfully" });
        if (onSuccess) onSuccess();
      }
      // Invalidate event queries
      queryClient.invalidateQueries({ queryKey: ["/api/events"] });
      queryClient.invalidateQueries({ queryKey: ["/api/my-events"] });
    },
    onError: (error: Error) => {
      toast({ 
        title: "Error", 
        description: error.message || "Failed to update event", 
        variant: "destructive" 
      });
    },
  });

  // Handle step 1 submission (basic event details)
  function onSubmitStep1(data: EventFormValues) {
    if (event) {
      updateEventMutation.mutate({ ...data, id: event.id });
    } else {
      createEventMutation.mutate(data);
    }
  }

  // Handle step 2 completion (products management)
  function handleCompleteStep2() {
    toast({ title: "Success", description: "Event and products saved successfully" });
    if (onSuccess) onSuccess();
  }

  // Render step indicators
  const renderStepIndicators = () => {
    return (
      <div className="flex items-center mb-6 justify-center">
        <div className={`flex items-center ${currentStep === 1 ? "text-primary" : "text-muted-foreground"}`}>
          <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
            currentStep === 1 ? "bg-primary text-white" : 
            currentStep > 1 ? "bg-primary/20 text-primary" : "bg-muted text-muted-foreground"
          }`}>
            {currentStep > 1 ? <Check className="h-4 w-4" /> : "1"}
          </div>
          <span className="ml-2 font-medium">Event Details</span>
        </div>
        
        <div className="w-10 h-1 mx-3 bg-muted-foreground/30">
          <div className={`h-full bg-primary ${currentStep > 1 ? "w-full" : "w-0"} transition-all`}></div>
        </div>
        
        <div className={`flex items-center ${currentStep === 2 ? "text-primary" : "text-muted-foreground"}`}>
          <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
            currentStep === 2 ? "bg-primary text-white" : "bg-muted text-muted-foreground"
          }`}>
            2
          </div>
          <span className="ml-2 font-medium">Products & Tickets</span>
        </div>
      </div>
    );
  };

  // Step 1: Event Details Form
  const renderStep1 = () => (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmitStep1)} className="space-y-4">
        <FormField
          control={form.control}
          name="title"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Event Title</FormLabel>
              <FormControl>
                <Input placeholder="Enter event title" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        
        <FormField
          control={form.control}
          name="description"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Description</FormLabel>
              <FormControl>
                <Textarea 
                  placeholder="Enter event description" 
                  className="min-h-[100px]" 
                  {...field} 
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="location"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Location</FormLabel>
                <FormControl>
                  <Input placeholder="Enter event location" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          
          <FormField
            control={form.control}
            name="eventType"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Event Type</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Select event type" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {eventTypes.map(type => (
                      <SelectItem key={type.value} value={type.value}>
                        {type.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="startDate"
            render={({ field }) => (
              <FormItem className="flex flex-col">
                <FormLabel>Start Date & Time</FormLabel>
                <Popover>
                  <PopoverTrigger asChild>
                    <FormControl>
                      <Button
                        variant={"outline"}
                        className={`w-full pl-3 text-left font-normal ${
                          !field.value && "text-muted-foreground"
                        }`}
                      >
                        {field.value ? (
                          format(field.value, "PPP")
                        ) : (
                          <span>Pick a date</span>
                        )}
                        <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                      </Button>
                    </FormControl>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={field.value}
                      onSelect={(date) => {
                        field.onChange(date);
                        setFormStartDate(date);
                      }}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
                <FormControl>
                  <Input
                    type="time"
                    value={field.value ? format(field.value, "HH:mm") : ""}
                    onChange={(e) => {
                      const [hours, minutes] = e.target.value.split(':').map(Number);
                      const newDate = new Date(field.value);
                      newDate.setHours(hours, minutes);
                      field.onChange(newDate);
                      setFormStartDate(newDate);
                    }}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          
          <FormField
            control={form.control}
            name="endDate"
            render={({ field }) => (
              <FormItem className="flex flex-col">
                <FormLabel>End Date & Time</FormLabel>
                <Popover>
                  <PopoverTrigger asChild>
                    <FormControl>
                      <Button
                        variant={"outline"}
                        className={`w-full pl-3 text-left font-normal ${
                          !field.value && "text-muted-foreground"
                        }`}
                      >
                        {field.value ? (
                          format(field.value, "PPP")
                        ) : (
                          <span>Pick a date</span>
                        )}
                        <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                      </Button>
                    </FormControl>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={field.value}
                      onSelect={(date) => {
                        field.onChange(date);
                        setFormEndDate(date);
                      }}
                      disabled={(date) => date < formStartDate!}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
                <FormControl>
                  <Input
                    type="time"
                    value={field.value ? format(field.value, "HH:mm") : ""}
                    onChange={(e) => {
                      const [hours, minutes] = e.target.value.split(':').map(Number);
                      const newDate = new Date(field.value);
                      newDate.setHours(hours, minutes);
                      field.onChange(newDate);
                      setFormEndDate(newDate);
                    }}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="price"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Base Price ($)</FormLabel>
                <FormControl>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 transform -translate-y-1/2">$</span>
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      className="pl-7"
                      placeholder="0.00"
                      {...field}
                    />
                  </div>
                </FormControl>
                <FormDescription>
                  Set to 0 for free events
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
          
          <FormField
            control={form.control}
            name="imageUrl"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Image URL (Optional)</FormLabel>
                <FormControl>
                  <Input placeholder="Enter image URL" {...field} />
                </FormControl>
                <FormDescription>
                  Direct link to event image
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
        
        {/* All checkboxes for vendor options, volunteer options, merchandise and add-ons have been removed.
           All of these will be managed as products in step 2 */}
        
        <FormField
          control={form.control}
          name="isActive"
          render={({ field }) => (
            <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
              <FormControl>
                <input
                  type="checkbox"
                  checked={field.value}
                  onChange={field.onChange}
                  className="h-4 w-4 mt-1"
                />
              </FormControl>
              <div className="space-y-1 leading-none">
                <FormLabel>Active Event</FormLabel>
                <FormDescription>
                  Uncheck to hide this event from public listings
                </FormDescription>
              </div>
            </FormItem>
          )}
        />

        <div className="flex justify-between space-x-2 pt-4">
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              if (onSuccess) onSuccess();
            }}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            disabled={createEventMutation.isPending || updateEventMutation.isPending}
          >
            {createEventMutation.isPending || updateEventMutation.isPending
              ? "Saving..."
              : "Save & Continue"}
          </Button>
        </div>
      </form>
    </Form>
  );

  // Step 2: Product Management
  const renderStep2 = () => (
    <div className="space-y-6">
      <Alert className="mb-6">
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>Important</AlertTitle>
        <AlertDescription>
          All items for your event (tickets, merchandise, vendor spots, volunteer shifts, etc.) should be added as PRODUCTS. 
          Each product is fully editable and manageable. At minimum, create at least one ticket product for your event.
        </AlertDescription>
      </Alert>
      
      <ProductManager eventId={event?.id || newEventId!} />
      
      <div className="flex justify-between pt-6">
        <Button
          type="button"
          variant="outline"
          onClick={() => setCurrentStep(1)}
          className="flex items-center"
        >
          <ChevronLeft className="mr-1 h-4 w-4" />
          Back to Details
        </Button>
        
        <Button 
          onClick={handleCompleteStep2}
          className="flex items-center"
        >
          Complete
          <ChevronRight className="ml-1 h-4 w-4" />
        </Button>
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      {renderStepIndicators()}
      
      {currentStep === 1 && renderStep1()}
      {currentStep === 2 && renderStep2()}
    </div>
  );
}