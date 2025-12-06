# Design: Document Management with Placeholders and Status

## Context

The document management module currently stores documents as ProseMirror JSON content without any status management or placeholder metadata. Users need to:
1. Create templates that can be in draft or published state
2. Define placeholders with metadata (type, options) for form generation
3. Use published templates to generate filled documents

## Goals

- Enable draft/published workflow for document templates
- Store placeholder metadata alongside document content
- Provide interactive placeholder editing in edit mode
- Generate form-based document creation from published templates
- Export filled documents as PDF

## Non-Goals

- Multi-version template management (single version per template)
- Placeholder validation rules (basic type checking only)
- Template sharing/collaboration features

## Decisions

### 1. Status Field Storage
- **Decision**: Add `status` field as String enum ("draft", "published") with index
- **Rationale**: Simple, queryable, allows future status expansion
- **Alternatives considered**: Boolean `is_published` (less flexible)

### 2. Placeholder Metadata Storage
- **Decision**: Store placeholder metadata as JSON field `placeholder_metadata` with structure:
  ```json
  {
    "placeholder_name": {
      "name": "placeholder_name",
      "type": "text" | "radio" | "checkbox",
      "options": ["option1", "option2"]  // for radio/checkbox
    }
  }
  ```
- **Rationale**: Flexible, allows per-placeholder configuration, easy to query
- **Alternatives considered**: Separate table (more complex, overkill for current needs)

### 3. Placeholder Extraction
- **Decision**: Extract placeholders from ProseMirror JSON during create/update by scanning for `{{placeholder}}` patterns in text nodes
- **Rationale**: Automatic initialization, consistent with template_editor approach
- **Alternatives considered**: Manual placeholder definition (more user effort)

### 4. Edit Mode Placeholder Rendering
- **Decision**: Render placeholders as non-editable chips in edit mode, click opens dialog to edit metadata
- **Rationale**: Prevents accidental editing, clear visual distinction, familiar UX pattern
- **Alternatives considered**: Inline editing (confusing, error-prone)

### 5. Form Generation Mode
- **Decision**: Separate "generate" mode that renders placeholders as form components based on metadata
- **Rationale**: Clear separation of concerns, better UX for form filling
- **Alternatives considered**: Inline form editing in preview (confusing, mixed concerns)

## Architecture

### Data Model Changes
```
Document:
  + status: str (draft/published, indexed)
  + placeholder_metadata: JSON (dict of placeholder configs)
```

### API Changes
```
GET /documents?status=draft|published|all
PUT /documents/{id}/status (update status only)
GET /documents/{id}/placeholders (get placeholder metadata)
PUT /documents/{id}/placeholders (update placeholder metadata)
POST /documents/{id}/generate (create filled document from form data)
```

### Frontend Changes
- Add status filter dropdown in document list
- Add status badge/indicator in document cards
- Add placeholder chip rendering in edit mode
- Add placeholder metadata dialog
- Add "Generate" button for published templates
- Add form-filling view with dynamic form components
- Add "Download Document" button in form mode

## Risks / Trade-offs

### Risk: Placeholder Metadata Sync
- **Risk**: Placeholder metadata may become out of sync with document content
- **Mitigation**: Re-extract placeholders on content update, merge with existing metadata

### Risk: Performance with Large Placeholder Counts
- **Risk**: JSON field queries may be slow with many placeholders
- **Mitigation**: Current scale is small (<100 placeholders per doc), monitor and optimize if needed

### Trade-off: Placeholder Metadata vs Separate Table
- **Chosen**: JSON field for simplicity
- **Trade-off**: Less queryable, but sufficient for current needs

## Migration Plan

1. Add database migration for `status` and `placeholder_metadata` fields
2. Set default status="draft" for existing documents
3. Initialize empty placeholder_metadata for existing documents
4. Frontend: Add status filter (defaults to all)
5. Frontend: Add placeholder chip rendering (gracefully handles missing metadata)
6. Frontend: Add form generation mode

## Open Questions

- Should we allow editing placeholder metadata in draft mode only?
- Should we validate placeholder metadata before allowing publish?
- Should we support placeholder inheritance from template_editor module?

