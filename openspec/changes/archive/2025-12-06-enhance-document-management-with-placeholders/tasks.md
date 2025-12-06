# Implementation Tasks

## 1. Backend: Database Schema Updates
- [x] 1.1 Create Alembic migration to add `status` field (String, default="draft", indexed)
- [x] 1.2 Create Alembic migration to add `placeholder_metadata` field (JSON, nullable)
- [x] 1.3 Update Document model with new fields
- [x] 1.4 Set default status="draft" for existing records via migration

## 2. Backend: Placeholder Extraction Service
- [x] 2.1 Create placeholder extraction utility function to scan ProseMirror JSON for `{{placeholder}}` patterns
- [x] 2.2 Integrate placeholder extraction into document create service
- [x] 2.3 Integrate placeholder extraction into document update service (merge with existing metadata)
- [ ] 2.4 Add unit tests for placeholder extraction

## 3. Backend: API Schema Updates
- [x] 3.1 Add `status` field to DocumentResponse schema
- [x] 3.2 Add `placeholder_metadata` field to DocumentResponse schema
- [x] 3.3 Add `status` filter parameter to list_documents endpoint
- [x] 3.4 Add status update endpoint (PUT /documents/{id}/status)
- [x] 3.5 Add placeholder metadata update endpoint (PUT /documents/{id}/placeholders)

## 4. Backend: Document Generation Service
- [x] 4.1 Create service function to generate filled document from template and form data
- [x] 4.2 Replace placeholders in ProseMirror JSON with form values
- [x] 4.3 Add document generation endpoint (POST /documents/{id}/generate)
- [ ] 4.4 Add unit tests for document generation

## 5. Frontend: API Client Updates
- [x] 5.1 Add `status` and `placeholder_metadata` to Document interface
- [x] 5.2 Add status parameter to getDocuments API call
- [x] 5.3 Add updateDocumentStatus API call
- [x] 5.4 Add updatePlaceholderMetadata API call
- [x] 5.5 Add generateDocument API call

## 6. Frontend: Status Management UI
- [x] 6.1 Add status filter dropdown to document list component
- [x] 6.2 Add status badge/indicator to document cards
- [x] 6.3 Add status update UI (dropdown or toggle in document detail view)
- [x] 6.4 Update document list to pass status filter to API

## 7. Frontend: Placeholder Chip Component
- [x] 7.1 Create PlaceholderChip component for edit mode rendering
- [x] 7.2 Create PlaceholderMetadataDialog component for editing placeholder metadata
- [x] 7.3 Integrate placeholder chip rendering into document editor
- [x] 7.4 Add click handler to open metadata dialog
- [x] 7.5 Add placeholder extraction on document create/update

## 8. Frontend: Form Generation Mode
- [x] 8.1 Add "Generate" button to published template preview
- [x] 8.2 Create DocumentFormGenerator component that renders form based on placeholder metadata
- [x] 8.3 Create form components for text, radio, and checkbox input types
- [x] 8.4 Add form-filling view mode
- [x] 8.5 Add "Download Document" button in form mode
- [x] 8.6 Implement form submission and document generation

## 9. Frontend: PDF Generation Integration
- [x] 9.1 Update PDF export to handle filled documents
- [x] 9.2 Ensure form values are properly rendered in generated HTML
- [x] 9.3 Test PDF generation with various placeholder types

## 10. Testing
- [ ] 10.1 Add backend unit tests for placeholder extraction
- [ ] 10.2 Add backend unit tests for document generation
- [ ] 10.3 Add frontend tests for placeholder chip component
- [ ] 10.4 Add frontend tests for form generation
- [ ] 10.5 Add integration tests for end-to-end document generation flow

