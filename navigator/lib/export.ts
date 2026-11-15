/** Keep user-entered text literal in spreadsheet applications. Numbers retain their sign. */
export function csvCell(value: unknown): string {
  let text = value == null ? "Unknown" : String(value);
  if (typeof value === "string" && /^[\s]*[=+\-@]/.test(text))
    text = "'" + text;
  return '"' + text.replaceAll('"', '""') + '"';
}
