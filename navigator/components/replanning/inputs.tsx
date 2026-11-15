import type { InputRow } from '@/lib/replanning/model';
import styles from './workspace.module.css';
const text = (value: unknown) => value === undefined ? 'Absent' : value === null ? 'None / unbounded' : typeof value === 'object' ? JSON.stringify(value) : String(value);
export function InputComparison({ rows }: { rows: InputRow[] }) {
  const changed = rows.filter(r => r.changed), held = rows.filter(r => !r.changed);
  const table = (items: InputRow[], both: boolean) => <div className={styles.tableScroll}><table><thead><tr><th scope="col">Input</th><th scope="col">{both ? 'Reference' : 'Held value'}</th>{both && <th scope="col">Candidate</th>}</tr></thead><tbody>{items.map(r => <tr key={r.path}><th scope="row">{r.path}</th><td>{text(r.before)}</td>{both && <td>{text(r.after)}</td>}</tr>)}</tbody></table></div>;
  return <section className={styles.section} aria-label="Changed and held inputs"><h3>What changed?</h3><p>{changed.length} changed input fields · {held.length} held constant. Requirements and external report bindings are inputs too; a weaker requirement is not an improved physical result. Flight inputs are recorded here but are not solved by the resource assessment.</p>{changed.length ? table(changed, true) : <p>Reference and candidate have identical inputs. Choose a saved case or test a controlled date/site alternative below.</p>}<details><summary>Held-constant inputs ({held.length})</summary>{table(held, false)}</details></section>;
}
