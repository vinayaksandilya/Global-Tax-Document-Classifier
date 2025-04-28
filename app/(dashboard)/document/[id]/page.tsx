"use client"

import { useState, useEffect } from "react"
import { useParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { FileText, Share2, Tag, Clock, User, Bot, Send, Download } from "lucide-react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Separator } from "@/components/ui/separator"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { documentSchema } from "@/lib/document-schema"
import { supabase } from "@/lib/supabase"
import { Document } from "@/lib/document-schema"
import { useDocumentClassifier } from "@/hooks/use-document-classifier"
import { useDocumentChat } from '@/hooks/use-document-chat'

export default function DocumentPage() {
  const params = useParams()
  const documentId = params.id as string
  const { classifyDocument, isClassifying } = useDocumentClassifier()
  const { sendMessage, getChatHistory, isSending, error: chatError } = useDocumentChat()

  const [document, setDocument] = useState<Document | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [newTag, setNewTag] = useState("")
  const [newComment, setNewComment] = useState("")
  const [isUpdating, setIsUpdating] = useState(false)
  const [newMessage, setNewMessage] = useState("")
  const [chatMessages, setChatMessages] = useState<any[]>([])
  const [classificationStatus, setClassificationStatus] = useState<string | null>(null)

  useEffect(() => {
    const fetchDocument = async () => {
      setLoading(true)
      setError(null)
      try {
        // Get current user
        const { data: { user }, error: userError } = await supabase.auth.getUser()
        if (userError || !user) throw new Error('Not authenticated')

        // Fetch document with tags
        const { data: doc, error: docError } = await supabase
          .from('documents')
          .select(`
            *,
            document_tags (
              tag
            )
          `)
          .eq('id', documentId)
          .single()

        if (docError) throw docError
        if (!doc) throw new Error('Document not found')

        // Check if user has access to the document
        const { data: share, error: shareError } = await supabase
          .from('document_shares')
          .select('*')
          .eq('document_id', documentId)
          .eq('shared_with', user.id)
          .single()

        if (doc.user_id !== user.id && !share) {
          throw new Error('You do not have access to this document')
        }

        // Transform document tags into the expected format
        const transformedDoc = {
          ...doc,
          tags: doc.document_tags?.map((t: any) => t.tag) || []
        }

        setDocument(transformedDoc)
      } catch (error: any) {
        console.error("Error fetching document:", error)
        setError(error.message)
      } finally {
        setLoading(false)
      }
    }

    fetchDocument()
  }, [documentId])

  // Fetch chat messages
  useEffect(() => {
    const fetchChatMessages = async () => {
      if (!document) return
      const messages = await getChatHistory(document.id)
      setChatMessages(messages)
    }

    fetchChatMessages()
  }, [document, getChatHistory])

  const handleAddTag = async () => {
    if (!newTag.trim() || !document) return

    try {
      const { error } = await supabase
        .from('document_tags')
        .insert({
          document_id: document.id,
          tag: newTag.trim()
        })

      if (error) throw error

      // Log activity
      await supabase
        .from('document_activities')
        .insert({
          document_id: document.id,
          user_id: document.user_id,
          activity_type: 'add_tag',
          activity_details: { tag: newTag.trim() }
        })

      setDocument({
        ...document,
        tags: [...(document.tags || []), newTag.trim()]
      })
      setNewTag("")
    } catch (error: any) {
      console.error("Error adding tag:", error)
    }
  }

  const handleRemoveTag = async (tagToRemove: string) => {
    if (!document) return

    try {
      const { error } = await supabase
        .from('document_tags')
        .delete()
        .eq('document_id', document.id)
        .eq('tag', tagToRemove)

      if (error) throw error

      // Log activity
      await supabase
        .from('document_activities')
        .insert({
          document_id: document.id,
          user_id: document.user_id,
          activity_type: 'remove_tag',
          activity_details: { tag: tagToRemove }
        })

      setDocument({
        ...document,
        tags: document.tags.filter(tag => tag !== tagToRemove)
      })
    } catch (error: any) {
      console.error("Error removing tag:", error)
    }
  }

  const handleAddComment = async () => {
    if (!newComment.trim() || !document) return

    try {
      const { data: { user }, error: userError } = await supabase.auth.getUser()
      if (userError || !user) throw new Error('Not authenticated')

      const { data: comment, error: commentError } = await supabase
        .from('document_comments')
        .insert({
          document_id: document.id,
          user_id: user.id,
          comment: newComment.trim()
        })
        .select()
        .single()

      if (commentError) throw commentError

      // Log activity
      await supabase
        .from('document_activities')
        .insert({
          document_id: document.id,
          user_id: user.id,
          activity_type: 'add_comment',
          activity_details: { comment: newComment.trim() }
        })

      setDocument({
        ...document,
        comments: [...(document.comments || []), comment]
      })
      setNewComment("")
    } catch (error: any) {
      console.error("Error adding comment:", error)
    }
  }

  const handleUpdateClassification = async () => {
    if (!document) return

    setIsUpdating(true)
    setClassificationStatus('Classifying document...')
    try {
      // Classify the document
      const classificationResult = await classifyDocument(document.public_url)

      // Update document in database
      const { error } = await supabase
        .from('documents')
        .update({
          document_type: classificationResult.document_type,
          country_of_origin: classificationResult.country,
          document_category: classificationResult.document_category,
          document_subtype: classificationResult.document_subtype,
          status: classificationResult.status,
          metadata: {
            ...document.metadata,
            confidence_score: classificationResult.confidence_score,
            classification_timestamp: new Date().toISOString()
          }
        })
        .eq('id', document.id)

      if (error) throw error

      // Log activity
      await supabase
        .from('document_activities')
        .insert({
          document_id: document.id,
          user_id: document.user_id,
          activity_type: 'reclassify',
          activity_details: { 
            previous_type: document.document_type,
            new_type: classificationResult.document_type,
            previous_country: document.country_of_origin,
            new_country: classificationResult.country,
            previous_category: document.document_category,
            new_category: classificationResult.document_category,
            previous_subtype: document.document_subtype,
            new_subtype: classificationResult.document_subtype,
            confidence_score: classificationResult.confidence_score
          }
        })

      // Update local state
      setDocument({
        ...document,
        document_type: classificationResult.document_type,
        country_of_origin: classificationResult.country,
        document_category: classificationResult.document_category,
        document_subtype: classificationResult.document_subtype,
        status: classificationResult.status,
        metadata: {
          ...document.metadata,
          confidence_score: classificationResult.confidence_score,
          classification_timestamp: new Date().toISOString()
        }
      })

      setClassificationStatus('Document classified successfully!')
      setTimeout(() => setClassificationStatus(null), 3000)
    } catch (error: any) {
      console.error("Error updating classification:", error)
      setClassificationStatus('Error classifying document: ' + error.message)
      setTimeout(() => setClassificationStatus(null), 5000)
    } finally {
      setIsUpdating(false)
    }
  }

  const handleCountryChange = (country: string) => {
    setDocument({
      ...document,
      country_of_origin: country
    })
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleString()
  }

  const getRandomPainting = () => {
    const paintings = [
      "/swirling-night-landscape.png",
      "/enigmatic-portrait.png",
      "/melting-time.png",
      "/anguished-face.png",
      "/enigmatic-gaze.png",
    ]
    return paintings[Math.floor(Math.random() * paintings.length)]
  }

  const getRandomQuote = () => {
    const quotes = [
      "The best way to predict the future is to create it.",
      "Simplicity is the ultimate sophistication.",
      "Innovation distinguishes between a leader and a follower.",
      "The only way to do great work is to love what you do.",
      "Creativity is intelligence having fun.",
    ]
    return quotes[Math.floor(Math.random() * quotes.length)]
  }

  const handleSaveEdits = async () => {
    if (!document) return

    try {
      const oldData = {
        companyName: document.metadata?.companyName,
        employeeName: document.metadata?.employeeName,
        documentPurpose: document.metadata?.documentPurpose
      }

      const newData = {
        companyName: document.metadata?.companyName || "",
        employeeName: document.metadata?.employeeName || "",
        documentPurpose: document.metadata?.documentPurpose || ""
      }

      // Update document in database
      const { error } = await supabase
        .from('documents')
        .update({
          metadata: {
            ...document.metadata,
            ...newData
          }
        })
        .eq('id', document.id)

      if (error) throw error

      // Log activity
      await supabase
        .from('document_activities')
        .insert({
          document_id: document.id,
          user_id: document.user_id,
          activity_type: 'edit_details',
          activity_details: {
            old_data: oldData,
            new_data: newData
          }
        })

      setDocument({
        ...document,
        metadata: {
          ...document.metadata,
          ...newData
        }
      })
    } catch (error: any) {
      console.error("Error saving edits:", error)
      setError(error.message)
    }
  }

  const handleSendMessage = async () => {
    if (!newMessage.trim() || !document) return

    try {
      const messages = await sendMessage(document.id, newMessage, {
        url: document.public_url,
        type: document.file_type,
        name: document.file_name
      })

      setChatMessages(prev => [...prev, ...messages])
      setNewMessage("")
    } catch (error: any) {
      console.error("Error sending message:", error)
      setError(error.message)
    }
  }

  const handleUpdateStatus = async (newStatus: 'pending' | 'classified' | 'pending_review' | 'non_classified' | 'failed') => {
    if (!document) return

    try {
      // Update document in database
      const { error } = await supabase
        .from('documents')
        .update({
          status: newStatus,
          metadata: {
            ...document.metadata,
            status: newStatus,
            status_changed_at: new Date().toISOString(),
            status_changed_by: document.user_id
          }
        })
        .eq('id', document.id)

      if (error) throw error

      // Log activity
      await supabase
        .from('document_activities')
        .insert({
          document_id: document.id,
          user_id: document.user_id,
          activity_type: 'status_change',
          activity_details: {
            old_status: document.status,
            new_status: newStatus
          }
        })

      // Update local state
      setDocument({
        ...document,
        status: newStatus,
        metadata: {
          ...document.metadata,
          status: newStatus,
          status_changed_at: new Date().toISOString(),
          status_changed_by: document.user_id
        }
      })
    } catch (error: any) {
      console.error("Error updating status:", error)
      setError(error.message)
    }
  }

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-center">
          <div className="mb-4 h-12 w-12 animate-spin rounded-full border-4 border-gray-200 border-t-black mx-auto"></div>
          <p>Loading document...</p>
        </div>
      </div>
    )
  }

  if (!document) {
    return (
      <div className="container mx-auto p-6">
        <Alert>
          <AlertDescription>Document not found</AlertDescription>
        </Alert>
      </div>
    )
  }

  return (
    <div className="flex h-[calc(100vh-4rem)] overflow-hidden">
      {/* Left column - Document preview */}
      <div className="w-1/2 border-r border-gray-200 overflow-auto">
        {document.public_url ? (
          <div className="h-full flex items-center justify-center bg-gray-100">
            {document.file_type?.includes('pdf') ? (
              <iframe
                src={document.public_url}
                className="w-full h-full"
                title="Document preview"
              />
            ) : (
              <img
                src={document.public_url}
                alt="Document preview"
                className="max-w-full max-h-full object-contain"
              />
            )}
          </div>
        ) : (
          <div className="h-full flex flex-col items-center justify-center bg-gray-100 p-6 text-center">
            <div className="text-gray-500">
              <FileText className="h-16 w-16 mx-auto mb-4" />
              <p className="text-lg">No preview available</p>
              <p className="text-sm mt-2">This document type cannot be previewed</p>
            </div>
          </div>
        )}
      </div>

      {/* Right column - Document details */}
      <div className="w-1/2 overflow-auto">
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h1 className="text-2xl font-bold line-clamp-1" title={document.file_name}>
              {document.file_name}
            </h1>
            <div className="flex gap-2">
              <Button 
                variant="outline" 
                size="sm"
                onClick={handleUpdateClassification}
                disabled={isUpdating}
              >
                {isUpdating ? (
                  <>
                    <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-gray-900 border-t-transparent" />
                    Classifying...
                  </>
                ) : (
                  <>
                    <FileText className="mr-2 h-4 w-4" />
                    Classify
                  </>
                )}
              </Button>
              <Button variant="outline" size="sm">
                <Download className="mr-2 h-4 w-4" />
                Download
              </Button>
            </div>
          </div>

          <div className="mb-6">
            <div className="flex items-center gap-2">
              <Badge
                className={
                  document.status === "classified"
                    ? "bg-green-100 text-green-800"
                    : document.status === "pending_review"
                      ? "bg-yellow-100 text-yellow-800"
                      : "bg-red-100 text-red-800"
                }
              >
                {document.status}
              </Badge>
              <Select
                value={document.status}
                onValueChange={handleUpdateStatus}
              >
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Change status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="classified">Classified</SelectItem>
                  <SelectItem value="pending_review">Pending Review</SelectItem>
                  <SelectItem value="non_classified">Non Classified</SelectItem>
                </SelectContent>
              </Select>
              {document.metadata?.confidence_score && (
                <span className="ml-2 text-sm text-gray-500">
                  AI Confidence: {(document.metadata.confidence_score * 100).toFixed(0)}%
                </span>
              )}
            </div>
          </div>

          {/* Classification Details */}
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>Classification Details</CardTitle>
              <CardDescription>Document classification information</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-500">Country</label>
                  <p className="font-medium">{document.country_of_origin || 'Not classified'}</p>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-500">Document Type</label>
                  <p className="font-medium">{document.document_type || 'Not classified'}</p>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-500">Category</label>
                  <p className="font-medium">{document.document_category || 'Not classified'}</p>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-500">Subtype</label>
                  <p className="font-medium">{document.document_subtype || 'Not specified'}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Tabs defaultValue="chat">
            <TabsList className="w-full">
              <TabsTrigger value="chat" className="flex-1">
                Chat with Document
              </TabsTrigger>
              <TabsTrigger value="comments" className="flex-1">
                Comments
              </TabsTrigger>
            </TabsList>

            <TabsContent value="chat" className="pt-4">
              <Card>
                <CardHeader>
                  <CardTitle>Chat with Document</CardTitle>
                  <CardDescription>Ask questions about this document</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {/* Chat messages */}
                    <div className="space-y-4 max-h-[400px] overflow-y-auto">
                      {chatMessages.map((message) => (
                        <div
                          key={message.id}
                          className={`flex ${message.is_user ? 'justify-end' : 'justify-start'}`}
                        >
                          <div
                            className={`max-w-[80%] rounded-lg p-3 ${
                              message.is_user
                                ? 'bg-blue-500 text-white'
                                : 'bg-gray-100 text-gray-900'
                            }`}
                          >
                            <p className="text-sm">{message.message}</p>
                            {message.document_context && (
                              <div className="mt-2 text-xs opacity-70">
                                <p>Document: {message.document_context.name}</p>
                                <p>Type: {message.document_context.type}</p>
                              </div>
                            )}
                            <p className="text-xs mt-1 opacity-70">
                              {formatDate(message.created_at)}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Message input */}
                    <div className="flex gap-2">
                      <Textarea
                        placeholder="Ask a question about this document..."
                        value={newMessage}
                        onChange={(e) => setNewMessage(e.target.value)}
                        className="min-h-[80px]"
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault()
                            handleSendMessage()
                          }
                        }}
                      />
                    </div>
                    <div className="flex justify-end">
                      <Button
                        onClick={handleSendMessage}
                        disabled={isSending || !newMessage.trim()}
                      >
                        {isSending ? (
                          <>
                            <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                            Sending...
                          </>
                        ) : (
                          <>
                            <Send className="mr-2 h-4 w-4" />
                            Send
                          </>
                        )}
                      </Button>
                    </div>
                    {chatError && (
                      <p className="text-sm text-red-500">{chatError}</p>
                    )}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="comments" className="pt-4">
              <Card>
                <CardHeader>
                  <CardTitle>Comments</CardTitle>
                  <CardDescription>Discuss this document with your team</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4 mb-4">
                    {document.comments?.map((comment: any) => (
                      <div key={comment.id} className="flex gap-3">
                        <Avatar>
                          <AvatarImage src={comment.user?.avatar || "/placeholder.svg"} alt={comment.user?.email || 'User'} />
                          <AvatarFallback>{(comment.user?.email || 'U').charAt(0).toUpperCase()}</AvatarFallback>
                        </Avatar>
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <p className="font-medium">{comment.user?.email || 'Unknown User'}</p>
                            <p className="text-xs text-gray-500">{formatDate(comment.created_at)}</p>
                          </div>
                          <p className="text-sm mt-1">{comment.comment}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                  <Separator className="my-4" />
                  <div className="flex gap-2">
                    <Textarea
                      placeholder="Add a comment..."
                      value={newComment}
                      onChange={(e) => setNewComment(e.target.value)}
                      className="min-h-[80px]"
                    />
                  </div>
                  <div className="mt-2 flex justify-end">
                    <Button onClick={handleAddComment}>
                      <Send className="mr-2 h-4 w-4" />
                      Send
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  )
}
