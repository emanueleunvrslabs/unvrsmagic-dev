import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-openclaw-key',
}

// Simple shared secret — set OPENCLAW_BRIDGE_SECRET in Supabase secrets
const EXPECTED_SECRET = Deno.env.get('OPENCLAW_BRIDGE_SECRET') ?? 'openclaw-bridge-secret'

interface MessagePayload {
  type: 'message'
  channel: string          // 'telegram' | 'whatsapp'
  contact_identifier: string
  contact_name?: string
  content: string
  direction: 'inbound' | 'outbound'
  content_type?: string    // 'text' | 'image' | 'voice'
  media_url?: string
  agent_name?: string
  metadata?: Record<string, any>
}

interface LeadPayload {
  type: 'lead'
  name?: string
  email?: string
  phone?: string
  company?: string
  source_channel?: string
  notes?: string
  status?: string          // 'new' | 'qualified' | 'converted'
  metadata?: Record<string, any>
}

interface ImagePayload {
  type: 'image'
  title: string
  prompt: string
  status: 'completed' | 'processing' | 'failed'
  media_url?: string
  thumbnail_url?: string
  metadata?: Record<string, any>
}

type BridgePayload = MessagePayload | LeadPayload | ImagePayload

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  // Auth check
  const incomingKey = req.headers.get('x-openclaw-key')
  if (incomingKey !== EXPECTED_SECRET) {
    return new Response(JSON.stringify({ ok: false, error: 'Unauthorized' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Get owner user_id
    const { data: ownerRole } = await supabase
      .from('user_roles')
      .select('user_id')
      .eq('role', 'owner')
      .single()

    if (!ownerRole) {
      return new Response(JSON.stringify({ ok: false, error: 'No owner configured' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const userId = ownerRole.user_id
    const body: BridgePayload = await req.json()

    if (body.type === 'message') {
      const msg = body as MessagePayload

      // Upsert conversation
      const { data: existingConv } = await supabase
        .from('unvrs_conversations')
        .select('id')
        .eq('channel', msg.channel)
        .eq('contact_identifier', msg.contact_identifier)
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      let conversationId: string

      if (existingConv) {
        conversationId = existingConv.id
        await supabase
          .from('unvrs_conversations')
          .update({
            last_message_at: new Date().toISOString(),
            status: 'active',
            contact_name: msg.contact_name ?? undefined,
            current_agent: msg.agent_name ?? undefined,
          })
          .eq('id', conversationId)
      } else {
        const { data: newConv, error } = await supabase
          .from('unvrs_conversations')
          .insert({
            channel: msg.channel,
            contact_identifier: msg.contact_identifier,
            contact_name: msg.contact_name ?? null,
            current_agent: msg.agent_name ?? null,
            status: 'active',
            last_message_at: new Date().toISOString(),
            user_id: userId,
            metadata: msg.metadata ?? null,
          })
          .select('id')
          .single()
        if (error) throw error
        conversationId = newConv.id
      }

      // Insert message
      await supabase.from('unvrs_messages').insert({
        conversation_id: conversationId,
        content: msg.content,
        direction: msg.direction,
        content_type: msg.content_type ?? 'text',
        media_url: msg.media_url ?? null,
        processed_by_agent: msg.agent_name ?? null,
        user_id: userId,
        metadata: msg.metadata ?? null,
      })

      return new Response(JSON.stringify({ ok: true, conversation_id: conversationId }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (body.type === 'lead') {
      const lead = body as LeadPayload

      const { data, error } = await supabase
        .from('unvrs_leads')
        .insert({
          name: lead.name ?? null,
          email: lead.email ?? null,
          phone: lead.phone ?? null,
          company: lead.company ?? null,
          source_channel: lead.source_channel ?? null,
          notes: lead.notes ?? null,
          status: lead.status ?? 'new',
          first_contact_at: new Date().toISOString(),
          user_id: userId,
          metadata: lead.metadata ?? null,
        })
        .select('id')
        .single()

      if (error) throw error

      return new Response(JSON.stringify({ ok: true, lead_id: data.id }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (body.type === 'image') {
      const img = body as ImagePayload

      const { data, error } = await supabase
        .from('ai_social_content')
        .insert({
          title: img.title,
          type: 'image',
          prompt: img.prompt,
          status: img.status,
          media_url: img.media_url ?? null,
          thumbnail_url: img.thumbnail_url ?? null,
          user_id: userId,
          metadata: img.metadata ?? null,
        })
        .select('id')
        .single()

      if (error) throw error

      return new Response(JSON.stringify({ ok: true, content_id: data.id }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    return new Response(JSON.stringify({ ok: false, error: 'Unknown payload type' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  } catch (err) {
    console.error('[OPENCLAW-BRIDGE] Error:', err)
    return new Response(JSON.stringify({ ok: false, error: err instanceof Error ? err.message : 'Unknown error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
