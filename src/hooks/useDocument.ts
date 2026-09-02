import { useState, useEffect, useCallback } from 'react';
import * as dbStorage from '../indexedDbStorage';
import { GoogleDriveSyncService } from '../googleDriveSync';
import type { AppDocument, Category, TodoItemType, TodoList } from '../types';
import { migrateCategories } from '../utils/categoryUtils';
import { generateUUID } from '../utils/uuid';

// Google Drive Sync Service initialization with Client ID from environment variable
const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID;
const driveSyncService = new GoogleDriveSyncService(GOOGLE_CLIENT_ID);

const getInitialSampleData = (): TodoList[] => {
  const orangesTodo: TodoItemType = {
    id: generateUUID(),
    title: 'Oranges',
    completed: false,
  };

  const fruitsSubcat: Category = {
    id: generateUUID(),
    title: 'Fruits',
    collapsed: false,
    hideCheckedItems: false,
    showCheckboxes: true,
    sortCheckedToBottom: false,
    items: [orangesTodo],
    subcategories: [],
    depth: 2,
  };

  const foodCategory: Category = {
    id: generateUUID(),
    title: 'Food',
    collapsed: false,
    hideCheckedItems: false,
    showCheckboxes: true,
    sortCheckedToBottom: false,
    items: [],
    subcategories: [fruitsSubcat],
    depth: 1,
  };

  const shoppingList: TodoList = {
    id: generateUUID(),
    title: 'Shopping',
    categories: [foodCategory],
  };

  const workList: TodoList = {
    id: generateUUID(),
    title: 'Work',
    categories: [],
  };

  const personalList: TodoList = {
    id: generateUUID(),
    title: 'Personal',
    categories: [],
  };

  return [shoppingList, workList, personalList];
};

const createNewDocument = (): AppDocument => {
  return {
    version: 1,
    documentId: generateUUID(),
    updatedAt: new Date().toISOString(),
    lists: getInitialSampleData(),
    activeListId: '',
    syncMetadata: {
      lastSyncedAt: null,
      remoteRevision: null,
      isDirty: false,
      documentVersion: 1,
    },
  };
};

export interface UseDocumentReturn {
  doc: AppDocument | null;
  activeListId: string;
  isLoading: boolean;
  isDbAvailable: boolean;
  setActiveListId: (id: string) => void;
  updateDocument: (updatedDoc: AppDocument, isUserAction?: boolean) => Promise<void>;
  driveSyncService: GoogleDriveSyncService;
}

export const useDocument = (): UseDocumentReturn => {
  const [doc, setDoc] = useState<AppDocument | null>(null);
  const [activeListId, setActiveListId] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isDbAvailable, setIsDbAvailable] = useState<boolean>(true);

  // Initialize App & Database
  useEffect(() => {
    async function loadApp() {
      try {
        const isAvailable = await dbStorage.initDB();
        setIsDbAvailable(isAvailable !== null);

        const localDoc = await dbStorage.loadDocument();
        if (localDoc) {
          const migratedDoc = {
            ...localDoc,
            lists: localDoc.lists.map((list) => ({
              ...list,
              categories: migrateCategories(list.categories),
            })),
          };
          setDoc(migratedDoc);
          setActiveListId(migratedDoc.activeListId || migratedDoc.lists[0]?.id || '');
        } else {
          const initialDoc = createNewDocument();
          initialDoc.activeListId = initialDoc.lists[0].id;
          setDoc(initialDoc);
          setActiveListId(initialDoc.lists[0].id);
          await dbStorage.saveDocument(initialDoc);
        }
      } catch (error) {
        console.error('Failed to load app:', error);
      } finally {
        setIsLoading(false);
      }
    }
    loadApp();
  }, []);

  // Handle local state changes & database persistence
  const updateDocument = useCallback(
    async (updatedDoc: AppDocument, isUserAction = true) => {
      const finalDoc = {
        ...updatedDoc,
        updatedAt: new Date().toISOString(),
        syncMetadata: {
          ...updatedDoc.syncMetadata,
          isDirty: isUserAction,
        },
      };

      setDoc(finalDoc);

      try {
        await dbStorage.saveDocument(finalDoc);
      } catch (error) {
        console.error('Failed to save document:', error);
      }
    },
    []
  );

  return {
    doc,
    activeListId,
    setActiveListId,
    isLoading,
    isDbAvailable,
    updateDocument,
    driveSyncService,
  };
};