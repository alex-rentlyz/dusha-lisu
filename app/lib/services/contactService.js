import {
  collection, doc, onSnapshot, setDoc, writeBatch, serverTimestamp,
} from "firebase/firestore";
import { getDb } from "../firebase/firestore";

const COLLECTION = "contacts";

/**
 * Subscribe to real-time contact updates.
 * @param {Function} callback - receives array of contact objects
 * @returns {Function} unsubscribe function
 */
export function subscribeToContacts(callback) {
  const ref = collection(getDb(), COLLECTION);
  return onSnapshot(ref, (snapshot) => {
    const contacts = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));
    callback(contacts);
  }, (error) => {
    console.error("Contacts listener error:", error);
  });
}

/**
 * Create or update a contact (upsert).
 * Uses client-generated ID to preserve existing app behavior.
 */
export async function saveContact(contact) {
  const { id, ...data } = contact;
  const ref = doc(getDb(), COLLECTION, id);
  await setDoc(ref, {
    ...data,
    updatedAt: serverTimestamp(),
    createdAt: data.createdAt || serverTimestamp(),
  }, { merge: true });
}

/**
 * Batch create multiple contacts (used for migration).
 */
export async function batchCreateContacts(contacts) {
  const chunks = [];
  for (let i = 0; i < contacts.length; i += 450) {
    chunks.push(contacts.slice(i, i + 450));
  }

  for (const chunk of chunks) {
    const batch = writeBatch(getDb());
    chunk.forEach((contact) => {
      const { id, ...data } = contact;
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
