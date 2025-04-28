import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { Product, insertProductSchema } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { 
  Tabs, 
  TabsContent, 
  TabsList, 
  TabsTrigger 
} from "@/components/ui/tabs";
import { 
  Package, 
  Ticket as TicketIcon, 
  Store, 
  Users, 
  Plus, 
  Edit as EditIcon, 
  Trash2
} from "lucide-react";

// Extend product schema for form validation
const productFormSchema = insertProductSchema.extend({
  price: z.coerce.number().min(0, "Price must be positive"),
  quantity: z.coerce.number().min(0, "Quantity must be positive"),
});

// Define product form values type
type ProductFormValues = z.infer<typeof productFormSchema>;

interface ProductManagerProps {
  eventId: number;
}

export default function ProductManager({ eventId }: ProductManagerProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<string>("tickets");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [productType, setProductType] = useState<string>("ticket");

  // Get all products for this event
  const { data: products = [], isLoading: isLoadingProducts } = useQuery({
    queryKey: ["/api/products", eventId],
    queryFn: async () => {
      const res = await fetch(`/api/products?eventId=${eventId}`);
      if (!res.ok) throw new Error("Failed to fetch products");
      return res.json();
    },
    enabled: !!eventId,
  });

  // Filtered products by type
  const tickets = products.filter(p => p.type === "ticket");
  const merchandise = products.filter(p => p.type === "merchandise");
  const addons = products.filter(p => p.type === "addon");
  const vendorSpots = products.filter(p => p.type === "vendor_spot");
  const volunteerShifts = products.filter(p => p.type === "volunteer_shift");

  // Create product mutation
  const createProductMutation = useMutation({
    mutationFn: async (data: ProductFormValues) => {
      const res = await apiRequest("POST", "/api/products", data);
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || "Failed to create product");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/products", eventId] });
      toast({ title: "Success", description: "Product created successfully" });
      setIsDialogOpen(false);
      form.reset();
    },
    onError: (error: Error) => {
      toast({ 
        title: "Error", 
        description: error.message || "Failed to create product", 
        variant: "destructive" 
      });
    },
  });

  // Update product mutation
  const updateProductMutation = useMutation({
    mutationFn: async (data: ProductFormValues & { id: number }) => {
      const { id, ...product } = data;
      const res = await apiRequest("PATCH", `/api/products/${id}`, product);
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || "Failed to update product");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/products", eventId] });
      toast({ title: "Success", description: "Product updated successfully" });
      setIsDialogOpen(false);
      setEditingProduct(null);
      form.reset();
    },
    onError: (error: Error) => {
      toast({ 
        title: "Error", 
        description: error.message || "Failed to update product", 
        variant: "destructive" 
      });
    },
  });

  // Delete product mutation
  const deleteProductMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest("DELETE", `/api/products/${id}`);
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || "Failed to delete product");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/products", eventId] });
      toast({ title: "Success", description: "Product deleted successfully" });
    },
    onError: (error: Error) => {
      toast({ 
        title: "Error", 
        description: error.message || "Failed to delete product", 
        variant: "destructive" 
      });
    },
  });

  // Default form values
  const defaultValues: Partial<ProductFormValues> = {
    eventId,
    name: "",
    description: "",
    type: productType,
    price: 0,
    quantity: 0,
    isActive: true,
  };

  // Create form
  const form = useForm<ProductFormValues>({
    resolver: zodResolver(productFormSchema),
    defaultValues,
  });

  // Set form values when editing product
  useEffect(() => {
    if (editingProduct) {
      form.reset({
        eventId,
        name: editingProduct.name,
        description: editingProduct.description || "",
        type: editingProduct.type,
        price: editingProduct.price,
        quantity: editingProduct.quantity || 0,
        isActive: editingProduct.isActive,
        imageUrl: editingProduct.imageUrl || "",
      });
      setProductType(editingProduct.type);
    }
  }, [editingProduct, form, eventId]);

  // Reset form and editing state when dialog is closed
  const handleDialogOpenChange = (open: boolean) => {
    setIsDialogOpen(open);
    if (!open) {
      setEditingProduct(null);
      form.reset(defaultValues);
    }
  };

  // Handle form submission
  function onSubmit(data: ProductFormValues) {
    if (editingProduct) {
      updateProductMutation.mutate({ ...data, id: editingProduct.id });
    } else {
      createProductMutation.mutate({ ...data, type: productType });
    }
  }

  // Open dialog for creating a new product
  const handleAddProduct = (type: string) => {
    setProductType(type);
    form.reset({
      ...defaultValues,
      type: type,
    });
    setIsDialogOpen(true);
  };

  // Open dialog for editing a product
  const handleEditProduct = (product: Product) => {
    setEditingProduct(product);
    setIsDialogOpen(true);
  };

  // Confirm and delete a product
  const handleDeleteProduct = (product: Product) => {
    if (window.confirm(`Are you sure you want to delete ${product.name}?`)) {
      deleteProductMutation.mutate(product.id);
    }
  };

  // Type-specific names and descriptions
  const getTypeLabel = (type: string) => {
    switch (type) {
      case "ticket": return "Ticket";
      case "merchandise": return "Merchandise";
      case "addon": return "Add-on";
      case "vendor_spot": return "Vendor Spot";
      case "volunteer_shift": return "Volunteer Shift";
      default: return type.charAt(0).toUpperCase() + type.slice(1);
    }
  };

  const getTypeDescription = (type: string) => {
    switch (type) {
      case "ticket": 
        return "Tickets are the main entry products for your event";
      case "merchandise": 
        return "Physical items like t-shirts, posters, etc. to sell at your event";
      case "addon": 
        return "Optional add-ons that can be purchased with tickets";
      case "vendor_spot": 
        return "Spaces for vendors to sell products at your event";
      case "volunteer_shift": 
        return "Volunteer positions for your event";
      default: 
        return "";
    }
  };

  // Render product cards
  const renderProductCards = (products: Product[], type: string) => {
    if (products.length === 0) {
      return (
        <div className="text-center py-10 bg-muted/30 rounded-lg border border-dashed">
          <h3 className="text-lg font-medium mb-2">No {getTypeLabel(type).toLowerCase()} products yet</h3>
          <p className="text-muted-foreground mb-4">Add some {getTypeLabel(type).toLowerCase()} options for your event</p>
          <Button onClick={() => handleAddProduct(type)}>
            <Plus className="h-4 w-4 mr-1" />
            Add {getTypeLabel(type)}
          </Button>
        </div>
      );
    }

    return (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {products.map((product) => (
          <Card key={product.id} className="overflow-hidden">
            <CardHeader className="pb-3">
              <div className="flex justify-between items-start">
                <div>
                  <CardTitle className="text-base">{product.name}</CardTitle>
                  <CardDescription className="mt-1 line-clamp-2">
                    {product.description || "No description"}
                  </CardDescription>
                </div>
                {product.isActive ? (
                  <Badge variant="success">Active</Badge>
                ) : (
                  <Badge variant="secondary">Inactive</Badge>
                )}
              </div>
            </CardHeader>
            <CardContent className="pb-3">
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div>
                  <span className="text-muted-foreground">Price:</span>
                  <p className="font-medium">${product.price.toFixed(2)}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Quantity:</span>
                  <p className="font-medium">
                    {product.quantity === null ? "Unlimited" : product.quantity}
                  </p>
                </div>
              </div>
            </CardContent>
            <CardFooter className="flex justify-end gap-2 pt-0">
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => handleEditProduct(product)}
              >
                <EditIcon className="h-4 w-4 mr-1" />
                Edit
              </Button>
              <Button 
                variant="destructive" 
                size="sm"
                onClick={() => handleDeleteProduct(product)}
              >
                <Trash2 className="h-4 w-4 mr-1" />
                Delete
              </Button>
            </CardFooter>
          </Card>
        ))}
      </div>
    );
  };

  // Render product form dialog
  const renderProductForm = () => (
    <Dialog open={isDialogOpen} onOpenChange={handleDialogOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            {editingProduct ? `Edit ${getTypeLabel(productType)}` : `Add ${getTypeLabel(productType)}`}
          </DialogTitle>
          <DialogDescription>
            {getTypeDescription(productType)}
          </DialogDescription>
        </DialogHeader>
        
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Name</FormLabel>
                  <FormControl>
                    <Input placeholder={`${getTypeLabel(productType)} name`} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description</FormLabel>
                  <FormControl>
                    <Textarea placeholder="Description (optional)" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="price"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Price ($)</FormLabel>
                    <FormControl>
                      <Input type="number" min="0" step="0.01" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="quantity"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Quantity</FormLabel>
                    <FormControl>
                      <Input type="number" min="0" {...field} />
                    </FormControl>
                    <FormDescription>
                      0 for unlimited
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            
            <FormField
              control={form.control}
              name="imageUrl"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Image URL (Optional)</FormLabel>
                  <FormControl>
                    <Input placeholder="Image URL" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <FormField
              control={form.control}
              name="isActive"
              render={({ field }) => (
                <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
                  <FormControl>
                    <input
                      type="checkbox"
                      checked={field.value}
                      onChange={field.onChange}
                      className="h-4 w-4 mt-1"
                    />
                  </FormControl>
                  <div className="space-y-1 leading-none">
                    <FormLabel>Active</FormLabel>
                    <FormDescription>
                      Inactive products won't be available for purchase
                    </FormDescription>
                  </div>
                </FormItem>
              )}
            />
            
            <DialogFooter>
              <Button 
                type="button" 
                variant="outline" 
                onClick={() => setIsDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button 
                type="submit"
                disabled={createProductMutation.isPending || updateProductMutation.isPending}
              >
                {createProductMutation.isPending || updateProductMutation.isPending
                  ? "Saving..."
                  : editingProduct ? "Update" : "Create"
                }
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );

  return (
    <div className="space-y-6">
      <Tabs defaultValue="tickets" value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid grid-cols-5">
          <TabsTrigger value="tickets" className="flex items-center gap-1">
            <TicketIcon className="h-4 w-4" />
            <span className="hidden sm:inline">Tickets</span>
            {tickets.length > 0 && (
              <Badge variant="secondary" className="ml-1">{tickets.length}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="merchandise" className="flex items-center gap-1">
            <Package className="h-4 w-4" />
            <span className="hidden sm:inline">Merchandise</span>
            {merchandise.length > 0 && (
              <Badge variant="secondary" className="ml-1">{merchandise.length}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="addons" className="flex items-center gap-1">
            <Plus className="h-4 w-4" />
            <span className="hidden sm:inline">Add-ons</span>
            {addons.length > 0 && (
              <Badge variant="secondary" className="ml-1">{addons.length}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="vendors" className="flex items-center gap-1">
            <Store className="h-4 w-4" />
            <span className="hidden sm:inline">Vendors</span>
            {vendorSpots.length > 0 && (
              <Badge variant="secondary" className="ml-1">{vendorSpots.length}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="volunteers" className="flex items-center gap-1">
            <Users className="h-4 w-4" />
            <span className="hidden sm:inline">Volunteers</span>
            {volunteerShifts.length > 0 && (
              <Badge variant="secondary" className="ml-1">{volunteerShifts.length}</Badge>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="tickets" className="pt-4">
          <div className="flex justify-between items-center mb-4">
            <div>
              <h3 className="text-lg font-medium">Tickets</h3>
              <p className="text-muted-foreground">Create different ticket types for your event</p>
            </div>
            <Button onClick={() => handleAddProduct("ticket")}>
              <Plus className="h-4 w-4 mr-1" />
              Add Ticket
            </Button>
          </div>
          {isLoadingProducts ? (
            <div className="flex justify-center p-8">
              <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full"></div>
            </div>
          ) : (
            renderProductCards(tickets, "ticket")
          )}
        </TabsContent>

        <TabsContent value="merchandise" className="pt-4">
          <div className="flex justify-between items-center mb-4">
            <div>
              <h3 className="text-lg font-medium">Merchandise</h3>
              <p className="text-muted-foreground">Add merchandise items for sale at your event</p>
            </div>
            <Button onClick={() => handleAddProduct("merchandise")}>
              <Plus className="h-4 w-4 mr-1" />
              Add Item
            </Button>
          </div>
          {isLoadingProducts ? (
            <div className="flex justify-center p-8">
              <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full"></div>
            </div>
          ) : (
            renderProductCards(merchandise, "merchandise")
          )}
        </TabsContent>

        <TabsContent value="addons" className="pt-4">
          <div className="flex justify-between items-center mb-4">
            <div>
              <h3 className="text-lg font-medium">Add-ons</h3>
              <p className="text-muted-foreground">Create optional add-ons that customers can purchase</p>
            </div>
            <Button onClick={() => handleAddProduct("addon")}>
              <Plus className="h-4 w-4 mr-1" />
              Add Add-on
            </Button>
          </div>
          {isLoadingProducts ? (
            <div className="flex justify-center p-8">
              <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full"></div>
            </div>
          ) : (
            renderProductCards(addons, "addon")
          )}
        </TabsContent>

        <TabsContent value="vendors" className="pt-4">
          <div className="flex justify-between items-center mb-4">
            <div>
              <h3 className="text-lg font-medium">Vendor Spots</h3>
              <p className="text-muted-foreground">Create vendor registration options for your event</p>
            </div>
            <Button onClick={() => handleAddProduct("vendor_spot")}>
              <Plus className="h-4 w-4 mr-1" />
              Add Vendor Spot
            </Button>
          </div>
          {isLoadingProducts ? (
            <div className="flex justify-center p-8">
              <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full"></div>
            </div>
          ) : (
            renderProductCards(vendorSpots, "vendor_spot")
          )}
        </TabsContent>

        <TabsContent value="volunteers" className="pt-4">
          <div className="flex justify-between items-center mb-4">
            <div>
              <h3 className="text-lg font-medium">Volunteer Shifts</h3>
              <p className="text-muted-foreground">Create volunteer shift options for your event</p>
            </div>
            <Button onClick={() => handleAddProduct("volunteer_shift")}>
              <Plus className="h-4 w-4 mr-1" />
              Add Volunteer Shift
            </Button>
          </div>
          {isLoadingProducts ? (
            <div className="flex justify-center p-8">
              <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full"></div>
            </div>
          ) : (
            renderProductCards(volunteerShifts, "volunteer_shift")
          )}
        </TabsContent>
      </Tabs>

      {renderProductForm()}
    </div>
  );
}