import type { AppDocument, Category, TodoItemType, TodoList } from '../types';

const deepEqual = (left: unknown, right: unknown): boolean =>
  JSON.stringify(left) === JSON.stringify(right);

const parseTime = (value: string): number => {
  const timestamp = Date.parse(value);
  return Number.isNaN(timestamp) ? 0 : timestamp;
};

const chooseValue = <T>(
  base: T | undefined,
  local: T,
  remote: T,
  hasBase: boolean,
  preferLocal: boolean
): T => {
  if (deepEqual(local, remote)) return local;
  if (hasBase && deepEqual(local, base)) return remote;
  if (hasBase && deepEqual(remote, base)) return local;
  return preferLocal ? local : remote;
};

interface Identifiable {
  id: string;
}

type MergeEntity<T extends Identifiable> = (
  base: T | undefined,
  local: T,
  remote: T,
  hasBase: boolean,
  preferLocal: boolean
) => T;

const mergeOptionalEntity = <T extends Identifiable>(
  base: T | undefined,
  local: T | undefined,
  remote: T | undefined,
  hasBase: boolean,
  preferLocal: boolean,
  mergeEntity: MergeEntity<T>
): T | undefined => {
  if (!local && !remote) return undefined;
  if (!local) {
    if (!hasBase || !base) return remote;
    if (remote && !deepEqual(remote, base)) return remote;
    return undefined;
  }
  if (!remote) {
    if (!hasBase || !base) return local;
    if (!deepEqual(local, base)) return local;
    return undefined;
  }

  if (hasBase && base) {
    if (deepEqual(local, base)) return remote;
    if (deepEqual(remote, base)) return local;
  }

  return mergeEntity(base, local, remote, hasBase, preferLocal);
};

const mergeById = <T extends Identifiable>(
  baseItems: T[] | undefined,
  localItems: T[],
  remoteItems: T[],
  hasBase: boolean,
  preferLocal: boolean,
  mergeEntity: MergeEntity<T>
): T[] => {
  const baseMap = new Map((baseItems ?? []).map((item) => [item.id, item]));
  const localMap = new Map(localItems.map((item) => [item.id, item]));
  const remoteMap = new Map(remoteItems.map((item) => [item.id, item]));

  const preferredOrder = preferLocal ? localItems : remoteItems;
  const secondaryOrder = preferLocal ? remoteItems : localItems;
  const orderedIds = [
    ...preferredOrder.map((item) => item.id),
    ...secondaryOrder.map((item) => item.id),
    ...(baseItems ?? []).map((item) => item.id),
  ].filter((id, index, ids) => ids.indexOf(id) === index);

  return orderedIds.flatMap((id) => {
    const merged = mergeOptionalEntity(
      baseMap.get(id),
      localMap.get(id),
      remoteMap.get(id),
      hasBase,
      preferLocal,
      mergeEntity
    );

    return merged ? [merged] : [];
  });
};

const mergeTodoItem: MergeEntity<TodoItemType> = (
  base,
  local,
  remote,
  hasBase,
  preferLocal
) => ({
  id: local.id,
  title: chooseValue(base?.title, local.title, remote.title, hasBase, preferLocal),
  completed: chooseValue(base?.completed, local.completed, remote.completed, hasBase, preferLocal),
  isText: chooseValue(base?.isText, local.isText, remote.isText, hasBase, preferLocal),
  text: chooseValue(base?.text, local.text, remote.text, hasBase, preferLocal),
  isList: chooseValue(base?.isList, local.isList, remote.isList, hasBase, preferLocal),
  collapsed: chooseValue(base?.collapsed, local.collapsed, remote.collapsed, hasBase, preferLocal),
  listItems:
    local.listItems || remote.listItems || base?.listItems
      ? mergeById(
          base?.listItems,
          local.listItems ?? [],
          remote.listItems ?? [],
          hasBase,
          preferLocal,
          mergeTodoItem
        )
      : undefined,
});

const mergeCategory: MergeEntity<Category> = (
  base,
  local,
  remote,
  hasBase,
  preferLocal
) => ({
  id: local.id,
  title: chooseValue(base?.title, local.title, remote.title, hasBase, preferLocal),
  collapsed: chooseValue(base?.collapsed, local.collapsed, remote.collapsed, hasBase, preferLocal),
  hideCheckedItems: chooseValue(
    base?.hideCheckedItems,
    local.hideCheckedItems,
    remote.hideCheckedItems,
    hasBase,
    preferLocal
  ),
  showCheckboxes: chooseValue(
    base?.showCheckboxes,
    local.showCheckboxes,
    remote.showCheckboxes,
    hasBase,
    preferLocal
  ),
  sortCheckedToBottom: chooseValue(
    base?.sortCheckedToBottom,
    local.sortCheckedToBottom,
    remote.sortCheckedToBottom,
    hasBase,
    preferLocal
  ),
  depth: chooseValue(base?.depth, local.depth, remote.depth, hasBase, preferLocal),
  items: mergeById(base?.items, local.items, remote.items, hasBase, preferLocal, mergeTodoItem),
  subcategories: mergeById(
    base?.subcategories,
    local.subcategories,
    remote.subcategories,
    hasBase,
    preferLocal,
    mergeCategory
  ),
});

const mergeTodoList: MergeEntity<TodoList> = (
  base,
  local,
  remote,
  hasBase,
  preferLocal
) => ({
  id: local.id,
  title: chooseValue(base?.title, local.title, remote.title, hasBase, preferLocal),
  categories: mergeById(
    base?.categories,
    local.categories,
    remote.categories,
    hasBase,
    preferLocal,
    mergeCategory
  ),
});

export const mergeDocuments = (
  base: AppDocument | null,
  local: AppDocument,
  remote: AppDocument
): AppDocument => {
  const hasBase = base !== null;
  const preferLocal = parseTime(local.updatedAt) >= parseTime(remote.updatedAt);
  const lists = mergeById(base?.lists, local.lists, remote.lists, hasBase, preferLocal, mergeTodoList);

  const preferredActiveListId = chooseValue(
    base?.activeListId,
    local.activeListId,
    remote.activeListId,
    hasBase,
    preferLocal
  );
  const activeListId = lists.some((list) => list.id === preferredActiveListId)
    ? preferredActiveListId
    : lists[0]?.id ?? '';

  return {
    version: Math.max(local.version, remote.version, base?.version ?? 1),
    // Once a remote document exists, keep its identity while merging local content into it.
    documentId: remote.documentId || local.documentId,
    updatedAt: new Date().toISOString(),
    lists,
    activeListId,
    syncMetadata: {
      lastSyncedAt: local.syncMetadata.lastSyncedAt ?? remote.syncMetadata.lastSyncedAt,
      remoteRevision: local.syncMetadata.remoteRevision ?? remote.syncMetadata.remoteRevision,
      isDirty: true,
      documentVersion:
        Math.max(
          local.syncMetadata.documentVersion,
          remote.syncMetadata.documentVersion,
          base?.syncMetadata.documentVersion ?? 1
        ) + 1,
    },
  };
};

export const documentsHaveSameContent = (left: AppDocument, right: AppDocument): boolean => {
  const withoutSyncMetadata = (document: AppDocument) => ({
    version: document.version,
    documentId: document.documentId,
    lists: document.lists,
    activeListId: document.activeListId,
  });

  return deepEqual(withoutSyncMetadata(left), withoutSyncMetadata(right));
};
