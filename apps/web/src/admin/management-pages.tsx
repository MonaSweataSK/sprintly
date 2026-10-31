import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { AlertTriangle, LoaderCircle, Pencil, Plus, RefreshCw, Shield, Trash2, UserRound, Users, X } from 'lucide-react'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { MemberMultiSelector } from '@/components/selectors'
import {
  createMember,
  createTeam,
  deactivateMember,
  deleteTeam,
  getMembers,
  getTeams,
  permanentlyDeleteMember,
  updateMember,
  updateTeam,
  type Member,
  type MemberInput,
  type Team,
  type TeamInput,
} from '@/lib/api'

const inputClassName =
  'h-10 w-full rounded-md border bg-white px-3 text-sm outline-none placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring'

function ErrorMessage({ children }: { children: string }) {
  return (
    <p
      className="rounded-lg border border-destructive/20 bg-destructive/5 px-3 py-2.5 text-sm text-destructive"
      role="alert"
    >
      {children}
    </p>
  )
}

function QueryError({
  message,
  onRetry,
}: {
  message: string
  onRetry: () => void
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <p className="text-sm text-destructive" role="alert">{message}</p>
      <Button variant="outline" size="sm" onClick={onRetry}>
        <RefreshCw aria-hidden="true" size={15} />
        Retry
      </Button>
    </div>
  )
}

export function MembersPage() {
  const queryClient = useQueryClient()
  const [editing, setEditing] = useState<Member | null>(null)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<Member['role']>('USER')
  const membersQuery = useQuery({
    queryKey: ['members'],
    queryFn: getMembers,
  })
  const saveMutation = useMutation({
    mutationFn: (input: MemberInput) =>
      editing ? updateMember(editing.id, input) : createMember(input),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['members'] })
      setEditing(null)
      setName('')
      setEmail('')
      setRole('USER')
    },
  })
  const activationMutation = useMutation({
    mutationFn: ({ member, active }: { member: Member; active: boolean }) =>
      active
        ? updateMember(member.id, { isActive: true })
        : deactivateMember(member.id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['members'] }),
  })
  const deleteMutation = useMutation({
    mutationFn: permanentlyDeleteMember,
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['members'] }),
        queryClient.invalidateQueries({ queryKey: ['teams'] }),
        queryClient.invalidateQueries({ queryKey: ['assignee-options'] }),
      ])
      if (editing?.id === deleteMutation.variables) {
        resetForm()
      }
    },
  })

  function startEditing(member: Member) {
    setEditing(member)
    setName(member.name)
    setEmail(member.email)
    setRole(member.role)
  }

  function resetForm() {
    setEditing(null)
    setName('')
    setEmail('')
    setRole('USER')
    saveMutation.reset()
  }

  const saveError =
    saveMutation.error instanceof Error ? saveMutation.error.message : undefined
  const activationError =
    activationMutation.error instanceof Error
      ? activationMutation.error.message
      : undefined
  const deleteError =
    deleteMutation.error instanceof Error
      ? deleteMutation.error.message
      : undefined

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm text-muted-foreground">Admin</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">Members</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Approve people for email sign-in, assign roles, or revoke access.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {editing ? <Pencil aria-hidden="true" size={17} /> : <Plus aria-hidden="true" size={17} />}
            {editing ? 'Edit member' : 'Add member'}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form
            className="grid gap-4 md:grid-cols-2"
            onSubmit={(event) => {
              event.preventDefault()
              saveMutation.mutate({ name: name.trim(), email: email.trim(), role })
            }}
          >
            <label className="space-y-2 text-sm font-medium">
              Name
              <input
                className={inputClassName}
                value={name}
                onChange={(event) => setName(event.target.value)}
                maxLength={120}
                required
              />
            </label>
            <label className="space-y-2 text-sm font-medium">
              Email
              <input
                className={inputClassName}
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                maxLength={254}
                required
              />
            </label>
            <label className="space-y-2 text-sm font-medium">
              Role
              <select
                className={inputClassName}
                value={role}
                onChange={(event) => setRole(event.target.value as Member['role'])}
              >
                <option value="USER">Member</option>
                <option value="ADMIN">Admin</option>
              </select>
            </label>
            <div className="flex items-end gap-2">
              <Button type="submit" disabled={saveMutation.isPending}>
                {saveMutation.isPending ? (
                  <LoaderCircle aria-hidden="true" className="animate-spin" size={16} />
                ) : (
                  <Plus aria-hidden="true" size={16} />
                )}
                {editing ? 'Save changes' : 'Add member'}
              </Button>
              {editing && (
                <Button type="button" variant="outline" onClick={resetForm}>
                  <X aria-hidden="true" size={16} />
                  Cancel
                </Button>
              )}
            </div>
            {saveError && <div className="md:col-span-2"><ErrorMessage>{saveError}</ErrorMessage></div>}
          </form>
        </CardContent>
      </Card>

      {activationError && <ErrorMessage>{activationError}</ErrorMessage>}
      {deleteError && <ErrorMessage>{deleteError}</ErrorMessage>}
      <p className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-2.5 text-sm text-amber-900">
        <AlertTriangle aria-hidden="true" className="mt-0.5 shrink-0" size={16} />
        Permanent deletion cannot be undone. It also removes the member’s
        sessions, OTP history, and team memberships.
      </p>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users aria-hidden="true" size={18} />
            Member directory
          </CardTitle>
        </CardHeader>
        <CardContent>
          {membersQuery.isPending ? (
            <p className="flex items-center gap-2 text-sm text-muted-foreground" role="status">
              <LoaderCircle aria-hidden="true" className="animate-spin" size={16} />
              Loading members…
            </p>
          ) : membersQuery.isError ? (
            <QueryError message={membersQuery.error.message} onRetry={() => void membersQuery.refetch()} />
          ) : membersQuery.data.length === 0 ? (
            <p className="text-sm text-muted-foreground">No members yet. Add the first member above.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[700px] text-left text-sm">
                <thead className="border-b text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="pb-3 pr-4 font-medium">Member</th>
                    <th className="pb-3 pr-4 font-medium">Role</th>
                    <th className="pb-3 pr-4 font-medium">Status</th>
                    <th className="pb-3 pr-4 font-medium">Added</th>
                    <th className="pb-3 text-right font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {membersQuery.data.map((member) => (
                    <tr key={member.id}>
                      <td className="py-4 pr-4">
                        <p className="font-medium">{member.name}</p>
                        <p className="text-xs text-muted-foreground">{member.email}</p>
                      </td>
                      <td className="py-4 pr-4">
                        <span className="inline-flex items-center gap-1.5">
                          {member.role === 'ADMIN' ? <Shield aria-hidden="true" size={14} /> : <UserRound aria-hidden="true" size={14} />}
                          {member.role === 'ADMIN' ? 'Admin' : 'Member'}
                        </span>
                      </td>
                      <td className="py-4 pr-4">
                        <span className={member.isActive ? 'text-emerald-700' : 'text-muted-foreground'}>
                          {member.isActive ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="py-4 pr-4 text-muted-foreground">
                        {new Date(member.createdAt).toLocaleDateString()}
                      </td>
                      <td className="py-4 text-right">
                        <div className="inline-flex gap-2">
                          <Button variant="outline" size="sm" onClick={() => startEditing(member)}>
                            <Pencil aria-hidden="true" size={14} />
                            Edit
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={activationMutation.isPending}
                            onClick={() => activationMutation.mutate({ member, active: !member.isActive })}
                          >
                            {member.isActive ? 'Deactivate' : 'Activate'}
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className="border-destructive/30 text-destructive hover:bg-destructive/5 hover:text-destructive"
                            disabled={deleteMutation.isPending}
                            onClick={() => {
                              const confirmed = window.confirm(
                                `Permanently delete ${member.name} (${member.email})? This cannot be undone and will remove their sessions, OTP history, and team memberships.`,
                              )
                              if (confirmed) {
                                deleteMutation.mutate(member.id)
                              }
                            }}
                          >
                            {deleteMutation.isPending &&
                            deleteMutation.variables === member.id ? (
                              <LoaderCircle
                                aria-hidden="true"
                                className="animate-spin"
                                size={14}
                              />
                            ) : (
                              <Trash2 aria-hidden="true" size={14} />
                            )}
                            Delete permanently
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

export function TeamsPage() {
  const queryClient = useQueryClient()
  const [editing, setEditing] = useState<Team | null>(null)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [memberIds, setMemberIds] = useState<string[]>([])
  const teamsQuery = useQuery({ queryKey: ['teams'], queryFn: getTeams })
  const membersQuery = useQuery({ queryKey: ['members'], queryFn: getMembers })
  const saveMutation = useMutation({
    mutationFn: (input: TeamInput) =>
      editing ? updateTeam(editing.id, input) : createTeam(input),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['teams'] })
      await queryClient.invalidateQueries({ queryKey: ['team-options'] })
      resetForm()
    },
  })
  const deleteMutation = useMutation({
    mutationFn: deleteTeam,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['teams'] })
      await queryClient.invalidateQueries({ queryKey: ['team-options'] })
    },
  })

  function resetForm() {
    setEditing(null)
    setName('')
    setDescription('')
    setMemberIds([])
    saveMutation.reset()
  }

  function startEditing(team: Team) {
    setEditing(team)
    setName(team.name)
    setDescription(team.description ?? '')
    setMemberIds(team.members.map((membership) => membership.userId))
  }

  const saveError =
    saveMutation.error instanceof Error ? saveMutation.error.message : undefined
  const deleteError =
    deleteMutation.error instanceof Error ? deleteMutation.error.message : undefined

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm text-muted-foreground">Admin</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">Teams</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Create teams and assign active members to each team.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{editing ? 'Edit team' : 'Create team'}</CardTitle>
        </CardHeader>
        <CardContent>
          <form
            className="space-y-4"
            onSubmit={(event) => {
              event.preventDefault()
              saveMutation.mutate({
                name: name.trim(),
                description: description.trim(),
                memberIds,
              })
            }}
          >
            <div className="grid gap-4 md:grid-cols-2">
              <label className="space-y-2 text-sm font-medium">
                Team name
                <input
                  className={inputClassName}
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  maxLength={120}
                  required
                />
              </label>
              <label className="space-y-2 text-sm font-medium">
                Description
                <input
                  className={inputClassName}
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  maxLength={500}
                  placeholder="Optional"
                />
              </label>
            </div>
            {membersQuery.isError ? (
              <QueryError
                message={membersQuery.error.message}
                onRetry={() => void membersQuery.refetch()}
              />
            ) : membersQuery.isPending ? (
              <p className="text-sm text-muted-foreground">Loading active members…</p>
            ) : (
              <MemberMultiSelector
                members={membersQuery.data.filter((member) => member.isActive)}
                value={memberIds}
                onChange={setMemberIds}
                disabled={saveMutation.isPending}
              />
            )}
            <div className="flex gap-2">
              <Button type="submit" disabled={saveMutation.isPending || membersQuery.isError || membersQuery.isPending}>
                {saveMutation.isPending ? (
                  <LoaderCircle aria-hidden="true" className="animate-spin" size={16} />
                ) : (
                  <Plus aria-hidden="true" size={16} />
                )}
                {editing ? 'Save team' : 'Create team'}
              </Button>
              {editing && (
                <Button type="button" variant="outline" onClick={resetForm}>
                  <X aria-hidden="true" size={16} />
                  Cancel
                </Button>
              )}
            </div>
            {saveError && <ErrorMessage>{saveError}</ErrorMessage>}
          </form>
        </CardContent>
      </Card>

      {deleteError && <ErrorMessage>{deleteError}</ErrorMessage>}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users aria-hidden="true" size={18} />
            Team directory
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {teamsQuery.isPending ? (
            <p className="flex items-center gap-2 text-sm text-muted-foreground" role="status">
              <LoaderCircle aria-hidden="true" className="animate-spin" size={16} />
              Loading teams…
            </p>
          ) : teamsQuery.isError ? (
            <QueryError message={teamsQuery.error.message} onRetry={() => void teamsQuery.refetch()} />
          ) : teamsQuery.data.length === 0 ? (
            <p className="text-sm text-muted-foreground">No teams yet. Create a team above.</p>
          ) : (
            teamsQuery.data.map((team) => (
              <div key={team.id} className="flex flex-col gap-3 rounded-lg border p-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <h2 className="font-medium">{team.name}</h2>
                  {team.description && (
                    <p className="mt-1 text-sm text-muted-foreground">{team.description}</p>
                  )}
                  <p className="mt-2 text-xs text-muted-foreground">
                    {team.members.length === 0
                      ? 'No members assigned'
                      : team.members.map(({ user }) => user.name).join(', ')}
                  </p>
                </div>
                <div className="flex shrink-0 gap-2">
                  <Button variant="outline" size="sm" onClick={() => startEditing(team)}>
                    <Pencil aria-hidden="true" size={14} />
                    Edit
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={deleteMutation.isPending}
                    onClick={() => {
                      if (window.confirm(`Delete the ${team.name} team?`)) {
                        deleteMutation.mutate(team.id)
                      }
                    }}
                  >
                    Delete
                  </Button>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  )
}
