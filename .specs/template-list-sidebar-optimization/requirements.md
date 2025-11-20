# Requirements Document

## Introduction

Optimize the sidebar of the document template page to improve user experience by adding status filtering and clarifying button text.

## Requirements

### Requirement 1: Status Filter

**User Story:** As a user, I want to filter the document template list by status (Draft/Published) so that I can easily find the templates I need.

#### Acceptance Criteria

1. Add a dropdown menu in the sidebar header to filter templates.
2. The dropdown should include options: "All" (Default), "Draft", "Published".
3. Selecting an option should reload the template list with the selected status filter.
4. The API call to fetch templates should include the `status` parameter when a specific status is selected.

### Requirement 2: Rename "New" Button

**User Story:** As a user, I want the "New" button to be clearly labeled as "New Template" to avoid ambiguity.

#### Acceptance Criteria

1. Change the text of the "+ New" button in the sidebar to "+ New Template".

