import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'
import { corsHeaders } from '../_shared/cors.ts'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    // Use service role to bypass RLS for saving tokens
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const url = new URL(req.url)
    let action = url.searchParams.get('action')

    // Get Instagram app credentials from environment
    const appId = Deno.env.get('INSTAGRAM_APP_ID')
    const appSecret = Deno.env.get('INSTAGRAM_APP_SECRET')

    if (!appId || !appSecret) {
      console.error('Instagram app not configured')
      return new Response(
        JSON.stringify({ error: 'Instagram app not configured. Please add INSTAGRAM_APP_ID and INSTAGRAM_APP_SECRET to secrets.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const redirectUri = `${Deno.env.get('SUPABASE_URL')}/functions/v1/instagram-oauth?action=callback`

    // Try to read JSON body (for calls via supabase.functions.invoke)
    let body: any = null
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      try {
        body = await req.json()
      } catch (_) {
        // ignore if no JSON body
      }
    }

    if (!action && body && typeof body.action === 'string') {
      action = body.action
    }

    console.log('Instagram OAuth request:', { method: req.method, action })

    // Start OAuth flow
    if (action === 'start') {
      let userId = url.searchParams.get('user_id') as string | null
      if (!userId && body && typeof body.user_id === 'string') {
        userId = body.user_id
      }

      if (!userId) {
        return new Response(
          JSON.stringify({ error: 'Missing user_id' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      const origin = req.headers.get('origin') || req.headers.get('referer')?.split('/').slice(0, 3).join('/') || ''
      const stateData = `${userId}|${origin}`

      const authUrl = `https://www.facebook.com/v21.0/dialog/oauth?client_id=${appId}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=instagram_basic,instagram_content_publish,pages_show_list,pages_read_engagement&response_type=code&state=${encodeURIComponent(stateData)}`

      return new Response(
        JSON.stringify({ authUrl }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Handle OAuth callback
    if (action === 'callback') {
      const code = url.searchParams.get('code')
      const state = url.searchParams.get('state')
      const fbError = url.searchParams.get('error')

      // If Facebook returned an error (user denied permissions)
      if (fbError) {
        const errorDesc = url.searchParams.get('error_description') || fbError
        console.error('Facebook OAuth denied:', fbError, errorDesc)
        const [, appOrigin] = decodeURIComponent(state || '').split('|')
        const redirectUrl = appOrigin || 'https://boss.unvrslabs.dev'
        return Response.redirect(`${redirectUrl}/ai-social/connection?error=${encodeURIComponent(errorDesc)}`, 302)
      }

      if (!code || !state) {
        return new Response(
          JSON.stringify({ error: 'Invalid callback parameters' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      const [userId, appOrigin] = decodeURIComponent(state).split('|')
      const redirectUrl = appOrigin || 'https://boss.unvrslabs.dev'

      // Exchange code for Facebook access token
      const tokenResponse = await fetch(`https://graph.facebook.com/v21.0/oauth/access_token?client_id=${appId}&client_secret=${appSecret}&code=${code}&redirect_uri=${encodeURIComponent(redirectUri)}`)

      if (!tokenResponse.ok) {
        const text = await tokenResponse.text()
        console.error('Token exchange failed:', text)
        return Response.redirect(`${redirectUrl}/ai-social/connection?error=${encodeURIComponent('Token exchange failed: ' + text.slice(0, 200))}`, 302)
      }

      const tokenData = await tokenResponse.json()
      const userAccessToken = tokenData.access_token
      console.log('Facebook token received for user:', userId)

      // Get FB user info
      const meRes = await fetch(`https://graph.facebook.com/v21.0/me?fields=id,name&access_token=${userAccessToken}`)
      const meData = await meRes.json()
      console.log('Facebook user:', JSON.stringify(meData))

      // Get user's Facebook pages (with pagination)
      let allPages: any[] = []
      let pagesUrl: string = `https://graph.facebook.com/v21.0/me/accounts?limit=100&access_token=${userAccessToken}`
      while (pagesUrl) {
        const pagesResponse = await fetch(pagesUrl)
        if (!pagesResponse.ok) {
          const pagesErr = await pagesResponse.text()
          console.error('me/accounts failed:', pagesErr)
          break
        }
        const pagesData = await pagesResponse.json()
        if (pagesData.data) allPages = allPages.concat(pagesData.data)
        pagesUrl = pagesData.paging?.next || ''
      }

      console.log(`=== FACEBOOK PAGES FOUND via me/accounts: ${allPages.length} ===`)
      for (const p of allPages) {
        console.log(`  Page: "${p.name}" id=${p.id}`)
      }

      // Also try to directly access known page IDs that might not appear in me/accounts
      // This handles "New Pages Experience" pages that sometimes don't show in me/accounts
      const knownPageIds = ['976286265579141'] // Energizzo
      for (const knownId of knownPageIds) {
        const alreadyFound = allPages.some(p => p.id === knownId)
        if (!alreadyFound) {
          // Try getting page token directly
          const directRes = await fetch(`https://graph.facebook.com/v21.0/${knownId}?fields=name,access_token,instagram_business_account&access_token=${userAccessToken}`)
          if (directRes.ok) {
            const directData = await directRes.json()
            console.log(`Direct page fetch for ${knownId}:`, JSON.stringify(directData))
            if (directData.access_token) {
              allPages.push({
                id: knownId,
                name: directData.name || 'Direct Page',
                access_token: directData.access_token,
              })
              console.log(`  Added page "${directData.name}" via direct fetch`)
            }
          } else {
            const errText = await directRes.text()
            console.error(`Direct fetch for page ${knownId} failed:`, errText)
          }
        }
      }

      // Also try getting ALL pages the user token can see via /me/accounts with different fields
      if (allPages.length === 0) {
        const retryRes = await fetch(`https://graph.facebook.com/v21.0/${meData.id}/accounts?limit=100&access_token=${userAccessToken}`)
        if (retryRes.ok) {
          const retryData = await retryRes.json()
          console.log('Retry with /id/accounts:', JSON.stringify(retryData))
          if (retryData.data) allPages = allPages.concat(retryData.data)
        }
      }

      // Process each page: find Instagram Business Accounts
      let connectedCount = 0
      const debugInfo: string[] = []

      for (const page of allPages) {
        const pageId = page.id
        const pageAccessToken = page.access_token
        const pageName = page.name || 'Instagram Account'

        const igRes = await fetch(`https://graph.facebook.com/v21.0/${pageId}?fields=instagram_business_account&access_token=${pageAccessToken}`)
        if (!igRes.ok) {
          const err = await igRes.text()
          console.error(`Page "${pageName}" (${pageId}): IG query failed:`, err)
          debugInfo.push(`${pageName}: IG query failed`)
          continue
        }

        const igData = await igRes.json()
        const igId = igData.instagram_business_account?.id
        console.log(`Page "${pageName}" (${pageId}): ig_business_account = ${igId || 'NONE'}`)

        // Always save the Facebook page connection
        const { data: existingFb } = await supabaseClient
          .from('api_keys')
          .select('id')
          .eq('user_id', userId)
          .eq('provider', 'facebook')
          .eq('owner_id', pageId)
          .maybeSingle()

        if (existingFb) {
          await supabaseClient
            .from('api_keys')
            .update({ api_key: pageAccessToken, label: pageName })
            .eq('id', existingFb.id)
          debugInfo.push(`FB ${pageName}: updated`)
        } else {
          await supabaseClient
            .from('api_keys')
            .insert({
              user_id: userId,
              provider: 'facebook',
              api_key: pageAccessToken,
              owner_id: pageId,
              label: pageName,
            })
          debugInfo.push(`FB ${pageName} (${pageId}): connected!`)
        }

        if (!igId) {
          debugInfo.push(`${pageName}: no IG business account`)
          continue
        }

        // Upsert Instagram connection
        const { data: existing } = await supabaseClient
          .from('api_keys')
          .select('id')
          .eq('user_id', userId)
          .eq('provider', 'instagram')
          .eq('owner_id', igId)
          .maybeSingle()

        if (existing) {
          const { error: updateError } = await supabaseClient
            .from('api_keys')
            .update({ api_key: pageAccessToken, label: pageName })
            .eq('id', existing.id)
          if (updateError) {
            console.error('Update error:', updateError)
            debugInfo.push(`${pageName}: update failed - ${updateError.message}`)
          } else {
            connectedCount++
            debugInfo.push(`${pageName} (${igId}): updated`)
          }
        } else {
          const { error: insertError } = await supabaseClient
            .from('api_keys')
            .insert({
              user_id: userId,
              provider: 'instagram',
              api_key: pageAccessToken,
              owner_id: igId,
              label: pageName,
            })
          if (insertError) {
            console.error('Insert error:', insertError)
            debugInfo.push(`${pageName}: insert failed - ${insertError.message}`)
          } else {
            connectedCount++
            debugInfo.push(`${pageName} (${igId}): connected!`)
          }
        }
      }

      console.log(`Connected ${connectedCount} account(s). Details:`, debugInfo.join('; '))

      if (connectedCount > 0) {
        return Response.redirect(`${redirectUrl}/ai-social/connection?success=true&connected=${connectedCount}`, 302)
      }

      // No accounts connected — show error with details
      const summary = allPages.length === 0
        ? 'Nessuna pagina Facebook trovata. Assicurati di selezionare le pagine durante l\'autorizzazione.'
        : `Pagine trovate: ${allPages.map(p => p.name).join(', ')}. Nessuna ha un account Instagram Business collegato.`
      return Response.redirect(`${redirectUrl}/ai-social/connection?error=${encodeURIComponent(summary)}`, 302)
    }

    // Debug action
    if (action === 'debug') {
      let userId = url.searchParams.get('user_id') as string | null
      if (!userId && body && typeof body.user_id === 'string') {
        userId = body.user_id
      }
      if (!userId) {
        return new Response(JSON.stringify({ error: 'Missing user_id' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      }

      const { data: keys } = await supabaseClient
        .from('api_keys')
        .select('api_key, label, owner_id')
        .eq('user_id', userId)
        .eq('provider', 'instagram')

      if (!keys || keys.length === 0) {
        return new Response(JSON.stringify({ error: 'No Instagram tokens found' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      }

      const debugResults: any[] = []
      for (const key of keys) {
        const token = key.api_key
        const pagesRes = await fetch(`https://graph.facebook.com/v21.0/me/accounts?limit=100&access_token=${token}`)
        const pagesData = await pagesRes.json()

        const pages: any[] = []
        if (pagesData.data) {
          for (const p of pagesData.data) {
            const igRes = await fetch(`https://graph.facebook.com/v21.0/${p.id}?fields=instagram_business_account,name&access_token=${p.access_token}`)
            const igData = await igRes.json()
            pages.push({
              page_id: p.id,
              page_name: p.name,
              ig_business_account: igData.instagram_business_account?.id || null,
            })
          }
        }

        debugResults.push({
          existing_label: key.label,
          existing_owner_id: key.owner_id,
          pages_visible: pages,
          pages_error: pagesData.error || null,
        })
      }

      return new Response(JSON.stringify({ debug: debugResults }, null, 2), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    return new Response(
      JSON.stringify({ error: 'Invalid action' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Instagram OAuth error:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
