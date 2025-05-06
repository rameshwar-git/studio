
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

   const checkAvailability = async (hall: string, date: Date, startTime: string, endTime: string): Promise<boolean> => {
        const selectedDateStart = startOfDay(date);
        const [startH, startM] = startTime.split(':').map(Number);
        const [endH, endM] = endTime.split(':').map(Number);

        const newBookingStart = setMinutes(setHours(selectedDateStart, startH), startM);
        const newBookingEnd = setMinutes(setHours(selectedDateStart, endH), endM);

        const existingBookings = await getHallBookingsForDate(hall, selectedDateStart);

        for (const booking of existingBookings) {
            const existingStart = booking.startTimeDate!; 
            const existingEnd = booking.endTimeDate!;   

            const existingRangeStart = addHours(existingStart, -1);
            const existingRangeEnd = addHours(existingEnd, 1);

            if (isBefore(newBookingStart, existingRangeEnd) && isBefore(existingRangeStart, newBookingEnd)) {
                if (isBefore(newBookingStart, addHours(existingEnd,1)) && isBefore(addHours(existingStart, -1), newBookingEnd)) {
                    return false; 
                }
            }
        }
        return true; 
    };


  async function onSubmit(data: BookingFormData) {
    onLoadingChange(true);
    setError(null); 
    try {
      const isAvailable = await checkAvailability(data.hallPreference, data.date, data.startTime, data.endTime);
      if (!isAvailable) {
        setError(`The selected time slot for ${data.hallPreference} is not available due to an existing booking or required 1-hour gap. Please choose a different time or hall.`);
        onSubmitSuccess(null, `Selected slot for ${data.hallPreference} is unavailable.`);
        return;
      }

      const studentHistory = 'No major issues reported.'; 
      const hallAvailability = 'Hall availability data is complex and dynamic.'; 

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
      form.reset({ // Reset form after successful submission
          studentName: userProfile?.name || '',
          studentEmail: userProfile?.email || '',
          hallPreference: '',
          date: undefined, // Clear date
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
  const [error, setError] = React.useState<string | null>(null);


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
                            // Reset time fields when date changes manually
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
                            form.setValue('endTime', ''); // Reset end time when start time changes
                        }} 
                        value={field.value} // Use value instead of defaultValue for controlled component
                        disabled={!form.watch('date')} // Disable if date not selected
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
                        value={field.value} // Use value
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
