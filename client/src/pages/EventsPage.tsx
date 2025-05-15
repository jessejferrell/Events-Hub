import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Event } from "@shared/schema";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import EventCard from "@/components/events/EventCard";
import EventCalendar from "@/components/events/EventCalendar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { 
  Search, 
  GridIcon, 
  List, 
  CalendarIcon, 
  Filter, 
  ChevronDown 
} from "lucide-react";
import { ContextualHelp } from "@/components/ui/contextual-help";
import { HELP_TOPICS } from "@/contexts/help-context";

// Event type options
const eventTypes = [
  { value: "", label: "All Event Types" },
  { value: "concert", label: "Concerts" },
  { value: "festival", label: "Festivals" },
  { value: "workshop", label: "Workshops" },
  { value: "community", label: "Community" },
  { value: "sports", label: "Sports" },
];

// Location options
const locationOptions = [
  { value: "", label: "All Locations" },
  { value: "downtown", label: "Downtown" },
  { value: "park", label: "City Park" },
  { value: "convention", label: "Convention Center" },
  { value: "riverfront", label: "Riverfront" },
];

// Sort options
const sortOptions = [
  { value: "dateDesc", label: "Date (Upcoming First)" },
  { value: "dateAsc", label: "Date (Oldest First)" },
  { value: "title", label: "Title (A-Z)" },
];

export default function EventsPage() {
  // State for view mode and filters
  const [viewMode, setViewMode] = useState<"grid" | "calendar">("grid");
  const [searchQuery, setSearchQuery] = useState("");
  const [eventType, setEventType] = useState("");
  const [location, setLocation] = useState("");
  const [sortBy, setSortBy] = useState("dateDesc");
  const [showFilters, setShowFilters] = useState(false);

  // Build query parameters
  const queryParams = new URLSearchParams();
  if (searchQuery) queryParams.append("search", searchQuery);
  if (eventType) queryParams.append("type", eventType);
  if (location) queryParams.append("location", location);
  queryParams.append("sortBy", sortBy);
  queryParams.append("isUpcoming", "true");

  // Fetch events with filters
  const { data: events, isLoading, isError } = useQuery<Event[]>({
    queryKey: ["/api/events", { search: searchQuery, type: eventType, location, sortBy }],
    queryFn: async () => {
      const res = await fetch(`/api/events?${queryParams.toString()}`);
      if (!res.ok) throw new Error("Failed to fetch events");
      return await res.json();
    }
  });

  // Handle search input change
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value);
  };

  // Handle search form submission
  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // The query will be automatically refetched due to queryKey dependencies
  };

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      
      <main className="flex-grow container mx-auto px-4 py-6">
        <h1 className="text-2xl font-bold mb-1">
          {viewMode === "grid" ? "Upcoming Events" : "Events Calendar"}
        </h1>
        <p className="text-neutral-500 mb-6">
          {viewMode === "grid" 
            ? "Browse all upcoming events in your area. Find the perfect event for you and your family." 
            : "Browse all upcoming city events and activities"}
        </p>
        
        {/* Search and Filters */}
        <div className="flex flex-col md:flex-row mb-6 gap-4">
          {/* Search */}
          <div className="relative flex-grow">
            <form onSubmit={handleSearchSubmit}>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                <Input
                  type="text"
                  placeholder="Search events..."
                  className="pl-10"
                  value={searchQuery}
                  onChange={handleSearchChange}
                />
              </div>
            </form>
          </div>
          
          {/* View Toggle */}
          <div className="flex bg-white border border-neutral-200 rounded-md overflow-hidden relative">
            <Button
              variant={viewMode === "grid" ? "secondary" : "ghost"}
              className={`flex items-center justify-center px-4 py-2 ${
                viewMode === "grid" ? "text-white" : ""
              }`}
              onClick={() => setViewMode("grid")}
            >
              <GridIcon className="h-4 w-4 mr-1" />
              <span>Grid</span>
            </Button>
            <Button
              variant={viewMode === "calendar" ? "secondary" : "ghost"}
              className={`flex items-center justify-center px-4 py-2 ${
                viewMode === "calendar" ? "text-white" : ""
              }`}
              onClick={() => setViewMode("calendar")}
            >
              <CalendarIcon className="h-4 w-4 mr-1" />
              <span>Calendar</span>
            </Button>
            <div className="absolute right-0 top-0 transform translate-x-1/3 -translate-y-1/3">
              <ContextualHelp topic={HELP_TOPICS.EVENT_CALENDAR} />
            </div>
          </div>
          
          {/* Filters Button */}
          <Button
            variant="outline"
            className="flex items-center justify-center"
            onClick={() => setShowFilters(!showFilters)}
          >
            <Filter className="h-4 w-4 mr-1" />
            <span>Filters</span>
          </Button>
          
          {/* Sort Dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="flex items-center justify-between min-w-[180px]">
                <span>{sortOptions.find(option => option.value === sortBy)?.label}</span>
                <ChevronDown className="h-4 w-4 ml-2" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              {sortOptions.map(option => (
                <DropdownMenuItem 
                  key={option.value}
                  onClick={() => setSortBy(option.value)}
                >
                  {option.label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        
        {/* Expanded Filters */}
        {showFilters && (
          <div className="mb-6 p-4 border border-gray-200 rounded-md bg-white">
            <h3 className="font-medium mb-3">Filter Options</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm mb-1">Event Type</label>
                <Select value={eventType} onValueChange={setEventType}>
                  <SelectTrigger>
                    <SelectValue placeholder="All Event Types" />
                  </SelectTrigger>
                  <SelectContent>
                    {eventTypes.map(type => (
                      <SelectItem key={type.value} value={type.value}>
                        {type.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="block text-sm mb-1">Location</label>
                <Select value={location} onValueChange={setLocation}>
                  <SelectTrigger>
                    <SelectValue placeholder="All Locations" />
                  </SelectTrigger>
                  <SelectContent>
                    {locationOptions.map(loc => (
                      <SelectItem key={loc.value} value={loc.value}>
                        {loc.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        )}
        
        {/* Content based on view mode */}
        {viewMode === "grid" ? (
          <div className="mb-8">
            {/* Event count */}
            <p className="text-neutral-500 mb-4 text-sm">
              {isLoading 
                ? "Loading events..." 
                : isError 
                  ? "Error loading events" 
                  : `Showing ${events?.length || 0} event${events?.length !== 1 ? 's' : ''}`}
            </p>
            
            {/* Events Grid */}
            {isLoading ? (
              <div className="flex justify-center py-12">
                <div className="animate-spin h-10 w-10 border-4 border-primary border-t-transparent rounded-full" />
              </div>
            ) : isError ? (
              <div className="bg-red-50 border border-red-200 rounded-md p-4 text-center">
                <p className="text-red-700">Failed to load events. Please try again later.</p>
              </div>
            ) : events && events.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {events.map(event => (
                  <EventCard key={event.id} event={event} />
                ))}
              </div>
            ) : (
              <div className="bg-white rounded-lg border border-gray-200 p-8 text-center">
                <h3 className="text-xl font-medium mb-2">No events found</h3>
                <p className="text-gray-500">Try adjusting your filters or search query</p>
              </div>
            )}
          </div>
        ) : (
          <EventCalendar events={events || []} isLoading={isLoading} isError={isError} />
        )}
      </main>
      
      <Footer />
    </div>
  );
}
