import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  ArrowLeft,
  CalendarDays,
  Clock3,
  LoaderCircle,
  Pencil,
  Plus,
  RefreshCw,
  Trash2,
  X,
} from 'lucide-react'
import { useEffect, useState } from 'react'
import {
  Link,
  Navigate,
  useNavigate,
  useParams,
} from 'react-router-dom'
import { TeamSelector } from '@/components/selectors'
import { SprintTaskList } from '@/tasks/task-pages'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  ApiError,
  createSprint,
  deleteSprint,
  getSprint,
  getSprints,
  getTeamOptions,
  setSprintStatus,
  updateSprint,
  type Sprint,
  type SprintInput,
  type SprintStatus,
} from '@/lib/api'

const inputClassName =
  'h-10 w-full rounded-md border bg-white px-3 text-sm outline-none placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring'

function localDateInput(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function defaultSprintInput(): SprintInput {
  const start = new Date()
  const end = new Date(start)
  end.setDate(end.getDate() + 14)
  return {
    name: '',
    description: '',
    teamId: null,
    startDate: localDateInput(start),
    endDate: localDateInput(end),
  }
}

function dateLabel(value: string): string {
  return new Date(value).toLocaleDateString(undefined, {
    timeZone: 'UTC',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

function statusLabel(status: SprintStatus): string {
  return status.charAt(0) + status.slice(1).toLowerCase()
}

function StatusBadge({ status }: { status: SprintStatus }) {
  const style =
    status === 'ACTIVE'
      ? 'bg-emerald-500/10 text-emerald-700'
      : status === 'COMPLETED'
        ? 'bg-slate-500/10 text-slate-600'
        : 'bg-amber-500/10 text-amber-800'

  return (
    <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${style}`}>
      {statusLabel(status)}
    </span>
  )
}

function SprintError({ message }: { message: string }) {
  return (
    <p
      className="rounded-lg border border-destructive/20 bg-destructive/5 px-3 py-2.5 text-sm text-destructive"
      role="alert"
    >
      {message}
    </p>
  )
}

function SprintForm({
  initialValue,
  submitLabel,
  isPending,
  error,
  onSubmit,
  onCancel,
}: {
  initialValue?: SprintInput
  submitLabel: string
  isPending: boolean
  error?: string
  onSubmit: (input: SprintInput) => void
  onCancel?: () => void
}) {
  const [form, setForm] = useState<SprintInput>(
    () => initialValue ?? defaultSprintInput(),
  )

  return (
    <form
      className="space-y-4"
      onSubmit={(event) => {
        event.preventDefault()
        onSubmit({
          ...form,
          name: form.name.trim(),
          description: form.description?.trim() ?? '',
          teamId: form.teamId || null,
        })
      }}
    >
      <label className="block space-y-2 text-sm font-medium">
        Sprint name
        <input
          className={inputClassName}
          value={form.name}
          onChange={(event) =>
            setForm((current) => ({ ...current, name: event.target.value }))
          }
          maxLength={160}
          required
        />
      </label>

      <label className="block space-y-2 text-sm font-medium">
        Description
        <textarea
          className="min-h-24 w-full rounded-md border bg-white px-3 py-2 text-sm outline-none placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring"
          value={form.description ?? ''}
          onChange={(event) =>
            setForm((current) => ({
              ...current,
              description: event.target.value,
            }))
          }
          maxLength={2000}
          placeholder="Optional sprint details"
        />
      </label>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block space-y-2 text-sm font-medium">
          Team
          <TeamSelector
            id="sprint-team"
            value={form.teamId ?? ''}
            onChange={(teamId) =>
              setForm((current) => ({ ...current, teamId: teamId || null }))
            }
            disabled={isPending}
          />
        </label>
        <div className="hidden sm:block" />
        <label className="block space-y-2 text-sm font-medium">
          Start date
          <input
            className={inputClassName}
            type="date"
            value={form.startDate}
            max={form.endDate}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                startDate: event.target.value,
              }))
            }
            required
          />
        </label>
        <label className="block space-y-2 text-sm font-medium">
          End date
          <input
            className={inputClassName}
            type="date"
            value={form.endDate}
            min={form.startDate}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                endDate: event.target.value,
              }))
            }
            required
          />
        </label>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button
          type="submit"
          disabled={
            isPending ||
            !form.name.trim() ||
            !form.startDate ||
            !form.endDate ||
            form.endDate < form.startDate
          }
        >
          {isPending ? (
            <LoaderCircle
              aria-hidden="true"
              className="animate-spin"
              size={16}
            />
          ) : (
            <Plus aria-hidden="true" size={16} />
          )}
          {submitLabel}
        </Button>
        {onCancel && (
          <Button
            type="button"
            variant="outline"
            disabled={isPending}
            onClick={onCancel}
          >
            Cancel
          </Button>
        )}
      </div>
      {error && <SprintError message={error} />}
    </form>
  )
}

function SprintCard({ sprint }: { sprint: Sprint }) {
  return (
    <Link
      to={`/sprints/${sprint.id}`}
      className="block rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <Card className="transition-shadow hover:shadow-md">
        <CardContent className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <h3 className="truncate font-semibold">{sprint.name}</h3>
            <p className="mt-1 truncate text-sm text-muted-foreground">
              {sprint.description || 'No description'}
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1.5">
                <CalendarDays aria-hidden="true" size={14} />
                {dateLabel(sprint.startDate)} – {dateLabel(sprint.endDate)}
              </span>
              <span>{sprint.team?.name ?? 'No team'}</span>
            </div>
          </div>
          <StatusBadge status={sprint.status} />
        </CardContent>
      </Card>
    </Link>
  )
}

const statusSections: { status: SprintStatus; title: string }[] = [
  { status: 'ACTIVE', title: 'Active' },
  { status: 'PLANNED', title: 'Planned' },
  { status: 'COMPLETED', title: 'Completed' },
]

export function SprintDashboardPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [selectedTeam, setSelectedTeam] = useState('')
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const sprintsQuery = useQuery({
    queryKey: ['sprints'],
    queryFn: getSprints,
  })
  const teamsQuery = useQuery({
    queryKey: ['team-options'],
    queryFn: getTeamOptions,
    staleTime: 30_000,
  })
  const createMutation = useMutation({
    mutationFn: createSprint,
    onSuccess: async (sprint) => {
      await queryClient.invalidateQueries({ queryKey: ['sprints'] })
      setIsCreateOpen(false)
      navigate(`/sprints/${sprint.id}`)
    },
  })

  const error =
    createMutation.error instanceof Error
      ? createMutation.error.message
      : undefined
  const filteredSprints = sprintsQuery.data?.filter((sprint) => {
    if (!selectedTeam) return true
    if (selectedTeam === 'unassigned') return sprint.teamId == null
    return sprint.teamId === selectedTeam
  })

  useEffect(() => {
    if (!isCreateOpen) return
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !createMutation.isPending) {
        setIsCreateOpen(false)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [createMutation.isPending, isCreateOpen])

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm text-muted-foreground">Workspace</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">Sprints</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Plan work, track active sprints, and browse by team.
          </p>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <label className="w-full space-y-2 text-sm font-medium sm:w-52">
            Browse by team
            <select
              className={inputClassName}
              value={selectedTeam}
              onChange={(event) => setSelectedTeam(event.target.value)}
            >
              <option value="">All teams</option>
              <option value="unassigned">Unassigned</option>
              {teamsQuery.data
                ?.slice()
                .sort((left, right) => left.name.localeCompare(right.name))
                .map((team) => (
                  <option key={team.id} value={team.id}>
                    {team.name}
                  </option>
                ))}
            </select>
          </label>
          <Button onClick={() => setIsCreateOpen(true)}>
            <Plus aria-hidden="true" size={16} />
            Create sprint
          </Button>
          {teamsQuery.isError && (
            <span className="text-xs text-destructive" role="alert">
              Could not load teams: {teamsQuery.error.message}
            </span>
          )}
        </div>
      </div>

      {isCreateOpen && (
        <div className="fixed inset-0 z-40">
          <button
            type="button"
            className="absolute inset-0 size-full cursor-default bg-slate-950/40"
            aria-label="Close create sprint form"
            disabled={createMutation.isPending}
            onClick={() => setIsCreateOpen(false)}
          />
          <aside
            role="dialog"
            aria-modal="true"
            aria-labelledby="create-sprint-title"
            className="absolute inset-y-0 right-0 flex w-full max-w-xl flex-col bg-white shadow-2xl motion-safe:animate-[sprint-slide-in_200ms_ease-out]"
          >
            <div className="flex items-start justify-between border-b px-6 py-5">
              <div>
                <p className="text-sm text-muted-foreground">Sprint planning</p>
                <h2
                  id="create-sprint-title"
                  className="mt-1 text-xl font-semibold tracking-tight"
                >
                  Create sprint
                </h2>
              </div>
              <Button
                type="button"
                size="icon"
                variant="ghost"
                aria-label="Close create sprint form"
                disabled={createMutation.isPending}
                onClick={() => setIsCreateOpen(false)}
              >
                <X aria-hidden="true" size={18} />
              </Button>
            </div>
            <div className="flex-1 overflow-y-auto p-6">
              <SprintForm
                submitLabel="Create sprint"
                isPending={createMutation.isPending}
                error={error}
                onSubmit={(input) => createMutation.mutate(input)}
                onCancel={() => setIsCreateOpen(false)}
              />
            </div>
          </aside>
        </div>
      )}

      {sprintsQuery.isPending ? (
        <p
          className="flex items-center gap-2 text-sm text-muted-foreground"
          role="status"
        >
          <LoaderCircle
            aria-hidden="true"
            className="animate-spin"
            size={17}
          />
          Loading sprints…
        </p>
      ) : sprintsQuery.isError ? (
        <div className="flex items-center justify-between gap-4">
          <SprintError message={sprintsQuery.error.message} />
          <Button
            variant="outline"
            size="sm"
            onClick={() => void sprintsQuery.refetch()}
          >
            <RefreshCw aria-hidden="true" size={15} />
            Retry
          </Button>
        </div>
      ) : (
        <div className="space-y-8">
          {statusSections.map(({ status, title }) => {
            const sprints =
              filteredSprints?.filter((sprint) => sprint.status === status) ?? []
            return (
              <section key={status} aria-labelledby={`sprint-${status}`}>
                <div className="mb-3 flex items-center justify-between">
                  <h2
                    id={`sprint-${status}`}
                    className="text-lg font-semibold tracking-tight"
                  >
                    {title}
                  </h2>
                  <span className="text-sm text-muted-foreground">
                    {sprints.length}
                  </span>
                </div>
                {sprints.length ? (
                  <div className="space-y-3">
                    {sprints.map((sprint) => (
                      <SprintCard key={sprint.id} sprint={sprint} />
                    ))}
                  </div>
                ) : (
                  <Card>
                    <CardContent className="py-5 text-sm text-muted-foreground">
                      No {title.toLowerCase()} sprints for this selection.
                    </CardContent>
                  </Card>
                )}
              </section>
            )
          })}
        </div>
      )}
    </div>
  )
}

export function SprintDetailsPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [isEditing, setIsEditing] = useState(false)
  const sprintQuery = useQuery({
    queryKey: ['sprints', id],
    queryFn: () => getSprint(id ?? ''),
    enabled: Boolean(id),
    retry: false,
  })
  const refreshSprints = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['sprints'] }),
      queryClient.invalidateQueries({ queryKey: ['sprints', id] }),
    ])
  }
  const saveMutation = useMutation({
    mutationFn: (input: SprintInput) => updateSprint(id ?? '', input),
    onSuccess: refreshSprints,
  })
  const statusMutation = useMutation({
    mutationFn: (status: SprintStatus) => setSprintStatus(id ?? '', status),
    onSuccess: refreshSprints,
  })
  const deleteMutation = useMutation({
    mutationFn: () => deleteSprint(id ?? ''),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['sprints'] })
      navigate('/dashboard', { replace: true })
    },
  })

  if (!id) {
    return <Navigate to="/dashboard" replace />
  }
  if (sprintQuery.isPending) {
    return (
      <p className="flex items-center gap-2 text-sm text-muted-foreground" role="status">
        <LoaderCircle aria-hidden="true" className="animate-spin" size={17} />
        Loading sprint…
      </p>
    )
  }
  if (sprintQuery.isError) {
    const notFound =
      sprintQuery.error instanceof ApiError && sprintQuery.error.status === 404
    return (
      <div className="space-y-4">
        <SprintError
          message={notFound ? 'This sprint could not be found.' : sprintQuery.error.message}
        />
        <Button variant="outline" onClick={() => navigate('/dashboard')}>
          <ArrowLeft aria-hidden="true" size={15} />
          Back to sprints
        </Button>
      </div>
    )
  }

  const sprint = sprintQuery.data
  const mutationError = [
    saveMutation.error,
    statusMutation.error,
    deleteMutation.error,
  ].find((error): error is Error => error instanceof Error)?.message
  const isPending =
    saveMutation.isPending ||
    statusMutation.isPending ||
    deleteMutation.isPending
  const sprintInput: SprintInput = {
    name: sprint.name,
    description: sprint.description ?? '',
    teamId: sprint.teamId,
    startDate: sprint.startDate.slice(0, 10),
    endDate: sprint.endDate.slice(0, 10),
  }

  return (
    <div className="space-y-6">
      <Link
        to="/dashboard"
        className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft aria-hidden="true" size={15} />
        All sprints
      </Link>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-sm text-muted-foreground">Sprint details</p>
          <div className="mt-1 flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-semibold tracking-tight">{sprint.name}</h1>
            <StatusBadge status={sprint.status} />
          </div>
          <p className="mt-2 text-sm text-muted-foreground">
            {sprint.description || 'No description'}
          </p>
        </div>
        <div className="flex flex-wrap items-end gap-2">
          <label className="space-y-1.5 text-xs font-medium text-muted-foreground">
            Status
            <select
              className={`${inputClassName} min-w-40`}
              value={sprint.status}
              disabled={isPending}
              onChange={(event) => {
                const status = event.target.value as SprintStatus
                if (
                  status === 'COMPLETED' &&
                  !window.confirm(
                    'Complete this sprint? It will become read-only. You can reopen it later.',
                  )
                ) {
                  return
                }
                statusMutation.mutate(status)
              }}
            >
              <option value="PLANNED">Planned</option>
              <option value="ACTIVE">Active</option>
              <option value="COMPLETED">Completed</option>
            </select>
          </label>
          {sprint.status !== 'COMPLETED' && (
            <Button
              variant="outline"
              disabled={isPending}
              onClick={() => setIsEditing((editing) => !editing)}
            >
              <Pencil aria-hidden="true" size={16} />
              {isEditing ? 'Cancel edit' : 'Edit'}
            </Button>
          )}
          {sprint.status !== 'COMPLETED' && (
            <Button
              variant="outline"
              disabled={isPending}
              className="border-destructive/30 text-destructive hover:bg-destructive/5 hover:text-destructive"
              onClick={() => {
                if (
                  window.confirm(
                    `Delete "${sprint.name}"? Its tasks will be moved to the backlog, not deleted.`,
                  )
                ) {
                  deleteMutation.mutate()
                }
              }}
            >
              {deleteMutation.isPending ? (
                <LoaderCircle
                  aria-hidden="true"
                  className="animate-spin"
                  size={16}
                />
              ) : (
                <Trash2 aria-hidden="true" size={16} />
              )}
              Delete
            </Button>
          )}
        </div>
      </div>

      {mutationError && <SprintError message={mutationError} />}

      {isEditing && sprint.status !== 'COMPLETED' ? (
        <Card>
          <CardHeader>
            <CardTitle>Edit sprint</CardTitle>
          </CardHeader>
          <CardContent>
            <SprintForm
              key={`${sprint.id}-${sprint.updatedAt}`}
              initialValue={sprintInput}
              submitLabel="Save changes"
              isPending={saveMutation.isPending}
              error={saveMutation.error instanceof Error ? saveMutation.error.message : undefined}
              onSubmit={(input) =>
                saveMutation.mutate(input, {
                  onSuccess: () => setIsEditing(false),
                })
              }
              onCancel={() => setIsEditing(false)}
            />
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CalendarDays aria-hidden="true" size={17} />
                Dates
              </CardTitle>
            </CardHeader>
            <CardContent className="text-sm">
              <p>{dateLabel(sprint.startDate)} – {dateLabel(sprint.endDate)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock3 aria-hidden="true" size={17} />
                Team
              </CardTitle>
            </CardHeader>
            <CardContent className="text-sm">
              {sprint.team?.name ?? 'Unassigned'}
            </CardContent>
          </Card>
        </div>
      )}

      <SprintTaskList
        sprintId={sprint.id}
        canCreate={sprint.status !== 'COMPLETED'}
      />
    </div>
  )
}
