
'use client';

import * as React from 'react';
import Link from 'next/link';
import type {BookingFormData} from '@/components/booking-form';
import {BookingForm} from '@/components/booking-form';
import {BookingConfirmation} from '@/components/booking-confirmation';
import {VenueCalendar} from '@/components/venue-calendar';
import type {AuthorizeBookingOutput} from '@/ai/flows/authorize-booking';
import { savePendingBooking, getUserProfile, type UserProfileData, getUserBookings, type BookingRequest, getVenueAvailabilityForMonth } from '@/services/firestore';
import { auth } from '@/lib/firebase';
import { sendApprovalEmail } from '@/services/email';
import crypto from 'crypto';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/button';
import { LogIn, Loader2, User, ListChecks, Hourglass, CheckSquare, XSquare, Info, PlusCircle, AlertTriangle, CalendarDays, Clock } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { format, parse } from 'date-fns';
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
  const [venueBookings, setVenueBookings] = React.useState<BookingRequest[]>([]);
  const [calendarMonth, setCalendarMonth] = React.useState(new Date());


   React.useEffect(() => {
    async function fetchUserDataAndVenueBookings() {
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

          const venueData = await getVenueAvailabilityForMonth(calendarMonth.getFullYear(), calendarMonth.getMonth());
          setVenueBookings(venueData);


        } catch (err: any) {
          console.error("Failed to fetch user/venue data:", err);
          let specificError = "Could not load your information or venue availability at this time.";
           if (err.message && err.message.toLowerCase().includes('profile')) {
            specificError = "Could not load your profile.";
          } else if (err.message && err.message.toLowerCase().includes('bookings')) {
            specificError = "Could not load your booking information.";
          } else if (err.message && err.message.toLowerCase().includes('venue')) {
            specificError = "Could not load venue availability.";
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
        setVenueBookings([]);
        setShowBookingForm(false);
        setBookingResult(null);
        setError(null);
      }
    }
    fetchUserDataAndVenueBookings();
  }, [user, toast, calendarMonth]);


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


        tokenValue = crypto.randomBytes(32).toString('hex');
        bookingId = await savePendingBooking(result.formData, tokenValue, user.uid, aiReasonForDecision);

        if (result.requiresDirectorApproval) {
          const directorEmail = process.env.NEXT_PUBLIC_DIRECTOR_EMAIL || 'director@example.com';
          if (!directorEmail) {
             console.warn("Director email is not configured. Approval email not sent.");
             // Not throwing error to allow booking to proceed, but log it.
          } else {
            await sendApprovalEmail(directorEmail, tokenValue, result.formData);
          }
        } else {
           console.log("Booking auto-processed by AI (or does not require director approval):", result.formData, "Reason:", aiReasonForDecision);
           // If not requiring director approval, it's saved as 'pending' but AI might suggest it's clear.
           // The actual approval still happens via the director link or an admin panel.
           // For this app, "auto-approved" means the AI didn't flag it for mandatory director review.
        }

        setBookingResult({ ...result, bookingId, token: tokenValue });

        if (user) {
            const updatedBookings = await getUserBookings(user.uid);
            setUserBookings(updatedBookings);
            const updatedVenueBookings = await getVenueAvailabilityForMonth(calendarMonth.getFullYear(), calendarMonth.getMonth());
            setVenueBookings(updatedVenueBookings);
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
      // If there was an error message from BookingForm (e.g. availability)
      if (errorMsg) {
        setError(errorMsg); // Display error from form.
        toast({
            title: 'Booking Error',
            description: errorMsg,
            variant: 'destructive',
        });
      }
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

  const formatTimeDisplay = (timeString?: string) => {
    if (!timeString) return 'N/A';
    const [hours, minutes] = timeString.split(':');
    const tempDate = new Date(2000, 0, 1, parseInt(hours), parseInt(minutes));
    return format(tempDate, 'p'); // e.g., 9:00 AM
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

      <div className="w-full max-w-4xl space-y-8">
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
                    Your user profile could not be loaded. This might be temporary.
                </AlertDescription>
            </Alert>
        )}

        {!showBookingForm && !bookingResult && !error && !isLoading && (
          <Card className="mt-6">
              <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                     <CalendarDays className="h-6 w-6 text-primary" /> Venue Availability Calendar
                  </CardTitle>
                  <CardDescription>Green indicates dates with some availability. Red indicates dates that are fully booked. Select a date on the calendar or use the form below.</CardDescription>
              </CardHeader>
              <CardContent>
                  <VenueCalendar
                    bookings={venueBookings}
                    currentMonth={calendarMonth}
                    onMonthChange={setCalendarMonth}
                  />
                  <p className="mt-2 text-xs text-muted-foreground">Note: Calendar shows general availability. Specific time slot conflicts are checked during booking.</p>
              </CardContent>
          </Card>
        )}


        {!showBookingForm && !bookingResult && !error && !isLoading && !bookingsLoading && (
          <div className="space-y-6">
            {userBookings.length > 0 ? (
              <>
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
                                    <p><strong>Date:</strong> {format(booking.date, 'PPP')}</p>
                                    <p><strong>Time:</strong> {formatTimeDisplay(booking.startTime)} - {formatTimeDisplay(booking.endTime)}</p>
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
                                    <p><strong>Date:</strong> {format(booking.date, 'PPP')}</p>
                                    <p><strong>Time:</strong> {formatTimeDisplay(booking.startTime)} - {formatTimeDisplay(booking.endTime)}</p>
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
                                    <p><strong>Date:</strong> {format(booking.date, 'PPP')}</p>
                                    <p><strong>Time:</strong> {formatTimeDisplay(booking.startTime)} - {formatTimeDisplay(booking.endTime)}</p>
                                    {booking.rejectedAt && <p><strong>Processed:</strong> {format(booking.rejectedAt.toDate(), 'Pp')}</p>}
                                    {booking.rejectionReason && <p><strong>Reason:</strong> {booking.rejectionReason}</p>}
                                </div>
                            ))}
                        </CardContent>
                    </Card>
                )}
              </>
            ) : (
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

        {showBookingForm && !bookingResult && !error && !isLoading && (
          <Card className="mt-6">
            <CardHeader>
                <CardTitle>New Hall Booking Request</CardTitle>
                <CardDescription>Fill in the details below to book a hall. A 1-hour gap is maintained between bookings.</CardDescription>
            </CardHeader>
            <CardContent>
                <BookingForm
                    onSubmitSuccess={handleBookingSubmit}
                    onLoadingChange={handleLoadingChange}
                    isLoading={isLoading}
                    userProfile={userProfile}
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

        {error && !isLoading && !bookingResult && ( // Only show general error if no specific booking result error shown in form
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
                {showBookingForm && !bookingResult && !error ? 'Back to Summary & Calendar' : 'View Summary & Calendar'}
            </Button>
           </div>
        )}
      </div>
    </main>
  );
}
