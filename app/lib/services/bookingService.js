import {
  collection, doc, onSnapshot, setDoc, deleteDoc, writeBatch, serverTimestamp,
} from "firebase/firestore";
import { getDb } from "../firebase/firestore";

const COLLECTION = "bookings";

/**
 * Subscribe to real-time booking updates.
 * @param {Function} callback - receives array of booking objects
 * @returns {Function} unsubscribe function
 */
export function subscribeToBookings(callback) {
  const ref = collection(getDb(), COLLECTION);
  return onSnapshot(ref, (snapshot) => {
    const bookings = snapshot.docs
      .filter((doc) => !doc.id.startsWith("__"))
      .map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
    callback(bookings);
  }, (error) => {
    console.error("Bookings listener error:", error);
  });
}

/**
 * Create or update a booking (upsert).
 * Uses client-generated ID to preserve existing app behavior.
 */
export async function saveBooking(booking, isNew = false) {
  const { id, createdAt, updatedAt, ...data } = booking;
  const ref = doc(getDb(), COLLECTION, id);
  const payload = {
    ...data,
    updatedAt: serverTimestamp(),
  };
  // Only set createdAt for new bookings — merge:true preserves existing fields
  if (isNew) {
    payload.createdAt = serverTimestamp();
  }
  await setDoc(ref, payload, { merge: true });
}

/**
 * Delete a booking by ID.
 */
export async function removeBooking(id) {
  const ref = doc(getDb(), COLLECTION, id);
  await deleteDoc(ref);
}

/**
 * Batch create multiple bookings (used for migration).
 */
export async function batchCreateBookings(bookings) {
  // Firestore batch limit is 500 operations
  const chunks = [];
  for (let i = 0; i < bookings.length; i += 450) {
    chunks.push(bookings.slice(i, i + 450));
  }

  for (const chunk of chunks) {
    const batch = writeBatch(getDb());
    chunk.forEach((booking) => {
      const { id, ...data } = booking;
      const ref = doc(getDb(), COLLECTION, id);
      batch.set(ref, {
        ...data,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    });
    await batch.commit();
  }
}
