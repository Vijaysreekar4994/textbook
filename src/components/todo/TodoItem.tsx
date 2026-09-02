import React, { useEffect, useRef } from 'react';
import { type TodoItemType } from '../../types';
import { Icon } from '../Icon';
import { countCompletedItems } from '../../utils';
import type { TodoItemProps } from '../types/todoItem.types';

export const TodoItem: React.FC<TodoItemProps> = ({
  item,
  hideChecked,
  showCheckboxes,
  sortCheckedToBottom,
  categoryId,
  parentListId,
  focusInputId,
  setFocusInputId,
  onUpdateTodo,
  onDeleteTodo,
  onAddTodoAfter,
  onSetModalConfig,
  setOpenDropdownId,
  renderTodoItem,
}) => {
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement | null>(null);

  const hasChildren = item.listItems && item.listItems.length > 0;
  const childrenAllCompleted = hasChildren && item.listItems!.every((child) => child.completed);
  const deletionDisabled = item.isList && hasChildren && !childrenAllCompleted;

  useEffect(() => {
    if (focusInputId === item.id && inputRef.current) {
      inputRef.current.focus();
      setFocusInputId(null);
    }
  }, [focusInputId, item.id, setFocusInputId]);

  const handleCheckboxChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onUpdateTodo(item.id, () => ({ completed: e.target.checked }));
  };

  const handleListToggle = () => {
    onUpdateTodo(item.id, (t) => ({ collapsed: !t.collapsed }));
  };

  const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onUpdateTodo(item.id, () => ({ title: e.target.value }));
  };

  const handleTitleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (!item.title.trim()) {
        onDeleteTodo(item.id);
      } else {
        const isNestedList = !!parentListId;
        onAddTodoAfter(categoryId || '', item.id, isNestedList, parentListId);
      }
    }
  };

  const handleTitleBlur = () => {
    if (!item.title.trim()) {
      onDeleteTodo(item.id);
    }
  };

  const handleNotesChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    onUpdateTodo(item.id, () => ({ text: e.target.value, title: e.target.value }));
  };

  const handleNotesBlur = () => {
    if (!item.text?.trim() && !item.title?.trim()) {
      onDeleteTodo(item.id);
    }
  };

  const handleDeleteClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    setOpenDropdownId(null);
    onSetModalConfig({
      isOpen: true,
      type: 'danger',
      title: 'Delete Task',
      message: `Is it okay to delete "${item.title || 'this'}" item?`,
      onConfirm: () => {
        onDeleteTodo(item.id);
      },
      confirmLabel: 'Delete',
      cancelLabel: 'Cancel',
    });
  };

  const handleChildRender = (child: TodoItemType) => {
    return renderTodoItem(child, hideChecked, showCheckboxes, sortCheckedToBottom, categoryId, item.id);
  };

  if (hideChecked && item.completed && !item.isList) {
    return null;
  }

  return (
    <div key={item.id} className="todo-item">
      <div className="todo-row">
        {showCheckboxes && !item.isList && !item.isText && (
          <input
            type="checkbox"
            className="todo-checkbox"
            checked={item.completed}
            onChange={handleCheckboxChange}
          />
        )}

        {item.isList ? (
          <div className="todo-title-list-wrapper">
            <span
              className="list-fold-toggle"
              onClick={handleListToggle}
            >
              <Icon name={item.collapsed ? "ri-arrow-right-s-line" : "ri-arrow-down-s-line"} className="fold-icon" />
              <span className={`todo-title-text ${item.completed ? 'completed' : ''}`}>
                {item.title || 'Untitled List'}
              </span>
              {(() => {
                const counts = countCompletedItems(item);
                return (
                  <span className="list-items-count">
                    ({counts.completed}/{counts.total} <Icon name="ri-check-line" className="checkmark" />)
                  </span>
                );
              })()}
            </span>
          </div>
        ) : showCheckboxes ? (
          <input
            id={`input-${item.id}`}
            ref={inputRef as React.RefObject<HTMLInputElement>}
            type="text"
            className={`todo-title-input ${item.completed ? 'completed' : ''}`}
            value={item.title}
            placeholder="Task name..."
            onChange={handleTitleChange}
            onKeyDown={handleTitleKeyDown}
            onBlur={handleTitleBlur}
          />
        ) : (
          <textarea
            id={`input-${item.id}`}
            ref={inputRef as React.RefObject<HTMLTextAreaElement>}
            className="todo-notes"
            value={item.text || item.title}
            placeholder="Enter notes..."
            onChange={handleNotesChange}
            onBlur={handleNotesBlur}
          />
        )}

        {!item.isList && (
          <button
            className="delete-icon-btn"
            onClick={handleDeleteClick}
            disabled={deletionDisabled}
          >
            <Icon name="ri-delete-bin-line" />
          </button>
        )}
      </div>

      {item.isList && item.listItems && (
        <div className="nested-list">
          {!item.collapsed && (
            <>
              {item.listItems.map(handleChildRender)}
            </>
          )}
        </div>
      )}
    </div>
  );
};
