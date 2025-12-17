# Smart Document Generation Agent

## Summary
Migrate the `smart-doc-gen` Claude skill to an Agno-based agent within the `app/agentic` module. This agent will provide an intelligent runtime for generating legal documents by mapping case data to DOCX templates.

## Motivation
- The current `smart-doc-gen` skill runs in the IDE/CLI via `openskills`.
- We want to expose this capability as a service or a more autonomous agent within the `app/agentic` system (based on Agno).
- This aligns with the broader goal of building an agentic evidence platform.

## Proposed Solution
- Create a new Agno agent `SmartDocGenAgent` in `app/agentic/agents/smart_doc_gen_agent.py`.
- Implement a wrapper/orchestrator that fetches data using `app.cases.services` and `app.evidences.services`.
- Wrap the existing `smart-doc-gen/scripts/doc_utils.py` functionality into an Agno `Toolkit`.
- Implement the 4-step workflow (Analyze, Extract, Map, Fill) within the agent's instructions, ensuring the "Map" step uses the live data structure.
