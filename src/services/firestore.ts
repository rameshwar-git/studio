
'use server';
/**
 * @fileOverview Firestore service functions for managing booking and user profile data.
 */
import { db } from '@/lib/firebase';
import { collection, addDoc, query, where, getDocs, updateDoc, doc, getDoc, setDoc, serverTimestamp, Timestamp } from 'firebase/firestore';
import type { BookingFormData } from '@/components/booking-form'; // Assuming BookingFormData includes necessary fields

export interface BookingRequest extends BookingFormData {
  id?: string; // Firestore document ID
  status: 'pending' | 'approved' | 'rejected';
  token: string;
  createdAt: Timestamp;
  approvedAt?: Timestamp;
  rejectedAt?: Timestamp;
  userId?: string; // Link booking to the user who created it
}

export interface UserProfileData {
    name: string;
    email: string;
    department: string;
    createdAt?: Timestamp; // Optional: track when the profile was created
}

const PENDING_BOOKINGS_COLLECTION = 'pendingBookings';
const USERS_COLLECTION = 'users';

/**
 * Saves user profile data to Firestore. Typically called after registration.
 * @param userId - The Firebase Authentication user ID.
 * @param profileData - The user profile data to save.
 */
export async function saveUserProfile(userId: string, profileData: UserProfileData): Promise<void> {
  try {
    const userDocRef = doc(db, USERS_COLLECTION, userId);
    await setDoc(userDocRef, {
        ...profileData,
        createdAt: serverTimestamp(), // Add a timestamp for creation date
    });
    console.log("User profile saved for user ID: ", userId);
  } catch (e) {
    console.error("Error saving user profile: ", e);
    throw new Error("Failed to save user profile.");
  }
}


/**
 * Saves a pending booking request to Firestore.
 * @param bookingDetails - The details of the booking.
 * @param token - The unique authorization token.
 * @param userId - The ID of the user making the booking.
 * @returns The ID of the newly created Firestore document.
 */
export async function savePendingBooking(bookingDetails: BookingFormData, token: string, userId?: string): Promise<string> {
  try {
    const docRef = await addDoc(collection(db, PENDING_BOOKINGS_COLLECTION), {
      ...bookingDetails,
      userId: userId || null, // Store the user ID or null if not logged in
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
      studentId: data.studentId, // Keep studentId from form for now
      hallPreference: data.hallPreference,
      dates: (data.dates as Timestamp).toDate(), // Convert Timestamp to Date
      status: data.status,
      token: data.token,
      createdAt: data.createdAt,
      userId: data.userId, // Include userId
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
        userId: data.userId, // Include userId
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

/**
 * Retrieves user profile data from Firestore.
 * @param userId - The Firebase Authentication user ID.
 * @returns The user profile data or null if not found.
 */
export async function getUserProfile(userId: string): Promise<UserProfileData | null> {
    try {
        const userDocRef = doc(db, USERS_COLLECTION, userId);
        const docSnap = await getDoc(userDocRef);

        if (!docSnap.exists()) {
            console.log("No user profile found for ID:", userId);
            return null;
        }

        const data = docSnap.data();
        // Ensure correct type casting
        const userProfile: UserProfileData = {
            name: data.name,
            email: data.email,
            department: data.department,
            createdAt: data.createdAt, // Include createdAt if stored
        };
         console.log("User profile found for ID:", userId, userProfile);
        return userProfile;

    } catch (e) {
        console.error("Error getting user profile: ", e);
        throw new Error("Failed to retrieve user profile.");
    }
}
