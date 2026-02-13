"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { ensureAuth } from "../firebase/auth";
import { subscribeToBookings, saveBooking as fbSaveBooking, removeBooking } from "../services/bookingService";
import { subscribeToContacts, saveContact as fbSaveContact } from "../services/contactService";
import { subscribeToCancellations, saveCancellation } from "../services/cancellationService";
import { migrateFromLocalStorage } from "../services/migrationService";
import { loadData, saveData } from "../storage";

/**
 * Check if Firebase is configured (env variables present).
 */
function isFirebaseConfigured() {
  return !!(
    process.env.NEXT_PUBLIC_FIREBASE_API_KEY &&
    process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID
  );
}

/**
 * Main data hook that replaces localStorage-based loadData/saveData.
 *
 * When Firebase is configured:
 * - Authenticates anonymously
 * - Migrates localStorage data to Firestore (once)
 * - Subscribes to real-time Firestore listeners
 * - Provides async mutation functions
 *
 * When Firebase is NOT configured (no env vars):
 * - Falls back to localStorage (existing behavior)
 */
export function useFirestoreData() {
  const [bookings, setBookings] = useState([]);
  const [contacts, setContacts] = useState([]);
  const [cancellations, setCancellations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const unsubscribers = useRef([]);

  useEffect(() => {
    if (!isFirebaseConfigured()) {
      // Fallback: use localStorage
      const data = loadData();
      setBookings(data.bookings);
      setContacts(data.contacts);
      setLoading(false);
      return;
    }

    let mounted = true;

    async function init() {
      try {
        // 1. Authenticate
        await ensureAuth();

        // 2. Run migration (no-op if already done)
        await migrateFromLocalStorage();

        if (!mounted) return;

        // 3. Subscribe to real-time updates
        const unsubBookings = subscribeToBookings((data) => {
          if (mounted) setBookings(data);
        });

        const unsubContacts = subscribeToContacts((data) => {
          if (mounted) setContacts(data);
        });

        const unsubCancellations = subscribeToCancellations((data) => {
          if (mounted) setCancellations(data);
        });

        unsubscribers.current = [unsubBookings, unsubContacts, unsubCancellations];

        // Loading is set to false after first snapshot arrives
        // Use a small delay to ensure at least one snapshot is received
        setTimeout(() => {
          if (mounted) setLoading(false);
        }, 500);

      } catch (err) {
        console.error("Firebase initialization failed, falling back to localStorage:", err);
        if (mounted) {
          setError(err);
          // Fallback to localStorage
          const data = loadData();
          setBookings(data.bookings);
          setContacts(data.contacts);
          setLoading(false);
        }
      }
    }

    init();

    return () => {
      mounted = false;
      unsubscribers.current.forEach((unsub) => unsub());
    };
  }, []);

  // ── Mutation functions ──

  const saveBooking = useCallback(async (booking) => {
    if (!isFirebaseConfigured()) {
      // localStorage fallback
      setBookings((prev) => {
        const idx = prev.findIndex((b) => b.id === booking.id);
        const next = idx >= 0 ? prev.map((b) => (b.id === booking.id ? booking : b)) : [...prev, booking];
        setContacts((c) => { saveData(next, c); return c; });
        return next;
      });
      return;
    }
    try {
      await fbSaveBooking(booking);
    } catch (err) {
      console.error("Failed to save booking:", err);
      setError(err);
    }
  }, []);

  const deleteBooking = useCallback(async (id) => {
    if (!isFirebaseConfigured()) {
      setBookings((prev) => {
        const booking = prev.find((b) => b.id === id);
        if (booking) {
          setCancellations((c) => [...c, {
            ...booking,
            bookingId: id,
            cancelMonth: booking.checkIn ? booking.checkIn.substring(0, 7) : "",
            cancelledAtISO: new Date().toISOString(),
          }]);
        }
        const next = prev.filter((b) => b.id !== id);
        setContacts((c) => { saveData(next, c); return c; });
        return next;
      });
      return;
    }
    try {
      // 1. Log cancellation before deleting
      const booking = bookings.find((b) => b.id === id);
      if (booking) {
        await saveCancellation(booking);
      }
      // 2. Hard-delete the booking
      await removeBooking(id);
    } catch (err) {
      console.error("Failed to delete booking:", err);
      setError(err);
    }
  }, [bookings]);

  const saveContact = useCallback(async (contact) => {
    if (!isFirebaseConfigured()) {
      setContacts((prev) => {
        const idx = prev.findIndex((c) => c.id === contact.id);
        const next = idx >= 0 ? prev.map((c) => (c.id === contact.id ? contact : c)) : [...prev, contact];
        setBookings((b) => { saveData(b, next); return b; });
        return next;
      });
      return;
    }
    try {
      await fbSaveContact(contact);
    } catch (err) {
      console.error("Failed to save contact:", err);
      setError(err);
    }
  }, []);

  return {
    bookings,
    contacts,
    cancellations,
    loading,
    error,
    saveBooking,
    deleteBooking,
    saveContact,
  };
}
