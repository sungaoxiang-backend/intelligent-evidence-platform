# Design: Export Consistency Improvements

## Problem Analysis
The discrepancy arises from three main sources:
1.  **CSS Context Divergence:** The editor runs in a full App context (Tailwind, global resets, extra stylesheets). The export runs in a minimal HTML shell with only `templateBaseStyles` injected. Missing utility classes or specific browser resets cause layout shifts.
2.  **Rendering Engine Differences:** `renderHTML` in Tiptap extensions is often a simplified version of the React NodeView. For complex nodes like Images (with rotation/resizing) and Tables (with col resizing), the raw HTML output often lacks the wrapper divs that provide the layout logic in the editor.
3.  **Layout Box vs. Visual Box:** Rotated images in raw HTML via `transform: rotate()` do not affect the flow of surrounding text (the box occupies the original space). In the editor, a wrapper likely reserves the correct amount of space.

## Solution Design

### 1. Shared Styling Module
Create `frontend/components/documents/shared/styles.ts` to export a `generateDocumentStyles()` function.
- This function returns a CSS string containing all necessary styles: standard HTML element styles, Tiptap-specific classes (e.g., `ProseMirror-*`), and custom utility classes used within the document content.
- **Frontend:** Inject this into the Editor's shadow DOM or scope it to `.template-doc`.
- **Backend/Export:** Inject this string into the `<style>` tag of the HTML sent to Playwright.

### 2. Intelligent Image Rendering
Modify `ImageExtension` in `frontend/components/documents/extensions/image-extension.ts`.
- **Current:** `renderHTML` returns `img` attributes with `style="transform..."`.
- **New:** `renderHTML` should return a wrapper `span/div` with `display: inline-block` (or block) that contains the `img`.
- **Layout Correction:** If possible in pure CSS/HTML, the wrapper should have dimensions that accommodate the rotated image to prevent overlap. Alternatively, ensure the export HTML supports `overflow: visible` (which `page.tsx` currently attempts) but within a context that doesn't clip.

### 3. Table Consistency
- Verify `TableWithAttrs` logic for `renderHTML`. Ensure `colgroup` and `col` widths use valid CSS units (e.g., convert `twips` to `px` consistently).
- The `page.tsx` logic currently re-calculates some widths. We should move this logic into the Tiptap Extension's `renderHTML` so `getHTML()` returns the "ready-to-print" version directly, reducing the need for post-processing in `page.tsx`.

### 4. Component Refactoring
- Refactor `page.tsx`'s `handleDownload` to use the new `generateDocumentStyles`.
- Remove ad-hoc CSS injections in `page.tsx` to prevent future drift.

## Architectural Impact
- **Low Risk:** Changes are primarily in styling and Tiptap serialization.
- **Backward Compatibility:** Existing documents will render with the new CSS. This might settle some layout shifts, generally improving them.
