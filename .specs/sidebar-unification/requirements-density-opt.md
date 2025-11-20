# Requirements Document - Sidebar Card Density Optimization

## Introduction

Optimize the `SidebarItem` component to reduce whitespace and unnecessary height, creating a more compact and information-dense layout for document templates and placeholders.

## Requirements

### Requirement 1: Compact Visual Design

**User Story:** As a user, I want to see more items in the list without scrolling, so the cards should have less padding and wasted vertical space.

**Acceptance Criteria:**
1. Reduce padding inside the card.
2. Reduce the gap between the content column and the action column.
3. Remove or reduce fixed minimum heights that force the card to be taller than necessary.
4. Ensure action buttons and status badges are still easily clickable and readable.

### Requirement 2: Optimized Layout

**User Story:** As a user, I want the card layout to adapt to its content naturally.

**Acceptance Criteria:**
1. The right column (actions/status) should not force a large minimum height.
2. Content spacing (title, description, meta) should be tightened.

