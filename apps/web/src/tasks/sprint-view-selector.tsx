import { ChevronDown, Eye } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

const selectClassName =
  'h-10 appearance-none rounded-md border bg-white py-2 pl-9 pr-9 text-sm font-medium outline-none focus-visible:ring-2 focus-visible:ring-ring'

export function SprintViewSelector({
  sprintId,
  value,
}: {
  sprintId: string
  value: 'board' | 'list'
}) {
  const navigate = useNavigate()

  return (
    <label className="relative inline-flex items-center">
      <Eye
        aria-hidden="true"
        className="pointer-events-none absolute left-3 text-muted-foreground"
        size={16}
      />
      <span className="sr-only">Sprint view</span>
      <select
        aria-label="Sprint view"
        className={selectClassName}
        value={value}
        onChange={(event) => {
          navigate(`/sprints/${sprintId}/${event.target.value}`)
        }}
      >
        <option value="board">Board</option>
        <option value="list">List</option>
      </select>
      <ChevronDown
        aria-hidden="true"
        className="pointer-events-none absolute right-3 text-muted-foreground"
        size={15}
      />
    </label>
  )
}
