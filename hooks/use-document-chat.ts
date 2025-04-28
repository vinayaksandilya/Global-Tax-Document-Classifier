import { useState, useCallback, useRef, useEffect } from 'react'
import { supabase } from '@/lib/supabase'

interface ChatMessage {
  id: string
  document_id: string
  user_id: string
  message: string
  is_user: boolean
  created_at: string
  document_context?: {
    url: string
    type: string
    name: string
  }
}

// Cache for chat history
const chatHistoryCache = new Map<string, {
  messages: any[];
  timestamp: number;
}>();

// Cache expiration time (1 minute)
const CACHE_EXPIRATION = 60 * 1000;

export function useDocumentChat() {
  const [isSending, setIsSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const lastFetchRef = useRef<string | null>(null)
  const [messages, setMessages] = useState<any[]>([])

  const getChatHistory = useCallback(async (documentId: string) => {
    // Check if we're already fetching this document's chat history
    if (lastFetchRef.current === documentId) {
      return messages
    }

    // Check cache first
    const cachedHistory = chatHistoryCache.get(documentId)
    if (cachedHistory && Date.now() - cachedHistory.timestamp < CACHE_EXPIRATION) {
      setMessages(cachedHistory.messages)
      return cachedHistory.messages
    }

    lastFetchRef.current = documentId

    try {
      const { data, error } = await supabase
        .from('document_chat')
        .select('*')
        .eq('document_id', documentId)
        .order('created_at', { ascending: true })

      if (error) throw error

      // Update cache
      chatHistoryCache.set(documentId, {
        messages: data,
        timestamp: Date.now()
      })

      setMessages(data)
      return data
    } catch (err: any) {
      console.error('Error fetching chat history:', err)
      setError(err.message)
      return []
    } finally {
      lastFetchRef.current = null
    }
  }, [messages])

  const sendMessage = useCallback(async (
    documentId: string,
    message: string,
    documentContext: {
      url: string;
      type: string;
      name: string;
    }
  ) => {
    setIsSending(true)
    setError(null)

    try {
      // Get the OpenRouter API key from environment variables
      const apiKey = process.env.NEXT_PUBLIC_OPENROUTER_API_KEY
      if (!apiKey) {
        throw new Error('OpenRouter API key not configured')
      }

      // Get current user
      const { data: { user }, error: userError } = await supabase.auth.getUser()
      if (userError || !user) throw new Error('Not authenticated')

      // Get the file content as base64
      const fileResponse = await fetch(documentContext.url)
      if (!fileResponse.ok) {
        throw new Error('File not accessible')
      }
      const fileBlob = await fileResponse.blob()
      const reader = new FileReader()
      const base64Promise = new Promise<string>((resolve, reject) => {
        reader.onload = () => resolve(reader.result as string)
        reader.onerror = reject
      })
      reader.readAsDataURL(fileBlob)
      const base64Content = await base64Promise

      // Determine if the file is a PDF or image
      const isPDF = documentContext.type?.includes('pdf')
      const isImage = /\.(jpg|jpeg|png|gif|webp)$/i.test(documentContext.name)

      const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': window.location.origin,
          'X-Title': 'Document Chat'
        },
        body: JSON.stringify({
          model: 'meta-llama/llama-3.2-11b-vision-instruct',
          messages: [
            {
              role: 'system',
              content: `You are a helpful assistant analyzing a document. Please help the user with their question about this document.`
            },
            {
              role: 'user',
              content: isPDF ? [
                {
                  type: 'text',
                  text: `Here is the document and my question: ${message}`
                },
                {
                  type: 'file',
                  file: {
                    filename: documentContext.name,
                    file_data: base64Content
                  }
                }
              ] : [
                {
                  type: 'text',
                  text: `Here is the document and my question: ${message}`
                },
                {
                  type: 'image_url',
                  image_url: {
                    url: documentContext.url
                  }
                }
              ]
            }
          ],
          temperature: 0.7,
          max_tokens: 1000,
          plugins: isPDF ? [
            {
              id: 'file-parser',
              pdf: {
                engine: 'mistral-ocr',
                extract_text: true,
                extract_tables: true
              }
            }
          ] : undefined
        })
      })

      if (!response.ok) {
        throw new Error('Failed to get response from AI')
      }

      const data = await response.json()
      const aiResponse = data.choices[0].message.content

      // Store the messages in the database
      const { data: userMessage, error: userMessageError } = await supabase
        .from('document_chat')
        .insert({
          document_id: documentId,
          user_id: user.id,
          message: message,
          is_user: true
        })
        .select()
        .single()

      if (userMessageError) throw userMessageError

      const { data: aiMessage, error: aiMessageError } = await supabase
        .from('document_chat')
        .insert({
          document_id: documentId,
          user_id: user.id,
          message: aiResponse,
          is_user: false
        })
        .select()
        .single()

      if (aiMessageError) throw aiMessageError

      // Update cache
      const newMessages = [...messages, userMessage, aiMessage]
      chatHistoryCache.set(documentId, {
        messages: newMessages,
        timestamp: Date.now()
      })

      setMessages(newMessages)
      return [userMessage, aiMessage]
    } catch (err: any) {
      console.error('Error sending message:', err)
      setError(err.message)
      throw err
    } finally {
      setIsSending(false)
    }
  }, [messages])

  // Clear cache for a specific document
  const clearCache = useCallback((documentId: string) => {
    chatHistoryCache.delete(documentId)
  }, [])

  // Clear entire cache
  const clearAllCache = useCallback(() => {
    chatHistoryCache.clear()
  }, [])

  return {
    sendMessage,
    getChatHistory,
    isSending,
    error,
    messages,
    clearCache,
    clearAllCache
  }
} 