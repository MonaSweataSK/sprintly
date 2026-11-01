-- AlterTable
ALTER TABLE "tasks" ALTER COLUMN "task_key" SET DEFAULT ('TASK-'::text || nextval('task_key_seq'::regclass)::text);
