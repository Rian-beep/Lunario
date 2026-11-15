'use client';

import { nativeMathMarkup } from '@/lib/math-typesetting';

const escapeAttribute = (value: string) => value.replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]!);

/** The only HTML inserted here comes from the closed, authored expression registry. */
export function NativeMath({ expression, display = false, label }: { expression: string; display?: boolean; label?: string }) {
  const markup = nativeMathMarkup(expression, display).replace(/<math([^>]*)>/, (_, attributes: string) => {
    const existingStyle = attributes.match(/ style="([^"]*)"/)?.[1] ?? '';
    const cleanAttributes = attributes.replace(/ style="[^"]*"/, '');
    return `<math${cleanAttributes} aria-label="${escapeAttribute(label ?? expression)}" style="${existingStyle}font-family:Cambria Math,STIX Two Math,STIX Math,Latin Modern Math,math;font-size:1em;font-style:normal;font-weight:normal;line-height:normal;letter-spacing:normal;text-transform:none;direction:ltr">`;
  });
  return <span tabIndex={display ? 0 : undefined} onKeyDown={event => {
    if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', ' '].includes(event.key)) event.stopPropagation();
  }} style={{ display: display ? 'block' : 'inline-block', maxWidth: '100%', overflowX: 'auto', verticalAlign: 'middle', fontSize: display ? '1.2em' : '1em', paddingBlock: display ? '0.65em' : undefined }} dangerouslySetInnerHTML={{ __html: markup }} />;
}
