import { createContext, useContext } from 'react';

export type ServerRole = 'CampusAdmin' | 'HostelAdmin' | 'MessManager' | 'Faculty' | 'Student';

export interface SessionUser {
  id: string;
  role: ServerRole;
  name: string;
  email: string;
  room: string;
  /** Institutional ID: registration number (students) or employee ID (staff). */
  ref?: string;
}

export const SessionContext = createContext<SessionUser | null>(null);

export function useSession(): SessionUser | null {
  return useContext(SessionContext);
}

// Demo credentials are only revealed in dev builds or when explicitly enabled.
export const SHOW_DEMO_CREDENTIALS =
  import.meta.env.DEV || import.meta.env.VITE_SHOW_DEMO_CREDENTIALS === 'true';
