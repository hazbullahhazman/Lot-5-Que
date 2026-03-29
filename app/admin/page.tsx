'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/utils/supabase'
import { Check, X, Power, Bell, Settings, Search, LayoutDashboard, Users, UserPlus, HelpCircle, LogOut } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'

export default function AdminDashboard() {
  const [currentServing, setCurrentServing] = useState(0)
  const [queue, setQueue] = useState<any[]>([])

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    try {
        const { data: settingsData } = await supabase.from('settings').select('*').limit(1).single()
        if (settingsData) setCurrentServing(settingsData.current_serving_number || 0)

        const { data: queueData } = await supabase
          .from('queue_entries')
          .select('*')
          .eq('status', 'WAITING')
          .order('queue_number', { ascending: true })
        if (queueData) setQueue(queueData)
    } catch(err) {
        if(queue.length === 0) {
            setCurrentServing(12)
            setQueue([
                { id: '1', queue_number: 14, customer_name: 'Julian De Luca', service: 'Skin Fade + Beard', phone_number: '(555) 123-4567' },
                { id: '2', queue_number: 15, customer_name: 'Marcus Knight', service: 'Classic Taper', phone_number: '(555) 987-6543' },
                { id: '3', queue_number: 16, customer_name: 'Aaron Rodriguez', service: 'Buzz Cut', phone_number: '(555) 246-8101' },
                { id: '4', queue_number: 17, customer_name: 'Simon Lee', service: 'Long Hair Trim', phone_number: '(555) 369-1470' },
            ])
        }
    }
  }

  const handleCallNext = async (ticketId: string, ticketNumber: number) => {
    try {
        await supabase.from('queue_entries').update({ status: 'SERVING' }).eq('id', ticketId)
        await supabase.from('settings').update({ current_serving_number: ticketNumber }).eq('id', 1)
        
        setQueue(q => q.filter(item => item.id !== ticketId))
        setCurrentServing(ticketNumber)
    } catch(err) {
        console.error(err)
    }
  }

  return (
    <div className="bg-[#f9f6f5] text-on-surface selection:bg-primary-container selection:text-on-primary-container font-body min-h-screen">
      
      {/* TopNavBar */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-white transition-colors flex justify-between items-center w-full px-6 py-4 shadow-sm border-b border-outline-variant/10">
        <div className="flex items-center gap-8">
          <span className="text-2xl font-black tracking-tighter text-[#596000] font-headline">Lot 5 Barbershop</span>
          <div className="hidden md:flex items-center gap-6">
            <a href="#" className="text-[#004be2] font-bold px-3 py-1 rounded transition-all">Overview</a>
            <a href="#" className="text-[#596000] hover:bg-[#e5f638]/10 px-3 py-1 rounded transition-all">Management</a>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="relative hidden sm:block">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-outline-variant w-4 h-4" />
            <input className="bg-surface-container-high border-none rounded-full pl-10 pr-4 py-2 text-sm focus:ring-2 focus:ring-secondary/20 w-64 text-on-surface" placeholder="Search queue..." type="text"/>
          </div>
          <button className="p-2 text-[#596000] hover:bg-[#e5f638]/20 rounded-full transition-all">
            <Bell className="w-5 h-5" />
          </button>
          <button className="p-2 text-[#596000] hover:bg-[#e5f638]/20 rounded-full transition-all">
            <Settings className="w-5 h-5" />
          </button>
          <div className="w-10 h-10 rounded-full bg-surface-container-high overflow-hidden border-2 border-[#e5f638] flex items-center justify-center">
            <span className="material-symbols-outlined text-outline-variant">person</span>
          </div>
        </div>
      </header>

      {/* SideNavBar (Desktop Only) */}
      <aside className="hidden md:flex fixed left-0 top-0 h-full w-64 flex-col pt-24 pb-8 px-4 bg-white border-r border-outline-variant/10 shadow-sm transition-all z-40">
        <div className="flex items-center gap-3 px-4 mb-8">
          <div className="w-12 h-12 rounded-xl bg-primary-container flex items-center justify-center text-on-primary-container shadow-sm overflow-hidden">
             <img src="https://lh3.googleusercontent.com/aida-public/AB6AXuD63qccmTNpBREBp-MgYU5DF75uFtfT-FeJH6IzCT0wCM6fvZtEQFlZTt_xwz7GVYVSnPxI-q6FpWf_zTD7gbcd_hIsKONLxeuFVqSze47fw9_2K22vl-IQJCHLslCAHp_dRLsQ1tPGuE9iiiQvSh-6ENKh5odGOizuPRdMC7T1WflVOGnjtVkSZfPNLbeRP3FzGW7hToPPAtqdN4WHwUx4E0s0F4bcYNIT7kCAAU1P51vvxwmrMcQVceMb2kohzqB0zq6cfNS9Zg" className="w-full h-full object-cover grayscale opacity-90" alt="admin" />
          </div>
          <div>
            <p className="font-headline font-semibold tracking-tight text-on-surface">Lot 5 Admin</p>
            <p className="text-xs text-on-surface-variant font-medium">Master Barber</p>
          </div>
        </div>
        
        <button className="w-full bg-[#e5f638] text-[#545b00] py-3 rounded-full font-headline font-bold flex items-center justify-center gap-2 hover:bg-[#d7e827] transition-all mb-6">
            <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 0, 'wght' 600" }}>add</span> Add Customer
        </button>
        
        <nav className="flex-1 space-y-1">
          <a href="#" className="flex items-center gap-3 bg-[#c5d0ff] text-[#004be2] rounded-lg px-4 py-3 scale-[0.98] shadow-sm">
            <LayoutDashboard className="w-5 h-5 text-[#004be2]" />
            <span className="font-headline font-semibold tracking-tight">Overview</span>
          </a>
          <a href="#" className="flex items-center gap-3 text-gray-500 px-4 py-3 hover:translate-x-1 transition-transform">
            <Users className="w-5 h-5" />
            <span className="font-headline font-semibold tracking-tight">Management</span>
          </a>
        </nav>
        <div className="mt-auto space-y-1">
          <a href="#" className="flex items-center gap-3 text-gray-500 px-4 py-3 hover:translate-x-1 transition-transform">
            <HelpCircle className="w-5 h-5" />
            <span className="font-headline font-semibold tracking-tight">Support</span>
          </a>
          <a href="#" className="flex items-center gap-3 text-red-600 px-4 py-3 hover:translate-x-1 transition-transform">
            <LogOut className="w-5 h-5" />
            <span className="font-headline font-semibold tracking-tight">Logout</span>
          </a>
        </div>
      </aside>

      {/* Main Content */}
      <main className="md:pl-64 pt-24 pb-32 px-6 min-h-screen max-w-[1400px] mx-auto">
        
        {/* Header Section with Bento Stats */}
        <section className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
          <div className="md:col-span-2 bg-[#ffffe6] p-8 rounded-[2rem] relative overflow-hidden flex flex-col justify-center border border-[#e5f638]/20 shadow-sm">
            <div className="relative z-10">
              <h1 className="text-4xl font-extrabold font-headline tracking-tighter text-on-surface mb-2">Morning, Lot 5.</h1>
              <p className="text-on-surface-variant font-medium">There are currently {queue.length} customers waiting in the queue.</p>
            </div>
            {/* Artistic Overlay */}
            <div className="absolute right-0 top-0 w-1/3 h-full bg-gradient-to-l from-[#e5f638]/40 to-transparent pointer-events-none"></div>
          </div>
          
          <div className="bg-[#e5f638] p-6 rounded-[2rem] flex flex-col items-center justify-center text-center shadow-sm">
            <p className="text-[#545b00] font-headline font-bold text-xs uppercase tracking-widest mb-1">Avg. Wait Time</p>
            <div className="text-6xl font-black font-headline text-[#545b00]">24</div>
            <p className="text-[#545b00]/80 text-sm font-bold">Minutes</p>
          </div>
        </section>

        {/* Queue Table Section */}
        <section className="bg-white rounded-3xl overflow-hidden shadow-sm border border-outline-variant/10">
          <div className="px-8 py-6 flex justify-between items-center bg-white border-b border-outline-variant/5">
            <h2 className="font-headline font-bold text-2xl text-on-surface">Live Queue</h2>
            <div className="flex gap-2">
               <span className="px-3 py-1 bg-[#c5d0ff] text-[#004be2] text-xs font-bold rounded-full flex items-center gap-1">
                 <span className="w-2 h-2 bg-[#004be2] rounded-full animate-pulse"></span> LIVE UPDATE
               </span>
            </div>
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="text-on-surface-variant text-xs font-bold uppercase tracking-widest bg-surface/50 border-b border-outline-variant/5">
                   <th className="px-8 py-4">Customer</th>
                   <th className="px-8 py-4">Phone Number</th>
                   <th className="px-8 py-4">Wait Time</th>
                   <th className="px-8 py-4">Status</th>
                   <th className="px-8 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant/5">
                <AnimatePresence mode="popLayout">
                  {queue.map((q, i) => (
                    <motion.tr 
                      layout
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 10, filter: 'blur(4px)' }}
                      transition={{ duration: 0.3 }}
                      key={q.id} 
                      className="group hover:bg-[#f9f6f5] transition-colors duration-200"
                    >
                      <td className="px-8 py-6">
                        <div className="flex items-center gap-3">
                           <div className={`w-10 h-10 rounded-full ${i === 0 ? 'bg-[#c5d0ff] text-[#004be2]' : 'bg-surface-container-high text-on-surface-variant'} flex items-center justify-center font-bold`}>
                              {q.customer_name ? q.customer_name.substring(0, 2).toUpperCase() : 'CU'}
                           </div>
                           <div>
                             <p className="font-bold text-on-surface">{q.customer_name}</p>
                             <p className="text-xs text-on-surface-variant">{q.service || 'Standard Cut'}</p>
                           </div>
                        </div>
                      </td>
                      <td className="px-8 py-6 font-body text-sm text-on-surface-variant">
                         {q.phone_number}
                      </td>
                      <td className="px-8 py-6">
                        <div className={`px-4 py-2 text-sm font-bold rounded-full inline-flex items-center gap-1 ${i === 0 ? 'bg-[#e5f638] text-[#545b00]' : 'bg-surface-container-low text-on-surface'}`}>
                           <span>{(i + 1) * 15 - 10}</span>
                           <span className="text-[10px] uppercase">Min</span>
                        </div>
                      </td>
                      <td className="px-8 py-6">
                         <span className={`font-bold text-xs uppercase tracking-tighter ${i === 0 ? 'text-[#004be2]' : 'text-on-surface-variant'}`}>
                            {i === 0 ? 'Next Up' : 'Waiting'}
                         </span>
                      </td>
                      <td className="px-8 py-6 text-right">
                         <div className="flex justify-end gap-2">
                           <button 
                             onClick={() => handleCallNext(q.id, q.queue_number)}
                             className="text-on-surface-variant hover:text-[#004be2] transition-colors p-2 rounded-full hover:bg-[#004be2]/10"
                             title="Take Next"
                           >
                             <span className="material-symbols-outlined font-black">check</span>
                           </button>
                           <button className="text-on-surface-variant hover:text-secondary transition-colors p-2 rounded-full hover:bg-secondary/10">
                             <span className="material-symbols-outlined">more_vert</span>
                           </button>
                         </div>
                      </td>
                    </motion.tr>
                  ))}
                  
                  {queue.length === 0 && (
                     <tr>
                        <td colSpan={5} className="px-8 py-16 text-center text-on-surface-variant font-medium">
                           Queue is empty. Relax and grab a coffee.
                        </td>
                     </tr>
                  )}
                </AnimatePresence>
              </tbody>
            </table>
          </div>
          <div className="px-8 py-4 bg-surface/50 border-t border-outline-variant/5 text-center">
             <button className="text-[#004be2] font-bold text-sm hover:underline decoration-2 underline-offset-4 transition-all">View All Entries</button>
          </div>
        </section>

        {/* On the Floor Sector */}
        <section className="mt-12">
          <h3 className="font-headline font-bold text-2xl mb-6 px-2 text-on-surface">On the Floor</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
             {/* Stylist 1 */}
             <div className="bg-[#c5d0ff] p-6 rounded-3xl relative overflow-hidden shadow-sm">
                <div className="flex justify-between items-start mb-4">
                  <div className="w-14 h-14 rounded-xl overflow-hidden border border-white/20">
                     <img src="https://lh3.googleusercontent.com/aida-public/AB6AXuDmrC4QzCSj1zKeI0n5fiAwr_vM1muRqt5FQc6JEegfpyBd7DqRd9E0ix0DdDqb1lC01m2c7tn9pEaeWyNoIAqNJ4_tIgcZt3Inx5d86ENIMHm7z4XrZJogXoHQKtW9-nsPDL3h6QqhtGay9y4ghX2U3H6Lw8NXrjTLqCcy9UQDX_iuhCC6PAjAlb5v2XPgcDOUOEpigzeKy1Bu50O4Hsln0tfYKKs_5haUszgM42e8S9Q5mFRWavQV_1_rgqtxdrZ7-axKlMxLIg" className="w-full h-full object-cover" alt="Leo" />
                  </div>
                  <span className="bg-[#004be2] text-white text-[10px] font-bold px-3 py-1 rounded-full uppercase tracking-widest">Active</span>
                </div>
                <h4 className="font-headline font-bold text-[#004be2] text-lg">Leo Mancini</h4>
                <p className="text-xs font-semibold text-[#004be2]/70">Finishing Skin Fade</p>
             </div>
             
             {/* Stylist 2 */}
             <div className="bg-white p-6 rounded-3xl border border-outline-variant/10 shadow-sm">
                <div className="flex justify-between items-start mb-4">
                  <div className="w-14 h-14 rounded-xl overflow-hidden opacity-50 grayscale transition-all">
                     <img src="https://lh3.googleusercontent.com/aida-public/AB6AXuAdQcon7_XvHgsiXOMjjD5utUKri_Oilwmf75C0Ytz4BSaZoGjBW7fTiSodvNpuhK6hG4Q37-6M9yGmD9_QTLTcs9Q0QR0FeYUzHa29JiCkxGIbVBFcO2CCFttbSAH4h7lJFFhWkGMwqK0j6RGf06oTOimgY7KbxZfCYROyWnEC5Ye93bNnMfk_wjKslF8bj5MFFR6mGxeLiPaMzSpLg_HGr5iA03zYqCegV26qPmVOsOZSFSG3aXYItPMV8MY9yn1UKmUKhpw2oA" className="w-full h-full object-cover" alt="Sarah" />
                  </div>
                  <span className="bg-surface-dim/40 text-on-surface-variant text-[10px] font-bold px-3 py-1 rounded-full uppercase tracking-widest">On Break</span>
                </div>
                <h4 className="font-headline font-bold text-on-surface text-lg">Sarah Cho</h4>
                <p className="text-xs font-semibold text-on-surface-variant">Back in 12 min</p>
             </div>

             {/* Stylist 3 */}
             <div className="bg-[#c5d0ff] p-6 rounded-3xl relative overflow-hidden shadow-sm">
                <div className="flex justify-between items-start mb-4">
                  <div className="w-14 h-14 rounded-xl overflow-hidden border border-white/20">
                     <img src="https://lh3.googleusercontent.com/aida-public/AB6AXuDx2F3rc6pw4Jzs2ZvJAyTXApdTtrRSQ0r6YCvMYPs6doan0iQwqrXjHYZLoQKhDEzJztXeYLMPml5fxFGarJ-keUmstqCjPHBkIGzbuIyo0KXeOB6dtm9t8tmcAsNL_rYIUXl2dXJnFJt8wZwATrInDy7WK2-7bqF06w2X2IJQiu48NSwdUXEHyPXtSaogfaWdh98qg_kmc5kiM1c9Pesb04WuFpT4jm5CcP-7eS7Jhe3qqM2z42NiLzDyowg7UFp3xYhMf_JMRg" className="w-full h-full object-cover" alt="Rick" />
                  </div>
                  <span className="bg-[#004be2] text-white text-[10px] font-bold px-3 py-1 rounded-full uppercase tracking-widest">Active</span>
                </div>
                <h4 className="font-headline font-bold text-[#004be2] text-lg">Rick Vance</h4>
                <p className="text-xs font-semibold text-[#004be2]/70">Beard Grooming</p>
             </div>
             
             {/* Stylist 4 (Clock In) */}
             <div className="bg-[#e5f638] p-6 rounded-3xl flex flex-col items-center justify-center border-2 border-dashed border-[#596000]/20 hover:bg-[#d7e827] cursor-pointer transition-all shadow-sm">
                <div className="w-8 h-8 rounded-full bg-[#545b00]/20 flex items-center justify-center mb-3">
                   <span className="material-symbols-outlined text-[#545b00] font-black leading-none" style={{ fontSize: '20px' }}>add</span>
                </div>
                <p className="font-headline font-bold text-sm text-[#545b00]">Clock In Stylist</p>
             </div>
          </div>
        </section>
      </main>

    </div>
  )
}
