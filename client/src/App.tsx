import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import { AuthProvider } from "@/hooks/use-auth";
import { CartProvider } from "@/hooks/use-cart";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import HomePage from "@/pages/HomePage";
import AuthPage from "@/pages/AuthPage";
import EventsPage from "@/pages/EventsPage";
import EventDetailsPage from "@/pages/EventDetailsPage";
import MyEventsPage from "@/pages/MyEventsPage";
import AdminDashboardPage from "@/pages/AdminDashboardPage";
import VendorRegistrationPage from "@/pages/VendorRegistrationPage";
import VolunteerRegistrationPage from "@/pages/VolunteerRegistrationPage";

import PaymentConnectionsPage from "@/pages/PaymentConnectionsPage";
import UserProfilePage from "@/pages/UserProfilePage";

function Router() {
  return (
    <Switch>
      {/* Public routes - no login required */}
      <Route path="/" component={HomePage} />
      <Route path="/auth" component={AuthPage} />
      <Route path="/events" component={EventsPage} />
      <Route path="/events/:id" component={EventDetailsPage} />
      
      {/* Basic user features - any logged in user */}
      <ProtectedRoute path="/profile" component={UserProfilePage} />
      <ProtectedRoute path="/registration/vendor/:id" component={VendorRegistrationPage} />
      <ProtectedRoute path="/registration/volunteer/:id" component={VolunteerRegistrationPage} />
      
      {/* Event owner features */}
      <ProtectedRoute path="/my-events" component={MyEventsPage} roles={["event_owner"]} />
      <ProtectedRoute path="/payment-connections" component={PaymentConnectionsPage} roles={["event_owner"]} />
      
      {/* Admin-only routes */}
      <ProtectedRoute path="/admin" component={AdminDashboardPage} roles={["admin"]} />
      
      {/* 404 page */}
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <CartProvider>
          <TooltipProvider>
            <Toaster />
            <Router />
          </TooltipProvider>
        </CartProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
