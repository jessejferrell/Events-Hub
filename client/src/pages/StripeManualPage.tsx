import { useState } from "react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { AlertCircle, CheckCircle, ExternalLink } from "lucide-react";

export default function StripeManualPage() {
  const [code, setCode] = useState("");
  const [accountId, setAccountId] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [rawResponse, setRawResponse] = useState<string | null>(null);

  // Function to generate Stripe OAuth URL
  const getStripeOAuthUrl = () => {
    // Get client_id and redirect_uri from environment
    const clientId = import.meta.env.VITE_STRIPE_CLIENT_ID || "";
    
    const params = new URLSearchParams({
      response_type: "code",
      client_id: clientId,
      scope: "read_write",
      redirect_uri: window.location.origin + "/api/stripe/oauth/callback"
    });
    
    return `https://connect.stripe.com/oauth/authorize?${params.toString()}`;
  };

  // Handle direct API request
  const handleDirectApiRequest = async () => {
    if (!code) {
      setError("Please enter an authorization code");
      return;
    }
    
    setIsLoading(true);
    setError(null);
    setResult(null);
    setRawResponse(null);
    
    try {
      // Make a direct request to our manual endpoint
      const response = await fetch("/api/stripe/direct-token-exchange", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ code })
      });
      
      const text = await response.text();
      setRawResponse(text);
      
      try {
        const data = JSON.parse(text);
        setResult(data);
        
        if (response.ok && data.success) {
          // Success!
          setError(null);
        } else {
          setError(data.error || "Unknown error occurred");
        }
      } catch (parseError) {
        setError("Failed to parse response: " + parseError.message);
      }
    } catch (err) {
      setError("Network error: " + err.message);
    } finally {
      setIsLoading(false);
    }
  };

  // Handle direct account connection
  const handleConnectAccount = async () => {
    if (!accountId) {
      setError("Please enter a Stripe account ID");
      return;
    }
    
    setIsLoading(true);
    setError(null);
    setResult(null);
    
    try {
      const response = await fetch("/api/stripe/manual-connect", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ stripeAccountId: accountId })
      });
      
      const data = await response.json();
      setResult(data);
      
      if (response.ok && data.success) {
        // Success!
        setError(null);
      } else {
        setError(data.error || "Unknown error occurred");
      }
    } catch (err) {
      setError("Network error: " + err.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      
      <main className="flex-grow container mx-auto px-4 py-6">
        <h1 className="text-2xl font-bold mb-6">Stripe Manual Connect</h1>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Step 1: Get OAuth URL */}
          <Card>
            <CardHeader>
              <CardTitle>Step 1: Start OAuth Flow</CardTitle>
              <CardDescription>
                Click to start the Stripe Connect OAuth flow. Copy the code from the URL.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button 
                className="w-full mb-4"
                onClick={() => window.open(getStripeOAuthUrl(), "_blank")}
              >
                <ExternalLink className="h-4 w-4 mr-2" />
                Start OAuth Flow
              </Button>
              <p className="text-sm text-muted-foreground">
                After authorizing, Stripe will redirect with a code in the URL. Copy that code for the next step.
              </p>
            </CardContent>
          </Card>
          
          {/* Step 2: Exchange Code for Token */}
          <Card>
            <CardHeader>
              <CardTitle>Step 2: Exchange OAuth Code</CardTitle>
              <CardDescription>
                Paste the code from Stripe and exchange it for an account ID
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-1">
                    Authorization Code
                  </label>
                  <Input
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    placeholder="ac_..."
                    className="w-full"
                  />
                </div>
                
                <Button 
                  onClick={handleDirectApiRequest}
                  disabled={isLoading || !code}
                  className="w-full"
                >
                  {isLoading ? "Exchanging..." : "Exchange for Token"}
                </Button>
              </div>
            </CardContent>
          </Card>
          
          {/* Step 3: Manual Account Connection */}
          <Card>
            <CardHeader>
              <CardTitle>Step 3: Manual Account Connection</CardTitle>
              <CardDescription>
                If you already have a Stripe account ID, enter it here
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-1">
                    Stripe Account ID
                  </label>
                  <Input
                    value={accountId}
                    onChange={(e) => setAccountId(e.target.value)}
                    placeholder="acct_..."
                    className="w-full"
                  />
                </div>
                
                <Button 
                  onClick={handleConnectAccount}
                  disabled={isLoading || !accountId}
                  className="w-full"
                >
                  {isLoading ? "Connecting..." : "Connect Account"}
                </Button>
              </div>
            </CardContent>
          </Card>
          
          {/* Results */}
          <Card>
            <CardHeader>
              <CardTitle>Results</CardTitle>
              <CardDescription>
                Response from the API
              </CardDescription>
            </CardHeader>
            <CardContent>
              {error && (
                <Alert variant="destructive" className="mb-4">
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>Error</AlertTitle>
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}
              
              {result && !error && (
                <Alert className="mb-4 bg-green-50 text-green-900 border-green-200">
                  <CheckCircle className="h-4 w-4 text-green-600" />
                  <AlertTitle>Success</AlertTitle>
                  <AlertDescription>
                    {JSON.stringify(result, null, 2)}
                  </AlertDescription>
                </Alert>
              )}
              
              {rawResponse && (
                <div className="mt-4">
                  <label className="block text-sm font-medium mb-1">
                    Raw API Response
                  </label>
                  <Textarea
                    readOnly
                    value={rawResponse}
                    className="font-mono text-xs h-40"
                  />
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </main>
      
      <Footer />
    </div>
  );
}