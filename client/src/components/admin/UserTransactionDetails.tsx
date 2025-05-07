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
import { 
  AlertCircle, 
  ArrowLeft, 
  Clock, 
  CreditCard,
  Download, 
  Mail,
  Phone,
  ShoppingBag, 
  Store, 
  Ticket, 
  User
} from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { formatCurrency, formatDate } from '@/lib/utils';

// Interface for user transaction details
interface UserTransactionData {
  user: {
    id: number;
    username: string;
    email: string;
    name: string;
    role: string;
    stripeAccountId: string | null;
    stripeCustomerId: string | null;
  };
  orders: any[];
  tickets: any[];
  vendorProfile: any;
  vendorRegistrations: any[];
  volunteerProfile: any;
  volunteerAssignments: any[];
  stripeAccountStatus: any;
}

interface UserTransactionDetailsProps {
  userId: number;
  onBack: () => void;
}

export function UserTransactionDetails({ userId, onBack }: UserTransactionDetailsProps) {
  const [activeTab, setActiveTab] = useState('overview');
  
  const { data, isLoading, error } = useQuery<UserTransactionData>({
    queryKey: [`/api/admin/users/${userId}/transactions`],
    queryFn: async () => {
      const res = await fetch(`/api/admin/users/${userId}/transactions`);
      if (!res.ok) {
        throw new Error('Failed to fetch user transactions');
      }
      return res.json();
    }
  });
  
  // Generate summary metrics if data is available
  const summary = React.useMemo(() => {
    if (!data) return null;
    
    const totalSpent = data.orders.reduce((sum, o) => sum + (o.totalAmount || o.amount || 0), 0);
    const ticketsPurchased = data.tickets.length;
    const ticketsValue = data.tickets.reduce((sum, t) => sum + (t.price || 0), 0);
    const vendorCount = data.vendorRegistrations.length;
    const vendorValue = data.vendorRegistrations.reduce(
      (sum, v) => sum + (v.totalAmount || v.amount || 0), 
      0
    );
    const volunteerCount = data.volunteerAssignments.length;
    
    return {
      totalSpent,
      ticketsPurchased,
      ticketsValue,
      vendorCount,
      vendorValue,
      volunteerCount
    };
  }, [data]);
  
  const handleExportData = () => {
    // Open export endpoint in new window
    window.open(`/api/admin/users/${userId}/transactions/export`, '_blank');
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
          <CardTitle>User Transaction Details</CardTitle>
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
  
  const { user, stripeAccountStatus } = data;
  
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
        <div className="flex items-start md:items-center justify-between flex-col md:flex-row gap-4 md:gap-0">
          <div className="flex items-center">
            <Avatar className="h-12 w-12 mr-4">
              <AvatarImage src="" alt={user.name || user.username} />
              <AvatarFallback>{(user.name || user.username || '').substring(0, 2).toUpperCase()}</AvatarFallback>
            </Avatar>
            <div>
              <CardTitle className="text-xl">{user.name || user.username}</CardTitle>
              <CardDescription className="flex items-center gap-2">
                <Mail className="h-3 w-3" /> {user.email}
              </CardDescription>
            </div>
          </div>
          <div className="flex flex-col md:flex-row gap-2">
            <Badge variant="outline" className="capitalize">
              {user.role}
            </Badge>
            {user.stripeAccountId && (
              <Badge 
                variant={
                  stripeAccountStatus?.chargesEnabled ? 'default' : 'secondary'
                }
              >
                {stripeAccountStatus?.chargesEnabled ? 'Stripe Verified' : 'Stripe Pending'}
              </Badge>
            )}
          </div>
        </div>
      </CardHeader>
      
      <CardContent>
        {summary && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <Card>
              <CardContent className="p-4">
                <p className="text-sm text-neutral-500">Total Spent</p>
                <h3 className="text-2xl font-bold mt-1">{formatCurrency(summary.totalSpent)}</h3>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <p className="text-sm text-neutral-500">Tickets Purchased</p>
                <h3 className="text-2xl font-bold mt-1">
                  {summary.ticketsPurchased} <span className="text-sm font-normal text-neutral-500">
                    ({formatCurrency(summary.ticketsValue)})
                  </span>
                </h3>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <p className="text-sm text-neutral-500">Vendor Registrations</p>
                <h3 className="text-2xl font-bold mt-1">
                  {summary.vendorCount} <span className="text-sm font-normal text-neutral-500">
                    ({formatCurrency(summary.vendorValue)})
                  </span>
                </h3>
              </CardContent>
            </Card>
          </div>
        )}
        
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid grid-cols-5 mb-6">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="purchases">Purchases</TabsTrigger>
            <TabsTrigger value="tickets">Tickets</TabsTrigger>
            <TabsTrigger value="vendor">Vendor</TabsTrigger>
            <TabsTrigger value="volunteer">Volunteer</TabsTrigger>
          </TabsList>
          
          <TabsContent value="overview">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-lg flex items-center">
                    <User className="mr-2 h-5 w-5" />
                    User Information
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <dl className="space-y-3">
                    <div className="flex justify-between">
                      <dt className="text-sm font-medium text-neutral-500">Username</dt>
                      <dd>{user.username}</dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className="text-sm font-medium text-neutral-500">Email</dt>
                      <dd>{user.email || 'Not provided'}</dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className="text-sm font-medium text-neutral-500">Role</dt>
                      <dd className="capitalize">{user.role}</dd>
                    </div>
                    <Separator />
                    <div className="flex justify-between">
                      <dt className="text-sm font-medium text-neutral-500">User ID</dt>
                      <dd>#{user.id}</dd>
                    </div>
                    {user.stripeCustomerId && (
                      <div className="flex justify-between">
                        <dt className="text-sm font-medium text-neutral-500">Stripe Customer</dt>
                        <dd>{user.stripeCustomerId}</dd>
                      </div>
                    )}
                    {user.stripeAccountId && (
                      <>
                        <div className="flex justify-between">
                          <dt className="text-sm font-medium text-neutral-500">Stripe Connect</dt>
                          <dd>{user.stripeAccountId}</dd>
                        </div>
                        {stripeAccountStatus && (
                          <div className="flex justify-between">
                            <dt className="text-sm font-medium text-neutral-500">Account Status</dt>
                            <dd className="flex items-center gap-1">
                              {stripeAccountStatus.chargesEnabled ? (
                                <>
                                  <Badge>Verified</Badge>
                                </>
                              ) : (
                                <>
                                  <Badge variant="outline">Pending</Badge>
                                </>
                              )}
                            </dd>
                          </div>
                        )}
                      </>
                    )}
                  </dl>
                  {stripeAccountStatus && stripeAccountStatus.requirements && 
                      (stripeAccountStatus.requirements.currentlyDue.length > 0 || 
                       stripeAccountStatus.requirements.eventuallyDue.length > 0) && (
                    <Alert className="mt-4">
                      <AlertCircle className="h-4 w-4" />
                      <AlertTitle>Verification Required</AlertTitle>
                      <AlertDescription>
                        <div className="space-y-2 mt-2">
                          {stripeAccountStatus.requirements.currentlyDue.length > 0 && (
                            <div>
                              <p className="text-sm font-medium">Currently Due:</p>
                              <ul className="text-sm list-disc list-inside">
                                {stripeAccountStatus.requirements.currentlyDue.map((item: string) => (
                                  <li key={item}>{item.replace(/_/g, ' ')}</li>
                                ))}
                              </ul>
                            </div>
                          )}
                          {stripeAccountStatus.requirements.eventuallyDue.length > 0 && (
                            <div>
                              <p className="text-sm font-medium">Eventually Due:</p>
                              <ul className="text-sm list-disc list-inside">
                                {stripeAccountStatus.requirements.eventuallyDue.map((item: string) => (
                                  <li key={item}>{item.replace(/_/g, ' ')}</li>
                                ))}
                              </ul>
                            </div>
                          )}
                        </div>
                      </AlertDescription>
                    </Alert>
                  )}
                </CardContent>
              </Card>
              
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-lg flex items-center">
                    <CreditCard className="mr-2 h-5 w-5" />
                    Transaction History
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Type</TableHead>
                        <TableHead>Event</TableHead>
                        <TableHead>Amount</TableHead>
                        <TableHead>Date</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data.orders.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={4} className="text-center py-4 text-neutral-500">
                            No transaction history found
                          </TableCell>
                        </TableRow>
                      ) : (
                        data.orders.slice(0, 5).map((order) => (
                          <TableRow key={`order-${order.id}`}>
                            <TableCell className="flex items-center">
                              <ShoppingBag className="mr-2 h-4 w-4 text-blue-500" />
                              Order
                            </TableCell>
                            <TableCell>{order.eventTitle || `Event #${order.eventId}`}</TableCell>
                            <TableCell>{formatCurrency(order.totalAmount || order.amount)}</TableCell>
                            <TableCell>{formatDate(new Date(order.createdAt))}</TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
          
          <TabsContent value="purchases">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center">
                  <ShoppingBag className="mr-2 h-5 w-5" />
                  Order History
                </CardTitle>
                <CardDescription>
                  All purchase orders made by this user.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Order #</TableHead>
                      <TableHead>Event</TableHead>
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
                          No orders found for this user
                        </TableCell>
                      </TableRow>
                    ) : (
                      data.orders.map((order) => (
                        <TableRow key={`order-${order.id}`}>
                          <TableCell>{order.orderNumber || `#${order.id}`}</TableCell>
                          <TableCell>{order.eventTitle || `Event #${order.eventId}`}</TableCell>
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
                  All tickets purchased by this user.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Ticket #</TableHead>
                      <TableHead>Event</TableHead>
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
                          No tickets found for this user
                        </TableCell>
                      </TableRow>
                    ) : (
                      data.tickets.map((ticket) => (
                        <TableRow key={`ticket-${ticket.id}`}>
                          <TableCell>{ticket.ticketNumber || `#${ticket.id}`}</TableCell>
                          <TableCell>{ticket.eventTitle || `Event #${ticket.eventId}`}</TableCell>
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
          
          <TabsContent value="vendor">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center">
                  <Store className="mr-2 h-5 w-5" />
                  Vendor Profile & Registrations
                </CardTitle>
                <CardDescription>
                  Vendor profile and event booth registrations.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {data.vendorProfile ? (
                  <div className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div>
                        <h3 className="text-lg font-semibold mb-2">Vendor Profile</h3>
                        <dl className="space-y-2">
                          <div className="flex justify-between">
                            <dt className="text-sm font-medium text-neutral-500">Business Name</dt>
                            <dd>{data.vendorProfile.businessName}</dd>
                          </div>
                          <div className="flex justify-between">
                            <dt className="text-sm font-medium text-neutral-500">Business Type</dt>
                            <dd>{data.vendorProfile.businessType}</dd>
                          </div>
                          <div className="flex justify-between">
                            <dt className="text-sm font-medium text-neutral-500">Contact</dt>
                            <dd className="flex items-center">
                              <Phone className="h-3 w-3 mr-1" />
                              {data.vendorProfile.phoneNumber || 'N/A'}
                            </dd>
                          </div>
                        </dl>
                      </div>
                      <div>
                        <h3 className="text-lg font-semibold mb-2">Product Categories</h3>
                        <div className="flex flex-wrap gap-2">
                          {data.vendorProfile.productCategories ? (
                            data.vendorProfile.productCategories.map((category: string) => (
                              <Badge key={category} variant="outline">
                                {category}
                              </Badge>
                            ))
                          ) : (
                            <p className="text-neutral-500">No product categories specified</p>
                          )}
                        </div>
                      </div>
                    </div>
                    
                    <Separator />
                    
                    <div>
                      <h3 className="text-lg font-semibold mb-4">Vendor Registrations</h3>
                      
                      {data.vendorRegistrations.length === 0 ? (
                        <p className="text-neutral-500">No vendor registrations found</p>
                      ) : (
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Event</TableHead>
                              <TableHead>Spot</TableHead>
                              <TableHead>Price</TableHead>
                              <TableHead>Status</TableHead>
                              <TableHead>Registration Date</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {data.vendorRegistrations.map((registration) => (
                              <TableRow key={`vendor-reg-${registration.id}`}>
                                <TableCell>{registration.eventTitle || `Event #${registration.eventId}`}</TableCell>
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
                                <TableCell>{formatDate(new Date(registration.createdAt))}</TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <Store className="h-12 w-12 mx-auto mb-4 text-neutral-300" />
                    <h3 className="text-lg font-medium">No Vendor Profile</h3>
                    <p className="text-neutral-500 mt-1">This user doesn't have a vendor profile.</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
          
          <TabsContent value="volunteer">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center">
                  <Clock className="mr-2 h-5 w-5" />
                  Volunteer Profile & Assignments
                </CardTitle>
                <CardDescription>
                  Volunteer profile and event shift assignments.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {data.volunteerProfile ? (
                  <div className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div>
                        <h3 className="text-lg font-semibold mb-2">Volunteer Profile</h3>
                        <dl className="space-y-2">
                          <div className="flex justify-between">
                            <dt className="text-sm font-medium text-neutral-500">Availability</dt>
                            <dd>{data.volunteerProfile.availability || 'Not specified'}</dd>
                          </div>
                          <div className="flex justify-between">
                            <dt className="text-sm font-medium text-neutral-500">Experience</dt>
                            <dd>{data.volunteerProfile.experience || 'Not specified'}</dd>
                          </div>
                          <div className="flex justify-between">
                            <dt className="text-sm font-medium text-neutral-500">Contact</dt>
                            <dd className="flex items-center">
                              <Phone className="h-3 w-3 mr-1" />
                              {data.volunteerProfile.phoneNumber || 'N/A'}
                            </dd>
                          </div>
                        </dl>
                      </div>
                      <div>
                        <h3 className="text-lg font-semibold mb-2">Skills</h3>
                        <div className="flex flex-wrap gap-2">
                          {data.volunteerProfile.skills ? (
                            data.volunteerProfile.skills.map((skill: string) => (
                              <Badge key={skill} variant="outline">
                                {skill}
                              </Badge>
                            ))
                          ) : (
                            <p className="text-neutral-500">No skills specified</p>
                          )}
                        </div>
                      </div>
                    </div>
                    
                    <Separator />
                    
                    <div>
                      <h3 className="text-lg font-semibold mb-4">Volunteer Assignments</h3>
                      
                      {data.volunteerAssignments.length === 0 ? (
                        <p className="text-neutral-500">No volunteer assignments found</p>
                      ) : (
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Event</TableHead>
                              <TableHead>Shift</TableHead>
                              <TableHead>Status</TableHead>
                              <TableHead>Time Slot</TableHead>
                              <TableHead>Assignment Date</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {data.volunteerAssignments.map((assignment) => (
                              <TableRow key={`volunteer-${assignment.id}`}>
                                <TableCell>{assignment.eventTitle || `Event #${assignment.eventId}`}</TableCell>
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
                                <TableCell>{formatDate(new Date(assignment.createdAt))}</TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <Clock className="h-12 w-12 mx-auto mb-4 text-neutral-300" />
                    <h3 className="text-lg font-medium">No Volunteer Profile</h3>
                    <p className="text-neutral-500 mt-1">This user doesn't have a volunteer profile.</p>
                  </div>
                )}
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