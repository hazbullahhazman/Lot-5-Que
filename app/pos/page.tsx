'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient as supabase } from '@/utils/supabase/client'
import { motion, AnimatePresence } from 'framer-motion'
import { Banknote, Calculator, CheckCircle, CreditCard, Menu, PhoneCall, Plus, RefreshCw, Scissors, Search, User, UserX, XCircle, PauseCircle } from 'lucide-react'
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

const MOCK_CALLED_TO_CHAIR_KEY = 'lot5_mock_called_to_chair'

type QueueStatus = 'WAITING' | 'NOTIFIED' | 'CALLED' | 'IN_CHAIR' | 'HOLD' | 'PAYMENT_PENDING' | 'COMPLETED' | 'ABSENT' | 'CANCELLED'
type EntryType = 'walk_in' | 'booking'

type QueueEntry = {
  id: string
  user_id?: string | null
  queue_number: number
  customer_name?: string | null
  phone_number?: string | null
  status: QueueStatus | string
  booked_time?: string | null
  joined_at?: string | null
  entry_type?: EntryType | string | null
  assigned_barber_id?: string | null
  profiles?: { name?: string | null; email?: string | null; phone?: string | null } | { name?: string | null; email?: string | null; phone?: string | null }[] | null
}

type StaffProfile = { id: string; name?: string; role: 'admin' | 'owner' | 'barber' | string }
type CatalogItem = { id?: string; service_type?: string; name?: string; base_price?: number; price?: number; commission_type?: 'fixed' | 'percentage' | string; barber_cut?: number }

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

const ACTIVE_STATUSES: QueueStatus[] = ['WAITING', 'NOTIFIED', 'CALLED', 'IN_CHAIR', 'HOLD', 'PAYMENT_PENDING']

const isLiveSupabase = () => Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && !process.env.NEXT_PUBLIC_SUPABASE_URL.includes('placeholder'))

const getProfileValue = (entry: QueueEntry, key: 'name' | 'email' | 'phone') => {
  const profile = Array.isArray(entry.profiles) ? entry.profiles[0] : entry.profiles
  return profile?.[key] || null
}

const getCustomerName = (entry?: QueueEntry | null) => entry?.customer_name || (entry ? getProfileValue(entry, 'name') : null) || 'Walk-in Customer'
const getEntryType = (entry: QueueEntry): EntryType => (entry.entry_type as EntryType) || (entry.booked_time ? 'booking' : 'walk_in')
const getPhone = (entry?: QueueEntry | null) => entry?.phone_number || (entry ? getProfileValue(entry, 'phone') : null) || ''

export default function POSSystem() {
  const router = useRouter()
  const [profile, setProfile] = useState<StaffProfile | null>(null)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [activeQueue, setActiveQueue] = useState<QueueEntry[]>([])
  const [barbers, setBarbers] = useState<any[]>(MOCK_BARBERS)
  const [pricing, setPricing] = useState<CatalogItem[]>(MOCK_PRICING)
  const [addons, setAddons] = useState<CatalogItem[]>(MOCK_ADDONS)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCustomer, setSelectedCustomer] = useState<QueueEntry | null>(null)
  const [selectedBarber, setSelectedBarber] = useState('')
  const [selectedService, setSelectedService] = useState<CatalogItem | null>(null)
  const [selectedAddons, setSelectedAddons] = useState<CatalogItem[]>([])
  const [tips, setTips] = useState(0)
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'qr' | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [showSuccess, setShowSuccess] = useState(false)
  const [showWalkInModal, setShowWalkInModal] = useState(false)
  const [shopSettings, setShopSettings] = useState({ averageServiceMinutes: 30, whatsappQueueMessage: DEFAULT_QUEUE_MESSAGE })

  useEffect(() => {
    checkPOSAuth()

    let channel: any
    if (isLiveSupabase()) {
      channel = supabase()
        .channel('staff-console-events')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'queue_entries' }, () => fetchData())
        .on('postgres_changes', { event: '*', schema: 'public', table: 'pricing_config' }, () => fetchData())
        .on('postgres_changes', { event: '*', schema: 'public', table: 'addon_items' }, () => fetchData())
        .on('postgres_changes', { event: '*', schema: 'public', table: 'settings' }, () => fetchData())
        .subscribe()
    }

    return () => { if (channel) supabase().removeChannel(channel) }
  }, [])

  const checkPOSAuth = async () => {
    if (!isLiveSupabase()) {
      const role = safeStorageGet('mock_role') || 'owner'
      if (!['admin', 'owner', 'barber'].includes(role)) {
        window.location.href = '/login'
        return
      }
      const mockProfile = { id: 'admin-123', name: role === 'barber' ? 'Demo Barber' : 'Offline Admin', role }
      setProfile(mockProfile)
      if (role === 'barber') setSelectedBarber(mockProfile.id)
      fetchData()
      return
    }

    const { data: { session } } = await supabase().auth.getSession()
    if (!session) { window.location.href = '/login'; return }

    const { data } = await supabase().from('profiles').select('*').eq('id', session.user.id).single()
    if (!data || !['admin', 'owner', 'barber'].includes(data.role)) {
      window.location.href = '/dashboard'
      return
    }

    setProfile(data)
    if (data.role === 'barber') setSelectedBarber(data.id)
    fetchData()
  }

  const selectFromUrl = (queue: QueueEntry[]) => {
    const targetId = new URLSearchParams(window.location.search).get('customer')
    if (!targetId) return
    const target = queue.find(q => q.id === targetId)
    if (target) selectCustomer(target)
  }

  const fetchData = async () => {
    if (!isLiveSupabase()) {
      let calledIds: string[] = []
      try {
        calledIds = JSON.parse(safeStorageGet(MOCK_CALLED_TO_CHAIR_KEY) || '[]')
      } catch {
        calledIds = []
      }
      const mockQueue: QueueEntry[] = [
        { id: 'q1', queue_number: 14, customer_name: 'Julian D.', phone_number: '60123456789', status: calledIds.includes('q1') ? 'IN_CHAIR' : 'WAITING', joined_at: new Date(Date.now() - 35 * 60000).toISOString(), entry_type: 'walk_in' },
        { id: 'q2', queue_number: 15, customer_name: 'Marcus K.', phone_number: '60198765432', status: calledIds.includes('q2') ? 'IN_CHAIR' : 'WAITING', joined_at: new Date(Date.now() - 15 * 60000).toISOString(), entry_type: 'walk_in' },
        { id: 'q3', queue_number: 0, customer_name: 'Syed Booking', phone_number: '60132273797', status: calledIds.includes('q3') ? 'IN_CHAIR' : 'WAITING', booked_time: '18:30', joined_at: new Date().toISOString(), entry_type: 'booking' }
      ]
      setActiveQueue(mockQueue)
      selectFromUrl(mockQueue)
      return
    }

    try {
      const q = await supabase()
        .from('queue_entries')
        .select('*, profiles(name, email, phone)')
        .in('status', ACTIVE_STATUSES)
        .order('booked_time', { ascending: true, nullsFirst: false })
        .order('queue_number', { ascending: true })
      if (q.data) {
        setActiveQueue(q.data as QueueEntry[])
        selectFromUrl(q.data as QueueEntry[])
        if (selectedCustomer && !q.data.some(item => item.id === selectedCustomer.id)) handleReset()
      }

      const b = await supabase().from('profiles').select('*').in('role', ['barber', 'owner', 'admin']).order('name', { ascending: true })
      if (b.data && b.data.length > 0) setBarbers(b.data)

      const p = await supabase().from('pricing_config').select('*').order('service_type', { ascending: true })
      if (p.data && p.data.length > 0) setPricing(p.data)

      const a = await supabase().from('addon_items').select('*').eq('active', true).order('name', { ascending: true })
      if (a.data && a.data.length > 0) setAddons(a.data)

      const s = await supabase().from('settings').select('raw_settings').eq('id', 1).single()
      if (s.data?.raw_settings) setShopSettings({ ...shopSettings, ...(s.data.raw_settings as any) })
    } catch (e) {
      console.error(e)
    }
  }

  const selectCustomer = (entry: QueueEntry) => {
    setSelectedCustomer(entry)
    setSelectedService(null)
    setSelectedAddons([])
    setTips(0)
    setPaymentMethod(null)
    if (entry.assigned_barber_id) setSelectedBarber(entry.assigned_barber_id)
  }

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    const query = searchQuery.trim().toLowerCase()
    if (!query) return
    const cust = activeQueue.find(q =>
      q.queue_number?.toString() === query ||
      getCustomerName(q).toLowerCase().includes(query) ||
      getPhone(q).includes(query)
    )
    if (cust) {
      selectCustomer(cust)
      setSearchQuery('')
    } else {
      alert('Customer not found in active queue or bookings.')
    }
  }

  const updateQueueStatus = async (entry: QueueEntry, status: QueueStatus) => {
    if (!isLiveSupabase()) {
      setActiveQueue(prev => status === 'ABSENT' || status === 'CANCELLED'
        ? prev.filter(q => q.id !== entry.id)
        : prev.map(q => q.id === entry.id ? { ...q, status } : q))
      if (selectedCustomer?.id === entry.id) setSelectedCustomer(prev => prev ? { ...prev, status } : prev)
      return
    }

    const { error } = await supabase().from('queue_entries').update({ status }).eq('id', entry.id)
    if (error) {
      alert(`Unable to update queue: ${error.message}`)
      return
    }
    fetchData()
  }

  const getQueuePosition = (entry: QueueEntry) => {
    if (getEntryType(entry) === 'booking') return 1
    const queue = activeQueue.filter(q => getEntryType(q) === 'walk_in' && ['WAITING', 'NOTIFIED', 'CALLED'].includes(String(q.status)))
    const index = queue.findIndex(q => q.id === entry.id)
    return index >= 0 ? index + 1 : 1
  }

  const getEstimatedWaitMinutes = (entry: QueueEntry) => {
    if (getEntryType(entry) === 'booking') return 0
    return Math.max(5, getQueuePosition(entry) * (shopSettings.averageServiceMinutes || 30))
  }

  const buildQueueMessage = (entry: QueueEntry) => {
    const wait = getEstimatedWaitMinutes(entry)
    const estimatedTime = entry.booked_time || new Date(Date.now() + wait * 60000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    return (shopSettings.whatsappQueueMessage || DEFAULT_QUEUE_MESSAGE)
      .replaceAll('{{customer_name}}', getCustomerName(entry))
      .replaceAll('{{queue_number}}', entry.booked_time ? entry.booked_time : `#${entry.queue_number}`)
      .replaceAll('{{estimated_wait}}', String(wait))
      .replaceAll('{{estimated_time}}', estimatedTime)
      .replaceAll('{{shop_name}}', 'Lot 5 Barbershop')
  }

  const handleCallCustomer = async (entry: QueueEntry) => {
    const name = getCustomerName(entry)
    const phone = getPhone(entry)
    if (phone && window.confirm(`Notify ${name} via WhatsApp?`)) {
      const cleanPhone = phone.replace(/[^\d]/g, '')
      const message = buildQueueMessage(entry)
      window.open(`https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`, '_blank')
      await updateQueueStatus(entry, 'NOTIFIED')
    } else if (!phone) {
      alert('Customer did not provide a phone number.')
    }
  }

  const handleMoveToChair = async (entry: QueueEntry) => {
    selectCustomer(entry)
    await updateQueueStatus(entry, 'IN_CHAIR')
  }

  const handleHoldEntry = async (entry: QueueEntry) => {
    await updateQueueStatus(entry, 'HOLD')
  }

  const handleMarkAbsent = async (entry: QueueEntry) => {
    if (!window.confirm(`Mark ${getCustomerName(entry)} as absent/no-show?`)) return
    await updateQueueStatus(entry, 'ABSENT')
  }

  const handleCancelEntry = async (entry: QueueEntry) => {
    if (!window.confirm(`Cancel ${getCustomerName(entry)} from the queue?`)) return
    await updateQueueStatus(entry, 'CANCELLED')
  }

  const handleAddWalkIn = async (e: React.FormEvent) => {
    e.preventDefault()
    const formData = new FormData(e.target as HTMLFormElement)
    const name = String(formData.get('name') || '').trim()
    const phone = String(formData.get('phone') || '').trim()
    const service = String(formData.get('service') || 'Walk-in').trim()
    const remark = String(formData.get('remark') || '').trim()
    const finalName = remark ? `${name} - ${service} (${remark})` : `${name} - ${service}`

    if (!isLiveSupabase()) {
      const nextTicket = Math.max(0, ...activeQueue.filter(q => getEntryType(q) === 'walk_in').map(q => Number(q.queue_number || 0))) + 1
      setActiveQueue(prev => [...prev, { id: Date.now().toString(), queue_number: nextTicket, customer_name: finalName, phone_number: phone, status: 'WAITING', joined_at: new Date().toISOString(), entry_type: 'walk_in' }])
      setShowWalkInModal(false)
      return
    }

    const { error } = await supabase().rpc('join_walk_in_queue', {
      p_customer_name: finalName,
      p_phone_number: phone || null,
      p_user_id: null,
      p_service_type: service,
      p_remark: remark || null
    })

    if (error) {
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      const { data: qnData } = await supabase()
        .from('queue_entries')
        .select('queue_number')
        .gte('joined_at', today.toISOString())
        .eq('entry_type', 'walk_in')
        .order('queue_number', { ascending: false })
        .limit(1)
      const nextTicket = qnData?.[0]?.queue_number ? qnData[0].queue_number + 1 : 1
      const fallback = await supabase().from('queue_entries').insert([{ customer_name: finalName, phone_number: phone || null, queue_number: nextTicket, status: 'WAITING', entry_type: 'walk_in', service_type: service }])
      if (fallback.error) {
        alert(`Unable to add walk-in: ${fallback.error.message}`)
        return
      }
    }

    setShowWalkInModal(false)
    fetchData()
  }

  const toggleAddon = (addon: CatalogItem) => {
    if (selectedAddons.find(a => a.id === addon.id || a.name === addon.name)) {
      setSelectedAddons(prev => prev.filter(a => a.id !== addon.id && a.name !== addon.name))
    } else {
      setSelectedAddons(prev => [...prev, addon])
    }
  }

  const subtotal = useMemo(() => {
    let total = 0
    if (selectedService) total += Number(selectedService.base_price || 0)
    selectedAddons.forEach(a => total += Number(a.price || 0))
    return total
  }, [selectedService, selectedAddons])

  const totalAmount = subtotal + tips
  const isFormValid = Boolean(selectedCustomer && selectedService && paymentMethod && selectedBarber)

  const handleReset = () => {
    setSelectedCustomer(null)
    setSelectedService(null)
    setSelectedAddons([])
    setTips(0)
    setPaymentMethod(null)
  }

  const calculateCommission = () => {
    let commissionAmount = 0
    if (selectedService?.commission_type === 'fixed') commissionAmount += Number(selectedService.barber_cut || 0)
    else if (selectedService) commissionAmount += Number(selectedService.base_price || 0) * (Number(selectedService.barber_cut || 50) / 100)

    selectedAddons.forEach(a => {
      if (a.commission_type === 'fixed') commissionAmount += Number(a.barber_cut || 0)
      else commissionAmount += Number(a.price || 0) * (Number(a.barber_cut || 50) / 100)
    })
    return commissionAmount
  }

  const handleSubmitTransaction = async () => {
    if (!isFormValid || !selectedCustomer || !selectedService) return
    setIsSubmitting(true)

    const transactionPayload = {
      user_id: selectedCustomer.user_id || null,
      queue_number: selectedCustomer.queue_number?.toString() || null,
      customer_name: getCustomerName(selectedCustomer),
      customer_id: selectedCustomer.user_id || null,
      service_type: selectedService.service_type,
      items: selectedAddons,
      subtotal,
      tips,
      total: totalAmount,
      payment_method: paymentMethod,
      barber_id: selectedBarber,
      barber_name: barbers.find(b => b.id === selectedBarber)?.name || profile?.name,
      commission_amount: calculateCommission(),
      status: 'COMPLETED'
    }

    if (isLiveSupabase()) {
      await supabase().from('queue_entries').update({ status: 'PAYMENT_PENDING', assigned_barber_id: selectedBarber }).eq('id', selectedCustomer.id)

      const { error: txError } = await supabase().from('transactions').insert([transactionPayload])
      if (txError) {
        console.error('Transaction Insert Error:', txError)
        alert(`Failed to save transaction: ${txError.message}\nDetails: ${txError.details || ''}`)
        setIsSubmitting(false)
        return
      }

      const { error: queueError } = await supabase().from('queue_entries').update({ status: 'COMPLETED', assigned_barber_id: selectedBarber }).eq('id', selectedCustomer.id)
      if (queueError) {
        alert(`Payment saved, but queue completion failed: ${queueError.message}`)
        setIsSubmitting(false)
        return
      }
    } else {
      console.log('Mock saved:', transactionPayload)
      let calledIds: string[] = []
      try {
        calledIds = JSON.parse(safeStorageGet(MOCK_CALLED_TO_CHAIR_KEY) || '[]')
      } catch {
        calledIds = []
      }
      safeStorageSet(MOCK_CALLED_TO_CHAIR_KEY, JSON.stringify(calledIds.filter(id => id !== selectedCustomer.id)))
      setActiveQueue(prev => prev.filter(q => q.id !== selectedCustomer.id))
    }

    setShowSuccess(true)
    setTimeout(() => {
      setShowSuccess(false)
      handleReset()
      setIsSubmitting(false)
      fetchData()
      router.push('/admin?tab=overview')
    }, 2200)
  }

  const posReadyQueue = activeQueue.filter(q => q.status === 'IN_CHAIR' || q.status === 'PAYMENT_PENDING')
  const walkIns = posReadyQueue.filter(q => getEntryType(q) === 'walk_in')
  const bookings = posReadyQueue.filter(q => getEntryType(q) === 'booking').sort((a, b) => String(a.booked_time || '').localeCompare(String(b.booked_time || '')))

  const QueueRow = ({ entry, index }: { entry: QueueEntry; index: number }) => {
    const isSelected = selectedCustomer?.id === entry.id
    const isBooking = getEntryType(entry) === 'booking'
    return (
      <div className={`p-4 rounded-2xl border transition-all ${isSelected ? 'border-[#004be2] bg-[#f0f4ff] shadow-sm' : 'border-outline-variant/10 bg-white hover:border-[#004be2]/30'}`}>
        <button onClick={() => selectCustomer(entry)} className="w-full text-left">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className={`text-[10px] font-black uppercase tracking-widest px-2 py-1 rounded-full ${entry.status === 'NOTIFIED' || entry.status === 'CALLED' ? 'bg-[#545b00] text-[#e5f638]' : entry.status === 'IN_CHAIR' ? 'bg-[#004be2] text-white' : entry.status === 'HOLD' ? 'bg-orange-100 text-orange-700' : 'bg-surface-container text-on-surface-variant'}`}>{entry.status}</span>
                <span className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">{isBooking ? entry.booked_time : `#${entry.queue_number}`}</span>
              </div>
              <p className="font-black text-on-surface truncate">{getCustomerName(entry)}</p>
              <p className="text-xs font-medium text-on-surface-variant mt-1">{getPhone(entry) || 'No phone saved'}</p>
            </div>
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-black ${isBooking ? 'bg-[#e5f638] text-[#545b00]' : index === 0 ? 'bg-[#c5d0ff] text-[#004be2]' : 'bg-surface-container text-on-surface-variant'}`}>
              {isBooking ? 'B' : index + 1}
            </div>
          </div>
        </button>
        <div className="grid grid-cols-1 gap-2 mt-4">
          <button onClick={() => selectCustomer(entry)} className="px-3 py-2 rounded-xl bg-[#004be2] text-white font-bold text-xs flex items-center justify-center gap-2">
            <Calculator className="w-3.5 h-3.5" /> Start POS
          </button>
        </div>
      </div>
    )
  }

  if (!profile) return <div className="min-h-screen flex items-center justify-center p-10 font-bold text-lg text-on-surface">Initializing Staff Console...</div>

  return (
    <div className="min-h-screen bg-[#f4f7f6] font-body text-on-surface pb-20 md:pb-0">
      <div className="md:hidden flex items-center justify-between bg-white px-4 py-4 border-b border-outline-variant/10">
        <button onClick={() => setSidebarOpen(true)} className="p-2 bg-surface rounded-xl hover:bg-surface-container-high transition-colors">
          <Menu className="w-5 h-5 text-on-surface" />
        </button>
        <span className="text-xl font-black tracking-tighter text-[#596000] font-headline">Lot 5<span className="text-[#004be2]">.</span></span>
      </div>

      <AppSidebar sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen} activeTab="pos" profile={profile} />

      <main className="md:pl-64 px-4 md:px-8 py-8 max-w-[1600px] mx-auto animate-in fade-in duration-500">
        <div className="flex flex-col xl:flex-row xl:items-end justify-between gap-4 mb-8">
          <div>
            <p className="text-xs font-black uppercase tracking-widest text-[#004be2] mb-2">Unified staff console</p>
            <h1 className="font-headline font-black text-3xl md:text-5xl tracking-tight text-[#545b00]">Queue, chair, and payment</h1>
          </div>
          <div className="flex flex-col sm:flex-row gap-3 w-full xl:w-auto">
            <form onSubmit={handleSearch} className="flex w-full sm:w-auto bg-white rounded-full overflow-hidden border border-outline-variant/10 shadow-sm">
              <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="bg-transparent px-5 py-3 outline-none font-bold text-sm min-w-0 flex-1 sm:w-64" placeholder="Search ticket, name, phone" />
              <button type="submit" className="px-4 bg-[#004be2] text-white"><Search className="w-4 h-4" /></button>
            </form>
            <button onClick={() => setShowWalkInModal(true)} className="px-5 py-3 rounded-full bg-[#e5f638] text-[#545b00] font-black text-xs uppercase tracking-widest flex items-center justify-center gap-2 shadow-sm">
              <Plus className="w-4 h-4" /> Add Walk-in
            </button>
            <button onClick={fetchData} className="px-5 py-3 rounded-full bg-white text-on-surface font-black text-xs uppercase tracking-widest flex items-center justify-center gap-2 border border-outline-variant/10 shadow-sm">
              <RefreshCw className="w-4 h-4" /> Refresh
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-[380px_minmax(0,1fr)_420px] gap-6">
          <aside className="space-y-6">
            <section className="bg-surface-container-lowest rounded-[2rem] p-5 border border-outline-variant/10 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-headline font-black text-xl text-on-surface">Walk-ins</h2>
                <span className="bg-[#c5d0ff] text-[#004be2] px-3 py-1 rounded-full text-xs font-black">{walkIns.length}</span>
              </div>
              <div className="space-y-3 max-h-[42vh] overflow-y-auto pr-1">
                {walkIns.length === 0 ? <p className="text-sm text-on-surface-variant font-medium p-4 text-center">No walk-ins called to chair.</p> : walkIns.map((entry, index) => <QueueRow key={entry.id} entry={entry} index={index} />)}
              </div>
            </section>

            <section className="bg-surface-container-lowest rounded-[2rem] p-5 border border-outline-variant/10 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-headline font-black text-xl text-on-surface">Bookings</h2>
                <span className="bg-[#e5f638] text-[#545b00] px-3 py-1 rounded-full text-xs font-black">{bookings.length}</span>
              </div>
              <div className="space-y-3 max-h-[34vh] overflow-y-auto pr-1">
                {bookings.length === 0 ? <p className="text-sm text-on-surface-variant font-medium p-4 text-center">No booking customers called to chair.</p> : bookings.map((entry, index) => <QueueRow key={entry.id} entry={entry} index={index} />)}
              </div>
            </section>
          </aside>

          <section className="space-y-6">
            <div className={`bg-white p-6 md:p-8 rounded-[2rem] shadow-sm border transition-all ${selectedCustomer ? 'border-[#004be2]/20' : 'border-outline-variant/10'}`}>
              <p className="text-xs font-black uppercase tracking-widest text-[#004be2] mb-3">Selected customer</p>
              {selectedCustomer ? (
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-5">
                  <div>
                    <h2 className="font-headline font-black text-3xl text-on-surface mb-2">{getCustomerName(selectedCustomer)}</h2>
                    <div className="flex flex-wrap gap-2">
                      <span className="px-3 py-1 rounded-full bg-surface-container font-bold text-xs uppercase tracking-widest">{getEntryType(selectedCustomer) === 'booking' ? `Booking ${selectedCustomer.booked_time}` : `Ticket #${selectedCustomer.queue_number}`}</span>
                      <span className="px-3 py-1 rounded-full bg-[#c5d0ff] text-[#004be2] font-bold text-xs uppercase tracking-widest">{selectedCustomer.status}</span>
                      {getPhone(selectedCustomer) && <span className="px-3 py-1 rounded-full bg-[#e5f638]/30 text-[#545b00] font-bold text-xs uppercase tracking-widest">{getPhone(selectedCustomer)}</span>}
                    </div>
                  </div>
                  <button onClick={() => selectedCustomer && handleMoveToChair(selectedCustomer)} className="px-5 py-3 rounded-full bg-[#004be2] text-white font-black text-xs uppercase tracking-widest flex items-center justify-center gap-2">
                    <Scissors className="w-4 h-4" /> In Chair
                  </button>
                </div>
              ) : (
                <div className="py-12 text-center border-2 border-dashed border-outline-variant/20 rounded-2xl">
                  <User className="w-10 h-10 mx-auto text-on-surface-variant/40 mb-3" />
                  <p className="font-bold text-on-surface-variant">Choose a walk-in or booking from the queue.</p>
                </div>
              )}
            </div>

            <div className={`bg-white p-6 md:p-8 rounded-[2rem] shadow-sm border border-outline-variant/10 transition-opacity ${!selectedCustomer ? 'opacity-50 pointer-events-none' : 'opacity-100'}`}>
              <h2 className="text-sm font-black uppercase tracking-widest text-[#004be2] mb-4 flex items-center gap-2"><Scissors className="w-4 h-4" /> Served By</h2>
              {profile?.role === 'barber' ? (
                <div className="py-3 px-4 rounded-xl border-2 border-[#004be2] bg-[#c5d0ff] text-[#004be2] shadow-sm font-bold text-sm flex items-center gap-3 w-max">
                  <div className="w-6 h-6 rounded-full bg-white flex items-center justify-center font-black text-[10px] text-black">{profile?.name ? profile.name.substring(0, 1) : 'U'}</div>
                  {profile?.name || 'Loading...'}
                </div>
              ) : (
                <select value={selectedBarber} onChange={e => setSelectedBarber(e.target.value)} className="w-full bg-surface border border-outline-variant/20 rounded-xl px-4 py-3 font-bold text-sm outline-none focus:border-[#004be2] transition-colors">
                  <option value="" disabled>Select the barber...</option>
                  {barbers.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                </select>
              )}
            </div>

            <div className={`bg-white p-6 md:p-8 rounded-[2rem] shadow-sm border border-outline-variant/10 transition-opacity ${!selectedCustomer ? 'opacity-50 pointer-events-none' : 'opacity-100'}`}>
              <h2 className="text-sm font-black uppercase tracking-widest text-[#004be2] mb-4">Service & Items</h2>
              <p className="text-xs font-bold text-on-surface-variant uppercase tracking-widest mb-3">Base Service</p>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-8">
                {pricing.map(item => (
                  <button key={item.id || item.service_type} onClick={() => setSelectedService(item)} className={`p-4 rounded-2xl border flex flex-col justify-between items-start text-left h-24 transition-all ${selectedService?.service_type === item.service_type ? 'bg-[#e5f638] border-[#545b00]/20 text-[#545b00] shadow-sm scale-[1.02]' : 'bg-surface border-outline-variant/10 hover:border-[#004be2]/30 text-on-surface'}`}>
                    <span className="font-bold text-sm leading-tight">{item.service_type}</span>
                    <span className="font-black text-lg block mt-2">RM {Number(item.base_price || 0).toFixed(2)}</span>
                  </button>
                ))}
              </div>

              <p className="text-xs font-bold text-on-surface-variant uppercase tracking-widest mb-3">Add-ons</p>
              <div className="flex flex-wrap gap-2">
                {addons.map(addon => {
                  const isSelected = selectedAddons.find(a => a.id === addon.id || a.name === addon.name)
                  return (
                    <button key={addon.id || addon.name} onClick={() => toggleAddon(addon)} className={`px-4 py-2 rounded-full border text-sm font-bold transition-colors ${isSelected ? 'bg-black text-white border-black' : 'bg-surface border-outline-variant/20 hover:border-black/30 text-on-surface'}`}>
                      {addon.name} <span className={`ml-1 opacity-60 ${isSelected ? 'text-[#e5f638]' : ''}`}>+RM{Number(addon.price || 0).toFixed(2)}</span>
                    </button>
                  )
                })}
              </div>
            </div>
          </section>

          <aside className="space-y-6 xl:sticky xl:top-8 h-max">
            <section className={`bg-white p-6 md:p-8 rounded-[2rem] shadow-sm border border-outline-variant/10 transition-opacity ${!selectedService ? 'opacity-50 pointer-events-none' : 'opacity-100'}`}>
              <h2 className="text-sm font-black uppercase tracking-widest text-[#004be2] mb-4">Payment & Tips</h2>
              <div className="mb-8">
                <div className="flex justify-between items-center mb-2">
                  <label className="text-xs font-bold text-on-surface-variant uppercase tracking-widest">Tips</label>
                  <span className="text-sm font-black">RM {tips.toFixed(2)}</span>
                </div>
                <div className="flex gap-2 mb-3">
                  {[0, 2, 5, 10].map(t => (
                    <button key={t} onClick={() => setTips(t)} className={`flex-1 py-2 font-bold text-sm rounded-xl border ${tips === t ? 'bg-black text-white border-black' : 'bg-surface text-on-surface border-outline-variant/10 hover:bg-surface-container'}`}>
                      {t === 0 ? 'None' : `+RM ${t}`}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-on-surface-variant uppercase tracking-widest mb-2 block">Method</label>
                <div className="grid grid-cols-2 gap-3">
                  <button onClick={() => setPaymentMethod('cash')} className={`p-4 rounded-2xl flex flex-col items-center justify-center gap-2 border-2 transition-colors ${paymentMethod === 'cash' ? 'border-[#004be2] bg-[#c5d0ff]/30 text-[#004be2]' : 'border-transparent bg-surface-container text-on-surface-variant hover:bg-surface-container-high'}`}>
                    <Banknote className="w-6 h-6" /><span className="font-bold text-sm">Cash</span>
                  </button>
                  <button onClick={() => setPaymentMethod('qr')} className={`p-4 rounded-2xl flex flex-col items-center justify-center gap-2 border-2 transition-colors ${paymentMethod === 'qr' ? 'border-[#545b00] bg-[#e5f638]/30 text-[#545b00]' : 'border-transparent bg-surface-container text-on-surface-variant hover:bg-surface-container-high'}`}>
                    <CreditCard className="w-6 h-6" /><span className="font-bold text-sm">QR / Transfer</span>
                  </button>
                </div>
              </div>
            </section>

            <div className="bg-[#fcfbf9] p-6 rounded-[2rem] shadow-sm border border-outline-variant/20 font-mono text-sm relative overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-2 border-t-2 border-dashed border-outline-variant/20"></div>
              <div className="text-center mb-6 pt-2">
                <h3 className="font-black text-xl uppercase tracking-widest">LOT 5 BARBERSHOP</h3>
                <p className="text-xs opacity-60">UTM Skudai, Johor</p>
                <div className="w-full border-b border-dashed border-black/20 my-4"></div>
              </div>
              <div className="space-y-1 mb-6">
                <div className="flex justify-between"><span className="opacity-60">Queue:</span> <strong>{selectedCustomer ? (getEntryType(selectedCustomer) === 'booking' ? selectedCustomer.booked_time : `#${selectedCustomer.queue_number}`) : '--'}</strong></div>
                <div className="flex justify-between gap-4"><span className="opacity-60">Customer:</span> <strong className="text-right">{selectedCustomer ? getCustomerName(selectedCustomer) : '--'}</strong></div>
                <div className="flex justify-between"><span className="opacity-60">Date:</span> <strong>{new Date().toLocaleDateString('en-MY')}</strong></div>
                <div className="flex justify-between"><span className="opacity-60">Served By:</span> <strong>{barbers.find(b => b.id === selectedBarber)?.name || '--'}</strong></div>
                <div className="flex justify-between"><span className="opacity-60">Status:</span> <strong>{paymentMethod ? paymentMethod.toUpperCase() : 'PENDING'}</strong></div>
              </div>
              <div className="w-full border-b border-dashed border-black/20 my-4"></div>
              <div className="space-y-2 mb-4">
                {selectedService ? <div className="flex justify-between"><span>{selectedService.service_type}</span><span>{Number(selectedService.base_price || 0).toFixed(2)}</span></div> : <div className="opacity-40 italic">No service selected</div>}
                {selectedAddons.map(a => <div key={a.id || a.name} className="flex justify-between text-xs pl-2"><span>+ {a.name}</span><span>{Number(a.price || 0).toFixed(2)}</span></div>)}
              </div>
              <div className="w-full border-b border-dashed border-black/20 my-4"></div>
              <div className="space-y-1">
                <div className="flex justify-between text-xs"><span className="opacity-60">Subtotal</span><span>{subtotal.toFixed(2)}</span></div>
                <div className="flex justify-between text-xs"><span className="opacity-60">Tips</span><span>{tips.toFixed(2)}</span></div>
                <div className="flex justify-between font-black text-xl mt-2 pt-2 border-t border-black/10"><span>TOTAL</span><span>RM {totalAmount.toFixed(2)}</span></div>
              </div>
            </div>

            <div className="flex gap-4 pt-2">
              <button onClick={handleReset} disabled={isSubmitting} className="flex-1 py-4 font-bold text-sm bg-white border border-outline-variant/20 rounded-full hover:bg-surface-container transition-colors shadow-sm">Reset</button>
              <button onClick={handleSubmitTransaction} disabled={!isFormValid || isSubmitting} className="flex-[2] flex items-center justify-center gap-2 py-4 font-black text-sm uppercase tracking-widest bg-black text-white rounded-full shadow-md hover:bg-black/80 disabled:opacity-50 disabled:cursor-not-allowed transition-all">
                {isSubmitting ? <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span> : 'Submit Payment'}
              </button>
            </div>
          </aside>
        </div>
      </main>

      {showWalkInModal && (
        <div className="fixed inset-0 z-[70] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-[2rem] p-8 max-w-md w-full shadow-2xl animate-in fade-in zoom-in duration-200">
            <h3 className="font-headline font-black text-2xl mb-2 text-[#004be2]">Add Walk-in Customer</h3>
            <p className="text-sm font-medium text-on-surface-variant mb-6">Create a queue entry for a customer without a smartphone account.</p>
            <form onSubmit={handleAddWalkIn} className="space-y-4">
              <div>
                <label className="text-xs font-bold text-on-surface-variant uppercase tracking-widest mb-2 block">Customer Name</label>
                <input name="name" type="text" placeholder="e.g. John Doe" required className="w-full bg-surface border border-outline-variant/20 rounded-xl px-4 py-3 font-bold text-sm outline-none focus:border-[#004be2]" />
              </div>
              <div>
                <label className="text-xs font-bold text-on-surface-variant uppercase tracking-widest mb-2 block">Phone Number</label>
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
                <label className="text-xs font-bold text-on-surface-variant uppercase tracking-widest mb-2 block">Remarks</label>
                <input name="remark" type="text" placeholder="Any specific requests?" className="w-full bg-surface border border-outline-variant/20 rounded-xl px-4 py-3 font-bold text-sm outline-none focus:border-[#004be2]" />
              </div>
              <div className="flex gap-4 pt-4">
                <button type="button" onClick={() => setShowWalkInModal(false)} className="flex-1 py-3 font-bold text-sm bg-surface-container rounded-xl hover:bg-surface-container-high transition-colors text-on-surface">Cancel</button>
                <button type="submit" className="flex-1 py-3 font-bold text-sm bg-[#e5f638] text-[#545b00] rounded-xl hover:scale-105 transition-transform shadow-sm">Add to Queue</button>
              </div>
            </form>
          </div>
        </div>
      )}

      <AnimatePresence>
        {showSuccess && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-center justify-center bg-[#e5f638]/95 backdrop-blur-sm">
            <motion.div initial={{ scale: 0.8, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.8, opacity: 0 }} className="bg-white p-10 rounded-[3rem] shadow-2xl text-center max-w-sm w-full mx-4">
              <div className="w-24 h-24 bg-[#545b00] rounded-full flex items-center justify-center mx-auto mb-6 text-[#e5f638]"><CheckCircle className="w-12 h-12" /></div>
              <h2 className="font-headline font-black text-3xl text-[#545b00] mb-2">Paid successfully!</h2>
              <p className="font-bold text-lg text-on-surface">RM {totalAmount.toFixed(2)}</p>
              <p className="text-sm font-medium text-on-surface-variant mt-2 uppercase tracking-widest bg-surface-container py-2 rounded-full">Queue completed and commission recorded.</p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
