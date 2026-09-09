import React, { useCallback, useEffect, useRef, useState } from 'react';

export interface ReorderListProps<T> {
  items: T[];
  getItemId: (item: T) => string;
  /** Renders the content of a single row. `isDragging` is true while the row is being dragged. */
  renderItem: (item: T, isDragging: boolean) => React.ReactNode;
  /** Called with the newly ordered items whenever the user drops a row. */
  onReorder: (items: T[]) => void;
  className?: string;
  itemClassName?: string;
}

interface PendingDrag {
  pointerId: number;
  startX: number;
  startY: number;
  id: string;
}

const DRAG_THRESHOLD = 6;

/**
 * Reusable drag-to-reorder list.
 *
 * Supports both mouse and touch ("press and hold") dragging. While the user
 * holds and moves an item, a floating clone follows the pointer and a primary
 * colored drop indicator is shown above/below the hovered row once the pointer
 * crosses 50% of that row's height, signalling where the item will be dropped.
 *
 * Dragging only starts when the pointer goes down on the drag handle — the
 * element rendered inside a row that carries the `reorder-handle` class. The
 * rest of the row keeps its normal tap/scroll behaviour, so the list can be
 * placed inside a scroll view.
 *
 * Usage:
 * <ReorderList
 *   items={items}
 *   getItemId={(item) => item.id}
 *   renderItem={(item) => (
 *     <>
 *       <Icon name="ri-draggable" className="reorder-handle" />
 *       <span>{item.title}</span>
 *     </>
 *   )}
 *   onReorder={(nextItems) => setItems(nextItems)}
 * />
 */
export function ReorderList<T>({
  items,
  getItemId,
  renderItem,
  onReorder,
  className = '',
  itemClassName = '',
}: ReorderListProps<T>) {
  const listRef = useRef<HTMLDivElement>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [pointerPos, setPointerPos] = useState({ x: 0, y: 0 });
  const [dropIndex, setDropIndex] = useState<number | null>(null);

  // Refs keep the global pointer handlers reading the latest values without
  // re-registering listeners on every render.
  const dragRef = useRef<{
    pending: PendingDrag | null;
    active: boolean;
    draggedId: string | null;
  }>({ pending: null, active: false, draggedId: null });
  const dropIndexRef = useRef<number | null>(null);
  const itemsRef = useRef(items);
  const getItemIdRef = useRef(getItemId);
  const onReorderRef = useRef(onReorder);

  // Keep refs in sync with the latest props after each render so the global
  // pointer handlers always read current values without re-registering.
  useEffect(() => {
    itemsRef.current = items;
    getItemIdRef.current = getItemId;
    onReorderRef.current = onReorder;
  });

  const computeDropIndex = useCallback((excludedId: string, clientY: number) => {
    const listEl = listRef.current;
    if (!listEl) return 0;

    // Only the non-dragged rows are considered for the insertion point, since
    // the dragged row is removed from its slot while dragging.
    const children = Array.from(listEl.children).filter((child) => {
      const el = child as HTMLElement;
      return el.dataset.reorderId !== excludedId;
    });

    let insert = 0;
    for (const child of children) {
      const rect = (child as HTMLElement).getBoundingClientRect();
      if (clientY > rect.top + rect.height / 2) {
        insert += 1;
      } else {
        break;
      }
    }
    return insert;
  }, []);

  const handlePointerDown = useCallback((id: string, e: React.PointerEvent) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    // Only start a drag when the pointer goes down on the drag handle. The rest
    // of the row keeps normal tap/scroll behaviour, so a list can live inside a
    // scroll view and still be reordered via its handle.
    if (!(e.target as HTMLElement).closest('.reorder-handle')) return;
    dragRef.current.pending = {
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      id,
    };
  }, []);

  const handlePointerMove = useCallback((e: PointerEvent) => {
    const state = dragRef.current;
    if (!state.pending || e.pointerId !== state.pending.pointerId) return;

    setPointerPos({ x: e.clientX, y: e.clientY });

    // Only begin dragging once the pointer has moved past the threshold, so a
    // plain tap/click still works normally.
    if (!state.active) {
      if (
        Math.hypot(
          e.clientX - state.pending.startX,
          e.clientY - state.pending.startY
        ) < DRAG_THRESHOLD
      ) {
        return;
      }
      state.active = true;
      state.draggedId = state.pending.id;
      setDragActive(true);
      setDraggingId(state.pending.id);
    }

    const insert = computeDropIndex(state.draggedId as string, e.clientY);
    dropIndexRef.current = insert;
    setDropIndex(insert);
  }, [computeDropIndex]);

  const handlePointerUp = useCallback((e: PointerEvent) => {
    const state = dragRef.current;
    if (!state.pending || e.pointerId !== state.pending.pointerId) return;

    if (state.active) {
      const draggedId = state.draggedId as string;
      const currentItems = itemsRef.current;
      const moved = currentItems.find((it) => getItemIdRef.current(it) === draggedId);
      const rest = currentItems.filter((it) => getItemIdRef.current(it) !== draggedId);

      if (moved) {
        const target = Math.min(dropIndexRef.current ?? rest.length, rest.length);
        onReorderRef.current([...rest.slice(0, target), moved, ...rest.slice(target)]);
      }
    }

    state.pending = null;
    state.active = false;
    state.draggedId = null;
    dropIndexRef.current = null;
    setDragActive(false);
    setDraggingId(null);
    setDropIndex(null);
  }, []);

  useEffect(() => {
    const onMove = (e: PointerEvent) => handlePointerMove(e);
    const onUp = (e: PointerEvent) => handlePointerUp(e);
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
    };
  }, [handlePointerMove, handlePointerUp]);

  const draggedItem = draggingId ? items.find((it) => getItemId(it) === draggingId) : null;
  const displayItems = draggingId
    ? items.filter((it) => getItemId(it) !== draggingId)
    : items;

  return (
    <div ref={listRef} className={`reorder-list ${className}`}>
      {items.map((item) => {
        const id = getItemId(item);
        const isDragging = id === draggingId;
        const displayIndex = displayItems.findIndex((d) => getItemId(d) === id);
        const showBefore = dragActive && displayIndex === dropIndex;
        const showAfter =
          dragActive && displayIndex === (dropIndex ?? Number.MAX_SAFE_INTEGER) - 1;

        return (
          <div
            key={id}
            data-reorder-id={id}
            className={`reorder-item ${itemClassName} ${isDragging ? 'is-dragging' : ''}`}
            onPointerDown={(e) => handlePointerDown(id, e)}
          >
            {showBefore && <span className="reorder-drop-indicator indicator-top" />}
            {renderItem(item, isDragging)}
            {showAfter && <span className="reorder-drop-indicator indicator-bottom" />}
          </div>
        );
      })}

      {dragActive && draggedItem && (
        <div
          className="reorder-ghost"
          style={{ left: pointerPos.x, top: pointerPos.y }}
        >
          {renderItem(draggedItem, true)}
        </div>
      )}
    </div>
  );
}
