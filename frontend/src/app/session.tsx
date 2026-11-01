/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import type { Session } from '../mocks/session'
import { getPreviewSession } from '../mocks/session'
interface SessionContextValue {
  session: Session | null
  setProductionSession: (session: Session | null) => void
}
const SessionContext = createContext<SessionContextValue>({
  session: null,
  setProductionSession: () => {},
})
export function SessionProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(() => getPreviewSession())
  useEffect(() => {
    const update = () => setSession(getPreviewSession())
    window.addEventListener('cocomark:session', update)
    return () => window.removeEventListener('cocomark:session', update)
  }, [])
  return (
    <SessionContext.Provider value={{ session, setProductionSession: setSession }}>
      {children}
    </SessionContext.Provider>
  )
}
export function useSession() {
  return useContext(SessionContext)
}
