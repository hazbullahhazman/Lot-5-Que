export default function POSLoading() {
  return (
    <div className="min-h-screen bg-[#f4f7f6] flex items-center justify-center px-6">
      <div className="bg-white rounded-[2rem] border border-outline-variant/10 shadow-sm p-8 w-full max-w-sm text-center">
        <div className="w-14 h-14 mx-auto mb-5 rounded-2xl bg-[#004be2] text-white flex items-center justify-center shadow-sm">
          <span className="material-symbols-outlined text-3xl">point_of_sale</span>
        </div>
        <p className="text-[10px] uppercase tracking-widest font-black text-[#004be2] mb-2">Secure POS</p>
        <h1 className="font-headline font-black text-2xl text-on-surface mb-5">Opening staff console</h1>
        <div className="h-2 rounded-full bg-surface-container overflow-hidden">
          <div className="h-full w-1/2 rounded-full bg-[#e5f638] animate-pulse"></div>
        </div>
      </div>
    </div>
  )
}
