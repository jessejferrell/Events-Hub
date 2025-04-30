import { useState, useEffect } from 'react';
import { useSiteSettings, type ColorSettings, type OrgSettings } from '@/hooks/use-site-settings';
import { useAuth } from '@/hooks/use-auth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, AlertTriangle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

// Default colors
const DEFAULT_COLORS = {
  primary: '#00a99d',   // Teal
  secondary: '#8a4fff', // Purple
  accent: '#f0e6ff',    // Light purple
};

export default function SimpleSiteSettingsManager() {
  const { user } = useAuth();
  const isSuperAdmin = user?.role === 'super_admin' || user?.role === 'admin';
  const { settings, getSetting, updateSetting, isLoading, ColorSettingsSchema, OrgSettingsSchema } = useSiteSettings();
  
  // Organization details form state
  const [orgSettings, setOrgSettings] = useState<OrgSettings>({
    name: '',
    logo: '',
    contactEmail: '',
    contactPhone: '',
    address: '',
  });
  
  // Color settings state
  const [colorSettings, setColorSettings] = useState<ColorSettings>(DEFAULT_COLORS);
  
  // Load settings only once when component mounts or settings change
  useEffect(() => {
    if (!isLoading && settings) {
      // Load organization settings
      const savedOrgSettings = getSetting('orgSettings');
      if (savedOrgSettings) {
        setOrgSettings(savedOrgSettings);
      }
      
      // Load color settings
      const savedColorSettings = getSetting('colors');
      if (savedColorSettings) {
        setColorSettings({
          primary: savedColorSettings.primary || DEFAULT_COLORS.primary,
          secondary: savedColorSettings.secondary || DEFAULT_COLORS.secondary,
          accent: savedColorSettings.accent || DEFAULT_COLORS.accent,
        });
      }
    }
  }, [isLoading, settings, getSetting]);
  
  // Handle save organization settings
  const handleSaveOrgSettings = () => {
    try {
      updateSetting('orgSettings', orgSettings, OrgSettingsSchema);
    } catch (error) {
      console.error('Error saving organization settings:', error);
    }
  };
  
  // Handle save color settings
  const handleSaveColorSettings = () => {
    try {
      updateSetting('colors', colorSettings, ColorSettingsSchema);
    } catch (error) {
      console.error('Error saving color settings:', error);
    }
  };
  
  // Access check
  if (!isSuperAdmin) {
    return (
      <Alert variant="destructive" className="mb-4">
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription>
          You don't have permission to access site settings. This section is restricted to administrators.
        </AlertDescription>
      </Alert>
    );
  }
  
  // Loading state
  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }
  
  return (
    <div className="space-y-6">
      <p className="text-sm text-muted-foreground">
        These settings control the branding and appearance of the entire site. Changes will affect all users.
        <Badge variant="secondary" className="ml-2">Admin Access</Badge>
      </p>
      
      <Tabs defaultValue="organization" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="organization">Organization Info</TabsTrigger>
          <TabsTrigger value="appearance">Colors & Appearance</TabsTrigger>
        </TabsList>
        
        {/* Organization Info Tab */}
        <TabsContent value="organization">
          <Card>
            <CardHeader>
              <CardTitle>Organization Details</CardTitle>
              <CardDescription>Update your organization's basic information</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="orgName">Organization Name</Label>
                <Input 
                  id="orgName" 
                  placeholder="Enter organization name" 
                  value={orgSettings.name} 
                  onChange={(e) => setOrgSettings(prev => ({...prev, name: e.target.value}))}
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="orgLogo">Logo URL</Label>
                <Input 
                  id="orgLogo" 
                  placeholder="https://example.com/logo.png" 
                  value={orgSettings.logo || ''} 
                  onChange={(e) => setOrgSettings(prev => ({...prev, logo: e.target.value}))}
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="orgEmail">Contact Email</Label>
                <Input 
                  id="orgEmail" 
                  type="email"
                  placeholder="contact@example.org" 
                  value={orgSettings.contactEmail || ''} 
                  onChange={(e) => setOrgSettings(prev => ({...prev, contactEmail: e.target.value}))}
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="orgPhone">Contact Phone</Label>
                <Input 
                  id="orgPhone" 
                  placeholder="(555) 123-4567" 
                  value={orgSettings.contactPhone || ''} 
                  onChange={(e) => setOrgSettings(prev => ({...prev, contactPhone: e.target.value}))}
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="orgAddress">Address</Label>
                <Input 
                  id="orgAddress" 
                  placeholder="123 Main St, City, State, Zip" 
                  value={orgSettings.address || ''} 
                  onChange={(e) => setOrgSettings(prev => ({...prev, address: e.target.value}))}
                />
              </div>
              
              <Button onClick={handleSaveOrgSettings} className="mt-4">
                Save Organization Info
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
        
        {/* Appearance Tab */}
        <TabsContent value="appearance">
          <Card>
            <CardHeader>
              <CardTitle>Site Colors</CardTitle>
              <CardDescription>Customize the visual appearance of your site</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Primary Color */}
                <div className="space-y-2">
                  <Label htmlFor="primaryColor">Primary Color</Label>
                  <div className="flex gap-2 items-center">
                    <input
                      type="color"
                      id="primaryColor"
                      value={colorSettings.primary}
                      onChange={(e) => setColorSettings(prev => ({...prev, primary: e.target.value}))}
                      className="h-10 w-10 rounded cursor-pointer"
                    />
                    <Input
                      value={colorSettings.primary}
                      onChange={(e) => {
                        const color = e.target.value.startsWith('#') ? e.target.value : `#${e.target.value}`;
                        setColorSettings(prev => ({...prev, primary: color}));
                      }}
                      className="w-28"
                    />
                    <div 
                      className="h-10 w-10 rounded-md border"
                      style={{ backgroundColor: colorSettings.primary }}
                    />
                  </div>
                </div>
                
                {/* Secondary Color */}
                <div className="space-y-2">
                  <Label htmlFor="secondaryColor">Secondary Color</Label>
                  <div className="flex gap-2 items-center">
                    <input
                      type="color"
                      id="secondaryColor"
                      value={colorSettings.secondary}
                      onChange={(e) => setColorSettings(prev => ({...prev, secondary: e.target.value}))}
                      className="h-10 w-10 rounded cursor-pointer"
                    />
                    <Input
                      value={colorSettings.secondary}
                      onChange={(e) => {
                        const color = e.target.value.startsWith('#') ? e.target.value : `#${e.target.value}`;
                        setColorSettings(prev => ({...prev, secondary: color}));
                      }}
                      className="w-28"
                    />
                    <div 
                      className="h-10 w-10 rounded-md border"
                      style={{ backgroundColor: colorSettings.secondary }}
                    />
                  </div>
                </div>
                
                {/* Accent Color */}
                <div className="space-y-2">
                  <Label htmlFor="accentColor">Accent Color</Label>
                  <div className="flex gap-2 items-center">
                    <input
                      type="color"
                      id="accentColor"
                      value={colorSettings.accent}
                      onChange={(e) => setColorSettings(prev => ({...prev, accent: e.target.value}))}
                      className="h-10 w-10 rounded cursor-pointer"
                    />
                    <Input
                      value={colorSettings.accent}
                      onChange={(e) => {
                        const color = e.target.value.startsWith('#') ? e.target.value : `#${e.target.value}`;
                        setColorSettings(prev => ({...prev, accent: color}));
                      }}
                      className="w-28"
                    />
                    <div 
                      className="h-10 w-10 rounded-md border"
                      style={{ backgroundColor: colorSettings.accent }}
                    />
                  </div>
                </div>
              </div>
              
              <Button onClick={handleSaveColorSettings} className="mt-6">
                Save Color Settings
              </Button>
              
              <div className="mt-8">
                <h3 className="text-lg font-medium mb-4">Preview</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="p-4 rounded-md border flex items-center justify-center" 
                      style={{ backgroundColor: colorSettings.primary, height: '60px' }}>
                    <p className="text-center font-medium text-white">Primary</p>
                  </div>
                  <div className="p-4 rounded-md border flex items-center justify-center" 
                      style={{ backgroundColor: colorSettings.secondary, height: '60px' }}>
                    <p className="text-center font-medium text-white">Secondary</p>
                  </div>
                  <div className="p-4 rounded-md border flex items-center justify-center" 
                      style={{ backgroundColor: colorSettings.accent, height: '60px' }}>
                    <p className="text-center font-medium text-slate-900">Accent</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}