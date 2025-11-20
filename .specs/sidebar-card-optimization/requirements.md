# Requirements Document - Sidebar Card Compact Design

## Introduction

Optimize the `SidebarItem` component to reduce whitespace and unnecessary height, making the list more compact and information-dense.

## Requirements

### Requirement 1: Compact Visual Design

**User Story:** As a user, I want to see more items in the list without scrolling, so the cards should have less padding and wasted space.

**Acceptance Criteria:**
1. Reduce card padding (e.g., from `p-3` to `p-2.5` or `p-2`).
2. Reduce internal spacing between elements (gap, margins).
3. Remove fixed minimum heights that force cards to be taller than their content.

### Requirement 2: Optimized Layout Structure

**User Story:** As a user, I want the card layout to adapt to the content size naturally.

**Acceptance Criteria:**
1. Adjust the Grid/Flex layout to prevent the right column (actions/status) from forcing extra height on the card when not needed.
2. Ensure the title, description, and metadata flow vertically with minimal spacing.
3. Align actions and status efficiently.

