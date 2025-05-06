
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

  const getStatusBadge = () => {
    if (requiresDirectorApproval) {
      return <Badge variant="destructive" className="mb-1 bg-yellow-500 text-yellow-900 hover:bg-yellow-500/80">Pending Director Approval</Badge>;
    } else {
      return <Badge variant="default" className="mb-1 bg-green-600 hover:bg-green-600/80">Auto-Processed</Badge>;
    }
  };

   const getStatusIcon = () => {
    if (requiresDirectorApproval) {
       return <Mail className="mt-1 h-5 w-5 flex-shrink-0 text-yellow-600" />;
    } else {
      return <CheckCircle className="mt-1 h-5 w-5 flex-shrink-0 text-green-600" />;
    }
  };

  const getStatusBorderColor = () => {
     return requiresDirectorApproval ? 'border-yellow-500 bg-yellow-50' : 'border-green-500 bg-green-50';
  }

   const getStatusTextColor = () => {
    return requiresDirectorApproval ? 'text-yellow-800' : 'text-green-800';
   }

   const getStatusDescription = () => {
     if (requiresDirectorApproval) {
       return (
         <>
            <p className={`text-sm ${getStatusTextColor()}`}>{reason}</p>
            <p className="mt-2 text-sm text-muted-foreground italic">
               An email has been sent to the director for review. You will be notified via email once a decision is made. Your request ID is: <strong>{bookingId || 'N/A'}</strong>
            </p>
         </>
       );
     } else {
       return (
         <>
           <p className={`text-sm ${getStatusTextColor()}`}>{reason}</p>
           <p className="mt-2 text-sm text-muted-foreground italic">
             Your booking is provisionally confirmed based on initial checks. No further action is needed from you at this time. Your request ID is: <strong>{bookingId || 'N/A'}</strong>
           </p>
         </>
       );
     }
   };

    const formatTime = (timeString: string) => {
      if (!timeString) return 'N/A';
      // Assuming timeString is "HH:mm"
      const [hours, minutes] = timeString.split(':');
      const tempDate = new Date(2000, 0, 1, parseInt(hours), parseInt(minutes));
      return format(tempDate, 'p'); // e.g., 9:00 AM
    };

  return (
    <Card className="w-full max-w-2xl shadow-md">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-2xl text-primary">
          {requiresDirectorApproval ? (
              <Clock className="h-6 w-6 text-yellow-600" />
          ) : (
             <CheckCircle className="h-6 w-6 text-green-600" />
          )}
           Booking Request {requiresDirectorApproval ? 'Pending' : 'Submitted'}
        </CardTitle>
        <CardDescription>
           {requiresDirectorApproval
            ? 'Your request requires director approval and has been submitted for review.'
            : 'Your request has been received and auto-processed based on initial checks.'}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <h3 className="mb-2 text-lg font-semibold text-foreground">Booking Details:</h3>
          <div className="space-y-2 rounded-md border p-4">
            <p className="flex items-center gap-2">
              <User className="h-4 w-4 text-muted-foreground" />
              <strong>Student Name:</strong> {studentName}
            </p>
            <p className="flex items-center gap-2">
              <Mail className="h-4 w-4 text-muted-foreground" />
              <strong>Student Email:</strong> {studentEmail}
            </p>
            <p className="flex items-center gap-2">
              <Building className="h-4 w-4 text-muted-foreground" />
              <strong>Hall Preference:</strong> {hallPreference}
            </p>
            <p className="flex items-center gap-2">
              <CalendarDays className="h-4 w-4 text-muted-foreground" />
              <strong>Date:</strong> {format(date, 'PPP')}
            </p>
            <p className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <strong>Time:</strong> {formatTime(startTime)} - {formatTime(endTime)}
            </p>
          </div>
        </div>

        <Separator />

        <div>
          <h3 className="mb-2 text-lg font-semibold text-foreground">Authorization Status:</h3>
          <div className={`flex items-start gap-3 rounded-md border p-4 ${getStatusBorderColor()}`}>
             {getStatusIcon()}
            <div className="flex-1">
               {getStatusBadge()}
              {getStatusDescription()}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
