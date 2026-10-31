import { useQuery } from '@tanstack/react-query'
import {
  Activity,
  ArrowUpRight,
  CircleCheck,
  LayoutDashboard,
  LoaderCircle,
  RefreshCw,
  TriangleAlert,
} from 'lucide-react'
import { NavLink, Outlet, Route, Routes, useLocation } from 'react-router-dom'
import { getHealth } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

function AppShell() {
  const location = useLocation()
  const pageTitle = location.pathname === '/health' ? 'API status' : 'Overview'

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="fixed inset-x-0 top-0 z-10 flex h-16 items-center justify-between border-b bg-white px-6">
        <div className="flex items-center gap-3">
          <div className="flex size-9 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <Activity aria-hidden="true" size={19} />
          </div>
          <span className="text-lg font-semibold tracking-tight">Sprintly</span>
          <span className="ml-2 hidden rounded-full border px-2.5 py-1 text-xs text-muted-foreground sm:inline">
            Workspace
          </span>
        </div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span className="size-2 rounded-full bg-slate-400" aria-hidden="true" />
          Project foundation
        </div>
      </header>

      <aside className="fixed bottom-0 left-0 top-16 hidden w-64 border-r bg-white p-4 md:block">
        <p className="mb-3 px-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Workspace
        </p>
        <nav aria-label="Main navigation" className="space-y-1">
          <NavLink
            to="/"
            end
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
        </nav>
        <div className="absolute inset-x-4 bottom-5 rounded-xl border bg-muted/40 p-3">
          <p className="text-sm font-medium">Project foundation</p>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
            The application shell is ready for the next implementation step.
          </p>
        </div>
      </aside>

      <main className="min-h-screen px-5 pb-10 pt-24 md:ml-64 md:px-10">
        <div className="mx-auto max-w-5xl">
          <div className="mb-8">
            <p className="text-sm text-muted-foreground">Workspace</p>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight">{pageTitle}</h1>
          </div>
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

function OverviewPage() {
  return (
    <div className="space-y-6">
      <section>
        <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
          Your application workspace is set up. This starter connects the React
          client to the NestJS API and is ready for the next step.
        </p>
      </section>
      <HealthStatus />
    </div>
  )
}

function HealthPage() {
  return (
    <div className="space-y-6">
      <p className="text-sm leading-6 text-muted-foreground">
        Confirm that the frontend can reach the backend health endpoint.
      </p>
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
      <Route element={<AppShell />}>
        <Route index element={<OverviewPage />} />
        <Route path="health" element={<HealthPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  )
}
