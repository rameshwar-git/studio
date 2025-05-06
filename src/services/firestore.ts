'use server';
/**
 * @fileOverview Firestore service functions for managing booking data.
 */
import { db } from '@/lib/firebase';
import { collection, addDoc, query, where, getDocs, updateDoc, doc, getDoc, serverTimestamp, Timestamp } from 'firebase/firestore';
import type { BookingFormData } from '@/components/booking-form'; // Assuming BookingFormData includes necessary fields

export interface BookingRequest extends BookingFormData {
  id?: string; // Firestore document ID
  status: 'pending' | 'approved' | 'rejected';
  token: string;
  createdAt: Timestamp;
  approvedAt?: Timestamp;
  rejectedAt?: Timestamp;
}

const PENDING_BOOKINGS_COLLECTION = 'pendingBookings';

/**
 * Saves a pending booking request to Firestore.
 * @param bookingDetails - The details of the booking.
 * @param token - The unique authorization token.
 * @returns The ID of the newly created Firestore document.
 */
export async function savePendingBooking(bookingDetails: BookingFormData, token: string): Promise<string> {
  try {
    const docRef = await addDoc(collection(db, PENDING_BOOKINGS_COLLECTION), {
      ...bookingDetails,
      dates: Timestamp.fromDate(bookingDetails.dates), // Store date as Firestore Timestamp
      status: 'pending',
      token: token,
      createdAt: serverTimestamp(),
    });
    console.log("Pending booking saved with ID: ", docRef.id);
    return docRef.id;
  } catch (e) {
    console.error("Error adding document: ", e);
    throw new Error("Failed to save pending booking request.");
  }
}

/**
 * Retrieves a booking request by its authorization token.
 * @param token - The authorization token.
 * @returns The booking request data or null if not found.
 */
export async function getBookingByToken(token: string): Promise<BookingRequest | null> {
  try {
    const q = query(collection(db, PENDING_BOOKINGS_COLLECTION), where("token", "==", token));
    const querySnapshot = await getDocs(q);

    if (querySnapshot.empty) {
      console.log("No matching booking found for token:", token);
      return null;
    }

    // Assuming token is unique, there should be only one document
    const docSnap = querySnapshot.docs[0];
    const data = docSnap.data();

    // Convert Firestore Timestamp back to Date object if needed by frontend
    const bookingData: BookingRequest = {
      id: docSnap.id,
      studentId: data.studentId,
      hallPreference: data.hallPreference,
      dates: (data.dates as Timestamp).toDate(), // Convert Timestamp to Date
      status: data.status,
      token: data.token,
      createdAt: data.createdAt,
       // Add optional fields if they exist
      approvedAt: data.approvedAt,
      rejectedAt: data.rejectedAt,
    };
     console.log("Booking found for token:", token, bookingData);
    return bookingData;
  } catch (e) {
    console.error("Error getting booking by token: ", e);
    throw new Error("Failed to retrieve booking request.");
  }
}

/**
 * Updates the status of a booking request by its Firestore document ID.
 * @param bookingId - The Firestore document ID of the booking.
 * @param newStatus - The new status ('approved' or 'rejected').
 */
export async function updateBookingStatus(bookingId: string, newStatus: 'approved' | 'rejected'): Promise<void> {
  try {
    const bookingRef = doc(db, PENDING_BOOKINGS_COLLECTION, bookingId);
    const updateData: { status: 'approved' | 'rejected'; approvedAt?: Timestamp; rejectedAt?: Timestamp } = {
        status: newStatus,
    };
    if (newStatus === 'approved') {
        updateData.approvedAt = serverTimestamp();
    } else {
        updateData.rejectedAt = serverTimestamp();
    }

    await updateDoc(bookingRef, updateData);
    console.log(`Booking ${bookingId} status updated to ${newStatus}`);
  } catch (e) {
    console.error("Error updating booking status: ", e);
    throw new Error("Failed to update booking status.");
  }
}


/**
 * Retrieves a booking request by its Firestore document ID.
 * @param bookingId - The Firestore document ID of the booking.
 * @returns The booking request data or null if not found.
 */
export async function getBookingById(bookingId: string): Promise<BookingRequest | null> {
    try {
      const bookingRef = doc(db, PENDING_BOOKINGS_COLLECTION, bookingId);
      const docSnap = await getDoc(bookingRef);

      if (!docSnap.exists()) {
        console.log("No booking found for ID:", bookingId);
        return null;
      }

      const data = docSnap.data();
      const bookingData: BookingRequest = {
        id: docSnap.id,
        studentId: data.studentId,
        hallPreference: data.hallPreference,
        dates: (data.dates as Timestamp).toDate(), // Convert Timestamp to Date
        status: data.status,
        token: data.token, // Include token if needed elsewhere
        createdAt: data.createdAt,
         // Add optional fields if they exist
        approvedAt: data.approvedAt,
        rejectedAt: data.rejectedAt,
      };
      console.log("Booking found for ID:", bookingId, bookingData);
      return bookingData;
    } catch (e) {
      console.error("Error getting booking by ID: ", e);
      throw new Error("Failed to retrieve booking request by ID.");
    }
  }
