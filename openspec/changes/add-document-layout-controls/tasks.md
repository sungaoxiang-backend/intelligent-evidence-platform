## 1. Backend Infrastructure
- [x] 1.1 Update DocumentTemplate model to include page layout metadata
  - [x] Add `page_layout` JSON field to store margins and line spacing
  - [x] Create database migration script
  - [x] Update model serialization to include layout metadata
- [x] 1.2 Update API endpoints for layout persistence
  - [x] Modify template save endpoint to accept layout settings
  - [x] Update template retrieval endpoint to return layout settings
  - [x] Add validation for layout value ranges

## 2. Frontend UI Components
- [x] 2.1 Create PageMarginControl toolbar component
  - [x] Design dropdown button with preset options (窄边距、适中边距、正常边距、宽边距)
  - [x] Implement margin value conversion (mm to px)
  - [x] Add current selection display
  - [x] Integrate with existing toolbar styling
- [x] 2.2 Create LineSpacingControl toolbar component
  - [x] Design dropdown button with preset options (1.0, 1.15, 1.5, 1.75, 2.0)
  - [x] Add current selection display
  - [x] Integrate with existing toolbar styling
- [x] 2.3 Update DocumentEditor component
  - [x] Add PageMarginControl and LineSpacingControl to toolbar
  - [x] Layout controls near existing formatting buttons
  - [x] Ensure proper responsive design

## 3. CSS Layout System Updates
- [x] 3.1 Update A4 page layout CSS
  - [x] Convert fixed margins to CSS custom properties
  - [x] Define CSS variables for all margin directions
  - [x] Ensure print media queries respect dynamic margins
  - [x] Add smooth transitions for margin changes
- [x] 3.2 Update container and content area styling
  - [x] Adjust content width calculations based on margins
  - [x] Ensure pagination calculations update with margin changes
  - [x] Test layout with all preset combinations

## 4. Tiptap Extensions Enhancement
- [x] 4.1 Extend paragraph and heading node attributes
  - [x] Add lineSpacing attribute to existing extensions
  - [x] Update serialization to include line spacing data
  - [x] Ensure compatibility with existing content
- [x] 4.2 Create layout management extension
  - [x] Add commands for updating page margins
  - [x] Add commands for updating line spacing
  - [x] Integrate with editor transaction system
- [x] 4.3 Update document content serialization
  - [x] Include layout settings in saved document JSON
  - [x] Ensure backward compatibility with existing documents
  - [x] Handle missing layout defaults gracefully

## 5. State Management and Persistence
- [x] 5.1 Implement layout state management
  - [x] Create Redux/Context slice for layout settings
  - [x] Connect layout controls to state management
  - [x] Implement layout change handlers
- [x] 5.2 Update document save/load logic
  - [x] Include layout settings in save operations
  - [x] Load and apply layout settings on document open
  - [x] Handle layout defaults for new documents
- [x] 5.3 Implement real-time preview updates
  - [x] Connect layout changes to preview component
  - [x] Ensure immediate visual feedback
  - [x] Optimize performance for frequent updates

## 6. Document Preview Integration
- [x] 6.1 Update DocumentPreview component
  - [x] Apply saved layout settings to preview mode
  - [x] Ensure consistency between edit and preview modes
  - [x] Update PDF export to include layout settings
- [x] 6.2 Update PDF export functionality
  - [x] Include layout CSS in exported HTML
  - [x] Test PDF output with different layout combinations
  - **BACKEND**: Ensure PDF generation respects layout settings

## 7. Testing and Validation
- [x] 7.1 Unit tests for new components
  - [x] Test PageMarginControl component behavior
  - [x] Test LineSpacingControl component behavior
  - [x] Test layout state management
- [x] 7.2 Integration tests
  - [x] Test layout changes persist correctly
  - [x] Test preview reflects layout changes
  - [x] Test PDF export includes layout settings
- [x] 7.3 Visual regression tests
  - [x] Test all margin presets with various content
  - [x] Test all line spacing presets
  - [x] Test pagination accuracy with layout changes
- [x] 7.4 Browser compatibility testing
  - [x] Test layout controls in Chrome, Firefox, Safari, Edge
  - [x] Test print functionality across browsers
  - [x] Verify CSS custom property support

## 8. Performance Optimization
- [x] 8.1 Optimize layout change performance
  - [x] Implement debouncing for frequent layout changes
  - [x] Optimize CSS recalculation performance
  - [x] Minimize layout thrashing
- [x] 8.2 Optimize preview updates
  - [x] Batch layout updates to reduce reflows
  - [x] Implement efficient change detection
  - [x] Cache layout calculations where possible

## 9. Documentation and Cleanup
- [x] 9.1 Update component documentation
  - [x] Document new layout control components
  - [x] Update API documentation for layout endpoints
  - [x] Add usage examples for layout features
- [x] 9.2 Code cleanup and refactoring
  - [x] Remove any temporary code or debug statements
  - [x] Ensure consistent code style with existing codebase
  - [x] Optimize imports and remove unused dependencies