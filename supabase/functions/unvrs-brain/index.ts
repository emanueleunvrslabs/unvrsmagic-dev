import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface AudioMessageData {
  url: string
  mimetype?: string
  mediaKey: string
  fileSha256?: string
  fileLength?: string
  seconds?: number
  messageId?: string
}

interface IncomingMessage {
  channel: 'whatsapp' | 'telegram' | 'instagram' | 'linkedin' | 'phone' | 'email'
  contact_identifier: string // phone number, telegram user id, etc.
  contact_name?: string
  content_type: 'text' | 'voice' | 'image' | 'document' | 'video'
  content?: string
  media_url?: string
  audio_message_data?: AudioMessageData
  metadata?: Record<string, any>
}

interface BrainResponse {
  success: boolean
  conversation_id: string
  routed_to_agent: string
  response?: string
  response_type?: 'text' | 'audio'
  audio_url?: string
  action?: string
  error?: string
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  const startTime = Date.now()

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const message: IncomingMessage = await req.json()
    console.log('[UNVRS.BRAIN] Received message:', JSON.stringify(message))

    // Step 1: Get owner user_id (the system owner)
    const { data: ownerRole, error: ownerError } = await supabase
      .from('user_roles')
      .select('user_id')
      .eq('role', 'owner')
      .single()

    if (ownerError || !ownerRole) {
      console.error('[UNVRS.BRAIN] Failed to get owner:', ownerError)
      throw new Error('System owner not configured')
    }

    const ownerId = ownerRole.user_id
    console.log('[UNVRS.BRAIN] Owner ID:', ownerId)

    // Step 2: Normalize contact identifier
    const normalizedContact = normalizeContactIdentifier(message.channel, message.contact_identifier)
    console.log('[UNVRS.BRAIN] Normalized contact:', normalizedContact)

    // Step 3: Find or create conversation
    let conversation = await findActiveConversation(supabase, ownerId, message.channel, normalizedContact)
    
    if (!conversation) {
      conversation = await createConversation(supabase, ownerId, message, normalizedContact)
      console.log('[UNVRS.BRAIN] Created new conversation:', conversation.id)
    } else {
      console.log('[UNVRS.BRAIN] Found existing conversation:', conversation.id)
    }

    // Step 4: Store the incoming message
    await storeMessage(supabase, ownerId, conversation.id, message, 'inbound')

    // Step 5: Identify sender type (client, lead, or public)
    const senderInfo = await identifySender(supabase, ownerId, message.channel, normalizedContact)
    console.log('[UNVRS.BRAIN] Sender info:', JSON.stringify(senderInfo))

    // Step 6: Update conversation with client/lead info if found
    if (senderInfo.client_id || senderInfo.lead_id) {
      await supabase
        .from('unvrs_conversations')
        .update({
          client_id: senderInfo.client_id,
          lead_id: senderInfo.lead_id,
          contact_name: senderInfo.name || message.contact_name,
          updated_at: new Date().toISOString()
        })
        .eq('id', conversation.id)
    }

    // Step 7: Determine which agent should handle this
    const routingDecision = await determineRouting(supabase, conversation, senderInfo, message)
    console.log('[UNVRS.BRAIN] Routing decision:', routingDecision)

    // Step 8: Update conversation with current agent
    await supabase
      .from('unvrs_conversations')
      .update({
        current_agent: routingDecision.agent,
        last_message_at: new Date().toISOString()
      })
      .eq('id', conversation.id)

    // Step 9: Create or update agent session
    const session = await getOrCreateAgentSession(supabase, ownerId, conversation.id, routingDecision.agent)
    console.log('[UNVRS.BRAIN] Agent session:', session.id)

    // Step 10: Log to agent_logs
    await supabase.from('agent_logs').insert({
      agent_name: 'unvrs-brain',
      user_id: ownerId,
      log_level: 'info',
      message: `Routed ${message.channel} message to ${routingDecision.agent}`,
      action: 'route_message',
      metadata: {
        conversation_id: conversation.id,
        channel: message.channel,
        sender_type: senderInfo.type,
        content_type: message.content_type,
        routed_to: routingDecision.agent
      },
      duration_ms: Date.now() - startTime
    })

    // Step 11: If voice message, transcribe it
    let processedContent = message.content
    if (message.content_type === 'voice' && message.media_url) {
      processedContent = await transcribeVoice(supabase, ownerId, message.media_url, message.audio_message_data)
      console.log('[UNVRS.BRAIN] Transcribed voice:', processedContent)
      
      // Update message with transcription
      await supabase
        .from('unvrs_messages')
        .update({ transcription: processedContent })
        .eq('conversation_id', conversation.id)
        .eq('media_url', message.media_url)
    }

    // Step 12: Generate response based on routing
    const response = await generateAgentResponse(
      supabase, 
      ownerId, 
      conversation, 
      session, 
      routingDecision, 
      senderInfo, 
      processedContent || message.content || '',
      message
    )

    // Step 13: If original message was voice, convert response to audio (unless it's a data request from owner)
    let responseType: 'text' | 'audio' = 'text'
    let audioUrl: string | undefined
    
    // Skip TTS if owner requested data - data should always be text
    const skipTTS = response.forceText === true
    
    if (message.content_type === 'voice' && response.text && !skipTTS) {
      console.log('[UNVRS.BRAIN] Original was voice message, converting response to audio...')
      audioUrl = await textToSpeech(supabase, ownerId, response.text)
      if (audioUrl) {
        responseType = 'audio'
        console.log('[UNVRS.BRAIN] Audio generated:', audioUrl)
      }
    } else if (skipTTS) {
      console.log('[UNVRS.BRAIN] Data request detected, forcing text response')
    }

    // Step 14: Store outbound message if response generated
    if (response.text) {
      await storeMessage(supabase, ownerId, conversation.id, {
        channel: message.channel,
        contact_identifier: normalizedContact,
        content_type: responseType === 'audio' ? 'voice' : 'text',
        content: response.text,
        media_url: audioUrl,
        metadata: { agent: routingDecision.agent }
      }, 'outbound')
    }

    const brainResponse: BrainResponse = {
      success: true,
      conversation_id: conversation.id,
      routed_to_agent: routingDecision.agent,
      response: response.text,
      response_type: responseType,
      audio_url: audioUrl,
      action: response.action
    }

    console.log('[UNVRS.BRAIN] Response:', JSON.stringify(brainResponse))

    return new Response(JSON.stringify(brainResponse), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  } catch (error) {
    console.error('[UNVRS.BRAIN] Error:', error)
    return new Response(JSON.stringify({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})

// Helper Functions

function normalizeContactIdentifier(channel: string, identifier: string): string {
  if (channel === 'whatsapp' || channel === 'phone') {
    // Remove all non-numeric except leading +
    return identifier.replace(/[^\d+]/g, '').replace(/^\+/, '')
  }
  return identifier.toLowerCase().trim()
}

async function findActiveConversation(
  supabase: any, 
  ownerId: string, 
  channel: string, 
  contact: string
) {
  const { data, error } = await supabase
    .from('unvrs_conversations')
    .select('*')
    .eq('user_id', ownerId)
    .eq('channel', channel)
    .eq('contact_identifier', contact)
    .in('status', ['active', 'paused'])
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  if (error && error.code !== 'PGRST116') {
    console.error('[UNVRS.BRAIN] Error finding conversation:', error)
  }
  return data
}

async function createConversation(
  supabase: any, 
  ownerId: string, 
  message: IncomingMessage, 
  normalizedContact: string
) {
  const { data, error } = await supabase
    .from('unvrs_conversations')
    .insert({
      user_id: ownerId,
      channel: message.channel,
      contact_identifier: normalizedContact,
      contact_name: message.contact_name,
      current_agent: 'brain',
      status: 'active',
      metadata: message.metadata || {}
    })
    .select()
    .single()

  if (error) {
    console.error('[UNVRS.BRAIN] Error creating conversation:', error)
    throw error
  }
  return data
}

async function storeMessage(
  supabase: any, 
  ownerId: string, 
  conversationId: string, 
  message: IncomingMessage, 
  direction: 'inbound' | 'outbound'
) {
  const { error } = await supabase
    .from('unvrs_messages')
    .insert({
      user_id: ownerId,
      conversation_id: conversationId,
      direction,
      content_type: message.content_type,
      content: message.content,
      media_url: message.media_url,
      metadata: message.metadata || {}
    })

  if (error) {
    console.error('[UNVRS.BRAIN] Error storing message:', error)
  }
}

// Escape SQL LIKE wildcards to prevent injection
function escapeLikePattern(input: string): string {
  return input.replace(/%/g, '\\%').replace(/_/g, '\\_')
}

async function identifySender(
  supabase: any, 
  ownerId: string, 
  channel: string, 
  contact: string
): Promise<{ type: 'owner' | 'client' | 'lead' | 'public', client_id?: string, lead_id?: string, name?: string }> {
  
  // Get owner phone from environment variable (secure, not hardcoded)
  const OWNER_PHONE = Deno.env.get('OWNER_PHONE_NUMBER') || ''
  
  // Check if sender is the OWNER
  if ((channel === 'whatsapp' || channel === 'phone') && OWNER_PHONE) {
    const normalizedContact = contact.replace(/[^\d]/g, '')
    const normalizedOwner = OWNER_PHONE.replace(/[^\d]/g, '')
    if (normalizedContact === normalizedOwner || normalizedContact.endsWith(normalizedOwner)) {
      console.log('[UNVRS.BRAIN] Owner detected')
      return {
        type: 'owner',
        name: 'Emanuele'
      }
    }
  }
  
  // Check if it's an existing client by phone or email
  if (channel === 'whatsapp' || channel === 'phone') {
    // Normalize phone number for exact matching (more secure than LIKE)
    const normalizedPhone = contact.replace(/[^\d]/g, '')
    const { data: clientContact } = await supabase
      .from('client_contacts')
      .select('client_id, first_name, last_name, clients!inner(id, user_id)')
      .or(`whatsapp_number.ilike.%${escapeLikePattern(normalizedPhone)}%`)
      .limit(1)
      .single()

    if (clientContact) {
      return {
        type: 'client',
        client_id: clientContact.client_id,
        name: `${clientContact.first_name} ${clientContact.last_name}`.trim()
      }
    }
  }

  if (channel === 'email') {
    const escapedEmail = escapeLikePattern(contact)
    const { data: clientContact } = await supabase
      .from('client_contacts')
      .select('client_id, first_name, last_name')
      .ilike('email', escapedEmail)
      .limit(1)
      .single()

    if (clientContact) {
      return {
        type: 'client',
        client_id: clientContact.client_id,
        name: `${clientContact.first_name} ${clientContact.last_name}`.trim()
      }
    }
  }

  // Check if it's an existing lead - use escaped patterns
  const escapedContact = escapeLikePattern(contact)
  const { data: lead } = await supabase
    .from('unvrs_leads')
    .select('id, name, phone, email')
    .eq('user_id', ownerId)
    .or(`phone.ilike.%${escapedContact}%,email.ilike.%${escapedContact}%`)
    .limit(1)
    .single()

  if (lead) {
    return {
      type: 'lead',
      lead_id: lead.id,
      name: lead.name
    }
  }

  return { type: 'public' }
}

async function determineRouting(
  supabase: any,
  conversation: any,
  senderInfo: any,
  message: IncomingMessage
): Promise<{ agent: string, reason: string }> {
  
  // If sender is the OWNER → route directly to BRAIN (full control)
  if (senderInfo.type === 'owner') {
    return { agent: 'brain', reason: 'Owner detected - BRAIN responds directly with full capabilities' }
  }
  
  // If sender is a known client → route to HLO (client support)
  if (senderInfo.type === 'client') {
    return { agent: 'hlo', reason: 'Known client - routing to HLO for support' }
  }

  // If sender is a lead → check current agent session
  if (senderInfo.type === 'lead') {
    // Check if there's an active session with another agent
    const { data: activeSession } = await supabase
      .from('unvrs_agent_sessions')
      .select('agent_type')
      .eq('conversation_id', conversation.id)
      .is('ended_at', null)
      .order('started_at', { ascending: false })
      .limit(1)
      .single()

    if (activeSession && activeSession.agent_type !== 'brain') {
      return { 
        agent: activeSession.agent_type, 
        reason: `Continuing with ${activeSession.agent_type} session` 
      }
    }

    return { agent: 'switch', reason: 'Known lead - routing to SWITCH for qualification' }
  }

  // Public/unknown sender → route to SWITCH for initial qualification
  return { agent: 'switch', reason: 'Unknown sender - routing to SWITCH for qualification' }
}

async function getOrCreateAgentSession(
  supabase: any,
  ownerId: string,
  conversationId: string,
  agentType: string
) {
  // Check for existing active session
  const { data: existingSession } = await supabase
    .from('unvrs_agent_sessions')
    .select('*')
    .eq('conversation_id', conversationId)
    .eq('agent_type', agentType)
    .is('ended_at', null)
    .single()

  if (existingSession) {
    // Update last activity
    await supabase
      .from('unvrs_agent_sessions')
      .update({ last_activity_at: new Date().toISOString() })
      .eq('id', existingSession.id)
    return existingSession
  }

  // Create new session
  const { data: newSession, error } = await supabase
    .from('unvrs_agent_sessions')
    .insert({
      user_id: ownerId,
      conversation_id: conversationId,
      agent_type: agentType,
      state: {},
      context: {}
    })
    .select()
    .single()

  if (error) {
    console.error('[UNVRS.BRAIN] Error creating session:', error)
    throw error
  }

  return newSession
}

async function transcribeVoice(
  supabase: any,
  ownerId: string,
  mediaUrl: string,
  audioMessageData?: any
): Promise<string> {
  // Get OpenAI API key
  const { data: openaiKey } = await supabase
    .from('api_keys')
    .select('api_key')
    .eq('user_id', ownerId)
    .eq('provider', 'openai')
    .single()

  if (!openaiKey) {
    console.log('[UNVRS.BRAIN] No OpenAI API key found, skipping transcription')
    return '[Voice message - transcription unavailable]'
  }

  const WASENDER_API_KEY = Deno.env.get('WASENDER_API_KEY')
  if (!WASENDER_API_KEY) {
    console.log('[UNVRS.BRAIN] No WASender API key found, skipping transcription')
    return '[Voice message - transcription unavailable]'
  }

  try {
    // If we have audioMessageData, use WASender decrypt-media API
    if (audioMessageData) {
      console.log('[UNVRS.BRAIN] Decrypting audio via WASender API...')
      
      // Build the decrypt request body
      const decryptBody = {
        data: {
          messages: {
            key: {
              id: audioMessageData.messageId || 'unknown'
            },
            message: {
              audioMessage: {
                url: audioMessageData.url,
                mimetype: audioMessageData.mimetype || 'audio/ogg; codecs=opus',
                mediaKey: audioMessageData.mediaKey,
                fileSha256: audioMessageData.fileSha256,
                fileLength: audioMessageData.fileLength,
                seconds: audioMessageData.seconds
              }
            }
          }
        }
      }

      console.log('[UNVRS.BRAIN] Decrypt request:', JSON.stringify(decryptBody))

      const decryptResponse = await fetch('https://www.wasenderapi.com/api/decrypt-media', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${WASENDER_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(decryptBody)
      })

      if (!decryptResponse.ok) {
        const errorText = await decryptResponse.text()
        console.error('[UNVRS.BRAIN] WASender decrypt error:', decryptResponse.status, errorText)
        return '[Voice message - decrypt failed]'
      }

      const decryptResult = await decryptResponse.json()
      console.log('[UNVRS.BRAIN] Decrypt result:', JSON.stringify(decryptResult))

      if (!decryptResult.publicUrl) {
        console.error('[UNVRS.BRAIN] No publicUrl in decrypt response')
        return '[Voice message - decrypt failed]'
      }

      // Now download the decrypted audio
      console.log('[UNVRS.BRAIN] Downloading decrypted audio from:', decryptResult.publicUrl)
      
      const audioResponse = await fetch(decryptResult.publicUrl)
      if (!audioResponse.ok) {
        console.error('[UNVRS.BRAIN] Failed to download decrypted audio:', audioResponse.status)
        return '[Voice message - download failed]'
      }

      const audioBlob = await audioResponse.blob()
      console.log('[UNVRS.BRAIN] Decrypted audio blob size:', audioBlob.size, 'type:', audioBlob.type)

      // Send to OpenAI Whisper
      const formData = new FormData()
      formData.append('file', audioBlob, 'audio.ogg')
      formData.append('model', 'whisper-1')

      console.log('[UNVRS.BRAIN] Sending to OpenAI Whisper...')

      const whisperResponse = await fetch('https://api.openai.com/v1/audio/transcriptions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${openaiKey.api_key}`
        },
        body: formData
      })

      if (whisperResponse.ok) {
        const result = await whisperResponse.json()
        console.log('[UNVRS.BRAIN] Transcription result:', result.text)
        return result.text || '[Voice message - no text detected]'
      } else {
        const errorText = await whisperResponse.text()
        console.error('[UNVRS.BRAIN] OpenAI Whisper error:', whisperResponse.status, errorText)
        return '[Voice message - transcription failed]'
      }
    } else {
      // Fallback: try direct download (won't work for encrypted files)
      console.log('[UNVRS.BRAIN] No audioMessageData, trying direct download from:', mediaUrl)
      
      const audioResponse = await fetch(mediaUrl)
      if (!audioResponse.ok) {
        console.error('[UNVRS.BRAIN] Failed to download audio:', audioResponse.status)
        return '[Voice message - download failed]'
      }
      
      const audioBlob = await audioResponse.blob()
      console.log('[UNVRS.BRAIN] Audio blob size:', audioBlob.size, 'type:', audioBlob.type)

      const formData = new FormData()
      formData.append('file', audioBlob, 'audio.ogg')
      formData.append('model', 'whisper-1')

      const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${openaiKey.api_key}`
        },
        body: formData
      })

      if (response.ok) {
        const result = await response.json()
        console.log('[UNVRS.BRAIN] Transcription result:', result.text)
        return result.text || '[Voice message - no text detected]'
      } else {
        const errorText = await response.text()
        console.error('[UNVRS.BRAIN] OpenAI Whisper error:', response.status, errorText)
        return '[Voice message - transcription failed]'
      }
    }
  } catch (error) {
    console.error('[UNVRS.BRAIN] Transcription error:', error)
    return '[Voice message - transcription error]'
  }
}

async function textToSpeech(
  supabase: any,
  ownerId: string,
  text: string
): Promise<string | undefined> {
  // Get OpenAI API key
  const { data: openaiKey } = await supabase
    .from('api_keys')
    .select('api_key')
    .eq('user_id', ownerId)
    .eq('provider', 'openai')
    .single()

  if (!openaiKey) {
    console.log('[UNVRS.BRAIN] No OpenAI API key found, skipping TTS')
    return undefined
  }

  try {
    // Replace UNVRS with Universe for proper TTS pronunciation
    const ttsText = text
      .replace(/UNVRS Labs/gi, 'Universe Labs')
      .replace(/UNVRS/gi, 'Universe')
    
    console.log('[UNVRS.BRAIN] Generating TTS with OpenAI for:', ttsText.substring(0, 100))

    // Use OpenAI TTS API
    // Voice options: alloy, echo, fable, onyx, nova, shimmer
    // Using 'shimmer' - warm, engaging, energetic voice good for multilingual
    const response = await fetch('https://api.openai.com/v1/audio/speech', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiKey.api_key}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'tts-1',
        input: ttsText,
        voice: 'shimmer',
        response_format: 'mp3'
      })
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('[UNVRS.BRAIN] OpenAI TTS error:', response.status, errorText)
      return undefined
    }

    // Get audio as array buffer
    const audioBuffer = await response.arrayBuffer()
    console.log('[UNVRS.BRAIN] TTS audio generated, size:', audioBuffer.byteLength)

    // Upload to Supabase Storage
    const fileName = `tts_${Date.now()}.mp3`
    const filePath = `voice-responses/${fileName}`

    const { error: uploadError } = await supabase.storage
      .from('uploads')
      .upload(filePath, audioBuffer, {
        contentType: 'audio/mpeg',
        upsert: false
      })

    if (uploadError) {
      console.error('[UNVRS.BRAIN] Error uploading TTS audio:', uploadError)
      return undefined
    }

    // Get public URL
    const { data: publicUrlData } = supabase.storage
      .from('uploads')
      .getPublicUrl(filePath)

    console.log('[UNVRS.BRAIN] TTS audio uploaded:', publicUrlData.publicUrl)
    return publicUrlData.publicUrl

  } catch (error) {
    console.error('[UNVRS.BRAIN] TTS error:', error)
    return undefined
  }
}

async function generateAgentResponse(
  supabase: any,
  ownerId: string,
  conversation: any,
  session: any,
  routing: { agent: string, reason: string },
  senderInfo: any,
  content: string,
  originalMessage: IncomingMessage
): Promise<{ text?: string, action?: string, forceText?: boolean }> {
  
  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  
  // Route to appropriate agent edge function
  switch (routing.agent) {
    case 'brain':
      // OWNER mode - BRAIN responds directly with full AI capabilities
      try {
        console.log('[UNVRS.BRAIN] Owner mode - responding directly')
        
        // Get OpenAI API key
        const { data: openaiKey } = await supabase
          .from('api_keys')
          .select('api_key')
          .eq('user_id', ownerId)
          .eq('provider', 'openai')
          .single()

        if (!openaiKey) {
          return {
            text: 'Ciao boss! Non ho trovato la chiave API OpenAI configurata. Verificala nelle impostazioni.',
            action: 'error'
          }
        }

        // Get conversation history for context
        const { data: messages } = await supabase
          .from('unvrs_messages')
          .select('direction, content, content_type')
          .eq('conversation_id', conversation.id)
          .order('created_at', { ascending: true })
          .limit(30)

        const conversationHistory = (messages || []).map((m: any) => ({
          role: m.direction === 'inbound' ? 'user' : 'assistant',
          content: m.content || '[media]'
        }))

        conversationHistory.push({
          role: 'user',
          content: content
        })

        // Detect if owner is asking for data (numbers, emails, addresses, etc.)
        const dataRequestPatterns = [
          /numer[oi]/i, /telefon/i, /cell/i, /mail/i, /email/i, /indirizz/i,
          /via\s/i, /città/i, /cap\s/i, /p\.?iva/i, /partita\s*iva/i, /codice\s*fiscale/i,
          /fattura/i, /preventivo/i, /quant[io]/i, /dat[io]/i, /info/i, /contatt/i,
          /whatsapp/i, /wa\s/i, /dammi/i, /dimmi/i, /qual\s*è/i, /che\s*cos'è/i
        ]
        const isDataRequest = dataRequestPatterns.some(pattern => pattern.test(content))
        
        if (isDataRequest) {
          console.log('[UNVRS.BRAIN] Data request detected, will force text response')
        }

        // Define database tools for BRAIN
        const databaseTools = [
          {
            type: 'function',
            function: {
              name: 'search_database',
              description: 'Cerca nel database. Usa per trovare clienti, contatti, lead, progetti, conversazioni.',
              parameters: {
                type: 'object',
                properties: {
                  table: { 
                    type: 'string', 
                    enum: ['clients', 'client_contacts', 'unvrs_leads', 'client_projects', 'unvrs_conversations', 'unvrs_messages'],
                    description: 'Tabella da cercare'
                  },
                  search_term: { type: 'string', description: 'Termine di ricerca (nome, email, telefono, ecc.)' },
                  filters: { type: 'object', description: 'Filtri aggiuntivi come oggetto chiave-valore' }
                },
                required: ['table']
              }
            }
          },
          {
            type: 'function',
            function: {
              name: 'create_record',
              description: 'Crea un nuovo record nel database.',
              parameters: {
                type: 'object',
                properties: {
                  table: { 
                    type: 'string', 
                    enum: ['clients', 'client_contacts', 'unvrs_leads', 'client_projects'],
                    description: 'Tabella dove creare il record'
                  },
                  data: { type: 'object', description: 'Dati del nuovo record' }
                },
                required: ['table', 'data']
              }
            }
          },
          {
            type: 'function',
            function: {
              name: 'update_record',
              description: 'Aggiorna un record esistente nel database.',
              parameters: {
                type: 'object',
                properties: {
                  table: { 
                    type: 'string', 
                    enum: ['clients', 'client_contacts', 'unvrs_leads', 'client_projects'],
                    description: 'Tabella da aggiornare'
                  },
                  id: { type: 'string', description: 'ID del record da aggiornare' },
                  data: { type: 'object', description: 'Dati da aggiornare' }
                },
                required: ['table', 'id', 'data']
              }
            }
          },
          {
            type: 'function',
            function: {
              name: 'delete_record',
              description: 'Elimina un record dal database.',
              parameters: {
                type: 'object',
                properties: {
                  table: { 
                    type: 'string', 
                    enum: ['clients', 'client_contacts', 'unvrs_leads', 'client_projects'],
                    description: 'Tabella da cui eliminare'
                  },
                  id: { type: 'string', description: 'ID del record da eliminare' }
                },
                required: ['table', 'id']
              }
            }
          },
          {
            type: 'function',
            function: {
              name: 'send_message',
              description: 'Invia un messaggio WhatsApp a un contatto.',
              parameters: {
                type: 'object',
                properties: {
                  phone_number: { type: 'string', description: 'Numero di telefono del destinatario' },
                  message: { type: 'string', description: 'Testo del messaggio da inviare' }
                },
                required: ['phone_number', 'message']
              }
            }
          },
          {
            type: 'function',
            function: {
              name: 'get_stats',
              description: 'Ottieni statistiche aggregate dal database.',
              parameters: {
                type: 'object',
                properties: {
                  stat_type: { 
                    type: 'string', 
                    enum: ['clients_count', 'leads_count', 'active_leads', 'conversations_today', 'all_clients', 'all_leads'],
                    description: 'Tipo di statistica richiesta'
                  }
                },
                required: ['stat_type']
              }
            }
          }
        ]

        // Function to execute database tools
        const executeDbTool = async (toolName: string, args: any): Promise<string> => {
          console.log(`[UNVRS.BRAIN] Executing tool: ${toolName}`, args)
          
          switch (toolName) {
            case 'search_database': {
              const { table, search_term, filters } = args
              let query = supabase.from(table).select('*')
              
              if (search_term) {
                // Escape SQL LIKE wildcards to prevent injection
                const escapedTerm = escapeLikePattern(search_term)
                if (table === 'clients') {
                  query = query.or(`company_name.ilike.%${escapedTerm}%,vat_number.ilike.%${escapedTerm}%`)
                } else if (table === 'client_contacts') {
                  query = supabase.from(table).select('*, clients(company_name)')
                    .or(`first_name.ilike.%${escapedTerm}%,last_name.ilike.%${escapedTerm}%,email.ilike.%${escapedTerm}%,whatsapp_number.ilike.%${escapedTerm}%`)
                } else if (table === 'unvrs_leads') {
                  query = query.or(`name.ilike.%${escapedTerm}%,email.ilike.%${escapedTerm}%,phone.ilike.%${escapedTerm}%,company.ilike.%${escapedTerm}%`)
                } else if (table === 'client_projects') {
                  query = supabase.from(table).select('*, clients(company_name)')
                    .or(`project_name.ilike.%${escapedTerm}%,description.ilike.%${escapedTerm}%`)
                }
              }
              
              if (filters) {
                for (const [key, value] of Object.entries(filters)) {
                  query = query.eq(key, value)
                }
              }
              
              const { data, error } = await query.limit(20)
              if (error) return `Errore: ${error.message}`
              if (!data || data.length === 0) return 'Nessun risultato trovato.'
              return JSON.stringify(data, null, 2)
            }
            
            case 'create_record': {
              const { table, data } = args
              // Add user_id for tables that need it
              const insertData = { ...data, user_id: ownerId }
              
              const { data: created, error } = await supabase.from(table).insert(insertData).select().single()
              if (error) return `Errore creazione: ${error.message}`
              return `Record creato con successo. ID: ${created.id}`
            }
            
            case 'update_record': {
              const { table, id, data } = args
              const { error } = await supabase.from(table).update(data).eq('id', id)
              if (error) return `Errore aggiornamento: ${error.message}`
              return `Record aggiornato con successo.`
            }
            
            case 'delete_record': {
              const { table, id } = args
              const { error } = await supabase.from(table).delete().eq('id', id)
              if (error) return `Errore eliminazione: ${error.message}`
              return `Record eliminato con successo.`
            }
            
            case 'send_message': {
              const { phone_number, message } = args
              // Get WASender API key
              const { data: wasenderKey } = await supabase
                .from('api_keys')
                .select('api_key')
                .eq('provider', 'wasender')
                .single()
              
              if (!wasenderKey) return 'Errore: chiave WASender non configurata.'
              
              const waResponse = await fetch('https://api.wasender.dev/v1/messages/send', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${wasenderKey.api_key}`
                },
                body: JSON.stringify({
                  phone: phone_number.replace(/[^0-9]/g, ''),
                  message: message
                })
              })
              
              if (!waResponse.ok) return `Errore invio messaggio: ${await waResponse.text()}`
              return `Messaggio inviato con successo a ${phone_number}`
            }
            
            case 'get_stats': {
              const { stat_type } = args
              switch (stat_type) {
                case 'clients_count': {
                  const { count } = await supabase.from('clients').select('*', { count: 'exact', head: true })
                  return `Totale clienti: ${count || 0}`
                }
                case 'leads_count': {
                  const { count } = await supabase.from('unvrs_leads').select('*', { count: 'exact', head: true })
                  return `Totale lead: ${count || 0}`
                }
                case 'active_leads': {
                  const { data } = await supabase.from('unvrs_leads').select('*').in('status', ['new', 'qualified'])
                  return `Lead attivi: ${data?.length || 0}\n${JSON.stringify(data, null, 2)}`
                }
                case 'conversations_today': {
                  const today = new Date().toISOString().split('T')[0]
                  const { count } = await supabase.from('unvrs_conversations').select('*', { count: 'exact', head: true }).gte('created_at', today)
                  return `Conversazioni oggi: ${count || 0}`
                }
                case 'all_clients': {
                  const { data } = await supabase.from('clients').select('*, client_contacts(*)')
                  return JSON.stringify(data, null, 2)
                }
                case 'all_leads': {
                  const { data } = await supabase.from('unvrs_leads').select('*')
                  return JSON.stringify(data, null, 2)
                }
                default:
                  return 'Tipo statistica non riconosciuto'
              }
            }
            
            default:
              return 'Tool non riconosciuto'
          }
        }

        const ownerSystemPrompt = `Sei BRAIN, l'intelligenza centrale di UNVRS Labs. Stai parlando con Emanuele, il boss.

STILE OBBLIGATORIO:
• Risposte BREVI e CONCISE. Massimo 2-3 frasi.
• Vai dritto al punto, niente giri di parole.
• Al primo messaggio: "Ciao boss, che posso fare per te?"
• Chiama SEMPRE Emanuele "boss", MAI "capo"

HAI ACCESSO COMPLETO AL DATABASE:
• USA i tool per CERCARE, CREARE, MODIFICARE, ELIMINARE dati
• Clienti: aziende con P.IVA, indirizzi, contatti
• Contatti: persone associate ai clienti (nome, telefono, email)
• Lead: potenziali clienti in lavorazione
• Progetti: progetti dei clienti
• Conversazioni e messaggi

QUANDO TI CHIEDONO DATI:
• USA SEMPRE il tool search_database per cercare
• NON inventare MAI dati, usa solo quelli dei tool
• Per numeri/email/indirizzi: cerca e fornisci i risultati

QUANDO TI CHIEDONO DI CREARE/MODIFICARE/ELIMINARE:
• USA i tool create_record, update_record, delete_record
• Conferma brevemente l'azione completata

REGOLE:
• NON usare MAI trattini (-, —, –). Usa punti o virgole.
• Rispondi nella stessa lingua del boss.`

        // First API call with tools
        let openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${openaiKey.api_key}`
          },
          body: JSON.stringify({
            model: 'gpt-5-2025-08-07',
            max_completion_tokens: 1000,
            messages: [
              { role: 'system', content: ownerSystemPrompt },
              ...conversationHistory
            ],
            tools: databaseTools,
            tool_choice: 'auto'
          })
        })

        if (!openaiResponse.ok) {
          const error = await openaiResponse.text()
          console.error('[UNVRS.BRAIN] OpenAI error for owner:', error)
          return {
            text: 'Ciao boss! Ho avuto un problema con OpenAI. Riprova tra poco.',
            action: 'error'
          }
        }

        let aiResult = await openaiResponse.json()
        let message = aiResult.choices?.[0]?.message

        // Process tool calls if any
        const toolResults: any[] = []
        while (message?.tool_calls && message.tool_calls.length > 0) {
          console.log('[UNVRS.BRAIN] Processing tool calls:', message.tool_calls.length)
          
          for (const toolCall of message.tool_calls) {
            const args = JSON.parse(toolCall.function.arguments)
            const result = await executeDbTool(toolCall.function.name, args)
            toolResults.push({
              role: 'tool',
              tool_call_id: toolCall.id,
              content: result
            })
          }
          
          // Call API again with tool results
          openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${openaiKey.api_key}`
            },
            body: JSON.stringify({
              model: 'gpt-5-2025-08-07',
              max_completion_tokens: 1000,
              messages: [
                { role: 'system', content: ownerSystemPrompt },
                ...conversationHistory,
                message,
                ...toolResults
              ],
              tools: databaseTools,
              tool_choice: 'auto'
            })
          })
          
          if (!openaiResponse.ok) break
          aiResult = await openaiResponse.json()
          message = aiResult.choices?.[0]?.message
          toolResults.length = 0 // Clear for next iteration if needed
        }

        const aiText = message?.content || 'Ciao boss, come posso aiutarti?'

        console.log('[UNVRS.BRAIN] Owner response:', aiText)

        return {
          text: aiText,
          action: 'continue',
          forceText: isDataRequest
        }
      } catch (error) {
        console.error('[UNVRS.BRAIN] BRAIN owner mode error:', error)
        return {
          text: 'Ciao boss! Ho avuto un errore interno. Riprova.',
          action: 'error'
        }
      }

    case 'hlo':
      try {
        const hloResponse = await fetch(`${supabaseUrl}/functions/v1/unvrs-hlo`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${supabaseKey}`
          },
          body: JSON.stringify({
            conversation_id: conversation.id,
            session_id: session.id,
            user_id: ownerId,
            message: content,
            sender_info: {
              type: 'client',
              client_id: senderInfo.client_id,
              name: senderInfo.name
            },
            channel: originalMessage.channel,
            contact_identifier: originalMessage.contact_identifier
          })
        })
        
        const hloResult = await hloResponse.json()
        console.log('[UNVRS.BRAIN] HLO response:', JSON.stringify(hloResult))
        
        return {
          text: hloResult.response,
          action: hloResult.action
        }
      } catch (error) {
        console.error('[UNVRS.BRAIN] HLO error:', error)
        return {
          text: `Ciao${senderInfo.name ? ` ${senderInfo.name}` : ''}! Ho ricevuto il tuo messaggio. Ti risponderemo a breve.`,
          action: 'queue_for_human'
        }
      }

    case 'switch':
      try {
        const switchResponse = await fetch(`${supabaseUrl}/functions/v1/unvrs-switch`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${supabaseKey}`
          },
          body: JSON.stringify({
            conversation_id: conversation.id,
            session_id: session.id,
            user_id: ownerId,
            message: content,
            sender_info: {
              type: senderInfo.type,
              lead_id: senderInfo.lead_id,
              name: senderInfo.name
            },
            channel: originalMessage.channel,
            contact_identifier: originalMessage.contact_identifier
          })
        })
        
        const switchResult = await switchResponse.json()
        console.log('[UNVRS.BRAIN] SWITCH response:', JSON.stringify(switchResult))
        
        // Handle handoffs
        if (switchResult.action === 'handoff_intake') {
          // Update conversation to INTAKE agent
          await supabase
            .from('unvrs_conversations')
            .update({ current_agent: 'intake' })
            .eq('id', conversation.id)
          
          // End SWITCH session
          await supabase
            .from('unvrs_agent_sessions')
            .update({ ended_at: new Date().toISOString() })
            .eq('id', session.id)
        }
        
        return {
          text: switchResult.response,
          action: switchResult.action
        }
      } catch (error) {
        console.error('[UNVRS.BRAIN] SWITCH error:', error)
        return {
          text: `Ciao! Benvenuto in UNVRS Labs. 👋\nCome posso aiutarti oggi?`,
          action: 'await_response'
        }
      }

    case 'intake':
      // INTAKE agent will be implemented in Phase 2.5
      return {
        text: `Perfetto! Vediamo insieme di cosa hai bisogno. Puoi descrivermi brevemente il tuo progetto?`,
        action: 'collect_requirements'
      }

    default:
      return {
        text: `Messaggio ricevuto. Un operatore ti risponderà a breve.`,
        action: 'queue_for_human'
      }
  }
}
