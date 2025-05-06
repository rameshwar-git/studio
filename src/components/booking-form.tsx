'use client';

import * as React from 'react';
import {zodResolver} from '@hookform/resolvers/zod';
import {useForm} from 'react-hook-form';
import {z} from 'zod';
import {CalendarIcon, Loader2, User, CalendarDays, Building, Clock, Mail} from 'lucide-react';
import {format, addHours, setHours, setMinutes, isBefore, isEqual, startOfDay} from 'date-fns';

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
import { getHallBookingsForDate } from '@/services/firestore'; // For availability check

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
    // Basic check: end time must be after start time
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
  onSubmitSuccess: (result: (AuthorizeBookingOutput &amp; { formData: BookingFormData }) | null, error?: string) =&gt; void;
  onLoadingChange: (isLoading: boolean) =&gt; void;
  isLoading: boolean;
  userProfile: UserProfileData | null;
}

// Helper to generate time slots
const generateTimeSlots = () =&gt; {
    const slots = [];
    const Tslots = [];
    const startHour = 9;
    const endHour = 17; // 5 PM
    for (let hour = startHour; hour &lt; endHour; hour++) {
        slots.push(`${String(hour).padStart(2, '0')}:00`);
        slots.push(`${String(hour).padStart(2, '0')}:30`);
    }
    slots.push(`${String(endHour).padStart(2, '0')}:00`); // Add 5:00 PM as a possible end time

    // For end time, we need slots up to 5 PM. For start time, up to 4:30 PM.
    // Assuming 1 hour booking slot minimum
    for (let hour = startHour; hour &lt;= endHour; hour++) {
        Tslots.push(`${String(hour).padStart(2, '0')}:00`);
        if (hour &lt; endHour) { // Don't add 5:30 PM for example
          Tslots.push(`${String(hour).padStart(2, '0')}:30`);
        }
    }

    return { startSlots: Tslots.slice(0, -1), endSlots: Tslots.slice(1) }; // start up to 4:30, end up to 5:00
};

const { startSlots, endSlots } = generateTimeSlots();

export function BookingForm({ onSubmitSuccess, onLoadingChange, isLoading, userProfile }: BookingFormProps) {
  const {toast} = useToast();

  const form = useForm&lt;BookingFormData&gt;({
    resolver: zodResolver(bookingFormSchema),
    defaultValues: {
      studentName: userProfile?.name || '',
      studentEmail: userProfile?.email || '',
      hallPreference: '',
      date: undefined,
      startTime: '',
      endTime: '',
    },
  });

   React.useEffect(() =&gt; {
     form.reset({
       studentName: userProfile?.name || '',
       studentEmail: userProfile?.email || '',
       hallPreference: '',
       date: undefined,
       startTime: '',
       endTime: '',
     });
   }, [userProfile, form]);

   const checkAvailability = async (hall: string, date: Date, startTime: string, endTime: string): Promise&lt;boolean&gt; =&gt; {
        const selectedDateStart = startOfDay(date);
        const [startH, startM] = startTime.split(':').map(Number);
        const [endH, endM] = endTime.split(':').map(Number);

        const newBookingStart = setMinutes(setHours(selectedDateStart, startH), startM);
        const newBookingEnd = setMinutes(setHours(selectedDateStart, endH), endM);

        // Fetch existing bookings for the hall on the selected date
        const existingBookings = await getHallBookingsForDate(hall, selectedDateStart);

        for (const booking of existingBookings) {
            const existingStart = booking.startTimeDate!; // Should be populated by getHallBookingsForDate
            const existingEnd = booking.endTimeDate!;   // Should be populated by getHallBookingsForDate

            // Conflict if new booking overlaps with (existing booking +/- 1 hour gap)
            // New booking [S_new, E_new]
            // Existing booking effective range [S_exist - 1hr, E_exist + 1hr]
            const existingRangeStart = addHours(existingStart, -1);
            const existingRangeEnd = addHours(existingEnd, 1);

            // Check for overlap:
            // (StartA &lt; EndB) and (EndA &gt; StartB)
            if (isBefore(newBookingStart, existingRangeEnd) &amp;&amp; isBefore(existingRangeStart, newBookingEnd)) {
                 // More precise check: If new start is within 1 hour of existing end OR new end is within 1 hour of existing start
                if (isBefore(newBookingStart, addHours(existingEnd,1)) &amp;&amp; isBefore(addHours(existingStart, -1), newBookingEnd)) {
                    return false; // Conflict
                }
            }
        }
        return true; // No conflicts
    };


  async function onSubmit(data: BookingFormData) {
    onLoadingChange(true);
    setError(null); // Clear previous errors
    try {
      const isAvailable = await checkAvailability(data.hallPreference, data.date, data.startTime, data.endTime);
      if (!isAvailable) {
        setError(`The selected time slot for ${data.hallPreference} is not available due to an existing booking or required 1-hour gap. Please choose a different time or hall.`);
        onSubmitSuccess(null, `Selected slot for ${data.hallPreference} is unavailable.`);
        return;
      }

      const studentHistory = 'No major issues reported.'; // Simulated
      const hallAvailability = 'Hall availability data is complex and dynamic.'; // Simulated for AI context

      const aiInput = {
        studentId: data.studentEmail, // Using email as studentId for AI
        hallPreference: data.hallPreference,
        dates: format(data.date, 'PPP'), // Format date to string for AI
        startTime: data.startTime,
        endTime: data.endTime,
        studentHistory: studentHistory,
        hallAvailability: hallAvailability, // This could be a summary or specific status
      };

      const authorizationResult = await authorizeBooking(aiInput);

      onSubmitSuccess({ ...authorizationResult, formData: data });
      toast({
        title: 'Booking Submitted',
        description: 'Your booking request has been processed.',
      });
      // Form will be hidden by parent or reset if user makes another booking
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
  const [error, setError] = React.useState&lt;string | null&gt;(null);


  return (
    &lt;Form {...form}&gt;
      &lt;form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 rounded-lg border bg-card p-6 shadow-sm"&gt;
        &lt;div className="grid grid-cols-1 gap-4 md:grid-cols-2"&gt;
            &lt;FormField
            control={form.control}
            name="studentName"
            render={({field}) =&gt; (
                &lt;FormItem&gt;
                &lt;FormLabel className="flex items-center gap-2"&gt;
                    &lt;User className="h-4 w-4 text-muted-foreground" /&gt; Student Name
                &lt;/FormLabel&gt;
                &lt;FormControl&gt;
                    &lt;Input placeholder="Your full name" {...field} readOnly={!!userProfile?.name} /&gt;
                &lt;/FormControl&gt;
                &lt;FormMessage /&gt;
                &lt;/FormItem&gt;
            )}
            /&gt;
            &lt;FormField
            control={form.control}
            name="studentEmail"
            render={({field}) =&gt; (
                &lt;FormItem&gt;
                &lt;FormLabel className="flex items-center gap-2"&gt;
                    &lt;Mail className="h-4 w-4 text-muted-foreground" /&gt; Student Email
                &lt;/FormLabel&gt;
                &lt;FormControl&gt;
                    &lt;Input type="email" placeholder="your.email@university.edu" {...field} readOnly={!!userProfile?.email} /&gt;
                &lt;/FormControl&gt;
                &lt;FormMessage /&gt;
                &lt;/FormItem&gt;
            )}
            /&gt;
        &lt;/div&gt;
        &lt;FormField
          control={form.control}
          name="hallPreference"
          render={({field}) =&gt; (
            &lt;FormItem&gt;
              &lt;FormLabel className="flex items-center gap-2"&gt;
                &lt;Building className="h-4 w-4 text-muted-foreground" /&gt; Hall Preference
              &lt;/FormLabel&gt;
              &lt;FormControl&gt;
                &lt;Input placeholder="e.g., Main Hall, Seminar Room A" {...field} /&gt;
              &lt;/FormControl&gt;
              &lt;FormDescription&gt;Specify the hall you wish to book.&lt;/FormDescription&gt;
              &lt;FormMessage /&gt;
            &lt;/FormItem&gt;
          )}
        /&gt;
        &lt;FormField
          control={form.control}
          name="date"
          render={({field}) =&gt; (
            &lt;FormItem className="flex flex-col"&gt;
              &lt;FormLabel className="flex items-center gap-2"&gt;
                &lt;CalendarDays className="h-4 w-4 text-muted-foreground" /&gt; Booking Date
              &lt;/FormLabel&gt;
              &lt;Popover&gt;
                &lt;PopoverTrigger asChild&gt;
                  &lt;FormControl&gt;
                    &lt;Button
                      variant={'outline'}
                      className={cn(
                        'w-full pl-3 text-left font-normal',
                        !field.value &amp;&amp; 'text-muted-foreground'
                      )}
                    &gt;
                      {field.value ? format(field.value, 'PPP') : &lt;span&gt;Pick a date&lt;/span&gt;}
                      &lt;CalendarIcon className="ml-auto h-4 w-4 opacity-50" /&gt;
                    &lt;/Button&gt;
                  &lt;/FormControl&gt;
                &lt;/PopoverTrigger&gt;
                &lt;PopoverContent className="w-auto p-0" align="start"&gt;
                  &lt;Calendar
                    mode="single"
                    selected={field.value}
                    onSelect={field.onChange}
                    disabled={(date) =&gt; date &lt; startOfDay(new Date())} // Disable past dates
                    initialFocus
                  /&gt;
                &lt;/PopoverContent&gt;
              &lt;/Popover&gt;
              &lt;FormDescription&gt;Select the date for your booking.&lt;/FormDescription&gt;
              &lt;FormMessage /&gt;
            &lt;/FormItem&gt;
          )}
        /&gt;
        &lt;div className="grid grid-cols-1 gap-4 md:grid-cols-2"&gt;
            &lt;FormField
                control={form.control}
                name="startTime"
                render={({ field }) =&gt; (
                &lt;FormItem&gt;
                    &lt;FormLabel className="flex items-center gap-2"&gt;&lt;Clock className="h-4 w-4 text-muted-foreground" /&gt; Start Time&lt;/FormLabel&gt;
                    &lt;Select onValueChange={field.onChange} defaultValue={field.value}&gt;
                    &lt;FormControl&gt;
                        &lt;SelectTrigger&gt;
                        &lt;SelectValue placeholder="Select start time" /&gt;
                        &lt;/SelectTrigger&gt;
                    &lt;/FormControl&gt;
                    &lt;SelectContent&gt;
                        {startSlots.map(time =&gt; (
                        &lt;SelectItem key={`start-${time}`} value={time}&gt;{format(setMinutes(setHours(new Date(), parseInt(time.split(':')[0])), parseInt(time.split(':')[1])), 'p')}&lt;/SelectItem&gt;
                        ))}
                    &lt;/SelectContent&gt;
                    &lt;/Select&gt;
                    &lt;FormMessage /&gt;
                &lt;/FormItem&gt;
                )}
            /&gt;
            &lt;FormField
                control={form.control}
                name="endTime"
                render={({ field }) =&gt; (
                &lt;FormItem&gt;
                    &lt;FormLabel className="flex items-center gap-2"&gt;&lt;Clock className="h-4 w-4 text-muted-foreground" /&gt; End Time&lt;/FormLabel&gt;
                    &lt;Select onValueChange={field.onChange} defaultValue={field.value}
                        disabled={!form.watch('startTime')} // Disable if start time not selected
                    &gt;
                    &lt;FormControl&gt;
                        &lt;SelectTrigger&gt;
                        &lt;SelectValue placeholder="Select end time" /&gt;
                        &lt;/SelectTrigger&gt;
                    &lt;/FormControl&gt;
                    &lt;SelectContent&gt;
                        {endSlots
                        .filter(time =&gt; {
                            const selectedStartTime = form.watch('startTime');
                            if (!selectedStartTime) return true; // Show all if start time not selected
                            const [startH, startM] = selectedStartTime.split(':').map(Number);
                            const [currentEndH, currentEndM] = time.split(':').map(Number);
                            // End time must be at least 30 mins after start time
                            return currentEndH &gt; startH || (currentEndH === startH &amp;&amp; currentEndM &gt; startM);
                        })
                        .map(time =&gt; (
                        &lt;SelectItem key={`end-${time}`} value={time}&gt;{format(setMinutes(setHours(new Date(), parseInt(time.split(':')[0])), parseInt(time.split(':')[1])), 'p')}&lt;/SelectItem&gt;
                        ))}
                    &lt;/SelectContent&gt;
                    &lt;/Select&gt;
                    &lt;FormDescription&gt;A 1-hour gap will be enforced around your booking.&lt;/FormDescription&gt;
                    &lt;FormMessage /&gt;
                &lt;/FormItem&gt;
                )}
            /&gt;
        &lt;/div&gt;
         {error &amp;&amp; &lt;p className="text-sm font-medium text-destructive"&gt;{error}&lt;/p&gt;}
        &lt;Button type="submit" disabled={isLoading} className="w-full bg-accent text-accent-foreground hover:bg-accent/90"&gt;
          {isLoading ? (
            &lt;&gt;
              &lt;Loader2 className="mr-2 h-4 w-4 animate-spin" /&gt; Submitting...
            &lt;/&gt;
          ) : (
            'Submit Booking Request'
          )}
        &lt;/Button&gt;
      &lt;/form&gt;
    &lt;/Form&gt;
  );
}
