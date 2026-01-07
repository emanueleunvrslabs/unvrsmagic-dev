import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";
import { corsHeaders } from '../_shared/cors.ts';

const ARERA_BASE_URL = "https://www.arera.it";
const ARERA_LIST_URL = `${ARERA_BASE_URL}/atti-e-provvedimenti?anno=&numero=&tipologia=Delibera&keyword=&settore=&orderby=&orderbydir=&numelements=25`;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    
    // Verify the request comes from an authenticated user
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized - Missing or invalid authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create a client with the user's auth token to verify their identity
    const anonClient = createClient(supabaseUrl, anonKey, {
      auth: { persistSession: false },
      global: { headers: { Authorization: authHeader } }
    });

    const { data: { user }, error: authError } = await anonClient.auth.getUser();
    if (authError || !user) {
      console.error('Auth error:', authError);
      return new Response(
        JSON.stringify({ error: 'Unauthorized - Invalid token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const userId = user.id;
    console.log(`Authenticated user: ${userId}`);

    // Use service role for database operations
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Verify user has owner role
    const { data: userRole, error: roleError } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', userId)
      .eq('role', 'owner')
      .maybeSingle();

    if (roleError || !userRole) {
      console.error('Role check error:', roleError, 'User role:', userRole);
      return new Response(
        JSON.stringify({ error: 'Forbidden - Owner role required' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse request body for action
    let action = "sync";
    try {
      const bodyText = await req.text();
      if (bodyText) {
        const body = JSON.parse(bodyText);
        action = body.action || "sync";
      }
    } catch {
      // No body or invalid JSON, default to sync
    }

    console.log(`Starting ARERA scraper with action: ${action} for owner: ${userId}`);

    // Get owner's API keys (Anthropic for summarization, Firecrawl for scraping)
    const { data: ownerRole } = await supabase
      .from("user_roles")
      .select("user_id")
      .eq("role", "owner")
      .single();

    if (!ownerRole) {
      throw new Error("Owner not found");
    }

    const { data: apiKeys } = await supabase
      .from("api_keys")
      .select("api_key, provider")
      .eq("user_id", ownerRole.user_id)
      .in("provider", ["anthropic", "firecrawl"]);

    const anthropicKey = apiKeys?.find(k => k.provider === "anthropic")?.api_key;
    const firecrawlKey = apiKeys?.find(k => k.provider === "firecrawl")?.api_key;

    if (!anthropicKey) {
      throw new Error("Anthropic API key not configured");
    }

    // Handle recategorize action
    if (action === "recategorize") {
      return await handleRecategorize(supabase, anthropicKey);
    }

    if (!firecrawlKey) {
      throw new Error("Firecrawl API key not configured");
    }

    // Fetch ARERA delibere list page using Firecrawl (50 items per page)
    console.log("Fetching ARERA delibere via Firecrawl...");
    
    const firecrawlResponse = await fetch("https://api.firecrawl.dev/v1/scrape", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${firecrawlKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        url: ARERA_LIST_URL,
        formats: ["html"],
      }),
    });

    if (!firecrawlResponse.ok) {
      const errText = await firecrawlResponse.text();
      console.error("Firecrawl error:", errText);
      throw new Error(`Failed to fetch ARERA page via Firecrawl: ${firecrawlResponse.status}`);
    }

    const firecrawlData = await firecrawlResponse.json();
    const html = firecrawlData.data?.html || "";
    console.log("HTML fetched via Firecrawl, length:", html.length);

    // Parse delibere from HTML
    const delibere = parseDelibereList(html);
    console.log(`Found ${delibere.length} delibere`);

    // Prima di procedere, cancella tutte le delibere esistenti
    console.log("Clearing existing ARERA delibere before re-synchronizing...");
    const { error: deleteError } = await supabase
      .from("arera_delibere")
      .delete()
      .neq("delibera_code", "");

    if (deleteError) {
      console.error("Error deleting existing delibere:", deleteError);
      throw new Error("Impossibile cancellare le delibere esistenti");
    }

    const results = [];

    for (const delibera of delibere) { // Process all delibere
      let insertedRecord: any = null;

      try {
        console.log(`Processing: ${delibera.code}`);

        // Insert initial record for this deliberation
        const { data: inserted, error: insertError } = await supabase
          .from("arera_delibere")
          .insert({
            user_id: ownerRole.user_id,
            delibera_code: delibera.code,
            publication_date: delibera.date,
            title: delibera.title,
            detail_url: delibera.detailUrl,
            status: "processing",
          })
          .select()
          .single();

        if (insertError) {
          console.error(`Insert error for ${delibera.code}:`, insertError);
          continue;
        }

        insertedRecord = inserted;

        // Fetch detail page via Firecrawl
        const detailHtml = await fetchDetailPage(delibera.detailUrl, firecrawlKey);
        const { description, files } = parseDetailPage(detailHtml);

        // Download files and upload to storage
        const uploadedFiles = [];
        for (const file of files.slice(0, 5)) { // Max 5 files per delibera
          try {
            const fileData = await downloadFile(file.url);
            if (fileData) {
              // Extract extension from original URL or default to pdf
              const urlExtension = file.url.split('.').pop()?.toLowerCase() || 'pdf';
              const extension = ['pdf', 'doc', 'docx', 'xls', 'xlsx'].includes(urlExtension) ? urlExtension : 'pdf';
              const fileName = `${delibera.code.replace(/\//g, "-")}/${file.name}.${extension}`;
              const { data: uploadData, error: uploadError } = await supabase.storage
                .from("arera-files")
                .upload(fileName, fileData, {
                  contentType: file.type || "application/pdf",
                  upsert: true,
                });

              if (!uploadError) {
                const { data: publicUrl } = supabase.storage
                  .from("arera-files")
                  .getPublicUrl(fileName);

                uploadedFiles.push({
                  name: file.name,
                  url: publicUrl.publicUrl,
                  originalUrl: file.url,
                });
              }
            }
          } catch (fileError) {
            console.error(`Error downloading file ${file.name}:`, fileError);
          }
        }

        // Generate summary and detect category with Anthropic
        let summary = "";
        let category = "generale";
        if (description) {
          const aiResult = await generateSummaryAndCategory(anthropicKey, delibera.title, description);
          summary = aiResult.summary;
          category = aiResult.category;
        }

        // Update record
        if (insertedRecord?.id) {
          await supabase
            .from("arera_delibere")
            .update({
              description,
              summary,
              category,
              files: uploadedFiles,
              status: "completed",
            })
            .eq("id", insertedRecord.id);
        }

        results.push({
          code: delibera.code,
          category,
          status: "completed",
          filesCount: uploadedFiles.length,
        });

      } catch (error) {
        console.error(`Error processing ${delibera.code}:`, error);
        const errorMessage = error instanceof Error ? error.message : "Unknown error";

        // Mark this deliberation as failed in the database
        if (insertedRecord?.id) {
          await supabase
            .from("arera_delibere")
            .update({
              status: "error",
              error_message: errorMessage,
            })
            .eq("id", insertedRecord.id);
        }

        results.push({
          code: delibera.code,
          category: "unknown",
          status: "error",
          error: errorMessage,
        });
      }
    }

    // Send emails for new deliberations based on user preferences
    if (results.length > 0) {
      await sendEmailNotifications(
        supabase,
        anthropicKey,
        results.filter(r => r.status === "completed"),
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        totalFound: delibere.length,
        newProcessed: results.length,
        results,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Scraper error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

function parseDelibereList(html: string): Array<{
  code: string;
  date: string;
  title: string;
  detailUrl: string;
}> {
  const delibere: Array<{ code: string; date: string; title: string; detailUrl: string }> = [];
  
  // Pattern per blocchi delibera ARERA - struttura:
  // <a id="atto" href="https://www.arera.it/atti-e-provvedimenti/dettaglio/25/520-25">
  //   <p class="data-atto">25/11/2025</p>
  //   <h3 class="sigla-atto">520/2025/C/rif</h3>
  //   <p class="testo-atto">Titolo della delibera</p>
  // </a>
  
  const attoPattern = /<a[^>]*id="atto"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi;
  const datePattern = /<p[^>]*class="data-atto"[^>]*>([^<]+)<\/p>/i;
  const codePattern = /<h3[^>]*class="sigla-atto"[^>]*>([^<]+)<\/h3>/i;
  const titlePattern = /<p[^>]*class="testo-atto"[^>]*>([^<]+)<\/p>/i;

  let match;
  
  while ((match = attoPattern.exec(html)) !== null) {
    const href = match[1];
    const blockHtml = match[2];
    
    const dateMatch = datePattern.exec(blockHtml);
    const codeMatch = codePattern.exec(blockHtml);
    const titleMatch = titlePattern.exec(blockHtml);
    
    if (codeMatch) {
      const code = codeMatch[1].trim();
      const date = dateMatch ? formatDate(dateMatch[1].trim()) : new Date().toISOString().split("T")[0];
      const title = titleMatch ? titleMatch[1].trim() : code;
      
      delibere.push({
        code,
        date,
        title,
        detailUrl: href.startsWith("http") ? href : `${ARERA_BASE_URL}${href}`,
      });
    }
  }

  console.log(`Parser found ${delibere.length} delibere blocks`);
  return delibere;
}

function formatDate(dateStr: string): string {
  const parts = dateStr.split(/[\/\-]/);
  if (parts.length === 3) {
    const [day, month, year] = parts;
    return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
  }
  return new Date().toISOString().split("T")[0];
}

async function fetchDetailPage(url: string, firecrawlKey: string): Promise<string> {
  const response = await fetch("https://api.firecrawl.dev/v1/scrape", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${firecrawlKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      url: url,
      formats: ["html"],
    }),
  });
  
  if (!response.ok) {
    throw new Error(`Failed to fetch detail page via Firecrawl: ${response.status}`);
  }
  
  const data = await response.json();
  return data.data?.html || "";
}

function parseDetailPage(html: string): { description: string; files: Array<{ name: string; url: string; type?: string }> } {
  let description = "";
  const files: Array<{ name: string; url: string; type?: string }> = [];

  // Extract description from content area
  const contentMatch = /<div[^>]*class="[^"]*content[^"]*"[^>]*>([\s\S]*?)<\/div>/i.exec(html);
  if (contentMatch) {
    description = contentMatch[1]
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 5000);
  }

  // Extract PDF/document links
  const filePattern = /<a[^>]*href="([^"]*\.(pdf|doc|docx|xls|xlsx))"[^>]*>([^<]*)<\/a>/gi;
  let fileMatch;
  
  while ((fileMatch = filePattern.exec(html)) !== null) {
    const url = fileMatch[1].startsWith("http") ? fileMatch[1] : `${ARERA_BASE_URL}${fileMatch[1]}`;
    const name = fileMatch[3].trim() || `document.${fileMatch[2]}`;
    
    if (!files.find(f => f.url === url)) {
      files.push({
        name,
        url,
        type: `application/${fileMatch[2]}`,
      });
    }
  }

  return { description, files };
}

async function downloadFile(url: string, retries = 2): Promise<Uint8Array | null> {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000); // 30s timeout
      
      const response = await fetch(url, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          "Accept": "application/pdf,*/*",
          "Accept-Language": "it-IT,it;q=0.9,en-US;q=0.8,en;q=0.7",
        },
        signal: controller.signal,
      });
      
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        console.error(`Failed to download file (attempt ${attempt + 1}): ${response.status}`);
        if (attempt < retries) {
          await new Promise(r => setTimeout(r, 1000 * (attempt + 1))); // Backoff
          continue;
        }
        return null;
      }
      
      const arrayBuffer = await response.arrayBuffer();
      return new Uint8Array(arrayBuffer);
    } catch (error) {
      console.error(`Download error (attempt ${attempt + 1}):`, error);
      if (attempt < retries) {
        await new Promise(r => setTimeout(r, 1000 * (attempt + 1))); // Backoff
        continue;
      }
      return null;
    }
  }
  return null;
}

async function generateSummaryAndCategory(apiKey: string, title: string, description: string): Promise<{ summary: string; category: string }> {
  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 600,
        messages: [
          {
            role: "user",
            content: `Sei un esperto di regolamentazione energetica italiana. Analizza questa delibera ARERA.

COMPITO 1 - CATEGORIA: Determina la categoria principale tra queste opzioni:
- elettricita: Regolazione, distribuzione, trasmissione, tariffe, continuità del servizio elettrico
- gas: Norme, regolamentazioni e tariffe gas naturale, distribuzione, rete, concessioni
- acqua: Servizio idrico integrato, tariffe qualità servizio idrico
- rifiuti: Gestione rifiuti urbani, tariffazione, qualità servizio, ciclo rifiuti
- teleriscaldamento: Riscaldamento a rete e sue regolamentazioni
- generale: Aspetti interni ARERA, regolamenti generali, organizzazione, bilancio, procedure trasversali

COMPITO 2 - SOMMARIO: Crea un sommario in esattamente 3 bullet points concisi in italiano.

Titolo: ${title}

Contenuto: ${description.slice(0, 3000)}

Rispondi in questo formato esatto:
CATEGORIA: [nome_categoria]
SOMMARIO:
• [bullet 1]
• [bullet 2]
• [bullet 3]`,
          },
        ],
      }),
    });

    if (!response.ok) {
      console.error("Anthropic API error:", await response.text());
      return { summary: "", category: "generale" };
    }

    const data = await response.json();
    const text = data.content?.[0]?.text || "";
    
    // Parse response
    const categoryMatch = text.match(/CATEGORIA:\s*(\w+)/i);
    const category = categoryMatch ? categoryMatch[1].toLowerCase() : "generale";
    
    // Validate category
    const validCategories = ["elettricita", "gas", "acqua", "rifiuti", "teleriscaldamento", "generale"];
    const finalCategory = validCategories.includes(category) ? category : "generale";
    
    // Extract summary (everything after "SOMMARIO:")
    const summaryMatch = text.match(/SOMMARIO:\s*([\s\S]*)/i);
    const summary = summaryMatch ? summaryMatch[1].trim() : "";
    
    console.log(`Category detected: ${finalCategory} for delibera: ${title.slice(0, 50)}`);
    
    return { summary, category: finalCategory };
  } catch (error) {
    console.error("Summary/category generation error:", error);
    return { summary: "", category: "generale" };
  }
}

// Handle recategorization of existing deliberations
async function handleRecategorize(supabase: any, anthropicKey: string): Promise<Response> {
  console.log("Starting recategorization of existing deliberations...");
  
  // Get all deliberations that need categorization (either null category or 'generale')
  const { data: delibere, error } = await supabase
    .from("arera_delibere")
    .select("id, delibera_code, title, description, summary")
    .or("category.is.null,category.eq.generale")
    .eq("status", "completed");
  
  if (error) {
    console.error("Error fetching deliberations:", error);
    return new Response(
      JSON.stringify({ error: "Failed to fetch deliberations" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
  
  console.log(`Found ${delibere?.length || 0} deliberations to recategorize`);
  
  let updated = 0;
  const results: Array<{ code: string; category: string; status: string }> = [];
  
  for (const delibera of (delibere || [])) {
    try {
      // Use title and description to detect category
      const content = `${delibera.title}\n\n${delibera.description || delibera.summary || ""}`;
      
      const category = await detectCategory(anthropicKey, delibera.title, content);
      
      // Update the deliberation with the detected category
      const { error: updateError } = await supabase
        .from("arera_delibere")
        .update({ category })
        .eq("id", delibera.id);
      
      if (!updateError) {
        updated++;
        results.push({ code: delibera.delibera_code, category, status: "success" });
        console.log(`Updated ${delibera.delibera_code}: category = ${category}`);
      } else {
        results.push({ code: delibera.delibera_code, category: "error", status: "failed" });
      }
      
      // Small delay to avoid rate limiting
      await new Promise(r => setTimeout(r, 500));
      
    } catch (error) {
      console.error(`Error recategorizing ${delibera.delibera_code}:`, error);
      results.push({ code: delibera.delibera_code, category: "error", status: "failed" });
    }
  }
  
  return new Response(
    JSON.stringify({
      success: true,
      total: delibere?.length || 0,
      updated,
      results,
    }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
}

// Detect category only (without generating summary)
async function detectCategory(apiKey: string, title: string, content: string): Promise<string> {
  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 100,
        messages: [
          {
            role: "user",
            content: `Sei un esperto di regolamentazione energetica italiana. Analizza questa delibera ARERA e determina la categoria principale.

Categorie disponibili:
- elettricita: Regolazione, distribuzione, trasmissione, tariffe, continuità del servizio elettrico
- gas: Norme, regolamentazioni e tariffe gas naturale, distribuzione, rete, concessioni
- acqua: Servizio idrico integrato, tariffe qualità servizio idrico
- rifiuti: Gestione rifiuti urbani, tariffazione, qualità servizio, ciclo rifiuti
- teleriscaldamento: Riscaldamento a rete e sue regolamentazioni
- generale: Aspetti interni ARERA, regolamenti generali, organizzazione, bilancio, procedure trasversali

Titolo: ${title}

Contenuto: ${content.slice(0, 2000)}

Rispondi con UNA SOLA PAROLA: il nome della categoria (elettricita, gas, acqua, rifiuti, teleriscaldamento, o generale).`,
          },
        ],
      }),
    });

    if (!response.ok) {
      console.error("Anthropic API error:", await response.text());
      return "generale";
    }

    const data = await response.json();
    const text = data.content?.[0]?.text?.toLowerCase().trim() || "generale";
    
    // Validate category
    const validCategories = ["elettricita", "gas", "acqua", "rifiuti", "teleriscaldamento", "generale"];
    return validCategories.includes(text) ? text : "generale";
  } catch (error) {
    console.error("Category detection error:", error);
    return "generale";
  }
}

// Helper to safely convert ArrayBuffer to base64 without exceeding call stack
function arrayBufferToBase64(buffer: ArrayBuffer): string {
  let binary = "";
  const bytes = new Uint8Array(buffer);
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

// Determine if a delibera is relevant for wholesale energy/gas sellers and tariff changes
async function isRelevantForWholesaleTariffs(
  apiKey: string,
  title: string,
  content: string,
): Promise<boolean> {
  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 50,
        messages: [
          {
            role: "user",
            content:
`Sei un esperto di regolazione energetica italiana.
Devi decidere se questa delibera interessa direttamente VENDITORI GROSSISTI e trader di energia elettrica e gas (non i clienti finali retail, non solo distributori/TSO) e in particolare se riguarda corrispettivi, prezzi o condizioni economiche/tariffarie applicate ai venditori o al mercato all'ingrosso.

Esempi di delibere RILEVANTI:
- delibere che fissano o modificano corrispettivi a carico delle imprese di vendita/venditori grossisti;
- delibere che definiscono o aggiornano tariffe, prezzi o partite economiche su mercati all'ingrosso di energia elettrica o gas;
- delibere simili a quelle indicate come riferimento dall'utente, che trattano cambi tariffari per fornitori/venditori grossisti.

NON considerare rilevanti le delibere che riguardano SOLO:
- distributori di rete,
- operatori di trasmissione,
- gestori di distribuzione,
- aspetti organizzativi interni, ricorsi, contenziosi, adempimenti puramente formali.

In caso di dubbio MA se vi è qualsiasi impatto economico su venditori grossisti o imprese di vendita, rispondi SI.

Titolo: ${title}

Testo: ${content.slice(0, 2000)}

Rispondi SOLO con una parola: "SI" se è rilevante per venditori grossisti e tariffe, altrimenti "NO".`,
          },
        ],
      }),
    });

    if (!response.ok) {
      console.error("Anthropic relevance API error:", await response.text());
      return false;
    }

    const data = await response.json();
    const text = (data.content?.[0]?.text || "").trim().toUpperCase();
    return text.startsWith("SI");
  } catch (error) {
    console.error("Wholesale relevance detection error:", error);
    return false;
  }
}

// Send email notifications to users based on their category preferences
async function sendEmailNotifications(
  supabase: any,
  anthropicKey: string,
  newDelibere: Array<{ code: string; category: string; status: string; filesCount?: number }>,
): Promise<void> {
  console.log(`Sending email notifications for ${newDelibere.length} new delibere...`);
  
  try {
    // Get all active email preferences
    const { data: preferences, error: prefError } = await supabase
      .from("arera_email_preferences")
      .select("*")
      .eq("active", true);

    if (prefError || !preferences || preferences.length === 0) {
      console.log("No email preferences found or error:", prefError);
      return;
    }

    // Get owner's Resend API key
    const { data: ownerRole } = await supabase
      .from("user_roles")
      .select("user_id")
      .eq("role", "owner")
      .single();

    if (!ownerRole) {
      console.error("Owner not found for Resend API key");
      return;
    }

    const { data: resendKey } = await supabase
      .from("api_keys")
      .select("api_key")
      .eq("user_id", ownerRole.user_id)
      .eq("provider", "resend")
      .single();

    if (!resendKey?.api_key) {
      console.log("Resend API key not configured, skipping email notifications");
      return;
    }

    // Get full delibera details for the new ones
    const deliberaCodes = newDelibere.map(d => d.code);
    const { data: fullDelibere, error: delibereError } = await supabase
      .from("arera_delibere")
      .select("*")
      .in("delibera_code", deliberaCodes);

    if (delibereError || !fullDelibere) {
      console.error("Error fetching full delibera details:", delibereError);
      return;
    }

    // Pre-filter delibere relevant for wholesale sellers and tariff changes
    const relevanceMap = new Map<string, boolean>();
    for (const d of fullDelibere) {
      const sector = (d.category || "generale") as string;
      // Siamo interessati solo a elettricità e gas
      if (sector !== "elettricita" && sector !== "gas") {
        relevanceMap.set(d.delibera_code, false);
        continue;
      }
      const content = `${d.title}\n\n${d.summary || d.description || ""}`;
      const isRelevant = await isRelevantForWholesaleTariffs(
        anthropicKey,
        d.title as string,
        content,
      );
      relevanceMap.set(d.delibera_code, isRelevant);
      // Piccola pausa per evitare rate limiting
      await new Promise(r => setTimeout(r, 200));
    }

    // Send an email per delibera to each user based on their category preferences
    const categoryLabels: Record<string, string> = {
      elettricita: "Elettricità",
      gas: "Gas",
      acqua: "Acqua",
      rifiuti: "Rifiuti",
      teleriscaldamento: "Teleriscaldamento",
      generale: "Generale",
    };

    for (const pref of preferences) {
      const userCategories: string[] = pref.categories || [];

      // All delibere matching at least one of the user's categories AND relevant for wholesale
      const matchingDelibere = fullDelibere.filter((d: any) => {
        const cat = (d.category || "generale") as string;
        if (!userCategories.includes(cat)) return false;
        const isRelevant = relevanceMap.get(d.delibera_code) ?? false;
        return isRelevant;
      });

      if (matchingDelibere.length === 0) {
        console.log(`No matching delibere for user ${pref.email}`);
        continue;
      }

      for (const d of matchingDelibere) {
        const cat = (d.category || "generale") as string;

        const emailHtml = `
          <div style="font-family: Arial, sans-serif; max-width: 700px; margin: 0 auto;">
            <h2 style="color:#0f172a;font-size:18px;margin:0 0 12px 0;">${d.title}</h2>
            ${d.summary ? `<div style="color:#475569;font-size:14px;white-space:pre-wrap;margin-bottom:16px;">${d.summary}</div>` : ""}
            ${d.detail_url ? `<a href="${d.detail_url}" style="color:#2563eb;font-size:14px;">Apri la delibera originale sul sito ARERA →</a>` : ""}
          </div>
        `;

        // No attachments: email now only contains the summary and original ARERA link.

        // Send email via Resend (one per delibera)
        try {
          const resendResponse = await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: {
              "Authorization": `Bearer ${resendKey.api_key}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              from: "UNVRS LABS <emanuele@unvrslabs.dev>",
              to: [pref.email],
              // Subject must be the original title of the delibera
              subject: d.title as string,
              html: emailHtml,
            }),
          });

          if (resendResponse.ok) {
            console.log(`Email sent successfully to ${pref.email} for delibera ${d.delibera_code}`);
          } else {
            const errorData = await resendResponse.text();
            console.error(`Failed to send email to ${pref.email} for delibera ${d.delibera_code}:`, errorData);
          }
        } catch (emailError) {
          console.error(`Error sending email to ${pref.email} for delibera ${d.delibera_code}:`, emailError);
        }
      }
    }
  } catch (error) {
    console.error("Error in sendEmailNotifications:", error);
  }
}
