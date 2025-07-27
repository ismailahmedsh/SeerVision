import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { getSettings, updateSettings } from '@/api/settings'

interface SettingsData {
  profile: {
    name: string
    email: string
    timezone: string
  }
  notifications: {
    emailAlerts: boolean
    pushNotifications: boolean
    analysisUpdates: boolean
    systemMaintenance: boolean
  }
  analysis: {
    defaultInterval: number
    confidenceThreshold: number
    maxHistoryDays: number
    autoArchive: boolean
  }
  display: {
    theme: string
    language: string
    dateFormat: string
  }
}

interface SettingsContextType {
  settings: SettingsData | null
  updateSetting: (section: keyof SettingsData, key: string, value: any) => void
  saveSettings: () => Promise<void>
  refreshSettings: () => Promise<void>
  loading: boolean
}

const SettingsContext = createContext<SettingsContextType | undefined>(undefined)

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<SettingsData | null>(null)
  const [loading, setLoading] = useState(true)

  const loadSettings = async () => {
    try {
      setLoading(true)
      const response = await getSettings()
      setSettings(response.settings)
    } catch (error) {
      console.error("Error loading settings:", error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadSettings()
  }, [])

  const updateSetting = (section: keyof SettingsData, key: string, value: any) => {
    if (!settings) return
    setSettings({
      ...settings,
      [section]: {
        ...settings[section],
        [key]: value
      }
    })
  }

  const saveSettings = async () => {
    if (!settings) return
    try {
      await updateSettings(settings)
    } catch (error) {
      console.error("Error saving settings:", error)
      throw error
    }
  }

  const refreshSettings = async () => {
    await loadSettings()
  }

  return (
    <SettingsContext.Provider value={{
      settings,
      updateSetting,
      saveSettings,
      refreshSettings,
      loading
    }}>
      {children}
    </SettingsContext.Provider>
  )
}

export function useSettings() {
  const context = useContext(SettingsContext)
  if (context === undefined) {
    throw new Error('useSettings must be used within a SettingsProvider')
  }
  return context
}