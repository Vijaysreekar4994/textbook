# Cline Project Instructions - Textbook PWA

## Project Overview
A portable checklist/todo PWA (Progressive Web App) built with React 19, TypeScript, and SCSS. Features nested categories, multiple lists with tab navigation, IndexedDB local storage, and Google Drive sync.

## Tech Stack
- **Framework**: React 19.2.8 (functional components, hooks)
- **Language**: TypeScript 6.0
- **Styling**: SCSS (no CSS-in-JS, no Tailwind)
- **Build Tool**: Vite 8.2.2
- **Storage**: IndexedDB (local) + Google Drive API (sync)
- **PWA**: vite-plugin-pwa with service worker

## Feature Patterns

### Sort Checked Items to Bottom
When enabled for a category, checked items automatically move to the bottom of the list while unchecked items stay at the top.

**Implementation:**
- Add `sortCheckedToBottom: boolean` to `Category` interface in `src/types.ts`
- Create `sortTodoItems(items, sortCheckedToBottom)` helper function in `App.tsx`
- Apply sorting in `renderCategory` when mapping items
- Pass `sortCheckedToBottom` parameter to `renderTodoItem` for nested list sorting
- Add toggle in category dropdown menu
- Include migration function `migrateDocument()` for backward compatibility

**Key Files:**
- `src/types.ts` - Add property to Category interface
- `src/App.tsx` - Add sort function, update rendering, add toggle UI
- Migration: Use `?? false` default for existing data

**Handler Naming:**
- Use `handleUpdateCategory(catId, (c) => ({ sortCheckedToBottom: !c.sortCheckedToBottom }))` pattern
- Follows existing `handle<Event>` naming convention

**Testing:**
- Check items move to bottom immediately on toggle
- Unchecking moves item back to correct position
- Works with nested sub-items (depth 1-3)
- Persists after page refresh (IndexedDB)
- Works alongside "Hide checked items" feature
- Build passes: `npm run build`

### Enter Key to Add New Task
Press Enter while editing a task in checkbox mode to quickly create a new task below and continue typing.

**Implementation:**
- Add `handleAddTodoAfter()` function in `App.tsx` to insert new item after current one
- Add `onKeyDown` handler to checkbox mode inputs
- Press Enter: creates new task at same depth level, auto-focuses new input
- If current task is empty: deletes it without creating new one (clean UX)
- Works for both category items and nested list items
- Pass `categoryId` and `parentListId` to `renderTodoItem()` for proper context

**Key Files:**
- `src/App.tsx` - Add `handleAddTodoAfter()`, update `renderTodoItem()` signature, add `onKeyDown` handler

**Handler Pattern:**
```typescript
const handleAddTodoAfter = (
  categoryId: string,
  afterItemId: string,
  depth: number,
  isNestedList: boolean = false,
  parentListId?: string
) => {
  // Creates new blank task after the specified item
  // Sets focusInputIdRef.current to auto-focus new input
  // Inserts at correct position maintaining order
};
```

**Testing:**
- Press Enter after typing task → new blank task created below, focused
- Press Enter on empty task → task deleted, no new task created
- Works at all nesting depths (1-3)
- Works in nested lists (sub-items)
- Maintains task order and depth level
- Build passes: `npm run build`

## Icon System (Remix Icon)

### Setup
Remix Icon is installed via npm and loaded via CDN in `index.html` for optimal performance.

**Installation:**
```bash
npm install remixicon --save
```

**Files:**
- `index.html` - CDN link in `<head>` section
- `src/main.tsx` - Import CSS: `import 'remixicon/fonts/remixicon.css';`
- `src/components/Icon.tsx` - Reusable Icon component wrapper

### Usage Pattern

**Basic Usage:**
```tsx
import { Icon } from './components/Icon';

<Icon name="ri-checkbox-line" />
```

**With Props:**
```tsx
<Icon name="ri-arrow-right-s-line" size={20} />
<Icon name="ri-delete-bin-line" className="custom-class" />
<Icon name="ri-check-circle-fill" color="#22c55e" />
<Icon name="ri-plug-line" onClick={handleClick} />
```

**Available Props:**
- `name` (required): Icon name from Remix Icon library (e.g., `ri-home-line`, `ri-star-fill`)
- `size` (optional): Number or string (e.g., `20`, `"1.5rem"`)
- `color` (optional): CSS color value
- `className` (optional): Additional CSS classes
- `style` (optional): Inline styles object
- `onClick` (optional): Click handler

**Icon Naming Convention:**
- Line icons: `ri-{name}-line` (outlined style)
- Fill icons: `ri-{name}-fill` (solid style)
- Browse all icons: https://remixicon.com/

**Replaced Icons in App:**
| Old Emoji | New Icon | Usage |
|-----------|----------|-------|
| 🔌 | `ri-plug-line` | Connect Google Drive button |
| 🟢 | `ri-checkbox-circle-fill` | Auto-sync enabled indicator |
| 🚪 | `ri-logout-box-line` | Sign Out button |
| ⚠️ | `ri-alert-line` | Database unavailable alert |
| ▶ | `ri-arrow-right-s-line` | Collapsed fold indicator |
| ▼ | `ri-arrow-down-s-line` | Expanded fold indicator |
| ✓ | `ri-check-line` | Completed items counter |
| ⋮ | `ri-more-2-fill` | Dropdown menu trigger |
| ✚ | `ri-add-line` | Add new item button |

**Benefits:**
- Consistent visual style across the app
- Scalable vector graphics (SVG-based fonts)
- Easy to customize size, color, and styling
- Better accessibility with `aria-hidden="true"`
- Professional appearance
- Easy to find and replace icons via Remix Icon website