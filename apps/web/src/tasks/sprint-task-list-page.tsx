import { useState } from 'react'
import { Link, Navigate, useParams } from 'react-router-dom'
import {
  ArrowLeft,
  LoaderCircle,
  RefreshCw,
} from 'lucide-react'
import { MemberSelector } from '@/components/selectors'
import { Button } from '@/components/ui/button'
import { SprintViewSelector } from './sprint-view-selector'
import {
  ApiError,
  type SprintTaskPageQuery,
  type Task,
  type TaskInput,
  type TaskSortField,
  type TaskStatus,
} from '@/lib/api'
import { useUpdateTask, useSprintTaskPage } from './task-hooks'

const taskStatuses: { value: TaskStatus; label: string }[] = [
  { value: 'TODO', label: 'To Do' },
  { value: 'IN_PROGRESS', label: 'In Progress' },
  { value: 'IN_REVIEW', label: 'In Review' },
  { value: 'DONE', label: 'Done' },
]

const sortOptions: { value: TaskSortField; label: string }[] = [
  { value: 'taskKey', label: 'Task key' },
  { value: 'title', label: 'Title' },
  { value: 'startDate', label: 'Start date' },
  { value: 'endDate', label: 'Due date' },
  { value: 'createdAt', label: 'Created date' },
  { value: 'updatedAt', label: 'Updated date' },
]

const controlClass =
  'h-9 rounded-md border bg-white px-2.5 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60'

function TaskListRow({
  task,
  disabled,
  onUpdate,
}: {
  task: Task
  disabled: boolean
  onUpdate: (task: Task, patch: Partial<TaskInput>) => void
}) {
  return (
    <div className="grid min-w-[980px] grid-cols-[minmax(220px,2fr)_140px_170px_140px_135px_135px] items-center gap-3 border-t bg-white px-3 py-2.5">
      <div className="min-w-0">
        <Link
          to={`/tasks/${encodeURIComponent(task.taskKey)}`}
          className="block truncate text-xs text-muted-foreground hover:text-foreground"
        >
          {task.taskKey}
        </Link>
        <Link
          to={`/tasks/${encodeURIComponent(task.taskKey)}`}
          className="mt-0.5 block truncate text-sm font-medium hover:underline"
        >
          {task.title}
        </Link>
      </div>
      <select
        id={`status-${task.id}`}
        aria-label={`Status for ${task.taskKey}`}
        className={controlClass}
        value={task.status}
        disabled={disabled}
        onChange={(event) => onUpdate(task, { status: event.target.value as TaskStatus })}
      >
        {taskStatuses.map((status) => (
          <option key={status.value} value={status.value}>{status.label}</option>
        ))}
      </select>
      <div>
        <label className="sr-only" htmlFor={`assignee-${task.id}`}>Assignee for {task.taskKey}</label>
        <MemberSelector
          id={`assignee-${task.id}`}
          value={task.assigneeId ?? ''}
          disabled={disabled}
          onChange={(assigneeId) => onUpdate(task, { assigneeId: assigneeId || null })}
        />
      </div>
      <span className="truncate text-sm text-muted-foreground" title={task.sprint?.name ?? 'Backlog'}>
        {task.sprint?.name ?? 'Backlog'}
      </span>
      <input
        id={`start-${task.id}`}
        aria-label={`Start date for ${task.taskKey}`}
        className={controlClass}
        type="date"
        value={task.startDate?.slice(0, 10) ?? ''}
        disabled={disabled}
        onChange={(event) => onUpdate(task, { startDate: event.target.value || null })}
      />
      <input
        id={`due-${task.id}`}
        aria-label={`Due date for ${task.taskKey}`}
        className={controlClass}
        type="date"
        value={task.endDate?.slice(0, 10) ?? ''}
        disabled={disabled}
        onChange={(event) => onUpdate(task, { endDate: event.target.value || null })}
      />
    </div>
  )
}

export function SprintTaskListPage() {
  const { id } = useParams()
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)
  const [sortBy, setSortBy] = useState<TaskSortField>('taskKey')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc')
  const query: SprintTaskPageQuery = { page, pageSize, sortBy, sortOrder }
  const tasksQuery = useSprintTaskPage(id ?? '', query)
  const updateMutation = useUpdateTask()

  if (!id) return <Navigate to="/dashboard" replace />
  if (tasksQuery.isPending) {
    return <p className="flex items-center gap-2 text-sm text-muted-foreground" role="status"><LoaderCircle aria-hidden="true" className="animate-spin" size={16} />Loading sprint tasks…</p>
  }
  if (tasksQuery.isError) {
    const notFound = tasksQuery.error instanceof ApiError && tasksQuery.error.status === 404
    return (
      <div className="space-y-4">
        <p className="rounded-lg border border-destructive/20 bg-destructive/5 px-3 py-2.5 text-sm text-destructive" role="alert">
          {notFound ? 'This sprint could not be found.' : tasksQuery.error.message}
        </p>
        <Button variant="outline" onClick={() => void tasksQuery.refetch()}><RefreshCw aria-hidden="true" size={15} />Retry</Button>
      </div>
    )
  }

  const { sprint, tasks, pagination } = tasksQuery.data
  const disabled = updateMutation.isPending || sprint.status === 'COMPLETED'
  const updateTask = (task: Task, patch: Partial<TaskInput>) => {
    updateMutation.mutate({ id: task.id, input: patch })
  }
  const firstItem = pagination.total === 0 ? 0 : (page - 1) * pageSize + 1
  const lastItem = Math.min(page * pageSize, pagination.total)

  return (
    <div className="space-y-6">
      <Link to={`/sprints/${sprint.id}`} className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft aria-hidden="true" size={15} />{sprint.name}
      </Link>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm text-muted-foreground">Sprint list</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">{sprint.name}</h1>
          {sprint.status === 'COMPLETED' && <p className="mt-2 text-sm text-muted-foreground">Completed sprint tasks are read-only.</p>}
        </div>
        <SprintViewSelector sprintId={sprint.id} value="list" />
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <label className="space-y-1.5 text-xs font-medium text-muted-foreground">
          Sort by
          <select className={`${controlClass} block min-w-36`} value={sortBy} onChange={(event) => { setSortBy(event.target.value as TaskSortField); setPage(1) }}>
            {sortOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
        </label>
        <label className="space-y-1.5 text-xs font-medium text-muted-foreground">
          Order
          <select className={`${controlClass} block`} value={sortOrder} onChange={(event) => { setSortOrder(event.target.value as 'asc' | 'desc'); setPage(1) }}>
            <option value="asc">Ascending</option>
            <option value="desc">Descending</option>
          </select>
        </label>
        <label className="space-y-1.5 text-xs font-medium text-muted-foreground">
          Rows per page
          <select className={`${controlClass} block`} value={pageSize} onChange={(event) => { setPageSize(Number(event.target.value)); setPage(1) }}>
            {[10, 20, 50].map((size) => <option key={size} value={size}>{size}</option>)}
          </select>
        </label>
      </div>

      {updateMutation.isError && <p className="rounded-lg border border-destructive/20 bg-destructive/5 px-3 py-2.5 text-sm text-destructive" role="alert">{updateMutation.error.message}</p>}
      {sprint.status === 'COMPLETED' && <p className="text-xs text-muted-foreground">Reopen the sprint to make inline edits.</p>}

      <div className="space-y-3">
        {tasks.length ? (
          <div className="overflow-x-auto rounded-xl border">
            <div className="grid min-w-[980px] grid-cols-[minmax(220px,2fr)_140px_170px_140px_135px_135px] gap-3 bg-muted/50 px-3 py-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              <span>Task</span><span>Status</span><span>Assignee</span><span>Sprint</span><span>Start date</span><span>Due date</span>
            </div>
            {tasks.map((task) => (
              <TaskListRow key={task.id} task={task} disabled={disabled} onUpdate={updateTask} />
            ))}
          </div>
        ) : (
          <p className="rounded-lg border border-dashed px-4 py-8 text-center text-sm text-muted-foreground">No tasks are assigned to this sprint yet.</p>
        )}
      </div>

      <div className="flex flex-col gap-3 border-t pt-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-muted-foreground">Showing {firstItem}–{lastItem} of {pagination.total} tasks</p>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" disabled={page <= 1 || tasksQuery.isFetching} onClick={() => setPage((current) => Math.max(1, current - 1))}>Previous</Button>
          <span className="min-w-24 text-center text-sm text-muted-foreground">Page {page} of {Math.max(pagination.totalPages, 1)}</span>
          <Button variant="outline" size="sm" disabled={page >= pagination.totalPages || tasksQuery.isFetching} onClick={() => setPage((current) => current + 1)}>Next</Button>
        </div>
      </div>
    </div>
  )
}
