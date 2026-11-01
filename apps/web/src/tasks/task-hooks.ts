import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  createTask,
  deleteTask,
  addTaskDependency,
  getBacklogTasks,
  getSprintBoard,
  getTask,
  getTaskDependencies,
  getTasks,
  removeTaskDependency,
  updateTask,
  type TaskInput,
} from '@/lib/api'

export function useTasks(sprintId?: string) {
  return useQuery({
    queryKey: ['tasks', sprintId ?? 'all'],
    queryFn: () => getTasks(sprintId),
  })
}

export function useBacklogTasks() {
  return useQuery({
    queryKey: ['tasks', 'backlog'],
    queryFn: getBacklogTasks,
  })
}

export function useSprintBoard(sprintId: string) {
  return useQuery({
    queryKey: ['sprint-board', sprintId],
    queryFn: () => getSprintBoard(sprintId),
    enabled: Boolean(sprintId),
  })
}

export function useTask(taskKey: string) {
  return useQuery({
    queryKey: ['tasks', 'key', taskKey],
    queryFn: () => getTask(taskKey),
    enabled: Boolean(taskKey),
    retry: false,
  })
}

export function useTaskDependencies(taskId: string) {
  return useQuery({
    queryKey: ['tasks', taskId, 'dependencies'],
    queryFn: () => getTaskDependencies(taskId),
    enabled: Boolean(taskId),
  })
}

function useInvalidateTasks() {
  const queryClient = useQueryClient()
  return async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['tasks'] }),
      queryClient.invalidateQueries({ queryKey: ['sprints'] }),
    ])
  }
}

export function useCreateTask() {
  const invalidateTasks = useInvalidateTasks()
  return useMutation({
    mutationFn: (input: TaskInput) => createTask(input),
    onSuccess: invalidateTasks,
  })
}

export function useUpdateTask() {
  const invalidateTasks = useInvalidateTasks()
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: Partial<TaskInput> }) =>
      updateTask(id, input),
    onSuccess: invalidateTasks,
  })
}

export function useDeleteTask() {
  const invalidateTasks = useInvalidateTasks()
  return useMutation({
    mutationFn: deleteTask,
    onSuccess: invalidateTasks,
  })
}

export function useAddTaskDependency() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({
      taskId,
      dependsOnTaskId,
    }: {
      taskId: string
      dependsOnTaskId: string
    }) => addTaskDependency(taskId, dependsOnTaskId),
    onSuccess: async (_dependency, { taskId }) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['tasks'] }),
        queryClient.invalidateQueries({
          queryKey: ['tasks', taskId, 'dependencies'],
        }),
      ])
    },
  })
}

export function useRemoveTaskDependency() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({
      taskId,
      dependencyId,
    }: {
      taskId: string
      dependencyId: string
    }) => removeTaskDependency(taskId, dependencyId),
    onSuccess: async (_result, { taskId }) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['tasks'] }),
        queryClient.invalidateQueries({
          queryKey: ['tasks', taskId, 'dependencies'],
        }),
      ])
    },
  })
}
