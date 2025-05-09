import React, { useState, useEffect } from 'react';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertCircle, ExternalLink, Loader, RefreshCw } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
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
} from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';

export default function StripeConnectionPage() {
  const { toast } = useToast();
  const [connectionData, setConnectionData] = useState<any>(null);
  const [configData, setConfigData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isDisconnecting, setIsDisconnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // This function is deliberately simple - just fetch the data directly
  const fetchConnectionData = async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      // Add timestamp to prevent caching
      const timestamp = Date.now();
      
      // First get config
      const configResponse = await fetch(`/api/stripe/config?_=${timestamp}`);
      if (!configResponse.ok) {
        throw new Error(`Config error: ${configResponse.status} ${configResponse.statusText}`);
      }
      const configJson = await configResponse.json();
      setConfigData(configJson);
      
      // Then get account status
      const statusResponse = await fetch(`/api/stripe/account-status?_=${timestamp}`);
      if (!statusResponse.ok) {
        throw new Error(`Status error: ${statusResponse.status} ${statusResponse.statusText}`);
      }
      
      // Log raw response for debugging
      const rawText = await statusResponse.text();
      console.log("SERVER RESPONSE:", rawText);
      
      try {
        const data = JSON.parse(rawText);
        console.log("PARSED DATA:", data);
        setConnectionData(data);
      } catch (e) {
        console.error("Failed to parse response as JSON:", e);
        throw new Error("Invalid server response format");
      }
    } catch (err) {
      console.error("Error fetching data:", err);
      setError(err.message || "Failed to fetch connection status");
      toast({
        title: "Error",
        description: err.message || "Could not get connection status",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };
  
  // Start a Stripe connection flow
  const handleConnect = async () => {
    setIsConnecting(true);
    
    try {
      const response = await fetch('/api/stripe/connect');
      if (!response.ok) {
        throw new Error(`Error ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();
      
      if (data.url) {
        // Redirect to Stripe
        window.location.href = data.url;
      } else if (data.connected) {
        toast({
          title: "Already connected",
          description: "Your account is already connected to Stripe"
        });
        fetchConnectionData();
        setIsConnecting(false);
      } else {
        throw new Error("Invalid response from server");
      }
    } catch (err) {
      console.error("Connection error:", err);
      toast({
        title: "Connection Error",
        description: err.message || "Failed to start connection process",
        variant: "destructive"
      });
      setIsConnecting(false);
    }
  };
  
  // Disconnect from Stripe
  const handleDisconnect = async () => {
    setIsDisconnecting(true);
    
    try {
      const response = await fetch('/api/stripe/disconnect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      
      if (!response.ok) {
        throw new Error(`Error ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();
      
      if (data.success) {
        toast({
          title: "Disconnected",
          description: "Your Stripe account has been disconnected"
        });
        fetchConnectionData();
      } else {
        throw new Error(data.message || "Failed to disconnect");
      }
    } catch (err) {
      console.error("Disconnect error:", err);
      toast({
        title: "Disconnect Error",
        description: err.message || "Failed to disconnect from Stripe",
        variant: "destructive"
      });
    } finally {
      setIsDisconnecting(false);
    }
  };
  
  // Initial data load
  useEffect(() => {
    fetchConnectionData();
    
    // Also check URL for redirect results
    const params = new URLSearchParams(window.location.search);
    const success = params.get('success');
    const error = params.get('error');
    const message = params.get('message');
    
    if (success === 'true') {
      window.history.replaceState({}, '', window.location.pathname);
      toast({
        title: "Connection Successful",
        description: "Your Stripe account has been connected"
      });
    } else if (error === 'true') {
      window.history.replaceState({}, '', window.location.pathname);
      toast({
        title: "Connection Error",
        description: message || "There was an error connecting your Stripe account",
        variant: "destructive"
      });
    }
  }, []);
  
  // Set up auto-refresh
  useEffect(() => {
    const interval = setInterval(() => {
      fetchConnectionData();
    }, 30000);
    
    return () => clearInterval(interval);
  }, []);
  
  // Is connected based on the response data
  const isConnected = connectionData?.connected === true;
  
  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      
      <main className="flex-grow container mx-auto px-4 py-6">
        <h1 className="text-2xl font-bold mb-6">Payment Connections</h1>
        
        {/* Show any errors at the top */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-md">
            <div className="flex items-center">
              <AlertCircle className="h-5 w-5 text-red-600 mr-2" />
              <h3 className="font-medium text-red-700">Error</h3>
            </div>
            <p className="mt-1 text-red-600">{error}</p>
            <div className="mt-3">
              <Button size="sm" variant="outline" onClick={fetchConnectionData}>
                Try Again
              </Button>
            </div>
          </div>
        )}
        
        {/* Connection Card */}
        <Card className="max-w-3xl mb-8">
          <CardHeader>
            <CardTitle>Stripe Connect</CardTitle>
            <CardDescription>
              Connect your Stripe account to accept payments directly to your bank account.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              // Loading state
              <div className="space-y-4">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-4 w-5/6" />
                <Skeleton className="h-4 w-2/3" />
                <Skeleton className="h-10 w-40 mt-4" />
              </div>
            ) : isConnected ? (
              // Connected state
              <div>
                <div className="mb-4 p-4 bg-green-50 rounded-md border border-green-200">
                  <div className="flex justify-between items-start">
                    <h3 className="text-lg font-medium text-green-800 mb-2">Connection Details</h3>
                    <Button 
                      size="sm" 
                      variant="ghost" 
                      onClick={fetchConnectionData} 
                      className="text-green-700 hover:text-green-800 hover:bg-green-100"
                    >
                      <RefreshCw className="h-4 w-4 mr-1" />
                      Refresh
                    </Button>
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center">
                      <span className="text-sm font-medium text-green-700 w-40">Account ID:</span>
                      <span className="text-sm text-green-800">{connectionData?.accountId}</span>
                    </div>
                    <div className="flex items-center">
                      <span className="text-sm font-medium text-green-700 w-40">Details Submitted:</span>
                      <span className="text-sm text-green-800">{connectionData?.detailsSubmitted ? 'Yes' : 'No'}</span>
                    </div>
                    <div className="flex items-center">
                      <span className="text-sm font-medium text-green-700 w-40">Charges Enabled:</span>
                      <span className="text-sm text-green-800">{connectionData?.chargesEnabled ? 'Yes' : 'No'}</span>
                    </div>
                    <div className="flex items-center">
                      <span className="text-sm font-medium text-green-700 w-40">Payouts Enabled:</span>
                      <span className="text-sm text-green-800">{connectionData?.payoutsEnabled ? 'Yes' : 'No'}</span>
                    </div>
                  </div>
                </div>
                
                <p className="text-neutral-600 mb-6">
                  Your Stripe account is successfully connected to City Event Hub. 
                  Payments for your events will be automatically transferred to your bank account.
                  {connectionData?.detailsSubmitted === false && (
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
                          onClick={handleDisconnect}
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
              // Not connected state
              <div>
                {configData?.hasOAuthKey ? (
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
                  onClick={handleConnect} 
                  disabled={isConnecting || !configData?.hasOAuthKey}
                  className="bg-blue-600 hover:bg-blue-700"
                >
                  {isConnecting ? (
                    <>
                      <Loader className="h-4 w-4 mr-2 animate-spin" />
                      Connecting...
                    </>
                  ) : 'Connect with Stripe'}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
        
        {/* FAQ Section */}
        <div className="max-w-3xl">
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