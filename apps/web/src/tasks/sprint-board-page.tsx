import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCorners,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import {
  AlertCircle,
  ArrowLeft,
  CalendarDays,
  GripVertical,
  LoaderCircle,
  RefreshCw,
} from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link, Navigate, useParams } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import {
  ApiError,
  updateTask,
  type SprintBoard,
  type SprintBoardTask,
  type TaskInput,
  type TaskStatus,
} from '@/lib/api'
import { useSprintBoard } from './task-hooks'

type GroupBy = 'status' | 'assignee' | 'dueDate'
type SortBy = 'taskKey' | 'title' | 'startDate' | 'endDate' | 'createdAt' | 'updatedAt'
interface BoardColumn {
  id: string
  title: string
  description?: string
  tasks: SprintBoardTask[]
  target: { status?: TaskStatus; assigneeId?: string | null; endDate?: string | null }
}

const statusColumns: { id: TaskStatus; title: string }[] = [
  { id: 'TODO', title: 'To Do' },
  { id: 'IN_PROGRESS', title: 'In Progress' },
  { id: 'IN_REVIEW', title: 'In Review' },
  { id: 'DONE', title: 'Done' },
]

const dueBuckets = [
  { id: 'overdue', title: 'Overdue', daysFromToday: -1 },
  { id: 'today', title: 'Due Today', daysFromToday: 0 },
  { id: 'soon', title: 'Due in 1–3 Days', daysFromToday: 1 },
  { id: 'week', title: 'Due in 4–7 Days', daysFromToday: 4 },
  { id: 'later', title: 'Due Later', daysFromToday: 8 },
  { id: 'none', title: 'No Due Date', daysFromToday: null },
] as const

const sortOptions: { value: SortBy; label: string }[] = [
  { value: 'taskKey', label: 'Task key' },
  { value: 'title', label: 'Title' },
  { value: 'startDate', label: 'Start date' },
  { value: 'endDate', label: 'Due date' },
  { value: 'createdAt', label: 'Created date' },
  { value: 'updatedAt', label: 'Updated date' },
]

const inputClassName =
  'h-10 rounded-md border bg-white px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring'

function kolkataDate(date = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date)
  const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]))
  return `${values.year}-${values.month}-${values.day}`
}

function shiftDate(date: string, days: number): string {
  const shifted = new Date(`${date}T00:00:00.000Z`)
  shifted.setUTCDate(shifted.getUTCDate() + days)
  return shifted.toISOString().slice(0, 10)
}

function dueBucketId(endDate: string | null, today: string): string {
  if (!endDate) return 'none'
  const difference =
    (Date.parse(`${endDate.slice(0, 10)}T00:00:00.000Z`) -
      Date.parse(`${today}T00:00:00.000Z`)) /
    86_400_000
  if (difference < 0) return 'overdue'
  if (difference === 0) return 'today'
  if (difference <= 3) return 'soon'
  if (difference <= 7) return 'week'
  return 'later'
}

function taskDate(value: string | null): string {
  if (!value) return 'No due date'
  return new Date(value).toLocaleDateString(undefined, {
    timeZone: 'UTC',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

function sortTasks(tasks: SprintBoardTask[], sortBy: SortBy): SprintBoardTask[] {
  return [...tasks].sort((left, right) => {
    const leftValue = left[sortBy]
    const rightValue = right[sortBy]
    if (leftValue === null || rightValue === null) {
      if (leftValue === rightValue) return left.taskKey.localeCompare(right.taskKey)
      return leftValue === null ? 1 : -1
    }
    return String(leftValue).localeCompare(String(rightValue), undefined, {
      numeric: true,
      sensitivity: 'base',
    })
  })
}

function columnsFor(
  board: SprintBoard,
  groupBy: GroupBy,
  today: string,
  sortBy: SortBy,
): BoardColumn[] {
  let columns: BoardColumn[]
  if (groupBy === 'status') {
    columns = statusColumns.map(({ id, title }) => ({
      id: `status:${id}`,
      title,
      tasks: board.tasks.filter((task) => task.status === id),
      target: { status: id },
    }))
  } else if (groupBy === 'assignee') {
    const members = [
      ...board.activeTeamMembers,
      ...board.outsideTeamAssignees.filter(
        (outside) =>
          !board.activeTeamMembers.some((member) => member.id === outside.id),
      ),
    ]
    columns = [
      ...members.map((member) => ({
        id: `assignee:${member.id}`,
        title: member.name,
        tasks: board.tasks.filter((task) => task.assigneeId === member.id),
        target: { assigneeId: member.id },
      })),
      {
        id: 'assignee:unassigned',
        title: 'Unassigned',
        tasks: board.tasks.filter((task) => task.assigneeId === null),
        target: { assigneeId: null },
      },
    ]
  } else {
    columns = dueBuckets.map(({ id, title, daysFromToday }) => ({
      id: `due:${id}`,
      title,
      tasks: board.tasks.filter((task) => dueBucketId(task.endDate, today) === id),
      target: {
        endDate:
          daysFromToday === null ? null : shiftDate(today, daysFromToday),
      },
    }))
  }

  return columns.map((column) => ({
    ...column,
    tasks: sortTasks(column.tasks, sortBy),
  }))
}

function BoardTaskCard({ task, disabled }: { task: SprintBoardTask; disabled: boolean }) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, isDragging } =
    useDraggable({ id: task.id, disabled })
  const blockedBy = task.prerequisites.filter(
    ({ dependsOnTask }) =>
      dependsOnTask.deletedAt !== null || dependsOnTask.status !== 'DONE',
  )

  return (
    <div
      ref={setNodeRef}
      className={isDragging ? 'opacity-40' : ''}
    >
      <Card className="bg-white shadow-sm">
        <CardContent className="space-y-3 p-3">
        <div className="flex items-start gap-2">
          {!disabled && (
            <button
              ref={setActivatorNodeRef}
              type="button"
              className="mt-0.5 cursor-grab rounded p-1 text-muted-foreground hover:bg-muted active:cursor-grabbing"
              aria-label={`Drag ${task.taskKey}`}
              {...attributes}
              {...listeners}
            >
              <GripVertical aria-hidden="true" size={16} />
            </button>
          )}
          <div className="min-w-0 flex-1">
            <Link
              to={`/tasks/${encodeURIComponent(task.taskKey)}`}
              className="text-xs font-medium text-muted-foreground hover:text-foreground"
            >
              {task.taskKey}
            </Link>
            <Link
              to={`/tasks/${encodeURIComponent(task.taskKey)}`}
              className="mt-1 block break-words text-sm font-medium hover:underline"
            >
              {task.title}
            </Link>
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
          <span>{task.assignee?.name ?? 'Unassigned'}</span>
          <span className="inline-flex items-center gap-1">
            <CalendarDays aria-hidden="true" size={13} />
            {taskDate(task.endDate)}
          </span>
        </div>
        {blockedBy.length > 0 && (
          <p className="flex items-start gap-1.5 rounded bg-amber-50 px-2 py-1.5 text-xs text-amber-900">
            <AlertCircle aria-hidden="true" className="mt-0.5 shrink-0" size={13} />
            Blocked by {blockedBy.map(({ dependsOnTask }) => dependsOnTask.taskKey).join(', ')}
          </p>
        )}
        </CardContent>
      </Card>
    </div>
  )
}

function BoardColumnView({
  column,
  disabled,
}: {
  column: BoardColumn
  disabled: boolean
}) {
  const { isOver, setNodeRef } = useDroppable({
    id: column.id,
    disabled,
    data: { type: 'sprint-board-column' },
  })

  return (
    <section
      ref={setNodeRef}
      aria-label={`${column.title}, ${column.tasks.length} tasks`}
      className={`flex min-h-72 w-72 shrink-0 flex-col rounded-xl border p-3 transition-colors ${
        isOver ? 'border-primary bg-accent/60' : 'bg-muted/40'
      }`}
    >
      <div className="mb-3 flex items-center justify-between gap-2 px-1">
        <h2 className="text-sm font-semibold">{column.title}</h2>
        <span className="rounded-full bg-white px-2 py-0.5 text-xs text-muted-foreground">
          {column.tasks.length}
        </span>
      </div>
      <div className="flex flex-1 flex-col gap-2">
        {column.tasks.length ? (
          column.tasks.map((task) => (
            <BoardTaskCard key={task.id} task={task} disabled={disabled} />
          ))
        ) : (
          <p className="flex min-h-24 flex-1 items-center justify-center rounded-lg border border-dashed px-3 text-center text-xs text-muted-foreground">
            No tasks here. Drop a task to move it.
          </p>
        )}
      </div>
    </section>
  )
}

function patchForColumn(
  column: BoardColumn,
  task: SprintBoardTask,
): Partial<TaskInput> | null {
  if (column.target.status !== undefined) {
    return task.status === column.target.status
      ? null
      : { status: column.target.status }
  }
  if ('assigneeId' in column.target) {
    if (task.assigneeId === column.target.assigneeId) return null
    return { assigneeId: column.target.assigneeId }
  }
  if (task.endDate?.slice(0, 10) === column.target.endDate) return null
  return { endDate: column.target.endDate }
}

export function SprintBoardPage() {
  const { id } = useParams()
  const queryClient = useQueryClient()
  const [groupBy, setGroupBy] = useState<GroupBy>('status')
  const [sortBy, setSortBy] = useState<SortBy>('taskKey')
  const [mutationError, setMutationError] = useState<string>()
  const boardQuery = useSprintBoard(id ?? '')
  const boardKey = ['sprint-board', id]
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor),
  )

  const updateMutation = useMutation({
    mutationFn: ({ taskId, patch }: { taskId: string; patch: Partial<TaskInput> }) =>
      updateTask(taskId, patch),
    onMutate: async ({ taskId, patch }) => {
      setMutationError(undefined)
      await queryClient.cancelQueries({ queryKey: boardKey })
      const previous = queryClient.getQueryData<SprintBoard>(boardKey)
      if (previous) {
        const memberId = patch.assigneeId
        const member = memberId
          ? [...previous.activeTeamMembers, ...previous.outsideTeamAssignees].find(
              (candidate) => candidate.id === memberId,
            )
          : null
        queryClient.setQueryData<SprintBoard>(boardKey, {
          ...previous,
          tasks: previous.tasks.map((task) =>
            task.id === taskId
              ? {
                  ...task,
                  ...patch,
                  assignee:
                    patch.assigneeId === undefined
                      ? task.assignee
                      : member
                        ? { id: member.id, name: member.name, email: '' }
                        : null,
                }
              : task,
          ),
        })
      }
      return { previous }
    },
    onError: (error, _variables, context) => {
      if (context?.previous) {
        queryClient.setQueryData(boardKey, context.previous)
      }
      setMutationError(error instanceof Error ? error.message : 'Task update failed.')
    },
    onSettled: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: boardKey }),
        queryClient.invalidateQueries({ queryKey: ['tasks'] }),
        queryClient.invalidateQueries({ queryKey: ['sprints', id] }),
      ])
    },
  })

  const today = useMemo(() => kolkataDate(), [])

  if (!id) return <Navigate to="/dashboard" replace />
  if (boardQuery.isPending) {
    return (
      <p className="flex items-center gap-2 text-sm text-muted-foreground" role="status">
        <LoaderCircle aria-hidden="true" className="animate-spin" size={17} />
        Loading sprint board…
      </p>
    )
  }
  if (boardQuery.isError) {
    const notFound = boardQuery.error instanceof ApiError && boardQuery.error.status === 404
    return (
      <div className="space-y-4">
        <p className="rounded-lg border border-destructive/20 bg-destructive/5 px-3 py-2.5 text-sm text-destructive" role="alert">
          {notFound ? 'This sprint could not be found.' : boardQuery.error.message}
        </p>
        <Button variant="outline" onClick={() => void boardQuery.refetch()}>
          <RefreshCw aria-hidden="true" size={15} />
          Retry
        </Button>
      </div>
    )
  }

  const board = boardQuery.data
  const columns = columnsFor(board, groupBy, today, sortBy)
  const isReadOnly = board.sprint.status === 'COMPLETED'

  function handleDragEnd(event: DragEndEvent) {
    if (isReadOnly || !event.over) return
    const task = board.tasks.find(({ id: taskId }) => taskId === event.active.id)
    const column = columns.find(({ id: columnId }) => columnId === event.over?.id)
    if (!task || !column) return
    const patch = patchForColumn(column, task)
    if (patch) updateMutation.mutate({ taskId: task.id, patch })
  }

  return (
    <div className="space-y-6">
      <Link
        to={`/sprints/${board.sprint.id}`}
        className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft aria-hidden="true" size={15} />
        {board.sprint.name}
      </Link>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm text-muted-foreground">Sprint board</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">
            {board.sprint.name}
          </h1>
          {isReadOnly && (
            <p className="mt-2 text-sm text-muted-foreground">
              This completed sprint is read-only. Reopen it to move tasks.
            </p>
          )}
        </div>
        <div className="flex flex-wrap gap-3">
          <label className="space-y-1.5 text-xs font-medium text-muted-foreground">
            Group by
            <select
              className={`${inputClassName} block min-w-40`}
              value={groupBy}
              onChange={(event) => setGroupBy(event.target.value as GroupBy)}
            >
              <option value="status">Status</option>
              <option value="assignee">Assignee</option>
              <option value="dueDate">Due date</option>
            </select>
          </label>
          <label className="space-y-1.5 text-xs font-medium text-muted-foreground">
            Sort by
            <select
              className={`${inputClassName} block min-w-40`}
              value={sortBy}
              onChange={(event) => setSortBy(event.target.value as SortBy)}
            >
              {sortOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>

      {mutationError && (
        <p className="rounded-lg border border-destructive/20 bg-destructive/5 px-3 py-2.5 text-sm text-destructive" role="alert">
          {mutationError}
        </p>
      )}
      {updateMutation.isPending && (
        <p className="flex items-center gap-2 text-xs text-muted-foreground" role="status">
          <LoaderCircle aria-hidden="true" className="animate-spin" size={14} />
          Saving task change…
        </p>
      )}

      <DndContext
        sensors={sensors}
        collisionDetection={(args) =>
          closestCorners({
            ...args,
            droppableContainers: args.droppableContainers.filter(
              ({ data }) => data.current?.type === 'sprint-board-column',
            ),
          })
        }
        onDragEnd={handleDragEnd}
      >
        <div className="overflow-x-auto pb-4">
          <div className="flex min-h-80 w-max gap-3">
            {columns.map((column) => (
              <BoardColumnView
                key={column.id}
                column={column}
                disabled={isReadOnly || updateMutation.isPending}
              />
            ))}
          </div>
        </div>
      </DndContext>
    </div>
  )
}
