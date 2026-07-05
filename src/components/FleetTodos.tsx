import { useCallback, useEffect, useState } from 'react'
import { ChevronDown, Plus, Trash2, ListChecks } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '@/contexts/useAuth'
import {
  fetchFleetTodos,
  addFleetTodo,
  toggleFleetTodo,
  deleteFleetTodo,
} from '@/lib/fleetTodos'
import type { FleetTodo } from '@/lib/types'

export default function FleetTodos({ fleetId }: { fleetId: string }) {
  const { isAdmin } = useAuth()
  const { t } = useTranslation()

  const [todos, setTodos] = useState<FleetTodo[]>([])
  const [open, setOpen] = useState(false)
  const [newTitle, setNewTitle] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      setTodos(await fetchFleetTodos(fleetId))
    } catch {
      /* silent – section stays empty on error */
    }
  }, [fleetId])

  useEffect(() => { load() }, [load])

  const doneCount = todos.filter(td => td.done).length
  const totalCount = todos.length
  const allDone = totalCount > 0 && doneCount === totalCount
  const progressPct = totalCount > 0 ? (doneCount / totalCount) * 100 : 0

  async function handleAdd() {
    const title = newTitle.trim()
    if (!title || busy) return
    setBusy(true)
    setError(null)
    try {
      const created = await addFleetTodo(fleetId, title, totalCount)
      setTodos(prev => [...prev, created])
      setNewTitle('')
    } catch (err) {
      console.error('[FleetTodos] add failed:', err)
      setError(t('fleet_todos.save_failed'))
    } finally {
      setBusy(false)
    }
  }

  async function handleToggle(todo: FleetTodo) {
    const done = !todo.done
    setError(null)
    setTodos(prev => prev.map(td => (td.id === todo.id ? { ...td, done } : td)))
    try {
      await toggleFleetTodo(todo.id, done)
    } catch (err) {
      console.error('[FleetTodos] toggle failed:', err)
      setTodos(prev => prev.map(td => (td.id === todo.id ? { ...td, done: !done } : td)))
      setError(t('fleet_todos.save_failed'))
    }
  }

  async function handleDelete(id: string) {
    const prev = todos
    setError(null)
    setTodos(p => p.filter(td => td.id !== id))
    try {
      await deleteFleetTodo(id)
    } catch (err) {
      console.error('[FleetTodos] delete failed:', err)
      setTodos(prev)
      setError(t('fleet_todos.save_failed'))
    }
  }

  return (
    <div className="mt-2 bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-gray-50 transition-colors"
      >
        <ListChecks size={18} className={allDone ? 'text-emerald-500' : 'text-gray-400'} />
        <span className="flex-1 font-semibold text-gray-700 text-sm uppercase tracking-wide">
          {t('fleet_todos.title')}
        </span>

        {totalCount > 0 && (
          <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
            allDone
              ? 'bg-emerald-100 text-emerald-700'
              : 'bg-gray-100 text-gray-500'
          }`}>
            {doneCount}/{totalCount}
          </span>
        )}

        <ChevronDown
          size={16}
          className={`text-gray-400 flex-shrink-0 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {totalCount > 0 && (
        <div className="px-4 -mt-1 pb-2">
          <div className="h-1 rounded-full bg-gray-100 overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-300"
              style={{
                width: `${progressPct}%`,
                backgroundColor: allDone ? '#10b981' : '#3b82f6',
              }}
            />
          </div>
        </div>
      )}

      {open && (
        <div className="border-t border-gray-100">
          {todos.length === 0 && (
            <p className="text-sm text-gray-400 text-center py-4">
              {t('fleet_todos.empty')}
            </p>
          )}

          <ul>
            {todos.map(todo => (
              <li
                key={todo.id}
                className="flex items-center gap-3 px-4 py-2.5 border-b border-gray-50 last:border-b-0"
              >
                <button
                  onClick={() => handleToggle(todo)}
                  className={`w-5 h-5 rounded-md border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
                    todo.done
                      ? 'bg-emerald-500 border-emerald-500 text-white'
                      : 'border-gray-300 hover:border-gray-400'
                  }`}
                >
                  {todo.done && (
                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                      <path d="M2.5 6L5 8.5L9.5 3.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  )}
                </button>

                <span className={`flex-1 text-sm ${
                  todo.done ? 'text-gray-400 line-through' : 'text-gray-900'
                }`}>
                  {todo.title}
                </span>

                {isAdmin && (
                  <button
                    onClick={() => handleDelete(todo.id)}
                    className="p-1 text-gray-300 hover:text-red-400 transition-colors flex-shrink-0"
                  >
                    <Trash2 size={14} />
                  </button>
                )}
              </li>
            ))}
          </ul>

          {error && (
            <p className="px-4 pt-2 text-xs text-red-500">{error}</p>
          )}

          <div className="flex items-center gap-2 px-4 py-2.5 border-t border-gray-100">
            <input
              value={newTitle}
              onChange={e => setNewTitle(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleAdd()}
              placeholder={t('fleet_todos.placeholder')}
              className="flex-1 text-sm bg-transparent outline-none placeholder:text-gray-300"
            />
            <button
              onClick={handleAdd}
              disabled={!newTitle.trim() || busy}
              className="p-1 text-gray-300 hover:text-blue-600 disabled:opacity-30 transition-colors"
            >
              <Plus size={18} />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
