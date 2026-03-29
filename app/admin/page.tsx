'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/utils/supabase'
import { Check, X, Power, Bell, Settings, Search, LayoutDashboard, Users, UserPlus, HelpCircle, LogOut } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'

export default function AdminDashboard() {
  const [currentServing, setCurrentServing] = useState(0)
  const [queue, setQueue] = useState<any[]>([])
  const [isQueueOpen, setIsQueueOpen] = useState(true)
  const [activeTab, setActiveTab] = useState<'overview' | 'customers'>('overview')

  // Dynamic CRM Data
  const [historicalQueue, setHistoricalQueue] = useState<any[]>([])
  const [crmMetrics, setCrmMetrics] = useState({ today: 0, week: 0, month: 0 })
  const [chartData, setChartData] = useState<any[]>([])

  useEffect(() => {
    fetchData()
  }, [])

  const calculateCRM = (data: any[]) => {
      const now = new Date();
      let todayCount = 0; let weekCount = 0; let monthCount = 0;
      const hourCounts: Record<number, number> = {};
      const uniqueDays = new Set();
      const formattedHistorical: any[] = [];

      data.forEach(item => {
          if(!item.created_at) return;
          const d = new Date(item.created_at);
          if (isNaN(d.getTime())) return;
          
          uniqueDays.add(d.toDateString());
          
          if (item.status === 'COMPLETED' || item.status === 'SERVING') {
             const diffTime = Math.abs(now.getTime() - d.getTime());
             const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 
             if (diffDays <= 1) todayCount++;
             if (diffDays <= 7) weekCount++;
             if (diffDays <= 30) monthCount++;
          }
          
          const hour = d.getHours();
          if (hour >= 9 && hour <= 19) {
             hourCounts[hour] = (hourCounts[hour] || 0) + 1;
          }

          formattedHistorical.push({
              id: item.id,
              date: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
              time: d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }),
              name: item.customer_name || 'Walk-in',
              service: item.service || 'Standard Cut',
              phone: item.phone_number || '-',
              status: item.status
          })
      });
      
      setCrmMetrics({ today: todayCount, week: weekCount, month: monthCount });
      setHistoricalQueue(formattedHistorical);
      
      const numDays = uniqueDays.size || 1;
      const chart = [];
      let maxAvg = 0;
      
      for (let h = 9; h <= 19; h++) {
          const avg = ((hourCounts[h] || 0) / numDays);
          if (avg > maxAvg) maxAvg = avg;
          const label = h > 12 ? `${h-12} PM` : (h === 12 ? `12 PM` : `${h} AM`);
          chart.push({ time: label, count: Math.round(avg * 10) / 10, rawAvg: avg });
      }
      
      const finalChart = chart.map((stat) => {
          const pct = maxAvg === 0 ? 0 : Math.round((stat.rawAvg / maxAvg) * 100);
          return { ...stat, heightPct: Math.max(5, pct), peak: pct > 80 }
      });
      setChartData(finalChart);
  }

  const generateMockCRM = () => {
      setHistoricalQueue([
        { id: 'h1', date: 'Today', time: '10:15 AM', name: 'John Doe', service: 'Skin Fade', phone: '(555) 123-4567', status: 'COMPLETED' },
        { id: 'h2', date: 'Today', time: '11:30 AM', name: 'Michael Smith', service: 'Classic Cut', phone: '(555) 987-6543', status: 'COMPLETED' },
        { id: 'h3', date: 'Yesterday', time: '02:10 PM', name: 'David Lee', service: 'Buzz Cut', phone: '(555) 246-8101', status: 'COMPLETED' },
        { id: 'h4', date: 'Yesterday', time: '04:20 PM', name: 'Will Thomas', service: 'Skin Fade', phone: '(555) 369-1470', status: 'CANCELLED' },
        { id: 'h5', date: 'Mar 26', time: '09:00 AM', name: 'Robert King', service: 'Line Up', phone: '(555) 555-0000', status: 'COMPLETED' },
      ])
      setCrmMetrics({ today: 24, week: 142, month: 618 })
      
      setChartData([
         { time: "9 AM", count: 2.1, heightPct: 10, peak: false },
         { time: "10 AM", count: 4.5, heightPct: 25, peak: false },
         { time: "11 AM", count: 7.8, heightPct: 40, peak: false },
         { time: "12 PM", count: 14.0, heightPct: 70, peak: false },
         { time: "1 PM", count: 18.2, heightPct: 90, peak: true },
         { time: "2 PM", count: 12.5, heightPct: 60, peak: false },
         { time: "3 PM", count: 9.3, heightPct: 45, peak: false },
         { time: "4 PM", count: 15.1, heightPct: 75, peak: false },
         { time: "5 PM", count: 20.4, heightPct: 100, peak: true },
         { time: "6 PM", count: 11.0, heightPct: 55, peak: false },
         { time: "7 PM", count: 6.2, heightPct: 30, peak: false },
       ])
  }

  const fetchData = async () => {
    try {
        const { data: settingsData, error } = await supabase.from('settings').select('*').limit(1).single()
        if (settingsData && !error) {
            setCurrentServing(settingsData.current_serving_number || 0)
            if (settingsData.is_accepting_bookings !== undefined) setIsQueueOpen(settingsData.is_accepting_bookings)
        } else {
            const offlineState = localStorage.getItem('lot5_queue_open');
            if (offlineState !== null) setIsQueueOpen(offlineState === 'true');
        }

        const { data: queueData } = await supabase
          .from('queue_entries')
          .select('*')
          .in('status', ['WAITING', 'CALLED'])
          .order('queue_number', { ascending: true })
        if (queueData) setQueue(queueData)

        const { data: allData, error } = await supabase
          .from('queue_entries')
          .select('*')
          .order('created_at', { ascending: false })
          
        if (allData && !error) {
            calculateCRM(allData)
        } else {
            generateMockCRM()
        }
    } catch(err) {
        if(queue.length === 0) {
            setCurrentServing(12)
            setQueue([
                { id: '1', queue_number: 14, customer_name: 'Julian De Luca', service: 'Skin Fade + Beard', phone_number: '(555) 123-4567', status: 'WAITING' },
                { id: '2', queue_number: 15, customer_name: 'Marcus Knight', service: 'Classic Taper', phone_number: '(555) 987-6543', status: 'WAITING' },
                { id: '3', queue_number: 16, customer_name: 'Aaron Rodriguez', service: 'Buzz Cut', phone_number: '(555) 246-8101', status: 'WAITING' },
                { id: '4', queue_number: 17, customer_name: 'Simon Lee', service: 'Long Hair Trim', phone_number: '(555) 369-1470', status: 'WAITING' },
            ])
            generateMockCRM()
        }
    }
  }

  const toggleQueue = async () => {
      const newState = !isQueueOpen;
      setIsQueueOpen(newState);
      if (typeof window !== 'undefined') localStorage.setItem('lot5_queue_open', String(newState));
      try { await supabase.from('settings').upsert({ id: 1, is_accepting_bookings: newState }) } 
      catch (err) { console.error('Offline toggle', err) }
  }

  const downloadCSV = () => {
    const csvContent = "data:text/csv;charset=utf-8," 
      + "Date,Time,Customer,Service,Wait Time (Mins)\n"
      + "2024-03-29,10:15 AM,John Doe,Skin Fade,15\n"
      + "2024-03-29,11:30 AM,Michael Smith,Classic Cut,22\n"
      + "2024-03-29,12:45 PM,Chris Evans,Beard Trim,5\n"
      + "2024-03-29,02:10 PM,David Lee,Buzz Cut,10\n"
      + "2024-03-29,02:40 PM,Robert King,Line Up,5\n"
      + "2024-03-29,04:20 PM,Will Thomas,Skin Fade,18\n";
    
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `lot5_analytics_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  const handleCallCustomer = async (ticketId: string, customerName: string) => {
    if (window.confirm(`Call ${customerName || 'Customer'} to the floor?`)) {
      try {
          await supabase.from('queue_entries').update({ status: 'CALLED' }).eq('id', ticketId)
          setQueue(q => q.map(item => item.id === ticketId ? { ...item, status: 'CALLED' } : item))
      } catch(err) {
          console.error('Supabase not connected. Running offline demo call.', err)
          setQueue(q => q.map(item => item.id === ticketId ? { ...item, status: 'CALLED' } : item))
      }
    }
  }

  const handleCallNext = async (ticketId: string, ticketNumber: number) => {
    // 1. Grab customer before removing
    const customer = queue.find(q => q.id === ticketId)
    
    // 2. Remove from active queue immediately for snappy UI
    setQueue(q => q.filter(item => item.id !== ticketId))
    setCurrentServing(ticketNumber)
    
    // 3. Inject into Customer Database list instantly
    if (customer) {
        const d = new Date()
        const completedRecord = {
            id: ticketId,
            date: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
            time: d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }),
            name: customer.customer_name || 'Walk-in',
            service: customer.service || 'Standard Cut',
            phone: customer.phone_number || '-',
            status: 'COMPLETED'
        };
        setHistoricalQueue(prev => [completedRecord, ...prev])
        setCrmMetrics(prev => ({ ...prev, today: prev.today + 1, week: prev.week + 1, month: prev.month + 1 }))
    }

    // 4. Fire Async DB Updates
    try {
        await supabase.from('queue_entries').update({ status: 'COMPLETED' }).eq('id', ticketId) // Changed from SERVING to COMPLETED to ensure it shows as green in ledger
        await supabase.from('settings').update({ current_serving_number: ticketNumber }).eq('id', 1)
    } catch(err) {
        console.error('Supabase not connected. Running offline demo skip.', err)
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
          <button onClick={() => setActiveTab('overview')} className={`w-full flex items-center gap-3 rounded-lg px-4 py-3 transition-all ${activeTab === 'overview' ? 'bg-[#c5d0ff] text-[#004be2] scale-[0.98] shadow-sm' : 'text-gray-500 hover:bg-surface hover:translate-x-1'}`}>
            <LayoutDashboard className={`w-5 h-5 ${activeTab === 'overview' ? 'text-[#004be2]' : ''}`} />
            <span className="font-headline font-semibold tracking-tight">Overview</span>
          </button>
          <button onClick={() => setActiveTab('customers')} className={`w-full flex items-center gap-3 rounded-lg px-4 py-3 transition-all ${activeTab === 'customers' ? 'bg-[#c5d0ff] text-[#004be2] scale-[0.98] shadow-sm' : 'text-gray-500 hover:bg-surface hover:translate-x-1'}`}>
            <Users className={`w-5 h-5 ${activeTab === 'customers' ? 'text-[#004be2]' : ''}`} />
            <span className="font-headline font-semibold tracking-tight">Customers</span>
          </button>
          <button className="w-full flex items-center gap-3 text-gray-500 px-4 py-3 hover:translate-x-1 transition-transform">
            <span className="material-symbols-outlined text-xl">settings_applications</span>
            <span className="font-headline font-semibold tracking-tight">Management</span>
          </button>
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
        {activeTab === 'overview' ? (
        <>
        {/* Header Section with Bento Stats */}
        <section className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-10">
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

          {/* STOP QUEUE TOGGLE */}
          <div className={`p-6 rounded-[2rem] flex flex-col items-center justify-center text-center shadow-sm transition-colors cursor-pointer border-2 ${isQueueOpen ? 'bg-white border-green-500/20 hover:border-green-500' : 'bg-red-50 border-red-500 shadow-[0_0_30px_rgba(239,68,68,0.2)]'}`} onClick={toggleQueue}>
             <div className="w-12 h-12 rounded-full mb-3 flex items-center justify-center transform transition-transform active:scale-95" style={{ backgroundColor: isQueueOpen ? '#10B981' : '#EF4444' }}>
                <span className="material-symbols-outlined text-white font-black">{isQueueOpen ? 'check' : 'block'}</span>
             </div>
             <p className={`font-headline font-extrabold text-lg leading-tight ${isQueueOpen ? 'text-green-600' : 'text-red-600'}`}>
               {isQueueOpen ? 'Accepting Sign-ins' : 'Queue Closed'}
             </p>
             <p className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant mt-2">Tap to Toggle</p>
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
                         <span className={`font-bold text-xs uppercase tracking-tighter ${q.status === 'CALLED' ? 'text-[#545b00] bg-[#e5f638] px-3 py-1 rounded-full animate-pulse' : (i === 0 ? 'text-[#004be2]' : 'text-on-surface-variant')}`}>
                            {q.status === 'CALLED' ? 'Called out' : (i === 0 ? 'Next Up' : 'Waiting')}
                         </span>
                      </td>
                      <td className="px-8 py-6 text-right">
                         <div className="flex justify-end gap-2">
                           {q.status !== 'CALLED' && (
                               <button 
                                 onClick={() => handleCallCustomer(q.id, q.customer_name)}
                                 className="text-on-surface-variant hover:text-[#545b00] transition-colors p-2 rounded-full hover:bg-[#e5f638]/40"
                                 title="Call Customer Formally"
                               >
                                 <span className="material-symbols-outlined font-black">campaign</span>
                               </button>
                           )}
                           <button 
                             onClick={() => handleCallNext(q.id, q.queue_number)}
                             className="text-on-surface-variant hover:text-[#004be2] transition-colors p-2 rounded-full hover:bg-[#004be2]/10"
                             title="Complete Ticket & Mark Serving"
                           >
                             <span className="material-symbols-outlined font-black">check</span>
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

        </>
        ) : (
        /* -- CUSTOMERS CRM VIEW -- */
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
          
          <div className="mb-8">
            <h1 className="text-4xl font-extrabold font-headline tracking-tighter text-on-surface mb-2">Customer Database</h1>
            <p className="text-on-surface-variant font-medium">Track your historical traffic and manage client records.</p>
          </div>

          {/* Metrics Row */}
          <section className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
            <div className="bg-[#e5f638] p-8 rounded-[2rem] flex flex-col items-start shadow-sm border border-[#545b00]/10 relative overflow-hidden">
               <span className="text-sm font-label font-bold uppercase tracking-widest text-[#545b00] mb-2 z-10">Today's Traffic</span>
               <div className="flex items-baseline gap-2 z-10">
                 <span className="font-headline text-6xl font-black text-[#545b00] tracking-tighter leading-none">{crmMetrics.today}</span>
                 <span className="font-headline text-lg font-bold text-[#545b00]">Cuts</span>
               </div>
               <span className="material-symbols-outlined text-[8rem] text-white/30 absolute -bottom-6 -right-4 rotate-[-15deg] pointer-events-none" style={{ fontVariationSettings: "'FILL' 1" }}>groups</span>
            </div>
            
            <div className="bg-[#c5d0ff] p-8 rounded-[2rem] flex flex-col items-start shadow-sm relative overflow-hidden">
               <span className="text-sm font-label font-bold uppercase tracking-widest text-[#004be2] mb-2 z-10">This Week</span>
               <div className="flex items-baseline gap-2 z-10">
                 <span className="font-headline text-6xl font-black text-[#004be2] tracking-tighter leading-none">{crmMetrics.week}</span>
                 <span className="font-headline text-lg font-bold text-[#004be2]">Cuts</span>
               </div>
               <span className="material-symbols-outlined text-[8rem] text-white/30 absolute -bottom-6 -right-4 rotate-[-15deg] pointer-events-none" style={{ fontVariationSettings: "'FILL' 1" }}>calendar_view_week</span>
            </div>

            <div className="bg-white p-8 rounded-[2rem] border border-outline-variant/10 shadow-sm flex flex-col items-start relative overflow-hidden">
               <span className="text-sm font-label font-bold uppercase tracking-widest text-on-surface-variant mb-2 z-10">This Month</span>
               <div className="flex items-baseline gap-2 z-10">
                 <span className="font-headline text-6xl font-black text-on-surface tracking-tighter leading-none">{crmMetrics.month}</span>
                 <span className="font-headline text-lg font-bold text-on-surface-variant">Cuts</span>
               </div>
               <span className="material-symbols-outlined text-[8rem] text-on-surface-variant/5 absolute -bottom-6 -right-4 rotate-[-15deg] pointer-events-none" style={{ fontVariationSettings: "'FILL' 1" }}>calendar_month</span>
            </div>
          </section>

          {/* CRM TABLE */}
          <section className="bg-white rounded-[2rem] overflow-hidden shadow-sm border border-outline-variant/10 mb-10">
            <div className="px-8 py-6 flex flex-col md:flex-row justify-between items-start md:items-center bg-white border-b border-outline-variant/5 gap-4">
               <h2 className="font-headline font-bold text-2xl text-on-surface">Client History</h2>
               <div className="relative w-full md:w-auto">
                 <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-outline-variant w-4 h-4" />
                 <input className="w-full md:w-auto bg-surface-container-low border-none rounded-xl pl-10 pr-4 py-2 text-sm focus:ring-2 focus:ring-secondary/20 min-w-[200px]" placeholder="Search records..." type="text"/>
               </div>
            </div>
            <div className="overflow-x-auto max-h-[400px]">
              <table className="w-full text-left border-collapse">
                <thead className="sticky top-0 z-10 bg-surface/90 backdrop-blur-md">
                  <tr className="text-on-surface-variant text-xs font-bold uppercase tracking-widest border-b border-outline-variant/5">
                     <th className="px-8 py-4">Date & Time</th>
                     <th className="px-8 py-4">Customer</th>
                     <th className="px-8 py-4">Service</th>
                     <th className="px-8 py-4 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-outline-variant/5">
                  {historicalQueue.map(h => (
                      <tr key={h.id} className="hover:bg-surface transition-colors cursor-pointer">
                          <td className="px-8 py-5">
                             <p className="font-bold text-sm text-on-surface">{h.date}</p>
                             <p className="text-xs text-on-surface-variant">{h.time}</p>
                          </td>
                          <td className="px-8 py-5">
                             <p className="font-bold text-sm text-on-surface">{h.name}</p>
                             <p className="text-xs text-on-surface-variant">{h.phone}</p>
                          </td>
                          <td className="px-8 py-5">
                             <span className="bg-surface-container-high px-3 py-1 rounded-md text-xs font-bold text-on-surface-variant">{h.service}</span>
                          </td>
                          <td className="px-8 py-5 text-center">
                             {h.status === 'COMPLETED' ? (
                                <span className="inline-flex items-center gap-1 text-[#10B981] bg-[#10B981]/10 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-widest">
                                   <Check className="w-3 h-3" /> Served
                                </span>
                             ) : (
                                <span className="inline-flex items-center gap-1 text-red-500 bg-red-500/10 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-widest">
                                   <X className="w-3 h-3" /> Cancelled
                                </span>
                             )}
                          </td>
                      </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {/* Statistics & Analytics */}
          <section className="bg-white rounded-[2rem] p-8 shadow-sm border border-outline-variant/10">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-10 gap-4">
              <div>
                <h3 className="font-headline font-bold text-2xl text-on-surface">Daily Traffic Analysis</h3>
                <p className="text-sm text-on-surface-variant font-medium">Identify peak hours to optimize stylist scheduling.</p>
              </div>
              <button onClick={downloadCSV} className="bg-[#e5f638] text-[#545b00] px-6 py-3 rounded-full font-bold text-sm tracking-wide shadow-sm hover:shadow-md transition-all flex items-center gap-2 border border-[#545b00]/10 whitespace-nowrap">
                <span className="material-symbols-outlined font-black text-lg">download</span>
                Export Latest CSV
              </button>
            </div>
            
            <div className="h-64 flex items-end gap-2 md:gap-4 mt-10 px-2 relative">
               <div className="absolute inset-0 flex flex-col justify-between pointer-events-none opacity-20 border-b border-l border-on-surface-variant/50 pt-4 pb-8">
                  <div className="w-full h-[1px] bg-on-surface-variant"></div>
                  <div className="w-full h-[1px] bg-on-surface-variant"></div>
                  <div className="w-full h-[1px] bg-on-surface-variant"></div>
               </div>
               
               {chartData.map((stat, i) => (
                 <div key={i} className="relative flex-1 group flex flex-col justify-end items-center h-full break-normal pt-10 cursor-crosshair">
                    <div style={{ height: `${stat.heightPct}%` }} className={`w-full rounded-t-xl transition-all duration-500 ease-out group-hover:bg-[#004be2] z-10 ${stat.peak ? 'bg-[#c5d0ff]' : 'bg-surface-container-highest'}`}></div>
                    <span className="absolute -bottom-6 text-[10px] font-bold text-on-surface-variant whitespace-nowrap">{stat.time}</span>
                    <span className="absolute -top-6 opacity-0 group-hover:opacity-100 text-xs font-black text-[#004be2] transition-opacity bg-white px-2 py-1 rounded-md shadow-sm border border-[#004be2]/20">{stat.count}</span>
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
