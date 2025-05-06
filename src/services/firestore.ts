'use server';
/**
 * @fileOverview Firebase service functions for managing booking (Firestore) and user profile data (Realtime Database).
 */
import { db, realtimeDB } from '@/lib/firebase'; // Use db for Firestore, realtimeDB for Realtime DB
import { collection, addDoc, query, where, getDocs, updateDoc, doc, getDoc, serverTimestamp as firestoreServerTimestamp, Timestamp, orderBy, type FieldValue } from 'firebase/firestore';
import { ref as rtdbRef, set as setRealtimeDB, get as getRealtimeDB, serverTimestamp as realtimeServerTimestamp } from "firebase/database";
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
const HALL_BOOKINGS_RTDB_PATH = 'hallBookings'; // Path for hall bookings in Realtime Database
const DATA_FETCH_FAILURES_RTDB_PATH = 'dataFetchFailures/hallBookingsForDate';


export async function saveUserProfile(userId: string, profileData: Omit<UserProfileData, 'createdAt'>): Promise<void> {
  try {
    const userProfileRef = rtdbRef(realtimeDB, `${USERS_RTDB_PATH}/${userId}/profile`);
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
    
    const bookingDateStartOfDay = startOfDay(date); // This is a JS Date
    const [startH, startM] = startTime.split(':').map(Number);
    const [endH, endM] = endTime.split(':').map(Number);

    const startTimeDate = setMinutes(setHours(bookingDateStartOfDay, startH), startM); // JS Date
    const endTimeDate = setMinutes(setHours(bookingDateStartOfDay, endH), endM); // JS Date

    // 1. Save to Firestore
    const docRef = await addDoc(collection(db, PENDING_BOOKINGS_COLLECTION), {
      ...restOfDetails,
      date: Timestamp.fromDate(bookingDateStartOfDay), 
      startTime, 
      endTime,   
      startTimeDate: Timestamp.fromDate(startTimeDate), 
      endTimeDate: Timestamp.fromDate(endTimeDate),     
      userId: userId || null,
      status: 'pending',
      token: token,
      createdAt: firestoreServerTimestamp(),
      aiReason: aiReason || null,
    });
    console.log("Pending booking saved to Firestore with ID: ", docRef.id);

    // 2. Save to Realtime Database
    // This fulfills the requirement: "if there is no data on hall booking in real time database there create new entry in realtime database"
    // by ensuring every new booking saved to Firestore also gets an entry in Realtime Database.
    const bookingId = docRef.id;
    const hallBookingRef = rtdbRef(realtimeDB, `${HALL_BOOKINGS_RTDB_PATH}/${bookingId}`);
    
    // Constructing the data for Realtime Database.
    // We'll store simplified data, or you can store the full BookingRequest object.
    // For this example, let's store key details.
    // Note: Realtime Database doesn't have a native Timestamp type like Firestore.
    // Dates are often stored as ISO strings or milliseconds since epoch.
    const rtdbBookingData = {
        firestoreId: bookingId,
        studentName: restOfDetails.studentName,
        studentEmail: restOfDetails.studentEmail,
        hallPreference: restOfDetails.hallPreference,
        date: bookingDateStartOfDay.toISOString(), // Store as ISO string
        startTime: startTime,
        endTime: endTime,
        startTimeISO: startTimeDate.toISOString(),
        endTimeISO: endTimeDate.toISOString(),
        status: 'pending',
        userId: userId || null,
        createdAt: realtimeServerTimestamp(), // Use Realtime Database server timestamp
        aiReason: aiReason || null,
    };
    await setRealtimeDB(hallBookingRef, rtdbBookingData);
    console.log("Booking data also saved to Realtime Database under hallBookings/", bookingId);

    return bookingId;
  } catch (e: any) {
    console.error("Error adding document and/or saving to Realtime Database: ", e);
    throw new Error(`Failed to save pending booking request: ${e.message || 'Unknown error'}`);
  }
}

function mapDocToBookingRequest(docSnap: any): BookingRequest {
    const data = docSnap.data();
    const bookingDate = (data.date as Timestamp).toDate();
    
    let startTimeDate, endTimeDate;
    // If startTimeDate and endTimeDate are already Firestore Timestamps, use them.
    // Otherwise, construct from date, startTime, endTime.
    if (data.startTimeDate && data.endTimeDate) {
        startTimeDate = (data.startTimeDate as Timestamp).toDate();
        endTimeDate = (data.endTimeDate as Timestamp).toDate();
    } else if (data.startTime && data.endTime) {
        // Fallback if precise timestamps are not stored (though they should be by savePendingBooking)
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
      startTimeDate: startTimeDate,
      endTimeDate: endTimeDate,
      status: data.status,
      token: data.token,
      createdAt: data.createdAt, // Firestore Timestamp
      userId: data.userId,
      approvedAt: data.approvedAt, // Firestore Timestamp
      rejectedAt: data.rejectedAt, // Firestore Timestamp
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
    // 1. Update Firestore
    const bookingRef = doc(db, PENDING_BOOKINGS_COLLECTION, bookingId);
    const updateData: Partial<BookingRequest> & { approvedAt?: FieldValue, rejectedAt?: FieldValue, status: 'approved' | 'rejected'} = { 
        status: newStatus,
    };
    if (newStatus === 'approved') {
        updateData.approvedAt = firestoreServerTimestamp(); 
        updateData.rejectionReason = undefined; 
    } else {
        updateData.rejectedAt = firestoreServerTimestamp(); 
        updateData.rejectionReason = rejectionReason || "No reason provided.";
    }
    
    await updateDoc(bookingRef, updateData);
    console.log(`Booking ${bookingId} status updated to ${newStatus} in Firestore`);

    // 2. Update Realtime Database
    const hallBookingRtdbRef = rtdbRef(realtimeDB, `${HALL_BOOKINGS_RTDB_PATH}/${bookingId}`);
    const rtdbSnapshot = await getRealtimeDB(hallBookingRtdbRef);
    if (rtdbSnapshot.exists()) {
        const rtdbUpdateData: any = { status: newStatus };
        if (newStatus === 'approved') {
            rtdbUpdateData.approvedAt = realtimeServerTimestamp();
            rtdbUpdateData.rejectionReason = null; // Clear rejection reason in RTDB
        } else {
            rtdbUpdateData.rejectedAt = realtimeServerTimestamp();
            rtdbUpdateData.rejectionReason = rejectionReason || "No reason provided.";
        }
        await setRealtimeDB(rtdbRef(realtimeDB, `${HALL_BOOKINGS_RTDB_PATH}/${bookingId}`), {
            ...rtdbSnapshot.val(), // Preserve existing data
            ...rtdbUpdateData      // Apply updates
        });
        console.log(`Booking ${bookingId} status updated to ${newStatus} in Realtime Database`);
    } else {
        console.warn(`Booking ${bookingId} not found in Realtime Database for status update.`);
        // Optionally, you could create it here if it's missing, based on Firestore data.
        // For now, just log a warning.
    }

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
        const userProfileRef = rtdbRef(realtimeDB, `${USERS_RTDB_PATH}/${userId}/profile`);
        const snapshot = await getRealtimeDB(userProfileRef);

        if (!snapshot.exists()) {
            console.warn(`No user profile found in Realtime Database for ID: ${userId}.`);
            return null;
        }
        const data = snapshot.val() as UserProfileData; 
         if (!data || !data.name || !data.email || !data.department) {
            console.error(`User profile data from Realtime Database for ID ${userId} is incomplete or malformed:`, data);
            throw new Error(`Incomplete user profile data retrieved for ID ${userId}.`);
        }
        console.log("User profile found in Realtime Database for ID:", userId, data);
        return data;

    } catch (e: any) 
     {
        console.error(`Error getting user profile from Realtime Database for ID ${userId}: `, e);
         if (e.message && (e.message.startsWith('Failed to retrieve user profile') || e.message.startsWith('Incomplete user profile data'))) {
             throw e; 
        }
        
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
 * Retrieves all bookings for a specific hall on a specific date from Firestore.
 * If retrieval fails, it logs a failure entry to Firebase Realtime Database.
 * @param hallPreference - The name of the hall.
 * @param date - The specific date (JS Date object, time part will be ignored for date range).
 * @returns An array of booking requests for that hall and date.
 */
export async function getHallBookingsForDate(hallPreference: string, date: Date): Promise<BookingRequest[]> {
  try {
    // Query Firestore as it's the source of truth for detailed booking objects
    const dayStart = Timestamp.fromDate(startOfDay(date));
    const dayEnd = Timestamp.fromDate(endOfDay(date));

    const q = query(
      collection(db, PENDING_BOOKINGS_COLLECTION),
      where("hallPreference", "==", hallPreference),
      where("date", ">=", dayStart), 
      where("date", "<=", dayEnd),   
      where("status", "in", ["pending", "approved"]) 
    );
    const querySnapshot = await getDocs(q);
    const bookings: BookingRequest[] = querySnapshot.docs.map(mapDocToBookingRequest);
    console.log(`Found ${bookings.length} Firestore bookings for hall '${hallPreference}' on ${format(date, 'PPP')}`);
    return bookings;
  } catch (e: any) {
    const errorMessage = e instanceof Error ? e.message : 'Unknown error';
    console.error(`Error getting bookings for hall ${hallPreference} on date ${date}: `, errorMessage);
    
    // Log failure to Realtime Database
    try {
      const dateString = format(date, 'yyyy-MM-dd');
      const failureLogRef = rtdbRef(realtimeDB, `${DATA_FETCH_FAILURES_RTDB_PATH}/${hallPreference}/${dateString}`);
      await setRealtimeDB(failureLogRef, {
        hallPreference: hallPreference,
        date: dateString,
        error: errorMessage,
        timestamp: realtimeServerTimestamp(),
      });
      console.log(`Logged Firestore fetch failure to Realtime Database for hall '${hallPreference}' on ${dateString}`);
    } catch (logError: any) {
      console.error(`Failed to log Firestore fetch failure to Realtime Database: `, logError);
    }
    // Re-throw original error after attempting to log
    throw new Error(`Failed to retrieve hall bookings for date: ${errorMessage}`);
  }
}

/**
 * Retrieves all bookings for all halls within a given month from Firestore.
 * This is used for populating the venue availability calendar.
 * @param year - The year (e.g., 2024).
 * @param month - The month (0-indexed, e.g., 0 for January).
 * @returns An array of all booking requests for that month.
 */
export async function getVenueAvailabilityForMonth(year: number, month: number): Promise<BookingRequest[]> {
  try {
    // Query Firestore as it's the source of truth
    const dateInMonth = new Date(year, month, 1);
    const monthStart = Timestamp.fromDate(startOfMonth(dateInMonth));
    const monthEnd = Timestamp.fromDate(endOfMonth(dateInMonth));

    const q = query(
      collection(db, PENDING_BOOKINGS_COLLECTION),
      where("date", ">=", monthStart),
      where("date", "<=", monthEnd),
      where("status", "in", ["pending", "approved"]) 
    );
    const querySnapshot = await getDocs(q);
    const bookings: BookingRequest[] = querySnapshot.docs.map(mapDocToBookingRequest);
    console.log(`Found ${bookings.length} total Firestore bookings for ${format(dateInMonth, 'MMMM yyyy')}`);
    return bookings;
  } catch (e: any) {
    console.error(`Error getting venue availability for month ${month + 1}/${year}: `, e);
    throw new Error(`Failed to retrieve venue availability: ${e.message || 'Unknown error'}`);
  }
}

// Example function to get a booking from Realtime Database (if needed directly)
// This is illustrative, as Firestore is currently the primary source for getHallBookingsForDate and getVenueAvailabilityForMonth
export async function getHallBookingFromRealtimeDB(bookingId: string): Promise<any | null> {
    try {
        const bookingRef = rtdbRef(realtimeDB, `${HALL_BOOKINGS_RTDB_PATH}/${bookingId}`);
        const snapshot = await getRealtimeDB(bookingRef);
        if (snapshot.exists()) {
            return snapshot.val();
        }
        return null;
    } catch (e: any) {
        console.error(`Error fetching booking ${bookingId} from Realtime Database: `, e);
        throw new Error(`Failed to fetch booking from Realtime Database: ${e.message || 'Unknown error'}`);
    }
}

// Example function to get all hall bookings from Realtime Database for a specific date
// This would require restructuring how data is stored in RTDB or client-side filtering
// For complex queries, Firestore is generally preferred.
// This is a simplified example and might be inefficient for large datasets.
export async function getHallBookingsForDateFromRealtimeDB(date: Date): Promise<any[]> {
    try {
        const allBookingsRef = rtdbRef(realtimeDB, HALL_BOOKINGS_RTDB_PATH);
        const snapshot = await getRealtimeDB(allBookingsRef);
        if (snapshot.exists()) {
            const allBookings = snapshot.val();
            const dateString = startOfDay(date).toISOString().split('T')[0]; // YYYY-MM-DD
            
            const bookingsForDate = Object.values(allBookings).filter((booking: any) => {
                return booking.date && booking.date.startsWith(dateString) && (booking.status === 'pending' || booking.status === 'approved');
            });
            return bookingsForDate;
        }
        return [];
    } catch (e: any) {
        console.error(`Error fetching hall bookings for date ${date.toISOString()} from Realtime Database: `, e);
        throw new Error(`Failed to fetch bookings from Realtime Database: ${e.message || 'Unknown error'}`);
    }
}
