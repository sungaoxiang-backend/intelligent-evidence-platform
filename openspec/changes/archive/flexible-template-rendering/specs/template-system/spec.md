## ADDED Requirements

### Requirement: Template Render Configuration System
The system SHALL support configurable rendering logic for templates instead of hardcoded type-based rendering.

#### Scenario: Load template render configuration
- **WHEN** a template is loaded for preview or editing
- **THEN** the system SHALL load the template's render configuration if available
- **AND** the system SHALL merge the template configuration with default configuration
- **AND** the system SHALL use the merged configuration to determine rendering behavior

#### Scenario: Default configuration for existing templates
- **WHEN** a template does not have a render configuration
- **THEN** the system SHALL use default configuration that maintains existing behavior
- **AND** the system SHALL automatically generate configuration based on template type if possible

#### Scenario: Cell renderer selection
- **WHEN** rendering a table cell
- **THEN** the system SHALL evaluate cell renderer matchers in configuration order
- **AND** the system SHALL use the first matching renderer configuration
- **AND** the system SHALL fall back to default renderer if no matcher matches

### Requirement: Enhanced Placeholder Extraction
The system SHALL extract placeholders from all supported node types, not just table cells.

#### Scenario: Extract placeholders from paragraphs
- **WHEN** extracting placeholders from a template
- **THEN** the system SHALL extract placeholders from paragraph nodes
- **AND** the system SHALL include these placeholders in the placeholder list

#### Scenario: Extract placeholders from headings
- **WHEN** extracting placeholders from a template
- **THEN** the system SHALL extract placeholders from heading nodes
- **AND** the system SHALL include these placeholders in the placeholder list

#### Scenario: Extract placeholders from lists
- **WHEN** extracting placeholders from a template
- **THEN** the system SHALL extract placeholders from list nodes
- **AND** the system SHALL include these placeholders in the placeholder list

#### Scenario: Extract placeholders from table cells
- **WHEN** extracting placeholders from a template
- **THEN** the system SHALL continue to extract placeholders from table cells
- **AND** the system SHALL support placeholders in merged cells (colspan/rowspan)

### Requirement: Conditional Rendering
The system SHALL support conditional display/hide of template sections based on form data.

#### Scenario: Show section based on field value
- **WHEN** rendering a template with conditional rules
- **AND** a conditional rule specifies showing a section when a field equals a value
- **AND** the form data matches the condition
- **THEN** the system SHALL display the target section
- **AND** the system SHALL hide the section when the condition is not met

#### Scenario: Hide section based on field value
- **WHEN** rendering a template with conditional rules
- **AND** a conditional rule specifies hiding a section when a field equals a value
- **AND** the form data matches the condition
- **THEN** the system SHALL hide the target section
- **AND** the system SHALL show the section when the condition is not met

#### Scenario: Complex conditional logic
- **WHEN** rendering a template with conditional rules
- **AND** a conditional rule uses AND/OR logic with multiple conditions
- **THEN** the system SHALL evaluate all conditions according to the logic operator
- **AND** the system SHALL show/hide the section based on the combined result

#### Scenario: Conditional rendering for cells
- **WHEN** rendering a table cell with conditional rules
- **THEN** the system SHALL evaluate conditions for the cell
- **AND** the system SHALL show/hide the cell content based on conditions
- **AND** the system SHALL maintain table structure when cells are hidden

### Requirement: Complex Table Support
The system SHALL properly render and support interaction with complex table structures including merged cells.

#### Scenario: Render merged cells in preview
- **WHEN** rendering a template with tables containing colspan/rowspan
- **THEN** the system SHALL correctly display merged cells in the preview
- **AND** the system SHALL preserve the merged cell structure
- **AND** the system SHALL support placeholders within merged cells

#### Scenario: Edit merged cells
- **WHEN** editing a template with merged cells
- **THEN** the system SHALL allow inserting placeholders in merged cells
- **AND** the system SHALL preserve the merged cell structure during editing
- **AND** the system SHALL support splitting merged cells if needed

#### Scenario: Interactive merged cells
- **WHEN** a merged cell has configured interactive features
- **THEN** the system SHALL support replication or other interactions within the merged cell
- **AND** the system SHALL maintain the merged structure during interactions

### Requirement: Interactive Elements
The system SHALL support interactive elements such as checkboxes and radio buttons in templates.

#### Scenario: Render checkbox field
- **WHEN** rendering a template with a checkbox placeholder
- **THEN** the system SHALL render a checkbox input field
- **AND** the system SHALL bind the checkbox value to the form data
- **AND** the system SHALL support conditional rendering based on checkbox state

#### Scenario: Render radio button field
- **WHEN** rendering a template with a radio button placeholder
- **THEN** the system SHALL render radio button inputs for each option
- **AND** the system SHALL bind the selected value to the form data
- **AND** the system SHALL support conditional rendering based on radio selection

#### Scenario: Conditional rendering from interactive elements
- **WHEN** an interactive element (checkbox/radio) changes value
- **AND** conditional rules depend on that element's value
- **THEN** the system SHALL re-evaluate conditional rules
- **AND** the system SHALL update the display accordingly

### Requirement: Mixed Content Support
The system SHALL support templates containing mixed content types (tables, paragraphs, headings, lists).

#### Scenario: Render template with tables and paragraphs
- **WHEN** rendering a template containing both tables and paragraphs
- **THEN** the system SHALL render tables using table renderer
- **AND** the system SHALL render paragraphs using paragraph renderer with placeholder support
- **AND** the system SHALL maintain the document structure

#### Scenario: Render template with headings and lists
- **WHEN** rendering a template containing headings and lists
- **THEN** the system SHALL render headings with placeholder support
- **AND** the system SHALL render lists with placeholder support
- **AND** the system SHALL extract placeholders from these nodes

#### Scenario: Mixed content with conditional rendering
- **WHEN** rendering a template with mixed content and conditional rules
- **THEN** the system SHALL apply conditional rendering to all content types
- **AND** the system SHALL maintain document structure when sections are hidden

## MODIFIED Requirements

### Requirement: Template Type-Based Rendering Logic
The system SHALL apply rendering logic based on template render configuration, with fallback to template type if no configuration is provided.

#### Scenario: Configuration-based rendering
- **WHEN** a template has a render configuration
- **THEN** the system SHALL use the configuration to determine rendering behavior
- **AND** the system SHALL NOT rely solely on template type string matching

#### Scenario: Type-based fallback
- **WHEN** a template does not have a render configuration
- **THEN** the system SHALL fall back to type-based rendering logic
- **AND** the system SHALL maintain existing behavior for backward compatibility

#### Scenario: Hybrid rendering
- **WHEN** a template has partial render configuration
- **THEN** the system SHALL use configuration for specified aspects
- **AND** the system SHALL use type-based logic for unspecified aspects

