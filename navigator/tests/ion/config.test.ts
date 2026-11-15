import assert from "node:assert/strict";
import { test } from "node:test";
import { DEFAULT_DRACO_DECODER_URL, validateIonConfiguration } from "../../lib/ion/config";

test("Ion configuration requires an explicit nonempty runtime token; unknown options are rejected", () => {
  for (const input of [undefined, null, [], {}, { accessToken: "" }, { accessToken: " " }, { accessToken: 2 }, { accessToken: "fixture value" }, { accessToken: "fixture", assetId: 1 }, { accessToken: "fixture", persist: true }]) {
    const result = validateIonConfiguration(input);
    assert.equal(result.ok, false);
    assert.equal(JSON.stringify(result).includes("fixture"), false);
  }
  assert.deepEqual(validateIonConfiguration({ accessToken: "fixture" }), {
    ok: true, value: { accessToken: "fixture", decoderUrl: DEFAULT_DRACO_DECODER_URL },
  });
});

test("decoder paths allow local or public HTTPS directories, never credential-bearing URLs", () => {
  for (const decoderUrl of ["/data/draco/", "https://decoder.invalid/public/"])
    assert.equal(validateIonConfiguration({ accessToken: "fixture", decoderUrl }).ok, true);
  for (const decoderUrl of ["", "relative/", "//decoder.invalid/", "javascript:bad/", "http://decoder.invalid/", "https://user:pass@decoder.invalid/", "/data/draco", "/data/?secret=value/", "/data/#fragment/", "/data/ bad/", "/data/\\bad/"])
    assert.equal(validateIonConfiguration({ accessToken: "fixture", decoderUrl }).ok, false, decoderUrl);
});
