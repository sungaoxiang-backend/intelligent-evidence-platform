# Requirements Document - Sidebar UI Unification

## Introduction

Unify the UI structure of the Document Template List (in Preview mode) and the Placeholder List (in Edit mode) by introducing shared layout components. This ensures visual consistency and easier maintenance.

## Requirements

### Requirement 1: Unified Sidebar Layout Component

**User Story:** As a developer, I want a shared `SidebarLayout` component so that both the template list and placeholder list share the same structure, padding, and scrolling behavior.

**Acceptance Criteria:**
1. Create a `SidebarLayout` component.
2. It must support a header section with:
   - Total count badge.
   - Custom left-side controls (e.g., filters).
   - Custom right-side actions (e.g., "New" button, Refresh).
3. It must support an optional sub-header (e.g., for Search inputs).
4. It must include a `ScrollArea` for the main content.
5. It must support a customizable Empty State.

### Requirement 2: Unified Sidebar List Item Component

**User Story:** As a user, I want list items (templates and placeholders) to look consistent in terms of spacing, typography, and interaction states.

**Acceptance Criteria:**
1. Create a `SidebarItem` component.
2. It must support a standard grid layout (70% content / 30% actions).
3. It must handle selection state (visual styling).
4. It must provide slots for:
   - Title (editable or static).
   - Subtitle/Description.
   - Metadata (tags/badges).
   - Action buttons (hover visible or always visible).
   - Status badge (bottom right).

### Requirement 3: Refactor Existing Lists

**User Story:** As a user, I want to see the unified design applied to both the Template List and Placeholder List.

**Acceptance Criteria:**
1. Refactor `DocumentTemplatesPage` to use `SidebarLayout` and `SidebarItem` for the template list.
2. Refactor `PlaceholderList` to use `SidebarLayout` and `SidebarItem`.
3. Ensure functional parity is maintained (filtering, selection, editing, deleting).

