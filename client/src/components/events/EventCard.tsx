import { Link } from "wouter";
import { Event } from "@shared/schema";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Calendar, MapPin, Clock, Tag, DollarSign } from "lucide-react";
import { format } from "date-fns";

interface EventCardProps {
  event: Event;
}

export default function EventCard({ event }: EventCardProps) {
  return (
    <Card className="overflow-hidden hover:shadow-lg transition-all duration-300 h-full flex flex-col group border-transparent hover:border-primary/20">
      {/* Event Image with overlay gradient */}
      <div className="relative aspect-video overflow-hidden">
        {event.imageUrl ? (
          <>
            <img 
              src={event.imageUrl} 
              alt={event.title} 
              className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
              onError={(e) => {
                // Hide the broken image and show a fallback
                e.currentTarget.style.display = 'none';
                const parent = e.currentTarget.parentElement;
                if (parent) {
                  // Add gradient overlay
                  const overlay = parent.querySelector('.overlay-gradient');
                  if (overlay) overlay.remove();
                  
                  // Add fallback content
                  const fallback = document.createElement('div');
                  fallback.className = 'w-full h-full bg-gradient-to-br from-primary/20 to-secondary/20 flex items-center justify-center';
                  fallback.innerHTML = `
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-10 w-10 text-primary/50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                    </svg>
                  `;
                  parent.appendChild(fallback);
                }
              }}
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent opacity-70 overlay-gradient"></div>
          </>
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-primary/20 to-secondary/20 flex items-center justify-center">
            <Tag className="h-10 w-10 text-primary/50" />
          </div>
        )}
        
        {/* Event type badge */}
        <Badge className="absolute top-3 left-3 bg-primary/90 hover:bg-primary border-none font-medium">
          {event.eventType}
        </Badge>
        
        {/* Price badge if not free */}
        {event.price > 0 && (
          <Badge className="absolute top-3 right-3 bg-secondary/90 hover:bg-secondary border-none font-medium">
            ${event.price.toFixed(2)}
          </Badge>
        )}
        
        {/* Event title on image */}
        <div className="absolute bottom-0 left-0 right-0 p-4">
          <h3 className="font-bold text-lg text-white drop-shadow-md line-clamp-1">{event.title}</h3>
        </div>
      </div>
      
      {/* Event Info */}
      <CardContent className="p-4 flex-grow">
        <div className="flex items-center text-sm text-gray-500 mb-2.5">
          <Calendar className="h-4 w-4 mr-1.5 text-primary/70" />
          <span>
            {format(new Date(event.startDate), "MMM d, yyyy")}
            {new Date(event.startDate).toDateString() !== new Date(event.endDate).toDateString() && 
              ` - ${format(new Date(event.endDate), "MMM d, yyyy")}`}
          </span>
        </div>
        
        <div className="flex items-center text-sm text-gray-500 mb-2.5">
          <Clock className="h-4 w-4 mr-1.5 text-primary/70" />
          <span>{format(new Date(event.startDate), "h:mm a")}</span>
        </div>
        
        <div className="flex items-center text-sm text-gray-500 mb-3">
          <MapPin className="h-4 w-4 mr-1.5 text-primary/70" />
          <span className="truncate">{event.location}</span>
        </div>
        
        <p className="text-sm text-gray-600 mb-3 line-clamp-2">{event.description}</p>
        
        {event.price === 0 ? (
          <Badge variant="outline" className="mb-3 text-green-600 bg-green-50 hover:bg-green-50 border-green-200">
            Free Event
          </Badge>
        ) : (
          <div className="flex items-center mb-3 text-gray-700">
            <DollarSign className="h-4 w-4 mr-1 text-green-600" />
            <span className="font-medium">${event.price.toFixed(2)}</span>
            <span className="text-xs text-gray-500 ml-1">per ticket</span>
          </div>
        )}
      </CardContent>
      
      <CardFooter className="p-4 pt-0">
        <Link href={`/events/${event.id}`} className="w-full">
          <Button className="w-full bg-secondary hover:bg-secondary-foreground hover:text-secondary transition-colors">
            View Event
          </Button>
        </Link>
      </CardFooter>
    </Card>
  );
}
