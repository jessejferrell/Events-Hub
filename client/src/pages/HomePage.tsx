import { useAuth } from "@/hooks/use-auth";
import { Link } from "wouter";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { useQuery } from "@tanstack/react-query";
import { Event } from "@shared/schema";
import { Calendar, Users, MapPin, Clock } from "lucide-react";
import { format } from "date-fns";

export default function HomePage() {
  const { user } = useAuth();

  // Fetch upcoming events
  const { data: upcomingEvents, isLoading } = useQuery<Event[]>({
    queryKey: ["/api/events", { isUpcoming: true }],
    queryFn: async () => {
      const res = await fetch("/api/events?isUpcoming=true");
      if (!res.ok) throw new Error("Failed to fetch events");
      return await res.json();
    }
  });

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      
      <main className="flex-grow">
        {/* Hero Section */}
        <section className="bg-primary text-white py-16">
          <div className="container mx-auto px-4 text-center">
            <h1 className="text-4xl font-bold mb-4">Welcome to City Event Hub</h1>
            <p className="max-w-2xl mx-auto mb-8">
              Discover, attend, and organize local events in your community. Find the perfect event for you and your family.
            </p>
            <div className="flex justify-center space-x-4">
              <Link href="/events">
                <Button className="bg-white text-primary hover:bg-white/90">
                  Browse Events
                </Button>
              </Link>
              {user?.role === "event_owner" && (
                <Link href="/my-events/create">
                  <Button variant="outline" className="border-white text-white hover:bg-white/10">
                    Create Event
                  </Button>
                </Link>
              )}
            </div>
          </div>
        </section>
        
        {/* Featured Events Section */}
        <section className="py-12 bg-gray-50">
          <div className="container mx-auto px-4">
            <div className="flex justify-between items-center mb-8">
              <h2 className="text-2xl font-bold">Upcoming Events</h2>
              <Link href="/events">
                <Button variant="link" className="text-secondary">
                  View All Events
                </Button>
              </Link>
            </div>
            
            {isLoading ? (
              <div className="flex justify-center py-12">
                <div className="animate-spin h-10 w-10 border-4 border-primary border-t-transparent rounded-full" />
              </div>
            ) : upcomingEvents && upcomingEvents.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {upcomingEvents.slice(0, 4).map((event) => (
                  <div key={event.id} className="bg-white rounded-lg border border-gray-200 overflow-hidden hover:shadow-md transition-shadow">
                    {/* Event Image Placeholder */}
                    <div className="aspect-video bg-gray-200 flex items-center justify-center">
                      {event.imageUrl ? (
                        <img 
                          src={event.imageUrl} 
                          alt={event.title} 
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <span className="text-gray-400">Event Image</span>
                      )}
                    </div>
                    
                    {/* Event Info */}
                    <div className="p-4">
                      <h3 className="font-semibold text-lg mb-2">{event.title}</h3>
                      <div className="flex items-center text-sm text-gray-500 mb-2">
                        <Calendar className="h-4 w-4 mr-1" />
                        <span>
                          {format(new Date(event.startDate), "MMM d, yyyy")}
                          {new Date(event.startDate).toDateString() !== new Date(event.endDate).toDateString() && 
                            ` - ${format(new Date(event.endDate), "MMM d, yyyy")}`}
                        </span>
                      </div>
                      <p className="text-sm mb-2 line-clamp-2">{event.description}</p>
                      <div className="flex items-center text-sm text-gray-500 mb-4">
                        <MapPin className="h-4 w-4 mr-1" />
                        <span>{event.location}</span>
                      </div>
                      <Link href={`/events/${event.id}`}>
                        <Button className="w-full bg-secondary hover:bg-secondary/90">
                          View Event
                        </Button>
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="bg-white rounded-lg border border-gray-200 p-8 text-center">
                <h3 className="text-xl font-medium mb-2">No upcoming events</h3>
                <p className="text-gray-500 mb-4">Stay tuned for new events coming soon!</p>
                {user?.role === "event_owner" && (
                  <Link href="/my-events/create">
                    <Button className="bg-secondary hover:bg-secondary/90">
                      Create New Event
                    </Button>
                  </Link>
                )}
              </div>
            )}
          </div>
        </section>
        
        {/* How It Works Section */}
        <section className="py-12">
          <div className="container mx-auto px-4">
            <h2 className="text-2xl font-bold mb-8 text-center">How City Event Hub Works</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              <div className="bg-white p-6 rounded-lg border border-gray-200 text-center">
                <div className="bg-blue-100 rounded-full h-16 w-16 flex items-center justify-center mx-auto mb-4">
                  <Calendar className="h-8 w-8 text-secondary" />
                </div>
                <h3 className="text-lg font-semibold mb-2">Discover Events</h3>
                <p className="text-gray-600">Browse upcoming events in your area and find activities that interest you.</p>
              </div>
              
              <div className="bg-white p-6 rounded-lg border border-gray-200 text-center">
                <div className="bg-purple-100 rounded-full h-16 w-16 flex items-center justify-center mx-auto mb-4">
                  <Users className="h-8 w-8 text-primary" />
                </div>
                <h3 className="text-lg font-semibold mb-2">Join the Community</h3>
                <p className="text-gray-600">Register for events, purchase tickets, and connect with other attendees.</p>
              </div>
              
              <div className="bg-white p-6 rounded-lg border border-gray-200 text-center">
                <div className="bg-green-100 rounded-full h-16 w-16 flex items-center justify-center mx-auto mb-4">
                  <Clock className="h-8 w-8 text-green-600" />
                </div>
                <h3 className="text-lg font-semibold mb-2">Create Your Own</h3>
                <p className="text-gray-600">Become an event owner and organize your own events through our platform.</p>
              </div>
            </div>
          </div>
        </section>
      </main>
      
      <Footer />
    </div>
  );
}
