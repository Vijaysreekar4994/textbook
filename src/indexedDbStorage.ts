import {
  DB_NAME,
  DB_VERSION,
  STORE_NAME,
  LEGACY_DOC_ID_KEY,
  GUEST_DOC_ID_KEY,
  USER_DOC_ID_PREFIX,
  SYNC_BASE_ID_PREFIX,
  type AppDocument,
} from './types';

const inMemoryStore = new Map<string, AppDocument>();
const writeQueues = new Map<string, Promise<void>>();

let isDbAvailable = true;
let dbPromise: Promise<IDBDatabase | null> | null = null;

export const getUserDocumentKey = (userId: string): string => `${USER_DOC_ID_PREFIX}${userId}`;
export const getSyncBaseKey = (userId: string): string => `${SYNC_BASE_ID_PREFIX}${userId}`;

export const getDbAvailability = (): boolean => isDbAvailable;

export const initDB = (): Promise<IDBDatabase | null> => {
  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      isDbAvailable = false;
      resolve(null);
      return;
    }

    const request = window.indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => {
      isDbAvailable = false;
      resolve(null);
    };

    request.onblocked = () => {
      isDbAvailable = false;
      resolve(null);
    };

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };

    request.onsuccess = () => {
      isDbAvailable = true;
      resolve(request.result);
    };
  });

  return dbPromise;
};

const readFromDb = async (key: string): Promise<AppDocument | null> => {
  const db = await initDB();
  if (!db) return inMemoryStore.get(key) ?? null;

  return new Promise((resolve) => {
    const transaction = db.transaction(STORE_NAME, 'readonly');
    const request = transaction.objectStore(STORE_NAME).get(key);

    request.onsuccess = () => resolve((request.result as AppDocument | undefined) ?? null);
    request.onerror = () => resolve(inMemoryStore.get(key) ?? null);
  });
};

const enqueueWrite = async (key: string, write: () => Promise<void>): Promise<void> => {
  const previousWrite = writeQueues.get(key) ?? Promise.resolve();
  const nextWrite = previousWrite.catch(() => undefined).then(write);

  writeQueues.set(key, nextWrite);

  try {
    await nextWrite;
  } finally {
    if (writeQueues.get(key) === nextWrite) {
      writeQueues.delete(key);
    }
  }
};

export const flushStorageWrites = async (key?: string): Promise<void> => {
  if (key) {
    await (writeQueues.get(key) ?? Promise.resolve()).catch(() => undefined);
    return;
  }

  await Promise.all([...writeQueues.values()].map((queue) => queue.catch(() => undefined)));
};

export const loadDocumentByKey = async (key: string): Promise<AppDocument | null> => {
  await flushStorageWrites(key);
  const document = await readFromDb(key);
  return document ? structuredClone(document) : null;
};

export const saveDocumentByKey = async (key: string, document: AppDocument): Promise<boolean> => {
  const snapshot = structuredClone(document);
  inMemoryStore.set(key, snapshot);

  if (!isDbAvailable) return false;

  let savedToDb = true;

  await enqueueWrite(key, async () => {
    const db = await initDB();
    if (!db) {
      savedToDb = false;
      return;
    }

    await new Promise<void>((resolve) => {
      const transaction = db.transaction(STORE_NAME, 'readwrite');
      transaction.objectStore(STORE_NAME).put(snapshot, key);
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => {
        savedToDb = false;
        resolve();
      };
      transaction.onabort = () => {
        savedToDb = false;
        resolve();
      };
    });
  });

  return savedToDb;
};

export const deleteDocumentByKey = async (key: string): Promise<boolean> => {
  inMemoryStore.delete(key);

  if (!isDbAvailable) return false;

  let deletedFromDb = true;

  await enqueueWrite(key, async () => {
    const db = await initDB();
    if (!db) {
      deletedFromDb = false;
      return;
    }

    await new Promise<void>((resolve) => {
      const transaction = db.transaction(STORE_NAME, 'readwrite');
      transaction.objectStore(STORE_NAME).delete(key);
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => {
        deletedFromDb = false;
        resolve();
      };
      transaction.onabort = () => {
        deletedFromDb = false;
        resolve();
      };
    });
  });

  return deletedFromDb;
};

export const loadGuestDocument = async (): Promise<AppDocument | null> => {
  const guestDocument = await loadDocumentByKey(GUEST_DOC_ID_KEY);
  if (guestDocument) return guestDocument;

  const legacyDocument = await loadDocumentByKey(LEGACY_DOC_ID_KEY);
  if (!legacyDocument) return null;

  // Copy, don't delete: keeping the old key is a deliberate recovery safety net.
  await saveDocumentByKey(GUEST_DOC_ID_KEY, legacyDocument);
  return legacyDocument;
};

export const saveGuestDocument = (document: AppDocument): Promise<boolean> =>
  saveDocumentByKey(GUEST_DOC_ID_KEY, document);

export const loadUserDocument = (userId: string): Promise<AppDocument | null> =>
  loadDocumentByKey(getUserDocumentKey(userId));

export const saveUserDocument = (userId: string, document: AppDocument): Promise<boolean> =>
  saveDocumentByKey(getUserDocumentKey(userId), document);

export const deleteUserDocument = (userId: string): Promise<boolean> =>
  deleteDocumentByKey(getUserDocumentKey(userId));

export const loadSyncBase = (userId: string): Promise<AppDocument | null> =>
  loadDocumentByKey(getSyncBaseKey(userId));

export const saveSyncBase = (userId: string, document: AppDocument): Promise<boolean> =>
  saveDocumentByKey(getSyncBaseKey(userId), document);

export const deleteSyncBase = (userId: string): Promise<boolean> =>
  deleteDocumentByKey(getSyncBaseKey(userId));

export const deleteLegacyDocument = (): Promise<boolean> =>
  deleteDocumentByKey(LEGACY_DOC_ID_KEY);
