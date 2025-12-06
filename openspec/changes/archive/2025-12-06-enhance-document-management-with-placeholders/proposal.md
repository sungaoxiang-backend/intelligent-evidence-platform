# Change: Enhance Document Management with Placeholders and Status

## Why

The current document management module lacks the ability to:
1. Manage document templates with draft/published status workflow
2. Store and manage placeholder metadata for interactive form generation
3. Provide a form-filling mode for published templates
4. Generate documents from filled forms

This enhancement will enable users to create reusable document templates with placeholders, publish them for use, and generate filled documents from form inputs.

## What Changes

- **ADDED**: Document status field (draft/published) with update capability
- **ADDED**: Status filter in document search (defaults to all statuses)
- **ADDED**: Placeholder metadata storage in document model
- **ADDED**: Automatic placeholder initialization from `{{placeholder}}` patterns during template creation
- **ADDED**: Placeholder chip rendering in edit mode with click-to-edit dialog
- **ADDED**: "Generate" button for published templates
- **ADDED**: Form-filling mode that renders placeholders as interactive form components
- **ADDED**: "Download Document" button in form-filling mode to generate PDF from filled form

## Impact

- **Affected specs**: `document-management`
- **Affected code**: 
  - `app/documents_management/models.py` - Add status and placeholder_metadata fields
  - `app/documents_management/schemas.py` - Add status and placeholder_metadata to schemas
  - `app/documents_management/services.py` - Add status filtering and placeholder extraction logic
  - `app/documents_management/routers.py` - Add status filter parameter and placeholder endpoints
  - `frontend/app/documents/page.tsx` - Add status filter UI and form-filling mode
  - `frontend/components/documents/` - Add placeholder chip components and form rendering
  - `frontend/lib/documents-api.ts` - Add status and placeholder-related API calls

