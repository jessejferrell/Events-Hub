import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import StatCard from "@/components/admin/StatCard";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  User, 
  Calendar, 
  DollarSign, 
  Ticket, 
  BarChart2, 
  PieChart, 
  Users, 
  Settings 
} from "lucide-react";
import { format } from "date-fns";
import { Event, Payment } from "@shared/schema";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

// Types for admin stats
interface AdminStats {
  totalUsers: number;
  activeEvents: number;
  monthlyRevenue: number;
  ticketsSoldMTD: number;
  recentEvents: Event[];
  recentPayments: Payment[];
}

export default function AdminDashboardPage() {
  const [activeTab, setActiveTab] = useState("overview");

  // Fetch admin stats
  const { data: stats, isLoading } = useQuery<AdminStats>({
    queryKey: ["/api/admin/stats"],
    queryFn: async () => {
      const res = await fetch("/api/admin/stats");
      if (!res.ok) throw new Error("Failed to fetch admin stats");
      return await res.json();
    },
  });

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      
      <main className="flex-grow container mx-auto px-4 py-6">
        <h1 className="text-2xl font-bold mb-1">Admin Dashboard</h1>
        <p className="text-neutral-500 mb-6">Manage users, events, payments, and system settings</p>
        
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <StatCard 
            title="Total Users" 
            value={isLoading ? "-" : stats?.totalUsers.toString() || "0"} 
            icon={<User />} 
            linkText="View all users" 
            linkHref="#users" 
            iconBgClass="bg-neutral-100"
            isLoading={isLoading}
          />
          
          <StatCard 
            title="Active Events" 
            value={isLoading ? "-" : stats?.activeEvents.toString() || "0"} 
            icon={<Calendar />} 
            linkText="View all events" 
            linkHref="#events" 
            iconBgClass="bg-green-100"
            isLoading={isLoading}
          />
          
          <StatCard 
            title="Monthly Revenue" 
            value={isLoading ? "-" : `$${stats?.monthlyRevenue.toFixed(2) || "0.00"}`} 
            icon={<DollarSign />} 
            linkText="View financial reports" 
            linkHref="#analytics" 
            iconBgClass="bg-blue-100"
            isLoading={isLoading}
          />
          
          <StatCard 
            title="Tickets Sold (MTD)" 
            value={isLoading ? "-" : stats?.ticketsSoldMTD.toString() || "0"} 
            icon={<Ticket />} 
            linkText="View ticket reports" 
            linkHref="#analytics" 
            iconBgClass="bg-purple-100"
            isLoading={isLoading}
          />
        </div>
        
        {/* Admin Tabs */}
        <Tabs defaultValue={activeTab} onValueChange={setActiveTab} className="mb-8">
          <TabsList className="border-b w-full justify-start rounded-none bg-transparent p-0 mb-6">
            <TabsTrigger 
              value="overview" 
              className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none px-4 py-2 data-[state=active]:text-primary"
            >
              Overview
            </TabsTrigger>
            <TabsTrigger 
              value="users" 
              className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none px-4 py-2 data-[state=active]:text-primary"
            >
              Users
            </TabsTrigger>
            <TabsTrigger 
              value="events" 
              className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none px-4 py-2 data-[state=active]:text-primary"
            >
              Events
            </TabsTrigger>
            <TabsTrigger 
              value="analytics" 
              className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none px-4 py-2 data-[state=active]:text-primary"
            >
              Analytics & Reports
            </TabsTrigger>
            <TabsTrigger 
              value="settings" 
              className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none px-4 py-2 data-[state=active]:text-primary"
            >
              Settings
            </TabsTrigger>
          </TabsList>
          
          {/* Overview Tab Content */}
          <TabsContent value="overview" className="m-0">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
              {/* Recent Events */}
              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2 pt-4 px-4">
                  <div>
                    <CardTitle className="text-lg">Recent Events</CardTitle>
                  </div>
                  <Button variant="link" size="sm" className="text-secondary p-0">
                    View all
                  </Button>
                </CardHeader>
                <CardContent className="px-4 pb-4">
                  {isLoading ? (
                    <div className="flex justify-center py-8">
                      <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
                    </div>
                  ) : stats && stats.recentEvents && stats.recentEvents.length > 0 ? (
                    <div className="space-y-2">
                      {stats.recentEvents.map((event) => (
                        <div key={event.id} className="border border-neutral-100 rounded-lg p-3 hover:bg-neutral-50 transition-colors">
                          <div className="flex justify-between items-start mb-2">
                            <h3 className="font-medium">{event.title}</h3>
                            <Badge variant={event.isActive ? "success" : "secondary"}>
                              {event.isActive ? "Active" : "Inactive"}
                            </Badge>
                          </div>
                          <div className="flex items-center text-sm text-neutral-500 mb-2">
                            <Calendar className="h-4 w-4 mr-1" />
                            <span>{format(new Date(event.startDate), "MMM d, yyyy")}</span>
                            <span className="mx-2">•</span>
                            <Ticket className="h-4 w-4 mr-1" />
                            <span>0 tickets sold</span>
                          </div>
                          <div className="text-sm font-medium">$0.00 revenue</div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8 text-neutral-500">
                      No events found
                    </div>
                  )}
                </CardContent>
              </Card>
              
              {/* Recent Payments */}
              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2 pt-4 px-4">
                  <div>
                    <CardTitle className="text-lg">Recent Payments</CardTitle>
                  </div>
                  <Button variant="link" size="sm" className="text-secondary p-0">
                    View all
                  </Button>
                </CardHeader>
                <CardContent className="px-4 pb-4">
                  {isLoading ? (
                    <div className="flex justify-center py-8">
                      <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
                    </div>
                  ) : stats && stats.recentPayments && stats.recentPayments.length > 0 ? (
                    <table className="min-w-full">
                      <thead>
                        <tr>
                          <th className="py-2 px-2 text-left text-sm font-medium text-neutral-500">Transaction</th>
                          <th className="py-2 px-2 text-left text-sm font-medium text-neutral-500">Amount</th>
                          <th className="py-2 px-2 text-left text-sm font-medium text-neutral-500">Status</th>
                          <th className="py-2 px-2 text-left text-sm font-medium text-neutral-500">Date</th>
                        </tr>
                      </thead>
                      <tbody>
                        {stats.recentPayments.map((payment) => (
                          <tr key={payment.id}>
                            <td className="py-2 px-2 text-sm">{payment.stripePaymentId || `PMT-${payment.id}`}</td>
                            <td className="py-2 px-2 text-sm">${payment.amount.toFixed(2)}</td>
                            <td className="py-2 px-2 text-sm">
                              <Badge variant={
                                payment.status === "completed" ? "success" : 
                                payment.status === "refunded" ? "destructive" : "secondary"
                              }>
                                {payment.status}
                              </Badge>
                            </td>
                            <td className="py-2 px-2 text-sm">{format(new Date(payment.createdAt), "MMM d, yyyy")}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  ) : (
                    <div className="text-center py-8 text-neutral-500">
                      No payments found
                    </div>
                  )}
                </CardContent>
              </Card>
              
              {/* Monthly Revenue Chart */}
              <Card>
                <CardHeader className="pb-2 pt-4 px-4">
                  <CardTitle className="text-lg">Monthly Revenue</CardTitle>
                </CardHeader>
                <CardContent className="px-4 pb-4">
                  <div className="h-64 flex items-center justify-center bg-neutral-50 rounded">
                    <div className="text-center text-neutral-400">
                      <BarChart2 className="h-12 w-12 mx-auto mb-2" />
                      <p>Revenue chart will appear here when data is available</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              
              {/* User Distribution Chart */}
              <Card>
                <CardHeader className="pb-2 pt-4 px-4">
                  <CardTitle className="text-lg">User Distribution</CardTitle>
                </CardHeader>
                <CardContent className="px-4 pb-4">
                  <div className="h-64 flex items-center justify-center bg-neutral-50 rounded">
                    <div className="text-center text-neutral-400">
                      <PieChart className="h-12 w-12 mx-auto mb-2" />
                      <p>User distribution chart will appear here when data is available</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
          
          {/* Other tabs content */}
          <TabsContent value="users" className="m-0">
            <Card>
              <CardHeader>
                <CardTitle>User Management</CardTitle>
                <CardDescription>View and manage all users in the system</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex justify-center items-center py-12">
                  <div className="text-center">
                    <Users className="h-12 w-12 mx-auto mb-4 text-neutral-300" />
                    <p className="text-neutral-600 mb-2">User management interface will be implemented here</p>
                    <p className="text-neutral-500 text-sm">This section will include user listing, role management, and user details</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
          
          <TabsContent value="events" className="m-0">
            <Card>
              <CardHeader>
                <CardTitle>Event Management</CardTitle>
                <CardDescription>View and manage all events in the system</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex justify-center items-center py-12">
                  <div className="text-center">
                    <Calendar className="h-12 w-12 mx-auto mb-4 text-neutral-300" />
                    <p className="text-neutral-600 mb-2">Event management interface will be implemented here</p>
                    <p className="text-neutral-500 text-sm">This section will include event listing, approval, editing, and deletion</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
          
          <TabsContent value="analytics" className="m-0">
            <Card>
              <CardHeader>
                <CardTitle>Analytics & Reports</CardTitle>
                <CardDescription>View detailed analytics and generate reports</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex justify-center items-center py-12">
                  <div className="text-center">
                    <BarChart2 className="h-12 w-12 mx-auto mb-4 text-neutral-300" />
                    <p className="text-neutral-600 mb-2">Analytics dashboard will be implemented here</p>
                    <p className="text-neutral-500 text-sm">This section will include financial reports, ticket sales, and user growth</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
          
          <TabsContent value="settings" className="m-0">
            <Card>
              <CardHeader>
                <CardTitle>System Settings</CardTitle>
                <CardDescription>Configure platform settings and defaults</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex justify-center items-center py-12">
                  <div className="text-center">
                    <Settings className="h-12 w-12 mx-auto mb-4 text-neutral-300" />
                    <p className="text-neutral-600 mb-2">Settings interface will be implemented here</p>
                    <p className="text-neutral-500 text-sm">This section will include global configurations and platform settings</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
      
      <Footer />
    </div>
  );
}
