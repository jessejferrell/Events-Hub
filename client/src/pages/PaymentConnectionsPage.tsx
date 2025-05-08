import React, { useState, useEffect, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { queryClient } from "@/lib/queryClient";
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
      console.log("Fetching connection status from server...");
      const res = await fetch("/api/stripe/account-status", {
        // Add cache busting to ensure we get fresh data
        headers: {
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache'
        },
        // Add timestamp to prevent browser caching
        cache: 'no-store'
      });
      if (!res.ok) throw new Error("Failed to fetch Stripe account status");
      const data = await res.json();
      console.log("Received connection status:", data);
      return data;
    },
    enabled: !!user,
    // Force a refetch on window focus to ensure updated status
    refetchOnWindowFocus: true,
    // Don't cache the result for long - we want fresh data
    staleTime: 2000,
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
    
    // Capture the time we started the connection attempt (for debugging)
    const startTime = new Date().toISOString();
    console.log(`[${startTime}] Starting Stripe connect flow`);
    
    fetch("/api/stripe/connect")
      .then(res => {
        console.log(`[${new Date().toISOString()}] Received response: ${res.status} ${res.statusText}`);
        
        // If there's an error, try to extract it properly
        if (!res.ok) {
          return res.text().then(text => {
            try {
              // Try to parse as JSON
              const errorJson = JSON.parse(text);
              throw new Error(errorJson.message || `Error ${res.status}: ${res.statusText}`);
            } catch (e) {
              // If not valid JSON, use text directly
              throw new Error(`Error ${res.status}: ${text || res.statusText}`);
            }
          });
        }
        
        return res.json();
      })
      .then(data => {
        console.log(`[${new Date().toISOString()}] Parsed data:`, data);
        
        if (data.connected) {
          // Already connected
          toast({
            title: "Already connected",
            description: "Your account is already connected to Stripe.",
          });
          // Invalidate to ensure fresh data
          queryClient.invalidateQueries({ queryKey: ["/api/stripe/account-status"] });
          refetchStatus();
          setIsRedirecting(false);
        } else if (data.url) {
          // Log the redirect URL we're going to (except sensitive parts)
          const urlObj = new URL(data.url);
          const sanitizedUrl = `${urlObj.origin}${urlObj.pathname}?...params-hidden...`;
          console.log(`[${new Date().toISOString()}] Redirecting to: ${sanitizedUrl}`);
          
          // Redirect to Stripe Connect OAuth
          window.location.href = data.url;
        } else {
          // Something went wrong
          console.error(`[${new Date().toISOString()}] Invalid response:`, data);
          toast({
            title: "Connection error",
            description: data.message || "Could not connect to Stripe. Invalid response format.",
            variant: "destructive",
          });
          setIsRedirecting(false);
        }
      })
      .catch(error => {
        console.error(`[${new Date().toISOString()}] Connection error:`, error);
        toast({
          title: "Connection error",
          description: error.message || "Could not connect to Stripe.",
          variant: "destructive",
        });
        setIsRedirecting(false);
      });
  };
  
  // Function to attempt recovering a Stripe connection - memoize to prevent useEffect dependency issues
  const handleRecoverConnection = useCallback(async () => {
    if (isRecovering) return;
    
    setIsRecovering(true);
    setRecoveryResult(null);
    
    try {
      console.log("Attempting to recover Stripe connection...");
      const res = await fetch("/api/stripe/recover-connection");
      
      if (!res.ok) {
        throw new Error("Failed to recover connection");
      }
      
      const data = await res.json();
      console.log("Recovery response:", data);
      setRecoveryResult(data);
      
      if (data.recovered) {
        toast({
          title: "Connection recovered!",
          description: "Successfully recovered your Stripe account connection.",
        });
        
        // Ensure we get fresh status after recovery
        console.log("Connection recovered - forcing refetch of connection status");
        
        // Invalidate the query cache to ensure fresh data
        queryClient.invalidateQueries({ queryKey: ["/api/stripe/account-status"] });
        
        // Then refetch with our function
        await refetchStatus();
        
        // Force a second refetch after a small delay to ensure we have the latest data
        setTimeout(async () => {
          console.log("Performing second refetch to ensure latest status");
          await refetchStatus();
        }, 1000);
        
        // Clear URL params if any
        window.history.replaceState({}, document.title, window.location.pathname);
      } else if (data.alreadyConnected) {
        toast({
          title: "Already connected",
          description: "Your account is already connected to Stripe.",
        });
        
        // Still refresh status to ensure UI is consistent
        console.log("Account already connected - updating status");
        queryClient.invalidateQueries({ queryKey: ["/api/stripe/account-status"] });
        await refetchStatus();
      } else {
        toast({
          title: "Recovery not needed",
          description: data.message || "No pending Stripe connection found.",
        });
      }
    } catch (error: any) {
      console.error("Recovery error:", error);
      toast({
        title: "Recovery failed",
        description: error.message || "Failed to recover Stripe connection.",
        variant: "destructive"
      });
    } finally {
      setIsRecovering(false);
    }
  }, [isRecovering, refetchStatus, toast]);

  // Check URL for successful redirect or error
  useEffect(() => {
    const searchParams = new URLSearchParams(window.location.search);
    const success = searchParams.get("success");
    const error = searchParams.get("error");
    const message = searchParams.get("message");
    const code = searchParams.get("code"); // This is the Stripe authorization code
    
    console.log("========= PAYMENT PAGE PARAMS =========");
    console.log("URL:", window.location.href);
    console.log("Query params:", {
      success, error, message, code: code ? "PRESENT" : "NONE"
    });
    console.log("All params:", Object.fromEntries(searchParams.entries()));
    console.log("=====================================");
    
    // If we have a code parameter, this indicates we've been redirected from Stripe
    // or we're being redirected back from Stripe OAuth
    if (code) {
      console.log("DETECTED: Stripe authorization code present");
      
      // This means we've successfully completed a Stripe OAuth flow
      // Let's clean the URL first to prevent repeated processing
      searchParams.delete("code");
      window.history.replaceState(
        {}, 
        document.title, 
        window.location.pathname + (searchParams.toString() ? `?${searchParams.toString()}` : "")
      );
      
      // Always force a refresh of the connection status when we return with a code
      // This ensures the UI updates regardless of other params
      console.log("Forcibly refreshing connection status after OAuth redirect");
      toast({
        title: "Checking connection status",
        description: "Verifying your Stripe account connection...",
      });
      
      // Invalidate the query cache to ensure fresh data
      queryClient.invalidateQueries({ queryKey: ["/api/stripe/account-status"] });
      
      // Add a small delay to ensure backend has time to process everything
      setTimeout(async () => {
        try {
          console.log("First refetch attempt post-OAuth");
          await refetchStatus();
          
          // After refetching, check again if we're connected
          setTimeout(async () => {
            console.log("Second refetch attempt post-OAuth");
            await refetchStatus();
            
            console.log("Current connection status after refetch:", connectionStatus);
            
            if (connectionStatus?.connected) {
              console.log("CONNECTION CONFIRMED: User is connected to Stripe");
              toast({
                title: "Connection successful",
                description: "Your Stripe account has been successfully connected!",
              });
            } else {
              console.log("Still not showing as connected, attempting recovery");
              await handleRecoverConnection();
              
              // Final status check after recovery attempt
              setTimeout(async () => {
                console.log("Final status check after recovery");
                await refetchStatus();
              }, 1000);
            }
          }, 1500);
        } catch (err) {
          console.error("Error during post-OAuth status checks:", err);
        }
      }, 1500);
      
      return;
    }
    
    if (success === "true") {
      console.log("SHOWING SUCCESS TOAST");
      toast({
        title: "Connection successful",
        description: "Your Stripe account has been connected.",
      });
      // Clean up URL
      window.history.replaceState({}, document.title, window.location.pathname);
      // Refetch account status - invalidate cache first
      queryClient.invalidateQueries({ queryKey: ["/api/stripe/account-status"] });
      refetchStatus();
    } else if (error === "true") {
      // If we get an error, let's try an immediate recovery just in case
      // the error is just a UI issue and the account was actually connected
      console.log("SHOWING ERROR TOAST");
      console.log("Connection error detected in URL");
      console.log("Error message:", message);
      
      // Always try to recover when there's an error
      // The connection might have succeeded despite the error
      console.log("Attempting automatic recovery after error");
      
      // Invalidate cache before trying to recover
      queryClient.invalidateQueries({ queryKey: ["/api/stripe/account-status"] });
      handleRecoverConnection();
      
      toast({
        title: "Connection issue",
        description: message || "There was an issue with the Stripe connection. Attempting to recover...",
        variant: "destructive"
      });
      // Clean up URL
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, [toast, refetchStatus, connectionStatus, handleRecoverConnection]);
  
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
  
  const isConnected = connectionStatus?.connected;
  
  // Manual refresh function
  const handleManualRefresh = () => {
    queryClient.invalidateQueries({ queryKey: ["/api/stripe/account-status"] });
    refetchStatus();
    toast({
      title: "Refreshing connection status",
      description: "Checking your Stripe account connection status...",
    });
  };
  
  // State for tracking disconnect operation
  const [isDisconnecting, setIsDisconnecting] = useState(false);
  
  // Handle disconnecting from Stripe
  const handleDisconnectStripe = async () => {
    if (!window.confirm("Are you sure you want to disconnect your Stripe account? You will need to reconnect to process payments.")) {
      return;
    }
    
    setIsDisconnecting(true);
    
    try {
      const response = await fetch("/api/stripe/disconnect", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
      });
      
      const data = await response.json();
      
      if (response.ok) {
        toast({
          title: "Account disconnected",
          description: "Your Stripe account has been disconnected successfully",
        });
        
        // Invalidate and refresh the connection status
        queryClient.invalidateQueries({ queryKey: ["/api/stripe/account-status"] });
        refetchStatus();
      } else {
        toast({
          title: "Disconnect failed",
          description: data.message || "Failed to disconnect your Stripe account",
          variant: "destructive"
        });
      }
    } catch (error) {
      console.error("Error disconnecting Stripe account:", error);
      toast({
        title: "Disconnect failed",
        description: "An unexpected error occurred",
        variant: "destructive"
      });
    } finally {
      setIsDisconnecting(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      
      <main className="flex-grow container mx-auto px-4 py-6">
        <div className="mb-6 flex flex-wrap justify-between items-center">
          <h1 className="text-2xl font-bold">Payment Connections</h1>
          
          {!isLoading && !isLoadingConnection && (
            <div className={`px-4 py-2 rounded-full flex items-center ${
              isConnected 
                ? "bg-green-100 text-green-800 border border-green-300" 
                : "bg-amber-100 text-amber-800 border border-amber-300"
            }`}>
              {isConnected ? (
                <>
                  <BadgeCheck className="h-5 w-5 mr-2 text-green-600" />
                  <span className="font-medium">Connected to Stripe</span>
                </>
              ) : (
                <>
                  <AlertCircle className="h-5 w-5 mr-2 text-amber-600" />
                  <span className="font-medium">Not connected to Stripe</span>
                </>
              )}
            </div>
          )}
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
                
                <div className="flex flex-wrap gap-3">
                  <Button asChild variant="outline">
                    <a 
                      href="https://dashboard.stripe.com/" 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="flex items-center"
                    >
                      <ExternalLink className="h-4 w-4 mr-1.5" />
                      Open Stripe Dashboard
                    </a>
                  </Button>
                  
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="outline" className="text-red-600 border-red-200 hover:text-red-700 hover:bg-red-50 hover:border-red-300">
                        Disconnect Account
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Disconnect Stripe Account?</AlertDialogTitle>
                        <AlertDialogDescription>
                          This action will disconnect your Stripe account from City Event Hub. 
                          You will need to reconnect to process payments. Are you sure?
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={handleDisconnectStripe}
                          className="bg-red-600 hover:bg-red-700 text-white"
                          disabled={isDisconnecting}
                        >
                          {isDisconnecting ? 'Disconnecting...' : 'Disconnect'}
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </div>
            ) : (
              <div>
                {stripeConfig?.hasOAuthKey ? (
                  <div className="mb-4 p-3 border rounded-md bg-amber-50 border-amber-200">
                    <div className="flex items-center gap-2">
                      <AlertCircle className="h-5 w-5 text-amber-600" />
                      <p className="text-amber-800">Your account is not connected to Stripe</p>
                    </div>
                  </div>
                ) : (
                  <div className="mb-4 p-3 border rounded-md bg-amber-50 border-amber-200">
                    <div className="flex items-center gap-2">
                      <AlertCircle className="h-5 w-5 text-amber-600" />
                      <p className="text-amber-800">
                        Stripe OAuth is not properly configured. Please contact support.
                      </p>
                    </div>
                  </div>
                )}
                
                <p className="text-neutral-600 mb-6">
                  By connecting with Stripe, you can accept credit and debit card payments directly to your bank account,
                  while City Event Hub handles the processing fee of 1.5% + 30¢ per successful transaction.
                </p>
                
                <Button 
                  onClick={handleConnectStripe} 
                  disabled={isRedirecting || !stripeConfig?.hasOAuthKey}
                  className="bg-blue-600 hover:bg-blue-700"
                >
                  {isRedirecting ? 'Connecting...' : 'Connect with Stripe'}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
        
        {/* Additional Information */}
        <div className="mt-10 max-w-3xl">
          <h2 className="text-xl font-semibold mb-4">Frequently Asked Questions</h2>
          
          <div className="space-y-4">
            <div>
              <h3 className="font-medium mb-2">How does payment processing work?</h3>
              <p className="text-neutral-600">
                City Event Hub uses Stripe Connect to allow event organizers to accept payments directly to their own bank accounts. 
                Payments are processed securely through Stripe and deposited to your connected bank account.
              </p>
            </div>
            
            <div>
              <h3 className="font-medium mb-2">What if I don't have a Stripe account?</h3>
              <p className="text-neutral-600">
                Don't worry! You'll be guided through the Stripe account creation process when you click "Connect with Stripe". 
                The setup is quick and straightforward.
              </p>
            </div>
            
            <div>
              <h3 className="font-medium mb-2">How long does it take to receive funds?</h3>
              <p className="text-neutral-600">
                Typically, funds are available in your bank account within 2 business days after a successful transaction, 
                but this can vary based on your Stripe account settings and bank processing times.
              </p>
            </div>
          </div>
        </div>
      </main>
      
      <Footer />
    </div>
  );
}