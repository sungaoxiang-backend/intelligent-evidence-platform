## REMOVED Requirements

### Requirement: Legacy Document Templates Access
The legacy document templates management page SHALL be removed.

#### Scenario: Legacy Document Templates Access
- **Given** I am a user
- **When** I try to access `/document-templates`
- **Then** I should see a 404 page (Requirement for legacy page existence removed)

### Requirement: Legacy Document Generation Access
The legacy document generation page SHALL be removed.

#### Scenario: Legacy Document Generation Access
- **Given** I am a user
- **When** I try to access `/document-generation`
- **Then** I should see a 404 page (Requirement for legacy page existence removed)

## MODIFIED Requirements

### Requirement: Navigation Menu
The navigation menu SHALL be updated to remove legacy links and point to the new modules.

#### Scenario: Navigation Menu
- **Given** I am on the top navigation bar
- **Then** I should NOT see "文书模板" pointing to `/document-templates` (legacy)
- **And** I should see "文书模板" pointing to `/documents`
- **And** I should see "文书制作" pointing to `/document-creation`
