
'use client';

import * as React from 'react';
import { Calendar } from '@/components/ui/calendar';
import { Button } from '@/components/ui/button';
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
  addHours
} from 'date-fns';
import { useToast } from '@/hooks/use-toast'; // Import useToast

interface VenueCalendarProps {
  bookings: BookingRequest[];
  currentMonth: Date;
  onMonthChange: (newMonth: Date) => void;
  onDateSelect?: (date: Date) => void; // Callback for date selection
  selectedDate?: Date; // To highlight the selected date
}

// Define standard operational hours and booking duration
const OPERATIONAL_START_HOUR = 9; // 9 AM
const OPERATIONAL_END_HOUR = 17; // 5 PM
const BOOKING_DURATION_HOURS = 1;
const GAP_DURATION_HOURS = 1; // 1-hour gap

const getAllPossibleSlots = () => {
  const slots = [];
  for (let hour = OPERATIONAL_START_HOUR; hour < OPERATIONAL_END_HOUR; hour++) {
    slots.push({ start: hour, end: hour + BOOKING_DURATION_HOURS });
  }
  return slots;
};
const ALL_POSSIBLE_SLOTS = getAllPossibleSlots();

const getUniqueHalls = (bookings: BookingRequest[]): string[] => {
    const halls = new Set(bookings.map(b => b.hallPreference));
    if (halls.size === 0) {
        return ["Main Hall", "Seminar Room A", "Conference Room B"]; // Default halls
    }
    return Array.from(halls);
};


export function VenueCalendar({ bookings, currentMonth, onMonthChange, onDateSelect, selectedDate }: VenueCalendarProps) {
  const { toast } = useToast(); // Initialize toast
  const [dayStatus, setDayStatus] = React.useState<Record<string, 'available' | 'fully-booked'>>({});

  React.useEffect(() => {
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(currentMonth);
    const daysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd });
    const newDayStatus: Record<string, 'available' | 'fully-booked'> = {};
    
    const ALL_HALLS = getUniqueHalls(bookings);
    if (ALL_HALLS.length === 0) { 
        daysInMonth.forEach(day => {
            newDayStatus[format(day, 'yyyy-MM-dd')] = 'available';
        });
        setDayStatus(newDayStatus);
        return;
    }

    daysInMonth.forEach(day => {
      let isDayFullyBookedForAllHalls = true;

      for (const hall of ALL_HALLS) {
        const bookingsForHallOnDay = bookings.filter(
          b => isSameDay(b.startTimeDate || b.date, day) && b.hallPreference === hall && (b.status === 'approved' || b.status === 'pending'))
        .map(b => {
            let sd, ed;
            if (b.startTimeDate && b.endTimeDate) {
                sd = b.startTimeDate;
                ed = b.endTimeDate;
            } else { 
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
            const effectiveBookingStart = addHours(booking.start, -GAP_DURATION_HOURS);
            const effectiveBookingEnd = addHours(booking.end, GAP_DURATION_HOURS);
            if (slotStart < effectiveBookingEnd && slotEnd > effectiveBookingStart) {
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
          isDayFullyBookedForAllHalls = false; 
          break; 
        }
      }
      newDayStatus[format(day, 'yyyy-MM-dd')] = isDayFullyBookedForAllHalls ? 'fully-booked' : 'available';
    });
    setDayStatus(newDayStatus);
  }, [bookings, currentMonth]);

  const handleDateSelect = (date: Date | undefined) => {
    if (!date) return;
    const dateKey = format(date, 'yyyy-MM-dd');
    if (dayStatus[dateKey] === 'fully-booked') {
      toast({
        title: 'Fully Booked',
        description: `No slots available on ${format(date, 'PPP')}. Please select another date.`,
        variant: 'destructive',
      });
    } else if (onDateSelect) {
      onDateSelect(date);
    }
  };

  const modifiers = {
    available: (date: Date) => dayStatus[format(date, 'yyyy-MM-dd')] === 'available',
    fullyBooked: (date: Date) => dayStatus[format(date, 'yyyy-MM-dd')] === 'fully-booked',
    selected: selectedDate ? (date: Date) => isSameDay(date, selectedDate) : undefined,
  };

  const modifiersClassNames = {
    available: 'day-available',
    fullyBooked: 'day-fully-booked',
    selected: 'day-selected-custom', // Custom class for selected date styling if needed
  };

  return (
    <div className="rounded-md border">
      <Calendar
        mode="single"
        month={currentMonth}
        onMonthChange={onMonthChange}
        selected={selectedDate} // Pass selectedDate to Calendar
        onSelect={handleDateSelect} // Use internal handler
        modifiers={modifiers}
        modifiersClassNames={modifiersClassNames}
        components={{
          Caption: ({ displayMonth }) => (
            <div className="flex items-center justify-between px-2 py-1">
              <h2 className="font-semibold text-lg">
                {format(displayMonth, 'MMMM yyyy')}
              </h2>
              <div className="space-x-1">
                <Button
                  variant="outline"
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => onMonthChange(subMonths(currentMonth, 1))}
                >
                  <ChevronLeft className="h-4 w-4" />
                  <span className="sr-only">Previous month</span>
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => onMonthChange(addMonths(currentMonth, 1))}
                >
                  <ChevronRight className="h-4 w-4" />
                  <span className="sr-only">Next month</span>
                </Button>
              </div>
            </div>
          ),
        }}
        className="p-3"
      />
    </div>
  );
}
