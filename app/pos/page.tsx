'use client'

import { useEffect, useState, useMemo } from 'react'
import { createClient as supabase } from '@/utils/supabase/client'
import { motion, AnimatePresence } from 'framer-motion'
import { Search, MapPin, CheckCircle, Calculator, User, CreditCard, Banknote, RefreshCw, Scissors, TrendingUp, Users, Menu } from 'lucide-react'
import AppSidebar from '@/components/AppSidebar'

// Mock Data for offline prototyping
const MOCK_BARBERS = [
  { id: 'b1', name: 'Julian D.', active: true },
  { id: 'b2', name: 'Marcus K.', active: true }
]

const MOCK_PRICING = [
  { service_type: 'Student', base_price: 15.00, commission_type: 'fixed', barber_cut: 10.00 },
  { service_type: 'Staff / Outsider', base_price: 18.00, commission_type: 'fixed', barber_cut: 10.00 },
  { service_type: 'Palapes', base_price: 10.00, commission_type: 'fixed', barber_cut: 8.00 },
  { service_type: 'OKU / Warga Emas', base_price: 10.00, commission_type: 'fixed', barber_cut: 8.00 },
  { service_type: 'Highschool', base_price: 12.00, commission_type: 'fixed', barber_cut: 8.00 }
]

const MOCK_ADDONS = [
  { id: 'a1', name: 'Moustache Trim', price: 3.00, commission_type: 'percentage', barber_cut: 50.00 },
  { id: 'a2', name: 'Beard Trim', price: 5.00, commission_type: 'percentage', barber_cut: 50.00 },
  { id: 'a3', name: 'Hair Wash', price: 10.00, commission_type: 'percentage', barber_cut: 50.00 },
  { id: 'a4', name: 'Hair Colour', price: 30.00, commission_type: 'percentage', barber_cut: 50.00 },
  { id: 'a5', name: 'Design / Pattern', price: 5.00, commission_type: 'percentage', barber_cut: 50.00 }
]

export default function POSSystem() {
  const [profile, setProfile] = useState<any>(null)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  
  // Database State
  const [activeQueue, setActiveQueue] = useState<any[]>([])
  const [barbers, setBarbers] = useState<any[]>(MOCK_BARBERS)
  const [pricing, setPricing] = useState<any[]>(MOCK_PRICING)
  const [addons, setAddons] = useState<any[]>(MOCK_ADDONS)
  
  // Transaction State
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCustomer, setSelectedCustomer] = useState<any>(null)
  const [selectedBarber, setSelectedBarber] = useState<string>('')
  const [selectedService, setSelectedService] = useState<any>(null)
  const [selectedAddons, setSelectedAddons] = useState<any[]>([])
  const [tips, setTips] = useState<number>(0)
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'qr' | null>(null)

  const [isSubmitting, setIsSubmitting] = useState(false)
  const [showSuccess, setShowSuccess] = useState(false)

  useEffect(() => {
    checkPOSAuth()
  }, [])

  const checkPOSAuth = async () => {
     if (!process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL.includes('placeholder')) {
         const role = localStorage.getItem('mock_role') || 'owner'
         if (!['admin', 'owner', 'barber'].includes(role)) {
             window.location.href = '/login'
         } else {
             setProfile({ id: 'admin-123', name: 'Offline Admin', role })
             fetchData()
         }
         return
     }

     const { data: { session } } = await supabase().auth.getSession()
     if (!session) { window.location.href = '/login'; return }
     
     const { data } = await supabase().from('profiles').select('*').eq('id', session.user.id).single()
     if (!data || !['admin', 'owner', 'barber'].includes(data.role)) {
         window.location.href = '/dashboard' // Not authorized
         return
     }

     setProfile(data)
     fetchData()
  }

  const fetchData = async () => {
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL.includes('placeholder')) {
       // Mock queue load
       setActiveQueue([
          { id: '1', queue_number: 14, customer_name: 'Ahmad Zikri', status: 'WAITING' },
          { id: '2', queue_number: 15, customer_name: 'Farhan S.', status: 'WAITING' }
       ])
       return
    }

    try {
      const q = await supabase().from('queue_entries').select('*').in('status', ['WAITING', 'CALLED'])
      if (q.data) setActiveQueue(q.data)

      const b = await supabase().from('barbers').select('*').eq('active', true)
      if (b.data && b.data.length > 0) setBarbers(b.data)

      const p = await supabase().from('pricing_config').select('*')
      if (p.data && p.data.length > 0) setPricing(p.data)

      const a = await supabase().from('addon_items').select('*').eq('active', true)
      if (a.data && a.data.length > 0) setAddons(a.data)
    } catch (e) {
      console.error(e)
    }
  }

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    if (!searchQuery) return
    const cust = activeQueue.find(q => 
        q.queue_number.toString() === searchQuery || 
        (q.customer_name && q.customer_name.toLowerCase().includes(searchQuery.toLowerCase()))
    )
    if (cust) {
        setSelectedCustomer(cust)
        setSearchQuery('')
    } else {
        alert("Customer not found in active queue.")
    }
  }

  const toggleAddon = (addon: any) => {
      if (selectedAddons.find(a => a.id === addon.id)) {
          setSelectedAddons(prev => prev.filter(a => a.id !== addon.id))
      } else {
          setSelectedAddons(prev => [...prev, addon])
      }
  }

  const subtotal = useMemo(() => {
      let total = 0
      if (selectedService) total += Number(selectedService.base_price)
      selectedAddons.forEach(a => total += Number(a.price))
      return total
  }, [selectedService, selectedAddons])

  const totalAmount = subtotal + tips

  const isFormValid = selectedCustomer && selectedService && paymentMethod

  const handleReset = () => {
      setSelectedCustomer(null)
      setSelectedService(null)
      setSelectedAddons([])
      setTips(0)
      setPaymentMethod(null)
  }

  const handleSubmitTransaction = async () => {
      if (!isFormValid) return
      setIsSubmitting(true)
      
      let commissionAmount = 0;
      
      // Calculate Service Commission
      if (selectedService.commission_type === 'fixed') {
         commissionAmount += Number(selectedService.barber_cut || 0);
      } else {
         const cutRate = Number(selectedService.barber_cut || 50) / 100;
         commissionAmount += Number(selectedService.base_price) * cutRate;
      }
      
      // Calculate Addons Commission
      selectedAddons.forEach(a => {
         if (a.commission_type === 'fixed') {
             commissionAmount += Number(a.barber_cut || 0);
         } else {
             const cutRate = Number(a.barber_cut || 50) / 100;
             commissionAmount += Number(a.price) * cutRate;
         }
      });

      const transactionPayload = {
          queue_number: selectedCustomer.queue_number.toString(),
          customer_name: selectedCustomer.customer_name,
          customer_id: selectedCustomer.user_id || null,
          service_type: selectedService.service_type,
          items: selectedAddons,
          subtotal,
          tips,
          total: totalAmount,
          payment_method: paymentMethod,
          barber_id: profile?.id,
          barber_name: profile?.name,
          commission_amount: commissionAmount,
          status: 'COMPLETED'
      }

      if (process.env.NEXT_PUBLIC_SUPABASE_URL && !process.env.NEXT_PUBLIC_SUPABASE_URL.includes('placeholder')) {
         // 1. Insert Transaction
         const { error: txError } = await supabase().from('transactions').insert([transactionPayload])
         if (txError) console.error("Transaction Insert Error:", txError)
         
         // 2. Mark queue as completed
         await supabase().from('queue_entries').update({ status: 'COMPLETED' }).eq('id', selectedCustomer.id)
      } else {
         console.log("Mock saved:", transactionPayload)
      }

      // Success Sequence
      setShowSuccess(true)
      setTimeout(() => {
          setShowSuccess(false)
          handleReset()
          setIsSubmitting(false)
          fetchData()
      }, 2500)
  }

  if (!profile) return <div className="min-h-screen flex items-center justify-center p-10 font-bold text-lg text-on-surface">Initializing Secure POS...</div>

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
         activeTab={'pos'} 
         profile={profile} 
      />

      <main className="md:pl-64 flex-1 overflow-y-auto px-4 md:px-8 py-8 flex flex-col xl:flex-row gap-8 max-w-[1500px] mx-auto animate-in fade-in duration-500">
         
         {/* Left Side - Controls */}
         <div className="flex-1 space-y-6">
            
            {/* 1A. Customer Input */}
            <section className="bg-white p-6 md:p-8 rounded-[2rem] shadow-sm border border-outline-variant/10">
               <h2 className="text-sm font-black uppercase tracking-widest text-[#004be2] mb-4 flex items-center gap-2">
                 <User className="w-4 h-4"/> 1. Load Customer
               </h2>
               <div className="flex gap-4 mb-4">
                   <form onSubmit={handleSearch} className="flex-1 flex bg-surface-container rounded-full overflow-hidden focus-within:ring-2 focus-within:ring-[#004be2]/50 transition-shadow">
                      <input 
                        type="text" 
                        placeholder="Search Queue Number (e.g. 14) or Name..." 
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                        className="flex-1 bg-transparent px-6 py-4 outline-none font-bold text-sm"
                      />
                      <button type="submit" className="bg-[#004be2] text-white px-6 font-bold text-sm hover:bg-[#004be2]/90 transition-colors">
                         Load
                      </button>
                   </form>
               </div>
               
               {/* Selected Target visualization */}
               {selectedCustomer ? (
                   <div className="bg-[#e5f638]/20 border border-[#545b00]/10 rounded-2xl p-4 flex justify-between items-center animate-in slide-in-from-top-4 duration-300">
                      <div>
                         <span className="text-[#545b00] font-black text-xl block leading-none">{selectedCustomer.customer_name}</span>
                         <span className="text-xs font-bold text-[#545b00]/60 uppercase tracking-widest mt-1 block">Found in active queue</span>
                      </div>
                      <div className="bg-[#545b00] text-[#e5f638] px-4 py-2 rounded-xl font-headline font-black text-xl shadow-inner">
                         #{selectedCustomer.queue_number}
                      </div>
                   </div>
               ) : (
                   <div className="border-2 border-dashed border-outline-variant/20 rounded-2xl p-8 text-center text-on-surface-variant focus-within:bg-[#f8fcfd]">
                      <p className="font-bold text-sm">No customer loaded.</p>
                      <p className="text-xs mt-1 opacity-70">Search to load customer details.</p>
                      
                      {/* Mini manual quick select for prototype */}
                      <div className="flex flex-wrap justify-center gap-2 mt-4">
                         {activeQueue.map(q => (
                             <button key={q.id} onClick={() => setSelectedCustomer(q)} className="bg-surface border border-outline-variant/10 hover:border-[#004be2]/30 px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-[#c5d0ff]/20 transition-all font-body text-on-surface">
                                #{q.queue_number} {q.customer_name?.split(' ')[0]}
                             </button>
                         ))}
                      </div>
                   </div>
               )}
            </section>

            {/* 1B. Barber Display */}
            <section className={`bg-white p-6 md:p-8 rounded-[2rem] shadow-sm border border-outline-variant/10 transition-opacity duration-300 ${!selectedCustomer ? 'opacity-50 pointer-events-none' : 'opacity-100'}`}>
               <h2 className="text-sm font-black uppercase tracking-widest text-[#004be2] mb-4 flex items-center gap-2">
                 <Scissors className="w-4 h-4"/> 2. Served By
               </h2>
               <div className="py-3 px-4 rounded-xl border-2 border-[#004be2] bg-[#c5d0ff] text-[#004be2] shadow-sm font-bold text-sm flex items-center gap-3 w-max">
                  <div className="w-6 h-6 rounded-full bg-white flex items-center justify-center font-black text-[10px] text-black">
                     {profile?.name ? profile.name.substring(0, 1) : 'U'}
                  </div>
                  {profile?.name || 'Loading...'}
               </div>
            </section>

            {/* 1C & 1D. Services and Addons */}
            <section className={`bg-white p-6 md:p-8 rounded-[2rem] shadow-sm border border-outline-variant/10 transition-opacity duration-300 ${!selectedBarber ? 'opacity-50 pointer-events-none' : 'opacity-100'}`}>
               <h2 className="text-sm font-black uppercase tracking-widest text-[#004be2] mb-4">3. Service & Items</h2>
               
               <p className="text-xs font-bold text-on-surface-variant uppercase tracking-widest mb-3">Base Service (Required)</p>
               <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3 mb-8">
                  {pricing.map(item => (
                      <button 
                         key={item.service_type}
                         onClick={() => setSelectedService(item)}
                         className={`p-4 rounded-2xl border flex flex-col justify-between items-start text-left h-24 transition-all ${
                             selectedService?.service_type === item.service_type
                               ? 'bg-[#e5f638] border-[#545b00]/20 text-[#545b00] shadow-sm scale-[1.02]' 
                               : 'bg-surface border-outline-variant/10 hover:border-[#004be2]/30 text-on-surface'
                         }`}
                      >
                         <span className="font-bold text-sm leading-tight">{item.service_type}</span>
                         <span className="font-black text-lg block mt-2">RM {Number(item.base_price).toFixed(2)}</span>
                      </button>
                  ))}
               </div>

               <p className="text-xs font-bold text-on-surface-variant uppercase tracking-widest mb-3">Add-ons (Optional)</p>
               <div className="flex flex-wrap gap-2">
                  {addons.map(addon => {
                      const isSelected = selectedAddons.find(a => a.id === addon.id)
                      return (
                          <button 
                             key={addon.id}
                             onClick={() => toggleAddon(addon)}
                             className={`px-4 py-2 rounded-full border text-sm font-bold transition-colors ${
                                 isSelected 
                                   ? 'bg-black text-white border-black' 
                                   : 'bg-surface border-outline-variant/20 hover:border-black/30 text-on-surface'
                             }`}
                          >
                             {addon.name} <span className={`ml-1 opacity-60 ${isSelected ? 'text-[#e5f638]' : ''}`}>+RM{Number(addon.price).toFixed(2)}</span>
                          </button>
                      )
                  })}
               </div>
            </section>

         </div>

         {/* Right Side - Receipt & Payment */}
         <div className="w-full lg:w-[400px] flex-shrink-0 space-y-6 lg:sticky lg:top-24 h-max">
            
            {/* 1E & 1F. Payment & Tips Layout inside a single panel */}
            <section className={`bg-white p-6 md:p-8 rounded-[2rem] shadow-sm border border-outline-variant/10 transition-opacity duration-300 ${!selectedService ? 'opacity-50 pointer-events-none' : 'opacity-100'}`}>
               
               <h2 className="text-sm font-black uppercase tracking-widest text-[#004be2] mb-4">4. Payment & Tips</h2>
               
               {/* Tips Input */}
               <div className="mb-8">
                  <div className="flex justify-between items-center mb-2">
                     <label className="text-xs font-bold text-on-surface-variant uppercase tracking-widest">Tips (Optional)</label>
                     <span className="text-sm font-black">RM {tips.toFixed(2)}</span>
                  </div>
                  <div className="flex gap-2 mb-3">
                     {[0, 2, 5, 10].map(t => (
                        <button 
                           key={t}
                           onClick={() => setTips(t)}
                           className={`flex-1 py-2 font-bold text-sm rounded-xl border ${tips === t ? 'bg-black text-white border-black' : 'bg-surface text-on-surface border-outline-variant/10 hover:bg-surface-container'}`}
                        >
                           {t === 0 ? 'None' : `+RM ${t}`}
                        </button>
                     ))}
                  </div>
               </div>

               {/* Payment Method */}
               <div className="mb-4">
                  <label className="text-xs font-bold text-on-surface-variant uppercase tracking-widest mb-2 block">Method (Required)</label>
                  <div className="grid grid-cols-2 gap-3">
                     <button 
                        onClick={() => setPaymentMethod('cash')}
                        className={`p-4 rounded-2xl flex flex-col items-center justify-center gap-2 border-2 transition-colors ${paymentMethod === 'cash' ? 'border-[#004be2] bg-[#c5d0ff]/30 text-[#004be2]' : 'border-transparent bg-surface-container text-on-surface-variant hover:bg-surface-container-high'}`}
                     >
                        <Banknote className="w-6 h-6"/>
                        <span className="font-bold text-sm">Cash</span>
                     </button>
                     <button 
                        onClick={() => setPaymentMethod('qr')}
                        className={`p-4 rounded-2xl flex flex-col items-center justify-center gap-2 border-2 transition-colors ${paymentMethod === 'qr' ? 'border-[#545b00] bg-[#e5f638]/30 text-[#545b00]' : 'border-transparent bg-surface-container text-on-surface-variant hover:bg-surface-container-high'}`}
                     >
                        <CreditCard className="w-6 h-6"/>
                        <span className="font-bold text-sm">QR / Transfer</span>
                     </button>
                  </div>
               </div>
            </section>

            {/* LIVE RECEIPT */}
            <div className="bg-[#fcfbf9] p-6 rounded-[2rem] shadow-sm border border-outline-variant/20 font-mono text-sm relative overflow-hidden group">
               {/* Tear edge effect using dashed border at top/bottom visually */}
               <div className="absolute top-0 left-0 w-full h-2 border-t-2 border-dashed border-outline-variant/20"></div>
               
               <div className="text-center mb-6 pt-2">
                  <h3 className="font-black text-xl uppercase tracking-widest">LOT 5 BARBERSHOP</h3>
                  <p className="text-xs opacity-60">UTM Skudai, Johor</p>
                  <div className="w-full border-b border-dashed border-black/20 my-4"></div>
               </div>

               <div className="space-y-1 mb-6">
                  <div className="flex justify-between"><span className="opacity-60">Queue No:</span> <strong>{selectedCustomer ? `#${selectedCustomer.queue_number}` : '--'}</strong></div>
                  <div className="flex justify-between"><span className="opacity-60">Customer:</span> <strong>{selectedCustomer?.customer_name || '--'}</strong></div>
                  <div className="flex justify-between"><span className="opacity-60">Date:</span> <strong>{new Date().toLocaleDateString('en-MY')}</strong></div>
                  <div className="flex justify-between"><span className="opacity-60">Served By:</span> <strong>{profile?.name || '--'}</strong></div>
                  <div className="flex justify-between"><span className="opacity-60">Status:</span> <strong>{paymentMethod ? paymentMethod.toUpperCase() : 'PENDING'}</strong></div>
               </div>

               <div className="w-full border-b border-dashed border-black/20 my-4"></div>

               <div className="space-y-2 mb-4">
                  {selectedService ? (
                     <div className="flex justify-between">
                        <span>{selectedService.service_type}</span>
                        <span>{Number(selectedService.base_price).toFixed(2)}</span>
                     </div>
                  ) : <div className="opacity-40 italic">No service selected</div>}
                  
                  {selectedAddons.map(a => (
                     <div key={a.id} className="flex justify-between text-xs pl-2">
                        <span>+ {a.name}</span>
                        <span>{Number(a.price).toFixed(2)}</span>
                     </div>
                  ))}
               </div>

               <div className="w-full border-b border-dashed border-black/20 my-4"></div>

               <div className="space-y-1">
                  <div className="flex justify-between text-xs">
                     <span className="opacity-60">Subtotal</span>
                     <span>{subtotal.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                     <span className="opacity-60">Tips</span>
                     <span>{tips.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between font-black text-xl mt-2 pt-2 border-t border-black/10">
                     <span>TOTAL</span>
                     <span>RM {totalAmount.toFixed(2)}</span>
                  </div>
               </div>

               <div className="text-center mt-8 text-xs opacity-50 uppercase tracking-widest font-bold">
                  Thank you! See you again.
               </div>
            </div>

            {/* Actions */}
            <div className="flex gap-4 pt-4">
               <button 
                  onClick={handleReset}
                  disabled={isSubmitting}
                  className="flex-1 py-4 font-bold text-sm bg-white border border-outline-variant/20 rounded-full hover:bg-surface-container transition-colors shadow-sm"
               >
                  Reset
               </button>
               <button 
                  onClick={handleSubmitTransaction}
                  disabled={!isFormValid || isSubmitting}
                  className="flex-[2] flex items-center justify-center gap-2 py-4 font-black text-sm uppercase tracking-widest bg-black text-white rounded-full shadow-md hover:bg-black/80 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
               >
                  {isSubmitting ? <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span> : 'Submit Payment'}
               </button>
            </div>
         </div>
      </main>

      {/* Success Overlay */}
      <AnimatePresence>
         {showSuccess && (
            <motion.div 
               initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
               className="fixed inset-0 z-50 flex items-center justify-center bg-[#e5f638]/95 backdrop-blur-sm"
            >
               <motion.div 
                  initial={{ scale: 0.8, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.8, opacity: 0 }}
                  className="bg-white p-10 rounded-[3rem] shadow-2xl text-center max-w-sm w-full mx-4"
               >
                  <div className="w-24 h-24 bg-[#545b00] rounded-full flex items-center justify-center mx-auto mb-6 text-[#e5f638]">
                     <CheckCircle className="w-12 h-12" />
                  </div>
                  <h2 className="font-headline font-black text-3xl text-[#545b00] mb-2">Paid successfully!</h2>
                  <p className="font-bold text-lg text-on-surface">RM {totalAmount.toFixed(2)}</p>
                  <p className="text-sm font-medium text-on-surface-variant mt-2 uppercase tracking-widest bg-surface-container py-2 rounded-full">
                     Served by {barbers.find(b=>b.id === selectedBarber)?.name}
                  </p>
               </motion.div>
            </motion.div>
         )}
      </AnimatePresence>

    </div>
  )
}
