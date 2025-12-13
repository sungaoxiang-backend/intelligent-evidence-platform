# Proposal: Improve Document Export Consistency

## Background
The current document generation system exhibits discrepancies between the "Document Creation" editor (WYSIWYG) and the exported PDF. Users have reported issues with:
- Text and paragraph formatting.
- Table positioning and styling.
- Image sizing and rotation.
- Layout shifts (e.g., page breaks).

The system uses Tiptap for editing and Playwright (headless Chromium) for PDF generation. The HTML used for export is generated via `editor.getHTML()`, which may not perfectly match the interactive DOM rendered by React NodeViews, nor does it share a guaranteed identical CSS context.

## Goal
Achieve near-pixel-perfect consistency between the Tiptap editor and the exported PDF.

## Changes
1.  **Unified CSS:** Refactor CSS generation to a shared module used by both the Editor (injected via `style` or `emotion`) and the Export logic (injected into the HTML string).
2.  **Enhanced Image Export:** Update `ImageExtension.renderHTML` to wrap images in a container that handles rotation and layout flow correctly in raw HTML, matching the behavior of the interactive NodeView.
3.  **Table Width Standardization:** Ensure table width and column width calculations (converting between pixels, twips, and percentages) are identical in both environments.
4.  **Font Consistency:** Explicitly define and embed/link fonts in the export HTML to match the editor's loaded fonts.

## Non-Goals
- Changing the underlying PDF engine (Playwright is sufficient if input HTML is correct).
- Complete refactoring of the Tiptap editor configuration beyond what is needed for consistency.
