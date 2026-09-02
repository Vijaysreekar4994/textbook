import type { Category, TodoItemType } from '../types';

export const updateCategoriesRecursive = (
  categories: Category[],
  categoryId: string,
  mutation: (cat: Category) => Partial<Category>
): Category[] => {
  return categories.map((cat) => {
    if (cat.id === categoryId) {
      return { ...cat, ...mutation(cat) };
    }
    return {
      ...cat,
      subcategories: updateCategoriesRecursive(cat.subcategories, categoryId, mutation),
    };
  });
};

export const deleteCategoryRecursive = (categories: Category[], categoryId: string): Category[] => {
  return categories
    .filter((cat) => cat.id !== categoryId)
    .map((cat) => ({
      ...cat,
      subcategories: deleteCategoryRecursive(cat.subcategories, categoryId),
    }));
};

export const findCategoryById = (categories: Category[], categoryId: string): Category | null => {
  for (const cat of categories) {
    if (cat.id === categoryId) return cat;
    const found = findCategoryById(cat.subcategories, categoryId);
    if (found) return found;
  }
  return null;
};

export const addSubcategory = (categories: Category[], parentId: string, newSub: Category): Category[] => {
  return categories.map((cat) => {
    if (cat.id === parentId) {
      return { ...cat, subcategories: [...cat.subcategories, newSub] };
    }
    return { ...cat, subcategories: addSubcategory(cat.subcategories, parentId, newSub) };
  });
};

export const updateTodoItems = (
  categories: Category[],
  todoId: string,
  mutation: (item: TodoItemType) => Partial<TodoItemType>
): Category[] => {
  const updateItems = (items: TodoItemType[]): TodoItemType[] => {
    return items.map((item) => {
      if (item.id === todoId) return { ...item, ...mutation(item) };
      if (item.listItems) return { ...item, listItems: updateItems(item.listItems) };
      return item;
    });
  };
  return categories.map((cat) => ({
    ...cat,
    items: updateItems(cat.items),
    subcategories: updateTodoItems(cat.subcategories, todoId, mutation),
  }));
};

export const deleteTodoItem = (categories: Category[], todoId: string): Category[] => {
  const deleteItems = (items: TodoItemType[]): TodoItemType[] =>
    items.filter((i) => i.id !== todoId).map((i) => ({
      ...i,
      listItems: i.listItems ? deleteItems(i.listItems) : undefined,
    }));
  return categories.map((cat) => ({
    ...cat,
    items: deleteItems(cat.items),
    subcategories: deleteTodoItem(cat.subcategories, todoId),
  }));
};

export const sortTodoItems = (items: TodoItemType[], sortCheckedToBottom: boolean): TodoItemType[] => {
  if (!sortCheckedToBottom) return items;
  return [...items].sort((a, b) => (a.completed === b.completed ? 0 : a.completed ? 1 : -1));
};

export const countCompletedItems = (item: TodoItemType): { completed: number; total: number } => {
  if (!item.listItems || item.listItems.length === 0) {
    return { completed: 0, total: 0 };
  }
  let completed = 0;
  let total = 0;
  for (const child of item.listItems) {
    if (child.completed) completed++;
    total++;
    if (child.listItems && child.listItems.length > 0) {
      const nested = countCompletedItems(child);
      completed += nested.completed;
      total += nested.total;
    }
  }
  return { completed, total };
};

export const countCategoryItems = (category: Category): { completed: number; total: number } => {
  let completed = 0;
  let total = 0;
  for (const item of category.items) {
    if (!category.showCheckboxes) continue;
    if (item.isText) continue;
    if (item.completed) completed++;
    total++;
    if (item.isList) {
      const listCounts = countCompletedItems(item);
      completed += listCounts.completed;
      total += listCounts.total;
    }
  }
  category.subcategories.forEach((sub) => {
    const subCounts = countCategoryItems(sub);
    completed += subCounts.completed;
    total += subCounts.total;
  });
  return { completed, total };
};

export const uncheckAllItems = (items: TodoItemType[]): TodoItemType[] => {
  return items.map((item) => ({
    ...item,
    completed: false,
    listItems: item.listItems ? uncheckAllItems(item.listItems) : undefined,
  }));
};

export const hasAnyCompletedItems = (items: TodoItemType[]): boolean => {
  return items.some((item) => {
    if (item.completed) return true;
    if (item.listItems && hasAnyCompletedItems(item.listItems)) return true;
    return false;
  });
};

export const verifyAllChildrenCompleted = (item: TodoItemType): boolean => {
  if (!item.listItems || item.listItems.length === 0) {
    return true;
  }
  return item.listItems.every((child) => {
    if (child.isText) return true;
    if (!child.completed) return false;
    return verifyAllChildrenCompleted(child);
  });
};

export const migrateCategories = (categories: Category[]): Category[] => {
  return categories.map((cat) => ({
    ...cat,
    sortCheckedToBottom: cat.sortCheckedToBottom ?? false,
    subcategories: migrateCategories(cat.subcategories),
  }));
};
