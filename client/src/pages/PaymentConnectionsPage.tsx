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
import { Badge } from "@/components/ui/badge";
import { BadgeCheck, ExternalLink, RefreshCw, AlertCircle } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

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
  
  // Recovery process - attempt to recover a pending Stripe connection from the session
  const [isRecovering, setIsRecovering] = useState(false);
  const [recoveryResult, setRecoveryResult] = useState<{
    recovered: boolean;
    message: string;
    accountId?: string;
    alreadyConnected?: boolean;
    error?: string;
  } | null>(null);

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

  // Check URL for successful redirect or error
  useEffect(() => {
    const searchParams = new URLSearchParams(window.location.search);
    const success = searchParams.get("success");
    const error = searchParams.get("error");
    const message = searchParams.get("message");
    
    if (success === "true") {
      toast({
        title: "Connection successful",
        description: "Your Stripe account has been connected.",
      });
      // Clean up URL
      window.history.replaceState({}, document.title, window.location.pathname);
      // Refetch account status
      refetchStatus();
    } else if (error === "true") {
      toast({
        title: "Connection failed",
        description: message || "Failed to connect Stripe account. Please try again.",
        variant: "destructive"
      });
      // Clean up URL
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, [toast, refetchStatus]);
  
  // REMOVED auto-refresh which was running constantly and annoying users
  // Manual refresh is better and avoids confusion
  
  // Special handler for when "Connection Failed" appears but Stripe confirmed success
  useEffect(() => {
    const searchParams = new URLSearchParams(window.location.search);
    const error = searchParams.get("error");
    const warning = searchParams.get("warning");
    
    // If there's an error in the URL but we know the connection was actually made,
    // this is a false error from session issues
    if ((error === "true" || warning === "true") && connectionStatus?.connected) {
      // Clean up URL and show success message instead
      window.history.replaceState({}, document.title, window.location.pathname);
      toast({
        title: "Connection successful",
        description: "Your Stripe account was connected successfully despite the error message!",
      });
    }
  }, [toast, connectionStatus?.connected]);
  
  // Automatically try recovery if there's an error or warning in the URL parameters
  useEffect(() => {
    const searchParams = new URLSearchParams(window.location.search);
    const error = searchParams.get("error");
    const warning = searchParams.get("warning");
    
    // If there's an error or warning in the URL and we're not already connected,
    // automatically attempt recovery right away
    if ((error === "true" || warning === "true") && !connectionStatus?.connected && !isRecovering) {
      // Attempt recovery immediately after page loads
      console.log("Auto-attempting connection recovery...");
      // Set a short timeout to make sure component is fully mounted
      const timer = setTimeout(() => {
        handleRecoverConnection();
      }, 300);
      
      return () => clearTimeout(timer);
    }
  }, [connectionStatus?.connected, isRecovering]);
  
  // REMOVED automatic connection recovery which was causing unwanted popups
  // User can now manually click "Recover Connection" button if needed

  const isConnected = connectionStatus?.connected;
  
  // Manual refresh function
  const handleManualRefresh = () => {
    refetchStatus();
    toast({
      title: "Refreshing connection status",
      description: "Checking your Stripe account connection status...",
    });
  };
  
  // Function to attempt recovering a Stripe connection
  const handleRecoverConnection = async () => {
    if (isRecovering) return;
    
    setIsRecovering(true);
    setRecoveryResult(null);
    
    try {
      const res = await fetch("/api/stripe/recover-connection");
      
      if (!res.ok) {
        throw new Error("Failed to recover connection");
      }
      
      const data = await res.json();
      setRecoveryResult(data);
      
      if (data.recovered) {
        toast({
          title: "Connection recovered!",
          description: "Successfully recovered your Stripe account connection.",
        });
        
        // Refetch connection status after successful recovery
        refetchStatus();
        
        // Clear URL params if any
        window.history.replaceState({}, document.title, window.location.pathname);
      } else if (data.alreadyConnected) {
        toast({
          title: "Already connected",
          description: "Your account is already connected to Stripe.",
        });
        refetchStatus();
      } else {
        toast({
          title: "Recovery not needed",
          description: data.message || "No pending Stripe connection found.",
        });
      }
    } catch (error: any) {
      toast({
        title: "Recovery failed",
        description: error.message || "Failed to recover Stripe connection.",
        variant: "destructive"
      });
    } finally {
      setIsRecovering(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      
      <main className="flex-grow container mx-auto px-4 py-6">
        <div className="mb-6">
          <h1 className="text-2xl font-bold">Payment Connections</h1>
        </div>
        
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
                <div className="mb-4 p-4 bg-green-50 rounded-md border border-green-200">
                  <div className="flex justify-between items-start">
                    <h3 className="text-lg font-medium text-green-800 mb-2">Connection Details</h3>
                    <Button 
                      size="sm" 
                      variant="ghost" 
                      onClick={handleManualRefresh} 
                      className="text-green-700 hover:text-green-800 hover:bg-green-100"
                    >
                      <RefreshCw className="h-4 w-4 mr-1" />
                      Refresh
                    </Button>
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center">
                      <span className="text-sm font-medium text-green-700 w-40">Account ID:</span>
                      <span className="text-sm text-green-800">{connectionStatus?.accountId}</span>
                    </div>
                    <div className="flex items-center">
                      <span className="text-sm font-medium text-green-700 w-40">Details Submitted:</span>
                      <span className="text-sm text-green-800">{connectionStatus?.detailsSubmitted ? 'Yes' : 'No'}</span>
                    </div>
                    <div className="flex items-center">
                      <span className="text-sm font-medium text-green-700 w-40">Charges Enabled:</span>
                      <span className="text-sm text-green-800">{connectionStatus?.chargesEnabled ? 'Yes' : 'No'}</span>
                    </div>
                    <div className="flex items-center">
                      <span className="text-sm font-medium text-green-700 w-40">Payouts Enabled:</span>
                      <span className="text-sm text-green-800">{connectionStatus?.payoutsEnabled ? 'Yes' : 'No'}</span>
                    </div>
                  </div>
                </div>
                
                <p className="text-neutral-600 mb-6">
                  Your Stripe account is successfully connected to City Event Hub. 
                  Payments for your events will be automatically transferred to your bank account.
                  {!connectionStatus?.detailsSubmitted && (
                    <span className="text-amber-600 block mt-2">
                      <AlertCircle className="h-4 w-4 inline mr-1" />
                      Please complete your account setup in the Stripe Dashboard to enable payments.
                    </span>
                  )}
                </p>
                <div className="flex space-x-4">
                  <Button
                    className="bg-green-600 hover:bg-green-700 text-white"
                    onClick={() => window.open("https://dashboard.stripe.com", "_blank")}
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
                
                {/* Connection error alert */}
                {window.location.search.includes('error=true') && (
                  <div className="mb-4 p-4 bg-amber-50 rounded-md border border-amber-200">
                    <h3 className="text-lg font-medium text-amber-800 mb-2 flex items-center">
                      <AlertCircle className="h-5 w-5 mr-2" />
                      Connection Issue
                    </h3>
                    <p className="text-sm text-amber-700 mb-2">
                      We received an error message during the connection process, but this may be incorrect.
                    </p>
                    <ul className="text-sm text-amber-700 list-disc list-inside mb-3">
                      <li>If you completed the Stripe authorization, try the "Recover Connection" button</li>
                      <li>If you see "Connection Failed" but Stripe confirmed your account setup, this is likely a session issue that can be fixed automatically</li>
                    </ul>
                    <div className="flex flex-wrap gap-3">
                      <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={handleRecoverConnection}
                        disabled={isRecovering}
                        className="text-amber-700 border-amber-300 hover:bg-amber-100"
                      >
                        {isRecovering ? (
                          <>
                            <div className="h-4 w-4 mr-1 animate-spin rounded-full border-2 border-current border-t-transparent" />
                            Recovering...
                          </>
                        ) : (
                          <>
                            <RefreshCw className="h-4 w-4 mr-1" />
                            Recover Connection
                          </>
                        )}
                      </Button>
                      <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={handleManualRefresh}
                        className="text-amber-700 border-amber-300 hover:bg-amber-100"
                      >
                        <RefreshCw className="h-4 w-4 mr-1" />
                        Check Status
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => window.history.replaceState({}, document.title, window.location.pathname)}
                        className="text-amber-700 border-amber-300 hover:bg-amber-100"
                      >
                        Clear Message
                      </Button>
                    </div>
                    
                    {/* Show recovery result if available */}
                    {recoveryResult && (
                      <div className={`mt-3 p-3 rounded-md ${
                        recoveryResult.recovered 
                          ? "bg-green-100 border border-green-200 text-green-800"
                          : "bg-amber-100 border border-amber-200 text-amber-800"
                      }`}>
                        <p className="text-sm font-medium">
                          {recoveryResult.recovered 
                            ? "Successfully recovered your Stripe connection!"
                            : "Recovery not needed"}
                        </p>
                        <p className="text-xs mt-1">
                          {recoveryResult.message}
                        </p>
                      </div>
                    )}
                  </div>
                )}
                
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
      </main>
      
      <Footer />
    </div>
  );
}