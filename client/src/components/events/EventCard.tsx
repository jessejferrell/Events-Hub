import { Link } from "wouter";
import { Event } from "@shared/schema";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Calendar, MapPin } from "lucide-react";
import { format } from "date-fns";

interface EventCardProps {
  event: Event;
}

export default function EventCard({ event }: EventCardProps) {
  return (
    <Card className="bg-white rounded-lg border border-gray-200 overflow-hidden hover:shadow-md transition-shadow h-full flex flex-col">
      {/* Event Image */}
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
      <CardContent className="p-4 flex-grow">
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
        <div className="flex items-center text-sm text-gray-500">
          <MapPin className="h-4 w-4 mr-1" />
          <span>{event.location}</span>
        </div>
      </CardContent>
      
      <CardFooter className="p-4 pt-0">
        <Link href={`/events/${event.id}`} className="w-full">
          <Button className="w-full bg-secondary hover:bg-secondary/90">
            View Event
          </Button>
        </Link>
      </CardFooter>
    </Card>
  );
}
