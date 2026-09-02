export interface TodoItemType {
  id: string;
  title: string;
  completed: boolean;
  isText?: boolean;
  text?: string;
  isList?: boolean;
  listItems?: TodoItemType[];
  collapsed?: boolean; // For fold/unfold functionality
}

export interface Category {
  id: string;
  title: string;
  collapsed: boolean;
  hideCheckedItems: boolean;
  showCheckboxes: boolean; // Controls whether items display as checkboxes or text notes
  sortCheckedToBottom: boolean; // When true, checked items move to bottom of list
  items: TodoItemType[];
  subcategories: Category[];
  depth: number; // 1 to 5
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
  version: number; // document schema/data version
  documentId: string;
  updatedAt: string;
  lists: TodoList[];
  activeListId: string;
  syncMetadata: SyncMetadata;
}

export const MAX_DEPTH = 3;
export const DB_NAME = 'TodoAppDatabase';
export const DB_VERSION = 1;
export const STORE_NAME = 'documents';
export const DOC_ID_KEY = 'current_document';