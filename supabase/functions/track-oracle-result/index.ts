import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.45.0";

interface TrackResultRequest {
  type: "DIVINE" | "REALITY" | "VOID";
  word: string;
  score: number;
}

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

    const body = (await req.json()) as TrackResultRequest;
    const { type, word, score } = body;

    if (!type || !word) {
      return new Response(
        JSON.stringify({ error: "Missing required fields" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Find or get divine word ID
    const { data: divineWord } = await client
      .from("divine_words")
      .select("id")
      .eq("word", word)
      .maybeSingle();

    if (!divineWord && type !== "VOID") {
      return new Response(
        JSON.stringify({ error: "Divine word not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Update or insert user collection
    if (divineWord) {
      const { data: existing } = await client
        .from("user_collections")
        .select("id, found_count")
        .eq("user_id", user.id)
        .eq("divine_word_id", divineWord.id)
        .maybeSingle();

      if (existing) {
        await client
          .from("user_collections")
          .update({
            found_count: existing.found_count + 1,
            updated_at: new Date().toISOString(),
          })
          .eq("id", existing.id);
      } else {
        await client.from("user_collections").insert({
          user_id: user.id,
          divine_word_id: divineWord.id,
          found_count: 1,
          first_found_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });
      }
    }

    // Update user statistics
    const { data: stats } = await client
      .from("user_statistics")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle();

    const points = type === "DIVINE" ? 20 : type === "REALITY" ? 5 : 1;
    const divineIncrement = type === "DIVINE" ? 1 : 0;
    const realityIncrement = type === "REALITY" ? 1 : 0;

    if (stats) {
      await client
        .from("user_statistics")
        .update({
          total_spins: stats.total_spins + 1,
          total_points: stats.total_points + points,
          divine_count: stats.divine_count + divineIncrement,
          reality_count: stats.reality_count + realityIncrement,
          highest_score: Math.max(stats.highest_score, score),
          last_spin_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", stats.id);
    } else {
      await client.from("user_statistics").insert({
        user_id: user.id,
        total_spins: 1,
        total_points: points,
        divine_count: divineIncrement,
        reality_count: realityIncrement,
        highest_score: score,
        last_spin_at: new Date().toISOString(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: "Oracle result tracked successfully",
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
