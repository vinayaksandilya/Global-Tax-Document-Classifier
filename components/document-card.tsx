"use client"

import { Document } from "@/lib/document-schema"
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { FileText, Download, Trash2, Check } from "lucide-react"
import Link from "next/link"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog"
import { useState } from "react"
import { supabase } from "@/lib/supabase"
import { useRouter } from "next/navigation"

interface DocumentCardProps {
  document: Document;
  onDelete?: () => void;
  onSelect?: () => void;
  isSelected?: boolean;
  viewMode?: 'grid' | 'list';
}

export function DocumentCard({ document, onDelete, onSelect, isSelected, viewMode = 'grid' }: DocumentCardProps) {
  const [isDeleting, setIsDeleting] = useState(false)
  const router = useRouter()

  const handleDelete = async () => {
    setIsDeleting(true)
    try {
      // First delete all related records
      await Promise.all([
        supabase.from('document_activities').delete().eq('document_id', document.id),
        supabase.from('document_comments').delete().eq('document_id', document.id),
        supabase.from('document_tags').delete().eq('document_id', document.id),
        supabase.from('document_shares').delete().eq('document_id', document.id)
      ])

      // Then delete the document record
      const { error: dbError } = await supabase
        .from('documents')
        .delete()
        .eq('id', document.id)

      if (dbError) throw dbError

      // Finally delete the file from storage
      const { error: storageError } = await supabase.storage
        .from('docu')
        .remove([document.file_path])

      if (storageError) throw storageError

      // Call the onDelete callback if provided
      onDelete?.()
    } catch (error: any) {
      console.error('Error deleting document:', error)
      alert('Failed to delete document: ' + error.message)
    } finally {
      setIsDeleting(false)
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'classified':
        return 'bg-green-500';
      case 'pending_review':
        return 'bg-yellow-500';
      case 'failed':
        return 'bg-red-500';
      default:
        return 'bg-gray-500';
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const handleCardClick = (e: React.MouseEvent) => {
    // Prevent click if clicking on buttons
    if ((e.target as HTMLElement).closest('button')) {
      return;
    }
    router.push(`/document/${document.id}`);
  };

  if (viewMode === 'list') {
    return (
      <Card 
        className={`relative cursor-pointer transition-all ${isSelected ? 'ring-2 ring-blue-500' : ''}`}
        onClick={handleCardClick}
      >
        <div className="flex items-center justify-between p-4">
          <div className="flex items-center gap-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-100">
              <FileText className="h-5 w-5 text-gray-500" />
            </div>
            <div>
              <h3 className="font-medium">{document.file_name}</h3>
              <div className="flex items-center gap-2 mt-1">
                <Badge className={getStatusColor(document.status)}>
                  {document.status.replace('_', ' ')}
                </Badge>
                <span className="text-sm text-gray-500">
                  {document.country_of_origin || 'No country'}
                </span>
                <span className="text-sm text-gray-500">
                  {document.document_type || 'No type'}
                </span>
                <span className="text-sm text-gray-500">
                  {formatFileSize(document.file_size)}
                </span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" asChild>
              <Link href={`/document/${document.id}`}>
                <FileText className="h-4 w-4" />
              </Link>
            </Button>
            <Button variant="ghost" size="icon" onClick={(e) => {
              e.stopPropagation()
              window.open(document.public_url, '_blank')
            }}>
              <Download className="h-4 w-4" />
            </Button>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="ghost" size="icon" disabled={isDeleting}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This action cannot be undone. This will permanently delete the document
                    and all associated data.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={handleDelete} disabled={isDeleting}>
                    {isDeleting ? 'Deleting...' : 'Delete'}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>
      </Card>
    )
  }

  return (
    <Card 
      className={`relative cursor-pointer transition-all ${isSelected ? 'ring-2 ring-blue-500' : ''}`}
      onClick={handleCardClick}
    >
      {isSelected && (
        <div className="absolute top-2 right-2">
          <Check className="h-5 w-5 text-blue-500" />
        </div>
      )}
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg truncate" title={document.file_name}>
            {document.file_name}
          </CardTitle>
          <Badge className={getStatusColor(document.status)}>
            {document.status.replace('_', ' ')}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          <p className="text-sm text-gray-500">
            Country: {document.country_of_origin}
          </p>
          <p className="text-sm text-gray-500">
            Type: {document.document_type}
          </p>
          <p className="text-sm text-gray-500">
            Category: {document.document_category}
          </p>
          <p className="text-sm text-gray-500">
            Size: {formatFileSize(document.file_size)}
          </p>
          {document.extracted_data?.name && (
            <p className="text-sm text-gray-500">
              Name: {document.extracted_data.name}
            </p>
          )}
          {document.extracted_data?.companyName && (
            <p className="text-sm text-gray-500">
              Company: {document.extracted_data.companyName}
            </p>
          )}
        </div>
      </CardContent>
      <CardFooter className="flex justify-between">
        <Button variant="ghost" size="icon" asChild>
          <Link href={`/document/${document.id}`}>
            <FileText className="h-4 w-4" />
          </Link>
        </Button>
        <Button variant="ghost" size="icon" onClick={(e) => {
          e.stopPropagation()
          window.open(document.public_url, '_blank')
        }}>
          <Download className="h-4 w-4" />
        </Button>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="ghost" size="icon" disabled={isDeleting}>
              <Trash2 className="h-4 w-4" />
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Are you sure?</AlertDialogTitle>
              <AlertDialogDescription>
                This action cannot be undone. This will permanently delete the document
                and all associated data.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={handleDelete} disabled={isDeleting}>
                {isDeleting ? 'Deleting...' : 'Delete'}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </CardFooter>
    </Card>
  )
} 