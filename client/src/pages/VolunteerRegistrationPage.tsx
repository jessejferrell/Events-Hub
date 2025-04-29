import { useEffect, useState } from "react";
import { useParams, useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useAuth } from "@/hooks/use-auth";
import { useCart } from "@/hooks/use-cart";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { useMutation, useQuery } from "@tanstack/react-query";

import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2 } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertCircle } from "lucide-react";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

// Define the volunteer registration form schema
const volunteerFormSchema = z.object({
  fullName: z.string().min(1, "Full name is required"),
  email: z.string().email("Must be a valid email"),
  phoneNumber: z.string().min(10, "Phone number must be at least 10 digits"),
  age: z.string().refine(val => !isNaN(Number(val)) && Number(val) >= 16, {
    message: "Volunteer must be at least 16 years old",
  }),
  experience: z.string().optional(),
  interests: z.string().optional(),
  availability: z.string().min(1, "Please select your availability"),
  emergencyContactName: z.string().min(1, "Emergency contact name is required"),
  emergencyContactPhone: z.string().min(10, "Emergency contact phone must be at least 10 digits"),
  tShirtSize: z.string().min(1, "T-shirt size is required"),
  specialAccommodations: z.string().optional(),
  agreeToTerms: z.boolean().refine(val => val === true, {
    message: "You must agree to the terms and conditions",
  }),
});

type VolunteerFormValues = z.infer<typeof volunteerFormSchema>;

export default function VolunteerRegistrationPage() {
  const { id } = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const { user } = useAuth();
  const { setRegistrationStatus, getCartItem } = useCart();
  const { toast } = useToast();
  const [isExistingProfile, setIsExistingProfile] = useState(false);
  
  // Get the cart item
  const cartItem = getCartItem(id);
  
  // Redirect if cart item doesn't exist or isn't a volunteer shift
  useEffect(() => {
    if (!cartItem) {
      toast({
        title: "Item not found",
        description: "The specified cart item was not found.",
        variant: "destructive",
      });
      navigate("/");
      return;
    }
    
    if (cartItem.product.type !== 'volunteer_shift') {
      toast({
        title: "Invalid item type",
        description: "This item does not require volunteer registration.",
        variant: "destructive",
      });
      navigate("/");
    }
  }, [cartItem, toast, navigate]);
  
  // Fetch existing volunteer profile if any
  const { data: volunteerProfile, isLoading: isLoadingProfile } = useQuery({
    queryKey: ['/api/volunteer-profile'],
    enabled: !!user,
  });
  
  useEffect(() => {
    if (volunteerProfile) {
      setIsExistingProfile(true);
    }
  }, [volunteerProfile]);
  
  // Set up the form with default values from existing profile
  const form = useForm<VolunteerFormValues>({
    resolver: zodResolver(volunteerFormSchema),
    defaultValues: {
      fullName: volunteerProfile?.fullName || user?.name || "",
      email: volunteerProfile?.email || user?.email || "",
      phoneNumber: volunteerProfile?.phoneNumber || user?.phoneNumber || "",
      age: volunteerProfile?.age?.toString() || "",
      experience: volunteerProfile?.experience || "",
      interests: volunteerProfile?.interests || "",
      availability: volunteerProfile?.availability || "",
      emergencyContactName: volunteerProfile?.emergencyContactName || "",
      emergencyContactPhone: volunteerProfile?.emergencyContactPhone || "",
      tShirtSize: volunteerProfile?.tShirtSize || "",
      specialAccommodations: volunteerProfile?.specialAccommodations || "",
      agreeToTerms: false,
    },
  });
  
  // On submit mutation
  const submitMutation = useMutation({
    mutationFn: async (formData: VolunteerFormValues) => {
      // First, save or update the volunteer profile
      let profileResponse;
      
      if (isExistingProfile && volunteerProfile?.id) {
        // Update existing profile
        profileResponse = await apiRequest("PUT", `/api/volunteer-profile/${volunteerProfile.id}`, formData);
      } else {
        // Create new profile
        profileResponse = await apiRequest("POST", "/api/volunteer-profile", formData);
      }
      
      const profile = await profileResponse.json();
      
      // Then, create volunteer assignment for this specific event/shift
      const assignmentData = {
        userId: user?.id,
        eventId: cartItem?.product.eventId,
        volunteerShiftId: cartItem?.product.id,
        profileId: profile.id,
        status: "pending",
        notes: formData.specialAccommodations,
        availability: formData.availability,
      };
      
      const assignmentResponse = await apiRequest(
        "POST", 
        "/api/volunteer-assignments", 
        assignmentData
      );
      
      return assignmentResponse.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Registration saved",
        description: "Your volunteer registration information has been saved successfully.",
      });
      
      // Mark this cart item as having completed registration
      setRegistrationStatus(id, 'complete', data);
      
      // Check if there are more registrations needed, or go to checkout
      const { needsRegistration, getNextRegistrationPath } = useCart();
      
      if (needsRegistration()) {
        navigate(getNextRegistrationPath());
      } else {
        navigate("/checkout");
      }
    },
    onError: (error: Error) => {
      toast({
        title: "Registration failed",
        description: error.message || "Failed to save volunteer registration. Please try again.",
        variant: "destructive",
      });
    },
  });
  
  const onSubmit = (values: VolunteerFormValues) => {
    submitMutation.mutate(values);
  };
  
  // Show loading state
  if (isLoadingProfile || !cartItem) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }
  
  return (
    <div className="container py-8">
      <div className="max-w-3xl mx-auto">
        <Card>
          <CardHeader>
            <CardTitle>Volunteer Registration</CardTitle>
            <CardDescription>
              Please provide your information to volunteer for: {cartItem.product.name}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isExistingProfile && (
              <Alert className="mb-6">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Using Existing Profile</AlertTitle>
                <AlertDescription>
                  We've prefilled the form with your existing volunteer profile information.
                  You can make changes if needed.
                </AlertDescription>
              </Alert>
            )}
            
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                <FormField
                  control={form.control}
                  name="fullName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Full Name</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <FormField
                    control={form.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Email</FormLabel>
                        <FormControl>
                          <Input {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={form.control}
                    name="phoneNumber"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Phone Number</FormLabel>
                        <FormControl>
                          <Input {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <FormField
                    control={form.control}
                    name="age"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Age</FormLabel>
                        <FormControl>
                          <Input type="number" min="16" {...field} />
                        </FormControl>
                        <FormDescription>You must be at least 16 years old to volunteer.</FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={form.control}
                    name="tShirtSize"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>T-Shirt Size</FormLabel>
                        <Select 
                          onValueChange={field.onChange} 
                          defaultValue={field.value}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select a size" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="XS">XS</SelectItem>
                            <SelectItem value="S">S</SelectItem>
                            <SelectItem value="M">M</SelectItem>
                            <SelectItem value="L">L</SelectItem>
                            <SelectItem value="XL">XL</SelectItem>
                            <SelectItem value="XXL">XXL</SelectItem>
                            <SelectItem value="XXXL">XXXL</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormDescription>For your volunteer t-shirt.</FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                
                <FormField
                  control={form.control}
                  name="experience"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Previous Volunteer Experience (optional)</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Tell us about any previous volunteer experience..."
                          className="min-h-20"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="interests"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Areas of Interest (optional)</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="What types of volunteer roles interest you most?"
                          className="min-h-20"
                          {...field}
                        />
                      </FormControl>
                      <FormDescription>
                        e.g., ticket taking, setting up, cleaning, event coordination, etc.
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="availability"
                  render={({ field }) => (
                    <FormItem className="space-y-3">
                      <FormLabel>Availability</FormLabel>
                      <FormControl>
                        <RadioGroup
                          onValueChange={field.onChange}
                          defaultValue={field.value}
                          className="flex flex-col space-y-1"
                        >
                          <FormItem className="flex items-center space-x-3 space-y-0">
                            <FormControl>
                              <RadioGroupItem value="full" />
                            </FormControl>
                            <FormLabel className="font-normal">
                              Full event - All hours needed
                            </FormLabel>
                          </FormItem>
                          <FormItem className="flex items-center space-x-3 space-y-0">
                            <FormControl>
                              <RadioGroupItem value="morning" />
                            </FormControl>
                            <FormLabel className="font-normal">
                              Morning shifts only
                            </FormLabel>
                          </FormItem>
                          <FormItem className="flex items-center space-x-3 space-y-0">
                            <FormControl>
                              <RadioGroupItem value="afternoon" />
                            </FormControl>
                            <FormLabel className="font-normal">
                              Afternoon shifts only
                            </FormLabel>
                          </FormItem>
                          <FormItem className="flex items-center space-x-3 space-y-0">
                            <FormControl>
                              <RadioGroupItem value="evening" />
                            </FormControl>
                            <FormLabel className="font-normal">
                              Evening shifts only
                            </FormLabel>
                          </FormItem>
                          <FormItem className="flex items-center space-x-3 space-y-0">
                            <FormControl>
                              <RadioGroupItem value="flexible" />
                            </FormControl>
                            <FormLabel className="font-normal">
                              Flexible - Assign me wherever needed most
                            </FormLabel>
                          </FormItem>
                        </RadioGroup>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <FormField
                    control={form.control}
                    name="emergencyContactName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Emergency Contact Name</FormLabel>
                        <FormControl>
                          <Input {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={form.control}
                    name="emergencyContactPhone"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Emergency Contact Phone</FormLabel>
                        <FormControl>
                          <Input {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                
                <FormField
                  control={form.control}
                  name="specialAccommodations"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Special Accommodations (optional)</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Do you require any special accommodations?"
                          className="min-h-16"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="agreeToTerms"
                  render={({ field }) => (
                    <FormItem className="flex items-start space-x-3 space-y-0 rounded-md border p-4">
                      <FormControl>
                        <Checkbox
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                      <div className="space-y-1 leading-none">
                        <FormLabel>Volunteer Agreement</FormLabel>
                        <FormDescription>
                          I agree to arrive on time for my assigned shift, follow all event guidelines,
                          and understand that my participation is crucial to the success of the event.
                          I release the organizers from liability for any injuries that may occur during
                          my volunteer service.
                        </FormDescription>
                      </div>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <div className="pt-4">
                  <Button 
                    type="submit" 
                    className="w-full"
                    disabled={submitMutation.isPending}
                  >
                    {submitMutation.isPending ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Saving Registration...
                      </>
                    ) : (
                      'Complete Registration'
                    )}
                  </Button>
                </div>
              </form>
            </Form>
          </CardContent>
          <CardFooter className="flex justify-center text-xs text-muted-foreground">
            Thank you for volunteering! Event organizers will contact you with your assigned shift details.
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}