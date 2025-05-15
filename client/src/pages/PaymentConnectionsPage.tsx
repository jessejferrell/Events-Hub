import React, { useState, useEffect, useCallback } from "react";
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
import { ContextualHelp } from "@/components/ui/contextual-help";

export default function PaymentConnectionsPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [isRedirecting, setIsRedirecting] = useState(false);
  const [isDisconnecting, setIsDisconnecting] = useState(false);
  const [isRecovering, setIsRecovering] = useState(false);
  const [recoveryResult, setRecoveryResult] = useState<{
    recovered: boolean;
    message: string;
    accountId?: string;
    alreadyConnected?: boolean;
    error?: string;
  } | null>(null);

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
  const { 
    data: connectionStatus, 
    isLoading: isLoadingConnection, 
    refetch: refetchStatus,
    error: connectionError
  } = useQuery({
    queryKey: ["/api/stripe/account-status"],
    queryFn: async () => {
      try {
        console.log("Fetching account status from API...");
        const res = await fetch("/api/stripe/account-status");
        
        if (!res.ok) {
          const errorText = await res.text();
          console.error(`Account status API error (${res.status}):`, errorText);
          throw new Error(errorText || "Failed to fetch Stripe account status");
        }
        
        const data = await res.json();
        console.log("Account status API response:", data);
        return data;
      } catch (error) {
        console.error("Error in account status query:", error);
        throw error;
      }
    },
    enabled: !!user,
    retry: 2,
    retryDelay: 1000,
    staleTime: 30000, // Refresh every 30 seconds
  });

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
  
  // Simplified disconnect function to avoid security triggers
  const handleDisconnectStripe = () => {
    setIsDisconnecting(true);
    
    // Simple fetch with minimal options
    fetch("/api/stripe/disconnect", { method: "POST" })
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          toast({
            title: "Account disconnected",
            description: "Your Stripe account has been disconnected successfully",
          });
          refetchStatus();
        } else {
          toast({
            title: "Disconnect failed",
            description: "Failed to disconnect your Stripe account",
            variant: "destructive"
          });
        }
      })
      .catch(() => {
        toast({
          title: "Disconnect failed",
          description: "An error occurred",
          variant: "destructive"
        });
      })
      .finally(() => {
        setIsDisconnecting(false);
      });
  };
  
  // Function to attempt recovering a Stripe connection
  const handleRecoverConnection = useCallback(async () => {
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
      console.log("Forcibly refreshing connection status after OAuth redirect");
      toast({
        title: "Checking connection status",
        description: "Verifying your Stripe account connection...",
      });
      
      // Add a small delay to ensure backend has time to process everything
      setTimeout(() => {
        refetchStatus();
        
        // After refetching, check again if we're connected
        setTimeout(() => {
          if (connectionStatus?.connected) {
            console.log("CONNECTION CONFIRMED: User is connected to Stripe");
            toast({
              title: "Connection successful",
              description: "Your Stripe account has been successfully connected!",
            });
          } else {
            console.log("Still not showing as connected, attempting recovery");
            handleRecoverConnection();
          }
        }, 1000);
      }, 1000);
      
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
      // Refetch account status
      refetchStatus();
    } else if (error === "true") {
      // If we get an error, let's try an immediate recovery just in case
      console.log("SHOWING ERROR TOAST");
      console.log("Connection error detected in URL");
      console.log("Error message:", message);
      
      // Always try to recover when there's an error
      console.log("Attempting automatic recovery after error");
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
  
  // Make connection status more robust and handle errors better
  const isConnected = connectionStatus?.connected;
  
  // Show connection error alert if needed
  useEffect(() => {
    if (connectionError) {
      console.error("Connection status error:", connectionError);
      toast({
        title: "Connection status error",
        description: "There was an issue checking your Stripe connection. Please try refreshing the page.",
        variant: "destructive",
      });
    }
  }, [connectionError, toast]);
  
  // Manual refresh function
  const handleManualRefresh = () => {
    refetchStatus();
    toast({
      title: "Refreshing connection status",
      description: "Checking your Stripe account connection status...",
    });
  };

  return (
    <>
      <Navbar />
      <main className="container max-w-screen-lg px-4 py-8 mx-auto">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Payment Connections</h1>
            <p className="text-muted-foreground mt-1">
              Connect your Stripe account to receive payments directly
            </p>
          </div>
          <div>
            <Button
              variant="ghost"
              className="text-primary hover:bg-primary/10 rounded-full p-2"
              onClick={() => window.open("https://stripe.com/docs/connect", "_blank")}
            >
              <ExternalLink size={20} />
            </Button>
          </div>
        </div>
        
        <div className="flex flex-col md:flex-row gap-6">
          <div className="md:w-2/3">
            <Card>
              <CardHeader>
                <CardTitle>Stripe Connect</CardTitle>
                <CardDescription>
                  Connect your account to Stripe to receive payments directly to your bank account
                </CardDescription>
              </CardHeader>
              <CardContent>
                {isLoading || isLoadingConnection ? (
                  <div className="p-4 space-y-4">
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
                    
                    <p className="text-neutral-600 mb-4">
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
                      Connect your Stripe account to receive payments directly for your events. This allows you to manage your own pricing, 
                      payment schedules, and receive funds directly to your bank account.
                    </p>

                    <div className="p-4 bg-blue-50 rounded-md border border-blue-200 mb-4">
                      <h3 className="text-md font-medium text-blue-800 flex items-center mb-2">
                        <BadgeCheck className="h-5 w-5 mr-2 text-blue-600" />
                        Benefits of connecting Stripe
                      </h3>
                      <ul className="list-disc pl-5 text-sm text-blue-800 space-y-1">
                        <li>Receive payments directly to your bank account</li>
                        <li>Set your own pricing and event options</li>
                        <li>Access detailed transaction and payout reporting</li>
                        <li>Control your refund and cancellation policies</li>
                      </ul>
                    </div>

                    <div className="flex flex-wrap gap-3">
                      <Button 
                        onClick={handleConnectStripe}
                        disabled={isRedirecting}
                        className="gap-2"
                      >
                        {isRedirecting ? (
                          <>
                            <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full" />
                            Connecting...
                          </>
                        ) : (
                          <>
                            Connect with Stripe
                          </>
                        )}
                      </Button>
                      
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button 
                            variant="outline" 
                            className="text-blue-600 border-blue-200 hover:bg-blue-50 hover:text-blue-700"
                            disabled={isRecovering}
                          >
                            {isRecovering ? (
                              <>
                                <div className="animate-spin h-4 w-4 border-2 border-blue-600 border-t-transparent rounded-full mr-2" />
                                Recovering...
                              </>
                            ) : "Recover Connection"}
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Recover Stripe Connection</AlertDialogTitle>
                            <AlertDialogDescription>
                              If you've connected your Stripe account but it's not showing as connected, 
                              this will attempt to recover the connection from your browser session.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction onClick={handleRecoverConnection}>Continue</AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                      
                      <Button
                        variant="outline"
                        className="text-neutral-600 border-neutral-200 hover:bg-neutral-50 hover:text-neutral-700"
                        onClick={handleManualRefresh}
                      >
                        <RefreshCw className="h-4 w-4 mr-2" />
                        Refresh Status
                      </Button>
                    </div>
                    
                    {/* Recovery result info */}
                    {recoveryResult && (
                      <div className={`mt-4 p-3 rounded-md border ${
                        recoveryResult.recovered ? 'bg-green-50 border-green-200' : 
                        recoveryResult.alreadyConnected ? 'bg-blue-50 border-blue-200' : 
                        recoveryResult.error ? 'bg-red-50 border-red-200' : 
                        'bg-amber-50 border-amber-200'
                      }`}>
                        <p className={`font-medium ${
                          recoveryResult.recovered ? 'text-green-700' : 
                          recoveryResult.alreadyConnected ? 'text-blue-700' : 
                          recoveryResult.error ? 'text-red-700' : 
                          'text-amber-700'
                        }`}>
                          {recoveryResult.recovered 
                            ? 'Connection successfully recovered!' 
                            : recoveryResult.alreadyConnected
                              ? 'Your account is already connected'
                              : recoveryResult.error
                                ? 'Recovery error: ' + recoveryResult.error
                                : recoveryResult.message || 'No recovery needed'}
                        </p>
                        {recoveryResult.accountId && (
                          <p className="text-sm mt-1 text-neutral-600">
                            Account ID: {recoveryResult.accountId}
                          </p>
                        )}
                      </div>
                    )}
                  </>
                )}

                {connectionStatus?.connected && (
                  <div className="mt-6 border-t border-gray-200 pt-6">
                    <h3 className="font-medium text-gray-900 mb-3">Disconnect Account</h3>
                    <p className="text-neutral-600 text-sm mb-4">
                      If you need to disconnect your Stripe account, you can do so by clicking the button below.
                      This will remove the connection between your account and the platform.
                    </p>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button 
                          variant="outline" 
                          className="bg-white border-red-200 text-red-600 hover:text-red-700 hover:bg-red-50"
                          disabled={isDisconnecting}
                        >
                          {isDisconnecting ? (
                            <>
                              <div className="animate-spin h-4 w-4 border-2 border-red-600 border-t-transparent rounded-full mr-2" />
                              Disconnecting...
                            </>
                          ) : "Disconnect Stripe Account"}
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                          <AlertDialogDescription>
                            Disconnecting your Stripe account will prevent you from receiving payments.
                            Any existing payouts will still be processed according to Stripe's schedule.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction 
                            onClick={handleDisconnectStripe}
                            className="bg-red-600 hover:bg-red-700 text-white"
                          >
                            Disconnect
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
          
          <div className="md:w-1/3">
            <Card>
              <CardHeader>
                <CardTitle>About Stripe Connect</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-4">
                  Stripe Connect allows you to receive payments directly to your bank account for events you create on the platform.
                </p>
                
                <div className="space-y-4">
                  <div className="flex items-start">
                    <div className="bg-green-100 p-2 rounded-full mr-3 mt-0.5">
                      <BadgeCheck className="h-4 w-4 text-green-600" />
                    </div>
                    <div>
                      <h4 className="text-sm font-medium">Direct Payouts</h4>
                      <p className="text-xs text-muted-foreground">Payments go directly to your bank account.</p>
                    </div>
                  </div>
                  
                  <div className="flex items-start">
                    <div className="bg-green-100 p-2 rounded-full mr-3 mt-0.5">
                      <BadgeCheck className="h-4 w-4 text-green-600" />
                    </div>
                    <div>
                      <h4 className="text-sm font-medium">Secure Processing</h4>
                      <p className="text-xs text-muted-foreground">Industry-standard security for all transactions.</p>
                    </div>
                  </div>
                  
                  <div className="flex items-start">
                    <div className="bg-green-100 p-2 rounded-full mr-3 mt-0.5">
                      <BadgeCheck className="h-4 w-4 text-green-600" />
                    </div>
                    <div>
                      <h4 className="text-sm font-medium">Transaction Management</h4>
                      <p className="text-xs text-muted-foreground">View and manage all your transactions in one place.</p>
                    </div>
                  </div>
                </div>
                
                <div className="mt-6">
                  <Button 
                    variant="outline" 
                    className="w-full"
                    onClick={() => window.open("https://stripe.com/connect", "_blank")}
                  >
                    <ExternalLink className="h-4 w-4 mr-2" />
                    Learn More
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}