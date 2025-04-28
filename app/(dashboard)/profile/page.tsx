"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { supabase } from "@/lib/supabase"
import { FileText, User, LogOut } from "lucide-react"

export default function ProfilePage() {
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [name, setName] = useState("")
  const [isEditing, setIsEditing] = useState(false)
  const [stats, setStats] = useState({
    totalDocuments: 0,
    classifiedDocuments: 0,
    pendingDocuments: 0
  })

  useEffect(() => {
    const fetchUserData = async () => {
      try {
        const { data: { user }, error: userError } = await supabase.auth.getUser()
        if (userError) throw userError
        if (!user) throw new Error('Not authenticated')

        setUser(user)
        setName(user.user_metadata?.name || '')

        // Fetch document statistics
        const { data: documents, error: docError } = await supabase
          .from('documents')
          .select('status')
          .eq('user_id', user.id)

        if (docError) throw docError

        const stats = {
          totalDocuments: documents.length,
          classifiedDocuments: documents.filter(doc => doc.status === 'classified').length,
          pendingDocuments: documents.filter(doc => doc.status === 'pending_review').length
        }

        setStats(stats)
      } catch (error: any) {
        console.error("Error fetching user data:", error)
        setError(error.message)
      } finally {
        setLoading(false)
      }
    }

    fetchUserData()
  }, [])

  const handleUpdateProfile = async () => {
    try {
      const { error } = await supabase.auth.updateUser({
        data: { name }
      })

      if (error) throw error

      setIsEditing(false)
      setUser(prev => ({
        ...prev,
        user_metadata: { ...prev.user_metadata, name }
      }))
    } catch (error: any) {
      console.error("Error updating profile:", error)
      setError(error.message)
    }
  }

  const handleLogout = async () => {
    try {
      const { error } = await supabase.auth.signOut()
      if (error) throw error
      router.push('/login')
    } catch (error: any) {
      console.error("Error logging out:", error)
      setError(error.message)
    }
  }

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-center">
          <div className="mb-4 h-12 w-12 animate-spin rounded-full border-4 border-gray-200 border-t-black mx-auto"></div>
          <p>Loading profile...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto p-6">
      <h1 className="mb-6 text-3xl font-bold">Profile</h1>

      {error && (
        <Alert variant="destructive" className="mb-6">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Personal Information</CardTitle>
            <CardDescription>Update your profile information</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" value={user?.email} readOnly />
            </div>
            <div className="space-y-2">
              <Label htmlFor="name">Name</Label>
              {isEditing ? (
                <div className="flex gap-2">
                  <Input
                    id="name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                  <Button onClick={handleUpdateProfile}>Save</Button>
                  <Button variant="outline" onClick={() => setIsEditing(false)}>
                    Cancel
                  </Button>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <Input id="name" value={name} readOnly />
                  <Button variant="outline" onClick={() => setIsEditing(true)}>
                    Edit
                  </Button>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Document Statistics</CardTitle>
            <CardDescription>Overview of your documents</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4">
              <div className="flex items-center justify-between rounded-lg border p-4">
                <div className="flex items-center gap-2">
                  <FileText className="h-5 w-5 text-gray-500" />
                  <div>
                    <p className="font-medium">Total Documents</p>
                    <p className="text-sm text-gray-500">All your documents</p>
                  </div>
                </div>
                <p className="text-2xl font-bold">{stats.totalDocuments}</p>
              </div>
              <div className="flex items-center justify-between rounded-lg border p-4">
                <div className="flex items-center gap-2">
                  <FileText className="h-5 w-5 text-green-500" />
                  <div>
                    <p className="font-medium">Classified</p>
                    <p className="text-sm text-gray-500">Successfully classified</p>
                  </div>
                </div>
                <p className="text-2xl font-bold">{stats.classifiedDocuments}</p>
              </div>
              <div className="flex items-center justify-between rounded-lg border p-4">
                <div className="flex items-center gap-2">
                  <FileText className="h-5 w-5 text-yellow-500" />
                  <div>
                    <p className="font-medium">Pending Review</p>
                    <p className="text-sm text-gray-500">Awaiting classification</p>
                  </div>
                </div>
                <p className="text-2xl font-bold">{stats.pendingDocuments}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="mt-6">
        <Button variant="destructive" onClick={handleLogout}>
          <LogOut className="mr-2 h-4 w-4" />
          Log out
        </Button>
      </div>
    </div>
  )
} 