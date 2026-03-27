import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { MessageSquare, Plus, Trash2, ChevronRight, Megaphone, Send, Radio } from 'lucide-react'
import { toast } from 'sonner'
import {
  getTicketStats,
  listTickets,
  createTicket,
  getTicket,
  updateTicket,
  addTicketMessage,
  listAnnouncements,
  createAnnouncement,
  deleteAnnouncement,
  listBroadcasts,
  sendBroadcast,
} from '@/lib/superadmin.api'
import type { SupportTicket, TicketStatus, TicketPriority, Announcement, Broadcast, BroadcastSegment } from '@/types/superadmin.types'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtDate(iso: string) {
  return new Date(iso).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' })
}

const STATUS_COLORS: Record<TicketStatus, string> = {
  OPEN:        'bg-blue-600/20 text-blue-400',
  IN_PROGRESS: 'bg-yellow-600/20 text-yellow-400',
  RESOLVED:    'bg-green-600/20 text-green-400',
  CLOSED:      'bg-slate-600/20 text-slate-400',
}

const PRIORITY_COLORS: Record<TicketPriority, string> = {
  LOW:    'bg-slate-600/20 text-slate-400',
  MEDIUM: 'bg-blue-600/20 text-blue-400',
  HIGH:   'bg-orange-600/20 text-orange-400',
  URGENT: 'bg-red-600/20 text-red-400',
}

const STATUSES: TicketStatus[] = ['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED']
const PRIORITIES: TicketPriority[] = ['LOW', 'MEDIUM', 'HIGH', 'URGENT']

// ─── Create Ticket Dialog ─────────────────────────────────────────────────────

function CreateTicketDialog({ onClose, onSave }: {
  onClose: () => void
  onSave: (p: { subject: string; description: string; priority: TicketPriority }) => void
}) {
  const [subject, setSubject] = useState('')
  const [description, setDescription] = useState('')
  const [priority, setPriority] = useState<TicketPriority>('MEDIUM')

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={onClose}>
      <div className="bg-card border border-border rounded-xl p-6 w-full max-w-lg" onClick={e => e.stopPropagation()}>
        <h2 className="text-base font-semibold text-foreground mb-4">New Support Ticket</h2>
        <div className="space-y-3">
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Subject</label>
            <input value={subject} onChange={e => setSubject(e.target.value)} placeholder="Brief description of the issue"
              className="w-full bg-input border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-brand" />
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Description</label>
            <textarea value={description} onChange={e => setDescription(e.target.value)} rows={4} placeholder="Full details of the issue…"
              className="w-full bg-input border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-brand resize-none" />
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Priority</label>
            <select value={priority} onChange={e => setPriority(e.target.value as TicketPriority)}
              className="w-full bg-input border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-brand">
              {PRIORITIES.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>
        </div>
        <div className="flex justify-end gap-2 mt-5">
          <button onClick={onClose} className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground transition-colors">Cancel</button>
          <button
            onClick={() => { if (subject.trim() && description.trim()) onSave({ subject: subject.trim(), description: description.trim(), priority }) }}
            className="px-4 py-2 text-sm bg-brand text-white rounded-lg hover:bg-brand/90 transition-colors"
          >Create Ticket</button>
        </div>
      </div>
    </div>
  )
}

// ─── Ticket Detail Panel ──────────────────────────────────────────────────────

function TicketDetail({ ticketId, onClose }: { ticketId: string; onClose: () => void }) {
  const qc = useQueryClient()
  const [reply, setReply] = useState('')

  const { data: ticket, isLoading } = useQuery({
    queryKey: ['ticket', ticketId],
    queryFn: () => getTicket(ticketId),
  })

  const updateMut = useMutation({
    mutationFn: (payload: Parameters<typeof updateTicket>[1]) => updateTicket(ticketId, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['ticket', ticketId] })
      qc.invalidateQueries({ queryKey: ['tickets'] })
      toast.success('Ticket updated')
    },
    onError: () => toast.error('Failed to update'),
  })

  const replyMut = useMutation({
    mutationFn: (content: string) => addTicketMessage(ticketId, content),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['ticket', ticketId] })
      setReply('')
      toast.success('Reply sent')
    },
    onError: () => toast.error('Failed to send reply'),
  })

  if (isLoading) return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="bg-card border border-border rounded-xl p-8 text-muted-foreground text-sm">Loading…</div>
    </div>
  )
  if (!ticket) return null

  const isClosed = ticket.status === 'CLOSED'

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-end bg-black/40" onClick={onClose}>
      <div className="bg-card border-l border-border h-full w-full max-w-xl flex flex-col" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-start justify-between p-5 border-b border-border">
          <div className="flex-1 pr-4">
            <h2 className="text-sm font-semibold text-foreground">{ticket.subject}</h2>
            <p className="text-xs text-muted-foreground mt-0.5">#{ticket.id.slice(0, 8)} · {ticket.submittedBy}</p>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground text-lg leading-none">×</button>
        </div>

        {/* Status / priority controls */}
        <div className="flex items-center gap-3 px-5 py-3 border-b border-border flex-wrap">
          <select
            value={ticket.status}
            onChange={e => updateMut.mutate({ status: e.target.value as TicketStatus })}
            className={`text-xs px-2 py-1 rounded-md border-0 font-medium focus:outline-none focus:ring-1 focus:ring-brand cursor-pointer ${STATUS_COLORS[ticket.status]}`}
          >
            {STATUSES.map(s => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
          </select>
          <select
            value={ticket.priority}
            onChange={e => updateMut.mutate({ priority: e.target.value as TicketPriority })}
            className={`text-xs px-2 py-1 rounded-md border-0 font-medium focus:outline-none focus:ring-1 focus:ring-brand cursor-pointer ${PRIORITY_COLORS[ticket.priority]}`}
          >
            {PRIORITIES.map(p => <option key={p} value={p}>{p}</option>)}
          </select>
          {ticket.tenant && (
            <span className="text-xs text-muted-foreground">Tenant: <span className="text-foreground">{ticket.tenant.name}</span></span>
          )}
          <span className="text-xs text-muted-foreground ml-auto">{fmtDate(ticket.createdAt)}</span>
        </div>

        {/* Description */}
        <div className="px-5 py-4 border-b border-border">
          <p className="text-xs text-muted-foreground mb-1">Description</p>
          <p className="text-sm text-foreground whitespace-pre-wrap">{ticket.description}</p>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
          {(ticket.messages ?? []).length === 0 && (
            <p className="text-xs text-muted-foreground text-center py-4">No messages yet.</p>
          )}
          {(ticket.messages ?? []).map(msg => (
            <div key={msg.id} className={`flex flex-col gap-1 ${msg.isStaff ? 'items-end' : 'items-start'}`}>
              <div className={`max-w-xs px-3 py-2 rounded-xl text-sm ${msg.isStaff ? 'bg-brand text-white' : 'bg-sidebar-active text-foreground'}`}>
                {msg.content}
              </div>
              <span className="text-xs text-muted-foreground">{msg.authorEmail} · {fmtDate(msg.createdAt)}</span>
            </div>
          ))}
        </div>

        {/* Reply box */}
        {!isClosed && (
          <div className="p-4 border-t border-border flex gap-2">
            <input
              value={reply}
              onChange={e => setReply(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey && reply.trim()) { e.preventDefault(); replyMut.mutate(reply.trim()) } }}
              placeholder="Type a reply… (Enter to send)"
              className="flex-1 bg-input border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-brand"
            />
            <button
              onClick={() => { if (reply.trim()) replyMut.mutate(reply.trim()) }}
              disabled={!reply.trim()}
              className="p-2 bg-brand text-white rounded-lg hover:bg-brand/90 transition-colors disabled:opacity-40"
            >
              <Send size={15} />
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Tickets Tab ──────────────────────────────────────────────────────────────

function TicketsTab() {
  const qc = useQueryClient()
  const [statusFilter, setStatusFilter] = useState<TicketStatus | ''>('')
  const [showCreate, setShowCreate] = useState(false)
  const [detailId, setDetailId] = useState<string | null>(null)

  const { data: stats } = useQuery({ queryKey: ['ticket-stats'], queryFn: getTicketStats })
  const { data, isLoading } = useQuery({
    queryKey: ['tickets', statusFilter],
    queryFn: () => listTickets(statusFilter ? { status: statusFilter } : undefined),
  })

  const createMut = useMutation({
    mutationFn: createTicket,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tickets'] })
      qc.invalidateQueries({ queryKey: ['ticket-stats'] })
      setShowCreate(false)
      toast.success('Ticket created')
    },
    onError: () => toast.error('Failed to create ticket'),
  })

  const tickets: SupportTicket[] = data?.data ?? []

  return (
    <div className="space-y-4">
      {/* Stats row */}
      {stats && (
        <div className="grid grid-cols-4 gap-3">
          {STATUSES.map(s => {
            const count = stats.byStatus.find(b => b.status === s)?._count ?? 0
            return (
              <button
                key={s}
                onClick={() => setStatusFilter(statusFilter === s ? '' : s)}
                className={`p-3 rounded-xl border text-left transition-colors ${statusFilter === s ? 'border-brand bg-brand/10' : 'border-border bg-card hover:border-brand/40'}`}
              >
                <p className={`text-lg font-bold ${STATUS_COLORS[s].split(' ')[1]}`}>{count}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{s.replace('_', ' ')}</p>
              </button>
            )
          })}
        </div>
      )}

      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{data?.pagination.total ?? 0} ticket{(data?.pagination.total ?? 0) !== 1 ? 's' : ''}{statusFilter ? ` · ${statusFilter.replace('_', ' ')}` : ''}</p>
        <button onClick={() => setShowCreate(true)} className="flex items-center gap-2 px-4 py-2 bg-brand text-white rounded-lg text-sm hover:bg-brand/90 transition-colors">
          <Plus size={14} /> New Ticket
        </button>
      </div>

      {isLoading ? (
        <div className="text-center py-12 text-muted-foreground text-sm">Loading…</div>
      ) : tickets.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground text-sm">
          <MessageSquare size={32} className="mx-auto mb-3 opacity-30" />
          No tickets found.
        </div>
      ) : (
        <div className="border border-border rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-sidebar-active text-muted-foreground text-xs">
                <th className="px-4 py-3 text-left font-medium">Subject</th>
                <th className="px-4 py-3 text-left font-medium">Status</th>
                <th className="px-4 py-3 text-left font-medium">Priority</th>
                <th className="px-4 py-3 text-left font-medium">Tenant</th>
                <th className="px-4 py-3 text-left font-medium">Messages</th>
                <th className="px-4 py-3 text-left font-medium">Created</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {tickets.map(t => (
                <tr key={t.id} className="hover:bg-sidebar-hover transition-colors cursor-pointer" onClick={() => setDetailId(t.id)}>
                  <td className="px-4 py-3 font-medium text-foreground max-w-xs truncate">{t.subject}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded-md font-medium ${STATUS_COLORS[t.status]}`}>{t.status.replace('_', ' ')}</span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded-md font-medium ${PRIORITY_COLORS[t.priority]}`}>{t.priority}</span>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground text-xs">{t.tenant?.name ?? '—'}</td>
                  <td className="px-4 py-3 text-muted-foreground text-xs">{t._count?.messages ?? 0}</td>
                  <td className="px-4 py-3 text-muted-foreground text-xs">{fmtDate(t.createdAt)}</td>
                  <td className="px-4 py-3 text-right"><ChevronRight size={14} className="text-muted-foreground" /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showCreate && (
        <CreateTicketDialog onClose={() => setShowCreate(false)} onSave={p => createMut.mutate(p)} />
      )}
      {detailId && <TicketDetail ticketId={detailId} onClose={() => setDetailId(null)} />}
    </div>
  )
}

// ─── Announcements Tab ────────────────────────────────────────────────────────

function AnnouncementsTab() {
  const qc = useQueryClient()
  const [showForm, setShowForm] = useState(false)
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [scheduledFor, setScheduledFor] = useState('')

  const { data: announcements = [], isLoading } = useQuery({
    queryKey: ['announcements'],
    queryFn: listAnnouncements,
  })

  const createMut = useMutation({
    mutationFn: createAnnouncement,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['announcements'] })
      setShowForm(false)
      setTitle('')
      setBody('')
      setScheduledFor('')
      toast.success(scheduledFor ? 'Announcement scheduled' : 'Announcement published')
    },
    onError: () => toast.error('Failed to create announcement'),
  })

  const deleteMut = useMutation({
    mutationFn: deleteAnnouncement,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['announcements'] }); toast.success('Deleted') },
    onError: () => toast.error('Failed to delete'),
  })

  const now = new Date()

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{announcements.length} announcement{announcements.length !== 1 ? 's' : ''}</p>
        <button onClick={() => setShowForm(!showForm)} className="flex items-center gap-2 px-4 py-2 bg-brand text-white rounded-lg text-sm hover:bg-brand/90 transition-colors">
          <Plus size={14} /> New Announcement
        </button>
      </div>

      {showForm && (
        <div className="bg-card border border-brand/30 rounded-xl p-5 space-y-3">
          <h3 className="text-sm font-semibold text-foreground">Broadcast Announcement</h3>
          <input value={title} onChange={e => setTitle(e.target.value)} placeholder="Title"
            className="w-full bg-input border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-brand" />
          <textarea value={body} onChange={e => setBody(e.target.value)} rows={4} placeholder="Announcement body…"
            className="w-full bg-input border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-brand resize-none" />
          <div className="flex items-center gap-3">
            <div className="flex-1">
              <label className="text-xs text-muted-foreground mb-1 block">Schedule for (optional — blank = publish now)</label>
              <input type="datetime-local" value={scheduledFor} onChange={e => setScheduledFor(e.target.value)}
                className="w-full bg-input border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-brand" />
            </div>
          </div>
          {scheduledFor && (
            <p className="text-xs text-amber-400 flex items-center gap-1.5">
              ⏰ Will go live on {new Date(scheduledFor).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' })}
            </p>
          )}
          <div className="flex justify-end gap-2">
            <button onClick={() => setShowForm(false)} className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground transition-colors">Cancel</button>
            <button
              onClick={() => {
                if (title.trim() && body.trim())
                  createMut.mutate({ title: title.trim(), body: body.trim(), scheduledFor: scheduledFor || undefined })
              }}
              className="flex items-center gap-2 px-4 py-2 text-sm bg-brand text-white rounded-lg hover:bg-brand/90 transition-colors"
            >
              <Megaphone size={13} /> {scheduledFor ? 'Schedule' : 'Publish Now'}
            </button>
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="text-center py-12 text-muted-foreground text-sm">Loading…</div>
      ) : announcements.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground text-sm">
          <Megaphone size={32} className="mx-auto mb-3 opacity-30" />
          No announcements yet.
        </div>
      ) : (
        <div className="space-y-3">
          {announcements.map((ann: Announcement) => {
            const isScheduled = !!ann.scheduledFor && new Date(ann.scheduledFor) > now
            return (
              <div key={ann.id} className={`border rounded-xl p-4 ${isScheduled ? 'bg-amber-950/20 border-amber-700/40' : 'bg-card border-border'}`}>
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="text-sm font-semibold text-foreground">{ann.title}</p>
                      {isScheduled && (
                        <span className="text-xs bg-amber-600/20 text-amber-400 px-2 py-0.5 rounded-full">
                          ⏰ Scheduled: {new Date(ann.scheduledFor!).toLocaleString('en-GB', { dateStyle: 'short', timeStyle: 'short' })}
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground whitespace-pre-wrap">{ann.body}</p>
                    <p className="text-xs text-muted-foreground mt-2">{ann.authorEmail} · Created {fmtDate(ann.createdAt)}</p>
                  </div>
                  <button
                    onClick={() => { if (confirm('Delete this announcement?')) deleteMut.mutate(ann.id) }}
                    className="text-muted-foreground hover:text-red-400 transition-colors p-1 flex-shrink-0"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ─── Broadcasts Tab ───────────────────────────────────────────────────────────

const SEGMENTS: BroadcastSegment[] = ['ALL', 'ACTIVE', 'TRIAL', 'PAID', 'SUSPENDED']
const SEGMENT_LABELS: Record<BroadcastSegment, string> = {
  ALL: 'All Tenants',
  ACTIVE: 'Active Tenants',
  TRIAL: 'Trial Tenants',
  PAID: 'Paid Tenants',
  SUSPENDED: 'Suspended Tenants',
}
const SEGMENT_COLORS: Record<BroadcastSegment, string> = {
  ALL: 'bg-indigo-600/20 text-indigo-400',
  ACTIVE: 'bg-green-600/20 text-green-400',
  TRIAL: 'bg-yellow-600/20 text-yellow-400',
  PAID: 'bg-blue-600/20 text-blue-400',
  SUSPENDED: 'bg-red-600/20 text-red-400',
}

function BroadcastsTab() {
  const qc = useQueryClient()
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')
  const [segment, setSegment] = useState<BroadcastSegment>('ALL')

  const { data: broadcasts = [], isLoading } = useQuery({
    queryKey: ['broadcasts'],
    queryFn: listBroadcasts,
  })

  const sendMut = useMutation({
    mutationFn: sendBroadcast,
    onSuccess: (b) => {
      toast.success(`Broadcast sent to ${b.sentCount} recipients`)
      setSubject('')
      setBody('')
      setSegment('ALL')
      qc.invalidateQueries({ queryKey: ['broadcasts'] })
    },
    onError: () => toast.error('Failed to send broadcast'),
  })

  function handleSend() {
    if (!subject.trim() || !body.trim()) return
    if (!confirm(`Send this broadcast to: ${SEGMENT_LABELS[segment]}?`)) return
    sendMut.mutate({ subject: subject.trim(), body: body.trim(), segment })
  }

  return (
    <div className="space-y-8">
      {/* Compose */}
      <div className="space-y-4">
        <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
          <Radio size={14} className="text-indigo-400" />
          Compose Broadcast
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Subject</label>
            <input
              value={subject}
              onChange={e => setSubject(e.target.value)}
              placeholder="e.g. Scheduled maintenance on Sunday"
              className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-indigo-500"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Audience</label>
            <select
              value={segment}
              onChange={e => setSegment(e.target.value as BroadcastSegment)}
              className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground outline-none focus:border-indigo-500"
            >
              {SEGMENTS.map(s => (
                <option key={s} value={s}>{SEGMENT_LABELS[s]}</option>
              ))}
            </select>
          </div>
          <div className="flex items-end">
            <button
              onClick={handleSend}
              disabled={!subject.trim() || !body.trim() || sendMut.isPending}
              className="w-full flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
            >
              <Send size={14} />
              {sendMut.isPending ? 'Sending…' : 'Send Broadcast'}
            </button>
          </div>
        </div>
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">Message body</label>
          <textarea
            value={body}
            onChange={e => setBody(e.target.value)}
            rows={5}
            placeholder="Write your message here…"
            className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-indigo-500 resize-none"
          />
        </div>
      </div>

      {/* History */}
      <div>
        <h3 className="text-sm font-semibold text-foreground mb-3">Broadcast History</h3>
        {isLoading ? (
          <div className="space-y-2">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-16 bg-sidebar-active rounded-lg animate-pulse" />
            ))}
          </div>
        ) : broadcasts.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">No broadcasts sent yet</p>
        ) : (
          <div className="space-y-3">
            {broadcasts.map(b => (
              <div key={b.id} className="bg-sidebar-active rounded-lg p-4 space-y-1">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-semibold text-foreground truncate">{b.subject}</p>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${SEGMENT_COLORS[b.segment]}`}>
                        {SEGMENT_LABELS[b.segment]}
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground mt-1 line-clamp-2 whitespace-pre-wrap">{b.body}</p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-xs font-medium text-foreground">{b.sentCount} sent</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{fmtDate(b.createdAt)}</p>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">By {b.sentByEmail}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

type Tab = 'tickets' | 'announcements' | 'broadcasts'

const TAB_LABELS: Record<Tab, string> = {
  tickets: 'Tickets',
  announcements: 'Announcements',
  broadcasts: 'Broadcasts',
}

export default function SupportPage() {
  const [tab, setTab] = useState<Tab>('tickets')

  return (
    <div className="p-8 space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-foreground">Support</h1>
        <p className="text-sm text-muted-foreground mt-1">Manage support tickets, announcements, and email broadcasts</p>
      </div>

      <div className="flex gap-1 p-1 bg-sidebar-active rounded-lg w-fit">
        {(['tickets', 'announcements', 'broadcasts'] as Tab[]).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-1.5 text-sm rounded-md transition-colors capitalize ${tab === t ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
          >
            {TAB_LABELS[t]}
          </button>
        ))}
      </div>

      <div className="bg-card border border-border rounded-xl p-6">
        {tab === 'tickets' && <TicketsTab />}
        {tab === 'announcements' && <AnnouncementsTab />}
        {tab === 'broadcasts' && <BroadcastsTab />}
      </div>
    </div>
  )
}
