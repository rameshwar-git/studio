'use server';
/**
 * @fileOverview Placeholder email service. In a real app, integrate with an email provider like SendGrid or Mailgun.
 */

import type { BookingFormData } from "@/components/booking-form"; // Adjust path as needed

/**
 * Simulates sending an approval email to the director.
 * @param to - The recipient email address (director).
 * @param token - The unique authorization token.
 * @param bookingDetails - The details of the booking request.
 */
export async function sendApprovalEmail(to: string, token: string, bookingDetails: BookingFormData): Promise<void> {
  const approvalLink = `${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:9002'}/approve/${token}`; // Ensure you have BASE_URL in your env

  const emailSubject = `Booking Request Approval Needed: ${bookingDetails.studentId} - ${bookingDetails.hallPreference}`;
  const emailBody = `
    <p>A new hall booking request requires your approval:</p>
    <ul>
      <li><strong>Student ID:</strong> ${bookingDetails.studentId}</li>
      <li><strong>Hall Preference:</strong> ${bookingDetails.hallPreference}</li>
      <li><strong>Date:</strong> ${bookingDetails.dates.toLocaleDateString()}</li>
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

  // In a real application, you would use an email sending library here:
  // e.g., using SendGrid:
  // const sgMail = require('@sendgrid/mail');
  // sgMail.setApiKey(process.env.SENDGRID_API_KEY);
  // const msg = {
  //   to: to,
  //   from: 'noreply@yourdomain.com', // Use a verified sender
  //   subject: emailSubject,
  //   html: emailBody,
  // };
  // try {
  //   await sgMail.send(msg);
  //   console.log('Approval email sent successfully');
  // } catch (error) {
  //   console.error('Error sending approval email:', error);
  //   if (error.response) {
  //     console.error(error.response.body)
  //   }
  //   throw new Error('Failed to send approval email.');
  // }

  // For simulation purposes, we just log the details.
  await new Promise(resolve => setTimeout(resolve, 500)); // Simulate network delay
}

/**
 * Simulates sending a confirmation email to the student.
 * @param to - The recipient email address (student - derived if possible, or use a placeholder).
 * @param status - The final status of the booking ('approved' or 'rejected').
 * @param bookingDetails - The details of the booking request.
 * @param reason - Optional reason for rejection.
 */
export async function sendConfirmationEmail(to: string, status: 'approved' | 'rejected', bookingDetails: BookingFormData, reason?: string): Promise<void> {
    const emailSubject = `Booking Request Update: ${bookingDetails.hallPreference} on ${bookingDetails.dates.toLocaleDateString()}`;
    let emailBody = `
      <p>Your hall booking request has been updated:</p>
      <ul>
        <li><strong>Student ID:</strong> ${bookingDetails.studentId}</li>
        <li><strong>Hall Preference:</strong> ${bookingDetails.hallPreference}</li>
        <li><strong>Date:</strong> ${bookingDetails.dates.toLocaleDateString()}</li>
        <li><strong>Status:</strong> ${status === 'approved' ? 'Approved' : 'Rejected'}</li>
      </ul>
    `;

    if (status === 'rejected' && reason) {
        emailBody += `<p><strong>Reason for Rejection:</strong> ${reason}</p>`;
    } else if (status === 'approved') {
         emailBody += `<p>Your booking is confirmed. Please contact the administration for any further details.</p>`;
    }


    console.log("--- SIMULATING STUDENT CONFIRMATION EMAIL ---");
    console.log("To:", to); // Note: We don't have student email in the form, using placeholder
    console.log("Subject:", emailSubject);
    console.log("Body:", emailBody);
    console.log("--- END SIMULATING STUDENT CONFIRMATION EMAIL ---");

    // Add real email sending logic here as in sendApprovalEmail
     await new Promise(resolve => setTimeout(resolve, 500)); // Simulate network delay
}
