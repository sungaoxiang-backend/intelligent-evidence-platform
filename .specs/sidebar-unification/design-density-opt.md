# Design Document - Sidebar Card Density Optimization

## Overview

This document outlines CSS and structure changes to `frontend/components/common/sidebar-item.tsx` to achieve a more compact look.

## Component Changes

### `SidebarItem` (`frontend/components/common/sidebar-item.tsx`)

**Style Updates:**
- **Container Padding:** Change `p-3` to `p-2.5` or `p-2`.
- **Grid Gap:** Change `gap-3` to `gap-2`.
- **Right Column:**
  - Remove `min-h-[60px]`.
  - Change `justify-between` to `justify-start` with `gap-1` or keep `justify-between` but let height be auto.
  - Actually, `justify-between` is useful to pin Status to bottom. However, if the description is short, we don't want the status to float far away if we don't enforce height.
  - **Alternative:** If we want it compact, maybe the status doesn't *need* to be at the absolute bottom if the card is short.
  - **Decision:** Remove `min-h-[60px]`. Use `flex-col` with `h-full`. If the left content is tall, `h-full` will make the right column tall, and `justify-between` will push Status to bottom. If left content is short, the card is short, and Status is just below Actions.

**Internal Spacing:**
- **Title:** `mb-0.5` (was `mb-1`).
- **Description:** `mb-1.5` (adjust for visual balance).
- **Meta:** `text-[10px]` (keep, but check line height).

## Testing
- Check visual regression in Document Template List.
- Check visual regression in Placeholder List.

