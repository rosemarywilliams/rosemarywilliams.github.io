/**
 * CLOUDFLARE WORKER CODE
 * ----------------------
 * Copy and paste this entire file into your Cloudflare Worker 'Edit Code' section.
 * 
 * SETUP:
 * 1. Create a KV Namespace named 'GALLERY_KV'.
 * 2. In Worker Settings > Variables, bind 'GALLERY_KV' to that namespace.
 * 3. In Worker Triggers > Routes, add '*yourdomain.com/api/art'.
 */

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const key = "art_gallery_data";

    // Standard CORS headers to allow your website to talk to this worker
    const corsHeaders = {
      "Access-Control-Allow-Origin": "*", // Or set to your specific domain for tighter security
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    };

    // Handle Pre-flight checks (Browser asking permission)
    if (request.method === "OPTIONS") {
      return new Response("OK", { headers: corsHeaders });
    }

    // The API Route
    if (url.pathname.endsWith("/api/art")) {
      
      // GET: Retrieve the list of art
      if (request.method === "GET") {
        const data = await env.GALLERY_KV.get(key);
        return new Response(data || "[]", {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      } 
      
      // POST: Save the list of art
      else if (request.method === "POST") {
        try {
            const data = await request.text();
            // Basic validation to ensure it's JSON
            JSON.parse(data); 
            await env.GALLERY_KV.put(key, data);
            return new Response("Saved", { headers: corsHeaders });
        } catch (err) {
            return new Response("Invalid JSON", { status: 400, headers: corsHeaders });
        }
      }
    }

    return new Response("Not Found", { status: 404, headers: corsHeaders });
  },
};