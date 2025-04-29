import { useEffect, useState } from "react";
import { useParams, useLocation } from "wouter";
import { useCart } from "@/hooks/use-cart";
import { useAuth } from "@/hooks/use-auth";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation } from "@tanstack/react-query";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Loader2 } from "lucide-react";

// Form schema for vendor registration
const vendorFormSchema = z.object({
  businessName: z.string().min(2, "Business name must be at least 2 characters"),
  businessDescription: z.string().min(10, "Please provide a description of your business"),
  productsDescription: z.string().min(10, "Please describe what products you'll be selling"),
  specialRequests: z.string().optional(),
  contactPhone: z.string().min(10, "Please provide a valid phone number"),
  businessWebsite: z.string().optional(),
  hasInsurance: z.boolean().optional(),
  agreeToTerms: z.boolean().refine(val => val === true, {
    message: "You must agree to the terms and conditions",
  }),
});

type VendorFormValues = z.infer<typeof vendorFormSchema>;

export default function VendorRegistrationPage() {
  const { id } = useParams<{ id: string }>();
  const { toast } = useToast();
  const { user } = useAuth();
  const { items, updateRegistrationData } = useCart();
  const [, navigate] = useLocation();

  // Find the cart item
  const cartItem = items.find(item => item.id === id);
  
  // Get existing vendor profile if any
  const { data: existingProfile, isLoading: isLoadingProfile } = useQuery({
    queryKey: ["/api/vendor-profile"],
    queryFn: async () => {
      try {
        const res = await apiRequest("GET", "/api/vendor-profile");
        if (res.status === 404) {
          return null; // No profile found, that's ok
        }
        return await res.json();
      } catch (error) {
        return null; // Handle no profile gracefully
      }
    },
    enabled: !!user,
  });

  // Create or update vendor profile mutation
  const profileMutation = useMutation({
    mutationFn: async (formData: VendorFormValues) => {
      const profileData = {
        userId: user?.id,
        businessName: formData.businessName,
        businessDescription: formData.businessDescription,
        contactPhone: formData.contactPhone,
        website: formData.businessWebsite || null,
        hasInsurance: formData.hasInsurance || false,
        metadata: {
          termsAccepted: formData.agreeToTerms,
          termsAcceptedDate: new Date().toISOString(),
        },
      };
      
      const endpoint = existingProfile 
        ? `/api/vendor-profile/${existingProfile.id}` 
        : "/api/vendor-profile";
      
      const method = existingProfile ? "PUT" : "POST";
      
      const res = await apiRequest(method, endpoint, profileData);
      return await res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/vendor-profile"] });
      
      // Update cart item with registration data
      if (cartItem) {
        updateRegistrationData(id, {
          vendorProfileId: data.id,
          productsDescription: form.getValues().productsDescription,
          specialRequests: form.getValues().specialRequests || "",
          status: "pending",
        });
        
        toast({
          title: "Registration saved",
          description: "Your vendor information has been saved. Continuing to checkout.",
        });
        
        // Navigate back to cart/checkout
        navigate("/checkout");
      }
    },
    onError: (error: Error) => {
      toast({
        title: "Registration failed",
        description: error.message,
        variant: "destructive",
      });
    }
  });

  // Form setup with default values
  const form = useForm<VendorFormValues>({
    resolver: zodResolver(vendorFormSchema),
    defaultValues: {
      businessName: existingProfile?.businessName || "",
      businessDescription: existingProfile?.businessDescription || "",
      productsDescription: cartItem?.registrationData?.productsDescription || "",
      specialRequests: cartItem?.registrationData?.specialRequests || "",
      contactPhone: existingProfile?.contactPhone || "",
      businessWebsite: existingProfile?.website || "",
      hasInsurance: existingProfile?.hasInsurance || false,
      agreeToTerms: false,
    },
  });
  
  // Update form when profile data loads
  useEffect(() => {
    if (existingProfile) {
      form.reset({
        businessName: existingProfile.businessName || "",
        businessDescription: existingProfile.businessDescription || "",
        productsDescription: cartItem?.registrationData?.productsDescription || "",
        specialRequests: cartItem?.registrationData?.specialRequests || "",
        contactPhone: existingProfile.contactPhone || "",
        businessWebsite: existingProfile.website || "",
        hasInsurance: existingProfile.hasInsurance || false,
        agreeToTerms: false,
      });
    }
  }, [existingProfile, cartItem, form]);

  // Redirect to home if cart item not found
  useEffect(() => {
    if (!cartItem) {
      toast({
        title: "Item not found",
        description: "We couldn't find the vendor registration in your cart.",
        variant: "destructive",
      });
      navigate("/");
    }
  }, [cartItem, toast, navigate]);

  // Form submission handler
  const onSubmit = (values: VendorFormValues) => {
    profileMutation.mutate(values);
  };

  if (isLoadingProfile) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="container max-w-3xl py-8">
      <Card>
        <CardHeader>
          <CardTitle>Vendor Registration</CardTitle>
          <CardDescription>
            Please provide your vendor information for {cartItem?.product.name}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <FormField
                control={form.control}
                name="businessName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Business Name</FormLabel>
                    <FormControl>
                      <Input placeholder="Your business name" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="businessDescription"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Business Description</FormLabel>
                    <FormControl>
                      <Textarea 
                        placeholder="Tell us about your business" 
                        className="min-h-[100px]" 
                        {...field} 
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="productsDescription"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Products You'll Be Selling</FormLabel>
                    <FormControl>
                      <Textarea 
                        placeholder="What products will you be selling at this event?" 
                        className="min-h-[100px]" 
                        {...field} 
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="specialRequests"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Special Requests (Optional)</FormLabel>
                    <FormControl>
                      <Textarea 
                        placeholder="Any special requirements for your booth?" 
                        className="min-h-[80px]" 
                        {...field} 
                      />
                    </FormControl>
                    <FormDescription>
                      E.g., electricity needs, space requirements, etc.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <FormField
                  control={form.control}
                  name="contactPhone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Contact Phone</FormLabel>
                      <FormControl>
                        <Input placeholder="(555) 123-4567" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="businessWebsite"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Business Website (Optional)</FormLabel>
                      <FormControl>
                        <Input placeholder="https://yourbusiness.com" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              
              <FormField
                control={form.control}
                name="hasInsurance"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
                    <FormControl>
                      <input
                        type="checkbox"
                        className="h-4 w-4 mt-1"
                        checked={field.value}
                        onChange={field.onChange}
                      />
                    </FormControl>
                    <div className="space-y-1 leading-none">
                      <FormLabel>I have business liability insurance</FormLabel>
                      <FormDescription>
                        Some events may require proof of insurance
                      </FormDescription>
                    </div>
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="agreeToTerms"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
                    <FormControl>
                      <input
                        type="checkbox"
                        className="h-4 w-4 mt-1"
                        checked={field.value}
                        onChange={field.onChange}
                      />
                    </FormControl>
                    <div className="space-y-1 leading-none">
                      <FormLabel>I agree to the terms and conditions</FormLabel>
                      <FormDescription>
                        By checking this box, you agree to abide by all event rules and regulations
                      </FormDescription>
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <div className="flex justify-between">
                <Button 
                  type="button" 
                  variant="outline"
                  onClick={() => navigate("/")}
                >
                  Cancel
                </Button>
                <Button 
                  type="submit"
                  disabled={profileMutation.isPending}
                >
                  {profileMutation.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    "Save and Continue"
                  )}
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}