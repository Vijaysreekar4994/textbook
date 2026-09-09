import { type ReactNode, useEffect, useRef, useState } from 'react';
import { Icon, Modal, ReorderList, Category as CategoryComponent, TodoItem } from './components';
import { useDocument, type UseDocumentReturn } from './hooks/useDocument';
import { DriveSyncProvider } from './sync/DriveSyncContext';
import { MAX_DEPTH, type Category, type TodoItemType, type TodoList } from './types';
import type { ModalConfig } from './components/types/todoItem.types';
import {
  deleteCategoryRecursive,
  deleteTodoItem,
  updateCategoriesRecursive,
  updateTodoItems,
} from './utils/categoryUtils';
import { generateUUID } from './utils/uuid';
import { SyncPanel } from './components/SyncPanel';

interface AppContentProps {
  document: UseDocumentReturn;
}

const AppContent = ({ document }: AppContentProps) => {
  const {
    doc,
    activeListId,
    isLoading,
    isDbAvailable,
    setActiveListId,
    updateDocument,
  } = document;

  const [focusInputId, setFocusInputId] = useState<string | null>(null);
  const [openDropdownId, setOpenDropdownId] = useState<string | null>(null);
  const [modalConfig, setModalConfig] = useState<ModalConfig>({
    isOpen: false,
    type: 'info',
    title: '',
    message: '',
    onConfirm: () => undefined,
  });
  const [tabMenuOpen, setTabMenuOpen] = useState(false);
  const [tabMenuPos, setTabMenuPos] = useState({ top: 0, left: 0 });
  const tabOptionsRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (!target.closest('.dropdown') && !target.closest('.btn-add-task')) {
        setOpenDropdownId(null);
      }
    };

    window.document.addEventListener('click', handleClickOutside);
    return () => window.document.removeEventListener('click', handleClickOutside);
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (!target.closest('.tab-options')) {
        setTabMenuOpen(false);
      }
    };

    window.document.addEventListener('click', handleClickOutside);
    return () => window.document.removeEventListener('click', handleClickOutside);
  }, []);

  const getActiveList = (): TodoList | undefined =>
    doc?.lists.find((list) => list.id === activeListId);

  const handleAddList = () => {
    if (!doc) return;

    const listTitle = prompt('Enter name of new list:');
    if (!listTitle?.trim()) return;

    const newList: TodoList = {
      id: generateUUID(),
      title: listTitle.trim(),
      categories: [],
    };

    setActiveListId(newList.id);
    updateDocument({
      ...doc,
      lists: [...doc.lists, newList],
      activeListId: newList.id,
    });
  };

  const handleDeleteList = (listId: string) => {
    if (!doc) return;

    const target = doc.lists.find((list) => list.id === listId);
    if (!target) return;

    // Close the tab-options-menu so it doesn't linger behind the modal
    setTabMenuOpen(false);

    setModalConfig({
      isOpen: true,
      type: 'danger',
      title: 'Delete List',
      message: `Are you absolutely sure you want to delete the list "${target.title}" and all its contents?`,
      onConfirm: () => {
        const remainingLists = doc.lists.filter((list) => list.id !== listId);
        const fallbackListId = remainingLists[0]?.id ?? '';

        setActiveListId(fallbackListId);
        updateDocument({
          ...doc,
          lists: remainingLists,
          activeListId: fallbackListId,
        });
      },
      confirmLabel: 'Delete',
      cancelLabel: 'Cancel',
    });
  };

  const handleEditList = (listId: string) => {
    if (!doc) return;
    const target = doc.lists.find((list) => list.id === listId);
    if (!target) return;

    const newTitle = prompt('Rename list:', target.title);
    if (!newTitle?.trim()) return;

    updateDocument({
      ...doc,
      lists: doc.lists.map((list) =>
        list.id === listId ? { ...list, title: newTitle.trim() } : list
      ),
    });
  };

  const handleAddRootCategory = () => {
    if (!doc) return;

    const categoryTitle = prompt('Enter category title:');
    if (!categoryTitle?.trim()) return;

    const newCategory: Category = {
      id: generateUUID(),
      title: categoryTitle.trim(),
      collapsed: false,
      hideCheckedItems: false,
      showCheckboxes: true,
      sortCheckedToBottom: false,
      items: [],
      subcategories: [],
      depth: 1,
    };

    updateDocument({
      ...doc,
      lists: doc.lists.map((list) =>
        list.id === activeListId
          ? { ...list, categories: [...list.categories, newCategory] }
          : list
      ),
    });
  };

  const handleUpdateCategory = (
    categoryId: string,
    mutation: (category: Category) => Partial<Category>
  ) => {
    if (!doc) return;

    updateDocument({
      ...doc,
      lists: doc.lists.map((list) =>
        list.id === activeListId
          ? {
              ...list,
              categories: updateCategoriesRecursive(list.categories, categoryId, mutation),
            }
          : list
      ),
    });
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
        updateDocument({
          ...doc,
          lists: doc.lists.map((list) =>
            list.id === activeListId
              ? {
                  ...list,
                  categories: deleteCategoryRecursive(list.categories, categoryId),
                }
              : list
          ),
        });
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
    if (!title?.trim()) return;

    const newSubcategory: Category = {
      id: generateUUID(),
      title: title.trim(),
      collapsed: false,
      hideCheckedItems: parentCategory.hideCheckedItems,
      showCheckboxes: parentCategory.showCheckboxes,
      sortCheckedToBottom: parentCategory.sortCheckedToBottom,
      items: [],
      subcategories: [],
      depth: parentCategory.depth + 1,
    };

    handleUpdateCategory(parentCategory.id, (category) => ({
      subcategories: [...category.subcategories, newSubcategory],
    }));
  };

  const handleUpdateTodo = (
    todoId: string,
    mutation: (item: TodoItemType) => Partial<TodoItemType>
  ) => {
    if (!doc) return;

    updateDocument({
      ...doc,
      lists: doc.lists.map((list) =>
        list.id === activeListId
          ? {
              ...list,
              categories: updateTodoItems(list.categories, todoId, mutation),
            }
          : list
      ),
    });
  };

  const handleDeleteTodo = (todoId: string) => {
    if (!doc) return;

    updateDocument({
      ...doc,
      lists: doc.lists.map((list) =>
        list.id === activeListId
          ? {
              ...list,
              categories: deleteTodoItem(list.categories, todoId),
            }
          : list
      ),
    });
  };

  const handleAddTodoAfter = (
    categoryId: string,
    afterItemId: string,
    isNestedList = false,
    parentListId?: string
  ) => {
    const newTodo: TodoItemType = {
      id: generateUUID(),
      title: '',
      completed: false,
    };

    setFocusInputId(newTodo.id);

    if (isNestedList && parentListId) {
      handleUpdateTodo(parentListId, (item) => {
        const existingItems = item.listItems ?? [];
        const itemIndex = existingItems.findIndex((existingItem) => existingItem.id === afterItemId);
        const newItems = [...existingItems];
        newItems.splice(itemIndex + 1, 0, newTodo);
        return { listItems: newItems };
      });
      return;
    }

    handleUpdateCategory(categoryId, (category) => {
      const displayOrderedItems = [...category.items].reverse();
      const itemIndex = displayOrderedItems.findIndex((item) => item.id === afterItemId);
      const newItems = [...displayOrderedItems];
      newItems.splice(itemIndex + 1, 0, newTodo);
      return { items: newItems.reverse() };
    });
  };

  const renderTodoItem = (
    item: TodoItemType,
    hideChecked: boolean,
    showCheckboxes: boolean,
    sortCheckedToBottom = false,
    categoryId?: string,
    parentListId?: string
  ): ReactNode => (
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

  const renderCategory = (category: Category): ReactNode => (
    <CategoryComponent
      key={category.id}
      category={category}
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

  const toggleTabMenu = () => {
    if (!tabMenuOpen && tabOptionsRef.current) {
      const rect = tabOptionsRef.current.getBoundingClientRect();
      const menuWidth = 260;
      const left = Math.max(
        8,
        Math.min(rect.right - menuWidth, window.innerWidth - menuWidth - 8)
      );
      setTabMenuPos({ top: rect.bottom + 4, left });
    }
    setTabMenuOpen((open) => !open);
  };

  const handleReorderLists = (reordered: TodoList[]) => {
    if (!doc) return;
    updateDocument({ ...doc, lists: reordered });
  };

  const handleTabClick = (listId: string) => {
    setActiveListId(listId);
    if (!doc) return;
    updateDocument({ ...doc, activeListId: listId }, false);
  };

  const handleModalClose = () => {
    setModalConfig((currentConfig) => ({ ...currentConfig, isOpen: false }));
  };

  if (isLoading) {
    return (
      <div className="app-container">
        <div className="empty-state">Loading...</div>
      </div>
    );
  }

  const activeList = getActiveList();

  return (
    <div className="app-container">
      <nav className="tab-navigation">
        <div className="tab-list">
          {doc?.lists.map((list) => (
            <button
              key={list.id}
              className={`tab-item ${list.id === activeListId ? 'active' : ''}`}
              onClick={() => handleTabClick(list.id)}
              type="button"
            >
              {list.title}
            </button>
          ))}

          <button className="tab-item add-tab" onClick={handleAddList} type="button">
            <Icon name="ri-add-line" /> New List
          </button>

          <div className="tab-options">
            <button
              ref={tabOptionsRef}
              className="tab-options-button"
              onClick={toggleTabMenu}
              type="button"
              title="View and reorder lists"
            >
              <Icon name="ri-list-settings-line" />
            </button>

            {tabMenuOpen && doc && (
              <div
                className="tab-options-menu"
                style={{ top: tabMenuPos.top, left: tabMenuPos.left }}
              >
                <div className="tab-options-menu-header">Drag to reorder lists</div>
                {doc.lists.length === 0 ? (
                  <div className="tab-options-empty">No lists yet.</div>
                ) : (
                  <ReorderList
                    items={doc.lists}
                    getItemId={(list) => list.id}
                    renderItem={(list) => (
                      <>
                        <Icon name="ri-draggable" className="tab-options-drag reorder-handle" />
                        <span className="tab-options-title">{list.title}</span>
                        {list.id === activeListId && (
                          <Icon name="ri-check-line" className="tab-options-active" />
                        )}
                        <button
                          className="icon-btn primary-icon-btn"
                          onClick={() => handleEditList(list.id)}
                          onPointerDown={(e) => e.stopPropagation()}
                          type="button"
                          title="Rename list"
                        >
                          <Icon name="ri-pencil-line" />
                        </button>
                        <button
                          className="icon-btn delete-icon-btn"
                          onClick={() => handleDeleteList(list.id)}
                          onPointerDown={(e) => e.stopPropagation()}
                          type="button"
                          title="Delete list"
                        >
                          <Icon name="ri-delete-bin-line" />
                        </button>
                      </>
                    )}
                    onReorder={handleReorderLists}
                    className="tab-options-list"
                    itemClassName="tab-options-item"
                  />
                )}
              </div>
            )}
          </div>
        </div>
      </nav>

      <main className="app-body">
        {activeList ? (
          <div className="list-wrapper">
            <div className="list-header-row">
              <button className="btn btn-outline" onClick={handleAddRootCategory} type="button">
                <Icon name="ri-add-line" /> New Category
              </button>
            </div>

            {activeList.categories.length === 0 ? (
              <div className="empty-state">Click "New Category" to get started.</div>
            ) : (
              <div className="categories-grid">
                {activeList.categories.map((category) => renderCategory(category))}
              </div>
            )}
          </div>
        ) : (
          <div className="empty-state">
            Create a list to get started.
          </div>
        )}
      </main>

      <footer className="app-footer">
        <SyncPanel document={doc} isDbAvailable={isDbAvailable} />
      </footer>

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
};

export default function App() {
  const document = useDocument();

  return (
    <DriveSyncProvider document={document}>
      <AppContent document={document} />
    </DriveSyncProvider>
  );
}
