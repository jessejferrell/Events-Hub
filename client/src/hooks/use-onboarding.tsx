import React, { createContext, useContext, useState, useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useMutation, useQuery } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { UserOnboarding } from "@shared/schema";

// Define the steps for the onboarding process
export type OnboardingStep = {
  id: string;
  title: string;
  description: string;
  elementId: string; // The ID of the element to attach the tooltip to
  position: "top" | "right" | "bottom" | "left" | "top-right" | "top-left" | "bottom-right" | "bottom-left";
  route?: string; // The route where this step should be shown
  requiresAuth?: boolean; // Whether this step requires authentication
  requiredRole?: string; // Required role for this step (if any)
};

export const ONBOARDING_STEPS: OnboardingStep[] = [
  {
    id: "welcome",
    title: "Welcome to City Event Hub!",
    description: "Let's take a quick tour to help you get familiar with the platform.",
    elementId: "navbar",
    position: "bottom",
    route: "/",
  },
  {
    id: "browse_events",
    title: "Browse Events",
    description: "Click here to discover upcoming events in your community.",
    elementId: "browse-events-link",
    position: "bottom",
    route: "/",
  },
  {
    id: "create_account",
    title: "Create an Account",
    description: "Sign up to purchase tickets, register as a vendor, or volunteer for events.",
    elementId: "auth-button",
    position: "bottom-left",
    route: "/",
  },
  {
    id: "profile_settings",
    title: "Profile Settings",
    description: "Manage your personal information, view your tickets, and track your registrations.",
    elementId: "profile-link",
    position: "bottom-left",
    route: "/",
    requiresAuth: true,
  },
  {
    id: "create_event",
    title: "Create Your Own Event",
    description: "As an event owner, you can create and manage your events here.",
    elementId: "create-event-link",
    position: "bottom",
    route: "/my-events",
    requiresAuth: true,
    requiredRole: "event_owner",
  },
  {
    id: "admin_dashboard",
    title: "Admin Dashboard",
    description: "Access administrative tools and reports to manage the platform.",
    elementId: "admin-dashboard-link",
    position: "bottom",
    route: "/admin",
    requiresAuth: true,
    requiredRole: "admin",
  },
];

interface OnboardingContextType {
  currentStep: number;
  activeTooltip: string | null;
  isOnboardingComplete: boolean;
  completedSteps: Record<string, boolean>;
  dismissedTooltips: Record<string, boolean>;
  startOnboarding: () => void;
  completeOnboarding: () => void;
  goToNextStep: () => void;
  goToPreviousStep: () => void;
  dismissTooltip: (stepId: string) => void;
  markStepComplete: (stepId: string) => void;
  resetOnboarding: () => void;
  showTooltip: (stepId: string) => void;
}

export const OnboardingContext = createContext<OnboardingContextType | null>(null);

export function OnboardingProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [currentStep, setCurrentStep] = useState(0);
  const [activeTooltip, setActiveTooltip] = useState<string | null>(null);
  const [completedSteps, setCompletedSteps] = useState<Record<string, boolean>>({});
  const [dismissedTooltips, setDismissedTooltips] = useState<Record<string, boolean>>({});
  const [isOnboardingComplete, setIsOnboardingComplete] = useState(false);

  // Fetch user onboarding data if authenticated
  const { data: onboardingData } = useQuery<UserOnboarding>({
    queryKey: ["/api/onboarding"],
    enabled: !!user, // Use !!user instead of isAuthenticated
  });

  // Update onboarding mutation
  const updateOnboardingMutation = useMutation({
    mutationFn: async (data: Partial<UserOnboarding>) => {
      const res = await apiRequest("PATCH", "/api/onboarding", data);
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/onboarding"] });
    },
  });

  // Initialize onboarding state from server data
  useEffect(() => {
    if (onboardingData) {
      setCompletedSteps(onboardingData.completedSteps as Record<string, boolean> || {});
      setDismissedTooltips(onboardingData.dismissedTooltips as Record<string, boolean> || {});
      setIsOnboardingComplete(onboardingData.onboardingComplete);
      
      if (onboardingData.lastStep) {
        const stepIndex = ONBOARDING_STEPS.findIndex(step => step.id === onboardingData.lastStep);
        if (stepIndex >= 0) {
          setCurrentStep(stepIndex);
        }
      }
    }
  }, [onboardingData]);

  // Start the onboarding process
  const startOnboarding = () => {
    setCurrentStep(0);
    setIsOnboardingComplete(false);
    showTooltip(ONBOARDING_STEPS[0].id);
    
    if (user) {
      updateOnboardingMutation.mutate({
        onboardingComplete: false,
        lastStep: ONBOARDING_STEPS[0].id,
      });
    }
  };

  // Complete the onboarding process
  const completeOnboarding = () => {
    setActiveTooltip(null);
    setIsOnboardingComplete(true);
    
    if (user) {
      updateOnboardingMutation.mutate({
        onboardingComplete: true,
      });
    }
  };

  // Go to the next onboarding step
  const goToNextStep = () => {
    const currentStepId = ONBOARDING_STEPS[currentStep].id;
    markStepComplete(currentStepId);
    
    if (currentStep < ONBOARDING_STEPS.length - 1) {
      const nextStep = currentStep + 1;
      setCurrentStep(nextStep);
      
      const nextStepId = ONBOARDING_STEPS[nextStep].id;
      showTooltip(nextStepId);
      
      if (user) {
        updateOnboardingMutation.mutate({
          lastStep: nextStepId,
        });
      }
    } else {
      completeOnboarding();
    }
  };

  // Go to the previous onboarding step
  const goToPreviousStep = () => {
    if (currentStep > 0) {
      const prevStep = currentStep - 1;
      setCurrentStep(prevStep);
      
      const prevStepId = ONBOARDING_STEPS[prevStep].id;
      showTooltip(prevStepId);
      
      if (user) {
        updateOnboardingMutation.mutate({
          lastStep: prevStepId,
        });
      }
    }
  };

  // Dismiss a tooltip
  const dismissTooltip = (stepId: string) => {
    setActiveTooltip(null);
    setDismissedTooltips(prev => ({ ...prev, [stepId]: true }));
    
    if (user) {
      updateOnboardingMutation.mutate({
        dismissedTooltips: { ...dismissedTooltips, [stepId]: true },
      });
    }
  };

  // Mark a step as complete
  const markStepComplete = (stepId: string) => {
    setCompletedSteps(prev => ({ ...prev, [stepId]: true }));
    
    if (user) {
      updateOnboardingMutation.mutate({
        completedSteps: { ...completedSteps, [stepId]: true },
      });
    }
  };

  // Reset the onboarding process
  const resetOnboarding = () => {
    setCurrentStep(0);
    setActiveTooltip(null);
    setCompletedSteps({});
    setDismissedTooltips({});
    setIsOnboardingComplete(false);
    
    if (user) {
      updateOnboardingMutation.mutate({
        completedSteps: {},
        dismissedTooltips: {},
        onboardingComplete: false,
        lastStep: ONBOARDING_STEPS[0].id,
      });
    }
  };

  // Show a specific tooltip
  const showTooltip = (stepId: string) => {
    // Check if the tooltip has been dismissed
    if (dismissedTooltips[stepId]) {
      return;
    }
    
    // Find the step
    const stepIndex = ONBOARDING_STEPS.findIndex(step => step.id === stepId);
    if (stepIndex < 0) {
      return;
    }
    
    const step = ONBOARDING_STEPS[stepIndex];
    
    // Check if the step requires auth
    if (step.requiresAuth && !user) {
      return;
    }
    
    // Check if the step requires a specific role
    if (step.requiredRole && user?.role !== step.requiredRole) {
      return;
    }
    
    setCurrentStep(stepIndex);
    setActiveTooltip(stepId);
    
    if (user) {
      updateOnboardingMutation.mutate({
        lastStep: stepId,
      });
    }
  };

  return (
    <OnboardingContext.Provider
      value={{
        currentStep,
        activeTooltip,
        isOnboardingComplete,
        completedSteps,
        dismissedTooltips,
        startOnboarding,
        completeOnboarding,
        goToNextStep,
        goToPreviousStep,
        dismissTooltip,
        markStepComplete,
        resetOnboarding,
        showTooltip,
      }}
    >
      {children}
    </OnboardingContext.Provider>
  );
}

export function useOnboarding() {
  const context = useContext(OnboardingContext);
  if (!context) {
    throw new Error("useOnboarding must be used within an OnboardingProvider");
  }
  return context;
}