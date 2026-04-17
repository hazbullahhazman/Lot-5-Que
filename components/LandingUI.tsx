'use client'
import Link from 'next/link'
import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

const HERO_IMAGES = [
  "/slider-images/1.jpg",
  "/slider-images/2.jpg",
  "/slider-images/3.jpg",
  "/slider-images/4.jpg"
];

export function SiteHeader({ isDashboard = false }: { isDashboard?: boolean }) {
  return (
    <nav className={`w-full z-50 bg-[#FAFAFA]/95 dark:bg-[#141414]/95 backdrop-blur border-b border-slate-200 dark:border-slate-800 ${isDashboard ? 'sticky top-0' : 'fixed top-0'}`}>
      <div className="max-w-7xl mx-auto flex items-center justify-between px-6 py-5">
        <Link href="/" className="text-2xl font-black text-slate-900 dark:text-white uppercase tracking-tight">
            LOT 5
        </Link>
        <div className="hidden md:flex items-center gap-10">
          <Link href="/#services" className="text-sm font-bold uppercase tracking-widest text-slate-500 hover:text-slate-900 dark:hover:text-white transition-colors">Services</Link>
          <Link href="/#products" className="text-sm font-bold uppercase tracking-widest text-slate-500 hover:text-slate-900 dark:hover:text-white transition-colors">Products</Link>
          <Link href="/#story" className="text-sm font-bold uppercase tracking-widest text-slate-500 hover:text-slate-900 dark:hover:text-white transition-colors">Our Story</Link>
          <Link href="/#concierge" className="text-sm font-bold uppercase tracking-widest text-slate-500 hover:text-slate-900 dark:hover:text-white transition-colors">Concierge</Link>
        </div>
        <div className="flex items-center gap-6">
          <button className="text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors" onClick={() => document.documentElement.classList.toggle('dark')}>
            <span className="material-symbols-outlined text-[20px]">dark_mode</span>
          </button>
          {!isDashboard && (
            <div className="flex items-center gap-4">
              <Link href="/#services" className="hidden lg:flex border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 px-5 py-2.5 rounded-full text-[10px] font-bold uppercase tracking-widest hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
                View Service
              </Link>
              <Link href="/register" className="hidden lg:flex bg-slate-900 dark:bg-white text-white dark:text-black px-5 py-2.5 rounded-full text-[10px] font-bold uppercase tracking-widest hover:scale-105 transition-transform">
                Register Now
              </Link>
              <Link href="/login" className="bg-landing-primary text-black px-5 py-2.5 rounded-full text-[10px] font-bold uppercase tracking-widest hover:scale-105 transition-transform shadow-sm">
                Join the Queue
              </Link>
            </div>
          )}
        </div>
      </div>
    </nav>
  )
}

export function LandingHero() {
  const [[page, direction], setPage] = useState([0, 0]);

  const imageIndex = ((page % HERO_IMAGES.length) + HERO_IMAGES.length) % HERO_IMAGES.length;

  const paginate = (newDirection: number) => {
    setPage([page + newDirection, newDirection]);
  };

  useEffect(() => {
    const timer = setInterval(() => {
      paginate(1);
    }, 5000);
    return () => clearInterval(timer);
  }, [page]);

  const variants = {
    enter: (direction: number) => ({
      x: direction > 0 ? 1000 : -1000,
      opacity: 0
    }),
    center: {
      zIndex: 1,
      x: 0,
      opacity: 1
    },
    exit: (direction: number) => ({
      zIndex: 0,
      x: direction < 0 ? 1000 : -1000,
      opacity: 0
    })
  };

  const swipeConfidenceThreshold = 10000;
  const swipePower = (offset: number, velocity: number) => {
    return Math.abs(offset) * velocity;
  };

  return (
    <section className="relative h-screen min-h-[800px] flex items-center pt-20 overflow-hidden">
      <div className="absolute inset-0 z-0 bg-stone-950">
        <AnimatePresence initial={false} custom={direction}>
          <motion.img
            key={page}
            src={HERO_IMAGES[imageIndex]}
            custom={direction}
            variants={variants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{
              x: { type: "spring", stiffness: 300, damping: 30 },
              opacity: { duration: 0.2 }
            }}
            drag="x"
            dragConstraints={{ left: 0, right: 0 }}
            dragElastic={1}
            onDragEnd={(e, { offset, velocity }) => {
              const swipe = swipePower(offset.x, velocity.x);
              if (swipe < -swipeConfidenceThreshold) {
                paginate(1);
              } else if (swipe > swipeConfidenceThreshold) {
                paginate(-1);
              }
            }}
            alt="Barbershop background slider" 
            className="absolute inset-0 w-full h-full object-cover object-top cursor-grab active:cursor-grabbing"
          />
        </AnimatePresence>
        <div className="absolute inset-0 bg-gradient-to-b from-stone-950/50 via-stone-950/60 to-stone-950 border-b border-landing-primary shadow-2xl z-10 pointer-events-none"></div>
      </div>
      
      {/* Slider Indicators */}
      <div className="absolute bottom-24 left-1/2 -translate-x-1/2 z-20 flex gap-3 pointer-events-auto">
         {HERO_IMAGES.map((_, idx) => (
             <button 
               key={idx} 
               onClick={() => setPage([idx, idx > imageIndex ? 1 : -1])}
               className={`h-2 rounded-full transition-all duration-300 ${idx === imageIndex ? 'bg-landing-primary w-8' : 'bg-white/40 hover:bg-white w-2'}`}
               aria-label={`Go to slide ${idx + 1}`}
             />
         ))}
      </div>

      <div className="relative z-10 w-full max-w-7xl mx-auto px-6 text-center pointer-events-none">
        <p className="text-landing-primary font-bold tracking-[0.2em] uppercase text-sm mb-6 drop-shadow-md">PREMIUM MEN&apos;S STYLE</p>
        <h1 className="text-5xl md:text-[6.5rem] font-black text-white leading-[1.05] tracking-tight mb-12 drop-shadow-2xl">
            Defining the Modern<br/><span className="italic font-light opacity-95">Gentleman.</span>
        </h1>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-6 pointer-events-auto">
          <Link href="/login" className="bg-landing-primary text-black px-10 py-5 rounded-full font-bold uppercase tracking-widest hover:bg-yellow-400 transition-colors shadow-xl w-full sm:w-auto">
              Join The Queue
          </Link>
          <Link href="/#services" className="border border-white/60 bg-black/20 backdrop-blur-sm text-white px-10 py-5 rounded-full font-bold uppercase tracking-widest hover:bg-white/20 transition-colors w-full sm:w-auto">
              OUR SERVICES
          </Link>
        </div>
      </div>
    </section>
  )
}

export function MarketingSections() {
  return (
    <div className="bg-[#f9f6f5] dark:bg-stone-950 text-slate-900 dark:text-white">
      {/* THE CRAFT SECTIOM */}
      <section className="py-32 px-6 max-w-7xl mx-auto" id="services">
        <div className="flex flex-col md:flex-row justify-between items-end mb-16 gap-6">
          <div>
            <h2 className="text-4xl md:text-5xl font-black uppercase tracking-tight mb-2">The Craft</h2>
            <p className="text-slate-500 max-w-md">Meticulous attention to detail for every client, every time. Experience the Lot 5 standard.</p>
          </div>
          <div className="flex gap-4">
            <button className="w-12 h-12 rounded-full border border-slate-300 dark:border-slate-700 flex items-center justify-center hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
              <span className="material-symbols-outlined text-slate-400">arrow_back</span>
            </button>
            <button className="w-12 h-12 rounded-full bg-slate-900 text-white flex items-center justify-center hover:bg-slate-800 transition-colors">
              <span className="material-symbols-outlined">arrow_forward</span>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="bg-white dark:bg-[#1A1A1A] rounded-[1.5rem] overflow-hidden shadow-sm hover:shadow-xl transition-all duration-300 border border-slate-200/60 dark:border-stone-800 flex flex-col">
            <div className="aspect-[4/5] overflow-hidden">
                <img alt="Classic Cut" className="w-full h-full object-cover hover:scale-105 transition-transform duration-700" src="/classic_cut.png" />
            </div>
            <div className="p-8">
              <h3 className="font-black text-xl uppercase tracking-wider mb-2">UTM Students</h3>
              <div className="flex justify-between items-end">
                  <p className="text-slate-500 text-sm max-w-[200px]">Tailored precision for every profile.</p>
                  <span className="text-landing-primary font-bold text-lg">RM 15.00</span>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-[#1A1A1A] rounded-[1.5rem] overflow-hidden shadow-sm hover:shadow-xl transition-all duration-300 border border-slate-200/60 dark:border-stone-800 flex flex-col">
            <div className="aspect-[4/5] overflow-hidden">
                <img alt="Beard Sculpt" className="w-full h-full object-cover hover:scale-105 transition-transform duration-700" src="/beard_sculpt.png" />
            </div>
            <div className="p-8">
              <h3 className="font-black text-xl uppercase tracking-wider mb-2">Staff / Outsider</h3>
              <div className="flex justify-between items-end">
                  <p className="text-slate-500 text-sm max-w-[200px]">Premium cut for staff & outsiders.</p>
                  <span className="text-landing-primary font-bold text-lg">RM 18.00</span>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-[#1A1A1A] rounded-[1.5rem] overflow-hidden shadow-sm hover:shadow-xl transition-all duration-300 border border-slate-200/60 dark:border-stone-800 flex flex-col">
            <div className="aspect-[4/5] overflow-hidden">
                <img alt="Hot Towel Shave" className="w-full h-full object-cover hover:scale-105 transition-transform duration-700" src="/hot_towel.png" />
            </div>
            <div className="p-8">
              <h3 className="font-black text-xl uppercase tracking-wider mb-2">Shave</h3>
              <div className="flex justify-between items-end">
                  <p className="text-slate-500 text-sm max-w-[200px]">The ultimate traditional ritual.</p>
                  <span className="text-landing-primary font-bold text-lg">RM 10.00</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* DIGITAL CONCIERGE BANNER */}
      <section className="px-6 py-12 max-w-7xl mx-auto" id="concierge">
         <div className="bg-[#121212] rounded-[2.5rem] overflow-hidden shadow-2xl relative grid grid-cols-1 md:grid-cols-2 text-white">
            <div className="p-12 md:p-20 z-10 flex flex-col justify-center">
                <div className="w-16 h-1 bg-landing-primary mb-8"></div>
                <h2 className="text-3xl md:text-5xl font-black uppercase leading-tight mb-8">The Lot 5<br/><span className="text-landing-primary">Digital Concierge</span></h2>
                <p className="text-stone-400 text-lg leading-relaxed mb-12">
                    We&apos;ve eliminated the wait. Our digital concierge system allows you to join the queue from anywhere. Get real-time updates on your wait time, select your preferred barber, and arrive exactly when your chair is ready. High-end grooming, meeting high-end technology.
                </p>
                <div className="flex gap-12 mb-12">
                    <div>
                        <p className="text-landing-primary text-3xl font-black mb-1">0%</p>
                        <p className="text-xs uppercase tracking-widest text-stone-500 font-bold">Wait Room Time</p>
                    </div>
                    <div>
                        <p className="text-landing-primary text-3xl font-black mb-1">100%</p>
                        <p className="text-xs uppercase tracking-widest text-stone-500 font-bold">Service Focus</p>
                    </div>
                </div>
                <Link href="/login" className="flex items-center gap-3 text-landing-primary font-bold uppercase tracking-widest text-sm hover:opacity-80 transition-opacity">
                    Explore The App <span className="material-symbols-outlined text-[20px]">arrow_forward</span>
                </Link>
            </div>
            <div className="relative min-h-[400px] md:min-h-full opacity-60 md:opacity-100 hidden md:block">
               {/* Dark gradient fade for the image edge to blend with black section */}
               <div className="absolute inset-y-0 left-0 w-32 bg-gradient-to-r from-[#121212] to-transparent z-10 hidden md:block"></div>
               <img alt="Barbershop precise tools" className="w-full h-full object-cover object-left" src="https://images.unsplash.com/photo-1521590838159-86ebf4b6bed8?q=80&w=2674&auto=format&fit=crop" />
            </div>
         </div>
      </section>

      {/* PREMIUM PROVISIONS */}
      <section className="py-32 px-6 max-w-7xl mx-auto text-center" id="products">
         <span className="text-landing-primary font-bold uppercase tracking-[0.2em] text-xs mb-4 block">Essentials</span>
         <h2 className="text-4xl md:text-5xl font-black uppercase mb-20 tracking-tight">Premium Provisions</h2>

         <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8 mb-16">
            <div className="bg-white dark:bg-[#1a1a1a] p-6 rounded-[2rem] border border-slate-200 dark:border-stone-800 text-left hover:shadow-xl transition-all duration-300">
                <div className="aspect-square bg-[#FAFAFA] dark:bg-stone-900 rounded-2xl flex items-center justify-center p-8 mb-6">
                   <img alt="Matte Pomade" className="w-full h-full object-contain mix-blend-multiply dark:mix-blend-normal" src="https://lh3.googleusercontent.com/aida-public/AB6AXuD8vzm3TpIP7_g9BSkQbdWx1cmJbgY7WI3XrbmmKbtYYYyfJO67fp9XyAKBNN8j4c1UMkWfGGk8vyiYTJGcaEkRDLXYjBVJnronomBJOta7eOop_74uvv57XvdGTBZublyJUkaQRNxcd_Bx5TgEp-P-nhPC9hHTWiXlLMWpR0DWYrzZQUfnj4XK8LgQsTNnrTrNbFohj2VT75wqhC28zwBYHSKa5snOw6TpxPWY5PpiTlqzk0152MlFtZUQa4CP_R0fdw3ksMXpFg" />
                </div>
                <h4 className="font-bold text-sm uppercase tracking-wide mb-1">Matte Pomade - Clay</h4>
                <p className="text-slate-500 text-xs mb-4">Firm hold, natural finish</p>
                <div className="flex items-center justify-between">
                   <span className="font-black text-lg">RM 24.50</span>
                   <button className="bg-slate-900 dark:bg-white text-white dark:text-black w-10 h-10 rounded-lg flex items-center justify-center hover:bg-landing-primary hover:text-black transition-colors">
                     <span className="material-symbols-outlined text-[18px]">shopping_cart</span>
                   </button>
                </div>
            </div>

            <div className="bg-white dark:bg-[#1a1a1a] p-6 rounded-[2rem] border border-slate-200 dark:border-stone-800 text-left hover:shadow-xl transition-all duration-300">
                <div className="aspect-square bg-[#FAFAFA] dark:bg-stone-900 rounded-2xl flex items-center justify-center p-8 mb-6">
                   <img alt="Lot 5 Serum" className="w-full h-full object-contain mix-blend-multiply dark:mix-blend-normal" src="https://lh3.googleusercontent.com/aida-public/AB6AXuDEpmvOExkfH1u2T_rcCY71LG64tleXvonsbXE7dDRaH_hHUKCQ9TtsGdr2U-7wlA1kfx-SGYh0zWX7ayNvbSW5ieYa1VJiZ01LBzEzyRg3W9j4lml8m-VLVywdWtYnxqRwgppYvxsC4A6b7-cbCuXUeTp1Db6N-s27K6S4GGciXB0QYC4wwWpeEmGa4xBgjL5jWFu01wCqtI4m2fBUcyDrobyxnBUkuwI5GOIg0cWipcMUnn3vTb-rMXS4Ki_BneCdhf8gUW_Rtg" />
                </div>
                <h4 className="font-bold text-sm uppercase tracking-wide mb-1">Lot 5 Grooming Oil</h4>
                <p className="text-slate-500 text-xs mb-4">Sandalwood &amp; Cedar</p>
                <div className="flex items-center justify-between">
                   <span className="font-black text-lg">RM 12.00</span>
                   <button className="bg-slate-900 dark:bg-white text-white dark:text-black w-10 h-10 rounded-lg flex items-center justify-center hover:bg-landing-primary hover:text-black transition-colors">
                     <span className="material-symbols-outlined text-[18px]">shopping_cart</span>
                   </button>
                </div>
            </div>

            <div className="bg-white dark:bg-[#1a1a1a] p-6 rounded-[2rem] border border-slate-200 dark:border-stone-800 text-left hover:shadow-xl transition-all duration-300">
                <div className="aspect-square bg-[#FAFAFA] dark:bg-stone-900 rounded-2xl flex items-center justify-center p-8 mb-6">
                   <img alt="Grooming Kit" className="w-full h-full object-contain mix-blend-multiply dark:mix-blend-normal" src="https://lh3.googleusercontent.com/aida-public/AB6AXuDdWPMeCEnt0_kh4h52jBfxG9hNUEJztJhhxR8usuk9pNH9N8BycChwb0tTWcCH36L0oHbGHGp94uVY8JBg1utd3Dbuw0DQcbANgFQeB27VAFJpyd0dUCnqm2GZmdo4NrOEqJIsV8ELay-YlbIeJ5syf9GThup2piWKaEBw6uIfdqgMqnV-vyB4yQ4b5JCRa-aZ3dFjz6HwdTYnBnUU4VH4tEM5UGpa0OhBVX9DYysWisxMcpMN9GzUQs53FiI6QTNtnkHfu8Vsog" />
                </div>
                <h4 className="font-bold text-sm uppercase tracking-wide mb-1">Premium Grooming Kit</h4>
                <p className="text-slate-500 text-xs mb-4">Razor, Brush &amp; Stand</p>
                <div className="flex items-center justify-between">
                   <span className="font-black text-lg">RM 45.00</span>
                   <button className="bg-slate-900 dark:bg-white text-white dark:text-black w-10 h-10 rounded-lg flex items-center justify-center hover:bg-landing-primary hover:text-black transition-colors">
                     <span className="material-symbols-outlined text-[18px]">shopping_cart</span>
                   </button>
                </div>
            </div>

            <div className="bg-white dark:bg-[#1a1a1a] p-6 rounded-[2rem] border border-slate-200 dark:border-stone-800 text-left hover:shadow-xl transition-all duration-300">
                <div className="aspect-square bg-[#FAFAFA] dark:bg-stone-900 rounded-2xl flex items-center justify-center p-8 mb-6">
                   <img alt="Premium Hair Tonic" className="w-full h-full object-contain mix-blend-multiply dark:mix-blend-normal" src="https://lh3.googleusercontent.com/aida-public/AB6AXuDc1HayOtXSLD84QV2jO2bQn0EfBFFNA0RE2u2JdoNBmOzq3Ss0hHlu27urBbA7MfZBa8UEZHYtK9DbBmfu93zUFDJ2qIFb1T25unBCqv_Z19XrXqoJXqJUayASmybu86fTDu68_WMWZKJESnAiCRKFGbvZ8feIp5G49nBw5B6fl8DanBL_Q__m95YgqMsYsmFQKsxmUvQSVgLdPG4FCOuKI5Q3ATR0rG5Eeu5poj94nTIlTOvdIRF72rDTHAWqjNBLuzgQWLsP9w" />
                </div>
                <h4 className="font-bold text-sm uppercase tracking-wide mb-1">Hair &amp; Beard Tonic</h4>
                <p className="text-slate-500 text-xs mb-4">Weightless texture</p>
                <div className="flex items-center justify-between">
                   <span className="font-black text-lg">RM 24.00</span>
                   <button className="bg-slate-900 dark:bg-white text-white dark:text-black w-10 h-10 rounded-lg flex items-center justify-center hover:bg-landing-primary hover:text-black transition-colors">
                     <span className="material-symbols-outlined text-[18px]">shopping_cart</span>
                   </button>
                </div>
            </div>
         </div>

         <button className="px-10 py-4 border-2 border-slate-900 dark:border-white rounded-full font-bold uppercase tracking-widest text-xs hover:bg-slate-900 hover:text-white dark:hover:bg-white dark:hover:text-black transition-colors">
            Shop All Products
         </button>
      </section>

      {/* BEYOND THE BLADE */}
      <section className="py-24 px-6 max-w-7xl mx-auto" id="story">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-16 items-center">
           <div className="relative">
              <img alt="Scissor tools" className="rounded-[2.5rem] shadow-2xl w-full object-cover aspect-square" src="https://lh3.googleusercontent.com/aida-public/AB6AXuCOV2jZzHzySTQ-EVwmQb0MCTG5tumOB93TGJsTLufk7kQgXuyjrPGAlMsPqGqTyWB6VcflsAjxzgT7nK7JowHjngmEWXW7JNo5I_8wmrYBF9apAn19bvLBZbRCAPdzV8QPAjEzOU1FT6B8W_MC5Z5QRYhEe3Hb8N2hyZwuDE-HH3yFEhLrqtgoilwEXl0o6T_YESaN0Dm2PUH-exeyNr57nyeOC362H7sN9L7FGV0KWSOQSatVuq8AO3aaiA8sRT5IXBXMKfokBg" />
              <div className="absolute -bottom-8 -right-8 bg-white dark:bg-stone-900 p-8 rounded-[2rem] shadow-xl border border-slate-100 dark:border-stone-800">
                 <p className="text-xs uppercase tracking-[0.2em] font-bold text-slate-500 mb-2">Established</p>
                 <p className="text-4xl font-black text-landing-primary">MCMXCIV</p>
              </div>
           </div>
           
           <div className="md:pl-10">
              <h2 className="text-5xl font-black uppercase leading-tight mb-8">BEYOND THE<br/>BLADE.</h2>
              <p className="text-slate-600 dark:text-stone-400 text-lg mb-6 leading-relaxed">
                  Lot 5 was born from a desire to return to the golden age of barbering, while embracing the technology of tomorrow. We don&apos;t just cut hair; we sculpt confidence.
              </p>
              <p className="text-slate-600 dark:text-stone-400 text-lg mb-12 leading-relaxed">
                  Every station is equipped with premium tools, every towel is perfectly steamed, and every barber is a master of their craft. This is the new standard of precision grooming.
              </p>
              
              <div className="flex items-center gap-6">
                 <div className="w-16 h-16 rounded-full bg-slate-900 border-2 border-landing-primary p-1 overflow-hidden">
                    {/* Dummy founder avatar */}
                    <img className="w-full h-full object-cover rounded-full" alt="Founder" src="https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=300&h=300&fit=crop" />
                 </div>
                 <div>
                    <p className="font-black uppercase tracking-wider text-sm">BARBER / STYLIST</p>
                    <p className="text-slate-500 uppercase tracking-widest text-[10px]">Your Style Master In Chief</p>
                 </div>
              </div>
           </div>
        </div>
      </section>

      {/* COMMUNITY IMPACT */}
      <section className="py-24 px-6 max-w-7xl mx-auto">
         <span className="text-landing-primary uppercase tracking-[0.2em] text-xs font-bold mb-4 block">Our Impact</span>
         <h2 className="text-4xl md:text-5xl font-black uppercase mb-16"><span className="text-slate-900 dark:text-white">Beyond the Chair:</span><br/><span className="text-slate-400">Our Community Impact</span></h2>
         
         <div className="grid grid-cols-1 md:grid-cols-2 gap-16">
            <div>
               <h3 className="text-2xl font-black uppercase mb-6">Next Barber Program: <span className="text-landing-primary">Banyuwangi</span></h3>
               <p className="text-slate-600 dark:text-stone-400 leading-relaxed mb-8">
                  A dedicated initiative designed to teach premium barbering skills to local youth in Banyuwangi. We are creating sustainable job opportunities and cultivating the next generation of master barbers.
               </p>
               <div className="flex gap-10 mb-12">
                  <div>
                      <p className="text-landing-primary text-3xl font-black mb-1">50+</p>
                      <p className="text-[10px] uppercase font-bold tracking-widest text-slate-500">Trained</p>
                  </div>
                  <div>
                     <p className="text-landing-primary text-3xl font-black mb-1">100%</p>
                     <p className="text-[10px] uppercase font-bold tracking-widest text-landing-primary drop-shadow-sm">Empowered</p>
                  </div>
               </div>
               <div className="grid grid-cols-2 gap-4">
                  <div className="rounded-[1.5rem] overflow-hidden aspect-[4/5]">
                     <img className="w-full h-full object-cover" src="https://lh3.googleusercontent.com/aida/ADBb0uinG4v9tlqn2m9jqAc8asqHWaaPcZ6N7rmXJt5_Hk0WUCXKN6hw3ehc7nihvzZaiyKJNbu1xCh5h9ebM9zIsRfMANarK0ZUx6UETieIiMiERWnxDLLvkq1I2wG9f-hMHzLdVBrjMYltBcMzCek57J8Jif3sNO4Vm2Lvkjcj82aY9Qdd2fjIoLrB2-VVuRb8XRtXcyjIfhz73bbuE0qQkKSA4Z8abrCReBeYcKEPVsicsVv6Nksragyecwf47kK1gs9Fy1CQbqFq" alt="Barber Training 1" />
                  </div>
                  <div className="rounded-[1.5rem] overflow-hidden aspect-[4/5] mt-8">
                     <img className="w-full h-full object-cover" src="https://lh3.googleusercontent.com/aida/ADBb0ugrV7fPrCxDCI5Yz1CwZPZ3oM6BQ4IAJPQN0_WxyIxcQPCCi9-NIMoQaD-Ls1ek4HBjEGIeyfiuL-FVePQoJjcF0hZcxm_poBiRGYFLPNg476zrj5dGvTRXY1C80o9XWz0tEOuG4tbnZBlaSwu3MPQcahmuJUMXWOqu0ezI2Mj5D4unsaSr-zbsoycyILs81Mm9APTvVwYBTYWcxYgxbtCR9vP4P1GwfsZaaCVyJTrHbT6PWpUDI4J_INCR3hd8mUU_4Nv6nMeP" alt="Barber Training 2" />
                  </div>
               </div>
            </div>

            <div>
               <div className="grid grid-cols-2 gap-4 mb-12">
                  <div className="rounded-[1.5rem] overflow-hidden aspect-[4/5] mt-12">
                     <img className="w-full h-full object-cover" src="https://lh3.googleusercontent.com/aida/ADBb0uj1y6nIilZw8REwbG1h7vhURno6Z1jMRwHWD8p-L5WS4JfekKDByYupcqFLrl1li1lclC2XxzbV_mr5Gn1mmAIcBqCfAx5AymsGCqc133I0E-hZ7jU7xnCx8SdiIOKN8NjFuj9thyXPWzwEcpYee3OnDhiR0L84Kf_mfmGDOEkLgZ3rhcBT2eQn2YlgsH7INVE2RL2gCPQ7x42LdNH1xMEXaVbsXzFd-9ZWDuIZA9Sk-xXGDEDIQIPvSOS7tPz6skIKZC9fNpU" alt="Community Outwards 1" />
                  </div>
                  <div className="rounded-[1.5rem] overflow-hidden aspect-[4/5]">
                     <img className="w-full h-full object-cover" src="https://lh3.googleusercontent.com/aida/ADBb0uh5vfGSj3JEhyQFRmV9SB4dMHe7HaxYRGBqdGrhpxaHSsD_hYMqlA4iv4KmQYUk8Z1RjtBIP0vYc5RfiFzXIJ2ymWEj0rcFG5cpMEFJn5V6OWtTXTqWkAY4tHrinr_qF0-FnwLfyDheIw5fiIhtS61BheeFSzY7PWv8Cw7WspxwKK00l4IXZplEyAjCx8A0QVPmZ9QCNZ40SV0y7l5zJrpQZgOOOSkykBoEhJXLVkM2NTjEXhd4BqytkAae2VPMZob0w2NJ8yYg" alt="Community Outwards 2" />
                  </div>
               </div>
               <h3 className="text-2xl font-black uppercase mb-6">Nationwide Service <span className="text-landing-primary">Across Indonesia</span></h3>
               <p className="text-slate-600 dark:text-stone-400 leading-relaxed mb-6">
                  Lot 5 travels beyond our shop walls to provide community grooming services across the archipelago. We believe that looking your best should be accessible to everyone, no matter their circumstances.
               </p>
               <button className="flex items-center gap-2 text-landing-primary font-bold text-xs tracking-widest uppercase hover:opacity-80 transition-opacity">
                  See Our Initiatives <span className="material-symbols-outlined text-sm">arrow_forward</span>
               </button>
            </div>
         </div>
      </section>
    </div>
  )
}

export function SiteFooter() {
  return (
    <footer className="bg-[#f9f6f5] dark:bg-stone-950 border-t border-slate-200 dark:border-stone-900 pb-12 pt-20 px-6">
      <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-4 gap-12 mb-16">
         <div className="col-span-1 md:col-span-2">
            <Link href="/" className="text-3xl font-black text-slate-900 dark:text-white uppercase tracking-tight mb-6 block">
               LOT 5
            </Link>
            <p className="text-slate-500 max-w-sm mb-8 text-sm leading-relaxed">
               Precision barbering for the modern era. Join our digital queue and experience the art of grooming refined.
            </p>
            <div className="flex gap-4">
               {/* Minimal social icons */}
               <div className="w-8 h-8 rounded-full bg-slate-200 dark:bg-stone-900 flex items-center justify-center hover:bg-landing-primary transition-colors cursor-pointer text-slate-600">
                  <span className="material-symbols-outlined text-[16px]">map</span>
               </div>
               <div className="w-8 h-8 rounded-full bg-slate-200 dark:bg-stone-900 flex items-center justify-center hover:bg-landing-primary transition-colors cursor-pointer text-slate-600">
                  <span className="material-symbols-outlined text-[16px]">call</span>
               </div>
               <div className="w-8 h-8 rounded-full bg-slate-200 dark:bg-stone-900 flex items-center justify-center hover:bg-landing-primary transition-colors cursor-pointer text-slate-600">
                  <span className="material-symbols-outlined text-[16px]">mail</span>
               </div>
            </div>
         </div>
         
         <div>
            <h4 className="font-bold text-xs uppercase tracking-[0.2em] mb-6 text-slate-900 dark:text-white">Navigation</h4>
            <ul className="space-y-4 text-sm text-slate-500">
               <li><Link href="/#services" className="hover:text-landing-primary transition-colors">Services</Link></li>
               <li><Link href="/#products" className="hover:text-landing-primary transition-colors">Products</Link></li>
               <li><Link href="/#concierge" className="hover:text-landing-primary transition-colors">Digital Concierge</Link></li>
               <li><Link href="/#story" className="hover:text-landing-primary transition-colors">Our Story</Link></li>
            </ul>
         </div>

         <div>
            <h4 className="font-bold text-xs uppercase tracking-[0.2em] mb-6 text-slate-900 dark:text-white">Hours</h4>
            <ul className="space-y-4 text-sm text-slate-500">
               <li className="flex justify-between"><span>Mon - Fri</span> <span>14:00 - 22:00</span></li>
               <li className="flex justify-between"><span>Saturday</span> <span>09:00 - 18:00</span></li>
               <li className="flex justify-between"><span>Sunday</span> <span>Closed</span></li>
            </ul>
         </div>
      </div>
      
      <div className="max-w-7xl mx-auto border-t border-slate-200 dark:border-stone-800 pt-8 flex flex-col md:flex-row justify-between items-center gap-4 text-xs text-slate-400 font-medium">
         <p>© 2024 LOT 5 BARBERSHOP. PRECISION & CRAFT. ALL RIGHTS RESERVED.</p>
         <div className="flex gap-6">
            <Link href="#" className="hover:text-slate-900 dark:hover:text-white transition-colors">PRIVACY</Link>
            <Link href="#" className="hover:text-slate-900 dark:hover:text-white transition-colors">TERMS</Link>
         </div>
      </div>
    </footer>
  )
}
