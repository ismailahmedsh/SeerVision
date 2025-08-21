import { useState, useEffect } from "react"
import { Settings as SettingsIcon, User, Database, Shield, Trash2 } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { useToast } from "@/hooks/useToast"
import { useSettings } from "@/contexts/SettingsContext"
import { useAuth } from "@/contexts/AuthContext"
import { updateSettings } from "@/api/settings"

export function Settings() {
  const [saving, setSaving] = useState(false)
  const [changingPassword, setChangingPassword] = useState(false)
  const [showResetConfirm, setShowResetConfirm] = useState(false)
  const [resettingData, setResettingData] = useState(false)
  const [passwordData, setPasswordData] = useState({
    oldPassword: '',
    newPassword: '',
    confirmPassword: ''
  })
  const [originalSettings, setOriginalSettings] = useState(null)
  const { toast } = useToast()
  const { settings, updateSetting, saveSettings, refreshSettings, loading } = useSettings()
  const { isAuthenticated, user, updateUser } = useAuth()

  useEffect(() => {
    if (settings && !originalSettings) {
      setOriginalSettings({
        profile: { name: settings.profile?.name || "" },
        analysis: { defaultInterval: settings.analysis?.defaultInterval || 10 }
      })
    }
  }, [settings, originalSettings])

  const hasChanges = settings && originalSettings && (
    settings.profile?.name !== originalSettings.profile?.name ||
    settings.analysis?.defaultInterval !== originalSettings.analysis?.defaultInterval
  )
  

  const handleSaveSettings = async () => {
    try {
      setSaving(true)
      
      if (!settings) {
        throw new Error("Settings not loaded yet")
      }
      const settingsToSave = {
        profile: {
          name: settings.profile?.name || ""
        },
        analysis: {
          defaultInterval: settings.analysis?.defaultInterval || 10
        }
      }
      try {
        const result = await updateSettings(settingsToSave)
        
        if (settingsToSave.profile?.name && result.success) {
          updateUser({ name: settingsToSave.profile.name })
        }
      } catch (updateError) {
        throw new Error(`Failed to update settings: ${updateError.message}`)
      }
      try {
        await refreshSettings()
      } catch (refreshError) {
        // Silent refresh failure
      }
      
      setOriginalSettings({
        profile: { name: settingsToSave.profile?.name || "" },
        analysis: { defaultInterval: settingsToSave.analysis?.defaultInterval || 10 }
      })
      
      toast({
        title: "Success",
        description: "Settings saved successfully",
      })
    } catch (error) {
      toast({
        title: "Error",
        description: `Failed to save settings: ${error.message}`,
        variant: "destructive",
      })
    } finally {
      setSaving(false)
    }
  }

  const handleChangePassword = async () => {
    if (passwordData.newPassword !== passwordData.confirmPassword) {
      toast({
        title: "Error",
        description: "New passwords do not match",
        variant: "destructive",
      })
      return
    }

    try {
      setChangingPassword(true)


      toast({
        title: "Success",
        description: "Password changed successfully",
      })

      setPasswordData({
        oldPassword: '',
        newPassword: '',
        confirmPassword: ''
      })
      setChangingPassword(false)
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to change password",
        variant: "destructive",
      })
    } finally {
      setChangingPassword(false)
    }
  }

  const handleResetAnalyticsData = async () => {
    try {
      setResettingData(true)


      toast({
        title: "Success",
        description: "All analytics data has been reset successfully",
      })
      
      setShowResetConfirm(false)
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to reset analytics data",
        variant: "destructive",
      })
    } finally {
      setResettingData(false)
    }
  }

  if (loading) {
    return (
      <div className="space-y-6 p-4 lg:p-6">
        <div className="animate-pulse">
          <div className="h-8 bg-slate-200 dark:bg-slate-700 rounded w-1/3 mb-2"></div>
          <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-1/2"></div>
        </div>
        <div className="h-96 bg-slate-200 dark:bg-slate-700 rounded animate-pulse"></div>
</div>
    )
  }

  return (
    <div className="space-y-6 p-4 lg:p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold bg-gradient-to-r from-slate-900 to-slate-600 dark:from-white dark:to-slate-300 bg-clip-text text-transparent">
            Settings
          </h1>
          <p className="text-slate-600 dark:text-slate-400 mt-2">
            Manage your account and application preferences
          </p>
        </div>
                 <Button
           onClick={handleSaveSettings}
           disabled={saving || !settings || !hasChanges}
           className="bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white"
         >
           {saving ? "Saving..." : "Save Changes"}
         </Button>
      </div>

      <Tabs defaultValue="profile" className="space-y-6">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="profile">Profile</TabsTrigger>
          <TabsTrigger value="analysis">Analysis</TabsTrigger>
        </TabsList>

                 <TabsContent value="profile" className="space-y-6">
           <Card className="bg-white/60 dark:bg-slate-800/60 backdrop-blur-sm border-slate-200 dark:border-slate-700">
             <CardHeader>
               <CardTitle className="flex items-center gap-2">
                 <User className="h-5 w-5 text-blue-600" />
                 Profile Information
               </CardTitle>
             </CardHeader>
             <CardContent className="space-y-4">
               <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                 <div className="space-y-2">
                   <Label htmlFor="name">Full Name</Label>
                   <Input
                     id="name"
                     value={settings?.profile.name || ""}
                     onChange={(e) => updateSetting('profile', 'name', e.target.value)}
                   />
                 </div>
                 <div className="space-y-2">
                   <Label htmlFor="email">Email Address</Label>
                   <Input
                     id="email"
                     type="email"
                     value={user?.email || ""}
                     disabled
                     className="bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 cursor-not-allowed"
                   />
                   <p className="text-xs text-gray-500 dark:text-gray-400">
                     Email cannot be changed after account creation
                   </p>
                 </div>
               </div>
             </CardContent>
           </Card>

           <Card className="bg-white/60 dark:bg-slate-800/60 backdrop-blur-sm border-slate-200 dark:border-slate-700">
             <CardHeader>
               <CardTitle className="flex items-center gap-2">
                 <Shield className="h-5 w-5 text-red-600" />
                 Change Password
               </CardTitle>
             </CardHeader>
             <CardContent className="space-y-4">
               <div className="space-y-2">
                 <Label htmlFor="oldPassword">Current Password</Label>
                 <Input
                   id="oldPassword"
                   type="password"
                   value={passwordData.oldPassword}
                   onChange={(e) => setPasswordData(prev => ({ ...prev, oldPassword: e.target.value }))}
                   placeholder="Enter your current password"
                 />
               </div>
               <div className="space-y-2">
                 <Label htmlFor="newPassword">New Password</Label>
                 <Input
                   id="newPassword"
                   type="password"
                   value={passwordData.newPassword}
                   onChange={(e) => setPasswordData(prev => ({ ...prev, newPassword: e.target.value }))}
                   placeholder="Enter your new password"
                 />
               </div>
               <div className="space-y-2">
                 <Label htmlFor="confirmPassword">Confirm New Password</Label>
                 <Input
                   id="confirmPassword"
                   type="password"
                   value={passwordData.confirmPassword}
                   onChange={(e) => setPasswordData(prev => ({ ...prev, confirmPassword: e.target.value }))}
                   placeholder="Confirm your new password"
                 />
               </div>
               <Button
                 onClick={handleChangePassword}
                 disabled={changingPassword || !passwordData.oldPassword || !passwordData.newPassword || !passwordData.confirmPassword}
                 className="w-full bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white"
               >
                 {changingPassword ? "Changing Password..." : "Change Password"}
               </Button>
             </CardContent>
           </Card>
         </TabsContent>

         <TabsContent value="analysis" className="space-y-6">
           <Card className="bg-white/60 dark:bg-slate-800/60 backdrop-blur-sm border-slate-200 dark:border-slate-700">
             <CardHeader>
               <CardTitle className="flex items-center gap-2">
                 <Database className="h-5 w-5 text-purple-600" />
                 Analysis Settings
               </CardTitle>
             </CardHeader>
             <CardContent className="space-y-6">
               <div className="space-y-2">
                 <Label htmlFor="interval">Default Update Interval (seconds)</Label>
                  <Input
                    id="interval"
                    type="number"
                    min="10"
                    max="120"
                    value={settings?.analysis.defaultInterval || 10}
                    onChange={(e) => updateSetting('analysis', 'defaultInterval', parseInt(e.target.value))}
                  />
                  <p className="text-xs text-slate-600 dark:text-slate-400">
                    How often to update analysis data (10-120 seconds)
                  </p>
               </div>
             </CardContent>
           </Card>

           <Card className="bg-white/60 dark:bg-slate-800/60 backdrop-blur-sm border-slate-200 dark:border-slate-700">
             <CardHeader>
               <CardTitle className="flex items-center gap-2">
                 <Trash2 className="h-5 w-5 text-red-600" />
                 Data Management
               </CardTitle>
             </CardHeader>
             <CardContent className="space-y-4">
               <div className="space-y-2">
                 <Label>Reset Analytics Data</Label>
                 <p className="text-sm text-slate-600 dark:text-slate-400">
                   This will permanently delete all analytics data including detections, confidence scores, and timeseries data. 
                   All widgets will be reset to empty state. This action cannot be undone.
                 </p>
                 <Button
                   onClick={() => setShowResetConfirm(true)}
                   variant="destructive"
                   className="w-full"
                 >
                   <Trash2 className="mr-2 h-4 w-4" />
                   Reset All Analytics Data
                 </Button>
               </div>
             </CardContent>
           </Card>
         </TabsContent>
       </Tabs>


       <AlertDialog open={showResetConfirm} onOpenChange={setShowResetConfirm}>
         <AlertDialogContent>
           <AlertDialogHeader>
             <AlertDialogTitle>Reset Analytics Data</AlertDialogTitle>
             <AlertDialogDescription>
               This action will permanently delete ALL analytics data including:
               <br />• Detection counts and statistics
               <br />• Confidence scores and metrics
               <br />• Timeseries data for charts
               <br />• All widget data will be reset to empty
               <br /><br />
               <strong>This action cannot be undone.</strong> Are you sure you want to continue?
             </AlertDialogDescription>
           </AlertDialogHeader>
           <AlertDialogFooter>
             <AlertDialogCancel>Cancel</AlertDialogCancel>
             <AlertDialogAction
               onClick={handleResetAnalyticsData}
               disabled={resettingData}
               className="bg-red-600 hover:bg-red-700 focus:ring-red-600"
             >
               {resettingData ? "Resetting..." : "Yes, Reset All Data"}
             </AlertDialogAction>
           </AlertDialogFooter>
         </AlertDialogContent>
       </AlertDialog>
     </div>
   )
 }