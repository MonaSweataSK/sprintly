import { useQuery } from '@tanstack/react-query'
import { Plus, X } from 'lucide-react'
import { useMemo, useState } from 'react'
import { getAssigneeOptions, getTeamOptions, type Member } from '@/lib/api'
import { Button } from '@/components/ui/button'

const selectClassName =
  'h-10 w-full rounded-md border bg-white px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60'

interface SelectorProps {
  id: string
  value: string
  onChange: (value: string) => void
  disabled?: boolean
  onBlur?: () => void
}

export function MemberSelector({
  id,
  value,
  onChange,
  disabled = false,
  onBlur,
}: SelectorProps) {
  const options = useQuery({
    queryKey: ['assignee-options'],
    queryFn: getAssigneeOptions,
    staleTime: 30_000,
  })

  return (
    <div className="space-y-1">
      <select
        id={id}
        className={selectClassName}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onBlur={onBlur}
        disabled={disabled || options.isPending || options.isError}
        aria-describedby={options.isError ? `${id}-error` : undefined}
      >
        <option value="">
          {options.isPending
            ? 'Loading members…'
            : options.isError
              ? 'Members unavailable'
              : 'Unassigned'}
        </option>
        {options.data?.map((member) => (
          <option key={member.id} value={member.id}>
            {member.name}
          </option>
        ))}
      </select>
      {options.isError && (
        <p id={`${id}-error`} className="text-xs text-destructive" role="alert">
          {options.error.message}
        </p>
      )}
    </div>
  )
}

export function TeamSelector({
  id,
  value,
  onChange,
  disabled = false,
}: SelectorProps) {
  const options = useQuery({
    queryKey: ['team-options'],
    queryFn: getTeamOptions,
    staleTime: 30_000,
  })

  return (
    <div className="space-y-1">
      <select
        id={id}
        className={selectClassName}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        disabled={disabled || options.isPending || options.isError}
        aria-describedby={options.isError ? `${id}-error` : undefined}
      >
        <option value="">
          {options.isPending
            ? 'Loading teams…'
            : options.isError
              ? 'Teams unavailable'
              : 'No team'}
        </option>
        {options.data?.map((team) => (
          <option key={team.id} value={team.id}>
            {team.name}
          </option>
        ))}
      </select>
      {options.isError && (
        <p id={`${id}-error`} className="text-xs text-destructive" role="alert">
          {options.error.message}
        </p>
      )}
    </div>
  )
}

interface MemberMultiSelectorProps {
  members: Pick<Member, 'id' | 'name' | 'email'>[]
  value: string[]
  onChange: (value: string[]) => void
  disabled?: boolean
}

export function MemberMultiSelector({
  members,
  value,
  onChange,
  disabled = false,
}: MemberMultiSelectorProps) {
  const [search, setSearch] = useState('')
  const selectedMembers = useMemo(
    () =>
      value.flatMap((id) => {
        const member = members.find((candidate) => candidate.id === id)
        return member ? [member] : []
      }),
    [members, value],
  )
  const normalizedSearch = search.trim().toLocaleLowerCase()
  const availableMembers = members.filter(
    (member) =>
      !value.includes(member.id) &&
      (!normalizedSearch ||
        member.name.toLocaleLowerCase().includes(normalizedSearch) ||
        member.email.toLocaleLowerCase().includes(normalizedSearch)),
  )
  const matchingMembers = availableMembers.slice(0, 6)

  return (
    <fieldset className="space-y-3 disabled:opacity-60">
      <legend className="text-sm font-medium">Team members</legend>
      {members.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Add active members before assigning them to a team.
        </p>
      ) : (
        <div className="space-y-3">
          <label htmlFor="team-member-search" className="sr-only">
            Search members by name or email
          </label>
          <input
            id="team-member-search"
            className={selectClassName}
            type="search"
            autoComplete="off"
            placeholder="Search members by name or email"
            value={search}
            disabled={disabled}
            onChange={(event) => setSearch(event.target.value)}
            aria-controls="team-member-search-results"
          />

          {search.trim() && (
            <div
              id="team-member-search-results"
              className="max-h-60 overflow-y-auto rounded-lg border bg-white"
              aria-live="polite"
            >
              {matchingMembers.length ? (
                matchingMembers.map((member) => (
                  <div
                    key={member.id}
                    className="flex items-center justify-between gap-3 border-b px-3 py-2.5 last:border-b-0"
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium">
                        {member.name}
                      </span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {member.email}
                      </span>
                    </span>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={disabled}
                      onClick={() => {
                        onChange([...value, member.id])
                        setSearch('')
                      }}
                    >
                      <Plus aria-hidden="true" size={14} />
                      Add
                    </Button>
                  </div>
                ))
              ) : (
                <p className="px-3 py-3 text-sm text-muted-foreground">
                  No available members match “{search.trim()}”.
                </p>
              )}
              {availableMembers.length > matchingMembers.length && (
                <p className="border-t px-3 py-2 text-xs text-muted-foreground">
                  Showing the first 6 matches. Refine your search to see others.
                </p>
              )}
            </div>
          )}

          <div className="space-y-2" aria-label="Selected team members">
            {selectedMembers.length ? (
              selectedMembers.map((member) => (
                <div
                  key={member.id}
                  className="flex items-center justify-between gap-3 rounded-md border bg-white px-3 py-2"
                >
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium">
                      {member.name}
                    </span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {member.email}
                    </span>
                  </span>
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    disabled={disabled}
                    aria-label={`Remove ${member.name} from team`}
                    onClick={() =>
                      onChange(value.filter((id) => id !== member.id))
                    }
                  >
                    <X aria-hidden="true" size={16} />
                  </Button>
                </div>
              ))
            ) : (
              <p className="text-sm text-muted-foreground">
                No members added yet. Search above and select Add.
              </p>
            )}
          </div>
        </div>
      )}
    </fieldset>
  )
}
