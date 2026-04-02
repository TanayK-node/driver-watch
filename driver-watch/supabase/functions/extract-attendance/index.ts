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

    const uniqueDriverNames = Array.from(
      new Set(
        (drivers || [])
          .map((d: { driverId: string; name: string }) => (d.name || "").trim())
          .filter(Boolean)
      )
    );

    const driverList = uniqueDriverNames.join("\n");
    const today = new Date().toISOString().slice(0, 10);

    const systemPrompt = `You are an attendance data extractor. This is attendance data from a gate register image.

Assume date = ${today} if a row has no visible date.

Give records in this exact structure and return ONLY JSON:
{
  "rows": [
    {
      "rawName": "Driver Name",
      "date": "YYYY-MM-DD",
      "inTime": "HH:MM",
      "outTime": "HH:MM or empty string"
    }
  ]
}

This is the list of driver names. This list is VERY IMPORTANT.
Use ONLY these names in rawName (exact spelling from the list):
${driverList}

Rules:
- Extract all attendance rows visible in the image.
- rawName must be exactly one name from the list above. Do not invent or alter names.
- If a handwritten name is unclear, choose the closest valid name from the list.
- Convert all dates to YYYY-MM-DD format.
- If date is missing on a row, use ${today}.
- Convert all times to 24-hour HH:MM format.
- If out time is missing, set outTime to empty string "".
- Return ONLY valid JSON. No markdown, no explanation, no extra keys.
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
          model: "google/gemini-2.5-flash",
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
                  text: "Extract attendance and map each driver to ONLY the provided driver list names.",
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
