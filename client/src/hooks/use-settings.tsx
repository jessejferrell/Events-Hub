import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";

// Type definitions
interface SystemSetting {
  id: number;
  key: string;
  value: any;
  category: string;
  createdAt: Date;
  updatedAt: Date;
  updatedBy: number;
}

interface UpdateSettingParams {
  key: string;
  value: any;
  category?: string;
}

// Define cache keys
const SETTINGS_CACHE_KEY = (category?: string) => 
  category ? ["/api/admin/settings", category] : ["/api/admin/settings"];

export function useSettings(category?: string) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isDeleting, setIsDeleting] = useState<boolean>(false);

  // Fetch settings query
  const { 
    data: settings = [],
    isLoading,
    error,
    refetch
  } = useQuery<SystemSetting[]>({
    queryKey: SETTINGS_CACHE_KEY(category),
    queryFn: async () => {
      const url = category 
        ? `/api/admin/settings?category=${encodeURIComponent(category)}` 
        : '/api/admin/settings';
      const res = await fetch(url);
      
      if (!res.ok) {
        throw new Error("Failed to fetch settings");
      }
      
      return res.json();
    }
  });

  // Update setting mutation
  const { mutate: updateSetting, isPending: isUpdating } = useMutation({
    mutationFn: async (params: UpdateSettingParams) => {
      const { key, value, category: settingCategory = category } = params;
      
      const res = await apiRequest(
        "PUT", 
        `/api/admin/settings/${encodeURIComponent(key)}`,
        { value, category: settingCategory }
      );
      
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.message || "Failed to update setting");
      }
      
      return res.json();
    },
    onSuccess: (data, variables) => {
      // Invalidate the settings cache
      queryClient.invalidateQueries({ queryKey: SETTINGS_CACHE_KEY(variables.category) });
      
      toast({
        title: "Setting updated",
        description: `Successfully updated ${variables.key}`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to update setting",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Delete setting mutation (implemented as a function to handle confirmation)
  const deleteSetting = async (key: string) => {
    try {
      setIsDeleting(true);
      
      const res = await apiRequest(
        "DELETE", 
        `/api/admin/settings/${encodeURIComponent(key)}`,
        {}
      );
      
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.message || "Failed to delete setting");
      }
      
      // Invalidate the settings cache
      queryClient.invalidateQueries({ queryKey: SETTINGS_CACHE_KEY(category) });
      
      toast({
        title: "Setting deleted",
        description: `Successfully deleted ${key}`,
      });
    } catch (error: any) {
      toast({
        title: "Failed to delete setting",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsDeleting(false);
    }
  };

  return {
    settings,
    isLoading,
    error,
    refetch,
    updateSetting,
    isUpdating,
    deleteSetting,
    isDeleting,
  };
}