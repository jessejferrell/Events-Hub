import { useState } from "react";
import { useSettings } from "@/hooks/use-settings";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Plus, Save, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Switch } from "@/components/ui/switch";
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

// Define the categories we'll use
const SETTING_CATEGORIES = [
  "appearance",
  "eventDefaults",
  "email",
  "payment",
  "content",
  "userManagement",
  "analytics",
  "integration"
];

// Define human-readable names for the categories
const CATEGORY_NAMES: Record<string, string> = {
  appearance: "Appearance",
  eventDefaults: "Event Defaults",
  email: "Email & Notifications",
  payment: "Payment Options",
  content: "Content Management",
  userManagement: "User Management",
  analytics: "Analytics & Reporting",
  integration: "External Integrations"
};

// Helper function to get proper setting display name
const getSettingDisplayName = (key: string): string => {
  return key
    .replace(/([A-Z])/g, ' $1') // Add space before capital letters
    .replace(/^./, str => str.toUpperCase()) // Capitalize first letter
    .replace(/\./g, ' → '); // Replace dots with arrows for hierarchical settings
};

// Helper to determine if a setting value is a boolean
const isBooleanValue = (value: any): boolean => {
  return typeof value === 'boolean';
};

// Helper to determine if a setting value is a complex object (for JSON editor)
const isComplexObject = (value: any): boolean => {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
};

export default function SystemSettingsPage() {
  const { toast } = useToast();
  const [activeCategory, setActiveCategory] = useState<string>("");
  const [newSettingKey, setNewSettingKey] = useState<string>("");
  const [newSettingValue, setNewSettingValue] = useState<string>("");
  
  const { 
    settings = [], 
    isLoading, 
    updateSetting, 
    deleteSetting, 
    isUpdating,
    isDeleting
  } = useSettings(activeCategory === "" ? undefined : activeCategory);
  
  const handleUpdateSetting = (key: string, value: any) => {
    updateSetting({ key, value, category: activeCategory });
  };
  
  const handleAddNewSetting = () => {
    if (!newSettingKey.trim()) {
      toast({
        title: "Error",
        description: "Setting key cannot be empty",
        variant: "destructive",
      });
      return;
    }
    
    let parsedValue: any = newSettingValue;
    
    // Try to parse as JSON if it looks like an object
    if (newSettingValue.trim().startsWith('{') && newSettingValue.trim().endsWith('}')) {
      try {
        parsedValue = JSON.parse(newSettingValue);
      } catch (e) {
        toast({
          title: "Invalid JSON",
          description: "The value you entered is not valid JSON",
          variant: "destructive",
        });
        return;
      }
    }
    
    updateSetting({
      key: newSettingKey,
      value: parsedValue,
      category: activeCategory
    });
    
    // Reset form
    setNewSettingKey("");
    setNewSettingValue("");
  };
  
  // Render different input types based on the setting value
  const renderSettingInput = (setting: any) => {
    const { key, value } = setting;
    
    if (isBooleanValue(value)) {
      return (
        <div className="flex items-center space-x-2">
          <Switch 
            id={key} 
            checked={value}
            onCheckedChange={(checked) => handleUpdateSetting(key, checked)}
          />
          <Label htmlFor={key}>Enabled</Label>
        </div>
      );
    }
    
    if (isComplexObject(value)) {
      return (
        <Textarea
          className="font-mono text-sm"
          rows={5}
          value={JSON.stringify(value, null, 2)}
          onChange={(e) => {
            try {
              const parsed = JSON.parse(e.target.value);
              handleUpdateSetting(key, parsed);
            } catch (error) {
              // Don't update if JSON is invalid
              console.error("Invalid JSON:", error);
            }
          }}
        />
      );
    }
    
    // Default to text input
    return (
      <Input
        value={value?.toString() || ""}
        onChange={(e) => handleUpdateSetting(key, e.target.value)}
      />
    );
  };
  
  // Render template settings for event defaults
  const renderEventDefaultSettings = () => {
    if (activeCategory !== "eventDefaults") return null;
    
    return (
      <div className="mt-8">
        <h3 className="text-lg font-semibold mb-4">Default Product Templates</h3>
        <p className="text-sm text-gray-500 mb-6">
          These product templates will be available when creating new events. They'll provide default options that can be customized for each event.
        </p>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Ticket Templates */}
          <Card>
            <CardHeader>
              <CardTitle>Ticket Templates</CardTitle>
              <CardDescription>Default ticket types for events</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="p-4 border rounded">
                  <h4 className="font-medium">General Admission</h4>
                  <div className="grid grid-cols-2 gap-4 mt-2">
                    <div>
                      <Label>Price</Label>
                      <Input defaultValue="25.00" />
                    </div>
                    <div>
                      <Label>Capacity</Label>
                      <Input defaultValue="100" />
                    </div>
                  </div>
                  <div className="flex justify-end mt-4">
                    <Button size="sm" variant="outline">Save Template</Button>
                  </div>
                </div>
                
                <div className="p-4 border rounded">
                  <h4 className="font-medium">VIP Access</h4>
                  <div className="grid grid-cols-2 gap-4 mt-2">
                    <div>
                      <Label>Price</Label>
                      <Input defaultValue="75.00" />
                    </div>
                    <div>
                      <Label>Capacity</Label>
                      <Input defaultValue="20" />
                    </div>
                  </div>
                  <div className="flex justify-end mt-4">
                    <Button size="sm" variant="outline">Save Template</Button>
                  </div>
                </div>
                
                <Button className="w-full" variant="outline" size="sm">
                  <Plus className="h-4 w-4 mr-2" />
                  Add Ticket Template
                </Button>
              </div>
            </CardContent>
          </Card>
          
          {/* Merchandise Templates */}
          <Card>
            <CardHeader>
              <CardTitle>Merchandise Templates</CardTitle>
              <CardDescription>Default merchandise for events</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="p-4 border rounded">
                  <h4 className="font-medium">Event T-Shirt</h4>
                  <div className="grid grid-cols-2 gap-4 mt-2">
                    <div>
                      <Label>Price</Label>
                      <Input defaultValue="20.00" />
                    </div>
                    <div>
                      <Label>Options</Label>
                      <Input defaultValue="Size, Color" />
                    </div>
                  </div>
                  <div className="flex justify-end mt-4">
                    <Button size="sm" variant="outline">Save Template</Button>
                  </div>
                </div>
                
                <Button className="w-full" variant="outline" size="sm">
                  <Plus className="h-4 w-4 mr-2" />
                  Add Merchandise Template
                </Button>
              </div>
            </CardContent>
          </Card>
          
          {/* Vendor Templates */}
          <Card>
            <CardHeader>
              <CardTitle>Vendor Templates</CardTitle>
              <CardDescription>Default vendor options for events</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="p-4 border rounded">
                  <h4 className="font-medium">Standard Booth</h4>
                  <div className="grid grid-cols-2 gap-4 mt-2">
                    <div>
                      <Label>Price</Label>
                      <Input defaultValue="150.00" />
                    </div>
                    <div>
                      <Label>Space</Label>
                      <Input defaultValue="10x10 ft" />
                    </div>
                  </div>
                  <div className="flex justify-end mt-4">
                    <Button size="sm" variant="outline">Save Template</Button>
                  </div>
                </div>
                
                <Button className="w-full" variant="outline" size="sm">
                  <Plus className="h-4 w-4 mr-2" />
                  Add Vendor Template
                </Button>
              </div>
            </CardContent>
          </Card>
          
          {/* Volunteer Templates */}
          <Card>
            <CardHeader>
              <CardTitle>Volunteer Templates</CardTitle>
              <CardDescription>Default volunteer roles for events</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="p-4 border rounded">
                  <h4 className="font-medium">General Helper</h4>
                  <div className="grid grid-cols-2 gap-4 mt-2">
                    <div>
                      <Label>Hours</Label>
                      <Input defaultValue="4" />
                    </div>
                    <div>
                      <Label>Required</Label>
                      <Input defaultValue="5" />
                    </div>
                  </div>
                  <div className="flex justify-end mt-4">
                    <Button size="sm" variant="outline">Save Template</Button>
                  </div>
                </div>
                
                <Button className="w-full" variant="outline" size="sm">
                  <Plus className="h-4 w-4 mr-2" />
                  Add Volunteer Template
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  };
  
  // Special payment settings form
  const renderPaymentSettings = () => {
    if (activeCategory !== "payment") return null;
    
    return (
      <div className="mt-8">
        <h3 className="text-lg font-semibold mb-4">Platform Payment Settings</h3>
        <p className="text-sm text-gray-500 mb-6">
          These settings control how your platform handles payments. Note that most Stripe-specific settings should be configured directly in your Stripe dashboard.
        </p>
        
        <Tabs defaultValue="api_keys" className="w-full mb-8">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="api_keys">API Keys</TabsTrigger>
            <TabsTrigger value="platform_fees">Platform Fees</TabsTrigger>
            <TabsTrigger value="payment_options">Payment Options</TabsTrigger>
          </TabsList>
          
          <TabsContent value="api_keys">
            <Card>
              <CardHeader>
                <CardTitle>API Keys</CardTitle>
                <CardDescription>Connect your platform to Stripe for payment processing</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="stripe-public-key">Stripe Public Key</Label>
                    <Input
                      id="stripe-public-key"
                      placeholder="pk_test_..."
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      Your publishable key from the Stripe dashboard
                    </p>
                  </div>
                  
                  <div>
                    <Label htmlFor="stripe-secret-key">Stripe Secret Key</Label>
                    <Input
                      id="stripe-secret-key"
                      type="password"
                      placeholder="sk_test_..."
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      Your secret key from the Stripe dashboard (never share this)
                    </p>
                  </div>
                  
                  <div>
                    <Label htmlFor="stripe-webhook-secret">Webhook Secret</Label>
                    <Input
                      id="stripe-webhook-secret"
                      type="password"
                      placeholder="whsec_..."
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      Used to verify webhook events from Stripe
                    </p>
                  </div>
                </div>
              </CardContent>
              <CardFooter className="flex justify-end">
                <Button>
                  <Save className="h-4 w-4 mr-2" />
                  Save API Keys
                </Button>
              </CardFooter>
            </Card>
          </TabsContent>
          
          <TabsContent value="platform_fees">
            <Card>
              <CardHeader>
                <CardTitle>Platform Fee Configuration</CardTitle>
                <CardDescription>Set up the fees your platform charges on transactions</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="platform-fee-percentage">Platform Fee Percentage</Label>
                    <div className="flex items-center">
                      <Input
                        id="platform-fee-percentage"
                        defaultValue="4.5"
                        className="w-32"
                      />
                      <span className="ml-2">%</span>
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">
                      Percentage fee added to all transactions (in addition to Stripe fees)
                    </p>
                  </div>
                  
                  <div>
                    <Label htmlFor="platform-fixed-fee">Fixed Fee Per Transaction</Label>
                    <div className="flex items-center">
                      <span className="mr-2">$</span>
                      <Input
                        id="platform-fixed-fee"
                        defaultValue="0.30"
                        className="w-32"
                      />
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">
                      Fixed fee added to all transactions (in addition to Stripe fees)
                    </p>
                  </div>
                </div>
              </CardContent>
              <CardFooter className="flex justify-end">
                <Button>
                  <Save className="h-4 w-4 mr-2" />
                  Save Fee Configuration
                </Button>
              </CardFooter>
            </Card>
          </TabsContent>
          
          <TabsContent value="payment_options">
            <Card>
              <CardHeader>
                <CardTitle>Payment Options</CardTitle>
                <CardDescription>Configure payment methods and checkout options</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-medium">Accept Credit Cards</h4>
                      <p className="text-sm text-muted-foreground">
                        Allow customers to pay with credit cards
                      </p>
                    </div>
                    <Switch defaultChecked id="accept-credit-cards" />
                  </div>
                  
                  <Separator />
                  
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-medium">Accept Apple Pay / Google Pay</h4>
                      <p className="text-sm text-muted-foreground">
                        Enable digital wallet payments
                      </p>
                    </div>
                    <Switch defaultChecked id="accept-digital-wallets" />
                  </div>
                  
                  <Separator />
                  
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-medium">Show Price Breakdown</h4>
                      <p className="text-sm text-muted-foreground">
                        Show itemized fees at checkout
                      </p>
                    </div>
                    <Switch defaultChecked id="show-price-breakdown" />
                  </div>
                </div>
              </CardContent>
              <CardFooter className="flex justify-end">
                <Button>
                  <Save className="h-4 w-4 mr-2" />
                  Save Payment Options
                </Button>
              </CardFooter>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    );
  };

  // Main settings dashboard similar to the screenshot
  const renderSettingsDashboard = () => {
    return (
      <div className="container mx-auto py-6">
        <div className="flex flex-col gap-4">
          <h1 className="text-3xl font-bold">System Settings</h1>
          <p className="text-gray-500">
            Configure system-wide settings and defaults for your event platform.
          </p>
          <Separator className="my-6" />
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {/* General System Settings Card */}
            <Card className="overflow-hidden">
              <CardContent className="p-0">
                <div className="p-6 flex flex-col h-full">
                  <div className="flex items-center mb-4">
                    <div className="bg-green-100 p-3 rounded-full mr-4">
                      <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-green-600">
                        <circle cx="12" cy="12" r="10"></circle>
                        <path d="M12 8v8"></path>
                        <path d="M8 12h8"></path>
                      </svg>
                    </div>
                    <div>
                      <h3 className="text-xl font-semibold">General System Settings</h3>
                      <p className="text-gray-500 text-sm mt-1">
                        Configure appearance, event defaults, email settings, payment options, user management, analytics, and more
                      </p>
                    </div>
                  </div>
                  <p className="text-gray-600 mb-6">
                    Configure system defaults, email settings, appearance, and other core settings.
                  </p>
                  <Button 
                    className="mt-auto"
                    onClick={() => setActiveCategory("appearance")}
                  >
                    Manage System Settings
                  </Button>
                </div>
              </CardContent>
            </Card>
            
            {/* Content Management Card */}
            <Card className="overflow-hidden">
              <CardContent className="p-0">
                <div className="p-6 flex flex-col h-full">
                  <div className="flex items-center mb-4">
                    <div className="bg-blue-100 p-3 rounded-full mr-4">
                      <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-blue-600">
                        <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"></path>
                        <polyline points="14 2 14 8 20 8"></polyline>
                      </svg>
                    </div>
                    <div>
                      <h3 className="text-xl font-semibold">Content Management</h3>
                      <p className="text-gray-500 text-sm mt-1">
                        Manage static content, pages, announcements, terms of service, privacy policy, and other site content
                      </p>
                    </div>
                  </div>
                  <p className="text-gray-600 mb-6">
                    Update website content, legal information, and manage custom pages.
                  </p>
                  <div className="mt-auto text-center bg-gray-100 py-2 rounded-md">
                    <span className="text-gray-500 text-sm">Coming Soon</span>
                  </div>
                </div>
              </CardContent>
            </Card>
            
            {/* Payment & Fees Configuration Card */}
            <Card className="overflow-hidden">
              <CardContent className="p-0">
                <div className="p-6 flex flex-col h-full">
                  <div className="flex items-center mb-4">
                    <div className="bg-purple-100 p-3 rounded-full mr-4">
                      <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-purple-600">
                        <rect x="2" y="5" width="20" height="14" rx="2"></rect>
                        <line x1="2" y1="10" x2="22" y2="10"></line>
                      </svg>
                    </div>
                    <div>
                      <h3 className="text-xl font-semibold">Payment & Fees Configuration</h3>
                      <p className="text-gray-500 text-sm mt-1">
                        Configure payment gateways, processing fees, platform fees, and payout schedules for event organizers
                      </p>
                    </div>
                  </div>
                  <p className="text-gray-600 mb-6">
                    Set up payment processors, fee structures, and manage financial settings.
                  </p>
                  <Button 
                    className="mt-auto"
                    onClick={() => setActiveCategory("payment")}
                  >
                    Manage Payment Settings
                  </Button>
                </div>
              </CardContent>
            </Card>
            
            {/* Permissions & Access Control Card */}
            <Card className="overflow-hidden">
              <CardContent className="p-0">
                <div className="p-6 flex flex-col h-full">
                  <div className="flex items-center mb-4">
                    <div className="bg-amber-100 p-3 rounded-full mr-4">
                      <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-amber-600">
                        <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                        <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
                      </svg>
                    </div>
                    <div>
                      <h3 className="text-xl font-semibold">Permissions & Access Control</h3>
                      <p className="text-gray-500 text-sm mt-1">
                        Manage user roles, permissions, access controls, and administrative privileges
                      </p>
                    </div>
                  </div>
                  <p className="text-gray-600 mb-6">
                    Control who can access what features and data within the platform.
                  </p>
                  <Button 
                    className="mt-auto"
                    onClick={() => setActiveCategory("userManagement")}
                  >
                    Manage Permissions
                  </Button>
                </div>
              </CardContent>
            </Card>
            
            {/* System Integration Card */}
            <Card className="overflow-hidden">
              <CardContent className="p-0">
                <div className="p-6 flex flex-col h-full">
                  <div className="flex items-center mb-4">
                    <div className="bg-cyan-100 p-3 rounded-full mr-4">
                      <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-cyan-600">
                        <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path>
                        <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path>
                      </svg>
                    </div>
                    <div>
                      <h3 className="text-xl font-semibold">System Integrations</h3>
                      <p className="text-gray-500 text-sm mt-1">
                        Connect with external services like email platforms, marketing tools, and analytics
                      </p>
                    </div>
                  </div>
                  <p className="text-gray-600 mb-6">
                    Integrate with third-party services and extend platform functionality.
                  </p>
                  <Button 
                    className="mt-auto"
                    onClick={() => setActiveCategory("integration")}
                  >
                    Manage Integrations
                  </Button>
                </div>
              </CardContent>
            </Card>
            
            {/* Analytics & Reporting Card */}
            <Card className="overflow-hidden">
              <CardContent className="p-0">
                <div className="p-6 flex flex-col h-full">
                  <div className="flex items-center mb-4">
                    <div className="bg-rose-100 p-3 rounded-full mr-4">
                      <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-rose-600">
                        <line x1="18" y1="20" x2="18" y2="10"></line>
                        <line x1="12" y1="20" x2="12" y2="4"></line>
                        <line x1="6" y1="20" x2="6" y2="14"></line>
                      </svg>
                    </div>
                    <div>
                      <h3 className="text-xl font-semibold">Analytics & Reporting</h3>
                      <p className="text-gray-500 text-sm mt-1">
                        Configure analytics tracking, custom reports, and data exports
                      </p>
                    </div>
                  </div>
                  <p className="text-gray-600 mb-6">
                    Set up how data is tracked, analyzed, and reported across the platform.
                  </p>
                  <Button 
                    className="mt-auto"
                    onClick={() => setActiveCategory("analytics")}
                  >
                    Manage Analytics
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    );
  };

  // Settings detail view with tabs
  const renderSettingsDetailView = () => {
    return (
      <div className="container mx-auto py-6">
        <div className="flex flex-col gap-4">
          <div className="flex justify-between items-center">
            <h1 className="text-3xl font-bold">System Settings</h1>
            <Button 
              variant="outline" 
              onClick={() => setActiveCategory("")}
            >
              Back to Dashboard
            </Button>
          </div>
          <p className="text-gray-500">
            Configure system-wide settings and defaults for your event platform.
          </p>
          <Separator className="my-2" />
          
          <Tabs value={activeCategory} onValueChange={setActiveCategory} className="w-full">
            <TabsList className="mb-8 flex flex-wrap h-auto p-1">
              {SETTING_CATEGORIES.map((category) => (
                <TabsTrigger 
                  key={category} 
                  value={category}
                  className="flex-grow"
                >
                  {CATEGORY_NAMES[category]}
                </TabsTrigger>
              ))}
            </TabsList>
            
            {SETTING_CATEGORIES.map((category) => (
              <TabsContent key={category} value={category} className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle>{CATEGORY_NAMES[category]} Settings</CardTitle>
                    <CardDescription>
                      Configure {CATEGORY_NAMES[category].toLowerCase()} settings for your event platform
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {isLoading ? (
                      <div className="flex items-center justify-center py-10">
                        <Loader2 className="h-8 w-8 animate-spin text-primary" />
                      </div>
                    ) : settings.length === 0 ? (
                      <div className="text-center py-10">
                        <p className="text-gray-500">No settings found for this category</p>
                      </div>
                    ) : (
                      <div className="space-y-6">
                        {settings.map((setting) => (
                          <div key={setting.key} className="grid gap-2">
                            <div className="flex justify-between items-start">
                              <Label htmlFor={setting.key} className="text-base font-medium">
                                {getSettingDisplayName(setting.key)}
                              </Label>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => deleteSetting(setting.key)}
                                disabled={isDeleting}
                              >
                                <Trash2 className="h-4 w-4 text-red-500" />
                                <span className="sr-only">Delete</span>
                              </Button>
                            </div>
                            {renderSettingInput(setting)}
                          </div>
                        ))}
                      </div>
                    )}
                    
                    <Separator className="my-6" />
                    
                    <div className="space-y-4">
                      <h3 className="text-lg font-medium">Add New Setting</h3>
                      <div className="grid gap-4">
                        <div className="grid grid-cols-1 gap-2">
                          <Label htmlFor="newSettingKey">Setting Key</Label>
                          <Input
                            id="newSettingKey"
                            placeholder="E.g. siteName"
                            value={newSettingKey}
                            onChange={(e) => setNewSettingKey(e.target.value)}
                          />
                        </div>
                        <div className="grid grid-cols-1 gap-2">
                          <Label htmlFor="newSettingValue">Value</Label>
                          <Input
                            id="newSettingValue"
                            placeholder="E.g. My Event Platform"
                            value={newSettingValue}
                            onChange={(e) => setNewSettingValue(e.target.value)}
                          />
                        </div>
                        <Button 
                          onClick={handleAddNewSetting}
                          disabled={isUpdating || !newSettingKey.trim()}
                        >
                          {isUpdating ? (
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          ) : (
                            <Plus className="h-4 w-4 mr-2" />
                          )}
                          Add Setting
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
                
                {/* Render special settings interfaces for specific categories */}
                {renderEventDefaultSettings()}
                {renderPaymentSettings()}
                
              </TabsContent>
            ))}
          </Tabs>
        </div>
      </div>
    );
  };

  return activeCategory === "" ? renderSettingsDashboard() : renderSettingsDetailView();
}