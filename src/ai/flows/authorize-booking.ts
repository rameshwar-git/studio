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
  studentId: z.string().describe('The ID of the student making the booking request.'),
  hallPreference: z.string().describe('The preferred hall for the booking.'),
  dates: z.string().describe('The dates for which the hall is being requested.'),
  studentHistory: z.string().describe('A summary of the student history, including any past issues or violations.'),
  hallAvailability: z.string().describe('Information on the availability of the requested hall for the given dates.'),
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
  prompt: `You are an AI assistant that determines whether a hall booking request requires director approval based on student history and hall availability.\n\nStudent ID: {{{studentId}}}\nHall Preference: {{{hallPreference}}}\nDates: {{{dates}}}\nStudent History: {{{studentHistory}}}\nHall Availability: {{{hallAvailability}}}\n\nBased on this information, determine if the booking request requires director approval. Explain the reason for your decision. `,
});

const authorizeBookingFlow = ai.defineFlow(
  {
    name: 'authorizeBookingFlow',
    inputSchema: AuthorizeBookingInputSchema,
    outputSchema: AuthorizeBookingOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
