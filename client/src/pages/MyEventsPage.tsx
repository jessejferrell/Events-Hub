import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import { Event } from "@shared/schema";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useLocation, Link } from "wouter";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Calendar, Clock, MapPin, Edit, Trash2, PlusCircle, Copy, Eye } from "lucide-react";
import EventForm from "@/components/ui/event-form";
import { ContextualHelp } from "@/components/ui/contextual-help";
import { HELP_TOPICS } from "@/contexts/help-context";
import { format } from "date-fns";

export default function MyEventsPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);

  // Fetch user's events
  const { data: events, isLoading } = useQuery<Event[]>({
    queryKey: ["/api/my-events"],
    queryFn: async () => {
      const res = await fetch("/api/my-events");
      if (!res.ok) throw new Error("Failed to fetch events");
      return await res.json();
    },
  });

  // Delete event mutation
  const deleteEventMutation = useMutation({
    mutationFn: async (eventId: number) => {
      await apiRequest("DELETE", `/api/events/${eventId}`);
    },
    onSuccess: () => {
      toast({
        title: "Event deleted",
        description: "Your event has been deleted successfully.",
      });
      setIsDeleteDialogOpen(false);
      // Refetch events after deletion
      queryClient.invalidateQueries({ queryKey: ["/api/my-events"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete event",
        variant: "destructive",
      });
    },
  });

  // Handle event deletion
  const handleDeleteEvent = (event: Event) => {
    setSelectedEvent(event);
    setIsDeleteDialogOpen(true);
  };

  // Handle edit event
  const handleEditEvent = (event: Event) => {
    setSelectedEvent(event);
    setIsEditDialogOpen(true);
  };

  // Duplicate event mutation
  const duplicateEventMutation = useMutation({
    mutationFn: async (eventId: number) => {
      const response = await apiRequest("POST", `/api/events/${eventId}/duplicate`);
      return await response.json();
    },
    onSuccess: () => {
      toast({
        title: "Event duplicated",
        description: "Your event has been duplicated successfully. The new event is saved as a draft.",
      });
      // Refetch events after duplication
      queryClient.invalidateQueries({ queryKey: ["/api/my-events"] });
      queryClient.invalidateQueries({ queryKey: ["/api/events"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to duplicate event",
        variant: "destructive",
      });
    },
  });

  // Handle event duplication
  const handleDuplicateEvent = (event: Event) => {
    duplicateEventMutation.mutate(event.id);
  };

  // Handle dialog close after create/edit
  const handleFormSuccess = () => {
    setIsCreateDialogOpen(false);
    setIsEditDialogOpen(false);
    queryClient.invalidateQueries({ queryKey: ["/api/my-events"] });
  };

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      
      <main className="flex-grow container mx-auto px-4 py-6">
        <div className="flex justify-between items-center mb-6">
          <div className="flex items-start">
            <div>
              <h1 className="text-2xl font-bold mb-1">My Events</h1>
              <p className="text-neutral-500">
                Manage your events and view analytics
              </p>
            </div>
            <ContextualHelp topic={HELP_TOPICS.MY_EVENTS} side="right" />
          </div>
          <div className="relative">
            <ContextualHelp topic={HELP_TOPICS.EVENT_CREATION} placement="left" />
            <Button 
              onClick={() => setIsCreateDialogOpen(true)}
              className="bg-secondary hover:bg-secondary/90"
            >
              <PlusCircle className="mr-2 h-4 w-4" />
              Create Event
            </Button>
          </div>
        </div>
        
        {isLoading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin h-10 w-10 border-4 border-primary border-t-transparent rounded-full" />
          </div>
        ) : events && events.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {events.map((event) => (
              <Card key={event.id} className="hover:shadow-md transition-shadow">
                <CardHeader className="pb-2">
                  <CardTitle className="text-lg">{event.title}</CardTitle>
                  <CardDescription className="flex items-center">
                    <Calendar className="h-4 w-4 mr-1 text-muted-foreground" />
                    <span>
                      {format(new Date(event.startDate), "MMM d, yyyy")}
                      {new Date(event.startDate).toDateString() !== new Date(event.endDate).toDateString() && 
                        ` - ${format(new Date(event.endDate), "MMM d, yyyy")}`}
                    </span>
                  </CardDescription>
                </CardHeader>
                <CardContent className="pb-2">
                  <div className="h-32 bg-gray-100 rounded mb-3 flex items-center justify-center overflow-hidden">
                    {event.imageUrl ? (
                      <img 
                        src={event.imageUrl} 
                        alt={event.title} 
                        className="w-full h-full object-cover rounded"
                        onError={(e) => {
                          // Hide the broken image and show a fallback
                          e.currentTarget.style.display = 'none';
                          const parent = e.currentTarget.parentElement;
                          if (parent) {
                            const fallback = document.createElement('div');
                            fallback.className = 'flex flex-col items-center justify-center w-full h-full';
                            fallback.innerHTML = `
                              <svg xmlns="http://www.w3.org/2000/svg" class="h-10 w-10 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                              </svg>
                              <span class="text-gray-400 mt-2">${event.title}</span>
                            `;
                            parent.appendChild(fallback);
                          }
                        }}
                      />
                    ) : (
                      <div className="flex flex-col items-center justify-center">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                        <span className="text-gray-400 mt-2">Event Image</span>
                      </div>
                    )}
                  </div>
                  <p className="text-sm line-clamp-2 mb-2">{event.description}</p>
                  <div className="flex items-center text-sm text-gray-500">
                    <MapPin className="h-4 w-4 mr-1" />
                    <span>{event.location}</span>
                  </div>
                  <div className="flex items-center text-sm text-gray-500 mt-1">
                    <Clock className="h-4 w-4 mr-1" />
                    <span>{format(new Date(event.startDate), "h:mm a")}</span>
                  </div>
                </CardContent>
                <CardFooter className="flex flex-col pt-2 gap-2">
                  <div className="flex justify-between w-full gap-2">
                    <div className="relative flex-1">
                      <ContextualHelp
                        content="Update event details, ticket prices, and other settings"
                        title="Edit Event"
                        placement="top"
                        variant="compact"
                      />
                      <Button
                        variant="outline" 
                        size="sm"
                        onClick={() => handleEditEvent(event)}
                        className="w-full"
                      >
                        <Edit className="h-4 w-4 mr-1" />
                        Edit
                      </Button>
                    </div>
                    <div className="relative flex-1">
                      <ContextualHelp
                        content="Preview how your event appears to attendees"
                        title="View Event"
                        placement="top"
                        variant="compact"
                      />
                      <Button
                        variant="secondary" 
                        size="sm"
                        onClick={() => navigate(`/events/${event.id}`)}
                        className="w-full"
                      >
                        <Eye className="h-4 w-4 mr-1" />
                        View
                      </Button>
                    </div>
                  </div>
                  <div className="flex justify-between w-full gap-2">
                    <div className="relative flex-1">
                      <ContextualHelp
                        content="Create a copy of this event with all settings intact"
                        title="Duplicate Event"
                        placement="bottom"
                        variant="compact"
                      />
                      <Button
                        variant="outline" 
                        size="sm"
                        onClick={() => handleDuplicateEvent(event)}
                        disabled={duplicateEventMutation.isPending}
                        className="w-full"
                      >
                        {duplicateEventMutation.isPending ? (
                          <>
                            <div className="h-4 w-4 mr-1 animate-spin border-2 border-t-transparent border-primary rounded-full" />
                            Duplicating...
                          </>
                        ) : (
                          <>
                            <Copy className="h-4 w-4 mr-1" />
                            Duplicate
                          </>
                        )}
                      </Button>
                    </div>
                    <div className="relative flex-1">
                      <ContextualHelp
                        content="Permanently remove this event. This action cannot be undone."
                        title="Delete Event"
                        placement="bottom"
                        variant="compact"
                      />
                      <Button
                        variant="destructive" 
                        size="sm"
                        onClick={() => handleDeleteEvent(event)}
                        className="w-full"
                      >
                        <Trash2 className="h-4 w-4 mr-1" />
                        Delete
                      </Button>
                    </div>
                  </div>
                </CardFooter>
              </Card>
            ))}
          </div>
        ) : (
          <div className="bg-white rounded-lg border border-gray-200 p-8 text-center relative">
            <div className="absolute top-2 right-2">
              <ContextualHelp
                title="Create Your First Event"
                content="Click the button below to create your first event. You'll be able to set details like date, location, ticket prices, and more."
                side="top"
                variant="compact"
              />
            </div>
            <h3 className="text-xl font-medium mb-2">No events created yet</h3>
            <p className="text-gray-500 mb-6">Get started by creating your first event</p>
            <Button 
              onClick={() => setIsCreateDialogOpen(true)}
              className="bg-secondary hover:bg-secondary/90"
            >
              <PlusCircle className="mr-2 h-4 w-4" />
              Create Event
            </Button>
          </div>
        )}

        {/* Create Event Dialog */}
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Create a New Event</DialogTitle>
              <DialogDescription>
                Fill out the form below to create your event.
              </DialogDescription>
            </DialogHeader>
            <EventForm onSuccess={handleFormSuccess} />
          </DialogContent>
        </Dialog>

        {/* Edit Event Dialog */}
        <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
          <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Edit Event</DialogTitle>
              <DialogDescription>
                Make changes to your event details.
              </DialogDescription>
            </DialogHeader>
            {selectedEvent && (
              <EventForm 
                event={selectedEvent} 
                onSuccess={handleFormSuccess} 
              />
            )}
          </DialogContent>
        </Dialog>
        
        {/* Delete Confirmation Dialog */}
        <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Delete Event</DialogTitle>
              <DialogDescription>
                Are you sure you want to delete this event? This action cannot be undone.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setIsDeleteDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={() => selectedEvent && deleteEventMutation.mutate(selectedEvent.id)}
                disabled={deleteEventMutation.isPending}
              >
                {deleteEventMutation.isPending ? "Deleting..." : "Delete Event"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </main>
      
      <Footer />
    </div>
  );
}
