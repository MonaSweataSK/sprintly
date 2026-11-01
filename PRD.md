# Product Requirements Document
## Sprint & Task Management Platform

**Document Version:** 3.4  
**Status:** Requirements Baseline  

---

## 1. Product Overview

### 1.1 Purpose
Build a web-based sprint and task management platform for a single organization that supports multiple teams, concurrent sprints, task assignments, deadline tracking, dependencies, and visual task management.

The application provides two primary task interfaces:
- **Board View**
- **List View**

### 1.2 Product Objectives
- Simplify sprint planning and execution.
- Support multiple active sprints simultaneously.
- Assign sprints to teams or leave them unassigned.
- Allow members to create, assign, and manage tasks.
- Visualize tasks by status, assignee, and due date.
- Find tasks globally by ID, title, or description using search suggestions.
- Support drag-and-drop updates across all board grouping modes.
- Enforce task dependency completion requirements.
- Prevent sprint completion when unfinished tasks exist.
- Allow users to permanently delete tasks.
- Persist all application data.
- Restrict access to Admin-approved email addresses through email OTP verification and authenticated sessions.

---

## 2. Users and Permissions

### 2.1 Admin
Admins can:
- Approve member email addresses and assign Admin or User roles for OTP-based access.
- View, add, edit, and deactivate organization members.
- Change member roles.
- Create and manage teams.
- Manage team memberships.
- Create and manage sprints.
- Create and manage tasks.
- Assign sprints to teams.
- Assign tasks to members.
- Manage task dependencies.
- Use Board and List views.
- Search tasks globally by ID, title, or description.
- Permanently delete tasks that have no dependent tasks.

### 2.2 User
Users can:
- Access the application after verifying their approved email address using a one-time password (OTP).
- Create, edit, and delete sprints.
- Assign sprints to existing teams.
- Create, edit, and permanently delete tasks.
- Assign tasks to active members.
- Update task statuses and dates.
- Manage task dependencies.
- Use Board and List views.
- Search tasks globally by ID, title, or description.
- Group and sort task views.

Users cannot:
- Access the full member directory.
- Add, edit, remove, or deactivate members.
- Manage teams or team membership.
- Change member roles.
- Permanently delete tasks.

> *Task assignment selectors display minimal member information without exposing the administrative member directory.*

### 2.3 Email-Based Authentication and Access Control
- **Requirement ID:** AUTH-01
- **Priority:** P0 — Required for MVP

#### 2.3.1 Overview
The application uses Admin-approved email addresses and one-time passwords (OTP) to authenticate members. There is no public signup or user-created password. Once verified, a member receives a persistent authenticated session and does not need to enter an OTP again for each request or after reopening the browser, while that session remains valid.

#### 2.3.2 Authentication Flow
1. An Admin adds a member's email and assigns an Admin or User role; PostgreSQL stores the approved email, role, and active status.
2. The member opens the application and enters their email address.
3. The backend checks whether the email is approved and active. The UI always gives a generic response to avoid revealing registered emails.
4. If approved, the backend sends a single-use OTP to that email, valid for 5 minutes (configurable within 2–5 minutes).
5. The member submits the OTP; the backend verifies it and invalidates it after successful use.
6. The backend creates a revocable server-side session and issues a signed JWT used for authenticated requests. The token is set in a `Secure`, `HttpOnly` cookie rather than being stored in JavaScript-accessible storage.
7. The browser automatically sends the cookie with eligible API requests. NestJS verifies the JWT, validates the active server-side session, and obtains the member's current role from PostgreSQL for authorization.
8. The session survives browser close/reopen. Short-lived JWTs are renewed while the server-side session remains valid, without requiring repeated OTP verification.
9. When the member logs out, the backend revokes the session and clears its cookie. The next sign-in requires a new OTP.

#### 2.3.3 Business Rules
- **AUTH-BR-01:** Only active, Admin-approved email addresses can establish authenticated sessions.
- **AUTH-BR-02:** Emails are unique, compared case-insensitively, and normalized by trimming surrounding whitespace.
- **AUTH-BR-03:** OTPs expire 5 minutes after issuance by default. Expiration is configurable within 2–5 minutes. OTPs are single-use.
- **AUTH-BR-04:** Incorrect, expired, used, or replaced OTPs are rejected. Issuing a replacement OTP invalidates the previous outstanding OTP.
- **AUTH-BR-05:** OTP requests and verifications have rate limits, verification-attempt limits, and a resend cooldown.
- **AUTH-BR-06:** OTPs are not stored in plaintext and are never exposed in API responses or application logs.
- **AUTH-BR-07:** Email submission returns the same generic message whether the address is approved or not; OTP email is sent only to approved active members.
- **AUTH-BR-08:** Protected requests require a valid signed JWT in a cookie and an active server-side session. Supplying an email, role, or user ID alone never grants access.
- **AUTH-BR-09:** Authorization checks the member's current role in PostgreSQL. Deactivation/removal revokes current sessions; role changes apply to subsequent requests.
- **AUTH-BR-10:** The initial Admin is provisioned through a controlled setup process. Public Admin registration is forbidden.
- **AUTH-BR-11:** Authentication persists across browser restarts using a persistent cookie and a renewable session, not a never-expiring JWT.
- **AUTH-BR-12:** The default session expires after 30 days of inactivity (proposed product default). Valid authenticated activity renews the inactivity window. The session may also have an administrator-configurable maximum absolute lifetime.
- **AUTH-BR-13:** JWTs must have a finite expiration. The backend supports renewal within an active session, and must validate revocation for protected requests.
- **AUTH-BR-14:** Logout revokes the server-side session and clears authentication cookies. A revoked session cannot be revived through JWT renewal; OTP verification is required to sign in again.
- **AUTH-BR-15:** Authentication cookies must use `Secure` and `HttpOnly` attributes, appropriate `SameSite` settings, and CSRF protection for state-changing operations where needed.

#### 2.3.4 Acceptance Criteria
- Admin can approve a member email and assign a role.
- Approved members can request and verify an OTP; inactive or unapproved emails cannot sign in.
- OTPs expire after the configured 2–5-minute validity period (5 minutes by default).
- Incorrect, expired, reused, or superseded OTPs are rejected, and rate limits are enforced.
- Successful OTP verification establishes a session and sets an authentication cookie.
- Members can access protected APIs without repeatedly submitting an OTP.
- Members remain authenticated after closing and reopening their browser, provided the session is valid.
- Expired short-lived JWTs are renewed only for active, non-revoked sessions.
- User roles are enforced using current database values, not untrusted request payloads.
- Member deactivation immediately prevents further authenticated access.
- Logout revokes the session, clears the cookie, and prevents subsequent authenticated requests or renewal with the revoked credentials.
- After logout or session expiration, signing in requires another OTP.

---

## 3. Sprint Management

- **Requirement ID:** SPR-01
- **Priority:** P0

### 3.1 Sprint Properties

| Property | Required | Description / Constraint |
| :--- | :--- | :--- |
| **Sprint ID** | Auto-generated | Unique identifier |
| **Sprint Name** | Yes | String |
| **Description** | No | Text |
| **Start Date** | Yes | Date |
| **End Date** | Yes | Date |
| **Assigned Team** | No | Reference to Team |
| **Status** | Yes | Enum: Planned, Active, Completed |
| **Created By** | Auto-generated | Reference to User |
| **Created At** | Auto-generated | Timestamp |
| **Updated At** | Auto-generated | Timestamp |

### 3.2 Sprint Statuses
- Planned
- Active
- Completed

### 3.3 Functional Requirements
- Create a sprint.
- Edit sprint properties.
- Delete a sprint.
- Start a sprint.
- Complete a sprint.
- Assign or remove a team.
- View sprints by status.
- Filter sprints by team.
- View all tasks belonging to a sprint.

### 3.4 Business Rules
- **SPR-BR-01:** Multiple sprints can be Active simultaneously.
- **SPR-BR-02:** The same team can have multiple active sprints.
- **SPR-BR-03:** Sprint date ranges may overlap.
- **SPR-BR-04:** A sprint may exist without an assigned team.
- **SPR-BR-05:** Sprint end date must not precede its start date.
- **SPR-BR-06:** A task belongs to at most one sprint.
- **SPR-BR-07:** Deleting a sprint moves its tasks to the unassigned backlog rather than deleting them.
- **SPR-BR-08: Sprint Completion Validation**
  A sprint can transition from Active to Completed only when all tasks currently belonging to that sprint have status `Done`.
  If one or more tasks are unfinished:
  - The sprint must remain `Active`.
  - A warning must be displayed.
  - The warning must identify the unfinished tasks.
  - Users must be able to open those tasks.
  - No sprint status change may be persisted.  
  *Warning example:* `"Cannot complete Sprint 12. Three tasks are still unfinished: TASK-104, TASK-108, TASK-112."`  
  *An empty sprint may be completed after confirmation.*
- **SPR-BR-09:** Completing a sprint must not automatically change task statuses.
- **SPR-BR-10:** Completed sprints are read-only for task membership and task status changes. Reopening a completed sprint changes its status to Active and allows further editing.
- **SPR-BR-11:** Sprint completion must be validated by the backend, including when called directly through the API.

### 3.5 Acceptance Criteria
- Multiple sprints can be active concurrently.
- Sprints can remain unassigned to teams.
- A sprint containing only `Done` tasks can be completed.
- A sprint with at least one unfinished task cannot be completed.
- The application displays unfinished task identifiers.
- Task completion does not automatically complete the sprint.
- A completed sprint retains its tasks and history.
- Reopening a sprint permits further task updates.

---

## 4. Task Management

- **Requirement ID:** TASK-01
- **Priority:** P0

### 4.1 Task Properties

| Property | Required | Description / Constraint |
| :--- | :--- | :--- |
| **Task ID** | Auto-generated | Unique identifier |
| **Task Key** | Auto-generated | Human-readable identifier (e.g., TASK-101) |
| **Title** | Yes | Non-empty string |
| **Description** | No | Text |
| **Assignee** | No | Reference to Member |
| **Start Date** | No | Date |
| **End Date** | No | Date |
| **Sprint** | No | Reference to Sprint |
| **Status** | Yes | Enum (Default: To Do) |
| **Dependencies**| No | Array of Task IDs |
| **Created By** | Auto-generated | Reference to User |
| **Created At** | Auto-generated | Timestamp |
| **Updated At** | Auto-generated | Timestamp |

### 4.2 Task Statuses
- To Do
- In Progress
- In Review
- Done

### 4.3 Functional Requirements
- Create tasks within a sprint or the backlog.
- Edit task details.
- Assign or unassign a task.
- Change task status.
- Change start and end dates.
- Move tasks between eligible sprints.
- Add and remove dependencies.
- Permanently delete tasks.

### 4.4 Business Rules
- Every task has a unique, immutable identifier.
- Task title must not be empty.
- End date cannot precede start date.
- Assignee must be an active organization member.
- Task status defaults to `To Do`.
- Tasks cannot transition to `Done` while prerequisites remain unfinished.
- Tasks in completed sprints cannot be edited until the sprint is reopened.
- Deleted tasks are excluded from normal task views.

---

## 5. Task Dependencies

- **Requirement ID:** DEP-01
- **Priority:** P0

### 5.1 Requirements
- Tasks can depend on multiple prerequisite tasks.
- Dependencies can span sprints.
- Self-dependencies are prohibited.
- Circular dependencies are prohibited.
- Users can add and remove dependencies.
- Unfinished prerequisites are visually indicated.

### 5.2 Completion Validation
A task can transition to `Done` only if all its prerequisite tasks have status `Done`.

*Example:* `TASK-103` depends on `TASK-101` and `TASK-102`. `TASK-103` can be completed only when both prerequisite tasks are `Done`. If a prerequisite remains unfinished, the transition is rejected.

*Warning:* `"Cannot complete TASK-103. TASK-102 must be completed first."`

Reopening a prerequisite from `Done` is blocked while a completed task depends on it. Deleting a prerequisite is blocked while any task depends on it.

---

## 6. Board View

- **Requirement ID:** BOARD-01
- **Priority:** P0

### 6.1 Board Features
- Sprint selector.
- Create Task action.
- Task cards.
- Grouping controls.
- Sorting controls.
- Drag-and-drop task management.
- Task details panel.

### 6.2 Task Card Fields
- Task Key
- Title
- Assignee
- Status
- End Date
- Dependency indicator

### 6.3 Grouping by Status
**Columns:**
1. To Do
2. In Progress
3. In Review
4. Done

Dragging tasks between columns updates their status. Dragging into `Done` triggers dependency validation.

### 6.4 Grouping by Assignee
Columns represent assignees, including an **Unassigned** column.

#### Business Rules:
- If a sprint is assigned to a team, all active members of that team must appear as individual columns, regardless of task assignment.
- Team members with zero assigned tasks must still have a column displaying *"No tasks assigned"*.
- An **Unassigned** column must always be present.
- Tasks assigned to members outside the sprint's team must appear in their respective assignee columns.
- If a sprint has no assigned team, columns are generated from the sprint's existing task assignees, plus Unassigned.
- Global search must not filter, modify, or hide board tasks or team member columns.
- Dragging a task into another member's column updates the task's assignee.
- Dragging a task into the Unassigned column removes its assignee.

#### Acceptance Criteria:
- All active team members appear when grouping a team-assigned sprint by assignee.
- Members with no tasks display empty columns.
- Dragging tasks into empty columns successfully assigns them.
- Tasks assigned to non-team members remain visible.
- Assignee changes persist after refreshing the board.

### 6.5 Grouping by Due Date

| Column | Condition | Default Drag Target Date |
| :--- | :--- | :--- |
| **Overdue** | End date before today | Yesterday |
| **Due Today** | End date equals today | Today |
| **Due in 1–3 Days** | End date within next 3 days | Tomorrow |
| **Due in 4–7 Days** | End date within next 4–7 days | Today + 4 days |
| **Due Later** | End date beyond 7 days | Today + 8 days |
| **No Due Date** | End date is empty | Clear end date |

Dragging between due-date columns is supported. Users can subsequently choose exact dates. Invalid date ranges must be rejected.

---

## 7. List View

- **Requirement ID:** LIST-01
- **Priority:** P0

### Features
- Display tasks in compact vertical rows.
- Show title, assignee, status, sprint, and dates.
- Open task details.
- Inline editing for supported fields.
- Group by status, assignee, sprint, or due date.
- Sort tasks.
- Expand and collapse groups.
- Support pagination.

> *Board and List views must display the complete task set for the selected sprint (subject to normal visibility rules), independently of the global search query.*

---

## 8. Global Task Search, Grouping, and Sorting

- **Requirement ID:** SEARCH-01
- **Priority:** P0

### 8.1 Global Task Search
A single search input must be accessible from the application-level navigation, independently of the sprint Board and List views. No search/filter controls or filtered task results appear within the Board itself.

#### Searchable fields:
- Task ID / Task Key (e.g., `TASK-104`)
- Task Title
- Task Description

#### Search behavior:
- Search covers all tasks across all sprints, including backlog tasks, not just the currently selected sprint.
- Matching tasks appear in a dropdown anchored to the global search input as the user types.
- Each dropdown result displays the task ID/key and title; a brief description excerpt may be displayed to explain a description match.
- Clicking a task's title opens that task's detail page, including when it belongs to a different sprint.
- If a query matches no tasks, the dropdown displays *"No tasks found"*.
- Empty queries close the results dropdown.
- Search is case-insensitive and supports partial matches in all three fields.
- Global search results do not filter, remove, or change cards/rows in Board or List views.
- The dropdown must be keyboard accessible (arrow-key navigation, Enter to open, Escape to close).

#### Acceptance Criteria:
- Searching by task ID/key finds the corresponding task.
- Searching by title finds matching tasks.
- Searching by description finds matching tasks.
- Results are displayed in a dropdown rather than changing the current Board or List view.
- Clicking a result title navigates to the correct task detail page.
- Search works across multiple sprints and backlog tasks.
- No board-level or list-level task filtering UI is present.

### 8.2 Grouping
Grouping changes presentation, not the set of tasks shown. Supported grouping dimensions:
- Status
- Assignee
- Due Date
- Sprint (List/all-task view)

### 8.3 Sorting
Supported sort fields:
- Task Key
- Title
- Start Date
- End Date
- Created Date
- Updated Date

*Sorting operates within the selected Board or List context; it is separate from global search.*

---

## 9. Task Deletion

- **Requirement ID:** DEL-01
- **Priority:** P0

### 9.1 Hard Deletion
*Available to Admins and Users.*
- Requires explicit confirmation.
- Permanently removes the task record.
- Removes the task's dependency relationships.
- Cannot be undone.
- Deletion is blocked while other tasks depend on the task being deleted.
- Public task keys are never reused; a recreated task receives a new key.

---

## 10. Application Screens

### Email Verification & Access
A standalone email entry screen allows users to request an OTP. A verification screen accepts the code and establishes a persistent session. The interface shows a 5-minute OTP countdown (configurable within 2–5 minutes), resend and expiration feedback, and a generic response for unknown emails. Authenticated users remain signed in after browser restart until session expiration or logout. Logout revokes the server-side session and clears the authentication cookie.

### Global Navigation Search
A global task search field appears in application navigation. Matching task IDs, titles, and descriptions produce a results dropdown; clicking a result title opens the task detail page. Search never filters the active Board or List.

### 10.1 Sprint Dashboard
Displays planned, active, and completed sprints with team assignments, dates, and task completion progress.

### 10.2 Sprint Board
Interactive task board with drag-and-drop, sorting, and grouping. No board-level filtering.

### 10.3 Task List
List of tasks with inline editing, sorting, and grouping. No view-level filtering.

### 10.4 Task Details
Task editor containing all MVP task properties, dependencies, and deletion controls.

### 10.5 Sprint Details
Sprint name, description, team, dates, status, completion progress, and start/complete/reopen actions.

### 10.6 Member Management
Admin-only member directory and membership controls.

### 10.7 Team Management
Admin-only team administration.

---

## 11. MVP Acceptance Criteria

| ID | Requirement | Expected Result |
| :--- | :--- | :--- |
| **AC-01** | Admin manages members | Allowed |
| **AC-02** | User views member directory | Denied |
| **AC-03** | Create sprint without team | Allowed |
| **AC-04** | Multiple active sprints | Allowed |
| **AC-05** | Assign sprint to team | Persisted |
| **AC-06** | Create task | Persisted |
| **AC-07** | Assign task | Persisted |
| **AC-08** | Drag by status | Updates status |
| **AC-09** | Drag by assignee | Updates assignee |
| **AC-10** | Drag by due date | Updates end date |
| **AC-11** | Task has unfinished dependencies | Cannot mark Done |
| **AC-12** | Task dependencies completed | Can mark Done |
| **AC-13** | Sprint has unfinished tasks | Cannot complete |
| **AC-14** | All sprint tasks Done | Can complete |
| **AC-15** | Sprint completed | Task editing locked |
| **AC-16** | Reopen sprint | Editing enabled |
| **AC-17** | Switch Board/List | Selected sprint retained |
| **AC-18** | Delete a task without dependents | Removed and no longer appears |
| **AC-19** | Delete a task with dependents | Rejected with dependent task keys |
| **AC-20** | Recreate a deleted task | Receives a new public task key |
| **AC-21** | Refresh application | Data retained |
| **AC-22** | Group sprint by assignee | All active team members shown, including empty columns |
| **AC-23** | Search globally by ID/title/description | Matching tasks shown in dropdown |
| **AC-24** | Click search result title | Correct task detail page opens |
| **AC-25** | Search while viewing Board/List | Visible view tasks remain unchanged |
| **AC-26** | Approved member enters correct OTP | Authenticated session created |
| **AC-27** | Unapproved or inactive email requests access | No authenticated access granted |
| **AC-28** | OTP is expired, invalid, or reused | Verification rejected |
| **AC-29** | User impersonates Admin by entering Admin email | Access denied without mailbox verification |
| **AC-30** | Member is deactivated after login | Existing session no longer grants access |
| **AC-32** | User logs out | Session revoked and cookie cleared; OTP needed again |
| **AC-33** | User closes and reopens browser | Session remains valid without OTP |
| **AC-34** | OTP age exceeds 5 minutes (default) | OTP rejected |
| **AC-35** | JWT expires while session is active | Session renewal allows continued use |
| **AC-36** | Session inactive for 30 days (default) | Session expires and OTP sign-in is required |
| **AC-37** | Revoked session attempts API access or renewal | Access denied |

---

## 12. Additional Scope (Post-MVP) — File Attachments

- **Requirement ID:** ATT-01
- **Priority:** P1 — Not required for MVP

*File attachments will be implemented after the MVP is completed. They must not block MVP development, testing, or release.*

### 12.1 Planned Features
- Upload files to tasks.
- View attachment names, sizes, types, and upload details.
- Download authorized task attachments.
- Remove attachments from tasks.
- Display an attachment indicator on task cards and in task details.

### 12.2 Planned Rules
- Maximum file size: 10 MB per file.
- Allowed file types are configurable.
- Only authenticated, authorized users can access attachments.
- Files are stored in external object storage; metadata is persisted in PostgreSQL.
- Permanent task deletion removes attachment metadata and schedules file cleanup.

### 12.3 Release Boundary
- The MVP Task model and UI do not require attachment fields or controls.
- The MVP has no attachment API or file-storage dependency.
- Attachment features will have separate acceptance criteria when P1 work begins.

---

## 13. Out of Scope
- Multi-organization support.
- Multiple projects.
- Table view.
- Comments.
- Notifications.
- Custom statuses.
- Analytics and burndown reports.
- Time tracking.
- AI functionality.
- Real-time collaboration.
- External integrations.
- Native mobile applications.

---

## 14. Definition of Done
The MVP is complete when all P0 functional requirements and MVP acceptance criteria pass, and the application supports end-to-end sprint planning, task management, dependency validation, sprint completion enforcement, task visualization, global task search, approved-email OTP authentication, secure session handling, role-based access control, and persistence.