// ===============================================================
// Canopy Web — Global State (Zustand with localStorage)
// ===============================================================
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { User, Home, Equipment, MaintenanceTask, WeatherData, Agent, MaintenanceLog } from '@/types';

interface CanopyState {
  user: User | null;
  isAuthenticated: boolean;
  setUser: (user: User | null) => void;
  home: Home | null;
  setHome: (home: Home | null) => void;
  equipment: Equipment[];
  setEquipment: (items: Equipment[]) => void;
  addEquipment: (item: Equipment) => void;
  updateEquipment: (id: string, updates: Partial<Equipment>) => void;
  removeEquipment: (id: string) => void;
  tasks: MaintenanceTask[];
  setTasks: (tasks: MaintenanceTask[]) => void;
  completeTask: (id: string, notes?: string, photoUrl?: string) => void;
  skipTask: (id: string) => void;
  maintenanceLogs: MaintenanceLog[];
  setMaintenanceLogs: (logs: MaintenanceLog[]) => void;
  addMaintenanceLog: (log: MaintenanceLog) => void;
  weather: WeatherData | null;
  setWeather: (data: WeatherData | null) => void;
  agent: Agent | null;
  setAgent: (agent: Agent | null) => void;
  isLoading: boolean;
  setLoading: (loading: boolean) => void;
  reset: () => void;
}

export const useStore = create<CanopyState>()(
  persist(
    (set) => ({
      user: null,
      isAuthenticated: false,
      setUser: (user) => set({ user, isAuthenticated: !!user }),
      home: null,
      setHome: (home) => set({ home }),
      equipment: [],
      setEquipment: (equipment) => set({ equipment }),
      addEquipment: (item) => set((s) => ({ equipment: [...s.equipment, item] })),
      updateEquipment: (id, updates) => set((s) => ({ equipment: s.equipment.map((e) => (e.id === id ? { ...e, ...updates } : e)) })),
      removeEquipment: (id) => set((s) => ({ equipment: s.equipment.filter((e) => e.id !== id) })),
      tasks: [],
      setTasks: (tasks) => set({ tasks }),
      completeTask: (id, notes, photoUrl) => set((s) => ({
        tasks: s.tasks.map((t) => t.id === id ? { ...t, status: 'completed' as const, completed_date: new Date().toISOString(), completion_notes: notes, completion_photo_url: photoUrl } : t),
      })),
      skipTask: (id) => set((s) => ({ tasks: s.tasks.map((t) => t.id === id ? { ...t, status: 'skipped' as const } : t) })),
      maintenanceLogs: [],
      setMaintenanceLogs: (maintenanceLogs) => set({ maintenanceLogs }),
      addMaintenanceLog: (log) => set((s) => ({ maintenanceLogs: [...s.maintenanceLogs, log] })),
      weather: null,
      setWeather: (weather) => set({ weather }),
      agent: null,
      setAgent: (agent) => set({ agent }),
      isLoading: false,
      setLoading: (isLoading) => set({ isLoading }),
      reset: () => set({ user: null, isAuthenticated: false, home: null, equipment: [], tasks: [], maintenanceLogs: [], weather: null, agent: null }),
    }),
    {
      name: 'canopy-web-store',
      partialize: (state) => ({
        user: state.user,
        isAuthenticated: state.isAuthenticated,
        home: state.home,
        equipment: state.equipment,
        tasks: state.tasks,
        maintenanceLogs: state.maintenanceLogs,
        agent: state.agent,
      }),
    }
  )
);
