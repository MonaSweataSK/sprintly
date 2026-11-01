DROP INDEX "tasks_sprint_id_deleted_at_status_idx";
DROP INDEX "tasks_assignee_id_deleted_at_idx";

ALTER TABLE "tasks" DROP COLUMN "deleted_at";

CREATE INDEX "tasks_sprint_id_status_idx" ON "tasks"("sprint_id", "status");
CREATE INDEX "tasks_assignee_id_idx" ON "tasks"("assignee_id");
