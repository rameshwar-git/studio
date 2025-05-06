'use client';

import * as React from 'react';
import { Calendar } from '@/components/ui/calendar';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { BookingRequest } from '@/services/firestore';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import {
  format,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  isSameDay,
  addMonths,
  subMonths,
  setHours,
  setMinutes,
  isWithinInterval,
  addHours
} from 'date-fns';

interface VenueCalendarProps {
  bookings: BookingRequest[];
  currentMonth: Date;
  onMonthChange: (newMonth: Date) =&gt; void;
}

// Define standard operational hours and booking duration
const OPERATIONAL_START_HOUR = 9; // 9 AM
const OPERATIONAL_END_HOUR = 17; // 5 PM (bookings can end at 5 PM, so last start is 4 PM for 1hr)
const BOOKING_DURATION_HOURS = 1;
const GAP_DURATION_HOURS = 1; // 1-hour gap

// Generate all possible 1-hour start slots within operational hours
const getAllPossibleSlots = () =&gt; {
  const slots = [];
  for (let hour = OPERATIONAL_START_HOUR; hour &lt; OPERATIONAL_END_HOUR; hour++) {
    // Bookings are 1 hour, so a booking starting at hour X ends at X+1
    // Last possible start time is OPERATIONAL_END_HOUR - BOOKING_DURATION_HOURS
    slots.push({ start: hour, end: hour + BOOKING_DURATION_HOURS });
  }
  return slots;
};
const ALL_POSSIBLE_SLOTS = getAllPossibleSlots();

// Get unique hall names from bookings (in a real app, this might come from a predefined list)
const getUniqueHalls = (bookings: BookingRequest[]): string[] =&gt; {
    const halls = new Set(bookings.map(b =&gt; b.hallPreference));
    // Add some default halls if none are in bookings, for demo purposes
    if (halls.size === 0) {
        return ["Main Hall", "Seminar Room A", "Conference Room B"];
    }
    return Array.from(halls);
};


export function VenueCalendar({ bookings, currentMonth, onMonthChange }: VenueCalendarProps) {
  const [dayStatus, setDayStatus] = React.useState&lt;Record&lt;string, 'available' | 'fully-booked'&gt;&gt;({});

  React.useEffect(() =&gt; {
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(currentMonth);
    const daysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd });
    const newDayStatus: Record&lt;string, 'available' | 'fully-booked'&gt; = {};
    
    const ALL_HALLS = getUniqueHalls(bookings);
    if (ALL_HALLS.length === 0) { // If no halls, all days are 'available' (or undefined by default)
        daysInMonth.forEach(day =&gt; {
            newDayStatus[format(day, 'yyyy-MM-dd')] = 'available';
        });
        setDayStatus(newDayStatus);
        return;
    }

    daysInMonth.forEach(day =&gt; {
      let isDayFullyBookedForAllHalls = true;

      for (const hall of ALL_HALLS) {
        const bookingsForHallOnDay = bookings.filter(
          b =&gt; isSameDay(b.startTimeDate || b.date, day) &amp;&amp; b.hallPreference === hall &amp;&amp; (b.status === 'approved' || b.status === 'pending'))
        .map(b =&gt; {
            // Ensure startTimeDate and endTimeDate are actual Date objects
            let sd, ed;
            if (b.startTimeDate &amp;&amp; b.endTimeDate) {
                sd = b.startTimeDate;
                ed = b.endTimeDate;
            } else { // Fallback if precise timestamps weren't stored/retrieved (should not happen with current firestore.ts)
                const [sH, sM] = b.startTime.split(':').map(Number);
                const [eH, eM] = b.endTime.split(':').map(Number);
                sd = setMinutes(setHours(b.date, sH),sM);
                ed = setMinutes(setHours(b.date, eH),eM);
            }
            return { start: sd, end: ed };
        });

        let hasAvailableSlotInThisHall = false;
        for (const slot of ALL_POSSIBLE_SLOTS) {
          const slotStart = setHours(day, slot.start);
          const slotEnd = setHours(day, slot.end);
          
          let isSlotAvailable = true;
          for (const booking of bookingsForHallOnDay) {
            // Effective booking interval including 1-hour gap on both sides
            const effectiveBookingStart = addHours(booking.start, -GAP_DURATION_HOURS);
            const effectiveBookingEnd = addHours(booking.end, GAP_DURATION_HOURS);

            // Check if [slotStart, slotEnd) overlaps with [effectiveBookingStart, effectiveBookingEnd)
            // Overlap if (slotStart &lt; effectiveBookingEnd) and (slotEnd &gt; effectiveBookingStart)
            if (slotStart &lt; effectiveBookingEnd &amp;&amp; slotEnd &gt; effectiveBookingStart) {
              isSlotAvailable = false;
              break;
            }
          }
          if (isSlotAvailable) {
            hasAvailableSlotInThisHall = true;
            break; 
          }
        }
        
        if (hasAvailableSlotInThisHall) {
          isDayFullyBookedForAllHalls = false; // Found an available slot in at least one hall
          break; 
        }
      }
      newDayStatus[format(day, 'yyyy-MM-dd')] = isDayFullyBookedForAllHalls ? 'fully-booked' : 'available';
    });
    setDayStatus(newDayStatus);
  }, [bookings, currentMonth]);

  const modifiers = {
    available: (date: Date) =&gt; dayStatus[format(date, 'yyyy-MM-dd')] === 'available',
    fullyBooked: (date: Date) =&gt; dayStatus[format(date, 'yyyy-MM-dd')] === 'fully-booked',
  };

  const modifiersClassNames = {
    available: 'day-available',
    fullyBooked: 'day-fully-booked',
  };

  return (
    &lt;div className="rounded-md border"&gt;
      &lt;Calendar
        mode="single"
        month={currentMonth}
        onMonthChange={onMonthChange}
        modifiers={modifiers}
        modifiersClassNames={modifiersClassNames}
        components={{
          Caption: ({ displayMonth }) =&gt; (
            &lt;div className="flex items-center justify-between px-2 py-1"&gt;
              &lt;h2 className="font-semibold text-lg"&gt;
                {format(displayMonth, 'MMMM yyyy')}
              &lt;/h2&gt;
              &lt;div className="space-x-1"&gt;
                &lt;Button
                  variant="outline"
                  size="icon"
                  className="h-7 w-7"
                  onClick={() =&gt; onMonthChange(subMonths(currentMonth, 1))}
                &gt;
                  &lt;ChevronLeft className="h-4 w-4" /&gt;
                  &lt;span className="sr-only"&gt;Previous month&lt;/span&gt;
                &lt;/Button&gt;
                &lt;Button
                  variant="outline"
                  size="icon"
                  className="h-7 w-7"
                  onClick={() =&gt; onMonthChange(addMonths(currentMonth, 1))}
                &gt;
                  &lt;ChevronRight className="h-4 w-4" /&gt;
                  &lt;span className="sr-only"&gt;Next month&lt;/span&gt;
                &lt;/Button&gt;
              &lt;/div&gt;
            &lt;/div&gt;
          ),
        }}
        className="p-3"
      /&gt;
    &lt;/div&gt;
  );
}
