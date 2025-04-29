import { useEffect, useState } from "react";
import { useRoute, useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Event, Ticket, Product } from "@shared/schema";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogFooter,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { apiRequest } from "@/lib/queryClient";
import { Calendar, Clock, MapPin, Tag, Users, DollarSign, ShoppingBag, HelpingHand, Store } from "lucide-react";
import { format } from "date-fns";

export default function EventDetailsPage() {
  const [match, params] = useRoute("/events/:id");
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  
  const [ticketQuantity, setTicketQuantity] = useState(1);
  const [isPurchasing, setIsPurchasing] = useState(false);
  const [checkoutUrl, setCheckoutUrl] = useState<string | null>(null);

  // Redirect if no match
  useEffect(() => {
    if (!match) navigate("/events", { replace: true });
  }, [match, navigate]);

  // Get event ID from params
  const eventId = match ? parseInt(params.id) : -1;

  // Fetch event details
  const { data: event, isLoading, isError } = useQuery<Event>({
    queryKey: [`/api/events/${eventId}`],
    queryFn: async () => {
      const res = await fetch(`/api/events/${eventId}`);
      if (!res.ok) throw new Error("Failed to fetch event");
      return await res.json();
    },
    enabled: eventId > 0,
  });

  // Fetch user tickets for this event if logged in
  const { data: userTickets } = useQuery<Ticket[]>({
    queryKey: ["/api/my-tickets"],
    queryFn: async () => {
      const res = await fetch("/api/my-tickets");
      if (!res.ok) throw new Error("Failed to fetch tickets");
      return await res.json();
    },
    enabled: !!user,
  });

  // Check if user has tickets for this event
  const hasTickets = userTickets?.some(ticket => ticket.eventId === eventId);

  // Fetch products for this event
  const { data: products, isLoading: productsLoading } = useQuery<Product[]>({
    queryKey: [`/api/events/${eventId}/products`],
    queryFn: async () => {
      const res = await fetch(`/api/events/${eventId}/products`);
      if (!res.ok) throw new Error("Failed to fetch products");
      return await res.json();
    },
    enabled: eventId > 0,
  });

  // Organize products by type
  const ticketProducts = products?.filter(p => p.type === "ticket") || [];
  const merchandiseProducts = products?.filter(p => p.type === "merchandise") || [];
  const vendorProducts = products?.filter(p => p.type === "vendor_spot") || [];
  const volunteerProducts = products?.filter(p => p.type === "volunteer_shift") || [];
  
  // Debug log
  console.log("Products:", { 
    all: products,
    tickets: ticketProducts,
    merchandise: merchandiseProducts, 
    vendors: vendorProducts, 
    volunteers: volunteerProducts 
  });

  // Create checkout session mutation
  const createCheckoutSession = useMutation({
    mutationFn: async ({ eventId, quantity }: { eventId: number, quantity: number }) => {
      const res = await apiRequest("POST", "/api/create-checkout-session", { eventId, quantity });
      return await res.json();
    },
    onSuccess: (data) => {
      if (data.url) {
        setCheckoutUrl(data.url);
      } else {
        toast({
          title: "Error",
          description: "Unable to create checkout session",
          variant: "destructive",
        });
      }
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create checkout session",
        variant: "destructive",
      });
    },
  });

  // Handle buy tickets
  const handleBuyTickets = async () => {
    if (!user) {
      // Redirect to login if not authenticated
      navigate("/auth");
      return;
    }

    setIsPurchasing(true);
    createCheckoutSession.mutate({ eventId, quantity: ticketQuantity });
  };

  // Handle checkout redirect
  useEffect(() => {
    if (checkoutUrl) {
      window.location.href = checkoutUrl;
    }
  }, [checkoutUrl]);

  // Process URL parameters on page load
  useEffect(() => {
    const searchParams = new URLSearchParams(window.location.search);
    const success = searchParams.get("success");
    const sessionId = searchParams.get("session_id");
    
    if (success === "true" && sessionId) {
      toast({
        title: "Purchase Successful!",
        description: "Your tickets have been purchased successfully.",
      });
      // Clean up the URL
      navigate(`/events/${eventId}`, { replace: true });
      // Refetch user tickets
      queryClient.invalidateQueries({ queryKey: ["/api/my-tickets"] });
    }
    
    const cancelled = searchParams.get("cancelled");
    if (cancelled === "true") {
      toast({
        title: "Purchase Cancelled",
        description: "Your ticket purchase was cancelled.",
        variant: "destructive",
      });
      // Clean up the URL
      navigate(`/events/${eventId}`, { replace: true });
    }
  }, [eventId, navigate, queryClient, toast]);

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      
      <main className="flex-grow container mx-auto px-4 py-6">
        {isLoading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin h-10 w-10 border-4 border-primary border-t-transparent rounded-full" />
          </div>
        ) : isError || !event ? (
          <div className="bg-red-50 border border-red-200 rounded-md p-8 text-center">
            <h2 className="text-xl font-semibold text-red-700 mb-2">Event Not Found</h2>
            <p className="text-red-600 mb-4">The event you're looking for doesn't exist or has been removed.</p>
            <Button onClick={() => navigate("/events")}>
              Back to Events
            </Button>
          </div>
        ) : (
          <>
            {/* Event Header */}
            <div className="mb-8">
              <h1 className="text-3xl font-bold mb-2">{event.title}</h1>
              <div className="flex flex-wrap gap-4 text-gray-600">
                <div className="flex items-center">
                  <Calendar className="h-5 w-5 mr-1 text-gray-500" />
                  <span>
                    {format(new Date(event.startDate), "MMM d, yyyy")}
                    {new Date(event.startDate).toDateString() !== new Date(event.endDate).toDateString() && 
                      ` - ${format(new Date(event.endDate), "MMM d, yyyy")}`}
                  </span>
                </div>
                <div className="flex items-center">
                  <MapPin className="h-5 w-5 mr-1 text-gray-500" />
                  <span>{event.location}</span>
                </div>
                <div className="flex items-center">
                  <Tag className="h-5 w-5 mr-1 text-gray-500" />
                  <span>{event.eventType}</span>
                </div>
              </div>
            </div>
            
            {/* Event Content */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-8">
              {/* Event Details */}
              <div className="lg:col-span-2">
                {/* Event Image */}
                <div className="aspect-video bg-gray-200 rounded-lg mb-6 flex items-center justify-center">
                  {event.imageUrl ? (
                    <img 
                      src={event.imageUrl} 
                      alt={event.title} 
                      className="w-full h-full object-cover rounded-lg"
                    />
                  ) : (
                    <span className="text-gray-400">Event Image</span>
                  )}
                </div>
                
                {/* Event Description */}
                <div className="bg-white p-6 rounded-lg border border-gray-200 mb-6">
                  <h2 className="text-xl font-semibold mb-4">About This Event</h2>
                  <div className="prose max-w-none">
                    <p>{event.description}</p>
                  </div>
                </div>
                
                {/* Event Schedule */}
                <div className="bg-white p-6 rounded-lg border border-gray-200">
                  <h2 className="text-xl font-semibold mb-4">Schedule</h2>
                  <div className="flex items-start mb-4">
                    <Clock className="h-5 w-5 mr-3 text-gray-500 mt-0.5" />
                    <div>
                      <h3 className="font-medium">Date and Time</h3>
                      <p className="text-gray-600">
                        {format(new Date(event.startDate), "EEEE, MMMM d, yyyy")}
                        <br />
                        {format(new Date(event.startDate), "h:mm a")} - 
                        {format(new Date(event.endDate), "h:mm a")}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start">
                    <MapPin className="h-5 w-5 mr-3 text-gray-500 mt-0.5" />
                    <div>
                      <h3 className="font-medium">Location</h3>
                      <p className="text-gray-600">{event.location}</p>
                    </div>
                  </div>
                </div>
              </div>
              
              {/* Ticket Purchase Card */}
              <div>
                <div className="bg-white p-6 rounded-lg border border-gray-200 sticky top-6">
                  <h2 className="text-xl font-semibold mb-4">Tickets</h2>
                  
                  {event.price > 0 ? (
                    <>
                      <div className="flex items-center mb-4">
                        <DollarSign className="h-5 w-5 mr-1 text-gray-500" />
                        <span className="text-2xl font-bold">${event.price.toFixed(2)}</span>
                        <span className="ml-1 text-gray-600">per ticket</span>
                      </div>
                      
                      {hasTickets ? (
                        <div className="bg-green-50 p-4 rounded-md mb-4">
                          <p className="text-green-700 font-medium">You already have tickets for this event!</p>
                          <p className="text-green-600 text-sm mt-1">Check your account for ticket details</p>
                        </div>
                      ) : (
                        <>
                          <div className="mb-4">
                            <label className="block text-sm mb-1">Quantity</label>
                            <div className="flex">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setTicketQuantity(prev => Math.max(1, prev - 1))}
                                className="px-3"
                              >
                                -
                              </Button>
                              <Input
                                type="number"
                                min="1"
                                value={ticketQuantity}
                                onChange={(e) => setTicketQuantity(parseInt(e.target.value) || 1)}
                                className="text-center mx-2"
                              />
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setTicketQuantity(prev => prev + 1)}
                                className="px-3"
                              >
                                +
                              </Button>
                            </div>
                          </div>
                          
                          <div className="mb-4">
                            <div className="flex justify-between py-2 border-t border-gray-200">
                              <span>Subtotal</span>
                              <span>${(event.price * ticketQuantity).toFixed(2)}</span>
                            </div>
                            <div className="flex justify-between py-2 border-t border-gray-200 font-medium">
                              <span>Total</span>
                              <span>${(event.price * ticketQuantity).toFixed(2)}</span>
                            </div>
                          </div>
                          
                          <Button 
                            className="w-full bg-secondary hover:bg-secondary/90"
                            onClick={handleBuyTickets}
                            disabled={createCheckoutSession.isPending}
                          >
                            {createCheckoutSession.isPending ? "Processing..." : "Buy Tickets"}
                          </Button>
                        </>
                      )}
                    </>
                  ) : (
                    <>
                      <div className="bg-blue-50 p-4 rounded-md mb-4">
                        <p className="text-blue-700 font-medium">This is a free event!</p>
                        <p className="text-blue-600 text-sm mt-1">No ticket purchase required</p>
                      </div>
                      
                      <Button className="w-full bg-secondary hover:bg-secondary/90">
                        Register for Event
                      </Button>
                    </>
                  )}
                  
                  <div className="mt-4 text-sm text-gray-500">
                    <p className="flex items-center mb-1">
                      <Users className="h-4 w-4 mr-1" />
                      <span>Share this event with friends</span>
                    </p>
                    {/* Social share buttons would go here */}
                  </div>
                </div>
              </div>
            </div>
            
            {/* Products Section with Tabs */}
            <div className="mb-12">
              <h2 className="text-2xl font-bold mb-6">Participate in This Event</h2>
              
              <Tabs defaultValue="tickets" className="w-full">
                <TabsList className="mb-6 w-full justify-start">
                  <TabsTrigger value="tickets" className="flex items-center gap-1">
                    <ShoppingBag className="h-4 w-4" />
                    Tickets
                  </TabsTrigger>
                  
                  {merchandiseProducts.length > 0 && (
                    <TabsTrigger value="merchandise" className="flex items-center gap-1">
                      <ShoppingBag className="h-4 w-4" />
                      Merchandise
                    </TabsTrigger>
                  )}
                  
                  {vendorProducts.length > 0 && (
                    <TabsTrigger value="vendors" className="flex items-center gap-1">
                      <Store className="h-4 w-4" />
                      Vendor Options
                    </TabsTrigger>
                  )}
                  
                  {volunteerProducts.length > 0 && (
                    <TabsTrigger value="volunteers" className="flex items-center gap-1">
                      <HelpingHand className="h-4 w-4" />
                      Volunteer
                    </TabsTrigger>
                  )}
                </TabsList>
                
                <TabsContent value="tickets">
                  {ticketProducts.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                      {ticketProducts.map((product) => (
                        <Card key={product.id} className="overflow-hidden">
                          {product.imageUrl && (
                            <div className="aspect-video w-full">
                              <img 
                                src={product.imageUrl} 
                                alt={product.name} 
                                className="w-full h-full object-cover"
                              />
                            </div>
                          )}
                          <CardHeader>
                            <CardTitle>{product.name}</CardTitle>
                            <CardDescription>{product.description}</CardDescription>
                          </CardHeader>
                          <CardContent>
                            <p className="text-2xl font-bold mb-2">${product.price.toFixed(2)}</p>
                            {product.quantity !== null && (
                              <p className="text-sm text-gray-500 mb-2">
                                {product.quantity > 0 
                                  ? `${product.quantity} left` 
                                  : 'Sold out'}
                              </p>
                            )}
                          </CardContent>
                          <CardFooter>
                            <Button 
                              className="w-full" 
                              disabled={!product.isActive || (product.quantity !== null && product.quantity <= 0)}
                              onClick={() => {
                                if (!user) {
                                  navigate("/auth");
                                  return;
                                }
                                // Handle product selection
                              }}
                            >
                              {product.quantity !== null && product.quantity <= 0
                                ? "Sold Out"
                                : "Add to Cart"}
                            </Button>
                          </CardFooter>
                        </Card>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-12 bg-gray-50 rounded-lg">
                      <p className="text-gray-500">No tickets are available for this event yet.</p>
                    </div>
                  )}
                </TabsContent>
                
                <TabsContent value="merchandise">
                  {merchandiseProducts.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                      {merchandiseProducts.map((product) => (
                        <Card key={product.id} className="overflow-hidden">
                          {product.imageUrl && (
                            <div className="aspect-video w-full">
                              <img 
                                src={product.imageUrl} 
                                alt={product.name} 
                                className="w-full h-full object-cover"
                              />
                            </div>
                          )}
                          <CardHeader>
                            <CardTitle>{product.name}</CardTitle>
                            <CardDescription>{product.description}</CardDescription>
                          </CardHeader>
                          <CardContent>
                            <p className="text-2xl font-bold mb-2">${product.price.toFixed(2)}</p>
                            {product.quantity !== null && (
                              <p className="text-sm text-gray-500 mb-2">
                                {product.quantity > 0 
                                  ? `${product.quantity} left` 
                                  : 'Sold out'}
                              </p>
                            )}
                          </CardContent>
                          <CardFooter>
                            <Button 
                              className="w-full" 
                              disabled={!product.isActive || (product.quantity !== null && product.quantity <= 0)}
                              onClick={() => {
                                if (!user) {
                                  navigate("/auth");
                                  return;
                                }
                                // Handle product selection
                              }}
                            >
                              {product.quantity !== null && product.quantity <= 0
                                ? "Sold Out"
                                : "Add to Cart"}
                            </Button>
                          </CardFooter>
                        </Card>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-12 bg-gray-50 rounded-lg">
                      <p className="text-gray-500">No merchandise is available for this event yet.</p>
                    </div>
                  )}
                </TabsContent>
                
                <TabsContent value="vendors">
                  {vendorProducts.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                      {vendorProducts.map((product) => (
                        <Card key={product.id} className="overflow-hidden">
                          {product.imageUrl && (
                            <div className="aspect-video w-full">
                              <img 
                                src={product.imageUrl} 
                                alt={product.name} 
                                className="w-full h-full object-cover"
                              />
                            </div>
                          )}
                          <CardHeader>
                            <CardTitle>{product.name}</CardTitle>
                            <CardDescription>{product.description}</CardDescription>
                          </CardHeader>
                          <CardContent>
                            <p className="text-2xl font-bold mb-2">${product.price.toFixed(2)}</p>
                            {product.quantity !== null && (
                              <p className="text-sm text-gray-500 mb-2">
                                {product.quantity > 0 
                                  ? `${product.quantity} spots left` 
                                  : 'No spots available'}
                              </p>
                            )}
                          </CardContent>
                          <CardFooter>
                            <Button 
                              className="w-full" 
                              disabled={!product.isActive || (product.quantity !== null && product.quantity <= 0)}
                              onClick={() => {
                                if (!user) {
                                  navigate("/auth");
                                  return;
                                }
                                // Handle vendor registration
                              }}
                            >
                              {product.quantity !== null && product.quantity <= 0
                                ? "Spots Full"
                                : "Apply as Vendor"}
                            </Button>
                          </CardFooter>
                        </Card>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-12 bg-gray-50 rounded-lg">
                      <p className="text-gray-500">No vendor opportunities are available for this event yet.</p>
                    </div>
                  )}
                </TabsContent>
                
                <TabsContent value="volunteers">
                  {volunteerProducts.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                      {volunteerProducts.map((product) => (
                        <Card key={product.id} className="overflow-hidden">
                          {product.imageUrl && (
                            <div className="aspect-video w-full">
                              <img 
                                src={product.imageUrl} 
                                alt={product.name} 
                                className="w-full h-full object-cover"
                              />
                            </div>
                          )}
                          <CardHeader>
                            <CardTitle>{product.name}</CardTitle>
                            <CardDescription>{product.description}</CardDescription>
                          </CardHeader>
                          <CardContent>
                            {product.quantity !== null && (
                              <p className="text-sm text-gray-500 mb-2">
                                {product.quantity > 0 
                                  ? `${product.quantity} positions left` 
                                  : 'No positions available'}
                              </p>
                            )}
                          </CardContent>
                          <CardFooter>
                            <Button 
                              className="w-full" 
                              disabled={!product.isActive || (product.quantity !== null && product.quantity <= 0)}
                              onClick={() => {
                                if (!user) {
                                  navigate("/auth");
                                  return;
                                }
                                // Handle volunteer sign up
                              }}
                            >
                              {product.quantity !== null && product.quantity <= 0
                                ? "Positions Filled"
                                : "Volunteer"}
                            </Button>
                          </CardFooter>
                        </Card>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-12 bg-gray-50 rounded-lg">
                      <p className="text-gray-500">No volunteer opportunities are available for this event yet.</p>
                    </div>
                  )}
                </TabsContent>
              </Tabs>
            </div>
          </>
        )}
      </main>
      
      <Footer />
      
      {/* Purchase Dialog */}
      <Dialog open={isPurchasing} onOpenChange={setIsPurchasing}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Redirecting to Checkout</DialogTitle>
            <DialogDescription>
              You are being redirected to our secure payment processor. Please wait...
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-center py-4">
            <div className="animate-spin h-10 w-10 border-4 border-primary border-t-transparent rounded-full" />
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
