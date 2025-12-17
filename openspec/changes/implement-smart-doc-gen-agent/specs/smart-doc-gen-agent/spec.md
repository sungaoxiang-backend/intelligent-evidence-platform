# Spec: Smart Document Generation Agent

## ADDED Requirements

### Requirement: Document Generation Capability
The agent MUST be able to accept a `case_id` and a template path, fetch live case data from the system, analyze the template, and generate a filled document.

#### Scenario: Generate Document from Case ID
Given a valid `case_id` existing in the database and a `template.docx`
When the `SmartDocGenAgent` is invoked with these inputs
Then it should fetch the case details and evidence list via system services
And analyze the template type
And extract the template structure
And intelligently map the fetched case data to the template fields
And generate a filled `.docx` file
And return the path to the generated file.

### Requirement: Robustness
The agent MUST handle errors and missing data gracefully without crashing.

#### Scenario: Handle Missing Data
Given a case data capable of partial filling
When the agent encounters a required field missing in the case data
Then it should attempt to infer it (e.g., current date) or leave it blank/marked, but not crash.

### Requirement: Template Support
The agent MUST support both element-based (forms) and narrative-based (contracts/complaints) templates.

#### Scenario: Support Element-Based Templates
Given an "Element-based" template (e.g., court form)
Then the agent should correctly identify it
And map data to specific cells (row/col) based on labels.

#### Scenario: Support Narrative-Based Templates
Given a "Narrative-based" template (e.g., complaint)
Then the agent should correctly identify it
And map data to paragraph placeholders.
