import { createEvents, EventAttributes } from 'ics';
import { Event } from '@shared/schema';
import { promisify } from 'util';

const createEventsAsync = promisify(createEvents);

/**
 * Generate an iCalendar file for an event
 * 
 * @param event The event to create calendar entry for
 * @param reminderMinutes Optional reminder time in minutes before the event
 * @returns iCalendar string
 */
export async function generateICalendar(event: Event, reminderMinutes: number[] = [15, 60, 1440]): Promise<string> {
  // Convert event start date to array format required by ics
  // [year, month, day, hour, minute]
  const startDate = new Date(event.startDate);
  const endDate = new Date(event.endDate);
  
  const startArray = [
    startDate.getFullYear(),
    startDate.getMonth() + 1, // Months are 1-indexed in ics
    startDate.getDate(),
    startDate.getHours(),
    startDate.getMinutes()
  ];
  
  const endArray = [
    endDate.getFullYear(),
    endDate.getMonth() + 1,
    endDate.getDate(),
    endDate.getHours(),
    endDate.getMinutes()
  ];
  
  // Format alarms based on provided reminder minutes
  const alarms = reminderMinutes.map(minutes => ({
    action: 'display',
    trigger: { minutes, before: true },
    description: `Reminder: ${event.title}`
  }));
  
  // Construct event data for ics
  const eventData: EventAttributes = {
    start: startArray as [number, number, number, number, number],
    end: endArray as [number, number, number, number, number],
    title: event.title,
    description: event.description,
    location: event.location,
    url: `${process.env.REPLIT_DOMAINS ? 'https://' + process.env.REPLIT_DOMAINS.split(',')[0] : ''}/events/${event.id}`,
    status: 'CONFIRMED',
    busyStatus: 'BUSY',
    organizer: { name: 'Moss Point Main Street', email: 'events@mosspointmainstreet.org' },
    alarms: alarms
  };
  
  try {
    // Create iCalendar event
    const { error, value } = await createEventsAsync({ events: [eventData] });
    
    if (error) {
      console.error('Error creating iCalendar event:', error);
      throw new Error(`Failed to generate calendar file: ${error}`);
    }
    
    return value || '';
  } catch (error) {
    console.error('Error generating iCalendar:', error);
    throw new Error('Failed to generate calendar file');
  }
}