import { useState, useCallback, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { taxSchema } from '@/lib/tax-schema'

type Country = keyof typeof taxSchema
type DocumentCategory = 'CompanyDocuments' | 'EmployeeDocuments'
type DocumentType = string

interface ClassificationResult {
  country: Country | null;
  document_type: DocumentType | null;
  document_category: DocumentCategory;
  document_subtype?: string | null;
  status: 'classified' | 'pending_review' | 'non_classified';
  confidence_score: number;
}

const CACHE_EXPIRATION = 5 * 60 * 1000;
const classificationCache = new Map<string, { result: ClassificationResult; timestamp: number }>();

export function useDocumentClassifier() {
  const [isClassifying, setIsClassifying] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const lastClassificationRef = useRef<string | null>(null)

  const extractDocumentDetails = useCallback(async (classificationResult: string): Promise<ClassificationResult> => {
    try {
      // Try to parse as JSON first
      try {
        const jsonResult = JSON.parse(classificationResult)
        return {
          country: jsonResult['Country of Origin'] as Country,
          document_type: jsonResult['Document Type'],
          document_category: jsonResult['Document Category'] as DocumentCategory,
          document_subtype: jsonResult['Document Subtype'],
          status: 'classified',
          confidence_score: jsonResult['Confidence Score']
        }
      } catch {
        // Fall back to text parsing
        const details = {
          country: null as Country | null,
          documentType: null as string | null,
          category: 'CompanyDocuments' as DocumentCategory,
          subtype: null as string | null,
          confidence_score: 0
        }

        const matches = {
          country: classificationResult.match(/Country of Origin:\s*([^\n*]+)/i),
          type: classificationResult.match(/Document Type:\s*([^\n*]+)/i),
          category: classificationResult.match(/Document Category:\s*([^\n*]+)/i),
          subtype: classificationResult.match(/Document Subtype:\s*([^\n*]+)/i),
          confidence: classificationResult.match(/Confidence Score:\s*([^\n*]+)/i)
        }

        if (matches.country) details.country = matches.country[1].trim() as Country
        if (matches.type) details.documentType = matches.type[1].trim()
        if (matches.category) details.category = matches.category[1].trim() as DocumentCategory
        if (matches.subtype) details.subtype = matches.subtype[1].trim()
        if (matches.confidence) details.confidence_score = parseFloat(matches.confidence[1].trim())

        // Validate against schema
        if (details.country && !taxSchema[details.country]) {
          details.country = null
        }

        if (details.country && details.documentType) {
          const countrySchema = taxSchema[details.country]
          const categoryTypes = countrySchema?.[details.category]
          
          if (!categoryTypes?.includes(details.documentType)) {
            // Try other categories
            const allCategories: DocumentCategory[] = ['CompanyDocuments', 'EmployeeDocuments']
            let foundMatch = false
            
            for (const category of allCategories) {
              if (countrySchema?.[category]?.includes(details.documentType)) {
                details.category = category
                foundMatch = true
                break
              }
            }
            
            if (!foundMatch) details.documentType = null
          }
        }

        // Determine status
        const validFields = [
          details.documentType && details.country,
          details.category === 'CompanyDocuments' || details.category === 'EmployeeDocuments',
          details.country !== null
        ].filter(Boolean).length

        const status = validFields >= 2 ? 'classified' : 
                      validFields === 1 ? 'pending_review' : 
                      'non_classified'

        return {
          country: details.country,
          document_type: details.documentType,
          document_category: details.category,
          document_subtype: details.subtype,
          status,
          confidence_score: details.confidence_score
        }
      }
    } catch (error) {
      console.error('Error extracting document details:', error)
      return {
        country: null,
        document_type: null,
        document_category: 'CompanyDocuments',
        document_subtype: null,
        status: 'non_classified',
        confidence_score: 0
      }
    }
  }, [])

  const classifyDocument = useCallback(async (fileUrl: string): Promise<ClassificationResult> => {
    if (lastClassificationRef.current === fileUrl) {
      return Promise.reject(new Error('Classification already in progress'))
    }

    const cachedResult = classificationCache.get(fileUrl)
    if (cachedResult && Date.now() - cachedResult.timestamp < CACHE_EXPIRATION) {
      return cachedResult.result
    }

    setIsClassifying(true)
    setError(null)
    lastClassificationRef.current = fileUrl

    try {
      const apiKey = process.env.NEXT_PUBLIC_OPENROUTER_API_KEY
      if (!apiKey) throw new Error('OpenRouter API key not configured')

      const filename = fileUrl.split('/').pop() || 'document.pdf'
      const isPDF = filename.toLowerCase().endsWith('.pdf')
      const isImage = /\.(jpg|jpeg|png|gif|webp)$/i.test(filename)

      const fileResponse = await fetch(fileUrl)
      if (!fileResponse.ok) throw new Error('File not accessible')
      
      const fileBlob = await fileResponse.blob()
      const base64Content = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => resolve(reader.result as string)
        reader.onerror = reject
        reader.readAsDataURL(fileBlob)
      })

      const systemPrompt = `You are a document classification expert. Analyze the provided document and classify it according to the following tax schema: ${JSON.stringify(taxSchema)}

      Your task is to:
      1. Identify the country of origin (must be one of: ${Object.keys(taxSchema).join(', ')})
      2. Determine the document type (must be one of the types listed in the schema for the identified country)
      3. Determine the document category (must be either 'CompanyDocuments' or 'EmployeeDocuments')
      4. Extract any additional information that might be relevant

      Important rules:
      - The country must be one of: ${Object.keys(taxSchema).join(', ')}
      - The document type must be one of the types listed in the schema for the identified country
      - The document category must be either 'CompanyDocuments' or 'EmployeeDocuments'
      - If you cannot determine the country or document type with high confidence, set them to null
      - If you cannot determine the category, default to 'CompanyDocuments'
      - Include a confidence score (0-1) based on how certain you are about the classification

      You must return the result in the following exact format:
      Country of Origin: [country name or null]
      Document Type: [document type or null]
      Document Category: [CompanyDocuments or EmployeeDocuments]
      Document Subtype: [subtype or null]
      Confidence Score: [0-1]`

      const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': window.location.origin,
          'X-Title': 'Tax Document Classifier'
        },
        body: JSON.stringify({
          model: 'x-ai/grok-2-vision-1212',
          messages: [
            { role: 'system', content: systemPrompt },
            {
              role: 'user',
              content: isPDF ? [
                { type: 'text', text: 'Please classify this PDF document. Return the result in the exact format specified.' },
                { type: 'file', file: { filename, file_data: base64Content } }
              ] : [
                { type: 'text', text: 'Please classify this image document. Return the result in the exact format specified.' },
                { type: 'image_url', image_url: { url: base64Content } }
              ]
            }
          ],
          max_tokens: 1000,
          temperature: 0.1,
          response_format: { type: "text" },
          plugins: isPDF ? [{
            id: 'file-parser',
            pdf: { engine: 'mistral-ocr', extract_text: true, extract_tables: true }
          }] : undefined
        })
      })

      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`OpenRouter API error: ${response.status} ${response.statusText}`)
      }

      const data = await response.json()
      if (!data?.choices?.[0]?.message?.content) {
        throw new Error('Invalid response from OpenRouter API')
      }

      const result = await extractDocumentDetails(data.choices[0].message.content)
      classificationCache.set(fileUrl, { result, timestamp: Date.now() })
      return result

    } catch (error: any) {
      console.error('Error classifying document:', error)
      setError(error.message)
      throw error
    } finally {
      setIsClassifying(false)
      lastClassificationRef.current = null
    }
  }, [extractDocumentDetails])

  const batchVerify = useCallback(async (documentIds: string[]): Promise<{ success: boolean; error?: string }> => {
    setIsClassifying(true)
    setError(null)

    try {
      const { data: { user }, error: userError } = await supabase.auth.getUser()
      if (userError || !user) throw new Error('Not authenticated')

      const { data: documents, error: fetchError } = await supabase
        .from('documents')
        .select('*')
        .in('id', documentIds)
        .eq('user_id', user.id)

      if (fetchError || !documents?.length) throw new Error('No documents found')

      const results = await Promise.allSettled(
        documents.map(async (document, index) => {
          await new Promise(resolve => setTimeout(resolve, index * 1000))
          
          try {
            const cachedResult = classificationCache.get(document.public_url)
            if (cachedResult && Date.now() - cachedResult.timestamp < CACHE_EXPIRATION) {
              return { document, result: cachedResult.result }
            }

            const classificationResult = await classifyDocument(document.public_url)
            
            const { error: updateError } = await supabase
              .from('documents')
              .update({
                document_type: classificationResult.document_type,
                country_of_origin: classificationResult.country,
                document_category: classificationResult.document_category,
                status: classificationResult.status,
                metadata: {
                  ...document.metadata,
                  confidence_score: classificationResult.confidence_score,
                  classification_timestamp: new Date().toISOString()
                }
              })
              .eq('id', document.id)

            if (updateError) throw updateError

            await supabase
              .from('document_activities')
              .insert({
                document_id: document.id,
                user_id: user.id,
                activity_type: 'batch_verify',
                activity_details: {
                  old_status: document.status,
                  new_status: classificationResult.status,
                  classification_result: classificationResult
                }
              })

            return { document, result: classificationResult }
          } catch (docError: any) {
            console.error(`Error processing document ${document.id}:`, docError)
            throw docError
          }
        })
      )

      const successful = results.filter(r => r.status === 'fulfilled').length
      const failed = results.filter(r => r.status === 'rejected').length

      return { 
        success: successful > 0,
        error: failed > 0 ? `${failed} documents failed to process` : undefined
      }
    } catch (err: any) {
      console.error('Batch verify error:', err)
      setError(err.message)
      return { success: false, error: err.message }
    } finally {
      setIsClassifying(false)
    }
  }, [classifyDocument])

  const clearCache = useCallback((fileUrl: string) => {
    classificationCache.delete(fileUrl)
  }, [])

  const clearAllCache = useCallback(() => {
    classificationCache.clear()
  }, [])

  return {
    classifyDocument,
    batchVerify,
    isClassifying,
    error,
    clearCache,
    clearAllCache
  }
} 