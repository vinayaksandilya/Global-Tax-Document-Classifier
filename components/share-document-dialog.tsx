"use client"

import { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Share2 } from "lucide-react"
import { supabase } from '@/lib/supabase'

interface ShareDocumentDialogProps {
  documentId: string;
}

export function ShareDocumentDialog({ documentId }: ShareDocumentDialogProps) {
  const [email, setEmail] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleShare = async () => {
    setIsLoading(true)
    setError(null)

    try {
      // Get user by email
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('id')
        .eq('email', email)
        .single()

      if (userError) throw new Error('User not found')

      // Share document
      const { error: shareError } = await supabase
        .from('document_shares')
        .insert({
          document_id: documentId,
          shared_with: userData.id
        })

      if (shareError) throw shareError

      setEmail('')
    } catch (err: any) {
      setError(err.message)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon">
          <Share2 className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Share Document</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Enter email address"
            />
          </div>
          {error && (
            <p className="text-sm text-red-500">{error}</p>
          )}
          <Button onClick={handleShare} disabled={isLoading}>
            {isLoading ? 'Sharing...' : 'Share'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
} 