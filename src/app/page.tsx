'use client';

import * as React from 'react';
import Link from 'next/link';
import type {BookingFormData} from '@/components/booking-form';
import {BookingForm} from '@/components/booking-form';
import {BookingConfirmation} from '@/components/booking-confirmation';
import type {AuthorizeBookingOutput} from '@/ai/flows/authorize-booking';
import { savePendingBooking, getUserProfile, type UserProfileData, getUserBookings, type BookingRequest } from '@/services/firestore';
import { auth } from '@/lib/firebase';
import { sendApprovalEmail } from '@/services/email'; 
import crypto from 'crypto'; 
import { useAuth } from '@/context/AuthContext'; 
import { Button } from '@/components/ui/button'; 
import { LogIn, Loader2, User, ListChecks, Hourglass, CheckSquare, XSquare, Info, PlusCircle, AlertTriangle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";


interface BookingResult extends AuthorizeBookingOutput {
  formData: BookingFormData;
  bookingId?: string; 
  token?: string; 
}

export default function Home() {
  const { user, loading: authLoading } = useAuth(); 
  const { toast } = useToast();
  const [bookingResult, setBookingResult] = React.useState<BookingResult | null>(null);
  const [isLoading, setIsLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [userProfile, setUserProfile] = React.useState<UserProfileData | null>(null);
  const [profileLoading, setProfileLoading] = React.useState(false);
  const [userBookings, setUserBookings] = React.useState<BookingRequest[]>([]);
  const [bookingsLoading, setBookingsLoading] = React.useState(false);
  const [showBookingForm, setShowBookingForm] = React.useState(false);


   React.useEffect(() => {
    async function fetchUserData() {
      if (user) {
        setProfileLoading(true);
        setBookingsLoading(true);
        setShowBookingForm(false); 
        setBookingResult(null); 
        setError(null); 
        try {
          const profile = await getUserProfile(user.uid); 
          setUserProfile(profile);
          
          const bookings = await getUserBookings(user.uid); 
          setUserBookings(bookings);

        } catch (err: any) {
          console.error("Failed to fetch user data:", err);
          let specificError = "Could not load your information at this time.";
          if (err.message && err.message.toLowerCase().includes('profile')) {
            specificError = "Could not load your profile. It might not exist or there was a connection issue.";
          } else if (err.message && err.message.toLowerCase().includes('bookings')) {
            specificError = "Could not load your booking information due to a connection issue.";
          }
          setError(specificError);
          toast({
            title: 'Data Loading Error',
            description: specificError,
            variant: 'destructive',
          });
        } finally {
          setProfileLoading(false);
          setBookingsLoading(false);
        }
      } else {
        setUserProfile(null); 
        setUserBookings([]);
        setShowBookingForm(false);
        setBookingResult(null);
        setError(null);
      }
    }
    fetchUserData();
  }, [user, toast]);


  const handleBookingSubmit = async (result: BookingResult | null, errorMsg?: string) => {
    setError(errorMsg || null); 

    if (result && !errorMsg) {
      if (!user) {
         setError("You must be logged in to make a booking.");
         setIsLoading(false);
         return;
      }

      setIsLoading(true);
      try {
        let bookingId: string | undefined;
        let tokenValue: string | undefined;

        const aiReasonForDecision = result.reason;

        if (result.requiresDirectorApproval) {
          tokenValue = crypto.randomBytes(32).toString('hex');
          bookingId = await savePendingBooking(result.formData, tokenValue, user.uid, aiReasonForDecision);

          const directorEmail = process.env.NEXT_PUBLIC_DIRECTOR_EMAIL || 'director@example.com'; 
          if (!directorEmail) {
             throw new Error("Director email is not configured.");
          }
          await sendApprovalEmail(directorEmail, tokenValue, result.formData);
        } else {
           tokenValue = crypto.randomBytes(32).toString('hex'); 
           bookingId = await savePendingBooking(result.formData, tokenValue, user.uid, aiReasonForDecision);
           console.log("Booking auto-processed by AI:", result.formData, "Reason:", aiReasonForDecision);
        }
        
        setBookingResult({ ...result, bookingId, token: tokenValue });
        
        if (user) { 
            const updatedBookings = await getUserBookings(user.uid);
            setUserBookings(updatedBookings);
        }
        setShowBookingForm(false); 
        setError(null); 

      } catch (dbError: any) {
         console.error("Error during booking process:", dbError);
         setError(`Failed to process booking: ${dbError.message}`);
         setBookingResult(null); 
      } finally {
        setIsLoading(false); 
      }
    } else {
      setBookingResult(null);
      setIsLoading(false);
    }
  };


  const handleLoadingChange = (loading: boolean) => {
    setIsLoading(loading);
    if (loading) {
      setBookingResult(null);
      setError(null);
    }
  };

  const pendingBookings = userBookings.filter(b => b.status === 'pending');
  const approvedBookings = userBookings.filter(b => b.status === 'approved');
  const rejectedBookings = userBookings.filter(b => b.status === 'rejected');

   if (authLoading || (user && (profileLoading || bookingsLoading) && !error)) {
    return (
       <main className="container mx-auto flex min-h-screen flex-col items-center justify-center p-4 md:p-8">
        <div className="flex flex-col items-center space-y-2">
          <Loader2 className="h-12 w-12 animate-spin text-primary" />
           <p className="text-lg text-muted-foreground">
             {authLoading ? 'Checking authentication...' : (profileLoading ? 'Loading profile...' : 'Loading bookings...')}
           </p>
        </div>
       </main>
    );
  }

  if (!user) {
    return (
       <main className="container mx-auto flex min-h-screen flex-col items-center justify-center p-4 md:p-8">
        <div className="w-full max-w-md space-y-6 rounded-lg border bg-card p-8 text-center shadow-lg">
          <h1 className="text-3xl font-bold text-primary">Welcome to HallPass</h1>
          <p className="text-muted-foreground">Please log in or register to book a hall.</p>
          <div className="flex justify-center gap-4">
             <Button asChild>
              <Link href="/login">
                <LogIn className="mr-2 h-4 w-4" /> Login
              </Link>
            </Button>
            <Button variant="outline" asChild>
               <Link href="/register">
                 <User className="mr-2 h-4 w-4" /> Register
               </Link>
            </Button>
          </div>
        </div>
       </main>
    );
  }

  return (
    <main className="container mx-auto flex min-h-screen flex-col items-center p-4 pt-20 md:p-8 md:pt-24">
      <Button
          variant="outline"
          onClick={async () => {
            if (auth) { 
              await auth.signOut();
              toast({ title: 'Logged Out', description: 'You have been successfully logged out.' });
            }
          }}
          className="absolute right-4 top-4"
        >
          Logout
        </Button>

      <div className="w-full max-w-3xl space-y-8">
        {userProfile && !profileLoading && (
            <div className="text-center">
                <h1 className="text-3xl font-bold text-primary">Welcome, {userProfile.name}!</h1>
                <p className="text-muted-foreground">{userProfile.department}</p>
            </div>
        )}
        {!userProfile && !profileLoading && !error && (
            <Alert variant="default" className="mt-4 bg-blue-50 border-blue-300">
                <Info className="h-4 w-4 text-blue-600"/>
                <AlertTitle className="text-blue-700">Profile Information</AlertTitle>
                <AlertDescription className="text-blue-600">
                    Your user profile could not be loaded. If you just registered, it might still be syncing. Otherwise, please contact support if this persists.
                </AlertDescription>
            </Alert>
        )}


        {/* This block shows summary/no-history and lists if applicable */}
        {/* It's visible when not showing the form, not loading, no result, and bookings data loaded */}
        {!showBookingForm && !bookingResult && !error && !isLoading && !bookingsLoading && (
          <div className="space-y-6"> 
            {userBookings.length > 0 ? (
              <>
                {/* Booking Summary Card */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <ListChecks className="h-6 w-6 text-primary" />
                      Your Booking Summary
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                    <div className="rounded-md border p-4 text-center">
                      <p className="text-2xl font-bold">{userBookings.length}</p>
                      <p className="text-sm text-muted-foreground">Total Bookings</p>
                    </div>
                    <div className="rounded-md border p-4 text-center">
                      <p className="text-2xl font-bold text-yellow-600">{pendingBookings.length}</p>
                      <p className="text-sm text-muted-foreground">Pending</p>
                    </div>
                    <div className="rounded-md border p-4 text-center">
                      <p className="text-2xl font-bold text-green-600">{approvedBookings.length}</p>
                      <p className="text-sm text-muted-foreground">Approved</p>
                    </div>
                  </CardContent>
                </Card>

                {/* Lists of Bookings */}
                {pendingBookings.length > 0 && (
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2 text-xl">
                                <Hourglass className="h-5 w-5 text-yellow-600" /> Pending Requests
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-3">
                            {pendingBookings.map(booking => (
                                <div key={booking.id} className="rounded-md border p-3">
                                    <p><strong>Hall:</strong> {booking.hallPreference}</p>
                                    <p><strong>Date:</strong> {format(booking.dates, 'PPP')}</p>
                                    <p><strong>Submitted:</strong> {format(booking.createdAt.toDate(), 'Pp')}</p>
                                    {booking.aiReason && (
                                      <Alert variant="default" className="mt-2 bg-blue-50 border-blue-300">
                                        <Info className="h-4 w-4 text-blue-600" />
                                        <AlertTitle className="text-blue-700">AI Note</AlertTitle>
                                        <AlertDescription className="text-blue-600">
                                          {booking.aiReason}
                                        </AlertDescription>
                                      </Alert>
                                    )}
                                </div>
                            ))}
                        </CardContent>
                    </Card>
                )}
                {approvedBookings.length > 0 && (
                     <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2 text-xl">
                                <CheckSquare className="h-5 w-5 text-green-600" /> Approved Bookings
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-3">
                            {approvedBookings.map(booking => (
                                <div key={booking.id} className="rounded-md border p-3">
                                    <p><strong>Hall:</strong> {booking.hallPreference}</p>
                                    <p><strong>Date:</strong> {format(booking.dates, 'PPP')}</p>
                                    {booking.approvedAt && <p><strong>Approved:</strong> {format(booking.approvedAt.toDate(), 'Pp')}</p>}
                                </div>
                            ))}
                        </CardContent>
                    </Card>
                )}
                 {rejectedBookings.length > 0 && (
                     <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2 text-xl">
                                <XSquare className="h-5 w-5 text-destructive" /> Rejected/Cancelled Bookings
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-3">
                            {rejectedBookings.map(booking => (
                                <div key={booking.id} className="rounded-md border p-3">
                                    <p><strong>Hall:</strong> {booking.hallPreference}</p>
                                    <p><strong>Date:</strong> {format(booking.dates, 'PPP')}</p>
                                    {booking.rejectedAt && <p><strong>Processed:</strong> {format(booking.rejectedAt.toDate(), 'Pp')}</p>}
                                    {booking.rejectionReason && <p><strong>Reason:</strong> {booking.rejectionReason}</p>}
                                </div>
                            ))}
                        </CardContent>
                    </Card>
                )}
              </>
            ) : (
              // No bookings yet message
              <Card> 
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Info className="h-6 w-6 text-primary" />
                    No Booking History
                  </CardTitle>
                  <CardDescription>
                    You haven't made any hall booking requests yet.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground">
                    Click the "{userBookings.length === 0 ? "Make Your First Booking Request" : "Make a New Booking Request"}" button below to get started!
                  </p>
                </CardContent>
              </Card>
            )}
          </div>
        )}
        
        {/* "Make New Booking" / "Cancel Booking" Button */}
        {!bookingResult && !error && !isLoading && (
            <div className="text-center mt-6">
                 <Button 
                    onClick={() => {
                        setShowBookingForm(prev => !prev);
                        setBookingResult(null); 
                        setError(null); 
                    }}
                    variant={showBookingForm ? "outline" : "default"}
                    className="w-full sm:w-auto"
                  >
                    {showBookingForm ? (
                        <> <XSquare className="mr-2 h-4 w-4" /> Cancel New Booking</>
                    ) : (
                        <> <PlusCircle className="mr-2 h-4 w-4" /> 
                         {userBookings.length === 0 ? "Make Your First Booking Request" : "Make a New Booking Request"}
                        </>
                    )}
                </Button>
            </div>
        )}

        {/* Booking Form */}
        {showBookingForm && !bookingResult && !error && !isLoading && ( 
          <Card className="mt-6">
            <CardHeader>
                <CardTitle>New Hall Booking Request</CardTitle>
                <CardDescription>Fill in the details below to book a hall.</CardDescription>
            </CardHeader>
            <CardContent>
                <BookingForm
                    onSubmitSuccess={handleBookingSubmit}
                    onLoadingChange={handleLoadingChange}
                    isLoading={isLoading} 
                    defaultStudentId={userProfile?.email || user?.email || ''}
                />
            </CardContent>
          </Card>
        )}

         {isLoading && ( 
          <div className="flex flex-col items-center justify-center rounded-md border bg-card p-6 text-center shadow-sm mt-6">
             <Loader2 className="mr-3 h-8 w-8 animate-spin text-primary" />
            <p className="mt-2 text-lg font-semibold text-foreground">Processing Request...</p>
             <p className="text-muted-foreground">
                Please wait while we process your booking.
            </p>
          </div>
        )}


        {bookingResult && !isLoading && ( 
          <div className="mt-6">
            <BookingConfirmation
                bookingDetails={bookingResult.formData}
                authorization={bookingResult}
                bookingId={bookingResult.bookingId} 
            />
          </div>
        )}

        {error && !isLoading && ( 
          <Alert variant="destructive" className="mt-6">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>{error || 'An unexpected error occurred. Please try again.'}</AlertDescription>
          </Alert>
        )}

        {(bookingResult || error || showBookingForm) && !isLoading && ( 
           <div className="text-center mt-6">
            <Button
                onClick={() => {
                setBookingResult(null);
                setError(null);
                setShowBookingForm(false); 
                }}
                variant="outline"
                className="w-full sm:w-auto"
            >
                {showBookingForm && !bookingResult && !error ? 'Back to Summary' : 'View Booking Summary / Make Another'}
            </Button>
           </div>
        )}
      </div>
    </main>
  );
}
