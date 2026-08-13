import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ZONE_LABEL_EN, TRUCK_ZONES } from '@/lib/damages'

const TRUCK_ZONE_EMOJI: Record<string, string> = {
  'Kabine': '🚚', 'Aufbau': '📦', 'Ladefläche': '🛻', 'Unterfahrschutz': '🛡️',
}

type ViewId = 'top' | 'front' | 'back' | 'left' | 'right'

interface Props {
  value: string | null
  onChange: (pos: string) => void
}

const ZONE_TO_VIEW: Record<string, ViewId> = {
  'Motorhaube': 'top', 'Dach': 'top', 'Spiegel links': 'top', 'Spiegel rechts': 'top',
  'Frontscheibe': 'front', 'Scheinwerfer links': 'front', 'Scheinwerfer rechts': 'front',
  'Stoßfänger vorne': 'front', 'Kennzeichen vorne': 'front',
  'Heckscheibe': 'back', 'Rückleuchte links': 'back', 'Rückleuchte rechts': 'back',
  'Stoßfänger hinten': 'back', 'Kennzeichen hinten': 'back',
  'Kotflügel vorne links': 'left', 'Tür vorne links': 'left', 'Tür hinten links': 'left',
  'Kotflügel hinten links': 'left', 'Seitenscheibe vorne links': 'left',
  'Seitenscheibe hinten links': 'left', 'Reifen vorne links': 'left',
  'Felge vorne links': 'left', 'Reifen hinten links': 'left', 'Felge hinten links': 'left',
  'Kotflügel vorne rechts': 'right', 'Tür vorne rechts': 'right', 'Tür hinten rechts': 'right',
  'Kotflügel hinten rechts': 'right', 'Seitenscheibe vorne rechts': 'right',
  'Seitenscheibe hinten rechts': 'right', 'Reifen vorne rechts': 'right',
  'Felge vorne rechts': 'right', 'Reifen hinten rechts': 'right', 'Felge hinten rechts': 'right',
}

// Abbreviated SVG zone labels — DE (split on | = new line)
const SHORT_DE: Record<string, string> = {
  'Motorhaube': 'Motor-|haube', 'Dach': 'Dach',
  'Spiegel links': 'Spiegel|links', 'Spiegel rechts': 'Spiegel|rechts',
  'Frontscheibe': 'Front-|scheibe',
  'Scheinwerfer links': 'Schein-|werfer|li.', 'Scheinwerfer rechts': 'Schein-|werfer|re.',
  'Stoßfänger vorne': 'Stoßf.|vorne', 'Kennzeichen vorne': 'KZ|vorne',
  'Heckscheibe': 'Heck-|scheibe',
  'Rückleuchte links': 'Rückl.|links', 'Rückleuchte rechts': 'Rückl.|rechts',
  'Stoßfänger hinten': 'Stoßf.|hinten', 'Kennzeichen hinten': 'KZ|hinten',
  'Kotflügel vorne': 'Kotfl.|vorne', 'Kotflügel hinten': 'Kotfl.|hinten',
  'Seitenscheibe vorne': 'Scheibe|vorne', 'Seitenscheibe hinten': 'Scheibe|hinten',
  'Tür vorne': 'Tür|vorne', 'Tür hinten': 'Tür|hinten',
  'Reifen vorne': 'Reifen|vorne', 'Reifen hinten': 'Reifen|hinten',
  'Felge vorne': 'Felge|vorne', 'Felge hinten': 'Felge|hinten',
}

// Abbreviated SVG zone labels — EN
const SHORT_EN: Record<string, string> = {
  'Motorhaube': 'Hood', 'Dach': 'Roof',
  'Spiegel links': 'Mirror|left', 'Spiegel rechts': 'Mirror|right',
  'Frontscheibe': 'Wind-|shield',
  'Scheinwerfer links': 'Head-|light|li.', 'Scheinwerfer rechts': 'Head-|light|re.',
  'Stoßfänger vorne': 'Bumper|front', 'Kennzeichen vorne': 'Plate|front',
  'Heckscheibe': 'Rear|window',
  'Rückleuchte links': 'Tail lt.|left', 'Rückleuchte rechts': 'Tail lt.|right',
  'Stoßfänger hinten': 'Bumper|rear', 'Kennzeichen hinten': 'Plate|rear',
  'Kotflügel vorne': 'Fender|front', 'Kotflügel hinten': 'Fender|rear',
  'Seitenscheibe vorne': 'Window|front', 'Seitenscheibe hinten': 'Window|rear',
  'Tür vorne': 'Door|front', 'Tür hinten': 'Door|rear',
  'Reifen vorne': 'Tire|front', 'Reifen hinten': 'Tire|rear',
  'Felge vorne': 'Rim|front', 'Felge hinten': 'Rim|rear',
}


function sl(key: string, lang: string): string[] {
  const map = lang === 'en' ? SHORT_EN : SHORT_DE
  return (map[key] ?? key).split('|')
}

// ─── Colors ───────────────────────────────────────────────────────────────────

function zFill(sel: boolean)   { return sel ? '#fbbf24' : '#e5e7eb' }
function zStroke(sel: boolean) { return sel ? '#d97706' : '#9ca3af' }
function zText(sel: boolean)   { return sel ? '#78350f' : '#374151' }

// ─── Label helper ─────────────────────────────────────────────────────────────

function Label({ x, y, lines, fontSize = 9, sel }: {
  x: number; y: number; lines: string[]; fontSize?: number; sel: boolean
}) {
  const lh = fontSize + 2
  return (
    <>
      {lines.map((line, i) => (
        <text key={i} x={x} y={y + (i - (lines.length - 1) / 2) * lh}
          textAnchor="middle" dominantBaseline="middle"
          fontSize={fontSize} fontWeight={sel ? '700' : '500'}
          fill={zText(sel)} style={{ userSelect: 'none', pointerEvents: 'none' }}>
          {line}
        </text>
      ))}
    </>
  )
}

// ─── Zone props helper ────────────────────────────────────────────────────────

function zp(pos: string, sel: string, on: (p: string) => void) {
  const active = sel === pos
  return {
    fill: zFill(active), stroke: zStroke(active), strokeWidth: 1.5 as number,
    onClick: () => on(pos), style: { cursor: 'pointer' as const },
  }
}

// ─── TOP VIEW ─────────────────────────────────────────────────────────────────

function TopView({ sel, on, lang }: { sel: string; on: (p: string) => void; lang: string }) {
  return (
    <svg viewBox="0 0 360 240" width="100%" height="100%" preserveAspectRatio="xMidYMid meet">
      <path d="M 18,145 L 18,95 L 28,64 L 58,60 L 103,55 L 106,30 L 152,30 L 155,55 L 268,58 L 295,62 L 338,78 L 342,120 L 338,162 L 295,178 L 268,182 L 155,185 L 152,210 L 106,210 L 103,185 L 58,180 L 28,176 Z"
        fill="#f9fafb" stroke="#6b7280" strokeWidth={1.5} />
      <line x1="138" y1="68" x2="138" y2="172" stroke="#d1d5db" strokeWidth={1.5} strokeDasharray="5 3" />
      <line x1="268" y1="68" x2="268" y2="172" stroke="#d1d5db" strokeWidth={1.5} strokeDasharray="5 3" />
      <polygon points="25,175 25,65 55,62 135,60 135,180 55,178" {...zp('Motorhaube', sel, on)} />
      <Label x={80} y={120} lines={sl('Motorhaube', lang)} fontSize={11} sel={sel === 'Motorhaube'} />
      <rect x={155} y={62} width={110} height={116} rx={4} {...zp('Dach', sel, on)} />
      <Label x={210} y={120} lines={sl('Dach', lang)} fontSize={13} sel={sel === 'Dach'} />
      <rect x={103} y={178} width={50} height={34} rx={3} {...zp('Spiegel links', sel, on)} />
      <Label x={128} y={195} lines={sl('Spiegel links', lang)} fontSize={7.5} sel={sel === 'Spiegel links'} />
      <rect x={103} y={28} width={50} height={34} rx={3} {...zp('Spiegel rechts', sel, on)} />
      <Label x={128} y={45} lines={sl('Spiegel rechts', lang)} fontSize={7.5} sel={sel === 'Spiegel rechts'} />
    </svg>
  )
}

// ─── FRONT VIEW ───────────────────────────────────────────────────────────────

function FrontView({ sel, on, lang }: { sel: string; on: (p: string) => void; lang: string }) {
  return (
    <svg viewBox="0 0 300 200" width="100%" height="100%" preserveAspectRatio="xMidYMid meet">
      <path d="M 110,15 L 190,15 L 225,26 L 230,58 L 275,60 L 276,130 L 268,162 L 32,162 L 24,130 L 25,60 L 70,58 L 75,26 Z"
        fill="#f9fafb" stroke="#6b7280" strokeWidth={1.5} />
      <rect x={84} y={92} width={132} height={38} rx={4} fill="#f3f4f6" stroke="#d1d5db" strokeWidth={1} />
      <polygon points="88,18 212,18 222,90 78,90" {...zp('Frontscheibe', sel, on)} />
      <Label x={150} y={55} lines={sl('Frontscheibe', lang)} fontSize={10} sel={sel === 'Frontscheibe'} />
      <polygon points="28,60 84,60 84,128 25,125" {...zp('Scheinwerfer links', sel, on)} />
      <Label x={56} y={94} lines={sl('Scheinwerfer links', lang)} fontSize={8.5} sel={sel === 'Scheinwerfer links'} />
      <polygon points="216,60 272,60 275,125 216,128" {...zp('Scheinwerfer rechts', sel, on)} />
      <Label x={244} y={94} lines={sl('Scheinwerfer rechts', lang)} fontSize={8.5} sel={sel === 'Scheinwerfer rechts'} />
      <rect x={28} y={133} width={244} height={26} rx={6} {...zp('Stoßfänger vorne', sel, on)} />
      <Label x={150} y={146} lines={sl('Stoßfänger vorne', lang)} fontSize={9.5} sel={sel === 'Stoßfänger vorne'} />
      <rect x={112} y={136} width={76} height={20} rx={3} {...zp('Kennzeichen vorne', sel, on)} />
      <Label x={150} y={146} lines={sl('Kennzeichen vorne', lang)} fontSize={8} sel={sel === 'Kennzeichen vorne'} />
    </svg>
  )
}

// ─── REAR VIEW ────────────────────────────────────────────────────────────────

function RearView({ sel, on, lang }: { sel: string; on: (p: string) => void; lang: string }) {
  return (
    <svg viewBox="0 0 300 200" width="100%" height="100%" preserveAspectRatio="xMidYMid meet">
      <path d="M 110,15 L 190,15 L 225,26 L 230,58 L 275,60 L 276,130 L 268,162 L 32,162 L 24,130 L 25,60 L 70,58 L 75,26 Z"
        fill="#f9fafb" stroke="#6b7280" strokeWidth={1.5} />
      <polygon points="95,18 205,18 215,80 85,80" {...zp('Heckscheibe', sel, on)} />
      <Label x={150} y={50} lines={sl('Heckscheibe', lang)} fontSize={10} sel={sel === 'Heckscheibe'} />
      <rect x={28} y={60} width={58} height={68} rx={4} {...zp('Rückleuchte links', sel, on)} />
      <Label x={57} y={94} lines={sl('Rückleuchte links', lang)} fontSize={9} sel={sel === 'Rückleuchte links'} />
      <rect x={214} y={60} width={58} height={68} rx={4} {...zp('Rückleuchte rechts', sel, on)} />
      <Label x={243} y={94} lines={sl('Rückleuchte rechts', lang)} fontSize={9} sel={sel === 'Rückleuchte rechts'} />
      <rect x={28} y={133} width={244} height={26} rx={6} {...zp('Stoßfänger hinten', sel, on)} />
      <Label x={150} y={146} lines={sl('Stoßfänger hinten', lang)} fontSize={9.5} sel={sel === 'Stoßfänger hinten'} />
      <rect x={108} y={92} width={84} height={28} rx={3} {...zp('Kennzeichen hinten', sel, on)} />
      <Label x={150} y={106} lines={sl('Kennzeichen hinten', lang)} fontSize={8} sel={sel === 'Kennzeichen hinten'} />
    </svg>
  )
}

// ─── SIDE VIEWS ───────────────────────────────────────────────────────────────

const SIDE_OUTLINE =
  'M 30,168 L 30,138 C 32,118 45,108 60,105 ' +
  'L 62,58 C 62,22 78,12 152,12 ' +
  'L 285,10 C 395,10 415,12 428,16 ' +
  'L 510,58 L 512,168 ' +
  'L 462,168 A 40,40 0 0 0 382,168 ' +
  'L 143,168 A 40,40 0 0 0 63,168 Z'

function LeftView({ sel, on, lang }: { sel: string; on: (p: string) => void; lang: string }) {
  const sx = ' links'
  return (
    <svg viewBox="0 0 540 235" width="100%" height="100%" preserveAspectRatio="xMidYMid meet">
      <path d={SIDE_OUTLINE} fill="#f9fafb" stroke="#6b7280" strokeWidth={1.5} />
      <line x1="152" y1="95" x2="418" y2="95" stroke="#d1d5db" strokeWidth={1.5} strokeDasharray="6 3" />
      <rect x={55} y={52} width={92} height={116} rx={4} {...zp('Kotflügel vorne' + sx, sel, on)} />
      <Label x={101} y={110} lines={sl('Kotflügel vorne', lang)} fontSize={9} sel={sel === 'Kotflügel vorne' + sx} />
      <rect x={152} y={12} width={130} height={81} rx={4} {...zp('Seitenscheibe vorne' + sx, sel, on)} />
      <Label x={217} y={53} lines={sl('Seitenscheibe vorne', lang)} fontSize={9} sel={sel === 'Seitenscheibe vorne' + sx} />
      <rect x={152} y={95} width={130} height={71} rx={4} {...zp('Tür vorne' + sx, sel, on)} />
      <Label x={217} y={130} lines={sl('Tür vorne', lang)} fontSize={9} sel={sel === 'Tür vorne' + sx} />
      <rect x={287} y={12} width={128} height={81} rx={4} {...zp('Seitenscheibe hinten' + sx, sel, on)} />
      <Label x={351} y={53} lines={sl('Seitenscheibe hinten', lang)} fontSize={9} sel={sel === 'Seitenscheibe hinten' + sx} />
      <rect x={287} y={95} width={128} height={71} rx={4} {...zp('Tür hinten' + sx, sel, on)} />
      <Label x={351} y={130} lines={sl('Tür hinten', lang)} fontSize={9} sel={sel === 'Tür hinten' + sx} />
      <rect x={420} y={52} width={88} height={116} rx={4} {...zp('Kotflügel hinten' + sx, sel, on)} />
      <Label x={464} y={110} lines={sl('Kotflügel hinten', lang)} fontSize={9} sel={sel === 'Kotflügel hinten' + sx} />
      <circle cx={103} cy={188} r={44} {...zp('Reifen vorne' + sx, sel, on)} />
      <Label x={103} y={218} lines={sl('Reifen vorne', lang)} fontSize={7} sel={sel === 'Reifen vorne' + sx} />
      <circle cx={103} cy={188} r={20} {...zp('Felge vorne' + sx, sel, on)} />
      <Label x={103} y={188} lines={sl('Felge vorne', lang)} fontSize={7.5} sel={sel === 'Felge vorne' + sx} />
      <circle cx={422} cy={188} r={44} {...zp('Reifen hinten' + sx, sel, on)} />
      <Label x={422} y={218} lines={sl('Reifen hinten', lang)} fontSize={7} sel={sel === 'Reifen hinten' + sx} />
      <circle cx={422} cy={188} r={20} {...zp('Felge hinten' + sx, sel, on)} />
      <Label x={422} y={188} lines={sl('Felge hinten', lang)} fontSize={7.5} sel={sel === 'Felge hinten' + sx} />
    </svg>
  )
}

function RightView({ sel, on, lang }: { sel: string; on: (p: string) => void; lang: string }) {
  const sx = ' rechts'
  return (
    <svg viewBox="0 0 540 235" width="100%" height="100%" preserveAspectRatio="xMidYMid meet">
      <g transform="scale(-1,1) translate(-540,0)">
        <path d={SIDE_OUTLINE} fill="#f9fafb" stroke="#6b7280" strokeWidth={1.5} />
        <line x1="152" y1="95" x2="418" y2="95" stroke="#d1d5db" strokeWidth={1.5} strokeDasharray="6 3" />
      </g>
      <rect x={393} y={52} width={92} height={116} rx={4} {...zp('Kotflügel vorne' + sx, sel, on)} />
      <Label x={439} y={110} lines={sl('Kotflügel vorne', lang)} fontSize={9} sel={sel === 'Kotflügel vorne' + sx} />
      <rect x={258} y={12} width={130} height={81} rx={4} {...zp('Seitenscheibe vorne' + sx, sel, on)} />
      <Label x={323} y={53} lines={sl('Seitenscheibe vorne', lang)} fontSize={9} sel={sel === 'Seitenscheibe vorne' + sx} />
      <rect x={258} y={95} width={130} height={71} rx={4} {...zp('Tür vorne' + sx, sel, on)} />
      <Label x={323} y={130} lines={sl('Tür vorne', lang)} fontSize={9} sel={sel === 'Tür vorne' + sx} />
      <rect x={125} y={12} width={128} height={81} rx={4} {...zp('Seitenscheibe hinten' + sx, sel, on)} />
      <Label x={189} y={53} lines={sl('Seitenscheibe hinten', lang)} fontSize={9} sel={sel === 'Seitenscheibe hinten' + sx} />
      <rect x={125} y={95} width={128} height={71} rx={4} {...zp('Tür hinten' + sx, sel, on)} />
      <Label x={189} y={130} lines={sl('Tür hinten', lang)} fontSize={9} sel={sel === 'Tür hinten' + sx} />
      <rect x={32} y={52} width={88} height={116} rx={4} {...zp('Kotflügel hinten' + sx, sel, on)} />
      <Label x={76} y={110} lines={sl('Kotflügel hinten', lang)} fontSize={9} sel={sel === 'Kotflügel hinten' + sx} />
      <circle cx={437} cy={188} r={44} {...zp('Reifen vorne' + sx, sel, on)} />
      <Label x={437} y={218} lines={sl('Reifen vorne', lang)} fontSize={7} sel={sel === 'Reifen vorne' + sx} />
      <circle cx={437} cy={188} r={20} {...zp('Felge vorne' + sx, sel, on)} />
      <Label x={437} y={188} lines={sl('Felge vorne', lang)} fontSize={7.5} sel={sel === 'Felge vorne' + sx} />
      <circle cx={118} cy={188} r={44} {...zp('Reifen hinten' + sx, sel, on)} />
      <Label x={118} y={218} lines={sl('Reifen hinten', lang)} fontSize={7} sel={sel === 'Reifen hinten' + sx} />
      <circle cx={118} cy={188} r={20} {...zp('Felge hinten' + sx, sel, on)} />
      <Label x={118} y={188} lines={sl('Felge hinten', lang)} fontSize={7.5} sel={sel === 'Felge hinten' + sx} />
    </svg>
  )
}

// ─── Main ─────────────────────────────────────────────────────────────────────

const VIEW_IDS: ViewId[] = ['top', 'front', 'back', 'left', 'right']

const VIEW_LABELS: Record<ViewId, { de: string; en: string }> = {
  top:   { de: 'Oben',   en: 'Top'   },
  front: { de: 'Vorne',  en: 'Front' },
  back:  { de: 'Hinten', en: 'Rear'  },
  left:  { de: 'Links',  en: 'Left'  },
  right: { de: 'Rechts', en: 'Right' },
}

export default function CarDamageSelector({ value, onChange }: Props) {
  const { i18n } = useTranslation()
  const lang = i18n.language.startsWith('en') ? 'en' : 'de'
  const sel = value ?? ''

  const [activeView, setActiveView] = useState<ViewId>(() =>
    (sel && ZONE_TO_VIEW[sel]) ? ZONE_TO_VIEW[sel] : 'top'
  )

  const displayLabel = sel
    ? (lang === 'en' ? (ZONE_LABEL_EN[sel] ?? sel) : sel)
    : ''

  return (
    <div className="space-y-2">
      {/* View tabs */}
      <div className="flex border-b border-gray-200">
        {VIEW_IDS.map(id => (
          <button key={id} type="button" onClick={() => setActiveView(id)}
            className={`flex-1 py-1.5 text-xs font-medium transition-colors ${
              activeView === id
                ? 'text-blue-600 border-b-2 border-blue-500'
                : 'text-gray-400'
            }`}>
            {VIEW_LABELS[id][lang]}
          </button>
        ))}
      </div>

      {/* SVG diagram */}
      <div style={{ height: 200 }}>
        {activeView === 'top'   && <TopView   sel={sel} on={onChange} lang={lang} />}
        {activeView === 'front' && <FrontView sel={sel} on={onChange} lang={lang} />}
        {activeView === 'back'  && <RearView  sel={sel} on={onChange} lang={lang} />}
        {activeView === 'left'  && <LeftView  sel={sel} on={onChange} lang={lang} />}
        {activeView === 'right' && <RightView sel={sel} on={onChange} lang={lang} />}
      </div>

      {/* Interior button */}
      <button type="button" onClick={() => onChange('Innenraum')}
        className={`w-full py-2 rounded-xl border text-sm font-medium transition-colors ${
          sel === 'Innenraum'
            ? 'bg-amber-100 border-amber-400 text-amber-800'
            : 'border-gray-200 text-gray-500 hover:border-blue-400'
        }`}>
        {lang === 'de' ? '🪑 Innenraum' : '🪑 Interior'}
      </button>

      {/* Lkw-spezifische Zonen */}
      <div className="grid grid-cols-2 gap-2">
        {TRUCK_ZONES.map(zone => (
          <button key={zone} type="button" onClick={() => onChange(zone)}
            className={`py-2 rounded-xl border text-sm font-medium transition-colors ${
              sel === zone
                ? 'bg-amber-100 border-amber-400 text-amber-800'
                : 'border-gray-200 text-gray-500 hover:border-blue-400'
            }`}>
            {TRUCK_ZONE_EMOJI[zone]} {lang === 'en' ? ZONE_LABEL_EN[zone] : zone}
          </button>
        ))}
      </div>

      {/* Selected label */}
      {sel && (
        <p className="text-xs text-amber-700 font-medium px-1">
          ✓ {displayLabel}
        </p>
      )}
    </div>
  )
}
