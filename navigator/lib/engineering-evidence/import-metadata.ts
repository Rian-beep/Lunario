import { parseHorizonsResponse, validateHorizonsRequestUrl, type GeometryRequest } from './horizons';
import { object, utc } from './validation';

export type ObserverArchive = {
  request: GeometryRequest;
  requestUrl: string;
  fetchedUtc: string;
  response: Record<string, unknown>;
};

/** Import time and the response's generation banner are not retrieval evidence. */
export function importObserverGeometry(input: unknown, fallbackRequest: GeometryRequest, originalRetrievedUtc = '') {
  const archive = object(input), response = object(archive.response ?? archive);
  const metadata = archive.metadata == null ? {} : object(archive.metadata);
  const candidates = [archive.fetchedUtc, archive.retrievedUtc, metadata.fetchedUtc, metadata.retrievedUtc, response.fetchedUtc, response.retrievedUtc];
  const valid = candidates.flatMap(value => {
    try { return [utc(value)]; } catch { return []; }
  });
  if (new Set(valid.map(value => Date.parse(value))).size > 1)
    throw Error('Conflicting original retrieval timestamps. Correct the observer JSON metadata before importing.');
  let fetchedUtc = valid[0];
  if (!fetchedUtc) {
    try { fetchedUtc = utc(originalRetrievedUtc.trim()); }
    catch { throw Error('Original retrieval timestamp missing or invalid. Enter the original retrieval UTC (YYYY-MM-DDTHH:mm:ssZ), then select the file again. Do not use the import time or the Horizons generation banner.'); }
  }
  const declared = archive.request == null ? fallbackRequest : object(archive.request);
  const request = { stationId: declared.stationId, startUtc: declared.startUtc, endUtc: declared.endUtc } as GeometryRequest;
  if (request.stationId !== fallbackRequest.stationId)
    throw Error('Select the archived station before importing its observer response.');
  const geometry = parseHorizonsResponse(response, request, fetchedUtc);
  if (archive.requestUrl != null) {
    if (typeof archive.requestUrl !== 'string') throw Error('Invalid archived Horizons request URL');
    validateHorizonsRequestUrl(archive.requestUrl, request);
  }
  // Schema 1 does not carry the API signature. Retain the complete JSON response
  // separately for inspection and archive export, without altering the shared envelope.
  const retained: ObserverArchive = { request, requestUrl: typeof archive.requestUrl === 'string' ? archive.requestUrl : geometry.requestUrl, fetchedUtc, response: structuredClone(response) };
  return { geometry, archive: retained };
}
