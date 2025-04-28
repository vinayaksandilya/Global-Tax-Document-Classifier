"use client"

import { useState, useCallback } from "react"
import { useDropzone } from "react-dropzone"
import { useRouter } from "next/navigation"
import { Upload, X, FileText } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { supabase } from "@/lib/supabase"
import { useDocumentClassifier } from "@/hooks/use-document-classifier"

interface UploadedFile {
  name: string
  size: number
  type: string
  status: 'uploading' | 'classifying' | 'success' | 'error'
  error?: string
  publicUrl?: string | null
  filePath?: string | null
}

export default function DashboardPage() {
  const router = useRouter()
  const { classifyDocument } = useDocumentClassifier()
  const [files, setFiles] = useState<UploadedFile[]>([])
  const [error, setError] = useState("")

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    setError("")
    
    // Add files to state with uploading status
    const newFiles = acceptedFiles.map(file => ({
      name: file.name,
      size: file.size,
      type: file.type,
      status: 'uploading' as const
    }))
    
    setFiles(prev => [...prev, ...newFiles])

    // Upload each file
    for (let i = 0; i < acceptedFiles.length; i++) {
      const file = acceptedFiles[i]
      try {
        // Get current user
        const { data: { user }, error: userError } = await supabase.auth.getUser()
        if (userError || !user) throw new Error('Not authenticated')

        // Generate a unique file name
        const fileExt = file.name.split('.').pop()
        const fileName = `${Math.random().toString(36).substring(2)}-${Date.now()}.${fileExt}`
        const filePath = `${user.id}/${fileName}`

        // Upload to Supabase Storage
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('docu')
          .upload(filePath, file, {
            cacheControl: '3600',
            upsert: false
          })

        if (uploadError) throw uploadError

        // Get public URL
        const { data: { publicUrl } } = supabase.storage
          .from('docu')
          .getPublicUrl(filePath)

        // Store document metadata in database with pending_review status
        const { data: document, error: dbError } = await supabase
          .from('documents')
          .insert({
            user_id: user.id,
            file_path: filePath,
            file_name: file.name,
            file_type: file.type,
            file_size: file.size,
            public_url: publicUrl,
            status: 'pending_review',
            country_of_origin: null,
            document_type: null,
            document_subtype: null,
            document_category: null,
            extracted_data: null,
            confidence_score: 0
          })
          .select()
          .single()

        if (dbError) throw dbError

        // Log activity
        await supabase
          .from('document_activities')
          .insert({
            document_id: document.id,
            user_id: user.id,
            activity_type: 'upload',
            activity_details: { status: 'pending_review' }
          })

        // Update file status to classifying
        setFiles(prev => prev.map((f, index) => 
          index === i ? { 
            ...f, 
            status: 'classifying', 
            publicUrl,
            filePath
          } : f
        ))

        // Classify the document
        try {
          const classificationResult = await classifyDocument(publicUrl)

          // Update document with classification results
          const { error: updateError } = await supabase
            .from('documents')
            .update({
              document_type: classificationResult.document_type,
              country_of_origin: classificationResult.country,
              document_category: classificationResult.document_category,
              document_subtype: classificationResult.document_subtype,
              status: classificationResult.status,
              metadata: {
                confidence_score: classificationResult.confidence_score,
                classification_timestamp: new Date().toISOString()
              }
            })
            .eq('id', document.id)

          if (updateError) throw updateError

          // Log classification activity
          await supabase
            .from('document_activities')
            .insert({
              document_id: document.id,
              user_id: user.id,
              activity_type: 'classify',
              activity_details: { 
                classification_result: classificationResult
              }
            })

          // Update file status to success
          setFiles(prev => prev.map((f, index) => 
            index === i ? { 
              ...f, 
              status: 'success'
            } : f
          ))
        } catch (classifyError: any) {
          console.error('Classification error:', classifyError)
          // Update file status to error
          setFiles(prev => prev.map((f, index) => 
            index === i ? { 
              ...f, 
              status: 'error', 
              error: classifyError.message 
            } : f
          ))
          setError(classifyError.message)
        }

      } catch (err: any) {
        console.error('Upload error:', err)
        setFiles(prev => prev.map((f, index) => 
          index === i ? { ...f, status: 'error', error: err.message } : f
        ))
        setError(err.message)
      }
    }
  }, [classifyDocument])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf'],
      'application/msword': ['.doc'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
      'image/jpeg': ['.jpg', '.jpeg'],
      'image/png': ['.png']
    }
  })

  const removeFile = (index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index))
  }

  return (
    <div className="container mx-auto p-6">
      <h1 className="mb-6 text-3xl font-bold">Upload Documents</h1>

      {error && (
        <Alert variant="destructive" className="mb-6">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div
        {...getRootProps()}
        className={`flex flex-col items-center justify-center rounded-lg border-2 border-dashed p-12 text-center transition-colors ${
          isDragActive ? "border-black bg-gray-50" : "border-gray-300 hover:border-gray-400"
        }`}
      >
        <input {...getInputProps()} />
        <Upload className="mb-4 h-12 w-12 text-gray-400" />
        <h2 className="mb-2 text-xl font-semibold">Drag & drop files here</h2>
        <p className="mb-4 text-sm text-gray-500">or click to browse your files</p>
        <p className="text-xs text-gray-400">Supports PDF, DOCX, JPG, and PNG files</p>
      </div>

      {files.length > 0 && (
        <div className="mt-6 space-y-4">
          <h2 className="text-lg font-semibold">Uploaded Files</h2>
          <div className="space-y-2">
            {files.map((file, index) => (
              <div
                key={index}
                className="flex items-center justify-between rounded-lg border p-4"
              >
                <div className="flex items-center gap-4">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-100">
                    <FileText className="h-5 w-5 text-gray-500" />
                  </div>
                  <div>
                    <p className="font-medium">{file.name}</p>
                    <p className="text-sm text-gray-500">
                      {(file.size / 1024 / 1024).toFixed(2)} MB
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {file.status === 'uploading' && (
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-gray-200 border-t-black" />
                  )}
                  {file.status === 'classifying' && (
                    <p className="text-sm text-blue-500">Classifying...</p>
                  )}
                  {file.status === 'success' && (
                    <p className="text-sm text-green-500">Uploaded & Classified</p>
                  )}
                  {file.status === 'error' && (
                    <p className="text-sm text-red-500">{file.error}</p>
                  )}
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => removeFile(index)}
                    disabled={file.status === 'uploading' || file.status === 'classifying'}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
