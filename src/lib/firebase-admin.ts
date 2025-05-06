/**
 * @fileOverview Firebase Admin SDK Initialization (Server-side only).
 * Use this for backend operations where client-side SDK is not suitable,
 * like custom auth claims or bypassing security rules (with caution).
 */
import * as admin from 'firebase-admin';

// Ensure this file is only imported on the server
if (typeof window !== 'undefined') {
    throw new Error('Firebase Admin SDK should not be imported on the client.');
}

// Path to your service account key JSON file
// IMPORTANT: Store this file securely and DO NOT commit it to your repository.
// Use environment variables or a secure secrets manager.
const serviceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT_KEY_PATH;

if (!admin.apps.length) {
    try {
        if (!serviceAccountPath) {
             console.warn("FIREBASE_SERVICE_ACCOUNT_KEY_PATH not set. Admin SDK initialized without credentials. Some operations might be limited.");
             admin.initializeApp();
        } else {
            // eslint-disable-next-line @typescript-eslint/no-var-requires
            const serviceAccount = require(serviceAccountPath);
            admin.initializeApp({
                credential: admin.credential.cert(serviceAccount),
                // Optional: databaseURL: process.env.FIREBASE_DATABASE_URL,
                // Optional: storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET
            });
             console.log("Firebase Admin SDK initialized successfully.");
        }

    } catch (error: any) {
        console.error('Firebase Admin initialization error:', error.stack);
        // Decide how to handle initialization failure - maybe throw an error
        // throw new Error('Failed to initialize Firebase Admin SDK');
    }
}

const adminAuth = admin.auth;
const adminDb = admin.firestore;
const adminStorage = admin.storage;

export { adminAuth, adminDb, adminStorage };
export default admin; // Export the default admin instance
