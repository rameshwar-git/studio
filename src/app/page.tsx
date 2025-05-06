'use client';

import * as React from 'react';
import type {BookingFormData} from '@/components/booking-form';
import {BookingForm} from '@/components/booking-form';
import {BookingConfirmation} from '@/components/booking-confirmation';
import type {AuthorizeBookingOutput} from '@/ai/flows/authorize-booking';

interface BookingResult extends AuthorizeBookingOutput {
  formData: BookingFormData;
}

export default function Home() {
  const [bookingResult, setBookingResult] = React.useState<BookingResult | null>(null);
  const [isLoading, setIsLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const handleBookingSubmit = (result: BookingResult | null, error?: string) => {
    setBookingResult(result);
    setError(error || null);
    setIsLoading(false);
  };

  const handleLoadingChange = (loading: boolean) => {
    setIsLoading(loading);
    // Reset state when starting a new submission
    if (loading) {
      setBookingResult(null);
      setError(null);
    }
  };

  return (
    <main className="container mx-auto flex min-h-screen flex-col items-center justify-center p-4 md:p-8">
      <div className="w-full max-w-2xl space-y-8">
        <h1 className="text-center text-4xl font-bold text-primary">HallPass</h1>
        <p className="text-center text-muted-foreground">
          Register for your college hall booking.
        </p>

        {!bookingResult && !error && (
          <BookingForm
            onSubmitSuccess={handleBookingSubmit}
            onLoadingChange={handleLoadingChange}
            isLoading={isLoading}
          />
        )}

        {isLoading && (
          <div className="text-center text-muted-foreground">Processing your request...</div>
        )}

        {bookingResult && (
          <BookingConfirmation
            bookingDetails={bookingResult.formData}
            authorization={bookingResult}
          />
        )}

        {error && (
          <div className="rounded-md border border-destructive bg-destructive/10 p-4 text-center text-destructive">
            <p className="font-semibold">Error:</p>
            <p>{error}</p>
          </div>
        )}

        {(bookingResult || error) && !isLoading && (
           <button
            onClick={() => {
              setBookingResult(null);
              setError(null);
            }}
            className="mt-4 w-full rounded-md bg-secondary px-4 py-2 text-secondary-foreground hover:bg-secondary/80"
           >
            Make Another Booking
          </button>
        )}
      </div>
    </main>
  );
}
