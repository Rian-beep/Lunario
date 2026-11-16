export const runtime = "nodejs";

/** Local/next-server only. Token stays in navigator/.env.local (gitignored) as CESIUM_ION_TOKEN. */
export async function GET() {
  const token = process.env.CESIUM_ION_TOKEN?.trim();
  const tilesetUrl = process.env.CESIUM_TILESET_URL?.trim() || null;
  if (!token && !tilesetUrl) {
    return Response.json({ error: "missing" }, { status: 404, headers: { "Cache-Control": "no-store" } });
  }
  return Response.json(
    { token: token || null, assetId: 2684829, tilesetUrl },
    { headers: { "Cache-Control": "no-store" } },
  );
}
