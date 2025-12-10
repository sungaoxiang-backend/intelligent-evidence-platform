## ADDED Requirements

### Requirement: Template System Limitations Documentation
The system SHALL document all assumptions and limitations in the template preview, editing, form preview, and form editing functionality.

#### Scenario: Document template type assumptions
- **WHEN** analyzing the template system
- **THEN** the system SHALL document that templates MUST be one of three types: 要素式 (element-style), 陈述式 (narrative-style), or 混合式 (mixed-style)
- **AND** the system SHALL document that rendering logic is hardcoded based on template type
- **AND** the system SHALL document that templates without a recognized type cannot be properly processed

#### Scenario: Document table structure assumptions
- **WHEN** analyzing the template system
- **THEN** the system SHALL document that all interactive template content MUST be within tables
- **AND** the system SHALL document that table rows MUST support checkbox controls (element-style uses absolute positioning overlay, narrative-style creates checkbox cells)
- **AND** the system SHALL document that table cells MUST be organized in a specific way (containing paragraphs, placeholders, etc.)

#### Scenario: Document cell processing assumptions
- **WHEN** analyzing the template system
- **THEN** the system SHALL document that element-style templates only use ReplicableCell for cells with multiple placeholders
- **AND** the system SHALL document that narrative-style templates use NarrativeTableCell for ALL cells regardless of placeholder presence
- **AND** the system SHALL document that mixed-style templates use simple rendering without special features

#### Scenario: Document placeholder organization assumptions
- **WHEN** analyzing the template system
- **THEN** the system SHALL document that placeholders MUST be embedded within cell paragraphs
- **AND** the system SHALL document that placeholders MUST be extractable via the extractPlaceholdersFromCell function
- **AND** the system SHALL document that placeholders outside of table cells cannot be properly processed

#### Scenario: Document preview and editing limitations
- **WHEN** analyzing the template system
- **THEN** the system SHALL document that template preview is completely dependent on template type detection
- **AND** the system SHALL document that form preview assumes all interactions are within table cells
- **AND** the system SHALL document that template editing assumes templates must contain tables
- **AND** the system SHALL document that form editing features (add/delete rows, paragraph replication) are completely determined by template type

#### Scenario: Document export limitations
- **WHEN** analyzing the template system
- **THEN** the system SHALL document that export logic is completely determined by template type
- **AND** the system SHALL document that element-style templates preserve placeholder components and option states during export
- **AND** the system SHALL document that narrative-style templates convert placeholders to plain text during export
- **AND** the system SHALL document that mixed-style templates directly replace placeholders while preserving table structure

#### Scenario: Document data structure assumptions
- **WHEN** analyzing the template system
- **THEN** the system SHALL document that cells MUST have stable cellIds in the format: table-{tableIndex}-row-{rowIndex}-cell-{cellIndex}
- **AND** the system SHALL document that form data storage depends on stable cell identifiers
- **AND** the system SHALL document that dynamic table structures cannot be properly handled

#### Scenario: Document unsupported scenarios
- **WHEN** analyzing the template system
- **THEN** the system SHALL document that pure paragraph templates (without tables) cannot be processed
- **AND** the system SHALL document that custom template types (not element-style/narrative-style/mixed-style) cannot be processed
- **AND** the system SHALL document that placeholders outside table cells cannot be processed
- **AND** the system SHALL document that non-standard cell structures cannot be processed
- **AND** the system SHALL document that dynamic table structures cannot be processed
- **AND** the system SHALL document that custom interaction patterns cannot be processed

