# Tasks: Improve Document Export Consistency

- [ ] Refactor styles to `frontend/components/documents/shared/document-styles.ts` <!-- id: 0 -->
    - [ ] Move `templateBaseStyles` and other editor-specific CSS into this file.
    - [ ] Create a function `getExportStyles()` that returns the full CSS block.
- [ ] Update `ImageExtension.ts` to output robust HTML <!-- id: 1 -->
    - [ ] Modify `renderHTML` to handle rotation and sizing attributes correctly.
    - [ ] Ensure the output HTML structure mirrors the content flow seen in the editor.
- [ ] Update `TableWithAttrs` for consistent rendering <!-- id: 2 -->
    - [ ] Verify `col-width` output in `renderHTML` matches the editor's visual layout.
- [ ] Update `page.tsx` download logic <!-- id: 3 -->
    - [ ] Import and use `getExportStyles()`.
    - [ ] Remove duplicate/ad-hoc CSS strings.
    - [ ] Ensure `tempEditor` uses the exact same extensions as `DocumentEditor`.
- [ ] Verify PDF Output <!-- id: 4 -->
    - [ ] Test with a document containing: Text, Headings, Table, Rotated Image.
    - [ ] Compare visual appearance of Editor vs PDF.
