import { useAuth } from "@/hooks/use-auth";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Link, useLocation } from "wouter";
import { LogOut, User, Settings, Mail, AlertCircle, BadgeCheck, Loader2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { CartWidget } from "@/components/cart/CartWidget";
import { useQuery } from "@tanstack/react-query";

export default function Navbar() {
  const { user, logoutMutation } = useAuth();
  const [location] = useLocation();
  const [stripeChecked, setStripeChecked] = useState(false);
  
  // Define the type for Stripe status
  interface StripeStatus {
    connected: boolean;
    accountId?: string;
    detailsSubmitted?: boolean;
    chargesEnabled?: boolean;
    payoutsEnabled?: boolean;
    message?: string;
  }
  
  // Fresh fetch of Stripe status, independent from any cached state
  const { data: stripeStatus, isLoading: isLoadingStripeStatus } = useQuery<StripeStatus>({
    queryKey: ['/api/stripe/account-status'],
    queryFn: async () => {
      try {
        const res = await fetch('/api/stripe/account-status');
        if (!res.ok) {
          throw new Error(`Failed to fetch Stripe status: ${res.status}`);
        }
        const data = await res.json();
        
        // Ensure we have a valid response with at least the connected field
        if (typeof data?.connected !== 'boolean') {
          console.warn('Invalid Stripe status response format:', data);
          return { connected: false, message: "Invalid response format" };
        }
        
        return data;
      } catch (error) {
        console.error('Error fetching Stripe status:', error);
        // Return a failsafe response that won't break the UI
        return { connected: false, message: "Error checking status" };
      }
    },
    enabled: !!user && (user.role === 'admin' || user.role === 'event_owner'),
    refetchInterval: 10000, // Check every 10 seconds
    staleTime: 0, // Never consider the data fresh
    refetchOnMount: true, // Always refetch when component mounts
    refetchOnWindowFocus: true, // Refetch when window regains focus
  });
  
  // We don't need this separate fetch since we have the query above
  // that will properly handle status updates with refetching
  useEffect(() => {
    if (user && (user.role === 'admin' || user.role === 'event_owner')) {
      setStripeChecked(true);
    }
  }, [user, stripeStatus]);

  const handleLogout = useCallback(() => {
    logoutMutation.mutate();
  }, [logoutMutation]);

  // Generate avatar initials from username or name
  const getInitials = () => {
    if (!user) return "?";
    if (user.name) {
      return user.name.split(' ').map(n => n[0]).join('').toUpperCase();
    }
    return user.username.substring(0, 2).toUpperCase();
  };

  return (
    <header className="bg-gradient-to-r from-primary to-secondary text-white shadow-md">
      {/* Top Navigation Bar */}
      <div className="container mx-auto px-4 py-3 flex justify-between items-center">
        <Link href="/" className="flex items-center space-x-2">
          <div className="bg-white rounded-full p-1.5">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-6 w-6 text-primary">
              <path d="M11 17a1 1 0 1 0 2 0c0-.5-.34-1-1-1-.5 0-1 .63-1 1Z"></path>
              <path d="M12 10v4"></path>
              <path d="M2 8c0-2.2.9-4.1 2.3-5.5C5.7 1.1 7.8 0 10 0h4c2.2 0 4.3 1.1 5.7 2.5C21.1 3.9 22 5.8 22 8v6c0 5-4 8-10 8h0c-6 0-10-3-10-8V8Z"></path>
            </svg>
          </div>
          <span className="font-bold text-xl tracking-tight">City Event Hub</span>
        </Link>
        
        <div className="flex items-center space-x-4">
          <CartWidget />
          
          {/* Guest buttons or User Menu */}
          {!user ? (
            <div className="flex items-center space-x-2">
              <Link href="/auth">
                <Button className="bg-white text-primary hover:bg-white/90 font-medium px-4 py-2 rounded-md">
                  Log In / Register
                </Button>
              </Link>
            </div>
          ) : (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="flex items-center space-x-2 hover:bg-white/10 px-3 py-2 rounded-full h-auto transition-colors">
                  <span className="hidden sm:inline text-sm font-medium">{user.name || user.username}</span>
                  <Avatar className="h-8 w-8 bg-secondary/80 text-white ring-2 ring-white/30">
                    <AvatarFallback>{getInitials()}</AvatarFallback>
                  </Avatar>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56 mt-1 border-none shadow-lg rounded-xl">
                <div className="px-4 py-3 border-b">
                  <p className="text-sm font-medium">{user.name || user.username}</p>
                  <p className="text-xs text-muted-foreground mt-1">{user.email}</p>
                </div>
                <Link href="/profile">
                  <DropdownMenuItem className="cursor-pointer">
                    <User className="mr-2 h-4 w-4" />
                    <span>Profile</span>
                  </DropdownMenuItem>
                </Link>
                
                {user.role === "admin" && (
                  <>
                    <Link href="/admin">
                      <DropdownMenuItem className="cursor-pointer">
                        <Settings className="mr-2 h-4 w-4" />
                        <span>Admin Dashboard</span>
                      </DropdownMenuItem>
                    </Link>
                    <Link href="/email-notifications">
                      <DropdownMenuItem className="cursor-pointer">
                        <Mail className="mr-2 h-4 w-4" />
                        <span>Email Notifications</span>
                      </DropdownMenuItem>
                    </Link>
                  </>
                )}
                
                <DropdownMenuSeparator />
                
                <DropdownMenuItem 
                  onClick={handleLogout} 
                  disabled={logoutMutation.isPending}
                  className="cursor-pointer text-destructive focus:text-destructive"
                >
                  <LogOut className="mr-2 h-4 w-4" />
                  <span>{logoutMutation.isPending ? "Logging out..." : "Log out"}</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </div>
      
      {/* Main Navigation */}
      <nav className="border-t border-white/10 bg-white/5 backdrop-blur-sm">
        <div className="container mx-auto px-4">
          <div className="flex justify-between items-center">
            <ul className="flex flex-wrap">
              <li className="mr-2">
                <Link href="/">
                  <div className={`inline-block py-3 px-4 font-medium transition-all ${
                    location === "/" 
                      ? "text-white border-b-2 border-white" 
                      : "text-white/70 hover:text-white border-b-2 border-transparent hover:border-white/50"
                  }`}>
                    Home
                  </div>
                </Link>
              </li>
              <li className="mr-2">
                <Link href="/events">
                  <div className={`inline-block py-3 px-4 font-medium transition-all ${
                    location === "/events" || location.startsWith("/events/")
                      ? "text-white border-b-2 border-white" 
                      : "text-white/70 hover:text-white border-b-2 border-transparent hover:border-white/50"
                  }`}>
                    Events
                  </div>
                </Link>
              </li>
              {user && (user.role === "event_owner" || user.role === "admin") && (
                <li className="mr-2">
                  <Link href="/my-events">
                    <div className={`inline-block py-3 px-4 font-medium transition-all ${
                      location === "/my-events" || location.startsWith("/my-events/")
                        ? "text-white border-b-2 border-white" 
                        : "text-white/70 hover:text-white border-b-2 border-transparent hover:border-white/50"
                    }`}>
                      My Events
                    </div>
                  </Link>
                </li>
              )}
              {user && user.role === "admin" && (
                <>
                  <li className="mr-2">
                    <Link href="/admin">
                      <div className={`inline-block py-3 px-4 font-medium transition-all ${
                        location === "/admin" 
                          ? "text-white border-b-2 border-white" 
                          : "text-white/70 hover:text-white border-b-2 border-transparent hover:border-white/50"
                      }`}>
                        Admin
                      </div>
                    </Link>
                  </li>
                  <li className="mr-2">
                    <Link href="/email-notifications">
                      <div className={`inline-block py-3 px-4 font-medium transition-all ${
                        location === "/email-notifications" 
                          ? "text-white border-b-2 border-white" 
                          : "text-white/70 hover:text-white border-b-2 border-transparent hover:border-white/50"
                      }`}>
                        Email Notifications
                      </div>
                    </Link>
                  </li>
                </>
              )}
              {user && (user.role === "event_owner" || user.role === "admin") && (
                <li className="mr-2">
                  <Link href="/payment-connections">
                    <div className={`inline-block py-3 px-4 font-medium transition-all ${
                      location === "/payment-connections" 
                        ? "text-white border-b-2 border-white" 
                        : "text-white/70 hover:text-white border-b-2 border-transparent hover:border-white/50"
                    }`}>
                      Payment Connections
                    </div>
                  </Link>
                </li>
              )}
            </ul>
            
            {/* Stripe connection status indicator */}
            {user && (user.role === "event_owner" || user.role === "admin") && (
              <div className="flex items-center ml-auto">
                {isLoadingStripeStatus ? (
                  <div className="flex items-center text-xs bg-gray-100 text-gray-500 px-3 py-1 rounded-full">
                    <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                    <span>Checking...</span>
                  </div>
                ) : (
                  <>
                    {/* Multi-level check for connected status similar to PaymentConnectionsPage */}
                    {(() => {
                      // Robust status detection - never display incorrect status due to data inconsistency
                      let isConnected = false;
                      
                      try {
                        // PRIMARY CHECK: Direct from connected field
                        if (stripeStatus && typeof stripeStatus.connected === 'boolean') {
                          isConnected = stripeStatus.connected;
                        }
                        // SECONDARY CHECK: Account ID presence
                        else if (stripeStatus?.accountId && 
                                typeof stripeStatus.accountId === 'string' && 
                                stripeStatus.accountId.startsWith('acct_')) {
                          isConnected = true;
                        }
                        // TERTIARY CHECK: Account capabilities
                        else if (stripeStatus && 
                                (stripeStatus.detailsSubmitted === true || 
                                stripeStatus.chargesEnabled === true || 
                                stripeStatus.payoutsEnabled === true)) {
                          isConnected = true;
                        }
                      } catch (error) {
                        console.error("Error determining status in navbar:", error);
                      }
                      
                      return isConnected ? (
                        <div className="flex items-center text-xs bg-green-100 text-green-800 px-3 py-1 rounded-full">
                          <BadgeCheck className="h-3 w-3 mr-1 text-green-600" />
                          <span>Stripe Connected</span>
                        </div>
                      ) : (
                        <div className="flex items-center text-xs bg-amber-100 text-amber-800 px-3 py-1 rounded-full">
                          <AlertCircle className="h-3 w-3 mr-1 text-amber-600" />
                          <span>Not Connected</span>
                        </div>
                      );
                    })()}
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      </nav>
    </header>
  );
}