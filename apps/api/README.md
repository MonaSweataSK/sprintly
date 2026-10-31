# Sprintly API

## Local setup

From the repository root:

```sh
npm install
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env
npm run db:up
npm run db:migrate
```

In `apps/api/.env`, set distinct randomly generated values for `JWT_SECRET`
and `OTP_HASH_SECRET` (at least 32 characters). For example, run
`openssl rand -base64 48` separately for each value. Configure
`SMTP_HOST`, `SMTP_PORT`, and `SMTP_FROM`; configure both `SMTP_USER` and
`SMTP_PASSWORD` when the provider requires authentication.

The initial administrator is created separately from public sign-in:

1. Set `ADMIN_NAME` and `ADMIN_EMAIL` in `apps/api/.env`.
2. Run `npm run seed:admin --workspace=@sprintly/api`.

The script refuses to create another administrator once one exists. No public
signup endpoint is provided.

## Authentication

The API routes are under `/api/v1/auth`: `request-otp`, `verify-otp`, `refresh`,
`logout`, and `me`. OTP challenges expire after five minutes, allow at most
five verification attempts, and are stored as keyed HMAC hashes. Approved
active users receive OTP mail through SMTP.

Access tokens last 15 minutes; rotating refresh tokens and server-side sessions
expire after 30 days of inactivity. Tokens are stored in Secure, HttpOnly,
SameSite cookies. Authenticated requests reload the active user and role from
PostgreSQL. For admin-only endpoints, use
`@UseGuards(SessionAuthGuard, RolesGuard)` and `@Roles(UserRole.ADMIN)`.

## Members and teams

Administrators can list/create members at `/api/v1/members`, update a member
with `PATCH /api/v1/members/:id`, and deactivate one with
`DELETE /api/v1/members/:id`. Deactivation revokes all active sessions and
removes the member from team memberships. Admins cannot demote or deactivate
the last active administrator. Member emails are trimmed and stored in
lowercase; duplicate addresses return a conflict.

Permanent deletion is a separate Admin-only operation:
`DELETE /api/v1/members/:id/permanent`. It cannot delete the requesting admin's
own account or the last active administrator. Database cascades remove the
member's OTP challenges, sessions, and team memberships.

Administrators can manage teams at `/api/v1/teams` and replace a team's
membership through `PUT /api/v1/teams/:id/members` with a `memberIds` array,
or add/remove one member at a time through `POST /api/v1/teams/:id/members`
and `DELETE /api/v1/teams/:id/members/:memberId`. Team names are unique, and
only active members may be assigned. Signed-in
regular users can use `/api/v1/assignee-options` and `/api/v1/team-options`,
which return minimal selection data without exposing the administrative
directory.

Run `npm run start:dev --workspace=@sprintly/api` to start the API.
