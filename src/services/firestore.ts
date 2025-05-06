'use server';
/**
 * @fileOverview Firestore service functions for managing booking and user profile data.
 */
import { db } from '@/lib/firebase';
import { collection, addDoc, query, where, getDocs, updateDoc, doc, getDoc, setDoc, serverTimestamp, Timestamp, orderBy } from 'firebase/firestore';
import type { BookingFormData } from '@/components/booking-form'; // Assuming BookingFormData includes necessary fields

export interface BookingRequest extends BookingFormData {
  id?: string; // Firestore document ID
  status: 'pending' | 'approved' | 'rejected';
  token: string;
  createdAt: Timestamp;
  approvedAt?: Timestamp;
  rejectedAt?: Timestamp;
  userId?: string; // Link booking to the user who created it
  rejectionReason?: string; // Reason for rejection, if any
  aiReason?: string; // Reason from AI if approval was required
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
 * @param aiReason - The reason from AI if director approval is needed.
 * @returns The ID of the newly created Firestore document.
 */
export async function savePendingBooking(bookingDetails: BookingFormData, token: string, userId?: string, aiReason?: string): Promise<string> {
  try {
    const docRef = await addDoc(collection(db, PENDING_BOOKINGS_COLLECTION), {
      ...bookingDetails,
      userId: userId || null, // Store the user ID or null if not logged in
      dates: Timestamp.fromDate(bookingDetails.dates), // Store date as Firestore Timestamp
      status: 'pending',
      token: token,
      createdAt: serverTimestamp(),
      aiReason: aiReason || null,
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
      userId: data.userId, // Include userId
      approvedAt: data.approvedAt,
      rejectedAt: data.rejectedAt,
      rejectionReason: data.rejectionReason,
      aiReason: data.aiReason,
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
 * @param rejectionReason - Optional reason if status is 'rejected'.
 */
export async function updateBookingStatus(bookingId: string, newStatus: 'approved' | 'rejected', rejectionReason?: string): Promise<void> {
  try {
    const bookingRef = doc(db, PENDING_BOOKINGS_COLLECTION, bookingId);
    const updateData: Partial<BookingRequest> = { // Use Partial for update data
        status: newStatus,
    };
    if (newStatus === 'approved') {
        updateData.approvedAt = serverTimestamp() as Timestamp;
        updateData.rejectionReason = undefined; // Clear rejection reason if any, explicitly
    } else { // 'rejected'
        updateData.rejectedAt = serverTimestamp() as Timestamp;
        updateData.rejectionReason = rejectionReason || "No reason provided.";
    }

    await updateDoc(bookingRef, updateData as any); // Using 'as any' due to complex type with serverTimestamp and undefined
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
        const userProfile: UserProfileData = {
            name: data.name,
            email: data.email,
            department: data.department,
            createdAt: data.createdAt,
        };
         console.log("User profile found for ID:", userId, userProfile);
        return userProfile;

    } catch (e) {
        console.error("Error getting user profile: ", e);
        throw new Error("Failed to retrieve user profile.");
    }
}

/**
 * Retrieves all booking requests for a specific user.
 * @param userId - The ID of the user.
 * @returns An array of booking requests.
 */
export async function getUserBookings(userId: string): Promise<BookingRequest[]> {
  try {
    const q = query(
      collection(db, PENDING_BOOKINGS_COLLECTION),
      where("userId", "==", userId),
      orderBy("createdAt", "desc") // Order by creation date, newest first
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
  } catch (e) {
    console.error("Error getting user bookings: ", e);
    throw new Error("Failed to retrieve user bookings.");
  }
}

