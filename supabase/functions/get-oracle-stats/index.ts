import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Missing authorization header" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const token = authHeader.replace("Bearer ", "");
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !supabaseKey) {
      return new Response(
        JSON.stringify({ error: "Server configuration error" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const client = createClient(supabaseUrl, supabaseKey);

    const {
      data: { user },
      error: authError,
    } = await client.auth.getUser(token);

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get user statistics
    const { data: stats } = await client
      .from("user_statistics")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle();

    // Get user collections with word details
    const { data: collections } = await client
      .from("user_collections")
      .select(`
        id,
        found_count,
        first_found_at,
        updated_at,
        divine_words (
          id,
          word,
          rarity
        )
      `)
      .eq("user_id", user.id)
      .order("updated_at", { ascending: false });

    // Get all divine words for completion calculation
    const { data: allWords } = await client
      .from("divine_words")
      .select("id, rarity");

    const totalWords = allWords?.length || 0;
    const collectedWords = collections?.length || 0;
    const completionPercent = totalWords > 0 ? Math.floor((collectedWords / totalWords) * 100) : 0;

    // Group collections by rarity
    const ssrCollections = collections?.filter((c) => c.divine_words.rarity === "SSR") || [];
    const srCollections = collections?.filter((c) => c.divine_words.rarity === "SR") || [];

    return new Response(
      JSON.stringify({
        stats: stats || {
          total_spins: 0,
          total_points: 0,
          divine_count: 0,
          reality_count: 0,
          highest_score: 0,
          last_spin_at: null,
        },
        collections: {
          total: collectedWords,
          ssr: ssrCollections.length,
          sr: srCollections.length,
          items: collections || [],
        },
        completion: {
          percent: completionPercent,
          collected: collectedWords,
          total: totalWords,
        },
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
