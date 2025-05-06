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
export async function sendApprovalEmail(to: string, token: string, bookingDetails: BookingFormData): Promise&lt;void&gt; {
  const approvalLink = `${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:9002'}/approve/${token}`; // Ensure you have BASE_URL in your env

  const formatTime = (timeString: string) =&gt; {
    if (!timeString) return 'N/A';
    const [hours, minutes] = timeString.split(':');
    const tempDate = new Date(2000, 0, 1, parseInt(hours), parseInt(minutes));
    return formatDateFn(tempDate, 'p');
  };

  const emailSubject = `Booking Request Approval Needed: ${bookingDetails.studentEmail} - ${bookingDetails.hallPreference}`;
  const emailBody = `
    &lt;p&gt;A new hall booking request requires your approval:&lt;/p&gt;
    &lt;ul&gt;
      &lt;li&gt;&lt;strong&gt;Student Name:&lt;/strong&gt; ${bookingDetails.studentName}&lt;/li&gt;
      &lt;li&gt;&lt;strong&gt;Student Email:&lt;/strong&gt; ${bookingDetails.studentEmail}&lt;/li&gt;
      &lt;li&gt;&lt;strong&gt;Hall Preference:&lt;/strong&gt; ${bookingDetails.hallPreference}&lt;/li&gt;
      &lt;li&gt;&lt;strong&gt;Date:&lt;/strong&gt; ${formatDateFn(bookingDetails.date, 'PPP')}&lt;/li&gt;
      &lt;li&gt;&lt;strong&gt;Time:&lt;/strong&gt; ${formatTime(bookingDetails.startTime)} - ${formatTime(bookingDetails.endTime)}&lt;/li&gt;
    &lt;/ul&gt;
    &lt;p&gt;Please review the request and approve or reject it by clicking the link below:&lt;/p&gt;
    &lt;p&gt;&lt;a href="${approvalLink}"&gt;Review Booking Request&lt;/a&gt;&lt;/p&gt;
    &lt;p&gt;Link: ${approvalLink}&lt;/p&gt;
  `;

  console.log("--- SIMULATING EMAIL ---");
  console.log("To:", to);
  console.log("Subject:", emailSubject);
  console.log("Body:", emailBody);
  console.log("--- END SIMULATING EMAIL ---");
  await new Promise(resolve =&gt; setTimeout(resolve, 500)); 
}

/**
 * Simulates sending a confirmation email to the student.
 * @param to - The recipient email address (student - derived if possible, or use a placeholder).
 * @param status - The final status of the booking ('approved' or 'rejected').
 * @param bookingDetails - The details of the booking request.
 * @param reason - Optional reason for rejection.
 */
export async function sendConfirmationEmail(to: string, status: 'approved' | 'rejected', bookingDetails: BookingFormData, reason?: string): Promise&lt;void&gt; {
    const formatTime = (timeString: string) =&gt; {
        if (!timeString) return 'N/A';
        const [hours, minutes] = timeString.split(':');
        const tempDate = new Date(2000, 0, 1, parseInt(hours), parseInt(minutes));
        return formatDateFn(tempDate, 'p');
    };
    
    const emailSubject = `Booking Request Update: ${bookingDetails.hallPreference} on ${formatDateFn(bookingDetails.date, 'PPP')}`;
    let emailBody = `
      &lt;p&gt;Your hall booking request for &lt;strong&gt;${bookingDetails.hallPreference}&lt;/strong&gt; has been updated:&lt;/p&gt;
      &lt;ul&gt;
        &lt;li&gt;&lt;strong&gt;Student Name:&lt;/strong&gt; ${bookingDetails.studentName}&lt;/li&gt;
        &lt;li&gt;&lt;strong&gt;Student Email:&lt;/strong&gt; ${bookingDetails.studentEmail}&lt;/li&gt;
        &lt;li&gt;&lt;strong&gt;Hall Preference:&lt;/strong&gt; ${bookingDetails.hallPreference}&lt;/li&gt;
        &lt;li&gt;&lt;strong&gt;Date:&lt;/strong&gt; ${formatDateFn(bookingDetails.date, 'PPP')}&lt;/li&gt;
        &lt;li&gt;&lt;strong&gt;Time:&lt;/strong&gt; ${formatTime(bookingDetails.startTime)} - ${formatTime(bookingDetails.endTime)}&lt;/li&gt;
        &lt;li&gt;&lt;strong&gt;Status:&lt;/strong&gt; ${status === 'approved' ? 'Approved' : 'Rejected'}&lt;/li&gt;
      &lt;/ul&gt;
    `;

    if (status === 'rejected' &amp;&amp; reason) {
        emailBody += `&lt;p&gt;&lt;strong&gt;Reason for Rejection:&lt;/strong&gt; ${reason}&lt;/p&gt;`;
    } else if (status === 'approved') {
         emailBody += `&lt;p&gt;Your booking is confirmed. Please contact the administration for any further details.&lt;/p&gt;`;
    }


    console.log("--- SIMULATING STUDENT CONFIRMATION EMAIL ---");
    console.log("To:", to); 
    console.log("Subject:", emailSubject);
    console.log("Body:", emailBody);
    console.log("--- END SIMULATING STUDENT CONFIRMATION EMAIL ---");

     await new Promise(resolve =&gt; setTimeout(resolve, 500)); 
}
