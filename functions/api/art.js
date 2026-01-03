export async function onRequest(context) {
  // 1. Setup
  const { request, env } = context;
  const key = "art_gallery_data";

  // 2. Handle CORS (Allows your website to talk to this backend)
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*", 
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };

  if (request.method === "OPTIONS") {
    return new Response("OK", { headers: corsHeaders });
  }

  // 3. GET Request: Someone visits art.html (Loading the gallery)
  if (request.method === "GET") {
    // We look inside the KV (memory) for the data
    const data = await env.GALLERY_KV.get(key);
    return new Response(data || "[]", {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // 4. POST Request: You click "Save" on editart.html
  if (request.method === "POST") {
    try {
      const data = await request.text();
      // Save the new list into the KV (memory)
      await env.GALLERY_KV.put(key, data);
      return new Response("Saved", { headers: corsHeaders });
    } catch (err) {
      return new Response("Error saving", { status: 500, headers: corsHeaders });
    }
  }

  return new Response("Method not allowed", { status: 405, headers: corsHeaders });
}