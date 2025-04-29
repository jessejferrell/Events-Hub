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
  const [activeCategory, setActiveCategory] = useState<string>(SETTING_CATEGORIES[0]);
  const [newSettingKey, setNewSettingKey] = useState<string>("");
  const [newSettingValue, setNewSettingValue] = useState<string>("");
  
  const { 
    settings, 
    isLoading, 
    updateSetting, 
    deleteSetting, 
    isUpdating,
    isDeleting
  } = useSettings(activeCategory);
  
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
        <h3 className="text-lg font-semibold mb-4">Stripe Integration</h3>
        <Card>
          <CardContent className="pt-6">
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="stripeMode">Mode</Label>
                  <Select defaultValue="test">
                    <SelectTrigger>
                      <SelectValue placeholder="Select mode" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="test">Test</SelectItem>
                      <SelectItem value="live">Live</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <div>
                  <Label htmlFor="stripe-account-type">Account Type</Label>
                  <Select defaultValue="standard">
                    <SelectTrigger>
                      <SelectValue placeholder="Select account type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="standard">Standard</SelectItem>
                      <SelectItem value="connect">Connect (Multi-party)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              
              <div>
                <Label htmlFor="stripe-public-key">Stripe Public Key</Label>
                <Input
                  id="stripe-public-key"
                  placeholder="pk_test_..."
                />
              </div>
              
              <div>
                <Label htmlFor="stripe-secret-key">Stripe Secret Key</Label>
                <Input
                  id="stripe-secret-key"
                  type="password"
                  placeholder="sk_test_..."
                />
              </div>
              
              <div>
                <Label htmlFor="stripe-webhook-secret">Webhook Secret</Label>
                <Input
                  id="stripe-webhook-secret"
                  type="password"
                  placeholder="whsec_..."
                />
              </div>
              
              <div className="pt-2">
                <Button>
                  <Save className="h-4 w-4 mr-2" />
                  Save Stripe Configuration
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  };

  return (
    <div className="container mx-auto py-6">
      <div className="flex flex-col gap-4">
        <h1 className="text-3xl font-bold">System Settings</h1>
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
}