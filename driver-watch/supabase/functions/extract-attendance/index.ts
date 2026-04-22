import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { imageBase64, drivers } = await req.json();

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    if (!imageBase64) throw new Error("imageBase64 is required");
    
    // Safely extract and deduplicate driver names
    const uniqueDriverNames = Array.from(
      new Set(
        (drivers || [])
          .map((d: { driverId: string; name: string }) => (d.name || "").trim())
          .filter(Boolean)
      )
    );

    const driverList = uniqueDriverNames.join("\n");
    const today = new Date().toISOString().slice(0, 10);
    
    const systemPrompt = `You are an expert data entry assistant reading a handwritten gate register. 
    
Assume date = ${today} if a row has no visible date.

This is the STRICT, ALLOWED LIST of driver names from my database:
=== DRIVER LIST ===
${driverList}
===================

CRITICAL INSTRUCTION FOR NAME MAPPING:
When you read a handwritten name, you MUST perform a "fuzzy match" against the DRIVER LIST. 
- If the handwritten name is abbreviated (e.g., "Deepak P.").
- If it is missing a middle name (e.g., "Deepak Panhalkar").
- If it is misspelled (e.g., "Depak").
You must STILL output the EXACT full name from the DRIVER LIST. 
DO NOT output the literal handwritten name. If a name is completely illegible and cannot be matched to the list, skip that row entirely.

Give records in this exact structure and return ONLY JSON:
{
  "rows": [
    {
      "rawName": "EXACT MATCH FROM DRIVER LIST",
      "date": "YYYY-MM-DD",
      "inTime": "HH:MM",
      "outTime": "HH:MM or empty string"
    }
  ]
}

Rules:
- Extract all attendance rows visible in the image.
- rawName MUST exactly match a name from the list.
- Convert all dates to YYYY-MM-DD format.
- If date is missing on a row, use ${today}.
- Convert all times to 24-hour HH:MM format.
- If out time is missing, set outTime to empty string "".
- Return ONLY valid JSON.
- If no attendance rows are readable, return {"rows": []}.`;

    const response = await fetch(
      "https://ai.gateway.lovable.dev/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.0-flash",
          response_format: { type: "json_object" }, // Forces strict JSON output
          messages: [
            { role: "system", content: systemPrompt },
            {
              role: "user",
              content: [
                {
                  type: "image_url",
                  image_url: { url: `data:image/jpeg;base64,${imageBase64}` },
                },
                {
                  type: "text",
                  text: "Extract attendance and fuzzy-match every name directly to the provided driver list.",
                },
              ],
            },
          ],
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);

      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded. Please try again in a moment." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "AI credits exhausted. Please add funds in Settings > Workspace > Usage." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({ error: "AI extraction failed" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || "";

    // Parse the JSON from the response (strip markdown code fences if any)
    const jsonStr = content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    let parsed;
    try {
      parsed = JSON.parse(jsonStr);
    } catch {
      console.error("Failed to parse AI response:", content);
      return new Response(
        JSON.stringify({ error: "Could not parse AI response", raw: content }),
        { status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(JSON.stringify(parsed), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("extract-attendance error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});