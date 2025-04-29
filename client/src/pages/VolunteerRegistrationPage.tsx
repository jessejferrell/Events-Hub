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
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue 
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2 } from "lucide-react";

// Form schema for volunteer registration
const volunteerFormSchema = z.object({
  skills: z.string().min(2, "Please list your skills"),
  experience: z.string().min(10, "Please provide a brief summary of your experience"),
  availabilityNotes: z.string().optional(),
  emergencyContact: z.string().min(2, "Emergency contact is required"),
  emergencyPhone: z.string().min(10, "Please provide a valid emergency contact phone"),
  tshirtSize: z.string().min(1, "Please select a t-shirt size"),
  dietaryRestrictions: z.string().optional(),
  agreeToTerms: z.boolean().refine(val => val === true, {
    message: "You must agree to the terms and conditions",
  }),
});

type VolunteerFormValues = z.infer<typeof volunteerFormSchema>;

export default function VolunteerRegistrationPage() {
  const { id } = useParams<{ id: string }>();
  const { toast } = useToast();
  const { user } = useAuth();
  const { items, updateRegistrationData } = useCart();
  const [, navigate] = useLocation();

  // Find the cart item
  const cartItem = items.find(item => item.id === id);
  
  // Get existing volunteer profile if any
  const { data: existingProfile, isLoading: isLoadingProfile } = useQuery({
    queryKey: ["/api/volunteer-profile"],
    queryFn: async () => {
      try {
        const res = await apiRequest("GET", "/api/volunteer-profile");
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

  // Create or update volunteer profile mutation
  const profileMutation = useMutation({
    mutationFn: async (formData: VolunteerFormValues) => {
      const profileData = {
        userId: user?.id,
        skills: JSON.stringify(formData.skills.split(',').map(s => s.trim())),
        experience: formData.experience,
        availability: JSON.stringify({
          notes: formData.availabilityNotes
        }),
        emergencyContact: formData.emergencyContact,
        emergencyPhone: formData.emergencyPhone,
        tshirtSize: formData.tshirtSize,
        dietaryRestrictions: formData.dietaryRestrictions || "",
        metadata: {
          termsAccepted: formData.agreeToTerms,
          termsAcceptedDate: new Date().toISOString(),
        },
      };
      
      const endpoint = existingProfile 
        ? `/api/volunteer-profile/${existingProfile.id}` 
        : "/api/volunteer-profile";
      
      const method = existingProfile ? "PUT" : "POST";
      
      const res = await apiRequest(method, endpoint, profileData);
      return await res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/volunteer-profile"] });
      
      // Update cart item with registration data
      if (cartItem) {
        updateRegistrationData(id, {
          volunteerProfileId: data.id,
          notes: form.getValues().availabilityNotes || "",
          status: "pending",
        });
        
        toast({
          title: "Registration saved",
          description: "Your volunteer information has been saved. Continuing to checkout.",
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

  // Parse skills from JSON if needed
  const parseSkills = (profile: any) => {
    if (!profile || !profile.skills) return "";
    try {
      const skillsArray = typeof profile.skills === 'string' 
        ? JSON.parse(profile.skills) 
        : profile.skills;
      return Array.isArray(skillsArray) ? skillsArray.join(", ") : "";
    } catch (e) {
      return typeof profile.skills === 'string' ? profile.skills : "";
    }
  };

  // Parse availability notes from JSON if needed
  const parseAvailabilityNotes = (profile: any) => {
    if (!profile || !profile.availability) return "";
    try {
      const availability = typeof profile.availability === 'string'
        ? JSON.parse(profile.availability)
        : profile.availability;
      return availability.notes || "";
    } catch (e) {
      return "";
    }
  };

  // Form setup with default values
  const form = useForm<VolunteerFormValues>({
    resolver: zodResolver(volunteerFormSchema),
    defaultValues: {
      skills: parseSkills(existingProfile),
      experience: existingProfile?.experience || "",
      availabilityNotes: parseAvailabilityNotes(existingProfile),
      emergencyContact: existingProfile?.emergencyContact || "",
      emergencyPhone: existingProfile?.emergencyPhone || "",
      tshirtSize: existingProfile?.tshirtSize || "",
      dietaryRestrictions: existingProfile?.dietaryRestrictions || "",
      agreeToTerms: false,
    },
  });
  
  // Update form when profile data loads
  useEffect(() => {
    if (existingProfile) {
      form.reset({
        skills: parseSkills(existingProfile),
        experience: existingProfile.experience || "",
        availabilityNotes: parseAvailabilityNotes(existingProfile),
        emergencyContact: existingProfile.emergencyContact || "",
        emergencyPhone: existingProfile.emergencyPhone || "",
        tshirtSize: existingProfile.tshirtSize || "",
        dietaryRestrictions: existingProfile.dietaryRestrictions || "",
        agreeToTerms: false,
      });
    }
  }, [existingProfile, form]);

  // Redirect to home if cart item not found
  useEffect(() => {
    if (!cartItem) {
      toast({
        title: "Item not found",
        description: "We couldn't find the volunteer registration in your cart.",
        variant: "destructive",
      });
      navigate("/");
    }
  }, [cartItem, toast, navigate]);

  // Form submission handler
  const onSubmit = (values: VolunteerFormValues) => {
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
          <CardTitle>Volunteer Registration</CardTitle>
          <CardDescription>
            Please provide your information to volunteer for {cartItem?.product.name}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <FormField
                control={form.control}
                name="skills"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Skills</FormLabel>
                    <FormControl>
                      <Input placeholder="Photography, Social Media, Event Setup, etc." {...field} />
                    </FormControl>
                    <FormDescription>
                      List skills separated by commas
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="experience"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Experience</FormLabel>
                    <FormControl>
                      <Textarea 
                        placeholder="Tell us about your previous volunteer experience" 
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
                name="availabilityNotes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Availability Notes (Optional)</FormLabel>
                    <FormControl>
                      <Textarea 
                        placeholder="Any notes about your availability during the event?" 
                        className="min-h-[80px]" 
                        {...field} 
                      />
                    </FormControl>
                    <FormDescription>
                      E.g., "I can only volunteer in the mornings" or "I need breaks every 2 hours"
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <FormField
                  control={form.control}
                  name="emergencyContact"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Emergency Contact Name</FormLabel>
                      <FormControl>
                        <Input placeholder="Full name" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="emergencyPhone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Emergency Contact Phone</FormLabel>
                      <FormControl>
                        <Input placeholder="(555) 123-4567" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <FormField
                  control={form.control}
                  name="tshirtSize"
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
                          <SelectItem value="2XL">2XL</SelectItem>
                          <SelectItem value="3XL">3XL</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormDescription>
                        For your volunteer t-shirt
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="dietaryRestrictions"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Dietary Restrictions (Optional)</FormLabel>
                      <FormControl>
                        <Input placeholder="Vegetarian, Gluten-free, etc." {...field} />
                      </FormControl>
                      <FormDescription>
                        For event meals/snacks
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              
              <FormField
                control={form.control}
                name="agreeToTerms"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
                    <FormControl>
                      <Checkbox
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                    <div className="space-y-1 leading-none">
                      <FormLabel>I agree to the volunteer terms and conditions</FormLabel>
                      <FormDescription>
                        By checking this box, you agree to abide by all event volunteer guidelines
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