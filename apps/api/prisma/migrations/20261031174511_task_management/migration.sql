-- Task keys are allocated from a sequence so deleted keys can never be reused.
CREATE SEQUENCE "task_key_seq" START WITH 101 INCREMENT BY 1;

-- CreateEnum
CREATE TYPE "TaskStatus" AS ENUM ('TODO', 'IN_PROGRESS', 'IN_REVIEW', 'DONE');

-- CreateTable
CREATE TABLE "tasks" (
    "id" UUID NOT NULL,
    "task_key" VARCHAR(32) NOT NULL DEFAULT ('TASK-'::text || nextval('task_key_seq'::regclass)::text),
    "title" VARCHAR(240) NOT NULL,
    "description" VARCHAR(10000),
    "assignee_id" UUID,
    "sprint_id" UUID,
    "start_date" DATE,
    "end_date" DATE,
    "status" "TaskStatus" NOT NULL DEFAULT 'TODO',
    "created_by" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "deleted_at" TIMESTAMPTZ(3),

    CONSTRAINT "tasks_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "tasks_task_key_key" ON "tasks"("task_key");

-- CreateIndex
CREATE INDEX "tasks_sprint_id_deleted_at_status_idx" ON "tasks"("sprint_id", "deleted_at", "status");

-- CreateIndex
CREATE INDEX "tasks_assignee_id_deleted_at_idx" ON "tasks"("assignee_id", "deleted_at");

-- CreateIndex
CREATE INDEX "tasks_created_at_idx" ON "tasks"("created_at");

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_assignee_id_fkey" FOREIGN KEY ("assignee_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_sprint_id_fkey" FOREIGN KEY ("sprint_id") REFERENCES "sprints"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
