import { useCallback, useEffect, useRef, useState } from 'react';
import * as dbStorage from '../indexedDbStorage';
import { ACTIVE_USER_STORAGE_KEY, GUEST_DOC_ID_KEY, type AppDocument } from '../types';
import { mergeDocuments } from '../sync/documentMerge';
import { createEmptyDocument, migrateDocument } from '../utils/documentUtils';

export interface ApplySyncResult {
  document: AppDocument;
  hasPendingLocalChanges: boolean;
}

export interface UseDocumentReturn {
  doc: AppDocument | null;
  activeListId: string;
  ownerUserId: string | null;
  isLoading: boolean;
  isDbAvailable: boolean;
  setActiveListId: (id: string) => void;
  updateDocument: (updatedDocument: AppDocument, isUserAction?: boolean) => void;
  getCurrentDocument: () => AppDocument | null;
  setUserDocument: (userId: string, document: AppDocument) => Promise<void>;
  applySyncResult: (
    userId: string,
    syncStartDocument: AppDocument,
    syncedDocument: AppDocument
  ) => Promise<ApplySyncResult>;
  resetAfterLogout: () => Promise<void>;
}

const getStoredActiveUserId = (): string | null => {
  try {
    return localStorage.getItem(ACTIVE_USER_STORAGE_KEY);
  } catch {
    return null;
  }
};

const setStoredActiveUserId = (userId: string | null) => {
  try {
    if (userId) {
      localStorage.setItem(ACTIVE_USER_STORAGE_KEY, userId);
      return;
    }

    localStorage.removeItem(ACTIVE_USER_STORAGE_KEY);
  } catch {
    // IndexedDB remains authoritative if localStorage is unavailable.
  }
};

export const useDocument = (): UseDocumentReturn => {
  const [doc, setDoc] = useState<AppDocument | null>(null);
  const [activeListId, setActiveListId] = useState('');
  const [ownerUserId, setOwnerUserId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isDbAvailable, setIsDbAvailable] = useState(true);

  const docRef = useRef<AppDocument | null>(null);
  const ownerUserIdRef = useRef<string | null>(null);

  const setDocumentState = useCallback((document: AppDocument) => {
    docRef.current = document;
    setDoc(document);
    setActiveListId(document.activeListId || document.lists[0]?.id || '');
  }, []);

  const persistDocument = useCallback(async (document: AppDocument, userId: string | null) => {
    const saved = userId
      ? await dbStorage.saveUserDocument(userId, document)
      : await dbStorage.saveGuestDocument(document);

    setIsDbAvailable(saved || dbStorage.getDbAvailability());
  }, []);

  useEffect(() => {
    const loadApp = async () => {
      try {
        const db = await dbStorage.initDB();
        setIsDbAvailable(db !== null);

        const storedUserId = getStoredActiveUserId();
        const storedDocument = storedUserId
          ? await dbStorage.loadUserDocument(storedUserId)
          : await dbStorage.loadGuestDocument();

        const initialDocument = migrateDocument(storedDocument ?? createEmptyDocument());

        ownerUserIdRef.current = storedUserId;
        setOwnerUserId(storedUserId);
        setDocumentState(initialDocument);

        if (!storedDocument) {
          await persistDocument(initialDocument, storedUserId);
        }
      } finally {
        setIsLoading(false);
      }
    };

    void loadApp();
  }, [persistDocument, setDocumentState]);

  const updateDocument = useCallback(
    (updatedDocument: AppDocument, isUserAction = true) => {
      const currentDocument = docRef.current;
      // This is also an in-memory revision guard. Increment for UI-only persisted changes too
      // so an in-flight sync can never replace a newer local state snapshot.
      const nextVersion =
        (currentDocument?.syncMetadata.documentVersion ?? updatedDocument.syncMetadata.documentVersion) + 1;

      const finalDocument: AppDocument = {
        ...updatedDocument,
        updatedAt: isUserAction ? new Date().toISOString() : updatedDocument.updatedAt,
        syncMetadata: {
          ...updatedDocument.syncMetadata,
          isDirty: isUserAction ? true : updatedDocument.syncMetadata.isDirty,
          documentVersion: nextVersion,
        },
      };

      setDocumentState(finalDocument);
      void persistDocument(finalDocument, ownerUserIdRef.current);
    },
    [persistDocument, setDocumentState]
  );

  const getCurrentDocument = useCallback(() => docRef.current, []);

  const setUserDocument = useCallback(
    async (userId: string, document: AppDocument) => {
      const migratedDocument = migrateDocument(document);

      ownerUserIdRef.current = userId;
      setOwnerUserId(userId);
      setStoredActiveUserId(userId);
      setDocumentState(migratedDocument);
      await persistDocument(migratedDocument, userId);
    },
    [persistDocument, setDocumentState]
  );

  const applySyncResult = useCallback(
    async (
      userId: string,
      syncStartDocument: AppDocument,
      syncedDocument: AppDocument
    ): Promise<ApplySyncResult> => {
      if (ownerUserIdRef.current !== userId) {
        return { document: syncedDocument, hasPendingLocalChanges: false };
      }

      const latestDocument = docRef.current;
      if (!latestDocument) {
        await setUserDocument(userId, syncedDocument);
        return { document: syncedDocument, hasPendingLocalChanges: false };
      }

      const didDocumentChangeDuringSync =
        latestDocument.syncMetadata.documentVersion !== syncStartDocument.syncMetadata.documentVersion ||
        latestDocument.updatedAt !== syncStartDocument.updatedAt;

      if (!didDocumentChangeDuringSync) {
        setDocumentState(syncedDocument);
        await persistDocument(syncedDocument, userId);
        return { document: syncedDocument, hasPendingLocalChanges: false };
      }

      // Preserve edits made while the network request was running.
      const mergedWithInFlightEdits = mergeDocuments(
        syncStartDocument,
        latestDocument,
        syncedDocument
      );

      setDocumentState(mergedWithInFlightEdits);
      await persistDocument(mergedWithInFlightEdits, userId);

      return { document: mergedWithInFlightEdits, hasPendingLocalChanges: true };
    },
    [persistDocument, setDocumentState, setUserDocument]
  );

  const resetAfterLogout = useCallback(async () => {
    const emptyGuestDocument = createEmptyDocument();

    ownerUserIdRef.current = null;
    setOwnerUserId(null);
    setStoredActiveUserId(null);
    setDocumentState(emptyGuestDocument);

    // Remove any previous guest content so another person on the same device cannot see it.
    await dbStorage.deleteDocumentByKey(GUEST_DOC_ID_KEY);
    await dbStorage.deleteLegacyDocument();
    await persistDocument(emptyGuestDocument, null);
  }, [persistDocument, setDocumentState]);

  return {
    doc,
    activeListId,
    ownerUserId,
    isLoading,
    isDbAvailable,
    setActiveListId,
    updateDocument,
    getCurrentDocument,
    setUserDocument,
    applySyncResult,
    resetAfterLogout,
  };
};
