## ADDED Requirements

### Requirement: Table Row Export Control

The system SHALL support controlling whether individual table rows are included in exported documents through a boolean flag at the row level.

#### Scenario: User toggles row export in statement-style template
- **WHEN** a user is generating a document from a statement-style template
- **AND** the template contains a table with multiple rows
- **THEN** each table row SHALL display a checkbox control labeled "包含在导出中" (Include in export)
- **AND** when the user unchecks a row's checkbox
- **THEN** that row SHALL be excluded from the exported DOCX document
- **AND** when the user checks a row's checkbox
- **THEN** that row SHALL be included in the exported DOCX document

#### Scenario: User toggles row export in element-style template
- **WHEN** a user is generating a document from an element-style template
- **AND** the template contains a table with multiple rows
- **THEN** each table row SHALL display a checkbox control labeled "包含在导出中" (Include in export)
- **AND** when the user unchecks a row's checkbox
- **THEN** that row SHALL be excluded from the exported DOCX document
- **AND** when the user checks a row's checkbox
- **THEN** that row SHALL be included in the exported DOCX document

#### Scenario: Default export behavior for existing templates
- **WHEN** a template does not have the `exportEnabled` attribute on any table rows
- **THEN** all table rows SHALL be included in the exported document by default
- **AND** the system SHALL treat missing `exportEnabled` attributes as `true`

#### Scenario: Multiple rows with different export states
- **WHEN** a table contains multiple rows
- **AND** some rows have `exportEnabled: true` and others have `exportEnabled: false`
- **THEN** only rows with `exportEnabled: true` SHALL be included in the exported document
- **AND** rows with `exportEnabled: false` SHALL be completely excluded from the exported document

### Requirement: ProseMirror JSON Structure for Export Control

The system SHALL store the export control state in the ProseMirror JSON structure using an `exportEnabled` attribute on `tableRow` nodes.

#### Scenario: Table row with export control attribute
- **WHEN** a table row node exists in ProseMirror JSON
- **THEN** it MAY have an `attrs.exportEnabled` property of type boolean
- **AND** if `exportEnabled` is not present, it SHALL default to `true`
- **AND** if `exportEnabled` is `false`, the row SHALL be excluded from export
- **AND** if `exportEnabled` is `true`, the row SHALL be included in export

### Requirement: Export Filtering Logic

The system SHALL filter out table rows with `exportEnabled: false` during the document export process.

#### Scenario: Export filters disabled rows
- **WHEN** the system processes a ProseMirror JSON document for export
- **AND** the document contains a table with rows
- **THEN** the system SHALL check each `tableRow` node's `exportEnabled` attribute
- **AND** if `exportEnabled` is `false` or missing (defaults to `true`)
- **THEN** the system SHALL include the row in the export
- **AND** if `exportEnabled` is explicitly `false`
- **THEN** the system SHALL exclude the row from the export
- **AND** the filtered JSON SHALL maintain correct table structure (no broken tables)

#### Scenario: Export filtering preserves table structure
- **WHEN** a table has multiple rows with some rows disabled
- **THEN** the exported document SHALL contain a valid table structure
- **AND** the table SHALL only contain rows with `exportEnabled: true`
- **AND** the table structure SHALL remain intact (no empty tables if all rows are disabled)

