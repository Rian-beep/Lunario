export function packTerrain(data) {
  const pack = (g) => {
    if (g.encodedHeights && !g.heights) return g;
    const valid = g.heights.filter((v) => v != null && Number.isFinite(v));
    if (!valid.length)
      throw new Error("Refusing to pack an empty terrain grid");
    let min = Infinity,
      max = -Infinity;
    for (const v of valid) {
      min = Math.min(min, v);
      max = Math.max(max, v);
    }
    const offset = Math.round((min + max) / 2),
      scale = Math.max(0.1, Math.ceil(((max - min) / 65500) * 10) / 10),
      bytes = Buffer.alloc(g.heights.length * 2);
    g.heights.forEach((v, i) =>
      bytes.writeInt16LE(
        v == null || !Number.isFinite(v)
          ? -32768
          : Math.round((v - offset) / scale),
        i * 2,
      ),
    );
    const meta = { ...g };
    delete meta.heights;
    return {
      ...meta,
      encodedHeights: bytes.toString("base64"),
      heightOffsetM: offset,
      heightScaleM: scale,
    };
  };
  return {
    ...data,
    overview: pack(data.overview),
    patches: data.patches.map(pack),
  };
}
