import { useState, useRef, useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  QrCode, Download, RefreshCw, Users, Wifi, WifiOff,
  Plus, Pencil, Trash2, ChevronDown, ChevronUp, LayoutGrid, List, X,
} from 'lucide-react'
import { toast } from 'sonner'
import { tablesApi, type TableRow, type FloorSection, type QrCodeResult } from '@/lib/tables.api'
import { useAuthStore } from '@/store/auth.store'
import { cn } from '@/lib/utils'

// ── Status config ──────────────────────────────────────────────────────────────

const STATUS_CFG: Record<string, { label: string; dot: string }> = {
  AVAILABLE:      { label: 'Available',      dot: 'bg-green-500' },
  OCCUPIED:       { label: 'Occupied',        dot: 'bg-orange-500' },
  RESERVED:       { label: 'Reserved',        dot: 'bg-blue-500' },
  CLEANING:       { label: 'Cleaning',        dot: 'bg-yellow-500' },
  OUT_OF_SERVICE: { label: 'Out of Service',  dot: 'bg-gray-400' },
}

const FLOOR_COLORS = [
  'bg-brand/10 border-brand/30 text-brand',
  'bg-blue-50 border-blue-200 text-blue-700',
  'bg-purple-50 border-purple-200 text-purple-700',
  'bg-emerald-50 border-emerald-200 text-emerald-700',
  'bg-amber-50 border-amber-200 text-amber-700',
]

// ── QR Modal ───────────────────────────────────────────────────────────────────

function QrModal({ result, tableNumber, onClose }: { result: QrCodeResult; tableNumber: string; onClose: () => void }) {
  function downloadPng() {
    const a = document.createElement('a')
    a.href = result.qrDataUri
    a.download = `table-${tableNumber}-qr.png`
    a.click()
  }
  function printQr() {
    const win = window.open('', '_blank')
    if (!win) return
    win.document.write(`<html><head><title>QR Code — Table ${tableNumber}</title>
      <style>body{font-family:sans-serif;text-align:center;padding:40px}img{width:260px;height:260px;display:block;margin:0 auto 16px}h2{font-size:20px;margin:0 0 4px}p{color:#666;font-size:13px;margin:0}</style></head>
      <body><h2>Table ${tableNumber}</h2><p>Scan to order</p><img src="${result.qrDataUri}"/>
      <p style="font-size:11px;color:#999;margin-top:12px">${result.qrUrl}</p>
      <script>window.onload=()=>{window.print();window.close()}<\/script></body></html>`)
    win.document.close()
  }
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div className="bg-white rounded-2xl p-6 w-80 flex flex-col items-center gap-4 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between w-full">
          <h3 className="font-bold text-gray-900 text-base">Table {tableNumber} — QR Code</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={16} /></button>
        </div>
        <img src={result.qrDataUri} alt="" className="w-56 h-56 rounded-lg border border-gray-100" />
        <p className="text-xs text-gray-400 text-center break-all">{result.qrUrl}</p>
        <div className="flex gap-2 w-full">
          <button onClick={downloadPng} className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50">
            <Download size={15} /> Download
          </button>
          <button onClick={printQr} className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-brand text-white text-sm font-medium hover:opacity-90">
            Print
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Section Form Modal ─────────────────────────────────────────────────────────

function SectionModal({
  restaurantId, existing, onClose,
}: {
  restaurantId: string
  existing?: FloorSection
  onClose: () => void
}) {
  const qc = useQueryClient()
  const [name, setName] = useState(existing?.name ?? '')
  const [desc, setDesc] = useState(existing?.description ?? '')

  const mut = useMutation({
    mutationFn: () =>
      existing
        ? tablesApi.updateSection(restaurantId, existing.id, { name, description: desc || undefined })
        : tablesApi.createSection(restaurantId, { name, description: desc || undefined }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['floor-sections', restaurantId] })
      qc.invalidateQueries({ queryKey: ['tables', restaurantId] })
      toast.success(existing ? 'Section updated' : 'Section created')
      onClose()
    },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? 'Failed'),
  })

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div className="bg-white rounded-2xl p-6 w-96 shadow-2xl space-y-4" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-gray-900">{existing ? 'Edit Section' : 'Add Floor Section'}</h3>
          <button onClick={onClose}><X size={16} className="text-gray-400" /></button>
        </div>
        <div className="space-y-3">
          <div>
            <label className="text-xs font-medium text-gray-500 uppercase">Section name *</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Indoor, Outdoor, Rooftop"
              className="mt-1 w-full h-10 border border-gray-200 rounded-lg px-3 text-sm outline-none focus:border-brand"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-500 uppercase">Description (optional)</label>
            <input
              value={desc}
              onChange={(e) => setDesc(e.target.value)}
              placeholder="Main dining area"
              className="mt-1 w-full h-10 border border-gray-200 rounded-lg px-3 text-sm outline-none focus:border-brand"
            />
          </div>
        </div>
        <div className="flex gap-2 pt-1">
          <button onClick={onClose} className="flex-1 py-2 rounded-xl border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50">Cancel</button>
          <button
            onClick={() => mut.mutate()}
            disabled={!name.trim() || mut.isPending}
            className="flex-1 py-2 rounded-xl bg-brand text-white text-sm font-medium hover:opacity-90 disabled:opacity-50"
          >
            {mut.isPending ? 'Saving…' : existing ? 'Save' : 'Create Section'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Table Form Modal ───────────────────────────────────────────────────────────

function TableModal({
  restaurantId, sections, existing, defaultSectionId, onClose,
}: {
  restaurantId: string
  sections: FloorSection[]
  existing?: TableRow
  defaultSectionId?: string
  onClose: () => void
}) {
  const qc = useQueryClient()
  const [sectionId, setSectionId] = useState(existing?.floorSection.id ?? defaultSectionId ?? sections[0]?.id ?? '')
  const [tableNumber, setTableNumber] = useState(existing?.tableNumber ?? '')
  const [capacity, setCapacity] = useState(String(existing?.capacity ?? 2))

  const mut = useMutation({
    mutationFn: () =>
      existing
        ? tablesApi.updateTable(restaurantId, existing.id, {
            tableNumber,
            capacity: Number(capacity),
          })
        : tablesApi.createTable(restaurantId, {
            floorSectionId: sectionId,
            tableNumber,
            capacity: Number(capacity),
          }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['floor-sections', restaurantId] })
      qc.invalidateQueries({ queryKey: ['tables', restaurantId] })
      toast.success(existing ? 'Table updated' : 'Table added')
      onClose()
    },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? 'Failed'),
  })

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div className="bg-white rounded-2xl p-6 w-96 shadow-2xl space-y-4" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-gray-900">{existing ? 'Edit Table' : 'Add Table'}</h3>
          <button onClick={onClose}><X size={16} className="text-gray-400" /></button>
        </div>
        <div className="space-y-3">
          {!existing && (
            <div>
              <label className="text-xs font-medium text-gray-500 uppercase">Floor section *</label>
              <select
                value={sectionId}
                onChange={(e) => setSectionId(e.target.value)}
                className="mt-1 w-full h-10 border border-gray-200 rounded-lg px-3 text-sm outline-none focus:border-brand bg-white"
              >
                {sections.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>
          )}
          <div>
            <label className="text-xs font-medium text-gray-500 uppercase">Table number *</label>
            <input
              value={tableNumber}
              onChange={(e) => setTableNumber(e.target.value)}
              placeholder="e.g. 1, T-01, A1"
              className="mt-1 w-full h-10 border border-gray-200 rounded-lg px-3 text-sm outline-none focus:border-brand"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-500 uppercase">Capacity (seats)</label>
            <input
              type="number"
              min={1}
              max={50}
              value={capacity}
              onChange={(e) => setCapacity(e.target.value)}
              className="mt-1 w-full h-10 border border-gray-200 rounded-lg px-3 text-sm outline-none focus:border-brand"
            />
          </div>
        </div>
        <div className="flex gap-2 pt-1">
          <button onClick={onClose} className="flex-1 py-2 rounded-xl border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50">Cancel</button>
          <button
            onClick={() => mut.mutate()}
            disabled={!tableNumber.trim() || !sectionId || mut.isPending}
            className="flex-1 py-2 rounded-xl bg-brand text-white text-sm font-medium hover:opacity-90 disabled:opacity-50"
          >
            {mut.isPending ? 'Saving…' : existing ? 'Save' : 'Add Table'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Floor Plan Canvas (drag to position) ──────────────────────────────────────

const CANVAS_W = 880
const CANVAS_H = 500
const TABLE_W = 80
const TABLE_H = 56

function FloorPlanCanvas({ sections, restaurantId }: { sections: FloorSection[]; restaurantId: string }) {
  const qc = useQueryClient()
  const allTables = sections.flatMap((s, si) =>
    s.tables.map((t) => ({
      ...t,
      sectionName: s.name,
      colorIdx: si % FLOOR_COLORS.length,
      x: t.posX ?? (50 + (s.tables.indexOf(t) % 6) * 110),
      y: t.posY ?? (40 + Math.floor(s.tables.indexOf(t) / 6) * 90 + si * 80),
    }))
  )

  const [positions, setPositions] = useState<Record<string, { x: number; y: number }>>(() => {
    const map: Record<string, { x: number; y: number }> = {}
    allTables.forEach((t) => { map[t.id] = { x: t.x, y: t.y } })
    return map
  })

  const dragging = useRef<{ id: string; ox: number; oy: number; mx: number; my: number } | null>(null)

  const onMouseDown = useCallback((e: React.MouseEvent, tableId: string) => {
    e.preventDefault()
    const pos = positions[tableId] ?? { x: 50, y: 50 }
    dragging.current = { id: tableId, ox: pos.x, oy: pos.y, mx: e.clientX, my: e.clientY }
  }, [positions])

  const onMouseMove = useCallback((e: React.MouseEvent) => {
    if (!dragging.current) return
    const { id, ox, oy, mx, my } = dragging.current
    const dx = e.clientX - mx
    const dy = e.clientY - my
    const newX = Math.max(0, Math.min(CANVAS_W - TABLE_W, ox + dx))
    const newY = Math.max(0, Math.min(CANVAS_H - TABLE_H, oy + dy))
    setPositions((prev) => ({ ...prev, [id]: { x: newX, y: newY } }))
  }, [])

  const onMouseUp = useCallback(async () => {
    if (!dragging.current) return
    const { id } = dragging.current
    const pos = positions[id]
    dragging.current = null
    if (pos) {
      try {
        await tablesApi.updateTable(restaurantId, id, { posX: Math.round(pos.x), posY: Math.round(pos.y) })
        qc.invalidateQueries({ queryKey: ['floor-sections', restaurantId] })
      } catch {
        toast.error('Failed to save position')
      }
    }
  }, [positions, restaurantId, qc])

  if (allTables.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-2 text-center border-2 border-dashed border-gray-200 rounded-2xl">
        <LayoutGrid size={32} className="text-gray-300" />
        <p className="text-sm font-medium text-gray-400">No tables yet</p>
        <p className="text-xs text-gray-300">Add floor sections and tables first</p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {/* Legend */}
      <div className="flex flex-wrap gap-3">
        {sections.map((s, i) => (
          <div key={s.id} className="flex items-center gap-1.5">
            <div className={cn('w-3 h-3 rounded-sm border', FLOOR_COLORS[i % FLOOR_COLORS.length])} />
            <span className="text-xs text-gray-500">{s.name}</span>
          </div>
        ))}
        <div className="ml-auto flex items-center gap-3 text-xs text-gray-400">
          {Object.entries(STATUS_CFG).map(([k, v]) => (
            <span key={k} className="flex items-center gap-1">
              <span className={cn('w-2 h-2 rounded-full', v.dot)} />
              {v.label}
            </span>
          ))}
        </div>
      </div>

      {/* Canvas */}
      <div
        className="relative bg-gray-50 rounded-2xl border border-gray-200 overflow-auto cursor-default select-none"
        style={{ width: '100%', height: CANVAS_H + 40 }}
        onMouseMove={onMouseMove}
        onMouseUp={onMouseUp}
        onMouseLeave={onMouseUp}
      >
        {/* Grid lines */}
        <svg className="absolute inset-0 pointer-events-none opacity-30" width={CANVAS_W} height={CANVAS_H}>
          {Array.from({ length: Math.floor(CANVAS_W / 40) }).map((_, i) => (
            <line key={`v${i}`} x1={i * 40} y1={0} x2={i * 40} y2={CANVAS_H} stroke="#d1d5db" strokeWidth={0.5} />
          ))}
          {Array.from({ length: Math.floor(CANVAS_H / 40) }).map((_, i) => (
            <line key={`h${i}`} x1={0} y1={i * 40} x2={CANVAS_W} y2={i * 40} stroke="#d1d5db" strokeWidth={0.5} />
          ))}
        </svg>

        {allTables.map((table) => {
          const pos = positions[table.id] ?? { x: table.x, y: table.y }
          const statusDot = STATUS_CFG[table.status]?.dot ?? 'bg-gray-400'
          const isOccupied = table.status === 'OCCUPIED'
          return (
            <div
              key={table.id}
              style={{ left: pos.x, top: pos.y, width: TABLE_W, height: TABLE_H }}
              className={cn(
                'absolute rounded-xl border-2 flex flex-col items-center justify-center text-center cursor-grab active:cursor-grabbing shadow-sm transition-shadow hover:shadow-md',
                FLOOR_COLORS[table.colorIdx],
                isOccupied && 'ring-2 ring-orange-400 ring-offset-1',
              )}
              onMouseDown={(e) => onMouseDown(e, table.id)}
            >
              <span className="text-[11px] font-bold leading-tight">T-{table.tableNumber}</span>
              <div className="flex items-center gap-0.5 mt-0.5">
                <span className={cn('w-1.5 h-1.5 rounded-full', statusDot)} />
                <span className="text-[9px] opacity-70">{table.capacity}p</span>
              </div>
            </div>
          )
        })}
      </div>
      <p className="text-xs text-gray-400">Drag tables to rearrange. Positions are saved automatically.</p>
    </div>
  )
}

// ── Sections & Tables manager ──────────────────────────────────────────────────

function SectionsManager({
  sections,
  restaurantId,
  onQrGenerated,
}: {
  sections: FloorSection[]
  restaurantId: string
  onQrGenerated: (result: QrCodeResult, tableNumber: string) => void
}) {
  const qc = useQueryClient()
  const [expanded, setExpanded] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(sections.map((s) => [s.id, true]))
  )
  const [sectionModal, setSectionModal] = useState<{ open: boolean; existing?: FloorSection }>({ open: false })
  const [tableModal, setTableModal] = useState<{ open: boolean; existing?: TableRow; sectionId?: string }>({ open: false })

  const deleteSectionMut = useMutation({
    mutationFn: (id: string) => tablesApi.deleteSection(restaurantId, id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['floor-sections', restaurantId] })
      qc.invalidateQueries({ queryKey: ['tables', restaurantId] })
      toast.success('Section deleted')
    },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? 'Cannot delete — section has tables'),
  })

  const deleteTableMut = useMutation({
    mutationFn: (id: string) => tablesApi.deleteTable(restaurantId, id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['floor-sections', restaurantId] })
      qc.invalidateQueries({ queryKey: ['tables', restaurantId] })
      toast.success('Table deleted')
    },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? 'Failed to delete'),
  })

  const generateMut = useMutation({
    mutationFn: (tableId: string) => tablesApi.generateQrCode(restaurantId, tableId),
    onSuccess: (result, tableId) => {
      qc.invalidateQueries({ queryKey: ['floor-sections', restaurantId] })
      const t = sections.flatMap((s) => s.tables).find((t) => t.id === tableId)
      if (t) onQrGenerated(result, t.tableNumber)
    },
    onError: () => toast.error('Failed to generate QR code'),
  })

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">{sections.length} section{sections.length !== 1 ? 's' : ''} · {sections.reduce((n, s) => n + s.tables.length, 0)} tables total</p>
        <button
          onClick={() => setSectionModal({ open: true })}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-brand text-white text-sm font-semibold hover:opacity-90"
        >
          <Plus size={14} /> Add Section
        </button>
      </div>

      {sections.length === 0 && (
        <div className="flex flex-col items-center justify-center h-48 gap-3 border-2 border-dashed border-gray-200 rounded-2xl">
          <List size={28} className="text-gray-300" />
          <div className="text-center">
            <p className="text-sm font-medium text-gray-500">No floor sections yet</p>
            <p className="text-xs text-gray-400 mt-0.5">Create a section (e.g. Indoor, Outdoor) then add tables to it</p>
          </div>
          <button
            onClick={() => setSectionModal({ open: true })}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-brand text-white text-sm font-semibold hover:opacity-90"
          >
            <Plus size={14} /> Create First Section
          </button>
        </div>
      )}

      {sections.map((section, si) => (
        <div key={section.id} className="border border-gray-200 rounded-2xl overflow-hidden">
          {/* Section header */}
          <div className={cn('flex items-center justify-between px-4 py-3', FLOOR_COLORS[si % FLOOR_COLORS.length])}>
            <button
              className="flex items-center gap-2 flex-1 text-left"
              onClick={() => setExpanded((p) => ({ ...p, [section.id]: !p[section.id] }))}
            >
              {expanded[section.id] ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
              <span className="font-semibold text-sm">{section.name}</span>
              <span className="text-xs opacity-60">({section.tables.length} table{section.tables.length !== 1 ? 's' : ''})</span>
              {section.description && <span className="text-xs opacity-50 ml-1">· {section.description}</span>}
            </button>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setTableModal({ open: true, sectionId: section.id })}
                className="flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-lg bg-white/60 hover:bg-white/90 transition-colors"
              >
                <Plus size={12} /> Add Table
              </button>
              <button
                onClick={() => setSectionModal({ open: true, existing: section })}
                className="p-1.5 rounded-lg hover:bg-white/60 transition-colors"
                title="Edit section"
              >
                <Pencil size={13} />
              </button>
              <button
                onClick={() => {
                  if (!window.confirm(`Delete "${section.name}"? All tables in it will be removed.`)) return
                  deleteSectionMut.mutate(section.id)
                }}
                className="p-1.5 rounded-lg hover:bg-red-100 text-red-500 transition-colors"
                title="Delete section"
              >
                <Trash2 size={13} />
              </button>
            </div>
          </div>

          {/* Tables list */}
          {expanded[section.id] && (
            <div className="p-3">
              {section.tables.length === 0 ? (
                <div className="text-center py-6 text-gray-400 text-sm">
                  No tables yet ·{' '}
                  <button
                    onClick={() => setTableModal({ open: true, sectionId: section.id })}
                    className="text-brand hover:underline font-medium"
                  >
                    Add first table
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2">
                  {section.tables.map((table) => {
                    const s = STATUS_CFG[table.status]
                    const hasQr = !!table.qrCode
                    return (
                      <div key={table.id} className="bg-white border border-gray-100 rounded-xl p-3 flex flex-col gap-2">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-bold text-gray-900 text-sm">T-{table.tableNumber}</p>
                            <p className="text-[11px] text-gray-400 flex items-center gap-0.5">
                              <Users size={10} /> {table.capacity} seats
                            </p>
                          </div>
                          <span className={cn('flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-full',
                            table.status === 'AVAILABLE' ? 'bg-green-50 text-green-700' :
                            table.status === 'OCCUPIED' ? 'bg-orange-50 text-orange-700' :
                            'bg-gray-50 text-gray-600'
                          )}>
                            <span className={cn('w-1.5 h-1.5 rounded-full', s?.dot ?? 'bg-gray-400')} />
                            {s?.label ?? table.status}
                          </span>
                        </div>
                        {table.sessions[0] && (
                          <div className="flex items-center gap-1 text-[10px] text-orange-600 bg-orange-50 rounded px-1.5 py-0.5">
                            <Wifi size={9} /> {table.sessions[0].guestCount} guests
                          </div>
                        )}
                        <div className="flex items-center gap-1 pt-1 border-t border-gray-50">
                          <button
                            onClick={() => generateMut.mutate(table.id)}
                            disabled={generateMut.isPending}
                            className={cn(
                              'flex-1 flex items-center justify-center gap-1 text-[10px] font-semibold py-1 rounded-lg transition-colors',
                              hasQr ? 'text-gray-500 hover:bg-gray-50' : 'bg-brand text-white hover:opacity-90'
                            )}
                            title={hasQr ? 'Regenerate QR' : 'Generate QR'}
                          >
                            {generateMut.isPending ? <RefreshCw size={10} className="animate-spin" /> : <QrCode size={10} />}
                            {hasQr ? 'QR' : 'Gen QR'}
                          </button>
                          <button
                            onClick={() => setTableModal({ open: true, existing: table })}
                            className="p-1 rounded-lg hover:bg-gray-50 text-gray-400 hover:text-gray-600"
                          >
                            <Pencil size={11} />
                          </button>
                          <button
                            onClick={() => {
                              if (!window.confirm(`Delete table ${table.tableNumber}?`)) return
                              deleteTableMut.mutate(table.id)
                            }}
                            className="p-1 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-500"
                          >
                            <Trash2 size={11} />
                          </button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      ))}

      {/* Modals */}
      {sectionModal.open && (
        <SectionModal
          restaurantId={restaurantId}
          existing={sectionModal.existing}
          onClose={() => setSectionModal({ open: false })}
        />
      )}
      {tableModal.open && (
        <TableModal
          restaurantId={restaurantId}
          sections={sections}
          existing={tableModal.existing}
          defaultSectionId={tableModal.sectionId}
          onClose={() => setTableModal({ open: false })}
        />
      )}
    </div>
  )
}

// ── QR Codes view ─────────────────────────────────────────────────────────────

function QrCodesView({
  sections,
  restaurantId,
  onQrGenerated,
}: {
  sections: FloorSection[]
  restaurantId: string
  onQrGenerated: (result: QrCodeResult, tableNumber: string) => void
}) {
  const qc = useQueryClient()
  const allTables = sections.flatMap((s) => s.tables)
  const missingQr = allTables.filter((t) => !t.qrCode).length
  const [bulkPending, setBulkPending] = useState(false)

  async function handleBulkGenerate() {
    const missing = allTables.filter((t) => !t.qrCode)
    if (missing.length === 0) { toast.info('All tables already have QR codes'); return }
    setBulkPending(true)
    let done = 0
    for (const t of missing) {
      try { await tablesApi.generateQrCode(restaurantId, t.id); done++ } catch { /* skip */ }
    }
    await qc.invalidateQueries({ queryKey: ['floor-sections', restaurantId] })
    setBulkPending(false)
    toast.success(`Generated QR codes for ${done} table${done !== 1 ? 's' : ''}`)
  }

  const generateMut = useMutation({
    mutationFn: (tableId: string) => tablesApi.generateQrCode(restaurantId, tableId),
    onSuccess: (result, tableId) => {
      qc.invalidateQueries({ queryKey: ['floor-sections', restaurantId] })
      const t = allTables.find((t) => t.id === tableId)
      if (t) onQrGenerated(result, t.tableNumber)
    },
    onError: () => toast.error('Failed to generate QR code'),
  })

  if (allTables.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-48 gap-2 text-center text-gray-400">
        <WifiOff size={28} className="text-gray-300" />
        <p className="text-sm">No tables yet — add sections and tables first</p>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      {missingQr > 0 && (
        <div className="flex items-center justify-between bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
          <p className="text-sm text-amber-800">{missingQr} table{missingQr !== 1 ? 's' : ''} without QR code</p>
          <button
            onClick={handleBulkGenerate}
            disabled={bulkPending}
            className="flex items-center gap-1.5 px-4 py-1.5 rounded-xl bg-brand text-white text-sm font-semibold hover:opacity-90 disabled:opacity-60"
          >
            {bulkPending ? <RefreshCw size={13} className="animate-spin" /> : <QrCode size={13} />}
            Generate All ({missingQr})
          </button>
        </div>
      )}
      {sections.map((section, si) => (
        <div key={section.id}>
          <h2 className={cn('text-xs font-bold uppercase tracking-wide px-2 py-1 rounded-md inline-flex mb-3', FLOOR_COLORS[si % FLOOR_COLORS.length])}>
            {section.name}
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {section.tables.map((table) => {
              const hasQr = !!table.qrCode
              const active = table.sessions[0]
              return (
                <div key={table.id} className="bg-white border border-gray-100 rounded-xl p-4 flex flex-col gap-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-bold text-gray-900 text-sm">Table {table.tableNumber}</p>
                      <p className="text-xs text-gray-400 flex items-center gap-1 mt-0.5">
                        <Users size={11} /> {table.capacity} seats
                      </p>
                    </div>
                    <span className={cn('text-xs font-semibold px-2 py-0.5 rounded-full',
                      table.status === 'AVAILABLE' ? 'bg-green-100 text-green-700' :
                      table.status === 'OCCUPIED' ? 'bg-orange-100 text-orange-700' :
                      'bg-gray-100 text-gray-600'
                    )}>
                      {STATUS_CFG[table.status]?.label ?? table.status}
                    </span>
                  </div>
                  {active && (
                    <div className="flex items-center gap-1.5 text-xs text-orange-600 bg-orange-50 rounded-lg px-2.5 py-1.5">
                      <Wifi size={12} /> Active · {active.guestCount} guests
                    </div>
                  )}
                  <div className="flex items-center justify-between pt-1 border-t border-gray-50">
                    <div className="flex items-center gap-1.5 text-xs">
                      {hasQr
                        ? <span className="text-green-600 flex items-center gap-1"><QrCode size={12} /> Generated</span>
                        : <span className="text-gray-400 flex items-center gap-1"><WifiOff size={12} /> No QR</span>}
                    </div>
                    <button
                      onClick={() => generateMut.mutate(table.id)}
                      disabled={generateMut.isPending}
                      className={cn(
                        'flex items-center gap-1 text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors',
                        hasQr ? 'text-gray-600 border border-gray-200 hover:bg-gray-50' : 'bg-brand text-white hover:opacity-90',
                      )}
                    >
                      <QrCode size={12} />
                      {hasQr ? 'Regenerate' : 'Generate QR'}
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}

// ── Main page ──────────────────────────────────────────────────────────────────

type Tab = 'manage' | 'floorplan' | 'qr'

export default function TablesPage() {
  const { user } = useAuthStore()
  const restaurantId = user?.restaurantId ?? ''
  const [tab, setTab] = useState<Tab>('manage')
  const [qrModal, setQrModal] = useState<{ result: QrCodeResult; tableNumber: string } | null>(null)

  const { data: sections = [], isLoading, refetch } = useQuery({
    queryKey: ['floor-sections', restaurantId],
    queryFn: () => tablesApi.listSections(restaurantId),
    enabled: !!restaurantId,
  })

  const totalTables = sections.reduce((n, s) => n + s.tables.length, 0)

  const TABS: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: 'manage',    label: 'Sections & Tables', icon: <List size={14} /> },
    { id: 'floorplan', label: 'Floor Plan',         icon: <LayoutGrid size={14} /> },
    { id: 'qr',        label: 'QR Codes',           icon: <QrCode size={14} /> },
  ]

  return (
    <div className="p-6 space-y-6 max-w-5xl">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Tables & Floor Plan</h1>
          <p className="text-sm text-gray-400 mt-0.5">
            {sections.length} section{sections.length !== 1 ? 's' : ''} · {totalTables} table{totalTables !== 1 ? 's' : ''}
          </p>
        </div>
        <button
          onClick={() => refetch()}
          className="p-2 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors text-gray-500"
          title="Refresh"
        >
          <RefreshCw size={15} className={isLoading ? 'animate-spin' : ''} />
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 rounded-xl p-1 w-fit">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={cn(
              'flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-sm font-medium transition-all',
              tab === t.id
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-500 hover:text-gray-700',
            )}
          >
            {t.icon}
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {isLoading ? (
        <div className="flex items-center justify-center h-48 text-gray-400 text-sm">
          <RefreshCw size={16} className="animate-spin mr-2" /> Loading…
        </div>
      ) : (
        <>
          {tab === 'manage' && (
            <SectionsManager
              sections={sections}
              restaurantId={restaurantId}
              onQrGenerated={(result, tableNumber) => setQrModal({ result, tableNumber })}
            />
          )}
          {tab === 'floorplan' && (
            <FloorPlanCanvas sections={sections} restaurantId={restaurantId} />
          )}
          {tab === 'qr' && (
            <QrCodesView
              sections={sections}
              restaurantId={restaurantId}
              onQrGenerated={(result, tableNumber) => setQrModal({ result, tableNumber })}
            />
          )}
        </>
      )}

      {qrModal && (
        <QrModal
          result={qrModal.result}
          tableNumber={qrModal.tableNumber}
          onClose={() => setQrModal(null)}
        />
      )}
    </div>
  )
}
