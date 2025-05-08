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
      console.log("Fetching Stripe account status...");
      // For reliability, use custom retry logic with exponential backoff
      let retries = 0;
      const maxRetries = 3;
      
      while (retries <= maxRetries) {
        try {
          const res = await fetch("/api/stripe/account-status");
          if (!res.ok) {
            throw new Error(`Failed to fetch Stripe account status: ${res.status}`);
          }
          const data = await res.json();
          console.log("Received connection status:", data);
          
          // Extra validation to ensure we have valid data
          if (typeof data?.connected !== 'boolean') {
            console.warn("Invalid connection status format, missing 'connected' field:", data);
            throw new Error("Invalid connection status format");
          }
          
          return data;
        } catch (error) {
          retries++;
          console.error(`Stripe status check failed (attempt ${retries}/${maxRetries + 1}):`, error);
          
          if (retries > maxRetries) {
            throw error;
          }
          
          // Wait before retrying with exponential backoff
          await new Promise(resolve => setTimeout(resolve, 500 * Math.pow(2, retries)));
        }
      }
      
      throw new Error("Failed to fetch Stripe account status after multiple attempts");
    },
    enabled: !!user,
    // Force refresh more frequently and don't keep stale data
    staleTime: 10 * 1000, // 10 seconds
    refetchOnMount: true,
    refetchOnWindowFocus: true,
    refetchInterval: 15 * 1000, // Periodically refresh every 15 seconds
  });
  
  // Recovery process - attempt to recover a pending Stripe connection from the session
  const [isRecovering, setIsRecovering] = useState(false);
  const [isForceResetting, setIsForceResetting] = useState(false);
  const [recoveryResult, setRecoveryResult] = useState<{
    recovered: boolean;
    message: string;
    accountId?: string;
    alreadyConnected?: boolean;
    error?: string;
  } | null>(null);

  // Simple direct connect function
  const handleConnectStripe = () => {
    setIsRedirecting(true);
    
    fetch("/api/stripe/connect")
      .then(res => {
        if (!res.ok) {
          throw new Error(`Error ${res.status}`);
        }
        return res.json();
      })
      .then(data => {
        if (data.connected) {
          toast({
            title: "Already connected",
            description: "Your account is already connected to Stripe.",
          });
          window.location.reload();
        } else if (data.url) {
          // Redirect to Stripe OAuth
          window.location.href = data.url;
        } else {
          toast({
            title: "Connection error",
            description: "Could not connect to Stripe.",
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
  
  // Function to attempt recovering a Stripe connection - memoize to prevent useEffect dependency issues
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

  // Simple URL handling - just clean up and show messages
  useEffect(() => {
    const searchParams = new URLSearchParams(window.location.search);
    const success = searchParams.get("success");
    const error = searchParams.get("error");
    const message = searchParams.get("message");
    const code = searchParams.get("code");
    
    // If we have a code parameter, clear it
    if (code) {
      searchParams.delete("code");
      window.history.replaceState({}, document.title, window.location.pathname);
      
      // Force reload to get the latest server state
      window.location.reload();
      return;
    }
    
    // Show success message
    if (success === "true") {
      toast({
        title: "Connection successful",
        description: "Your Stripe account has been connected.",
      });
      window.history.replaceState({}, document.title, window.location.pathname);
      window.location.reload();
    } 
    // Show error message
    else if (error === "true") {
      toast({
        title: "Connection issue",
        description: message || "There was an issue with the Stripe connection.",
        variant: "destructive"
      });
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, [toast]);
  
  // USE EXACTLY WHAT THE SERVER KNOWS - NO CLIENT-SIDE LOGIC
  // This checks ONLY what's in the user object and nothing else
  const isConnected = !!(user && user.stripeAccountId && user.stripeAccountId.startsWith('acct_'));
  
  // Log for debugging but don't use this for determining status
  console.log("=== STRIPE CONNECTION STATUS ===");
  console.log("USER OBJECT SAYS:", isConnected ? "CONNECTED" : "NOT CONNECTED");
  console.log("User stripeAccountId from server:", user?.stripeAccountId || "NONE");
  console.log("============================");
  
  // Manual refresh function
  const handleManualRefresh = () => {
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
        
        // Refresh the connection status
        setTimeout(() => {
          refetchStatus();
          window.location.reload(); // Force a full page reload to clear any cached state
        }, 1000);
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
  
  // Handle force reset (admin only)
  const handleForceReset = async () => {
    if (!window.confirm("⚠️ WARNING: This will completely reset your Stripe connection state. Only use this if you're experiencing connection issues. Continue?")) {
      return;
    }
    
    setIsForceResetting(true);
    
    try {
      const response = await fetch("/api/stripe/force-reset", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
      });
      
      const data = await response.json();
      
      if (response.ok) {
        toast({
          title: "Connection reset",
          description: "Your Stripe connection has been completely reset. You can now reconnect.",
        });
        
        // Force a full page reload to clear any cached state
        window.location.reload();
      } else {
        toast({
          title: "Reset failed",
          description: data.message || "Failed to reset your Stripe account",
          variant: "destructive"
        });
      }
    } catch (error) {
      console.error("Error resetting Stripe connection:", error);
      toast({
        title: "Reset failed",
        description: "An unexpected error occurred",
        variant: "destructive"
      });
    } finally {
      setIsForceResetting(false);
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
                <div className="flex flex-wrap gap-4">
                  <Button
                    className="bg-green-600 hover:bg-green-700 text-white"
                    onClick={() => window.open("https://dashboard.stripe.com", "_blank")}
                  >
                    <ExternalLink className="h-4 w-4 mr-2" />
                    Open Stripe Dashboard
                  </Button>
                  
                  <Button
                    variant="outline"
                    className="text-red-700 border-red-300 hover:bg-red-100"
                    onClick={handleDisconnectStripe}
                    disabled={isDisconnecting}
                  >
                    {isDisconnecting ? (
                      <>
                        <div className="h-4 w-4 mr-2 animate-spin rounded-full border-2 border-current border-t-transparent" />
                        Disconnecting...
                      </>
                    ) : (
                      <>Disconnect Stripe Account</>
                    )}
                  </Button>
                  
                  {user && (user.role === "admin" || user.role === "super_admin") && (
                    <Button
                      variant="outline"
                      className="text-amber-700 border-amber-300 hover:bg-amber-100"
                      onClick={handleForceReset}
                      disabled={isForceResetting}
                    >
                      {isForceResetting ? (
                        <>
                          <div className="h-4 w-4 mr-2 animate-spin rounded-full border-2 border-current border-t-transparent" />
                          Resetting...
                        </>
                      ) : (
                        <>
                          <AlertCircle className="h-4 w-4 mr-2" />
                          Force Reset Connection
                        </>
                      )}
                    </Button>
                  )}
                </div>
              </div>
            ) : (
              <>
                {connectionStatus && (
                  <div className="mb-4 p-3 border rounded-md bg-amber-50 border-amber-200">
                    <div className="flex items-center gap-2">
                      <AlertCircle className="h-5 w-5 text-amber-600" />
                      <p className="text-amber-800 font-medium">
                        {connectionStatus.connected 
                          ? "Your account is already connected to Stripe" 
                          : "Your account is not connected to Stripe"}
                      </p>
                    </div>
                    {connectionStatus.connected && (
                      <div className="mt-2">
                        <p className="text-sm text-amber-700 mb-2">Account ID: {connectionStatus.accountId}</p>
                        <div className="flex flex-wrap gap-2">
                          <Button 
                            variant="outline" 
                            size="sm"
                            className="text-amber-700 border-amber-300 hover:bg-amber-100"
                            onClick={handleManualRefresh}
                          >
                            <RefreshCw className="h-4 w-4 mr-1" />
                            Refresh Status
                          </Button>
                          
                          <Button 
                            variant="outline" 
                            size="sm"
                            className="text-red-700 border-red-300 hover:bg-red-100"
                            onClick={handleDisconnectStripe}
                          >
                            Disconnect
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
                
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
                      
                      {user?.role === 'admin' || user?.role === 'super_admin' ? (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={handleForceReset}
                          disabled={isForceResetting}
                          className="text-red-700 border-red-300 hover:bg-red-100"
                        >
                          {isForceResetting ? (
                            <>
                              <div className="h-4 w-4 mr-1 animate-spin rounded-full border-2 border-current border-t-transparent" />
                              Resetting...
                            </>
                          ) : (
                            <>
                              <AlertCircle className="h-4 w-4 mr-1" />
                              Force Reset Connection
                            </>
                          )}
                        </Button>
                      ) : null}
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