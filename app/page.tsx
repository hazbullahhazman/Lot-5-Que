import { SiteHeader, LandingHero, MarketingSections, SiteFooter } from '@/components/LandingUI'

export default function Home() {
  return (
    <div className="font-sans bg-landing-bg-light dark:bg-landing-bg-dark text-slate-900 dark:text-slate-100 transition-colors duration-300 min-h-screen selection:bg-landing-primary selection:text-black">
      <SiteHeader />
      <LandingHero />
      <MarketingSections />
      <SiteFooter />

      {/* Floating Mobile CTA */}
      <div className="md:hidden fixed bottom-6 left-6 right-6 z-50">
        <a className="w-full bg-landing-primary text-black flex items-center justify-center py-5 rounded-2xl font-bold uppercase tracking-widest shadow-2xl shadow-landing-primary/40" href="/login">
            Join the Queue
        </a>
      </div>
    </div>
  )
}
