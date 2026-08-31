import React, { useState, useEffect, useRef } from 'react';
import * as dbStorage from './indexedDbStorage';
import { GoogleDriveSyncService } from './googleDriveSync';
import { MAX_DEPTH, type AppDocument, type Category, type TodoItem, type TodoList } from './types';

// Replace with actual Client ID configured in Google Cloud Console
const GOOGLE_CLIENT_ID = '970309791343-hskt6htkclutahianitcppmmmn3ecg3q.apps.googleusercontent.com';

const driveSyncService = new GoogleDriveSyncService(GOOGLE_CLIENT_ID);

const generateUUID = () => crypto.randomUUID();

// Sample Data Structure matching requirements: Food -> Non-Veg -> Mutton hierarchy
const getInitialSampleData = (): TodoList[] => {
  const muttonTodo: TodoItem = {
    id: generateUUID(),
    title: 'Buy fresh mutton chops',
    completed: false,
    depth: 3,
  };

  const nonVegSubcat: Category = {
    id: generateUUID(),
    title: 'Non-Veg',
    collapsed: false,
    hideCheckedItems: false,
    showCheckboxes: true, // Default: show checkboxes
    items: [muttonTodo],
    subcategories: [],
    depth: 2,
  };

  const foodCategory: Category = {
    id: generateUUID(),
    title: 'Food',
    collapsed: false,
    hideCheckedItems: false,
    showCheckboxes: true, // Default: show checkboxes
    items: [],
    subcategories: [nonVegSubcat],
    depth: 1,
  };

  const foodList: TodoList = {
    id: generateUUID(),
    title: 'Food',
    categories: [foodCategory],
  };

  const shoppingList: TodoList = {
    id: generateUUID(),
    title: 'Shopping',
    categories: [],
  };

  const personalList: TodoList = {
    id: generateUUID(),
    title: 'Personal',
    categories: [],
  };

  return [foodList, shoppingList, personalList];
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

  // Focus reference for auto-focusing newly created items
  const focusInputIdRef = useRef<string | null>(null);

  // Auto-sync debounce timer reference (Google API recommends 2-3 second buffer)
  const syncTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isSyncingRef = useRef<boolean>(false);

  // Track which dropdown is currently open (for todo items and categories)
  const [openDropdownId, setOpenDropdownId] = useState<string | null>(null);

  // Initialize App & Database
  useEffect(() => {
    async function loadApp() {
      try {
        const isAvailable = await dbStorage.initDB();
        setIsDbAvailable(isAvailable !== null);

        const localDoc = await dbStorage.loadDocument();
        if (localDoc) {
          setDoc(localDoc);
          setActiveListId(localDoc.activeListId || localDoc.lists[0]?.id || '');
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

  // Dynamic input focus handling
  useEffect(() => {
    if (focusInputIdRef.current) {
      const el = document.getElementById(`input-${focusInputIdRef.current}`);
      if (el) {
        el.focus();
        focusInputIdRef.current = null;
      }
    }
  }, [doc]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      // Close dropdown if clicking outside dropdown AND outside category "Add a task" button
      if (!target.closest('.dropdown') && !target.closest('.btn-add')) {
        setOpenDropdownId(null);
      }
    };

    document.addEventListener('click', handleClickOutside);
    return () => {
      document.removeEventListener('click', handleClickOutside);
    };
  }, []);

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

    if (
      confirm(`Are you absolutely sure you want to delete the list "${target.title}" and all its contents?`)
    ) {
      const remainingLists = doc.lists.filter((l) => l.id !== listId);
      const fallbackListId = remainingLists[0]?.id || '';
      const updatedDoc = {
        ...doc,
        lists: remainingLists,
        activeListId: fallbackListId,
      };
      setActiveListId(fallbackListId);
      updateDocument(updatedDoc);
    }
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
    if (confirm(`Delete the category "${title}" and all its subcategories and checklist items?`)) {
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
    }
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
      items: [],
      subcategories: [],
      depth: parentCategory.depth + 1,
    };

    handleUpdateCategory(parentCategory.id, (cat) => ({
      subcategories: [...cat.subcategories, newSub],
    }));
  };

  // Todo Items CRUD Logic
  /* Deprecated - now inlined in the Add Task button
  const handleAddTodoToCategory = (categoryId: string, currentDepth: number) => {
    const newTodo: TodoItem = {
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
    mutation: (item: TodoItem) => Partial<TodoItem>
  ): Category[] => {
    const recursiveTodoUpdate = (items: TodoItem[]): TodoItem[] => {
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
    const recursiveTodoDelete = (items: TodoItem[]): TodoItem[] => {
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

  const handleUpdateTodo = (todoId: string, mutation: (item: TodoItem) => Partial<TodoItem>) => {
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

  // Recursive checklist compliance audit
  const verifyAllChildrenCompleted = (item: TodoItem): boolean => {
    if (!item.listItems || item.listItems.length === 0) {
      return true;
    }
    return item.listItems.every((child) => {
      if (child.isText) return true;
      if (!child.completed) return false;
      return verifyAllChildrenCompleted(child);
    });
  };

  // Count completed items recursively
  const countCompletedItems = (item: TodoItem): { completed: number; total: number } => {
    if (!item.listItems || item.listItems.length === 0) {
      return { completed: 0, total: 0 };
    }
    let completed = 0;
    let total = 0;
    item.listItems.forEach((child) => {
      if (child.isText) return; // Skip text items
      total += 1;
      if (child.completed) {
        completed += 1;
      }
      // Recursively count nested items
      const nested = countCompletedItems(child);
      completed += nested.completed;
      total += nested.total;
    });
    return { completed, total };
  };

  // Count completed items in a category (including all subcategories)
  // Only counts items when category is in checkbox mode (showCheckboxes: true)
  const countCategoryItems = (category: Category): { completed: number; total: number } => {
    let completed = 0;
    let total = 0;

    // Only count items if category is in checkbox mode
    if (!category.showCheckboxes) {
      return { completed: 0, total: 0 };
    }

    // Count items in this category
    category.items.forEach((item) => {
      if (item.isText) return; // Skip legacy text notes
      if (item.isList) {
        // Count items in the list
        const listCounts = countCompletedItems(item);
        completed += listCounts.completed;
        total += listCounts.total;
      } else {
        // Regular checkbox item
        total += 1;
        if (item.completed) {
          completed += 1;
        }
      }
    });

    // Count items in subcategories recursively
    category.subcategories.forEach((sub) => {
      const subCounts = countCategoryItems(sub);
      completed += subCounts.completed;
      total += subCounts.total;
    });

    return { completed, total };
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
            <button className="btn btn-primary" onClick={handleSignIn}>
              🔌 Connect Google Drive
            </button>
          ) : (
            <>
              <span className="auto-sync-indicator">🟢 Auto-sync enabled</span>
              <button className="btn btn-outline" onClick={handleSignOut}>
                🚪 Sign Out
              </button>
            </>
          )}
        </div>
        {!isDbAvailable && (
          <div className="db-alert">
            ⚠️ Persistence Unavailable. Running in local memory mode. Reload browser to retry.
          </div>
        )}
      </div>
    );
  };

  const renderTodoItem = (item: TodoItem, hideChecked: boolean, showCheckboxes: boolean): React.ReactNode => {
    // Hide checked items only when hideChecked is enabled and item is completed
    if (hideChecked && item.completed && !item.isList) {
      return null;
    }

    const hasChildren = item.listItems && item.listItems.length > 0;
    const childrenAllCompleted = verifyAllChildrenCompleted(item);
    // Safe deletion validator: lists can only be deleted if empty OR all descendants are completed
    const deletionDisabled = item.isList && hasChildren && !childrenAllCompleted;

    return (
      <div key={item.id} className={`todo-item depth-${item.depth}`}>
        <div className="todo-row">
          {/* Show checkbox only if showCheckboxes is true and item is not a list or text note */}
          {showCheckboxes && !item.isList && !item.isText && (
            <input
              type="checkbox"
              className="todo-checkbox"
              checked={item.completed}
              onChange={(e) => handleUpdateTodo(item.id, () => ({ completed: e.target.checked }))}
            />
          )}

          {item.isList ? (
            // List title with fold/unfold and item count (clickable, not input)
            <div className="todo-title-list-wrapper">
              <span
                className="list-fold-toggle"
                onClick={() => handleUpdateTodo(item.id, (t) => ({ collapsed: !t.collapsed }))}
              >
                <span className="fold-icon">{item.collapsed ? '▶' : '▼'}</span>
                <span className={`todo-title-text ${item.completed ? 'completed' : ''}`}>
                  {item.title || 'Untitled List'}
                </span>
                {(() => {
                  const counts = countCompletedItems(item);
                  return (
                    <span className="list-items-count">
                      ({counts.completed}/{counts.total} <span className="checkmark">✓</span>)
                    </span>
                  );
                })()}
              </span>
            </div>
          ) : showCheckboxes ? (
            // Checkbox mode: text input for task title
            <input
              id={`input-${item.id}`}
              type="text"
              className={`todo-title-input ${item.completed ? 'completed' : ''}`}
              value={item.title}
              placeholder="Task name..."
              onChange={(e) => handleUpdateTodo(item.id, () => ({ title: e.target.value }))}
              onBlur={() => {
                if (!item.title.trim()) {
                  handleDeleteTodo(item.id);
                }
              }}
            />
          ) : (
            // Text mode: textarea for notes
            <textarea
              id={`input-${item.id}`}
              className="todo-notes"
              value={item.text || item.title}
              placeholder="Enter notes..."
              onChange={(e) => handleUpdateTodo(item.id, () => ({ text: e.target.value, title: e.target.value }))}
              onBlur={() => {
                if (!item.text?.trim() && !item.title?.trim()) {
                  handleDeleteTodo(item.id);
                }
              }}
            />
          )}

          {/* Todo Dropdown Menu */}
          <div className={`dropdown ${openDropdownId === item.id ? 'open' : ''}`}>
            <button
              className="dropdown-trigger"
              onClick={(e) => {
                e.stopPropagation();
                setOpenDropdownId(openDropdownId === item.id ? null : item.id);
              }}
            >
              ⋮
            </button>
            <div className="dropdown-menu" onClick={(e) => e.stopPropagation()}>
              {item.isList && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    const newTitle = prompt('Rename list:', item.title);
                    if (newTitle && newTitle.trim()) {
                      handleUpdateTodo(item.id, () => ({ title: newTitle.trim() }));
                    }
                    setOpenDropdownId(null);
                  }}
                >
                  Rename List
                </button>
              )}
              <button
                className="delete-action"
                disabled={deletionDisabled}
                onClick={(e) => {
                  e.stopPropagation();
                  handleDeleteTodo(item.id);
                  setOpenDropdownId(null);
                }}
              >
                Delete Item
              </button>
              {deletionDisabled && (
                <div className="validation-tooltip">
                  Deletion disabled: All nested subtasks must exist and be checked.
                </div>
              )}
            </div>
          </div>
        </div>

        {item.isList && item.listItems && (
          <div className="nested-list">
            {!item.collapsed && (
              <>
                {item.listItems.map((child) => renderTodoItem(child, hideChecked, showCheckboxes))}
              </>
            )}
          </div>
        )}
      </div>
    );
  };

  const renderCategory = (cat: Category): React.ReactNode => {
    const counts = countCategoryItems(cat);

    return (
      <div key={cat.id} className={`category-card depth-${cat.depth}`}>
        <div className="category-header">
          <div className="category-meta">
            <button className="category-header-title-button" onClick={() => handleUpdateCategory(cat.id, (c) => ({ collapsed: !c.collapsed }))}>
              <span className="fold-icon">{cat.collapsed ? '▶' : '▼'}</span>
              <span className="category-title">{cat.title}</span>
            </button>
            {/* <span className="badge-depth">Lvl {cat.depth}</span> */}
            {counts.total > 0 && (
              <span className="category-count">
                ({counts.completed}/{counts.total} <span className="checkmark">✓</span>)
              </span>
            )}
            <button className="btn btn-add" onClick={(e) => {
              e.stopPropagation();
              // Expand category and add todo in a single state update
              const newTodoId = generateUUID();
              focusInputIdRef.current = newTodoId;
              handleUpdateCategory(cat.id, (c) => ({
                collapsed: false,
                items: [{
                  id: newTodoId,
                  title: '',
                  completed: false,
                  depth: cat.depth,
                }, ...c.items],
              }));
              }}>
              ✚
            </button>
          </div>

          <div className={`dropdown ${openDropdownId === cat.id ? 'open' : ''}`}>
            <button
              className="dropdown-trigger"
              onClick={(e) => {
                e.stopPropagation();
                setOpenDropdownId(openDropdownId === cat.id ? null : cat.id);
              }}
            >
              ⋮
            </button>
            <div className="dropdown-menu" onClick={(e) => e.stopPropagation()}>
              <button onClick={(e) => {
                e.stopPropagation();
                const newTitle = prompt('Rename category:', cat.title);
                if (newTitle && newTitle.trim()) {
                  handleUpdateCategory(cat.id, () => ({ title: newTitle.trim() }));
                }
                setOpenDropdownId(null);
              }}>
                Rename
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleUpdateCategory(cat.id, (c) => ({ hideCheckedItems: !c.hideCheckedItems }));
                  setOpenDropdownId(null);
                }}
                disabled={!cat.showCheckboxes}
              >
                {cat.hideCheckedItems ? 'Show Checked' : 'Hide Checked'}
              </button>
              <button onClick={(e) => {
                e.stopPropagation();
                handleUpdateCategory(cat.id, (c) => ({ showCheckboxes: !c.showCheckboxes }));
                setOpenDropdownId(null);
              }}>
                {cat.showCheckboxes ? 'Hide Checkboxes (Text Mode)' : 'Show Checkboxes (Task Mode)'}
              </button>
              <button disabled={cat.depth >= MAX_DEPTH} onClick={(e) => {
                e.stopPropagation();
                handleAddSubcategory(cat);
                setOpenDropdownId(null);
              }}>
                Add Subcategory
              </button>
              <button className="delete-action" onClick={(e) => {
                e.stopPropagation();
                handleDeleteCategory(cat.id, cat.title);
                setOpenDropdownId(null);
              }}>
                Delete Category
              </button>
            </div>
          </div>
        </div>

        {!cat.collapsed && (
          <div className="category-body">
            {/* <button className="btn btn-add" onClick={() => handleAddTodoToCategory(cat.id, cat.depth)}>
              Add a task
            </button> */}
            {[...cat.items].reverse().map((item) => renderTodoItem(item, cat.hideCheckedItems, cat.showCheckboxes))}
            {cat.subcategories.map((sub) => renderCategory(sub))}
          </div>
        )}
      </div>
    );
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
              <span onClick={() => {
                setActiveListId(list.id);
                if (doc) updateDocument({ ...doc, activeListId: list.id }, false);
              }}>
                {list.title}
              </span>
              <button className="tab-delete" onClick={() => handleDeleteList(list.id)}>×</button>
            </div>
          ))}
          <button className="tab-item add-tab" onClick={handleAddList}>
            ✚ New List
          </button>
        </div>
      </nav>

      {/* Active list body */}
      <main className="app-body">
        {activeList ? (
          <div className="list-wrapper">
            <div className="list-header-row">
              <button className="btn btn-add" onClick={handleAddRootCategory}>
                ✚ New Category
              </button>
            </div>

            {activeList.categories.length === 0 ? (
              <div className="empty-state">
                No categories created yet in this list. Click "New Category" to get started.
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
    </div>
  );
}