# Tasks

## 1. Preparation
- [ ] Create `app/agentic/tools/smart_doc_gen_toolkit.py` wrapper for `doc_utils.py`.
- [ ] Create `app/agentic/agents/smart_doc_gen_agent.py`.

## 2. Implementation
- [ ] Implement `SmartDocGenToolkit` methods: `analyze`, `extract`, `fill`.
- [ ] Implement `SmartDocGenAgent` with instructions derived from `SKILL.md`.
- [ ] Add unit tests for the toolkit.
- [ ] Add integration test for the agent.

## 3. Verification
- [ ] Create a test case in the local database with sample parties and evidence.
- [ ] Invoke `SmartDocGenAgent` with the test `case_id` and a standard template.
- [ ] Verify the generated document contains data from the database.
