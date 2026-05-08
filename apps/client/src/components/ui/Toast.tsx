'use client'
import { createContext, useContext, useState, useCallback } from 'react'
import { cn } from '@/lib/data'

const Ctx = createContext<{toast:(m:string,t?:'success'|'error'|'info')=>void}>({toast:()=>{}})
export const useToast = () => useContext(Ctx)

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<{id:number;m:string;t:string}[]>([])
  const toast = useCallback((m:string, t='success') => {
    const id = Date.now()
    setToasts(p => [...p, {id,m,t}])
    setTimeout(() => setToasts(p => p.filter(x => x.id !== id)), 3500)
  }, [])
  return (
    <Ctx.Provider value={{toast}}>
      {children}
      <div className="fixed bottom-6 right-6 z-[200] flex flex-col gap-2 pointer-events-none">
        {toasts.map(t => (
          <div key={t.id} className={cn(
            'px-4 py-3 rounded-sm border font-mono text-[12px] font-medium animate-fade-up',
            t.t==='error'  ? 'bg-stone border-danger/30 text-danger' :
            t.t==='info'   ? 'bg-stone border-jadeDark/40 text-jadeDark' :
                             'bg-stone border-success/35 text-success'
          )}
            style={{boxShadow:'0 4px 16px rgba(36,40,32,0.12)'}}>
            {t.m}
          </div>
        ))}
      </div>
    </Ctx.Provider>
  )
}
