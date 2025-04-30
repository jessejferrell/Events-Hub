import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

export interface SiteSetting {
  id: number;
  key: string;
  value: any;
  createdAt: string;
  updatedAt: string;
}

export function useSiteSettings() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  
  // Get all site settings
  const { 
    data: settings, 
    isLoading, 
    error 
  } = useQuery<SiteSetting[]>({
    queryKey: ["/api/site-settings"],
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
  
  // Get a specific setting by key
  const getSetting = (key: string) => {
    return settings?.find(setting => setting.key === key)?.value;
  };
  
  // Create or update a site setting
  const updateSettingMutation = useMutation({
    mutationFn: async ({ key, value }: { key: string; value: any }) => {
      const res = await apiRequest("POST", `/api/site-settings/${key}`, { value });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/site-settings"] });
      toast({
        title: "Setting updated",
        description: "Site setting has been updated successfully.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Update failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });
  
  // Delete a site setting
  const deleteSettingMutation = useMutation({
    mutationFn: async (key: string) => {
      await apiRequest("DELETE", `/api/site-settings/${key}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/site-settings"] });
      toast({
        title: "Setting deleted",
        description: "Site setting has been deleted successfully.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Delete failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });
  
  return {
    settings,
    isLoading,
    error,
    getSetting,
    updateSetting: updateSettingMutation.mutate,
    deleteSetting: deleteSettingMutation.mutate,
    isUpdating: updateSettingMutation.isPending,
    isDeleting: deleteSettingMutation.isPending,
  };
}