import { useState } from "react";
import { Event } from "@shared/schema";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon } from "lucide-react";
import { format, addMonths, subMonths, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isToday, isSameDay } from "date-fns";
import { Link } from "wouter";

interface EventCalendarProps {
  events: Event[];
  isLoading: boolean;
  isError: boolean;
}

export default function EventCalendar({ events, isLoading, isError }: EventCalendarProps) {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [eventType, setEventType] = useState("");
  const [location, setLocation] = useState("");

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

  // Navigate to previous month
  const prevMonth = () => {
    setCurrentMonth(subMonths(currentMonth, 1));
  };

  // Navigate to next month
  const nextMonth = () => {
    setCurrentMonth(addMonths(currentMonth, 1));
  };

  // Navigate to current month
  const goToToday = () => {
    setCurrentMonth(new Date());
  };

  // Get days for the calendar
  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const calendarDays = eachDayOfInterval({ start: monthStart, end: monthEnd });

  // Calculate start of display (might include days from previous month)
  const startDay = new Date(monthStart);
  const day = startDay.getDay(); // 0 = Sunday, 1 = Monday, etc.
  startDay.setDate(startDay.getDate() - day);

  // Calculate end of display (might include days from next month)
  const endDay = new Date(monthEnd);
  const endDayOfWeek = endDay.getDay();
  if (endDayOfWeek < 6) {
    endDay.setDate(endDay.getDate() + (6 - endDayOfWeek));
  }

  // Get all days to display
  const daysToDisplay = eachDayOfInterval({ start: startDay, end: endDay });

  // Filter events by selected filters
  const filteredEvents = events.filter(event => {
    if (eventType && event.eventType !== eventType) return false;
    if (location && !event.location.toLowerCase().includes(location.toLowerCase())) return false;
    return true;
  });

  // Get events for a specific day
  const getEventsForDay = (day: Date) => {
    return filteredEvents.filter(event => {
      const eventStart = new Date(event.startDate);
      const eventEnd = new Date(event.endDate);
      return (day >= eventStart && day <= eventEnd);
    });
  };

  return (
    <div>
      {/* Filters */}
      <div className="flex flex-wrap gap-2 mb-6">
        <div className="relative">
          <Select value={eventType} onValueChange={setEventType}>
            <SelectTrigger className="min-w-[180px]">
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
        
        <div className="relative">
          <Select value={location} onValueChange={setLocation}>
            <SelectTrigger className="min-w-[180px]">
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
      
      {/* Calendar Navigation */}
      <div className="flex justify-between items-center mb-4">
        <h2 className="font-semibold text-lg">{format(currentMonth, "MMMM yyyy")}</h2>
        <div className="flex">
          <Button variant="outline" size="icon" onClick={prevMonth}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="outline" className="mx-1" onClick={goToToday}>
            <CalendarIcon className="h-4 w-4 mr-1" />
            Today
          </Button>
          <Button variant="outline" size="icon" onClick={nextMonth}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
      
      {/* Calendar Grid */}
      {isLoading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin h-10 w-10 border-4 border-primary border-t-transparent rounded-full" />
        </div>
      ) : isError ? (
        <div className="bg-red-50 border border-red-200 rounded-md p-4 text-center">
          <p className="text-red-700">Failed to load events. Please try again later.</p>
        </div>
      ) : (
        <Card>
          {/* Days of Week */}
          <div className="grid grid-cols-7 text-center border-b border-neutral-200">
            <div className="py-2 font-medium text-neutral-700">SUN</div>
            <div className="py-2 font-medium text-neutral-700">MON</div>
            <div className="py-2 font-medium text-neutral-700">TUE</div>
            <div className="py-2 font-medium text-neutral-700">WED</div>
            <div className="py-2 font-medium text-neutral-700">THU</div>
            <div className="py-2 font-medium text-neutral-700">FRI</div>
            <div className="py-2 font-medium text-neutral-700">SAT</div>
          </div>
          
          {/* Calendar Dates */}
          <div className="grid grid-cols-7 text-sm">
            {daysToDisplay.map((day, i) => {
              const dayEvents = getEventsForDay(day);
              const isCurrentMonth = isSameMonth(day, currentMonth);
              
              return (
                <div 
                  key={i} 
                  className={`h-28 p-1 border-b border-r border-neutral-200 ${
                    !isCurrentMonth ? "bg-neutral-50" : ""
                  } ${isToday(day) ? "bg-blue-50" : ""}`}
                >
                  <div className={`font-medium ${!isCurrentMonth ? "text-neutral-400" : ""} ${isToday(day) ? "text-blue-600" : ""}`}>
                    {format(day, "d")}
                  </div>
                  
                  {/* Events for this day */}
                  <div className="overflow-y-auto max-h-[80px]">
                    {dayEvents.map(event => (
                      <Link key={event.id} href={`/events/${event.id}`}>
                        <div className="text-xs p-1 mt-1 rounded bg-secondary/10 text-secondary truncate cursor-pointer hover:bg-secondary/20">
                          {event.title}
                        </div>
                      </Link>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      )}
    </div>
  );
}
