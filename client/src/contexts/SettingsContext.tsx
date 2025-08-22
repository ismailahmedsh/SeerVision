import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { getSettings, updateSettings } from '@/api/settings'

interface SettingsData {
  profile: {
    name: string
    email: string
  }
  analysis: {
    defaultInterval: number
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

      
      if (response && typeof response === 'object' && 'settings' in response && response.settings) {
        const settingsData = response.settings as SettingsData
        let adjustedInterval = settingsData.analysis?.defaultInterval || 10
        if (adjustedInterval < 10) {
          adjustedInterval = 10
        }
        if (adjustedInterval > 120) {
          adjustedInterval = 120
        }
        setSettings(settingsData)

      } else if (response && typeof response === 'object' && 'success' in response && response.success && 'settings' in response && response.settings) {
        const settingsData = response.settings as SettingsData
        let adjustedInterval = settingsData.analysis?.defaultInterval || 10
        if (adjustedInterval < 10) {
          adjustedInterval = 10
        }
        if (adjustedInterval > 120) {
          adjustedInterval = 120
        }
        setSettings(settingsData)
      }
    } catch (error: any) {
      // Silent error handling
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadSettings()
    
    const timeout = setTimeout(() => {
      if (loading) {
        setLoading(false)
      }
    }, 5000)
    
    return () => clearTimeout(timeout)
  }, [])

  const updateSetting = (section: keyof SettingsData, key: string, value: any) => {
    if (!settings) return
    
    if (section === 'analysis' && key === 'defaultInterval') {
      if (value < 10) value = 10
      if (value > 120) value = 120
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
    } catch (error: any) {
      throw error
    }
  }

  const refreshSettings = async () => {
    await loadSettings()
  }

  const updateAnalysisInterval = async (value: number) => {
    try {
      const enforcedValue = Math.max(10, Math.min(120, value))
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
    } catch (error: any) {
      // Silent error handling
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