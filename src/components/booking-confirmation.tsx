import type * as React from 'react';
import { CheckCircle, AlertTriangle, User, Building, CalendarDays } from 'lucide-react';
import { format } from 'date-fns';
import type { BookingFormData } from './booking-form';
import type { AuthorizeBookingOutput } from '@/ai/flows/authorize-booking';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';

interface BookingConfirmationProps {
  bookingDetails: BookingFormData;
  authorization: AuthorizeBookingOutput;
}

export function BookingConfirmation({ bookingDetails, authorization }: BookingConfirmationProps) {
  const { studentId, hallPreference, dates } = bookingDetails;
  const { requiresDirectorApproval, reason } = authorization;

  return (
    <Card className="w-full max-w-2xl shadow-md">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-2xl text-primary">
          <CheckCircle className="h-6 w-6 text-green-600" /> Booking Request Submitted
        </CardTitle>
        <CardDescription>
          Your request has been received and is being processed.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <h3 className="mb-2 text-lg font-semibold text-foreground">Booking Details:</h3>
          <div className="space-y-2 rounded-md border p-4">
            <p className="flex items-center gap-2">
              <User className="h-4 w-4 text-muted-foreground" />
              <strong>Student ID:</strong> {studentId}
            </p>
            <p className="flex items-center gap-2">
              <Building className="h-4 w-4 text-muted-foreground" />
              <strong>Hall Preference:</strong> {hallPreference}
            </p>
            <p className="flex items-center gap-2">
              <CalendarDays className="h-4 w-4 text-muted-foreground" />
              <strong>Date:</strong> {format(dates, 'PPP')}
            </p>
          </div>
        </div>

        <Separator />

        <div>
          <h3 className="mb-2 text-lg font-semibold text-foreground">Authorization Status:</h3>
          <div className={`flex items-start gap-2 rounded-md border p-4 ${requiresDirectorApproval ? 'border-yellow-500 bg-yellow-50' : 'border-green-500 bg-green-50'}`}>
            {requiresDirectorApproval ? (
              <AlertTriangle className="mt-1 h-5 w-5 flex-shrink-0 text-yellow-600" />
            ) : (
              <CheckCircle className="mt-1 h-5 w-5 flex-shrink-0 text-green-600" />
            )}
            <div>
              <Badge variant={requiresDirectorApproval ? 'destructive' : 'default'} className="mb-1">
                {requiresDirectorApproval ? 'Director Approval Required' : 'Auto-Approved'}
              </Badge>
              <p className={`text-sm ${requiresDirectorApproval ? 'text-yellow-800' : 'text-green-800'}`}>
                {reason}
              </p>
            </div>
          </div>
           {requiresDirectorApproval && (
            <p className="mt-2 text-sm text-muted-foreground italic">
               Your request will be forwarded to the director for review. You will be notified once a decision is made.
            </p>
           )}
            {!requiresDirectorApproval && (
             <p className="mt-2 text-sm text-muted-foreground italic">
               Your booking is provisionally confirmed based on initial checks.
             </p>
            )}
        </div>
      </CardContent>
    </Card>
  );
}
