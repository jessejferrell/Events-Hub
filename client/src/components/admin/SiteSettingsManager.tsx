import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useSiteSettings } from "@/hooks/use-site-settings";
import { useToast } from "@/hooks/use-toast";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertCircle, Save, Upload, Palette } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { SketchPicker } from 'react-color';
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

const DEFAULT_COLORS = {
  primary: "#0EA5E9", // Teal
  secondary: "#7E22CE", // Purple
  accent: "#F59E0B", // Orange
};

export default function SiteSettingsManager() {
  const { user } = useAuth();
  const { toast } = useToast();
  const { settings, getSetting, updateSetting, isUpdating, isLoading } = useSiteSettings();
  
  const [orgName, setOrgName] = useState<string>("");
  const [orgLogo, setOrgLogo] = useState<string>("");
  const [colors, setColors] = useState(DEFAULT_COLORS);
  const [activeColor, setActiveColor] = useState<string | null>(null);
  
  // Check if user is authorized (super admin)
  const isAuthorized = user?.email === "jessejferrell@gmail.com";
  
  useEffect(() => {
    if (!isLoading && settings) {
      // Load organization name
      const savedOrgName = getSetting("orgName");
      if (savedOrgName) setOrgName(savedOrgName);
      
      // Load organization logo
      const savedOrgLogo = getSetting("orgLogo");
      if (savedOrgLogo) setOrgLogo(savedOrgLogo);
      
      // Load colors
      const savedColors = getSetting("colors");
      if (savedColors) setColors({...DEFAULT_COLORS, ...savedColors});
    }
  }, [isLoading, settings, getSetting]);
  
  const handleSaveSettings = () => {
    // Save org name
    updateSetting({ key: "orgName", value: orgName });
    
    // Save org logo
    if (orgLogo) {
      updateSetting({ key: "orgLogo", value: orgLogo });
    }
    
    // Save colors
    updateSetting({ key: "colors", value: colors });
    
    toast({
      title: "Settings saved",
      description: "Your site settings have been updated.",
    });
  };
  
  const handleColorChange = (color: any) => {
    if (!activeColor) return;
    
    setColors({
      ...colors,
      [activeColor]: color.hex
    });
  };
  
  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    // Create form data
    const formData = new FormData();
    formData.append("image", file);
    
    try {
      // Upload the image
      const response = await fetch("/api/upload", {
        method: "POST",
        body: formData,
        credentials: "include",
      });
      
      if (!response.ok) {
        throw new Error("Failed to upload logo");
      }
      
      const data = await response.json();
      setOrgLogo(data.imageUrl);
      
      toast({
        title: "Logo uploaded",
        description: "Your logo has been uploaded successfully.",
      });
    } catch (error: any) {
      toast({
        title: "Upload failed",
        description: error.message,
        variant: "destructive",
      });
    }
  };
  
  if (!isAuthorized) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>Unauthorized Access</AlertTitle>
        <AlertDescription>
          Only super admin (jessejferrell@gmail.com) can manage site settings.
        </AlertDescription>
      </Alert>
    );
  }
  
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-bold mb-2">Site Settings</h2>
          <p className="text-muted-foreground">
            Customize your organization's branding and appearance
          </p>
        </div>
        <Button 
          onClick={handleSaveSettings} 
          disabled={isUpdating}
          className="flex items-center"
        >
          <Save className="mr-2 h-4 w-4" />
          Save Changes
        </Button>
      </div>
      
      <Tabs defaultValue="branding" className="w-full">
        <TabsList>
          <TabsTrigger value="branding">Branding</TabsTrigger>
          <TabsTrigger value="colors">Colors</TabsTrigger>
          <TabsTrigger value="display">Display Options</TabsTrigger>
        </TabsList>
        
        <TabsContent value="branding" className="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Organization Information</CardTitle>
              <CardDescription>
                Set your organization name and logo that will appear throughout the site
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="orgName">Organization Name</Label>
                <Input
                  id="orgName"
                  value={orgName}
                  onChange={(e) => setOrgName(e.target.value)}
                  placeholder="e.g. Moss Point Main Street"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="orgLogo">Organization Logo</Label>
                <div className="flex flex-col space-y-2">
                  {orgLogo && (
                    <div className="border rounded p-4 mb-2">
                      <img 
                        src={orgLogo} 
                        alt="Organization Logo" 
                        className="max-h-32 mx-auto"
                      />
                    </div>
                  )}
                  <div className="flex items-center">
                    <Button 
                      variant="outline" 
                      className="flex items-center"
                      onClick={() => document.getElementById("logoUpload")?.click()}
                    >
                      <Upload className="mr-2 h-4 w-4" />
                      Upload Logo
                    </Button>
                    <input
                      id="logoUpload"
                      type="file"
                      accept="image/*"
                      onChange={handleLogoUpload}
                      className="hidden"
                    />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="colors" className="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Color Scheme</CardTitle>
              <CardDescription>
                Customize your site's color palette to match your brand
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {Object.entries(colors).map(([key, value]) => (
                  <div key={key} className="space-y-2">
                    <Label className="capitalize">{key} Color</Label>
                    <div className="flex items-center space-x-2">
                      <Popover open={activeColor === key} onOpenChange={(open) => setActiveColor(open ? key : null)}>
                        <PopoverTrigger asChild>
                          <Button 
                            variant="outline" 
                            className="w-full justify-start"
                            style={{ borderLeftWidth: '8px', borderLeftColor: value }}
                          >
                            <Palette className="mr-2 h-4 w-4" />
                            <span className="capitalize">{key}</span>
                            <div className="ml-auto">{value}</div>
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <SketchPicker
                            color={value}
                            onChange={handleColorChange}
                          />
                        </PopoverContent>
                      </Popover>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
            <CardFooter>
              <Alert className="bg-secondary/10 text-secondary border-secondary/50">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Color Application</AlertTitle>
                <AlertDescription>
                  Changes to colors will be applied site-wide. Primary is used for buttons and highlights, 
                  Secondary for accents, and Accent for special elements.
                </AlertDescription>
              </Alert>
            </CardFooter>
          </Card>
        </TabsContent>
        
        <TabsContent value="display" className="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Display Options</CardTitle>
              <CardDescription>
                Configure how different elements appear on your site
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-center text-muted-foreground py-8">
                Additional display options will be added in future updates.
              </p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}