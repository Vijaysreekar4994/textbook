import { DB_NAME, DB_VERSION, STORE_NAME, DOC_ID_KEY, type AppDocument } from './types';

// In-memory fallback if IndexedDB is blocked or unavailable (e.g. Incognito mode)
const inMemoryStore: Record<string, AppDocument | null> = {};
let isDbAvailable = true;

export const setDbAvailability = (available: boolean) => {
  isDbAvailable = available;
};

export const getDbAvailability = (): boolean => {
  return isDbAvailable;
};

export const initDB = (): Promise<IDBDatabase | null> => {
  return new Promise((resolve) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      console.warn('IndexedDB is not supported by this browser.');
      isDbAvailable = false;
      resolve(null);
      return;
    }

    try {
      const request = window.indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = (event) => {
        console.error('IndexedDB open error:', event);
        isDbAvailable = false;
        resolve(null); // Resolve with null to trigger in-memory fallback
      };

      request.onsuccess = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        resolve(db);
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME);
        }
      };

      request.onblocked = () => {
        console.warn('IndexedDB open blocked by another tab or connection.');
        isDbAvailable = false;
        resolve(null);
      };
    } catch (e) {
      console.error('Failed to initialize IndexedDB:', e);
      isDbAvailable = false;
      resolve(null);
    }
  });
};

export const loadDocument = async (): Promise<AppDocument | null> => {
  if (!isDbAvailable) {
    return inMemoryStore[DOC_ID_KEY] || null;
  }

  const db = await initDB();
  if (!db) {
    return inMemoryStore[DOC_ID_KEY] || null;
  }

  return new Promise((resolve) => {
    try {
      const transaction = db.transaction(STORE_NAME, 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.get(DOC_ID_KEY);

      request.onsuccess = () => {
        resolve(request.result || null);
      };

      request.onerror = () => {
        console.error('IndexedDB get error, falling back to in-memory store');
        resolve(inMemoryStore[DOC_ID_KEY] || null);
      };
    } catch (e) {
      console.error('IndexedDB transaction error, falling back to in-memory store:', e);
      resolve(inMemoryStore[DOC_ID_KEY] || null);
    }
  });
};

export const saveDocument = async (doc: AppDocument): Promise<boolean> => {
  // Always update in-memory cache
  inMemoryStore[DOC_ID_KEY] = JSON.parse(JSON.stringify(doc));

  if (!isDbAvailable) {
    return false; // Returns false to indicate it was only saved in-memory
  }

  const db = await initDB();
  if (!db) {
    return false;
  }

  return new Promise((resolve) => {
    try {
      const transaction = db.transaction(STORE_NAME, 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.put(doc, DOC_ID_KEY);

      request.onsuccess = () => {
        resolve(true);
      };

      request.onerror = (event) => {
        console.error('IndexedDB write error:', event);
        resolve(false);
      };
    } catch (e) {
      console.error('IndexedDB write transaction error:', e);
      resolve(false);
    }
  });
};