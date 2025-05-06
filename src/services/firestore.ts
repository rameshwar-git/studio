'use server';
/**
 * @fileOverview Firebase service functions for managing booking (Firestore) and user profile data (Realtime Database).
 */
import { db, realtimeDB } from '@/lib/firebase'; // Use db for Firestore, realtimeDB for Realtime DB
import { collection, addDoc, query, where, getDocs, updateDoc, doc, getDoc, serverTimestamp as firestoreServerTimestamp, Timestamp, orderBy, type FieldValue } from 'firebase/firestore';
import { ref, set as setRealtimeDB, get as getRealtimeDB, serverTimestamp as realtimeServerTimestamp } from "firebase/database";
import type { BookingFormData } from '@/components/booking-form';
import { startOfDay, endOfDay, parse, format, setHours, setMinutes, startOfMonth, endOfMonth } from 'date-fns';


export interface BookingRequest extends BookingFormData {
  id?: string; // Firestore document ID
  status: 'pending' | 'approved' | 'rejected';
  token: string;
  createdAt: Timestamp; // Firestore Timestamp
  approvedAt?: Timestamp;
  rejectedAt?: Timestamp;
  userId?: string;
  rejectionReason?: string;
  aiReason?: string;
  // For querying and availability checks
  startTimeDate?: Date; 
  endTimeDate?: Date;
}

export interface UserProfileData {
    name: string;
    email: string;
    department: string;
    createdAt?: Timestamp | number | FieldValue; 
}

const PENDING_BOOKINGS_COLLECTION = 'pendingBookings';
const USERS_RTDB_PATH = 'users';


export async function saveUserProfile(userId: string, profileData: Omit<UserProfileData, 'createdAt'>): Promise<void> {
  try {
    const userProfileRef = ref(realtimeDB, `${USERS_RTDB_PATH}/${userId}/profile`);
    await setRealtimeDB(userProfileRef, {
        ...profileData,
        createdAt: realtimeServerTimestamp(), 
    });
    console.log("User profile saved to Realtime Database for user ID: ", userId);
  } catch (e: any) {
    console.error("Error saving user profile to Realtime Database: ", e);
    throw new Error(`Failed to save user profile: ${e.message || 'Unknown error'}`);
  }
}

export async function savePendingBooking(bookingDetails: BookingFormData, token: string, userId?: string, aiReason?: string): Promise<string> {
  try {
    const { date, startTime, endTime, ...restOfDetails } = bookingDetails;
    
    const bookingDateStartOfDay = startOfDay(date);
    const [startH, startM] = startTime.split(':').map(Number);
    const [endH, endM] = endTime.split(':').map(Number);

    const startTimeDate = setMinutes(setHours(bookingDateStartOfDay, startH), startM);
    const endTimeDate = setMinutes(setHours(bookingDateStartOfDay, endH), endM);

    const docRef = await addDoc(collection(db, PENDING_BOOKINGS_COLLECTION), {
      ...restOfDetails,
      date: Timestamp.fromDate(bookingDateStartOfDay), // Store date as Firestore Timestamp (start of day for easier date-only queries)
      startTime, // Store as string e.g., "09:00"
      endTime,   // Store as string e.g., "10:00"
      startTimeDate: Timestamp.fromDate(startTimeDate), // Store full JS Date as Firestore Timestamp for precise time queries
      endTimeDate: Timestamp.fromDate(endTimeDate),     // Store full JS Date as Firestore Timestamp
      userId: userId || null,
      status: 'pending',
      token: token,
      createdAt: firestoreServerTimestamp(),
      aiReason: aiReason || null,
    });
    console.log("Pending booking saved with ID: ", docRef.id);
    return docRef.id;
  } catch (e: any) {
    console.error("Error adding document: ", e);
    throw new Error(`Failed to save pending booking request: ${e.message || 'Unknown error'}`);
  }
}

function mapDocToBookingRequest(docSnap: any): BookingRequest {
    const data = docSnap.data();
    const bookingDate = (data.date as Timestamp).toDate();
    
    let startTimeDate, endTimeDate;
    if (data.startTime && data.endTime) {
        const [startH, startM] = data.startTime.split(':').map(Number);
        const [endH, endM] = data.endTime.split(':').map(Number);
        startTimeDate = setMinutes(setHours(bookingDate, startH), startM);
        endTimeDate = setMinutes(setHours(bookingDate, endH), endM);
    }


    return {
      id: docSnap.id,
      studentName: data.studentName,
      studentEmail: data.studentEmail,
      hallPreference: data.hallPreference,
      date: bookingDate, // This is the start of the day
      startTime: data.startTime,
      endTime: data.endTime,
      startTimeDate: data.startTimeDate ? (data.startTimeDate as Timestamp).toDate() : startTimeDate, // Prefer stored precise timestamp
      endTimeDate: data.endTimeDate ? (data.endTimeDate as Timestamp).toDate() : endTimeDate,       // Prefer stored precise timestamp
      status: data.status,
      token: data.token,
      createdAt: data.createdAt,
      userId: data.userId,
      approvedAt: data.approvedAt,
      rejectedAt: data.rejectedAt,
      rejectionReason: data.rejectionReason,
      aiReason: data.aiReason,
    };
}


export async function getBookingByToken(token: string): Promise<BookingRequest | null> {
  try {
    const q = query(collection(db, PENDING_BOOKINGS_COLLECTION), where("token", "==", token));
    const querySnapshot = await getDocs(q);

    if (querySnapshot.empty) {
      console.log("No matching booking found for token:", token);
      return null;
    }
    // querySnapshot.docs[0] is a QueryDocumentSnapshot<DocumentData, DocumentData>
    // It needs to be passed to mapDocToBookingRequest
    const booking = mapDocToBookingRequest(querySnapshot.docs[0]);
    console.log("Booking found for token:", token, booking);
    return booking;
  } catch (e: any) {
    console.error("Error getting booking by token: ", e);
    throw new Error(`Failed to retrieve booking request: ${e.message || 'Unknown error'}`);
  }
}

export async function updateBookingStatus(bookingId: string, newStatus: 'approved' | 'rejected', rejectionReason?: string): Promise<void> {
  try {
    const bookingRef = doc(db, PENDING_BOOKINGS_COLLECTION, bookingId);
    const updateData: Partial<BookingRequest> & { approvedAt?: FieldValue, rejectedAt?: FieldValue} = { // Ensure FieldValue is part of the type
        status: newStatus,
    };
    if (newStatus === 'approved') {
        updateData.approvedAt = firestoreServerTimestamp(); // Directly assign serverTimestamp
        updateData.rejectionReason = undefined; // Clear rejection reason
    } else {
        updateData.rejectedAt = firestoreServerTimestamp(); // Directly assign serverTimestamp
        updateData.rejectionReason = rejectionReason || "No reason provided.";
    }
    
    await updateDoc(bookingRef, updateData);
    console.log(`Booking ${bookingId} status updated to ${newStatus}`);
  } catch (e: any) {
    console.error("Error updating booking status: ", e);
    throw new Error(`Failed to update booking status: ${e.message || 'Unknown error'}`);
  }
}

export async function getBookingById(bookingId: string): Promise<BookingRequest | null> {
    try {
      const bookingRef = doc(db, PENDING_BOOKINGS_COLLECTION, bookingId);
      const docSnap = await getDoc(bookingRef);

      if (!docSnap.exists()) {
        console.log("No booking found for ID:", bookingId);
        return null;
      }
      const booking = mapDocToBookingRequest(docSnap);
      console.log("Booking found for ID:", bookingId, booking);
      return booking;
    } catch (e: any) {
      console.error("Error getting booking by ID: ", e);
      throw new Error(`Failed to retrieve booking request by ID: ${e.message || 'Unknown error'}`);
    }
  }

export async function getUserProfile(userId: string): Promise<UserProfileData | null> {
    try {
        const userProfileRef = ref(realtimeDB, `${USERS_RTDB_PATH}/${userId}/profile`);
        const snapshot = await getRealtimeDB(userProfileRef);

        if (!snapshot.exists()) {
            console.warn(`No user profile found in Realtime Database for ID: ${userId}.`);
            return null;
        }
        const data = snapshot.val() as UserProfileData; // Type assertion
         if (!data || !data.name || !data.email || !data.department) {
            console.error(`User profile data from Realtime Database for ID ${userId} is incomplete or malformed:`, data);
            throw new Error(`Incomplete user profile data retrieved for ID ${userId}.`);
        }
        console.log("User profile found in Realtime Database for ID:", userId, data);
        return data;

    } catch (e: any) // Explicitly type e as any or Error
     {
        console.error(`Error getting user profile from Realtime Database for ID ${userId}: `, e);
         // Check if the error is one of the specific messages we want to re-throw directly
         if (e.message && (e.message.startsWith('Failed to retrieve user profile') || e.message.startsWith('Incomplete user profile data'))) {
             throw e; // Re-throw the specific error
        }
        // For other errors, wrap it in a generic message
        throw new Error(`Failed to retrieve user profile. Original error: ${e.message || 'Unknown Realtime Database error'}`);
    }
}

export async function getUserBookings(userId: string): Promise<BookingRequest[]> {
  try {
    const q = query(
      collection(db, PENDING_BOOKINGS_COLLECTION),
      where("userId", "==", userId),
      orderBy("createdAt", "desc")
    );
    const querySnapshot = await getDocs(q);

    const bookings: BookingRequest[] = querySnapshot.docs.map(mapDocToBookingRequest);
    console.log(`Found ${bookings.length} bookings for user ID: ${userId}`);
    return bookings;
  } catch (e: any) {
    console.error("Error getting user bookings: ", e);
    throw new Error(`Failed to retrieve user bookings: ${e.message || 'Unknown error'}`);
  }
}


/**
 * Retrieves all bookings for a specific hall on a specific date.
 * This is used to check for time conflicts.
 * @param hallPreference - The name of the hall.
 * @param date - The specific date (JS Date object, time part will be ignored for date range).
 * @returns An array of booking requests for that hall and date.
 */
export async function getHallBookingsForDate(hallPreference: string, date: Date): Promise<BookingRequest[]> {
  try {
    const dayStart = Timestamp.fromDate(startOfDay(date));
    const dayEnd = Timestamp.fromDate(endOfDay(date));

    const q = query(
      collection(db, PENDING_BOOKINGS_COLLECTION),
      where("hallPreference", "==", hallPreference),
      where("date", ">=", dayStart), // Using the 'date' field which is start of day
      where("date", "<=", dayEnd),   // Using the 'date' field which is start of day
      where("status", "in", ["pending", "approved"]) // Only consider active/pending bookings
    );
    const querySnapshot = await getDocs(q);
    const bookings: BookingRequest[] = querySnapshot.docs.map(mapDocToBookingRequest);
    console.log(`Found ${bookings.length} bookings for hall '${hallPreference}' on ${format(date, 'PPP')}`);
    return bookings;
  } catch (e: any) {
    console.error(`Error getting bookings for hall ${hallPreference} on date ${date}: `, e);
    throw new Error(`Failed to retrieve hall bookings for date: ${e.message || 'Unknown error'}`);
  }
}

/**
 * Retrieves all bookings for all halls within a given month.
 * This is used for populating the venue availability calendar.
 * @param year - The year (e.g., 2024).
 * @param month - The month (0-indexed, e.g., 0 for January).
 * @returns An array of all booking requests for that month.
 */
export async function getVenueAvailabilityForMonth(year: number, month: number): Promise<BookingRequest[]> {
  try {
    const dateInMonth = new Date(year, month, 1);
    const monthStart = Timestamp.fromDate(startOfMonth(dateInMonth));
    const monthEnd = Timestamp.fromDate(endOfMonth(dateInMonth));

    const q = query(
      collection(db, PENDING_BOOKINGS_COLLECTION),
      where("date", ">=", monthStart),
      where("date", "<=", monthEnd),
      where("status", "in", ["pending", "approved"]) // Only consider active/pending bookings
    );
    const querySnapshot = await getDocs(q);
    const bookings: BookingRequest[] = querySnapshot.docs.map(mapDocToBookingRequest);
    console.log(`Found ${bookings.length} total bookings for ${format(dateInMonth, 'MMMM yyyy')}`);
    return bookings;
  } catch (e: any) {
    console.error(`Error getting venue availability for month ${month + 1}/${year}: `, e);
    throw new Error(`Failed to retrieve venue availability: ${e.message || 'Unknown error'}`);
  }
}

