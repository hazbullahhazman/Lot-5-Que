'use client'

import { useEffect, useState, useMemo, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { createClient as supabase } from '@/utils/supabase/client'
import { motion } from 'framer-motion'
import { Search, DollarSign, Calendar, TrendingUp, Users, User, ArrowUpRight, ArrowDownRight, CreditCard, Banknote, Download, Calculator, Menu, Printer, Plus, Edit3 } from 'lucide-react'
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import AppSidebar from '@/components/AppSidebar'

export default function OwnerDashboardWrapper() {
  return (
     <Suspense fallback={<div className="min-h-screen flex items-center justify-center font-bold">Loading...</div>}>
        <OwnerDashboard />
     </Suspense>
  )
}

function OwnerDashboard() {
  const searchParams = useSearchParams()
  const initialTab = searchParams.get('tab') || 'customers'
  
  const [profile, setProfile] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [activeTab, setActiveTab] = useState(initialTab)
  
  // Payroll States
  const [adjustments, setAdjustments] = useState<any[]>([])
  const [showAdjustmentModal, setShowAdjustmentModal] = useState<string|null>(null) // barber_id
  const [generatePayslipFor, setGeneratePayslipFor] = useState<any|null>(null) // barber Object
  const [expandedBarber, setExpandedBarber] = useState<string|null>(null)
  
  // Data State
  const [transactions, setTransactions] = useState<any[]>([])
  const [barbers, setBarbers] = useState<any[]>([])
  const [pricing, setPricing] = useState<any[]>([])
  const [addons, setAddons] = useState<any[]>([])
  
  // Editor States
  const [showPricingModal, setShowPricingModal] = useState<any|null>(null)
  const [showAddonModal, setShowAddonModal] = useState<any|null>(null)

  useEffect(() => {
    checkOwner()
  }, [])

  const checkOwner = async () => {
     if (!process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL.includes('placeholder')) {
         const role = localStorage.getItem('mock_role') || 'owner'
         if (role !== 'owner') {
             window.location.href = '/login'
         } else {
             setProfile({ id: 'owner-123', name: 'Shop Owner', role })
             fetchData()
         }
         return
     }

     const { data: { session } } = await supabase().auth.getSession()
     if (!session) { window.location.href = '/login'; return }
     
     const { data } = await supabase().from('profiles').select('*').eq('id', session.user.id).single()
     if (!data || data.role !== 'owner') {
         window.location.href = '/dashboard' // Not an owner
         return
     }

     setProfile(data)
     fetchData()
  }

  useEffect(() => {
    const t = searchParams.get('tab')
    if (t) setActiveTab(t)
    else setActiveTab('customers')
  }, [searchParams])

  const fetchData = async () => {
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL.includes('placeholder')) {
        // Mock data
        setBarbers([
           { id: 'b1', name: 'Julian D.', commission_rate: 0.60 },
           { id: 'b2', name: 'Marcus K.', commission_rate: 0.50 }
        ])
        setTransactions([
           { id: 't1', queue_number: '14', customer_name: 'Ahmad Zikri', service_type: 'Student', items: [{name: 'Beard Trim'}], subtotal: 20, tips: 5, total: 25, payment_method: 'cash', barber_name: 'Julian D.', barber_id: 'b1', commission_amount: 15, created_at: new Date().toISOString() },
           { id: 't2', queue_number: '15', customer_name: 'Farhan S.', service_type: 'Staff', items: [], subtotal: 18, tips: 0, total: 18, payment_method: 'qr', barber_name: 'Marcus K.', barber_id: 'b2', commission_amount: 9, created_at: new Date(Date.now() - 3600000).toISOString() }
        ])
        setPricing([
          { id: 'p1', service_type: 'Student', base_price: 15.00, commission_type: 'fixed', barber_cut: 10.00 },
          { id: 'p2', service_type: 'Palapes', base_price: 10.00, commission_type: 'fixed', barber_cut: 8.00 }
        ])
        setAddons([
          { id: 'a1', name: 'Hair Wash', price: 10.00, commission_type: 'percentage', barber_cut: 50.00 }
        ])
        setLoading(false)
        return
    }

    try {
      const b = await supabase().from('profiles').select('*').in('role', ['barber', 'owner', 'admin'])
      if (b.data) setBarbers(b.data)

      const t = await supabase().from('transactions').select('*').order('created_at', { ascending: false })
      if (t.data) setTransactions(t.data)

      const adj = await supabase().from('payroll_adjustments').select('*').order('created_at', { ascending: false })
      if (adj.data) setAdjustments(adj.data)

      const p = await supabase().from('pricing_config').select('*')
      if (p.data) setPricing(p.data)

      const a = await supabase().from('addon_items').select('*')
      if (a.data) setAddons(a.data)

    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  // --- PAYROLL ACTIONS ---
  const handleSavePricing = async (e: React.FormEvent) => {
      e.preventDefault()
      const formData = new FormData(e.target as HTMLFormElement)
      const payload = {
          service_type: formData.get('service_type'),
          base_price: Number(formData.get('base_price')),
          commission_type: formData.get('commission_type'),
          barber_cut: Number(formData.get('barber_cut'))
      }
      
      if (!process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL.includes('placeholder')) {
         if (showPricingModal.id) setPricing(prev => prev.map(p => p.id === showPricingModal.id ? { ...p, ...payload } : p))
         else setPricing(prev => [...prev, { id: Date.now().toString(), ...payload }])
      } else {
         if (showPricingModal.id) await supabase().from('pricing_config').update(payload).eq('id', showPricingModal.id)
         else await supabase().from('pricing_config').insert([payload])
         fetchData()
      }
      setShowPricingModal(null)
  }

  const handleSaveAddon = async (e: React.FormEvent) => {
      e.preventDefault()
      const formData = new FormData(e.target as HTMLFormElement)
      const payload = {
          name: formData.get('name'),
          price: Number(formData.get('price')),
          commission_type: formData.get('commission_type'),
          barber_cut: Number(formData.get('barber_cut')),
          active: true
      }
      
      if (!process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL.includes('placeholder')) {
         if (showAddonModal.id) setAddons(prev => prev.map(a => a.id === showAddonModal.id ? { ...a, ...payload } : a))
         else setAddons(prev => [...prev, { id: Date.now().toString(), ...payload }])
      } else {
         if (showAddonModal.id) await supabase().from('addon_items').update(payload).eq('id', showAddonModal.id)
         else await supabase().from('addon_items').insert([payload])
         fetchData()
      }
      setShowAddonModal(null)
  }

  const handleAddAdjustment = async (e: React.FormEvent) => {
      e.preventDefault()
      const formData = new FormData(e.target as HTMLFormElement)
      const type = formData.get('type') as string
      const description = formData.get('description') as string
      const amount = Number(formData.get('amount'))

      if (!description.trim()) return alert("Description required")

      const now = new Date()
      const currentPeriod = `${String(now.getMonth() + 1).padStart(2, '0')}-${now.getFullYear()}`

      const payload = {
          barber_id: showAdjustmentModal,
          period: currentPeriod,
          type,
          description,
          amount
      }

      if (!process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL.includes('placeholder')) {
         setAdjustments(prev => [...prev, { id: Date.now().toString(), ...payload }])
      } else {
         await supabase().from('payroll_adjustments').insert([payload])
         fetchData()
      }
      setShowAdjustmentModal(null)
  }

  // --- DERIVED METRICS ---
  const today = new Date().toLocaleDateString()
  const todayTransactions = transactions.filter(t => new Date(t.created_at).toLocaleDateString() === today)
  
  const todayTotal = todayTransactions.reduce((acc, t) => acc + Number(t.total), 0)
  const monthTotal = transactions.reduce((acc, t) => acc + Number(t.total), 0) // Approximation for prototype
  const cashToday = todayTransactions.filter(t => t.payment_method === 'cash').reduce((acc, t) => acc + Number(t.total), 0)
  const qrToday = todayTransactions.filter(t => t.payment_method === 'qr').reduce((acc, t) => acc + Number(t.total), 0)

  const chartData = useMemo(() => {
     // Create a real grouping of today's transactions by hour
     const hoursMap: Record<number, {cash: number, qr: number}> = {}
     for (let h = 9; h <= 21; h += 2) {
         hoursMap[h] = { cash: 0, qr: 0 }
     }
     
     todayTransactions.forEach(t => {
         const hour = new Date(t.created_at).getHours()
         // Snap to closest 2-hour interval
         const bucket = Math.max(9, Math.min(21, Math.floor(hour / 2) * 2 + (hour % 2 === 0 ? 0 : -1)))
         if (hoursMap[bucket]) {
             if (t.payment_method === 'cash') hoursMap[bucket].cash += Number(t.total)
             if (t.payment_method === 'qr') hoursMap[bucket].qr += Number(t.total)
         }
     })

     return Object.entries(hoursMap).map(([h, data]) => ({
         name: `${h}:00`,
         Cash: data.cash,
         QR: data.qr,
         Total: data.cash + data.qr
     }))
  }, [todayTransactions])

  if (loading || !profile) return <div className="min-h-screen flex items-center justify-center p-10 font-bold text-lg text-on-surface">Loading Dashboard...</div>

  return (
    <div className="min-h-screen bg-[#f4f7f6] font-body text-on-surface pb-20 md:pb-0">
      
      {/* Mobile Top Header (when sidebar is hidden on small screens) */}
      <div className="md:hidden flex items-center justify-between bg-white px-4 py-4 border-b border-outline-variant/10">
         <button onClick={() => setSidebarOpen(true)} className="p-2 bg-surface rounded-xl hover:bg-surface-container-high transition-colors">
            <Menu className="w-5 h-5 text-on-surface" />
         </button>
         <span className="text-xl font-black tracking-tighter text-[#596000] font-headline">Lot 5<span className="text-[#004be2]">.</span></span>
      </div>

      <AppSidebar 
         sidebarOpen={sidebarOpen} 
         setSidebarOpen={setSidebarOpen} 
         activeTab={activeTab} 
         onTabChange={setActiveTab}
         profile={profile} 
      />

      {/* Main Content Area matched to Admin padding */}
      <main className="md:pl-64 flex-1 overflow-y-auto px-4 md:px-10 py-8 max-w-[1500px] mx-auto animate-in fade-in duration-500">
         
         {activeTab === 'customers' && (
         <>
         {/* Top Header */}
         <div className="flex justify-between items-center mb-8">
             <div className="flex-1 max-w-xl">
                <div className="bg-white rounded-full flex items-center px-4 py-2 border border-outline-variant/10 focus-within:ring-2 focus-within:ring-[#004be2]/20">
                   <Search className="w-4 h-4 text-on-surface-variant mr-3"/>
                   <input type="text" placeholder="Search transactions, customers..." className="bg-transparent border-none outline-none w-full text-sm font-bold opacity-70" />
                </div>
             </div>
             <div className="flex items-center gap-4 ml-4">
                <button className="bg-[#e5f638] text-[#545b00] px-4 py-2 rounded-full font-bold text-xs uppercase tracking-widest shadow-sm hover:scale-105 transition-transform" onClick={() => window.location.href = '/pos'}>
                   Launch POS
                </button>
             </div>
         </div>

         {/* Dashboard Title */}
         <div className="flex justify-between items-end mb-8">
            <div>
               <h1 className="font-headline font-black text-3xl md:text-4xl text-[#545b00] tracking-tight">Lot 5 Dashboard</h1>
               <p className="font-medium text-on-surface-variant">Performance summary for <strong className="text-[#004be2]">Today, {new Date().toLocaleDateString('en-US', {month: 'short', day: 'numeric'})}</strong></p>
            </div>
            <div className="hidden sm:flex gap-3">
               <button className="bg-white border border-outline-variant/20 px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 hover:bg-surface-container transition-colors">
                  <Calendar className="w-4 h-4 opacity-50"/> Select Date
               </button>
               <button className="bg-[#004be2] text-white px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 hover:bg-[#004be2]/90 transition-colors shadow-sm">
                  <Download className="w-4 h-4"/> Export PDF
               </button>
            </div>
         </div>

         {/* 3A. Summary Cards */}
         <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6 mb-8">
             {[
                 { label: 'Total Sales Today', value: todayTotal, diff: '+12%', up: true },
                 { label: 'This Month', value: monthTotal, diff: '+5.4%', up: true, primary: true },
                 { label: 'Cash Today', value: cashToday, diff: '-2%', up: false },
                { label: 'QR / Transfer', value: qrToday, bg: 'bg-[#e5f638]' }
             ].map((card, i) => (
                 <div key={i} className={`${card.bg || 'bg-white'} p-6 rounded-[2rem] shadow-sm border border-outline-variant/5 relative overflow-hidden group hover:shadow-md transition-shadow`}>
                    <p className={`text-[10px] font-black uppercase tracking-widest mb-3 ${card.bg ? 'text-[#545b00]' : 'text-on-surface-variant'}`}>{card.label}</p>
                    <div className="flex items-end gap-2">
                       <h3 className={`font-headline text-3xl md:text-4xl font-black tracking-tighter ${card.primary ? 'text-on-surface' : card.bg ? 'text-[#545b00]' : 'text-[#545b00]'}`}>
                          ${card.value.toFixed(2)}
                       </h3>
                       {card.diff && (
                          <span className={`text-[10px] font-bold mb-1 flex items-center ${card.up ? 'text-green-600' : 'text-red-500'}`}>
                             {card.up ? <ArrowUpRight className="w-3 h-3"/> : <ArrowDownRight className="w-3 h-3"/>}
                             {card.diff}
                          </span>
                       )}
                    </div>
                 </div>
             ))}
         </div>

         <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
            
            {/* 3B. Daily Sales Chart */}
            <div className="bg-white p-6 md:p-8 rounded-[2rem] shadow-sm border border-outline-variant/10 lg:col-span-2">
               <div className="flex justify-between items-center mb-8">
                  <div>
                     <h2 className="font-headline text-xl font-bold text-on-surface">Daily Revenue Flow</h2>
                     <p className="text-sm font-medium text-on-surface-variant">Hourly breakdown of today's service volume</p>
                  </div>
                  <div className="flex items-center gap-4 text-[10px] font-black uppercase tracking-widest text-[#545b00]">
                     <span className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-[#545b00]"></div> Services</span>
                  </div>
               </div>
               
               <div className="h-[250px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                      <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#6b7280', fontWeight: 'bold' }} dy={10} />
                      <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#6b7280' }} />
                      <Tooltip 
                         cursor={{fill: '#f8fcfd'}}
                         contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)', fontWeight: 'bold' }}
                      />
                      <Bar dataKey="Cash" stackId="a" fill="#e5f638" radius={[0,0,4,4]} />
                      <Bar dataKey="QR" stackId="a" fill="#c5d0ff" radius={[4,4,0,0]} />
                    </BarChart>
                  </ResponsiveContainer>
               </div>
            </div>

            {/* 3D. Mini Live Log */}
            <div className="bg-white p-6 md:p-8 rounded-[2rem] shadow-sm border border-outline-variant/10 flex flex-col">
               <div className="flex justify-between items-center mb-6">
                  <h2 className="font-headline text-xl font-bold text-on-surface">Live Log</h2>
                  <span className="bg-[#c5d0ff] text-[#004be2] text-[9px] font-black uppercase tracking-widest px-3 py-1 rounded-full">Recent</span>
               </div>
               <div className="space-y-4 flex-1">
                  {transactions.slice(0, 4).map(t => (
                     <div key={t.id} className="flex justify-between items-center p-3 hover:bg-surface-container rounded-2xl transition-colors cursor-pointer group">
                        <div className="flex items-center gap-3">
                           <div className="w-10 h-10 rounded-xl bg-[#c5d0ff]/50 flex justify-center items-center text-[#004be2]">
                              <User className="w-5 h-5"/>
                           </div>
                           <div>
                              <p className="font-bold text-sm text-on-surface leading-tight">{t.customer_name}</p>
                              <p className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest">{t.service_type}</p>
                           </div>
                        </div>
                        <div className="text-right">
                           <p className="font-black text-sm text-on-surface leading-tight">${Number(t.total).toFixed(2)}</p>
                           <p className="text-[10px] font-medium text-on-surface-variant">{new Date(t.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</p>
                        </div>
                     </div>
                  ))}
               </div>
               <button className="w-full mt-4 py-3 text-xs font-bold text-[#004be2] hover:bg-[#c5d0ff]/20 rounded-xl transition-colors flex items-center justify-center gap-2">
                  View All History <ArrowUpRight className="w-3 h-3"/>
               </button>
            </div>

         </div>

         {/* 3C. Staff Commission Table */}
         <div className="bg-white p-6 md:p-8 rounded-[2rem] shadow-sm border border-outline-variant/10">
            <div className="flex justify-between items-center mb-8">
               <div>
                  <h2 className="font-headline text-2xl font-bold text-on-surface text-[#004be2]">Staff Commission</h2>
                  <p className="text-sm font-medium text-on-surface-variant">Performance metrics and payout calculations</p>
               </div>
               <span className="bg-[#e5f638] text-[#545b00] text-[9px] font-black uppercase tracking-widest px-4 py-1.5 rounded-full shadow-sm">Current Period</span>
            </div>

            <div className="overflow-x-auto">
               <table className="w-full text-left">
                  <thead>
                     <tr className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant border-b border-outline-variant/10">
                        <th className="pb-4">Barber</th>
                        <th className="pb-4 text-center">Cuts</th>
                        <th className="pb-4 text-center">Gross Sales</th>
                        <th className="pb-4 text-center">Commission</th>
                        <th className="pb-4 text-center">Tips</th>
                        <th className="pb-4 text-right">Total Payout</th>
                     </tr>
                  </thead>
                  <tbody className="divide-y divide-outline-variant/5">
                     {barbers.map(b => {
                         const bTransactions = transactions.filter(t => t.barber_id === b.id)
                         const cuts = bTransactions.length
                         const gross = bTransactions.reduce((acc, t) => acc + Number(t.subtotal), 0)
                         const comm = bTransactions.reduce((acc, t) => acc + Number(t.commission_amount), 0)
                         const tips = bTransactions.reduce((acc, t) => acc + Number(t.tips), 0)
                         
                         return (
                            <tr key={b.id} className="hover:bg-surface/50 group transition-colors">
                               <td className="py-4">
                                  <div className="flex items-center gap-3">
                                     <div className="w-8 h-8 rounded-full bg-surface-container flex items-center justify-center border shadow-sm overflow-hidden">
                                        <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${b.name}`} alt="avatar" className="w-full h-full text-xs" />
                                     </div>
                                     <span className="font-bold text-sm text-on-surface">{b.name}</span>
                                  </div>
                               </td>
                               <td className="py-4 text-center font-bold text-sm">{cuts}</td>
                               <td className="py-4 text-center font-black text-sm">${gross.toFixed(2)}</td>
                               <td className="py-4 text-center text-sm"><span className="text-[#004be2] font-bold bg-[#c5d0ff]/30 px-3 py-1 rounded-full">${comm.toFixed(2)} ({(b.commission_rate * 100).toFixed(0)}%)</span></td>
                               <td className="py-4 text-center text-sm font-medium text-on-surface-variant">${tips.toFixed(2)}</td>
                               <td className="py-4 text-right">
                                  <span className="bg-[#e5f638] text-[#545b00] font-black px-4 py-1.5 rounded-xl shadow-sm border border-[#545b00]/10">
                                     ${(comm + tips).toFixed(2)}
                                  </span>
                               </td>
                            </tr>
                         )
                     })}
                  </tbody>
               </table>
            </div>
         </div>
         </>
         )}

         {activeTab === 'payroll' && (
         <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 max-w-6xl">
            <div className="mb-10">
               <h1 className="text-4xl md:text-5xl font-extrabold font-headline tracking-tighter text-on-surface mb-2">Payroll & Commission</h1>
               <p className="text-on-surface-variant font-bold text-lg">Automated payout summaries derived directly from POS transaction logs.</p>
            </div>

            <div className="bg-white p-6 md:p-8 rounded-[2rem] shadow-sm border border-outline-variant/10 mb-8">
               <div className="flex justify-between items-center mb-8">
                  <div>
                     <h2 className="font-headline text-2xl font-bold text-on-surface text-[#004be2]">Staff Ledger</h2>
                     <p className="text-sm font-medium text-on-surface-variant">Review automatic derivations and add custom adjustments.</p>
                  </div>
                  <span className="bg-[#e5f638] text-[#545b00] font-black uppercase tracking-widest px-4 py-1.5 rounded-full shadow-sm flex items-center gap-2">
                     <Calendar className="w-4 h-4"/> April 2026
                  </span>
               </div>

               <div className="space-y-6">
                  {barbers.map(b => {
                      const bTransactions = transactions.filter(t => t.barber_id === b.id)
                      const cuts = bTransactions.length
                      const commSubtotal = bTransactions.reduce((acc, t) => acc + Number(t.commission_amount), 0)
                      
                      const bAdj = adjustments.filter(a => a.barber_id === b.id)
                      const benefitsTotal = bAdj.filter(a => a.type === 'benefit').reduce((acc, a) => acc + Number(a.amount), 0)
                      const deductionsTotal = bAdj.filter(a => a.type === 'deduction').reduce((acc, a) => acc + Number(a.amount), 0)
                      
                      const netPay = commSubtotal + benefitsTotal - deductionsTotal
                       
                       const servicesGrouped = bTransactions.reduce((acc: any, t: any) => {
                           const kind = t.service_type || 'General Service'
                           if (!acc[kind]) acc[kind] = { count: 0, comm: 0 }
                           acc[kind].count += 1
                           acc[kind].comm += Number(t.commission_amount)
                           return acc
                       }, {})

                       return (
                          <div key={b.id} className="bg-surface-container-lowest border border-outline-variant/20 rounded-2xl transition-all shadow-sm overflow-hidden text-left">
                             <button onClick={() => setExpandedBarber(expandedBarber === b.id ? null : b.id)} className="w-full relative px-6 py-5 hover:bg-surface-container-low transition-colors text-left flex flex-col md:flex-row justify-between items-start md:items-center gap-6 group">
                                <div className="flex items-center gap-4">
                                   <div className={`w-12 h-12 rounded-2xl flex items-center justify-center border shadow-sm shrink-0 transition-colors ${expandedBarber === b.id ? 'bg-[#c5d0ff] text-[#004be2] border-transparent' : 'bg-surface text-on-surface-variant'}`}>
                                      <User className="w-6 h-6" />
                                   </div>
                                   <div>
                                      <h3 className="font-headline font-black text-xl leading-none group-hover:text-[#004be2] transition-colors">{b.name}</h3>
                                      <p className="text-xs font-bold text-on-surface-variant uppercase tracking-widest mt-1 opacity-70">{cuts} Customers Served</p>
                                   </div>
                                </div>

                                <div className="flex gap-6 w-full md:w-auto overflow-x-auto pb-2 md:pb-0">
                                   <div>
                                      <p className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant mb-1 line-clamp-1">Base Comm.</p>
                                      <p className="font-black text-lg text-on-surface">RM {commSubtotal.toFixed(2)}</p>
                                   </div>
                                   <div>
                                      <p className="text-[10px] font-black uppercase tracking-widest text-[#10B981] mb-1">Benefits</p>
                                      <p className="font-black text-lg text-[#10B981]">+RM {benefitsTotal.toFixed(2)}</p>
                                   </div>
                                   <div>
                                      <p className="text-[10px] font-black uppercase tracking-widest text-red-600 mb-1">Deductions</p>
                                      <p className="font-black text-lg text-red-600">-RM {deductionsTotal.toFixed(2)}</p>
                                   </div>
                                   <div className="bg-[#e5f638]/20 px-4 py-2 rounded-xl flex flex-col justify-center border border-[#545b00]/10 shrink-0">
                                      <p className="text-[10px] font-black uppercase tracking-widest text-[#545b00] mb-0.5">Net Pay</p>
                                      <p className="font-black text-xl text-[#545b00] leading-none">RM {netPay.toFixed(2)}</p>
                                   </div>
                                </div>

                                <div className="flex gap-2 w-full md:w-auto shrink-0 justify-end md:justify-start -mb-2 md:mb-0">
                                   <div onClick={(e) => { e.stopPropagation(); setShowAdjustmentModal(b.id) }} className="p-3 bg-white border border-outline-variant/20 rounded-xl hover:bg-surface-container text-on-surface transition-colors shadow-sm cursor-pointer" title="Add Adjustment">
                                      <Edit3 className="w-5 h-5" />
                                   </div>
                                   <div onClick={(e) => { e.stopPropagation(); setGeneratePayslipFor({ barber: b, bTransactions, cuts, commSubtotal, bAdj, benefitsTotal, deductionsTotal, netPay }) }} className="flex items-center gap-2 px-4 py-3 bg-[#004be2] text-white rounded-xl hover:bg-[#004be2]/90 font-bold text-sm tracking-wide transition-colors shadow-md shrink-0 cursor-pointer">
                                      <Printer className="w-4 h-4" /> Generate Slip
                                   </div>
                                </div>
                             </button>

                             {/* BREAKDOWN PANEL */}
                             {expandedBarber === b.id && (
                                <div className="border-t border-outline-variant/10 bg-[#f8fbff] p-6 lg:px-8">
                                   <h4 className="font-headline font-black text-lg text-[#004be2] mb-4">Service Breakdown for {b.name}</h4>
                                   
                                   {Object.keys(servicesGrouped).length === 0 ? (
                                      <p className="text-sm font-medium text-on-surface-variant italic">No services recorded for this period.</p>
                                   ) : (
                                      <div className="overflow-x-auto">
                                         <table className="w-full text-left text-sm max-w-2xl">
                                            <thead>
                                               <tr className="border-b border-black/10 uppercase text-[10px] tracking-widest opacity-60">
                                                  <th className="pb-3">Service Provided</th>
                                                  <th className="pb-3 text-center">Total Serviced</th>
                                                  <th className="pb-3 text-right">Commission Earned</th>
                                               </tr>
                                            </thead>
                                            <tbody>
                                               {Object.entries(servicesGrouped).map(([kind, data]: any) => (
                                                  <tr key={kind} className="border-b border-black/5 hover:bg-[#e6f0ff]/50 transition-colors">
                                                     <td className="py-3 font-bold text-on-surface">{kind}</td>
                                                     <td className="py-3 text-center font-medium">{data.count}</td>
                                                     <td className="py-3 text-right font-black text-[#545b00]">RM {data.comm.toFixed(2)}</td>
                                                  </tr>
                                               ))}
                                            </tbody>
                                            <tfoot>
                                               <tr>
                                                  <td className="pt-3 font-black text-on-surface text-[10px] uppercase tracking-widest">Total</td>
                                                  <td className="pt-3 text-center font-black">{cuts}</td>
                                                  <td className="pt-3 text-right font-black text-[#545b00] text-lg">RM {commSubtotal.toFixed(2)}</td>
                                               </tr>
                                            </tfoot>
                                         </table>
                                      </div>
                                   )}
                                </div>
                             )}
                          </div>
                      )
                  })}
               </div>
            </div>
         </div>
         )}
      {/* Adjustments Modal */}
      {showAdjustmentModal && (
         <div className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="bg-white rounded-[2rem] p-8 max-w-md w-full shadow-2xl">
               <h3 className="font-headline font-black text-2xl mb-2">Add Adjustment</h3>
               <p className="text-sm font-medium text-on-surface-variant mb-6">Record a benefit or deduction for the pay period.</p>
               
               <form onSubmit={handleAddAdjustment} className="space-y-4">
                  <div>
                     <label className="text-xs font-bold text-on-surface-variant uppercase tracking-widest mb-2 block">Adjustment Type</label>
                     <select name="type" className="w-full bg-surface border border-outline-variant/20 rounded-xl px-4 py-3 font-bold text-sm outline-none">
                        <option value="benefit">Benefit / Bonus (+)</option>
                        <option value="deduction">Deduction / Penalty (-)</option>
                     </select>
                  </div>
                  <div>
                     <label className="text-xs font-bold text-on-surface-variant uppercase tracking-widest mb-2 block">Description</label>
                     <input name="description" type="text" placeholder="e.g. Perfect Attendance" required className="w-full bg-surface border border-outline-variant/20 rounded-xl px-4 py-3 font-bold text-sm outline-none" />
                  </div>
                  <div>
                     <label className="text-xs font-bold text-on-surface-variant uppercase tracking-widest mb-2 block">Amount (RM)</label>
                     <input name="amount" type="number" step="0.01" min="0" placeholder="0.00" required className="w-full bg-surface border border-outline-variant/20 rounded-xl px-4 py-3 font-bold text-sm outline-none" />
                  </div>
                  <div className="flex gap-4 pt-4">
                     <button type="button" onClick={() => setShowAdjustmentModal(null)} className="flex-1 py-3 font-bold text-sm bg-surface-container rounded-xl hover:bg-surface-container-high transition-colors text-on-surface cursor-pointer">Cancel</button>
                     <button type="submit" className="flex-1 py-3 font-bold text-sm bg-black text-white rounded-xl hover:bg-black/80 transition-colors shadow-sm cursor-pointer">Save</button>
                  </div>
               </form>
            </motion.div>
         </div>
      )}

      {/* Generated Payslip Overlay (Print View) */}
      {generatePayslipFor && (
         <div className="fixed inset-0 z-[70] bg-surface-container-high flex items-center justify-center p-4">
            <div className="absolute top-4 right-4 flex gap-4 print:hidden">
               <button onClick={() => setGeneratePayslipFor(null)} className="px-4 py-2 bg-white rounded-full font-bold shadow-sm text-on-surface border border-outline-variant/20 hover:bg-surface-container transition-colors cursor-pointer">Close</button>
               <button onClick={() => window.print()} className="px-4 py-2 bg-[#004be2] text-white rounded-full font-bold shadow-sm flex items-center gap-2 hover:bg-[#004be2]/90 transition-colors cursor-pointer"><Printer className="w-4 h-4"/> Print PDF</button>
            </div>

            {/* A4 Format Container */}
            <div className="bg-white w-[800px] h-max max-h-[90vh] overflow-y-auto print:max-h-none print:overflow-visible p-12 shadow-2xl relative border border-outline-variant/10 text-black">
               
               <div className="text-center mb-10 pb-6 border-b-2 border-black">
                  <h1 className="font-headline font-black text-3xl tracking-widest uppercase mb-1">Lot 5 Barbershop</h1>
                  <p className="text-sm font-bold opacity-60 uppercase tracking-widest">UTM Skudai &mdash; Official Payslip</p>
               </div>

               <div className="flex justify-between mb-10">
                  <div>
                     <p className="text-[10px] font-black uppercase tracking-widest opacity-50 mb-1">Barber Name</p>
                     <p className="font-bold text-xl">{generatePayslipFor.barber.name}</p>
                  </div>
                  <div className="text-right">
                     <p className="text-[10px] font-black uppercase tracking-widest opacity-50 mb-1">Pay Period</p>
                     <p className="font-bold text-xl">April 2026</p>
                     <p className="text-xs font-medium uppercase mt-2">Issued: {new Date().toLocaleDateString()}</p>
                  </div>
               </div>

               <div className="mb-6">
                  <h3 className="font-black bg-[#f4f7f6] px-4 py-2 uppercase tracking-widest text-sm mb-4">Commission Breakdown</h3>
                  <table className="w-full text-sm">
                     <thead>
                        <tr className="border-b border-black/10 uppercase text-[10px] tracking-widest opacity-60">
                           <th className="text-left pb-2">Service</th>
                           <th className="text-center pb-2">Count</th>
                           <th className="text-right pb-2">Commission Earned</th>
                        </tr>
                     </thead>
                     <tbody>
                        <tr>
                           <td className="py-4 font-bold">Automated POS Service Logging</td>
                           <td className="py-4 text-center">{generatePayslipFor.cuts} pax</td>
                           <td className="py-4 text-right font-bold text-[#004be2]">RM {generatePayslipFor.commSubtotal.toFixed(2)}</td>
                        </tr>
                     </tbody>
                  </table>
               </div>

               <div className="mb-6">
                  <h3 className="font-black bg-[#f4f7f6] px-4 py-2 uppercase tracking-widest text-sm mb-4">Benefits & Adjustments</h3>
                  {generatePayslipFor.bAdj.filter((a:any) => a.type === 'benefit').length > 0 ? (
                     <table className="w-full text-sm mb-4">
                        <tbody>
                           {generatePayslipFor.bAdj.filter((a:any) => a.type === 'benefit').map((a:any) => (
                              <tr key={a.id} className="border-b border-black/5">
                                 <td className="py-2">{a.description}</td>
                                 <td className="py-2 text-right text-[#10B981]">RM {Number(a.amount).toFixed(2)}</td>
                              </tr>
                           ))}
                        </tbody>
                     </table>
                  ) : <p className="text-sm italic opacity-50 pl-4">No benefits recorded.</p>}
               </div>

               <div className="mb-10">
                  <h3 className="font-black bg-[#f4f7f6] px-4 py-2 uppercase tracking-widest text-sm mb-4">Deductions</h3>
                  {generatePayslipFor.bAdj.filter((a:any) => a.type === 'deduction').length > 0 ? (
                     <table className="w-full text-sm text-red-700">
                        <tbody>
                           {generatePayslipFor.bAdj.filter((a:any) => a.type === 'deduction').map((a:any) => (
                              <tr key={a.id} className="border-b border-black/5">
                                 <td className="py-2">{a.description}</td>
                                 <td className="py-2 text-right">-RM {Number(a.amount).toFixed(2)}</td>
                              </tr>
                           ))}
                        </tbody>
                     </table>
                  ) : <p className="text-sm italic opacity-50 pl-4">No deductions recorded.</p>}
               </div>

               <div className="border-t-2 border-black pt-4 flex justify-between items-center mb-16">
                  <span className="font-headline font-black text-2xl uppercase tracking-widest">Net Pay</span>
                  <span className="font-headline font-black text-4xl text-[#545b00]">RM {generatePayslipFor.netPay.toFixed(2)}</span>
               </div>

               <div className="flex justify-between items-end pt-10">
                  <div className="w-48 text-center pt-8 border-t border-black/20">
                     <p className="text-xs font-bold uppercase tracking-widest">Employer Signature</p>
                  </div>
                  <div className="w-48 text-center pt-8 border-t border-black/20">
                     <p className="text-xs font-bold uppercase tracking-widest">Employee Acknowledgement</p>
                  </div>
               </div>

            </div>
         </div>
      )}

      {/* --- PRICING & SERVICES VIEW --- */}
      {activeTab === 'pricing' && (
         <div className="space-y-8 animate-in fade-in duration-300">
             <div className="flex justify-between items-end mb-8">
                <div>
                   <h1 className="font-headline font-black text-3xl md:text-4xl text-[#545b00] tracking-tight">Pricing & Services</h1>
                   <p className="font-medium text-on-surface-variant">Manage exactly how much you charge and how much barbers earn.</p>
                </div>
             </div>

             {/* Services Table */}
             <div className="bg-white rounded-[2rem] shadow-sm border border-outline-variant/10 overflow-hidden">
                 <div className="px-6 py-5 border-b border-outline-variant/10 flex justify-between items-center bg-surface-container-lowest">
                    <h2 className="font-headline font-bold text-xl">Main Services (Haircuts)</h2>
                    <button onClick={() => setShowPricingModal({})} className="bg-[#004be2] text-white px-4 py-2 rounded-full font-bold text-xs uppercase tracking-widest shadow-sm hover:scale-105 flex items-center gap-2">
                       <Plus className="w-4 h-4"/> Add Service
                    </button>
                 </div>
                 <div className="overflow-x-auto">
                    <table className="w-full text-left">
                       <thead className="bg-surface/50 text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">
                          <tr>
                             <th className="px-6 py-4">Title</th>
                             <th className="px-6 py-4 text-center">Customer Price</th>
                             <th className="px-6 py-4 text-center">Barber Commission</th>
                             <th className="px-6 py-4 text-right">Actions</th>
                          </tr>
                       </thead>
                       <tbody className="divide-y divide-outline-variant/5">
                          {pricing.map(p => (
                             <tr key={p.id} className="hover:bg-surface-container-lowest">
                                <td className="px-6 py-4 font-bold">{p.service_type}</td>
                                <td className="px-6 py-4 text-center font-bold text-[#004be2]">RM {Number(p.base_price).toFixed(2)}</td>
                                <td className="px-6 py-4 text-center font-bold text-[#545b00]">
                                   {p.commission_type === 'fixed' ? `Flat RM ${Number(p.barber_cut).toFixed(2)}` : `${Number(p.barber_cut)}%`}
                                </td>
                                <td className="px-6 py-4 text-right">
                                   <button onClick={() => setShowPricingModal(p)} className="text-on-surface-variant hover:text-[#004be2] p-2 bg-surface rounded-lg">
                                      <Edit3 className="w-4 h-4"/>
                                   </button>
                                </td>
                             </tr>
                          ))}
                          {pricing.length === 0 && <tr><td colSpan={4} className="text-center py-8 opacity-50 italic">No services configured.</td></tr>}
                       </tbody>
                    </table>
                 </div>
             </div>

             {/* Addons Table */}
             <div className="bg-white rounded-[2rem] shadow-sm border border-outline-variant/10 overflow-hidden">
                 <div className="px-6 py-5 border-b border-outline-variant/10 flex justify-between items-center bg-surface-container-lowest">
                    <h2 className="font-headline font-bold text-xl">Add-ons & Extras</h2>
                    <button onClick={() => setShowAddonModal({})} className="bg-[#e5f638] text-[#545b00] px-4 py-2 rounded-full font-bold text-xs uppercase tracking-widest shadow-sm hover:scale-105 flex items-center gap-2">
                       <Plus className="w-4 h-4"/> Add Extra
                    </button>
                 </div>
                 <div className="overflow-x-auto">
                    <table className="w-full text-left">
                       <thead className="bg-surface/50 text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">
                          <tr>
                             <th className="px-6 py-4">Title</th>
                             <th className="px-6 py-4 text-center">Customer Price</th>
                             <th className="px-6 py-4 text-center">Barber Commission</th>
                             <th className="px-6 py-4 text-right">Actions</th>
                          </tr>
                       </thead>
                       <tbody className="divide-y divide-outline-variant/5">
                          {addons.map(a => (
                             <tr key={a.id} className="hover:bg-surface-container-lowest">
                                <td className="px-6 py-4 font-bold">{a.name}</td>
                                <td className="px-6 py-4 text-center font-bold text-[#004be2]">RM {Number(a.price).toFixed(2)}</td>
                                <td className="px-6 py-4 text-center font-bold text-[#545b00]">
                                   {a.commission_type === 'fixed' ? `Flat RM ${Number(a.barber_cut).toFixed(2)}` : `${Number(a.barber_cut)}%`}
                                </td>
                                <td className="px-6 py-4 text-right">
                                   <button onClick={() => setShowAddonModal(a)} className="text-on-surface-variant hover:text-[#004be2] p-2 bg-surface rounded-lg">
                                      <Edit3 className="w-4 h-4"/>
                                   </button>
                                </td>
                             </tr>
                          ))}
                          {addons.length === 0 && <tr><td colSpan={4} className="text-center py-8 opacity-50 italic">No add-ons configured.</td></tr>}
                       </tbody>
                    </table>
                 </div>
             </div>
         </div>
      )}

      {/* PRICING MODAL */}
      {showPricingModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
             <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setShowPricingModal(null)}></div>
             <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="bg-white rounded-3xl p-6 md:p-8 shadow-2xl relative z-10 w-full max-w-md border border-outline-variant/10">
                <h3 className="font-headline font-black text-2xl mb-6">{showPricingModal.id ? 'Edit Service' : 'Add New Service'}</h3>
                <form onSubmit={handleSavePricing} className="space-y-4">
                   <div>
                      <label className="text-xs font-bold uppercase tracking-widest text-on-surface-variant mb-2 block">Service Title</label>
                      <input name="service_type" defaultValue={showPricingModal.service_type} required type="text" className="w-full bg-surface border border-outline-variant/20 rounded-xl px-4 py-3 font-bold outline-none focus:border-[#004be2] transition-colors" placeholder="e.g. Student Cut" />
                   </div>
                   <div>
                      <label className="text-xs font-bold uppercase tracking-widest text-on-surface-variant mb-2 block">Customer Price (RM)</label>
                      <input name="base_price" defaultValue={showPricingModal.base_price} required type="number" step="0.01" className="w-full bg-surface border border-outline-variant/20 rounded-xl px-4 py-3 font-bold outline-none focus:border-[#004be2] transition-colors" placeholder="15.00" />
                   </div>
                   <div className="grid grid-cols-2 gap-4">
                      <div>
                         <label className="text-xs font-bold uppercase tracking-widest text-on-surface-variant mb-2 block">Comm. Type</label>
                         <select name="commission_type" defaultValue={showPricingModal.commission_type || 'fixed'} className="w-full bg-surface border border-outline-variant/20 rounded-xl px-4 py-3 font-bold outline-none focus:border-[#004be2] transition-colors">
                            <option value="fixed">Flat RM</option>
                            <option value="percentage">Percentage %</option>
                         </select>
                      </div>
                      <div>
                         <label className="text-xs font-bold uppercase tracking-widest text-on-surface-variant mb-2 block">Barber Cut</label>
                         <input name="barber_cut" defaultValue={showPricingModal.barber_cut} required type="number" step="0.01" className="w-full bg-surface border border-outline-variant/20 rounded-xl px-4 py-3 font-bold outline-none focus:border-[#004be2] transition-colors" placeholder="10.00 or 50" />
                      </div>
                   </div>
                   <div className="flex gap-3 pt-4">
                      <button type="button" onClick={() => setShowPricingModal(null)} className="flex-1 py-3 bg-surface hover:bg-surface-container rounded-xl font-bold transition-colors">Cancel</button>
                      <button type="submit" className="flex-1 py-3 bg-[#004be2] text-white rounded-xl font-bold shadow-md shadow-[#004be2]/20">Save Service</button>
                   </div>
                </form>
             </motion.div>
          </div>
      )}

      {/* ADDON MODAL */}
      {showAddonModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
             <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setShowAddonModal(null)}></div>
             <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="bg-white rounded-3xl p-6 md:p-8 shadow-2xl relative z-10 w-full max-w-md border border-outline-variant/10">
                <h3 className="font-headline font-black text-2xl mb-6">{showAddonModal.id ? 'Edit Add-on' : 'Add New Extra'}</h3>
                <form onSubmit={handleSaveAddon} className="space-y-4">
                   <div>
                      <label className="text-xs font-bold uppercase tracking-widest text-on-surface-variant mb-2 block">Add-on Title</label>
                      <input name="name" defaultValue={showAddonModal.name} required type="text" className="w-full bg-surface border border-outline-variant/20 rounded-xl px-4 py-3 font-bold outline-none focus:border-[#004be2] transition-colors" placeholder="e.g. Hair Wash" />
                   </div>
                   <div>
                      <label className="text-xs font-bold uppercase tracking-widest text-on-surface-variant mb-2 block">Customer Price (RM)</label>
                      <input name="price" defaultValue={showAddonModal.price} required type="number" step="0.01" className="w-full bg-surface border border-outline-variant/20 rounded-xl px-4 py-3 font-bold outline-none focus:border-[#004be2] transition-colors" placeholder="10.00" />
                   </div>
                   <div className="grid grid-cols-2 gap-4">
                      <div>
                         <label className="text-xs font-bold uppercase tracking-widest text-on-surface-variant mb-2 block">Comm. Type</label>
                         <select name="commission_type" defaultValue={showAddonModal.commission_type || 'percentage'} className="w-full bg-surface border border-outline-variant/20 rounded-xl px-4 py-3 font-bold outline-none focus:border-[#004be2] transition-colors">
                            <option value="fixed">Flat RM</option>
                            <option value="percentage">Percentage %</option>
                         </select>
                      </div>
                      <div>
                         <label className="text-xs font-bold uppercase tracking-widest text-on-surface-variant mb-2 block">Barber Cut</label>
                         <input name="barber_cut" defaultValue={showAddonModal.barber_cut} required type="number" step="0.01" className="w-full bg-surface border border-outline-variant/20 rounded-xl px-4 py-3 font-bold outline-none focus:border-[#004be2] transition-colors" placeholder="10.00 or 50" />
                      </div>
                   </div>
                   <div className="flex gap-3 pt-4">
                      <button type="button" onClick={() => setShowAddonModal(null)} className="flex-1 py-3 bg-surface hover:bg-surface-container rounded-xl font-bold transition-colors">Cancel</button>
                      <button type="submit" className="flex-1 py-3 bg-[#e5f638] text-[#545b00] rounded-xl font-bold shadow-md">Save Add-on</button>
                   </div>
                </form>
             </motion.div>
          </div>
      )}
      </main>
    </div>
  )
}
