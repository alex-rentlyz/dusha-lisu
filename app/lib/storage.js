const STORAGE_KEY = "dusha-lisu-v3";

export function loadData() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const data = JSON.parse(raw);
      return {
        bookings: data.bookings || [],
        contacts: data.contacts || [],
      };
    }
  } catch (e) {
    // ignore
  }
  return { bookings: [], contacts: [] };
}

export function saveData(bookings, contacts) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ bookings, contacts }));
  } catch (e) {
    // ignore
  }
}
