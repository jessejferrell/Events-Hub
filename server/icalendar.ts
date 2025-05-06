import { createEvent, EventAttributes } from 'ics';
import { Event } from '@shared/schema';
import { promisify } from 'util';

// Promisify createEvent to make it easier to work with
const createEventAsync = promisify<EventAttributes, string>((event, callback) => {
  createEvent(event, (error, value) => {
    if (error) {
      callback(error, '');
    } else {
      callback(null, value);
    }
  });
});

/**
 * Generate an iCalendar file for an event
 * 
 * @param event The event to create calendar entry for
 * @param reminderMinutes Optional reminder time in minutes before the event
 * @returns iCalendar string
 */
export async function generateICalendar(event: Event, reminderMinutes: number[] = [15, 60, 1440]): Promise<string> {
  // Convert from Date to [YYYY, MM, DD, HH, MM] format for ics library
  const startDate = new Date(event.startDate);
  const endDate = new Date(event.endDate);
  
  const start = [
    startDate.getFullYear(),
    startDate.getMonth() + 1, // Months are 0-indexed in JS
    startDate.getDate(),
    startDate.getHours(),
    startDate.getMinutes()
  ];
  
  const end = [
    endDate.getFullYear(),
    endDate.getMonth() + 1,
    endDate.getDate(),
    endDate.getHours(),
    endDate.getMinutes()
  ];

  // Create event data structure for ics
  const eventData: EventAttributes = {
    title: event.title,
    description: event.description,
    location: event.location,
    start: start as [number, number, number, number, number],
    end: end as [number, number, number, number, number],
    url: `${process.env.PUBLIC_URL || 'https://events.mosspointmainstreet.org'}/events/${event.id}`,
    status: 'CONFIRMED',
    busyStatus: 'BUSY',
    organizer: { name: 'Moss Point Main Street', email: 'director@mosspointmainstreet.org' },
    alarms: reminderMinutes.map(minutes => ({
      action: 'display',
      description: `Reminder: ${event.title}`,
      trigger: { minutes, before: true }
    }))
  };

  try {
    const icsContent = await createEventAsync(eventData);
    return icsContent;
  } catch (error) {
    console.error('Error generating iCalendar event:', error);
    throw new Error('Failed to generate calendar event');
  }
}