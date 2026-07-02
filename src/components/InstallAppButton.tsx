import { Download } from 'lucide-react'
import { usePwaInstall } from '../hooks/usePwaInstall'

export function InstallAppButton() {
  const { canInstall_, isInstalled_, promptInstall_ } = usePwaInstall()

  if (isInstalled_) {
    return (
      <section className="bg-slate-900 border border-emerald-900/40 rounded-3xl p-5 shadow-sm">
        <h3 className="text-base font-black text-slate-100 flex items-center gap-2 mb-2">
          <span className="text-xl">📱</span>
          <span>האפליקציה מותקנת</span>
        </h3>
        <p className="text-xs text-slate-400 leading-normal">
          Baby Tracker מותקן על המכשיר שלך ופועל במצב standalone.
        </p>
      </section>
    )
  }

  if (!canInstall_) {
    return (
      <section className="bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-sm">
        <h3 className="text-base font-black text-slate-100 flex items-center gap-2 mb-2">
          <span className="text-xl">📱</span>
          <span>התקנת אפליקציה</span>
        </h3>
        <p className="text-xs text-slate-400 leading-normal">
          ב-Chrome/Android: פתח תפריט הדפדפן ובחר &quot;הוסף למסך הבית&quot;.
          {' '}
          ב-iPhone/Safari: לחץ על כפתור השיתוף ובחר &quot;הוסף למסך הבית&quot;.
        </p>
      </section>
    )
  }

  return (
    <section className="bg-slate-900 border border-indigo-900/40 rounded-3xl p-5 shadow-sm">
      <h3 className="text-base font-black text-slate-100 flex items-center gap-2 mb-2">
        <span className="text-xl">📱</span>
        <span>התקנת אפליקציה</span>
      </h3>
      <p className="text-xs text-slate-400 mb-4 leading-normal">
        התקן את Baby Tracker על המכשיר לגישה מהירה, מסך מלא ועבודה offline לקבצים שמורים במטמון.
      </p>
      <button
        type="button"
        onClick={() => promptInstall_()}
        className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-black py-3 px-4 rounded-2xl flex items-center justify-center gap-2 shadow-lg transition-all text-sm cursor-pointer"
      >
        <Download className="w-4 h-4" />
        <span>התקן Baby Tracker</span>
      </button>
    </section>
  )
}
