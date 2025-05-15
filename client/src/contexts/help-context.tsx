import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";

// Import illustrations
import paymentIllustration from "@/assets/illustrations/payment.svg";
import eventIllustration from "@/assets/illustrations/event.svg";
import connectIllustration from "@/assets/illustrations/connect.svg";
import settingsIllustration from "@/assets/illustrations/settings.svg";

// Define the shape of a help item
export interface HelpItem {
  id: string;
  title: string;
  content: string;
  illustration: string;
}

// Available help topics
const HELP_TOPICS = {
  STRIPE_CONNECT: "stripe_connect",
  EVENT_CREATION: "event_creation",
  TICKET_MANAGEMENT: "ticket_management",
  PAYMENT_PROCESSING: "payment_processing",
  VENDOR_REGISTRATION: "vendor_registration",
  ACCOUNT_SETTINGS: "account_settings",
  EVENT_TICKETS: "event_tickets",
  CHECKOUT: "checkout",
} as const;

export { HELP_TOPICS };

type HelpTopicKey = keyof typeof HELP_TOPICS;
type HelpTopicValue = typeof HELP_TOPICS[HelpTopicKey];

// Predefined help items
export const helpItems: Record<HelpTopicValue, HelpItem> = {
  [HELP_TOPICS.STRIPE_CONNECT]: {
    id: HELP_TOPICS.STRIPE_CONNECT,
    title: "Stripe Connect",
    content: "Connect your Stripe account to receive payments directly to your bank account. Event proceeds go straight to your account with no waiting period!",
    illustration: connectIllustration
  },
  [HELP_TOPICS.EVENT_CREATION]: {
    id: HELP_TOPICS.EVENT_CREATION,
    title: "Creating Events",
    content: "Create engaging events with detailed descriptions, custom images, and flexible ticket options to attract more attendees.",
    illustration: eventIllustration
  },
  [HELP_TOPICS.TICKET_MANAGEMENT]: {
    id: HELP_TOPICS.TICKET_MANAGEMENT,
    title: "Ticket Management",
    content: "Create different ticket types with various price points and availability windows to maximize your event's attendance and revenue.",
    illustration: eventIllustration
  },
  [HELP_TOPICS.PAYMENT_PROCESSING]: {
    id: HELP_TOPICS.PAYMENT_PROCESSING,
    title: "Payment Processing",
    content: "Securely process payments using Stripe. Set up pricing tiers, early bird specials, and group discounts to boost sales.",
    illustration: paymentIllustration
  },
  [HELP_TOPICS.VENDOR_REGISTRATION]: {
    id: HELP_TOPICS.VENDOR_REGISTRATION,
    title: "Vendor Management",
    content: "Allow vendors to register for your events with custom booth options, pricing, and requirements to create a diverse marketplace.",
    illustration: eventIllustration
  },
  [HELP_TOPICS.ACCOUNT_SETTINGS]: {
    id: HELP_TOPICS.ACCOUNT_SETTINGS,
    title: "Account Settings",
    content: "Manage your account preferences, notification settings, and connected services to customize your experience.",
    illustration: settingsIllustration
  },
  [HELP_TOPICS.EVENT_TICKETS]: {
    id: HELP_TOPICS.EVENT_TICKETS,
    title: "Event Tickets",
    content: "Purchase tickets to attend your favorite events. Select the quantity and complete your purchase securely.",
    illustration: eventIllustration
  },
  [HELP_TOPICS.CHECKOUT]: {
    id: HELP_TOPICS.CHECKOUT,
    title: "Checkout",
    content: "Complete your purchase securely with our streamlined checkout process. Your payment information is protected by Stripe's secure payment processing.",
    illustration: paymentIllustration
  }
};

// Context type definition
interface HelpContextType {
  isHelpEnabled: boolean;
  toggleHelp: () => void;
  getHelpItem: (topicId: HelpTopicValue) => HelpItem | undefined;
  showTooltips: boolean;
  setShowTooltips: (show: boolean) => void;
}

// Create the context
const HelpContext = createContext<HelpContextType | undefined>(undefined);

// Provider component
export function HelpProvider({ children }: { children: ReactNode }) {
  const [isHelpEnabled, setIsHelpEnabled] = useState(() => {
    // Initialize from localStorage if available
    const stored = localStorage.getItem("helpEnabled");
    return stored ? JSON.parse(stored) : true;
  });
  
  const [showTooltips, setShowTooltips] = useState(() => {
    // Initialize from localStorage if available
    const stored = localStorage.getItem("showTooltips");
    return stored ? JSON.parse(stored) : true;
  });

  // Persist help state to localStorage
  useEffect(() => {
    localStorage.setItem("helpEnabled", JSON.stringify(isHelpEnabled));
  }, [isHelpEnabled]);
  
  // Persist tooltips state to localStorage
  useEffect(() => {
    localStorage.setItem("showTooltips", JSON.stringify(showTooltips));
  }, [showTooltips]);

  const toggleHelp = () => {
    setIsHelpEnabled((prev: boolean) => !prev);
  };

  const getHelpItem = (topicId: HelpTopicValue): HelpItem | undefined => {
    return helpItems[topicId];
  };

  return (
    <HelpContext.Provider value={{ 
      isHelpEnabled, 
      toggleHelp, 
      getHelpItem,
      showTooltips,
      setShowTooltips 
    }}>
      {children}
    </HelpContext.Provider>
  );
}

// Custom hook for using the help context
export function useHelp() {
  const context = useContext(HelpContext);
  if (context === undefined) {
    throw new Error("useHelp must be used within a HelpProvider");
  }
  return context;
}