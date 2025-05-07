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
  TableCaption, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { 
  AlertCircle, 
  ArrowLeft, 
  BarChart, 
  Check,
  Download, 
  FileText, 
  ShoppingBag, 
  Tag, 
  Ticket, 
  Users 
} from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { formatCurrency, formatDate } from '@/lib/utils';

// Interface for event transaction details
interface EventTransactionData {
  orders: any[];
  tickets: any[];
  vendorRegistrations: any[];
  volunteerAssignments: any[];
  analytics: any[];
  eventDetails: {
    id: number;
    title: string;
    startDate: string;
    endDate: string;
    location: string;
    status: string;
  };
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
  
  // Generate summary metrics if data is available
  const summary = React.useMemo(() => {
    if (!data) return null;
    
    const totalOrders = data.orders.length;
    const totalRevenue = data.orders.reduce((sum, o) => sum + (o.totalAmount || o.amount || 0), 0);
    const ticketsSold = data.tickets.length;
    const ticketRevenue = data.tickets.reduce((sum, t) => sum + (t.price || 0), 0);
    const vendorRegistrations = data.vendorRegistrations.length;
    const vendorRevenue = data.vendorRegistrations.reduce(
      (sum, v) => sum + (v.totalAmount || v.amount || 0), 
      0
    );
    const volunteerCount = data.volunteerAssignments.length;
    
    return {
      totalOrders,
      totalRevenue,
      ticketsSold,
      ticketRevenue,
      vendorRegistrations,
      vendorRevenue,
      volunteerCount
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
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            {[1, 2, 3, 4].map(i => (
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
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-xl">{eventDetails.title}</CardTitle>
            <CardDescription>
              {formatDate(new Date(eventDetails.startDate))} to {formatDate(new Date(eventDetails.endDate))}
              {' • '}{eventDetails.location}
            </CardDescription>
          </div>
          <Badge 
            variant={
              eventDetails.status === 'active' ? 'default' :
              eventDetails.status === 'upcoming' ? 'outline' :
              eventDetails.status === 'completed' ? 'secondary' :
              'destructive'
            }
          >
            {eventDetails.status}
          </Badge>
        </div>
      </CardHeader>
      
      <CardContent>
        {summary && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <Card>
              <CardContent className="p-4">
                <p className="text-sm text-neutral-500">Total Revenue</p>
                <h3 className="text-2xl font-bold mt-1">{formatCurrency(summary.totalRevenue)}</h3>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <p className="text-sm text-neutral-500">Tickets Sold</p>
                <h3 className="text-2xl font-bold mt-1">
                  {summary.ticketsSold} <span className="text-sm font-normal text-neutral-500">
                    ({formatCurrency(summary.ticketRevenue)})
                  </span>
                </h3>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <p className="text-sm text-neutral-500">Vendor Registrations</p>
                <h3 className="text-2xl font-bold mt-1">
                  {summary.vendorRegistrations} <span className="text-sm font-normal text-neutral-500">
                    ({formatCurrency(summary.vendorRevenue)})
                  </span>
                </h3>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <p className="text-sm text-neutral-500">Volunteers</p>
                <h3 className="text-2xl font-bold mt-1">{summary.volunteerCount}</h3>
              </CardContent>
            </Card>
          </div>
        )}
        
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid grid-cols-5 mb-6">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="orders">Orders</TabsTrigger>
            <TabsTrigger value="tickets">Tickets</TabsTrigger>
            <TabsTrigger value="vendors">Vendors</TabsTrigger>
            <TabsTrigger value="volunteers">Volunteers</TabsTrigger>
          </TabsList>
          
          <TabsContent value="overview">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-lg flex items-center">
                    <BarChart className="mr-2 h-5 w-5" />
                    Recent Transactions
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Type</TableHead>
                        <TableHead>Amount</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Date</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data.orders.slice(0, 5).map((order) => (
                        <TableRow key={`order-${order.id}`}>
                          <TableCell className="flex items-center">
                            <ShoppingBag className="mr-2 h-4 w-4 text-blue-500" />
                            Order
                          </TableCell>
                          <TableCell>{formatCurrency(order.totalAmount || order.amount)}</TableCell>
                          <TableCell>
                            <Badge variant={order.status === 'completed' ? 'default' : 'outline'}>
                              {order.status}
                            </Badge>
                          </TableCell>
                          <TableCell>{formatDate(new Date(order.createdAt))}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
              
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-lg flex items-center">
                    <FileText className="mr-2 h-5 w-5" />
                    Event Stats
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div>
                      <h4 className="text-sm font-medium text-neutral-500">Revenue Breakdown</h4>
                      <ul className="mt-2 space-y-2">
                        <li className="flex justify-between">
                          <span className="text-sm">Tickets</span>
                          <span className="font-medium">{formatCurrency(summary?.ticketRevenue || 0)}</span>
                        </li>
                        <li className="flex justify-between">
                          <span className="text-sm">Vendor Registrations</span>
                          <span className="font-medium">{formatCurrency(summary?.vendorRevenue || 0)}</span>
                        </li>
                        <li className="flex justify-between">
                          <span className="text-sm">Other</span>
                          <span className="font-medium">{formatCurrency((summary?.totalRevenue || 0) - 
                            (summary?.ticketRevenue || 0) - (summary?.vendorRevenue || 0))}</span>
                        </li>
                      </ul>
                    </div>
                    <Separator />
                    <div>
                      <h4 className="text-sm font-medium text-neutral-500">Status Summary</h4>
                      <div className="grid grid-cols-2 gap-4 mt-2">
                        <div>
                          <p className="text-sm">Ticket Status</p>
                          <ul className="mt-1 space-y-1 text-sm">
                            <li className="flex justify-between">
                              <span>Confirmed</span>
                              <Badge variant="outline" className="ml-2">
                                {data.tickets.filter(t => t.status === 'confirmed').length}
                              </Badge>
                            </li>
                            <li className="flex justify-between">
                              <span>Checked In</span>
                              <Badge variant="outline" className="ml-2">
                                {data.tickets.filter(t => t.status === 'checked_in').length}
                              </Badge>
                            </li>
                          </ul>
                        </div>
                        <div>
                          <p className="text-sm">Vendor Status</p>
                          <ul className="mt-1 space-y-1 text-sm">
                            <li className="flex justify-between">
                              <span>Approved</span>
                              <Badge variant="outline" className="ml-2">
                                {data.vendorRegistrations.filter(v => v.status === 'approved').length}
                              </Badge>
                            </li>
                            <li className="flex justify-between">
                              <span>Pending</span>
                              <Badge variant="outline" className="ml-2">
                                {data.vendorRegistrations.filter(v => v.status === 'pending').length}
                              </Badge>
                            </li>
                          </ul>
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
          
          <TabsContent value="orders">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center">
                  <ShoppingBag className="mr-2 h-5 w-5" />
                  Order History
                </CardTitle>
                <CardDescription>
                  Detailed history of all orders for this event.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Order #</TableHead>
                      <TableHead>User</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Payment Status</TableHead>
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
                          <TableCell>{order.userName || `User #${order.userId}`}</TableCell>
                          <TableCell>{formatCurrency(order.totalAmount || order.amount)}</TableCell>
                          <TableCell>
                            <Badge variant={order.status === 'completed' ? 'default' : 'outline'}>
                              {order.status}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Badge variant={
                              order.paymentStatus === 'paid' ? 'default' :
                              order.paymentStatus === 'pending' ? 'outline' :
                              'destructive'
                            }>
                              {order.paymentStatus}
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
          
          <TabsContent value="tickets">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center">
                  <Ticket className="mr-2 h-5 w-5" />
                  Ticket Purchases
                </CardTitle>
                <CardDescription>
                  All ticket purchases for this event.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Ticket #</TableHead>
                      <TableHead>User</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Price</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Date</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.tickets.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-4 text-neutral-500">
                          No tickets found for this event
                        </TableCell>
                      </TableRow>
                    ) : (
                      data.tickets.map((ticket) => (
                        <TableRow key={`ticket-${ticket.id}`}>
                          <TableCell>{ticket.ticketNumber || `#${ticket.id}`}</TableCell>
                          <TableCell>{ticket.userName || `User #${ticket.userId}`}</TableCell>
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
          
          <TabsContent value="vendors">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center">
                  <Tag className="mr-2 h-5 w-5" />
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
                      <TableHead>Vendor</TableHead>
                      <TableHead>Spot</TableHead>
                      <TableHead>Price</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Review Date</TableHead>
                      <TableHead>Approved By</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.vendorRegistrations.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-4 text-neutral-500">
                          No vendor registrations found for this event
                        </TableCell>
                      </TableRow>
                    ) : (
                      data.vendorRegistrations.map((registration) => (
                        <TableRow key={`vendor-${registration.id}`}>
                          <TableCell>{registration.vendorName || `Vendor #${registration.vendorProfileId}`}</TableCell>
                          <TableCell>{registration.spotName || `Spot #${registration.vendorSpotId}`}</TableCell>
                          <TableCell>{formatCurrency(registration.totalAmount || registration.amount || 0)}</TableCell>
                          <TableCell>
                            <Badge variant={
                              registration.status === 'approved' ? 'default' :
                              registration.status === 'pending' ? 'outline' :
                              'destructive'
                            }>
                              {registration.status}
                            </Badge>
                          </TableCell>
                          <TableCell>{registration.reviewDate ? formatDate(new Date(registration.reviewDate)) : 'N/A'}</TableCell>
                          <TableCell>{registration.reviewedByName || (registration.reviewedBy ? `Admin #${registration.reviewedBy}` : 'N/A')}</TableCell>
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
                      <TableHead>Volunteer</TableHead>
                      <TableHead>Shift</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Time Slot</TableHead>
                      <TableHead>Approved By</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.volunteerAssignments.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center py-4 text-neutral-500">
                          No volunteer assignments found for this event
                        </TableCell>
                      </TableRow>
                    ) : (
                      data.volunteerAssignments.map((assignment) => (
                        <TableRow key={`volunteer-${assignment.id}`}>
                          <TableCell>{assignment.volunteerName || `Volunteer #${assignment.volunteerProfileId}`}</TableCell>
                          <TableCell>{assignment.shiftName || `Shift #${assignment.volunteerShiftId}`}</TableCell>
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
                          <TableCell>
                            {assignment.startTime ? 
                              `${new Date(assignment.startTime).toLocaleTimeString()} - ${new Date(assignment.endTime).toLocaleTimeString()}` 
                              : 'N/A'}
                          </TableCell>
                          <TableCell>{assignment.reviewedByName || (assignment.reviewedBy ? `Admin #${assignment.reviewedBy}` : 'N/A')}</TableCell>
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