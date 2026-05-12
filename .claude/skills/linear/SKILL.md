---
name: linear
description: >-
  Linear ticket workflows for quantum-vault: fetch tickets, create branches from
  tickets, create new tickets, set up blocking relations between quantum-vault and libqc work.
argument-hint: '[ticket-id or action]'
---

# Linear

## Workflows

### Implement an Existing Ticket

#### 1. Fetch Ticket

```
Linear MCP: get_issue({ id: "<TICKET-ID>", includeRelations: true })
```

Extract: title, description, acceptance criteria, `gitBranchName`, blockers, Figma URLs, libqc dependencies, security/extension-runtime concerns.

#### 2. Setup Git Branch

From the `quantum-vault` repo root:

```bash
git checkout main && git pull
git checkout -b {gitBranchName-from-linear}
```

If the work also requires a sibling libqc change, create a matching branch there:

```bash
(cd ../libqc && git checkout main && git pull && git checkout -b {gitBranchName-from-linear})
```

Always use the exact `gitBranchName` from Linear - never modify it.

#### 3. Start Work

Summarize requirements, build an implementation plan (see the `orchestrate` skill for the plan template), then begin.

### Create a Branch from a Ticket

Fetch the ticket, extract `gitBranchName`, then:

```bash
git checkout -b {gitBranchName}
```

### Create a New Ticket

```
Linear MCP: save_issue({
  title: "<descriptive title>",
  team: "<team-name>",
  assignee: "me",
  description: "<markdown description>"
})
```

Include `parentId` for a subtask.

### Block a Ticket on libqc Work

When the current quantum-vault ticket is blocked by a libqc change:

1. Fetch the current ticket with `includeRelations: true`
2. Create a new ticket for the libqc work:

```
Linear MCP: save_issue({
  title: "<libqc work needed>",
  team: "<team-name>",
  blocks: ["<current-quantum-vault-ticket-id>"],
  description: "<what the SDK needs to export/change>"
})
```

Use `blocks` on the new ticket (not `blockedBy` on the consumer ticket).

### Update Ticket Status

Prefer the GitHub-Linear integration - it transitions status on PR events (draft -> ready -> merged). Only update status manually when the integration is not wired for this team or the ticket needs an exceptional state change.

```
Linear MCP: save_issue({ id: "<TICKET-ID>", state: "In Review" })
```

### Comment on a Ticket

```
Linear MCP: save_comment({ issueId: "<TICKET-ID>", body: "<markdown comment>" })
```

Post a comment only when there is meaningful context (implementation decisions, open questions, deferred scope). Do not post the PR link as a comment - the integration already surfaces it.

## Rules

- Always use the exact `gitBranchName` from Linear
- If no Linear ticket is mentioned, ask the user for the ticket ID
- Use `blocks` to create blocking relations (not `blockedBy` on the blocked ticket)
- Every ticket should have an assignee
- Do not update ticket status when the GitHub-Linear integration already handles it
