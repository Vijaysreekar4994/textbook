import type { AppDocument, Category, SyncMetadata, TodoItemType, TodoList } from '../types';
import { migrateCategories } from './categoryUtils';
import { generateUUID } from './uuid';

const DEFAULT_SYNC_METADATA: SyncMetadata = {
  lastSyncedAt: null,
  remoteRevision: null,
  isDirty: false,
  documentVersion: 1,
};

export const createEmptyDocument = (): AppDocument => ({
  version: 1,
  documentId: generateUUID(),
  updatedAt: new Date().toISOString(),
  lists: [],
  activeListId: '',
  syncMetadata: { ...DEFAULT_SYNC_METADATA },
});

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const isTodoItem = (value: unknown): value is TodoItemType => {
  if (!isRecord(value)) return false;
  if (typeof value.id !== 'string' || typeof value.title !== 'string') return false;
  if (typeof value.completed !== 'boolean') return false;
  if (value.listItems !== undefined) {
    if (!Array.isArray(value.listItems) || !value.listItems.every(isTodoItem)) return false;
  }
  return true;
};

const isCategory = (value: unknown): value is Category => {
  if (!isRecord(value)) return false;
  if (typeof value.id !== 'string' || typeof value.title !== 'string') return false;
  if (!Array.isArray(value.items) || !value.items.every(isTodoItem)) return false;
  if (!Array.isArray(value.subcategories) || !value.subcategories.every(isCategory)) return false;
  return true;
};

const isTodoList = (value: unknown): value is TodoList => {
  if (!isRecord(value)) return false;
  if (typeof value.id !== 'string' || typeof value.title !== 'string') return false;
  return Array.isArray(value.categories) && value.categories.every(isCategory);
};

export const isAppDocument = (value: unknown): value is AppDocument => {
  if (!isRecord(value)) return false;
  if (typeof value.documentId !== 'string' || typeof value.updatedAt !== 'string') return false;
  if (!Array.isArray(value.lists) || !value.lists.every(isTodoList)) return false;
  return isRecord(value.syncMetadata);
};

export const migrateDocument = (document: AppDocument): AppDocument => ({
  ...document,
  version: document.version ?? 1,
  activeListId: document.activeListId ?? '',
  lists: document.lists.map((list) => ({
    ...list,
    categories: migrateCategories(list.categories),
  })),
  syncMetadata: {
    ...DEFAULT_SYNC_METADATA,
    ...document.syncMetadata,
    documentVersion: document.syncMetadata?.documentVersion ?? 1,
  },
});

export const markDocumentSynced = (
  document: AppDocument,
  remoteRevision: string,
  syncedAt = new Date().toISOString()
): AppDocument => ({
  ...document,
  syncMetadata: {
    ...document.syncMetadata,
    isDirty: false,
    lastSyncedAt: syncedAt,
    remoteRevision,
  },
});
