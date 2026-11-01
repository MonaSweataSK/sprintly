/*
  Warnings:

  - You are about to drop the column `sprintId` on the `task_dependencies` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "task_dependencies" DROP CONSTRAINT "task_dependencies_sprintId_fkey";

-- AlterTable
ALTER TABLE "task_dependencies" DROP COLUMN "sprintId";

-- AlterTable
ALTER TABLE "tasks" ALTER COLUMN "task_key" SET DEFAULT ('TASK-'::text || nextval('task_key_seq'::regclass)::text);
