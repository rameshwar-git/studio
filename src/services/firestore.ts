'use server';
/**
 * @fileOverview Firebase service functions for managing booking (Firestore) and user profile data (Realtime Database).
 */
import { db, realtimeDB } from '@/lib/firebase'; // Use db for Firestore, realtimeDB for Realtime DB
import { collection, addDoc, query, where, getDocs, updateDoc, doc, getDoc, serverTimestamp as firestoreServerTimestamp, Timestamp, orderBy, type FieldValue } from 'firebase/firestore';
import { ref as rtdbRef, set as setRealtimeDB, get as getRealtimeDB, serverTimestamp as realtimeServerTimestamp } from "firebase/database";
import type { BookingFormData } from '@/components/booking-form';
import { startOfDay, endOfDay, parse, format, setHours, setMinutes, startOfMonth, endOfMonth, isEqual, parseISO } from 'date-fns';


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
    
    const bookingDateStartOfDay = startOfDay(date); 
    const [startH, startM] = startTime.split(':').map(Number);
    const [endH, endM] = endTime.split(':').map(Number);

    const startTimeDate = setMinutes(setHours(bookingDateStartOfDay, startH), startM); 
    const endTimeDate = setMinutes(setHours(bookingDateStartOfDay, endH), endM); 

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
    const bookingId = docRef.id;
    const hallBookingRef = rtdbRef(realtimeDB, `${HALL_BOOKINGS_RTDB_PATH}/${bookingId}`);
    
    const rtdbBookingData = {
        firestoreId: bookingId,
        studentName: restOfDetails.studentName,
        studentEmail: restOfDetails.studentEmail,
        hallPreference: restOfDetails.hallPreference,
        date: bookingDateStartOfDay.toISOString(), 
        startTime: startTime, 
        endTime: endTime,     
        startTimeISO: startTimeDate.toISOString(), 
        endTimeISO: endTimeDate.toISOString(),     
        status: 'pending',
        userId: userId || null,
        createdAt: realtimeServerTimestamp(), 
        aiReason: aiReason || null,
    };
    await setRealtimeDB(hallBookingRef, rtdbBookingData);
    console.log("Booking data also saved to Realtime Database under hallBookings/", bookingId);

    //3. Also Save the User Bookings in Realtime Database
    if (userId) {
        const userBookingsRef = rtdbRef(realtimeDB, `${USERS_RTDB_PATH}/${userId}/bookings/${bookingId}`);
        await setRealtimeDB(userBookingsRef, {
            ...rtdbBookingData,
            requestDate: realtimeServerTimestamp(),
        });
        console.log(`Booking information saved for user ${userId} under bookings/${bookingId}`);
    }


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

    if (data.startTimeDate && data.endTimeDate && data.startTimeDate instanceof Timestamp && data.endTimeDate instanceof Timestamp) {
        startTimeDate = (data.startTimeDate as Timestamp).toDate();
        endTimeDate = (data.endTimeDate as Timestamp).toDate();
    } else if (data.startTime && data.endTime) {
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
      date: bookingDate, 
      startTime: data.startTime,
      endTime: data.endTime,
      startTimeDate: startTimeDate,
      endTimeDate: endTimeDate,
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

    const hallBookingRtdbRef = rtdbRef(realtimeDB, `${HALL_BOOKINGS_RTDB_PATH}/${bookingId}`);
    const rtdbSnapshot = await getRealtimeDB(hallBookingRtdbRef);
    if (rtdbSnapshot.exists()) {
        const rtdbUpdateData: any = { status: newStatus };
        if (newStatus === 'approved') {
            rtdbUpdateData.approvedAt = realtimeServerTimestamp(); 
            rtdbUpdateData.rejectionReason = null; 
        } else {
            rtdbUpdateData.rejectedAt = realtimeServerTimestamp(); 
            rtdbUpdateData.rejectionReason = rejectionReason || "No reason provided.";
        }
        const existingData = rtdbSnapshot.val();
        await setRealtimeDB(hallBookingRtdbRef, {
            ...existingData, 
            ...rtdbUpdateData      
        });
        console.log(`Booking ${bookingId} status updated to ${newStatus} in Realtime Database`);
    } else {
        console.warn(`Booking ${bookingId} not found in Realtime Database for status update.`);
    }

    // Also update user's booking status in RTDB
    // Also update user's booking status in RTDB
    // Also update user's booking status in RTDB
    // Also update user's booking status in RTDB
    // Also update user's booking status in RTDB
    try {
        // Also update user's booking status in RTDB
        const bookingRef = rtdbRef(realtimeDB, `${USERS_RTDB_PATH}/${bookingDetails.userId}/bookings/${bookingId}`);
        const snapshot = await getRealtimeDB(bookingRef);

        if (snapshot.exists()) {
            await setRealtimeDB(bookingRef, {
                ...snapshot.val(),
                status: newStatus,
                rejectionReason: rejectionReason || null,
                approvedAt: newStatus === 'approved' ? realtimeServerTimestamp() : null,
                rejectedAt: newStatus === 'rejected' ? realtimeServerTimestamp() : null,
            });
            console.log(`User's booking status updated in RTDB for ${bookingId} to ${newStatus}`);
        } else {
            console.log(`User's booking not found in RTDB for ${bookingId}`);
        }
    } catch (e: any) {
        console.error(`Failed to update user's booking status in RTDB for ${bookingId}: `, e);
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
            console.warn(`User profile data from Realtime Database for ID ${userId} is incomplete or malformed:`, data);
            return null; // Return null instead of throwing, UI should handle this
        }
        console.log("User profile found in Realtime Database for ID:", userId, data);
        return data;

    } catch (e: any) {
        console.error(`Error getting user profile from Realtime Database for ID ${userId}: `, e);
        return null; // Return null on error, UI should handle this
    }
}

export async function getUserBookings(userId: string): Promise<BookingRequest[]> {
   try {
        const userBookingsRef = rtdbRef(realtimeDB, `${USERS_RTDB_PATH}/${userId}/bookings`);
        const snapshot = await getRealtimeDB(userBookingsRef);
        if (!snapshot.exists()) {
            console.log(`No bookings found in RTDB for user ID: ${userId}.`);
            return [];
        }

        const bookingsObj = snapshot.val();
        if (!bookingsObj) {
            return [];
        }

        const bookings: BookingRequest[] = Object.values(bookingsObj).map((booking: any) => {
             let startTimeDate, endTimeDate, dateObj;

            try {
                 dateObj = parseISO(booking.date);
                  const [startH, startM] = booking.startTime.split(':').map(Number);
                  const [endH, endM] = booking.endTime.split(':').map(Number);

                 startTimeDate = setMinutes(setHours(dateObj, startH), startM);
                 endTimeDate = setMinutes(setHours(dateObj, endH), endM);
             } catch (e) {
                 console.error("Error parsing dates from RTDB booking data:", e);
                // Handle or skip the booking that has parsing issues
                 startTimeDate = new Date(); // or null if you prefer
                 endTimeDate = new Date(); // or null
                 dateObj = new Date(); // Or a default date value
            }


            return {
                ...booking,
                date: dateObj,
                startTimeDate: startTimeDate,
                endTimeDate: endTimeDate,
            } as BookingRequest;
        });

        console.log(`Found ${bookings.length} bookings in RTDB for user ID: ${userId}`);
        return bookings;
    } catch (e: any) {
        console.error(`Error getting user bookings from RTDB for ID ${userId}: `, e);
        console.error("Error message: ", e.message);
        return [];
    }
}


export async function getHallBookingsForDate(hallPreference: string, date: Date): Promise<BookingRequest[]> {
  try {
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
    throw new Error(`Failed to retrieve hall bookings for date: ${errorMessage}`);
  }
}


export async function getVenueAvailabilityForMonth(year: number, month: number): Promise<BookingRequest[]> {
  try {
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


export async function getHallBookingsForDateFromRealtimeDB(hallPreference: string, targetDate: Date): Promise<any[]> {
    try {
        const allHallBookingsRef = rtdbRef(realtimeDB, HALL_BOOKINGS_RTDB_PATH);
        const snapshot = await getRealtimeDB(allHallBookingsRef);

        if (!snapshot.exists()) {
            console.log(`No bookings found under ${HALL_BOOKINGS_RTDB_PATH} in Realtime Database. Assuming no conflicts.`);
            return []; 
        }

        const allBookingsObject = snapshot.val(); 
        const bookingsForHallAndDate: any[] = [];
        const targetDateStartOfDay = startOfDay(targetDate);

        for (const bookingId in allBookingsObject) {
            const booking = allBookingsObject[bookingId];
            // Ensure booking has necessary fields before proceeding
            if (booking && booking.hallPreference === hallPreference && 
                (booking.status === 'pending' || booking.status === 'approved') &&
                booking.date) { // Check if booking.date exists
                
                try {
                    const bookingDateFromISO = parseISO(booking.date); // booking.date is 'YYYY-MM-DDTHH:mm:ss.sssZ' (start of day from savePendingBooking)
                    if (isEqual(startOfDay(bookingDateFromISO), targetDateStartOfDay)) {
                        // Add necessary time fields if they are directly on the object or need reconstruction
                        // For conflict checking, we need startTimeISO and endTimeISO preferably
                        bookingsForHallAndDate.push({
                            ...booking,
                            // Ensure startTime and endTime are present for checkAvailabilityWithRTDB
                            // parseISO will be used on startTimeISO and endTimeISO in the calling function
                        });
                    }
                } catch (parseError) {
                    console.error(`Error parsing date for booking ID ${bookingId}: ${booking.date}`, parseError);
                    // Skip this booking if date parsing fails
                }
            }
        }
        console.log(`Found ${bookingsForHallAndDate.length} relevant RTDB bookings for hall '${hallPreference}' on ${format(targetDate, 'PPP')}`);
        return bookingsForHallAndDate;
    } catch (e: any) {
        console.error(`Error fetching/filtering hall bookings from RTDB for hall ${hallPreference} on ${format(targetDate, 'PPP')}: `, e);
        return []; // Return empty array on error to allow booking to proceed as if no RTDB data
    }
}
