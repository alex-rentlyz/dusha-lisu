import { initializeFirestore, persistentLocalCache, persistentMultipleTabManager } from "firebase/firestore";
import { getApp } from "./config";

let _db = null;

/**
 * Get Firestore instance (lazy initialization).
 * Uses persistent local cache with multi-tab support.
 */
export function getDb() {
  if (_db) return _db;
  _db = initializeFirestore(getApp(), {
    localCache: persistentLocalCache({
      tabManager: persistentMultipleTabManager(),
    }),
  });
  return _db;
}
