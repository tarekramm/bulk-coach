// Cloudflare Workers static assets entry point.
// Cloud sync intentionally remains disabled until Cloudflare Access and D1 are configured.
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname.startsWith("/api/")) {
      return new Response(JSON.stringify({error:"Cloud sync not yet configured. Your tracking data is saved on your iPhone."}), {
        status:503, headers:{"content-type":"application/json","cache-control":"no-store"}
      });
    }
    return env.ASSETS.fetch(request);
  }
};
