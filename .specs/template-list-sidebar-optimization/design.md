# Design Document - Template List Sidebar Optimization

## Overview

This document outlines the design for optimizing the document template sidebar by adding a status filter and clarifying the "New" button text. This enhancement aims to improve the usability of the template management interface.

## Architecture

The changes will be localized to the `DocumentTemplatesPage` component (`frontend/app/document-templates/page.tsx`). No backend changes are required as the API already supports status filtering.

## Components and Interfaces

### 1. DocumentTemplatesPage (`frontend/app/document-templates/page.tsx`)

**State Changes:**
- Add `statusFilter` state: `const [statusFilter, setStatusFilter] = useState<"all" | "draft" | "published">("all")`

**UI Changes:**
- **Sidebar Header:**
  - Integrate `Select` component from `@/components/ui/select`.
  - Layout adjustment to accommodate the filter dropdown alongside the "New Template" button.
  - "New" button text changed to "New Template" (新建 -> 新建模板).

**Interaction Flow:**
1. User selects a status from the dropdown.
2. `statusFilter` state updates.
3. `useEffect` triggers `loadTemplates`.
4. `loadTemplates` calls API with the selected status (if not "all").
5. List refreshes with filtered results.

### 2. API Integration

**Existing API:**
- `templateApi.getTemplates(params?: { status?: string, ... })`

**Usage Update:**
- When `statusFilter` is "all", call `getTemplates({})`.
- When `statusFilter` is "draft", call `getTemplates({ status: "draft" })`.
- When `statusFilter` is "published", call `getTemplates({ status: "published" })`.

## Data Models

No new data models. Utilizing existing `DocumentTemplate` interface.

## Error Handling

- Standard error handling in `loadTemplates` (toast notifications) remains unchanged.
- If the filter returns no results, the existing "No templates" empty state will be displayed.

## Testing Strategy

1. **Manual Verification:**
   - Verify default view shows all templates.
   - Verify "Draft" filter shows only draft templates.
   - Verify "Published" filter shows only published templates.
   - Verify "New Template" button text is correct.
   - Verify creating a new template still works and refreshes the list correctly (reset filter or keep current?). *Decision: Keep current filter, but if the new template doesn't match the filter, it might disappear. Better UX: Switching to "All" or the specific status of the new template (Draft) on creation could be considered, but for now, we will stick to simple filtering. If a user creates a template (default Draft) while in "Published" view, they might not see it immediately. We should probably switch to "All" or "Draft" upon creation.* -> *Refinement: When a new template is created (default Draft), we should switch `statusFilter` to 'all' or 'draft' to ensure visibility.*

2. **Regression Testing:**
   - Ensure selecting/editing/deleting templates works as before.

