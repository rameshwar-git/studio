'use client';

import * as React from 'react';
import {zodResolver} from '@hookform/resolvers/zod';
import {useForm} from 'react-hook-form';
import {z} from 'zod';
import {CalendarIcon, Loader2, User, CalendarDays, Building, Clock, Mail} from 'lucide-react';
import {format, addHours, setHours, setMinutes, isBefore, isEqual, startOfDay, parseISO} from 'date-fns';

import {cn} from '@/lib/utils';
import {Button} from '@/components/ui/button';
import {Calendar} from '@/components/ui/calendar';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import {Input} from '@/components/ui/input';
import {Popover, PopoverContent, PopoverTrigger} from '@/components/ui/popover';
import {Select, SelectContent, SelectItem, SelectTrigger, SelectValue} from '@/components/ui/select';
import {useToast} from '@/hooks/use-toast';
import {authorizeBooking, type AuthorizeBookingOutput} from '@/ai/flows/authorize-booking';
import type {UserProfileData} from '@/services/firestore';
import { getHallBookingsForDateFromRealtimeDB } from '@/services/firestore'; // For availability check from RTDB

const bookingFormSchema = z.object({
  studentName: z.string().min(2, { message: 'Student name must be at least 2 characters.' }),
  studentEmail: z.string().email({ message: 'Please enter a valid email address.' }),
  hallPreference: z.string().min(1, {
    message: 'Hall preference is required.',
  }),
  date: z.date({
    required_error: 'Booking date is required.',
  }),
  startTime: z.string().min(1, { message: 'Start time is required.' }),
  endTime: z.string().min(1, { message: 'End time is required.' }),
}).refine(data => {
    if (data.startTime && data.endTime) {
        const [startHour, startMinute] = data.startTime.split(':').map(Number);
        const [endHour, endMinute] = data.endTime.split(':').map(Number);
        if (endHour < startHour || (endHour === startHour && endMinute <= startMinute)) {
            return false;
        }
    }
    return true;
}, {
    message: 'End time must be after start time.',
    path: ['endTime'],
});

export type BookingFormData = z.infer<typeof bookingFormSchema>;

interface BookingFormProps {
  onSubmitSuccess: (result: (AuthorizeBookingOutput & { formData: BookingFormData }) | null, error?: string) => void;
  onLoadingChange: (isLoading: boolean) => void;
  isLoading: boolean;
  userProfile: UserProfileData | null;
  preselectedDate?: Date; // New prop for preselected date
}

const generateTimeSlots = () => {
    const slots = [];
    const Tslots = [];
    const startHour = 9;
    const endHour = 17; 
    for (let hour = startHour; hour < endHour; hour++) {
        slots.push(`${String(hour).padStart(2, '0')}:00`);
        slots.push(`${String(hour).padStart(2, '0')}:30`);
    }
    slots.push(`${String(endHour).padStart(2, '0')}:00`); 

    for (let hour = startHour; hour <= endHour; hour++) {
        Tslots.push(`${String(hour).padStart(2, '0')}:00`);
        if (hour < endHour) { 
          Tslots.push(`${String(hour).padStart(2, '0')}:30`);
        }
    }

    return { startSlots: Tslots.slice(0, -1), endSlots: Tslots.slice(1) }; 
};

const { startSlots, endSlots } = generateTimeSlots();

export function BookingForm({ onSubmitSuccess, onLoadingChange, isLoading, userProfile, preselectedDate }: BookingFormProps) {
  const {toast} = useToast();

  const form = useForm<BookingFormData>({
    resolver: zodResolver(bookingFormSchema),
    defaultValues: {
      studentName: userProfile?.name || '',
      studentEmail: userProfile?.email || '',
      hallPreference: '',
      date: preselectedDate || undefined,
      startTime: '',
      endTime: '',
    },
  });

   React.useEffect(() => {
     form.reset({
       studentName: userProfile?.name || '',
       studentEmail: userProfile?.email || '',
       hallPreference: '',
       date: preselectedDate || form.getValues('date') || undefined, // Use preselectedDate if available
       startTime: '', // Reset times when date changes or form re-initializes
       endTime: '',
     });
   }, [userProfile, preselectedDate, form]);

   const checkAvailabilityWithRTDB = async (hall: string, date: Date, startTime: string, endTime: string): Promise<{available: boolean, rtdbDataExists: boolean}> => {
        const selectedDateStartOfDay = startOfDay(date);
        const [startH, startM] = startTime.split(':').map(Number);
        const [endH, endM] = endTime.split(':').map(Number);

        const newBookingStart = setMinutes(setHours(selectedDateStartOfDay, startH), startM);
        const newBookingEnd = setMinutes(setHours(selectedDateStartOfDay, endH), endM);

        let existingBookingsRTDB: any[] = [];
        let rtdbDataFoundInitially = false; 
        try {
            existingBookingsRTDB = await getHallBookingsForDateFromRealtimeDB(hall, selectedDateStartOfDay);
            rtdbDataFoundInitially = existingBookingsRTDB.length > 0;
        } catch (rtdbError: any) {
            // This catch block might not be hit if getHallBookingsForDateFromRealtimeDB handles its own errors and returns []
            console.warn("Error fetching booking data from Realtime Database for availability check:", rtdbError.message);
            return { available: true, rtdbDataExists: false }; // Treat as no data found
        }
        
        if (!rtdbDataFoundInitially) {
            // Case 1: No data available in Realtime Database for this hall/date. Proceed with booking.
            console.log("No existing bookings found in RTDB for this hall/date. Proceeding.");
            return { available: true, rtdbDataExists: false };
        }
        
        // Case 2: Data available in Realtime Database. Check for conflicts.
        console.log(`Found ${existingBookingsRTDB.length} bookings in RTDB for ${hall} on ${format(date, 'PPP')}. Checking for conflicts.`);
        for (const booking of existingBookingsRTDB) {
             const existingStart = booking.startTimeISO ? parseISO(booking.startTimeISO) : new Date(booking.startTime);
             const existingEnd = booking.endTimeISO ? parseISO(booking.endTimeISO) : new Date(booking.endTime);

            const existingRangeStart = addHours(existingStart, -1); // 1-hour gap before
            const existingRangeEnd = addHours(existingEnd, 1); // 1-hour gap after

            if (isBefore(newBookingStart, existingRangeEnd) && isBefore(existingRangeStart, newBookingEnd)) {
                 console.log("Conflict found with existing RTDB booking:", booking);
                 return { available: false, rtdbDataExists: true }; 
            }
        }
        console.log("No conflicts found with existing RTDB bookings.");
        return { available: true, rtdbDataExists: true }; 
    };


  async function onSubmit(data: BookingFormData) {
    onLoadingChange(true);
    setError(null); 
    try {
      const { available: isAvailable, rtdbDataExists } = await checkAvailabilityWithRTDB(data.hallPreference, data.date, data.startTime, data.endTime);
      
      if (rtdbDataExists && !isAvailable) {
        // Case 2: Data available, slot booked
        setError(`No booking is available for ${data.hallPreference} at the selected time. This slot (including 1-hour gaps) conflicts with an existing booking.`);
        onSubmitSuccess(null, `Selected slot for ${data.hallPreference} is unavailable due to conflict.`);
        onLoadingChange(false); // Ensure loading is set to false
        return;
      }
      // If !rtdbDataExists (Case 1), we proceed.
      // If rtdbDataExists and isAvailable (Case 2, but slot is free), we proceed.

      const studentHistory = 'No major issues reported.'; 
      const hallAvailability = rtdbDataExists 
        ? (isAvailable ? `Slot for ${data.hallPreference} appears available based on Realtime Database check.` : `Slot for ${data.hallPreference} has a conflict in Realtime Database.`)
        : `Availability for ${data.hallPreference} not checked against Realtime Database (no prior bookings for this hall/date).`;

      const aiInput = {
        studentId: data.studentEmail, 
        hallPreference: data.hallPreference,
        dates: format(data.date, 'PPP'), 
        startTime: data.startTime,
        endTime: data.endTime,
        studentHistory: studentHistory,
        hallAvailability: hallAvailability, 
      };

      const authorizationResult = await authorizeBooking(aiInput);

      onSubmitSuccess({ ...authorizationResult, formData: data });
      toast({
        title: 'Booking Submitted',
        description: 'Your booking request has been processed.',
      });
      form.reset({ 
          studentName: userProfile?.name || '',
          studentEmail: userProfile?.email || '',
          hallPreference: '',
          date: undefined, 
          startTime: '',
          endTime: '',
      });
    } catch (error) {
       console.error('Booking submission error:', error);
       const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred.';
       setError(`Booking submission failed: ${errorMessage}`);
       onSubmitSuccess(null, `Failed to process booking: ${errorMessage}`);
       toast({
        title: 'Booking Error',
        description: `Failed to submit booking: ${errorMessage}`,
        variant: 'destructive',
       });
    } finally {
      onLoadingChange(false);
    }
  }
  const [error, setErrorReact] = React.useState<string | null>(null); // Renamed to avoid conflict with global error

  // Custom setError function to also log to console for better debugging
  const setError = (message: string | null) => {
    if (message) {
      console.log("Setting error in BookingForm: ", message);
    }
    setErrorReact(message);
  };


  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 rounded-lg border bg-card p-6 shadow-sm">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <FormField
            control={form.control}
            name="studentName"
            render={({field}) => (
                <FormItem>
                <FormLabel className="flex items-center gap-2">
                    <User className="h-4 w-4 text-muted-foreground" /> Student Name
                </FormLabel>
                <FormControl>
                    <Input placeholder="Your full name" {...field} readOnly={!!userProfile?.name} />
                </FormControl>
                <FormMessage />
                </FormItem>
            )}
            />
            <FormField
            control={form.control}
            name="studentEmail"
            render={({field}) => (
                <FormItem>
                <FormLabel className="flex items-center gap-2">
                    <Mail className="h-4 w-4 text-muted-foreground" /> Student Email
                </FormLabel>
                <FormControl>
                    <Input type="email" placeholder="your.email@university.edu" {...field} readOnly={!!userProfile?.email} />
                </FormControl>
                <FormMessage />
                </FormItem>
            )}
            />
        </div>
        <FormField
          control={form.control}
          name="hallPreference"
          render={({field}) => (
            <FormItem>
              <FormLabel className="flex items-center gap-2">
                <Building className="h-4 w-4 text-muted-foreground" /> Hall Preference
              </FormLabel>
              <FormControl>
                <Input placeholder="e.g., Main Hall, Seminar Room A" {...field} />
              </FormControl>
              <FormDescription>Specify the hall you wish to book.</FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="date"
          render={({field}) => (
            <FormItem className="flex flex-col">
              <FormLabel className="flex items-center gap-2">
                <CalendarDays className="h-4 w-4 text-muted-foreground" /> Booking Date
              </FormLabel>
              <Popover>
                <PopoverTrigger asChild>
                  <FormControl>
                    <Button
                      variant={'outline'}
                      className={cn(
                        'w-full pl-3 text-left font-normal',
                        !field.value && 'text-muted-foreground'
                      )}
                       disabled={!!preselectedDate} // Disable if date is preselected from calendar
                    >
                      {field.value ? format(field.value, 'PPP') : <span>Pick a date</span>}
                      <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                    </Button>
                  </FormControl>
                </PopoverTrigger>
                 {!preselectedDate && ( // Only show popover if date is not preselected
                    <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                        mode="single"
                        selected={field.value}
                        onSelect={(date) => {
                            field.onChange(date);
                            form.setValue('startTime', '');
                            form.setValue('endTime', '');
                        }}
                        disabled={(date) => date < startOfDay(new Date())} 
                        initialFocus
                    />
                    </PopoverContent>
                 )}
              </Popover>
              <FormDescription>Select the date for your booking.</FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <FormField
                control={form.control}
                name="startTime"
                render={({ field }) => (
                <FormItem>
                    <FormLabel className="flex items-center gap-2"><Clock className="h-4 w-4 text-muted-foreground" /> Start Time</FormLabel>
                    <Select 
                        onValueChange={(value) => {
                            field.onChange(value);
                            form.setValue('endTime', ''); 
                        }} 
                        value={field.value} 
                        disabled={!form.watch('date')} 
                    >
                    <FormControl>
                        <SelectTrigger>
                        <SelectValue placeholder="Select start time" />
                        </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                        {startSlots.map(time => (
                        <SelectItem key={`start-${time}`} value={time}>{format(setMinutes(setHours(new Date(), parseInt(time.split(':')[0])), parseInt(time.split(':')[1])), 'p')}</SelectItem>
                        ))}
                    </SelectContent>
                    </Select>
                    <FormMessage />
                </FormItem>
                )}
            />
            <FormField
                control={form.control}
                name="endTime"
                render={({ field }) => (
                <FormItem>
                    <FormLabel className="flex items-center gap-2"><Clock className="h-4 w-4 text-muted-foreground" /> End Time</FormLabel>
                    <Select 
                        onValueChange={field.onChange} 
                        value={field.value} 
                        disabled={!form.watch('startTime')} 
                    >
                    <FormControl>
                        <SelectTrigger>
                        <SelectValue placeholder="Select end time" />
                        </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                        {endSlots
                        .filter(time => {
                            const selectedStartTime = form.watch('startTime');
                            if (!selectedStartTime) return true; 
                            const [startH, startM] = selectedStartTime.split(':').map(Number);
                            const [currentEndH, currentEndM] = time.split(':').map(Number);
                            return currentEndH > startH || (currentEndH === startH && currentEndM > startM);
                        })
                        .map(time => (
                        <SelectItem key={`end-${time}`} value={time}>{format(setMinutes(setHours(new Date(), parseInt(time.split(':')[0])), parseInt(time.split(':')[1])), 'p')}</SelectItem>
                        ))}
                    </SelectContent>
                    </Select>
                    <FormDescription>A 1-hour gap will be enforced around your booking.</FormDescription>
                    <FormMessage />
                </FormItem>
                )}
            />
        </div>
         {error && <p className="text-sm font-medium text-destructive">{error}</p>}
        <Button type="submit" disabled={isLoading || !form.watch('date')} className="w-full bg-accent text-accent-foreground hover:bg-accent/90">
          {isLoading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Submitting...
            </>
          ) : (
            'Submit Booking Request'
          )}
        </Button>
      </form>
    </Form>
  );
}
