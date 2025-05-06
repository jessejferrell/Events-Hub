import { useState } from "react";
import { Event } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Calendar, Clock, CalendarPlus } from "lucide-react";
import { format } from "date-fns";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";

interface CalendarIntegrationProps {
  event: Event;
}

type ReminderOption = {
  label: string;
  value: number;
};

const reminderOptions: ReminderOption[] = [
  { label: "15 minutes before", value: 15 },
  { label: "30 minutes before", value: 30 },
  { label: "1 hour before", value: 60 },
  { label: "2 hours before", value: 120 },
  { label: "1 day before", value: 1440 },
  { label: "2 days before", value: 2880 },
  { label: "1 week before", value: 10080 },
];

export default function CalendarIntegration({ event }: CalendarIntegrationProps) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedReminders, setSelectedReminders] = useState<number[]>([15, 1440]); // Default: 15min and 1 day

  const handleReminderToggle = (value: number) => {
    setSelectedReminders((current) =>
      current.includes(value)
        ? current.filter((item) => item !== value)
        : [...current, value]
    );
  };

  const getCalendarUrl = () => {
    // Build URL with selected reminders
    const reminderParam = selectedReminders.length > 0 
      ? `?reminders=${selectedReminders.join(',')}`
      : '';
    return `/api/events/${event.id}/calendar${reminderParam}`;
  };

  const formatEventDate = (date: Date) => {
    return format(new Date(date), "EEE, MMM d, yyyy 'at' h:mm a");
  };

  const generateGoogleCalendarUrl = () => {
    const startDate = new Date(event.startDate);
    const endDate = new Date(event.endDate);
    
    const formatForGoogle = (date: Date) => {
      // Format: YYYYMMDDTHHMMSSZ
      return date.toISOString().replace(/-|:|\.\d+/g, '').slice(0, 15) + 'Z';
    };

    const params = new URLSearchParams({
      action: 'TEMPLATE',
      text: event.title,
      details: event.description,
      location: event.location,
      dates: `${formatForGoogle(startDate)}/${formatForGoogle(endDate)}`,
    });

    return `https://calendar.google.com/calendar/render?${params.toString()}`;
  };

  const generateOutlookCalendarUrl = () => {
    const startDate = new Date(event.startDate);
    const endDate = new Date(event.endDate);
    
    const formatForOutlook = (date: Date) => {
      // Format: YYYY-MM-DDTHH:MM:SS
      return date.toISOString().slice(0, 19);
    };

    const params = new URLSearchParams({
      path: '/calendar/action/compose',
      rru: 'addevent',
      subject: event.title,
      body: event.description,
      location: event.location,
      startdt: formatForOutlook(startDate),
      enddt: formatForOutlook(endDate),
    });

    return `https://outlook.office.com/calendar/0/deeplink/compose?${params.toString()}`;
  };

  return (
    <>
      <Popover>
        <PopoverTrigger asChild>
          <Button 
            variant="outline" 
            size="sm" 
            className="flex items-center gap-2"
          >
            <Calendar className="h-4 w-4" />
            <span>Add to Calendar</span>
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-72">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="font-medium flex items-center">
                <Clock className="h-4 w-4 mr-2 text-primary" />
                Calendar Options
              </h4>
            </div>
            
            <div className="space-y-2">
              <Button 
                variant="secondary" 
                size="sm" 
                className="w-full justify-start"
                onClick={() => setDialogOpen(true)}
              >
                <CalendarPlus className="h-4 w-4 mr-2" />
                Download Calendar File (.ics)
              </Button>
              
              <a 
                href={generateGoogleCalendarUrl()} 
                target="_blank" 
                rel="noopener noreferrer"
              >
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="w-full justify-start"
                >
                  <svg viewBox="0 0 24 24" className="h-4 w-4 mr-2" xmlns="http://www.w3.org/2000/svg">
                    <path d="M21.5 6c.276 0 .5.224.5.5v11c0 .276-.224.5-.5.5h-19c-.276 0-.5-.224-.5-.5v-11c0-.276.224-.5.5-.5h19zM16 16v-3h-3v-2h3V8l3 4-3 4zm-8-8H5v8h3V8z" fill="#4285F4"/>
                  </svg>
                  Add to Google Calendar
                </Button>
              </a>
              
              <a 
                href={generateOutlookCalendarUrl()} 
                target="_blank" 
                rel="noopener noreferrer"
              >
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="w-full justify-start"
                >
                  <svg viewBox="0 0 24 24" className="h-4 w-4 mr-2" xmlns="http://www.w3.org/2000/svg">
                    <path d="M7 4.5c-1.93 0-3.5 1.57-3.5 3.5v8c0 1.93 1.57 3.5 3.5 3.5h10c1.93 0 3.5-1.57 3.5-3.5V8c0-1.93-1.57-3.5-3.5-3.5H7zm.5 3h9c.28 0 .5.22.5.5v7c0 .28-.22.5-.5.5h-9c-.28 0-.5-.22-.5-.5V8c0-.28.22-.5.5-.5z" fill="#0078D4"/>
                  </svg>
                  Add to Outlook Calendar
                </Button>
              </a>
            </div>
            
            <div className="border-t pt-2 text-xs text-muted-foreground">
              <p>
                {formatEventDate(new Date(event.startDate))}
                {new Date(event.startDate).toDateString() !== new Date(event.endDate).toDateString() && (
                  <> - {formatEventDate(new Date(event.endDate))}</>
                )}
              </p>
              <p className="mt-1">{event.location}</p>
            </div>
          </div>
        </PopoverContent>
      </Popover>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Event to Calendar</DialogTitle>
            <DialogDescription>
              Download a calendar file for "{event.title}" and set reminders.
            </DialogDescription>
          </DialogHeader>
          
          <div className="py-4">
            <h4 className="text-sm font-medium mb-3">Set Reminders</h4>
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {reminderOptions.map((option) => (
                <div key={option.value} className="flex items-center space-x-2">
                  <Checkbox 
                    id={`reminder-${option.value}`} 
                    checked={selectedReminders.includes(option.value)}
                    onCheckedChange={() => handleReminderToggle(option.value)}
                  />
                  <Label htmlFor={`reminder-${option.value}`} className="text-sm">
                    {option.label}
                  </Label>
                </div>
              ))}
            </div>
          </div>
          
          <DialogFooter>
            <a 
              href={getCalendarUrl()} 
              download={`${event.title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.ics`}
            >
              <Button 
                type="button" 
                onClick={() => setDialogOpen(false)}
              >
                <Calendar className="h-4 w-4 mr-2" />
                Download Calendar File
              </Button>
            </a>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}