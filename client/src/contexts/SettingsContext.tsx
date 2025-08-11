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
      const response = await getSettings()
      if (response && typeof response === 'object' && 'success' in response && response.success && 'settings' in response && response.settings) {
        const settingsData = response.settings as SettingsData
        let adjustedInterval = settingsData.analysis?.defaultInterval || 30
        if (adjustedInterval < 6) {
          adjustedInterval = 6
        }
        setSettings(settingsData)
      }
    } catch (error) {
      console.error('Failed to load settings:', error)
    }
  }

  useEffect(() => {
    loadSettings()
  }, [])

  const updateSetting = (section: keyof SettingsData, key: string, value: any) => {
    if (!settings) return
    
    // Enforce minimum analysis interval
    if (section === 'analysis' && key === 'defaultInterval' && value < 6) {
      value = 6
    }
    
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

  const updateAnalysisInterval = async (value: number) => {
    try {
      const enforcedValue = Math.max(6, value)
      const response = await updateSettings({
        analysis: {
          ...settings?.analysis,
          defaultInterval: enforcedValue
        }
      })
      
      if (response && typeof response === 'object' && 'success' in response && response.success) {
        setSettings(prev => {
          if (!prev) return prev
          return {
            ...prev,
            analysis: {
              ...prev.analysis,
              defaultInterval: enforcedValue
            }
          }
        })
      }
    } catch (error) {
      console.error('Failed to update analysis interval:', error)
    }
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