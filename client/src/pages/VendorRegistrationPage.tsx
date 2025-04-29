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

// Define the vendor registration form schema
const vendorFormSchema = z.object({
  businessName: z.string().min(1, "Business name is required"),
  description: z.string().min(1, "Description is required"),
  websiteUrl: z.string().url("Must be a valid URL").optional().or(z.literal("")),
  phoneNumber: z.string().min(10, "Phone number must be at least 10 digits"),
  preferredLocation: z.string().optional(),
  needsElectricity: z.boolean().default(false),
  needsWater: z.boolean().default(false),
  specialRequirements: z.string().optional(),
  agreeToTerms: z.boolean().refine(val => val === true, {
    message: "You must agree to the terms and conditions",
  }),
});

type VendorFormValues = z.infer<typeof vendorFormSchema>;

export default function VendorRegistrationPage() {
  const { id } = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const { user } = useAuth();
  const { setRegistrationStatus, getCartItem } = useCart();
  const { toast } = useToast();
  const [isExistingProfile, setIsExistingProfile] = useState(false);
  
  // Get the cart item
  const cartItem = getCartItem(id);
  
  // Redirect if cart item doesn't exist or isn't a vendor spot
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
    
    if (cartItem.product.type !== 'vendor_spot') {
      toast({
        title: "Invalid item type",
        description: "This item does not require vendor registration.",
        variant: "destructive",
      });
      navigate("/");
    }
  }, [cartItem, toast, navigate]);
  
  // Fetch existing vendor profile if any
  const { data: vendorProfile, isLoading: isLoadingProfile } = useQuery({
    queryKey: ['/api/vendor-profile'],
    enabled: !!user,
  });
  
  useEffect(() => {
    if (vendorProfile) {
      setIsExistingProfile(true);
    }
  }, [vendorProfile]);
  
  // Set up the form with default values from existing profile
  const form = useForm<VendorFormValues>({
    resolver: zodResolver(vendorFormSchema),
    defaultValues: {
      businessName: vendorProfile?.businessName || "",
      description: vendorProfile?.description || "",
      websiteUrl: vendorProfile?.websiteUrl || "",
      phoneNumber: vendorProfile?.phoneNumber || user?.phoneNumber || "",
      preferredLocation: vendorProfile?.preferredLocation || "",
      needsElectricity: vendorProfile?.needsElectricity || false,
      needsWater: vendorProfile?.needsWater || false,
      specialRequirements: vendorProfile?.specialRequirements || "",
      agreeToTerms: false,
    },
  });
  
  // On submit mutation
  const submitMutation = useMutation({
    mutationFn: async (formData: VendorFormValues) => {
      // First, save or update the vendor profile
      let profileResponse;
      
      if (isExistingProfile && vendorProfile?.id) {
        // Update existing profile
        profileResponse = await apiRequest("PUT", `/api/vendor-profile/${vendorProfile.id}`, formData);
      } else {
        // Create new profile
        profileResponse = await apiRequest("POST", "/api/vendor-profile", formData);
      }
      
      const profile = await profileResponse.json();
      
      // Then, create vendor registration for this specific event/spot
      const registrationData = {
        userId: user?.id,
        eventId: cartItem?.product.eventId,
        vendorSpotId: cartItem?.product.id,
        profileId: profile.id,
        status: "pending",
        specialRequirements: formData.specialRequirements,
        needsElectricity: formData.needsElectricity,
        needsWater: formData.needsWater,
        preferredLocation: formData.preferredLocation,
      };
      
      const registrationResponse = await apiRequest(
        "POST", 
        "/api/vendor-registrations", 
        registrationData
      );
      
      return registrationResponse.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Registration saved",
        description: "Your vendor registration information has been saved successfully.",
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
        description: error.message || "Failed to save vendor registration. Please try again.",
        variant: "destructive",
      });
    },
  });
  
  const onSubmit = (values: VendorFormValues) => {
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
            <CardTitle>Vendor Registration</CardTitle>
            <CardDescription>
              Please provide information about your business for the event: {cartItem.product.eventName}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isExistingProfile && (
              <Alert className="mb-6">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Using Existing Profile</AlertTitle>
                <AlertDescription>
                  We've prefilled the form with your existing vendor profile information.
                  You can make changes if needed.
                </AlertDescription>
              </Alert>
            )}
            
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                <FormField
                  control={form.control}
                  name="businessName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Business Name</FormLabel>
                      <FormControl>
                        <Input {...field} />
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
                      <FormLabel>Business Description</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Tell us about your business, products, or services..."
                          className="min-h-24"
                          {...field}
                        />
                      </FormControl>
                      <FormDescription>
                        This will be displayed in the event vendor listing.
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <FormField
                    control={form.control}
                    name="phoneNumber"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Contact Phone Number</FormLabel>
                        <FormControl>
                          <Input {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={form.control}
                    name="websiteUrl"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Website URL (optional)</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="https://yourwebsite.com" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                
                <FormField
                  control={form.control}
                  name="preferredLocation"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Preferred Location (optional)</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="e.g., Near stage, corner spot, etc." />
                      </FormControl>
                      <FormDescription>
                        While we can't guarantee specific spots, we'll try to accommodate preferences.
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <FormField
                    control={form.control}
                    name="needsElectricity"
                    render={({ field }) => (
                      <FormItem className="flex items-start space-x-3 space-y-0 rounded-md border p-4">
                        <FormControl>
                          <Checkbox
                            checked={field.value}
                            onCheckedChange={field.onChange}
                          />
                        </FormControl>
                        <div className="space-y-1 leading-none">
                          <FormLabel>Electricity Required</FormLabel>
                          <FormDescription>
                            Check if you need access to electricity for your booth.
                          </FormDescription>
                        </div>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={form.control}
                    name="needsWater"
                    render={({ field }) => (
                      <FormItem className="flex items-start space-x-3 space-y-0 rounded-md border p-4">
                        <FormControl>
                          <Checkbox
                            checked={field.value}
                            onCheckedChange={field.onChange}
                          />
                        </FormControl>
                        <div className="space-y-1 leading-none">
                          <FormLabel>Water Access Required</FormLabel>
                          <FormDescription>
                            Check if you need access to water for your booth.
                          </FormDescription>
                        </div>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                
                <FormField
                  control={form.control}
                  name="specialRequirements"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Special Requirements (optional)</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Any additional requests or requirements for your booth..."
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
                        <FormLabel>Terms and Conditions</FormLabel>
                        <FormDescription>
                          I agree to the event terms and conditions including setup/teardown times, 
                          vendor regulations, and payment policies.
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
            Your vendor information will be reviewed by event organizers.
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}