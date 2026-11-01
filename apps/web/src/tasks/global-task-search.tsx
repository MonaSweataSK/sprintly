import { useQuery } from '@tanstack/react-query'
import { LoaderCircle, Search } from 'lucide-react'
import { useEffect, useRef, useState, type KeyboardEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { searchTasks } from '@/lib/api'

const inputClassName =
  'h-10 w-full rounded-md border bg-background py-2 pl-9 pr-3 text-sm outline-none placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring'

export function GlobalTaskSearch() {
  const navigate = useNavigate()
  const containerRef = useRef<HTMLDivElement>(null)
  const [query, setQuery] = useState('')
  const [debouncedQuery, setDebouncedQuery] = useState('')
  const [isOpen, setIsOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(-1)
  const normalizedQuery = query.trim()

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setDebouncedQuery(normalizedQuery)
      setActiveIndex(-1)
    }, 250)
    return () => window.clearTimeout(timeout)
  }, [normalizedQuery])

  const searchQuery = useQuery({
    queryKey: ['task-search', debouncedQuery],
    queryFn: () => searchTasks(debouncedQuery),
    enabled: Boolean(debouncedQuery),
    staleTime: 15_000,
  })

  useEffect(() => {
    const handlePointerDown = (event: PointerEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('pointerdown', handlePointerDown)
    return () => document.removeEventListener('pointerdown', handlePointerDown)
  }, [])

  const results = searchQuery.data ?? []
  const isWaitingForSearch =
    normalizedQuery !== debouncedQuery || searchQuery.isPending

  function openResult(index: number) {
    const result = results[index]
    if (!result) return
    setQuery('')
    setDebouncedQuery('')
    setIsOpen(false)
    navigate(`/tasks/${encodeURIComponent(result.taskKey)}`)
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Escape') {
      setIsOpen(false)
      setActiveIndex(-1)
      return
    }
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      setIsOpen(true)
      setActiveIndex((index) => (results.length ? (index + 1) % results.length : -1))
      return
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault()
      setIsOpen(true)
      setActiveIndex((index) =>
        results.length ? (index <= 0 ? results.length - 1 : index - 1) : -1,
      )
      return
    }
    if (event.key === 'Enter' && activeIndex >= 0) {
      event.preventDefault()
      openResult(activeIndex)
    }
  }

  const showResults = isOpen && normalizedQuery.length > 0
  return (
    <div ref={containerRef} className="relative mx-3 min-w-0 max-w-lg flex-1">
      <label className="sr-only" htmlFor="global-task-search">
        Search tasks by key, title, or description
      </label>
      <div className="relative">
        <Search
          aria-hidden="true"
          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
          size={16}
        />
        <input
          id="global-task-search"
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={showResults}
          aria-controls="global-task-search-results"
          aria-activedescendant={activeIndex >= 0 ? `task-search-result-${activeIndex}` : undefined}
          className={inputClassName}
          placeholder="Search tasks…"
          autoComplete="off"
          value={query}
          onFocus={() => setIsOpen(true)}
          onChange={(event) => {
            setQuery(event.target.value)
            setIsOpen(true)
          }}
          onKeyDown={handleKeyDown}
        />
      </div>
      {showResults && (
        <div
          id="global-task-search-results"
          role="listbox"
          aria-label="Task search suggestions"
          className="absolute inset-x-0 top-full z-50 mt-2 max-h-96 overflow-y-auto rounded-lg border bg-white py-1 shadow-xl"
        >
          {isWaitingForSearch || searchQuery.isFetching ? (
            <p className="flex items-center gap-2 px-3 py-3 text-sm text-muted-foreground" role="status">
              <LoaderCircle aria-hidden="true" className="animate-spin" size={15} />
              Searching tasks…
            </p>
          ) : searchQuery.isError ? (
            <p className="px-3 py-3 text-sm text-destructive" role="alert">
              {searchQuery.error.message}
            </p>
          ) : results.length ? (
            results.map((result, index) => (
              <button
                key={result.id}
                id={`task-search-result-${index}`}
                type="button"
                role="option"
                aria-selected={activeIndex === index}
                tabIndex={-1}
                className={`block w-full px-3 py-2 text-left ${
                  activeIndex === index ? 'bg-accent' : 'hover:bg-muted/70'
                }`}
                onMouseDown={(event) => event.preventDefault()}
                onMouseEnter={() => setActiveIndex(index)}
                onClick={() => openResult(index)}
              >
                <span className="flex items-center justify-between gap-3">
                  <span className="truncate text-sm font-medium">{result.title}</span>
                  <span className="shrink-0 text-xs text-muted-foreground">{result.taskKey}</span>
                </span>
                <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                  {result.description?.trim() || result.sprintName || 'No description'}
                  {result.description && result.sprintName ? ` · ${result.sprintName}` : ''}
                </span>
              </button>
            ))
          ) : (
            <p className="px-3 py-3 text-sm text-muted-foreground" role="status">
              No tasks found.
            </p>
          )}
        </div>
      )}
    </div>
  )
}
