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
import { ShoppingCart, LogOut, User, Settings } from "lucide-react";
import { useCallback } from "react";

export default function Navbar() {
  const { user, logoutMutation } = useAuth();
  const [location] = useLocation();

  const handleLogout = useCallback(() => {
    logoutMutation.mutate();
  }, [logoutMutation]);

  if (!user) return null;

  // Generate avatar initials from username or name
  const getInitials = () => {
    if (user.name) {
      return user.name.split(' ').map(n => n[0]).join('').toUpperCase();
    }
    return user.username.substring(0, 2).toUpperCase();
  };

  return (
    <header className="bg-primary text-white">
      {/* Top Navigation Bar */}
      <div className="container mx-auto px-4 py-2 flex justify-between items-center">
        <Link href="/" className="flex items-center space-x-1">
          <span className="font-semibold">City Event Hub</span>
        </Link>
        
        <div className="flex items-center space-x-4">
          <Link href="/cart" className="relative p-1.5 rounded-full hover:bg-white/10">
            <ShoppingCart className="h-5 w-5" />
            {/* We would display badge with count if cart functionality is implemented */}
          </Link>
          
          {/* User Menu */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="flex items-center space-x-1 hover:bg-white/10 px-2 py-1 rounded-md h-auto">
                <span className="hidden sm:inline text-sm font-medium">{user.username}</span>
                <Avatar className="h-8 w-8 bg-white/20 text-white">
                  <AvatarFallback>{getInitials()}</AvatarFallback>
                </Avatar>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <Link href="/profile">
                <DropdownMenuItem>
                  <User className="mr-2 h-4 w-4" />
                  <span>Profile</span>
                </DropdownMenuItem>
              </Link>
              
              {user.role === "admin" && (
                <Link href="/admin">
                  <DropdownMenuItem>
                    <Settings className="mr-2 h-4 w-4" />
                    <span>Admin Dashboard</span>
                  </DropdownMenuItem>
                </Link>
              )}
              
              <DropdownMenuSeparator />
              
              <DropdownMenuItem onClick={handleLogout} disabled={logoutMutation.isPending}>
                <LogOut className="mr-2 h-4 w-4" />
                <span>{logoutMutation.isPending ? "Logging out..." : "Log out"}</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
      
      {/* Main Navigation */}
      <nav className="border-t border-white/20 bg-primary/90">
        <div className="container mx-auto px-4">
          <ul className="flex flex-wrap -mb-px">
            <li className="mr-1">
              <Link href="/">
                <a className={`inline-block py-3 px-4 ${
                  location === "/" 
                    ? "text-white border-b-2 border-white" 
                    : "text-white/80 hover:text-white border-b-2 border-transparent"
                }`}>
                  Home
                </a>
              </Link>
            </li>
            <li className="mr-1">
              <Link href="/events">
                <a className={`inline-block py-3 px-4 ${
                  location === "/events" 
                    ? "text-white border-b-2 border-white" 
                    : "text-white/80 hover:text-white border-b-2 border-transparent"
                }`}>
                  Events
                </a>
              </Link>
            </li>
            {(user.role === "event_owner" || user.role === "admin") && (
              <li className="mr-1">
                <Link href="/my-events">
                  <a className={`inline-block py-3 px-4 ${
                    location === "/my-events" 
                      ? "text-white border-b-2 border-white" 
                      : "text-white/80 hover:text-white border-b-2 border-transparent"
                  }`}>
                    My Events
                  </a>
                </Link>
              </li>
            )}
            {user.role === "admin" && (
              <li className="mr-1">
                <Link href="/admin">
                  <a className={`inline-block py-3 px-4 ${
                    location === "/admin" 
                      ? "text-white border-b-2 border-white" 
                      : "text-white/80 hover:text-white border-b-2 border-transparent"
                  }`}>
                    Admin
                  </a>
                </Link>
              </li>
            )}
            {(user.role === "event_owner" || user.role === "admin") && (
              <li className="mr-1">
                <Link href="/payment-connections">
                  <a className={`inline-block py-3 px-4 ${
                    location === "/payment-connections" 
                      ? "text-white border-b-2 border-white" 
                      : "text-white/80 hover:text-white border-b-2 border-transparent"
                  }`}>
                    Payment Connections
                  </a>
                </Link>
              </li>
            )}
          </ul>
        </div>
      </nav>
    </header>
  );
}
