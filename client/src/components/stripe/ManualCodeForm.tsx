import { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertCircle, CheckCircle } from "lucide-react";

export function ManualCodeForm() {
  const [code, setCode] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!code.trim()) {
      setError('Please enter the authorization code');
      return;
    }
    
    try {
      setIsLoading(true);
      setError(null);
      setSuccess(null);
      
      console.log('Submitting authorization code:', code);
      
      const response = await fetch('/api/stripe/manual-connect', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ authCode: code }),
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to process authorization code');
      }
      
      setSuccess(`Successfully connected Stripe account: ${data.accountId}`);
      setCode('');
      
      // Redirect after success
      setTimeout(() => {
        window.location.href = '/payment-connections?success=true';
      }, 3000);
      
    } catch (err: any) {
      console.error('Error submitting auth code:', err);
      setError(err.message || 'Failed to process authorization code');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader>
        <CardTitle>Manual Stripe Connection</CardTitle>
        <CardDescription>
          If the automatic connection failed, paste the authorization code here
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
        
        {success && (
          <Alert className="mb-4 bg-green-50 text-green-900 border-green-200">
            <CheckCircle className="h-4 w-4 text-green-600" />
            <AlertTitle>Success</AlertTitle>
            <AlertDescription>{success}</AlertDescription>
          </Alert>
        )}
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <label htmlFor="auth-code" className="text-sm font-medium">
              Authorization Code
            </label>
            <Input
              id="auth-code"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="ac_..."
              disabled={isLoading}
              className="w-full"
            />
            <p className="text-xs text-muted-foreground">
              This is the code provided by Stripe after authentication
            </p>
          </div>
        </form>
      </CardContent>
      <CardFooter>
        <Button 
          onClick={handleSubmit} 
          disabled={isLoading || !code.trim()} 
          className="w-full"
        >
          {isLoading ? 'Processing...' : 'Connect Stripe Account'}
        </Button>
      </CardFooter>
    </Card>
  );
}