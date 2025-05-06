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
const databaseURL = process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL; // Using the same env var as client for RTDB URL

if (!admin.apps.length) {
    try {
        if (!serviceAccountPath) {
             console.warn("FIREBASE_SERVICE_ACCOUNT_KEY_PATH not set. Firebase Admin SDK initialized without explicit credentials. Some admin operations might be limited or unavailable. Ensure your hosting environment (e.g., Firebase Hosting, Cloud Functions) provides default credentials if needed.");
             admin.initializeApp({
                // If running in Firebase environment, it might auto-initialize with default credentials
                // databaseURL could be provided if needed for specific admin tasks without full service account
                ...(databaseURL && { databaseURL }),
             });
        } else {
            // eslint-disable-next-line @typescript-eslint/no-var-requires
            const serviceAccount = require(serviceAccountPath);
            const appOptions: admin.AppOptions = {
                credential: admin.credential.cert(serviceAccount),
            };
            if (databaseURL) {
                appOptions.databaseURL = databaseURL;
            }
            // Optional: storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET
            if(process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET){
                appOptions.storageBucket = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET;
            }
            admin.initializeApp(appOptions);
            console.log("Firebase Admin SDK initialized successfully with service account.");
        }

    } catch (error: any) {
        console.error('Firebase Admin initialization error:', error.message);
        // Depending on the use case, you might want to throw the error or allow the app to continue with limited functionality.
        // For now, we log the error and proceed; some admin features might not work.
        // throw new Error('Failed to initialize Firebase Admin SDK: ' + error.message);
    }
}

const adminAuth = admin.apps.length ? admin.auth() : null;
const adminDb = admin.apps.length ? admin.firestore() : null;
const adminStorage = admin.apps.length ? admin.storage() : null;
const adminRealtimeDB = admin.apps.length ? admin.database() : null;


export { adminAuth, adminDb, adminStorage, adminRealtimeDB };
export default admin; // Export the default admin instance
