import { createContext, ReactNode, useContext, useEffect, useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { Product } from "@shared/schema";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";

export type CartItem = {
  id: string; // Unique identifier for the cart item
  productId: number;
  quantity: number;
  product: Product;
  registrationData?: any; // Data from vendor/volunteer registration forms
};

type CartContextType = {
  items: CartItem[];
  addItem: (product: Product, quantity?: number) => void;
  updateItem: (id: string, quantity: number) => void;
  removeItem: (id: string) => void;
  clearCart: () => void;
  itemCount: number;
  total: number;
  updateRegistrationData: (itemId: string, data: any) => void;
  getRegistrationStatus: (itemId: string) => 'pending' | 'complete' | null;
  setRegistrationStatus: (itemId: string, status: 'pending' | 'complete', data?: any) => void;
  getCartItem: (id: string) => CartItem | undefined;
  needsRegistration: () => boolean;
  getNextRegistrationPath: () => string;
  getNextRegistrationPathExcluding: (excludeItemId: string) => string;
  needsRegistrationExcluding: (excludeItemId: string) => boolean;
  getSmartCartNextAction: () => { action: 'register' | 'checkout', path: string, message: string };
  checkoutMutation: any;
  hasRegistrationType: (type: string) => boolean;
  hasItemOfType: (type: string) => boolean;
};

export const CartContext = createContext<CartContextType | null>(null);

export function CartProvider({ children }: { children: ReactNode }) {
  const { toast } = useToast();
  const { user } = useAuth();
  const [items, setItems] = useState<CartItem[]>([]);

  // Load cart from local storage on initial load
  useEffect(() => {
    const savedCart = localStorage.getItem('cart');
    if (savedCart) {
      try {
        setItems(JSON.parse(savedCart));
      } catch (error) {
        console.error('Failed to parse cart from localStorage', error);
        localStorage.removeItem('cart');
      }
    }
  }, []);

  // Save cart to local storage whenever it changes
  useEffect(() => {
    localStorage.setItem('cart', JSON.stringify(items));
  }, [items]);

  // Add an item to the cart
  const addItem = (product: Product, quantity = 1) => {
    setItems(prevItems => {
      // Check if product already exists in cart
      const existingItem = prevItems.find(item => item.productId === product.id);

      if (existingItem) {
        // Update quantity if item exists
        return prevItems.map(item => 
          item.productId === product.id 
            ? { ...item, quantity: item.quantity + quantity } 
            : item
        );
      } else {
        // Add new item
        const newItem: CartItem = {
          id: `${Date.now()}-${product.id}`, // Generate a unique ID
          productId: product.id,
          quantity,
          product,
          registrationData: null
        };
        
        toast({
          title: 'Added to cart',
          description: `${product.name} added to your cart.`,
        });

        return [...prevItems, newItem];
      }
    });
  };

  // Update an item's quantity
  const updateItem = (id: string, quantity: number) => {
    setItems(prevItems => 
      prevItems.map(item => 
        item.id === id ? { ...item, quantity } : item
      )
    );
  };

  // Remove an item from the cart
  const removeItem = (id: string) => {
    setItems(prevItems => prevItems.filter(item => item.id !== id));
  };

  // Clear the entire cart
  const clearCart = () => {
    setItems([]);
    localStorage.removeItem('cart');
  };

  // Update registration data for an item
  const updateRegistrationData = (itemId: string, data: any) => {
    setItems(prevItems => 
      prevItems.map(item => 
        item.id === itemId ? { ...item, registrationData: data } : item
      )
    );
  };

  // Get registration status for an item
  const getRegistrationStatus = (itemId: string): 'pending' | 'complete' | null => {
    const item = items.find(item => item.id === itemId);
    
    if (!item) return null;
    
    // If product is vendor_spot or volunteer_shift and requires registration data
    if (['vendor_spot', 'volunteer_shift'].includes(item.product.type)) {
      return item.registrationData ? 'complete' : 'pending';
    }
    
    return null; // No registration needed
  };

  // Check if cart has items of a specific type
  const hasItemOfType = (type: string): boolean => {
    return items.some(item => item.product.type === type);
  };

  // Check if cart has items that require registration of a specific type
  const hasRegistrationType = (type: string): boolean => {
    if (type === 'vendor') {
      return hasItemOfType('vendor_spot');
    } else if (type === 'volunteer') {
      return hasItemOfType('volunteer_shift');
    }
    return false;
  };
  
  // Get a cart item by ID
  const getCartItem = (id: string): CartItem | undefined => {
    return items.find(item => item.id === id);
  };

  // Set registration status for an item
  const setRegistrationStatus = (itemId: string, status: 'pending' | 'complete', data?: any) => {
    setItems(prevItems => 
      prevItems.map(item => 
        item.id === itemId ? { 
          ...item, 
          registrationData: status === 'complete' ? (data || true) : null 
        } : item
      )
    );
  };
  
  // Check if any items in the cart need registration
  const needsRegistration = (): boolean => {
    return items.some(item => {
      const status = getRegistrationStatus(item.id);
      return status === 'pending';
    });
  };
  
  // Get path to the next item that needs registration
  const getNextRegistrationPath = (): string => {
    // Find first vendor item that needs registration
    const pendingVendorItem = items.find(item => 
      item.product.type === 'vendor_spot' && getRegistrationStatus(item.id) === 'pending'
    );
    
    if (pendingVendorItem) {
      return `/registration/vendor/${pendingVendorItem.id}`;
    }
    
    // Find first volunteer item that needs registration
    const pendingVolunteerItem = items.find(item => 
      item.product.type === 'volunteer_shift' && getRegistrationStatus(item.id) === 'pending'
    );
    
    if (pendingVolunteerItem) {
      return `/registration/volunteer/${pendingVolunteerItem.id}`;
    }
    
    // If no registrations needed, go to checkout
    return '/checkout';
  };

  // Get next registration path excluding a specific item (for post-completion navigation)
  const getNextRegistrationPathExcluding = (excludeItemId: string): string => {
    // Find first vendor item that needs registration (excluding the specified item)
    const pendingVendorItem = items.find(item => 
      item.id !== excludeItemId &&
      item.product.type === 'vendor_spot' && 
      getRegistrationStatus(item.id) === 'pending'
    );
    
    if (pendingVendorItem) {
      return `/registration/vendor/${pendingVendorItem.id}`;
    }
    
    // Find first volunteer item that needs registration (excluding the specified item)
    const pendingVolunteerItem = items.find(item => 
      item.id !== excludeItemId &&
      item.product.type === 'volunteer_shift' && 
      getRegistrationStatus(item.id) === 'pending'
    );
    
    if (pendingVolunteerItem) {
      return `/registration/volunteer/${pendingVolunteerItem.id}`;
    }
    
    // If no registrations needed, go to checkout
    return '/checkout';
  };

  // Check if any items need registration excluding a specific item
  const needsRegistrationExcluding = (excludeItemId: string): boolean => {
    return items.some(item => {
      if (item.id === excludeItemId) return false; // Skip the excluded item
      const status = getRegistrationStatus(item.id);
      return status === 'pending';
    });
  };

  // Smart cart - determines what to do next in the cart flow based on cart contents
  const getSmartCartNextAction = (): { action: 'register' | 'checkout', path: string, message: string } => {
    // Check if cart has any items that need registration
    if (needsRegistration()) {
      const path = getNextRegistrationPath();
      const isVendorRegistration = path.includes('/registration/vendor/');
      const isVolunteerRegistration = path.includes('/registration/volunteer/');
      
      let message = "Please complete registration before checkout";
      
      if (isVendorRegistration) {
        message = "Please complete vendor registration before proceeding to checkout";
      } else if (isVolunteerRegistration) {
        message = "Please complete volunteer registration before proceeding to checkout";
      }
      
      return {
        action: 'register',
        path,
        message
      };
    }
    
    // If no registrations needed, proceed to checkout
    return {
      action: 'checkout',
      path: '/checkout',
      message: "Proceeding to checkout"
    };
  };

  // Calculate total number of items
  const itemCount = items.reduce((sum, item) => sum + item.quantity, 0);

  // Calculate total cost
  const total = items.reduce((sum, item) => sum + (item.product.price * item.quantity), 0);

  // Checkout mutation
  const checkoutMutation = useMutation({
    mutationFn: async () => {
      // Prepare order data
      const orderData = {
        items: items.map(item => ({
          productId: item.productId,
          quantity: item.quantity,
          registrationData: item.registrationData
        }))
      };
      
      const res = await apiRequest("POST", "/api/checkout", orderData);
      return await res.json();
    },
    onSuccess: (data) => {
      // Clear cart after successful checkout
      clearCart();
      
      // Navigate to the checkout success page or payment gateway
      if (data.checkoutUrl) {
        window.location.href = data.checkoutUrl;
      }
    },
    onError: (error: Error) => {
      toast({
        title: "Checkout failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  return (
    <CartContext.Provider
      value={{
        items,
        addItem,
        updateItem,
        removeItem,
        clearCart,
        itemCount,
        total,
        updateRegistrationData,
        getRegistrationStatus,
        setRegistrationStatus,
        getCartItem,
        needsRegistration,
        getNextRegistrationPath,
        getNextRegistrationPathExcluding,
        needsRegistrationExcluding,
        getSmartCartNextAction,
        checkoutMutation,
        hasRegistrationType,
        hasItemOfType
      }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error("useCart must be used within a CartProvider");
  }
  return context;
}