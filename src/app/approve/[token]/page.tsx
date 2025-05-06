'use client';

import * as React from 'react';
import { useParams } from 'next/navigation';
import { getBookingByToken, updateBookingStatus, type BookingRequest } from '@/services/firestore';
import { sendConfirmationEmail } from '@/services/email';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Loader2, CheckCircle, XCircle, User, Building, CalendarDays, AlertTriangle, Info, MessageSquare } from 'lucide-react';
import { format } from 'date-fns';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';

type ApprovalStatus = 'loading' | 'pending' | 'approved' | 'rejected' | 'not_found' | 'error' | 'already_processed';

export default function ApprovalPage() {
  const params = useParams();
  const token = params?.token as string | undefined;

  const [booking, setBooking] = React.useState<BookingRequest | null>(null);
  const [status, setStatus] = React.useState<ApprovalStatus>('loading');
  const [error, setError] = React.useState<string | null>(null);
  const [processingAction, setProcessingAction] = React.useState<'approve' | 'reject' | null>(null);
  const [rejectionReason, setRejectionReason] = React.useState('');
  const [showRejectionInput, setShowRejectionInput] = React.useState(false);

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
             setStatus('already_processed'); 
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

    if (action === 'reject' && !rejectionReason.trim() && showRejectionInput) {
        setError("Please provide a reason for rejection.");
        // Clear error after a delay so user can see it
        setTimeout(() => setError(null), 3000);
        return;
    }
    if (action === 'reject' && !showRejectionInput) {
        setShowRejectionInput(true);
        setError(null); // Clear any previous errors
        return; 
    }


    setProcessingAction(action);
    setError(null); 

    try {
      await updateBookingStatus(booking.id, action === 'approve' ? 'approved' : 'rejected', action === 'reject' ? rejectionReason : undefined);
      setStatus(action === 'approve' ? 'approved' : 'rejected');
      
      // Ensure booking.studentId is used for the email 'to' field. In a real app, this might be booking.userEmail
      const studentEmail = booking.studentId.includes('@') ? booking.studentId : `${booking.studentId}@example.com`; // Basic check or use a stored email
      await sendConfirmationEmail(studentEmail, action === 'approve' ? 'approved' : 'rejected', booking, action === 'reject' ? rejectionReason : undefined);


    } catch (e: any) {
      console.error(`Error ${action === 'approve' ? 'approving' : 'rejecting'} booking:`, e);
      setStatus('error');
      setError(`Failed to ${action} booking: ${e.message}`);
    } finally {
      setProcessingAction(null);
      // Do not hide rejection input here immediately, let the status change re-render the view
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
             <Alert variant={booking?.status === 'approved' ? 'default' : 'destructive'} className={booking?.status === 'approved' ? 'border-green-500 bg-green-50' : 'border-destructive bg-destructive/10'}>
               {booking?.status === 'approved' ? <CheckCircle className="h-4 w-4 text-green-600" /> : <XCircle className="h-4 w-4 text-destructive"/>}
              <AlertTitle>Booking Already Processed</AlertTitle>
              <AlertDescription>
                 This booking request was already <strong>{booking?.status}</strong>
                 {booking?.approvedAt && ` on ${format(booking.approvedAt.toDate(), 'PPP p')}`}.
                 {booking?.rejectedAt && ` on ${format(booking.rejectedAt.toDate(), 'PPP p')}`}.
                 {booking?.status === 'rejected' && booking.rejectionReason && <p className="mt-1">Reason: {booking.rejectionReason}</p>}
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
                 <Alert variant="destructive" className="bg-destructive/10">
                    <XCircle className="h-4 w-4" />
                 <AlertTitle>Booking Rejected</AlertTitle>
                 <AlertDescription>
                     You have rejected this booking request. The student will be notified.
                     {booking?.rejectionReason && <p className="mt-1">Provided Reason: {booking.rejectionReason}</p>}
                 </AlertDescription>
                 </Alert>
             );


       case 'pending':
         if (!booking) return null;
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
                    <strong>Student ID/Email:</strong> {booking.studentId}
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
                {booking.aiReason && (
                 <Alert variant="default" className="mt-4 bg-blue-50 border-blue-300">
                      <Info className="h-4 w-4 text-blue-600"/>
                     <AlertTitle className="text-blue-700">AI Recommendation Note</AlertTitle>
                     <AlertDescription className="text-blue-600">
                         Approval by director was suggested by AI due to: {booking.aiReason}
                     </AlertDescription>
                 </Alert>
                )}

                {showRejectionInput && (
                    <div className="space-y-2 pt-2">
                        <Label htmlFor="rejectionReason" className="flex items-center gap-2">
                            <MessageSquare className="h-4 w-4 text-muted-foreground"/> Reason for Rejection (Required)
                        </Label>
                        <Textarea
                            id="rejectionReason"
                            value={rejectionReason}
                            onChange={(e) => {
                                setRejectionReason(e.target.value);
                                if (error && e.target.value.trim()) setError(null); // Clear error when user types
                            }}
                            placeholder="Explain why the request is being rejected..."
                            className="min-h-[80px]"
                            disabled={!!processingAction}
                            aria-invalid={!!error && rejectionReason.trim() === ''}
                            aria-describedby={error && rejectionReason.trim() === '' ? "rejection-error" : undefined}
                        />
                        {error && rejectionReason.trim() === '' && (
                             <p id="rejection-error" className="text-sm text-destructive">{error}</p>
                        )}
                    </div>
                )}
             </CardContent>
             <CardFooter className="flex flex-col sm:flex-row justify-end space-y-2 sm:space-y-0 sm:space-x-3">
               <Button
                 variant="destructive"
                 onClick={() => handleAction('reject')}
                 disabled={!!processingAction && processingAction === 'approve'}
                 className="w-full sm:w-auto"
               >
                 {processingAction === 'reject' ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <XCircle className="mr-2 h-4 w-4" />
                  )}
                 {showRejectionInput ? 'Confirm Rejection' : 'Reject Request'}
               </Button>
               {!showRejectionInput && ( // Only show approve if not in rejection input mode
                <Button
                    variant="default"
                    className="bg-green-600 hover:bg-green-700 w-full sm:w-auto"
                    onClick={() => handleAction('approve')}
                    disabled={!!processingAction && processingAction === 'reject'}
                >
                    {processingAction === 'approve' ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                        <CheckCircle className="mr-2 h-4 w-4" />
                    )}
                    Approve Request
                </Button>
               )}
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

