import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { BadgeCheck, ExternalLink } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

export default function PaymentConnectionsPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [isRedirecting, setIsRedirecting] = useState(false);

  // Fetch Stripe configuration
  const { data: stripeConfig, isLoading } = useQuery({
    queryKey: ["/api/stripe/config"],
    queryFn: async () => {
      const res = await fetch("/api/stripe/config");
      if (!res.ok) throw new Error("Failed to fetch Stripe configuration");
      return await res.json();
    },
  });

  // Check for Stripe account connection status
  const { data: connectionStatus, isLoading: isLoadingConnection, refetch: refetchStatus } = useQuery({
    queryKey: ["/api/stripe/account-status"],
    queryFn: async () => {
      const res = await fetch("/api/stripe/account-status");
      if (!res.ok) throw new Error("Failed to fetch Stripe account status");
      return await res.json();
    },
    enabled: !!user,
  });

  // Redirect to Stripe Connect flow
  const handleConnectStripe = () => {
    setIsRedirecting(true);
    
    fetch("/api/stripe/connect")
      .then(res => res.json())
      .then(data => {
        if (data.connected) {
          // Already connected
          toast({
            title: "Already connected",
            description: "Your account is already connected to Stripe.",
          });
          refetchStatus();
          setIsRedirecting(false);
        } else if (data.url) {
          // Redirect to Stripe Connect OAuth
          window.location.href = data.url;
        } else {
          // Something went wrong
          toast({
            title: "Connection error",
            description: data.message || "Could not connect to Stripe.",
            variant: "destructive",
          });
          setIsRedirecting(false);
        }
      })
      .catch(error => {
        toast({
          title: "Connection error",
          description: error.message || "Could not connect to Stripe.",
          variant: "destructive",
        });
        setIsRedirecting(false);
      });
  };

  // Check URL for successful redirect
  useEffect(() => {
    const searchParams = new URLSearchParams(window.location.search);
    const success = searchParams.get("success");
    
    if (success === "true") {
      toast({
        title: "Connection successful",
        description: "Your Stripe account has been connected.",
      });
      // Clean up URL
      window.history.replaceState({}, document.title, window.location.pathname);
      // Refetch account status
      refetchStatus();
    }
  }, [toast, refetchStatus]);

  const isConnected = connectionStatus?.connected;

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      
      <main className="flex-grow container mx-auto px-4 py-6">
        <h1 className="text-2xl font-bold mb-6">Payment Connections</h1>
        
        {/* Stripe Connect Card */}
        <Card className="max-w-3xl">
          <CardHeader>
            <CardTitle>Stripe Connect</CardTitle>
            <CardDescription>
              Connect your Stripe account to accept payments directly to your bank account.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading || isLoadingConnection ? (
              <div className="space-y-4">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-4 w-5/6" />
                <Skeleton className="h-4 w-2/3" />
                <Skeleton className="h-10 w-40 mt-4" />
              </div>
            ) : isConnected ? (
              <div>
                <div className="flex items-center mb-4 p-3 bg-green-50 rounded-md border border-green-200">
                  <BadgeCheck className="h-6 w-6 text-green-500 mr-2" />
                  <div>
                    <p className="font-medium text-green-700">Your Stripe account is connected</p>
                    <p className="text-sm text-green-600">You can now receive payments directly to your bank account</p>
                  </div>
                </div>
                <p className="text-neutral-600 mb-6">
                  Your Stripe account (ID: {connectionStatus?.accountId}) is successfully connected to City Event Hub. 
                  Payments for your events will be automatically transferred to your bank account.
                </p>
                <div className="flex space-x-4">
                  <Button
                    variant="outline"
                    onClick={() => window.open("https://dashboard.stripe.com", "_blank")}
                    className="flex items-center"
                  >
                    <ExternalLink className="h-4 w-4 mr-2" />
                    Open Stripe Dashboard
                  </Button>
                </div>
              </div>
            ) : (
              <>
                <p className="text-neutral-600 mb-4">
                  By connecting with Stripe, you can accept credit and debit card payments directly to your bank account. 
                  Stripe charges standard processing fees of 2.9% + 30¢ per successful transaction.
                </p>
                
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button
                      className="bg-indigo-600 hover:bg-indigo-700"
                      disabled={isRedirecting}
                    >
                      {isRedirecting ? "Redirecting..." : "Connect with Stripe"}
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Connect with Stripe</AlertDialogTitle>
                      <AlertDialogDescription>
                        You will be redirected to Stripe to complete the connection process. 
                        After connecting, payments for your events will be sent directly to your bank account.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction onClick={handleConnectStripe}>Continue</AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </>
            )}
          </CardContent>
        </Card>
        
        {/* Future payment methods could be added here */}
      </main>
      
      <Footer />
    </div>
  );
}