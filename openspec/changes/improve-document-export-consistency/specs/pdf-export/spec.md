# PDF Export Consistency

## MODIFIED Requirements

### Requirement: Image Rendering Fidelity
The PDF export engine MUST accurately render images including their rotation, scaling, and position as displayed in the editor.

#### Scenario: Rotated Images
- **Given** a document with an image rotated by 90 degrees
- **When** the document is exported to PDF
- **Then** the image should appear rotated by 90 degrees in the PDF
- **And** the image should not be clipped by the page or container boundaries (unless it falls outside the printable area)
- **And** the surrounding text should flow around the image's rotated bounding box (if text wrap is supported) or the image should occupy its reserved space without overlapping text.

#### Scenario: Image Sizing
- **Given** a document with an image resized to specific dimensions
- **When** the document is exported to PDF
- **Then** the image in the PDF should match the dimensions set in the editor.

### Requirement: Table Layout Consistency
The PDF export engine MUST respect the specific column widths and table layout properties defined in the editor, ensuring 1:1 correspondence.

#### Scenario: Column Widths
- **Given** a table with custom column widths
- **When** the document is exported to PDF
- **Then** the column widths in the PDF should exactly match the widths in the editor.

### Requirement: Text and Style Consistency
The PDF export engine MUST use the exact same CSS definitions for typography and spacing as the editor to prevent layout shifts.

#### Scenario: Text Styling
- **Given** text with specific font, size, and paragraph spacing
- **When** the document is exported to PDF
- **Then** the text in the PDF should have identical font, size, and spacing to the editor view.
