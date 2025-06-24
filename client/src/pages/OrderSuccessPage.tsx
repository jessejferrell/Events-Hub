import { useEffect } from "react";
import { useParams, useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";

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
import { CheckCircle2, Calendar, MapPin, Download, ArrowRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Loader2 } from "lucide-react";

interface OrderItem {
  id: number;
  orderId: number;
  itemType: string;
  itemId: number;
  name: string;
  description: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  metadata?: any;
  createdAt: string;
}

interface Order {
  id: number;
  userId: number;
  eventId: number;
  orderNumber: string;
  status: string;
  totalAmount: number;
  paymentMethod: string;
  paymentStatus: string;
  stripePaymentId: string | null;
  stripeSessionId: string | null;
  emailSent: boolean;
  notes: string | null;
  metadata: any | null;
  createdAt: string;
  updatedAt: string;
}

interface OrderResponse {
  order: Order;
  items: OrderItem[];
  tickets: any[];
}

type QueryData = OrderResponse;
export default function OrderSuccessPage() {
  const { id } = useParams<{ id: string }>();
  const [location, setLocation] = useLocation();
  const searchParams = new URLSearchParams(location.split('?')[1] || '');
  const isSuccess = searchParams.get("success") === "true";
  const { toast } = useToast();
  const { user } = useAuth();

  const { data, isLoading, error } = useQuery<OrderResponse>({
    queryKey: ["order", id],
    queryFn: async () => {
      const response = await apiRequest("GET", `/api/orders/${id}`);
      const jsonData = await response.json();
      return jsonData as unknown as OrderResponse;
    },
    enabled: !!id,
  });

  useEffect(() => {
    if (isSuccess) {
      toast({
        title: "Payment successful!",
        description: "Your order has been confirmed.",
      });
      // Clean URL by removing the success parameter
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, [isSuccess, toast]);

  if (isLoading) {
    return (
      <div className="flex h-[calc(100vh-4rem)] items-center justify-center">
        <div className="flex flex-col items-center gap-2">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Loading order details...</p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="container max-w-4xl py-10">
        <Card>
          <CardHeader>
            <CardTitle className="text-center text-red-500">
              Error Loading Order
            </CardTitle>
          </CardHeader>
          <CardContent className="text-center">
            <p>We couldn't load your order details. Please try again later.</p>
            <Button className="mt-4" asChild>
              <a href="/">Return to Home</a>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8">
      <div className="max-w-3xl mx-auto">
        {/* Success message */}
        <div className="flex flex-col items-center justify-center mb-8 text-center">
          <div className="rounded-full bg-green-100 p-3 mb-4">
            <CheckCircle2 className="h-10 w-10 text-green-600" />
          </div>
          <h1 className="text-3xl font-bold">Thank You for Your Order!</h1>
          <p className="text-muted-foreground mt-2">
            Your order #{id} has been confirmed and processed successfully.
          </p>
        </div>

        {/* Order details */}
        <Card>
          <CardHeader>
            <CardTitle>Order Details</CardTitle>
            <CardDescription>
              Order #{id} • {data?.order?.createdAt ? new Date(data.order.createdAt).toLocaleDateString() : '-'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              {/* Order items */}
              {console.log(data)}
              <div>
                <h3 className="font-medium mb-3">Items</h3>
                <div className="space-y-4">
                  {data?.items?.map((item: OrderItem) => {
                    return (
                      <div key={item.id} className="flex justify-between">
                        <div>
                          <p className="font-medium">{item.name || 'Product'}</p>
                          <p className="text-sm text-muted-foreground">
                            {item.itemType === 'ticket' && 'Ticket'}
                            {item.itemType === 'merchandise' && 'Merchandise'}
                            {item.itemType === 'vendor_spot' && 'Vendor Registration'}
                            {item.itemType === 'volunteer_shift' && 'Volunteer Shift'}
                            {item.itemType === 'addon' && 'Add-on'}
                            {!item.itemType && 'Item'}
                          </p>
                          <p className="text-xs text-muted-foreground mt-1">{item.description}</p>
                          
                          {/* Registration status */}
                          {item.itemType === 'vendor_spot' && item.metadata && (
                            <div className="mt-2">
                              <Badge 
                                variant="outline" 
                                className={item.metadata.status === 'pending' ? 
                                  "bg-yellow-50 text-yellow-700 border-yellow-200" : 
                                  "bg-blue-50 text-blue-700 border-blue-200"}
                              >
                                {item.metadata.status === 'pending' ? 'Registration Pending' : 'Registration Complete'}
                              </Badge>
                            </div>
                          )}

                          {/* Show vendor metadata if available */}
                          {item.metadata && item.metadata.metadata && (
                            <div className="mt-2 text-sm">
                              {item.metadata.metadata.preferredLocation && (
                                <div className="flex items-center text-muted-foreground">
                                  <MapPin className="h-3 w-3 mr-1" />
                                  Preferred Location: {item.metadata.metadata.preferredLocation}
                                </div>
                              )}
                              {item.metadata.metadata.productsDescription && (
                                <div className="text-muted-foreground mt-1">
                                  Products: {item.metadata.metadata.productsDescription}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                        <div className="text-right">
                          <p className="font-medium">${(item.unitPrice || 0).toFixed(2)}</p>
                          <p className="text-sm text-muted-foreground">Qty: {item.quantity || 1}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
              
              <Separator />
              
              {/* Payment summary */}
              <div>
                <h3 className="font-medium mb-3">Payment Summary</h3>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span>Subtotal</span>
                    <span>${data?.order?.totalAmount?.toFixed(2) || '0.00'}</span>
                  </div>
                  {/* Add taxes, fees, etc. here if applicable */}
                  <div className="flex justify-between font-bold pt-2">
                    <span>Total</span>
                    <span>${data?.order?.totalAmount?.toFixed(2) || '0.00'}</span>
                  </div>
                </div>
              </div>
              
              <Separator />
              
              {/* Customer information */}
              <div>
                <h3 className="font-medium mb-3">Customer Information</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm font-medium">Customer</p>
                    <p className="text-sm">{user?.name || 'Guest'}</p>
                    <p className="text-sm text-muted-foreground">
                      {user?.email || ''}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm font-medium">Phone</p>
                    <p className="text-sm">{user?.phoneNumber || 'Not provided'}</p>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
          <CardFooter className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center">
            <Button 
              variant="outline" 
              className="flex-1"
              onClick={() => window.print()}
            >
              <Download className="mr-2 h-4 w-4" />
              Print Receipt
            </Button>
            <Button 
              className="flex-1"
              onClick={() => setLocation("/")}
            >
              Continue Shopping
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}
