# Technical PRD --- Sprint & Task Management Platform

**Version:** 1.2\
**Type:** MVP Technical Specification\
**Technology:** React + NestJS + PostgreSQL + TypeScript

## 1. Project Overview

We are building a task management application similar to Jira, but
simpler.

The application will be used by a single organization with multiple
teams. Members can create sprints, assign tasks, track their progress,
and manage deadlines.

The application has two main views: **Board View** and **List View**.

## 2. Technology Stack

  Component        Technology              Purpose
  ---------------- ----------------------- ---------------------------------
  Frontend         React.js + TypeScript   Build the user interface
  Backend          NestJS + TypeScript     Handle APIs and business logic
  Database         PostgreSQL              Store application data
  ORM              Prisma                  Communicate with PostgreSQL
  Styling          Tailwind CSS            Style the interface
  UI Components    shadcn/ui               Reusable UI components
  API Calls        TanStack Query          Fetch and update server data
  UI State         Zustand                 Manage frontend-only state
  Drag & Drop      dnd-kit                 Move tasks across columns
  Routing          React Router            Navigate between pages
  Authentication   Email OTP + JWT         Identify and authenticate users

## 3. Application Architecture

``` text
React Frontend
      |
 REST API Calls
      |
 NestJS Backend
      |
  +---+----------------+
  |                    |
PostgreSQL         Email Service
  |                    |
Users, Tasks,       Send OTP to
Sprints, Teams      approved users
Sessions, OTPs
```

React handles the interface. NestJS receives requests, checks
permissions, applies business rules, and reads or updates PostgreSQL.

We will use a single backend application divided into modules, rather
than microservices.

## 4. Authentication

### 4.1 Authentication Flow

There is no public signup or password-based login.

1.  Admin adds a user with their email and role.
2.  User opens the application and enters their email.
3.  NestJS checks whether that email exists in PostgreSQL and is active.
4.  If approved, NestJS sends an OTP valid for 5 minutes.
5.  User enters the OTP.
6.  NestJS verifies the OTP, marks it as used, and creates a session in
    PostgreSQL.
7.  NestJS generates a JWT and stores it in the browser using a Secure,
    HttpOnly cookie.
8.  The browser automatically sends the cookie with subsequent requests.
9.  NestJS verifies the JWT, checks the session, and reads the user's
    current role from PostgreSQL.

### 4.2 Session Management

-   Users remain logged in after closing and reopening the browser.
-   JWTs have a short expiration and can be renewed while the session is
    valid.
-   The session expires after 30 days of inactivity by default.
-   Users don't need another OTP while their session remains valid.
-   OTP requests and verification attempts have rate limits.

### 4.3 Logout

1.  User clicks Logout.
2.  React calls `POST /auth/logout`.
3.  NestJS marks the session as revoked.
4.  NestJS sends cookie-clearing headers.
5.  Browser deletes authentication cookies.
6.  User returns to email verification.

Even if someone still possesses an old JWT, NestJS rejects it because
its session is revoked.

## 5. Roles and Permissions

Two roles are supported.

  Operation                      Admin   User
  ---------------------------- ------- ------
  Add/edit/remove members          Yes     No
  View member directory            Yes     No
  Create/manage teams              Yes     No
  Create/edit/delete sprints       Yes    Yes
  Create/edit tasks                Yes    Yes
  Assign tasks                     Yes    Yes
  Move tasks                       Yes    Yes
  Manage dependencies              Yes    Yes
  Soft-delete tasks                Yes    Yes
  Restore tasks                    Yes    Yes
  Permanently delete tasks         Yes     No

The user role is stored in PostgreSQL.

NestJS checks the user's role before allowing restricted operations.
Regular users can access limited assignee options without viewing the
complete member directory.

## 6. Database Design

We need the following tables for the MVP.

### 6.1 Users

Stores approved users and their roles.

  Field          Purpose
  -------------- -----------------------------------------------
  `id`           Unique user ID
  `name`         Member's name
  `email`        Unique email address
  `role`         `ADMIN` or `USER`
  `is_active`    Whether the member can access the application
  `created_at`   Creation timestamp
  `updated_at`   Last update timestamp

### 6.2 Teams

Stores teams within the organization.

  Field           Purpose
  --------------- --------------------
  `id`            Unique team ID
  `name`          Team name
  `description`   Optional details
  `created_at`    Creation timestamp

### 6.3 Team Members

Connects users with teams.

  Field       Purpose
  ----------- --------------
  `id`        Record ID
  `team_id`   Related team
  `user_id`   Related user

One member can belong to multiple teams.

### 6.4 Sprints

  Field           Purpose
  --------------- ----------------------------------
  `id`            Unique sprint ID
  `name`          Sprint name
  `description`   Sprint details
  `team_id`       Assigned team, nullable
  `start_date`    Sprint start
  `end_date`      Sprint end
  `status`        `PLANNED`, `ACTIVE`, `COMPLETED`
  `created_by`    User who created it
  `created_at`    Creation timestamp
  `updated_at`    Update timestamp

Multiple sprints can be Active simultaneously, including multiple
sprints belonging to the same team.

### 6.5 Tasks

  Field           Purpose
  --------------- --------------------------------------------
  `id`            Internal UUID
  `task_key`      Human-readable ID, e.g. `TASK-101`
  `title`         Task title
  `description`   Task details
  `assignee_id`   Assigned user, nullable
  `sprint_id`     Sprint, nullable
  `start_date`    Start date
  `end_date`      Due date
  `status`        `TODO`, `IN_PROGRESS`, `IN_REVIEW`, `DONE`
  `created_by`    Task creator
  `created_at`    Creation timestamp
  `updated_at`    Last modification
  `deleted_at`    Soft-deletion timestamp

Task keys are unique and must never be reused.

### 6.6 Task Dependencies

  Field                  Purpose
  ---------------------- -----------------------------
  `id`                   Dependency record ID
  `task_id`              Task requiring another task
  `depends_on_task_id`   Prerequisite task

For example, `TASK-102` depends on `TASK-101`.

### 6.7 OTPs

  Field          Purpose
  -------------- ---------------------------------------
  `id`           OTP record ID
  `user_id`      User requesting access
  `otp_hash`     Securely stored OTP verification hash
  `expires_at`   Expiration time
  `used_at`      When OTP was used
  `attempts`     Failed verification attempts

### 6.8 Sessions

  Field              Purpose
  ------------------ ---------------------------
  `id`               Session ID
  `user_id`          Logged-in user
  `created_at`       Login time
  `last_active_at`   Last activity
  `expires_at`       Session expiration
  `revoked_at`       Logout or revocation time

## 7. Sprint Management

### Sprint Rules

-   Sprints can be created without a team.
-   Sprints can be assigned or reassigned to existing teams.
-   Multiple active sprints are allowed.
-   A sprint's end date cannot be before its start date.
-   Deleting a sprint moves its tasks to the backlog.
-   Completed sprints are read-only until reopened.

### Sprint Completion

Before completing a sprint, NestJS checks all non-deleted tasks
belonging to it.

``` text
User clicks Complete Sprint
          |
          v
NestJS checks sprint tasks
          |
          v
     All tasks Done?
       /        \
     Yes         No
      |           |
  Complete      Reject
   sprint       and warn
```

Example warning:

> Cannot complete Sprint 12. TASK-104 and TASK-108 are unfinished.

The completion check and status update happen in one database
transaction. Task changes must be coordinated with that transaction so a
sprint cannot become Completed while another request adds an unfinished
task.

An empty sprint can be completed after user confirmation.

## 8. Task Management and Dependencies

Users can create tasks, assign members, set dates, change statuses, move
tasks between sprints, and manage prerequisites.

### Dependency Rules

Suppose:

-   `TASK-101` --- Create database schema
-   `TASK-102` --- Implement API, depends on `TASK-101`
-   `TASK-103` --- Build frontend, depends on `TASK-102`

`TASK-102` cannot be marked Done until `TASK-101` is Done. Similarly,
`TASK-103` cannot be Done until `TASK-102` is Done.

NestJS must also reject circular dependencies and prevent reopening a
prerequisite while a completed task depends on it.

These checks apply whether the change comes from drag-and-drop, inline
editing, or a direct API request.

## 9. Board View

The board displays the tasks belonging to the selected sprint.

It supports three grouping modes.

### 9.1 Group by Status

Columns:

-   To Do
-   In Progress
-   In Review
-   Done

Dragging a task to another column changes its status. Moving into Done
triggers dependency checks.

### 9.2 Group by Assignee

If a sprint belongs to a team, every active team member gets a column,
even if they have no tasks.

Additional columns are created for assigned members outside the sprint's
team, plus Unassigned.

Dragging a task into another member's column updates its assignee.
Moving it to Unassigned clears the assignment.

### 9.3 Group by Due Date

  Column             Default date when dropped
  ------------------ ---------------------------
  Overdue            Yesterday
  Due Today          Today
  Due in 1--3 Days   Tomorrow
  Due in 4--7 Days   Today + 4 days
  Due Later          Today + 8 days
  No Due Date        Null

Dragging between these columns updates `end_date`.

Date calculations use the configured application timezone, initially
`Asia/Kolkata`. Updates must still satisfy start/end date validation.

### 9.4 Drag-and-Drop Implementation

Use dnd-kit in React.

When a user drops a task:

1.  React identifies the destination.
2.  React temporarily moves the task for immediate feedback.
3.  It sends the appropriate API request.
4.  NestJS validates and saves the change.
5.  If the backend rejects it, React moves the task back and displays
    the error.

## 10. List View

The List view displays tasks vertically, with their title, status,
assignee, sprint, and dates.

Users can open task details, edit supported fields inline, and sort tasks.

The Board and List use the same task data APIs. Neither includes task
filtering controls. Sprint task lists are paginated by the API, use an
allowlist of task sort fields with stable task-key/ID tie-breakers, and expose
the same task fields as the Board. The Board/List switch keeps the sprint ID
in the route so both views use the same selected sprint.

## 11. Global Task Search

Provide a single search input in the application navigation.

Search supports:

-   Task Key / ID
-   Task Title
-   Task Description

Example search: `authentication`

Possible results:

-   `TASK-104`
-   Implement authentication API
-   Build login and OTP verification endpoints

The backend searches all non-deleted tasks, including backlog tasks.
Results appear in a dropdown, and clicking a title opens the
corresponding task details page.

Search does not filter the currently open Board or List.

Implementation: use PostgreSQL case-insensitive partial matching, return at
most eight ranked suggestions, and debounce API requests in React. The API
excludes soft-deleted tasks and the global header supports keyboard navigation.
The current four-task local dataset measured 0.061 ms with `EXPLAIN ANALYZE`,
so add trigram indexes only after re-measuring against representative larger
data; suggestions do not change the active Board or List task set.

## 12. Task Deletion

### Soft Delete

When a user deletes a task, NestJS sets `deleted_at` rather than
removing the row.

The task disappears from normal views and appears in Trash.

### Restore

Clearing `deleted_at` restores the task, subject to sprint and
dependency validations.

### Permanent Delete

Admin-only.

The task must first be soft-deleted. Before deleting it permanently,
NestJS checks whether other active tasks depend on it.

If dependencies exist, the operation is rejected until they are
resolved.

## 13. API Endpoints

Base URL: `/api/v1`

  Feature               Endpoint                                  Method
  --------------------- ----------------------------------------- --------------------
  Request OTP           `/auth/request-otp`                       POST
  Verify OTP            `/auth/verify-otp`                        POST
  Renew session token   `/auth/refresh`                           POST
  Logout                `/auth/logout`                            POST
  Current user          `/auth/me`                                GET
  Members               `/members`                                GET, POST
  Member update         `/members/:id`                            PATCH, DELETE
  Assignee options      `/assignee-options`                       GET
  Teams                 `/teams`                                  GET, POST
  Team update           `/teams/:id`                              PATCH, DELETE
  Sprints               `/sprints`                                GET, POST
  Sprint update         `/sprints/:id`                            GET, PATCH, DELETE
  Start sprint          `/sprints/:id/start`                      POST
  Complete sprint       `/sprints/:id/complete`                   POST
  Reopen sprint         `/sprints/:id/reopen`                     POST
  Sprint board          `/sprints/:id/board`                      GET
  Tasks                 `/tasks`                                  GET, POST
  Task update           `/tasks/:id`                              GET, PATCH, DELETE
  Dependencies          `/tasks/:id/dependencies`                 GET, POST
  Remove dependency     `/tasks/:id/dependencies/:dependencyId`   DELETE
  Global search         `/tasks/search?q=...`                     GET
  Trash                 `/tasks/trash`                            GET
  Restore task          `/tasks/:id/restore`                      POST
  Permanent delete      `/tasks/:id/permanent`                    DELETE

All protected endpoints require a valid session. Admin-only endpoints
must check the current database role.

## 14. Frontend Pages

  Route                  Page
  ---------------------- -------------------------
  `/login`               Email entry
  `/verify-otp`          OTP verification
  `/dashboard`           Sprint dashboard
  `/sprints/:id/board`   Sprint board
  `/sprints/:id/list`    Task list
  `/sprints/:id`         Sprint details
  `/tasks/:taskKey`      Task details
  `/members`             Admin member management
  `/teams`               Admin team management
  `/trash`               Deleted tasks

## 15. Testing Requirements

The following functionality must be tested before release:

-   OTP expiry, incorrect codes, retry limits, and reuse prevention.
-   JWT renewal, browser restart persistence, session expiry, and logout
    revocation.
-   Admin and User permissions.
-   Multiple active sprints.
-   All team members appearing in assignee board columns.
-   Drag-and-drop in all three board grouping modes.
-   Task dependency validation and circular dependency prevention.
-   Sprint completion with unfinished tasks.
-   Concurrent task changes during sprint completion.
-   Global search and task navigation.
-   Task deletion and restoration.

Use Jest for NestJS tests, Vitest for React unit tests, and Playwright
for end-to-end flows.

## 16. Additional Scope (P1)

File attachments are not part of the MVP.

In a later phase, add file upload/download, external object storage such
as S3, attachment metadata in PostgreSQL, and file cleanup during
permanent task deletion.

Other features such as notifications, comments, analytics, and external
integrations remain outside the current scope.

## 17. Definition of Done

The MVP is complete when an approved member can authenticate through
OTP, remain logged in across browser restarts, create and manage sprints
and tasks, use Board and List views, manage dependencies, search
globally, and delete or restore tasks---with all role restrictions and
business rules enforced by NestJS and all data persisted in PostgreSQL.

**Final technical direction:** Build a NestJS modular monolith, use
PostgreSQL as the source of truth, and keep React responsible for
presentation and interactions. No microservices, Redis, Kafka, or
WebSockets are required for the MVP.
