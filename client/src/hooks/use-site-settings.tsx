import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { z } from "zod";

// Site settings type definitions
export interface SiteSetting {
  id: number;
  key: string;
  value: any;
  createdAt: string;
  updatedAt: string;
}

// Define Zod schemas for specific setting types
const ColorSettingsSchema = z.object({
  primary: z.string().regex(/^#[0-9A-Fa-f]{6}$/, "Must be a valid hex color code"),
  secondary: z.string().regex(/^#[0-9A-Fa-f]{6}$/, "Must be a valid hex color code"),
  accent: z.string().regex(/^#[0-9A-Fa-f]{6}$/, "Must be a valid hex color code"),
}).default({
  primary: '#00a99d',   // Default teal
  secondary: '#8a4fff', // Default purple
  accent: '#f0e6ff',    // Default light purple
});

const OrgSettingsSchema = z.object({
  name: z.string().min(1, "Organization name is required"),
  logo: z.string().url("Logo must be a valid URL").optional(),
  contactEmail: z.string().email("Must be a valid email").optional(),
  contactPhone: z.string().optional(),
  address: z.string().optional(),
});

// Export type definitions for use in components
export type ColorSettings = z.infer<typeof ColorSettingsSchema>;
export type OrgSettings = z.infer<typeof OrgSettingsSchema>;

export function useSiteSettings() {
  const { toast } = useToast();
  
  // Fetch all site settings
  const { data: settings, isLoading, error } = useQuery({
    queryKey: ["/api/site-settings"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/site-settings");
      return await res.json();
    }
  });
  
  // Create or update a site setting
  const updateMutation = useMutation({
    mutationFn: async ({ key, value }: { key: string, value: any }) => {
      const res = await apiRequest("POST", "/api/site-settings", { key, value });
      return await res.json();
    },
    onSuccess: () => {
      // Invalidate the query to refresh settings
      queryClient.invalidateQueries({ queryKey: ["/api/site-settings"] });
      toast({
        title: "Settings updated",
        description: "Your changes have been saved",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to update settings",
        description: error.message,
        variant: "destructive",
      });
    }
  });
  
  // Delete a site setting
  const deleteMutation = useMutation({
    mutationFn: async (key: string) => {
      const res = await apiRequest("DELETE", `/api/site-settings/${key}`);
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/site-settings"] });
      toast({
        title: "Setting removed",
        description: "Setting has been deleted",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to delete setting",
        description: error.message,
        variant: "destructive",
      });
    }
  });
  
  // Helper function to get a specific setting value
  const getSetting = (key: string): any => {
    if (!settings) return null;
    const setting = settings.find((s: SiteSetting) => s.key === key);
    return setting ? setting.value : null;
  };
  
  // Update a site setting with validation
  const updateSetting = (key: string, value: any, schema?: z.ZodTypeAny) => {
    try {
      // Validate against schema if provided
      if (schema) {
        const validatedValue = schema.parse(value);
        updateMutation.mutate({ key, value: validatedValue });
      } else {
        updateMutation.mutate({ key, value });
      }
    } catch (error) {
      if (error instanceof z.ZodError) {
        toast({
          title: "Validation error",
          description: error.errors[0].message,
          variant: "destructive",
        });
      } else {
        toast({
          title: "Error",
          description: "An unexpected error occurred",
          variant: "destructive",
        });
      }
    }
  };
  
  return {
    settings,
    isLoading,
    error,
    getSetting,
    updateSetting,
    deleteSetting: deleteMutation.mutate,
    ColorSettingsSchema,
    OrgSettingsSchema,
  };
}