import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { getDb } from "../firebase/firestore";
import { loadData } from "../storage";
import { batchCreateBookings } from "./bookingService";
import { batchCreateContacts } from "./contactService";

const METADATA_DOC = "app";
const METADATA_COLLECTION = "metadata";
const SCHEMA_VERSION = 1;

/**
 * One-time migration from localStorage to Firestore.
 * Checks if migration already happened (metadata doc exists).
 * If not, reads localStorage data and batch-writes to Firestore.
 *
 * @returns {{ migrated: boolean, bookingsCount: number, contactsCount: number }}
 */
export async function migrateFromLocalStorage() {
  try {
    // Check if migration already done
    const metaRef = doc(getDb(), METADATA_COLLECTION, METADATA_DOC);
    const metaSnap = await getDoc(metaRef);

    if (metaSnap.exists()) {
      return { migrated: false, bookingsCount: 0, contactsCount: 0 };
    }

    // Read from localStorage
    const data = loadData();
    const { bookings, contacts } = data;

    if (bookings.length === 0 && contacts.length === 0) {
      // No data to migrate — just mark as done
      await setDoc(metaRef, {
        schemaVersion: SCHEMA_VERSION,
        lastMigration: serverTimestamp(),
        source: "empty",
      });
      return { migrated: true, bookingsCount: 0, contactsCount: 0 };
    }

    // Batch write contacts first (bookings reference them)
    if (contacts.length > 0) {
      await batchCreateContacts(contacts);
    }

    // Batch write bookings
    if (bookings.length > 0) {
      await batchCreateBookings(bookings);
    }

    // Mark migration as complete
    await setDoc(metaRef, {
      schemaVersion: SCHEMA_VERSION,
      lastMigration: serverTimestamp(),
      source: "localStorage",
      bookingsCount: bookings.length,
      contactsCount: contacts.length,
    });

    console.log(`Migration complete: ${bookings.length} bookings, ${contacts.length} contacts`);

    return {
      migrated: true,
      bookingsCount: bookings.length,
      contactsCount: contacts.length,
    };
  } catch (error) {
    console.error("Migration failed:", error);
    return { migrated: false, bookingsCount: 0, contactsCount: 0, error };
  }
}
