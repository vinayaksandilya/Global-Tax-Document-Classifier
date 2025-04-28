import { supabase } from './supabase'

export async function uploadFile(file: File, bucket: string = 'docu') {
  try {
    // Get the current user
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    
    if (userError || !user) {
      throw new Error('User not authenticated')
    }

    // Generate a unique file name
    const fileExt = file.name.split('.').pop()
    const fileName = `${Math.random().toString(36).substring(2)}-${Date.now()}.${fileExt}`
    
    // Create user-specific folder path
    const filePath = `${user.id}/${fileName}`
    
    // Upload the file
    const { data, error } = await supabase.storage
      .from(bucket)
      .upload(filePath, file, {
        cacheControl: '3600',
        upsert: false
      })

    if (error) {
      throw error
    }

    // Get the public URL
    const { data: { publicUrl } } = supabase.storage
      .from(bucket)
      .getPublicUrl(filePath)

    return {
      fileName,
      filePath,
      publicUrl,
      error: null
    }
  } catch (error: any) {
    return {
      fileName: null,
      filePath: null,
      publicUrl: null,
      error: error.message
    }
  }
}

export async function deleteFile(filePath: string, bucket: string = 'docu') {
  try {
    const { error } = await supabase.storage
      .from(bucket)
      .remove([filePath])

    if (error) {
      throw error
    }

    return { error: null }
  } catch (error: any) {
    return { error: error.message }
  }
}

export async function listUserFiles(bucket: string = 'docu') {
  try {
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    
    if (userError || !user) {
      throw new Error('User not authenticated')
    }

    const { data, error } = await supabase.storage
      .from(bucket)
      .list(user.id)

    if (error) {
      throw error
    }

    return {
      files: data,
      error: null
    }
  } catch (error: any) {
    return {
      files: null,
      error: error.message
    }
  }
} 