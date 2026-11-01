import { useQuery } from '@tanstack/react-query'
import {
  ArrowLeft,
  CalendarDays,
  ClipboardList,
  LoaderCircle,
  Plus,
  RefreshCw,
  Trash2,
  X,
  Link2,
} from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom'
import { MemberSelector } from '@/components/selectors'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useToast } from '@/components/ui/toast'
import {
  ApiError,
  getSprints,
  type Task,
  type TaskInput,
  type TaskStatus,
} from '@/lib/api'
import {
  useAddTaskDependency,
  useBacklogTasks,
  useCreateTask,
  useDeleteTask,
  useRemoveTaskDependency,
  useTask,
  useTaskDependencies,
  useTasks,
  useUpdateTask,
} from './task-hooks'

const fieldClassName =
  'h-10 w-full rounded-md border bg-white px-3 text-sm outline-none placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60'

const statuses: { value: TaskStatus; label: string }[] = [
  { value: 'TODO', label: 'To Do' },
  { value: 'IN_PROGRESS', label: 'In Progress' },
  { value: 'IN_REVIEW', label: 'In Review' },
  { value: 'DONE', label: 'Done' },
]

function taskDate(value: string | null): string {
  if (!value) return 'No due date'
  return new Date(value).toLocaleDateString(undefined, {
    timeZone: 'UTC',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

function statusName(status: TaskStatus): string {
  return statuses.find((item) => item.value === status)?.label ?? status
}

function TaskError({ message }: { message: string }) {
  return (
    <p className="rounded-lg border border-destructive/20 bg-destructive/5 px-3 py-2.5 text-sm text-destructive" role="alert">
      {message}
    </p>
  )
}

export function TaskCard({ task }: { task: Task }) {
  return (
    <Link
      to={`/tasks/${encodeURIComponent(task.taskKey)}`}
      className="block rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <Card className="transition-shadow hover:shadow-md">
        <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <p className="text-xs font-medium text-muted-foreground">{task.taskKey}</p>
            <h3 className="mt-1 truncate font-semibold">{task.title}</h3>
            <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
              <span>{task.assignee?.name ?? 'Unassigned'}</span>
              <span>{task.sprint?.name ?? 'Backlog'}</span>
              <span className="inline-flex items-center gap-1">
                <CalendarDays aria-hidden="true" size={13} />
                {taskDate(task.endDate)}
              </span>
            </div>
          </div>
          <span className="shrink-0 rounded-full bg-muted px-2.5 py-1 text-xs font-medium">
            {statusName(task.status)}
          </span>
        </CardContent>
      </Card>
    </Link>
  )
}

export function TaskRow({ task }: { task: Task }) {
  return (
    <Link
      to={`/tasks/${encodeURIComponent(task.taskKey)}`}
      className="grid gap-2 rounded-lg border bg-white px-4 py-3 transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:grid-cols-[minmax(0,2fr)_1fr_1fr_1fr]"
    >
      <span className="min-w-0">
        <span className="block text-xs text-muted-foreground">{task.taskKey}</span>
        <span className="block truncate text-sm font-medium">{task.title}</span>
      </span>
      <span className="text-sm text-muted-foreground">{statusName(task.status)}</span>
      <span className="text-sm text-muted-foreground">{task.assignee?.name ?? 'Unassigned'}</span>
      <span className="text-sm text-muted-foreground">{taskDate(task.endDate)}</span>
    </Link>
  )
}

function TaskForm({
  initialValue,
  initialSprintId,
  isPending,
  error,
  submitLabel,
  onSubmit,
}: {
  initialValue?: TaskInput
  initialSprintId?: string | null
  isPending: boolean
  error?: string
  submitLabel: string
  onSubmit: (input: TaskInput) => void
}) {
  const [form, setForm] = useState<TaskInput>(() => ({
    title: initialValue?.title ?? '',
    description: initialValue?.description ?? '',
    assigneeId: initialValue?.assigneeId ?? null,
    sprintId: initialValue?.sprintId ?? initialSprintId ?? null,
    startDate: initialValue?.startDate?.slice(0, 10) ?? '',
    endDate: initialValue?.endDate?.slice(0, 10) ?? '',
    status: initialValue?.status ?? 'TODO',
  }))
  const sprintsQuery = useQuery({ queryKey: ['sprints'], queryFn: getSprints })

  return (
    <form
      className="space-y-4"
      onSubmit={(event) => {
        event.preventDefault()
        onSubmit({
          ...form,
          title: form.title.trim(),
          description: form.description?.trim() || null,
          assigneeId: form.assigneeId || null,
          sprintId: form.sprintId || null,
          startDate: form.startDate || null,
          endDate: form.endDate || null,
        })
      }}
    >
      <label className="block space-y-2 text-sm font-medium">
        Task title
        <input
          className={fieldClassName}
          value={form.title}
          maxLength={240}
          required
          disabled={isPending}
          onChange={(event) => setForm((value) => ({ ...value, title: event.target.value }))}
        />
      </label>

      <label className="block space-y-2 text-sm font-medium">
        Description
        <textarea
          className="min-h-28 w-full rounded-md border bg-white px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60"
          value={form.description ?? ''}
          maxLength={10000}
          disabled={isPending}
          onChange={(event) => setForm((value) => ({ ...value, description: event.target.value }))}
        />
      </label>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block space-y-2 text-sm font-medium">
          Assignee
          <MemberSelector
            id="task-assignee"
            value={form.assigneeId ?? ''}
            disabled={isPending}
            onChange={(assigneeId) => setForm((value) => ({ ...value, assigneeId: assigneeId || null }))}
          />
        </label>
        <label className="block space-y-2 text-sm font-medium">
          Sprint
          <select
            className={fieldClassName}
            value={form.sprintId ?? ''}
            disabled={isPending || sprintsQuery.isPending || sprintsQuery.isError}
            onChange={(event) => setForm((value) => ({ ...value, sprintId: event.target.value || null }))}
          >
            <option value="">Backlog (no sprint)</option>
            {sprintsQuery.data
              ?.filter(
                (sprint) =>
                  sprint.status !== 'COMPLETED' || sprint.id === form.sprintId,
              )
              .map((sprint) => (
                <option
                  key={sprint.id}
                  value={sprint.id}
                  disabled={sprint.status === 'COMPLETED'}
                >
                  {sprint.name}
                  {sprint.status === 'COMPLETED' ? ' (Completed)' : ''}
                </option>
              ))}
          </select>
          {sprintsQuery.isError && <span className="block text-xs text-destructive" role="alert">{sprintsQuery.error.message}</span>}
        </label>
        <label className="block space-y-2 text-sm font-medium">
          Status
          <select
            className={fieldClassName}
            value={form.status ?? 'TODO'}
            disabled={isPending}
            onChange={(event) => setForm((value) => ({ ...value, status: event.target.value as TaskStatus }))}
          >
            {statuses.map((status) => <option key={status.value} value={status.value}>{status.label}</option>)}
          </select>
        </label>
        <div className="hidden sm:block" />
        <label className="block space-y-2 text-sm font-medium">
          Start date
          <input
            className={fieldClassName}
            type="date"
            value={form.startDate ?? ''}
            max={form.endDate || undefined}
            disabled={isPending}
            onChange={(event) => setForm((value) => ({ ...value, startDate: event.target.value || null }))}
          />
        </label>
        <label className="block space-y-2 text-sm font-medium">
          End date
          <input
            className={fieldClassName}
            type="date"
            value={form.endDate ?? ''}
            min={form.startDate || undefined}
            disabled={isPending}
            onChange={(event) => setForm((value) => ({ ...value, endDate: event.target.value || null }))}
          />
        </label>
      </div>

      {error && <TaskError message={error} />}
      <Button type="submit" disabled={isPending || !form.title.trim() || Boolean(form.startDate && form.endDate && form.endDate < form.startDate)}>
        {isPending ? <LoaderCircle aria-hidden="true" className="animate-spin" size={16} /> : <Plus aria-hidden="true" size={16} />}
        {submitLabel}
      </Button>
    </form>
  )
}

function TaskCreateDrawer({
  initialSprintId,
  onClose,
  onCreated,
}: {
  initialSprintId?: string | null
  onClose: () => void
  onCreated: (task: Task) => void
}) {
  const createMutation = useCreateTask()

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !createMutation.isPending) onClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [createMutation.isPending, onClose])

  return (
    <div className="fixed inset-0 z-40">
      <button
        type="button"
        className="absolute inset-0 size-full cursor-default bg-slate-950/40"
        aria-label="Close create task form"
        disabled={createMutation.isPending}
        onClick={onClose}
      />
      <aside
        role="dialog"
        aria-modal="true"
        aria-labelledby="create-task-title"
        className="absolute inset-y-0 right-0 flex w-full max-w-xl flex-col bg-white shadow-2xl motion-safe:animate-[sprint-slide-in_200ms_ease-out]"
      >
        <div className="flex items-start justify-between border-b px-6 py-5">
          <div>
            <p className="text-sm text-muted-foreground">Task management</p>
            <h2
              id="create-task-title"
              className="mt-1 text-xl font-semibold tracking-tight"
            >
              Create task
            </h2>
          </div>
          <Button
            type="button"
            size="icon"
            variant="ghost"
            aria-label="Close create task form"
            disabled={createMutation.isPending}
            onClick={onClose}
          >
            <X aria-hidden="true" size={18} />
          </Button>
        </div>
        <div className="flex-1 overflow-y-auto p-6">
          <TaskForm
            initialSprintId={initialSprintId}
            submitLabel="Create task"
            isPending={createMutation.isPending}
            error={createMutation.error?.message}
            onSubmit={(input) =>
              createMutation.mutate(input, { onSuccess: onCreated })
            }
          />
        </div>
      </aside>
    </div>
  )
}

function TaskCollection({
  tasks,
  isPending,
  isError,
  error,
  onRetry,
  emptyMessage,
}: {
  tasks?: Task[]
  isPending: boolean
  isError: boolean
  error?: Error | null
  onRetry: () => void
  emptyMessage: string
}) {
  if (isPending) {
    return <p className="flex items-center gap-2 text-sm text-muted-foreground" role="status"><LoaderCircle aria-hidden="true" className="animate-spin" size={16} />Loading tasks…</p>
  }
  if (isError) {
    return <div className="flex items-center gap-3"><TaskError message={error?.message ?? 'Could not load tasks.'} /><Button variant="outline" size="sm" onClick={onRetry}><RefreshCw aria-hidden="true" size={15} />Retry</Button></div>
  }
  if (!tasks?.length) return <p className="text-sm text-muted-foreground">{emptyMessage}</p>

  return (
    <div className="space-y-2">
      <div className="hidden grid-cols-[minmax(0,2fr)_1fr_1fr_1fr] px-4 text-xs font-medium uppercase tracking-wide text-muted-foreground sm:grid">
        <span>Task</span><span>Status</span><span>Assignee</span><span>Due date</span>
      </div>
      {tasks.map((task) => <TaskRow key={task.id} task={task} />)}
    </div>
  )
}

export function BacklogPage() {
  const { showToast } = useToast()
  const tasksQuery = useBacklogTasks()
  const [isCreating, setIsCreating] = useState(false)

  return (
    <div className="space-y-6">
      <Link to="/dashboard" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft aria-hidden="true" size={15} />Sprints</Link>
      <div className="flex items-end justify-between gap-4">
        <div><p className="text-sm text-muted-foreground">Workspace tasks</p><h1 className="mt-1 text-2xl font-semibold tracking-tight">Backlog</h1><p className="mt-2 text-sm text-muted-foreground">Tasks not currently assigned to a sprint.</p></div>
        <Button onClick={() => setIsCreating(true)}><Plus aria-hidden="true" size={16} />Create task</Button>
      </div>
      {isCreating && (
        <TaskCreateDrawer
          onClose={() => setIsCreating(false)}
          onCreated={(task) => {
            if (task.sprintId) showToast('Successfully assigned to sprint.')
            setIsCreating(false)
          }}
        />
      )}
      <TaskCollection tasks={tasksQuery.data} isPending={tasksQuery.isPending} isError={tasksQuery.isError} error={tasksQuery.error} onRetry={() => void tasksQuery.refetch()} emptyMessage="No backlog tasks yet." />
    </div>
  )
}

export function SprintTaskList({ sprintId, canCreate }: { sprintId: string; canCreate: boolean }) {
  const { showToast } = useToast()
  const tasksQuery = useTasks(sprintId)
  const [isCreating, setIsCreating] = useState(false)

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-4">
          <CardTitle className="flex items-center gap-2"><ClipboardList aria-hidden="true" size={17} />Sprint tasks</CardTitle>
          {canCreate && <Button size="sm" onClick={() => setIsCreating(true)}><Plus aria-hidden="true" size={15} />Create task</Button>}
        </CardHeader>
        <CardContent>
          <TaskCollection tasks={tasksQuery.data} isPending={tasksQuery.isPending} isError={tasksQuery.isError} error={tasksQuery.error} onRetry={() => void tasksQuery.refetch()} emptyMessage="No tasks are assigned to this sprint yet." />
        </CardContent>
      </Card>
      {isCreating && (
        <TaskCreateDrawer
          initialSprintId={sprintId}
          onClose={() => setIsCreating(false)}
          onCreated={(task) => {
            if (task.sprintId) showToast('Successfully assigned to sprint.')
            setIsCreating(false)
          }}
        />
      )}
    </>
  )
}

function taskToInput(task: Task): TaskInput {
  return {
    title: task.title,
    description: task.description,
    assigneeId: task.assigneeId,
    sprintId: task.sprintId,
    startDate: task.startDate?.slice(0, 10) ?? null,
    endDate: task.endDate?.slice(0, 10) ?? null,
    status: task.status,
  }
}

function TaskDependenciesPanel({
  task,
  readOnly,
}: {
  task: Task
  readOnly: boolean
}) {
  const [selectedPrerequisite, setSelectedPrerequisite] = useState('')
  const dependenciesQuery = useTaskDependencies(task.id)
  const allTasksQuery = useTasks()
  const addMutation = useAddTaskDependency()
  const removeMutation = useRemoveTaskDependency()
  const existingPrerequisites = new Set(
    dependenciesQuery.data?.map(({ dependsOnTaskId }) => dependsOnTaskId),
  )
  const options = allTasksQuery.data?.filter(
    (candidate) =>
      candidate.id !== task.id && !existingPrerequisites.has(candidate.id),
  )
  const blockingDependencies =
    dependenciesQuery.data?.filter(
      ({ dependsOnTask }) =>
        dependsOnTask.deletedAt !== null || dependsOnTask.status !== 'DONE',
    ) ?? []

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Link2 aria-hidden="true" size={17} />
          Prerequisites
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {blockingDependencies.length > 0 && (
          <div
            className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950"
            role="status"
          >
            <p className="font-medium">
              This task is blocked until these prerequisites are completed:
            </p>
            <ul className="mt-2 list-inside list-disc space-y-1">
              {blockingDependencies.map(({ id, dependsOnTask }) => (
                <li key={id}>
                  {dependsOnTask.deletedAt ? (
                    <span>
                      {dependsOnTask.taskKey} — {dependsOnTask.title} (deleted)
                    </span>
                  ) : (
                    <Link
                      className="font-medium underline underline-offset-2"
                      to={`/tasks/${encodeURIComponent(dependsOnTask.taskKey)}`}
                    >
                      {dependsOnTask.taskKey} — {dependsOnTask.title}
                    </Link>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}

        {dependenciesQuery.isPending ? (
          <p className="text-sm text-muted-foreground" role="status">
            Loading prerequisites…
          </p>
        ) : dependenciesQuery.isError ? (
          <TaskError message={dependenciesQuery.error.message} />
        ) : dependenciesQuery.data?.length ? (
          <ul className="space-y-2">
            {dependenciesQuery.data.map(({ id, dependsOnTask }) => (
              <li
                key={id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-md border px-3 py-2.5"
              >
                <span className="min-w-0">
                  {dependsOnTask.deletedAt ? (
                    <span className="text-sm font-medium">
                      {dependsOnTask.taskKey} — {dependsOnTask.title} (deleted)
                    </span>
                  ) : (
                    <Link
                      className="text-sm font-medium underline-offset-2 hover:underline"
                      to={`/tasks/${encodeURIComponent(dependsOnTask.taskKey)}`}
                    >
                      {dependsOnTask.taskKey} — {dependsOnTask.title}
                    </Link>
                  )}
                  <span className="ml-2 text-xs text-muted-foreground">
                    {dependsOnTask.deletedAt
                      ? 'Deleted'
                      : statusName(dependsOnTask.status)}
                  </span>
                </span>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={readOnly || removeMutation.isPending}
                  onClick={() =>
                    removeMutation.mutate({
                      taskId: task.id,
                      dependencyId: id,
                    })
                  }
                >
                  Remove
                </Button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">
            No prerequisites have been added.
          </p>
        )}

        {removeMutation.error && (
          <TaskError message={removeMutation.error.message} />
        )}

        <form
          className="flex flex-col gap-2 sm:flex-row"
          onSubmit={(event) => {
            event.preventDefault()
            if (!selectedPrerequisite) return
            addMutation.mutate(
              { taskId: task.id, dependsOnTaskId: selectedPrerequisite },
              { onSuccess: () => setSelectedPrerequisite('') },
            )
          }}
        >
          <select
            className={fieldClassName}
            value={selectedPrerequisite}
            disabled={
              readOnly ||
              allTasksQuery.isPending ||
              allTasksQuery.isError ||
              dependenciesQuery.isPending ||
              addMutation.isPending
            }
            onChange={(event) => setSelectedPrerequisite(event.target.value)}
            aria-label="Select prerequisite task"
          >
            <option value="">Select a prerequisite task</option>
            {options?.map((candidate) => (
              <option key={candidate.id} value={candidate.id}>
                {candidate.taskKey} — {candidate.title}
              </option>
            ))}
          </select>
          <Button
            type="submit"
            variant="outline"
            disabled={readOnly || !selectedPrerequisite || addMutation.isPending}
          >
            {addMutation.isPending ? (
              <LoaderCircle
                aria-hidden="true"
                className="animate-spin"
                size={15}
              />
            ) : (
              <Plus aria-hidden="true" size={15} />
            )}
            Add prerequisite
          </Button>
        </form>
        {allTasksQuery.isError && (
          <TaskError message={allTasksQuery.error.message} />
        )}
        {addMutation.error && <TaskError message={addMutation.error.message} />}
        {readOnly && (
          <p className="text-xs text-muted-foreground">
            Reopen the sprint before changing task prerequisites.
          </p>
        )}
      </CardContent>
    </Card>
  )
}

export function TaskDetailsPage() {
  const { taskKey } = useParams()
  const navigate = useNavigate()
  const { showToast } = useToast()
  const taskQuery = useTask(taskKey ?? '')
  const updateMutation = useUpdateTask()
  const deleteMutation = useDeleteTask()

  if (!taskKey) return <Navigate to="/backlog" replace />
  if (taskQuery.isPending) return <p className="flex items-center gap-2 text-sm text-muted-foreground" role="status"><LoaderCircle aria-hidden="true" className="animate-spin" size={16} />Loading task…</p>
  if (taskQuery.isError) {
    const notFound = taskQuery.error instanceof ApiError && taskQuery.error.status === 404
    return <div className="space-y-4"><TaskError message={notFound ? 'This task could not be found.' : taskQuery.error.message} /><Button variant="outline" onClick={() => navigate('/backlog')}><ArrowLeft aria-hidden="true" size={15} />Back to backlog</Button></div>
  }

  const task = taskQuery.data
  return (
    <div className="space-y-6">
      <Link to={task.sprintId ? `/sprints/${task.sprintId}` : '/backlog'} className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft aria-hidden="true" size={15} />{task.sprint?.name ?? 'Backlog'}</Link>
      <div className="flex flex-wrap items-end justify-between gap-4"><div><p className="text-sm text-muted-foreground">{task.taskKey}</p><h1 className="mt-1 text-2xl font-semibold tracking-tight">{task.title}</h1></div><Button variant="outline" className="border-destructive/30 text-destructive hover:bg-destructive/5 hover:text-destructive" disabled={deleteMutation.isPending || task.sprint?.status === 'COMPLETED'} onClick={() => { if (window.confirm(`Move ${task.taskKey} to the trash?`)) deleteMutation.mutate(task.id, { onSuccess: () => navigate(task.sprintId ? `/sprints/${task.sprintId}` : '/backlog') }) }}>{deleteMutation.isPending ? <LoaderCircle aria-hidden="true" className="animate-spin" size={16} /> : <Trash2 aria-hidden="true" size={16} />}Delete</Button></div>
      {task.sprint?.status === 'COMPLETED' && <TaskError message="This task is read-only while its sprint is completed. Reopen the sprint before editing it." />}
      {(updateMutation.error || deleteMutation.error) && <TaskError message={updateMutation.error?.message ?? deleteMutation.error?.message ?? 'Task update failed.'} />}
      <Card><CardHeader><CardTitle>Task details</CardTitle></CardHeader><CardContent><TaskForm key={`${task.id}-${task.updatedAt}`} initialValue={taskToInput(task)} submitLabel="Save changes" isPending={updateMutation.isPending || task.sprint?.status === 'COMPLETED'} onSubmit={(input) => updateMutation.mutate({ id: task.id, input }, { onSuccess: (updatedTask) => {
        if (updatedTask.sprintId && updatedTask.sprintId !== task.sprintId) {
          showToast('Successfully assigned to sprint.')
          navigate(`/sprints/${updatedTask.sprintId}`)
        }
      } })} /></CardContent></Card>
      <TaskDependenciesPanel
        task={task}
        readOnly={task.sprint?.status === 'COMPLETED'}
      />
      <p className="text-xs text-muted-foreground">Created {new Date(task.createdAt).toLocaleString()} by {task.createdBy?.name ?? 'a former member'}.</p>
    </div>
  )
}
