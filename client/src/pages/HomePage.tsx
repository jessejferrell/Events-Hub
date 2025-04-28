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
        <section className="relative overflow-hidden bg-gradient-to-r from-primary to-secondary text-white py-24">
          {/* Background pattern */}
          <div className="absolute inset-0 opacity-10">
            <svg xmlns="http://www.w3.org/2000/svg" width="100%" height="100%">
              <defs>
                <pattern id="hero-pattern" patternUnits="userSpaceOnUse" width="40" height="40" patternTransform="scale(2) rotate(0)">
                  <rect x="0" y="0" width="100%" height="100%" fill="none"/>
                  <path d="M0 20h40M20 0v40" strokeWidth="2" stroke="#fff" fill="none"/>
                </pattern>
              </defs>
              <rect width="100%" height="100%" fill="url(#hero-pattern)"/>
            </svg>
          </div>
          
          {/* Content */}
          <div className="container mx-auto px-4 text-center relative z-10">
            <div className="inline-flex items-center justify-center rounded-full bg-white/10 backdrop-blur-sm px-4 py-1.5 mb-6">
              <span className="text-xs font-medium uppercase tracking-wider">The Best Event Platform</span>
            </div>
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold mb-6 drop-shadow-sm">
              Welcome to City Event Hub
            </h1>
            <p className="max-w-2xl mx-auto mb-10 text-lg opacity-90">
              Discover, attend, and organize local events in your community. Find the perfect event for you and your family.
            </p>
            <div className="flex flex-col sm:flex-row justify-center space-y-4 sm:space-y-0 sm:space-x-4">
              <Link href="/events">
                <Button className="bg-white text-primary hover:bg-white/90 hover:text-primary/80 font-medium px-8 py-6 h-auto rounded-full shadow-lg">
                  Browse Events
                </Button>
              </Link>
              {user?.role === "event_owner" && (
                <Link href="/my-events/create">
                  <Button variant="outline" className="border-white text-white hover:bg-white/10 font-medium px-8 py-6 h-auto rounded-full">
                    Create Event
                  </Button>
                </Link>
              )}
            </div>
            
            {/* Stats */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-8 mt-16 bg-white/10 backdrop-blur-sm p-6 rounded-xl">
              <div className="text-center">
                <p className="text-3xl font-bold">100+</p>
                <p className="text-sm opacity-80">Events Monthly</p>
              </div>
              <div className="text-center">
                <p className="text-3xl font-bold">5,000+</p>
                <p className="text-sm opacity-80">Happy Attendees</p>
              </div>
              <div className="text-center">
                <p className="text-3xl font-bold">50+</p>
                <p className="text-sm opacity-80">Event Organizers</p>
              </div>
            </div>
          </div>
        </section>
        
        {/* Featured Events Section */}
        <section className="py-20 bg-background">
          <div className="container mx-auto px-4">
            <div className="flex flex-col sm:flex-row justify-between items-center mb-12">
              <div>
                <div className="inline-flex items-center text-xs font-medium text-primary uppercase tracking-wider mb-2">
                  <div className="h-0.5 w-5 bg-primary mr-2"></div>
                  Don't Miss Out
                </div>
                <h2 className="text-3xl font-bold text-foreground">Upcoming Events</h2>
              </div>
              <Link href="/events" className="mt-4 sm:mt-0">
                <Button variant="outline" className="text-primary border-primary/30 hover:bg-primary/5">
                  View All Events
                </Button>
              </Link>
            </div>
            
            {isLoading ? (
              <div className="flex justify-center py-16">
                <div className="animate-spin h-10 w-10 border-4 border-primary border-t-transparent rounded-full" />
              </div>
            ) : upcomingEvents && upcomingEvents.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                {upcomingEvents.slice(0, 3).map((event) => (
                  <div key={event.id} className="overflow-hidden hover:shadow-lg transition-all duration-300 h-full flex flex-col group border border-border rounded-xl hover:border-primary/20">
                    {/* Event Image with overlay gradient */}
                    <div className="relative aspect-video overflow-hidden">
                      {event.imageUrl ? (
                        <>
                          <img 
                            src={event.imageUrl} 
                            alt={event.title} 
                            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                          />
                          <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent opacity-70"></div>
                        </>
                      ) : (
                        <div className="w-full h-full bg-gradient-to-br from-primary/20 to-secondary/20 flex items-center justify-center">
                          <Calendar className="h-10 w-10 text-primary/50" />
                        </div>
                      )}
                      
                      {/* Price badge if not free */}
                      {event.price > 0 && (
                        <div className="absolute top-3 right-3 bg-secondary/90 text-white text-sm font-medium px-3 py-1 rounded-full">
                          ${event.price.toFixed(2)}
                        </div>
                      )}
                      
                      {/* Event title on image */}
                      <div className="absolute bottom-0 left-0 right-0 p-4">
                        <h3 className="font-bold text-lg text-white drop-shadow-md line-clamp-1">{event.title}</h3>
                      </div>
                    </div>
                    
                    {/* Event Info */}
                    <div className="p-5 flex-grow flex flex-col">
                      <div className="flex items-center text-sm text-muted-foreground mb-3">
                        <Calendar className="h-4 w-4 mr-2 text-primary/70" />
                        <span>
                          {format(new Date(event.startDate), "MMM d, yyyy")}
                          {new Date(event.startDate).toDateString() !== new Date(event.endDate).toDateString() && 
                            ` - ${format(new Date(event.endDate), "MMM d, yyyy")}`}
                        </span>
                      </div>
                      
                      <div className="flex items-center text-sm text-muted-foreground mb-4">
                        <MapPin className="h-4 w-4 mr-2 text-primary/70" />
                        <span className="truncate">{event.location}</span>
                      </div>
                      
                      <p className="text-sm text-foreground mb-6 line-clamp-2 flex-grow">{event.description}</p>
                      
                      <Link href={`/events/${event.id}`} className="mt-auto">
                        <Button className="w-full bg-primary hover:bg-primary/90 text-white">
                          View Event
                        </Button>
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="bg-white rounded-xl border border-border p-10 text-center shadow-sm">
                <div className="inline-flex items-center justify-center bg-primary/5 p-4 rounded-full mb-4">
                  <Calendar className="h-8 w-8 text-primary" />
                </div>
                <h3 className="text-xl font-medium mb-2">No upcoming events</h3>
                <p className="text-muted-foreground mb-6 max-w-md mx-auto">Stay tuned for new events coming soon! We're constantly adding new experiences for you to enjoy.</p>
                {user?.role === "event_owner" && (
                  <Link href="/my-events/create">
                    <Button className="bg-primary hover:bg-primary/90 text-white px-6">
                      Create New Event
                    </Button>
                  </Link>
                )}
              </div>
            )}
          </div>
        </section>
        
        {/* How It Works Section */}
        <section className="py-20 bg-gradient-to-b from-background to-muted/30">
          <div className="container mx-auto px-4">
            <div className="text-center mb-16">
              <div className="inline-flex items-center text-xs font-medium text-primary uppercase tracking-wider mb-2">
                <div className="h-0.5 w-5 bg-primary mr-2"></div>
                Simple & Easy
                <div className="h-0.5 w-5 bg-primary ml-2"></div>
              </div>
              <h2 className="text-3xl md:text-4xl font-bold text-foreground">How City Event Hub Works</h2>
              <p className="text-muted-foreground mt-4 max-w-2xl mx-auto">
                Our platform makes it easy to discover, join, and create memorable events in your community.
              </p>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-10">
              <div className="relative group">
                <div className="absolute -inset-0.5 bg-gradient-to-r from-primary to-secondary rounded-2xl blur opacity-25 group-hover:opacity-50 transition duration-300"></div>
                <div className="bg-white p-8 rounded-xl shadow-sm border border-border relative flex flex-col items-center text-center h-full">
                  <div className="bg-primary/10 rounded-full h-20 w-20 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300">
                    <Calendar className="h-10 w-10 text-primary" />
                  </div>
                  <h3 className="text-xl font-bold mb-3 text-foreground">Discover Events</h3>
                  <p className="text-muted-foreground">Browse upcoming events in your area and find activities that match your interests and schedule.</p>
                  <div className="h-0.5 w-10 bg-primary/30 mt-6"></div>
                  <div className="absolute -top-4 -left-4 bg-primary text-white rounded-full h-8 w-8 flex items-center justify-center font-bold text-sm">1</div>
                </div>
              </div>
              
              <div className="relative group mt-10 md:mt-0">
                <div className="absolute -inset-0.5 bg-gradient-to-r from-secondary to-primary rounded-2xl blur opacity-25 group-hover:opacity-50 transition duration-300"></div>
                <div className="bg-white p-8 rounded-xl shadow-sm border border-border relative flex flex-col items-center text-center h-full">
                  <div className="bg-secondary/10 rounded-full h-20 w-20 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300">
                    <Users className="h-10 w-10 text-secondary" />
                  </div>
                  <h3 className="text-xl font-bold mb-3 text-foreground">Join the Community</h3>
                  <p className="text-muted-foreground">Register for events, purchase tickets, and connect with other attendees in your local community.</p>
                  <div className="h-0.5 w-10 bg-secondary/30 mt-6"></div>
                  <div className="absolute -top-4 -left-4 bg-secondary text-white rounded-full h-8 w-8 flex items-center justify-center font-bold text-sm">2</div>
                </div>
              </div>
              
              <div className="relative group mt-10 md:mt-0">
                <div className="absolute -inset-0.5 bg-gradient-to-r from-primary/60 to-secondary/60 rounded-2xl blur opacity-25 group-hover:opacity-50 transition duration-300"></div>
                <div className="bg-white p-8 rounded-xl shadow-sm border border-border relative flex flex-col items-center text-center h-full">
                  <div className="bg-gradient-to-r from-primary/10 to-secondary/10 rounded-full h-20 w-20 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300">
                    <Clock className="h-10 w-10 text-foreground" />
                  </div>
                  <h3 className="text-xl font-bold mb-3 text-foreground">Create Your Own</h3>
                  <p className="text-muted-foreground">Become an event organizer and create your own events with our powerful and easy-to-use platform.</p>
                  <div className="h-0.5 w-10 bg-gradient-to-r from-primary/30 to-secondary/30 mt-6"></div>
                  <div className="absolute -top-4 -left-4 bg-gradient-to-r from-primary to-secondary text-white rounded-full h-8 w-8 flex items-center justify-center font-bold text-sm">3</div>
                </div>
              </div>
            </div>
            
            <div className="text-center mt-16">
              <Link href="/events">
                <Button className="bg-primary text-white hover:bg-primary/90 px-8 py-6 h-auto rounded-full shadow-md">
                  Get Started Now
                </Button>
              </Link>
            </div>
          </div>
        </section>
      </main>
      
      <Footer />
    </div>
  );
}
