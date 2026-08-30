import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Plus, Trash2, ChevronDown, Package, User, Pencil, X,
  Circle, ShoppingCart, Check, PackageCheck,
} from 'lucide-react'
import Layout from '@/components/Layout'
import { useAuth } from '@/contexts/useAuth'
import {
  fetchPackingItems, addPackingItem, updatePackingItem, deletePackingItem,
} from '@/lib/packingItems'
import type { PackingItem, PackingStatus } from '@/lib/types'

// ─── Status-Konfiguration (Farben + Icons) ────────────────────────────────────

const STATUS_ORDER: PackingStatus[] = ['offen', 'kaufen', 'gekauft', 'gepackt']

const STATUS_META: Record<PackingStatus, {
  icon: typeof Circle
  chip: string          // Klassen für die Status-Pille am Eintrag
  dot: string           // Farbe für den Filter-Punkt
}> = {
  offen:   { icon: Circle,       chip: 'bg-gray-100 text-gray-500',        dot: '#9ca3af' },
  kaufen:  { icon: ShoppingCart, chip: 'bg-amber-100 text-amber-700',      dot: '#f59e0b' },
  gekauft: { icon: Check,        chip: 'bg-blue-100 text-blue-700',        dot: '#3b82f6' },
  gepackt: { icon: PackageCheck, chip: 'bg-emerald-100 text-emerald-700',  dot: '#10b981' },
}

type Filter = 'alle' | PackingStatus

// ─── Packliste-Seite ──────────────────────────────────────────────────────────

export default function Packliste() {
  const { t } = useTranslation()
  const { userName } = useAuth()

  const [items, setItems] = useState<PackingItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState<Filter>('alle')
  const [menuId, setMenuId] = useState<string | null>(null)
  const [editId, setEditId] = useState<string | null>(null)

  // Add-Form
  const [name, setName] = useState('')
  const [quantity, setQuantity] = useState('')
  const [category, setCategory] = useState('')
  const [newStatus, setNewStatus] = useState<PackingStatus>('offen')
  const [busy, setBusy] = useState(false)

  const statusLabel = useCallback(
    (s: PackingStatus) => t(`packing.status.${s}`),
    [t],
  )

  const load = useCallback(async () => {
    setLoading(true)
    try {
      setItems(await fetchPackingItems())
      setError(null)
    } catch (err) {
      console.error('[Packliste] load failed:', err)
      setError(t('packing.load_failed'))
    } finally {
      setLoading(false)
    }
  }, [t])

  useEffect(() => { load() }, [load])

  // Zähler je Status (für die Filter-Chips)
  const counts = useMemo(() => {
    const c: Record<Filter, number> = { alle: items.length, offen: 0, kaufen: 0, gekauft: 0, gepackt: 0 }
    for (const it of items) c[it.status]++
    return c
  }, [items])

  const visible = useMemo(
    () => (filter === 'alle' ? items : items.filter(it => it.status === filter)),
    [items, filter],
  )

  // Gruppierung nach Kategorie (Einträge ohne Kategorie ans Ende)
  const groups = useMemo(() => {
    const map = new Map<string, PackingItem[]>()
    for (const it of visible) {
      const key = (it.category ?? '').trim() || '__none__'
      if (!map.has(key)) map.set(key, [])
      map.get(key)!.push(it)
    }
    return [...map.entries()].sort(([a], [b]) => {
      if (a === '__none__') return 1
      if (b === '__none__') return -1
      return a.localeCompare(b)
    })
  }, [visible])

  async function handleAdd() {
    const trimmed = name.trim()
    if (!trimmed || busy) return
    setBusy(true)
    setError(null)
    try {
      const created = await addPackingItem({
        name: trimmed,
        quantity: quantity.trim() || null,
        category: category.trim() || null,
        status: newStatus,
        position: items.length,
        created_by: userName || null,
      })
      setItems(prev => [...prev, created])
      setName('')
      setQuantity('')
      // Kategorie & Status für schnelle Mehrfacheingabe beibehalten
    } catch (err) {
      console.error('[Packliste] add failed:', err)
      setError(t('packing.save_failed'))
    } finally {
      setBusy(false)
    }
  }

  async function handleStatus(item: PackingItem, status: PackingStatus) {
    setMenuId(null)
    if (status === item.status) return
    const prev = items
    setItems(p => p.map(it => (it.id === item.id ? { ...it, status } : it)))
    try {
      await updatePackingItem(item.id, { status })
    } catch (err) {
      console.error('[Packliste] status failed:', err)
      setItems(prev)
      setError(t('packing.save_failed'))
    }
  }

  /** Speichert die im Inline-Editor geänderten Felder eines Eintrags. */
  async function handleEditSave(
    item: PackingItem,
    patch: Pick<PackingItem, 'name' | 'quantity' | 'category'>,
  ) {
    const unchanged =
      patch.name === item.name &&
      patch.quantity === item.quantity &&
      patch.category === item.category
    setEditId(null)
    if (unchanged) return

    const prev = items
    setItems(p => p.map(it => (it.id === item.id ? { ...it, ...patch } : it)))
    setError(null)
    try {
      await updatePackingItem(item.id, patch)
    } catch (err) {
      console.error('[Packliste] edit failed:', err)
      setItems(prev)
      setError(t('packing.save_failed'))
    }
  }

  async function handleDelete(id: string) {
    const prev = items
    setItems(p => p.filter(it => it.id !== id))
    try {
      await deletePackingItem(id)
    } catch (err) {
      console.error('[Packliste] delete failed:', err)
      setItems(prev)
      setError(t('packing.save_failed'))
    }
  }

  return (
    <Layout
      header={
        <div className="flex items-center justify-between">
          <h1 className="text-lg font-bold text-gray-900">{t('packing.title')}</h1>
          <img src="/logo.png" alt="carhandling" className="h-11 w-auto" />
        </div>
      }
    >
      <div className="p-4 space-y-4">

        {/* Filter-Chips */}
        <div className="flex gap-2 overflow-x-auto -mx-1 px-1 pb-1">
          {(['alle', ...STATUS_ORDER] as Filter[]).map((f) => {
            const active = filter === f
            return (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`flex items-center gap-1.5 flex-shrink-0 px-3 py-1.5 rounded-full text-sm font-medium border transition-colors ${
                  active
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'bg-white text-gray-600 border-gray-200 hover:border-blue-300'
                }`}
              >
                {f !== 'alle' && (
                  <span className="w-2 h-2 rounded-full flex-shrink-0"
                    style={{ backgroundColor: STATUS_META[f].dot }} />
                )}
                {f === 'alle' ? t('packing.filter_all') : statusLabel(f)}
                <span className={`text-xs ${active ? 'text-blue-100' : 'text-gray-400'}`}>
                  {counts[f]}
                </span>
              </button>
            )
          })}
        </div>

        {/* Hinzufügen */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 space-y-3">
          <div className="flex items-center gap-2 text-gray-700 font-semibold text-sm">
            <Plus size={18} />
            {t('packing.add_title')}
          </div>

          <input
            value={name}
            onChange={e => setName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleAdd()}
            placeholder={t('packing.name_placeholder')}
            className="w-full px-3 py-2.5 rounded-xl border border-gray-300 focus:outline-none focus:border-blue-400 text-sm"
          />

          <div className="flex gap-2">
            <input
              value={quantity}
              onChange={e => setQuantity(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleAdd()}
              placeholder={t('packing.qty_placeholder')}
              className="w-1/3 px-3 py-2.5 rounded-xl border border-gray-300 focus:outline-none focus:border-blue-400 text-sm"
            />
            <input
              value={category}
              onChange={e => setCategory(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleAdd()}
              placeholder={t('packing.category_placeholder')}
              className="flex-1 px-3 py-2.5 rounded-xl border border-gray-300 focus:outline-none focus:border-blue-400 text-sm"
            />
          </div>

          {/* Initial-Status wählen */}
          <div className="flex gap-1.5 flex-wrap">
            {STATUS_ORDER.map((s) => {
              const Icon = STATUS_META[s].icon
              const active = newStatus === s
              return (
                <button
                  key={s}
                  type="button"
                  onClick={() => setNewStatus(s)}
                  className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                    active
                      ? STATUS_META[s].chip + ' border-transparent ring-2 ring-offset-1 ring-blue-300'
                      : 'bg-white text-gray-500 border-gray-200'
                  }`}
                >
                  <Icon size={13} />
                  {statusLabel(s)}
                </button>
              )
            })}
          </div>

          <button
            onClick={handleAdd}
            disabled={!name.trim() || busy}
            className="w-full py-2.5 rounded-xl bg-blue-600 text-white font-medium disabled:opacity-40 hover:bg-blue-700 transition-colors"
          >
            {busy ? t('common.loading') : t('packing.add_btn')}
          </button>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-red-700 text-sm">
            {error}
          </div>
        )}

        {/* Liste */}
        {loading ? (
          <div className="space-y-2">
            {[0, 1, 2].map(i => <div key={i} className="h-14 bg-gray-100 rounded-2xl animate-pulse" />)}
          </div>
        ) : visible.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm py-10 text-center">
            <Package size={32} className="mx-auto text-gray-300 mb-2" />
            <p className="text-sm text-gray-400">{t('packing.empty')}</p>
          </div>
        ) : (
          <div className="space-y-4">
            {groups.map(([cat, groupItems]) => (
              <div key={cat}>
                <h2 className="px-1 mb-1.5 text-xs font-semibold uppercase tracking-wide text-gray-400">
                  {cat === '__none__' ? t('packing.no_category') : cat}
                </h2>
                <ul className="bg-white rounded-2xl border border-gray-100 shadow-sm">
                  {groupItems.map((item) => (
                    <PackingRow
                      key={item.id}
                      item={item}
                      menuOpen={menuId === item.id}
                      onToggleMenu={() => setMenuId(id => (id === item.id ? null : item.id))}
                      onSetStatus={(s) => handleStatus(item, s)}
                      onDelete={() => handleDelete(item.id)}
                      statusLabel={statusLabel}
                      editing={editId === item.id}
                      onStartEdit={() => { setMenuId(null); setEditId(item.id) }}
                      onCancelEdit={() => setEditId(null)}
                      onSaveEdit={(patch) => handleEditSave(item, patch)}
                    />
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
      </div>
    </Layout>
  )
}

// ─── Einzelner Listeneintrag ──────────────────────────────────────────────────

function PackingRow({
  item, menuOpen, onToggleMenu, onSetStatus, onDelete, statusLabel,
  editing, onStartEdit, onCancelEdit, onSaveEdit,
}: {
  item: PackingItem
  menuOpen: boolean
  onToggleMenu: () => void
  onSetStatus: (s: PackingStatus) => void
  onDelete: () => void
  statusLabel: (s: PackingStatus) => string
  editing: boolean
  onStartEdit: () => void
  onCancelEdit: () => void
  onSaveEdit: (patch: Pick<PackingItem, 'name' | 'quantity' | 'category'>) => void
}) {
  const { t } = useTranslation()
  const meta = STATUS_META[item.status]
  const Icon = meta.icon
  const done = item.status === 'gepackt'
  const menuRef = useRef<HTMLDivElement>(null)
  const btnRef = useRef<HTMLButtonElement>(null)
  const [openUp, setOpenUp] = useState(false)

  // Klick ausserhalb schliesst das Status-Menü
  useEffect(() => {
    if (!menuOpen) return
    function onDoc(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) onToggleMenu()
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [menuOpen, onToggleMenu])

  // Bei zu wenig Platz nach unten (z. B. letzte Zeile) nach oben aufklappen
  useEffect(() => {
    if (menuOpen && btnRef.current) {
      const spaceBelow = window.innerHeight - btnRef.current.getBoundingClientRect().bottom
      setOpenUp(spaceBelow < 220)
    }
  }, [menuOpen])

  // Der Editor ist eine eigene Komponente: Sie wird beim Öffnen frisch gemountet
  // und übernimmt die Werte des Eintrags damit ohne Sync-Effekt.
  if (editing) {
    return <PackingEditRow item={item} onCancel={onCancelEdit} onSave={onSaveEdit} />
  }

  return (
    <li className="flex items-center gap-3 px-3 py-2.5 border-b border-gray-50 last:border-b-0">
      <div className="flex-1 min-w-0">
        <p className={`text-sm truncate ${done ? 'text-gray-400 line-through' : 'text-gray-900'}`}>
          {item.name}
        </p>
        {(item.quantity || item.created_by) && (
          <p className="text-xs text-gray-400 flex items-center gap-1.5 min-w-0">
            {item.quantity && <span className="truncate">{item.quantity}</span>}
            {item.quantity && item.created_by && (
              <span className="text-gray-300 flex-shrink-0">·</span>
            )}
            {item.created_by && (
              <span
                className="inline-flex items-center gap-1 min-w-0"
                title={t('packing.added_by', { name: item.created_by })}
              >
                <User size={11} className="flex-shrink-0" />
                <span className="truncate">{item.created_by}</span>
              </span>
            )}
          </p>
        )}
      </div>

      {/* Status-Pille mit Dropdown */}
      <div ref={menuRef} className="relative flex-shrink-0">
        <button
          ref={btnRef}
          onClick={onToggleMenu}
          className={`flex items-center gap-1 pl-2 pr-1.5 py-1 rounded-full text-xs font-medium ${meta.chip}`}
        >
          <Icon size={13} />
          {statusLabel(item.status)}
          <ChevronDown size={12} className={`transition-transform ${menuOpen ? 'rotate-180' : ''}`} />
        </button>

        {menuOpen && (
          <div className={`absolute right-0 z-50 w-36 bg-white rounded-xl border border-gray-200 shadow-lg overflow-hidden ${
            openUp ? 'bottom-full mb-1' : 'top-full mt-1'
          }`}>
            {STATUS_ORDER.map((s) => {
              const SIcon = STATUS_META[s].icon
              const active = s === item.status
              return (
                <button
                  key={s}
                  onClick={() => onSetStatus(s)}
                  className={`w-full flex items-center gap-2 px-3 py-2 text-sm text-left hover:bg-gray-50 ${
                    active ? 'font-semibold text-gray-900' : 'text-gray-600'
                  }`}
                >
                  <span className="w-2 h-2 rounded-full flex-shrink-0"
                    style={{ backgroundColor: STATUS_META[s].dot }} />
                  <SIcon size={13} className="text-gray-400" />
                  {statusLabel(s)}
                </button>
              )
            })}
          </div>
        )}
      </div>

      <button
        onClick={onStartEdit}
        aria-label={t('packing.edit_btn')}
        className="p-1 text-gray-300 hover:text-blue-500 transition-colors flex-shrink-0"
      >
        <Pencil size={15} />
      </button>

      <button
        onClick={onDelete}
        aria-label={t('common.delete')}
        className="p-1 text-gray-300 hover:text-red-400 transition-colors flex-shrink-0"
      >
        <Trash2 size={15} />
      </button>
    </li>
  )
}

// ─── Inline-Editor für einen Eintrag ──────────────────────────────────────────

function PackingEditRow({
  item, onCancel, onSave,
}: {
  item: PackingItem
  onCancel: () => void
  onSave: (patch: Pick<PackingItem, 'name' | 'quantity' | 'category'>) => void
}) {
  const { t } = useTranslation()
  const [name, setName] = useState(item.name)
  const [quantity, setQuantity] = useState(item.quantity ?? '')
  const [category, setCategory] = useState(item.category ?? '')

  function submit() {
    const trimmed = name.trim()
    if (!trimmed) return
    onSave({
      name: trimmed,
      quantity: quantity.trim() || null,
      category: category.trim() || null,
    })
  }

  function onKey(e: React.KeyboardEvent) {
    if (e.key === 'Enter') submit()
    if (e.key === 'Escape') onCancel()
  }

  return (
    <li className="px-3 py-2.5 border-b border-gray-50 last:border-b-0 bg-blue-50/40 space-y-2">
      <input
        autoFocus
        value={name}
        onChange={e => setName(e.target.value)}
        onKeyDown={onKey}
        placeholder={t('packing.name_placeholder')}
        className="w-full px-3 py-2 rounded-xl border border-gray-300 focus:outline-none focus:border-blue-400 text-sm"
      />

      <div className="flex gap-2">
        <input
          value={quantity}
          onChange={e => setQuantity(e.target.value)}
          onKeyDown={onKey}
          placeholder={t('packing.qty_placeholder')}
          className="w-1/3 px-3 py-2 rounded-xl border border-gray-300 focus:outline-none focus:border-blue-400 text-sm"
        />
        <input
          value={category}
          onChange={e => setCategory(e.target.value)}
          onKeyDown={onKey}
          placeholder={t('packing.category_placeholder')}
          className="flex-1 px-3 py-2 rounded-xl border border-gray-300 focus:outline-none focus:border-blue-400 text-sm"
        />
      </div>

      <div className="flex gap-2">
        <button
          onClick={submit}
          disabled={!name.trim()}
          className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl bg-blue-600 text-white text-sm font-medium disabled:opacity-40 hover:bg-blue-700 transition-colors"
        >
          <Check size={15} />
          {t('packing.save_btn')}
        </button>
        <button
          onClick={onCancel}
          className="flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl border border-gray-300 text-gray-600 text-sm font-medium hover:bg-gray-50 transition-colors"
        >
          <X size={15} />
          {t('common.cancel')}
        </button>
      </div>
    </li>
  )
}
