import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { Eye, EyeOff, User, CalendarCheck, Building } from "lucide-react";

// Login form schema
const loginSchema = z.object({
  email: z.string().email("Please enter a valid email"),
  password: z.string().min(1, "Password is required"),
  rememberMe: z.boolean().optional(),
});

// Registration form schema
const registerSchema = z.object({
  username: z.string().min(3, "Username must be at least 3 characters"),
  email: z.string().email("Please enter a valid email"),
  name: z.string().min(2, "Full name is required"),
  phoneNumber: z.string().min(10, "Valid phone number is required"),
  address: z.string().min(3, "Street address is required"),
  city: z.string().min(2, "City is required"),
  state: z.string().min(2, "State is required"),
  zipCode: z.string().min(5, "Valid zip code is required"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  confirmPassword: z.string().min(1, "Please confirm your password"),
}).refine(data => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});

type LoginFormValues = z.infer<typeof loginSchema>;
type RegisterFormValues = z.infer<typeof registerSchema>;

export default function AuthPage() {
  const [activeTab, setActiveTab] = useState<string>("login");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const { user, loginMutation, registerMutation } = useAuth();
  const [location, navigate] = useLocation();

  // Redirect if already logged in
  useEffect(() => {
    if (user) {
      navigate("/");
    }
  }, [user, navigate]);

  // Login form
  const loginForm = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: "",
      password: "",
      rememberMe: false,
    },
  });

  // Registration form
  const registerForm = useForm<RegisterFormValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      username: "",
      email: "",
      name: "",
      phoneNumber: "",
      address: "",
      city: "",
      state: "",
      zipCode: "",
      password: "",
      confirmPassword: "",
    },
  });

  // Handle login submission
  function onLoginSubmit(data: LoginFormValues) {
    loginMutation.mutate({
      email: data.email,
      password: data.password,
    });
  }

  // Handle registration submission
  function onRegisterSubmit(data: RegisterFormValues) {
    registerMutation.mutate(data);
  }

  // Toggle password visibility
  function togglePasswordVisibility() {
    setShowPassword(!showPassword);
  }

  // Toggle confirm password visibility
  function toggleConfirmPasswordVisibility() {
    setShowConfirmPassword(!showConfirmPassword);
  }

  // Handle forgot password
  function handleForgotPassword() {
    // In a real implementation, this would navigate to a password reset page
    console.log("Forgot password clicked");
  }
  
  return (
    <div className="flex min-h-screen w-full bg-gradient-to-br from-background to-muted">
      {/* Left Side: Auth Form */}
      <div className="w-full md:w-1/2 p-6 flex flex-col justify-center items-center">
        <div className="w-full max-w-md">
          {/* Logo */}
          <div className="flex justify-center mb-8">
            <div className="bg-white rounded-full p-3 shadow-md">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-10 w-10 text-primary">
                <path d="M11 17a1 1 0 1 0 2 0c0-.5-.34-1-1-1-.5 0-1 .63-1 1Z"></path>
                <path d="M12 10v4"></path>
                <path d="M2 8c0-2.2.9-4.1 2.3-5.5C5.7 1.1 7.8 0 10 0h4c2.2 0 4.3 1.1 5.7 2.5C21.1 3.9 22 5.8 22 8v6c0 5-4 8-10 8h0c-6 0-10-3-10-8V8Z"></path>
              </svg>
            </div>
          </div>
          
          <Tabs defaultValue={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-2 mb-6 bg-white/50">
              <TabsTrigger value="login" className="data-[state=active]:bg-primary data-[state=active]:text-white">
                Login
              </TabsTrigger>
              <TabsTrigger value="register" className="data-[state=active]:bg-primary data-[state=active]:text-white">
                Sign Up
              </TabsTrigger>
            </TabsList>
            
            {/* Login Form */}
            <TabsContent value="login">
              <div className="border border-border rounded-xl p-8 bg-white shadow-md">
                <h1 className="text-2xl font-bold mb-1 text-foreground">Login to City Event Hub</h1>
                <p className="text-muted-foreground mb-6 text-sm">Enter your credentials to access your account</p>
                
                <Form {...loginForm}>
                  <form onSubmit={loginForm.handleSubmit(onLoginSubmit)} className="space-y-4">
                    <FormField
                      control={loginForm.control}
                      name="email"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Email</FormLabel>
                          <FormControl>
                            <Input placeholder="you@example.com" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={loginForm.control}
                      name="password"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Password</FormLabel>
                          <div className="relative">
                            <FormControl>
                              <Input 
                                type={showPassword ? "text" : "password"} 
                                placeholder="********" 
                                {...field} 
                              />
                            </FormControl>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                              onClick={togglePasswordVisibility}
                            >
                              {showPassword ? (
                                <EyeOff className="h-4 w-4 text-gray-400" />
                              ) : (
                                <Eye className="h-4 w-4 text-gray-400" />
                              )}
                            </Button>
                          </div>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <div className="flex justify-between items-center">
                      <FormField
                        control={loginForm.control}
                        name="rememberMe"
                        render={({ field }) => (
                          <FormItem className="flex flex-row items-center space-x-2 space-y-0">
                            <FormControl>
                              <Checkbox
                                checked={field.value}
                                onCheckedChange={field.onChange}
                              />
                            </FormControl>
                            <FormLabel className="text-sm font-normal">Remember me</FormLabel>
                          </FormItem>
                        )}
                      />
                      
                      <Button
                        type="button"
                        variant="link"
                        size="sm"
                        className="p-0 h-auto font-normal text-sm text-secondary"
                        onClick={handleForgotPassword}
                      >
                        Forgot password?
                      </Button>
                    </div>
                    
                    <Button 
                      type="submit" 
                      className="w-full bg-primary hover:bg-primary/90 text-white"
                      disabled={loginMutation.isPending}
                    >
                      {loginMutation.isPending ? "Logging in..." : "Log in"}
                    </Button>
                    
                    <div className="text-center text-sm">
                      <span className="text-neutral-600">Don't have an account?</span>
                      <Button
                        type="button"
                        variant="link"
                        size="sm"
                        className="p-0 h-auto font-normal text-secondary ml-1"
                        onClick={() => setActiveTab("register")}
                      >
                        Sign up now
                      </Button>
                    </div>
                  </form>
                </Form>
              </div>
            </TabsContent>
            
            {/* Registration Form */}
            <TabsContent value="register">
              <div className="border border-border rounded-xl p-8 bg-white shadow-md">
                <h1 className="text-2xl font-bold mb-1 text-foreground">Create an Account</h1>
                <p className="text-muted-foreground mb-6 text-sm">Join City Event Hub to discover and attend local events</p>
                
                <Form {...registerForm}>
                  <form onSubmit={registerForm.handleSubmit(onRegisterSubmit)} className="space-y-4">
                    <FormField
                      control={registerForm.control}
                      name="username"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Username</FormLabel>
                          <FormControl>
                            <Input placeholder="johndoe" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={registerForm.control}
                      name="email"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Email</FormLabel>
                          <FormControl>
                            <Input placeholder="you@example.com" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={registerForm.control}
                      name="name"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Full Name</FormLabel>
                          <FormControl>
                            <Input placeholder="John Doe" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={registerForm.control}
                      name="phoneNumber"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Phone Number</FormLabel>
                          <FormControl>
                            <Input placeholder="(123) 456-7890" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={registerForm.control}
                      name="address"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Street Address</FormLabel>
                          <FormControl>
                            <Input placeholder="123 Main St" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <FormField
                        control={registerForm.control}
                        name="city"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>City</FormLabel>
                            <FormControl>
                              <Input placeholder="Anytown" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      
                      <FormField
                        control={registerForm.control}
                        name="state"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>State</FormLabel>
                            <FormControl>
                              <Input placeholder="State" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      
                      <FormField
                        control={registerForm.control}
                        name="zipCode"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Zip Code</FormLabel>
                            <FormControl>
                              <Input placeholder="12345" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                    
                    <FormField
                      control={registerForm.control}
                      name="password"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Password</FormLabel>
                          <div className="relative">
                            <FormControl>
                              <Input 
                                type={showPassword ? "text" : "password"} 
                                placeholder="********" 
                                {...field} 
                              />
                            </FormControl>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                              onClick={togglePasswordVisibility}
                            >
                              {showPassword ? (
                                <EyeOff className="h-4 w-4 text-gray-400" />
                              ) : (
                                <Eye className="h-4 w-4 text-gray-400" />
                              )}
                            </Button>
                          </div>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={registerForm.control}
                      name="confirmPassword"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Confirm Password</FormLabel>
                          <div className="relative">
                            <FormControl>
                              <Input 
                                type={showConfirmPassword ? "text" : "password"} 
                                placeholder="********" 
                                {...field} 
                              />
                            </FormControl>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                              onClick={toggleConfirmPasswordVisibility}
                            >
                              {showConfirmPassword ? (
                                <EyeOff className="h-4 w-4 text-gray-400" />
                              ) : (
                                <Eye className="h-4 w-4 text-gray-400" />
                              )}
                            </Button>
                          </div>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <Button 
                      type="submit" 
                      className="w-full bg-primary hover:bg-primary/90 text-white"
                      disabled={registerMutation.isPending}
                    >
                      {registerMutation.isPending ? "Creating account..." : "Create Account"}
                    </Button>
                    
                    <div className="text-center text-sm">
                      <span className="text-neutral-600">Already have an account?</span>
                      <Button
                        type="button"
                        variant="link"
                        size="sm"
                        className="p-0 h-auto font-normal text-secondary ml-1"
                        onClick={() => setActiveTab("login")}
                      >
                        Log in
                      </Button>
                    </div>
                  </form>
                </Form>
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </div>
      
      {/* Right Side: Welcome Banner */}
      <div className="hidden md:flex md:w-1/2 bg-gradient-to-br from-primary to-secondary items-center justify-center relative overflow-hidden">
        {/* Background pattern */}
        <div className="absolute inset-0 opacity-10">
          <svg xmlns="http://www.w3.org/2000/svg" width="100%" height="100%">
            <defs>
              <pattern id="a" patternUnits="userSpaceOnUse" width="40" height="40" patternTransform="scale(2) rotate(0)">
                <rect x="0" y="0" width="100%" height="100%" fill="none"/>
                <path d="M0 20h40M20 0v40" strokeWidth="2" stroke="#fff" fill="none"/>
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#a)"/>
          </svg>
        </div>
        
        <div className="px-12 py-16 text-white max-w-lg relative z-10">
          <div className="mb-8">
            <h2 className="text-4xl font-bold mb-4 drop-shadow-sm">Welcome to City Event Hub</h2>
            <p className="text-lg opacity-90 leading-relaxed mb-8">
              Your gateway to discovering, creating, and managing the best events in your city.
            </p>
          </div>
          
          {/* Features List */}
          <div className="space-y-8">
            <div className="flex items-start bg-white/10 p-4 rounded-lg backdrop-blur-sm">
              <div className="bg-white/20 p-2 rounded-full mr-4">
                <User className="h-6 w-6" />
              </div>
              <div>
                <h3 className="font-semibold text-lg mb-1">Personalized Experience</h3>
                <p className="text-white/80 text-sm leading-relaxed">
                  Customize your profile, set preferences, and receive tailored event recommendations.
                </p>
              </div>
            </div>
            
            <div className="flex items-start bg-white/10 p-4 rounded-lg backdrop-blur-sm">
              <div className="bg-white/20 p-2 rounded-full mr-4">
                <CalendarCheck className="h-6 w-6" />
              </div>
              <div>
                <h3 className="font-semibold text-lg mb-1">Event Management</h3>
                <p className="text-white/80 text-sm leading-relaxed">
                  Track tickets, manage registrations, and stay updated with your upcoming events.
                </p>
              </div>
            </div>
            
            <div className="flex items-start bg-white/10 p-4 rounded-lg backdrop-blur-sm">
              <div className="bg-white/20 p-2 rounded-full mr-4">
                <Building className="h-6 w-6" />
              </div>
              <div>
                <h3 className="font-semibold text-lg mb-1">Host & Organize</h3>
                <p className="text-white/80 text-sm leading-relaxed">
                  Create your own events, sell tickets, and grow your community with powerful tools.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
