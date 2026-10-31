import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Activity,
  ArrowUpRight,
  CircleCheck,
  LayoutDashboard,
  LoaderCircle,
  LogOut,
  RefreshCw,
  Shield,
  TriangleAlert,
  Users,
} from 'lucide-react'
import { useState } from 'react'
import { Link, Navigate, NavLink, Outlet, Route, Routes, useNavigate } from 'react-router-dom'
import { LoginPage, VerifyOtpPage } from '@/auth/auth-pages'
import { MembersPage, TeamsPage } from '@/admin/management-pages'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ApiError, getCurrentUser, getHealth, logout } from '@/lib/api'

function PageLoader() {
  return (
    <div className="flex min-h-screen items-center justify-center gap-3 text-sm text-muted-foreground" role="status">
      <LoaderCircle aria-hidden="true" className="animate-spin" size={18} />
      Restoring your session…
    </div>
  )
}

function ProtectedRoute() {
  const sessionQuery = useQuery({
    queryKey: ['auth', 'me'],
    queryFn: getCurrentUser,
    retry: false,
    staleTime: 30_000,
  })

  if (sessionQuery.isPending) {
    return <PageLoader />
  }
  if (sessionQuery.isError && sessionQuery.error instanceof ApiError && sessionQuery.error.status === 401) {
    return <Navigate to="/login" replace />
  }
  if (sessionQuery.isError) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-4 text-center">
        <p className="max-w-md text-sm text-destructive" role="alert">
          {sessionQuery.error.message}
        </p>
        <Button variant="outline" onClick={() => void sessionQuery.refetch()}>
          <RefreshCw aria-hidden="true" size={15} />
          Retry
        </Button>
      </div>
    )
  }

  return <Outlet />
}

function AdminRoute() {
  const { data: user } = useQuery({
    queryKey: ['auth', 'me'],
    queryFn: getCurrentUser,
  })

  return user?.role === 'ADMIN' ? <Outlet /> : <Navigate to="/dashboard" replace />
}

function AppShell() {
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const [logoutError, setLogoutError] = useState<string>()
  const { data: user } = useQuery({
    queryKey: ['auth', 'me'],
    queryFn: getCurrentUser,
  })
  const logoutMutation = useMutation({
    mutationFn: logout,
    onSuccess: () => {
      queryClient.clear()
      navigate('/login', { replace: true })
    },
    onError: (error) => {
      setLogoutError(error instanceof Error ? error.message : 'Could not log out. Please try again.')
    },
  })

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="fixed inset-x-0 top-0 z-10 flex h-16 items-center justify-between border-b bg-white px-6">
        <Link to="/dashboard" className="flex items-center gap-3" aria-label="Sprintly home">
          <div className="flex size-9 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <Activity aria-hidden="true" size={19} />
          </div>
          <span className="text-lg font-semibold tracking-tight">Sprintly</span>
          <span className="ml-2 hidden rounded-full border px-2.5 py-1 text-xs text-muted-foreground sm:inline">
            Workspace
          </span>
        </Link>
        <div className="flex items-center gap-3">
          <div className="hidden text-right sm:block">
            <p className="text-sm font-medium">{user?.name}</p>
            <p className="text-xs text-muted-foreground">{user?.role === 'ADMIN' ? 'Administrator' : 'Member'}</p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            disabled={logoutMutation.isPending}
            onClick={() => logoutMutation.mutate()}
          >
            {logoutMutation.isPending ? (
              <LoaderCircle aria-hidden="true" className="animate-spin" size={16} />
            ) : (
              <LogOut aria-hidden="true" size={16} />
            )}
            <span className="hidden sm:inline">Log out</span>
          </Button>
        </div>
      </header>

      <aside className="fixed bottom-0 left-0 top-16 hidden w-64 border-r bg-white p-4 md:block">
        <p className="mb-3 px-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Workspace
        </p>
        <nav aria-label="Main navigation" className="space-y-1">
          <NavLink
            to="/dashboard"
            className={({ isActive }) =>
              `flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-accent text-accent-foreground'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground'
              }`
            }
          >
            <LayoutDashboard aria-hidden="true" size={18} />
            Overview
          </NavLink>
          <NavLink
            to="/health"
            className={({ isActive }) =>
              `flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-accent text-accent-foreground'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground'
              }`
            }
          >
            <Activity aria-hidden="true" size={18} />
            API status
          </NavLink>
          {user?.role === 'ADMIN' && (
            <>
              <NavLink
                to="/members"
                className={({ isActive }) =>
                  `flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-accent text-accent-foreground'
                      : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                  }`
                }
              >
                <Shield aria-hidden="true" size={18} />
                Members
              </NavLink>
              <NavLink
                to="/teams"
                className={({ isActive }) =>
                  `flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-accent text-accent-foreground'
                      : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                  }`
                }
              >
                <Users aria-hidden="true" size={18} />
                Teams
              </NavLink>
            </>
          )}
        </nav>
        <div className="absolute inset-x-4 bottom-5 rounded-xl border bg-muted/40 p-3">
          <p className="text-sm font-medium">Signed in securely</p>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
            Your session is protected and can be revoked when you log out.
          </p>
        </div>
      </aside>

      <main className="min-h-screen px-5 pb-10 pt-24 md:ml-64 md:px-10">
        <div className="mx-auto max-w-5xl">
          {logoutError && (
            <p className="mb-5 rounded-lg border border-destructive/20 bg-destructive/5 px-3 py-2.5 text-sm text-destructive" role="alert">
              {logoutError}
            </p>
          )}
          <Outlet />
        </div>
      </main>
    </div>
  )
}

function HealthStatus() {
  const healthQuery = useQuery({
    queryKey: ['health'],
    queryFn: getHealth,
  })

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Activity aria-hidden="true" size={18} />
          Backend connection
        </CardTitle>
      </CardHeader>
      <CardContent>
        {healthQuery.isPending ? (
          <div className="flex items-center gap-3 text-sm text-muted-foreground" role="status">
            <LoaderCircle aria-hidden="true" className="animate-spin" size={18} />
            Checking the NestJS health endpoint…
          </div>
        ) : healthQuery.isError ? (
          <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3 text-sm text-destructive" role="alert">
              <TriangleAlert aria-hidden="true" className="mt-0.5 shrink-0" size={18} />
              <span>{healthQuery.error.message}</span>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => void healthQuery.refetch()}
            >
              <RefreshCw aria-hidden="true" size={15} />
              Retry
            </Button>
          </div>
        ) : (
          <div className="flex items-center gap-3 text-sm text-emerald-700" role="status">
            <CircleCheck aria-hidden="true" size={18} />
            Connected — API returned <code className="rounded bg-muted px-1.5 py-0.5">{healthQuery.data.status}</code>
            <a
              className="ml-auto inline-flex items-center gap-1 text-muted-foreground hover:text-foreground"
              href={`${import.meta.env.VITE_API_URL || 'http://localhost:3000'}/api/docs`}
              target="_blank"
              rel="noreferrer"
            >
              API docs <ArrowUpRight aria-hidden="true" size={14} />
            </a>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function DashboardPage() {
  const { data: user } = useQuery({
    queryKey: ['auth', 'me'],
    queryFn: getCurrentUser,
  })

  return (
    <div className="space-y-8">
      <div>
        <p className="text-sm text-muted-foreground">Workspace</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">
          Welcome, {user?.name}
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
          You’re signed in to Sprintly. Your approved account and current role
          are verified by the backend.
        </p>
      </div>
      <HealthStatus />
    </div>
  )
}

function HealthPage() {
  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm text-muted-foreground">Workspace</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">API status</h1>
      </div>
      <HealthStatus />
    </div>
  )
}

function NotFoundPage() {
  return (
    <Card>
      <CardContent className="py-8 text-sm text-muted-foreground">
        Page not found.
      </CardContent>
    </Card>
  )
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/verify-otp" element={<VerifyOtpPage />} />
      <Route element={<ProtectedRoute />}>
        <Route element={<AppShell />}>
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/health" element={<HealthPage />} />
          <Route element={<AdminRoute />}>
            <Route path="/members" element={<MembersPage />} />
            <Route path="/teams" element={<TeamsPage />} />
          </Route>
          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Route>
    </Routes>
  )
}
