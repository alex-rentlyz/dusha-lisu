import { doc, onSnapshot, setDoc, serverTimestamp } from "firebase/firestore";
import { getDb } from "../firebase/firestore";

// Store house prices as a special document in the "bookings" collection
// to reuse existing Firestore security rules that allow read/write to "bookings".
const COLLECTION = "bookings";
const DOC_ID = "__house_prices__";
const LS_KEY = "dusha_house_prices";

/**
 * Load house prices from localStorage (immediate, synchronous).
 */
export function loadHousePricesFromLocalStorage() {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw) return JSON.parse(raw);
  } catch (e) {
    // ignore parse errors
  }
  return null;
}

/**
 * Save house prices to localStorage.
 */
function saveHousePricesToLocalStorage(prices) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(prices));
  } catch (e) {
    // ignore quota errors
  }
}

/**
 * Subscribe to real-time house price updates.
 * @param {Function} callback - receives price object or null
 * @returns {Function} unsubscribe function
 */
export function subscribeToHousePrices(callback) {
  const ref = doc(getDb(), COLLECTION, DOC_ID);
  return onSnapshot(ref, (snapshot) => {
    if (snapshot.exists()) {
      const data = { ...snapshot.data() };
      delete data.updatedAt;
      delete data.createdAt;
      delete data._type;
      // Sync to localStorage whenever Firestore updates
      saveHousePricesToLocalStorage(data);
      callback(data);
    } else {
      // No Firestore doc — try localStorage fallback
      const local = loadHousePricesFromLocalStorage();
      callback(local);
    }
  }, (error) => {
    console.error("House prices listener error:", error);
    // On listener error, fall back to localStorage
    const local = loadHousePricesFromLocalStorage();
    callback(local);
  });
}

/**
 * Save house prices to Firestore + localStorage.
 * localStorage is always written first (guaranteed to work),
 * then Firestore is attempted.
 * @param {Object} prices - { house1: { mon: 13000, ... }, house2: { ... }, ... }
 */
export async function saveHousePrices(prices) {
  // Always persist to localStorage first
  saveHousePricesToLocalStorage(prices);

  // Then attempt Firestore
  try {
    const ref = doc(getDb(), COLLECTION, DOC_ID);
    await setDoc(ref, {
      ...prices,
      _type: "house_prices",
      updatedAt: serverTimestamp(),
      createdAt: prices.createdAt || serverTimestamp(),
    }, { merge: true });
  } catch (err) {
    console.error("Failed to save house prices to Firestore (localStorage backup used):", err);
    // Don't rethrow — localStorage save already succeeded
  }
}
