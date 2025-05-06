import type * as React from 'react';
import { CheckCircle, User, Building, CalendarDays, Mail, Clock, Info } from 'lucide-react';
import { format, parse } from 'date-fns';
import type { BookingFormData } from './booking-form';
import type { AuthorizeBookingOutput } from '@/ai/flows/authorize-booking';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';

interface BookingConfirmationProps {
  bookingDetails: BookingFormData;
  authorization: AuthorizeBookingOutput;
  bookingId?: string; // Optional booking ID from Firestore
}

export function BookingConfirmation({ bookingDetails, authorization, bookingId }: BookingConfirmationProps) {
  const { studentName, studentEmail, hallPreference, date, startTime, endTime } = bookingDetails;
  const { requiresDirectorApproval, reason } = authorization;

  const getStatusBadge = () =&gt; {
    if (requiresDirectorApproval) {
      return &lt;Badge variant="destructive" className="mb-1 bg-yellow-500 text-yellow-900 hover:bg-yellow-500/80"&gt;Pending Director Approval&lt;/Badge&gt;;
    } else {
      return &lt;Badge variant="default" className="mb-1 bg-green-600 hover:bg-green-600/80"&gt;Auto-Processed&lt;/Badge&gt;;
    }
  };

   const getStatusIcon = () =&gt; {
    if (requiresDirectorApproval) {
       return &lt;Mail className="mt-1 h-5 w-5 flex-shrink-0 text-yellow-600" /&gt;;
    } else {
      return &lt;CheckCircle className="mt-1 h-5 w-5 flex-shrink-0 text-green-600" /&gt;;
    }
  };

  const getStatusBorderColor = () =&gt; {
     return requiresDirectorApproval ? 'border-yellow-500 bg-yellow-50' : 'border-green-500 bg-green-50';
  }

   const getStatusTextColor = () =&gt; {
    return requiresDirectorApproval ? 'text-yellow-800' : 'text-green-800';
   }

   const getStatusDescription = () =&gt; {
     if (requiresDirectorApproval) {
       return (
         &lt;&gt;
            &lt;p className={`text-sm ${getStatusTextColor()}`}&gt;{reason}&lt;/p&gt;
            &lt;p className="mt-2 text-sm text-muted-foreground italic"&gt;
               An email has been sent to the director for review. You will be notified via email once a decision is made. Your request ID is: &lt;strong&gt;{bookingId || 'N/A'}&lt;/strong&gt;
            &lt;/p&gt;
         &lt;/&gt;
       );
     } else {
       return (
         &lt;&gt;
           &lt;p className={`text-sm ${getStatusTextColor()}`}&gt;{reason}&lt;/p&gt;
           &lt;p className="mt-2 text-sm text-muted-foreground italic"&gt;
             Your booking is provisionally confirmed based on initial checks. No further action is needed from you at this time. Your request ID is: &lt;strong&gt;{bookingId || 'N/A'}&lt;/strong&gt;
           &lt;/p&gt;
         &lt;/&gt;
       );
     }
   };

    const formatTime = (timeString: string) =&gt; {
      if (!timeString) return 'N/A';
      // Assuming timeString is "HH:mm"
      const [hours, minutes] = timeString.split(':');
      const tempDate = new Date(2000, 0, 1, parseInt(hours), parseInt(minutes));
      return format(tempDate, 'p'); // e.g., 9:00 AM
    };

  return (
    &lt;Card className="w-full max-w-2xl shadow-md"&gt;
      &lt;CardHeader&gt;
        &lt;CardTitle className="flex items-center gap-2 text-2xl text-primary"&gt;
          {requiresDirectorApproval ? (
              &lt;Clock className="h-6 w-6 text-yellow-600" /&gt;
          ) : (
             &lt;CheckCircle className="h-6 w-6 text-green-600" /&gt;
          )}
           Booking Request {requiresDirectorApproval ? 'Pending' : 'Submitted'}
        &lt;/CardTitle&gt;
        &lt;CardDescription&gt;
           {requiresDirectorApproval
            ? 'Your request requires director approval and has been submitted for review.'
            : 'Your request has been received and auto-processed based on initial checks.'}
        &lt;/CardDescription&gt;
      &lt;/CardHeader&gt;
      &lt;CardContent className="space-y-4"&gt;
        &lt;div&gt;
          &lt;h3 className="mb-2 text-lg font-semibold text-foreground"&gt;Booking Details:&lt;/h3&gt;
          &lt;div className="space-y-2 rounded-md border p-4"&gt;
            &lt;p className="flex items-center gap-2"&gt;
              &lt;User className="h-4 w-4 text-muted-foreground" /&gt;
              &lt;strong&gt;Student Name:&lt;/strong&gt; {studentName}
            &lt;/p&gt;
            &lt;p className="flex items-center gap-2"&gt;
              &lt;Mail className="h-4 w-4 text-muted-foreground" /&gt;
              &lt;strong&gt;Student Email:&lt;/strong&gt; {studentEmail}
            &lt;/p&gt;
            &lt;p className="flex items-center gap-2"&gt;
              &lt;Building className="h-4 w-4 text-muted-foreground" /&gt;
              &lt;strong&gt;Hall Preference:&lt;/strong&gt; {hallPreference}
            &lt;/p&gt;
            &lt;p className="flex items-center gap-2"&gt;
              &lt;CalendarDays className="h-4 w-4 text-muted-foreground" /&gt;
              &lt;strong&gt;Date:&lt;/strong&gt; {format(date, 'PPP')}
            &lt;/p&gt;
            &lt;p className="flex items-center gap-2"&gt;
              &lt;Clock className="h-4 w-4 text-muted-foreground" /&gt;
              &lt;strong&gt;Time:&lt;/strong&gt; {formatTime(startTime)} - {formatTime(endTime)}
            &lt;/p&gt;
          &lt;/div&gt;
        &lt;/div&gt;

        &lt;Separator /&gt;

        &lt;div&gt;
          &lt;h3 className="mb-2 text-lg font-semibold text-foreground"&gt;Authorization Status:&lt;/h3&gt;
          &lt;div className={`flex items-start gap-3 rounded-md border p-4 ${getStatusBorderColor()}`}&gt;
             {getStatusIcon()}
            &lt;div className="flex-1"&gt;
               {getStatusBadge()}
              {getStatusDescription()}
            &lt;/div&gt;
          &lt;/div&gt;
        &lt;/div&gt;
      &lt;/CardContent&gt;
    &lt;/Card&gt;
  );
}
