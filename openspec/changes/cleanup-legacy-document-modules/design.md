# Design: Legacy Cleanup Implementation

## Component Migration & Cleanup

### Frontend Refactoring
The new "Document Management" (`/documents`) and "Document Creation" (`/document-creation`) pages rely on `extensions.ts` and `utils.ts` located in `frontend/components/template-editor`. Before deleting `template-editor`, we must move these shared dependencies.

**Migration Plan:**
1.  Create `frontend/components/documents/shared/`.
2.  Move `frontend/components/template-editor/extensions.ts` -> `frontend/components/documents/shared/editor-extensions.ts`.
3.  Move `frontend/components/template-editor/utils.ts` -> `frontend/components/documents/shared/editor-utils.ts`.
4.  Update imports in:
    - `frontend/app/documents/page.tsx`
    - `frontend/app/document-creation/page.tsx`
    - `frontend/components/documents/document-editor.tsx` (and other components in `frontend/components/documents/`).

**Deletion Plan:**
Once migration is complete, the following directories will be deleted:
- `frontend/app/document-templates/`
- `frontend/app/document-generation/`
- `frontend/components/template-editor/` (Entirely)
- `frontend/components/document-generation/` (if exists and unused)
- `frontend/lib/template-api.ts`

### Backend Refactoring
The backend `app/api/v1.py` currently mounts both legacy and new routers.

**Router Cleanup:**
- Remove include for `documents_router` (from `app.documents`).
- Remove include for `documents_template_router`.
- Remove include for `template_editor_router`.
- Remove include for `document_generation_router`.
- **Keep** `documents_management_router` (Mounted at `/documents`, `/document-drafts`, `/document-creation`). Note: `documents_management_router` handles `/documents` endpoints, which were shadowed or shadowing the legacy `documents_router`. Since `documents_management_router` was included *first* in `v1.py`, it was already taking precedence.

**Module Deletion:**
- Delete `app/documents/`
- Delete `app/documents_template/`
- Delete `app/template_editor/`
- Delete `app/document_generation/`

### Database Cleanup
- Run `alembic revision --autogenerate -m "remove_legacy_document_tables"` to detect and drop tables defined in the deleted modules but not in `documents_management`.
- Verify that `documents_management` models (`Document`, `DocumentDraft`) are preserved.

## Verification
- Ensure `/documents` and `/document-creation` pages load and function correctly.
- Ensure API endpoints for `/api/v1/documents` and `/api/v1/document-drafts` function correctly.
