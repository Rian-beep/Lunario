export const ION_MOON_ASSET_ID = "2684829";
export const DEFAULT_DRACO_DECODER_URL = "/data/equipment/draco/";

export type IonCredentials = { accessToken: string; decoderUrl: string };
export type IonConfigurationResult =
  | { ok: true; value: IonCredentials }
  | { ok: false; error: string };

/** Runtime input only. Does not read environment variables, URLs or browser storage. */
export function validateIonConfiguration(input: unknown): IonConfigurationResult {
  if (!input || typeof input !== "object" || Array.isArray(input))
    return { ok: false, error: "Enter a Cesium Ion access token to enable online Moon tiles." };
  const fields = input as Record<string, unknown>;
  if (Object.keys(fields).some(key => key !== "accessToken" && key !== "decoderUrl"))
    return { ok: false, error: "Unknown Ion configuration option. Use accessToken and optional decoderUrl." };
  if (typeof fields.accessToken !== "string" || !fields.accessToken.trim() || /\s/.test(fields.accessToken))
    return { ok: false, error: "Enter a nonempty Cesium Ion access token without whitespace." };
  const decoderUrl = fields.decoderUrl ?? DEFAULT_DRACO_DECODER_URL;
  if (typeof decoderUrl !== "string" || !decoderUrl.endsWith("/") || /[\s?#\\]/.test(decoderUrl))
    return { ok: false, error: "The Draco decoder URL must be a directory ending in / without a query or fragment." };
  // Decoder assets are public files; disallow credentials, arbitrary schemes and protocol-relative URLs.
  if (!/^\/(?!\/)/.test(decoderUrl)) {
    try {
      const url = new URL(decoderUrl);
      if (url.protocol !== "https:" || url.username || url.password) throw new Error();
    } catch {
      return { ok: false, error: "Use a local absolute path or a public HTTPS Draco decoder directory." };
    }
  }
  return { ok: true, value: { accessToken: fields.accessToken, decoderUrl } };
}
