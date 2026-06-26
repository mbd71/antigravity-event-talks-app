# Project Rules

## 📋 Always Require an Approved Implementation Plan First
Before executing any shell commands, modifying/creating project files, or performing package installations:
1.  **Draft a Plan**: You MUST create a detailed implementation plan in an artifact file named `plan.md` in the current conversation root.
2.  **Request Review**: Set the plan artifact's `RequestFeedback` metadata flag to `true`. This will prompt the user with a "Proceed" button.
3.  **Wait for Consent**: Do NOT execute any actual file changes or terminal commands until the user has explicitly clicked "Proceed" or typed approval.

### Required Plan Structure:
*   **Requirements & Analysis**: Scope and key objectives of the task.
*   **Proposed Architecture**: High-level design, schema changes, and target file modifications.
*   **Step-by-Step Task List**: The specific sequence of implementation steps.
*   **Testing Strategy**: How the changes will be verified.
