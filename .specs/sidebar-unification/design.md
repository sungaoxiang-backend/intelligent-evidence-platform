# Design Document - Sidebar UI Unification

## Overview

This document details the design for unified sidebar components to be used across the Document Template List and Placeholder List. The goal is to reduce code duplication and enforce UI consistency.

## Components and Interfaces

### 1. `SidebarLayout` Component

**Location:** `frontend/components/common/sidebar-layout.tsx`

**Props Interface:**

```typescript
interface SidebarLayoutProps {
  title?: React.ReactNode; // Left side of header (e.g., Badge count, Filter dropdown)
  actions?: React.ReactNode; // Right side of header (e.g., Add button, Refresh)
  subheader?: React.ReactNode; // Optional search bar area
  isLoading?: boolean;
  isEmpty?: boolean;
  emptyState?: React.ReactNode;
  className?: string;
  children: React.ReactNode; // The list items
}
```

**Structure:**
- Root: `Card` (full height)
- Header: `CardHeader` -> Flex container (justify-between) -> `title` | `actions`
  - If `subheader` exists, render it below the main header row within `CardHeader`.
- Content: `CardContent` (p-0) -> `ScrollArea` (h-[calc(100vh-200px)]) -> `children`
- Loading/Empty states handled inside `CardContent`.

### 2. `SidebarItem` Component

**Location:** `frontend/components/common/sidebar-item.tsx`

**Props Interface:**

```typescript
interface SidebarItemProps {
  id: string | number;
  selected?: boolean;
  onClick?: () => void;
  className?: string;
  
  // Content Slots
  title: React.ReactNode; // Can be string or editable input
  description?: React.ReactNode; // Subtitle
  meta?: React.ReactNode; // Tags, small text
  
  // Action Slots
  actions?: React.ReactNode; // Buttons (Pencil, Trash, etc.)
  status?: React.ReactNode; // Bottom-right badge
}
```

**Structure:**
- Root: `div` with hover/selected styles (border, bg-color, shadow).
- Layout: Grid `minmax(0, 0.7fr) minmax(112px, 0.3fr)` (Matches existing ratio).
- Left Col: Flex col -> Title, Description, Meta.
- Right Col: Flex col (items-end, justify-between) -> Actions (top), Status (bottom).

## Refactoring Plan

### 1. `DocumentTemplatesPage`
- Replace the manual `Card` construction with `<SidebarLayout>`.
- Pass the Filter Select and Badge to the `title` prop.
- Pass the "New Template" button to the `actions` prop.
- Replace `TemplateListItem` internal structure to wrap `SidebarItem` or use `SidebarItem` directly if logic permits. Since `TemplateListItem` has specific logic (renaming state, etc.), it will likely render `<SidebarItem>` and pass down the props.

### 2. `PlaceholderList`
- Replace manual `Card` with `<SidebarLayout>`.
- Pass Badge/Refresh to `title`.
- Pass "New" button to `actions`.
- Pass Search Input to `subheader`.
- Update `renderPlaceholderItem` to return `<SidebarItem>`.

## Styling Strategy
- Use existing Tailwind classes found in `page.tsx` and `placeholder-list.tsx` to ensure the "new" components look exactly like the "best" version of the current ones.
- Standardize heights, padding, and font sizes.

## Error Handling
- Components are presentational; error handling remains in parent containers.
- `SidebarLayout` handles `isLoading` visually.

## Testing
- Verify visual regression (should look cleaner but familiar).
- Verify interactions (clicks, hovers, edits) still function.

