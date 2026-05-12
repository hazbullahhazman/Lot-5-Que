'use client'

import { useEffect, useState } from 'react'
import { createClient as supabase } from '@/utils/supabase/client'
import { motion, AnimatePresence } from 'framer-motion'
import { Cloud, Sun, CloudRain, Users, Clock, UsersRound } from 'lucide-react'

// Types
type QueueEntry = {
  id: string
  queue_number: number
  status: string
  customer_name?: string
  booked_time?: string
  profiles?: { name: string }
}

export default function TVDashboard() {
  const [activeQueue, setActiveQueue] = useState<QueueEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [now, setNow] = useState(new Date())
  
  // Weather state
  const [weather, setWeather] = useState({ temp: 32, condition: 'Sunny' })

  // Operations settings
  const [shopSettings, setShopSettings] = useState({
     barbers: [{ id: '1', name: 'Julian', active: true, role: 'both' }]
  })

  // Start clock & fetch weather
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000)
    
    // Fetch Weather for Johor Bahru
    const fetchWeather = async () => {
      try {
         const res = await fetch('https://api.open-meteo.com/v1/forecast?latitude=1.4927&longitude=103.7414&current_weather=true')
         if (res.ok) {
            const data = await res.json()
            setWeather({
               temp: Math.round(data.current_weather.temperature),
               condition: getWeatherCondition(data.current_weather.weathercode)
            })
         }
      } catch (err) {
         console.error("Weather fetch failed", err)
      }
    }
    fetchWeather()
    const weatherTimer = setInterval(fetchWeather, 30 * 60 * 1000)

    return () => {
       clearInterval(timer)
       clearInterval(weatherTimer)
    }
  }, [])

  const getWeatherCondition = (code: number) => {
     if (code <= 3) return 'Sunny'
     if (code >= 51 && code <= 67) return 'Rainy'
     if (code >= 80 && code <= 82) return 'Rainy'
     if (code >= 95) return 'Stormy'
     return 'Cloudy'
  }

  const WeatherIcon = () => {
      if (weather.condition === 'Sunny') return <Sun className="w-10 h-10 md:w-12 md:h-12 text-[#e5f638]" />
      if (weather.condition === 'Rainy') return <CloudRain className="w-10 h-10 md:w-12 md:h-12 text-[#004be2]" />
      return <Cloud className="w-10 h-10 md:w-12 md:h-12 text-gray-400" />
  }

  // Supabase real-time
  useEffect(() => {
    fetchInitialData()

    let channel: any
    if (process.env.NEXT_PUBLIC_SUPABASE_URL && !process.env.NEXT_PUBLIC_SUPABASE_URL.includes('placeholder')) {
        channel = supabase()
          .channel('tv-events')
          .on('postgres_changes', { event: '*', schema: 'public', table: 'queue_entries' }, () => fetchInitialData())
          .on('postgres_changes', { event: '*', schema: 'public', table: 'settings' }, () => fetchInitialData())
          .subscribe()
    }

    return () => { if (channel) supabase().removeChannel(channel) }
  }, [])

  const fetchInitialData = async () => {
      // Mock Support
      if (!process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL.includes('placeholder')) {
         setActiveQueue([
            { id: 'q1', queue_number: 42, status: 'CALLED', customer_name: 'Julian D.' },
            { id: 'q2', queue_number: 43, status: 'WAITING', customer_name: 'Marcus K.' },
            { id: 'q3', queue_number: 44, status: 'WAITING', customer_name: 'Azman' },
            { id: 'q4', queue_number: 45, status: 'WAITING', customer_name: 'Hafiz' },
            { id: 'q5', queue_number: 46, status: 'WAITING', customer_name: 'Zul' },
         ])
         setShopSettings({
            barbers: [
               { id: '1', name: 'Julian', active: true, role: 'both' },
               { id: '2', name: 'Marcus', active: true, role: 'queue' }
            ]
         })
         setLoading(false)
         return
      }

      const { data: sData } = await supabase().from('settings').select('raw_settings').eq('id', 1).single()
      if (sData?.raw_settings) setShopSettings(sData.raw_settings as any)

      const { data: qList } = await supabase()
         .from('queue_entries')
         .select('id, queue_number, status, customer_name, booked_time, profiles(name)')
         .in('status', ['WAITING', 'CALLED'])
         .order('queue_number', { ascending: true })
      
      if (qList) setActiveQueue(qList as QueueEntry[])
      setLoading(false)
  }

  const calledTickets = activeQueue.filter(q => q.status === 'CALLED')
  const waitingTickets = activeQueue.filter(q => q.status === 'WAITING' && !q.booked_time)
  
  const nowServing = calledTickets.length > 0 ? calledTickets[0] : null
  const nextUp = waitingTickets.length > 0 ? waitingTickets[0] : null
  const upcomingQueue = waitingTickets.slice(1, 11) // Next 10

  const activeWalkInBarbers = Math.max(1, shopSettings.barbers.filter((b:any) => b.active && (b.role === 'both' || b.role === 'queue')).length)
  const estPerPerson = 30; // 30 mins per haircut assumed
  const totalWaiting = waitingTickets.length;
  const estWaitTime = Math.ceil((totalWaiting * estPerPerson) / activeWalkInBarbers)

  if (loading) return <div className="min-h-screen bg-[#f8fcfd] flex items-center justify-center"><div className="w-16 h-16 border-4 border-[#004be2]/20 border-t-[#004be2] rounded-full animate-spin"></div></div>

  return (
    <div className="min-h-screen bg-[#f8fcfd] text-gray-900 font-body selection:bg-[#c5d0ff] selection:text-[#004be2] overflow-hidden flex flex-col p-6 md:p-10 TV-Layout relative">
      
      {/* Background Decorative Abstract Shapes */}
      <div className="absolute top-[-10%] right-[-5%] w-[800px] h-[800px] bg-[#e5f638]/20 rounded-full blur-[150px] pointer-events-none mix-blend-multiply"></div>
      <div className="absolute bottom-[-10%] left-[-5%] w-[600px] h-[600px] bg-[#004be2]/10 rounded-full blur-[150px] pointer-events-none mix-blend-multiply"></div>

      {/* 1. Header Section */}
      <header className="relative z-10 flex justify-between items-center w-full mb-12 bg-white/70 rounded-[2.5rem] p-6 md:p-8 border border-gray-200/50 backdrop-blur-xl shadow-sm">
        <div>
           <h1 className="text-5xl md:text-6xl font-black font-headline tracking-tighter text-[#004be2] mb-2 drop-shadow-sm">
              {now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}
           </h1>
           <p className="text-2xl md:text-3xl font-bold text-gray-500 uppercase tracking-widest">
              {now.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
           </p>
        </div>
        <div className="flex items-center gap-5 bg-white px-8 py-5 rounded-[2rem] border border-gray-100 shadow-md">
           <WeatherIcon />
           <div>
              <p className="text-3xl md:text-4xl font-black text-gray-800">{weather.temp}°C</p>
              <p className="text-sm font-bold text-[#004be2] uppercase tracking-widest">{weather.condition}</p>
           </div>
        </div>
      </header>

      {/* 2. Main Status Section (The Big 3) */}
      <section className="relative z-10 grid grid-cols-1 lg:grid-cols-3 gap-8 mb-12">
        {/* Now Serving */}
        <div className="col-span-1 bg-[#004be2] rounded-[3rem] p-10 flex flex-col items-center justify-center text-center shadow-2xl shadow-[#004be2]/30 relative overflow-hidden border border-[#c5d0ff]/20 transform transition-all">
           <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-10 mix-blend-overlay"></div>
           <div className="absolute top-0 left-0 w-full h-3 bg-[#e5f638] animate-pulse"></div>
           
           <span className="bg-[#e5f638] text-[#545b00] px-6 py-2 rounded-full text-lg md:text-xl font-black uppercase tracking-widest mb-6 shadow-md z-10 block">
              Now Serving
           </span>
           
           <div className="flex flex-col items-center justify-center w-full min-h-[160px] z-10">
              {nowServing ? (
                 <>
                   <span className="font-headline text-[8rem] md:text-[11rem] font-black text-white leading-none tracking-tighter drop-shadow-md">#{nowServing.queue_number}</span>
                   <p className="text-3xl font-bold text-[#c5d0ff] mt-4 truncate w-full max-w-full px-4">{nowServing.customer_name || nowServing.profiles?.name || 'Walk-in'}</p>
                 </>
              ) : (
                 <span className="font-headline text-5xl md:text-6xl font-black text-[#c5d0ff]/50 leading-none tracking-tighter">--</span>
              )}
           </div>
        </div>

        {/* Next Up */}
        <div className="col-span-1 bg-white rounded-[3rem] p-10 flex flex-col items-center justify-center text-center shadow-xl shadow-gray-200/50 border border-gray-100 relative overflow-hidden">
           <span className="text-xl md:text-2xl font-black uppercase tracking-widest text-[#004be2] mb-6 block">Next Up</span>
           <div className="flex flex-col items-center justify-center w-full min-h-[160px]">
              {nextUp ? (
                 <>
                   <span className="font-headline text-[7rem] md:text-[9rem] font-black text-gray-800 leading-none tracking-tighter opacity-90 drop-shadow-sm">#{nextUp.queue_number}</span>
                   <p className="text-2xl font-bold text-gray-500 mt-4 truncate w-full max-w-full px-4">{nextUp.customer_name || nextUp.profiles?.name || 'Walk-in'}</p>
                 </>
              ) : (
                 <span className="font-headline text-5xl md:text-6xl font-black text-gray-300 leading-none tracking-tighter">--</span>
              )}
           </div>
        </div>

        {/* Queue Metrics Board */}
        <div className="col-span-1 bg-white rounded-[3rem] p-10 flex flex-col items-stretch justify-center shadow-xl shadow-gray-200/50 border border-gray-100 relative overflow-hidden">
           <span className="text-xl font-black uppercase tracking-widest text-[#004be2] mb-8 text-center block">Live Status Board</span>
           
           <div className="space-y-6">
              <div className="flex items-center justify-between bg-[#f8fcfd] p-5 rounded-2xl border border-[#c5d0ff]/40">
                 <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-full bg-[#c5d0ff] text-[#004be2] flex items-center justify-center"><UsersRound className="w-6 h-6"/></div>
                    <span className="font-bold text-gray-600 text-lg">Active Barbers</span>
                 </div>
                 <span className="text-3xl font-black text-[#004be2]">{activeWalkInBarbers}</span>
              </div>

              <div className="flex items-center justify-between bg-[#f8fcfd] p-5 rounded-2xl border border-[#c5d0ff]/40">
                 <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-full bg-[#e5f638]/30 text-[#545b00] flex items-center justify-center"><Users className="w-6 h-6"/></div>
                    <span className="font-bold text-gray-600 text-lg">Waiting Queue</span>
                 </div>
                 <span className="text-3xl font-black text-gray-800">{totalWaiting}</span>
              </div>

              <div className="flex items-center justify-between bg-[#e5f638] p-5 rounded-2xl border border-[#545b00]/10 shadow-sm">
                 <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-full bg-white text-[#545b00] flex items-center justify-center"><Clock className="w-6 h-6"/></div>
                    <div className="flex flex-col">
                       <span className="font-black text-[#545b00] text-lg leading-tight">Est. Wait Time</span>
                       <span className="font-bold text-[#545b00]/70 text-xs uppercase tracking-widest">~{estPerPerson}m per person</span>
                    </div>
                 </div>
                 <div className="flex items-baseline gap-1">
                    <span className="text-4xl font-headline font-black text-[#545b00]">{estWaitTime}</span>
                    <span className="text-sm font-bold text-[#545b00]">m</span>
                 </div>
              </div>
           </div>
        </div>
      </section>

      {/* 3. Upcoming Queue Section */}
      <section className="relative z-10 flex-1 bg-white rounded-[3rem] border border-gray-100 p-8 flex flex-col shadow-xl shadow-gray-200/50 overflow-hidden">
         <h2 className="text-3xl font-black font-headline uppercase tracking-widest text-gray-800 mb-8 flex items-center gap-4">
            <span className="w-3 h-8 bg-[#e5f638] rounded-full"></span> Upcoming Queue
         </h2>
         
         {upcomingQueue.length === 0 ? (
            <div className="flex-1 flex items-center justify-center bg-gray-50 rounded-3xl border-2 border-dashed border-gray-200">
               <p className="text-2xl font-bold text-gray-400 uppercase tracking-widest">No more customers waiting</p>
            </div>
         ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-x-12 gap-y-6">
               <AnimatePresence mode="popLayout">
                  {upcomingQueue.map((q, i) => (
                     <motion.div 
                        key={q.id}
                        layout
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        transition={{ duration: 0.4 }}
                        className="flex items-center justify-between p-6 rounded-2xl bg-white border border-gray-200 hover:border-[#004be2]/30 shadow-sm transition-colors"
                     >
                        <div className="flex items-center gap-6">
                           <div className="w-16 h-16 rounded-[1.2rem] bg-[#f8fcfd] flex items-center justify-center font-black text-2xl text-[#004be2] border border-[#c5d0ff]/50 shadow-inner">
                              {i + 1}
                           </div>
                           <div>
                              <div className="flex items-baseline gap-3">
                                 <span className="font-headline text-5xl font-black text-gray-800 tracking-tighter">#{q.queue_number}</span>
                                 <span className="text-2xl font-bold text-gray-500 truncate max-w-[200px]">({q.customer_name || q.profiles?.name || 'Walk-in'})</span>
                              </div>
                           </div>
                        </div>
                        <span className="bg-gray-100 text-gray-500 px-6 py-2.5 rounded-full font-black uppercase tracking-widest text-sm border border-gray-200">
                           Waiting
                        </span>
                     </motion.div>
                  ))}
               </AnimatePresence>
            </div>
         )}
      </section>

    </div>
  )
}
