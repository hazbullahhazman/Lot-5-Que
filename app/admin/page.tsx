'use client'

import { useEffect, useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient as supabase } from '@/utils/supabase/client'
import { motion, AnimatePresence } from 'framer-motion'
import { Check, X, Shield, Bell, LayoutDashboard, Users, UserPlus, LogOut, Search, Activity, UserX, Menu, Calculator, Scissors, CalendarDays, Banknote, Tags } from 'lucide-react'
import AppSidebar from '@/components/AppSidebar'

const DEFAULT_QUEUE_MESSAGE = `Assalamualaikum, Hi Salam Sejahtera {{customer_name}},
saya daripada Lot 5 Barbershop UTM Skudai.

Nombor anda adalah {{queue_number}}.
Anggaran giliran anda sekitar {{estimated_time}} (lebih kurang {{estimated_wait}} minit).

Sila bersedia, giliran anda hampir tiba.`

const safeStorageGet = (key: string) => {
  try {
    if (typeof window === 'undefined') return null
    return window.localStorage.getItem(key)
  } catch {
    return null
  }
}

const safeStorageSet = (key: string, value: string) => {
  try {
    if (typeof window !== 'undefined') window.localStorage.setItem(key, value)
  } catch {
    // Storage can be unavailable in strict/private browser contexts.
  }
}

const safeStorageClear = () => {
  try {
    if (typeof window !== 'undefined') window.localStorage.clear()
  } catch {
    // Storage can be unavailable in strict/private browser contexts.
  }
}

const MOCK_CALLED_TO_CHAIR_KEY = 'lot5_mock_called_to_chair'
const WEEK_DAYS = [
  { key: 'monday', label: 'Monday' },
  { key: 'tuesday', label: 'Tuesday' },
  { key: 'wednesday', label: 'Wednesday' },
  { key: 'thursday', label: 'Thursday' },
  { key: 'friday', label: 'Friday' },
  { key: 'saturday', label: 'Saturday' },
  { key: 'sunday', label: 'Sunday' }
]

const DEFAULT_DAILY_HOURS = WEEK_DAYS.reduce((acc, day) => {
  acc[day.key] = { open: day.key !== 'wednesday', openTime: '14:00', closeTime: '22:00' }
  return acc
}, {} as Record<string, { open: boolean; openTime: string; closeTime: string }>)

const DEFAULT_SHOP_SETTINGS = {
  operationsMode: 'both', // 'both', 'slot', 'queue', 'closed'
  openTime: '14:00',
  closeTime: '22:00',
  breakStart: '19:15',
  breakEnd: '20:00',
  dailyHours: DEFAULT_DAILY_HOURS,
  averageServiceMinutes: 30,
  maxWalkInWaitMinutes: 120,
  whatsappQueueMessage: DEFAULT_QUEUE_MESSAGE,
  barbers: [
    { id: '1', name: 'Julian', active: true, role: 'both' },
    { id: '2', name: 'Marcus', active: true, role: 'queue' }
  ]
}

const normalizeShopSettings = (settings: any) => {
  const incoming = settings || {}
  return {
    ...DEFAULT_SHOP_SETTINGS,
    ...incoming,
    dailyHours: {
      ...DEFAULT_DAILY_HOURS,
      ...(incoming.dailyHours || {})
    },
    whatsappQueueMessage: incoming.whatsappQueueMessage || DEFAULT_QUEUE_MESSAGE,
    barbers: Array.isArray(incoming.barbers) && incoming.barbers.length > 0
      ? incoming.barbers
      : DEFAULT_SHOP_SETTINGS.barbers
  }
}

export default function AdminDashboardWrapper() {
  return (
     <Suspense fallback={<div className="min-h-screen flex items-center justify-center font-bold">Loading...</div>}>
        <AdminDashboard />
     </Suspense>
  )
}

function AdminDashboard() {
  const router = useRouter()
  const searchParams = useSearchParams()
  type AdminTab = 'overview' | 'customers' | 'management' | 'users' | 'pricing' | 'payroll'
  const initialTab = (searchParams.get('tab') as AdminTab) || 'overview'

  const [profile, setProfile] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [activeTab, setActiveTab] = useState<AdminTab>(initialTab)
  const [queueView, setQueueView] = useState<'queue' | 'slots'>('queue')
  
  // Data
  const [activeQueue, setActiveQueue] = useState<any[]>([])
  const [history, setHistory] = useState<any[]>([])
  const [usersList, setUsersList] = useState<any[]>([])
  const [metrics, setMetrics] = useState({ todayCuts: 0, todaySales: 0, weeklyCuts: 0, churnRisk: 0, absences: 0 })

  // Shop Management Configuration
  const [shopSettings, setShopSettings] = useState(DEFAULT_SHOP_SETTINGS)
  const [newBarberName, setNewBarberName] = useState('')
  const [longPressTimer, setLongPressTimer] = useState<NodeJS.Timeout | null>(null)

  useEffect(() => {
    router.prefetch('/pos')
    const saved = safeStorageGet('lot5_shop_settings')
    if (saved) setShopSettings(normalizeShopSettings(JSON.parse(saved)))

    checkAdmin()

    let channel: any
    if (process.env.NEXT_PUBLIC_SUPABASE_URL && !process.env.NEXT_PUBLIC_SUPABASE_URL.includes('placeholder')) {
        channel = supabase()
          .channel('admin-events')
          .on('postgres_changes', { event: '*', schema: 'public', table: 'queue_entries' }, () => fetchData())
          .on('postgres_changes', { event: '*', schema: 'public', table: 'settings' }, () => fetchData())
          .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, () => fetchData())
          .subscribe()
    }

    return () => { if (channel) supabase().removeChannel(channel) }
  }, [router])

  useEffect(() => {
    const t = searchParams.get('tab') as any
    if (t) setActiveTab(t)
    else setActiveTab('overview')
  }, [searchParams])

  const checkAdmin = async () => {
     if (!process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL.includes('placeholder')) {
         const role = safeStorageGet('mock_role') || 'owner'
         if (role !== 'admin' && role !== 'owner' && role !== 'barber') {
             window.location.href = '/login'
         } else {
             setProfile({ id: 'admin-123', name: role === 'owner' ? 'Shop Owner' : 'Master Barber', role })
             loadMockData()
             setLoading(false)
         }
         return
     }

     const { data: { session } } = await supabase().auth.getSession()
     if (!session) { window.location.href = '/login'; return }
     
     const { data } = await supabase().from('profiles').select('*').eq('id', session.user.id).single()
     if (!data || !['admin', 'owner', 'barber'].includes(data.role)) {
         window.location.href = '/dashboard' // Not an authorized role
         return
     }

     setProfile(data)
     fetchData()
     setLoading(false)
  }

  const loadMockData = () => {
      setActiveQueue([
          { id: 'q1', queue_number: 14, status: 'WAITING', customer_name: 'Julian D.', phone_number: '60123456789', joined_at: new Date(Date.now() - 40*60000).toISOString() },
          { id: 'q2', queue_number: 15, status: 'WAITING', customer_name: 'Marcus K.', phone_number: '60198765432', joined_at: new Date(Date.now() - 15*60000).toISOString() },
          { id: 'q3', queue_number: 0, status: 'WAITING', customer_name: 'Syed (Booking)', phone_number: '60132273797', booked_time: '18:30', joined_at: new Date().toISOString(), entry_type: 'booking' }
      ])
      setHistory([
          { id: 'h1', status: 'COMPLETED', created_at: new Date().toISOString(), customer_name: 'John Doe' }
      ])
      setUsersList([
          { id: '1', name: 'Julian D.', email: 'julian@lot5.com', role: 'admin', created_at: new Date().toISOString() },
          { id: '2', name: 'Marcus K.', email: 'marcus@lot5.com', role: 'user', created_at: new Date().toISOString() }
      ])
      setMetrics({ todayCuts: 12, todaySales: 360, weeklyCuts: 84, churnRisk: 5, absences: 2 })
  }

  const fetchData = async () => {
     if (!process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL.includes('placeholder')) return

     try {
         // Active Queue List mapping to User profiles
         const { data: qData } = await supabase()
            .from('queue_entries')
            .select('id, queue_number, status, user_id, customer_name, phone_number, joined_at, booked_time, entry_type, assigned_barber_id, profiles(name, email, phone)')
            .in('status', ['WAITING', 'NOTIFIED', 'CALLED', 'IN_CHAIR', 'HOLD', 'PAYMENT_PENDING'])
            .order('queue_number', { ascending: true })
         if (qData) setActiveQueue(qData)

         // Historical Data for CRM
         const { data: hData } = await supabase()
            .from('queue_entries')
            .select('id, queue_number, status, joined_at, customer_name, profiles(name, email)')
            .in('status', ['COMPLETED', 'CANCELLED', 'ABSENT'])
            .order('joined_at', { ascending: false })
            .limit(100)
         if (hData) {
             setHistory(hData)
             // Calculate CRM Metrics
             const now = new Date()
             let today = 0, week = 0, absent = 0
             hData.forEach(h => {
                const d = new Date(h.joined_at)
                const diffDays = Math.ceil(Math.abs(now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24))
                if (diffDays <= 1 && h.status === 'COMPLETED') today++
                if (diffDays <= 7 && h.status === 'COMPLETED') week++
                if (h.status === 'ABSENT' && diffDays <= 7) absent++
             })
             
             // Transactions (Sales logic)
             const { data: tData } = await supabase()
                .from('transactions')
                .select('price, total, created_at')
                .eq('status', 'COMPLETED')
             
             let sales = 0
             if (tData) {
                tData.forEach(t => {
                   const d = new Date(t.created_at)
                   const diff = Math.ceil(Math.abs(now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24))
                   if (diff <= 1) sales += Number(t.total ?? t.price ?? 0)
                })
             }

             setMetrics({ todayCuts: today, todaySales: sales, weeklyCuts: week, churnRisk: 0, absences: absent })
         }

         const { data: uData } = await supabase()
            .from('profiles')
            .select('*')
            .order('created_at', { ascending: false })
         if (uData) setUsersList(uData)
         
         const { data: sData } = await supabase()
            .from('settings')
            .select('raw_settings')
            .eq('id', 1)
            .single()
         if (sData?.raw_settings) {
            setShopSettings(normalizeShopSettings(sData.raw_settings))
         } else {
             const local = safeStorageGet('lot5_shop_settings')
             if (local) setShopSettings(normalizeShopSettings(JSON.parse(local)))
         }

     } catch (err) { console.error(err) }
  }

  const toggleUserRole = async (userId: string, currentRole: string) => {
     const newRole = currentRole === 'admin' ? 'user' : 'admin'
     if (!process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL.includes('placeholder')) {
         setUsersList(prev => prev.map(u => u.id === userId ? { ...u, role: newRole } : u))
         return
     }

     if (window.confirm(`Change role to ${newRole.toUpperCase()}?`)) {
         await supabase().from('profiles').update({ role: newRole }).eq('id', userId)
         fetchData()
     }
  }

  // Admin Actions
  const getQueueName = (q: any) => q.customer_name || q.profiles?.name || 'Customer'
  const getQueuePhone = (q: any) => q.phone_number || q.profiles?.phone || ''
  const getQueuePosition = (q: any) => {
     if (q.booked_time) return 1
     const queue = activeQueue.filter(item => !item.booked_time && ['WAITING', 'NOTIFIED', 'CALLED'].includes(item.status))
     const index = queue.findIndex(item => item.id === q.id)
     return index >= 0 ? index + 1 : 1
  }
  const getEstimatedWaitMinutes = (q: any) => {
     if (q.booked_time) return 0
     const activeBarbers = Math.max(1, shopSettings.barbers.filter(b => b.active && (b.role === 'both' || b.role === 'queue')).length)
     return Math.max(5, Math.ceil((getQueuePosition(q) * (shopSettings.averageServiceMinutes || 30)) / activeBarbers))
  }
  const buildQueueMessage = (q: any) => {
     const wait = getEstimatedWaitMinutes(q)
     const estimatedTime = q.booked_time || new Date(Date.now() + wait * 60000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
     return (shopSettings.whatsappQueueMessage || DEFAULT_QUEUE_MESSAGE)
       .replaceAll('{{customer_name}}', getQueueName(q))
       .replaceAll('{{queue_number}}', q.booked_time ? q.booked_time : `#${q.queue_number}`)
       .replaceAll('{{estimated_wait}}', String(wait))
       .replaceAll('{{estimated_time}}', estimatedTime)
       .replaceAll('{{shop_name}}', 'Lot 5 Barbershop')
  }

  const updateQueueStatus = async (id: string, status: string) => {
     if (!process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL.includes('placeholder')) {
        const calledIds = JSON.parse(safeStorageGet(MOCK_CALLED_TO_CHAIR_KEY) || '[]') as string[]
        const nextCalledIds = status === 'IN_CHAIR'
          ? Array.from(new Set([...calledIds, id]))
          : ['ABSENT', 'CANCELLED', 'COMPLETED'].includes(status)
            ? calledIds.filter(calledId => calledId !== id)
            : calledIds
        safeStorageSet(MOCK_CALLED_TO_CHAIR_KEY, JSON.stringify(nextCalledIds))
        setActiveQueue(prev => ['ABSENT', 'CANCELLED'].includes(status) ? prev.filter(q => q.id !== id) : prev.map(q => q.id === id ? { ...q, status } : q))
        return
     }
     await supabase().from('queue_entries').update({ status }).eq('id', id)
     fetchData()
  }

  const handleCallCustomer = async (q: any) => {
     const name = getQueueName(q)
     const phone = getQueuePhone(q)
     if (!phone) {
        alert('Customer did not provide a phone number.')
        return
     }
     if (window.confirm(`Send WhatsApp reminder to ${name}?`)) {
        const cleanPhone = phone.replace(/[^\d]/g, '')
        const message = buildQueueMessage(q)
        window.open(`https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`, '_blank')
        await updateQueueStatus(q.id, 'NOTIFIED')
     }
  }

  const handleOpenInPOS = async (id: string) => {
     await updateQueueStatus(id, 'IN_CHAIR')
     router.push(`/pos?customer=${id}`)
  }

  const handleCallToChair = async (id: string) => {
     await updateQueueStatus(id, 'IN_CHAIR')
  }

  const handleMarkAbsent = async (id: string) => {
     if (window.confirm(`Remove this customer from the active list?`)) {
        await updateQueueStatus(id, 'ABSENT')
        setMetrics(prev => ({ ...prev, absences: prev.absences + 1 }))
     }
  }

  const handleClearDefaultQueue = async () => {
     if (window.confirm(`Clear all Walk-in tickets? This will cancel all currently waiting non-booking tickets.`)) {
        if (!process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL.includes('placeholder')) {
            setActiveQueue(prev => prev.filter(q => q.booked_time))
            return
        }
        await supabase().from('queue_entries').update({ status: 'CANCELLED' }).in('status', ['WAITING', 'NOTIFIED', 'CALLED', 'HOLD']).is('booked_time', null)
        fetchData()
     }
  }

  const [showWalkInModal, setShowWalkInModal] = useState(false)

  const handleAddWalkIn = async (e: React.FormEvent) => {
      e.preventDefault()
      const formData = new FormData(e.target as HTMLFormElement)
      const name = formData.get('name') as string
      const phone = formData.get('phone') as string
      const service = formData.get('service') as string
      const remark = formData.get('remark') as string

      const finalName = remark ? `${name} - ${service} (${remark})` : `${name} - ${service}`

      let nextTicketNumber = 1
      if (!process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL.includes('placeholder')) {
         const walkInQueue = activeQueue.filter((q: any) => !q.booked_time)
         nextTicketNumber = walkInQueue.length > 0 ? walkInQueue[walkInQueue.length - 1].queue_number + 1 : 1
         setActiveQueue(prev => [...prev, { id: Date.now().toString(), queue_number: nextTicketNumber, status: 'WAITING', customer_name: finalName, phone_number: phone, joined_at: new Date().toISOString(), entry_type: 'walk_in' }])
      } else {
         const rpcResult = await supabase().rpc('join_walk_in_queue', {
             p_customer_name: finalName,
             p_phone_number: phone || null,
             p_user_id: null,
             p_service_type: service,
             p_remark: remark || null
         })

         if (rpcResult.error) {
             const today = new Date()
             today.setHours(0, 0, 0, 0)
             const { data: qnData } = await supabase()
                 .from('queue_entries')
                 .select('queue_number')
                 .gte('joined_at', today.toISOString())
                 .order('queue_number', { ascending: false })
                 .limit(1)
             if (qnData && qnData.length > 0) {
                 nextTicketNumber = qnData[0].queue_number + 1
             }
             await supabase().from('queue_entries').insert([{
                 customer_name: finalName,
                 phone_number: phone,
                 queue_number: nextTicketNumber,
                 status: 'WAITING',
                 entry_type: 'walk_in',
                 service_type: service
             }])
         }
         fetchData()
      }
      setShowWalkInModal(false)
  }

  const [isSaving, setIsSaving] = useState(false)
  const saveShopSettings = async (newSettings: any) => {
      const normalizedSettings = normalizeShopSettings(newSettings)
      setShopSettings(normalizedSettings)
      safeStorageSet('lot5_shop_settings', JSON.stringify(normalizedSettings))
      setIsSaving(true)
      if (process.env.NEXT_PUBLIC_SUPABASE_URL && !process.env.NEXT_PUBLIC_SUPABASE_URL.includes('placeholder')) {
         await supabase()
            .from('settings')
            .upsert({ id: 1, raw_settings: normalizedSettings }, { onConflict: 'id' })
      }
      setTimeout(() => setIsSaving(false), 1000)
  }

  const handleAddBarber = () => {
    if (!newBarberName.trim()) return
    const updated = {
       ...shopSettings,
       barbers: [...shopSettings.barbers, { id: Date.now().toString(), name: newBarberName.trim(), active: true, role: 'both' }]
    }
    saveShopSettings(updated)
    setNewBarberName('')
  }

  const handleDeleteBarber = (id: string) => {
    if (window.confirm("Remove this barber completely?")) {
        const updated = { ...shopSettings, barbers: shopSettings.barbers.filter(b => b.id !== id) }
        saveShopSettings(updated)
    }
  }

  const handleBarberTouchStart = (id: string) => {
      const timer = setTimeout(() => handleDeleteBarber(id), 1000)
      setLongPressTimer(timer)
  }
  const handleBarberTouchEnd = () => {
      if (longPressTimer) clearTimeout(longPressTimer)
  }

  const toggleBarberStatus = (id: string, field: 'active'|'role') => {
      const updated = {
          ...shopSettings,
          barbers: shopSettings.barbers.map(b => {
             if (b.id !== id) return b
             if (field === 'active') return { ...b, active: !b.active }
             let nextRole = 'both'
             if (b.role === 'both') nextRole = 'queue'
             else if (b.role === 'queue') nextRole = 'booking'
             else if (b.role === 'booking') nextRole = 'absent'
             return { ...b, role: nextRole }
          })
      }
      saveShopSettings(updated)
  }

  const handleLogout = async () => {
      safeStorageClear()
      if (process.env.NEXT_PUBLIC_SUPABASE_URL && !process.env.NEXT_PUBLIC_SUPABASE_URL.includes('placeholder')) {
         await supabase().auth.signOut()
      }
      window.location.href = '/'
  }

  const renderQueueCard = (q: any, i: number, isBooking = false) => {
     const name = getQueueName(q)
     const contact = q.phone_number || q.profiles?.phone || q.profiles?.email || 'N/A'
     const statusText = q.status === 'NOTIFIED' ? 'Notified' : q.status === 'CALLED' ? 'Called' : q.status === 'IN_CHAIR' ? 'In Chair' : q.status === 'HOLD' ? 'On Hold' : isBooking ? 'Awaiting Arrival' : (i === 0 ? 'Next Up' : 'Waiting')

     return (
        <motion.div
          key={q.id}
          layout
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          className="rounded-2xl border border-outline-variant/10 bg-white p-4 shadow-sm"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="font-black text-on-surface leading-tight truncate">{name}</p>
              <div className="flex flex-wrap gap-2 mt-2">
                <span className={`font-black text-[9px] uppercase tracking-widest px-2 py-1 rounded-full ${q.status === 'NOTIFIED' || q.status === 'CALLED' ? 'text-[#e5f638] bg-[#545b00]' : q.status === 'IN_CHAIR' ? 'text-white bg-[#004be2]' : q.status === 'HOLD' ? 'text-orange-700 bg-orange-100' : 'text-on-surface-variant bg-surface-container'}`}>
                  {statusText}
                </span>
                <span className="font-black text-[9px] uppercase tracking-widest px-2 py-1 rounded-full bg-[#e5f638]/20 text-[#545b00]">
                  {isBooking ? q.booked_time : `#${q.queue_number}`}
                </span>
              </div>
              <p className="text-xs font-bold text-on-surface-variant mt-3 break-all">{contact}</p>
              {q.joined_at && !isBooking && (
                <p className="text-[10px] font-bold text-orange-600 uppercase tracking-widest mt-2">
                  Waited {Math.floor((Date.now() - new Date(q.joined_at).getTime()) / 60000)} mins
                </p>
              )}
            </div>
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-black flex-shrink-0 ${isBooking ? 'bg-[#e5f638] text-[#545b00]' : i === 0 ? 'bg-[#c5d0ff] text-[#004be2]' : 'bg-surface-container text-on-surface-variant'}`}>
              {isBooking ? 'B' : i + 1}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 mt-4">
            <button
              onClick={() => handleCallCustomer(q)}
              className="bg-white border border-[#545b00]/10 text-[#545b00] font-black text-[10px] uppercase tracking-widest px-2 py-2.5 rounded-xl flex items-center justify-center gap-1"
            >
              <Bell className="w-3.5 h-3.5" /> Reminder
            </button>
            {q.status === 'IN_CHAIR' || q.status === 'PAYMENT_PENDING' ? (
              <button
                onClick={() => handleOpenInPOS(q.id)}
                className="bg-[#004be2] text-white font-black text-[10px] uppercase tracking-widest px-2 py-2.5 rounded-xl flex items-center justify-center gap-1"
              >
                <Calculator className="w-3.5 h-3.5" /> Open POS
              </button>
            ) : (
              <button
                onClick={() => handleCallToChair(q.id)}
                className="bg-[#e5f638] text-[#545b00] font-black text-[10px] uppercase tracking-widest px-2 py-2.5 rounded-xl flex items-center justify-center gap-1"
              >
                <Scissors className="w-3.5 h-3.5" /> Call to Chair
              </button>
            )}
            <button
              onClick={() => handleMarkAbsent(q.id)}
              className="bg-red-50 border border-red-100 text-red-600 font-black text-[10px] uppercase tracking-widest px-2 py-2.5 rounded-xl flex items-center justify-center gap-1 col-span-2"
            >
              <UserX className="w-3.5 h-3.5" /> Remove
            </button>
          </div>
        </motion.div>
     )
  }

  if (loading) return <div className="min-h-screen flex items-center justify-center bg-[#f9f6f5]"><div className="w-10 h-10 border-4 border-outline-variant/20 border-t-[#545b00] rounded-full animate-spin"></div></div>

  const walkInQueue = activeQueue.filter(q => !q.booked_time)
  const bookingQueue = activeQueue.filter(q => q.booked_time).sort((a, b) => String(a.booked_time || '').localeCompare(String(b.booked_time || '')))
  const calledToChair = activeQueue.filter(q => q.status === 'IN_CHAIR' || q.status === 'PAYMENT_PENDING')
  const waitingCount = activeQueue.filter(q => !q.booked_time && ['WAITING', 'NOTIFIED', 'CALLED', 'HOLD'].includes(q.status)).length
  const currentServingText = calledToChair.length > 0 ? calledToChair.map(getQueueName).join(', ') : 'No one in chair'
  const nextBooking = bookingQueue.find(q => ['WAITING', 'NOTIFIED', 'CALLED', 'HOLD'].includes(q.status))

  return (
    <div className="bg-[#f9f6f5] text-on-surface selection:bg-primary-container selection:text-on-primary-container font-body min-h-screen">
      
      {/* TopNavBar */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-white transition-colors flex justify-between items-center w-full px-4 md:px-6 py-4 shadow-sm border-b border-outline-variant/10">
        <div className="flex items-center gap-3 md:gap-8">
          <button onClick={() => setSidebarOpen(true)} className="md:hidden p-2 bg-surface rounded-xl hover:bg-surface-container-high transition-colors">
             <Menu className="w-5 h-5 text-on-surface" />
          </button>
          <span className="text-xl md:text-2xl font-black tracking-tighter text-[#596000] font-headline">Lot 5<span className="text-[#004be2]">.</span> <span className="font-bold text-[10px] md:text-xs uppercase tracking-widest text-[#004be2] bg-[#c5d0ff] px-2 rounded-full py-0.5 mt-1 sm:mt-0 sm:ml-2 shadow-sm align-middle hidden sm:inline-block">Admin</span></span>
        </div>
        <div className="flex items-center gap-4">
          <button onClick={handleLogout} className="px-3 md:px-4 py-2 border border-outline-variant/10 bg-surface-container-low hover:bg-red-50 hover:text-red-600 hover:border-red-100 rounded-full font-bold text-xs md:text-sm transition-all flex items-center gap-2">
             <span className="hidden sm:inline">Sign Out</span> <LogOut className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Mobile Overlay */}
      {sidebarOpen && (
         <div onClick={() => setSidebarOpen(false)} className="md:hidden fixed inset-0 bg-black/60 z-50 animate-in fade-in transition-all"></div>
      )}

      {/* SideNavBar via Component */}
      <AppSidebar 
         sidebarOpen={sidebarOpen} 
         setSidebarOpen={setSidebarOpen} 
         activeTab={activeTab} 
         onTabChange={(tab) => setActiveTab(tab as any)} 
         profile={profile} 
      />

      {/* Main Content */}
      <main className="md:pl-64 pt-24 pb-32 px-4 md:px-8 min-h-screen max-w-[1500px] mx-auto animate-in fade-in duration-500">
        
        {activeTab === 'overview' ? (
        <>
        {/* Header Section */}
        <section className="bg-gradient-to-r from-[#e5f638] to-[#f6ff8a] p-8 md:p-10 rounded-[2rem] relative overflow-hidden flex flex-col md:flex-row justify-between items-start md:items-center border border-[#545b00]/10 shadow-sm mb-10 gap-6">
           <div className="relative z-10 w-full md:w-auto">
              <h1 className="text-4xl md:text-5xl font-black font-headline tracking-tighter text-[#545b00] mb-2 leading-tight">Live Operations</h1>
              <p className="text-[#545b00]/80 font-bold text-lg">
                <span className="text-[#004be2] bg-[#c5d0ff] px-2 rounded underline decoration-wavy underline-offset-4">{waitingCount} waiting</span>
                <span className="mx-2">/</span>
                <span>{calledToChair.length} called to chair</span>
              </p>
              <p className="mt-2 text-sm font-black uppercase tracking-widest text-[#545b00]/70">
                Current serving: <span className="text-[#004be2] normal-case tracking-normal">{currentServingText}</span>
              </p>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 w-full md:w-auto">
              <div className="bg-white/80 backdrop-blur-md px-6 py-4 rounded-3xl shadow-sm text-center border border-white/50">
                 <p className="text-[10px] uppercase font-black tracking-widest text-[#004be2]/60 mb-1">Next Booking</p>
                 <p className="font-headline font-black text-2xl text-[#004be2]">{nextBooking?.booked_time || '--'}</p>
              </div>
              <div className="bg-white/80 backdrop-blur-md px-6 py-4 rounded-3xl shadow-sm text-center flex-1 border border-white/50">
                 <p className="text-[10px] uppercase font-black tracking-widest text-[#545b00]/60 mb-1">Today&apos;s Cuts</p>
                 <p className="font-headline font-black text-3xl text-[#545b00]">{metrics.todayCuts}</p>
              </div>
             <div className="bg-white/80 backdrop-blur-md px-6 py-4 rounded-3xl shadow-sm text-center flex-1 border border-white/50">
                <p className="text-[10px] uppercase font-black tracking-widest text-[#004be2]/60 mb-1">Today Sales</p>
                <p className="font-headline font-black text-3xl text-[#004be2]">RM {metrics.todaySales}</p>
             </div>
           </div>

           <div className="absolute right-0 top-0 w-1/3 h-full bg-gradient-to-l from-white/20 to-transparent pointer-events-none mix-blend-overlay"></div>
        </section>

        <section className="bg-white rounded-[2rem] border border-outline-variant/10 shadow-sm p-5 md:p-6 mb-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h2 className="font-headline font-black text-2xl text-on-surface flex items-center gap-2">
                <Scissors className="w-5 h-5 text-[#004be2]" /> Called to Chair
              </h2>
              <p className="text-sm font-bold text-on-surface-variant mt-1">Only these customers should appear in POS.</p>
            </div>
            <span className="w-max px-4 py-2 bg-[#c5d0ff] text-[#004be2] rounded-full text-xs font-black uppercase tracking-widest">
              {calledToChair.length} active
            </span>
          </div>
          <div className="mt-5 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
            {calledToChair.length === 0 ? (
              <div className="md:col-span-2 xl:col-span-3 rounded-2xl bg-surface-container-lowest border border-dashed border-outline-variant/20 p-6 text-center text-on-surface-variant font-bold">
                No customer has been called to chair yet.
              </div>
            ) : calledToChair.map(q => (
              <div key={q.id} className="rounded-2xl border border-[#004be2]/10 bg-[#f0f4ff] p-4 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-black text-on-surface truncate">{getQueueName(q)}</p>
                  <p className="text-xs font-bold text-[#004be2] uppercase tracking-widest mt-1">{q.booked_time ? `Slot ${q.booked_time}` : `Ticket #${q.queue_number}`}</p>
                </div>
                <button onClick={() => handleOpenInPOS(q.id)} className="px-4 py-2 rounded-xl bg-[#004be2] text-white font-black text-[10px] uppercase tracking-widest flex items-center gap-2">
                  <Calculator className="w-4 h-4" /> POS
                </button>
              </div>
            ))}
          </div>
        </section>

        <div className="grid grid-cols-1 2xl:grid-cols-2 gap-6 items-start">
        {/* Queue Management Table */}
        <section className="bg-white rounded-[2rem] overflow-hidden shadow-sm border border-outline-variant/10">
          <div className="px-4 md:px-8 py-5 md:py-6 flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 bg-white border-b border-outline-variant/5">
            <div>
              <h2 className="font-headline font-bold text-2xl text-on-surface">Queue Control</h2>
              <div className="mt-3 inline-flex bg-surface-container-low rounded-full p-1 border border-outline-variant/10 md:hidden">
                <button onClick={() => setQueueView('queue')} className={`px-4 py-2 rounded-full text-[10px] font-black uppercase tracking-widest ${queueView === 'queue' ? 'bg-[#e5f638] text-[#545b00]' : 'text-on-surface-variant'}`}>Queue</button>
                <button onClick={() => setQueueView('slots')} className={`px-4 py-2 rounded-full text-[10px] font-black uppercase tracking-widest ${queueView === 'slots' ? 'bg-[#c5d0ff] text-[#004be2]' : 'text-on-surface-variant'}`}>Slots</button>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2 sm:gap-3 w-full sm:w-auto">
              <button onClick={() => setShowWalkInModal(true)} className="px-3 md:px-4 py-1.5 bg-[#e5f638] text-[#545b00] hover:scale-105 rounded-full text-[9px] md:text-[10px] font-black uppercase tracking-widest transition-transform shadow-sm flex items-center gap-1">
                <UserPlus className="w-3 h-3" /> Add Walk-in
              </button>
              <button onClick={handleClearDefaultQueue} className="px-3 md:px-4 py-1.5 bg-red-50 text-red-600 hover:bg-red-500 hover:text-white rounded-full text-[9px] md:text-[10px] font-black uppercase tracking-widest border border-red-200 transition-colors shadow-sm hidden sm:block">
                Clear List
              </button>
              <span className="px-4 py-1.5 bg-[#c5d0ff] text-[#004be2] text-[10px] font-black uppercase tracking-widest rounded-full flex items-center gap-2 shadow-sm border border-[#004be2]/10">
                 <span className="w-2 h-2 bg-[#004be2] rounded-full animate-pulse"></span> LIVE SYNC
              </span>
            </div>
          </div>
          
          <div className="md:hidden p-4 space-y-3">
            <AnimatePresence mode="popLayout">
              {(queueView === 'queue' ? walkInQueue : bookingQueue).map((q, i) => renderQueueCard(q, i, queueView === 'slots'))}
            </AnimatePresence>
            {(queueView === 'queue' ? walkInQueue : bookingQueue).length === 0 && (
              <div className="px-4 py-14 text-center rounded-3xl bg-surface-container-lowest border border-outline-variant/10">
                <div className="w-14 h-14 bg-surface-container mx-auto rounded-full flex items-center justify-center mb-4">
                  <span className="material-symbols-outlined text-on-surface-variant/50 text-3xl">local_cafe</span>
                </div>
                <p className="text-on-surface-variant font-bold">{queueView === 'queue' ? 'Queue is empty.' : 'No upcoming slots.'}</p>
              </div>
            )}
          </div>

          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                 <tr className="text-on-surface-variant text-[9px] md:text-[10px] font-bold uppercase tracking-widest bg-surface/30 border-b border-outline-variant/5">
                   <th className="px-4 md:px-8 py-3 md:py-4">Status & Name</th>
                   <th className="px-4 md:px-8 py-3 md:py-4">Ticket</th>
                   <th className="px-4 md:px-8 py-3 md:py-4 hidden sm:table-cell">Contact</th>
                   <th className="px-4 md:px-8 py-3 md:py-4 text-right">Admin Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant/5">
                <AnimatePresence mode="popLayout">
                  {walkInQueue.map((q, i) => (
                    <motion.tr 
                      layout
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 10, filter: 'blur(4px)' }}
                      transition={{ duration: 0.3 }}
                      key={q.id} 
                      className="group hover:bg-[#f8fcfd] transition-colors duration-200"
                    >
                      <td className="px-4 md:px-8 py-4 md:py-6">
                        <div className="flex items-center gap-3 md:gap-4">
                           <div className={`w-10 h-10 md:w-12 md:h-12 rounded-2xl flex flex-col items-center justify-center font-black ${i === 0 ? 'bg-[#c5d0ff] text-[#004be2] shadow-sm border border-[#004be2]/10' : 'bg-surface-container-low text-on-surface-variant border border-outline-variant/10'}`}>
                              {(q.customer_name || q.profiles?.name) ? (q.customer_name || q.profiles?.name).substring(0, 2).toUpperCase() : 'CU'}
                           </div>
                           <div>
                             <p className="font-bold text-on-surface text-base md:text-lg">{q.customer_name || q.profiles?.name || 'Customer'}</p>
                             <span className={`font-black text-[9px] md:text-[10px] uppercase tracking-widest mt-1 mr-2 inline-block ${q.status === 'NOTIFIED' || q.status === 'CALLED' ? 'text-[#e5f638] bg-[#545b00] px-3 py-1 rounded-full animate-pulse' : q.status === 'HOLD' ? 'text-orange-700 bg-orange-100 px-3 py-1 rounded-full' : q.status === 'IN_CHAIR' ? 'text-white bg-[#004be2] px-3 py-1 rounded-full' : (i === 0 ? 'text-[#004be2]' : 'text-on-surface-variant')}`}>
                                {q.status === 'NOTIFIED' ? 'WhatsApp notified' : q.status === 'CALLED' ? 'Called to chair' : q.status === 'HOLD' ? 'On hold / skip for now' : q.status === 'IN_CHAIR' ? 'Now serving' : (i === 0 ? 'Next Up' : 'Waiting in Lobby')}
                             </span>
                             {q.joined_at && (
                                <div className="flex items-center gap-2 mt-2">
                                  <span className="font-bold text-[9px] text-on-surface-variant/80 tracking-widest uppercase bg-surface-container-high px-2 py-0.5 rounded-full inline-block border border-outline-variant/10">
                                    Joined: {new Date(q.joined_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                  </span>
                                  <span className="font-bold text-[9px] text-orange-600/90 tracking-widest uppercase bg-orange-50 px-2 py-0.5 rounded-full inline-block border border-orange-200">
                                    Waited: {Math.floor((Date.now() - new Date(q.joined_at).getTime()) / 60000)} mins
                                  </span>
                                </div>
                             )}
                           </div>
                        </div>
                      </td>
                      <td className="px-4 md:px-8 py-4 md:py-6">
                         <div className="bg-[#1a1a1a] text-[#e5f638] px-3 md:px-4 py-1.5 md:py-2 rounded-lg md:rounded-xl inline-flex items-center shadow-inner font-headline font-black text-sm md:text-base">
                            <span className="opacity-50 font-medium mr-1">#</span>{q.queue_number}
                         </div>
                      </td>
                      <td className="px-4 md:px-8 py-4 md:py-6 font-body text-xs md:text-sm font-medium text-on-surface-variant hidden sm:table-cell break-all">
                         {q.phone_number || q.profiles?.phone || q.profiles?.email || 'N/A'}
                      </td>
                      <td className="px-4 md:px-8 py-4 md:py-6 text-right">
                        <div className="flex justify-end gap-2 md:gap-3 opacity-100 md:opacity-80 group-hover:opacity-100 transition-opacity">
                           <button
                             onClick={() => handleCallCustomer(q)}
                             className="bg-white border border-[#545b00]/10 text-[#545b00] hover:bg-[#e5f638] hover:text-[#545b00] font-bold text-xs uppercase tracking-widest px-3 py-2 rounded-xl transition-colors shadow-sm flex items-center justify-center gap-2"
                             title="Send WhatsApp reminder"
                           >
                             <Bell className="w-4 h-4" /> Reminder
                           </button>
                           {q.status === 'IN_CHAIR' || q.status === 'PAYMENT_PENDING' ? (
                             <button
                               onClick={() => handleOpenInPOS(q.id)}
                               className="bg-[#004be2] border border-[#004be2] text-white hover:bg-[#0038aa] font-bold text-xs uppercase tracking-widest px-3 py-2 rounded-xl transition-colors shadow-sm flex items-center justify-center gap-2"
                               title="Open in POS to complete payment"
                             >
                               <Calculator className="w-4 h-4" /> Open POS
                             </button>
                           ) : (
                             <button
                               onClick={() => handleCallToChair(q.id)}
                               className="bg-[#e5f638] border border-[#545b00]/10 text-[#545b00] hover:bg-[#d8ed20] font-bold text-xs uppercase tracking-widest px-3 py-2 rounded-xl transition-colors shadow-sm flex items-center justify-center gap-2"
                               title="Call customer to chair"
                             >
                               <Scissors className="w-4 h-4" /> Call to Chair
                             </button>
                           )}
                           <button 
                             onClick={() => handleMarkAbsent(q.id)}
                             className="bg-red-50 border border-red-200 text-red-600 hover:bg-red-500 hover:text-white font-bold text-xs uppercase tracking-widest px-3 py-2 rounded-xl transition-colors shadow-sm flex items-center justify-center"
                             title="Remove from active list"
                           >
                             <UserX className="w-5 h-5" /> Remove
                           </button>
                         </div>
                      </td>
                    </motion.tr>
                  ))}
                  {walkInQueue.length === 0 && (
                     <tr>
                        <td colSpan={4} className="px-8 py-20 text-center">
                           <div className="w-16 h-16 bg-surface-container mx-auto rounded-full flex items-center justify-center mb-4">
                              <span className="material-symbols-outlined text-on-surface-variant/50 text-3xl">local_cafe</span>
                           </div>
                           <p className="text-on-surface-variant font-bold">Queue is empty. Relax and grab a coffee.</p>
                        </td>
                     </tr>
                  )}
                </AnimatePresence>
              </tbody>
            </table>
          </div>
        </section>

        {/* Bookings Table */}
        <section className="hidden md:block bg-white rounded-[2rem] overflow-hidden shadow-sm border border-outline-variant/10">
          <div className="px-4 md:px-8 py-5 md:py-6 flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 bg-white border-b border-outline-variant/5">
            <h2 className="font-headline font-bold text-2xl text-on-surface">Bookings Schedule</h2>
            <span className="px-4 py-1.5 bg-[#c5d0ff] text-[#004be2] text-[10px] font-black uppercase tracking-widest rounded-full flex items-center gap-2 shadow-sm border border-[#004be2]/10">
               <span className="w-2 h-2 bg-[#004be2] rounded-full animate-pulse"></span> SCHEDULE
            </span>
          </div>
          
          <div className="md:hidden p-4 space-y-3">
            <AnimatePresence mode="popLayout">
              {bookingQueue.map((q, i) => renderQueueCard(q, i, true))}
            </AnimatePresence>
            {bookingQueue.length === 0 && (
              <div className="px-4 py-14 text-center rounded-3xl bg-surface-container-lowest border border-outline-variant/10">
                <div className="w-14 h-14 bg-surface-container mx-auto rounded-full flex items-center justify-center mb-4">
                  <span className="material-symbols-outlined text-on-surface-variant/50 text-3xl">event_available</span>
                </div>
                <p className="text-on-surface-variant font-bold">No upcoming bookings today.</p>
              </div>
            )}
          </div>

          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                 <tr className="text-on-surface-variant text-[9px] md:text-[10px] font-bold uppercase tracking-widest bg-surface/30 border-b border-outline-variant/5">
                   <th className="px-4 md:px-8 py-3 md:py-4">Status & Name</th>
                   <th className="px-4 md:px-8 py-3 md:py-4">Time Slot</th>
                   <th className="px-4 md:px-8 py-3 md:py-4 hidden sm:table-cell">Contact</th>
                   <th className="px-4 md:px-8 py-3 md:py-4 text-right">Admin Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant/5">
                <AnimatePresence mode="popLayout">
                  {bookingQueue.map((q, i) => (
                    <motion.tr 
                      layout
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 10, filter: 'blur(4px)' }}
                      transition={{ duration: 0.3 }}
                      key={q.id} 
                      className="group hover:bg-[#f8fcfd] transition-colors duration-200"
                    >
                      <td className="px-4 md:px-8 py-4 md:py-6">
                        <div className="flex items-center gap-3 md:gap-4">
                           <div className={`w-10 h-10 md:w-12 md:h-12 rounded-2xl flex flex-col items-center justify-center font-black bg-surface-container-low text-on-surface-variant border border-outline-variant/10`}>
                              {(q.customer_name || q.profiles?.name) ? (q.customer_name || q.profiles?.name).substring(0, 2).toUpperCase() : 'CU'}
                           </div>
                           <div>
                             <p className="font-bold text-on-surface text-base md:text-lg">{q.customer_name || q.profiles?.name || 'Customer'}</p>
                             <span className={`font-black text-[9px] md:text-[10px] uppercase tracking-widest mt-1 inline-block ${q.status === 'NOTIFIED' || q.status === 'CALLED' ? 'text-[#e5f638] bg-[#545b00] px-3 py-1 rounded-full animate-pulse' : q.status === 'HOLD' ? 'text-orange-700 bg-orange-100 px-3 py-1 rounded-full' : q.status === 'IN_CHAIR' ? 'text-white bg-[#004be2] px-3 py-1 rounded-full' : 'text-on-surface-variant'}`}>
                                {q.status === 'NOTIFIED' ? 'WhatsApp notified' : q.status === 'CALLED' ? 'Called to chair' : q.status === 'HOLD' ? 'On hold / skip for now' : q.status === 'IN_CHAIR' ? 'Now serving' : 'Awaiting Arrival'}
                             </span>
                           </div>
                        </div>
                      </td>
                      <td className="px-4 md:px-8 py-4 md:py-6">
                         <div className="bg-[#e5f638]/20 border border-[#545b00]/20 text-[#545b00] px-3 md:px-4 py-1.5 md:py-2 rounded-lg md:rounded-xl inline-flex items-center font-headline font-black text-sm md:text-base">
                            {q.booked_time}
                         </div>
                      </td>
                      <td className="px-4 md:px-8 py-4 md:py-6 font-body text-xs md:text-sm font-medium text-on-surface-variant hidden sm:table-cell break-all">
                         {q.phone_number || q.profiles?.phone || q.profiles?.email || 'N/A'}
                      </td>
                      <td className="px-4 md:px-8 py-4 md:py-6 text-right">
                        <div className="flex justify-end gap-2 md:gap-3 opacity-100 md:opacity-80 group-hover:opacity-100 transition-opacity">
                           <button
                             onClick={() => handleCallCustomer(q)}
                             className="bg-white border border-[#545b00]/10 text-[#545b00] hover:bg-[#e5f638] hover:text-[#545b00] font-bold text-xs uppercase tracking-widest px-3 py-2 rounded-xl transition-colors shadow-sm flex items-center justify-center gap-2"
                             title="Send WhatsApp reminder"
                           >
                             <Bell className="w-4 h-4" /> Reminder
                           </button>
                           {q.status === 'IN_CHAIR' || q.status === 'PAYMENT_PENDING' ? (
                             <button
                               onClick={() => handleOpenInPOS(q.id)}
                               className="bg-[#004be2] border border-[#004be2] text-white hover:bg-[#0038aa] font-bold text-xs uppercase tracking-widest px-3 py-2 rounded-xl transition-colors shadow-sm flex items-center justify-center gap-2"
                               title="Open in POS to complete payment"
                             >
                               <Calculator className="w-4 h-4" /> Open POS
                             </button>
                           ) : (
                             <button
                               onClick={() => handleCallToChair(q.id)}
                               className="bg-[#e5f638] border border-[#545b00]/10 text-[#545b00] hover:bg-[#d8ed20] font-bold text-xs uppercase tracking-widest px-3 py-2 rounded-xl transition-colors shadow-sm flex items-center justify-center gap-2"
                               title="Call booking customer to chair"
                             >
                               <Scissors className="w-4 h-4" /> Call to Chair
                             </button>
                           )}
                           <button 
                             onClick={() => handleMarkAbsent(q.id)}
                             className="bg-red-50 border border-red-200 text-red-600 hover:bg-red-500 hover:text-white font-bold text-xs uppercase tracking-widest px-3 py-2 rounded-xl transition-colors shadow-sm flex items-center justify-center"
                             title="Remove from active list"
                           >
                             <UserX className="w-5 h-5" /> Remove
                           </button>
                         </div>
                      </td>
                    </motion.tr>
                  ))}
                  
                  {bookingQueue.length === 0 && (
                     <tr>
                        <td colSpan={4} className="px-8 py-20 text-center">
                           <div className="w-16 h-16 bg-surface-container mx-auto rounded-full flex items-center justify-center mb-4">
                              <span className="material-symbols-outlined text-on-surface-variant/50 text-3xl">event_available</span>
                           </div>
                           <p className="text-on-surface-variant font-bold">No upcoming bookings today.</p>
                        </td>
                     </tr>
                  )}
                </AnimatePresence>
              </tbody>
            </table>
          </div>
        </section>
        </div>

        </>
        ) : activeTab === 'customers' ? (
        /* -- CRM / Analytics VIEW -- */
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
          
          <div className="mb-10">
            <h1 className="text-4xl md:text-5xl font-extrabold font-headline tracking-tighter text-on-surface mb-2">CRM Intelligence</h1>
            <p className="text-on-surface-variant font-bold text-lg">Monitor client retention, sales, and overall shop performance.</p>
          </div>

          {/* Metrics Bento Grid */}
          <section className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
            <div className="bg-[#004be2] text-white p-8 rounded-[2rem] flex flex-col items-start shadow-xl shadow-[#004be2]/20 relative overflow-hidden border border-[#c5d0ff]/20 hover:scale-[1.01] transition-transform">
               <span className="text-[10px] font-black uppercase tracking-widest text-[#c5d0ff] mb-2 z-10 w-full flex justify-between">Today's Transactions <Activity className="w-4 h-4"/></span>
               <div className="flex items-baseline gap-2 z-10 mt-auto">
                 <span className="font-headline text-6xl font-black tracking-tighter leading-none">RM {metrics.todaySales}</span>
                 <span className="font-headline text-lg font-bold text-[#c5d0ff]">RM</span>
               </div>
               <span className="material-symbols-outlined text-[8rem] text-[#c5d0ff]/10 absolute -bottom-6 -right-4 rotate-[-15deg] pointer-events-none" style={{ fontVariationSettings: "'FILL' 1" }}>monetization_on</span>
            </div>

            <div className="bg-[#e5f638] p-8 rounded-[2rem] flex flex-col items-start shadow-sm border border-[#545b00]/10 relative overflow-hidden hover:scale-[1.01] transition-transform">
               <span className="text-[10px] font-black uppercase tracking-widest text-[#545b00]/70 mb-2 z-10 w-full flex justify-between">Weekly Haircuts <Users className="w-4 h-4"/></span>
               <div className="flex items-baseline gap-2 z-10 mt-auto">
                 <span className="font-headline text-6xl font-black text-[#545b00] tracking-tighter leading-none">{metrics.weeklyCuts}</span>
                 <span className="font-headline text-lg font-bold text-[#545b00]/70">Cuts</span>
               </div>
               <span className="material-symbols-outlined text-[8rem] text-[#545b00]/5 absolute -bottom-6 -right-4 rotate-[-15deg] pointer-events-none" style={{ fontVariationSettings: "'FILL' 1" }}>calendar_view_week</span>
            </div>

            <div className="bg-red-50 p-8 rounded-[2rem] border border-red-100 shadow-sm flex flex-col items-start relative overflow-hidden hover:scale-[1.01] transition-transform">
               <span className="text-[10px] font-black uppercase tracking-widest text-red-700 mb-2 z-10 w-full flex justify-between">No-Show / Absent <UserX className="w-4 h-4"/></span>
               <div className="flex items-baseline gap-2 z-10 mt-auto">
                 <span className="font-headline text-6xl font-black text-red-600 tracking-tighter leading-none">{metrics.absences}</span>
                 <span className="font-headline text-lg font-bold text-red-400">Lost</span>
               </div>
               <span className="material-symbols-outlined text-[8rem] text-red-600/5 absolute -bottom-6 -right-4 rotate-[-15deg] pointer-events-none" style={{ fontVariationSettings: "'FILL' 1" }}>warning</span>
            </div>
          </section>

          {/* Master History Letger */}
          <section className="bg-white rounded-[2rem] overflow-hidden shadow-sm border border-outline-variant/10 mb-10">
            <div className="px-8 py-6 flex flex-col md:flex-row justify-between items-start md:items-center bg-white border-b border-outline-variant/5 gap-4">
               <div>
                 <h2 className="font-headline font-bold text-2xl text-on-surface">Digital CRM Ledger</h2>
                 <p className="text-sm font-medium text-on-surface-variant">The absolute source of truth for all visitor activity.</p>
               </div>
               <div className="relative w-full md:w-auto">
                 <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-outline-variant w-4 h-4" />
                 <input className="w-full md:w-auto bg-surface-container-lowest border border-outline-variant/10 rounded-full pl-12 pr-4 py-3 text-sm focus:border-[#004be2] focus:ring-4 focus:ring-[#004be2]/10 outline-none transition-all min-w-[280px] font-bold" placeholder="Search client ledger..." type="text"/>
               </div>
            </div>
            
            <div className="overflow-x-auto max-h-[500px]">
              <table className="w-full text-left border-collapse">
                <thead className="sticky top-0 z-10 bg-white/95 backdrop-blur-md shadow-sm">
                  <tr className="text-on-surface-variant text-[10px] font-black uppercase tracking-widest border-b border-outline-variant/10">
                     <th className="px-8 py-5">Date & Time</th>
                     <th className="px-8 py-5">Customer Card</th>
                     <th className="px-8 py-5">Assigned Service</th>
                     <th className="px-8 py-5 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-outline-variant/5">
                  {history.map(h => {
                     const d = new Date(h.created_at)
                     return (
                      <tr key={h.id} className="hover:bg-surface transition-colors">
                          <td className="px-8 py-5">
                             <p className="font-bold text-sm text-on-surface">{d.toLocaleDateString('en-US', {month:'short', day:'numeric', year:'numeric'})}</p>
                             <p className="text-xs text-on-surface-variant font-bold mt-0.5 opacity-70">{d.toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})}</p>
                          </td>
                          <td className="px-8 py-5">
                             <p className="font-black text-base text-[#004be2]">{h.profiles?.name || 'Walk-in'}</p>
                             <p className="text-[10px] text-on-surface-variant uppercase tracking-widest font-bold mt-0.5">{h.profiles?.email || 'No email stored'}</p>
                          </td>
                          <td className="px-8 py-5">
                             <span className="bg-surface-container-high px-3 py-1.5 rounded-md text-xs font-bold text-on-surface-variant border border-outline-variant/10 shadow-sm">Haircut</span>
                          </td>
                          <td className="px-8 py-5 text-center">
                             {h.status === 'COMPLETED' ? (
                                <span className="inline-flex items-center gap-1 text-[#10B981] bg-[#10B981]/10 px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest border border-[#10B981]/20">
                                   <Check className="w-3 h-3" /> Served & Paid
                                </span>
                             ) : h.status === 'ABSENT' ? (
                                <span className="inline-flex items-center gap-1 text-red-600 bg-red-100 px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest border border-red-200">
                                   <UserX className="w-3 h-3" /> Absent
                                </span>
                             ) : (
                                <span className="inline-flex items-center gap-1 text-on-surface-variant bg-surface-container-high px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest border border-outline-variant/10">
                                   <X className="w-3 h-3" /> Cancelled
                                </span>
                             )}
                          </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </section>

        </div>
        ) : activeTab === 'management' ? (
        /* -- SHOP MANAGEMENT VIEW -- */
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 max-w-5xl">
           <div className="mb-10">
             <h1 className="text-4xl md:text-5xl font-extrabold font-headline tracking-tighter text-on-surface mb-2">Advanced Shop Control</h1>
             <p className="text-on-surface-variant font-bold text-lg">Manage operations mode, schedule, and active personnel capacity instantly.</p>
           </div>
           
           <section className="space-y-6">
              
              {/* Box 1: Operations Mode */}
              <div className="bg-white rounded-[2rem] shadow-sm border border-outline-variant/10 p-8 md:p-10">
                 <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
                    <h3 className="font-headline font-black text-xl text-on-surface">Operations Mode</h3>
                    <button 
                       onClick={() => saveShopSettings(shopSettings)}
                       disabled={isSaving}
                       className={`px-6 py-2 rounded-full font-bold text-[10px] uppercase tracking-widest transition-all shadow-sm flex items-center gap-2 ${isSaving ? 'bg-green-100 text-green-700' : 'bg-slate-900 text-white hover:bg-slate-800 hover:scale-105 active:scale-95'}`}
                    >
                       {isSaving ? <><Check className="w-4 h-4"/> Syncing to Cloud...</> : 'Force Save Settings'}
                    </button>
                 </div>
                 <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    {[ 
                      { id: 'both', label: 'Both Open', sub: 'QUEUE & SLOTS ACTIVE' },
                      { id: 'slot', label: 'Slot Only', sub: 'NO WALK-IN QUEUE' },
                      { id: 'queue', label: 'Queue Only', sub: 'NO ADV. BOOKING' },
                      { id: 'closed', label: 'Closed', sub: 'NOT ACCEPTING ANY' }
                    ].map(mode => {
                       const isSelected = shopSettings.operationsMode === mode.id
                       return (
                          <div 
                             key={mode.id}
                             onClick={() => saveShopSettings({ ...shopSettings, operationsMode: mode.id })}
                             className={`p-6 rounded-2xl border-2 cursor-pointer transition-all ${isSelected ? 'border-[#004be2] bg-[#f0f4ff]' : 'border-outline-variant/10 bg-surface-container-lowest hover:border-outline-variant/30'}`}
                          >
                             <div className={`w-8 h-8 rounded-xl mb-4 flex items-center justify-center ${isSelected ? 'bg-[#e5f638] text-[#545b00]' : 'bg-surface-container border border-outline-variant/10'}`}>
                                {isSelected && <span className="material-symbols-outlined text-sm font-bold">check</span>}
                             </div>
                             <p className="font-black text-on-surface mb-1">{mode.label}</p>
                             <p className="text-[9px] uppercase tracking-widest font-bold text-on-surface-variant">{mode.sub}</p>
                          </div>
                       )
                    })}
                 </div>
              </div>

              {/* Box 2 & 3: Hours, Breaks & Barbers */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                 
                 {/* Hours & Breaks */}
                  <div className="bg-white rounded-[2rem] shadow-sm border border-outline-variant/10 p-8 md:p-10">
                     <h3 className="font-headline font-black text-xl mb-6 text-on-surface">Schedule & Breaks</h3>
                     
                     <div className="grid grid-cols-2 gap-4 mb-6">
                        <div>
                          <label className="text-[10px] uppercase tracking-widest font-bold text-on-surface-variant mb-2 block">Open Time</label>
                         <input 
                           type="time" 
                           value={shopSettings.openTime} 
                           onChange={(e) => saveShopSettings({ ...shopSettings, openTime: e.target.value })}
                           className="w-full bg-surface border border-outline-variant/10 rounded-xl px-4 py-3 font-bold text-sm focus:border-[#004be2] outline-none transition-colors" 
                         />
                       </div>
                       <div>
                         <label className="text-[10px] uppercase tracking-widest font-bold text-on-surface-variant mb-2 block">Close Time</label>
                         <input 
                           type="time" 
                           value={shopSettings.closeTime} 
                           onChange={(e) => saveShopSettings({ ...shopSettings, closeTime: e.target.value })}
                           className="w-full bg-surface border border-outline-variant/10 rounded-xl px-4 py-3 font-bold text-sm focus:border-[#004be2] outline-none transition-colors" 
                         />
                        </div>
                     </div>

                     <div className="bg-surface-container-lowest p-5 rounded-2xl border border-outline-variant/10 mb-6">
                       <div className="flex items-center justify-between gap-3 mb-4">
                         <label className="text-[10px] uppercase tracking-widest font-black text-on-surface-variant block">Daily Operation Hours</label>
                         <span className="text-[9px] font-black uppercase tracking-widest text-[#004be2] bg-[#c5d0ff]/60 px-3 py-1 rounded-full">Customer visible</span>
                       </div>
                       <div className="space-y-3">
                         {WEEK_DAYS.map(day => {
                           const dailyHours = shopSettings.dailyHours || DEFAULT_DAILY_HOURS
                           const dayHours = dailyHours[day.key] || DEFAULT_DAILY_HOURS[day.key]
                           const updateDay = (patch: Partial<typeof dayHours>) => saveShopSettings({
                             ...shopSettings,
                             dailyHours: {
                               ...DEFAULT_DAILY_HOURS,
                               ...dailyHours,
                               [day.key]: { ...dayHours, ...patch }
                             }
                           })
                           return (
                             <div key={day.key} className="grid grid-cols-[1fr_auto_auto] gap-2 items-center">
                               <button
                                 type="button"
                                 onClick={() => updateDay({ open: !dayHours.open })}
                                 className={`text-left rounded-xl px-3 py-2 border font-black text-xs uppercase tracking-widest ${dayHours.open ? 'bg-[#e5f638]/25 text-[#545b00] border-[#545b00]/10' : 'bg-red-50 text-red-600 border-red-100'}`}
                               >
                                 {day.label}
                                 <span className="block text-[9px] opacity-70 mt-0.5">{dayHours.open ? 'Open' : 'Closed'}</span>
                               </button>
                               <input
                                 type="time"
                                 disabled={!dayHours.open}
                                 value={dayHours.openTime}
                                 onChange={(e) => updateDay({ openTime: e.target.value })}
                                 className="w-24 bg-white border border-outline-variant/10 rounded-xl px-2 py-2 font-bold text-xs disabled:opacity-40"
                               />
                               <input
                                 type="time"
                                 disabled={!dayHours.open}
                                 value={dayHours.closeTime}
                                 onChange={(e) => updateDay({ closeTime: e.target.value })}
                                 className="w-24 bg-white border border-outline-variant/10 rounded-xl px-2 py-2 font-bold text-xs disabled:opacity-40"
                               />
                             </div>
                           )
                         })}
                       </div>
                     </div>

                     <div className="bg-orange-50/50 p-6 rounded-2xl border border-orange-100">
                       <label className="text-[10px] uppercase tracking-widest font-bold text-orange-800 mb-4 block">Shop-wide Daily Break</label>
                       <div className="grid grid-cols-2 gap-4">
                          <div>
                            <input 
                              type="time" 
                              value={shopSettings.breakStart} 
                              onChange={(e) => saveShopSettings({ ...shopSettings, breakStart: e.target.value })}
                              className="w-full bg-white border border-orange-200 rounded-xl px-4 py-3 font-bold text-sm text-orange-900 focus:border-orange-400 outline-none transition-colors" 
                            />
                          </div>
                          <div>
                            <input 
                              type="time" 
                              value={shopSettings.breakEnd} 
                              onChange={(e) => saveShopSettings({ ...shopSettings, breakEnd: e.target.value })}
                              className="w-full bg-white border border-orange-200 rounded-xl px-4 py-3 font-bold text-sm text-orange-900 focus:border-orange-400 outline-none transition-colors" 
                            />
                         </div>
                       </div>
                    </div>

                    <div className="bg-[#f0f4ff] p-6 rounded-2xl border border-[#004be2]/10 mt-6">
                       <label className="text-[10px] uppercase tracking-widest font-bold text-[#004be2] mb-4 block">Walk-in Capacity Rules</label>
                       <div className="grid grid-cols-2 gap-4">
                          <div>
                            <span className="text-[9px] uppercase tracking-widest font-bold text-[#004be2]/70 mb-2 block">Avg Cut Minutes</span>
                            <input
                              type="number"
                              min="10"
                              step="5"
                              value={shopSettings.averageServiceMinutes || 30}
                              onChange={(e) => saveShopSettings({ ...shopSettings, averageServiceMinutes: Math.max(10, Number(e.target.value) || 30) })}
                              className="w-full bg-white border border-[#004be2]/20 rounded-xl px-4 py-3 font-bold text-sm text-[#004be2] focus:border-[#004be2] outline-none transition-colors"
                            />
                          </div>
                          <div>
                            <span className="text-[9px] uppercase tracking-widest font-bold text-[#004be2]/70 mb-2 block">Max Wait Minutes</span>
                            <input
                              type="number"
                              min="30"
                              step="15"
                              value={shopSettings.maxWalkInWaitMinutes || 120}
                              onChange={(e) => saveShopSettings({ ...shopSettings, maxWalkInWaitMinutes: Math.max(30, Number(e.target.value) || 120) })}
                              className="w-full bg-white border border-[#004be2]/20 rounded-xl px-4 py-3 font-bold text-sm text-[#004be2] focus:border-[#004be2] outline-none transition-colors"
                            />
                          </div>
                       </div>
                       <p className="text-[10px] font-bold text-[#004be2]/70 uppercase tracking-widest mt-4">
                         Current cap: {Math.max(1, Math.floor(((shopSettings.maxWalkInWaitMinutes || 120) * shopSettings.barbers.filter(b => b.active && (b.role === 'both' || b.role === 'queue')).length) / (shopSettings.averageServiceMinutes || 30)))} walk-ins before slots are recommended.
                       </p>
                    </div>

                    <div className="bg-white p-6 rounded-2xl border border-outline-variant/10 mt-6">
                       <label className="text-[10px] uppercase tracking-widest font-bold text-on-surface-variant mb-3 block">WhatsApp Queue Message Template</label>
                       <textarea
                         value={shopSettings.whatsappQueueMessage || DEFAULT_QUEUE_MESSAGE}
                         onChange={(e) => saveShopSettings({ ...shopSettings, whatsappQueueMessage: e.target.value })}
                         rows={7}
                         className="w-full bg-surface border border-outline-variant/10 rounded-2xl px-4 py-3 font-bold text-sm text-on-surface focus:border-[#004be2] outline-none transition-colors resize-y"
                       />
                       <p className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest mt-3 leading-relaxed">
                         Variables: {'{{customer_name}}'}, {'{{queue_number}}'}, {'{{estimated_wait}}'}, {'{{estimated_time}}'}, {'{{shop_name}}'}
                       </p>
                    </div>
                 </div>

                 {/* Barber Management */}
                 <div className="bg-white rounded-[2rem] shadow-sm border border-outline-variant/10 p-8 md:p-10 flex flex-col items-stretch">
                    <h3 className="font-headline font-black text-xl mb-2 text-on-surface flex justify-between items-center">
                       Personnel Force
                       <span className="text-xs font-bold bg-[#c5d0ff] text-[#004be2] px-3 py-1 rounded-full">{shopSettings.barbers.filter(b=>b.active).length} Active Today</span>
                    </h3>
                    <p className="text-[10px] uppercase tracking-widest font-bold text-on-surface-variant mb-6">Hold to delete • Tap to customize role</p>

                    <div className="flex-1 space-y-3 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                       <AnimatePresence>
                       {shopSettings.barbers.map(barber => (
                          <motion.div 
                             key={barber.id}
                             initial={{ opacity: 0, scale: 0.95 }}
                             animate={{ opacity: 1, scale: 1 }}
                             exit={{ opacity: 0, scale: 0.9, height: 0, overflow: 'hidden' }}
                             className={`p-4 rounded-2xl border flex items-center justify-between select-none ${barber.active ? 'bg-surface-container-lowest border-outline-variant/20 shadow-sm' : 'bg-surface border-transparent opacity-60 grayscale'}`}
                             onTouchStart={() => handleBarberTouchStart(barber.id)}
                             onTouchEnd={handleBarberTouchEnd}
                             onMouseDown={() => handleBarberTouchStart(barber.id)} // Desktop fallback
                             onMouseUp={handleBarberTouchEnd}
                             onMouseLeave={handleBarberTouchEnd}
                          >
                             <div className="flex items-center gap-3 w-[45%]">
                                <button
                                  onClick={(e) => { e.stopPropagation(); toggleBarberStatus(barber.id, 'active') }}
                                  className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 transition-colors ${barber.active ? 'bg-[#10B981]/10 text-[#10B981]' : 'bg-surface-container text-outline-variant'}`}
                                >
                                   <span className="material-symbols-outlined text-lg">{barber.active ? 'person' : 'person_off'}</span>
                                </button>
                                <p className="font-black truncate block">{barber.name}</p>
                             </div>

                             <button 
                                onClick={(e) => { e.stopPropagation(); toggleBarberStatus(barber.id, 'role') }}
                                className={`text-[9px] sm:text-[10px] font-bold uppercase tracking-widest px-2 sm:px-3 py-2 rounded-lg border flex items-center gap-1.5 transition-colors whitespace-nowrap
                                  ${barber.role === 'both' ? 'bg-[#e5f638]/20 border-[#545b00]/20 text-[#545b00]' 
                                  : barber.role === 'queue' ? 'bg-orange-50 border-orange-200 text-orange-600'
                                  : barber.role === 'booking' ? 'bg-[#c5d0ff]/50 border-[#004be2]/20 text-[#004be2]'
                                  : 'bg-red-50 border-red-200 text-red-600'}`}
                             >
                                <span className={`hidden sm:block w-1.5 h-1.5 rounded-full ${barber.role==='both'?'bg-[#545b00]':barber.role==='queue'?'bg-orange-600':barber.role==='booking'?'bg-[#004be2]':'bg-red-600'}`}></span>
                                {barber.role === 'both' ? 'Walk-in & Book' : barber.role === 'queue' ? 'Walk-ins Only' : barber.role === 'booking' ? 'Booking Only' : 'Absent'}
                             </button>
                             
                             {/* Desktop explicit delete */}
                             <button
                               onClick={(e) => { e.stopPropagation(); handleDeleteBarber(barber.id) }}
                               className="hidden md:flex ml-2 w-8 h-8 rounded hover:bg-red-50 text-outline-variant hover:text-red-500 items-center justify-center transition-colors shadow-sm bg-white border border-outline-variant/10"
                               title="Delete Barber"
                             >
                                <span className="material-symbols-outlined text-sm">delete</span>
                             </button>
                          </motion.div>
                       ))}
                       </AnimatePresence>
                    </div>

                    <div className="mt-4 flex gap-2 pt-4 border-t border-outline-variant/10">
                       <input 
                         type="text" 
                         placeholder="New Barber Name..." 
                         value={newBarberName}
                         onChange={e => setNewBarberName(e.target.value)}
                         onKeyDown={e => e.key === 'Enter' && handleAddBarber()}
                         className="flex-1 bg-surface border border-outline-variant/10 rounded-xl px-4 py-3 font-bold text-sm focus:border-[#004be2] outline-none transition-colors" 
                       />
                       <button 
                         onClick={handleAddBarber}
                         className="bg-slate-900 text-white rounded-xl px-4 flex items-center justify-center hover:opacity-90 shadow-sm"
                       >
                         <span className="material-symbols-outlined">add</span>
                       </button>
                    </div>

                 </div>
              </div>
           </section>
        </div>
        ) : activeTab === 'pricing' ? (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 max-w-6xl">
          <section className="bg-white rounded-[2rem] border border-outline-variant/10 shadow-sm p-8 md:p-10">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
              <div>
                <h1 className="text-4xl md:text-5xl font-black font-headline tracking-tighter text-on-surface mb-2">Pricing & Services</h1>
                <p className="text-on-surface-variant font-bold text-lg">Current counter prices used by POS.</p>
              </div>
              <span className="px-4 py-2 rounded-full bg-indigo-100 text-indigo-700 text-xs font-black uppercase tracking-widest flex items-center gap-2 w-max">
                <Tags className="w-4 h-4" /> POS Catalog
              </span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {[
                ['Student', 'RM 15', 'Barber cut RM 10'],
                ['Staff / Outsider', 'RM 18', 'Barber cut RM 10'],
                ['Palapes', 'RM 10', 'Barber cut RM 8'],
                ['OKU / Warga Emas', 'RM 10', 'Barber cut RM 8'],
                ['Highschool', 'RM 12', 'Barber cut RM 8'],
                ['Add-ons', 'RM 3 - RM 30', '50% barber cut']
              ].map(item => (
                <div key={item[0]} className="rounded-2xl bg-surface-container-lowest border border-outline-variant/10 p-5">
                  <p className="font-black text-lg text-on-surface">{item[0]}</p>
                  <p className="font-headline font-black text-3xl text-[#004be2] mt-3">{item[1]}</p>
                  <p className="text-xs font-bold uppercase tracking-widest text-on-surface-variant mt-3">{item[2]}</p>
                </div>
              ))}
            </div>
            <p className="mt-6 text-sm font-bold text-on-surface-variant">
              Full editable pricing can be wired to Supabase pricing_config next; this panel prevents the owner menu from opening a blank screen.
            </p>
          </section>
        </div>
        ) : activeTab === 'payroll' ? (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 max-w-6xl">
          <section className="bg-white rounded-[2rem] border border-outline-variant/10 shadow-sm p-8 md:p-10">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
              <div>
                <h1 className="text-4xl md:text-5xl font-black font-headline tracking-tighter text-on-surface mb-2">Payroll & Commission</h1>
                <p className="text-on-surface-variant font-bold text-lg">Commission summary from completed POS transactions.</p>
              </div>
              <span className="px-4 py-2 rounded-full bg-purple-100 text-purple-700 text-xs font-black uppercase tracking-widest flex items-center gap-2 w-max">
                <Banknote className="w-4 h-4" /> Owner View
              </span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
              <div className="rounded-2xl bg-[#e5f638]/30 border border-[#545b00]/10 p-5">
                <p className="text-[10px] font-black uppercase tracking-widest text-[#545b00]/70">Today Sales</p>
                <p className="font-headline font-black text-4xl text-[#545b00] mt-2">RM {metrics.todaySales}</p>
              </div>
              <div className="rounded-2xl bg-[#c5d0ff]/40 border border-[#004be2]/10 p-5">
                <p className="text-[10px] font-black uppercase tracking-widest text-[#004be2]/70">Today Cuts</p>
                <p className="font-headline font-black text-4xl text-[#004be2] mt-2">{metrics.todayCuts}</p>
              </div>
              <div className="rounded-2xl bg-surface-container-lowest border border-outline-variant/10 p-5">
                <p className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant">Weekly Cuts</p>
                <p className="font-headline font-black text-4xl text-on-surface mt-2">{metrics.weeklyCuts}</p>
              </div>
            </div>
            <div className="rounded-2xl border border-dashed border-outline-variant/20 p-8 text-center">
              <p className="font-black text-on-surface">Payroll ledger is ready for the next data step.</p>
              <p className="text-sm font-bold text-on-surface-variant mt-2">Once Supabase transactions are connected, this page should list barber commission rows and payout status.</p>
            </div>
          </section>
        </div>
        ) : null}

         {activeTab === 'users' && profile?.role === 'owner' && (
         <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 max-w-6xl">
            <section className="bg-gradient-to-r from-green-100 to-green-50 p-8 md:p-10 rounded-[2rem] relative overflow-hidden flex flex-col md:flex-row justify-between items-start md:items-center border border-green-200/50 shadow-sm mb-10 gap-6">
               <div className="relative z-10 w-full md:w-auto">
                  <h1 className="text-4xl md:text-5xl font-black font-headline tracking-tighter text-green-900 mb-2 leading-tight">Access Control</h1>
                  <p className="text-green-700 font-bold text-lg">Manage administrator privileges and registered users.</p>
               </div>
            </section>

            <section className="bg-white rounded-[2rem] overflow-hidden shadow-sm border border-outline-variant/10">
               <div className="px-8 py-6 flex flex-col md:flex-row justify-between items-start md:items-center bg-white border-b border-outline-variant/5 gap-4">
                 <div>
                    <h2 className="font-headline font-black text-2xl text-on-surface">Registered Users</h2>
                 </div>
               </div>
               
               <div className="overflow-x-auto max-h-[600px]">
                  <table className="w-full text-left border-collapse">
                     <thead className="sticky top-0 z-10 bg-white/95 backdrop-blur-md shadow-sm">
                        <tr className="text-on-surface-variant text-[10px] font-black uppercase tracking-widest border-b border-outline-variant/10">
                           <th className="px-8 py-5">Full Name</th>
                           <th className="px-8 py-5">Email Address</th>
                           <th className="px-8 py-5 text-center">System Role</th>
                           <th className="px-8 py-5 text-right">Actions</th>
                        </tr>
                     </thead>
                     <tbody className="divide-y divide-outline-variant/5">
                        {usersList.length === 0 ? (
                           <tr><td colSpan={4} className="py-10 text-center text-on-surface-variant font-medium">Loading user profiles... If empty, make sure you ran the SQL setup script!</td></tr>
                        ) : usersList.map((u) => (
                           <tr key={u.id} className="hover:bg-surface transition-colors group">
                              <td className="px-8 py-5">
                                 <p className="font-headline font-black text-lg text-on-surface">{u.name || 'Unnamed'}</p>
                                 <p className="font-body text-[10px] uppercase font-bold text-on-surface-variant/70 mt-0.5 tracking-widest">ID: {u.id.substring(0, 8)}</p>
                              </td>
                              <td className="px-8 py-5">
                                 <p className="font-body text-sm font-medium text-on-surface-variant">{u.email}</p>
                              </td>
                              <td className="px-8 py-5 text-center">
                                 <span className={`inline-block px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest shadow-sm border ${u.role === 'admin' ? 'bg-[#c5d0ff]/50 border-[#004be2]/20 text-[#004be2]' : 'bg-surface-container border-outline-variant/10 text-on-surface-variant'}`}>
                                    {u.role === 'admin' ? 'Administrator' : 'General User'}
                                 </span>
                              </td>
                              <td className="px-8 py-5 text-right">
                                 <button 
                                    onClick={() => toggleUserRole(u.id, u.role)}
                                    className={`px-4 py-2 rounded-xl font-bold text-xs uppercase tracking-widest transition-colors shadow-sm ${u.role === 'admin' ? 'text-red-600 bg-red-50 hover:bg-red-500 hover:text-white border border-red-100' : 'text-green-700 bg-green-50 hover:bg-green-500 hover:text-white border border-green-200'}`}
                                 >
                                    {u.role === 'admin' ? 'Revoke Admin' : 'Grant Admin'}
                                 </button>
                              </td>
                           </tr>
                        ))}
                     </tbody>
                  </table>
               </div>
            </section>
         </div>
         )}

        {showWalkInModal && (
           <div className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
              <div className="bg-white rounded-[2rem] p-8 max-w-md w-full shadow-2xl animate-in fade-in zoom-in duration-200">
                 <h3 className="font-headline font-black text-2xl mb-2 text-[#004be2]">Add Walk-in Customer</h3>
                 <p className="text-sm font-medium text-on-surface-variant mb-6">Create a queue entry for a customer without a smartphone account.</p>
                 
                 <form onSubmit={handleAddWalkIn} className="space-y-4">
                    <div>
                       <label className="text-xs font-bold text-on-surface-variant uppercase tracking-widest mb-2 block">Customer Name</label>
                       <input name="name" type="text" placeholder="e.g. John Doe" required className="w-full bg-surface border border-outline-variant/20 rounded-xl px-4 py-3 font-bold text-sm outline-none focus:border-[#004be2]" />
                    </div>
                    <div>
                       <label className="text-xs font-bold text-on-surface-variant uppercase tracking-widest mb-2 block">Phone Number (Optional)</label>
                       <input name="phone" type="tel" placeholder="e.g. 0123456789" className="w-full bg-surface border border-outline-variant/20 rounded-xl px-4 py-3 font-bold text-sm outline-none focus:border-[#004be2]" />
                    </div>
                    <div>
                       <label className="text-xs font-bold text-on-surface-variant uppercase tracking-widest mb-2 block">Haircut Style</label>
                       <select name="service" className="w-full bg-surface border border-outline-variant/20 rounded-xl px-4 py-3 font-bold text-sm outline-none focus:border-[#004be2]">
                          <option value="Tape Fade">Tape Fade</option>
                          <option value="Undercut">Undercut</option>
                          <option value="Low Fade">Low Fade</option>
                          <option value="Mid Fade">Mid Fade</option>
                          <option value="High Fade">High Fade</option>
                          <option value="Burst Fade">Burst Fade</option>
                          <option value="Other">Other</option>
                       </select>
                    </div>
                    <div>
                       <label className="text-xs font-bold text-on-surface-variant uppercase tracking-widest mb-2 block">Remarks (Optional)</label>
                       <input name="remark" type="text" placeholder="Any specific requests?" className="w-full bg-surface border border-outline-variant/20 rounded-xl px-4 py-3 font-bold text-sm outline-none focus:border-[#004be2]" />
                    </div>
                    
                    <div className="flex gap-4 pt-4">
                       <button type="button" onClick={() => setShowWalkInModal(false)} className="flex-1 py-3 font-bold text-sm bg-surface-container rounded-xl hover:bg-surface-container-high transition-colors text-on-surface cursor-pointer">Cancel</button>
                       <button type="submit" className="flex-1 py-3 font-bold text-sm bg-[#e5f638] text-[#545b00] rounded-xl hover:scale-105 transition-transform shadow-sm cursor-pointer">Add to Queue</button>
                    </div>
                 </form>
              </div>
           </div>
        )}

      </main>
    </div>
  )
}
