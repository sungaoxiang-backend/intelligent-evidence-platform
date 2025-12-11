## Context
The current document editor uses fixed A4 page layout with hardcoded margins (96px = 25.4mm) and default line spacing (1.5). Users report that content often spreads across multiple pages due to excessive white space, requiring manual optimization. The request is to add WPS-style layout controls for page margins and line spacing.

## Goals / Non-Goals
**Goals**:
- Provide intuitive dropdown controls for page margin adjustment
- Provide line spacing controls with common preset values
- Maintain document consistency and A4 standard compliance
- Ensure layout changes persist with document templates
- Provide real-time preview of layout changes

**Non-Goals**:
- Custom paper size support (beyond current A4 focus)
- Advanced typographic controls (kerning, tracking)
- Page orientation changes (portrait/landscape)
- Section-specific margins within a single document

## Decisions

### 1. UI Component Design
**Decision**: Implement dropdown buttons in the editor toolbar, similar to WPS interface
- **Why**: Familiar user experience for Chinese users accustomed to WPS
- **Components**: Two new toolbar buttons with dropdown menus
- **Location**: In the existing editor toolbar near formatting controls

### 2. Page Margin Implementation
**Decision**: Extend the existing CSS-based A4 layout with dynamic margin CSS variables
- **Why**: Minimal disruption to current pagination system
- **Approach**: CSS custom properties updated via JavaScript
- **Presets**:
  - Normal: 25.4mm (current default)
  - Narrow: 12.7mm (half default)
  - Moderate: 19.05mm (75% of default)
  - Wide: 38.1mm (150% of default)
  - Custom: User-defined values

### 3. Line Spacing Implementation
**Decision**: Extend existing Tiptap line height attributes
- **Why**: Leverages existing ProseMirror infrastructure
- **Approach**: Update paragraph and heading node attributes
- **Presets**: 1.0, 1.15, 1.5 (default), 1.75, 2.0

### 4. Data Persistence
**Decision**: Store layout settings as part of document template metadata
- **Why**: Maintains consistency with existing document structure
- **Storage**: JSON fields in DocumentTemplate model
- **Format**:
  ```json
  {
    "pageLayout": {
      "margins": { "top": 25.4, "bottom": 25.4, "left": 25.4, "right": 25.4 },
      "lineSpacing": 1.5
    }
  }
  ```

## Alternatives Considered

### 1. Modal Dialog Approach
- **Pros**: More space for options, better for complex settings
- **Cons**: Disrupts editing flow, requires more clicks
- **Rejected**: Dropdown approach is more efficient for common adjustments

### 2. Slider Controls
- **Pros**: Precise control over values
- **Cons**: More complex UI, harder to implement well
- **Rejected**: Preset values cover 95% of use cases

### 3. CSS Grid Layout Rewrite
- **Pros**: More flexible overall layout system
- **Cons**: Major architectural change, high risk
- **Rejected**: Too disruptive for this feature scope

## Risks / Trade-offs

### 1. Pagination Accuracy
- **Risk**: Dynamic margins may break page break calculations
- **Mitigation**: Test pagination thoroughly with all preset combinations
- **Fallback**: Maintain current pagination system as baseline

### 2. Print Fidelity
- **Risk**: Screen layout may not match printed output
- **Mitigation**: Ensure CSS print media queries respect dynamic margins
- **Testing**: Verify print preview matches screen layout

### 3. Browser Compatibility
- **Risk**: CSS custom properties may have limited support in older browsers
- **Mitigation**: Provide fallback CSS for unsupported browsers
- **Scope**: Focus on modern browsers (Chrome, Firefox, Safari, Edge)

### 4. Performance Impact
- **Risk**: Frequent layout recalculation may affect editor performance
- **Mitigation**: Debounce margin/spacing changes, batch updates
- **Testing**: Performance testing with large documents

## Migration Plan

### Phase 1: Infrastructure
1. Update DocumentTemplate model to include layout metadata
2. Create migration script for existing templates
3. Implement backend API changes

### Phase 2: Frontend Components
1. Create new toolbar button components
2. Extend Tiptap extensions for layout support
3. Update CSS for dynamic margins

### Phase 3: Integration
1. Integrate controls into document editor
2. Implement persistence logic
3. Update preview component

### Phase 4: Testing & Polish
1. Comprehensive testing of all preset combinations
2. Print layout verification
3. Performance optimization
4. Documentation updates

## Open Questions
- Should custom margin values be restricted to specific ranges?
- Do we need undo/redo support specifically for layout changes?
- Should layout presets be user-configurable or system-defined?
- How to handle layout conflicts between imported DOCX files and our presets?