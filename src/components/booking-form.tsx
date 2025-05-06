
'use client';

import * as React from 'react';
import {zodResolver} from '@hookform/resolvers/zod';
import {useForm} from 'react-hook-form';
import {z} from 'zod';
import {CalendarIcon, Loader2, User, CalendarDays, Building} from 'lucide-react';
import {format} from 'date-fns';

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
import {useToast} from '@/hooks/use-toast';
import {authorizeBooking, type AuthorizeBookingOutput} from '@/ai/flows/authorize-booking';

const bookingFormSchema = z.object({
  studentId: z.string().min(2, {
    message: 'Student ID must be at least 2 characters.',
    // Optionally add email validation if using email as ID
    // }).email({ message: "Please enter a valid email address."
  }),
  hallPreference: z.string().min(1, {
    message: 'Hall preference is required.',
  }),
  dates: z.date({
    required_error: 'Booking date is required.',
  }),
});

export type BookingFormData = z.infer<typeof bookingFormSchema>;

interface BookingFormProps {
  onSubmitSuccess: (result: (AuthorizeBookingOutput & { formData: BookingFormData }) | null, error?: string) => void;
  onLoadingChange: (isLoading: boolean) => void;
  isLoading: boolean;
  defaultStudentId?: string | null; // Optional prop to prefill student ID
}

export function BookingForm({ onSubmitSuccess, onLoadingChange, isLoading, defaultStudentId }: BookingFormProps) {
  const {toast} = useToast();

  const form = useForm<BookingFormData>({
    resolver: zodResolver(bookingFormSchema),
    defaultValues: {
      studentId: defaultStudentId || '', // Use defaultStudentId if provided
      hallPreference: '',
      dates: undefined,
    },
  });

   // Effect to reset the form if the defaultStudentId changes (e.g., user logs in/out)
   React.useEffect(() => {
     form.reset({
       studentId: defaultStudentId || '',
       hallPreference: '',
       dates: undefined,
     });
   }, [defaultStudentId, form]);


  async function onSubmit(data: BookingFormData) {
    onLoadingChange(true);
    try {
      // Simulate fetching student history and hall availability
      // In a real app, these would be fetched from a database or API based on the studentId (or logged-in user)
      const studentHistory = 'No major issues reported. Minor noise complaint in previous semester.';
      const hallAvailability = 'Hall A is available on the requested date. Hall B is booked.';

      const aiInput = {
        studentId: data.studentId,
        hallPreference: data.hallPreference,
        dates: format(data.dates, 'PPP'), // Format date to string for AI
        studentHistory: studentHistory,
        hallAvailability: hallAvailability,
      };

      const authorizationResult = await authorizeBooking(aiInput);

      onSubmitSuccess({ ...authorizationResult, formData: data });
      toast({
        title: 'Booking Submitted',
        description: 'Your booking request has been processed.',
      });
      // Don't reset form here, let the parent component handle visibility/reset
      // form.reset();

    } catch (error) {
       console.error('Booking submission error:', error);
       const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred.';
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

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 rounded-lg border bg-card p-6 shadow-sm">
        <FormField
          control={form.control}
          name="studentId"
          render={({field}) => (
            <FormItem>
              <FormLabel className="flex items-center gap-2">
                <User className="h-4 w-4 text-muted-foreground" /> Student ID
              </FormLabel>
              <FormControl>
                {/* Consider making this read-only if prefilled and linked to the logged-in user */}
                <Input
                    placeholder="Enter your student ID or email"
                    {...field}
                    // disabled={!!defaultStudentId} // Optionally disable if prefilled
                 />
              </FormControl>
              <FormDescription>Your unique college identification number or email.</FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="hallPreference"
          render={({field}) => (
            <FormItem>
              <FormLabel className="flex items-center gap-2">
                <Building className="h-4 w-4 text-muted-foreground" /> Hall Preference
              </FormLabel>
              <FormControl>
                <Input placeholder="e.g., Main Hall, North Wing" {...field} />
              </FormControl>
              <FormDescription>Specify the hall you wish to book.</FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="dates"
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
                    >
                      {field.value ? format(field.value, 'PPP') : <span>Pick a date</span>}
                      <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                    </Button>
                  </FormControl>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={field.value}
                    onSelect={field.onChange}
                    disabled={(date) => date < new Date(new Date().setHours(0, 0, 0, 0))} // Disable past dates
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
              <FormDescription>Select the date for your booking.</FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button type="submit" disabled={isLoading} className="w-full bg-accent text-accent-foreground hover:bg-accent/90">
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
