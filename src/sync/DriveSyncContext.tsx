import {
  createContext,
  type PropsWithChildren,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
/* eslint-disable react-refresh/only-export-components */
import { createGoogleApiService } from '../api/googleApiService';
import { createGoogleAuthSession } from '../auth/googleAuth';
import { createGoogleDriveSyncService } from '../googleDriveSync';
import * as dbStorage from '../indexedDbStorage';
import type { UseDocumentReturn } from '../hooks/useDocument';
import { GUEST_DOC_ID_KEY, type AppDocument, type DriveUser, type SyncStatus } from '../types';
import { createEmptyDocument, markDocumentSynced } from '../utils/documentUtils';
import { documentsHaveSameContent, mergeDocuments } from './documentMerge';

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID;
const SYNC_DEBOUNCE_MS = 1500;
const MAX_REMOTE_RETRIES = 3;

interface DriveSyncContextValue {
  status: SyncStatus;
  errorMessage: string | null;
  currentUser: DriveUser | null;
  isConnected: boolean;
  connect: () => Promise<boolean>;
  syncNow: () => Promise<boolean>;
  logout: () => Promise<boolean>;
}

const DriveSyncContext = createContext<DriveSyncContextValue | null>(null);

type DriveSyncProviderProps = PropsWithChildren<{
  document: UseDocumentReturn;
}>;

interface RemoteSyncResult {
  syncedDocument: AppDocument;
}

export const DriveSyncProvider = ({ children, document }: DriveSyncProviderProps) => {
  const [status, setStatus] = useState<SyncStatus>(
    document.ownerUserId ? 'reauth-required' : 'local-only'
  );
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [currentUser, setCurrentUser] = useState<DriveUser | null>(null);

  const syncPromiseRef = useRef<Promise<boolean> | null>(null);
  const syncTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const authSessionRef = useRef(createGoogleAuthSession(GOOGLE_CLIENT_ID));
  const apiServiceRef = useRef<ReturnType<typeof createGoogleApiService> | null>(null);
  const driveServiceRef = useRef<ReturnType<typeof createGoogleDriveSyncService> | null>(null);

  const isNetworkError = (error: unknown): boolean =>
    error instanceof TypeError ||
    (error instanceof DOMException && error.name === 'NetworkError');

  // Initialize services after auth session is available
  useEffect(() => {
    apiServiceRef.current = createGoogleApiService({
      getAccessToken: () => authSessionRef.current.getAccessToken(),
      onUnauthorized: () => {
        setStatus('reauth-required');
      },
    });
    driveServiceRef.current = createGoogleDriveSyncService(apiServiceRef.current);
  }, []);

  const updateStatus = useCallback((nextStatus: SyncStatus) => {
    setStatus(nextStatus);
  }, []);

  const syncAgainstRemote = useCallback(
    async (userId: string, localDocument: AppDocument): Promise<RemoteSyncResult> => {
      const driveService = driveServiceRef.current;
      if (!driveService) {
        throw new Error('Drive service not initialized');
      }

      const syncBase = await dbStorage.loadSyncBase(userId);

      for (let attempt = 0; attempt < MAX_REMOTE_RETRIES; attempt += 1) {
        const remoteFiles = await driveService.findFiles();
        const remoteMetadata = remoteFiles[0] ?? null;

        if (!remoteMetadata) {
          const uploadCandidate = markDocumentSynced(localDocument, '');
          const uploadedMetadata = await driveService.uploadFile(uploadCandidate, null);
          return {
            syncedDocument: markDocumentSynced(uploadCandidate, uploadedMetadata.version),
          };
        }

        const remoteDocuments = await Promise.all(
          remoteFiles.map((file) => driveService.downloadFile(file.id))
        );
        const primaryRemoteDocument = remoteDocuments[0];
        if (!primaryRemoteDocument) continue;

        // If an older app/device ever created duplicate appData files, fold them into the
        // newest file non-destructively instead of silently ignoring potentially valid data.
        const combinedRemoteDocument = remoteDocuments
          .slice(1)
          .reduce(
            (combined, duplicate) => mergeDocuments(null, duplicate, combined),
            primaryRemoteDocument
          );

        const mergedDocument = mergeDocuments(syncBase, localDocument, combinedRemoteDocument);

        if (documentsHaveSameContent(mergedDocument, primaryRemoteDocument)) {
          return {
            syncedDocument: markDocumentSynced(mergedDocument, remoteMetadata.version),
          };
        }

        // Re-check immediately before PATCH. If another device changed Drive while we were
        // merging, restart from its newest content instead of overwriting it.
        const latestMetadata = await driveService.getFileMetadata(remoteMetadata.id);
        if (latestMetadata.version !== remoteMetadata.version) continue;

        const uploadCandidate = markDocumentSynced(mergedDocument, remoteMetadata.version);
        const uploadedMetadata = await driveService.uploadFile(uploadCandidate, remoteMetadata.id);

        return {
          syncedDocument: markDocumentSynced(uploadCandidate, uploadedMetadata.version),
        };
      }

      throw new Error('Google Drive changed repeatedly during sync. The app kept local data and will retry.');
    },
    []
  );

  const performSync = useCallback(async (): Promise<boolean> => {

    if (!authSessionRef.current.hasValidAccessToken()) {
      updateStatus(document.ownerUserId ? 'reauth-required' : 'local-only');
      return false;
    }

    const originalOwnerUserId = document.ownerUserId;
    const originalDocument = document.getCurrentDocument();
    if (!originalDocument) return false;

    updateStatus('syncing');
    setErrorMessage(null);

    try {
      if (!driveServiceRef.current) {
        throw new Error('Drive service not initialized');
      }

      const authenticatedUser = await driveServiceRef.current.getCurrentUser();
      setCurrentUser(authenticatedUser);

      const storedUserDocument = await dbStorage.loadUserDocument(authenticatedUser.id);

      let localDocument: AppDocument;
      if (originalOwnerUserId === authenticatedUser.id) {
        localDocument = originalDocument;
      } else if (originalOwnerUserId === null) {
        localDocument = storedUserDocument
          ? mergeDocuments(null, originalDocument, storedUserDocument)
          : originalDocument;
      } else {
        // Account changed: never merge another user's local document into this account.
        localDocument = storedUserDocument ?? createEmptyDocument();
      }

      const { syncedDocument } = await syncAgainstRemote(authenticatedUser.id, localDocument);

      // This snapshot is exactly what Drive contains after this successful round.
      await dbStorage.saveSyncBase(authenticatedUser.id, syncedDocument);

      let hasPendingLocalChanges = false;

      if (originalOwnerUserId === authenticatedUser.id) {
        const applied = await document.applySyncResult(
          authenticatedUser.id,
          originalDocument,
          syncedDocument
        );
        hasPendingLocalChanges = applied.hasPendingLocalChanges;
      } else if (originalOwnerUserId === null) {
        const latestGuestDocument = document.getCurrentDocument() ?? originalDocument;
        const didGuestChangeDuringSync =
          latestGuestDocument.syncMetadata.documentVersion !==
          originalDocument.syncMetadata.documentVersion ||
          latestGuestDocument.updatedAt !== originalDocument.updatedAt;

        const documentToAdopt = didGuestChangeDuringSync
          ? mergeDocuments(originalDocument, latestGuestDocument, syncedDocument)
          : syncedDocument;

        hasPendingLocalChanges = documentToAdopt.syncMetadata.isDirty;
        await document.setUserDocument(authenticatedUser.id, documentToAdopt);
        await dbStorage.deleteDocumentByKey(GUEST_DOC_ID_KEY);
        await dbStorage.deleteLegacyDocument();
      } else {
        await document.setUserDocument(authenticatedUser.id, syncedDocument);
      }

      updateStatus(hasPendingLocalChanges ? 'syncing' : 'synced');
      return true;
    } catch (error: unknown) {
      if (isNetworkError(error)) {
        setErrorMessage(
          'Google Drive could not be reached. Your changes are saved locally.'
        );
        updateStatus('offline');
        return false;
      }

      const message =
        error instanceof Error ? error.message : 'Google Drive sync failed.';

      setErrorMessage(message);
      updateStatus('error');
      return false;
    }
  }, [document, syncAgainstRemote, updateStatus]);

  const syncNow = useCallback(async (): Promise<boolean> => {
    if (syncPromiseRef.current) return syncPromiseRef.current;

    const syncPromise = performSync().finally(() => {
      syncPromiseRef.current = null;
    });

    syncPromiseRef.current = syncPromise;
    return syncPromise;
  }, [performSync]);

  const connect = useCallback(async (): Promise<boolean> => {
    setErrorMessage(null);
    updateStatus('connecting');

    try {
      await authSessionRef.current.requestAccess(document.ownerUserId === null);
      return await syncNow();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Google authorization failed.';
      setErrorMessage(message);
      updateStatus(document.ownerUserId ? 'reauth-required' : 'local-only');
      return false;
    }
  }, [document.ownerUserId, syncNow, updateStatus]);

  const logout = useCallback(async (): Promise<boolean> => {
    const userId = document.ownerUserId;
    if (!userId) return true;

    if (!authSessionRef.current.hasValidAccessToken()) {
      updateStatus('reauth-required');
      setErrorMessage(
        'Reconnect Google Drive and complete the final sync before signing out.'
      );
      return false;
    }

    // A manual logout is destructive locally, so require a confirmed final Drive sync first.
    let didCompleteFinalSync = false;

    for (let attempt = 0; attempt < MAX_REMOTE_RETRIES; attempt += 1) {
      const didSync = await syncNow();
      const latestDocument = document.getCurrentDocument();

      if (!didSync || !latestDocument) break;

      if (!latestDocument.syncMetadata.isDirty) {
        didCompleteFinalSync = true;
        break;
      }
    }

    if (!didCompleteFinalSync) {
      setErrorMessage(
        'Reconnect Google Drive and complete the final sync before signing out.'
      );
      return false;
    }

    await dbStorage.deleteUserDocument(userId);
    await dbStorage.deleteSyncBase(userId);

    authSessionRef.current.clearAccessToken();
    setCurrentUser(null);

    await document.resetAfterLogout();

    updateStatus('local-only');
    setErrorMessage(null);

    return true;
  }, [document, syncNow, updateStatus]);

  useEffect(() => {
    const handleOnline = () => {
      if (!document.ownerUserId) {
        updateStatus('local-only');
        return;
      }

      if (!authSessionRef.current.hasValidAccessToken()) {
        updateStatus('reauth-required');
        return;
      }

      if (document.getCurrentDocument()?.syncMetadata.isDirty) {
        void syncNow();
      } else {
        updateStatus('synced');
      }
    };

    const handleOffline = () => {
      if (document.ownerUserId) updateStatus('offline');
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [document, syncNow, updateStatus]);

  useEffect(() => {
    if (syncTimerRef.current) clearTimeout(syncTimerRef.current);

    const currentDocument = document.doc;
    if (!currentDocument?.syncMetadata.isDirty || !document.ownerUserId) return;

    /* eslint-disable react-hooks/set-state-in-effect */
    if (!authSessionRef.current.hasValidAccessToken()) {
      setStatus('reauth-required');
      return;
    }
    /* eslint-enable react-hooks/set-state-in-effect */

    syncTimerRef.current = setTimeout(() => {
      void syncNow();
    }, SYNC_DEBOUNCE_MS);

    return () => {
      if (syncTimerRef.current) clearTimeout(syncTimerRef.current);
    };
  }, [document.doc, document.ownerUserId, syncNow]);

  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect */
    if (!document.ownerUserId) {
      setStatus('local-only');
      return;
    }

    if (!authSessionRef.current.hasValidAccessToken()) {
      setStatus('reauth-required');
    }
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [document.ownerUserId]);

  const value = useMemo<DriveSyncContextValue>(
    () => ({
      status,
      errorMessage,
      currentUser,
      isConnected: document.ownerUserId !== null,
      connect,
      syncNow,
      logout,
    }),
    [connect, currentUser, document.ownerUserId, errorMessage, logout, status, syncNow]
  );

  return <DriveSyncContext.Provider value={value}>{children}</DriveSyncContext.Provider>;
};

export const useDriveSync = (): DriveSyncContextValue => {
  const context = useContext(DriveSyncContext);
  if (!context) throw new Error('useDriveSync must be used inside DriveSyncProvider.');
  return context;
};

/* eslint-enable react-refresh/only-export-components */
