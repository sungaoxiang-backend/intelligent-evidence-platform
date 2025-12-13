# Proposal: Cleanup Legacy Document Management Modules

## Background
The application currently contains two generations of "document management" systems:
1.  **Legacy System**: File-based or older database implementation.
    *   Frontend: `/document-templates`, `/document-generation`
    *   Backend: `app/documents`, `app/documents_template`, `app/template_editor`, `app/document_generation`
2.  **New System**: Database-backed ProseMirror implementation (Tiptap).
    *   Frontend: `/documents` (文书模板), `/document-creation` (文书制作)
    *   Backend: `app/documents_management` (Exposes `/documents`, `/document-drafts`, `/document-creation`)

## Objective
Remove all legacy code, retaining only the "New System". This includes deleting unused frontend pages, backend modules, and API routes, and consolidating shared utilities.

## Scope
- **Frontend**:
    - Remove `frontend/app/document-templates` (Legacy Templates Page).
    - Remove `frontend/app/document-generation` (Legacy Generation Page).
    - Remove `frontend/lib/template-api.ts` (Legacy API Client).
    - Refactor and Remove `frontend/components/template-editor`:
        - Move used files (`extensions.ts`, `utils.ts`) to `frontend/components/documents/shared/`.
        - Delete the `template-editor` directory.
    - Update `frontend/components/top-navigation.tsx`.
- **Backend**:
    - Remove `app/documents` (Legacy file-based generator).
    - Remove `app/documents_template` (Legacy module).
    - Remove `app/template_editor` (Legacy module).
    - Remove `app/document_generation` (Legacy module).
    - Update `app/api/v1.py` to remove legacy routers.
- **Database**:
    - Generate migration to drop tables associated with legacy modules (if any independent tables exist).
