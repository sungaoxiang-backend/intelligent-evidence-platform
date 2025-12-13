# Proposal: Enhanced Document Layout & Pagination

## Background
The current document editor displays content as a single continuous A4-width scrolling container. This deviates from standard word processing interfaces (like Word or WPS) where content is distributed across discrete pages. Users have reported:
1.  The continuous scrolling behavior feels "weird" for a document editor.
2.  Lack of visual page boundaries makes it hard to gauge document length.
3.  Missing page numbers (visual and functional).

## Goal
Implement a "Print Layout" view in the document editor that visually simulates physical pages, identical to the final PDF output.

## Changes
1.  **Client-Side Pagination**: Implement logic to measure content height and visually split the editor content into multiple A4-sized containers (pages).
    *   *Note*: True DOM splitting is complex in ProseMirror/Tiptap. We will explore "visual" pagination (using decorations or background guides) vs "physical" pagination (multi-editor or complex coordination). We will prioritized a robust visual simulation first.
2.  **Page Numbers**: Add dynamic page numbering to the footer of each visual page.
3.  **Visual Polish**: Ensure the "page gap" style mimics standard document software (gray background, shadow per page).

## Risks & Considerations
-   **Complexity**: Accurately measuring text height in the browser to determine page breaks is non-trivial and performance-sensitive.
-   **Editing UX**: Crossing page boundaries (e.g., selection, typing) must be seamless.

## Non-Goals
-   Implementing "Sections" with different layouts (portrait/landscape mix) in version 1.
