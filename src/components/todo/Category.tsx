import React from 'react';
import { type Category as CategoryType, type TodoItemType } from '../../types';
import { Icon } from '../Icon';
import { countCategoryItems, hasAnyCompletedItems, uncheckAllItems, sortTodoItems } from '../../utils';

interface CategoryProps {
  category: CategoryType;
  onUpdateCategory: (categoryId: string, mutation: (cat: CategoryType) => Partial<CategoryType>) => void;
  onAddSubcategory: (category: CategoryType) => void;
  onDeleteCategory: (categoryId: string, title: string) => void;
  openDropdownId: string | null;
  setOpenDropdownId: (id: string | null) => void;
  setFocusInputId: (id: string | null) => void;
  renderTodoItem: (
    item: TodoItemType,
    hideChecked: boolean,
    showCheckboxes: boolean,
    sortCheckedToBottom: boolean,
    categoryId?: string,
    parentListId?: string
  ) => React.ReactNode;
  renderCategory: (category: CategoryType) => React.ReactNode;
}

export const Category: React.FC<CategoryProps> = ({
  category,
  onUpdateCategory,
  onAddSubcategory,
  onDeleteCategory,
  openDropdownId,
  setOpenDropdownId,
  setFocusInputId,
  renderTodoItem,
  renderCategory,
}) => {
  const counts = countCategoryItems(category);

  const handleCategoryTitleClick = () => {
    onUpdateCategory(category.id, (c) => ({ collapsed: !c.collapsed }));
  };

  const handleAddTaskClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    const newTodoId = crypto.randomUUID();
    onUpdateCategory(category.id, (c) => ({
      collapsed: false,
      items: [{
        id: newTodoId,
        title: '',
        completed: false,
        depth: category.depth,
      }, ...c.items],
    }));
    setFocusInputId(newTodoId);
  };

  const handleDropdownToggle = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    setOpenDropdownId(openDropdownId === category.id ? null : category.id);
  };

  const handleRenameClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    const newTitle = prompt('Rename category:', category.title);
    if (newTitle?.trim()) {
      onUpdateCategory(category.id, () => ({ title: newTitle.trim() }));
    }
    setOpenDropdownId(null);
  };

  const handleHideCheckedToggle = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    onUpdateCategory(category.id, (c) => ({ hideCheckedItems: !c.hideCheckedItems }));
    setOpenDropdownId(null);
  };

  const handleSortCheckedToggle = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    onUpdateCategory(category.id, (c) => ({ sortCheckedToBottom: !c.sortCheckedToBottom }));
    setOpenDropdownId(null);
  };

  const hasCheckedItems = category.showCheckboxes && hasAnyCompletedItems(category.items);

  const handleModeToggle = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    onUpdateCategory(category.id, (c) => ({ showCheckboxes: !c.showCheckboxes }));
    setOpenDropdownId(null);
  };

  const handleUncheckAllClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    onUpdateCategory(category.id, (c) => ({
      items: uncheckAllItems(c.items)
    }));
    setOpenDropdownId(null);
  };

  const handleAddSubcategoryClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    onAddSubcategory(category);
    setOpenDropdownId(null);
  };

  const handleDeleteCategoryClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    onDeleteCategory(category.id, category.title);
    setOpenDropdownId(null);
  };

  const handleTodoItemRender = (item: TodoItemType) => {
    return renderTodoItem(item, category.hideCheckedItems, category.showCheckboxes, category.sortCheckedToBottom, category.id);
  };

  const handleSubcategoryRender = (sub: CategoryType) => {
    return renderCategory(sub);
  };

  const sortedItems = sortTodoItems([...category.items].reverse(), category.sortCheckedToBottom);

  return (
    <div key={category.id} className={`category-card depth-${category.depth}`}>
      <div className="category-header">
        <div className="category-meta">
          <button className="category-header-title-button" onClick={handleCategoryTitleClick} type='button'>
            <Icon name={category.collapsed ? "ri-arrow-right-s-line" : "ri-arrow-down-s-line"} className="fold-icon" />
            <span className="category-title">{category.title}</span>
          </button>
          {counts.total > 0 && (
            <span className="category-count">
              ({counts.completed}/{counts.total} <Icon name="ri-check-line" className="checkmark" />)
            </span>
          )}
          <button className="btn btn-add-task" onClick={handleAddTaskClick} type='button'>
            <Icon name="ri-add-circle-fill" className="icon-primary" />
          </button>
        </div>

        <div className={`dropdown ${openDropdownId === category.id ? 'open' : ''}`}>
          <button
            className="dropdown-trigger"
            onClick={handleDropdownToggle}
            type='button'
          >
            <Icon name="ri-settings-5-line" />
          </button>
          <div className="dropdown-menu">
            <button onClick={handleRenameClick} type='button'>
              Rename
            </button>
            {category.showCheckboxes && (
              <button onClick={handleHideCheckedToggle} type='button'>
                <Icon name={category.hideCheckedItems ? "ri-checkbox-fill" : "ri-checkbox-blank-line"} />
                <span style={{ marginLeft: '8px' }}>Hide checked</span>
              </button>
            )}
            {category.showCheckboxes && (
              <button onClick={handleSortCheckedToggle} type='button'>
                <Icon name={category.sortCheckedToBottom ? "ri-checkbox-fill" : "ri-checkbox-blank-line"} />
                <span style={{ marginLeft: '8px' }}>Show checked at bottom</span>
              </button>
            )}
            <button onClick={handleModeToggle} disabled={hasCheckedItems} type='button'>
              {category.showCheckboxes ? 'Switch to NOTES mode' : 'Switch to TASK Mode'}<br />
              {hasCheckedItems && (
                <span className="mode-toggle-note">
                  Uncheck all to switch mode
                </span>
              )}
            </button>
            {category.showCheckboxes && hasCheckedItems && (
              <button onClick={handleUncheckAllClick} type='button'>
                Uncheck all items
              </button>
            )}
            <button disabled={category.depth >= 3} onClick={handleAddSubcategoryClick} type='button'>
              Add Subcategory
            </button>
            <button className="delete-action" onClick={handleDeleteCategoryClick} type='button'>
              Delete Category
            </button>
          </div>
        </div>
      </div>

      {!category.collapsed && (
        <div className="category-body">
          {sortedItems.map(handleTodoItemRender)}
          {category.subcategories.map(handleSubcategoryRender)}
        </div>
      )}
    </div>
  );
};
