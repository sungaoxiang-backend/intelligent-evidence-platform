# Tasks: Cleanup Legacy Modules

1. **Refactor Frontend Dependencies**
   - [x] Create directory `frontend/components/documents/shared`
   - [x] Move `extensions.ts` from `template-editor` to `frontend/components/documents/shared/editor-extensions.ts`
   - [x] Move `utils.ts` from `template-editor` to `frontend/components/documents/shared/editor-utils.ts`
   - [x] Update imports in `frontend/app/documents` and `frontend/app/document-creation` to point to new locations
   - [x] Verify frontend builds `npm run build` (optional check)

2. **Remove Legacy Frontend Code**
   - [x] Delete `frontend/app/document-templates` directory
   - [x] Delete `frontend/app/document-generation` directory
   - [x] Delete `frontend/components/template-editor` directory
   - [x] Delete `frontend/lib/template-api.ts`
   - [x] Update `frontend/components/top-navigation.tsx` to remove commented-out legacy links

3. **Cleanup Backend Routers**
   - [x] Edit `app/api/v1.py` to remove legacy router imports and `include_router` calls
   - [x] Verify server starts `python app/main.py` (optional check)

4. **Remove Legacy Backend Modules**
   - [x] Delete `app/documents` directory
   - [x] Delete `app/documents_template` directory
   - [x] Delete `app/template_editor` directory
   - [x] Delete `app/document_generation` directory

5. **Database Migration**
   - [x] Run `alembic revision --autogenerate -m "remove_legacy_modules"`
   - [x] Review generated migration script
   - [x] Apply migration `alembic upgrade head`

6. **Final Validation**
   - [x] Verify "文书模板" (/documents) page functions
   - [x] Verify "文书制作" (/document-creation) page functions
