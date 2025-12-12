---
description: Audit the consistency between original PRD/requirements and implemented OpenSpec artifacts.
---
<!-- OPENSPEC:START -->
**Guardrails**
- This audit is read-only. Do NOT modify any specs or archives during this value.
- Be objective. If a requirement is missing, report it as missing. Do not assume implicit implementation.
- Use Chinese for the final report.

**Steps**
1.  **Analyze Input**:
    - Identify the input source provided by the user (URL, file system path, or raw text).
    - If URL: Read content using `read_url_content` (or `browser` if needed).
    - If Path: Read file using `view_file` (resolve relative paths if needed).
    - If Text: Use directly.
    - Extract key feature keywords, user stories, and acceptance criteria from the inputs.

2.  **Context Discovery**:
    - Search for relevant *archived* changes using `find_by_name` in `openspec/changes/archive/` or `openspec list`. Look for names matching the extracted keywords.
    - Search for relevant *current* specs using `openspec list --specs` and `grep_search` on `openspec/specs/` for key terms.
    - *Goal*: Identify the specific `change-id` that was supposed to implement this PRD, and the specific `capability` specs that resulted.

3.  **Data Gathering**:
    - Read the `proposal.md` and `spec.md` (deltas) from the *archived* change directory (e.g., `openspec/changes/archive/YYYY-MM-DD-change-id/`).
    - Read the *current* `spec.md` for the relevant capabilities (e.g., `openspec/specs/capability/spec.md`).

4.  **Gap Analysis**:
    Perform a three-way comparison: **PRD (Input)** vs **Proposal (Plan)** vs **Current Spec (Truth)**.

    *   **Check 1: PRD vs Proposal** (Did we plan to build what was asked?)
        - Are all PRD requirements mentioned in the Proposal?
        - Are there major scope cuts?

    *   **Check 2: Proposal vs Current Spec** (Did we ship what we planned?)
        - Do the Scenarios in the Proposal exist in the Current Spec?
        - Have they been modified or removed since?

5.  **Generate Audit Report**:
    Output a Markdown report with the following structure:

    ```markdown
    # OpenSpec Audit Report

    **Source**: [Input Source]
    **Target Change**: [Matched Change ID]
    **Target Specs**: [Matched Capabilities]

    ## 1. Executive Summary
    - **Score**: [0-100]% Alignment
    - **Status**: [Health Status: Healthy/Diverged/Missing]
    - [Brief summary of findings]

    ## 2. Requirements Analysis
    | PRD Requirement | Proposal Status | Current Spec Status | Consistency |
    |-----------------|-----------------|---------------------|-------------|
    | [Req A]         | ✅ Planned      | ✅ Present          | 🟢 Pass     |
    | [Req B]         | ❌ Omitted      | ➖ N/A              | 🔴 Missing  |
    | [Req C]         | ✅ Planned      | ⚠️ Changed          | 🟡 Diverged |

    ## 3. Detailed Findings
    ### Missing Capabilities
    - [List items in PRD but not in Specs]

    ### Deviations
    - [List items that act differently than requested]

    ## 4. Recommendations
    - [Action items to reconcile]
    ```

**Reference**
- Archives are in `openspec/changes/archive/`.
- Current specs are in `openspec/specs/`.
<!-- OPENSPEC:END -->
