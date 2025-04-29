import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { useCart } from "@/hooks/use-cart";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { ShoppingBag, CreditCard, ArrowRight, ExternalLink, Info } from "lucide-react";

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { AlertCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@/components/ui/alert";
import { Loader2 } from "lucide-react";

export default function CheckoutPage() {
  const { items, total, itemCount, checkoutMutation, hasRegistrationType, getRegistrationStatus } = useCart();
  const { user } = useAuth();
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const [isRedirectingToStripe, setIsRedirectingToStripe] = useState(false);

  // Check if any items need registration
  const hasVendorRegistrations = hasRegistrationType('vendor');
  const hasVolunteerRegistrations = hasRegistrationType('volunteer');
  
  // Check if we have any incomplete registrations
  const [hasIncompleteRegistrations, setHasIncompleteRegistrations] = useState(false);
  
  useEffect(() => {
    // Check if all required registrations are complete
    const vendorItems = items.filter(item => item.product.type === 'vendor_spot');
    const volunteerItems = items.filter(item => item.product.type === 'volunteer_shift');
    
    const incompleteVendorRegistrations = vendorItems.some(
      item => getRegistrationStatus(item.id) !== 'complete'
    );
    
    const incompleteVolunteerRegistrations = volunteerItems.some(
      item => getRegistrationStatus(item.id) !== 'complete'
    );
    
    setHasIncompleteRegistrations(
      incompleteVendorRegistrations || incompleteVolunteerRegistrations
    );
  }, [items, getRegistrationStatus]);
  
  // If cart is empty, redirect to home
  useEffect(() => {
    if (itemCount === 0) {
      toast({
        title: "Cart is empty",
        description: "Your cart is empty. Add items to checkout.",
        variant: "destructive",
      });
      navigate("/");
    }
  }, [itemCount, toast, navigate]);

  // Handle checkout success or failure
  useEffect(() => {
    // Check URL for checkout status
    const searchParams = new URLSearchParams(window.location.search);
    const success = searchParams.get('success');
    const cancelled = searchParams.get('cancelled');
    
    if (success) {
      toast({
        title: "Payment successful",
        description: "Your order has been processed successfully.",
      });
      // Clean URL
      window.history.replaceState({}, document.title, window.location.pathname);
      // Go to order confirmation page
      navigate("/my-orders");
    } else if (cancelled) {
      toast({
        title: "Payment cancelled",
        description: "Your payment was cancelled.",
        variant: "destructive",
      });
      // Clean URL
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, [toast, navigate]);

  if (itemCount === 0) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // Handle checkout
  const handleCheckout = () => {
    if (hasIncompleteRegistrations) {
      toast({
        title: "Registration required",
        description: "Please complete all required registrations before checkout.",
        variant: "destructive",
      });
      return;
    }
    
    setIsRedirectingToStripe(true);
    
    checkoutMutation.mutate(undefined, {
      onSuccess: (data) => {
        if (data.checkoutUrl) {
          window.location.href = data.checkoutUrl;
        } else {
          setIsRedirectingToStripe(false);
          toast({
            title: "Checkout error",
            description: "Could not redirect to payment page. Please try again.",
            variant: "destructive",
          });
        }
      },
      onError: () => {
        setIsRedirectingToStripe(false);
      }
    });
  };

  return (
    <div className="container py-8">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {/* Order summary */}
        <div className="md:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Order Summary</CardTitle>
              <CardDescription>Review your items before checkout</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {items.map((item) => (
                  <div key={item.id} className="flex gap-4 py-2">
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
                    
                    <div className="flex-1">
                      <div className="flex justify-between">
                        <div>
                          <h4 className="font-medium">{item.product.name}</h4>
                          <p className="text-muted-foreground text-sm">
                            {item.product.type === 'ticket' && 'Ticket'}
                            {item.product.type === 'merchandise' && 'Merchandise'}
                            {item.product.type === 'vendor_spot' && 'Vendor Registration'}
                            {item.product.type === 'volunteer_shift' && 'Volunteer Shift'}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="font-medium">${item.product.price.toFixed(2)}</p>
                          <p className="text-muted-foreground text-sm">Qty: {item.quantity}</p>
                        </div>
                      </div>
                      
                      {/* Registration status */}
                      {['vendor_spot', 'volunteer_shift'].includes(item.product.type) && (
                        <div className="mt-2">
                          {item.registrationData ? (
                            <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                              Registration Complete
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">
                              Registration Incomplete
                            </Badge>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
          
          {/* Registration warnings */}
          {hasIncompleteRegistrations && (
            <Alert variant="destructive" className="mt-4">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Registration Required</AlertTitle>
              <AlertDescription>
                Some items in your cart require additional registration information.
                Please complete all registrations before proceeding to checkout.
              </AlertDescription>
            </Alert>
          )}
          
          {/* Registration reminders */}
          {(hasVendorRegistrations || hasVolunteerRegistrations) && !hasIncompleteRegistrations && (
            <Alert className="mt-4">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Registration Information</AlertTitle>
              <AlertDescription>
                {hasVendorRegistrations && "Your vendor registration information has been saved. "}
                {hasVolunteerRegistrations && "Your volunteer registration information has been saved. "}
                Event organizers will review your registration after checkout.
              </AlertDescription>
            </Alert>
          )}
          
          {/* Payment information */}
          <Card className="mt-4">
            <CardHeader>
              <CardTitle className="flex items-center">
                <CreditCard className="mr-2 h-5 w-5" />
                Payment Information
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 text-sm">
                <div className="flex items-start">
                  <Info className="h-4 w-4 mr-2 mt-0.5 text-muted-foreground" />
                  <p>
                    After clicking "Proceed to Payment," you'll be redirected to Stripe's secure payment page.
                    Your payment will go directly to the event organizer's account.
                  </p>
                </div>
                <div className="flex items-center mt-2">
                  <ExternalLink className="h-4 w-4 mr-2 text-muted-foreground" />
                  <p>For questions about payment security, visit <a href="https://stripe.com/docs/security" target="_blank" rel="noopener noreferrer" className="text-primary underline">Stripe's Security Page</a>.</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
        
        {/* Order total and checkout button */}
        <div>
          <Card>
            <CardHeader>
              <CardTitle>Order Total</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex justify-between">
                  <span>Subtotal</span>
                  <span>${total.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-sm text-muted-foreground">
                  <span>Platform Fee (5%)</span>
                  <span>${(total * 0.05).toFixed(2)}</span>
                </div>
                {/* Add taxes, fees, etc. here if applicable */}
                <Separator />
                <div className="flex justify-between font-bold">
                  <span>Total</span>
                  <span>${(total * 1.05).toFixed(2)}</span>
                </div>
              </div>
            </CardContent>
            <CardFooter>
              <Button 
                className="w-full"
                size="lg"
                onClick={handleCheckout}
                disabled={hasIncompleteRegistrations || checkoutMutation.isPending || isRedirectingToStripe}
              >
                {checkoutMutation.isPending || isRedirectingToStripe ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>
                    <CreditCard className="mr-2 h-4 w-4" />
                    Proceed to Payment
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </>
                )}
              </Button>
            </CardFooter>
          </Card>
          
          {/* Customer information */}
          <Card className="mt-4">
            <CardHeader>
              <CardTitle>Customer Information</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <p><strong>Name:</strong> {user?.name || user?.username}</p>
                <p><strong>Email:</strong> {user?.email}</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}