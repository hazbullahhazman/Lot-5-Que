'use client'

import { useEffect, useState } from 'react'
import { createClient as supabase } from '@/utils/supabase/client'
import { motion, AnimatePresence } from 'framer-motion'
import { Check, X, Shield, Bell, LayoutDashboard, Users, UserPlus, LogOut, Search, Activity, UserX } from 'lucide-react'

export default function AdminDashboard() {
  const [profile, setProfile] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  const [activeTab, setActiveTab] = useState<'overview' | 'customers' | 'management' | 'users'>('management')
  
  // Data
  const [activeQueue, setActiveQueue] = useState<any[]>([])
  const [history, setHistory] = useState<any[]>([])
  const [usersList, setUsersList] = useState<any[]>([])
  const [metrics, setMetrics] = useState({ todayCuts: 0, todaySales: 0, weeklyCuts: 0, churnRisk: 0, absences: 0 })

  // Shop Management Configuration
  const [shopSettings, setShopSettings] = useState({
    operationsMode: 'both', // 'both', 'slot', 'queue', 'closed'
    openTime: '17:00',
    closeTime: '22:00',
    breakStart: '19:15',
    breakEnd: '20:00',
    barbers: [
      { id: '1', name: 'Julian', active: true, role: 'both' },
      { id: '2', name: 'Marcus', active: true, role: 'queue' }
    ]
  })
  const [newBarberName, setNewBarberName] = useState('')
  const [longPressTimer, setLongPressTimer] = useState<NodeJS.Timeout | null>(null)

  useEffect(() => {
    const saved = localStorage.getItem('lot5_shop_settings')
    if (saved) setShopSettings(JSON.parse(saved))

    checkAdmin()

    let channel: any
    if (process.env.NEXT_PUBLIC_SUPABASE_URL && !process.env.NEXT_PUBLIC_SUPABASE_URL.includes('placeholder')) {
        channel = supabase()
          .channel('admin-events')
          .on('postgres_changes', { event: '*', schema: 'public', table: 'queues' }, () => {
             fetchData()
          })
          .subscribe()
    }

    return () => { if (channel) supabase().removeChannel(channel) }
  }, [])

  const checkAdmin = async () => {
     if (!process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL.includes('placeholder')) {
         const role = localStorage.getItem('mock_role')
         if (role !== 'admin') window.location.href = '/login'
         else {
             setProfile({ id: 'admin-123', name: 'Master Barber' })
             loadMockData()
             setLoading(false)
         }
         return
     }

     const { data: { session } } = await supabase().auth.getSession()
     if (!session) { window.location.href = '/login'; return }
     
     const { data } = await supabase().from('profiles').select('*').eq('id', session.user.id).single()
     if (!data || data.role !== 'admin') {
         window.location.href = '/dashboard' // Not an admin
         return
     }

     setProfile(data)
     fetchData()
     setLoading(false)
  }

  const loadMockData = () => {
      setActiveQueue([
          { id: 'q1', queue_number: 14, status: 'WAITING', customer_name: 'Julian D.', phone_number: '60123456789' },
          { id: 'q2', queue_number: 15, status: 'WAITING', customer_name: 'Marcus K.', phone_number: '60198765432' },
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
            .select('id, queue_number, status, user_id, customer_name, phone_number, created_at, profiles(name, email)')
            .in('status', ['WAITING', 'CALLED'])
            .order('queue_number', { ascending: true })
         if (qData) setActiveQueue(qData)

         // Historical Data for CRM
         const { data: hData } = await supabase()
            .from('queue_entries')
            .select('id, queue_number, status, created_at, customer_name, profiles(name, email)')
            .in('status', ['COMPLETED', 'CANCELLED', 'ABSENT'])
            .order('created_at', { ascending: false })
            .limit(100)
         if (hData) {
             setHistory(hData)
             // Calculate CRM Metrics
             const now = new Date()
             let today = 0, week = 0, absent = 0
             hData.forEach(h => {
                const d = new Date(h.created_at)
                const diffDays = Math.ceil(Math.abs(now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24))
                if (diffDays <= 1 && h.status === 'COMPLETED') today++
                if (diffDays <= 7 && h.status === 'COMPLETED') week++
                if (h.status === 'ABSENT' && diffDays <= 7) absent++
             })
             
             // Transactions (Sales logic)
             const { data: tData } = await supabase()
                .from('transactions')
                .select('price, created_at')
                .eq('status', 'COMPLETED')
             
             let sales = 0
             if (tData) {
                tData.forEach(t => {
                   const d = new Date(t.created_at)
                   const diff = Math.ceil(Math.abs(now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24))
                   if (diff <= 1) sales += Number(t.price || 0)
                })
             }

             setMetrics({ todayCuts: today, todaySales: sales, weeklyCuts: week, churnRisk: 0, absences: absent })
         }

         const { data: uData } = await supabase()
            .from('profiles')
            .select('*')
            .order('created_at', { ascending: false })
         if (uData) setUsersList(uData)

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
  const handleCallCustomer = async (id: string, name: string, phone?: string) => {
     if (window.confirm(`Call ${name} via WhatsApp?`)) {
        if (!process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL.includes('placeholder')) {
            setActiveQueue(prev => prev.map(q => q.id === id ? { ...q, status: 'CALLED' } : q))
        } else {
            await supabase().from('queue_entries').update({ status: 'CALLED' }).eq('id', id)
            fetchData()
        }

        if (phone) {
            const cleanPhone = phone.replace(/[^\d]/g, '')
            const message = "bro daripada Lot 5 Barbershop, lagi 15 minit turn awak."
            window.open(`https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`, '_blank')
        } else {
            alert("Customer did not provide a phone number.")
        }
     }
  }

  const handleMarkAttended = async (id: string, user_id: string) => {
     if (!process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL.includes('placeholder')) {
         setActiveQueue(prev => prev.filter(q => q.id !== id))
         setMetrics(prev => ({ ...prev, todayCuts: prev.todayCuts + 1, todaySales: prev.todaySales + 35 }))
         return
     }

     console.log('Completing ticket:', id, user_id)
     // 1. Update queue
     await supabase().from('queue_entries').update({ status: 'COMPLETED' }).eq('id', id)
     
     // 2. Add transaction record
     if (user_id) {
         await supabase().from('transactions').insert([{
             user_id,
             service_type: 'Standard Haircut',
             price: 35.00,
             status: 'COMPLETED'
         }])
     }
     
     fetchData()
  }

  const handleMarkAbsent = async (id: string) => {
     if (window.confirm(`Mark this customer as an Absent/No Show?`)) {
        if (!process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL.includes('placeholder')) {
            setActiveQueue(prev => prev.filter(q => q.id !== id))
            setMetrics(prev => ({ ...prev, absences: prev.absences + 1 }))
            return
        }
        await supabase().from('queue_entries').update({ status: 'ABSENT' }).eq('id', id)
        fetchData()
     }
  }

  const saveShopSettings = (newSettings: any) => {
      setShopSettings(newSettings)
      localStorage.setItem('lot5_shop_settings', JSON.stringify(newSettings))
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
             else if (b.role === 'queue') nextRole = 'slot'
             return { ...b, role: nextRole }
          })
      }
      saveShopSettings(updated)
  }

  const handleLogout = async () => {
      localStorage.clear()
      if (process.env.NEXT_PUBLIC_SUPABASE_URL && !process.env.NEXT_PUBLIC_SUPABASE_URL.includes('placeholder')) {
         await supabase().auth.signOut()
      }
      window.location.href = '/'
  }

  if (loading) return <div className="min-h-screen flex items-center justify-center bg-[#f9f6f5]"><div className="w-10 h-10 border-4 border-outline-variant/20 border-t-[#545b00] rounded-full animate-spin"></div></div>

  return (
    <div className="bg-[#f9f6f5] text-on-surface selection:bg-primary-container selection:text-on-primary-container font-body min-h-screen">
      
      {/* TopNavBar */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-white transition-colors flex justify-between items-center w-full px-6 py-4 shadow-sm border-b border-outline-variant/10">
        <div className="flex items-center gap-8">
          <span className="text-2xl font-black tracking-tighter text-[#596000] font-headline">Lot 5<span className="text-[#004be2]">.</span> <span className="font-bold text-xs uppercase tracking-widest text-[#004be2] bg-[#c5d0ff] px-2 rounded-full py-0.5 ml-2 shadow-sm">Admin</span></span>
        </div>
        <div className="flex items-center gap-4">
          <button onClick={handleLogout} className="px-4 py-2 border border-outline-variant/10 bg-surface-container-low hover:bg-red-50 hover:text-red-600 hover:border-red-100 rounded-full font-bold text-sm transition-all flex items-center gap-2">
             Sign Out <LogOut className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* SideNavBar (Desktop Only) */}
      <aside className="hidden md:flex fixed left-0 top-0 h-full w-64 flex-col pt-24 pb-8 px-4 bg-white border-r border-outline-variant/10 shadow-sm transition-all z-40">
        <div className="flex items-center gap-3 px-4 mb-8">
          <div className="w-12 h-12 rounded-2xl bg-[#004be2] flex items-center justify-center text-white shadow-sm overflow-hidden font-black text-xl border-2 border-white">
             {profile?.name ? profile.name.substring(0,2).toUpperCase() : 'AD'}
          </div>
          <div>
            <p className="font-headline font-bold tracking-tight text-on-surface text-lg">{profile?.name || 'Lot 5 Admin'}</p>
            <p className="text-xs text-[#004be2] font-black uppercase tracking-widest bg-[#c5d0ff] px-2 rounded w-min mt-0.5">Console</p>
          </div>
        </div>
        
        <nav className="flex-1 space-y-2">
          <button onClick={() => setActiveTab('overview')} className={`w-full flex items-center gap-3 rounded-2xl px-4 py-3.5 transition-all outline-none ${activeTab === 'overview' ? 'bg-[#e5f638] text-[#545b00] scale-[0.98] shadow-sm font-black' : 'text-gray-500 hover:bg-surface hover:translate-x-1 font-bold'}`}>
            <LayoutDashboard className={`w-5 h-5 ${activeTab === 'overview' ? 'text-[#545b00]' : ''}`} />
            <span className="tracking-wide">Queue Manager</span>
          </button>
          <button onClick={() => setActiveTab('customers')} className={`w-full flex items-center gap-3 rounded-2xl px-4 py-3.5 transition-all outline-none ${activeTab === 'customers' ? 'bg-[#c5d0ff] text-[#004be2] scale-[0.98] shadow-sm font-black' : 'text-gray-500 hover:bg-surface hover:translate-x-1 font-bold'}`}>
            <Users className={`w-5 h-5 ${activeTab === 'customers' ? 'text-[#004be2]' : ''}`} />
            <span className="tracking-wide">CRM Analytics</span>
          </button>
          <button onClick={() => setActiveTab('management')} className={`w-full flex items-center gap-3 rounded-2xl px-4 py-3.5 transition-all outline-none ${activeTab === 'management' ? 'bg-orange-100 text-orange-600 scale-[0.98] shadow-sm font-black' : 'text-gray-500 hover:bg-surface hover:translate-x-1 font-bold'}`}>
            <Shield className={`w-5 h-5 ${activeTab === 'management' ? 'text-orange-600' : ''}`} />
            <span className="tracking-wide">Shop Management</span>
          </button>
          <button onClick={() => setActiveTab('users')} className={`w-full flex items-center gap-3 rounded-2xl px-4 py-3.5 transition-all outline-none ${activeTab === 'users' ? 'bg-green-100 text-green-700 scale-[0.98] shadow-sm font-black' : 'text-gray-500 hover:bg-surface hover:translate-x-1 font-bold'}`}>
            <UserPlus className={`w-5 h-5 ${activeTab === 'users' ? 'text-green-700' : ''}`} />
            <span className="tracking-wide">User Access</span>
          </button>
        </nav>
      </aside>

      {/* Main Content */}
      <main className="md:pl-64 pt-24 pb-32 px-4 md:px-8 min-h-screen max-w-[1500px] mx-auto animate-in fade-in duration-500">
        
        {activeTab === 'overview' ? (
        <>
        {/* Header Section */}
        <section className="bg-gradient-to-r from-[#e5f638] to-[#f6ff8a] p-8 md:p-10 rounded-[2rem] relative overflow-hidden flex flex-col md:flex-row justify-between items-start md:items-center border border-[#545b00]/10 shadow-sm mb-10 gap-6">
           <div className="relative z-10 w-full md:w-auto">
              <h1 className="text-4xl md:text-5xl font-black font-headline tracking-tighter text-[#545b00] mb-2 leading-tight">Live Operations</h1>
              <p className="text-[#545b00]/80 font-bold text-lg">Currently <span className="text-[#004be2] bg-[#c5d0ff] px-2 rounded underline decoration-wavy underline-offset-4">{activeQueue.length} customers</span> waiting in the digital queue.</p>
           </div>
           
           <div className="flex gap-4 w-full md:w-auto">
             <div className="bg-white/80 backdrop-blur-md px-6 py-4 rounded-3xl shadow-sm text-center flex-1 border border-white/50">
                <p className="text-[10px] uppercase font-black tracking-widest text-[#545b00]/60 mb-1">Today&apos;s Cuts</p>
                <p className="font-headline font-black text-3xl text-[#545b00]">{metrics.todayCuts}</p>
             </div>
             <div className="bg-white/80 backdrop-blur-md px-6 py-4 rounded-3xl shadow-sm text-center flex-1 border border-white/50">
                <p className="text-[10px] uppercase font-black tracking-widest text-[#004be2]/60 mb-1">Today Sales</p>
                <p className="font-headline font-black text-3xl text-[#004be2]">${metrics.todaySales}</p>
             </div>
           </div>

           <div className="absolute right-0 top-0 w-1/3 h-full bg-gradient-to-l from-white/20 to-transparent pointer-events-none mix-blend-overlay"></div>
        </section>

        {/* Queue Management Table */}
        <section className="bg-white rounded-[2rem] overflow-hidden shadow-sm border border-outline-variant/10">
          <div className="px-8 py-6 flex justify-between items-center bg-white border-b border-outline-variant/5">
            <h2 className="font-headline font-bold text-2xl text-on-surface">Queue Control</h2>
            <span className="px-4 py-1.5 bg-[#c5d0ff] text-[#004be2] text-[10px] font-black uppercase tracking-widest rounded-full flex items-center gap-2 shadow-sm border border-[#004be2]/10">
               <span className="w-2 h-2 bg-[#004be2] rounded-full animate-pulse"></span> LIVE SYNC
            </span>
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="text-on-surface-variant text-[10px] font-bold uppercase tracking-widest bg-surface/30 border-b border-outline-variant/5">
                   <th className="px-8 py-4">Status & Name</th>
                   <th className="px-8 py-4">Ticket</th>
                   <th className="px-8 py-4">Contact</th>
                   <th className="px-8 py-4 text-right">Admin Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant/5">
                <AnimatePresence mode="popLayout">
                  {activeQueue.map((q, i) => (
                    <motion.tr 
                      layout
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 10, filter: 'blur(4px)' }}
                      transition={{ duration: 0.3 }}
                      key={q.id} 
                      className="group hover:bg-[#f8fcfd] transition-colors duration-200"
                    >
                      <td className="px-8 py-6">
                        <div className="flex items-center gap-4">
                           <div className={`w-12 h-12 rounded-2xl flex flex-col items-center justify-center font-black ${i === 0 ? 'bg-[#c5d0ff] text-[#004be2] shadow-sm border border-[#004be2]/10' : 'bg-surface-container-low text-on-surface-variant border border-outline-variant/10'}`}>
                              {(q.customer_name || q.profiles?.name) ? (q.customer_name || q.profiles?.name).substring(0, 2).toUpperCase() : 'CU'}
                           </div>
                           <div>
                             <p className="font-bold text-on-surface text-lg">{q.customer_name || q.profiles?.name || 'Customer'}</p>
                             <span className={`font-black text-[10px] uppercase tracking-widest mt-1 inline-block ${q.status === 'CALLED' ? 'text-[#e5f638] bg-[#545b00] px-3 py-1 rounded-full animate-pulse' : (i === 0 ? 'text-[#004be2]' : 'text-on-surface-variant')}`}>
                                {q.status === 'CALLED' ? 'Summoned to chair' : (i === 0 ? 'Next Up' : 'Waiting in Lobby')}
                             </span>
                           </div>
                        </div>
                      </td>
                      <td className="px-8 py-6">
                         <div className="bg-[#1a1a1a] text-[#e5f638] px-4 py-2 rounded-xl inline-flex items-center shadow-inner font-headline font-black">
                            <span className="opacity-50 font-medium mr-1">#</span>{q.queue_number}
                         </div>
                      </td>
                      <td className="px-8 py-6 font-body text-sm font-medium text-on-surface-variant">
                         {q.phone_number || q.profiles?.phone || q.profiles?.email || 'N/A'}
                      </td>
                      <td className="px-8 py-6 text-right">
                         <div className="flex justify-end gap-3 opacity-80 group-hover:opacity-100 transition-opacity">
                           {q.status !== 'CALLED' && (
                               <button 
                                 onClick={() => handleCallCustomer(q.id, q.customer_name || q.profiles?.name || 'Customer', q.phone_number || q.profiles?.phone)}
                                 className="bg-white border border-[#545b00]/10 text-[#545b00] hover:bg-[#e5f638] hover:text-[#545b00] font-bold text-xs uppercase tracking-widest px-4 py-2 rounded-xl transition-colors shadow-sm"
                               >
                                 Call Customer
                               </button>
                           )}
                           
                           {/* Mark Attended -> Completed */}
                           <button 
                             onClick={() => handleMarkAttended(q.id, q.user_id)}
                             className="bg-green-50 border border-green-200 text-green-600 hover:bg-green-500 hover:text-white font-bold text-xs uppercase tracking-widest px-3 py-2 rounded-xl transition-colors shadow-sm flex items-center justify-center"
                             title="Mark as Attended (Charge)"
                           >
                             <Check className="w-5 h-5" />
                           </button>

                           {/* Mark Absent */}
                           <button 
                             onClick={() => handleMarkAbsent(q.id)}
                             className="bg-red-50 border border-red-200 text-red-600 hover:bg-red-500 hover:text-white font-bold text-xs uppercase tracking-widest px-3 py-2 rounded-xl transition-colors shadow-sm flex items-center justify-center"
                             title="Mark as No Show (Absent)"
                           >
                             <UserX className="w-5 h-5" />
                           </button>
                         </div>
                      </td>
                    </motion.tr>
                  ))}
                  
                  {activeQueue.length === 0 && (
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
                 <span className="font-headline text-6xl font-black tracking-tighter leading-none">${metrics.todaySales}</span>
                 <span className="font-headline text-lg font-bold text-[#c5d0ff]">USD</span>
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
        ) : (
        /* -- SHOP MANAGEMENT VIEW -- */
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 max-w-5xl">
           <div className="mb-10">
             <h1 className="text-4xl md:text-5xl font-extrabold font-headline tracking-tighter text-on-surface mb-2">Advanced Shop Control</h1>
             <p className="text-on-surface-variant font-bold text-lg">Manage operations mode, schedule, and active personnel capacity instantly.</p>
           </div>
           
           <section className="space-y-6">
              
              {/* Box 1: Operations Mode */}
              <div className="bg-white rounded-[2rem] shadow-sm border border-outline-variant/10 p-8 md:p-10">
                 <h3 className="font-headline font-black text-xl mb-6 text-on-surface">Operations Mode</h3>
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
                                  : 'bg-[#c5d0ff]/50 border-[#004be2]/20 text-[#004be2]'}`}
                             >
                                <span className={`hidden sm:block w-1.5 h-1.5 rounded-full ${barber.role==='both'?'bg-[#545b00]':barber.role==='queue'?'bg-orange-600':'bg-[#004be2]'}`}></span>
                                {barber.role === 'both' ? 'Walk-in & Slots' : barber.role === 'queue' ? 'Walk-ins Only' : 'Slots Only'}
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
        )}

         {activeTab === 'users' && (
         <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <section className="bg-gradient-to-r from-green-100 to-green-50 p-8 md:p-10 rounded-[2rem] relative overflow-hidden flex flex-col md:flex-row justify-between items-start md:items-center border border-green-200/50 shadow-sm mb-10 gap-6">
               <div className="relative z-10 w-full md:w-auto">
                  <h1 className="text-4xl md:text-5xl font-black font-headline tracking-tighter text-green-900 mb-2 leading-tight">Access Control</h1>
                  <p className="text-green-700 font-bold text-lg">Manage administrator privileges and registered users.</p>
               </div>
            </section>

            <section className="bg-white rounded-[2rem] p-8 md:p-10 shadow-sm border border-outline-variant/10">
               <h2 className="font-headline font-black text-2xl mb-8 text-on-surface">Registered Users</h2>
               
               <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {usersList.length === 0 ? (
                     <div className="col-span-full py-10 text-center text-on-surface-variant font-medium">Loading user profiles... If empty, make sure you ran the SQL setup script!</div>
                  ) : usersList.map((u) => (
                     <div key={u.id} className="p-5 rounded-2xl border border-outline-variant/10 bg-surface flex flex-col gap-4 shadow-sm hover:shadow-md transition-all">
                        <div className="flex justify-between items-start">
                           <div>
                              <p className="font-headline font-black text-lg text-on-surface">{u.name || 'Unnamed'}</p>
                              <p className="font-body text-sm text-on-surface-variant font-medium truncate max-w-[200px]">{u.email}</p>
                              <p className="font-body text-xs text-on-surface-variant mt-1 opacity-70">ID: {u.id.substring(0, 8)}...</p>
                           </div>
                           <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${u.role === 'admin' ? 'bg-[#c5d0ff] text-[#004be2]' : 'bg-surface-container text-on-surface-variant'}`}>
                              {u.role === 'admin' ? 'Admin' : 'User'}
                           </span>
                        </div>
                        <div className="pt-4 border-t border-outline-variant/10 mt-auto">
                           <button 
                              onClick={() => toggleUserRole(u.id, u.role)}
                              className={`w-full py-2.5 rounded-xl font-bold text-sm transition-colors text-center ${u.role === 'admin' ? 'text-red-600 bg-red-50 hover:bg-red-100' : 'text-green-700 bg-green-50 hover:bg-green-100'}`}
                           >
                              {u.role === 'admin' ? 'Revoke Admin' : 'Make Admin'}
                           </button>
                        </div>
                     </div>
                  ))}
               </div>
            </section>
         </div>
         )}

      </main>
    </div>
  )
}
