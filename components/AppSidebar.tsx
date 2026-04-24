'use client'

import React from 'react'
import { LayoutDashboard, Users, Shield, UserPlus, Activity, Calculator, Banknote, X, Tags } from 'lucide-react'
import { useRouter } from 'next/navigation'

interface AppSidebarProps {
  sidebarOpen: boolean
  setSidebarOpen: (open: boolean) => void
  activeTab: string
  onTabChange?: (tab: string) => void
  profile: any
}

export default function AppSidebar({ sidebarOpen, setSidebarOpen, activeTab, onTabChange, profile }: AppSidebarProps) {
  const router = useRouter()
  
  const handleNav = (tabId: string, href?: string) => {
    if (href) {
       router.push(href)
       return
    }
    
    // Cross-pollinate owner navigation to admin views
    const sharedAdminViews = ['overview', 'management', 'users']
    if (profile?.role === 'owner' && sharedAdminViews.includes(tabId)) {
        router.push(`/admin?tab=${tabId}`)
        return
    }
    // Similarly, if admin or barber somehow forces payroll/owner dashboard
    if (['admin', 'barber'].includes(profile?.role) && ['customers', 'payroll'].includes(tabId)) {
        router.push(`/admin?tab=${tabId}`)
        return
    }

    if (onTabChange) {
       // If the parent component gave us a handler, we just change the active tab inside the client hierarchy
       onTabChange(tabId)
       setSidebarOpen(false)     
    } else {
       // Otherwise, we navigate cleanly via Next router
       let basePath = profile?.role === 'owner' ? '/owner' : '/admin'
       router.push(`${basePath}?tab=${tabId}`)
    }
  }

  return (
    <aside className={`fixed left-0 top-0 h-full w-64 flex-col pt-6 md:pt-24 pb-8 px-4 bg-white border-r border-outline-variant/10 shadow-xl transition-transform z-50 duration-300 flex md:translate-x-0 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'} print:hidden`}>
      <div className="flex justify-end md:hidden mb-2">
         <button onClick={() => setSidebarOpen(false)} className="p-2 text-on-surface-variant hover:bg-surface rounded-full"><X className="w-5 h-5" /></button>
      </div>
      
      <div className="flex items-center gap-3 px-4 mb-8">
        <div className="w-12 h-12 rounded-2xl bg-[#004be2] flex items-center justify-center text-white shadow-sm overflow-hidden font-black text-xl border-2 border-white">
           {profile?.name ? profile.name.substring(0,2).toUpperCase() : 'AD'}
        </div>
        <div>
          <p className="font-headline font-bold tracking-tight text-on-surface text-lg">{profile?.name || 'Staff'}</p>
          <p className="text-xs text-[#004be2] font-black uppercase tracking-widest bg-[#c5d0ff] px-2 rounded w-min mt-0.5">
             {profile?.role === 'owner' ? 'OWNER' : profile?.role === 'admin' ? 'CONSOLE' : 'BARBER'}
          </p>
        </div>
      </div>
      
      <nav className="flex-1 space-y-2 overflow-y-auto pr-2">
        {(profile?.role === 'admin' || profile?.role === 'barber' || profile?.role === 'owner') && (
            <>
              <button onClick={() => handleNav('overview')} className={`w-full flex items-center gap-3 rounded-2xl px-4 py-3.5 transition-all outline-none ${activeTab === 'overview' ? 'bg-[#e5f638] text-[#545b00] scale-[0.98] shadow-sm font-black' : 'text-gray-500 hover:bg-surface hover:translate-x-1 font-bold'}`}>
                <LayoutDashboard className={`w-5 h-5 ${activeTab === 'overview' ? 'text-[#545b00]' : ''}`} />
                <span className="tracking-wide">Queue Manager</span>
              </button>
              <button onClick={() => handleNav('customers')} className={`w-full flex items-center gap-3 rounded-2xl px-4 py-3.5 transition-all outline-none ${activeTab === 'customers' ? 'bg-[#c5d0ff] text-[#004be2] scale-[0.98] shadow-sm font-black' : 'text-gray-500 hover:bg-surface hover:translate-x-1 font-bold'}`}>
                <Users className={`w-5 h-5 ${activeTab === 'customers' ? 'text-[#004be2]' : ''}`} />
                <span className="tracking-wide">{profile?.role === 'owner' ? 'Dashboard & CRM' : 'CRM Analytics'}</span>
              </button>
              
              {profile?.role === 'owner' && (
                 <button onClick={() => handleNav('payroll')} className={`w-full flex items-center gap-3 rounded-2xl px-4 py-3.5 transition-all outline-none ${activeTab === 'payroll' ? 'bg-purple-100 text-purple-700 scale-[0.98] shadow-sm font-black' : 'text-gray-500 hover:bg-surface hover:translate-x-1 font-bold'}`}>
                   <Banknote className={`w-5 h-5 ${activeTab === 'payroll' ? 'text-purple-700' : ''}`} />
                   <span className="tracking-wide">Payroll & Comm.</span>
                 </button>
              )}

              <button onClick={() => handleNav('management')} className={`w-full flex items-center gap-3 rounded-2xl px-4 py-3.5 transition-all outline-none ${activeTab === 'management' ? 'bg-orange-100 text-orange-600 scale-[0.98] shadow-sm font-black' : 'text-gray-500 hover:bg-surface hover:translate-x-1 font-bold'}`}>
                <Shield className={`w-5 h-5 ${activeTab === 'management' ? 'text-orange-600' : ''}`} />
                <span className="tracking-wide">Shop Management</span>
              </button>
              
              {profile?.role === 'owner' && (
                 <button onClick={() => handleNav('users')} className={`w-full flex items-center gap-3 rounded-2xl px-4 py-3.5 transition-all outline-none ${activeTab === 'users' ? 'bg-green-100 text-green-700 scale-[0.98] shadow-sm font-black' : 'text-gray-500 hover:bg-surface hover:translate-x-1 font-bold'}`}>
                   <UserPlus className={`w-5 h-5 ${activeTab === 'users' ? 'text-green-700' : ''}`} />
                   <span className="tracking-wide">User Access</span>
                 </button>
              )}

              {profile?.role === 'owner' && (
                 <button onClick={() => handleNav('pricing')} className={`w-full flex items-center gap-3 rounded-2xl px-4 py-3.5 transition-all outline-none ${activeTab === 'pricing' ? 'bg-indigo-100 text-indigo-700 scale-[0.98] shadow-sm font-black' : 'text-gray-500 hover:bg-surface hover:translate-x-1 font-bold'}`}>
                   <Tags className={`w-5 h-5 ${activeTab === 'pricing' ? 'text-indigo-700' : ''}`} />
                   <span className="tracking-wide">Pricing & Services</span>
                 </button>
              )}
            </>
        )}
        
        {/* Core utilities accessible to all staff */}
        <div className="pt-4 mt-2 border-t border-outline-variant/10 space-y-2">
           <button onClick={() => handleNav('my-stats', '/my-stats')} className={`w-full flex items-center gap-3 rounded-2xl px-4 py-3.5 transition-all outline-none border hover:scale-[1.02] shadow-sm font-bold ${activeTab === 'my-stats' ? 'bg-surface-container-highest text-on-surface border-outline-variant/30' : 'bg-surface-container text-on-surface border-outline-variant/10'}`}>
             <Activity className="w-5 h-5 text-on-surface-variant" />
             <span className="tracking-wide text-sm">My Performance</span>
           </button>
           <button onClick={() => handleNav('pos', '/pos')} className={`w-full flex items-center gap-3 rounded-2xl px-4 py-3.5 transition-all outline-none border hover:scale-[1.02] shadow-sm font-black ${activeTab === 'pos' ? 'bg-[#c5ff50] text-[#4d6600] border-[#c5ff50]/10' : 'bg-[#e5f638] text-[#545b00] border-[#545b00]/10'}`}>
             <Calculator className="w-5 h-5" />
             <span className="tracking-wide">Launch POS</span>
           </button>
        </div>
      </nav>
    </aside>
  )
}
