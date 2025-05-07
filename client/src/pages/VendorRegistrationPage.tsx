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
  // Required contact fields
  fullName: z.string().min(1, "Full name is required"),
  businessName: z.string().min(1, "Business name is required"),
  businessAddress: z.string().min(1, "Business address is required"),
  businessAddressLine2: z.string().optional(),
  city: z.string().min(1, "City is required"),
  state: z.string().min(1, "State is required"),
  zipCode: z.string().min(5, "Zip code is required"),
  phoneNumber: z.string().min(10, "Phone number must be at least 10 digits"),
  email: z.string().email("Must be a valid email"),
  
  // Promotional information
  hasProvidedPromoInfo: z.boolean().default(false),
  
  // Social media and website links - optional unless hasProvidedPromoInfo is true
  websiteUrl: z.string().url("Must be a valid URL").optional().or(z.literal("")),
  facebookUrl: z.string().url("Must be a valid URL").optional().or(z.literal("")),
  instagramUrl: z.string().url("Must be a valid URL").optional().or(z.literal("")),
  tiktokUrl: z.string().url("Must be a valid URL").optional().or(z.literal("")),
  otherPromoUrl: z.string().url("Must be a valid URL").optional().or(z.literal("")),
  
  // Product/service description
  productsDescription: z.string().min(1, "Please describe your products or services"),
  
  // Event logistics
  preferredLocation: z.string().optional(),
  needsElectricity: z.boolean().default(false),
  needsWater: z.boolean().default(false),
  specialRequirements: z.string().optional(),
  
  // Terms agreement
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
  
  // Set up the form with default values from existing profile or user profile
  const form = useForm<VendorFormValues>({
    resolver: zodResolver(vendorFormSchema),
    defaultValues: {
      // Contact Information
      fullName: vendorProfile?.fullName || user?.name || "",
      businessName: vendorProfile?.businessName || "",
      businessAddress: vendorProfile?.businessAddress || user?.address || "",
      businessAddressLine2: vendorProfile?.businessAddressLine2 || "",
      city: vendorProfile?.city || user?.city || "",
      state: vendorProfile?.state || user?.state || "",
      zipCode: vendorProfile?.zipCode || user?.zipCode || "",
      phoneNumber: vendorProfile?.phoneNumber || user?.phoneNumber || "",
      email: vendorProfile?.email || user?.email || "",
      
      // Promotional information
      hasProvidedPromoInfo: vendorProfile?.hasProvidedPromoInfo || false,
      websiteUrl: vendorProfile?.websiteUrl || "",
      facebookUrl: vendorProfile?.facebookUrl || "",
      instagramUrl: vendorProfile?.instagramUrl || "",
      tiktokUrl: vendorProfile?.tiktokUrl || "",
      otherPromoUrl: vendorProfile?.otherPromoUrl || "",
      
      // Product/service description
      productsDescription: vendorProfile?.productsDescription || vendorProfile?.description || "",
      
      // Event logistics
      preferredLocation: vendorProfile?.preferredLocation || `${user?.city || ''}, ${user?.state || ''}`.trim(),
      needsElectricity: vendorProfile?.needsElectricity || false,
      needsWater: vendorProfile?.needsWater || false,
      specialRequirements: vendorProfile?.specialRequirements || "",
      
      // Terms agreement
      agreeToTerms: false,
    },
  });
  
  // On submit mutation
  const submitMutation = useMutation({
    mutationFn: async (formData: VendorFormValues) => {
      // First, save or update the vendor profile
      let profileResponse;
      
      // Prepare profile data
      const profileData = {
        fullName: formData.fullName,
        businessName: formData.businessName,
        businessAddress: formData.businessAddress,
        businessAddressLine2: formData.businessAddressLine2,
        city: formData.city,
        state: formData.state,
        zipCode: formData.zipCode,
        phoneNumber: formData.phoneNumber,
        email: formData.email,
        description: formData.productsDescription,
        websiteUrl: formData.websiteUrl,
        facebookUrl: formData.facebookUrl,
        instagramUrl: formData.instagramUrl,
        tiktokUrl: formData.tiktokUrl,
        otherPromoUrl: formData.otherPromoUrl,
        hasProvidedPromoInfo: formData.hasProvidedPromoInfo,
      };
      
      if (isExistingProfile && vendorProfile?.id) {
        // Update existing profile
        profileResponse = await apiRequest("PUT", `/api/vendor-profile/${vendorProfile.id}`, profileData);
      } else {
        // Create new profile
        profileResponse = await apiRequest("POST", "/api/vendor-profile", profileData);
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
        productsDescription: formData.productsDescription,
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
              Please provide information about your business for the event: {cartItem.product.name}
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
                {/* Contact Information Section */}
                <div className="space-y-4">
                  <h3 className="text-lg font-medium">Contact Information</h3>
                  
                  <FormField
                    control={form.control}
                    name="fullName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Full Name*</FormLabel>
                        <FormControl>
                          <Input {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={form.control}
                    name="businessName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Business Name*</FormLabel>
                        <FormControl>
                          <Input {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <div className="space-y-2">
                    <FormField
                      control={form.control}
                      name="businessAddress"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Business Address*</FormLabel>
                          <FormControl>
                            <Input {...field} placeholder="Street Address" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={form.control}
                      name="businessAddressLine2"
                      render={({ field }) => (
                        <FormItem>
                          <FormControl>
                            <Input {...field} placeholder="Street Address Line 2" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                      <FormField
                        control={form.control}
                        name="city"
                        render={({ field }) => (
                          <FormItem>
                            <FormControl>
                              <Input {...field} placeholder="City" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      
                      <FormField
                        control={form.control}
                        name="state"
                        render={({ field }) => (
                          <FormItem>
                            <FormControl>
                              <Input {...field} placeholder="State" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      
                      <FormField
                        control={form.control}
                        name="zipCode"
                        render={({ field }) => (
                          <FormItem>
                            <FormControl>
                              <Input {...field} placeholder="Postal Code" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  </div>
                  
                  <FormField
                    control={form.control}
                    name="phoneNumber"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Phone Number*</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="Ex. 2285558800" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={form.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>E-mail*</FormLabel>
                        <FormControl>
                          <Input {...field} type="email" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                
                {/* Promotional Information Section */}
                <div className="space-y-4 pt-4 border-t border-border">
                  <FormField
                    control={form.control}
                    name="hasProvidedPromoInfo"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-lg font-medium">Have you given us your logo, website, & social media info? (We want to promote you!)</FormLabel>
                        <div className="grid grid-cols-2 gap-2 pt-2">
                          <FormControl>
                            <div className="flex items-center space-x-2">
                              <input
                                type="radio"
                                id="promo-yes"
                                className="w-4 h-4 text-primary"
                                checked={field.value === true}
                                onChange={() => field.onChange(true)}
                              />
                              <label htmlFor="promo-yes">Yes</label>
                            </div>
                          </FormControl>
                          <FormControl>
                            <div className="flex items-center space-x-2">
                              <input
                                type="radio"
                                id="promo-no"
                                className="w-4 h-4 text-primary"
                                checked={field.value === false}
                                onChange={() => field.onChange(false)}
                              />
                              <label htmlFor="promo-no">No</label>
                            </div>
                          </FormControl>
                        </div>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  {form.watch("hasProvidedPromoInfo") === false && (
                    <div className="space-y-4 pt-2 animate-in fade-in-50">
                      <FormField
                        control={form.control}
                        name="websiteUrl"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Your Website:</FormLabel>
                            <FormControl>
                              <Input {...field} placeholder="https://yourwebsite.com" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      
                      <FormField
                        control={form.control}
                        name="facebookUrl"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Your Facebook Profile Link:</FormLabel>
                            <FormControl>
                              <Input {...field} placeholder="https://facebook.com/yourbusiness" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      
                      <FormField
                        control={form.control}
                        name="instagramUrl"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Your Instagram Profile Link:</FormLabel>
                            <FormControl>
                              <Input {...field} placeholder="https://instagram.com/yourbusiness" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      
                      <FormField
                        control={form.control}
                        name="tiktokUrl"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Your TikTok Profile Link:</FormLabel>
                            <FormControl>
                              <Input {...field} placeholder="https://tiktok.com/@yourbusiness" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      
                      <FormField
                        control={form.control}
                        name="otherPromoUrl"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Other Promotional Link:</FormLabel>
                            <FormControl>
                              <Input {...field} placeholder="https://" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  )}
                  
                  {form.watch("hasProvidedPromoInfo") === true && (
                    <div className="bg-muted/50 p-4 rounded-md border">
                      <p className="text-sm">
                        I understand set up will begin at (see flyer) Moss Point River Front located at Main Street, Moss Point, Mississippi. 
                        Sales Tax Reports Return your Mississippi Department of Revenue (DOR) sales tax form with payment to the 
                        Main Street representative before leaving. All participants must submit a signed and dated sales tax report form. 
                        This includes zero sales, non-profits, those who pay online, and exempt vendors. Exempt vendors must include 
                        a copy of their DOR exemption letter with the sales tax form.
                      </p>
                      <p className="text-sm font-semibold mt-4">
                        I understand that I am REQUIRED to stay the entire duration of the event. 
                        Vendors will not be allowed to leave until the event is over.
                      </p>
                      <p className="text-sm mt-4">
                        The application and payment are due a week prior to the event.
                      </p>
                    </div>
                  )}
                </div>
                
                {/* Products Description */}
                <div className="space-y-4 pt-4 border-t border-border">
                  <FormField
                    control={form.control}
                    name="productsDescription"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-lg font-medium">Please describe your products and/or services:</FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder="Tell us about what you'll be selling or offering at the event..."
                            className="min-h-24"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                
                {/* Event logistics */}
                <div className="space-y-4 pt-4 border-t border-border">
                  <h3 className="text-lg font-medium">Vendor Needs</h3>
                  
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
                </div>
                
                {/* Terms and Conditions */}
                <div className="pt-4 border-t border-border">
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
                </div>
                
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