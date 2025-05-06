
'use client';

import * as React from 'react';
import Link from 'next/link';
import type {BookingFormData} from '@/components/booking-form';
import {BookingForm} from '@/components/booking-form';
import {BookingConfirmation} from '@/components/booking-confirmation';
import type {AuthorizeBookingOutput} from '@/ai/flows/authorize-booking';
import { savePendingBooking, getUserProfile, type UserProfileData } from '@/services/firestore'; // Import Firestore service
import { sendApprovalEmail } from '@/services/email'; // Import Email service
import crypto from 'crypto'; // For generating token
import { useAuth } from '@/context/AuthContext'; // Import useAuth hook
import { Button } from '@/components/ui/button'; // Import Button
import { LogIn, Loader2, User } from 'lucide-react'; // Import icons

// Extend BookingResult to include database ID and token
interface BookingResult extends AuthorizeBookingOutput {
  formData: BookingFormData;
  bookingId?: string; // Firestore document ID
  token?: string; // Authorization token
}

export default function Home() {
  const { user, loading: authLoading } = useAuth(); // Get user and loading state from context
  const [bookingResult, setBookingResult] = React.useState<BookingResult | null>(null);
  const [isLoading, setIsLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [userProfile, setUserProfile] = React.useState<UserProfileData | null>(null);
  const [profileLoading, setProfileLoading] = React.useState(false);


   // Fetch user profile when user is authenticated
   React.useEffect(() => {
    async function fetchUserProfile() {
      if (user) {
        setProfileLoading(true);
        try {
          const profile = await getUserProfile(user.uid);
          setUserProfile(profile);
        } catch (err) {
          console.error("Failed to fetch user profile:", err);
          setError("Could not load your profile information.");
        } finally {
          setProfileLoading(false);
        }
      } else {
        setUserProfile(null); // Clear profile if user logs out
      }
    }
    fetchUserProfile();
  }, [user]);


  // Function to handle the result from BookingForm
  const handleBookingSubmit = async (result: BookingResult | null, errorMsg?: string) => {
    setError(errorMsg || null); // Set error first if any

    if (result && !errorMsg) {
      // Ensure user is logged in before proceeding
      if (!user) {
         setError("You must be logged in to make a booking.");
         setIsLoading(false);
         return;
      }

      // If AI indicates director approval is needed
      if (result.requiresDirectorApproval) {
        setIsLoading(true); // Keep loading indicator on while saving/sending email
        try {
          // 1. Generate a unique token
          const token = crypto.randomBytes(32).toString('hex');

          // 2. Save pending booking to Firestore, including the userId
          const bookingId = await savePendingBooking(result.formData, token, user.uid);

          // 3. Send email to director with the approval link
          const directorEmail = process.env.NEXT_PUBLIC_DIRECTOR_EMAIL || 'director@example.com'; // Get director email from env
          if (!directorEmail) {
             throw new Error("Director email is not configured.");
          }
          await sendApprovalEmail(directorEmail, token, result.formData);

           // Update state with bookingId and token for confirmation display
          setBookingResult({ ...result, bookingId, token });
          setError(null); // Clear any previous errors

        } catch (dbError: any) {
           console.error("Error during pending booking process:", dbError);
           setError(`Failed to process booking requiring approval: ${dbError.message}`);
           setBookingResult(null); // Clear booking result on error
        } finally {
          setIsLoading(false); // Stop loading indicator
        }
      } else {
        // If auto-approved by AI, just display the confirmation
        // In a real app, you might still save this directly as an 'approved' booking
         // Potentially save auto-approved booking here with user.uid if needed
        setBookingResult(result);
        setIsLoading(false);
      }
    } else {
      // Handle cases where the form itself failed or AI errored
      setBookingResult(null);
      setIsLoading(false);
    }
  };


  const handleLoadingChange = (loading: boolean) => {
    setIsLoading(loading);
    // Reset state when starting a new submission
    if (loading) {
      setBookingResult(null);
      setError(null);
    }
  };

  // Render loading state while checking authentication
   if (authLoading || (user && profileLoading)) {
    return (
       <main className="container mx-auto flex min-h-screen flex-col items-center justify-center p-4 md:p-8">
        <div className="flex flex-col items-center space-y-2">
          <Loader2 className="h-12 w-12 animate-spin text-primary" />
           <p className="text-lg text-muted-foreground">{authLoading ? 'Checking authentication...' : 'Loading profile...'}</p>
        </div>
       </main>
    );
  }

  // Render login prompt if user is not authenticated
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

  // Render main booking page if user is authenticated
  return (
    <main className="container mx-auto flex min-h-screen flex-col items-center justify-center p-4 md:p-8">
      <div className="w-full max-w-2xl space-y-8">
         {/* Optional: Display welcome message */}
        {userProfile && (
            <p className="text-center text-lg text-muted-foreground">
              Welcome, {userProfile.name}! ({userProfile.department})
            </p>
        )}
        <h1 className="text-center text-4xl font-bold text-primary">HallPass</h1>
        <p className="text-center text-muted-foreground">
          Register for your college hall booking.
        </p>

        {!bookingResult && !error && !isLoading && ( // Only show form initially
          <BookingForm
            onSubmitSuccess={handleBookingSubmit}
            onLoadingChange={handleLoadingChange}
            isLoading={isLoading} // Pass loading state down
            // Pass user profile data to prefill if needed (e.g., student ID)
            defaultStudentId={userProfile?.email} // Example: Prefill student ID with email
          />
        )}

         {isLoading && (
          <div className="flex flex-col items-center justify-center rounded-md border bg-card p-6 text-center shadow-sm">
             <svg className="mr-3 h-8 w-8 animate-spin text-primary" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
             </svg>
            <p className="mt-2 text-lg font-semibold text-foreground">Processing Request...</p>
             <p className="text-muted-foreground">
                {bookingResult?.requiresDirectorApproval ? "Saving request and notifying director..." : "Analyzing request..."}
            </p>
          </div>
        )}


        {bookingResult && !isLoading && ( // Show confirmation only when not loading
          <BookingConfirmation
            bookingDetails={bookingResult.formData}
            authorization={bookingResult}
            bookingId={bookingResult.bookingId} // Pass bookingId if available
          />
        )}

        {error && !isLoading && ( // Show error only when not loading
          <div className="rounded-md border border-destructive bg-destructive/10 p-4 text-center text-destructive">
            <p className="font-semibold">Error:</p>
            <p>{error}</p>
          </div>
        )}

        {(bookingResult || error) && !isLoading && ( // Show reset button after confirmation or error
           <button
            onClick={() => {
              setBookingResult(null);
              setError(null);
            }}
            className="mt-4 w-full rounded-md bg-secondary px-4 py-2 text-secondary-foreground shadow-sm transition-colors hover:bg-secondary/80 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
           >
            Make Another Booking
          </button>
        )}
      </div>
       {/* Add Logout Button */}
        <Button
          variant="outline"
          onClick={async () => {
            await auth.signOut();
            // Optionally redirect to login or show logged out message
             toast({ title: 'Logged Out', description: 'You have been successfully logged out.' });
             // router.push('/login'); // Optional redirect
          }}
          className="absolute right-4 top-4"
        >
          Logout
        </Button>
    </main>
  );
}
