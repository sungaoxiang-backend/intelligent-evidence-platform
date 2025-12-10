## ADDED Requirements

### Requirement: Mixed-Style Template Type
The system SHALL support a "混合式" (mixed-style) template type for complex table templates that require simple rendering without advanced features.

#### Scenario: Create template with mixed-style type
- **WHEN** a user creates a new template
- **THEN** the system SHALL provide a "混合式" option in the template type selector
- **AND** the user SHALL be able to select "混合式" as the template category

#### Scenario: Update template to mixed-style type
- **WHEN** a user updates an existing template
- **THEN** the system SHALL allow the user to change the template category to "混合式"
- **AND** the system SHALL save the updated category

#### Scenario: Identify mixed-style template
- **WHEN** a template has category set to "混合式"
- **THEN** the system SHALL identify it as a mixed-style template
- **AND** the system SHALL apply simple rendering logic without checkbox and paragraph replication features

### Requirement: Simple Rendering for Mixed-Style Templates
The system SHALL render mixed-style templates using simple rendering logic that preserves the original ProseMirror JSON structure.

#### Scenario: Form preview for mixed-style template
- **WHEN** rendering a form preview for a mixed-style template
- **THEN** the system SHALL NOT display checkbox controls for table rows
- **AND** the system SHALL NOT use ReplicableCell or NarrativeCell components
- **AND** the system SHALL use default TableCell rendering
- **AND** the system SHALL preserve the original table structure

#### Scenario: Document export for mixed-style template
- **WHEN** exporting a document from a mixed-style template
- **THEN** the system SHALL NOT perform table row replication or conversion
- **AND** the system SHALL directly replace placeholders while preserving table structure
- **AND** the system SHALL maintain the original ProseMirror JSON structure

## MODIFIED Requirements

### Requirement: Template Type-Based Rendering Logic
The system SHALL apply different rendering logic based on template type (element-style, narrative-style, or mixed-style).

#### Scenario: Element-style template rendering
- **WHEN** rendering an element-style template (category is "要素式")
- **THEN** the system SHALL apply element-style rendering logic with checkbox controls and ReplicableCell components
- **AND** the system SHALL support table row replication when needed

#### Scenario: Narrative-style template rendering
- **WHEN** rendering a narrative-style template (category is "陈述式")
- **THEN** the system SHALL apply narrative-style rendering logic with NarrativeCell components
- **AND** the system SHALL support paragraph replication when needed

#### Scenario: Mixed-style template rendering
- **WHEN** rendering a mixed-style template (category is "混合式")
- **THEN** the system SHALL apply simple rendering logic without advanced features
- **AND** the system SHALL preserve the original ProseMirror JSON structure
- **AND** the system SHALL NOT apply element-style or narrative-style specific features

