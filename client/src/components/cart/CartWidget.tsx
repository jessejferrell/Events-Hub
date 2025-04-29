import { useCart } from "@/hooks/use-cart";
import { ShoppingBag } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { CartItem } from "@/hooks/use-cart";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
  SheetFooter,
  SheetClose,
} from "@/components/ui/sheet";
import { Separator } from "@/components/ui/separator";
import { Link, useLocation } from "wouter";
import { cn } from "@/lib/utils";

export function CartWidget() {
  const { items, itemCount, total, removeItem, hasRegistrationType } = useCart();
  const [, navigate] = useLocation();
  const [isOpen, setIsOpen] = useState(false);

  if (itemCount === 0) {
    return (
      <Button 
        variant="ghost" 
        size="icon" 
        className="relative"
        onClick={() => setIsOpen(true)}
      >
        <ShoppingBag className="h-5 w-5" />
      </Button>
    );
  }

  return (
    <Sheet open={isOpen} onOpenChange={setIsOpen}>
      <SheetTrigger asChild>
        <Button 
          variant="ghost" 
          size="icon" 
          className="relative"
        >
          <ShoppingBag className="h-5 w-5" />
          <Badge 
            variant="secondary" 
            className="absolute -top-1 -right-1 h-5 w-5 rounded-full p-0 flex items-center justify-center text-xs"
          >
            {itemCount}
          </Badge>
        </Button>
      </SheetTrigger>
      <SheetContent className="w-full sm:max-w-md flex flex-col">
        <SheetHeader>
          <SheetTitle>Your Cart ({itemCount})</SheetTitle>
        </SheetHeader>
        
        <div className="flex-1 overflow-y-auto py-4">
          {items.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full gap-4 text-center">
              <ShoppingBag className="h-12 w-12 text-muted-foreground" />
              <div>
                <p className="font-medium">Your cart is empty</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Add items to your cart to get started
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {items.map((item) => (
                <CartItemCard 
                  key={item.id} 
                  item={item} 
                  onRemove={() => removeItem(item.id)} 
                />
              ))}
            </div>
          )}
        </div>
        
        {items.length > 0 && (
          <>
            <Separator />
            <div className="py-4">
              <div className="flex justify-between text-sm">
                <span>Subtotal</span>
                <span>${total.toFixed(2)}</span>
              </div>
              
              {/* Registration Requirements Alert */}
              {(hasRegistrationType('vendor') || hasRegistrationType('volunteer')) && (
                <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-md">
                  <p className="text-sm text-amber-800">
                    Some items in your cart require additional information before checkout.
                  </p>
                </div>
              )}
            </div>
            
            <SheetFooter className="gap-2 sm:gap-0">
              <SheetClose asChild>
                <Button variant="outline" className="w-full">
                  Continue Shopping
                </Button>
              </SheetClose>
              <Button 
                className="w-full"
                onClick={() => {
                  setIsOpen(false);
                  
                  // Check if we have any vendor or volunteer products that need registration
                  const vendorItems = items.filter(item => item.product.type === 'vendor_spot');
                  const volunteerItems = items.filter(item => item.product.type === 'volunteer_shift');
                  
                  // Check if any items need registration and don't have it completed
                  const hasIncompleteVendorRegistration = vendorItems.some(item => 
                    getRegistrationStatus(item.id) !== 'complete'
                  );
                  
                  const hasIncompleteVolunteerRegistration = volunteerItems.some(item => 
                    getRegistrationStatus(item.id) !== 'complete'
                  );
                  
                  // Route based on what's needed
                  if (hasIncompleteVendorRegistration) {
                    // Get the first vendor item that needs registration
                    const vendorItem = vendorItems.find(item => getRegistrationStatus(item.id) !== 'complete');
                    if (vendorItem) {
                      navigate(`/registration/vendor/${vendorItem.id}`);
                      return;
                    }
                  }
                  
                  if (hasIncompleteVolunteerRegistration) {
                    // Get the first volunteer item that needs registration
                    const volunteerItem = volunteerItems.find(item => getRegistrationStatus(item.id) !== 'complete');
                    if (volunteerItem) {
                      navigate(`/registration/volunteer/${volunteerItem.id}`);
                      return;
                    }
                  }
                  
                  // If all registrations are complete or there are none, go to checkout
                  navigate("/checkout");
                }}
              >
                Checkout
              </Button>
            </SheetFooter>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}

function CartItemCard({ item, onRemove }: { item: CartItem; onRemove: () => void }) {
  const { getRegistrationStatus } = useCart();
  const registrationStatus = getRegistrationStatus(item.id);
  const [, navigate] = useLocation();

  return (
    <div className="flex gap-3 bg-card border rounded-lg p-3">
      <div className="flex-shrink-0 bg-muted rounded-md w-16 h-16 flex items-center justify-center">
        {item.product.imageUrl ? (
          <img
            src={item.product.imageUrl}
            alt={item.product.name}
            className="w-full h-full object-cover rounded-md"
          />
        ) : (
          <ShoppingBag className="h-6 w-6 text-muted-foreground" />
        )}
      </div>
      
      <div className="flex-1 min-w-0">
        <div className="flex justify-between items-start">
          <div>
            <h4 className="font-medium text-sm line-clamp-1">{item.product.name}</h4>
            <p className="text-xs text-muted-foreground line-clamp-1">
              {item.product.type === 'ticket' && 'Ticket'}
              {item.product.type === 'merchandise' && 'Merchandise'}
              {item.product.type === 'vendor_spot' && 'Vendor Registration'}
              {item.product.type === 'volunteer_shift' && 'Volunteer Shift'}
            </p>
          </div>
          <Button 
            variant="ghost" 
            size="sm" 
            className="h-6 w-6 p-0" 
            onClick={onRemove}
          >
            &times;
          </Button>
        </div>
        
        <div className="flex justify-between items-center mt-1">
          <span className="text-sm font-medium">
            ${item.product.price.toFixed(2)} × {item.quantity}
          </span>
          <span className="font-medium text-sm">
            ${(item.product.price * item.quantity).toFixed(2)}
          </span>
        </div>
        
        {/* Registration Status */}
        {registrationStatus && (
          <div className="mt-2">
            {registrationStatus === 'pending' ? (
              <Button 
                variant="secondary" 
                size="sm" 
                className="text-xs h-7 w-full"
                onClick={() => {
                  navigate(`/registration/${item.product.type === 'vendor_spot' ? 'vendor' : 'volunteer'}/${item.id}`);
                }}
              >
                Complete Registration
              </Button>
            ) : (
              <Badge 
                variant="outline" 
                className={cn(
                  "text-xs px-2 h-5",
                  registrationStatus === 'complete' ? "bg-green-50 text-green-700 border-green-200" : ""
                )}
              >
                Registration Complete
              </Badge>
            )}
          </div>
        )}
      </div>
    </div>
  );
}