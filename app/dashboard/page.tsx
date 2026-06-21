'use client'

import { useEffect, useState } from 'react'
import { createClient as supabase } from '@/utils/supabase/client'
import { motion, AnimatePresence } from 'framer-motion'
import { LogOut, History, User, Clock, ArrowRight, ShieldCheck, Ticket, Users, UsersRound } from 'lucide-react'
import { MarketingSections, SiteFooter } from '@/components/LandingUI'

// Types
type UserProfile = { id: string, name: string, email: string, role: string, phone?: string, referral_code?: string }
type QueueEntry = { id: string, queue_number: number, status: string, created_at: string }
const WEEK_DAYS = [
  { key: 'sunday', label: 'Sunday' },
  { key: 'monday', label: 'Monday' },
  { key: 'tuesday', label: 'Tuesday' },
  { key: 'wednesday', label: 'Wednesday' },
  { key: 'thursday', label: 'Thursday' },
  { key: 'friday', label: 'Friday' },
  { key: 'saturday', label: 'Saturday' }
]

const DEFAULT_DAILY_HOURS = {
  monday: { open: true, openTime: '17:00', closeTime: '22:00' },
  tuesday: { open: true, openTime: '17:00', closeTime: '22:00' },
  wednesday: { open: true, openTime: '17:00', closeTime: '22:00' },
  thursday: { open: true, openTime: '17:00', closeTime: '22:00' },
  friday: { open: true, openTime: '17:00', closeTime: '22:00' },
  saturday: { open: true, openTime: '17:00', closeTime: '22:00' },
  sunday: { open: false, openTime: '17:00', closeTime: '22:00' }
} as Record<string, { open: boolean; openTime: string; closeTime: string }>

const parseTimeToMinutes = (timeStr: string) => {
  const [h, m] = timeStr.split(':').map(Number)
  return (h || 0) * 60 + (m || 0)
}

export default function UserDashboard() {
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)

  // System State
  const [currentServing, setCurrentServing] = useState(0)
  const [activeQueue, setActiveQueue] = useState<any[]>([]) 
  const [queueMode, setQueueMode] = useState<'walk-in' | 'booking'>('walk-in')
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null)
  const [serviceType, setServiceType] = useState<string>('Tape Fade')
  const [remark, setRemark] = useState<string>('')
  
  // Shop Settings Logic
  const [shopSettings, setShopSettings] = useState({
    operationsMode: 'both',
    openTime: '17:00',
    closeTime: '22:00',
    breakStart: '19:15',
    breakEnd: '20:00',
    dailyHours: DEFAULT_DAILY_HOURS,
    averageServiceMinutes: 30,
    maxWalkInWaitMinutes: 120,
    barbers: [{ id: '1', name: 'Julian', active: true, role: 'both' }]
  })

  // My active ticket
  const [myTicket, setMyTicket] = useState<any | null>(null)
  
  // History & Referrals
  const [myHistory, setMyHistory] = useState<any[]>([])
  const [referralCount, setReferralCount] = useState(0)
  const [activeTab, setActiveTab] = useState<'queue' | 'history' | 'profile' | 'referrals'>('queue')

  const activeWalkInBarbers = Math.max(1, shopSettings.barbers.filter(b => b.active && (b.role === 'both' || b.role === 'queue')).length);
  const activeBookingBarbers = Math.max(1, shopSettings.barbers.filter(b => b.active && (b.role === 'both' || b.role === 'booking')).length);
  const averageServiceMinutes = shopSettings.averageServiceMinutes || 30;
  const maxWalkInWaitMinutes = shopSettings.maxWalkInWaitMinutes || 120;
  const walkInWaitingCount = activeQueue.filter((q: any) => !q.booked_time && ['WAITING', 'NOTIFIED', 'CALLED'].includes(q.status)).length;
  const estimatedWalkInWaitMins = Math.ceil((walkInWaitingCount * averageServiceMinutes) / activeWalkInBarbers);
  const nextWalkInWaitMins = Math.ceil(((walkInWaitingCount + 1) * averageServiceMinutes) / activeWalkInBarbers);
  const maxWalkInCustomers = Math.max(1, Math.floor((maxWalkInWaitMinutes * activeWalkInBarbers) / averageServiceMinutes));
  const isWalkInAtCapacity = nextWalkInWaitMins > maxWalkInWaitMinutes;
  const todayInfo = WEEK_DAYS[new Date().getDay()];
  const todayHours = (shopSettings as any).dailyHours?.[todayInfo.key] || { open: true, openTime: shopSettings.openTime, closeTime: shopSettings.closeTime };
  const now = new Date();
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  const todayOpenMinutes = parseTimeToMinutes(todayHours.openTime);
  const todayCloseMinutes = parseTimeToMinutes(todayHours.closeTime);
  const isWithinOperationHours = Boolean(todayHours.open && nowMinutes >= todayOpenMinutes && nowMinutes < todayCloseMinutes);
  const canJoinWalkIn = shopSettings.operationsMode !== 'closed' && shopSettings.operationsMode !== 'slot' && isWithinOperationHours;
  const canBookSlot = shopSettings.operationsMode !== 'closed' && shopSettings.operationsMode !== 'queue';
  const operationStatus = shopSettings.operationsMode === 'closed' || !todayHours.open ? 'Closed today' : isWithinOperationHours ? 'Open now' : nowMinutes < todayOpenMinutes ? 'Not open yet' : 'Closed for today';

  useEffect(() => {
    fetchSessionAndData()

    let channel: any
    if (process.env.NEXT_PUBLIC_SUPABASE_URL && !process.env.NEXT_PUBLIC_SUPABASE_URL.includes('placeholder')) {
        channel = supabase()
          .channel('dashboard-events')
          .on('postgres_changes', { event: '*', schema: 'public', table: 'queue_entries' }, () => fetchInitialData())
          .on('postgres_changes', { event: '*', schema: 'public', table: 'settings' }, () => fetchInitialData())
          .subscribe()
    }

    return () => { if (channel) supabase().removeChannel(channel) }
  }, [])

  const fetchSessionAndData = async () => {
      const savedSettings = localStorage.getItem('lot5_shop_settings')
      if (savedSettings) setShopSettings(JSON.parse(savedSettings))

      // Offline/Mock Support Check
      if (!process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL.includes('placeholder')) {
         const mockRole = localStorage.getItem('mock_role') || 'user'
         setProfile({ id: 'mock-123', name: 'John Demo', email: 'user@lot5.com', role: mockRole, referral_code: 'L5DEMO' })
         setReferralCount(2)
         setActiveQueue([{ id: 'q1', queue_number: 14, status: 'WAITING' }, { id: 'q2', queue_number: 15, status: 'WAITING' }])
         setCurrentServing(12)
         
         const activeId = localStorage.getItem('lot5_mock_queue')
         const bookedSlot = localStorage.getItem('lot5_mock_booked_time')
         if (activeId) setMyTicket({ id: activeId, queue_number: 16, status: 'WAITING', created_at: new Date().toISOString(), booked_time: bookedSlot })
         
         const hist = localStorage.getItem('lot5_mock_history')
         if (hist) setMyHistory(JSON.parse(hist))

         setLoading(false)
         return
      }

      const { data: { session }, error } = await supabase().auth.getSession()
      if (error || !session) {
          window.location.href = '/login'
          return
      }
      
      const { data: profileData } = await supabase().from('profiles').select('*').eq('id', session.user.id).single()
      if (profileData) setProfile(profileData)

      await fetchInitialData(session.user.id)
      setLoading(false)
  }

  const fetchInitialData = async (userIdStr?: string) => {
      const uid = userIdStr || profile?.id
      if (!uid || uid === 'mock-123') return

      // Global Shop Settings
      const { data: sData } = await supabase().from('settings').select('raw_settings').eq('id', 1).single()
      let currentSettings = shopSettings
      if (sData?.raw_settings) {
         currentSettings = sData.raw_settings as any
         setShopSettings(currentSettings)
         if (currentSettings.operationsMode === 'slot') setQueueMode('booking')
         if (currentSettings.operationsMode === 'queue') setQueueMode('walk-in')
      }

      // Active Queue list (Used for capacity limits & queue positioning)
      const { data: qList } = await supabase()
         .from('queue_entries')
         .select('id, queue_number, status, booked_time, entry_type')
         .in('status', ['WAITING', 'NOTIFIED', 'CALLED', 'IN_CHAIR', 'HOLD', 'PAYMENT_PENDING'])
         .order('queue_number', { ascending: true })
      
      if (qList) setActiveQueue(qList)

      // My specific ticket
      const { data: myQ } = await supabase()
         .from('queue_entries')
         .select('*')
         .eq('user_id', uid)
         .in('status', ['WAITING', 'NOTIFIED', 'CALLED', 'IN_CHAIR', 'HOLD', 'PAYMENT_PENDING'])
         .order('joined_at', { ascending: false })
         .limit(1)
         .single()
      
      if (myQ) setMyTicket(myQ)
      else setMyTicket(null)

      // History
      const { data: hist } = await supabase()
         .from('queue_entries')
         .select('*')
         .eq('user_id', uid)
         .in('status', ['COMPLETED', 'CANCELLED', 'ABSENT'])
         .order('joined_at', { ascending: false })
         .limit(10)
      if (hist) setMyHistory(hist)

      // Referrals
      const { count } = await supabase()
         .from('profiles')
         .select('*', { count: 'exact', head: true })
         .eq('referred_by', uid)
      if (count !== null) setReferralCount(count)
  }

  const handleJoinQueue = async () => {
     if (!canJoinWalkIn) {
         alert(`Walk-in queue is not open right now. Today's hours: ${todayHours.open ? `${todayHours.openTime} - ${todayHours.closeTime}` : 'Closed'}. Please book a slot if available.`)
         return
     }
     if (isWalkInAtCapacity) {
         setQueueMode('booking')
         alert(`Walk-in wait is above ${maxWalkInWaitMinutes} minutes. Please book a slot for a more accurate time.`)
         return
     }

     if (profile?.id === 'mock-123') {
         const mockId = 'mq-' + Math.random().toString(36)
         localStorage.setItem('lot5_mock_queue', mockId)
         setMyTicket({ id: mockId, queue_number: 16, status: 'WAITING', created_at: new Date().toISOString() })
         return
     }

     const finalName = remark ? `${profile?.name} - ${serviceType} (${remark})` : `${profile?.name} - ${serviceType}`

     let data: any = null
     let error: any = null
     const rpcResult = await supabase().rpc('join_walk_in_queue', {
         p_customer_name: finalName,
         p_phone_number: profile?.phone || null,
         p_user_id: profile?.id,
         p_service_type: serviceType,
         p_remark: remark || null
     })

     if (!rpcResult.error) {
         data = Array.isArray(rpcResult.data) ? rpcResult.data[0] : rpcResult.data
     } else {
         const today = new Date()
         today.setHours(0, 0, 0, 0)
         const { data: qnData } = await supabase()
             .from('queue_entries')
             .select('queue_number')
             .gte('joined_at', today.toISOString())
             .eq('entry_type', 'walk_in')
             .order('queue_number', { ascending: false })
             .limit(1)
         const nextTicketNumber = qnData?.[0]?.queue_number ? qnData[0].queue_number + 1 : 1
         const insertResult = await supabase().from('queue_entries').insert([{
             user_id: profile?.id,
             customer_name: finalName,
             phone_number: profile?.phone,
             queue_number: nextTicketNumber,
             status: 'WAITING',
             entry_type: 'walk_in',
             service_type: serviceType
         }]).select().single()
         data = insertResult.data
         error = insertResult.error
     }

     if (error) {
         alert("Failed to join queue: " + error.message)
         console.error(error)
     }
     if (!error && data) {
         setMyTicket(data)
         fetchInitialData() // refresh activeQueue
     }
  }

  const handleCancelQueue = async () => {
     if (profile?.id === 'mock-123') {
         localStorage.removeItem('lot5_mock_queue')
         localStorage.removeItem('lot5_mock_booked_time')
         const newHist = [{ ...myTicket!, status: 'CANCELLED', created_at: new Date().toISOString() }, ...myHistory]
         setMyHistory(newHist)
         localStorage.setItem('lot5_mock_history', JSON.stringify(newHist))
         setMyTicket(null)
         return
     }

     if (!myTicket) return
     await supabase().from('queue_entries').update({ status: 'CANCELLED' }).eq('id', myTicket.id)
     setMyTicket(null)
     fetchInitialData()
  }

  const handleBookSlot = async () => {
     if (!selectedSlot) return alert("Select a time slot first")
     if (profile?.id === 'mock-123') {
         const mockId = 'mq-' + Math.random().toString(36)
         localStorage.setItem('lot5_mock_queue', mockId)
         localStorage.setItem('lot5_mock_booked_time', selectedSlot)
         setMyTicket({ id: mockId, queue_number: 16, status: 'WAITING', created_at: new Date().toISOString(), booked_time: selectedSlot })
         return
     }
     
     const { error } = await supabase().from('queue_entries').insert([{
         user_id: profile?.id,
         customer_name: profile?.name,
         phone_number: profile?.phone,
         queue_number: 0,
         status: 'WAITING',
         booked_time: selectedSlot,
         entry_type: 'booking'
     }])
     if (error) {
         alert("Booking failed: " + error.message)
     } else {
         alert("Booking submitted for " + selectedSlot)
         fetchSessionAndData() // Refresh everything
     }
  }

  const generateSlots = () => {
     const slots = [];
     if (!canBookSlot || !todayHours.open) return slots;
     const parseTime = (timeStr: string) => {
        const [h,m] = timeStr.split(':').map(Number);
        return h * 60 + m;
     };
     const open = parseTime(todayHours.openTime);
     const close = parseTime(todayHours.closeTime);
     const bStart = parseTime(shopSettings.breakStart);
     const bEnd = parseTime(shopSettings.breakEnd);

     // Count bookings per slot
     const slotCounts: Record<string, number> = {};
     activeQueue.forEach(q => {
         if (q.booked_time && q.status === 'WAITING') {
            slotCounts[q.booked_time] = (slotCounts[q.booked_time] || 0) + 1;
         }
     });

     for (let t = open; t < close; t += averageServiceMinutes) {
         if (t >= bStart && t < bEnd) continue;
         const h = Math.floor(t / 60).toString().padStart(2, '0');
         const m = (t % 60).toString().padStart(2, '0');
         const timeString = `${h}:${m}`;
         
         // If bookings exceed or equal the number of available active booking barbers, it's full
         const isFull = (slotCounts[timeString] || 0) >= activeBookingBarbers;
         
         slots.push({ time: timeString, full: isFull });
     }
     return slots;
  }

  const handleLogout = async () => {
      localStorage.clear()
      if (process.env.NEXT_PUBLIC_SUPABASE_URL && !process.env.NEXT_PUBLIC_SUPABASE_URL.includes('placeholder')) {
         await supabase().auth.signOut()
      }
      window.location.href = '/'
  }

  if (loading) return <div className="min-h-screen flex items-center justify-center bg-[#f8fcfd]"><div className="w-10 h-10 border-4 border-outline-variant/20 border-t-[#004be2] rounded-full animate-spin"></div></div>

  // Math
  const calledTickets = activeQueue.filter(q => q.status === 'IN_CHAIR' || q.status === 'CALLED');
  const nowServing = calledTickets.length > 0 ? calledTickets[0] : null;
  const currentServingNumber = nowServing ? nowServing.queue_number : '--';

  const walkInActiveQueue = activeQueue.filter(q => !q.booked_time && ['WAITING', 'NOTIFIED', 'CALLED'].includes(q.status));
  const myQueueIndex = walkInActiveQueue.findIndex(q => q.id === myTicket?.id);
  const peopleAhead = myQueueIndex >= 0 ? myQueueIndex : 0;
  const myWaitTimeMins = Math.ceil((peopleAhead * averageServiceMinutes) / activeWalkInBarbers);

  return (
    <div className="min-h-screen text-on-surface font-body bg-[#f8fcfd] selection:bg-primary-container selection:text-on-primary-container pb-24">
      
      {/* Top Header */}
      <header className="bg-white/95 backdrop-blur-md flex justify-between items-center w-full px-6 py-4 sticky top-0 z-50 shadow-sm border-b border-outline-variant/10">
        <div className="flex items-center gap-4">
          <span className="text-2xl font-black tracking-tighter text-[#596000] font-headline">Lot 5<span className="text-[#004be2]">.</span></span>
        </div>
        <div className="flex items-center gap-4">
           {profile?.role === 'admin' && (
              <a href="/admin" className="px-4 py-1.5 bg-surface-container-high text-xs font-bold uppercase tracking-widest rounded-full text-on-surface-variant flex items-center gap-1 hover:text-[#004be2] transition-colors"><ShieldCheck className="w-4 h-4" /> <span className="hidden sm:inline">Admin</span></a>
           )}
           <button onClick={() => setActiveTab('profile')} className={`w-10 h-10 rounded-full border-2 overflow-hidden flex items-center justify-center transition-all ${activeTab === 'profile' ? 'border-[#004be2] bg-[#c5d0ff]' : 'border-primary-container bg-surface-container-high hover:border-[#004be2]'}`}>
             <User className="w-5 h-5 text-on-surface-variant" />
           </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-4 mt-8 animate-in fade-in duration-500">
         
         {/* Navigation Tabs */}
         <div className="flex bg-surface-container-lowest p-1 rounded-full shadow-sm border border-outline-variant/10 mx-auto w-max mb-10 overflow-x-auto max-w-full">
            <button onClick={() => setActiveTab('queue')} className={`whitespace-nowrap px-6 py-2.5 rounded-full font-bold text-sm tracking-wide transition-all ${activeTab === 'queue' ? 'bg-[#c5d0ff] text-[#004be2] shadow-sm' : 'text-on-surface-variant hover:text-on-surface'}`}>Queue</button>
            <button onClick={() => setActiveTab('history')} className={`whitespace-nowrap px-6 py-2.5 rounded-full font-bold text-sm tracking-wide transition-all ${activeTab === 'history' ? 'bg-[#c5d0ff] text-[#004be2] shadow-sm' : 'text-on-surface-variant hover:text-on-surface'}`}>History</button>
            <button onClick={() => setActiveTab('referrals')} className={`whitespace-nowrap px-6 py-2.5 rounded-full font-bold text-sm tracking-wide transition-all ${activeTab === 'referrals' ? 'bg-[#e5f638] text-[#545b00] shadow-sm border border-[#545b00]/10' : 'text-on-surface-variant hover:text-on-surface'}`}>Refer Friends</button>
         </div>

         <AnimatePresence mode="wait">
            
         {/* --- 1. QUEUE SYSTEM VIEW --- */}
         {activeTab === 'queue' && (
           <motion.div key="queue" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
              {!myTicket ? (
                 <div className="bg-white rounded-[2rem] p-8 md:p-14 shadow-sm border border-outline-variant/10 text-center relative overflow-hidden">
                    <div className="absolute -right-20 -top-20 w-64 h-64 bg-[#e5f638]/20 rounded-full blur-3xl mix-blend-multiply pointer-events-none"></div>
                    <div className="absolute -left-20 -bottom-20 w-64 h-64 bg-[#c5d0ff]/20 rounded-full blur-3xl mix-blend-multiply pointer-events-none"></div>
                    
                    {/* Floating Background Icons */}
                    <div className="absolute inset-0 pointer-events-none overflow-hidden opacity-[0.03] select-none">
                      <span className="material-symbols-outlined absolute top-10 left-[10%] text-6xl rotate-12">content_cut</span>
                      <span className="material-symbols-outlined absolute top-32 right-[15%] text-7xl -rotate-12">brush</span>
                      <span className="material-symbols-outlined absolute bottom-24 left-[15%] text-5xl rotate-45">straighten</span>
                      <span className="material-symbols-outlined absolute bottom-12 right-[10%] text-6xl rotate-[-20deg]">face</span>
                      <span className="material-symbols-outlined absolute top-[40%] left-[5%] text-4xl">stars</span>
                      <span className="material-symbols-outlined absolute top-[50%] right-[8%] text-5xl rotate-12">dry_cleaning</span>
                      <span className="material-symbols-outlined absolute bottom-[40%] left-[8%] text-3xl">water_drop</span>
                      <span className="material-symbols-outlined absolute top-[20%] left-[20%] text-2xl">close</span>
                      <span className="material-symbols-outlined absolute bottom-[30%] right-[20%] text-3xl">circle</span>
                    </div>
                    
                    <div className="relative z-10 max-w-lg mx-auto">
                      <div className="bg-white rounded-[2rem] border border-outline-variant/10 shadow-sm p-5 mb-6 text-left">
                        <div className="flex items-start justify-between gap-4 mb-5">
                          <div>
                            <p className="text-[10px] font-black uppercase tracking-widest text-[#004be2] mb-1">Today&apos;s Operation</p>
                            <h1 className="font-headline text-2xl font-black text-on-surface">{todayInfo.label}</h1>
                            <p className="text-sm font-bold text-on-surface-variant mt-1">
                              {todayHours.open ? `${todayHours.openTime} - ${todayHours.closeTime}` : 'Closed'}
                            </p>
                          </div>
                          <span className={`px-3 py-2 rounded-full text-[10px] font-black uppercase tracking-widest ${isWithinOperationHours ? 'bg-[#e5f638] text-[#545b00]' : 'bg-red-50 text-red-600 border border-red-100'}`}>
                            {operationStatus}
                          </span>
                        </div>
                        <div className="grid grid-cols-3 gap-3">
                          <div className="rounded-2xl bg-[#e5f638]/20 border border-[#e5f638] p-3 text-center">
                            <p className="font-headline text-2xl font-black text-[#545b00]">{walkInWaitingCount}</p>
                            <p className="text-[9px] font-black uppercase tracking-widest text-[#545b00]/70 mt-1">Waiting</p>
                          </div>
                          <div className="rounded-2xl bg-[#c5d0ff]/35 border border-[#004be2]/10 p-3 text-center">
                            <p className="font-headline text-2xl font-black text-[#004be2]">{estimatedWalkInWaitMins}</p>
                            <p className="text-[9px] font-black uppercase tracking-widest text-[#004be2]/70 mt-1">Est. Min</p>
                          </div>
                          <div className="rounded-2xl bg-surface-container-lowest border border-outline-variant/10 p-3 text-center">
                            <p className="font-headline text-2xl font-black text-on-surface">{activeWalkInBarbers}</p>
                            <p className="text-[9px] font-black uppercase tracking-widest text-on-surface-variant mt-1">Barbers</p>
                          </div>
                        </div>
                        {!isWithinOperationHours && todayHours.open && (
                          <p className="mt-4 rounded-2xl bg-red-50 border border-red-100 px-4 py-3 text-sm font-bold text-red-700">
                            Walk-in queue starts at {todayHours.openTime}. You can review slots if booking is available.
                          </p>
                        )}
                      </div>
                      
                      {/* Segmented Control */}
                      {shopSettings.operationsMode === 'both' && (
                        <div className="flex bg-surface-container p-1 rounded-2xl mb-10 w-full">
                           <button 
                              onClick={() => setQueueMode('walk-in')}
                              disabled={!canJoinWalkIn}
                              className={`flex-1 py-3 rounded-xl font-bold tracking-widest uppercase text-xs transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${queueMode === 'walk-in' ? 'bg-white shadow-sm text-on-surface' : 'text-on-surface-variant hover:bg-white/50'}`}
                            >Walk-in Queue</button>
                            <button 
                              onClick={() => setQueueMode('booking')}
                              disabled={!canBookSlot}
                              className={`flex-1 py-3 rounded-xl font-bold tracking-widest uppercase text-xs transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${queueMode === 'booking' ? 'bg-[#004be2] shadow-sm text-white' : 'text-on-surface-variant hover:bg-white/50'}`}
                            >Book a Slot</button>
                        </div>
                      )}

                      {queueMode === 'walk-in' ? (
                          <>
                            <div className="w-20 h-20 bg-[#c5d0ff] text-[#004be2] rounded-2xl flex items-center justify-center mx-auto mb-8 shadow-sm border border-[#004be2]/10 rotate-3">
                               <span className="material-symbols-outlined text-4xl">content_cut</span>
                            </div>
                            <h1 className="font-headline text-4xl font-black tracking-tight text-on-surface mb-4">Ready for a fresh cut?</h1>
                            <p className="text-on-surface-variant font-medium mb-6 text-lg">Join the queue digitally. We&apos;ll notify you when it&apos;s your turn.</p>
                            
                            <div className="grid grid-cols-3 gap-3 mb-10 mx-auto w-full">
                              {/* 1. Estimate time waiting */}
                              <div className="bg-[#e5f638]/20 border border-[#e5f638] rounded-2xl py-3 px-2 flex flex-col items-center justify-center shadow-sm text-center">
                                <div className="text-2xl sm:text-3xl font-black font-headline text-[#545b00] flex items-baseline gap-1">
                                  {estimatedWalkInWaitMins} <span className="text-[10px] sm:text-xs font-bold">MIN</span>
                                </div>
                                <div className="leading-tight mt-1">
                                  <span className="font-bold text-[#545b00] block text-[10px] sm:text-[11px]">Estimated</span>
                                  <span className="font-black text-[#545b00] text-[8px] sm:text-[10px] uppercase tracking-widest">Wait Time</span>
                                </div>
                              </div>

                              {/* 2. Current people waiting */}
                              <div className="bg-[#e5f638]/20 border border-[#e5f638] rounded-2xl py-3 px-2 flex flex-col items-center justify-center shadow-sm text-center">
                                <div className="text-2xl sm:text-3xl font-black font-headline text-[#545b00]">
                                  {walkInWaitingCount}
                                </div>
                                <div className="leading-tight mt-1">
                                  <span className="font-bold text-[#545b00] block text-[10px] sm:text-[11px]">People</span>
                                  <span className="font-black text-[#545b00] text-[8px] sm:text-[10px] uppercase tracking-widest">Waiting</span>
                                </div>
                              </div>

                              {/* 3. Barber on Duty */}
                              <div className="bg-[#e5f638]/20 border border-[#e5f638] rounded-2xl py-3 px-2 flex flex-col items-center justify-center shadow-sm text-center">
                                <div className="text-2xl sm:text-3xl font-black font-headline text-[#545b00]">
                                  {activeWalkInBarbers}
                                </div>
                                <div className="leading-tight mt-1">
                                  <span className="font-bold text-[#545b00] block text-[10px] sm:text-[11px]">Barbers</span>
                                  <span className="font-black text-[#545b00] text-[8px] sm:text-[10px] uppercase tracking-widest">On Duty</span>
                                </div>
                              </div>
                            </div>
                            
                            {isWalkInAtCapacity && (
                              <div className="bg-[#004be2] text-white p-5 rounded-2xl shadow-sm mb-6 text-left border border-[#c5d0ff]">
                                <p className="font-black uppercase tracking-widest text-xs mb-2 text-[#e5f638]">Walk-ins are full</p>
                                <p className="font-bold leading-relaxed">Estimated wait is now over {maxWalkInWaitMinutes} minutes. Book a slot instead so you get an accurate time.</p>
                                <p className="text-xs font-bold uppercase tracking-widest text-white/70 mt-3">Capacity: {walkInWaitingCount}/{maxWalkInCustomers} walk-ins with {activeWalkInBarbers} walk-in barber{activeWalkInBarbers > 1 ? 's' : ''}</p>
                              </div>
                            )}

                            <div className="bg-white p-4 rounded-2xl border border-outline-variant/10 shadow-sm mb-6 text-left">
                               <label className="text-xs font-bold uppercase tracking-widest text-on-surface-variant mb-2 block">Haircut Style</label>
                               <select 
                                 value={serviceType}
                                 onChange={(e) => setServiceType(e.target.value)}
                                 className="w-full bg-surface-container-lowest border border-outline-variant/20 rounded-xl px-4 py-3 font-bold text-sm outline-none mb-4 focus:border-[#004be2]"
                               >
                                  <option value="Tape Fade">Tape Fade</option>
                                  <option value="Undercut">Undercut</option>
                                  <option value="Low Fade">Low Fade</option>
                                  <option value="Mid Fade">Mid Fade</option>
                                  <option value="High Fade">High Fade</option>
                                  <option value="Burst Fade">Burst Fade</option>
                                  <option value="Other">Other</option>
                               </select>
                               
                               <label className="text-xs font-bold uppercase tracking-widest text-on-surface-variant mb-2 block">Remarks (Optional)</label>
                               <input 
                                 type="text"
                                 value={remark}
                                 onChange={(e) => setRemark(e.target.value)}
                                 placeholder="Any specific requests?"
                                 className="w-full bg-surface-container-lowest border border-outline-variant/20 rounded-xl px-4 py-3 font-bold text-sm outline-none focus:border-[#004be2]"
                               />
                            </div>

                             <button
                               disabled={!canJoinWalkIn && !isWalkInAtCapacity}
                               onClick={isWalkInAtCapacity ? () => setQueueMode('booking') : handleJoinQueue}
                               className={`w-full font-headline font-extrabold text-xl py-5 rounded-full shadow-md hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 ${isWalkInAtCapacity ? 'bg-[#004be2] text-white' : canJoinWalkIn ? 'bg-[#e5f638] text-[#545b00]' : 'bg-surface-container text-on-surface-variant'}`}
                             >
                                {isWalkInAtCapacity ? 'Book a Slot Instead' : canJoinWalkIn ? 'Join the Queue' : 'Queue Opens Later'} <ArrowRight className="w-5 h-5" />
                             </button>
                          </>
                      ) : (
                          <div className="text-left">
                             <h1 className="font-headline text-4xl font-black tracking-tight text-[#545b00] mb-6 text-center">Book a Slot</h1>
                             <div className="mb-6 h-[200px] overflow-y-auto custom-scrollbar pr-2">
                                 <div className="grid grid-cols-3 gap-3">
                                    {generateSlots().map(slotObj => (
                                       <button 
                                         key={slotObj.time}
                                         disabled={slotObj.full}
                                         onClick={() => setSelectedSlot(slotObj.time)}
                                         className={`py-3 rounded-xl font-black text-sm flex flex-col items-center justify-center transition-all border outline-none 
                                          ${slotObj.full ? 'bg-surface-container border-transparent text-outline-variant opacity-50 cursor-not-allowed grayscale' :
                                          (selectedSlot === slotObj.time ? 'bg-[#e5f638] border-[#545b00]/20 text-[#545b00] shadow-sm scale-105' : 'bg-surface border-outline-variant/10 text-on-surface hover:border-outline-variant/30 hover:bg-surface-container-lowest')}`}
                                       >
                                         {slotObj.time}
                                         {slotObj.full && <span className="text-[8px] uppercase tracking-widest mt-0.5 opacity-80">Full</span>}
                                       </button>
                                    ))}
                                 </div>
                              </div>
                             
                             <div className="space-y-4 mb-8">
                                <div>
                                  <label className="text-xs font-bold uppercase tracking-widest text-on-surface-variant mb-2 block">Name</label>
                                  <input type="text" readOnly value={profile?.name || ''} className="w-full bg-surface border border-outline-variant/10 rounded-xl px-4 py-3 font-bold opacity-70 outline-none" />
                                </div>
                             </div>

                              <button disabled={!canBookSlot} onClick={handleBookSlot} className="w-full bg-[#004be2] text-white font-headline font-extrabold text-xl py-5 rounded-full shadow-md hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-3 mb-6 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100">
                                 Confirm Booking
                              </button>

                              <div className="bg-surface-container p-4 rounded-xl text-center border border-outline-variant/10">
                                <p className="text-[10px] uppercase font-bold tracking-widest text-on-surface-variant">Today: {todayHours.open ? `${todayHours.openTime} - ${todayHours.closeTime}` : 'Closed'} | Break {shopSettings.breakStart} - {shopSettings.breakEnd}</p>
                              </div>
                          </div>
                      )}
                    </div>
                 </div>
              ) : ['NOTIFIED', 'CALLED'].includes(myTicket.status) ? (
                 <div className="bg-[#004be2] rounded-[2rem] p-8 md:p-14 text-center text-white shadow-xl relative overflow-hidden animate-in zoom-in duration-500">
                    <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-10 mix-blend-overlay"></div>
                    <div className="w-32 h-32 bg-white/20 backdrop-blur-md rounded-full flex items-center justify-center mx-auto mb-8 border-4 border-[#c5d0ff] shadow-inner animate-pulse">
                      <span className="material-symbols-outlined text-6xl text-white">campaign</span>
                    </div>
                    <h1 className="font-headline text-5xl md:text-6xl font-black tracking-tighter mb-6 leading-tight">Your turn is close!</h1>
                    <p className="bg-[#e5f638] text-[#545b00] inline-block px-8 py-3 rounded-full font-bold uppercase tracking-widest text-sm shadow-md mt-2">
                       Please get ready or head to the shop
                    </p>
                 </div>
              ) : (
                 <div className="space-y-6">
                    <div className="text-center mb-10">
                       <h1 className="font-headline text-4xl font-extrabold tracking-tight text-on-surface">{myTicket.booked_time ? 'Booking Confirmed!' : 'You\'re in the queue!'}</h1>
                       <p className="text-on-surface-variant font-medium mt-3 text-lg flex justify-center items-center gap-2">
                          <Ticket className="w-5 h-5 opacity-50"/> {myTicket.booked_time ? 'Time:' : 'Ticket'} <strong className="text-[#004be2] bg-[#c5d0ff]/50 px-2 rounded">{myTicket.booked_time || `#${myTicket.queue_number}`}</strong>
                       </p>
                    </div>

                    {myTicket.booked_time ? (
                        <div className="bg-[#e5f638] rounded-[2rem] p-8 md:p-10 flex flex-col items-center justify-center text-center shadow-sm border border-[#545b00]/10 relative overflow-hidden group">
                           <span className="text-sm font-label font-bold uppercase tracking-widest text-[#545b00] mb-4">Reserved Time</span>
                           <h2 className="font-headline text-6xl font-black text-[#545b00] tracking-tighter">{myTicket.booked_time}</h2>
                           <div className="mt-6 flex items-center gap-2 bg-black/5 px-4 py-1.5 rounded-full text-center mx-auto">
                             <span className="material-symbols-outlined text-sm text-[#545b00]" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
                             <span className="text-[10px] font-bold text-[#545b00] uppercase tracking-widest">Locked In</span>
                           </div>
                        </div>
                    ) : (
                        <>
                        <div className="bg-[#c5d0ff] rounded-[2rem] p-8 md:p-12 flex flex-col md:flex-row items-center justify-around text-center shadow-sm relative overflow-hidden group hover:shadow-md transition-shadow">
                           
                           <div className="flex flex-col items-center">
                              <span className="text-sm font-label font-bold uppercase tracking-widest text-[#004be2] mb-4">Your Ticket</span>
                              <div className="relative">
                                <span className="font-headline text-[7rem] md:text-[9rem] font-black text-[#004be2] tracking-tighter leading-none block group-hover:scale-105 transition-transform">#{myTicket.queue_number}</span>
                              </div>
                              <span className="mt-4 bg-[#004be2] text-white px-5 py-2 rounded-full font-bold uppercase tracking-widest text-xs shadow-sm">Status: {myTicket.status === 'HOLD' ? 'On Hold' : myTicket.status === 'IN_CHAIR' ? 'Now Serving' : myTicket.status === 'NOTIFIED' ? 'Notified' : 'Waiting'}</span>
                           </div>

                           <div className="w-full h-px md:w-px md:h-40 bg-[#004be2]/10 my-8 md:my-0"></div>

                           <div className="flex flex-col items-center">
                              <span className="text-sm font-label font-bold uppercase tracking-widest text-[#004be2] mb-4">Estimated Wait</span>
                              <div className="flex items-baseline gap-2">
                                <span className="font-headline text-[5rem] md:text-[7rem] font-black text-[#004be2] tracking-tighter leading-none block group-hover:scale-105 transition-transform">{myWaitTimeMins}</span>
                                <span className="font-headline text-2xl font-bold text-[#004be2]">MIN</span>
                              </div>
                              <div className="mt-4 flex items-center gap-2 bg-white/40 px-4 py-1.5 rounded-full text-center mx-auto">
                                <span className="material-symbols-outlined text-sm text-[#004be2]" style={{ fontVariationSettings: "'FILL' 1" }}>bolt</span>
                                <span className="text-[10px] font-bold text-[#004be2] uppercase tracking-widest">Calculated dynamically</span>
                              </div>
                           </div>
                           
                        </div>

                        <div className="mt-6 bg-white rounded-[2rem] p-6 md:p-8 shadow-sm border border-outline-variant/10">
                           <span className="text-sm font-label font-bold uppercase tracking-widest text-[#004be2] mb-6 block text-center md:text-left">Live Shop Status</span>
                           
                           <div className="space-y-4">
                              <div className="flex items-center justify-between bg-[#f8fcfd] p-4 md:p-5 rounded-2xl border border-[#c5d0ff]/40">
                                 <div className="flex items-center gap-4">
                                    <div className="w-10 h-10 md:w-12 md:h-12 rounded-full bg-[#c5d0ff] text-[#004be2] flex items-center justify-center"><UsersRound className="w-5 h-5 md:w-6 md:h-6"/></div>
                                    <span className="font-bold text-gray-600 md:text-lg">Active Barbers</span>
                                 </div>
                                 <span className="text-2xl md:text-3xl font-black text-[#004be2]">{activeWalkInBarbers}</span>
                              </div>

                              <div className="flex items-center justify-between bg-[#f8fcfd] p-4 md:p-5 rounded-2xl border border-[#c5d0ff]/40">
                                 <div className="flex items-center gap-4">
                                    <div className="w-10 h-10 md:w-12 md:h-12 rounded-full bg-[#e5f638]/30 text-[#545b00] flex items-center justify-center"><Users className="w-5 h-5 md:w-6 md:h-6"/></div>
                                    <span className="font-bold text-gray-600 md:text-lg">Waiting Queue</span>
                                 </div>
                                 <span className="text-2xl md:text-3xl font-black text-gray-800">{activeQueue.filter((q: any) => !q.booked_time && q.status === 'WAITING').length}</span>
                              </div>

                              <div className="flex items-center justify-between bg-[#e5f638] p-4 md:p-5 rounded-2xl border border-[#545b00]/10 shadow-sm">
                                 <div className="flex items-center gap-4">
                                    <div className="w-10 h-10 md:w-12 md:h-12 rounded-full bg-white text-[#545b00] flex items-center justify-center"><span className="material-symbols-outlined text-lg md:text-xl">campaign</span></div>
                                    <div className="flex flex-col text-left">
                                       <span className="font-black text-[#545b00] md:text-lg leading-tight">Now Serving</span>
                                       <span className="font-bold text-[#545b00]/70 text-[10px] uppercase tracking-widest">In the chair</span>
                                    </div>
                                 </div>
                                 <div className="flex items-baseline gap-1">
                                    <span className="text-3xl md:text-4xl font-headline font-black text-[#545b00]">#{currentServingNumber}</span>
                                 </div>
                              </div>
                           </div>
                        </div>
                        </>
                    )}

                    <div className="mt-12 flex flex-col items-center justify-center w-full">
                       <button onClick={handleCancelQueue} className="w-full max-w-sm bg-white text-red-500 font-headline font-bold py-4 rounded-full border border-red-100 shadow-sm hover:bg-red-50 hover:text-red-600 active:scale-95 transition-all flex items-center justify-center gap-2">
                          <LogOut className="w-5 h-5"/> Leave Queue
                       </button>
                       <p className="text-[10px] uppercase font-bold text-on-surface-variant/50 tracking-widest mt-4">You will lose your spot</p>
                    </div>
                 </div>
              )}
           </motion.div>
         )}

         {/* --- 2. HISTORY VIEW --- */}
         {activeTab === 'history' && (
           <motion.div key="history" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
             <h2 className="font-headline font-black text-3xl mb-8 px-2 text-on-surface">Past Visits</h2>
             {myHistory.length === 0 ? (
                <div className="bg-white rounded-[2rem] p-16 text-center shadow-sm border border-outline-variant/10">
                   <div className="w-20 h-20 bg-surface-container mx-auto rounded-full flex items-center justify-center text-on-surface-variant mb-6 shadow-inner">
                      <History className="w-10 h-10 opacity-50" />
                   </div>
                   <h3 className="font-headline font-bold text-2xl text-on-surface mb-2">No history yet</h3>
                   <p className="text-on-surface-variant font-medium text-base max-w-sm mx-auto">When you complete visits at Lot 5, they will safely be stored here.</p>
                </div>
             ) : (
                <div className="bg-white rounded-[2rem] shadow-sm border border-outline-variant/10 overflow-hidden divide-y divide-outline-variant/5">
                   {myHistory.map(hist => {
                      const d = new Date(hist.created_at)
                      return (
                      <div key={hist.id} className="p-6 md:p-8 flex items-center justify-between hover:bg-surface/50 transition-colors">
                         <div className="flex gap-5 items-center">
                            <div className={`w-14 h-14 rounded-2xl flex items-center justify-center flex-shrink-0 shadow-sm border ${hist.status==='COMPLETED'?'bg-[#e5f638]/20 border-[#545b00]/10 text-[#545b00]': hist.status==='CANCELLED'?'bg-red-50 border-red-100 text-red-500':'bg-surface-container-high border-outline-variant/10 text-on-surface-variant'}`}>
                               <span className="material-symbols-outlined">{hist.status==='COMPLETED'?'check_circle':hist.status==='CANCELLED'?'cancel':'event_busy'}</span>
                            </div>
                            <div>
                               <p className="font-bold text-on-surface text-lg">{hist.booked_time ? 'Confirmed Booking' : 'Walk-in Ticket'}</p>
                               <p className="text-sm text-on-surface-variant font-medium mt-1">{d.toLocaleDateString('en-US', {month:'long', day:'numeric', year:'numeric'})} • {hist.booked_time ? `Reserved for ${hist.booked_time}` : `At ${d.toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}`}</p>
                            </div>
                         </div>
                         <div className="text-right">
                            <span className={`text-[10px] font-bold uppercase tracking-widest px-4 py-1.5 rounded-full shadow-sm ${hist.status==='COMPLETED'?'text-green-700 bg-green-100 border border-green-200':hist.status==='CANCELLED'?'text-red-600 bg-red-100 border border-red-200':'text-gray-600 bg-gray-100 border border-gray-200'}`}>
                               {hist.status}
                            </span>
                         </div>
                      </div>
                      )
                   })}
                </div>
             )}
           </motion.div>
         )}

         {/* --- 3. REFERRALS VIEW --- */}
         {activeTab === 'referrals' && (
            <motion.div key="referrals" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
               <h2 className="font-headline font-black text-3xl mb-8 px-2 text-on-surface">Refer &amp; Earn</h2>
               
               <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                  <div className="bg-[#e5f638] rounded-[2rem] p-8 shadow-sm border border-[#545b00]/10 text-[#545b00] relative overflow-hidden">
                     <span className="material-symbols-outlined absolute -bottom-4 -right-4 text-9xl opacity-10">group_add</span>
                     <p className="text-sm font-label font-bold uppercase tracking-widest mb-2">Total Referrals</p>
                     <p className="font-headline font-black text-6xl tracking-tighter">{referralCount}</p>
                     <p className="mt-4 text-sm font-medium">Friends who joined using your link.</p>
                  </div>
                  <div className="bg-white rounded-[2rem] p-8 shadow-sm border border-outline-variant/10 flex flex-col justify-center">
                     <p className="text-sm font-label font-bold uppercase tracking-widest text-on-surface-variant mb-4 flex items-center gap-2"><Ticket className="w-4 h-4"/> Your Referral Link</p>
                     <div className="bg-surface p-4 rounded-xl border border-outline-variant/20 flex items-center justify-between gap-4">
                        <span className="truncate font-medium text-[#004be2] text-sm">
                           {typeof window !== 'undefined' ? `${window.location.origin}/register?ref=${profile?.referral_code || 'CODE'}` : ''}
                        </span>
                        <button 
                           onClick={(e) => {
                              const btn = e.currentTarget;
                              navigator.clipboard.writeText(`${window.location.origin}/register?ref=${profile?.referral_code || 'CODE'}`);
                              btn.innerHTML = `<span class="material-symbols-outlined text-sm">check</span>`;
                              setTimeout(() => btn.innerHTML = `<span class="material-symbols-outlined text-sm">content_copy</span>`, 2000);
                           }}
                           className="flex-shrink-0 w-8 h-8 flex items-center justify-center bg-[#c5d0ff] text-[#004be2] rounded-lg hover:bg-[#004be2] hover:text-white transition-colors"
                           title="Copy Link"
                        >
                           <span className="material-symbols-outlined text-sm">content_copy</span>
                        </button>
                     </div>
                     <p className="mt-4 text-xs font-medium text-on-surface-variant leading-relaxed">Share this link to instantly grant your friends priority access. Every successful sign-up tracks towards your loyalty rewards.</p>
                  </div>
               </div>
            </motion.div>
         )}

         {/* --- 4. PROFILE VIEW --- */}
         {activeTab === 'profile' && (
           <motion.div key="profile" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
             <h2 className="font-headline font-black text-3xl mb-8 px-2 text-on-surface">My Profile</h2>
             <div className="bg-white rounded-[2rem] shadow-sm border border-outline-variant/10 p-8 md:p-12 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-bl from-[#004be2]/5 to-transparent pointer-events-none"></div>
                
                <div className="flex items-center gap-6 mb-12 pb-10 border-b border-outline-variant/10 relative z-10">
                   <div className="w-28 h-28 rounded-full bg-[#004be2] text-white flex items-center justify-center font-headline text-4xl font-black shadow-lg shadow-[#004be2]/20 border-4 border-white">
                      {profile?.name ? profile.name.substring(0,2).toUpperCase() : 'ME'}
                   </div>
                   <div>
                      <h3 className="font-headline font-black text-4xl text-on-surface mb-2 tracking-tight">{profile?.name || 'Customer'}</h3>
                      <p className="text-on-surface-variant font-medium text-lg">{profile?.email}</p>
                   </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-10 relative z-10">
                   <div className="bg-surface-container-lowest p-6 md:p-8 rounded-[1.5rem] border border-outline-variant/10 flex items-center gap-5 hover:border-[#e5f638] transition-colors">
                      <div className="w-14 h-14 rounded-full bg-[#e5f638] text-[#545b00] flex items-center justify-center shadow-sm">
                         <span className="material-symbols-outlined text-2xl">stars</span>
                      </div>
                      <div>
                         <p className="text-[10px] font-bold uppercase tracking-widest text-[#545b00]/70 mb-1">Loyalty Rewards</p>
                         <p className="font-headline font-black text-2xl text-on-surface">0 Points</p>
                      </div>
                   </div>
                   <div className="bg-surface-container-lowest p-6 md:p-8 rounded-[1.5rem] border border-outline-variant/10 flex items-center gap-5 hover:border-[#004be2]/30 transition-colors">
                      <div className="w-14 h-14 rounded-full bg-[#c5d0ff] text-[#004be2] flex items-center justify-center shadow-sm">
                         <span className="material-symbols-outlined text-2xl">verified_user</span>
                      </div>
                      <div>
                         <p className="text-[10px] font-bold uppercase tracking-widest text-[#004be2]/70 mb-1">Account Role</p>
                         <p className="font-headline font-black text-2xl text-on-surface capitalize">{profile?.role}</p>
                      </div>
                   </div>
                </div>

                <button onClick={handleLogout} className="w-full bg-surface text-red-500 font-headline font-bold py-5 rounded-2xl border border-outline-variant/10 hover:bg-red-50 hover:border-red-100 hover:text-red-600 transition-colors flex items-center justify-center gap-2 relative z-10">
                   <LogOut className="w-5 h-5"/> Sign Out
                </button>
             </div>
           </motion.div>
         )}

         </AnimatePresence>
      </main>

      <div className="mt-20">
         <MarketingSections />
         <SiteFooter />
      </div>
    </div>
  )
}
