'use client'

import { useState, useEffect, Suspense } from 'react'
import { supabase } from '@/utils/supabase/client'
import { motion } from 'framer-motion'
import { ArrowRight, Mail, Lock, User, AlertCircle, Ticket, Phone } from 'lucide-react'
import { useSearchParams } from 'next/navigation'

function RegisterForm() {
  const searchParams = useSearchParams()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [referralCode, setReferralCode] = useState('')

  useEffect(() => {
    const ref = searchParams.get('ref')
    if (ref) setReferralCode(ref)
  }, [searchParams])

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL.includes('placeholder')) {
        // Mock Success
        setTimeout(() => {
            setSuccess(true)
            setLoading(false)
        }, 1000)
        return
    }

    try {
      const db = supabase()
      const { error } = await db.auth.signUp({
        email,
        password,
        options: {
          data: {
            name,
            phone,
            role: 'user',
            referral_code: referralCode || undefined
          }
        }
      })

      if (error) {
        setError(error.message)
      } else {
        setSuccess(true)
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
    <div className="min-h-screen text-on-surface font-body selection:bg-primary-container selection:text-on-primary-container flex flex-col bg-[#f8fcfd] spotlight-bg relative overflow-hidden items-center justify-center py-12 px-4 shadow-[inset_0_0_100px_rgba(0,0,0,0.02)]">
      <div className="absolute top-0 -right-24 w-96 h-96 bg-[#e5f638]/20 rounded-full blur-3xl mix-blend-multiply pointer-events-none z-0"></div>
      <div className="absolute bottom-0 -left-24 w-80 h-80 bg-[#c5d0ff]/30 rounded-full blur-3xl mix-blend-multiply pointer-events-none z-0"></div>

      <motion.div 
        initial={{ opacity: 0, y: 20 }} 
        animate={{ opacity: 1, y: 0 }} 
        transition={{ duration: 0.5 }}
        className="w-full max-w-md relative z-10"
      >
        <div className="text-center mb-10">
          <span className="text-4xl font-black tracking-tighter text-[#545b00] block mb-2 font-headline drop-shadow-sm">Join Lot 5</span>
          <div className="h-1 w-12 bg-[#004be2] mx-auto rounded-full shadow-sm"></div>
        </div>

        <div className="bg-white rounded-3xl shadow-[0_32px_64px_rgba(0,0,0,0.06)] overflow-hidden border border-[#545b00]/10 p-8 md:p-10 backdrop-blur-md">
          {success ? (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center py-8">
               <div className="w-20 h-20 bg-[#e5f638] rounded-full flex items-center justify-center text-[#545b00] mx-auto mb-6 shadow-sm border border-[#545b00]/10">
                  <span className="material-symbols-outlined text-4xl">check_circle</span>
               </div>
               <h3 className="font-headline text-2xl font-black text-[#545b00] mb-2">You&apos;re Set!</h3>
               <p className="text-on-surface-variant font-medium mb-8">Your account has been created successfully. You can now login to join the queue.</p>
               <a href="/login" className="w-full inline-block bg-[#004be2] text-white font-headline font-extrabold text-lg py-4 rounded-full shadow-lg shadow-[#004be2]/20 hover:scale-[1.02] active:scale-[0.98] transition-all duration-200">
                  Go to Login
               </a>
            </motion.div>
          ) : (
            <>
              {error && (
                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="mb-6 bg-red-50 text-red-600 p-4 rounded-xl flex items-start gap-3 border border-red-100 text-sm font-medium">
                  <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                  <p>{error}</p>
                </motion.div>
              )}

              <form onSubmit={handleRegister} className="space-y-6">
                <div className="space-y-2">
                  <label className="block text-xs font-bold uppercase tracking-widest text-[#545b00]/70 ml-1">Full Name</label>
                  <div className="relative">
                    <User className="absolute left-4 top-1/2 -translate-y-1/2 text-outline-variant w-5 h-5" />
                    <input 
                      required type="text" value={name} onChange={e => setName(e.target.value)}
                      className="w-full pl-12 pr-4 py-4 bg-surface-container-lowest border-2 border-outline-variant/10 rounded-xl focus:border-[#004be2] focus:ring-4 focus:ring-[#004be2]/10 transition-all duration-200 font-medium placeholder:text-outline-variant/60 outline-none" 
                      placeholder="John Doe" 
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="block text-xs font-bold uppercase tracking-widest text-[#545b00]/70 ml-1">Email Address</label>
                  <div className="relative">
                    <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-outline-variant w-5 h-5" />
                    <input 
                      required type="email" value={email} onChange={e => setEmail(e.target.value)}
                      className="w-full pl-12 pr-4 py-4 bg-surface-container-lowest border-2 border-outline-variant/10 rounded-xl focus:border-[#004be2] focus:ring-4 focus:ring-[#004be2]/10 transition-all duration-200 font-medium placeholder:text-outline-variant/60 outline-none" 
                      placeholder="name@example.com" 
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="block text-xs font-bold uppercase tracking-widest text-[#545b00]/70 ml-1">Phone Number</label>
                  <div className="relative">
                    <Phone className="absolute left-4 top-1/2 -translate-y-1/2 text-outline-variant w-5 h-5" />
                    <input 
                      required type="tel" value={phone} onChange={e => setPhone(e.target.value)}
                      className="w-full pl-12 pr-4 py-4 bg-surface-container-lowest border-2 border-outline-variant/10 rounded-xl focus:border-[#004be2] focus:ring-4 focus:ring-[#004be2]/10 transition-all duration-200 font-medium placeholder:text-outline-variant/60 outline-none" 
                      placeholder="+60 12-345-6789" 
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="block text-xs font-bold uppercase tracking-widest text-[#545b00]/70 ml-1">Password</label>
                  <div className="relative">
                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-outline-variant w-5 h-5" />
                    <input 
                      required type="password" value={password} onChange={e => setPassword(e.target.value)}
                      className="w-full pl-12 pr-4 py-4 bg-surface-container-lowest border-2 border-outline-variant/10 rounded-xl focus:border-[#004be2] focus:ring-4 focus:ring-[#004be2]/10 transition-all duration-200 font-medium placeholder:text-outline-variant/60 outline-none" 
                      placeholder="••••••••" 
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="block text-xs font-bold uppercase tracking-widest text-[#545b00]/70 ml-1">Referral Code (Optional)</label>
                  <div className="relative">
                    <Ticket className="absolute left-4 top-1/2 -translate-y-1/2 text-outline-variant w-5 h-5" />
                    <input 
                      type="text" value={referralCode} onChange={e => setReferralCode(e.target.value)}
                      className="w-full pl-12 pr-4 py-4 bg-surface-container-lowest border-2 border-outline-variant/10 rounded-xl focus:border-[#004be2] focus:ring-4 focus:ring-[#004be2]/10 transition-all duration-200 font-bold placeholder:text-outline-variant/60 outline-none text-[#004be2] tracking-wider uppercase" 
                      placeholder="ENTER CODE" 
                    />
                  </div>
                </div>

                <button 
                  disabled={loading} type="submit"
                  className="w-full bg-[#e5f638] text-[#545b00] font-headline font-extrabold text-lg py-5 rounded-full shadow-lg shadow-[#e5f638]/20 hover:scale-[1.02] active:scale-[0.98] transition-all duration-200 mt-4 flex items-center justify-center gap-3 group disabled:opacity-50"
                >
                  {loading ? 'Creating account...' : 'Create Account'}
                  {!loading && <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />}
                </button>
              </form>

              <p className="mt-8 text-center text-sm font-medium text-on-surface-variant">
                Already have an account? <a href="/login" className="text-[#004be2] font-bold hover:underline transition-all">Sign in here</a>
              </p>
            </>
          )}
        </div>
      </motion.div>
    </div>
  )
}

export default function RegisterPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#f8fcfd]"></div>}>
      <RegisterForm />
    </Suspense>
  )
}
