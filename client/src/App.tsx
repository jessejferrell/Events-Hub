import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import { AuthProvider } from "@/hooks/use-auth";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import HomePage from "@/pages/HomePage";
import AuthPage from "@/pages/AuthPage";
import EventsPage from "@/pages/EventsPage";
import EventDetailsPage from "@/pages/EventDetailsPage";
import MyEventsPage from "@/pages/MyEventsPage";
import AdminDashboardPage from "@/pages/AdminDashboardPage";
import PaymentConnectionsPage from "@/pages/PaymentConnectionsPage";
import UserProfilePage from "@/pages/UserProfilePage";

function Router() {
  return (
    <Switch>
      <Route path="/auth" component={AuthPage} />
      <Route path="/events" component={EventsPage} />
      <Route path="/events/:id" component={EventDetailsPage} />
      <ProtectedRoute path="/" component={HomePage} />
      <ProtectedRoute path="/my-events" component={MyEventsPage} />
      <ProtectedRoute path="/admin" component={AdminDashboardPage} roles={["admin"]} />
      <ProtectedRoute path="/payment-connections" component={PaymentConnectionsPage} roles={["event_owner"]} />
      <ProtectedRoute path="/profile" component={UserProfilePage} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
