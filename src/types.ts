export interface TodoItemType {
  id: string;
  title: string;
  completed: boolean;
  isText?: boolean;
  text?: string;
  isList?: boolean;
  listItems?: TodoItemType[];
  collapsed?: boolean;
}

export interface Category {
  id: string;
  title: string;
  collapsed: boolean;
  hideCheckedItems: boolean;
  showCheckboxes: boolean;
  sortCheckedToBottom: boolean;
  items: TodoItemType[];
  subcategories: Category[];
  depth: number;
}

export interface TodoList {
  id: string;
  title: string;
  categories: Category[];
}

export interface SyncMetadata {
  lastSyncedAt: string | null;
  remoteRevision: string | null;
  isDirty: boolean;
  documentVersion: number;
}

export interface AppDocument {
  version: number;
  documentId: string;
  updatedAt: string;
  lists: TodoList[];
  activeListId: string;
  syncMetadata: SyncMetadata;
}

export interface DriveUser {
  id: string;
  displayName: string;
  emailAddress: string;
}

export interface DriveFileMetadata {
  id: string;
  version: string;
  modifiedTime: string;
}

export type SyncStatus =
  | 'local-only'
  | 'connecting'
  | 'syncing'
  | 'synced'
  | 'offline'
  | 'reauth-required'
  | 'error';

export const MAX_DEPTH = 3;

export const DB_NAME = 'TodoAppDatabase';
export const DB_VERSION = 1;
export const STORE_NAME = 'documents';

// Kept only so existing installations can be migrated without losing data.
export const LEGACY_DOC_ID_KEY = 'current_document';
export const GUEST_DOC_ID_KEY = 'document:guest';
export const USER_DOC_ID_PREFIX = 'document:user:';
export const SYNC_BASE_ID_PREFIX = 'sync-base:user:';
export const ACTIVE_USER_STORAGE_KEY = 'textbook_active_user_id';
