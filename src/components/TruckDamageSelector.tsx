import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ZONE_LABEL_EN, TRUCK_ZONES } from '@/lib/damages'

const EXTRA_ZONE_EMOJI: Record<string, string> = {
  'Innenraum': '🪑', 'Aufbau': '📦', 'Ladefläche': '🛻',
}

type ViewId = 'front' | 'back' | 'left' | 'right' | 'top'

interface Props {
  value: string | null
  onChange: (pos: string) => void
}

// Zone (ohne Seiten-Suffix) → passende Ansicht, für die Tab-Vorauswahl.
const ZONE_TO_VIEW: Record<string, ViewId> = {
  'Dachblende': 'front', 'Windschutzscheibe': 'front', 'Kühlergrill': 'front',
  'Scheinwerfer links': 'front', 'Scheinwerfer rechts': 'front',
  'Spiegel links': 'front', 'Spiegel rechts': 'front',
  'Stoßfänger vorne': 'front', 'Kennzeichen vorne': 'front',
  'Kabinenrückwand': 'back', 'Sattelkupplung': 'back', 'Unterfahrschutz': 'back',
  'Rückleuchte links': 'back', 'Rückleuchte rechts': 'back', 'Kennzeichen hinten': 'back',
  'Kabinendach': 'top', 'Chassis': 'top',
  'Tür links': 'left', 'Seitenscheibe links': 'left', 'Kotflügel vorne links': 'left',
  'Trittstufe links': 'left', 'Tank links': 'left', 'Chassis links': 'left',
  'Reifen vorne links': 'left', 'Felge vorne links': 'left',
  'Reifen hinten links': 'left', 'Felge hinten links': 'left',
  'Tür rechts': 'right', 'Seitenscheibe rechts': 'right', 'Kotflügel vorne rechts': 'right',
  'Trittstufe rechts': 'right', 'Tank rechts': 'right', 'Chassis rechts': 'right',
  'Reifen vorne rechts': 'right', 'Felge vorne rechts': 'right',
  'Reifen hinten rechts': 'right', 'Felge hinten rechts': 'right',
}

// Kurz-Labels für die SVG-Grafik (| = Zeilenumbruch), nach Basiszone.
const SHORT_DE: Record<string, string> = {
  'Tür': 'Tür', 'Seitenscheibe': 'Seiten-|scheibe',
  'Kotflügel vorne': 'Kotfl.|vorne', 'Trittstufe': 'Tritt',
  'Tank': 'Tank', 'Chassis': 'Chassis',
  'Reifen vorne': 'Reifen|vorne', 'Felge vorne': 'Felge|vorne',
  'Reifen hinten': 'Reifen|hinten', 'Felge hinten': 'Felge|hinten',
  'Sattelkupplung': 'Sattel-|kupplung',
  'Dachblende': 'Dach-|blende', 'Windschutzscheibe': 'Wind-|schutz-|scheibe',
  'Spiegel': 'Spiegel', 'Kühlergrill': 'Kühler-|grill',
  'Scheinwerfer': 'Schein-|werfer', 'Stoßfänger vorne': 'Stoßf.|vorne',
  'Kennzeichen vorne': 'KZ', 'Kennzeichen hinten': 'KZ',
  'Kabinenrückwand': 'Kabinen-|rückwand', 'Rückleuchte': 'Rückl.',
  'Unterfahrschutz': 'Unterf.-|schutz', 'Kabinendach': 'Kabinen-|dach',
}

const SHORT_EN: Record<string, string> = {
  'Tür': 'Door', 'Seitenscheibe': 'Side|window',
  'Kotflügel vorne': 'Fender|front', 'Trittstufe': 'Step',
  'Tank': 'Tank', 'Chassis': 'Chassis',
  'Reifen vorne': 'Tire|front', 'Felge vorne': 'Rim|front',
  'Reifen hinten': 'Tire|rear', 'Felge hinten': 'Rim|rear',
  'Sattelkupplung': 'Fifth|wheel',
  'Dachblende': 'Roof|fairing', 'Windschutzscheibe': 'Wind-|shield',
  'Spiegel': 'Mirror', 'Kühlergrill': 'Grille',
  'Scheinwerfer': 'Head-|light', 'Stoßfänger vorne': 'Bumper|front',
  'Kennzeichen vorne': 'Plate', 'Kennzeichen hinten': 'Plate',
  'Kabinenrückwand': 'Cab rear|wall', 'Rückleuchte': 'Tail|light',
  'Unterfahrschutz': 'Underrun|guard', 'Kabinendach': 'Cab|roof',
}

function sl(key: string, lang: string): string[] {
  const map = lang === 'en' ? SHORT_EN : SHORT_DE
  return (map[key] ?? key).split('|')
}

// ─── Colors ───────────────────────────────────────────────────────────────────

function zFill(sel: boolean)   { return sel ? '#fbbf24' : '#e5e7eb' }
function zStroke(sel: boolean) { return sel ? '#d97706' : '#9ca3af' }
function zText(sel: boolean)   { return sel ? '#78350f' : '#374151' }

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

function zp(pos: string, sel: string, on: (p: string) => void) {
  const active = sel === pos
  return {
    fill: zFill(active), stroke: zStroke(active), strokeWidth: 1.5 as number,
    onClick: () => on(pos), style: { cursor: 'pointer' as const },
  }
}

// ─── FRONT VIEW (Zugmaschine von vorne) ─────────────────────────────────────────

function FrontView({ sel, on, lang }: { sel: string; on: (p: string) => void; lang: string }) {
  return (
    <svg viewBox="0 0 300 240" width="100%" height="100%" preserveAspectRatio="xMidYMid meet">
      <rect x={60} y={14} width={180} height={26} rx={6} {...zp('Dachblende', sel, on)} />
      <Label x={150} y={27} lines={sl('Dachblende', lang)} fontSize={9} sel={sel === 'Dachblende'} />
      <polygon points="66,42 234,42 226,104 74,104" {...zp('Windschutzscheibe', sel, on)} />
      <Label x={150} y={72} lines={sl('Windschutzscheibe', lang)} fontSize={9} sel={sel === 'Windschutzscheibe'} />
      <rect x={32} y={58} width={26} height={54} rx={4} {...zp('Spiegel links', sel, on)} />
      <Label x={45} y={85} lines={sl('Spiegel', lang)} fontSize={7.5} sel={sel === 'Spiegel links'} />
      <rect x={242} y={58} width={26} height={54} rx={4} {...zp('Spiegel rechts', sel, on)} />
      <Label x={255} y={85} lines={sl('Spiegel', lang)} fontSize={7.5} sel={sel === 'Spiegel rechts'} />
      <rect x={94} y={110} width={112} height={44} rx={4} {...zp('Kühlergrill', sel, on)} />
      <Label x={150} y={132} lines={sl('Kühlergrill', lang)} fontSize={9} sel={sel === 'Kühlergrill'} />
      <rect x={64} y={110} width={26} height={44} rx={4} {...zp('Scheinwerfer links', sel, on)} />
      <Label x={77} y={132} lines={sl('Scheinwerfer', lang)} fontSize={7} sel={sel === 'Scheinwerfer links'} />
      <rect x={210} y={110} width={26} height={44} rx={4} {...zp('Scheinwerfer rechts', sel, on)} />
      <Label x={223} y={132} lines={sl('Scheinwerfer', lang)} fontSize={7} sel={sel === 'Scheinwerfer rechts'} />
      <rect x={54} y={158} width={192} height={30} rx={6} {...zp('Stoßfänger vorne', sel, on)} />
      <Label x={92} y={173} lines={sl('Stoßfänger vorne', lang)} fontSize={8.5} sel={sel === 'Stoßfänger vorne'} />
      <rect x={124} y={161} width={52} height={24} rx={3} {...zp('Kennzeichen vorne', sel, on)} />
      <Label x={150} y={173} lines={sl('Kennzeichen vorne', lang)} fontSize={8} sel={sel === 'Kennzeichen vorne'} />
    </svg>
  )
}

// ─── REAR VIEW (Zugmaschine von hinten – Sattelkupplungsseite) ──────────────────

function RearView({ sel, on, lang }: { sel: string; on: (p: string) => void; lang: string }) {
  return (
    <svg viewBox="0 0 300 240" width="100%" height="100%" preserveAspectRatio="xMidYMid meet">
      <rect x={70} y={14} width={160} height={90} rx={6} {...zp('Kabinenrückwand', sel, on)} />
      <Label x={150} y={55} lines={sl('Kabinenrückwand', lang)} fontSize={9} sel={sel === 'Kabinenrückwand'} />
      <polygon points="96,110 204,110 214,148 86,148" {...zp('Sattelkupplung', sel, on)} />
      <Label x={150} y={130} lines={sl('Sattelkupplung', lang)} fontSize={8.5} sel={sel === 'Sattelkupplung'} />
      <rect x={58} y={114} width={34} height={62} rx={4} {...zp('Rückleuchte links', sel, on)} />
      <Label x={75} y={145} lines={sl('Rückleuchte', lang)} fontSize={8} sel={sel === 'Rückleuchte links'} />
      <rect x={208} y={114} width={34} height={62} rx={4} {...zp('Rückleuchte rechts', sel, on)} />
      <Label x={225} y={145} lines={sl('Rückleuchte', lang)} fontSize={8} sel={sel === 'Rückleuchte rechts'} />
      <rect x={50} y={182} width={200} height={26} rx={6} {...zp('Unterfahrschutz', sel, on)} />
      <Label x={150} y={195} lines={sl('Unterfahrschutz', lang)} fontSize={9} sel={sel === 'Unterfahrschutz'} />
    </svg>
  )
}

// ─── TOP VIEW ───────────────────────────────────────────────────────────────────

function TopView({ sel, on, lang }: { sel: string; on: (p: string) => void; lang: string }) {
  return (
    <svg viewBox="0 0 560 240" width="100%" height="100%" preserveAspectRatio="xMidYMid meet">
      <rect x={196} y={72} width={330} height={96} rx={4} {...zp('Chassis', sel, on)} />
      <Label x={360} y={120} lines={sl('Chassis', lang)} fontSize={11} sel={sel === 'Chassis'} />
      <rect x={38} y={58} width={152} height={124} rx={6} {...zp('Kabinendach', sel, on)} />
      <Label x={114} y={120} lines={sl('Kabinendach', lang)} fontSize={10} sel={sel === 'Kabinendach'} />
      <rect x={40} y={26} width={50} height={30} rx={3} {...zp('Spiegel rechts', sel, on)} />
      <Label x={65} y={41} lines={sl('Spiegel', lang)} fontSize={7.5} sel={sel === 'Spiegel rechts'} />
      <rect x={40} y={184} width={50} height={30} rx={3} {...zp('Spiegel links', sel, on)} />
      <Label x={65} y={199} lines={sl('Spiegel', lang)} fontSize={7.5} sel={sel === 'Spiegel links'} />
    </svg>
  )
}

// ─── SIDE VIEW (Sattelzugmaschine, Front links; Rechts = gespiegelt) ────────────

const SIDE_W = 560

function SideView({ mirror, sel, on, lang }: {
  mirror: boolean; sel: string; on: (p: string) => void; lang: string
}) {
  const sx = mirror ? ' rechts' : ' links'
  // Helpers spiegeln die X-Koordinate für die rechte Ansicht.
  const rx = (x: number, w: number) => (mirror ? SIDE_W - x - w : x)
  const cx = (x: number) => (mirror ? SIDE_W - x : x)

  const ZRect = (x: number, y: number, w: number, h: number, key: string, pos: string, fs = 9, r = 4) => {
    const X = rx(x, w)
    return (
      <>
        <rect x={X} y={y} width={w} height={h} rx={r} {...zp(pos, sel, on)} />
        <Label x={X + w / 2} y={y + h / 2} lines={sl(key, lang)} fontSize={fs} sel={sel === pos} />
      </>
    )
  }
  const ZWheel = (cxp: number, cy: number, key: string, pos: string, felgeKey: string, felgePos: string) => {
    const X = cx(cxp)
    return (
      <>
        <circle cx={X} cy={cy} r={42} {...zp(pos, sel, on)} />
        <Label x={X} y={cy + 30} lines={sl(key, lang)} fontSize={7} sel={sel === pos} />
        <circle cx={X} cy={cy} r={18} {...zp(felgePos, sel, on)} />
        <Label x={X} y={cy} lines={sl(felgeKey, lang)} fontSize={7.5} sel={sel === felgePos} />
      </>
    )
  }

  // Sattelkupplung (mittig, keine Seite) als Trapez über der Hinterachse.
  const fifthPts = mirror
    ? `${SIDE_W - 372},150 ${SIDE_W - 468},150 ${SIDE_W - 458},168 ${SIDE_W - 382},168`
    : `372,150 468,150 458,168 382,168`

  return (
    <svg viewBox="0 0 560 260" width="100%" height="100%" preserveAspectRatio="xMidYMid meet">
      {/* Chassis-Rahmen */}
      {ZRect(150, 170, 372, 22, 'Chassis', 'Chassis' + sx, 10)}
      {/* Kabine: Seitenscheibe + Tür */}
      {ZRect(52, 48, 104, 36, 'Seitenscheibe', 'Seitenscheibe' + sx, 8.5)}
      {ZRect(52, 86, 104, 84, 'Tür', 'Tür' + sx, 10)}
      {/* Kotflügel vorne + Trittstufe */}
      {ZRect(38, 148, 92, 20, 'Kotflügel vorne', 'Kotflügel vorne' + sx, 8)}
      {ZRect(38, 170, 48, 22, 'Trittstufe', 'Trittstufe' + sx, 7.5, 3)}
      {/* Kraftstofftank */}
      {ZRect(205, 150, 96, 34, 'Tank', 'Tank' + sx, 9, 16)}
      {/* Sattelkupplung */}
      <polygon points={fifthPts} {...zp('Sattelkupplung', sel, on)} />
      <Label x={cx(425)} y={159} lines={sl('Sattelkupplung', lang)} fontSize={7.5} sel={sel === 'Sattelkupplung'} />
      {/* Achsen */}
      {ZWheel(110, 205, 'Reifen vorne', 'Reifen vorne' + sx, 'Felge vorne', 'Felge vorne' + sx)}
      {ZWheel(430, 205, 'Reifen hinten', 'Reifen hinten' + sx, 'Felge hinten', 'Felge hinten' + sx)}
    </svg>
  )
}

// ─── Main ───────────────────────────────────────────────────────────────────────

const VIEW_IDS: ViewId[] = ['front', 'back', 'left', 'right', 'top']

const VIEW_LABELS: Record<ViewId, { de: string; en: string }> = {
  front: { de: 'Vorne',  en: 'Front' },
  back:  { de: 'Hinten', en: 'Rear'  },
  left:  { de: 'Links',  en: 'Left'  },
  right: { de: 'Rechts', en: 'Right' },
  top:   { de: 'Oben',   en: 'Top'   },
}

export default function TruckDamageSelector({ value, onChange }: Props) {
  const { i18n } = useTranslation()
  const lang = i18n.language.startsWith('en') ? 'en' : 'de'
  const sel = value ?? ''

  const [activeView, setActiveView] = useState<ViewId>(() =>
    (sel && ZONE_TO_VIEW[sel]) ? ZONE_TO_VIEW[sel] : 'front'
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
        {activeView === 'front' && <FrontView sel={sel} on={onChange} lang={lang} />}
        {activeView === 'back'  && <RearView  sel={sel} on={onChange} lang={lang} />}
        {activeView === 'left'  && <SideView mirror={false} sel={sel} on={onChange} lang={lang} />}
        {activeView === 'right' && <SideView mirror={true}  sel={sel} on={onChange} lang={lang} />}
        {activeView === 'top'   && <TopView   sel={sel} on={onChange} lang={lang} />}
      </div>

      {/* Zusätzliche Zonen (Innenraum / Aufbau) */}
      <div className="grid grid-cols-3 gap-2">
        {TRUCK_ZONES.map(zone => (
          <button key={zone} type="button" onClick={() => onChange(zone)}
            className={`py-2 rounded-xl border text-sm font-medium transition-colors ${
              sel === zone
                ? 'bg-amber-100 border-amber-400 text-amber-800'
                : 'border-gray-200 text-gray-500 hover:border-blue-400'
            }`}>
            {EXTRA_ZONE_EMOJI[zone]} {lang === 'en' ? (ZONE_LABEL_EN[zone] ?? zone) : zone}
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
