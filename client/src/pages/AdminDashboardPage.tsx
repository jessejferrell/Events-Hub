import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import StatCard from "@/components/admin/StatCard";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  User as UserIcon, 
  Calendar, 
  DollarSign, 
  Ticket, 
  BarChart2 as BarChart2Icon, 
  PieChart as PieChartIcon, 
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
  Plus,
  CalendarCheck,
  CheckCircle,
  XCircle,
  Copy
} from "lucide-react";
import {
  BarChart,
  Bar,
  LineChart, 
  Line,
  PieChart, 
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ComposedChart
} from "recharts";
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
import { Textarea } from "@/components/ui/textarea";
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
  const { toast } = useToast();
  // Fetch current user for role-based permissions
  const { data: currentUser } = useQuery<UserType>({
    queryKey: ["/api/user"],
    queryFn: async () => {
      const res = await fetch("/api/user");
      if (!res.ok) throw new Error("Failed to fetch current user");
      const userData = await res.json();
      
      // Set the current user role
      if (userData && userData.role) {
        setCurrentUserRole(userData.role);
      }
      
      return userData;
    }
  });
  const [activeTab, setActiveTab] = useState("overview");
  
  // Ref for tabs component
  const tabsRef = useRef<HTMLDivElement>(null);
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
  const [userNotes, setUserNotes] = useState<Array<{ id: number, note: string, adminId: number, createdAt: string }>>([]);
  const [showEditUserForm, setShowEditUserForm] = useState(false);
  const [editUserData, setEditUserData] = useState<{
    name: string | null;
    email: string;
    username: string;
    role: string;
    phoneNumber: string | null;
    address: string | null;
  } | null>(null);
  const [currentUserRole, setCurrentUserRole] = useState<string>('');
  
  // Transaction editing state
  const [showTransactionEditor, setShowTransactionEditor] = useState(false);
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null);
  const [transactionStatusOptions, setTransactionStatusOptions] = useState<string[]>([
    'pending', 'completed', 'cancelled', 'refunded', 'failed', 'processing'
  ]);
  const [confirmDeleteTransaction, setConfirmDeleteTransaction] = useState(false);
  
  // Analytics state
  const [analyticsTimeframe, setAnalyticsTimeframe] = useState<string>("month");
  const [analyticsData, setAnalyticsData] = useState<{
    revenue: number;
    revenueChange: number;
    ticketsSold: number;
    ticketsChange: number;
    newUsers: number;
    usersChange: number;
    activeEvents: number;
    eventsChange: number;
    recentActivity: Array<{
      type: string;
      description: string;
      time: string;
    }>;
    conversionRate: {
      ticket: number;
      vendor: number;
      volunteer: number;
      merchandise: number;
    };
    userEngagement: {
      eventParticipation: number;
      multiTicket: number;
      returnRate: number;
      volunteerRate: number;
    };
  }>({
    revenue: 0,
    revenueChange: 0,
    ticketsSold: 0,
    ticketsChange: 0,
    newUsers: 0,
    usersChange: 0,
    activeEvents: 0,
    eventsChange: 0,
    recentActivity: [],
    conversionRate: {
      ticket: 0,
      vendor: 0,
      volunteer: 0,
      merchandise: 0
    },
    userEngagement: {
      eventParticipation: 0,
      multiTicket: 0,
      returnRate: 0,
      volunteerRate: 0
    }
  });
  
  // Chart data
  const [revenueData, setRevenueData] = useState<Array<{date: string; revenue: number}>>([]);
  const [revenueByEventType, setRevenueByEventType] = useState<Array<{name: string; value: number}>>([]);
  const [revenueByProductType, setRevenueByProductType] = useState<Array<{name: string; value: number}>>([]);
  const [topEvents, setTopEvents] = useState<Array<{name: string; date: string; revenue: number}>>([]);
  const [revenueAnalysis, setRevenueAnalysis] = useState<Array<{name: string; tickets: number; merchandise: number; vendors: number; other: number}>>([]);
  const [userGrowthData, setUserGrowthData] = useState<Array<{date: string; users: number}>>([]);
  const [userTypeData, setUserTypeData] = useState<Array<{name: string; value: number}>>([]);
  const [topUserSegments, setTopUserSegments] = useState<Array<{name: string; description: string; count: number}>>([]);
  const [eventGrowthData, setEventGrowthData] = useState<Array<{date: string; events: number}>>([]);
  const [eventTypeData, setEventTypeData] = useState<Array<{name: string; value: number}>>([]);
  const [eventPerformanceData, setEventPerformanceData] = useState<Array<{name: string; attendance: number; revenue: number}>>([]);
  const [eventLocationData, setEventLocationData] = useState<Array<{name: string; eventCount: number; growth: number}>>([]);
  
  // Chart colors
  const pieColors = ['#6366f1', '#ec4899', '#14b8a6', '#f59e0b', '#8b5cf6', '#22c55e'];

  // Function to handle stat card navigation
  const handleTabChange = (tabName: string, transactionType?: string) => {
    setActiveTab(tabName);
    
    if (transactionType) {
      setSelectedTransactionType(transactionType);
    }
  };

  // Fetch admin stats
  const { data: stats, isLoading } = useQuery<AdminStats>({
    queryKey: ["/api/admin/stats"],
    queryFn: async () => {
      const res = await fetch("/api/admin/stats");
      if (!res.ok) throw new Error("Failed to fetch admin stats");
      return await res.json();
    },
  });
  
  // Fetch analytics data based on timeframe
  const { data: analytics, isLoading: isLoadingAnalytics, refetch: refetchAnalytics } = useQuery({
    queryKey: ["/api/admin/analytics", analyticsTimeframe],
    queryFn: async () => {
      let queryParams = new URLSearchParams();
      if (analyticsTimeframe) queryParams.append("timeframe", analyticsTimeframe);
      
      const res = await fetch(`/api/admin/analytics?${queryParams.toString()}`);
      if (!res.ok) throw new Error("Failed to fetch analytics data");
      return await res.json();
    },
    enabled: activeTab === "analytics"
  });
  
  // Update analytics data and chart data when analytics response changes
  useEffect(() => {
    if (analytics) {
      // Update the analytics data state
      setAnalyticsData({
        revenue: analytics.revenue || 0,
        revenueChange: analytics.revenueChange || 0,
        ticketsSold: analytics.ticketsSold || 0,
        ticketsChange: analytics.ticketsChange || 0,
        newUsers: analytics.newUsers || 0,
        usersChange: analytics.usersChange || 0,
        activeEvents: analytics.activeEvents || 0,
        eventsChange: analytics.eventsChange || 0,
        recentActivity: analytics.recentActivity || [],
        conversionRate: analytics.conversionRate || {
          ticket: 0,
          vendor: 0,
          volunteer: 0,
          merchandise: 0
        },
        userEngagement: analytics.userEngagement || {
          eventParticipation: 0,
          multiTicket: 0,
          returnRate: 0,
          volunteerRate: 0
        }
      });
      
      // Update chart data
      if (analytics.revenueData) {
        setRevenueData(analytics.revenueData);
      }
      
      if (analytics.revenueByEventType) {
        setRevenueByEventType(analytics.revenueByEventType);
      }
      
      if (analytics.revenueByProductType) {
        setRevenueByProductType(analytics.revenueByProductType);
      }
      
      if (analytics.topEvents) {
        setTopEvents(analytics.topEvents);
      }
      
      if (analytics.revenueAnalysis) {
        setRevenueAnalysis(analytics.revenueAnalysis);
      }
      
      if (analytics.userGrowthData) {
        setUserGrowthData(analytics.userGrowthData);
      }
      
      if (analytics.userTypeData) {
        setUserTypeData(analytics.userTypeData);
      }
      
      if (analytics.topUserSegments) {
        setTopUserSegments(analytics.topUserSegments);
      }
      
      if (analytics.eventGrowthData) {
        setEventGrowthData(analytics.eventGrowthData);
      }
      
      if (analytics.eventTypeData) {
        setEventTypeData(analytics.eventTypeData);
      }
      
      if (analytics.eventPerformanceData) {
        setEventPerformanceData(analytics.eventPerformanceData);
      }
      
      if (analytics.eventLocationData) {
        setEventLocationData(analytics.eventLocationData);
      }
    }
  }, [analytics]);
  
  // Handle timeframe change
  useEffect(() => {
    if (activeTab === "analytics") {
      refetchAnalytics();
    }
  }, [analyticsTimeframe, activeTab, refetchAnalytics]);

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
      if (eventStatusFilter !== "all") queryParams.append("status", eventStatusFilter);
      
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
      console.log(`Deleting event with ID: ${eventId}`);
      
      const res = await fetch(`/api/events/${eventId}`, {
        method: 'DELETE',
      });
      
      if (!res.ok) {
        const errorText = await res.text();
        console.error(`Delete event error: ${errorText}`);
        throw new Error(`Failed to delete event: ${errorText}`);
      }
      
      return true;
    },
    onSuccess: () => {
      toast({
        title: "Event deleted",
        description: `The event has been successfully deleted.`
      });
      refetchEvents();
      setShowDeleteConfirm(false);
      setSelectedEvent(null);
    },
    onError: (error) => {
      toast({
        title: "Delete failed",
        description: error instanceof Error ? error.message : "An error occurred while deleting the event",
        variant: "destructive"
      });
      console.error("Delete event error:", error);
    }
  });
  
  // Toggle event status mutation
  const toggleEventStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: number; status?: string }) => {
      const res = await fetch(`/api/events/${id}/toggle-status`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ status }),
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
  
  // Event duplication state
  const [showDuplicateDialog, setShowDuplicateDialog] = useState(false);
  const [duplicateTitle, setDuplicateTitle] = useState("");
  
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
      id: event.id
      // No status needed - the API will handle cycling through statuses
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
  
  // Handle duplicate event
  const handleDuplicateEvent = (event: Event) => {
    setSelectedEvent(event);
    setDuplicateTitle(`${event.title} (Copy)`);
    setShowDuplicateDialog(true);
  };
  
  // Duplicate event mutation
  const duplicateEventMutation = useMutation({
    mutationFn: async (data: { eventId: number, title?: string }) => {
      const res = await fetch(`/api/events/${data.eventId}/duplicate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          title: data.title
        }),
      });
      
      if (!res.ok) {
        throw new Error('Failed to duplicate event');
      }
      
      return await res.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Event Duplicated",
        description: `"${data.title}" has been created as a draft`,
      });
      setShowDuplicateDialog(false);
      // Invalidate both events and my-events queries to ensure they both update
      queryClient.invalidateQueries({ queryKey: ["/api/events"] });
      queryClient.invalidateQueries({ queryKey: ["/api/my-events"] });
      refetchEvents();
    },
    onError: (error) => {
      toast({
        title: "Duplication Failed",
        description: error instanceof Error ? error.message : "An error occurred",
        variant: "destructive",
      });
    }
  });

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

  // User edit handlers
  const handleEditUser = (user: UserType) => {
    // Can only edit if:
    // 1. Current user is SUPER ADMIN (jessejferrell@gmail.com), or
    // 2. Current user is admin AND target user is not an admin
    const canEdit = 
      (currentUser?.email === 'jessejferrell@gmail.com') || 
      (currentUserRole === 'admin' && user.role !== 'admin');
    
    if (!canEdit) {
      return; // Don't allow editing
    }
    
    setSelectedUser(user);
    setEditUserData({
      name: user.name,
      email: user.email,
      username: user.username,
      role: user.role,
      phoneNumber: user.phoneNumber,
      address: user.address,
    });
    setShowEditUserForm(true);
  };
  
  // Update user mutation
  const updateUserMutation = useMutation({
    mutationFn: async (userData: typeof editUserData) => {
      if (!selectedUser || !userData) throw new Error('No user selected');
      
      const res = await fetch(`/api/admin/users/${selectedUser.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(userData),
      });
      
      if (!res.ok) throw new Error('Failed to update user');
      return await res.json();
    },
    onSuccess: () => {
      setShowEditUserForm(false);
      refetchUsers();
      if (selectedUser) {
        fetchUserDetails(selectedUser.id);
      }
      toast({
        title: "Success",
        description: "User information updated successfully",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update user",
        variant: "destructive"
      });
    }
  });
  
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
  
  // Refresh analytics data
  const fetchAnalyticsData = () => {
    refetchAnalytics();
    toast({
      title: "Refreshing data",
      description: "Analytics data is being refreshed",
    });
  };
  
  // Export analytics data
  const exportAnalyticsData = () => {
    let queryParams = new URLSearchParams();
    if (analyticsTimeframe) queryParams.append("timeframe", analyticsTimeframe);
    
    window.open(`/api/admin/analytics/export?${queryParams.toString()}`, '_blank');
    
    toast({
      title: "Export initiated",
      description: "Analytics data export has started",
    });
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
      
      console.log(`Deleting transaction: ${endpoint}`);
      
      const res = await fetch(endpoint, {
        method: 'DELETE',
      });
      
      if (!res.ok) {
        const errorText = await res.text();
        console.error(`Delete error: ${errorText}`);
        throw new Error(`Failed to delete ${selectedTransaction.type}: ${errorText}`);
      }
      
      return true;
    },
    onSuccess: () => {
      toast({
        title: "Transaction deleted",
        description: `The ${selectedTransaction?.type} has been deleted successfully.`,
        variant: "default",
      });
      setConfirmDeleteTransaction(false);
      setSelectedTransaction(null);
      refetchTransactions();
    },
    onError: (error) => {
      toast({
        title: "Delete failed",
        description: error.message,
        variant: "destructive",
      });
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
  
  // Handler for exporting financial reports
  const handleFinancialExport = async (reportType: 'detailed' | 'summary') => {
    let queryParams = new URLSearchParams();
    
    if (selectedEventId && selectedEventId !== "all_events") queryParams.append("eventId", selectedEventId);
    
    if (startDate) queryParams.append("startDate", startDate.toISOString());
    if (endDate) queryParams.append("endDate", endDate.toISOString());
    
    // Add report type parameter
    queryParams.append("reportType", reportType);
    
    window.open(`/api/admin/financial-report?${queryParams.toString()}`, "_blank");
    
    toast({
      title: "Financial report export started",
      description: `Your ${reportType} financial report is being generated.`,
    });
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
            onClick={() => handleTabChange("users")}
          />
          
          <StatCard 
            title="Active Events" 
            value={isLoading ? "-" : stats?.activeEvents.toString() || "0"} 
            icon={<Calendar />} 
            linkText="View all events" 
            linkHref="#events" 
            iconBgClass="bg-green-100"
            isLoading={isLoading}
            onClick={() => handleTabChange("events")}
          />
          
          <StatCard 
            title="Monthly Revenue" 
            value={isLoading ? "-" : `$${stats?.monthlyRevenue !== undefined ? stats.monthlyRevenue.toFixed(2) : "0.00"}`} 
            icon={<DollarSign />} 
            linkText="View financial reports" 
            linkHref="#analytics" 
            iconBgClass="bg-blue-100"
            isLoading={isLoading}
            onClick={() => handleTabChange("analytics")}
          />
          
          <StatCard 
            title="Tickets Sold (MTD)" 
            value={isLoading ? "-" : stats?.ticketsSoldMTD.toString() || "0"} 
            icon={<Ticket />} 
            linkText="View ticket reports" 
            linkHref="#analytics" 
            iconBgClass="bg-purple-100"
            isLoading={isLoading}
            onClick={() => handleTabChange("analytics")}
          />
        </div>
        
        {/* Admin Tabs */}
        <Tabs ref={tabsRef} defaultValue={activeTab} onValueChange={setActiveTab} className="mb-8">
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
                  <Button variant="link" size="sm" className="text-secondary p-0" onClick={() => handleTabChange("events")}>
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
                    onClick={() => handleTabChange("transactions", "order")}
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
                            <td className="py-2 px-2 text-sm">${order.totalAmount !== undefined ? order.totalAmount.toFixed(2) : '0.00'}</td>
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
                      <BarChart2Icon className="h-12 w-12 mx-auto mb-2" />
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
                      <PieChartIcon className="h-12 w-12 mx-auto mb-2" />
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
                            <td className="py-4 px-4 font-medium">${transaction.amount !== undefined ? transaction.amount.toFixed(2) : '0.00'}</td>
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
              <CardFooter className="flex flex-col sm:flex-row justify-between gap-4">
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
                <div className="flex flex-wrap gap-2">
                  <Button variant="outline" onClick={() => refetchTransactions()}>
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Refresh
                  </Button>
                  
                  <Dialog>
                    <DialogTrigger asChild>
                      <Button variant="outline">
                        <FileText className="h-4 w-4 mr-2" />
                        Financial Reports
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-md">
                      <DialogHeader>
                        <DialogTitle>Export Financial Reports</DialogTitle>
                        <DialogDescription>
                          Choose a report format for exporting financial data.
                        </DialogDescription>
                      </DialogHeader>
                      <div className="grid gap-4 py-4">
                        <Button onClick={() => handleFinancialExport('detailed')}>
                          <Download className="h-4 w-4 mr-2" />
                          Detailed Financial Report
                        </Button>
                        <Button onClick={() => handleFinancialExport('summary')}>
                          <BarChart2Icon className="h-4 w-4 mr-2" />
                          Summary Financial Report
                        </Button>
                      </div>
                    </DialogContent>
                  </Dialog>
                  
                  <Button onClick={handleExport}>
                    <Download className="h-4 w-4 mr-2" />
                    Export All Transactions
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
                        <SelectItem value="super_admin">Super Administrators</SelectItem>
                        <SelectItem value="admin">Administrators</SelectItem>
                        <SelectItem value="event_owner">Event Organizers</SelectItem>
                        <SelectItem value="vendor">Vendors</SelectItem>
                        <SelectItem value="volunteer">Volunteers</SelectItem>
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
                            Login Status
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
                                variant={user.role === 'super_admin' ? 'destructive' :
                                         user.role === 'admin' ? 'default' : 
                                         user.role === 'event_owner' ? 'secondary' : 
                                         'outline'}
                              >
                                {user.role}
                              </Badge>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <Badge variant={user.lastLogin ? 'success' : 'outline'}>
                                {user.lastLogin ? 'Logged in recently' : 'Never logged in'}
                              </Badge>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-neutral-500">
                              {new Date(user.createdAt).toLocaleDateString()}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                              <div className="flex justify-end space-x-2">
                                <Button 
                                  variant="ghost" 
                                  size="sm" 
                                  onClick={() => handleViewUser(user)}
                                  className="text-primary hover:text-primary-dark"
                                >
                                  <Eye className="h-4 w-4 mr-1" />
                                  View
                                </Button>
                                
                                {/* Edit button - only visible if current user has permission */}
                                {((currentUserRole === 'super_admin') || 
                                  (currentUserRole === 'admin' && user.role !== 'admin' && user.role !== 'super_admin')) && (
                                  <Button 
                                    variant="ghost" 
                                    size="sm" 
                                    onClick={() => handleEditUser(user)}
                                    className="text-amber-600 hover:text-amber-700"
                                  >
                                    <Edit className="h-4 w-4 mr-1" />
                                    Edit
                                  </Button>
                                )}
                              </div>
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
            
            {/* Edit User Dialog */}
            <Dialog open={showEditUserForm} onOpenChange={setShowEditUserForm}>
              <DialogContent className="max-w-lg">
                <DialogHeader>
                  <DialogTitle>Edit User</DialogTitle>
                  <DialogDescription>
                    Update user information. User roles can be changed in the User Details page.
                  </DialogDescription>
                </DialogHeader>
                
                {editUserData && (
                  <div className="space-y-4 py-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="edit-username">Username</Label>
                        <Input 
                          id="edit-username"
                          value={editUserData.username}
                          onChange={(e) => setEditUserData({...editUserData, username: e.target.value})}
                        />
                      </div>
                      
                      <div className="space-y-2">
                        <Label htmlFor="edit-email">Email</Label>
                        <Input 
                          id="edit-email"
                          type="email"
                          value={editUserData.email}
                          onChange={(e) => setEditUserData({...editUserData, email: e.target.value})}
                        />
                      </div>
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="edit-name">Full Name</Label>
                      <Input 
                        id="edit-name"
                        value={editUserData.name || ''}
                        onChange={(e) => setEditUserData({...editUserData, name: e.target.value || null})}
                      />
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="edit-phone">Phone Number</Label>
                      <Input 
                        id="edit-phone"
                        value={editUserData.phoneNumber || ''}
                        onChange={(e) => setEditUserData({...editUserData, phoneNumber: e.target.value || null})}
                      />
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="edit-address">Address</Label>
                      <Input 
                        id="edit-address"
                        value={editUserData.address || ''}
                        onChange={(e) => setEditUserData({...editUserData, address: e.target.value || null})}
                      />
                    </div>
                  </div>
                )}
                
                <DialogFooter>
                  <Button variant="outline" onClick={() => setShowEditUserForm(false)}>Cancel</Button>
                  <Button 
                    onClick={() => updateUserMutation.mutate(editUserData)}
                    disabled={updateUserMutation.isPending}
                  >
                    {updateUserMutation.isPending ? (
                      <>
                        <span className="animate-spin mr-2">◌</span>
                        Saving...
                      </>
                    ) : 'Save Changes'}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
            
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
                          <Badge 
                            variant={selectedUser.role === 'super_admin' ? 'destructive' :
                                     selectedUser.role === 'admin' ? 'default' : 
                                     selectedUser.role === 'event_owner' ? 'secondary' : 
                                     'outline'} 
                            className="mb-4"
                          >
                            {selectedUser.role}
                          </Badge>
                          
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
                            {/* Only show role selector if user has permission */}
                            {((currentUserRole === 'super_admin') || 
                              (currentUserRole === 'admin' && 
                               selectedUser.role !== 'admin' && 
                               selectedUser.role !== 'super_admin')) ? (
                              <Select 
                                value={selectedUser.role} 
                                onValueChange={(value) => handleUpdateUserRole(selectedUser.id, value)}
                              >
                                <SelectTrigger>
                                  <SelectValue placeholder="Select Role" />
                                </SelectTrigger>
                                <SelectContent>
                                  {/* Only super_admin can create another super_admin */}
                                  {currentUserRole === 'super_admin' && (
                                    <SelectItem value="super_admin">Super Administrator</SelectItem>
                                  )}
                                  <SelectItem value="admin">Administrator</SelectItem>
                                  <SelectItem value="event_owner">Event Organizer</SelectItem>
                                  <SelectItem value="vendor">Vendor</SelectItem>
                                  <SelectItem value="volunteer">Volunteer</SelectItem>
                                  <SelectItem value="user">Regular User</SelectItem>
                                </SelectContent>
                              </Select>
                            ) : (
                              <div className="text-neutral-500 text-sm italic">
                                You don't have permission to modify this user's role.
                              </div>
                            )}
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
                            {userNotes && userNotes.length > 0 ? (
                              userNotes.map((note: { id: number, note: string, adminId: number, createdAt: string }, index: number) => (
                                <div key={note.id || index} className="text-sm border-b pb-2">
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
                          <SelectItem value="draft">Draft</SelectItem>
                          <SelectItem value="upcoming">Upcoming</SelectItem>
                          <SelectItem value="active">Active</SelectItem>
                          <SelectItem value="completed">Completed</SelectItem>
                          <SelectItem value="cancelled">Cancelled</SelectItem>
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
                                          event.status === "draft" 
                                            ? "secondary" 
                                            : event.status === "upcoming" 
                                              ? "success" 
                                              : event.status === "completed" 
                                                ? "warning"
                                                : event.status === "cancelled"
                                                  ? "destructive"
                                                  : "success"
                                        }
                                      >
                                        {event.status 
                                          ? event.status.charAt(0).toUpperCase() + event.status.slice(1)
                                          : !event.isActive 
                                            ? "Draft" 
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
                                          title="Duplicate Event"
                                          onClick={() => handleDuplicateEvent(event)}
                                        >
                                          <Copy className="h-4 w-4" />
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
                                          {event.status === "draft" ? (
                                            <Calendar className="h-4 w-4 text-emerald-500" />
                                          ) : event.status === "upcoming" ? (
                                            <CalendarCheck className="h-4 w-4 text-blue-500" />
                                          ) : event.status === "active" ? (
                                            <CheckCircle className="h-4 w-4 text-green-500" />
                                          ) : event.status === "completed" ? (
                                            <Clock className="h-4 w-4 text-amber-500" />
                                          ) : event.status === "cancelled" ? (
                                            <XCircle className="h-4 w-4 text-red-500" />
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
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <div>
                  <CardTitle>Analytics & Reports</CardTitle>
                  <CardDescription>View detailed analytics and generate reports</CardDescription>
                </div>
                <Select 
                  value="monthly" 
                  onValueChange={(value) => setAnalyticsTimeframe(value)}
                >
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="Select timeframe" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="today">Today</SelectItem>
                    <SelectItem value="week">This Week</SelectItem>
                    <SelectItem value="month">This Month</SelectItem>
                    <SelectItem value="year">This Year</SelectItem>
                    <SelectItem value="all">All Time</SelectItem>
                  </SelectContent>
                </Select>
              </CardHeader>
              <CardContent>
                {/* Analytics Tabs */}
                <Tabs defaultValue="overview" className="space-y-4">
                  <TabsList className="grid w-full grid-cols-4">
                    <TabsTrigger value="overview">Overview</TabsTrigger>
                    <TabsTrigger value="revenue">Revenue</TabsTrigger>
                    <TabsTrigger value="users">Users</TabsTrigger>
                    <TabsTrigger value="events">Events</TabsTrigger>
                  </TabsList>
                  
                  {/* Overview Tab */}
                  <TabsContent value="overview" className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                      <div className="bg-white shadow rounded-lg p-4">
                        <div className="flex items-center">
                          <div className="p-3 rounded-full bg-blue-500 bg-opacity-10">
                            <DollarSign className="h-8 w-8 text-blue-500" />
                          </div>
                          <div className="ml-4">
                            <p className="text-gray-500 text-sm">Revenue</p>
                            <p className="text-2xl font-semibold">${(analyticsData?.revenue !== undefined ? analyticsData.revenue.toFixed(2) : '0.00')}</p>
                            <p className={`text-xs flex items-center ${analyticsData?.revenueChange >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                              {analyticsData?.revenueChange >= 0 ? (
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 mr-1" viewBox="0 0 20 20" fill="currentColor">
                                  <path fillRule="evenodd" d="M12 7a1 1 0 01-1 1H9v3a1 1 0 01-2 0V8H4a1 1 0 010-2h3V3a1 1 0 112 0v3h3a1 1 0 011 1z" clipRule="evenodd" />
                                </svg>
                              ) : (
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 mr-1" viewBox="0 0 20 20" fill="currentColor">
                                  <path fillRule="evenodd" d="M3 10a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" clipRule="evenodd" />
                                </svg>
                              )}
                              {Math.abs(analyticsData?.revenueChange || 0)}% vs previous period
                            </p>
                          </div>
                        </div>
                      </div>
                      
                      <div className="bg-white shadow rounded-lg p-4">
                        <div className="flex items-center">
                          <div className="p-3 rounded-full bg-green-500 bg-opacity-10">
                            <Ticket className="h-8 w-8 text-green-500" />
                          </div>
                          <div className="ml-4">
                            <p className="text-gray-500 text-sm">Tickets Sold</p>
                            <p className="text-2xl font-semibold">{analyticsData?.ticketsSold || 0}</p>
                            <p className={`text-xs flex items-center ${analyticsData?.ticketsChange >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                              {analyticsData?.ticketsChange >= 0 ? (
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 mr-1" viewBox="0 0 20 20" fill="currentColor">
                                  <path fillRule="evenodd" d="M12 7a1 1 0 01-1 1H9v3a1 1 0 01-2 0V8H4a1 1 0 010-2h3V3a1 1 0 112 0v3h3a1 1 0 011 1z" clipRule="evenodd" />
                                </svg>
                              ) : (
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 mr-1" viewBox="0 0 20 20" fill="currentColor">
                                  <path fillRule="evenodd" d="M3 10a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" clipRule="evenodd" />
                                </svg>
                              )}
                              {Math.abs(analyticsData?.ticketsChange || 0)}% vs previous period
                            </p>
                          </div>
                        </div>
                      </div>
                      
                      <div className="bg-white shadow rounded-lg p-4">
                        <div className="flex items-center">
                          <div className="p-3 rounded-full bg-purple-500 bg-opacity-10">
                            <Users className="h-8 w-8 text-purple-500" />
                          </div>
                          <div className="ml-4">
                            <p className="text-gray-500 text-sm">New Users</p>
                            <p className="text-2xl font-semibold">{analyticsData?.newUsers || 0}</p>
                            <p className={`text-xs flex items-center ${analyticsData?.usersChange >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                              {analyticsData?.usersChange >= 0 ? (
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 mr-1" viewBox="0 0 20 20" fill="currentColor">
                                  <path fillRule="evenodd" d="M12 7a1 1 0 01-1 1H9v3a1 1 0 01-2 0V8H4a1 1 0 010-2h3V3a1 1 0 112 0v3h3a1 1 0 011 1z" clipRule="evenodd" />
                                </svg>
                              ) : (
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 mr-1" viewBox="0 0 20 20" fill="currentColor">
                                  <path fillRule="evenodd" d="M3 10a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" clipRule="evenodd" />
                                </svg>
                              )}
                              {Math.abs(analyticsData?.usersChange || 0)}% vs previous period
                            </p>
                          </div>
                        </div>
                      </div>
                      
                      <div className="bg-white shadow rounded-lg p-4">
                        <div className="flex items-center">
                          <div className="p-3 rounded-full bg-amber-500 bg-opacity-10">
                            <Calendar className="h-8 w-8 text-amber-500" />
                          </div>
                          <div className="ml-4">
                            <p className="text-gray-500 text-sm">Active Events</p>
                            <p className="text-2xl font-semibold">{analyticsData?.activeEvents || 0}</p>
                            <p className={`text-xs flex items-center ${analyticsData?.eventsChange >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                              {analyticsData?.eventsChange >= 0 ? (
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 mr-1" viewBox="0 0 20 20" fill="currentColor">
                                  <path fillRule="evenodd" d="M12 7a1 1 0 01-1 1H9v3a1 1 0 01-2 0V8H4a1 1 0 010-2h3V3a1 1 0 112 0v3h3a1 1 0 011 1z" clipRule="evenodd" />
                                </svg>
                              ) : (
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 mr-1" viewBox="0 0 20 20" fill="currentColor">
                                  <path fillRule="evenodd" d="M3 10a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" clipRule="evenodd" />
                                </svg>
                              )}
                              {Math.abs(analyticsData?.eventsChange || 0)}% vs previous period
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                    
                    {/* Revenue Chart */}
                    <div className="bg-white shadow rounded-lg p-4">
                      <h3 className="text-lg font-medium mb-4">Revenue Trends</h3>
                      <div className="h-80">
                        {revenueData.length > 0 ? (
                          <BarChart 
                            data={revenueData}
                            margin={{ top: 20, right: 30, left: 40, bottom: 50 }}
                            className="w-full h-full"
                          >
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="date" />
                            <YAxis />
                            <Tooltip />
                            <Legend />
                            <Bar dataKey="revenue" fill="#6366f1" name="Revenue" />
                          </BarChart>
                        ) : (
                          <div className="h-full flex items-center justify-center">
                            <p className="text-neutral-500">No revenue data available for the selected period</p>
                          </div>
                        )}
                      </div>
                    </div>
                    
                    {/* Activity Feed and Conversion Metrics */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* Recent Activity */}
                      <div className="bg-white shadow rounded-lg p-4">
                        <h3 className="text-lg font-medium mb-4">Recent Activity</h3>
                        <div className="space-y-4">
                          {analyticsData?.recentActivity?.length > 0 ? (
                            analyticsData.recentActivity.map((activity, index) => (
                              <div key={index} className="flex items-start">
                                <div className={`p-2 rounded-full ${
                                  activity.type === 'purchase' ? 'bg-green-100 text-green-600' : 
                                  activity.type === 'user' ? 'bg-blue-100 text-blue-600' : 
                                  activity.type === 'event' ? 'bg-amber-100 text-amber-600' : 
                                  'bg-gray-100 text-gray-600'
                                }`}>
                                  {activity.type === 'purchase' ? <DollarSign className="h-4 w-4" /> : 
                                   activity.type === 'user' ? <UserIcon className="h-4 w-4" /> : 
                                   activity.type === 'event' ? <Calendar className="h-4 w-4" /> : 
                                   <FileText className="h-4 w-4" />}
                                </div>
                                <div className="ml-3">
                                  <p className="text-sm">{activity.description}</p>
                                  <p className="text-xs text-gray-500">{activity.time}</p>
                                </div>
                              </div>
                            ))
                          ) : (
                            <p className="text-neutral-500 text-center py-4">No recent activity</p>
                          )}
                        </div>
                      </div>
                      
                      {/* Conversion Metrics */}
                      <div className="bg-white shadow rounded-lg p-4">
                        <h3 className="text-lg font-medium mb-4">Conversion Metrics</h3>
                        <div className="space-y-4">
                          <div>
                            <div className="flex justify-between mb-1">
                              <span className="text-sm font-medium">Ticket Conversion Rate</span>
                              <span className="text-sm font-medium">{analyticsData?.conversionRate?.ticket || 0}%</span>
                            </div>
                            <div className="w-full bg-gray-200 rounded-full h-2.5">
                              <div className="bg-green-500 h-2.5 rounded-full" style={{ width: `${analyticsData?.conversionRate?.ticket || 0}%` }}></div>
                            </div>
                          </div>
                          
                          <div>
                            <div className="flex justify-between mb-1">
                              <span className="text-sm font-medium">Vendor Registration Rate</span>
                              <span className="text-sm font-medium">{analyticsData?.conversionRate?.vendor || 0}%</span>
                            </div>
                            <div className="w-full bg-gray-200 rounded-full h-2.5">
                              <div className="bg-blue-500 h-2.5 rounded-full" style={{ width: `${analyticsData?.conversionRate?.vendor || 0}%` }}></div>
                            </div>
                          </div>
                          
                          <div>
                            <div className="flex justify-between mb-1">
                              <span className="text-sm font-medium">Volunteer Registration Rate</span>
                              <span className="text-sm font-medium">{analyticsData?.conversionRate?.volunteer || 0}%</span>
                            </div>
                            <div className="w-full bg-gray-200 rounded-full h-2.5">
                              <div className="bg-purple-500 h-2.5 rounded-full" style={{ width: `${analyticsData?.conversionRate?.volunteer || 0}%` }}></div>
                            </div>
                          </div>
                          
                          <div>
                            <div className="flex justify-between mb-1">
                              <span className="text-sm font-medium">Merchandise Sales Rate</span>
                              <span className="text-sm font-medium">{analyticsData?.conversionRate?.merchandise || 0}%</span>
                            </div>
                            <div className="w-full bg-gray-200 rounded-full h-2.5">
                              <div className="bg-amber-500 h-2.5 rounded-full" style={{ width: `${analyticsData?.conversionRate?.merchandise || 0}%` }}></div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </TabsContent>
                  
                  {/* Revenue Tab */}
                  <TabsContent value="revenue" className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="bg-white shadow rounded-lg p-4">
                        <h3 className="text-lg font-medium mb-4">Revenue by Event Type</h3>
                        <div className="h-64">
                          {revenueByEventType.length > 0 ? (
                            <PieChart width={300} height={250}>
                              <Pie
                                data={revenueByEventType}
                                cx="50%"
                                cy="50%"
                                labelLine={false}
                                outerRadius={80}
                                fill="#8884d8"
                                dataKey="value"
                                label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                              >
                                {revenueByEventType.map((entry, index) => (
                                  <Cell key={`cell-${index}`} fill={pieColors[index % pieColors.length]} />
                                ))}
                              </Pie>
                              <Tooltip formatter={(value) => [`$${value}`, 'Revenue']} />
                              <Legend />
                            </PieChart>
                          ) : (
                            <div className="h-full flex items-center justify-center">
                              <p className="text-neutral-500">No data available</p>
                            </div>
                          )}
                        </div>
                      </div>
                      
                      <div className="bg-white shadow rounded-lg p-4">
                        <h3 className="text-lg font-medium mb-4">Revenue by Product Category</h3>
                        <div className="h-64">
                          {revenueByProductType.length > 0 ? (
                            <PieChart width={300} height={250}>
                              <Pie
                                data={revenueByProductType}
                                cx="50%"
                                cy="50%"
                                labelLine={false}
                                outerRadius={80}
                                fill="#8884d8"
                                dataKey="value"
                                label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                              >
                                {revenueByProductType.map((entry, index) => (
                                  <Cell key={`cell-${index}`} fill={pieColors[index % pieColors.length]} />
                                ))}
                              </Pie>
                              <Tooltip formatter={(value) => [`$${value}`, 'Revenue']} />
                              <Legend />
                            </PieChart>
                          ) : (
                            <div className="h-full flex items-center justify-center">
                              <p className="text-neutral-500">No data available</p>
                            </div>
                          )}
                        </div>
                      </div>
                      
                      <div className="bg-white shadow rounded-lg p-4">
                        <h3 className="text-lg font-medium mb-4">Top Performing Events</h3>
                        {topEvents.length > 0 ? (
                          <div className="space-y-4">
                            {topEvents.map((event, index) => (
                              <div key={index} className="flex items-center justify-between">
                                <div className="flex items-center">
                                  <div className="bg-neutral-100 rounded-md h-10 w-10 flex items-center justify-center mr-3">
                                    <span className="text-sm font-bold">{index + 1}</span>
                                  </div>
                                  <div>
                                    <p className="text-sm font-medium">{event.name}</p>
                                    <p className="text-xs text-gray-500">{event.date}</p>
                                  </div>
                                </div>
                                <p className="font-medium">${event.revenue !== undefined ? event.revenue.toFixed(2) : '0.00'}</p>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-neutral-500 text-center py-4">No event data available</p>
                        )}
                      </div>
                    </div>
                    
                    <div className="bg-white shadow rounded-lg p-4">
                      <h3 className="text-lg font-medium mb-4">Revenue Analysis</h3>
                      <div className="h-80">
                        {revenueAnalysis.length > 0 ? (
                          <BarChart 
                            data={revenueAnalysis}
                            margin={{ top: 20, right: 30, left: 40, bottom: 50 }}
                            className="w-full h-full"
                          >
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="name" />
                            <YAxis />
                            <Tooltip />
                            <Legend />
                            <Bar dataKey="tickets" fill="#6366f1" name="Tickets" />
                            <Bar dataKey="merchandise" fill="#ec4899" name="Merchandise" />
                            <Bar dataKey="vendors" fill="#14b8a6" name="Vendors" />
                            <Bar dataKey="other" fill="#f59e0b" name="Other" />
                          </BarChart>
                        ) : (
                          <div className="h-full flex items-center justify-center">
                            <p className="text-neutral-500">No revenue analysis data available</p>
                          </div>
                        )}
                      </div>
                    </div>
                  </TabsContent>
                  
                  {/* Users Tab */}
                  <TabsContent value="users" className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="bg-white shadow rounded-lg p-4">
                        <h3 className="text-lg font-medium mb-4">User Growth</h3>
                        <div className="h-80">
                          {userGrowthData.length > 0 ? (
                            <LineChart
                              data={userGrowthData}
                              margin={{ top: 20, right: 30, left: 40, bottom: 50 }}
                              className="w-full h-full"
                            >
                              <CartesianGrid strokeDasharray="3 3" />
                              <XAxis dataKey="date" />
                              <YAxis />
                              <Tooltip />
                              <Legend />
                              <Line type="monotone" dataKey="users" stroke="#6366f1" activeDot={{ r: 8 }} />
                            </LineChart>
                          ) : (
                            <div className="h-full flex items-center justify-center">
                              <p className="text-neutral-500">No user growth data available</p>
                            </div>
                          )}
                        </div>
                      </div>
                      
                      <div className="bg-white shadow rounded-lg p-4">
                        <h3 className="text-lg font-medium mb-4">User Types</h3>
                        <div className="h-80">
                          {userTypeData.length > 0 ? (
                            <PieChart width={400} height={300}>
                              <Pie
                                data={userTypeData}
                                cx="50%"
                                cy="50%"
                                labelLine={false}
                                outerRadius={80}
                                fill="#8884d8"
                                dataKey="value"
                                label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                              >
                                {userTypeData.map((entry, index) => (
                                  <Cell key={`cell-${index}`} fill={pieColors[index % pieColors.length]} />
                                ))}
                              </Pie>
                              <Tooltip />
                              <Legend />
                            </PieChart>
                          ) : (
                            <div className="h-full flex items-center justify-center">
                              <p className="text-neutral-500">No user type data available</p>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="bg-white shadow rounded-lg p-4">
                        <h3 className="text-lg font-medium mb-4">User Engagement</h3>
                        <div className="space-y-4">
                          <div>
                            <div className="flex justify-between mb-1">
                              <span className="text-sm font-medium">Event Participation Rate</span>
                              <span className="text-sm font-medium">{analyticsData?.userEngagement?.eventParticipation || 0}%</span>
                            </div>
                            <div className="w-full bg-gray-200 rounded-full h-2.5">
                              <div className="bg-blue-500 h-2.5 rounded-full" style={{ width: `${analyticsData?.userEngagement?.eventParticipation || 0}%` }}></div>
                            </div>
                          </div>
                          
                          <div>
                            <div className="flex justify-between mb-1">
                              <span className="text-sm font-medium">Multi-ticket Purchase Rate</span>
                              <span className="text-sm font-medium">{analyticsData?.userEngagement?.multiTicket || 0}%</span>
                            </div>
                            <div className="w-full bg-gray-200 rounded-full h-2.5">
                              <div className="bg-green-500 h-2.5 rounded-full" style={{ width: `${analyticsData?.userEngagement?.multiTicket || 0}%` }}></div>
                            </div>
                          </div>
                          
                          <div>
                            <div className="flex justify-between mb-1">
                              <span className="text-sm font-medium">Return Customer Rate</span>
                              <span className="text-sm font-medium">{analyticsData?.userEngagement?.returnRate || 0}%</span>
                            </div>
                            <div className="w-full bg-gray-200 rounded-full h-2.5">
                              <div className="bg-purple-500 h-2.5 rounded-full" style={{ width: `${analyticsData?.userEngagement?.returnRate || 0}%` }}></div>
                            </div>
                          </div>
                          
                          <div>
                            <div className="flex justify-between mb-1">
                              <span className="text-sm font-medium">Volunteer Rate</span>
                              <span className="text-sm font-medium">{analyticsData?.userEngagement?.volunteerRate || 0}%</span>
                            </div>
                            <div className="w-full bg-gray-200 rounded-full h-2.5">
                              <div className="bg-amber-500 h-2.5 rounded-full" style={{ width: `${analyticsData?.userEngagement?.volunteerRate || 0}%` }}></div>
                            </div>
                          </div>
                        </div>
                      </div>
                      
                      <div className="bg-white shadow rounded-lg p-4">
                        <h3 className="text-lg font-medium mb-4">Top Customer Segments</h3>
                        {topUserSegments.length > 0 ? (
                          <div className="space-y-4">
                            {topUserSegments.map((segment, index) => (
                              <div key={index} className="flex items-center justify-between">
                                <div className="flex items-center">
                                  <div className="bg-neutral-100 rounded-md h-10 w-10 flex items-center justify-center mr-3">
                                    <span className="text-sm font-bold">{index + 1}</span>
                                  </div>
                                  <div>
                                    <p className="text-sm font-medium">{segment.name}</p>
                                    <p className="text-xs text-gray-500">{segment.description}</p>
                                  </div>
                                </div>
                                <p className="font-medium">{segment.count} users</p>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-neutral-500 text-center py-4">No segment data available</p>
                        )}
                      </div>
                    </div>
                  </TabsContent>
                  
                  {/* Events Tab */}
                  <TabsContent value="events" className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="bg-white shadow rounded-lg p-4">
                        <h3 className="text-lg font-medium mb-4">Event Growth</h3>
                        <div className="h-80">
                          {eventGrowthData.length > 0 ? (
                            <LineChart
                              data={eventGrowthData}
                              margin={{ top: 20, right: 30, left: 40, bottom: 50 }}
                              className="w-full h-full"
                            >
                              <CartesianGrid strokeDasharray="3 3" />
                              <XAxis dataKey="date" />
                              <YAxis />
                              <Tooltip />
                              <Legend />
                              <Line type="monotone" dataKey="events" stroke="#6366f1" activeDot={{ r: 8 }} />
                            </LineChart>
                          ) : (
                            <div className="h-full flex items-center justify-center">
                              <p className="text-neutral-500">No event growth data available</p>
                            </div>
                          )}
                        </div>
                      </div>
                      
                      <div className="bg-white shadow rounded-lg p-4">
                        <h3 className="text-lg font-medium mb-4">Event Types</h3>
                        <div className="h-80">
                          {eventTypeData.length > 0 ? (
                            <PieChart width={400} height={300}>
                              <Pie
                                data={eventTypeData}
                                cx="50%"
                                cy="50%"
                                labelLine={false}
                                outerRadius={80}
                                fill="#8884d8"
                                dataKey="value"
                                label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                              >
                                {eventTypeData.map((entry, index) => (
                                  <Cell key={`cell-${index}`} fill={pieColors[index % pieColors.length]} />
                                ))}
                              </Pie>
                              <Tooltip />
                              <Legend />
                            </PieChart>
                          ) : (
                            <div className="h-full flex items-center justify-center">
                              <p className="text-neutral-500">No event type data available</p>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="bg-white shadow rounded-lg p-4">
                        <h3 className="text-lg font-medium mb-4">Event Performance</h3>
                        <div className="h-80">
                          {eventPerformanceData.length > 0 ? (
                            <ComposedChart
                              data={eventPerformanceData}
                              margin={{ top: 20, right: 30, left: 40, bottom: 50 }}
                              className="w-full h-full"
                            >
                              <CartesianGrid stroke="#f5f5f5" />
                              <XAxis dataKey="name" scale="band" />
                              <YAxis yAxisId="left" orientation="left" stroke="#6366f1" />
                              <YAxis yAxisId="right" orientation="right" stroke="#f59e0b" />
                              <Tooltip />
                              <Legend />
                              <Bar yAxisId="left" dataKey="attendance" barSize={20} fill="#6366f1" name="Attendance" />
                              <Line yAxisId="right" type="monotone" dataKey="revenue" stroke="#f59e0b" name="Revenue" />
                            </ComposedChart>
                          ) : (
                            <div className="h-full flex items-center justify-center">
                              <p className="text-neutral-500">No event performance data available</p>
                            </div>
                          )}
                        </div>
                      </div>
                      
                      <div className="bg-white shadow rounded-lg p-4">
                        <h3 className="text-lg font-medium mb-4">Event Locations</h3>
                        <div className="space-y-4">
                          {eventLocationData.length > 0 ? (
                            eventLocationData.map((location, index) => (
                              <div key={index} className="flex items-center justify-between">
                                <div className="flex items-center">
                                  <div className="p-2 rounded-full bg-neutral-100">
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                                    </svg>
                                  </div>
                                  <div className="ml-3">
                                    <p className="text-sm font-medium">{location.name}</p>
                                    <p className="text-xs text-gray-500">{location.eventCount} events</p>
                                  </div>
                                </div>
                                <div className="text-sm">
                                  <span className={`px-2 py-1 rounded-full text-xs ${
                                    location.growth > 0 ? 'bg-green-100 text-green-800' : 
                                    location.growth < 0 ? 'bg-red-100 text-red-800' : 
                                    'bg-gray-100 text-gray-800'
                                  }`}>
                                    {location.growth > 0 ? '+' : ''}{location.growth}%
                                  </span>
                                </div>
                              </div>
                            ))
                          ) : (
                            <p className="text-neutral-500 text-center py-4">No location data available</p>
                          )}
                        </div>
                      </div>
                    </div>
                  </TabsContent>
                </Tabs>
              </CardContent>
              
              <CardFooter className="flex justify-between">
                <Button variant="outline" onClick={() => fetchAnalyticsData()}>
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Refresh Data
                </Button>
                <Button variant="outline" onClick={() => exportAnalyticsData()}>
                  <Download className="mr-2 h-4 w-4" />
                  Export Report
                </Button>
              </CardFooter>
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
      
      {/* Transaction Edit Dialog */}
      <Dialog open={showTransactionEditor} onOpenChange={setShowTransactionEditor}>
        <DialogContent className="sm:max-w-[525px]">
          <DialogHeader>
            <DialogTitle>Edit Transaction</DialogTitle>
            <DialogDescription>
              Make changes to the transaction. Click save when you're done.
            </DialogDescription>
          </DialogHeader>
          
          {selectedTransaction && (
            <div className="space-y-4 py-4">
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="transaction-id" className="text-right">
                  ID
                </Label>
                <Input
                  id="transaction-id"
                  value={selectedTransaction.id}
                  className="col-span-3"
                  disabled
                />
              </div>
              
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="transaction-type" className="text-right">
                  Type
                </Label>
                <Input
                  id="transaction-type"
                  value={selectedTransaction.type}
                  className="col-span-3"
                  disabled
                />
              </div>
              
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="transaction-reference" className="text-right">
                  Reference
                </Label>
                <Input
                  id="transaction-reference"
                  value={selectedTransaction.reference}
                  className="col-span-3"
                  onChange={(e) => setSelectedTransaction({
                    ...selectedTransaction,
                    reference: e.target.value
                  })}
                />
              </div>
              
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="transaction-user" className="text-right">
                  User
                </Label>
                <Input
                  id="transaction-user"
                  value={selectedTransaction.userName || `User #${selectedTransaction.userId}`}
                  className="col-span-3"
                  disabled
                />
              </div>
              
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="transaction-event" className="text-right">
                  Event
                </Label>
                <Input
                  id="transaction-event"
                  value={selectedTransaction.eventTitle || `Event #${selectedTransaction.eventId}`}
                  className="col-span-3"
                  disabled
                />
              </div>
              
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="transaction-status" className="text-right">
                  Status
                </Label>
                <Select 
                  value={selectedTransaction.status}
                  onValueChange={(value) => setSelectedTransaction({
                    ...selectedTransaction,
                    status: value
                  })}
                >
                  <SelectTrigger className="col-span-3">
                    <SelectValue placeholder="Select status" />
                  </SelectTrigger>
                  <SelectContent>
                    {transactionStatusOptions.map((status) => (
                      <SelectItem key={status} value={status}>
                        {status.charAt(0).toUpperCase() + status.slice(1)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="transaction-amount" className="text-right">
                  Amount
                </Label>
                <Input
                  id="transaction-amount"
                  type="number"
                  step="0.01"
                  value={selectedTransaction.amount}
                  className="col-span-3"
                  onChange={(e) => setSelectedTransaction({
                    ...selectedTransaction,
                    amount: parseFloat(e.target.value)
                  })}
                />
              </div>
              
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="transaction-notes" className="text-right">
                  Notes
                </Label>
                <Textarea
                  id="transaction-notes"
                  value={selectedTransaction.notes || ''}
                  className="col-span-3"
                  rows={3}
                  onChange={(e) => setSelectedTransaction({
                    ...selectedTransaction,
                    notes: e.target.value
                  })}
                />
              </div>
            </div>
          )}
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowTransactionEditor(false)}>
              Cancel
            </Button>
            <Button 
              onClick={() => 
                updateTransactionMutation.mutate({
                  status: selectedTransaction?.status,
                  amount: selectedTransaction?.amount,
                  notes: selectedTransaction?.notes,
                  reference: selectedTransaction?.reference
                })
              }
              disabled={updateTransactionMutation.isPending}
            >
              {updateTransactionMutation.isPending ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* Transaction Delete Confirmation */}
      <AlertDialog open={confirmDeleteTransaction} onOpenChange={setConfirmDeleteTransaction}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the transaction record
              from our database.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={deleteTransactionMutation.isPending}
              asChild
            >
              <Button
                variant="destructive"
                onClick={() => deleteTransactionMutation.mutate()}
                disabled={deleteTransactionMutation.isPending}
              >
                {deleteTransactionMutation.isPending ? (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                    Deleting...
                  </>
                ) : "Delete"}
              </Button>
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      
      {/* Event Duplication Dialog */}
      <Dialog open={showDuplicateDialog} onOpenChange={setShowDuplicateDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Duplicate Event</DialogTitle>
            <DialogDescription>
              Create a copy of "{selectedEvent?.title}" with all its details, products, vendor spots, 
              and volunteer shifts. The new event will be created as a draft.
            </DialogDescription>
          </DialogHeader>
          
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="eventTitle">New Event Title</Label>
              <Input 
                id="eventTitle" 
                value={duplicateTitle} 
                onChange={(e) => setDuplicateTitle(e.target.value)}
                placeholder="Enter title for the duplicated event"
              />
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDuplicateDialog(false)}>
              Cancel
            </Button>
            <Button 
              onClick={() => {
                if (selectedEvent && duplicateTitle.trim()) {
                  duplicateEventMutation.mutate({
                    eventId: selectedEvent.id,
                    title: duplicateTitle.trim()
                  });
                }
              }}
              disabled={!duplicateTitle.trim() || duplicateEventMutation.isPending}
            >
              {duplicateEventMutation.isPending ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Duplicating...
                </>
              ) : "Duplicate Event"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
