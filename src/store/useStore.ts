// ===============================================================
// Canopy Web — Global State (Zustand with localStorage)
// ===============================================================
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { User, Home, Equipment, EquipmentConsumable, MaintenanceTask, WeatherData, Agent, MaintenanceLog } from '@/types';
import type { TaskTemplateDB } from '@/services/supabase';
import { trackEvent } from '@/utils/analytics';

interface CanopyState {
  user: User | null;
  isAuthenticated: boolean;
  setUser: (user: User | null) => void;
  home: Home | null;
  setHome: (home: Home | null) => void;
  homes: Home[];
  setHomes: (homes: Home[]) => void;
  activeHomeId: string | null;
  setActiveHomeId: (id: string | null) => void;
  switchHome: (id: string) => void;
  equipment: Equipment[];
  setEquipment: (items: Equipment[]) => void;
  addEquipment: (item: Equipment) => void;
  updateEquipment: (id: string, updates: Partial<Equipment>) => void;
  removeEquipment: (id: string) => void;
  consumables: EquipmentConsumable[];
  setConsumables: (items: EquipmentConsumable[]) => void;
  addConsumable: (item: EquipmentConsumable) => void;
  updateConsumable: (id: string, updates: Partial<EquipmentConsumable>) => void;
  removeConsumable: (id: string) => void;
  customTemplates: TaskTemplateDB[];
  setCustomTemplates: (templates: TaskTemplateDB[]) => void;
  tasks: MaintenanceTask[];
  setTasks: (tasks: MaintenanceTask[]) => void;
  setTask: (task: MaintenanceTask) => void;
  addTask: (task: MaintenanceTask) => void;
  removeTask: (id: string) => void;
  completeTask: (id: string, notes?: string, photoUrl?: string) => void;
  reopenTask: (id: string) => void;
  skipTask: (id: string) => void;
  snoozeTask: (id: string, days: number) => void;
  maintenanceLogs: MaintenanceLog[];
  setMaintenanceLogs: (logs: MaintenanceLog[]) => void;
  addMaintenanceLog: (log: MaintenanceLog) => void;
  weather: WeatherData | null;
  setWeather: (data: WeatherData | null) => void;
  agent: Agent | null;
  setAgent: (agent: Agent | null) => void;
  isLoading: boolean;
  setLoading: (loading: boolean) => void;
  onboardingStep: number;
  setOnboardingStep: (step: number) => void;
  /** When an as_needed task is completed, store it here so UI can prompt rescheduling */
  pendingReschedule: MaintenanceTask | null;
  setPendingReschedule: (task: MaintenanceTask | null) => void;
  reset: () => void;
}

export const useStore = create<CanopyState>()(
  persist(
    (set) => ({
      user: null,
      isAuthenticated: false,
      setUser: (user) => set({ user, isAuthenticated: !!user }),
      home: null,
      setHome: (home) => set((s) => {
        const homes = home ? (s.homes.some(h => h.id === home.id)
          ? s.homes.map(h => h.id === home.id ? home : h)
          : [...s.homes, home]
        ) : s.homes;
        return { home, homes, activeHomeId: home?.id || s.activeHomeId };
      }),
      homes: [],
      setHomes: (homes) => set({ homes }),
      activeHomeId: null,
      setActiveHomeId: (activeHomeId) => set({ activeHomeId }),
      switchHome: (id) => set((s) => {
        const home = s.homes.find(h => h.id === id) || null;
        return { home, activeHomeId: id, equipment: [], tasks: [], maintenanceLogs: [] };
      }),
      equipment: [],
      setEquipment: (equipment) => set({ equipment }),
      addEquipment: (item) => set((s) => ({ equipment: [...s.equipment, item] })),
      updateEquipment: (id, updates) => set((s) => ({ equipment: s.equipment.map((e) => (e.id === id ? { ...e, ...updates } : e)) })),
      removeEquipment: (id) => set((s) => ({ equipment: s.equipment.filter((e) => e.id !== id) })),
      consumables: [],
      setConsumables: (consumables) => set({ consumables }),
      addConsumable: (item) => set((s) => ({ consumables: [...s.consumables, item] })),
      updateConsumable: (id, updates) => set((s) => ({ consumables: s.consumables.map((c) => (c.id === id ? { ...c, ...updates } : c)) })),
      removeConsumable: (id) => set((s) => ({ consumables: s.consumables.filter((c) => c.id !== id) })),
      customTemplates: [],
      setCustomTemplates: (customTemplates) => set({ customTemplates }),
      tasks: [],
      setTasks: (tasks) => set({ tasks }),
      setTask: (task) => set((s) => ({
        tasks: s.tasks.map((t) => t.id === task.id ? task : t),
      })),
      addTask: (task) => set((s) => ({ tasks: [...s.tasks, task] })),
      removeTask: (id) => set((s) => ({ tasks: s.tasks.filter((t) => t.id !== id) })),
      completeTask: (id, notes, photoUrl) => set((s) => {
        // GA4: fire first_task_complete once per user (before this completion, no tasks were completed)
        const priorCompleted = s.tasks.filter((t) => t.status === 'completed').length;
        if (priorCompleted === 0) {
          const task = s.tasks.find((t) => t.id === id);
          trackEvent('first_task_complete', {
            task_id: id,
            category: task?.category,
            has_photo: !!photoUrl,
          });
        }
        return {
          tasks: s.tasks.map((t) => t.id === id ? { ...t, status: 'completed' as const, completed_date: new Date().toISOString(), completion_notes: notes, completion_photo_url: photoUrl } : t),
        };
      }),
      reopenTask: (id) => set((s) => ({
        tasks: s.tasks.map((t) => t.id === id ? { ...t, status: 'upcoming' as const, completed_date: undefined, completion_notes: undefined, completion_photo_url: undefined } : t),
      })),
      skipTask: (id) => set((s) => ({ tasks: s.tasks.map((t) => t.id === id ? { ...t, status: 'skipped' as const } : t) })),
      snoozeTask: (id, days) => set((s) => ({
        tasks: s.tasks.map((t) => {
          if (t.id === id) {
            const newDate = new Date(t.due_date);
            newDate.setDate(newDate.getDate() + days);
            return { ...t, due_date: newDate.toISOString() };
          }
          return t;
        }),
      })),
      maintenanceLogs: [],
      setMaintenanceLogs: (maintenanceLogs) => set({ maintenanceLogs }),
      addMaintenanceLog: (log) => set((s) => ({ maintenanceLogs: [...s.maintenanceLogs, log] })),
      weather: null,
      setWeather: (weather) => set({ weather }),
      agent: null,
      setAgent: (agent) => set({ agent }),
      isLoading: false,
      setLoading: (isLoading) => set({ isLoading }),
      onboardingStep: 0,
      setOnboardingStep: (onboardingStep) => set({ onboardingStep }),
      pendingReschedule: null,
      setPendingReschedule: (pendingReschedule) => set({ pendingReschedule }),
      reset: () => set({ user: null, isAuthenticated: false, home: null, homes: [], activeHomeId: null, equipment: [], consumables: [], customTemplates: [], tasks: [], maintenanceLogs: [], weather: null, agent: null, onboardingStep: 0, pendingReschedule: null }),
    }),
    {
      name: 'canopy-web-store',
      partialize: (state) => ({
        user: state.user,
        isAuthenticated: state.isAuthenticated,
        home: state.home,
        homes: state.homes,
        activeHomeId: state.activeHomeId,
        equipment: state.equipment,
        consumables: state.consumables,
        tasks: state.tasks,
        maintenanceLogs: state.maintenanceLogs,
        weather: state.weather,
        agent: state.agent,
        onboardingStep: state.onboardingStep,
      }),
    }
  )
);
