import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import StatCard from "@/components/admin/StatCard";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  User as UserIcon, 
  Calendar, 
  DollarSign, 
  Ticket, 
  BarChart2, 
  PieChart, 
  Users,
  ShoppingCart,
  Store,
  Clock,
  Download,
  Search,
  Filter,
  RefreshCw,
  FileText,
  Trash,
  Edit,
  Eye,
  AlertTriangle,
  Plus
} from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
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
import { format } from "date-fns";
import { Event, Order, User as UserType } from "@shared/schema";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Label } from "@/components/ui/label";
import { DatePicker } from "@/components/ui/date-picker";

// Types for admin stats
interface AdminStats {
  totalUsers: number;
  activeEvents: number;
  monthlyRevenue: number;
  ticketsSoldMTD: number;
  recentEvents: Event[];
  recentOrders: Order[];
}

// Transaction type for all transaction records
interface Transaction {
  id: number;
  type: "order" | "ticket" | "vendor" | "volunteer";
  reference: string;
  userId: number;
  eventId: number;
  status: string;
  amount: number;
  createdAt: string;
  notes?: string;
  userName?: string;
  userEmail?: string;
  eventTitle?: string;
}

export default function AdminDashboardPage() {
  const [activeTab, setActiveTab] = useState("overview");
  const [searchQuery, setSearchQuery] = useState("");
  const [eventSearchQuery, setEventSearchQuery] = useState("");
  const [eventStatusFilter, setEventStatusFilter] = useState("all");
  const [selectedEventId, setSelectedEventId] = useState<string>("");
  const [selectedTransactionType, setSelectedTransactionType] = useState<string>("");
  const [selectedStatus, setSelectedStatus] = useState<string>("");
  const [startDate, setStartDate] = useState<Date | null>(null);
  const [endDate, setEndDate] = useState<Date | null>(null);
  
  // User management state
  const [userSearchQuery, setUserSearchQuery] = useState('');
  const [selectedRole, setSelectedRole] = useState('all_roles');
  const [selectedUser, setSelectedUser] = useState<UserType | null>(null);
  const [showUserDetail, setShowUserDetail] = useState(false);
  const [userNote, setUserNote] = useState('');
  const [showEditUserForm, setShowEditUserForm] = useState(false);
  
  // Transaction editing state
  const [showTransactionEditor, setShowTransactionEditor] = useState(false);
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null);
  const [transactionStatusOptions, setTransactionStatusOptions] = useState<string[]>([
    'pending', 'completed', 'cancelled', 'refunded', 'failed', 'processing'
  ]);
  const [confirmDeleteTransaction, setConfirmDeleteTransaction] = useState(false);

  // Fetch admin stats
  const { data: stats, isLoading } = useQuery<AdminStats>({
    queryKey: ["/api/admin/stats"],
    queryFn: async () => {
      const res = await fetch("/api/admin/stats");
      if (!res.ok) throw new Error("Failed to fetch admin stats");
      return await res.json();
    },
  });

  // Fetch transactions
  const { data: transactions, isLoading: isLoadingTransactions, refetch: refetchTransactions } = useQuery<Transaction[]>({
    queryKey: ["/api/admin/search", searchQuery, selectedEventId, selectedTransactionType, selectedStatus],
    queryFn: async () => {
      let queryParams = new URLSearchParams();
      
      if (searchQuery) queryParams.append("q", searchQuery);
      if (selectedEventId && selectedEventId !== "all_events") queryParams.append("eventId", selectedEventId);
      if (selectedTransactionType && selectedTransactionType !== "all_types") queryParams.append("type", selectedTransactionType);
      if (selectedStatus && selectedStatus !== "all_statuses") queryParams.append("status", selectedStatus);
      
      const res = await fetch(`/api/admin/search?${queryParams.toString()}`);
      if (!res.ok) throw new Error("Failed to fetch transactions");
      return await res.json();
    },
    enabled: activeTab === "transactions"
  });
  
  // Navigation
  const [, navigate] = useLocation();
  
  // Event management
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  
  // Fetch all events for the Events tab
  const { data: allEvents, isLoading: isLoadingEvents, refetch: refetchEvents } = useQuery<Event[]>({
    queryKey: ["/api/events", eventSearchQuery, eventStatusFilter],
    queryFn: async () => {
      let queryParams = new URLSearchParams();
      
      if (eventSearchQuery) queryParams.append("search", eventSearchQuery);
      if (eventStatusFilter === "upcoming") queryParams.append("isUpcoming", "true");
      
      const res = await fetch(`/api/events?${queryParams.toString()}`);
      if (!res.ok) throw new Error("Failed to fetch events");
      return await res.json();
    },
    enabled: activeTab === "events"
  });
  
  // Fetch all users for Users tab
  const { data: users, isLoading: isLoadingUsers, refetch: refetchUsers } = useQuery<UserType[]>({
    queryKey: ["/api/admin/users", userSearchQuery, selectedRole],
    queryFn: async () => {
      let queryParams = new URLSearchParams();
      
      if (userSearchQuery) queryParams.append("search", userSearchQuery);
      if (selectedRole && selectedRole !== "all_roles") queryParams.append("role", selectedRole);
      
      const res = await fetch(`/api/admin/users?${queryParams.toString()}`);
      if (!res.ok) throw new Error("Failed to fetch users");
      return await res.json();
    },
    enabled: activeTab === "users"
  });
  
  // Delete event mutation
  const deleteEventMutation = useMutation({
    mutationFn: async (eventId: number) => {
      const res = await fetch(`/api/events/${eventId}`, {
        method: 'DELETE',
      });
      if (!res.ok) {
        throw new Error('Failed to delete event');
      }
      return true;
    },
    onSuccess: () => {
      refetchEvents();
      setShowDeleteConfirm(false);
      setSelectedEvent(null);
    },
  });
  
  // Toggle event status mutation
  const toggleEventStatusMutation = useMutation({
    mutationFn: async ({ id, isActive }: { id: number; isActive: boolean }) => {
      const res = await fetch(`/api/events/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ isActive }),
      });
      if (!res.ok) {
        throw new Error('Failed to update event status');
      }
      return await res.json();
    },
    onSuccess: () => {
      refetchEvents();
    },
  });
  
  // Update user role mutation
  const updateUserRoleMutation = useMutation({
    mutationFn: async ({ userId, role }: { userId: number; role: string }) => {
      const res = await fetch(`/api/admin/users/${userId}/role`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ role }),
      });
      if (!res.ok) {
        throw new Error('Failed to update user role');
      }
      return await res.json();
    },
    onSuccess: () => {
      refetchUsers();
    },
  });
  
  // Add user note mutation
  const addUserNoteMutation = useMutation({
    mutationFn: async ({ userId, note }: { userId: number; note: string }) => {
      const res = await fetch(`/api/admin/users/${userId}/notes`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ note }),
      });
      if (!res.ok) {
        throw new Error('Failed to add user note');
      }
      return await res.json();
    },
    onSuccess: () => {
      setUserNote('');
      // If we're viewing user details, we should refresh that data too
      if (selectedUser && showUserDetail) {
        fetchUserDetails(selectedUser.id);
      }
    },
  });
  
  // Handle event actions
  const handleViewEvent = (eventId: number) => {
    window.open(`/events/${eventId}`, '_blank');
  };
  
  const handleEditEvent = (eventId: number) => {
    navigate(`/events/${eventId}/edit`);
  };
  
  const handleManageTickets = (eventId: number) => {
    navigate(`/events/${eventId}/tickets`);
  };
  
  const handleToggleEventStatus = (event: Event) => {
    toggleEventStatusMutation.mutate({ 
      id: event.id, 
      isActive: !event.isActive 
    });
  };
  
  const handleDeleteEvent = (event: Event) => {
    setSelectedEvent(event);
    setShowDeleteConfirm(true);
  };
  
  const confirmDeleteEvent = () => {
    if (selectedEvent) {
      deleteEventMutation.mutate(selectedEvent.id);
    }
  };

  // User management handlers
  const fetchUserDetails = async (userId: number) => {
    try {
      const res = await fetch(`/api/admin/users/${userId}/details`);
      if (!res.ok) throw new Error('Failed to fetch user details');
      const userData = await res.json();
      setSelectedUser(userData);
      setShowUserDetail(true);
    } catch (error) {
      console.error('Error fetching user details:', error);
    }
  };
  
  const handleViewUser = (user: UserType) => {
    setSelectedUser(user);
    fetchUserDetails(user.id);
  };
  
  const handleUpdateUserRole = (userId: number, role: string) => {
    updateUserRoleMutation.mutate({ userId, role });
  };
  
  const handleAddUserNote = () => {
    if (selectedUser && userNote.trim()) {
      addUserNoteMutation.mutate({
        userId: selectedUser.id,
        note: userNote.trim()
      });
    }
  };
  
  const handleUserSearchFilter = () => {
    refetchUsers();
  };

  const handleSearch = () => {
    refetchTransactions();
  };
  
  // Transaction editing handlers
  const handleEditTransaction = (transaction: Transaction) => {
    setSelectedTransaction(transaction);
    setShowTransactionEditor(true);
  };
  
  const handleDeleteTransaction = (transaction: Transaction) => {
    setSelectedTransaction(transaction);
    setConfirmDeleteTransaction(true);
  };
  
  // Transaction update mutation
  const updateTransactionMutation = useMutation({
    mutationFn: async (transactionData: Partial<Transaction>) => {
      if (!selectedTransaction) throw new Error('No transaction selected');
      
      const endpoint = `/api/admin/${selectedTransaction.type}s/${selectedTransaction.id}`;
      const res = await fetch(endpoint, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(transactionData),
      });
      
      if (!res.ok) throw new Error(`Failed to update ${selectedTransaction.type}`);
      return await res.json();
    },
    onSuccess: () => {
      setShowTransactionEditor(false);
      refetchTransactions();
    }
  });
  
  // Transaction delete mutation
  const deleteTransactionMutation = useMutation({
    mutationFn: async () => {
      if (!selectedTransaction) throw new Error('No transaction selected');
      
      const endpoint = `/api/admin/${selectedTransaction.type}s/${selectedTransaction.id}`;
      const res = await fetch(endpoint, {
        method: 'DELETE',
      });
      
      if (!res.ok) throw new Error(`Failed to delete ${selectedTransaction.type}`);
      return true;
    },
    onSuccess: () => {
      setConfirmDeleteTransaction(false);
      refetchTransactions();
    }
  });

  const handleExport = async () => {
    let queryParams = new URLSearchParams();
    
    if (searchQuery) queryParams.append("q", searchQuery);
    if (selectedEventId && selectedEventId !== "all_events") queryParams.append("eventId", selectedEventId);
    if (selectedTransactionType && selectedTransactionType !== "all_types") queryParams.append("type", selectedTransactionType);
    if (selectedStatus && selectedStatus !== "all_statuses") queryParams.append("status", selectedStatus);
    
    if (startDate) queryParams.append("startDate", startDate.toISOString());
    if (endDate) queryParams.append("endDate", endDate.toISOString());
    
    window.open(`/api/admin/export?${queryParams.toString()}`, "_blank");
  };

  const getStatusBadgeVariant = (status: string) => {
    switch (status.toLowerCase()) {
      case 'completed':
      case 'active':
      case 'approved':
      case 'paid':
      case 'success':
        return 'success';
      case 'pending':
      case 'awaiting':
        return 'warning';
      case 'refunded':
      case 'rejected':
      case 'cancelled':
        return 'destructive';
      default:
        return 'secondary';
    }
  };

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      
      <main className="flex-grow container mx-auto px-4 py-6">
        <h1 className="text-2xl font-bold mb-1">Admin Dashboard</h1>
        <p className="text-neutral-500 mb-6">Manage users, events, and payments</p>
        
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <StatCard 
            title="Total Users" 
            value={isLoading ? "-" : stats?.totalUsers.toString() || "0"} 
            icon={<UserIcon />} 
            linkText="View all users" 
            linkHref="#users" 
            iconBgClass="bg-neutral-100"
            isLoading={isLoading}
            onClick={() => setActiveTab("users")}
          />
          
          <StatCard 
            title="Active Events" 
            value={isLoading ? "-" : stats?.activeEvents.toString() || "0"} 
            icon={<Calendar />} 
            linkText="View all events" 
            linkHref="#events" 
            iconBgClass="bg-green-100"
            isLoading={isLoading}
            onClick={() => setActiveTab("events")}
          />
          
          <StatCard 
            title="Monthly Revenue" 
            value={isLoading ? "-" : `$${stats?.monthlyRevenue.toFixed(2) || "0.00"}`} 
            icon={<DollarSign />} 
            linkText="View financial reports" 
            linkHref="#transactions" 
            iconBgClass="bg-blue-100"
            isLoading={isLoading}
            onClick={() => setActiveTab("transactions")}
          />
          
          <StatCard 
            title="Tickets Sold (MTD)" 
            value={isLoading ? "-" : stats?.ticketsSoldMTD.toString() || "0"} 
            icon={<Ticket />} 
            linkText="View ticket reports" 
            linkHref="#transactions" 
            iconBgClass="bg-purple-100"
            isLoading={isLoading}
            onClick={() => {
              setActiveTab("transactions");
              setSelectedTransactionType("ticket");
            }}
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
              value="transactions" 
              className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none px-4 py-2 data-[state=active]:text-primary"
            >
              Transactions
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
                  <Button variant="link" size="sm" className="text-secondary p-0" onClick={() => setActiveTab("events")}>
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
                            <span>{new Date(event.startDate).toLocaleDateString()}</span>
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
              
              {/* Recent Orders */}
              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2 pt-4 px-4">
                  <div>
                    <CardTitle className="text-lg">Recent Orders</CardTitle>
                  </div>
                  <Button 
                    variant="link" 
                    size="sm" 
                    className="text-secondary p-0" 
                    onClick={() => {
                      setActiveTab("transactions");
                      setSelectedTransactionType("order");
                    }}
                  >
                    View all
                  </Button>
                </CardHeader>
                <CardContent className="px-4 pb-4">
                  {isLoading ? (
                    <div className="flex justify-center py-8">
                      <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
                    </div>
                  ) : stats && stats.recentOrders && stats.recentOrders.length > 0 ? (
                    <table className="min-w-full">
                      <thead>
                        <tr>
                          <th className="py-2 px-2 text-left text-sm font-medium text-neutral-500">Order #</th>
                          <th className="py-2 px-2 text-left text-sm font-medium text-neutral-500">Amount</th>
                          <th className="py-2 px-2 text-left text-sm font-medium text-neutral-500">Status</th>
                          <th className="py-2 px-2 text-left text-sm font-medium text-neutral-500">Date</th>
                        </tr>
                      </thead>
                      <tbody>
                        {stats.recentOrders.map((order) => (
                          <tr key={order.id}>
                            <td className="py-2 px-2 text-sm">{order.orderNumber}</td>
                            <td className="py-2 px-2 text-sm">${order.totalAmount.toFixed(2)}</td>
                            <td className="py-2 px-2 text-sm">
                              <Badge variant={getStatusBadgeVariant(order.status)}>
                                {order.status}
                              </Badge>
                            </td>
                            <td className="py-2 px-2 text-sm">{new Date(order.createdAt).toLocaleDateString()}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  ) : (
                    <div className="text-center py-8 text-neutral-500">
                      No orders found
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
          
          {/* Transactions Tab Content */}
          <TabsContent value="transactions" className="m-0">
            <Card>
              <CardHeader>
                <CardTitle>Transaction Management</CardTitle>
                <CardDescription>View and manage all transactions across the platform</CardDescription>
              </CardHeader>
              <CardContent>
                {/* Filters */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
                  <div>
                    <Label htmlFor="search" className="mb-1.5 block">Search</Label>
                    <div className="relative">
                      <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-neutral-500" />
                      <Input
                        id="search"
                        placeholder="Order #, transaction ID..."
                        className="pl-9"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                      />
                    </div>
                  </div>
                  
                  <div>
                    <Label htmlFor="event" className="mb-1.5 block">Event</Label>
                    <Select value={selectedEventId} onValueChange={setSelectedEventId}>
                      <SelectTrigger id="event">
                        <SelectValue placeholder="All Events" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all_events">All Events</SelectItem>
                        {stats?.recentEvents?.map(event => (
                          <SelectItem key={event.id} value={event.id.toString()}>
                            {event.title}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div>
                    <Label htmlFor="type" className="mb-1.5 block">Transaction Type</Label>
                    <Select value={selectedTransactionType} onValueChange={setSelectedTransactionType}>
                      <SelectTrigger id="type">
                        <SelectValue placeholder="All Types" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all_types">All Types</SelectItem>
                        <SelectItem value="order">Orders</SelectItem>
                        <SelectItem value="ticket">Tickets</SelectItem>
                        <SelectItem value="vendor">Vendor Registrations</SelectItem>
                        <SelectItem value="volunteer">Volunteer Assignments</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div>
                    <Label htmlFor="status" className="mb-1.5 block">Status</Label>
                    <Select value={selectedStatus} onValueChange={setSelectedStatus}>
                      <SelectTrigger id="status">
                        <SelectValue placeholder="All Statuses" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all_statuses">All Statuses</SelectItem>
                        <SelectItem value="pending">Pending</SelectItem>
                        <SelectItem value="completed">Completed/Active</SelectItem>
                        <SelectItem value="cancelled">Cancelled</SelectItem>
                        <SelectItem value="refunded">Refunded</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div className="flex items-end">
                    <Button onClick={handleSearch} className="w-full">
                      <Filter className="h-4 w-4 mr-2" />
                      Apply Filters
                    </Button>
                  </div>
                </div>
                
                <Separator className="my-6" />
                
                {/* Transaction table */}
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse">
                    <thead>
                      <tr className="bg-neutral-50">
                        <th className="py-3 px-4 text-left text-sm font-medium text-neutral-500 border-b">Type</th>
                        <th className="py-3 px-4 text-left text-sm font-medium text-neutral-500 border-b">Reference</th>
                        <th className="py-3 px-4 text-left text-sm font-medium text-neutral-500 border-b">Event</th>
                        <th className="py-3 px-4 text-left text-sm font-medium text-neutral-500 border-b">User</th>
                        <th className="py-3 px-4 text-left text-sm font-medium text-neutral-500 border-b">Amount</th>
                        <th className="py-3 px-4 text-left text-sm font-medium text-neutral-500 border-b">Status</th>
                        <th className="py-3 px-4 text-left text-sm font-medium text-neutral-500 border-b">Date</th>
                        <th className="py-3 px-4 text-left text-sm font-medium text-neutral-500 border-b">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {isLoadingTransactions ? (
                        <tr>
                          <td colSpan={8} className="py-8 text-center">
                            <div className="flex justify-center">
                              <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
                            </div>
                          </td>
                        </tr>
                      ) : transactions && transactions.length > 0 ? (
                        transactions.map((transaction) => (
                          <tr key={`${transaction.type}-${transaction.id}`} className="border-b hover:bg-neutral-50">
                            <td className="py-4 px-4">
                              {transaction.type === "order" && <ShoppingCart className="h-5 w-5 text-blue-500" />}
                              {transaction.type === "ticket" && <Ticket className="h-5 w-5 text-green-500" />}
                              {transaction.type === "vendor" && <Store className="h-5 w-5 text-purple-500" />}
                              {transaction.type === "volunteer" && <Clock className="h-5 w-5 text-amber-500" />}
                            </td>
                            <td className="py-4 px-4 font-medium">{transaction.reference}</td>
                            <td className="py-4 px-4">{transaction.eventTitle || `Event #${transaction.eventId}`}</td>
                            <td className="py-4 px-4">{transaction.userName || transaction.userEmail || `User #${transaction.userId}`}</td>
                            <td className="py-4 px-4 font-medium">${transaction.amount.toFixed(2)}</td>
                            <td className="py-4 px-4">
                              <Badge variant={getStatusBadgeVariant(transaction.status)}>
                                {transaction.status}
                              </Badge>
                            </td>
                            <td className="py-4 px-4">{new Date(transaction.createdAt).toLocaleDateString()}</td>
                            <td className="py-4 px-4">
                              <div className="flex items-center space-x-2">
                                <Button 
                                  variant="outline" 
                                  size="sm"
                                  onClick={() => handleEditTransaction(transaction)}
                                >
                                  <Edit className="h-3.5 w-3.5 mr-1" />
                                  Edit
                                </Button>
                                <Button 
                                  variant="ghost" 
                                  size="sm"
                                  className="text-destructive hover:text-destructive/80"
                                  onClick={() => handleDeleteTransaction(transaction)}
                                >
                                  <Trash className="h-3.5 w-3.5 mr-1" />
                                  Delete
                                </Button>
                              </div>
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={8} className="py-8 text-center text-neutral-500">
                            No transactions found matching your criteria
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </CardContent>
              <CardFooter className="flex justify-between">
                <div className="flex items-center space-x-2">
                  <Label>Date Range:</Label>
                  <DatePicker
                    date={startDate}
                    setDate={setStartDate}
                    placeholder="Start Date"
                  />
                  <span>to</span>
                  <DatePicker
                    date={endDate}
                    setDate={setEndDate}
                    placeholder="End Date"
                  />
                </div>
                <div className="flex space-x-2">
                  <Button variant="outline" onClick={() => refetchTransactions()}>
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Refresh
                  </Button>
                  <Button onClick={handleExport}>
                    <Download className="h-4 w-4 mr-2" />
                    Export CSV
                  </Button>
                </div>
              </CardFooter>
            </Card>
          </TabsContent>
          
          {/* Users tab content */}
          <TabsContent value="users" className="m-0">
            <Card>
              <CardHeader>
                <CardTitle>User Management</CardTitle>
                <CardDescription>View and manage all users in the system</CardDescription>
              </CardHeader>
              <CardContent>
                {/* Filters */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                  <div>
                    <Label htmlFor="user-search" className="mb-1.5 block">Search</Label>
                    <div className="relative">
                      <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-neutral-500" />
                      <Input
                        id="user-search"
                        placeholder="Name, email, username..."
                        className="pl-9"
                        value={userSearchQuery}
                        onChange={(e) => setUserSearchQuery(e.target.value)}
                      />
                    </div>
                  </div>
                  
                  <div>
                    <Label htmlFor="role" className="mb-1.5 block">Role Filter</Label>
                    <Select value={selectedRole} onValueChange={setSelectedRole}>
                      <SelectTrigger id="role">
                        <SelectValue placeholder="All Roles" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all_roles">All Roles</SelectItem>
                        <SelectItem value="admin">Administrators</SelectItem>
                        <SelectItem value="organizer">Event Organizers</SelectItem>
                        <SelectItem value="vendor">Vendors</SelectItem>
                        <SelectItem value="user">Regular Users</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div className="flex items-end">
                    <Button onClick={handleUserSearchFilter} className="mb-[2px]">
                      <Filter className="h-4 w-4 mr-2" />
                      Filter
                    </Button>
                  </div>
                </div>

                {/* User listing */}
                {isLoadingUsers ? (
                  <div className="flex justify-center py-12">
                    <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
                  </div>
                ) : users && users.length > 0 ? (
                  <div className="rounded-md border">
                    <table className="min-w-full divide-y divide-neutral-200">
                      <thead className="bg-neutral-50">
                        <tr>
                          <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">
                            User
                          </th>
                          <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">
                            Role
                          </th>
                          <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">
                            Status
                          </th>
                          <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">
                            Joined
                          </th>
                          <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-neutral-500 uppercase tracking-wider">
                            Actions
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-neutral-200">
                        {users.map((user) => (
                          <tr key={user.id} className="hover:bg-neutral-50">
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="flex items-center">
                                <div className="flex-shrink-0 h-10 w-10 bg-neutral-200 rounded-full flex items-center justify-center">
                                  <UserIcon className="h-5 w-5 text-neutral-500" />
                                </div>
                                <div className="ml-4">
                                  <div className="text-sm font-medium text-neutral-900">
                                    {user.username}
                                  </div>
                                  <div className="text-sm text-neutral-500">
                                    {user.email}
                                  </div>
                                </div>
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <Badge 
                                variant={user.role === 'admin' ? 'destructive' : 
                                         user.role === 'organizer' ? 'default' : 
                                         'secondary'}
                              >
                                {user.role}
                              </Badge>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <Badge variant={user.lastLogin ? 'success' : 'outline'}>
                                {user.lastLogin ? 'Active' : 'Inactive'}
                              </Badge>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-neutral-500">
                              {new Date(user.createdAt).toLocaleDateString()}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                              <Button 
                                variant="ghost" 
                                size="sm" 
                                onClick={() => handleViewUser(user)}
                                className="text-primary hover:text-primary-dark"
                              >
                                View
                              </Button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="text-center py-12 border rounded-md">
                    <Users className="h-12 w-12 mx-auto mb-4 text-neutral-300" />
                    <p className="text-neutral-600 mb-2">No users found</p>
                    <p className="text-neutral-500 text-sm">Try a different search term or filter</p>
                  </div>
                )}
              </CardContent>
            </Card>
            
            {/* User Detail Dialog */}
            <Dialog open={showUserDetail} onOpenChange={setShowUserDetail}>
              <DialogContent className="max-w-4xl">
                {selectedUser && (
                  <>
                    <DialogHeader>
                      <DialogTitle>User Details</DialogTitle>
                    </DialogHeader>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                      {/* Basic User Info */}
                      <div className="space-y-4">
                        <div className="bg-neutral-100 p-6 rounded-lg text-center">
                          <div className="h-20 w-20 bg-neutral-200 rounded-full mx-auto flex items-center justify-center mb-4">
                            <UserIcon className="h-10 w-10 text-neutral-500" />
                          </div>
                          <h3 className="text-lg font-medium mb-1">{selectedUser.username}</h3>
                          <p className="text-neutral-500 mb-2">{selectedUser.email}</p>
                          <Badge variant="outline" className="mb-4">{selectedUser.role}</Badge>
                          
                          <div className="text-sm text-neutral-600">
                            <p className="flex justify-between pt-2 border-t">
                              <span>User ID:</span>
                              <span className="font-mono">{selectedUser.id}</span>
                            </p>
                            <p className="flex justify-between pt-2 border-t">
                              <span>Joined:</span>
                              <span>{new Date(selectedUser.createdAt).toLocaleDateString()}</span>
                            </p>
                            <p className="flex justify-between pt-2 border-t">
                              <span>Last update:</span>
                              <span>{new Date(selectedUser.updatedAt).toLocaleDateString()}</span>
                            </p>
                          </div>
                        </div>
                        
                        {/* Role Management */}
                        <div className="border rounded-lg p-4">
                          <h4 className="font-medium mb-3">Role Management</h4>
                          <div className="space-y-3">
                            <Select 
                              value={selectedUser.role} 
                              onValueChange={(value) => handleUpdateUserRole(selectedUser.id, value)}
                            >
                              <SelectTrigger>
                                <SelectValue placeholder="Select Role" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="admin">Administrator</SelectItem>
                                <SelectItem value="organizer">Event Organizer</SelectItem>
                                <SelectItem value="vendor">Vendor</SelectItem>
                                <SelectItem value="user">Regular User</SelectItem>
                              </SelectContent>
                            </Select>
                            <Button 
                              variant={selectedUser.lastLogin ? "destructive" : "default"} 
                              className="w-full"
                            >
                              {selectedUser.lastLogin ? "Deactivate Account" : "Activate Account"}
                            </Button>
                          </div>
                        </div>
                      </div>
                      
                      {/* User Activity & Orders */}
                      <div className="md:col-span-2 space-y-4">
                        <div className="border rounded-lg p-4">
                          <h4 className="font-medium mb-3">Account Information</h4>
                          <div className="space-y-4">
                            <div className="grid grid-cols-2 gap-2 text-sm">
                              <div className="text-neutral-500">Name:</div>
                              <div>{selectedUser.name || 'Not provided'}</div>
                              
                              <div className="text-neutral-500">Phone:</div>
                              <div>{selectedUser.phoneNumber || 'Not provided'}</div>
                              
                              <div className="text-neutral-500">Address:</div>
                              <div>{selectedUser.address || 'Not provided'}</div>
                              
                              <div className="text-neutral-500">City:</div>
                              <div>{selectedUser.city || 'Not provided'}</div>
                              
                              <div className="text-neutral-500">State:</div>
                              <div>{selectedUser.state || 'Not provided'}</div>
                              
                              <div className="text-neutral-500">Zip Code:</div>
                              <div>{selectedUser.zipCode || 'Not provided'}</div>
                            </div>
                            
                            <div className="pt-3 border-t">
                              <h5 className="text-sm font-medium mb-2">Payment Connections</h5>
                              <div className="grid grid-cols-2 gap-2 text-sm">
                                <div className="text-neutral-500">Stripe Customer:</div>
                                <div>
                                  {selectedUser.stripeCustomerId ? (
                                    <Badge variant="outline" className="font-mono text-xs">
                                      {selectedUser.stripeCustomerId.substring(0, 14)}...
                                    </Badge>
                                  ) : 'Not connected'}
                                </div>
                                
                                <div className="text-neutral-500">Stripe Connect:</div>
                                <div>
                                  {selectedUser.stripeAccountId ? (
                                    <Badge variant="outline" className="font-mono text-xs">
                                      {selectedUser.stripeAccountId.substring(0, 14)}...
                                    </Badge>
                                  ) : 'Not connected'}
                                </div>
                              </div>
                            </div>
                            
                            <div className="pt-3 border-t">
                              <h5 className="text-sm font-medium mb-2">Last Activity</h5>
                              <div className="flex items-center gap-2 text-sm">
                                <Clock className="h-4 w-4 text-neutral-500" />
                                <span>
                                  {selectedUser.lastLogin 
                                    ? `Last login: ${new Date(selectedUser.lastLogin).toLocaleString()}`
                                    : 'No login recorded'}
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>
                        
                        <div className="border rounded-lg p-4">
                          <h4 className="font-medium mb-3">Notes</h4>
                          <div className="mb-3">
                            <Input 
                              placeholder="Add a note about this user..."
                              value={userNote}
                              onChange={(e) => setUserNote(e.target.value)}
                            />
                          </div>
                          <div className="flex justify-end mb-4">
                            <Button size="sm" onClick={handleAddUserNote}>Add Note</Button>
                          </div>
                          <div className="space-y-2 max-h-[200px] overflow-y-auto">
                            {selectedUser.adminNotes && selectedUser.adminNotes.length > 0 ? (
                              selectedUser.adminNotes.map((note, index) => (
                                <div key={index} className="text-sm border-b pb-2">
                                  <p className="text-neutral-800">{note.note}</p>
                                  <div className="flex justify-between items-center mt-1">
                                    <p className="text-neutral-500 text-xs">
                                      By Admin #{note.adminId}
                                    </p>
                                    <p className="text-neutral-500 text-xs">
                                      {new Date(note.createdAt).toLocaleString()}
                                    </p>
                                  </div>
                                </div>
                              ))
                            ) : (
                              <div className="text-center py-4 text-neutral-500">
                                No notes added yet
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </>
                )}
              </DialogContent>
            </Dialog>
          </TabsContent>
          
          {/* Events tab content */}
          <TabsContent value="events" className="m-0">
            <Card>
              <CardHeader>
                <CardTitle>Event Management</CardTitle>
                <CardDescription>View and manage all events in the system</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-6">
                  {/* Event management controls */}
                  <div className="flex flex-col sm:flex-row gap-4 justify-between">
                    <div className="flex items-center gap-2">
                      <Input 
                        placeholder="Search events..." 
                        className="w-full sm:w-[250px]"
                        value={eventSearchQuery}
                        onChange={(e) => setEventSearchQuery(e.target.value)}
                      />
                      <Button variant="outline" size="icon" onClick={() => refetchEvents()}>
                        <Search className="h-4 w-4" />
                      </Button>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <Select 
                        defaultValue="all" 
                        value={eventStatusFilter}
                        onValueChange={setEventStatusFilter}
                      >
                        <SelectTrigger className="w-[150px]">
                          <SelectValue placeholder="Filter by status" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All Events</SelectItem>
                          <SelectItem value="upcoming">Upcoming</SelectItem>
                          <SelectItem value="past">Past Events</SelectItem>
                          <SelectItem value="unpublished">Unpublished</SelectItem>
                        </SelectContent>
                      </Select>
                      
                      <Button variant="outline" size="icon" title="Refresh" onClick={() => refetchEvents()}>
                        <RefreshCw className="h-4 w-4" />
                      </Button>
                      
                      <Button variant="default">
                        <Calendar className="h-4 w-4 mr-2" />
                        New Event
                      </Button>
                    </div>
                  </div>
                  
                  {/* Events table */}
                  <div className="rounded-md border">
                    <div className="relative w-full overflow-auto">
                      {isLoadingEvents ? (
                        <div className="flex justify-center py-12">
                          <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
                        </div>
                      ) : (
                        <table className="w-full caption-bottom text-sm">
                          <thead className="[&_tr]:border-b">
                            <tr className="border-b transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted">
                              <th className="h-12 px-4 text-left align-middle font-medium">Event</th>
                              <th className="h-12 px-4 text-left align-middle font-medium">Date</th>
                              <th className="h-12 px-4 text-left align-middle font-medium">Location</th>
                              <th className="h-12 px-4 text-left align-middle font-medium">Status</th>
                              <th className="h-12 px-4 text-left align-middle font-medium">Organizer</th>
                              <th className="h-12 px-4 text-left align-middle font-medium">Actions</th>
                            </tr>
                          </thead>
                          <tbody className="[&_tr:last-child]:border-0">
                            {allEvents && allEvents.length > 0 ? (
                              allEvents.map((event) => {
                                const eventStartDate = new Date(event.startDate);
                                const eventEndDate = new Date(event.endDate);
                                const isUpcoming = eventStartDate > new Date();
                                const isPast = eventEndDate < new Date();
                                
                                // Calculate duration in days
                                const durationDays = Math.ceil((eventEndDate.getTime() - eventStartDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;
                                
                                return (
                                  <tr key={event.id} className="border-b transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted">
                                    <td className="p-4 align-middle">
                                      <div className="flex items-center gap-3">
                                        <div className="h-10 w-10 rounded bg-primary/10 flex items-center justify-center">
                                          {event.imageUrl ? (
                                            <img 
                                              src={event.imageUrl} 
                                              alt={event.title}
                                              className="h-10 w-10 object-cover rounded"
                                            />
                                          ) : (
                                            <Calendar className="h-5 w-5 text-primary" />
                                          )}
                                        </div>
                                        <div>
                                          <div className="font-medium">{event.title}</div>
                                          <div className="text-xs text-muted-foreground">{event.eventType}</div>
                                        </div>
                                      </div>
                                    </td>
                                    <td className="p-4 align-middle">
                                      <div>{eventStartDate.toLocaleDateString()}</div>
                                      <div className="text-xs text-muted-foreground">
                                        {durationDays > 1 
                                          ? `${durationDays}-day event` 
                                          : "1-day event"
                                        }
                                      </div>
                                    </td>
                                    <td className="p-4 align-middle">
                                      <div>{event.location.split(',')[0]}</div>
                                      <div className="text-xs text-muted-foreground">
                                        {event.location.includes(',') 
                                          ? event.location.split(',').slice(1).join(',').trim() 
                                          : ''
                                        }
                                      </div>
                                    </td>
                                    <td className="p-4 align-middle">
                                      <Badge 
                                        variant={
                                          !event.isActive 
                                            ? "secondary" 
                                            : isUpcoming 
                                              ? "success" 
                                              : isPast 
                                                ? "warning"
                                                : "success"
                                        }
                                      >
                                        {!event.isActive 
                                          ? "Draft" 
                                          : isUpcoming 
                                            ? "Upcoming" 
                                            : isPast 
                                              ? "Past"
                                              : "Active"
                                        }
                                      </Badge>
                                    </td>
                                    <td className="p-4 align-middle">
                                      <div>Organizer ID: {event.ownerId}</div>
                                      <div className="text-xs text-muted-foreground">
                                        {/* We don't have owner name in the event data */}
                                        {event.ownerId === 2 ? "Jesse Ferrell" : "Event Owner"}
                                      </div>
                                    </td>
                                    <td className="p-4 align-middle">
                                      <div className="flex items-center gap-1">
                                        <Button 
                                          variant="ghost" 
                                          size="icon" 
                                          title="View event"
                                          onClick={() => handleViewEvent(event.id)}
                                        >
                                          <Eye className="h-4 w-4" />
                                        </Button>
                                        <Button 
                                          variant="ghost" 
                                          size="icon" 
                                          title="Edit"
                                          onClick={() => handleEditEvent(event.id)}
                                        >
                                          <Edit className="h-4 w-4" />
                                        </Button>
                                        <Button 
                                          variant="ghost" 
                                          size="icon" 
                                          title="Manage tickets"
                                          onClick={() => handleManageTickets(event.id)}
                                        >
                                          <Ticket className="h-4 w-4" />
                                        </Button>
                                        <Button 
                                          variant="ghost" 
                                          size="icon" 
                                          title="Toggle status"
                                          onClick={() => handleToggleEventStatus(event)}
                                        >
                                          {event.isActive ? (
                                            <AlertTriangle className="h-4 w-4 text-amber-500" />
                                          ) : (
                                            <Calendar className="h-4 w-4 text-emerald-500" />
                                          )}
                                        </Button>
                                        <Button 
                                          variant="ghost" 
                                          size="icon" 
                                          title="Delete"
                                          onClick={() => handleDeleteEvent(event)}
                                        >
                                          <Trash className="h-4 w-4 text-destructive" />
                                        </Button>
                                      </div>
                                    </td>
                                  </tr>
                                );
                              })
                            ) : (
                              <tr>
                                <td colSpan={6} className="p-8 text-center text-muted-foreground">
                                  <div className="flex flex-col items-center justify-center">
                                    <AlertTriangle className="h-8 w-8 mb-2 text-muted-foreground" />
                                    <p>No events found</p>
                                    <p className="text-sm mt-1">Try a different search or create a new event</p>
                                  </div>
                                </td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      )}
                    </div>
                  </div>
                  
                  {/* Pagination */}
                  {allEvents && allEvents.length > 0 && (
                    <div className="flex items-center justify-between">
                      <div className="text-sm text-muted-foreground">
                        Showing <strong>1-{allEvents.length}</strong> of <strong>{allEvents.length}</strong> events
                      </div>
                      <div className="flex items-center gap-2">
                        <Button variant="outline" size="sm" disabled>
                          Previous
                        </Button>
                        <Button variant="outline" size="sm" disabled>
                          Next
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
          
          {/* Analytics tab content */}
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
          

        </Tabs>
      </main>
      
      <Footer />
      
      {/* Delete Event Confirmation Dialog */}
      <Dialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Delete Event</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this event? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          
          {selectedEvent && (
            <div className="border rounded-md p-4 my-4">
              <h3 className="font-medium text-lg">{selectedEvent.title}</h3>
              <p className="text-sm text-muted-foreground mt-1">{selectedEvent.description}</p>
              <div className="flex items-center gap-2 mt-2 text-sm">
                <Calendar className="h-4 w-4" />
                <span>{new Date(selectedEvent.startDate).toLocaleDateString()}</span>
                <span>-</span>
                <span>{new Date(selectedEvent.endDate).toLocaleDateString()}</span>
              </div>
              <div className="flex items-center gap-2 mt-1 text-sm">
                <Store className="h-4 w-4" />
                <span>{selectedEvent.location}</span>
              </div>
            </div>
          )}
          
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => setShowDeleteConfirm(false)}
            >
              Cancel
            </Button>
            <Button 
              variant="destructive" 
              onClick={confirmDeleteEvent}
              disabled={deleteEventMutation.isPending}
            >
              {deleteEventMutation.isPending ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Deleting...
                </>
              ) : (
                <>
                  <Trash className="h-4 w-4 mr-2" />
                  Delete Event
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
