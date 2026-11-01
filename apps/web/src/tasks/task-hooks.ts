import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  createTask,
  deleteTask,
  getBacklogTasks,
  getTask,
  getTasks,
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

export function useTask(taskKey: string) {
  return useQuery({
    queryKey: ['tasks', 'key', taskKey],
    queryFn: () => getTask(taskKey),
    enabled: Boolean(taskKey),
    retry: false,
  })
}

function useInvalidateTasks() {
  const queryClient = useQueryClient()
  return async () => {
    await queryClient.invalidateQueries({ queryKey: ['tasks'] })
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
