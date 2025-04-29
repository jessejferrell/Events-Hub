import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { SystemSetting } from "@shared/schema";

export function useSettings(category?: string) {
  const { toast } = useToast();
  
  const settingsQuery = useQuery<SystemSetting[]>({
    queryKey: ["/api/settings", category],
    queryFn: async () => {
      const url = category ? `/api/settings?category=${encodeURIComponent(category)}` : "/api/settings";
      const res = await apiRequest("GET", url);
      return res.json();
    },
  });

  const updateSettingMutation = useMutation({
    mutationFn: async ({ key, value, category }: { key: string; value: any; category: string }) => {
      const res = await apiRequest("POST", "/api/settings", { key, value, category });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/settings"] });
      toast({
        title: "Setting updated",
        description: "The system setting has been updated successfully",
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

  const deleteSettingMutation = useMutation({
    mutationFn: async (key: string) => {
      await apiRequest("DELETE", `/api/settings/${encodeURIComponent(key)}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/settings"] });
      toast({
        title: "Setting deleted",
        description: "The system setting has been deleted successfully",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to delete setting",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  return {
    settings: settingsQuery.data || [],
    isLoading: settingsQuery.isLoading,
    error: settingsQuery.error,
    updateSetting: updateSettingMutation.mutate,
    deleteSetting: deleteSettingMutation.mutate,
    isUpdating: updateSettingMutation.isPending,
    isDeleting: deleteSettingMutation.isPending,
  };
}