'use server';
/**
 * @fileOverview AI authorization for hall bookings based on student history and hall availability.
 *
 * - authorizeBooking - A function that determines if a hall booking request requires director approval.
 * - AuthorizeBookingInput - The input type for the authorizeBooking function.
 * - AuthorizeBookingOutput - The return type for the authorizeBooking function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const AuthorizeBookingInputSchema = z.object({
  studentId: z.string().describe('The ID or email of the student making the booking request.'),
  hallPreference: z.string().describe('The preferred hall for the booking.'),
  dates: z.string().describe('The date for which the hall is being requested (e.g., "May 10, 2024").'),
  startTime: z.string().describe('The start time for the booking (e.g., "09:00").'),
  endTime: z.string().describe('The end time for the booking (e.g., "10:00").'),
  studentHistory: z.string().describe('A summary of the student history, including any past issues or violations.'),
  hallAvailability: z.string().describe('Information on the availability of the requested hall for the given date and time, considering any required gaps between bookings.'),
});
export type AuthorizeBookingInput = z.infer<typeof AuthorizeBookingInputSchema>;

const AuthorizeBookingOutputSchema = z.object({
  requiresDirectorApproval: z.boolean().describe('Whether the booking request requires director approval.'),
  reason: z.string().describe('The reason for requiring or not requiring director approval.'),
});
export type AuthorizeBookingOutput = z.infer<typeof AuthorizeBookingOutputSchema>;

export async function authorizeBooking(input: AuthorizeBookingInput): Promise<AuthorizeBookingOutput> {
  return authorizeBookingFlow(input);
}

const prompt = ai.definePrompt({
  name: 'authorizeBookingPrompt',
  input: {schema: AuthorizeBookingInputSchema},
  output: {schema: AuthorizeBookingOutputSchema},
  prompt: `You are an AI assistant that determines whether a college hall booking request requires director approval.
Consider the student's history and the hall's availability (including any mandatory 1-hour gaps between bookings).

Booking Request Details:
- Student ID/Email: {{{studentId}}}
- Hall Preference: {{{hallPreference}}}
- Date: {{{dates}}}
- Start Time: {{{startTime}}}
- End Time: {{{endTime}}}

Contextual Information:
- Student History: {{{studentHistory}}}
- Hall Availability Summary: {{{hallAvailability}}}

Based on all this information, determine if this booking request requires director approval.
Provide a concise reason for your decision.
For example, if student history is problematic or if the request is unusual (e.g., outside standard hours, very long duration, specific high-demand hall), it might require approval.
If the student history is clean and the hall is generally available for the requested slot as per standard procedures, it might not require director approval.
`,
});

const authorizeBookingFlow = ai.defineFlow(
  {
    name: 'authorizeBookingFlow',
    inputSchema: AuthorizeBookingInputSchema,
    outputSchema: AuthorizeBookingOutputSchema,
  },
  async (input) => {
    const {output} = await prompt(input);
    return output!;
  }
);
