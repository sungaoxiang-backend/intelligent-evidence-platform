# Change: Add Document Layout Controls

## Why
The document editor currently has fixed page margins and spacing settings, causing documents to spread across multiple pages unnecessarily due to excessive white space. Users need the ability to adjust page margins and line spacing to optimize document layout and reduce wasted space, similar to functionality available in WPS and other document editors.

## What Changes
- Add page margin adjustment controls (top, bottom, left, right) with preset options
- Add line spacing adjustment controls with preset values (1.0, 1.15, 1.5, 2.0)
- Implement dropdown UI components similar to WPS toolbar buttons
- Update the Tiptap editor extensions to support dynamic margin and spacing changes
- Ensure proper persistence of layout settings in document templates
- Maintain A4 page standards while allowing flexible margin adjustments

## Impact
- **Affected specs**: document-management (modify existing editor requirements)
- **Affected code**:
  - `frontend/components/template-editor/document-editor.tsx` - Main editor UI
  - `frontend/components/template-editor/extensions.ts` - Tiptap extensions
  - `frontend/components/template-editor/document-preview.tsx` - Preview component
  - CSS layout files for A4 page styling
- **User impact**: Users can optimize document layout to reduce page count and improve readability