'use client'

import { useEffect, useState } from 'react'
import { createClient as supabase } from '@/utils/supabase/client'
import { Scissors, DollarSign, Wallet, Calendar, Clock, ArrowRight, Menu } from 'lucide-react'
import AppSidebar from '@/components/AppSidebar'

export default function BarberStats() {
  const [profile, setProfile] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [sidebarOpen, setSidebarOpen] = useState(false)

  const [transactions, setTransactions] = useState<any[]>([])
  
  useEffect(() => {
    checkBarber()
  }, [])

  const checkBarber = async () => {
     if (!process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL.includes('placeholder')) {
         const role = localStorage.getItem('mock_role') || 'barber'
         if (!['barber', 'owner', 'admin'].includes(role)) {
             window.location.href = '/login'
         } else {
             setProfile({ id: 'b1', name: 'Julian D.', role, barber_id: 'b1' })
             fetchData('b1')
         }
         return
     }

     const { data: { session } } = await supabase().auth.getSession()
     if (!session) { window.location.href = '/login'; return }
     
     const { data } = await supabase().from('profiles').select('*').eq('id', session.user.id).single()
     if (!data || !['barber', 'owner', 'admin'].includes(data.role)) {
         window.location.href = '/dashboard' // Not authorized
         return
     }

     setProfile(data)
     fetchData(data.barber_id)
  }

  const fetchData = async (barberId: string) => {
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL.includes('placeholder')) {
        // Mock data targeted for "Julian D."
        setTransactions([
           { id: 't1', queue_number: '14', customer_name: 'Ahmad Zikri', service_type: 'Student', items: [{name: 'Beard Trim'}], subtotal: 20, tips: 5, total: 25, payment_method: 'cash', barber_name: 'Julian D.', barber_id: 'b1', commission_amount: 12.00, created_at: new Date().toISOString() },
           { id: 't2', queue_number: '18', customer_name: 'Marcus K.', service_type: 'Staff', items: [], subtotal: 18, tips: 2, total: 20, payment_method: 'qr', barber_name: 'Julian D.', barber_id: 'b1', commission_amount: 10.80, created_at: new Date(Date.now() - 3600000).toISOString() }
        ])
        setLoading(false)
        return
    }

    try {
      if (!barberId) {
          setLoading(false)
          return
      }
      
      const t = await supabase().from('transactions').select('*').eq('barber_id', barberId).order('created_at', { ascending: false })
      if (t.data) setTransactions(t.data)
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  const today = new Date().toLocaleDateString()
  const todayTransactions = transactions.filter(t => new Date(t.created_at).toLocaleDateString() === today)
  
  const cutsToday = todayTransactions.length
  const commToday = todayTransactions.reduce((acc, t) => acc + Number(t.commission_amount), 0)
  const tipsToday = todayTransactions.reduce((acc, t) => acc + Number(t.tips), 0)
  const totalPayout = commToday + tipsToday

  const currentMonth = new Date().getMonth()
  const currentYear = new Date().getFullYear()
  const monthTransactions = transactions.filter(t => {
      const d = new Date(t.created_at)
      return d.getMonth() === currentMonth && d.getFullYear() === currentYear
  })
  
  const cutsThisMonth = monthTransactions.length
  const commThisMonth = monthTransactions.reduce((acc, t) => acc + Number(t.commission_amount), 0)
  const salesThisMonth = monthTransactions.reduce((acc, t) => acc + Number(t.total), 0)

  if (loading || !profile) return <div className="min-h-screen flex items-center justify-center font-bold text-lg text-on-surface">Validating Staff Identity...</div>

  return (
    <div className="min-h-screen bg-surface font-body text-on-surface pb-20">
      
      {/* Mobile Top Header (when sidebar is hidden on small screens) */}
      <div className="md:hidden flex items-center justify-between bg-white px-4 py-4 border-b border-outline-variant/10">
         <button onClick={() => setSidebarOpen(true)} className="p-2 bg-surface rounded-xl hover:bg-surface-container-high transition-colors">
            <Menu className="w-5 h-5 text-on-surface" />
         </button>
         <div className="flex gap-2 items-center">
            <span className="text-xl font-black tracking-tighter text-[#596000] font-headline">My Performance</span>
         </div>
      </div>

      <AppSidebar 
         sidebarOpen={sidebarOpen} 
         setSidebarOpen={setSidebarOpen} 
         activeTab={'my-stats'} 
         profile={profile} 
      />

      <main className="md:pl-64 max-w-4xl mx-auto px-4 md:px-8 mt-8">
          
          <div className="mb-8">
             <p className="text-sm font-bold text-on-surface-variant uppercase tracking-widest mb-1 flex items-center gap-2">
                <Calendar className="w-4 h-4"/> {new Date().toLocaleDateString('en-MY', {weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'})}
             </p>
             <h2 className="font-headline font-black text-3xl">Your Performance</h2>
          </div>

          <h3 className="font-headline font-bold text-xl mb-4">Monthly Overview</h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-10">
              <div className="bg-surface-container border border-outline-variant/10 p-6 rounded-[2rem] shadow-sm">
                 <p className="text-[10px] text-on-surface-variant font-black uppercase tracking-widest mb-2 flex items-center gap-2">Monthly Haircut</p>
                 <span className="font-headline text-4xl font-black text-on-surface">{cutsThisMonth}</span>
              </div>
              <div className="bg-surface-container border border-outline-variant/10 p-6 rounded-[2rem] shadow-sm">
                 <p className="text-[10px] text-on-surface-variant font-black uppercase tracking-widest mb-2 flex items-center gap-2">Total Monthly Comm.</p>
                 <span className="font-headline text-4xl font-black text-on-surface">${commThisMonth.toFixed(2)}</span>
              </div>
              <div className="bg-surface-container border border-outline-variant/10 p-6 rounded-[2rem] shadow-sm">
                 <p className="text-[10px] text-on-surface-variant font-black uppercase tracking-widest mb-2 flex items-center gap-2">Sale Done</p>
                 <span className="font-headline text-4xl font-black text-on-surface">${salesThisMonth.toFixed(2)}</span>
              </div>
          </div>

          <h3 className="font-headline font-bold text-xl mb-4">Today's Progress</h3>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-10">
              <div className="bg-[#c5d0ff] text-[#004be2] p-6 rounded-[2rem] shadow-sm">
                 <p className="text-[10px] font-black uppercase tracking-widest mb-2 flex items-center gap-2"><Scissors className="w-3 h-3"/> Cuts Today</p>
                 <span className="font-headline text-5xl font-black">{cutsToday}</span>
              </div>
              <div className="bg-[#e5f638] text-[#545b00] p-6 rounded-[2rem] shadow-sm">
                 <p className="text-[10px] font-black uppercase tracking-widest mb-2 flex items-center gap-2"><DollarSign className="w-3 h-3"/> Commission</p>
                 <span className="font-headline text-5xl font-black">${commToday.toFixed(2)}</span>
              </div>
              <div className="bg-white border border-outline-variant/10 p-6 rounded-[2rem] shadow-sm">
                 <p className="text-[10px] text-on-surface-variant font-black uppercase tracking-widest mb-2 flex items-center gap-2"><Wallet className="w-3 h-3"/> Tips Earned</p>
                 <span className="font-headline text-4xl font-black text-on-surface">${tipsToday.toFixed(2)}</span>
              </div>
          </div>

          <div className="bg-[#1a1a1a] text-[#e5f638] p-6 rounded-[2rem] shadow-md flex justify-between items-center mb-10">
             <div>
                <p className="text-[10px] bg-[#545b00] px-3 py-1 rounded-full inline-block font-black uppercase tracking-widest mb-2">Total Take-Home Today</p>
                <div className="font-headline text-2xl font-bold opacity-80">(Commission + Tips)</div>
             </div>
             <div className="text-right">
                <span className="font-headline text-5xl shadow-inner">${totalPayout.toFixed(2)}</span>
             </div>
          </div>

          <h3 className="font-headline font-bold text-xl mb-4">Today's Transactions</h3>
          
          <div className="bg-white rounded-[2rem] shadow-sm border border-outline-variant/10 overflow-hidden divide-y divide-outline-variant/5">
             {todayTransactions.length === 0 ? (
                 <div className="p-10 text-center text-on-surface-variant">
                    <p className="font-bold">No cuts recorded yet today.</p>
                 </div>
             ) : (
                 todayTransactions.map(t => (
                    <div key={t.id} className="p-4 md:p-6 flex flex-col sm:flex-row justify-between sm:items-center gap-4 hover:bg-surface-container transition-colors">
                       <div className="flex items-center gap-4">
                           <div className="w-12 h-12 bg-surface text-on-surface flex flex-col items-center justify-center rounded-xl border border-outline-variant/10 shadow-sm leading-none">
                              <span className="text-[8px] font-bold opacity-50">#{t.queue_number}</span>
                           </div>
                           <div>
                              <p className="font-bold text-lg text-on-surface leading-tight">{t.customer_name}</p>
                              <div className="flex items-center gap-2 mt-1">
                                 <span className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest"><Clock className="w-3 h-3 inline pb-0.5 opacity-50"/> {new Date(t.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                                 <span className="w-1 h-1 rounded-full bg-outline-variant/30"></span>
                                 <span className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest">{t.service_type}</span>
                              </div>
                           </div>
                       </div>
                       <div className="text-right flex items-center sm:block gap-4 justify-between sm:w-auto w-full bg-surface-container sm:bg-transparent p-3 sm:p-0 rounded-xl">
                          <div>
                             <p className="text-xs font-bold text-on-surface-variant uppercase tracking-widest">Commission</p>
                             <p className="font-black text-[#004be2]">+${Number(t.commission_amount).toFixed(2)}</p>
                          </div>
                          {t.tips > 0 && (
                             <div>
                                <p className="text-xs font-bold text-on-surface-variant uppercase tracking-widest mt-0 sm:mt-2">Tips</p>
                                <p className="font-black text-[#545b00]">+${Number(t.tips).toFixed(2)}</p>
                             </div>
                          )}
                       </div>
                    </div>
                 ))
             )}
          </div>
      </main>
    </div>
  )
}
