import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface SignupRequest {
  first_name: string
  last_name: string
  birth_date: string
  whatsapp_number: string
  ref_code: string
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    const body: SignupRequest = await req.json()
    const { first_name, last_name, birth_date, whatsapp_number, ref_code } = body

    // Validate required fields
    if (!first_name || !last_name || !birth_date || !whatsapp_number || !ref_code) {
      return new Response(
        JSON.stringify({ error: 'All fields are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Validate field lengths
    if (first_name.length > 100 || last_name.length > 100) {
      return new Response(
        JSON.stringify({ error: 'Name fields must be less than 100 characters' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Validate phone number format (international format)
    const phoneRegex = /^\+[1-9]\d{6,14}$/
    const cleanedPhone = whatsapp_number.replace(/[\s\-()]/g, '')
    if (!phoneRegex.test(cleanedPhone)) {
      return new Response(
        JSON.stringify({ error: 'Invalid phone number format. Use international format (e.g., +1234567890)' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Validate birth_date format (YYYY-MM-DD)
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/
    if (!dateRegex.test(birth_date)) {
      return new Response(
        JSON.stringify({ error: 'Invalid date format. Use YYYY-MM-DD' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Validate date is a valid date
    const parsedDate = new Date(birth_date)
    if (isNaN(parsedDate.getTime())) {
      return new Response(
        JSON.stringify({ error: 'Invalid date' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Validate date is not in the future
    if (parsedDate > new Date()) {
      return new Response(
        JSON.stringify({ error: 'Birth date cannot be in the future' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Look up user_id from ref_code using the secure function
    const { data: userId, error: lookupError } = await supabase.rpc('lookup_user_by_ref_code', {
      ref_code_param: ref_code
    })

    if (lookupError || !userId) {
      console.error('Ref code lookup error:', lookupError)
      return new Response(
        JSON.stringify({ error: 'Invalid referral code' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Rate limiting: Check if this phone number has submitted recently (last hour)
    const oneHourAgo = new Date(Date.now() - 3600000).toISOString()
    const { count, error: countError } = await supabase
      .from('memora_contacts')
      .select('*', { count: 'exact', head: true })
      .eq('whatsapp_number', cleanedPhone)
      .gte('created_at', oneHourAgo)

    if (countError) {
      console.error('Rate limit check error:', countError)
    } else if (count && count >= 3) {
      return new Response(
        JSON.stringify({ error: 'Too many submissions. Please try again later.' }),
        { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Check for duplicate entry (same user + same phone)
    const { data: existing } = await supabase
      .from('memora_contacts')
      .select('id')
      .eq('user_id', userId)
      .eq('whatsapp_number', cleanedPhone)
      .single()

    if (existing) {
      return new Response(
        JSON.stringify({ error: 'This phone number is already registered' }),
        { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Insert the contact
    const { data: contact, error: insertError } = await supabase
      .from('memora_contacts')
      .insert({
        user_id: userId,
        first_name: first_name.trim().substring(0, 100),
        last_name: last_name.trim().substring(0, 100),
        birth_date,
        whatsapp_number: cleanedPhone
      })
      .select()
      .single()

    if (insertError) {
      console.error('Insert error:', insertError)
      return new Response(
        JSON.stringify({ error: 'Failed to save contact' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log(`[MEMORA] New contact registered: ${contact.id} for user ${userId}`)

    return new Response(
      JSON.stringify({ success: true, id: contact.id }),
      { status: 201, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Memora signup error:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
