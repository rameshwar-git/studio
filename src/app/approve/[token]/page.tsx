'use client';

import * as React from 'react';
import { useParams } from 'next/navigation';
import { getBookingByToken, updateBookingStatus, type BookingRequest } from '@/services/firestore';
import { sendConfirmationEmail } from '@/services/email';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Loader2, CheckCircle, XCircle, User, Building, CalendarDays, AlertTriangle, Info } from 'lucide-react';
import { format } from 'date-fns';

type ApprovalStatus = 'loading' | 'pending' | 'approved' | 'rejected' | 'not_found' | 'error' | 'already_processed';

export default function ApprovalPage() {
  const params = useParams();
  const token = params?.token as string | undefined;

  const [booking, setBooking] = React.useState<BookingRequest | null>(null);
  const [status, setStatus] = React.useState<ApprovalStatus>('loading');
  const [error, setError] = React.useState<string | null>(null);
  const [processingAction, setProcessingAction] = React.useState<'approve' | 'reject' | null>(null);

  React.useEffect(() => {
    async function fetchBooking() {
      if (!token) {
        setStatus('error');
        setError('Invalid approval link.');
        return;
      }

      setStatus('loading');
      try {
        const fetchedBooking = await getBookingByToken(token);
        if (fetchedBooking) {
           setBooking(fetchedBooking);
           if (fetchedBooking.status === 'pending') {
            setStatus('pending');
           } else {
             setStatus('already_processed'); // Already approved or rejected
           }
        } else {
          setStatus('not_found');
        }
      } catch (e: any) {
        console.error("Error fetching booking:", e);
        setStatus('error');
        setError(`Failed to load booking details: ${e.message}`);
      }
    }

    fetchBooking();
  }, [token]);

  const handleAction = async (action: 'approve' | 'reject') => {
    if (!booking || !booking.id) {
      setError("Cannot process action: Booking details are missing.");
      return;
    }

    setProcessingAction(action);
    setError(null); // Clear previous errors

    try {
      await updateBookingStatus(booking.id, action === 'approve' ? 'approved' : 'rejected');
      setStatus(action === 'approve' ? 'approved' : 'rejected');

      // Send confirmation email to student (using placeholder email)
       const studentPlaceholderEmail = `${booking.studentId}@example.com`; // Placeholder
       await sendConfirmationEmail(studentPlaceholderEmail, action === 'approve' ? 'approved' : 'rejected', booking);


    } catch (e: any) {
      console.error(`Error ${action === 'approve' ? 'approving' : 'rejecting'} booking:`, e);
      setStatus('error');
      setError(`Failed to ${action} booking: ${e.message}`);
    } finally {
      setProcessingAction(null);
    }
  };

   const renderContent = () => {
     switch (status) {
       case 'loading':
         return (
           <div className="flex flex-col items-center justify-center space-y-2 p-8">
             <Loader2 className="h-8 w-8 animate-spin text-primary" />
             <p className="text-muted-foreground">Loading booking details...</p>
           </div>
         );

       case 'not_found':
         return (
           <Alert variant="destructive">
             <AlertTriangle className="h-4 w-4" />
             <AlertTitle>Booking Not Found</AlertTitle>
             <AlertDescription>
               The booking request associated with this link could not be found. It might have been deleted or the link is invalid.
             </AlertDescription>
           </Alert>
         );

        case 'already_processed':
          return (
             <Alert variant={booking?.status === 'approved' ? 'default' : 'destructive'} className={booking?.status === 'approved' ? 'border-green-500 bg-green-50' : 'border-destructive'}>
               {booking?.status === 'approved' ? <CheckCircle className="h-4 w-4 text-green-600" /> : <XCircle className="h-4 w-4 text-destructive"/>}
              <AlertTitle>Booking Already Processed</AlertTitle>
              <AlertDescription>
                 This booking request was already <strong>{booking?.status}</strong>
                 {booking?.approvedAt && ` on ${format(booking.approvedAt.toDate(), 'PPP p')}`}.
                 {booking?.rejectedAt && ` on ${format(booking.rejectedAt.toDate(), 'PPP p')}`}.
                 <br/> No further action is needed.
              </AlertDescription>
             </Alert>
          )

       case 'error':
         return (
           <Alert variant="destructive">
             <AlertTriangle className="h-4 w-4" />
             <AlertTitle>Error</AlertTitle>
             <AlertDescription>
               {error || 'An unexpected error occurred.'}
             </AlertDescription>
           </Alert>
         );

       case 'approved':
         return (
            <Alert variant="default" className="border-green-500 bg-green-50">
               <CheckCircle className="h-4 w-4 text-green-600" />
              <AlertTitle>Booking Approved</AlertTitle>
              <AlertDescription>
                 You have successfully approved this booking request. The student will be notified.
              </AlertDescription>
            </Alert>
         );

        case 'rejected':
             return (
                 <Alert variant="destructive">
                    <XCircle className="h-4 w-4" />
                 <AlertTitle>Booking Rejected</AlertTitle>
                 <AlertDescription>
                     You have rejected this booking request. The student will be notified.
                 </AlertDescription>
                 </Alert>
             );


       case 'pending':
         if (!booking) return null; // Should not happen if status is pending
         return (
           <>
             <CardHeader>
               <CardTitle>Review Booking Request</CardTitle>
               <CardDescription>Please review the details below and approve or reject the request.</CardDescription>
             </CardHeader>
             <CardContent className="space-y-4">
               <div className="space-y-2 rounded-md border p-4">
                  <p className="flex items-center gap-2">
                    <User className="h-4 w-4 text-muted-foreground" />
                    <strong>Student ID:</strong> {booking.studentId}
                  </p>
                  <p className="flex items-center gap-2">
                    <Building className="h-4 w-4 text-muted-foreground" />
                    <strong>Hall Preference:</strong> {booking.hallPreference}
                  </p>
                  <p className="flex items-center gap-2">
                    <CalendarDays className="h-4 w-4 text-muted-foreground" />
                    <strong>Date:</strong> {format(booking.dates, 'PPP')}
                  </p>
                </div>
                {/* Optionally display AI reason here if it was stored */}
                 {/* <Alert variant="default" className="mt-4">
                      <Info className="h-4 w-4"/>
                     <AlertTitle>AI Recommendation</AlertTitle>
                     <AlertDescription>
                         AI recommended requiring director approval due to: [Reason from AI if stored]
                     </AlertDescription>
                 </Alert> */}
             </CardContent>
             <CardFooter className="flex justify-end space-x-3">
               <Button
                 variant="destructive"
                 onClick={() => handleAction('reject')}
                 disabled={!!processingAction}
               >
                 {processingAction === 'reject' ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <XCircle className="mr-2 h-4 w-4" />
                  )}
                 Reject
               </Button>
               <Button
                 variant="default"
                 className="bg-green-600 hover:bg-green-700"
                 onClick={() => handleAction('approve')}
                 disabled={!!processingAction}
               >
                  {processingAction === 'approve' ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <CheckCircle className="mr-2 h-4 w-4" />
                  )}
                 Approve
               </Button>
             </CardFooter>
           </>
         );
        default:
            return null;
     }
   };


  return (
    <main className="container mx-auto flex min-h-screen flex-col items-center justify-center p-4 md:p-8">
      <Card className="w-full max-w-lg shadow-lg">
       {renderContent()}
      </Card>
    </main>
  );
}
