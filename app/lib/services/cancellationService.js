import {
  collection, doc, onSnapshot, setDoc, serverTimestamp,
} from "firebase/firestore";
import { getDb } from "../firebase/firestore";

const COLLECTION = "cancellations";

/**
 * Subscribe to real-time cancellation updates.
 * @param {Function} callback - receives array of cancellation objects
 * @returns {Function} unsubscribe function
 */
export function subscribeToCancellations(callback) {
  const ref = collection(getDb(), COLLECTION);
  return onSnapshot(ref, (snapshot) => {
    const cancellations = snapshot.docs.map((d) => ({
      id: d.id,
      ...d.data(),
    }));
    callback(cancellations);
  }, (error) => {
    console.error("Cancellations listener error:", error);
  });
}

/**
 * Save a cancellation record before hard-deleting the booking.
 * Uses the original booking ID as the document ID (1:1 mapping).
 */
export async function saveCancellation(booking) {
  const { id, ...bookingData } = booking;
  const ref = doc(getDb(), COLLECTION, id);
  const cancelMonth = booking.checkIn ? booking.checkIn.substring(0, 7) : "";

  await setDoc(ref, {
    ...bookingData,
    bookingId: id,
    cancelMonth,
    cancelledAt: serverTimestamp(),
    cancelledAtISO: new Date().toISOString(),
  });
}
