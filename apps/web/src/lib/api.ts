export interface HealthResponse {
  status: 'ok'
}

export interface CurrentUser {
  id: string
  email: string
  name: string
  role: 'ADMIN' | 'USER'
}

export interface Member {
  id: string
  name: string
  email: string
  role: 'ADMIN' | 'USER'
  isActive: boolean
  createdAt: string
  updatedAt: string
}

export interface AssigneeOption {
  id: string
  name: string
}

export interface TeamOption {
  id: string
  name: string
}

export interface Team extends TeamOption {
  description: string | null
  createdAt: string
  members: {
    id: string
    teamId: string
    userId: string
    user: Pick<Member, 'id' | 'name' | 'email' | 'role' | 'isActive'>
  }[]
}

export interface MemberInput {
  name: string
  email: string
  role: Member['role']
}

export interface MemberUpdate {
  name?: string
  email?: string
  role?: Member['role']
  isActive?: boolean
}

export interface TeamInput {
  name: string
  description?: string
  memberIds?: string[]
}

export type SprintStatus = 'PLANNED' | 'ACTIVE' | 'COMPLETED'

export interface Sprint {
  id: string
  name: string
  description: string | null
  teamId: string | null
  startDate: string
  endDate: string
  status: SprintStatus
  team: TeamOption | null
  createdBy: { id: string; name: string } | null
  createdAt: string
  updatedAt: string
  taskProgress?: {
    total: number
    done: number
    unfinishedTaskKeys: string[]
  }
}

export interface SprintInput {
  name: string
  description?: string
  teamId?: string | null
  startDate: string
  endDate: string
}

export type TaskStatus = 'TODO' | 'IN_PROGRESS' | 'IN_REVIEW' | 'DONE'

export interface Task {
  id: string
  taskKey: string
  title: string
  description: string | null
  assigneeId: string | null
  sprintId: string | null
  startDate: string | null
  endDate: string | null
  status: TaskStatus
  createdById: string | null
  createdAt: string
  updatedAt: string
  deletedAt: string | null
  assignee: Pick<Member, 'id' | 'name' | 'email'> | null
  sprint: Pick<Sprint, 'id' | 'name' | 'status'> | null
  createdBy: { id: string; name: string } | null
}

export interface TaskInput {
  title: string
  description?: string | null
  assigneeId?: string | null
  sprintId?: string | null
  startDate?: string | null
  endDate?: string | null
  status?: TaskStatus
}

export interface TaskDependency {
  id: string
  taskId: string
  dependsOnTaskId: string
  createdAt: string
  dependsOnTask: {
    id: string
    taskKey: string
    title: string
    status: TaskStatus
    deletedAt: string | null
    sprintId: string | null
  }
}

export interface SprintBoard {
  sprint: Pick<Sprint, 'id' | 'name' | 'status' | 'teamId'>
  tasks: SprintBoardTask[]
  activeTeamMembers: { id: string; name: string }[]
  outsideTeamAssignees: { id: string; name: string }[]
}

export interface SprintBoardTask extends Task {
  prerequisites: {
    dependsOnTask: {
      id: string
      taskKey: string
      status: TaskStatus
      deletedAt: string | null
    }
  }[]
}

export type TaskSortField =
  | 'taskKey'
  | 'title'
  | 'startDate'
  | 'endDate'
  | 'createdAt'
  | 'updatedAt'

export interface SprintTaskPage {
  sprint: Pick<Sprint, 'id' | 'name' | 'status'>
  tasks: Task[]
  pagination: {
    page: number
    pageSize: number
    total: number
    totalPages: number
  }
}

export interface SprintTaskPageQuery {
  page: number
  pageSize: number
  sortBy: TaskSortField
  sortOrder: 'asc' | 'desc'
}

export interface OtpRequestResponse {
  message: string
  expiresInSeconds: number
  resendAfterSeconds: number
}

export class ApiError extends Error {
  readonly status: number

  constructor(
    message: string,
    status: number,
  ) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

const apiBase = `${(import.meta.env.VITE_API_URL || 'http://localhost:3000').replace(/\/$/, '')}/api/v1`

function getErrorMessage(payload: unknown): string | undefined {
  if (typeof payload !== 'object' || payload === null || !('message' in payload)) {
    return undefined
  }

  const message = payload.message
  if (typeof message === 'string') {
    return message
  }
  if (Array.isArray(message) && message.every((item) => typeof item === 'string')) {
    return message.join(', ')
  }
  return undefined
}

async function readPayload(response: Response): Promise<unknown> {
  const contentType = response.headers.get('content-type')
  if (!contentType?.includes('application/json')) {
    return undefined
  }
  return response.json()
}

async function send(
  path: string,
  init?: RequestInit,
): Promise<Response> {
  return fetch(`${apiBase}${path}`, {
    ...init,
    credentials: 'include',
    headers: {
      ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
      ...init?.headers,
    },
  })
}

async function apiRequest<T>(
  path: string,
  init?: RequestInit,
  allowSessionRenewal = true,
): Promise<T> {
  let response = await send(path, init)

  if (
    response.status === 401 &&
    allowSessionRenewal &&
    path !== '/auth/refresh' &&
    path !== '/auth/verify-otp' &&
    path !== '/auth/request-otp' &&
    path !== '/auth/logout'
  ) {
    const refresh = await send('/auth/refresh', { method: 'POST' })
    if (refresh.ok) {
      response = await send(path, init)
    }
  }

  const payload = await readPayload(response)
  if (!response.ok) {
    throw new ApiError(
      getErrorMessage(payload) ?? `API request failed with status ${response.status}`,
      response.status,
    )
  }
  return payload as T
}

export async function requestOtp(email: string): Promise<OtpRequestResponse> {
  return apiRequest<OtpRequestResponse>('/auth/request-otp', {
    method: 'POST',
    body: JSON.stringify({ email }),
  })
}

export async function verifyOtp(
  email: string,
  code: string,
): Promise<{ user: CurrentUser }> {
  return apiRequest<{ user: CurrentUser }>('/auth/verify-otp', {
    method: 'POST',
    body: JSON.stringify({ email, code }),
  })
}

export async function getCurrentUser(): Promise<CurrentUser> {
  return apiRequest<CurrentUser>('/auth/me')
}

export async function logout(): Promise<void> {
  await apiRequest<{ loggedOut: boolean }>('/auth/logout', { method: 'POST' }, false)
}

export async function getMembers(): Promise<Member[]> {
  return apiRequest<Member[]>('/members')
}

export async function createMember(input: MemberInput): Promise<Member> {
  return apiRequest<Member>('/members', {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

export async function updateMember(
  id: string,
  input: MemberUpdate,
): Promise<Member> {
  return apiRequest<Member>(`/members/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  })
}

export async function deactivateMember(id: string): Promise<Member> {
  return apiRequest<Member>(`/members/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  })
}

export async function permanentlyDeleteMember(id: string): Promise<void> {
  await apiRequest<{ deleted: boolean }>(
    `/members/${encodeURIComponent(id)}/permanent`,
    { method: 'DELETE' },
  )
}

export async function getAssigneeOptions(): Promise<AssigneeOption[]> {
  return apiRequest<AssigneeOption[]>('/assignee-options')
}

export async function getTeams(): Promise<Team[]> {
  return apiRequest<Team[]>('/teams')
}

export async function getTeamOptions(): Promise<TeamOption[]> {
  return apiRequest<TeamOption[]>('/team-options')
}

export async function createTeam(input: TeamInput): Promise<Team> {
  return apiRequest<Team>('/teams', {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

export async function updateTeam(
  id: string,
  input: TeamInput,
): Promise<Team> {
  return apiRequest<Team>(`/teams/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  })
}

export async function deleteTeam(id: string): Promise<void> {
  await apiRequest<{ deleted: boolean }>(
    `/teams/${encodeURIComponent(id)}`,
    { method: 'DELETE' },
  )
}

export async function getSprints(): Promise<Sprint[]> {
  return apiRequest<Sprint[]>('/sprints')
}

export async function getSprint(id: string): Promise<Sprint> {
  return apiRequest<Sprint>(`/sprints/${encodeURIComponent(id)}`)
}

export async function createSprint(input: SprintInput): Promise<Sprint> {
  return apiRequest<Sprint>('/sprints', {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

export async function updateSprint(
  id: string,
  input: Partial<SprintInput>,
): Promise<Sprint> {
  return apiRequest<Sprint>(`/sprints/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  })
}

export async function startSprint(id: string): Promise<Sprint> {
  return apiRequest<Sprint>(`/sprints/${encodeURIComponent(id)}/start`, {
    method: 'POST',
  })
}

export async function setSprintStatus(
  id: string,
  status: SprintStatus,
): Promise<Sprint> {
  return apiRequest<Sprint>(`/sprints/${encodeURIComponent(id)}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ status }),
  })
}

export async function planSprint(id: string): Promise<Sprint> {
  return apiRequest<Sprint>(`/sprints/${encodeURIComponent(id)}/plan`, {
    method: 'POST',
  })
}

export async function reopenSprint(id: string): Promise<Sprint> {
  return apiRequest<Sprint>(`/sprints/${encodeURIComponent(id)}/reopen`, {
    method: 'POST',
  })
}

export async function deleteSprint(id: string): Promise<void> {
  await apiRequest<{ deleted: boolean }>(
    `/sprints/${encodeURIComponent(id)}`,
    { method: 'DELETE' },
  )
}

export async function getTasks(sprintId?: string): Promise<Task[]> {
  const query = sprintId ? `?sprintId=${encodeURIComponent(sprintId)}` : ''
  return apiRequest<Task[]>(`/tasks${query}`)
}

export async function getSprintBoard(sprintId: string): Promise<SprintBoard> {
  return apiRequest<SprintBoard>(
    `/sprints/${encodeURIComponent(sprintId)}/board`,
  )
}

export async function getSprintTasks(
  sprintId: string,
  query: SprintTaskPageQuery,
): Promise<SprintTaskPage> {
  const search = new URLSearchParams({
    page: String(query.page),
    pageSize: String(query.pageSize),
    sortBy: query.sortBy,
    sortOrder: query.sortOrder,
  })
  return apiRequest<SprintTaskPage>(
    `/sprints/${encodeURIComponent(sprintId)}/tasks?${search.toString()}`,
  )
}

export async function getBacklogTasks(): Promise<Task[]> {
  return apiRequest<Task[]>('/tasks/backlog')
}

export async function getTask(taskKey: string): Promise<Task> {
  return apiRequest<Task>(`/tasks/${encodeURIComponent(taskKey)}`)
}

export async function createTask(input: TaskInput): Promise<Task> {
  return apiRequest<Task>('/tasks', {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

export async function updateTask(
  id: string,
  input: Partial<TaskInput>,
): Promise<Task> {
  return apiRequest<Task>(`/tasks/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  })
}

export async function deleteTask(id: string): Promise<void> {
  await apiRequest<{ deleted: boolean }>(`/tasks/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  })
}

export async function getTaskDependencies(
  taskId: string,
): Promise<TaskDependency[]> {
  return apiRequest<TaskDependency[]>(
    `/tasks/${encodeURIComponent(taskId)}/dependencies`,
  )
}

export async function addTaskDependency(
  taskId: string,
  dependsOnTaskId: string,
): Promise<TaskDependency> {
  return apiRequest<TaskDependency>(
    `/tasks/${encodeURIComponent(taskId)}/dependencies`,
    {
      method: 'POST',
      body: JSON.stringify({ dependsOnTaskId }),
    },
  )
}

export async function removeTaskDependency(
  taskId: string,
  dependencyId: string,
): Promise<void> {
  await apiRequest<{ removed: boolean }>(
    `/tasks/${encodeURIComponent(taskId)}/dependencies/${encodeURIComponent(dependencyId)}`,
    { method: 'DELETE' },
  )
}

export async function getHealth(): Promise<HealthResponse> {
  const response = await fetch(`${apiBase.replace(/\/api\/v1$/, '')}/health`)
  const payload: unknown = await readPayload(response)

  if (!response.ok) {
    throw new ApiError(
      getErrorMessage(payload) ?? `API request failed with status ${response.status}`,
      response.status,
    )
  }

  if (
    typeof payload !== 'object' ||
    payload === null ||
    !('status' in payload) ||
    payload.status !== 'ok'
  ) {
    throw new Error('The API returned an invalid health response')
  }

  return { status: 'ok' }
}
