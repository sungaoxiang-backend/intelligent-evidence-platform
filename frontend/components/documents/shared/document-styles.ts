
// Constants for A4 page layout
export const A4_PAGE_WIDTH = 794 // A4 width 210mm = 794px (96 DPI)
export const A4_PAGE_HEIGHT = 1123 // A4 height 297mm = 1123px (96 DPI)
export const A4_PAGE_MARGIN = 96 // Standard margin 25.4mm = 96px (96 DPI)
export const A4_CONTENT_WIDTH = A4_PAGE_WIDTH - (A4_PAGE_MARGIN * 2) // Content area width

/**
 * Returns the base styles for the document editor and export.
 * This ensures consistency between the WYSIWYG editor and the generated PDF.
 */
export function getDocumentBaseStyles(): string {
  return `
  /* Page Layout CSS Variables */
  .template-doc-container {
    /* Default Page Layout Variables */
    --page-margin-top: ${A4_PAGE_MARGIN}px;
    --page-margin-bottom: ${A4_PAGE_MARGIN}px;
    --page-margin-left: ${A4_PAGE_MARGIN}px;
    --page-margin-right: ${A4_PAGE_MARGIN}px;
    --content-line-height: 1.5;

    width: ${A4_PAGE_WIDTH}px;
    min-height: ${A4_PAGE_HEIGHT}px;
    margin: 0 auto;
    background: white;
    box-shadow: 0 0 10px rgba(0, 0, 0, 0.1);
    padding: var(--page-margin-top) var(--page-margin-right) var(--page-margin-bottom) var(--page-margin-left);
    box-sizing: border-box;
    position: relative;
    pointer-events: auto;
    /* Do NOT allow page to scroll locally in Print Layout */
    overflow: visible;
    flex-shrink: 0;
    transition: padding 0.2s ease-in-out;
  }
  
  /* Paginated Editor Container */
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 16px 0;
    background-color: #f5f5f5;
    min-height: 100%;
    position: relative;
  }
  
  /* Paginated Content Wrapper */
  .paginated-content-wrapper {
    position: relative;
    background: transparent;
  }
  
  /* Ensure editor content is above page background */
  .paginated-content-wrapper .ProseMirror {
    position: relative;
    z-index: 2;
    background: transparent;
  }
  
  /* Page Background */
  .page-background {
    border-radius: 0;
  }
  
  /* Page Break Line */
  .page-break-line {
    z-index: 1;
  }
  
  /* Print Media Query */
  @media print {
    .paginated-content-wrapper {
      page-break-after: always;
    }
    
    .page-break-line {
      display: none;
    }
    
    .page-background {
      box-shadow: none;
    }
  }
  
  .template-doc {
    font-family: "SimSun", "宋体", serif;
    /* Remove default font size, allow inline styles (from textStyle mark) to take effect */
    /* If no inline style, browser defaults will be used */
    /* font-size: 14px; */
    line-height: var(--content-line-height);
    color: #0f172a;
    width: 100%;
    /* Use inherit to respect container padding */
    max-width: none;
    margin: 0;
    position: relative;
    min-height: 100%;
    transition: line-height 0.2s ease-in-out;
  }

  /* Unify paragraph and heading line-heights */
  .template-doc p {
    line-height: var(--content-line-height) !important;
    margin: 0.5em 0 !important;
    transition: line-height 0.2s ease-in-out;
  }
  
  /* Heading Styles - Larger than default to match common standards */
  .template-doc h1 {
    font-size: 22pt !important;
    font-weight: bold !important;
    line-height: 1.5 !important;
    margin: 0.5em 0 !important;
  }
  
  .template-doc h2 {
    font-size: 18pt !important;
    font-weight: bold !important;
    line-height: 1.5 !important;
    margin: 0.5em 0 !important;
  }
  
  .template-doc h3 {
    font-size: 16pt !important;
    font-weight: bold !important;
    line-height: 1.5 !important;
    margin: 0.5em 0 !important;
  }
  
  .template-doc h4,
  .template-doc h5,
  .template-doc h6 {
    font-size: 14pt !important;
    font-weight: bold !important;
    line-height: 1.5 !important;
    margin: 0.5em 0 !important;
  }
  
  /* Editor Interactivity */
  .template-doc [contenteditable="true"],
  .template-doc [contenteditable="true"] * {
    cursor: text;
  }
  
  .template-doc [contenteditable="true"]:focus {
    outline: none;
  }
  
  /* ProseMirror Specifics */
  .template-doc .ProseMirror {
    outline: none;
    cursor: text;
    min-height: 200px;
  }
  
  .template-doc .ProseMirror:focus {
    outline: none;
  }
  
  /* Placeholder Chip */
  .placeholder-chip {
    display: inline-flex;
    align-items: center;
    background-color: #e2e8f0;
    border: 1px solid #cbd5e1;
    border-radius: 4px;
    padding: 2px 6px;
    margin: 0 2px;
    font-size: 0.9em;
    color: #475569;
    cursor: pointer;
    user-select: none;
    vertical-align: middle;
    transition: all 0.2s;
  }
  
  .placeholder-chip:hover {
    background-color: #cbd5e1;
    border-color: #94a3b8;
  }
  
  .placeholder-chip.selected {
    background-color: #bfdbfe;
    border-color: #3b82f6;
    color: #1e40af;
  }
  
  /* Table Styles */
  .template-doc table {
    border-collapse: collapse;
    margin: 0;
    overflow: hidden;
    table-layout: fixed;
    width: 100%;
  }
  
  .template-doc td,
  .template-doc th {
    min-width: 1em;
    border: 1px solid #000;
    padding: 3px 5px;
    vertical-align: top;
    box-sizing: border-box;
    position: relative;
  }
  
  .template-doc th {
    font-weight: bold;
    text-align: left;
    background-color: #f1f5f9;
  }
  
  .template-doc .selectedCell:after {
    z-index: 2;
    position: absolute;
    content: "";
    left: 0; 
    right: 0; 
    top: 0; 
    bottom: 0;
    background: rgba(200, 200, 255, 0.4);
    pointer-events: none;
  }
  
  .template-doc .column-resize-handle {
    position: absolute;
    right: -2px;
    top: 0;
    bottom: -2px;
    width: 4px;
    background-color: #adf;
    pointer-events: none;
  }
  
  .template-doc p {
    margin: 0;
  }
  
  .tableWrapper {
    overflow-x: auto;
  }
  
  /* Image Styles from Tiptap default */
  .template-doc img {
    max-width: 100%;
    height: auto;
    
    /* Image selected state */
    &.ProseMirror-selectednode {
      outline: 3px solid #68CEF8;
    }
  }

  /* Specific fix for rotated images in export and view */
  .image-wrapper {
    display: inline-block;
    position: relative;
    line-height: 0;
  }
  `
}
