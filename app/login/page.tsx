'use client'

import { useState } from 'react'
import { createClient as supabase } from '@/utils/supabase/client'
import { motion } from 'framer-motion'
import { ArrowRight, Mail, Lock, AlertCircle } from 'lucide-react'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    
    // Check if we are doing offline test without credentials
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL.includes('placeholder')) {
        // Mock Login for Demo
        setTimeout(() => {
            if (email === 'admin@lot5.com') {
                localStorage.setItem('mock_role', 'admin')
                window.location.href = '/admin'
            } else if (email === 'owner@lot5.com') {
                localStorage.setItem('mock_role', 'owner')
                window.location.href = '/owner'
            } else if (email === 'barber@lot5.com') {
                localStorage.setItem('mock_role', 'barber')
                window.location.href = '/admin'
            } else {
                localStorage.setItem('mock_role', 'user')
                window.location.href = '/dashboard'
            }
        }, 1000)
        return
    }

    try {
      const db = supabase()
      const { data, error } = await db.auth.signInWithPassword({
        email,
        password,
      })

      if (error) {
        setError(error.message)
      } else {
        // Redirection should happen based on role, but for simplicity let's rely on what we can query or just redirect to dashboard
        window.location.href = '/dashboard'
      }
    } catch (err: any) {
      setError(err.message || 'An unexpected error occurred.')
    } finally {
      if (process.env.NEXT_PUBLIC_SUPABASE_URL && !process.env.NEXT_PUBLIC_SUPABASE_URL.includes('placeholder')) {
         setLoading(false)
      }
    }
  }

  return (
    <div className="min-h-screen text-on-surface font-body selection:bg-primary-container selection:text-on-primary-container flex flex-col bg-surface spotlight-gradient relative overflow-hidden items-center justify-center py-12 px-4 shadow-[inset_0_0_100px_rgba(0,0,0,0.02)]">
      {/* Visual background flares */}
      <div className="absolute top-0 -right-24 w-96 h-96 bg-[#c5d0ff]/30 rounded-full blur-3xl mix-blend-multiply pointer-events-none z-0"></div>
      <div className="absolute bottom-0 -left-24 w-80 h-80 bg-[#e5f638]/20 rounded-full blur-3xl mix-blend-multiply pointer-events-none z-0"></div>

      <motion.div 
        initial={{ opacity: 0, y: 20 }} 
        animate={{ opacity: 1, y: 0 }} 
        transition={{ duration: 0.5 }}
        className="w-full max-w-md relative z-10"
      >
        <div className="text-center mb-10">
          <span className="text-4xl font-black tracking-tighter text-[#004be2] block mb-2 font-headline drop-shadow-sm">Welcome Back</span>
          <div className="h-1 w-12 bg-[#e5f638] mx-auto rounded-full shadow-sm"></div>
        </div>

        <div className="bg-surface-container-lowest rounded-3xl shadow-[0_32px_64px_rgba(0,0,0,0.06)] overflow-hidden border border-outline-variant/10 p-8 md:p-10 backdrop-blur-md">
          {error && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="mb-6 bg-red-50 text-red-600 p-4 rounded-xl flex items-start gap-3 border border-red-100 text-sm font-medium">
               <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
               <p>{error}</p>
            </motion.div>
          )}

          <form onSubmit={handleLogin} className="space-y-6">
            <div className="space-y-2">
              <label className="block text-xs font-bold uppercase tracking-widest text-on-surface-variant ml-1">Email Address</label>
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-outline-variant w-5 h-5" />
                <input 
                  required type="email" value={email} onChange={e => setEmail(e.target.value)}
                  className="w-full pl-12 pr-4 py-4 bg-surface-container-low border-none rounded-xl focus:ring-2 focus:ring-[#004be2]/20 focus:bg-surface-container-high transition-all duration-200 font-medium placeholder:text-outline-variant/60 outline-none" 
                  placeholder="name@example.com" 
                />
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between items-center ml-1">
                <label className="block text-xs font-bold uppercase tracking-widest text-on-surface-variant">Password</label>
                <a href="#" className="block text-[10px] font-bold uppercase tracking-widest text-[#004be2] hover:underline">Forgot?</a>
              </div>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-outline-variant w-5 h-5" />
                <input 
                  required type="password" value={password} onChange={e => setPassword(e.target.value)}
                  className="w-full pl-12 pr-4 py-4 bg-surface-container-low border-none rounded-xl focus:ring-2 focus:ring-[#004be2]/20 focus:bg-surface-container-high transition-all duration-200 font-medium placeholder:text-outline-variant/60 outline-none" 
                  placeholder="••••••••" 
                />
              </div>
            </div>

            <button 
              disabled={loading} type="submit"
              className="w-full bg-[#004be2] text-white font-headline font-extrabold text-lg py-5 rounded-full shadow-lg shadow-[#004be2]/20 hover:scale-[1.02] active:scale-[0.98] transition-all duration-200 mt-4 flex items-center justify-center gap-3 group disabled:opacity-50"
            >
              {loading ? 'Authenticating...' : 'Sign In'}
              {!loading && <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />}
            </button>
          </form>

          <p className="mt-8 text-center text-sm font-medium text-on-surface-variant">
            Don&apos;t have an account? <a href="/register" className="text-[#004be2] font-bold hover:underline transition-all">Sign up here</a>
          </p>
        </div>
      </motion.div>
    </div>
  )
}
