import React, { useState, useEffect, useRef } from 'react';
import * as dbStorage from './indexedDbStorage';
import { GoogleDriveSyncService } from './googleDriveSync';
import { Icon, Modal, Category as CategoryComponent, TodoItem } from './components';
import { MAX_DEPTH, type AppDocument, type Category, type TodoItemType, type TodoList } from './types';
import type { ModalConfig } from './components/types/todoItem.types';

// Google Drive Sync Service initialization with Client ID from environment variable
const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID;
const driveSyncService = new GoogleDriveSyncService(GOOGLE_CLIENT_ID);

const generateUUID = () => crypto.randomUUID();

// Sample Data Structure matching requirements: Food -> Non-Veg -> Mutton hierarchy
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
    showCheckboxes: true, // Default: show checkboxes
    sortCheckedToBottom: false, // Default: don't sort checked items to bottom
    items: [orangesTodo],
    subcategories: [],
    depth: 2,
  };

  const foodCategory: Category = {
    id: generateUUID(),
    title: 'Food',
    collapsed: false,
    hideCheckedItems: false,
    showCheckboxes: true, // Default: show checkboxes
    sortCheckedToBottom: false, // Default: don't sort checked items to bottom
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
    activeListId: '', // Assigned dynamically
    syncMetadata: {
      lastSyncedAt: null,
      remoteRevision: null,
      isDirty: false,
      documentVersion: 1,
    },
  };
};

export default function App() {
  const [doc, setDoc] = useState<AppDocument | null>(null);
  const [activeListId, setActiveListId] = useState<string>('');
  const [syncState, setSyncState] = useState<string>('Local only');
  const [isDbAvailable, setIsDbAvailable] = useState<boolean>(true);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Focus state for auto-focusing newly created items
  const [focusInputId, setFocusInputId] = useState<string | null>(null);

  // Auto-sync debounce timer reference (Google API recommends 2-3 second buffer)
  const syncTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isSyncingRef = useRef<boolean>(false);

  // Track which dropdown is currently open (for todo items and categories)
  const [openDropdownId, setOpenDropdownId] = useState<string | null>(null);

  // Modal state for generic confirmations
  const [modalConfig, setModalConfig] = useState<ModalConfig>({
    isOpen: false,
    type: 'info',
    title: '',
    message: '',
    onConfirm: () => { },
  });

  // Migration: Ensure all categories have the sortCheckedToBottom property
  const migrateCategories = (categories: Category[]): Category[] => {
    return categories.map((cat) => ({
      ...cat,
      sortCheckedToBottom: cat.sortCheckedToBottom ?? false, // Default to false for backward compatibility
      subcategories: migrateCategories(cat.subcategories),
    }));
  };

  // Migration: Ensure all lists have categories with the new property
  const migrateDocument = (doc: AppDocument): AppDocument => {
    return {
      ...doc,
      lists: doc.lists.map((list) => ({
        ...list,
        categories: migrateCategories(list.categories),
      })),
    };
  };

  // Initialize App & Database
  useEffect(() => {
    async function loadApp() {
      try {
        const isAvailable = await dbStorage.initDB();
        setIsDbAvailable(isAvailable !== null);

        const localDoc = await dbStorage.loadDocument();
        if (localDoc) {
          const migratedDoc = migrateDocument(localDoc);
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

  // Sync state initialization with Google Auth
  useEffect(() => {
    const updateSyncStateFromAuth = () => {
      if (driveSyncService.isAuthorized()) {
        setSyncState('Synced');
      } else {
        setSyncState('Signed out');
      }
    };

    updateSyncStateFromAuth();
  }, []);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      // Close dropdown if clicking outside dropdown AND outside category "Add a task" button
      if (!target.closest('.dropdown') && !target.closest('.btn-add-task')) {
        setOpenDropdownId(null);
      }
    };

    document.addEventListener('click', handleClickOutside);
    return () => {
      document.removeEventListener('click', handleClickOutside);
    };
  }, []);

  // Handle local state changes & database persistence
  const updateDocument = async (updatedDoc: AppDocument, isUserAction = true) => {
    const finalDoc = {
      ...updatedDoc,
      updatedAt: new Date().toISOString(),
      syncMetadata: {
        ...updatedDoc.syncMetadata,
        isDirty: isUserAction,
        documentVersion: isUserAction
          ? updatedDoc.syncMetadata.documentVersion + 1
          : updatedDoc.syncMetadata.documentVersion,
      },
    };
    setDoc(finalDoc);
    const saved = await dbStorage.saveDocument(finalDoc);
    setIsDbAvailable(saved);
  };

  // Safe 3-Way Google Drive Synchronization Protocol
  const performSynchronization = async (forcedLocalDoc?: AppDocument) => {
    // Prevent concurrent sync operations
    if (isSyncingRef.current) {
      console.log('Sync already in progress, skipping...');
      return;
    }

    if (!doc) return;
    const documentToSync = forcedLocalDoc || doc;
    setSyncState('Syncing');
    isSyncingRef.current = true;

    try {
      const fileId = await driveSyncService.findFile();

      if (!fileId) {
        // No remote document: Upload local copy safely
        const newFileId = await driveSyncService.uploadFile(documentToSync, null);
        const syncedDoc: AppDocument = {
          ...documentToSync,
          syncMetadata: {
            ...documentToSync.syncMetadata,
            isDirty: false,
            lastSyncedAt: new Date().toISOString(),
            remoteRevision: newFileId,
          },
        };
        await updateDocument(syncedDoc, false);
        setSyncState('Synced');
        return;
      }

      // Download and parse remote document
      const remoteDoc = await driveSyncService.downloadFile(fileId);

      // Perform state assessments & resolution matches
      const localChanged = documentToSync.syncMetadata.isDirty;
      const remoteChanged = remoteDoc.syncMetadata.documentVersion !== documentToSync.syncMetadata.documentVersion;

      if (!localChanged && !remoteChanged) {
        setSyncState('Synced');
        return;
      }

      if (localChanged && !remoteChanged) {
        // Safe upload: push local modifications up
        await driveSyncService.uploadFile(documentToSync, fileId);
        const syncedDoc: AppDocument = {
          ...documentToSync,
          syncMetadata: {
            ...documentToSync.syncMetadata,
            isDirty: false,
            lastSyncedAt: new Date().toISOString(),
            remoteRevision: fileId,
          },
        };
        await updateDocument(syncedDoc, false);
        setSyncState('Synced');
      } else if (!localChanged && remoteChanged) {
        // Safe download: overwrite inactive local state
        const syncedDoc: AppDocument = {
          ...remoteDoc,
          syncMetadata: {
            ...remoteDoc.syncMetadata,
            isDirty: false,
            lastSyncedAt: new Date().toISOString(),
            remoteRevision: fileId,
          },
        };
        await updateDocument(syncedDoc, false);
        setSyncState('Synced');
      } else {
        // Conflict detected: Always use local version (no user prompt)
        const resolvedDoc: AppDocument = {
          ...documentToSync,
          syncMetadata: {
            ...documentToSync.syncMetadata,
            isDirty: false,
            lastSyncedAt: new Date().toISOString(),
            remoteRevision: fileId,
          },
        };

        try {
          // Upload local version to Drive (always prefer local)
          await driveSyncService.uploadFile(resolvedDoc, fileId);
          await updateDocument(resolvedDoc, false);
          setSyncState('Synced');
        } catch (error) {
          console.error('Failed to sync local version during conflict:', error);
          setSyncState('Sync failed');
        }
      }
    } catch (e) {
      console.error('Drive sync failed:', e);
      setSyncState('Sync failed');
    } finally {
      // Always reset syncing flag
      isSyncingRef.current = false;
    }
  };

  // Auto-sync on every change with debounce (Google API rate limit protection)
  useEffect(() => {
    // Clear any pending sync timer
    if (syncTimerRef.current) {
      clearTimeout(syncTimerRef.current);
    }

    // Only auto-sync if:
    // - Document exists
    // - User is signed in (authorized)
    // - Document has unsynced changes (isDirty)
    // - Not currently syncing
    if (!doc || !driveSyncService.isAuthorized() || !doc.syncMetadata.isDirty || isSyncingRef.current) {
      return;
    }

    // Debounce sync by 2 seconds (Google API recommendation to batch changes)
    syncTimerRef.current = setTimeout(() => {
      performSynchronization();
    }, 2000);

    // Cleanup: cancel pending sync on unmount or dependency change
    return () => {
      if (syncTimerRef.current) {
        clearTimeout(syncTimerRef.current);
      }
    };
  }, [doc, doc?.syncMetadata.isDirty]);

  const getActiveList = (): TodoList | undefined => {
    return doc?.lists.find((l) => l.id === activeListId);
  };

  // Google OAuth flow
  const handleSignIn = () => {
    setSyncState('Signing in');
    driveSyncService.authorize(
      async () => {
        setSyncState('Syncing');
        await performSynchronization();
      },
      (error) => {
        console.error('Sign-in failed:', error);
        setSyncState('Sync failed');
        alert(`Google Authentication Failed: ${error}`);
      }
    );
  };

  const handleSignOut = () => {
    driveSyncService.clearToken();
    setSyncState('Signed out');
  };

  // list actions
  const handleAddList = () => {
    if (!doc) return;
    const listTitle = prompt('Enter name of new list:');
    if (!listTitle || !listTitle.trim()) return;

    const newList: TodoList = {
      id: generateUUID(),
      title: listTitle.trim(),
      categories: [],
    };

    const updatedDoc = {
      ...doc,
      lists: [...doc.lists, newList],
      activeListId: newList.id,
    };
    setActiveListId(newList.id);
    updateDocument(updatedDoc);
  };

  const handleDeleteList = (listId: string) => {
    if (!doc) return;
    const target = doc.lists.find((l) => l.id === listId);
    if (!target) return;

    setModalConfig({
      isOpen: true,
      type: 'danger',
      title: 'Delete List',
      message: `Are you absolutely sure you want to delete the list "${target.title}" and all its contents?`,
      onConfirm: () => {
        const remainingLists = doc.lists.filter((l) => l.id !== listId);
        const fallbackListId = remainingLists[0]?.id || '';
        const updatedDoc = {
          ...doc,
          lists: remainingLists,
          activeListId: fallbackListId,
        };
        setActiveListId(fallbackListId);
        updateDocument(updatedDoc);
      },
      confirmLabel: 'Delete',
      cancelLabel: 'Cancel',
    });
  };

  // Add Category at Root Level
  const handleAddRootCategory = () => {
    if (!doc) return;
    const categoryTitle = prompt('Enter category title:');
    if (!categoryTitle || !categoryTitle.trim()) return;

    const newCategory: Category = {
      id: generateUUID(),
      title: categoryTitle.trim(),
      collapsed: false,
      hideCheckedItems: false,
      showCheckboxes: true, // Default: show checkboxes
      sortCheckedToBottom: false, // Default: don't sort checked items to bottom
      items: [],
      subcategories: [],
      depth: 1,
    };

    const updatedDoc = {
      ...doc,
      lists: doc.lists.map((l) => {
        if (l.id === activeListId) {
          return {
            ...l,
            categories: [...l.categories, newCategory],
          };
        }
        return l;
      }),
    };
    updateDocument(updatedDoc);
  };

  // Recursive mutations
  const updateCategoriesRecursive = (
    categories: Category[],
    targetId: string,
    mutation: (cat: Category) => Partial<Category>
  ): Category[] => {
    return categories.map((cat) => {
      if (cat.id === targetId) {
        return { ...cat, ...mutation(cat) };
      }
      if (cat.subcategories.length > 0) {
        return {
          ...cat,
          subcategories: updateCategoriesRecursive(cat.subcategories, targetId, mutation),
        };
      }
      return cat;
    });
  };

  const deleteCategoryRecursive = (categories: Category[], targetId: string): Category[] => {
    return categories
      .filter((cat) => cat.id !== targetId)
      .map((cat) => {
        return {
          ...cat,
          subcategories: deleteCategoryRecursive(cat.subcategories, targetId),
        };
      });
  };

  const handleUpdateCategory = (categoryId: string, mutation: (cat: Category) => Partial<Category>) => {
    if (!doc) return;
    const updatedDoc = {
      ...doc,
      lists: doc.lists.map((l) => {
        if (l.id === activeListId) {
          return {
            ...l,
            categories: updateCategoriesRecursive(l.categories, categoryId, mutation),
          };
        }
        return l;
      }),
    };
    updateDocument(updatedDoc);
  };

  const handleDeleteCategory = (categoryId: string, title: string) => {
    if (!doc) return;
    setOpenDropdownId(null);
    setModalConfig({
      isOpen: true,
      type: 'danger',
      title: 'Delete Category',
      message: `Delete the category "${title}" and all its subcategories and checklist items?`,
      onConfirm: () => {
        const updatedDoc = {
          ...doc,
          lists: doc.lists.map((l) => {
            if (l.id === activeListId) {
              return {
                ...l,
                categories: deleteCategoryRecursive(l.categories, categoryId),
              };
            }
            return l;
          }),
        };
        updateDocument(updatedDoc);
      },
      confirmLabel: 'Delete',
      cancelLabel: 'Cancel',
    });
  };

  const handleAddSubcategory = (parentCategory: Category) => {
    if (parentCategory.depth >= MAX_DEPTH) {
      alert(`Nesting limit reached! Maximum nesting level is ${MAX_DEPTH}.`);
      return;
    }

    const title = prompt('Enter subcategory title:');
    if (!title || !title.trim()) return;

    const newSub: Category = {
      id: generateUUID(),
      title: title.trim(),
      collapsed: false,
      hideCheckedItems: parentCategory.hideCheckedItems,
      showCheckboxes: parentCategory.showCheckboxes, // Inherit from parent
      sortCheckedToBottom: parentCategory.sortCheckedToBottom, // Inherit from parent
      items: [],
      subcategories: [],
      depth: parentCategory.depth + 1,
    };

    handleUpdateCategory(parentCategory.id, (cat) => ({
      subcategories: [...cat.subcategories, newSub],
    }));
  };

  // Add new todo item after a specific item (for Enter key functionality)
  const handleAddTodoAfter = (
    categoryId: string,
    afterItemId: string,
    isNestedList: boolean = false,
    parentListId?: string
  ) => {
    const newTodo: TodoItemType = {
      id: generateUUID(),
      title: '',
      completed: false,
    };

    // Set focus to the new item
    setFocusInputId(newTodo.id);

    if (isNestedList && parentListId) {
      // Add to nested list
      handleUpdateTodo(parentListId, (item) => {
        const existingItems = item.listItems || [];
        const newItemIndex = existingItems.findIndex((i) => i.id === afterItemId);
        const newItems = [...existingItems];
        newItems.splice(newItemIndex + 1, 0, newTodo);
        return { listItems: newItems };
      });
    } else {
      // Add to category
      handleUpdateCategory(categoryId, (cat) => {
        const existingItems = [...cat.items].reverse(); // Maintain reverse order
        const newItemIndex = existingItems.findIndex((i) => i.id === afterItemId);
        const newItems = [...existingItems];
        newItems.splice(newItemIndex + 1, 0, newTodo);
        return { items: newItems.reverse() };
      });
    }
  };

  // Todo Items CRUD Logic
  /* Deprecated - now inlined in the Add Task button
  const handleAddTodoToCategory = (categoryId: string, currentDepth: number) => {
    const newTodo: TodoItemType = {
      id: generateUUID(),
      title: '',
      completed: false,
      depth: currentDepth,
    };

    // Set focus to the new item
    focusInputIdRef.current = newTodo.id;

    handleUpdateCategory(categoryId, (cat) => ({
      items: [newTodo, ...cat.items],
    }));
  };
  */

  const updateTodoInCategories = (
    categories: Category[],
    todoId: string,
    mutation: (item: TodoItemType) => Partial<TodoItemType>
  ): Category[] => {
    const recursiveTodoUpdate = (items: TodoItemType[]): TodoItemType[] => {
      return items.map((item) => {
        if (item.id === todoId) {
          return { ...item, ...mutation(item) };
        }
        if (item.listItems && item.listItems.length > 0) {
          return {
            ...item,
            listItems: recursiveTodoUpdate(item.listItems),
          };
        }
        return item;
      });
    };

    return categories.map((cat) => {
      return {
        ...cat,
        items: recursiveTodoUpdate(cat.items),
        subcategories: updateTodoInCategories(cat.subcategories, todoId, mutation),
      };
    });
  };

  const deleteTodoInCategories = (categories: Category[], todoId: string): Category[] => {
    const recursiveTodoDelete = (items: TodoItemType[]): TodoItemType[] => {
      return items
        .filter((item) => item.id !== todoId)
        .map((item) => {
          if (item.listItems && item.listItems.length > 0) {
            return {
              ...item,
              listItems: recursiveTodoDelete(item.listItems),
            };
          }
          return item;
        });
    };

    return categories.map((cat) => {
      return {
        ...cat,
        items: recursiveTodoDelete(cat.items),
        subcategories: deleteTodoInCategories(cat.subcategories, todoId),
      };
    });
  };

  const handleUpdateTodo = (todoId: string, mutation: (item: TodoItemType) => Partial<TodoItemType>) => {
    if (!doc) return;
    const updatedDoc = {
      ...doc,
      lists: doc.lists.map((l) => {
        if (l.id === activeListId) {
          return {
            ...l,
            categories: updateTodoInCategories(l.categories, todoId, mutation),
          };
        }
        return l;
      }),
    };
    updateDocument(updatedDoc);
  };

  const handleDeleteTodo = (todoId: string) => {
    if (!doc) return;
    const updatedDoc = {
      ...doc,
      lists: doc.lists.map((l) => {
        if (l.id === activeListId) {
          return {
            ...l,
            categories: deleteTodoInCategories(l.categories, todoId),
          };
        }
        return l;
      }),
    };
    updateDocument(updatedDoc);
  };

  // Components Render Methods
  const renderSyncPanel = () => {
    return (
      <div className="sync-panel">
        <div className="sync-status">
          <span className="indicator-label">Cloud Sync State:</span>
          <span className={`status-badge state-${syncState.toLowerCase().replace(' ', '-')}`}>
            {syncState}
          </span>
          {doc?.syncMetadata.lastSyncedAt && (
            <span className="timestamp">
              Last Synced: {new Date(doc.syncMetadata.lastSyncedAt).toLocaleTimeString()}
            </span>
          )}
        </div>
        <div className="sync-controls">
          {syncState === 'Signed out' || syncState === 'Local only' || syncState === 'Sync failed' ? (
            <button className="btn btn-primary" onClick={handleSignIn} type='button'>
              <Icon name="ri-plug-line" /> Connect Google Drive
            </button>
          ) : (
            <>
              <span className="auto-sync-indicator"><Icon name="ri-checkbox-circle-fill" color="#22c55e" /> Auto-sync enabled</span>
              <button className="btn btn-outline" onClick={handleSignOut} type='button'>
                <Icon name="ri-logout-box-line" /> Sign Out
              </button>
            </>
          )}
        </div>
        {!isDbAvailable && (
          <div className="db-alert">
            <Icon name="ri-alert-line" /> Persistence Unavailable. Running in local memory mode. Reload browser to retry.
          </div>
        )}
      </div>
    );
  };

  const renderTodoItem = (
    item: TodoItemType,
    hideChecked: boolean,
    showCheckboxes: boolean,
    sortCheckedToBottom: boolean = false,
    categoryId?: string,
    parentListId?: string
  ): React.ReactNode => {
    return (
      <TodoItem
        key={item.id}
        item={item}
        hideChecked={hideChecked}
        showCheckboxes={showCheckboxes}
        sortCheckedToBottom={sortCheckedToBottom}
        categoryId={categoryId}
        parentListId={parentListId}
        focusInputId={focusInputId}
        setFocusInputId={setFocusInputId}
        onUpdateTodo={handleUpdateTodo}
        onDeleteTodo={handleDeleteTodo}
        onAddTodoAfter={handleAddTodoAfter}
        onSetModalConfig={setModalConfig}
        setOpenDropdownId={setOpenDropdownId}
        renderTodoItem={renderTodoItem}
      />
    );
  };

  const renderCategory = (cat: Category): React.ReactNode => {
    return (
      <CategoryComponent
        key={cat.id}
        category={cat}
        onUpdateCategory={handleUpdateCategory}
        onAddSubcategory={handleAddSubcategory}
        onDeleteCategory={handleDeleteCategory}
        openDropdownId={openDropdownId}
        setOpenDropdownId={setOpenDropdownId}
        setFocusInputId={setFocusInputId}
        renderTodoItem={renderTodoItem}
        renderCategory={renderCategory}
      />
    );
  };

  const handleTabClick = (listId: string) => {
    setActiveListId(listId);
    if (doc) {
      updateDocument({ ...doc, activeListId: listId }, false);
    }
  };

  const handleTabDelete = (listId: string) => {
    handleDeleteList(listId);
  };

  const handleModalClose = () => {
    setModalConfig({ ...modalConfig, isOpen: false });
  };

  const activeList = getActiveList();

  if (isLoading) {
    return (
      <div className="app-container">
        <div className="empty-state">Loading...</div>
      </div>
    );
  }

  return (
    <div className="app-container">

      {/* Tabs list navigation */}
      <nav className="tab-navigation">
        <div className="tab-list">
          {doc?.lists.map((list) => (
            <div
              key={list.id}
              className={`tab-item ${list.id === activeListId ? 'active' : ''}`}
            >
              <button className='tab-title-button' onClick={() => handleTabClick(list.id)} type="button">
                {list.title}
              </button>
              <button className="tab-delete" onClick={() => handleTabDelete(list.id)} type='button'>
                <Icon name="ri-close-line" />
              </button>
            </div>
          ))}
          <button className="tab-item add-tab" onClick={handleAddList} type='button'>
            <Icon name="ri-add-line" /> New List
          </button>
        </div>
      </nav>

      {/* Active list body */}
      <main className="app-body">
        {activeList ? (
          <div className="list-wrapper">
            <div className="list-header-row">
              <button className="btn btn-outline" onClick={handleAddRootCategory} type='button'>
                <Icon name="ri-add-line" /> New Category
              </button>
            </div>

            {activeList.categories.length === 0 ? (
              <div className="empty-state">
                Click "New Category" to get started.
              </div>
            ) : (
              <div className="categories-grid">
                {activeList.categories.map((cat) => renderCategory(cat))}
              </div>
            )}
          </div>
        ) : (
          <div className="empty-state">
            Please select an existing list tab or create a new one to begin.
          </div>
        )}
      </main>
      <footer className="app-footer">
        {renderSyncPanel()}
      </footer>

      {/* Generic Modal for confirmations */}
      <Modal
        isOpen={modalConfig.isOpen}
        onClose={handleModalClose}
        title={modalConfig.title}
        message={modalConfig.message}
        type={modalConfig.type}
        onConfirm={modalConfig.onConfirm}
        confirmLabel={modalConfig.confirmLabel}
        cancelLabel={modalConfig.cancelLabel}
      />
    </div>
  );
}