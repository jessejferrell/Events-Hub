import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardHeader, 
  CardTitle, 
  CardFooter 
} from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import { Progress } from '@/components/ui/progress';
import { 
  AlertCircle, 
  ArrowLeft, 
  Calendar, 
  CircleDollarSign, 
  Download, 
  Map, 
  ShoppingBag, 
  Store, 
  Ticket, 
  Users
} from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { formatCurrency, formatDate } from '@/lib/utils';

// Interface for event transaction details
interface EventTransactionData {
  eventDetails: {
    id: number;
    title: string;
    startDate: string;
    endDate: string;
    location: string;
    status: string;
    capacity: number | null;
    ticketsSold: number;
    revenue: number;
    description: string;
    imageUrl: string | null;
  };
  orders: any[];
  tickets: any[];
  vendorRegistrations: any[];
  volunteerAssignments: any[];
  analytics: any[];
}

interface EventTransactionDetailsProps {
  eventId: number;
  onBack: () => void;
}

export function EventTransactionDetails({ eventId, onBack }: EventTransactionDetailsProps) {
  const [activeTab, setActiveTab] = useState('overview');
  
  const { data, isLoading, error } = useQuery<EventTransactionData>({
    queryKey: [`/api/admin/events/${eventId}/transactions`],
    queryFn: async () => {
      const res = await fetch(`/api/admin/events/${eventId}/transactions`);
      if (!res.ok) {
        throw new Error('Failed to fetch event transactions');
      }
      return res.json();
    }
  });
  
  // Calculate metrics if data is available
  const metrics = React.useMemo(() => {
    if (!data) return null;
    
    const totalRevenue = data.orders.reduce((sum, o) => sum + (o.totalAmount || o.amount || 0), 0);
    const ticketRevenue = data.tickets.reduce((sum, t) => sum + (t.price || 0), 0);
    const vendorRevenue = data.vendorRegistrations.reduce(
      (sum, v) => sum + (v.totalAmount || v.amount || 0), 
      0
    );
    const ticketCount = data.tickets.length;
    const vendorCount = data.vendorRegistrations.length;
    const volunteerCount = data.volunteerAssignments.length;
    
    let attendance = 0;
    const ticketsByType: Record<string, number> = {};
    const ticketRevenueByType: Record<string, number> = {};
    
    data.tickets.forEach(ticket => {
      if (ticket.status === 'checked_in') {
        attendance++;
      }
      
      const type = ticket.ticketType || 'Standard';
      ticketsByType[type] = (ticketsByType[type] || 0) + 1;
      ticketRevenueByType[type] = (ticketRevenueByType[type] || 0) + (ticket.price || 0);
    });
    
    return {
      totalRevenue,
      ticketRevenue,
      vendorRevenue,
      ticketCount,
      vendorCount,
      volunteerCount,
      attendance,
      ticketsByType,
      ticketRevenueByType
    };
  }, [data]);
  
  const handleExportData = () => {
    // Open export endpoint in new window
    window.open(`/api/admin/events/${eventId}/transactions/export`, '_blank');
  };
  
  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Button 
            variant="ghost" 
            className="w-fit p-0 mb-4" 
            onClick={onBack}
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Transactions
          </Button>
          <Skeleton className="h-8 w-3/4 mb-2" />
          <Skeleton className="h-4 w-1/2" />
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            {[1, 2, 3].map(i => (
              <Card key={i}>
                <CardContent className="p-4">
                  <Skeleton className="h-4 w-1/2 mb-2" />
                  <Skeleton className="h-8 w-3/4" />
                </CardContent>
              </Card>
            ))}
          </div>
          <Skeleton className="h-64 w-full" />
        </CardContent>
      </Card>
    );
  }
  
  if (error || !data) {
    return (
      <Card>
        <CardHeader>
          <Button 
            variant="ghost" 
            className="w-fit p-0 mb-4" 
            onClick={onBack}
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Transactions
          </Button>
          <CardTitle>Event Transaction Details</CardTitle>
        </CardHeader>
        <CardContent>
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>
              {error ? (error as Error).message : 'Unable to load transaction data'}
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }
  
  const { eventDetails } = data;
  const attendancePercentage = eventDetails.capacity ? 
    (metrics?.attendance || 0) / eventDetails.capacity * 100 : 0;
  
  return (
    <Card>
      <CardHeader>
        <Button 
          variant="ghost" 
          className="w-fit p-0 mb-4" 
          onClick={onBack}
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Transactions
        </Button>
        <div className="flex items-start justify-between flex-col md:flex-row">
          <div>
            <CardTitle className="text-xl">{eventDetails.title}</CardTitle>
            <CardDescription className="flex items-center gap-2">
              <Calendar className="h-3 w-3" />
              {formatDate(new Date(eventDetails.startDate), 'MMM d, yyyy')}
              {' - '}
              {formatDate(new Date(eventDetails.endDate), 'MMM d, yyyy')}
              <span className="mx-1">•</span>
              <Map className="h-3 w-3" />
              {eventDetails.location}
            </CardDescription>
          </div>
          <Badge variant={
            eventDetails.status === 'active' ? 'default' :
            eventDetails.status === 'upcoming' ? 'outline' :
            eventDetails.status === 'completed' ? 'secondary' :
            'destructive'
          }>
            {eventDetails.status}
          </Badge>
        </div>
      </CardHeader>
      
      <CardContent>
        {metrics && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <Card>
              <CardContent className="p-4">
                <p className="text-sm text-neutral-500">Total Revenue</p>
                <h3 className="text-2xl font-bold mt-1">{formatCurrency(metrics.totalRevenue)}</h3>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <p className="text-sm text-neutral-500">Tickets Sold</p>
                <h3 className="text-2xl font-bold mt-1">
                  {metrics.ticketCount} <span className="text-sm font-normal text-neutral-500">
                    ({formatCurrency(metrics.ticketRevenue)})
                  </span>
                </h3>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <p className="text-sm text-neutral-500">Vendor Registrations</p>
                <h3 className="text-2xl font-bold mt-1">
                  {metrics.vendorCount} <span className="text-sm font-normal text-neutral-500">
                    ({formatCurrency(metrics.vendorRevenue)})
                  </span>
                </h3>
              </CardContent>
            </Card>
          </div>
        )}
        
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid grid-cols-5 mb-6">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="tickets">Tickets</TabsTrigger>
            <TabsTrigger value="orders">Orders</TabsTrigger>
            <TabsTrigger value="vendors">Vendors</TabsTrigger>
            <TabsTrigger value="volunteers">Volunteers</TabsTrigger>
          </TabsList>
          
          <TabsContent value="overview">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-lg flex items-center">
                    <Calendar className="mr-2 h-5 w-5" />
                    Event Details
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <dl className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <dt className="text-sm font-medium text-neutral-500">Event Status</dt>
                        <dd className="mt-1">
                          <Badge variant={
                            eventDetails.status === 'active' ? 'default' :
                            eventDetails.status === 'upcoming' ? 'outline' :
                            eventDetails.status === 'completed' ? 'secondary' :
                            'destructive'
                          }>
                            {eventDetails.status}
                          </Badge>
                        </dd>
                      </div>
                      <div>
                        <dt className="text-sm font-medium text-neutral-500">Event ID</dt>
                        <dd className="mt-1">#{eventDetails.id}</dd>
                      </div>
                    </div>
                    
                    <div>
                      <dt className="text-sm font-medium text-neutral-500">Attendance</dt>
                      <dd className="mt-1">
                        <div className="flex justify-between mb-1 text-sm">
                          <span>{metrics?.attendance || 0} checked in</span>
                          <span>{eventDetails.capacity || 'Unlimited'} capacity</span>
                        </div>
                        <Progress
                          value={attendancePercentage}
                          className="h-2"
                        />
                      </dd>
                    </div>
                    
                    <div>
                      <dt className="text-sm font-medium text-neutral-500">Description</dt>
                      <dd className="mt-1 text-sm">{eventDetails.description}</dd>
                    </div>
                  </dl>
                </CardContent>
              </Card>
              
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-lg flex items-center">
                    <CircleDollarSign className="mr-2 h-5 w-5" />
                    Revenue Breakdown
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div>
                      <p className="text-sm font-medium text-neutral-500 mb-2">Ticket Revenue by Type</p>
                      <div className="space-y-2">
                        {metrics && Object.entries(metrics.ticketRevenueByType).map(([type, amount]) => (
                          <div key={type} className="flex justify-between items-center">
                            <div className="flex items-center">
                              <Ticket className="h-4 w-4 mr-2 text-blue-500" />
                              <span>{type}</span>
                            </div>
                            <div className="flex items-center">
                              <span className="font-medium">{formatCurrency(amount)}</span>
                              <span className="text-xs text-neutral-500 ml-2">
                                ({metrics.ticketsByType[type] || 0} tickets)
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                    
                    <Separator />
                    
                    <div>
                      <p className="text-sm font-medium text-neutral-500 mb-2">Revenue Sources</p>
                      <div className="space-y-2">
                        <div className="flex justify-between items-center">
                          <div className="flex items-center">
                            <Ticket className="h-4 w-4 mr-2 text-blue-500" />
                            <span>Tickets</span>
                          </div>
                          <span className="font-medium">{formatCurrency(metrics?.ticketRevenue || 0)}</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <div className="flex items-center">
                            <Store className="h-4 w-4 mr-2 text-green-500" />
                            <span>Vendor Fees</span>
                          </div>
                          <span className="font-medium">{formatCurrency(metrics?.vendorRevenue || 0)}</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <div className="flex items-center">
                            <ShoppingBag className="h-4 w-4 mr-2 text-purple-500" />
                            <span>Merchandise</span>
                          </div>
                          <span className="font-medium">{formatCurrency(0)}</span>
                        </div>
                      </div>
                    </div>
                    
                    <Separator />
                    
                    <div className="flex justify-between items-center pt-2">
                      <span className="font-medium">Total Revenue</span>
                      <span className="text-lg font-bold">{formatCurrency(metrics?.totalRevenue || 0)}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
          
          <TabsContent value="tickets">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center">
                  <Ticket className="mr-2 h-5 w-5" />
                  Ticket Sales
                </CardTitle>
                <CardDescription>
                  All tickets sold for this event.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Ticket #</TableHead>
                      <TableHead>Customer</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Price</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Purchase Date</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.tickets.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-4 text-neutral-500">
                          No tickets sold for this event yet
                        </TableCell>
                      </TableRow>
                    ) : (
                      data.tickets.map((ticket) => (
                        <TableRow key={`ticket-${ticket.id}`}>
                          <TableCell>{ticket.ticketNumber || `#${ticket.id}`}</TableCell>
                          <TableCell>
                            <div className="flex items-center">
                              <Avatar className="h-6 w-6 mr-2">
                                <AvatarFallback>{ticket.userName?.substring(0, 2).toUpperCase() || 'GU'}</AvatarFallback>
                              </Avatar>
                              <span>{ticket.userName || 'Guest User'}</span>
                            </div>
                          </TableCell>
                          <TableCell>{ticket.ticketType || 'Standard'}</TableCell>
                          <TableCell>{formatCurrency(ticket.price)}</TableCell>
                          <TableCell>
                            <Badge variant={
                              ticket.status === 'checked_in' ? 'default' :
                              ticket.status === 'confirmed' ? 'outline' :
                              'secondary'
                            }>
                              {ticket.status}
                            </Badge>
                          </TableCell>
                          <TableCell>{formatDate(new Date(ticket.createdAt))}</TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
          
          <TabsContent value="orders">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center">
                  <ShoppingBag className="mr-2 h-5 w-5" />
                  Order History
                </CardTitle>
                <CardDescription>
                  All purchase orders for this event.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Order #</TableHead>
                      <TableHead>Customer</TableHead>
                      <TableHead>Items</TableHead>
                      <TableHead>Total</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Date</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.orders.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-4 text-neutral-500">
                          No orders found for this event
                        </TableCell>
                      </TableRow>
                    ) : (
                      data.orders.map((order) => (
                        <TableRow key={`order-${order.id}`}>
                          <TableCell>{order.orderNumber || `#${order.id}`}</TableCell>
                          <TableCell>
                            <div className="flex items-center">
                              <Avatar className="h-6 w-6 mr-2">
                                <AvatarFallback>{order.userName?.substring(0, 2).toUpperCase() || 'GU'}</AvatarFallback>
                              </Avatar>
                              <span>{order.userName || `User #${order.userId}`}</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            {order.itemCount || (order.items ? order.items.length : '1')} items
                          </TableCell>
                          <TableCell>{formatCurrency(order.totalAmount || order.amount)}</TableCell>
                          <TableCell>
                            <Badge variant={
                              order.paymentStatus === 'paid' ? 'default' :
                              order.paymentStatus === 'pending' ? 'outline' :
                              'destructive'
                            }>
                              {order.paymentStatus || order.status}
                            </Badge>
                          </TableCell>
                          <TableCell>{formatDate(new Date(order.createdAt))}</TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
          
          <TabsContent value="vendors">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center">
                  <Store className="mr-2 h-5 w-5" />
                  Vendor Registrations
                </CardTitle>
                <CardDescription>
                  All vendor booth registrations for this event.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Registration #</TableHead>
                      <TableHead>Vendor</TableHead>
                      <TableHead>Booth/Spot</TableHead>
                      <TableHead>Fee</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Registration Date</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.vendorRegistrations.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-4 text-neutral-500">
                          No vendor registrations for this event
                        </TableCell>
                      </TableRow>
                    ) : (
                      data.vendorRegistrations.map((reg) => (
                        <TableRow key={`vendor-reg-${reg.id}`}>
                          <TableCell>{`#${reg.id}`}</TableCell>
                          <TableCell>
                            <div className="flex items-center">
                              <Avatar className="h-6 w-6 mr-2">
                                <AvatarFallback>{reg.businessName?.substring(0, 2).toUpperCase() || reg.userName?.substring(0, 2).toUpperCase() || 'VN'}</AvatarFallback>
                              </Avatar>
                              <span>{reg.businessName || reg.userName || `Vendor #${reg.vendorProfileId}`}</span>
                            </div>
                          </TableCell>
                          <TableCell>{reg.spotName || `Spot #${reg.vendorSpotId}`}</TableCell>
                          <TableCell>{formatCurrency(reg.totalAmount || reg.amount || 0)}</TableCell>
                          <TableCell>
                            <Badge variant={
                              reg.status === 'approved' ? 'default' :
                              reg.status === 'pending' ? 'outline' :
                              'destructive'
                            }>
                              {reg.status}
                            </Badge>
                          </TableCell>
                          <TableCell>{formatDate(new Date(reg.createdAt))}</TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
          
          <TabsContent value="volunteers">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center">
                  <Users className="mr-2 h-5 w-5" />
                  Volunteer Assignments
                </CardTitle>
                <CardDescription>
                  All volunteer shift assignments for this event.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Assignment #</TableHead>
                      <TableHead>Volunteer</TableHead>
                      <TableHead>Shift</TableHead>
                      <TableHead>Time Slot</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Assigned Date</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.volunteerAssignments.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-4 text-neutral-500">
                          No volunteer assignments for this event
                        </TableCell>
                      </TableRow>
                    ) : (
                      data.volunteerAssignments.map((assignment) => (
                        <TableRow key={`volunteer-${assignment.id}`}>
                          <TableCell>{`#${assignment.id}`}</TableCell>
                          <TableCell>
                            <div className="flex items-center">
                              <Avatar className="h-6 w-6 mr-2">
                                <AvatarFallback>{assignment.userName?.substring(0, 2).toUpperCase() || 'VL'}</AvatarFallback>
                              </Avatar>
                              <span>{assignment.userName || `Volunteer #${assignment.volunteerProfileId}`}</span>
                            </div>
                          </TableCell>
                          <TableCell>{assignment.shiftName || `Shift #${assignment.volunteerShiftId}`}</TableCell>
                          <TableCell>
                            {assignment.startTime ? 
                              `${new Date(assignment.startTime).toLocaleTimeString()} - ${new Date(assignment.endTime).toLocaleTimeString()}` 
                              : 'N/A'}
                          </TableCell>
                          <TableCell>
                            <Badge variant={
                              assignment.status === 'confirmed' ? 'default' :
                              assignment.status === 'pending' ? 'outline' :
                              assignment.status === 'completed' ? 'secondary' :
                              'destructive'
                            }>
                              {assignment.status}
                            </Badge>
                          </TableCell>
                          <TableCell>{formatDate(new Date(assignment.createdAt))}</TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </CardContent>
      
      <CardFooter className="flex justify-between">
        <Button variant="outline" onClick={onBack}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back
        </Button>
        <Button onClick={handleExportData}>
          <Download className="mr-2 h-4 w-4" />
          Export Data
        </Button>
      </CardFooter>
    </Card>
  );
}