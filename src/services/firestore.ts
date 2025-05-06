
'use server';
/**
 * @fileOverview Firebase service functions for managing booking (Firestore) and user profile data (Realtime Database).
 */
import { db, realtimeDB } from '@/lib/firebase'; // Use db for Firestore, realtimeDB for Realtime DB
import { collection, addDoc, query, where, getDocs, updateDoc, doc, getDoc, setDoc as setFirestoreDoc, serverTimestamp as firestoreServerTimestamp, Timestamp, orderBy } from 'firebase/firestore';
import { ref, set as setRealtimeDB, get as getRealtimeDB, child, serverTimestamp as realtimeServerTimestamp } from "firebase/database";
import type { BookingFormData } from '@/components/booking-form';

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
}

export interface UserProfileData {
    name: string;
    email: string;
    department: string;
    createdAt?: Timestamp | number; // Can be Firestore Timestamp or number from RTDB
}

const PENDING_BOOKINGS_COLLECTION = 'pendingBookings';
// Realtime Database path for users
const USERS_RTDB_PATH = 'users';


/**
 * Saves user profile data to Firebase Realtime Database.
 * @param userId - The Firebase Authentication user ID.
 * @param profileData - The user profile data to save.
 */
export async function saveUserProfile(userId: string, profileData: Omit<UserProfileData, 'createdAt'>): Promise<void> {
  try {
    const userProfileRef = ref(realtimeDB, `${USERS_RTDB_PATH}/${userId}/profile`);
    await setRealtimeDB(userProfileRef, {
        ...profileData,
        createdAt: realtimeServerTimestamp(), // Use Realtime Database serverTimestamp
    });
    console.log("User profile saved to Realtime Database for user ID: ", userId);
  } catch (e: any) {
    console.error("Error saving user profile to Realtime Database: ", e);
    throw new Error(`Failed to save user profile: ${e.message || 'Unknown error'}`);
  }
}


/**
 * Saves a pending booking request to Firestore.
 * @param bookingDetails - The details of the booking.
 * @param token - The unique authorization token.
 * @param userId - The ID of the user making the booking.
 * @param aiReason - The reason from AI if director approval is needed.
 * @returns The ID of the newly created Firestore document.
 */
export async function savePendingBooking(bookingDetails: BookingFormData, token: string, userId?: string, aiReason?: string): Promise<string> {
  try {
    const docRef = await addDoc(collection(db, PENDING_BOOKINGS_COLLECTION), {
      ...bookingDetails,
      userId: userId || null,
      dates: Timestamp.fromDate(bookingDetails.dates), // Store date as Firestore Timestamp
      status: 'pending',
      token: token,
      createdAt: firestoreServerTimestamp(), // Firestore serverTimestamp
      aiReason: aiReason || null,
    });
    console.log("Pending booking saved with ID: ", docRef.id);
    return docRef.id;
  } catch (e: any) {
    console.error("Error adding document: ", e);
    throw new Error(`Failed to save pending booking request: ${e.message || 'Unknown error'}`);
  }
}

/**
 * Retrieves a booking request by its authorization token from Firestore.
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

    const docSnap = querySnapshot.docs[0];
    const data = docSnap.data();

    const bookingData: BookingRequest = {
      id: docSnap.id,
      studentId: data.studentId,
      hallPreference: data.hallPreference,
      dates: (data.dates as Timestamp).toDate(),
      status: data.status,
      token: data.token,
      createdAt: data.createdAt,
      userId: data.userId,
      approvedAt: data.approvedAt,
      rejectedAt: data.rejectedAt,
      rejectionReason: data.rejectionReason,
      aiReason: data.aiReason,
    };
     console.log("Booking found for token:", token, bookingData);
    return bookingData;
  } catch (e: any) {
    console.error("Error getting booking by token: ", e);
    throw new Error(`Failed to retrieve booking request: ${e.message || 'Unknown error'}`);
  }
}

/**
 * Updates the status of a booking request in Firestore by its document ID.
 * @param bookingId - The Firestore document ID of the booking.
 * @param newStatus - The new status ('approved' or 'rejected').
 * @param rejectionReason - Optional reason if status is 'rejected'.
 */
export async function updateBookingStatus(bookingId: string, newStatus: 'approved' | 'rejected', rejectionReason?: string): Promise<void> {
  try {
    const bookingRef = doc(db, PENDING_BOOKINGS_COLLECTION, bookingId);
    const updateData: Partial<BookingRequest> = {
        status: newStatus,
    };
    if (newStatus === 'approved') {
        updateData.approvedAt = firestoreServerTimestamp() as Timestamp;
        updateData.rejectionReason = undefined;
    } else {
        updateData.rejectedAt = firestoreServerTimestamp() as Timestamp;
        updateData.rejectionReason = rejectionReason || "No reason provided.";
    }

    await updateDoc(bookingRef, updateData as any);
    console.log(`Booking ${bookingId} status updated to ${newStatus}`);
  } catch (e: any) {
    console.error("Error updating booking status: ", e);
    throw new Error(`Failed to update booking status: ${e.message || 'Unknown error'}`);
  }
}


/**
 * Retrieves a booking request from Firestore by its document ID.
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
        dates: (data.dates as Timestamp).toDate(),
        status: data.status,
        token: data.token,
        createdAt: data.createdAt,
        userId: data.userId,
        approvedAt: data.approvedAt,
        rejectedAt: data.rejectedAt,
        rejectionReason: data.rejectionReason,
        aiReason: data.aiReason,
      };
      console.log("Booking found for ID:", bookingId, bookingData);
      return bookingData;
    } catch (e: any) {
      console.error("Error getting booking by ID: ", e);
      throw new Error(`Failed to retrieve booking request by ID: ${e.message || 'Unknown error'}`);
    }
  }

/**
 * Retrieves user profile data from Firebase Realtime Database.
 * @param userId - The Firebase Authentication user ID.
 * @returns The user profile data or null if not found.
 */
export async function getUserProfile(userId: string): Promise<UserProfileData | null> {
    try {
        const userProfileRef = ref(realtimeDB, `${USERS_RTDB_PATH}/${userId}/profile`);
        const snapshot = await getRealtimeDB(userProfileRef);

        if (!snapshot.exists()) {
            console.warn(`No user profile found in Realtime Database for ID: ${userId}. This might be expected for new users.`);
            return null;
        }

        const data = snapshot.val();
        if (!data || !data.name || !data.email || !data.department) {
            console.error(`User profile data from Realtime Database for ID ${userId} is incomplete or malformed:`, data);
            throw new Error(`Incomplete user profile data retrieved for ID ${userId}.`);
        }
        
        // Convert RTDB timestamp (number) to Firestore Timestamp for consistency in UserProfileData if needed,
        // or adjust UserProfileData to expect number for createdAt from RTDB.
        // For now, we'll return it as number, assuming frontend can handle Timestamp or number.
        const userProfile: UserProfileData = {
            name: data.name,
            email: data.email,
            department: data.department,
            createdAt: data.createdAt, // This will be a number (milliseconds since epoch)
        };
        console.log("User profile found in Realtime Database for ID:", userId, userProfile);
        return userProfile;

    } catch (e: any) {
        console.error(`Error getting user profile from Realtime Database for ID ${userId}: `, e);
        // Check if the error message already indicates it's one of our thrown errors.
        if (e.message && (e.message.startsWith('Failed to retrieve user profile') || e.message.startsWith('Incomplete user profile data'))) {
             throw e; // Re-throw the specific error
        }
        throw new Error(`Failed to retrieve user profile. Original error: ${e.message || 'Unknown Realtime Database error'}`);
    }
}

/**
 * Retrieves all booking requests for a specific user from Firestore.
 * @param userId - The ID of the user.
 * @returns An array of booking requests.
 */
export async function getUserBookings(userId: string): Promise<BookingRequest[]> {
  try {
    const q = query(
      collection(db, PENDING_BOOKINGS_COLLECTION),
      where("userId", "==", userId),
      orderBy("createdAt", "desc")
    );
    const querySnapshot = await getDocs(q);

    const bookings: BookingRequest[] = [];
    querySnapshot.forEach((docSnap) => {
      const data = docSnap.data();
      bookings.push({
        id: docSnap.id,
        studentId: data.studentId,
        hallPreference: data.hallPreference,
        dates: (data.dates as Timestamp).toDate(),
        status: data.status,
        token: data.token,
        createdAt: data.createdAt,
        userId: data.userId,
        approvedAt: data.approvedAt,
        rejectedAt: data.rejectedAt,
        rejectionReason: data.rejectionReason,
        aiReason: data.aiReason,
      });
    });
    console.log(`Found ${bookings.length} bookings for user ID: ${userId}`);
    return bookings;
  } catch (e: any) {
    console.error("Error getting user bookings: ", e);
    throw new Error(`Failed to retrieve user bookings: ${e.message || 'Unknown error'}`);
  }
}

