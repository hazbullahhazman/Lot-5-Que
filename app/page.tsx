'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/utils/supabase'
import { motion, AnimatePresence } from 'framer-motion'
import { ArrowRight, User, Phone, LogOut } from 'lucide-react'

export default function Home() {
  const [currentServing, setCurrentServing] = useState(0)
  const [queue, setQueue] = useState<any[]>([])
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [loading, setLoading] = useState(false)
  
  const [joinedTicket, setJoinedTicket] = useState<number | null>(null)
  const [myQueueId, setMyQueueId] = useState<string | null>(null)
  const [myTicketStatus, setMyTicketStatus] = useState<string>('WAITING')
  const [isQueueOpen, setIsQueueOpen] = useState(true)

  useEffect(() => {
    // 🔥 NEW: Instant LocalStorage Restore
    if (typeof window !== 'undefined') {
       const savedTicketId = localStorage.getItem('lot5_queue_id')
       const savedQueueNumber = localStorage.getItem('lot5_queue_number')
       if (savedTicketId && savedQueueNumber) {
           setMyQueueId(savedTicketId)
           setJoinedTicket(parseInt(savedQueueNumber))
           
           if (savedTicketId !== 'mock-id') {
               supabase.from('queue_entries').select('status').eq('id', savedTicketId).single()
                 .then(({data}) => {
                     // Keep them if they are WAITING or CALLED
                     if (!data || (data.status !== 'WAITING' && data.status !== 'CALLED')) {
                         localStorage.removeItem('lot5_queue_id')
                         localStorage.removeItem('lot5_queue_number')
                         setJoinedTicket(null)
                         setMyQueueId(null)
                     } else {
                         setMyTicketStatus(data.status)
                     }
                 })
           }
       }
    }

    fetchInitialData()
    // Setup Supabase Realtime Listeners
    const channel = supabase
      .channel('public-events')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'queue_entries' }, () => {
        fetchInitialData()
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'settings' }, (payload: any) => {
        if(payload.new.current_serving_number !== undefined) {
          setCurrentServing(payload.new.current_serving_number)
        }
        if(payload.new.is_accepting_bookings !== undefined) {
          setIsQueueOpen(payload.new.is_accepting_bookings)
        }
      })
      .subscribe()
      
    // Listen for offline tab sync if Admin toggles in another tab without Supabase
    const handleStorageChange = (e: StorageEvent) => {
        if (e.key === 'lot5_queue_open') setIsQueueOpen(e.newValue === 'true')
    }
    window.addEventListener('storage', handleStorageChange)

    return () => { 
        supabase.removeChannel(channel)
        window.removeEventListener('storage', handleStorageChange)
    }
  }, [])

  const fetchInitialData = async () => {
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
        
        if (queueData) {
            setQueue(queueData)
            // Sync current ticket status if active via Realtime update
            if (typeof window !== 'undefined') {
                const id = localStorage.getItem('lot5_queue_id')
                if (id && id !== 'mock-id') {
                    const myData = queueData.find(q => q.id === id)
                    if (myData) {
                        setMyTicketStatus(myData.status)
                    } else {
                        // Ticket was cleared out
                        localStorage.removeItem('lot5_queue_id')
                        localStorage.removeItem('lot5_queue_number')
                        setJoinedTicket(null)
                        setMyQueueId(null)
                    }
                }
            }
        }
    } catch(err) {
        if(queue.length === 0 && currentServing === 0) {
            setCurrentServing(12)
            setQueue([
                { id: '1', queue_number: 14, customer_name: 'James D.', phone_number: '123' },
                { id: '2', queue_number: 15, customer_name: 'Mark R.', phone_number: '321' }
            ])
        }
    }
  }

  const joinQueue = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    
    try {
        // PRE-FLIGHT CHECK: Ensure the queue wasn't closed by Admin just now
        let trulyOpen = isQueueOpen;
        try {
            const { data: settingsData, error } = await supabase.from('settings').select('is_accepting_bookings').limit(1).single()
            if (settingsData && !error) trulyOpen = settingsData.is_accepting_bookings;
        } catch(err) {
            const offlineState = localStorage.getItem('lot5_queue_open');
            if (offlineState !== null) trulyOpen = offlineState === 'true';
        }

        if (trulyOpen === false) {
             setIsQueueOpen(false)
             alert("We’re currently at full capacity due to high demand. Please try again shortly or try again tomorrow.")
             setLoading(false)
             return;
        }

        const nextTicketNumber = queue.length > 0 ? queue[queue.length - 1].queue_number + 1 : currentServing + 1

        const { data, error } = await supabase.from('queue_entries').insert([{ 
            customer_name: name, 
            phone_number: phone,
            queue_number: nextTicketNumber,
            status: 'WAITING' // CRITICAL FIX: Ensure Admin panel properly detects the new entry
        }]).select()
        
        if(error) throw error

        setJoinedTicket(nextTicketNumber)
        if(data && data[0]) {
            setMyQueueId(data[0].id)
            if (typeof window !== 'undefined') {
                localStorage.setItem('lot5_queue_id', data[0].id)
                localStorage.setItem('lot5_queue_number', nextTicketNumber.toString())
            }
        }
        
    } catch (err) {
        const mockTicketNumber = currentServing + queue.length + 1
        setJoinedTicket(mockTicketNumber)
        setMyQueueId('mock-id')
        if (typeof window !== 'undefined') {
            localStorage.setItem('lot5_queue_id', 'mock-id')
            localStorage.setItem('lot5_queue_number', mockTicketNumber.toString())
        }
        
        // Add fake entry to local state to reflect UI instantly
        setQueue(prev => [...prev, { id: 'mock-id', queue_number: mockTicketNumber, customer_name: name || 'Demo User' }])
    } finally {
        setLoading(false)
    }
  }

  const exitQueue = async () => {
      try {
          if (myQueueId && myQueueId !== 'mock-id') {
              await supabase.from('queue_entries').update({ status: 'CANCELLED' }).eq('id', myQueueId)
          } else {
              setQueue(prev => prev.filter(q => q.id !== 'mock-id'))
          }
      } catch (err) {
          console.error(err)
      } finally {
          if (typeof window !== 'undefined') {
             localStorage.removeItem('lot5_queue_id')
             localStorage.removeItem('lot5_queue_number')
          }
          setJoinedTicket(null)
          setMyQueueId(null)
          setName('')
          setPhone('')
      }
  }

  // Calculate position logic for the dashboard view
  const myQueueIndex = queue.findIndex(q => q.queue_number === joinedTicket);
  const peopleAhead = myQueueIndex >= 0 ? myQueueIndex : 0;
  // If myQueueIndex is 0, they are next. If it's -1, they probably aren't in queue array (error or served). 
  let positionDisplay = peopleAhead + 1; 
  let positionSuffix = "TH";
  if (positionDisplay === 1) positionSuffix = "ST";
  else if (positionDisplay === 2) positionSuffix = "ND";
  else if (positionDisplay === 3) positionSuffix = "RD";

  return (
    <div className={`min-h-screen text-on-surface font-body selection:bg-primary-container selection:text-on-primary-container ${!joinedTicket ? 'flex flex-col bg-surface spotlight-gradient' : 'bg-[#f8fcfd] spotlight-bg'}`}>
      
      {joinedTicket && (
        <header className="bg-white/95 backdrop-blur-md transition-colors flex justify-between items-center w-full px-6 py-4 fixed top-0 z-50 shadow-sm border-b border-outline-variant/10">
          <div className="flex items-center gap-4">
            <span className="text-2xl font-black tracking-tighter text-[#596000] font-headline">Lot 5 Barbershop</span>
          </div>
          <div className="flex items-center gap-4">
            <div className="w-8 h-8 rounded-full border-2 border-primary-container overflow-hidden bg-surface-container-high">
              <span className="material-symbols-outlined text-outline-variant leading-none mt-1 ml-1" style={{ fontSize: '20px' }}>person</span>
            </div>
          </div>
        </header>
      )}

      {/* -- MAIN CONTENT WRAPPER -- */}
      <div className="w-full relative z-10 flex flex-col">
        
        {/* TOP SCREEN: Dynamic Dashboard/Form */}
        <div className="w-full relative min-h-[90vh] flex flex-col justify-center max-w-[1000px] mx-auto pt-16 lg:pt-24 pb-16 px-4 md:px-8">
          <AnimatePresence mode="wait">
      {!joinedTicket ? (
        <motion.main 
           key="join"
           initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, y: -20, filter: "blur(10px)" }}
           transition={{ duration: 0.6 }}
           className="flex-grow flex items-center justify-center py-12 relative overflow-hidden min-h-[70vh]"
        >
          <div className="absolute top-0 -right-24 w-96 h-96 bg-primary-container/20 rounded-full blur-3xl mix-blend-multiply pointer-events-none"></div>
          <div className="absolute bottom-0 -left-24 w-80 h-80 bg-secondary/10 rounded-full blur-3xl mix-blend-multiply pointer-events-none"></div>

          <div className="w-full max-w-lg relative z-10">
            {isQueueOpen ? (
            <>
            <div className="text-center mb-10">
              <span className="text-3xl font-black tracking-tighter text-primary block mb-2 font-headline">Lot 5 Barbershop</span>
              <div className="h-1 w-12 bg-secondary mx-auto rounded-full"></div>
            </div>

            <div className="bg-surface-container-lowest rounded-xl shadow-[0_24px_48px_rgba(0,0,0,0.06)] overflow-hidden border border-outline-variant/10">
              <div className="p-8 md:p-12">
                <header className="mb-8 items-start">
                  <h1 className="font-headline text-4xl font-extrabold tracking-tight text-on-background leading-none mb-4">Join the Queue</h1>
                  <p className="text-on-surface-variant text-sm font-medium leading-relaxed max-w-xs">Enter your details to secure your spot in today's rotation. We'll text you when your chair is ready.</p>
                </header>

                <form onSubmit={joinQueue} className="space-y-6">
                  <div className="space-y-2">
                    <label className="block text-xs font-bold uppercase tracking-widest text-on-surface-variant ml-1">Name</label>
                    <div className="relative">
                      <User className="absolute left-4 top-1/2 -translate-y-1/2 text-outline-variant w-5 h-5" />
                      <input 
                        required type="text" value={name} onChange={e => setName(e.target.value)}
                        className="w-full pl-12 pr-4 py-4 bg-surface-container-low border-none rounded-xl focus:ring-2 focus:ring-secondary/20 focus:bg-surface-container-high transition-all duration-200 font-medium placeholder:text-outline-variant/60" 
                        placeholder="Enter your full name" 
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="block text-xs font-bold uppercase tracking-widest text-on-surface-variant ml-1">Phone Number</label>
                    <div className="relative">
                      <Phone className="absolute left-4 top-1/2 -translate-y-1/2 text-outline-variant w-5 h-5" />
                      <input 
                        required type="tel" value={phone} onChange={e => setPhone(e.target.value)}
                        className="w-full pl-12 pr-4 py-4 bg-surface-container-low border-none rounded-xl focus:ring-2 focus:ring-secondary/20 focus:bg-surface-container-high transition-all duration-200 font-medium placeholder:text-outline-variant/60" 
                        placeholder="(555) 000-0000" 
                      />
                    </div>
                  </div>

                  <button 
                    disabled={loading} type="submit"
                    className="w-full bg-primary-container text-on-primary-container font-headline font-extrabold text-lg py-5 rounded-full shadow-lg shadow-primary-container/20 hover:scale-[1.02] active:scale-[0.98] transition-all duration-200 mt-4 flex items-center justify-center gap-3 group disabled:opacity-50"
                  >
                    {loading ? 'Processing...' : 'Join Now'}
                    {!loading && <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />}
                  </button>
                </form>

                <div className="mt-10 pt-8 border-t border-outline-variant/10 flex items-center justify-between text-xs font-bold uppercase tracking-widest text-outline">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-secondary animate-pulse"></span>
                    <span>Current Wait: {queue.length > 0 ? queue.length * 20 : 0} Mins</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-sm" style={{ fontVariationSettings: "'FILL' 1" }}>event_seat</span>
                    <span>System Live</span>
                  </div>
                </div>
              </div>
            </div>
            </>
            ) : (
               <div className="bg-red-50 rounded-[2rem] shadow-xl overflow-hidden border-2 border-red-500/20 text-center p-12 relative animate-in zoom-in duration-500">
                 <div className="absolute top-0 left-0 w-full h-2 bg-red-500"></div>
                 <div className="w-24 h-24 bg-red-100 rounded-full mx-auto flex items-center justify-center mb-6">
                    <span className="material-symbols-outlined text-5xl text-red-600 font-black">block</span>
                 </div>
                 <h1 className="font-headline text-4xl font-extrabold tracking-tight text-red-600 mb-4">Queue Closed</h1>
                 <p className="text-red-900/80 font-medium leading-relaxed mb-8 text-lg">We’re currently at full capacity due to high demand. Please try again shortly or try again tomorrow.</p>
               </div>
            )}
            
            <div className="mt-8 flex justify-center gap-8">
                <a href="#" className="text-xs font-bold text-on-surface-variant hover:text-secondary transition-colors uppercase tracking-widest flex items-center gap-1">Policy</a>
            </div>
          </div>
        </motion.main>
      ) : (
      
      /* -- VIEW 2: LIVE DASHBOARD -- */
        <motion.main 
           key="dashboard"
           initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} 
           transition={{ duration: 0.8, delay: 0.2 }}
           className="px-0 relative z-10 min-h-[70vh]"
        >
          {myTicketStatus === 'CALLED' ? (
             <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4 animate-in fade-in zoom-in duration-500">
               <div className="w-32 h-32 bg-[#004be2] rounded-full flex items-center justify-center animate-bounce shadow-[0_0_60px_rgba(0,0,0,0.1)] mb-8 border-4 border-[#c5d0ff]">
                  <span className="material-symbols-outlined text-6xl text-white">campaign</span>
               </div>
               <h1 className="font-headline text-5xl md:text-6xl font-black text-[#004be2] tracking-tighter leading-tight mb-6">
                  Bro Its your turn,<br/>Jom jadi Handsome !
               </h1>
               <p className="text-[#545b00] bg-[#e5f638] px-6 py-3 rounded-full font-bold uppercase tracking-widest text-sm shadow-md mt-4 border border-[#545b00]/10">
                  Please proceed to the barbershop floor immediately.
               </p>
             </div>
          ) : (
          <>
          <section className="mb-10 text-center">
            <h1 className="font-headline text-5xl font-extrabold tracking-tight text-primary-dim mb-2">Live Status</h1>
            <p className="text-on-surface-variant font-medium">Sit back and relax. We'll notify you when it's your turn.</p>
          </section>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-[#c5d0ff] rounded-[2rem] p-8 flex flex-col items-center justify-center text-center shadow-sm relative overflow-hidden transition-all hover:shadow-md">
              <span className="text-sm font-label font-bold uppercase tracking-widest text-[#004be2] mb-4">Your Position</span>
              <div className="relative">
                <span className="font-headline text-[7rem] font-black text-[#004be2] tracking-tighter leading-none">{positionDisplay}</span>
                <span className="font-headline text-2xl font-bold text-[#004be2]/60 absolute top-2 -right-12">{positionSuffix}</span>
              </div>
              <p className="mt-4 font-body font-semibold text-[#004be2]/80">in the queue</p>
              <div className="absolute right-0 top-0 w-48 h-48 bg-white/20 blur-3xl rounded-full mix-blend-overlay pointer-events-none"></div>
            </div>

            <div className="bg-[#e5f638] rounded-[2rem] p-8 flex flex-col items-center justify-center text-center shadow-sm border border-[#545b00]/10 transition-all hover:shadow-md relative overflow-hidden">
              <span className="text-sm font-label font-bold uppercase tracking-widest text-[#545b00] mb-4">Estimated Wait</span>
              <div className="flex items-baseline gap-2 relative z-10">
                <span className="font-headline text-7xl font-black text-[#545b00] tracking-tighter leading-none">{peopleAhead * 20}</span>
                <span className="font-headline text-2xl font-bold text-[#545b00]">MIN</span>
              </div>
              <div className="mt-4 flex items-center gap-2 bg-black/5 px-4 py-1.5 rounded-full relative z-10">
                <span className="material-symbols-outlined text-sm text-[#545b00]" style={{ fontVariationSettings: "'FILL' 1" }}>bolt</span>
                <span className="text-xs font-bold text-[#545b00] uppercase tracking-tight">Active</span>
              </div>
              <div className="absolute left-0 bottom-0 w-48 h-48 bg-white/30 blur-3xl rounded-full mix-blend-overlay pointer-events-none"></div>
            </div>

            <div className="md:col-span-2 bg-white rounded-[2rem] p-8 shadow-sm border border-outline-variant/10">
              <div className="flex justify-between items-center mb-8 border-b border-outline-variant/5 pb-4">
                <h3 className="font-headline text-xl font-bold tracking-tight text-[#2f2e2e]">People Ahead of You</h3>
                <span className="bg-[#1a1a1a] text-[#e5f638] text-xs font-bold px-4 py-1.5 rounded-full uppercase tracking-wider">{peopleAhead} Remaining</span>
              </div>
              
              <div className="space-y-4">
                {queue.slice(0, Math.max(0, myQueueIndex)).map((q, i) => (
                  <div key={q.id} className={`flex items-center justify-between p-4 rounded-xl transition-all ${i === 0 ? 'bg-surface border border-outline-variant/10 shadow-sm' : 'bg-surface/50'}`}>
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-surface-container-high rounded-full flex items-center justify-center font-headline font-bold text-on-surface-variant">
                          {q.customer_name ? q.customer_name.substring(0, 2).toUpperCase() : 'CU'}
                      </div>
                      <div>
                        <p className="font-headline font-bold text-on-surface">{q.customer_name || 'Customer'}</p>
                        <p className="text-xs font-medium text-on-surface-variant">Ticket #{q.queue_number} • {i === 0 ? 'Next Up' : 'Waiting'}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`w-2 h-2 rounded-full ${i === 0 ? 'bg-[#004be2] animate-pulse' : 'bg-outline-variant'}`}></span>
                      <span className={`text-[10px] font-bold uppercase tracking-widest ${i === 0 ? 'text-[#004be2]' : 'text-on-surface-variant'}`}>
                          {i === 0 ? 'In Chair' : 'Waiting'}
                      </span>
                    </div>
                  </div>
                ))}

                {peopleAhead === 0 && (
                   <div className="py-8 text-center text-[#545b00] font-bold font-headline rounded-xl bg-[#e5f638] border border-[#545b00]/10 shadow-sm text-lg animate-pulse">
                       You are next in line! Head to the shop floor.
                   </div>
                )}
              </div>
            </div>

            <div className="md:col-span-2 flex flex-col gap-4 mt-8">
                <button 
                  onClick={exitQueue}
                  className="w-full bg-white text-red-500 font-headline font-extrabold py-5 rounded-full flex items-center justify-center gap-3 transition-all active:scale-95 hover:bg-red-50 hover:text-red-600 border border-red-100 shadow-sm group"
                >
                  <LogOut className="w-5 h-5 transition-transform group-hover:-translate-x-1" />
                  Exit Queue
                </button>
                <p className="text-center text-[10px] text-on-surface-variant font-bold uppercase tracking-[0.2em] px-8">
                  By exiting, you will lose your spot in line and must re-register to join again.
                </p>
            </div>
          </div>
          </>
          )}
          
          {/* Subtle noise pattern overlay */}
          <div className="fixed inset-0 pointer-events-none opacity-[0.02] bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] mix-blend-overlay -z-10"></div>
        </motion.main>
      )}
      </AnimatePresence>

          {/* Scroll Down Hint */}
          <motion.div 
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1 }}
            className="absolute bottom-4 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 text-on-surface-variant cursor-pointer group pb-4"
            onClick={() => {
                if (typeof window !== 'undefined') window.scrollTo({ top: window.innerHeight * 0.9, behavior: 'smooth' })
            }}
          >
            <span className="text-[10px] font-bold uppercase tracking-widest group-hover:text-[#004be2] transition-colors">Swipe Down</span>
            <motion.span 
               animate={{ y: [0, 8, 0] }} transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
               className="material-symbols-outlined group-hover:text-[#004be2] transition-colors"
            >
              expand_more
            </motion.span>
          </motion.div>
        </div>

        {/* SCISSORS SLICING DIVIDER */}
        <div className="w-full block relative overflow-hidden py-16 max-w-5xl mx-auto opacity-80 pt-8 pb-16">
            <div className="absolute top-1/2 left-0 w-full border-t-2 border-dashed border-[#e5f638]"></div>
            <motion.div 
               animate={{ x: ["-10vw", "95vw"] }} 
               transition={{ duration: 5, repeat: Infinity, ease: "linear" }}
               className="absolute top-1/2 -translate-y-[50%] flex items-center pr-2"
            >
               <span className="material-symbols-outlined text-[#545b00] text-2xl bg-white rounded-full p-2 border border-[#e5f638] shadow-sm transform -rotate-90" style={{ fontVariationSettings: "'FILL' 1" }}>content_cut</span>
            </motion.div>
        </div>

        {/* BOTTOM SECTION: Promotional & Information */}
        <div className="w-full max-w-4xl mx-auto flex flex-col gap-6 px-4 md:px-8 pb-32">
             <div className="bg-[#1a1a1a] text-white p-8 rounded-[2rem] flex flex-col justify-center shadow-lg text-center md:text-left">
                <h2 className="font-headline text-4xl font-black leading-none tracking-tight mb-4 mt-2">Why choose Lot 5?</h2>
                <div className="w-12 h-1.5 bg-[#e5f638] rounded-full mx-auto md:mx-0"></div>
             </div>

             <div className="grid grid-cols-1 gap-6">
                 {/* Card 1 */}
                 <div className="bg-white rounded-[2rem] border border-outline-variant/10 shadow-sm overflow-hidden flex flex-col md:flex-row items-stretch group hover:shadow-md transition-shadow">
                     <div className="w-full md:w-2/5 h-64 md:h-auto shrink-0 overflow-hidden relative">
                         <img src="/barber-1.jpg" alt="Master Quality" className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-700 ease-out" />
                     </div>
                     <div className="p-8 md:p-10 flex flex-col justify-center gap-2 relative w-full">
                         <span className="absolute -top-6 md:top-auto md:-left-6 right-8 md:right-auto bg-[#e5f638] text-[#545b00] w-14 h-14 rounded-full flex items-center justify-center font-black shadow-md border-4 border-white material-symbols-outlined z-10 text-xl" style={{ fontVariationSettings: "'FILL' 1" }}>content_cut</span>
                         <h3 className="font-headline font-extrabold text-2xl text-[#2f2e2e] mt-2">Master Quality</h3>
                         <p className="text-sm text-on-surface-variant font-medium leading-relaxed">Every cut is an editorial masterpiece crafted with precision in an upscale environment.</p>
                     </div>
                 </div>

                 {/* Card 2 */}
                  <div className="bg-white rounded-[2rem] border border-outline-variant/10 shadow-sm overflow-hidden flex flex-col md:flex-row items-stretch group hover:shadow-md transition-shadow">
                     <div className="w-full md:w-2/5 h-64 md:h-auto shrink-0 overflow-hidden relative">
                         <img src="/barber-2.jpg" alt="Maximum Efficiency" className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-700 ease-out" />
                     </div>
                     <div className="p-8 md:p-10 flex flex-col justify-center gap-2 relative w-full">
                         <span className="absolute -top-6 md:top-auto md:-left-6 right-8 md:right-auto bg-[#c5d0ff] text-[#004be2] w-14 h-14 rounded-full flex items-center justify-center font-black shadow-md border-4 border-white material-symbols-outlined z-10 text-xl" style={{ fontVariationSettings: "'FILL' 1" }}>timer</span>
                         <h3 className="font-headline font-extrabold text-2xl text-[#2f2e2e] mt-2">Max Efficiency</h3>
                         <p className="text-sm text-on-surface-variant font-medium leading-relaxed">Skip the waiting room. Track your turn live and arrive right as your chair opens.</p>
                     </div>
                 </div>

                 {/* Card 3 */}
                  <div className="bg-white rounded-[2rem] border border-outline-variant/10 shadow-sm overflow-hidden flex flex-col md:flex-row items-stretch group hover:shadow-md transition-shadow">
                     <div className="w-full md:w-2/5 h-64 md:h-auto shrink-0 overflow-hidden relative">
                         <img src="/barber-3.jpg" alt="Premium Vibe" className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-700 ease-out" />
                     </div>
                     <div className="p-8 md:p-10 flex flex-col justify-center gap-2 relative w-full">
                         <span className="absolute -top-6 md:top-auto md:-left-6 right-8 md:right-auto bg-[#1a1a1a] text-white w-14 h-14 rounded-full flex items-center justify-center font-black shadow-md border-4 border-white material-symbols-outlined z-10 text-xl" style={{ fontVariationSettings: "'FILL' 1" }}>spa</span>
                         <h3 className="font-headline font-extrabold text-2xl text-[#2f2e2e] mt-2">Premium Vibe</h3>
                         <p className="text-sm text-on-surface-variant font-medium leading-relaxed">Premium beverages, hot towel finishing, and the absolute best grooming products.</p>
                     </div>
                 </div>
             </div>
        </div>

      </div>
    </div>
  )
}
