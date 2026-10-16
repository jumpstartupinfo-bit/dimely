import { useState, useEffect } from 'react'
import { Bot, ToggleLeft, ToggleRight, Plus, Trash2, Loader2, BookOpen, MessageSquare, XCircle, RefreshCcw, Zap } from 'lucide-react'
import { aiAgent as aiAgentApi, type AgentSettings, type KnowledgeItem, type AgentActivityItem } from '../lib/api'
import type { Page } from '../App'



interface AIAgentPageProps {
  onNavigate: (page: Page, username?: string) => void
}

function timeAgo(ts: string): string {
  const diff = (Date.now() - new Date(ts).getTime()) / 1000
  if (diff < 60) return 'just now'
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  return `${Math.floor(diff / 86400)}d ago`
}

const ACTIVITY_ICON: Record<string, React.ElementType> = {
  booking_declined: XCircle,
  booking_confirmed: BookOpen,
  message_sent: MessageSquare,
  rescheduled: RefreshCcw,
}
const ACTIVITY_COLOR: Record<string, string> = {
  booking_declined: '#DC2626',
  booking_confirmed: '#059669',
  message_sent: '#6366F1',
  rescheduled: '#F59E0B',
}

export function AIAgentPage({ onNavigate: _onNavigate }: AIAgentPageProps) {
  const [loading, setLoading] = useState(true)
  const [agent, setAgent] = useState<AgentSettings | null>(null)
  const [knowledge, setKnowledge] = useState<KnowledgeItem[]>([])
  const [activity, setActivity] = useState<AgentActivityItem[]>([])

  const [newLabel, setNewLabel] = useState('')
  const [newContent, setNewContent] = useState('')
  const [addingKnowledge, setAddingKnowledge] = useState(false)
  const [showAddForm, setShowAddForm] = useState(false)

  useEffect(() => {
    let mounted = true
    aiAgentApi.get().then((res) => {
      if (mounted) {
        setAgent(res.agent)
        setKnowledge(res.knowledge)
        setActivity(res.activity)
      }
    }).catch(() => {
      if (mounted) {
        // Demo state
        setAgent({
          is_enabled: 0, auto_confirm: 1, respond_inquiries: 1,
          decline_conflicts: 1, allow_rescheduling: 0, allow_vip_requests: 0,
        })
        setKnowledge([
          { id: '1', label: 'Preferred topics', content: 'I enjoy discussing entrepreneurship, creativity, and building online businesses.', is_active: true },
          { id: '2', label: 'Session style', content: 'I keep calls focused and results-oriented. No small talk.', is_active: true },
        ])
        setActivity([
          { id: '1', type: 'booking_declined', description: 'Declined booking from user — conflict detected', created_at: new Date(Date.now() - 120_000).toISOString() },
          { id: '2', type: 'booking_confirmed', description: 'Confirmed 30-min booking with guest', created_at: new Date(Date.now() - 3_600_000).toISOString() },
          { id: '3', type: 'message_sent', description: 'Sent pre-call reminder to guest', created_at: new Date(Date.now() - 7_200_000).toISOString() },
        ])
      }
    }).finally(() => { if (mounted) setLoading(false) })
    return () => { mounted = false }
  }, [])

  function togglePermission(key: string, val: boolean) {
    if (!agent) return
    const prev = agent
    const updated = { ...agent, [key]: val ? 1 : 0 }
    setAgent(updated)
    void aiAgentApi.update({ [key]: val }).catch(() => setAgent(prev))
  }

  function toggleEnabled() {
    if (!agent) return
    const prev = agent
    const newVal = !agent.is_enabled
    const updated = { ...agent, is_enabled: newVal ? 1 : 0 }
    setAgent(updated)
    void aiAgentApi.update({ is_enabled: newVal }).catch(() => setAgent(prev))
  }

  async function addKnowledge() {
    if (!newLabel.trim() || !newContent.trim()) return
    setAddingKnowledge(true)
    try {
      const item = await aiAgentApi.addKnowledge(newLabel.trim(), newContent.trim())
      setKnowledge((prev) => [...prev, { ...item, is_active: true }])
      setNewLabel('')
      setNewContent('')
      setShowAddForm(false)
    } catch { /* ignore */ }
    finally { setAddingKnowledge(false) }
  }

  async function deleteKnowledge(id: string) {
    await aiAgentApi.deleteKnowledge(id).catch(() => {})
    setKnowledge((prev) => prev.filter((k) => k.id !== id))
  }

  const PERMISSIONS = [
    { key: 'auto_confirm', label: 'Auto-confirm bookings', description: 'Automatically confirm new bookings that pass your availability checks' },
    { key: 'respond_inquiries', label: 'Respond to inquiries', description: 'Send pre-written responses to common questions about your sessions' },
    { key: 'decline_conflicts', label: 'Decline conflicts', description: 'Automatically decline bookings that overlap with existing ones' },
    { key: 'allow_rescheduling', label: 'Handle rescheduling', description: 'Let the agent propose alternative times when a booking needs to move' },
    { key: 'allow_vip_requests', label: 'Handle VIP requests', description: 'Accept special booking requests from verified top earners' },
  ]

  if (loading) {
    return (
      <div className="min-h-dvh bg-[#F8FAFC] flex items-center justify-center pt-16">
        <Loader2 size={28} className="animate-spin text-[#6366F1]" />
      </div>
    )
  }

  const enabled = !!agent?.is_enabled

  return (
    <div className="min-h-dvh bg-[#F8FAFC] pb-24 md:pb-8 pt-16" style={{ fontFamily: "'DM Sans', sans-serif" }}>
      <div className="max-w-2xl mx-auto px-4 py-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-[#0F172A]" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>AI Agent</h1>
            <p className="text-sm text-[#64748B]">Automate your bookings while you focus on what matters</p>
          </div>
          <Zap size={28} className="text-[#6366F1]" />
        </div>

        {/* On/off */}
        <div
          className={`rounded-2xl p-5 mb-5 flex items-center justify-between ${enabled ? 'bg-[#6366F1]' : 'bg-white border border-gray-100'}`}
        >
          <div className="flex items-center gap-3">
            <div className={`w-11 h-11 rounded-xl flex items-center justify-center ${enabled ? 'bg-white/20' : 'bg-[#E0E7FF]'}`}>
              <Bot size={22} className={enabled ? 'text-white' : 'text-[#6366F1]'} />
            </div>
            <div>
              <p className={`text-sm font-bold ${enabled ? 'text-white' : 'text-[#0F172A]'}`}>
                Agent is {enabled ? 'active' : 'off'}
              </p>
              <p className={`text-xs ${enabled ? 'text-[#A5B4FC]' : 'text-[#64748B]'}`}>
                {enabled ? 'Managing bookings automatically' : 'Enable to automate your bookings'}
              </p>
            </div>
          </div>
          <button onClick={toggleEnabled}>
            {enabled ? <ToggleRight size={36} className="text-white" /> : <ToggleLeft size={36} className="text-gray-300" />}
          </button>
        </div>

        {/* Permissions */}
        <div className="bg-white rounded-2xl border border-gray-100 p-5 mb-5">
          <h2 className="text-sm font-bold text-[#0F172A] mb-4" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>Permissions</h2>
          <div className="space-y-3">
            {PERMISSIONS.map(({ key, label, description }) => {
              const val = !!(agent?.[key])
              return (
                <div key={key} className={`flex items-start justify-between p-4 rounded-xl ${enabled ? 'bg-[#F8FAFC]' : 'bg-[#F8FAFC] opacity-50'}`}>
                  <div className="flex-1 pr-4">
                    <p className="text-sm font-semibold text-[#0F172A]">{label}</p>
                    <p className="text-xs text-[#64748B] mt-0.5 leading-relaxed">{description}</p>
                  </div>
                  <button
                    onClick={() => enabled && togglePermission(key, !val)}
                    className={`w-10 h-6 rounded-full transition-colors flex-shrink-0 mt-0.5 ${val && enabled ? 'bg-[#6366F1]' : 'bg-gray-200'}`}
                  >
                    <div className={`w-4 h-4 rounded-full bg-white shadow-sm mx-1 transition-transform ${val && enabled ? 'translate-x-4' : 'translate-x-0'}`} />
                  </button>
                </div>
              )
            })}
          </div>
        </div>

        {/* Knowledge base */}
        <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden mb-5">
          <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
            <h2 className="text-sm font-bold text-[#0F172A]" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>Knowledge base</h2>
            <button
              onClick={() => setShowAddForm(true)}
              className="flex items-center gap-1.5 text-xs font-semibold text-[#6366F1] bg-[#E0E7FF] px-3 py-1.5 rounded-xl hover:bg-[#C7D2FE] transition-colors"
            >
              <Plus size={12} /> Add
            </button>
          </div>

          {showAddForm && (
            <div className="px-5 py-4 border-b border-gray-100 bg-[#F8FAFC]">
              <input
                value={newLabel}
                onChange={(e) => setNewLabel(e.target.value)}
                placeholder="Label (e.g. Preferred topics)"
                className="w-full bg-white border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-[#0F172A] mb-2 focus:outline-none focus:ring-2 focus:ring-[#6366F1]"
              />
              <textarea
                value={newContent}
                onChange={(e) => setNewContent(e.target.value)}
                placeholder="Content for your AI agent to use..."
                className="w-full bg-white border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-[#0F172A] h-20 resize-none focus:outline-none focus:ring-2 focus:ring-[#6366F1]"
              />
              <div className="flex gap-2 mt-2">
                <button
                  onClick={() => { void addKnowledge() }}
                  disabled={addingKnowledge || !newLabel.trim() || !newContent.trim()}
                  className="flex-1 bg-[#6366F1] text-white text-sm font-semibold py-2.5 rounded-xl hover:bg-[#4F46E5] transition-colors flex items-center justify-center gap-2"
                >
                  {addingKnowledge ? <Loader2 size={14} className="animate-spin" /> : null}
                  {addingKnowledge ? 'Saving...' : 'Save'}
                </button>
                <button onClick={() => { setShowAddForm(false); setNewLabel(''); setNewContent('') }} className="px-4 py-2.5 text-sm text-[#64748B] hover:text-[#0F172A]">
                  Cancel
                </button>
              </div>
            </div>
          )}

          <div className="divide-y divide-gray-50">
            {knowledge.length === 0 ? (
              <div className="px-5 py-6 text-center text-sm text-[#64748B]">No knowledge items yet</div>
            ) : knowledge.map((item) => (
              <div key={item.id} className="px-5 py-4 flex items-start gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-[#0F172A]">{item.label}</p>
                  <p className="text-xs text-[#64748B] mt-0.5 leading-relaxed">{item.content}</p>
                </div>
                <button
                  onClick={() => { void deleteKnowledge(item.id) }}
                  className="text-[#64748B] hover:text-red-500 transition-colors flex-shrink-0 mt-0.5"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Recent activity */}
        {activity.length > 0 && (
          <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100">
              <h2 className="text-sm font-bold text-[#0F172A]" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>Recent activity</h2>
            </div>
            <div className="divide-y divide-gray-50">
              {activity.map((act) => {
                const Icon = ACTIVITY_ICON[act.type] ?? Zap
                const color = ACTIVITY_COLOR[act.type] ?? '#6366F1'
                return (
                  <div key={act.id} className="px-5 py-3.5 flex items-center gap-3">
                    <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: color + '15' }}>
                      <Icon size={14} style={{ color }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-[#0F172A] font-medium truncate">{act.description}</p>
                    </div>
                    <span className="text-xs text-[#94A3B8] flex-shrink-0">{timeAgo(act.created_at)}</span>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
