
'use server';
/**
 * @fileOverview Placeholder email service. In a real app, integrate with an email provider like SendGrid or Mailgun.
 */

import type { BookingFormData } from "@/components/booking-form"; // Adjust path as needed
import { format as formatDateFn, parse } from 'date-fns'; // Renamed to avoid conflict

/**
 * Simulates sending an approval email to the director.
 * @param to - The recipient email address (director).
 * @param token - The unique authorization token.
 * @param bookingDetails - The details of the booking request.
 */
export async function sendApprovalEmail(to: string, token: string, bookingDetails: BookingFormData): Promise<void> {
  const approvalLink = `${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:9002'}/approve/${token}`; // Ensure you have BASE_URL in your env

  const formatTime = (timeString: string) => {
    if (!timeString) return 'N/A';
    const [hours, minutes] = timeString.split(':');
    const tempDate = new Date(2000, 0, 1, parseInt(hours), parseInt(minutes));
    return formatDateFn(tempDate, 'p');
  };

  const emailSubject = `Booking Request Approval Needed: ${bookingDetails.studentEmail} - ${bookingDetails.hallPreference}`;
  const emailBody = `
    <p>A new hall booking request requires your approval:</p>
    <ul>
      <li><strong>Student Name:</strong> ${bookingDetails.studentName}</li>
      <li><strong>Student Email:</strong> ${bookingDetails.studentEmail}</li>
      <li><strong>Hall Preference:</strong> ${bookingDetails.hallPreference}</li>
      <li><strong>Date:</strong> ${formatDateFn(bookingDetails.date, 'PPP')}</li>
      <li><strong>Time:</strong> ${formatTime(bookingDetails.startTime)} - ${formatTime(bookingDetails.endTime)}</li>
    </ul>
    <p>Please review the request and approve or reject it by clicking the link below:</p>
    <p><a href="${approvalLink}">Review Booking Request</a></p>
    <p>Link: ${approvalLink}</p>
  `;

  console.log("--- SIMULATING EMAIL ---");
  console.log("To:", to);
  console.log("Subject:", emailSubject);
  console.log("Body:", emailBody);
  console.log("--- END SIMULATING EMAIL ---");
  await new Promise(resolve => setTimeout(resolve, 500));
}

/**
 * Simulates sending a confirmation email to the student.
 * @param to - The recipient email address (student - derived if possible, or use a placeholder).
 * @param status - The final status of the booking ('approved' or 'rejected').
 * @param bookingDetails - The details of the booking request.
 * @param reason - Optional reason for rejection.
 */
export async function sendConfirmationEmail(to: string, status: 'approved' | 'rejected', bookingDetails: BookingFormData, reason?: string): Promise<void> {
    const formatTime = (timeString: string) => {
        if (!timeString) return 'N/A';
        const [hours, minutes] = timeString.split(':');
        const tempDate = new Date(2000, 0, 1, parseInt(hours), parseInt(minutes));
        return formatDateFn(tempDate, 'p');
    };
    
    const emailSubject = `Booking Request Update: ${bookingDetails.hallPreference} on ${formatDateFn(bookingDetails.date, 'PPP')}`;
    let emailBody = `
      <p>Your hall booking request for <strong>${bookingDetails.hallPreference}</strong> has been updated:</p>
      <ul>
        <li><strong>Student Name:</strong> ${bookingDetails.studentName}</li>
        <li><strong>Student Email:</strong> ${bookingDetails.studentEmail}</li>
        <li><strong>Hall Preference:</strong> ${bookingDetails.hallPreference}</li>
        <li><strong>Date:</strong> ${formatDateFn(bookingDetails.date, 'PPP')}</li>
        <li><strong>Time:</strong> ${formatTime(bookingDetails.startTime)} - ${formatTime(bookingDetails.endTime)}</li>
        <li><strong>Status:</strong> ${status === 'approved' ? 'Approved' : 'Rejected'}</li>
      </ul>
    `;

    if (status === 'rejected' && reason) {
        emailBody += `<p><strong>Reason for Rejection:</strong> ${reason}</p>`;
    } else if (status === 'approved') {
         emailBody += `<p>Your booking is confirmed. Please contact the administration for any further details.</p>`;
    }


    console.log("--- SIMULATING STUDENT CONFIRMATION EMAIL ---");
    console.log("To:", to); 
    console.log("Subject:", emailSubject);
    console.log("Body:", emailBody);
    console.log("--- END SIMULATING STUDENT CONFIRMATION EMAIL ---");

     await new Promise(resolve => setTimeout(resolve, 500));
}

