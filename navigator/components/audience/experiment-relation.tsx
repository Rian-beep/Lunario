import {NativeMath} from '@/components/workbench/native-math';
import {mathRelation} from '@/lib/math-typesetting';
import {controlledFiniteRate,type ControlledResponse} from '@/lib/audience/experiments';
import type {ExperimentId} from '@/lib/teaching';
import type {ScenarioState} from '@/lib/scenario';
import styles from './audience.module.css';
const relations:Record<ExperimentId,string>={
 'array-height':'F☉ = diskFraction(h☉, horizon_array, ρ☉)',
 'antenna-height':'contact = h⊕ > max(horizon_ant, θ_mask)',
 orientation:'g = max(0, sin h☉ cos β + cos h☉ sin β cos(a☉ − α))',
 load:'ΔE_B = (η_c P_charge − P_delivered / η_d) Δt',
 storage:'E_B(arrival) = f₀ C_B',
 link:'P_rx[dBW] = P_tx[dBW] + G_tx + G_rx − L_fs − L_other',
};
const finiteMarkup='<math xmlns="http://www.w3.org/1998/Math/MathML" aria-label="Finite response rate equals change in response divided by change in controlled input"><mrow><mi>m</mi><mo>=</mo><mfrac><mrow><mo>Δ</mo><mi>y</mi></mrow><mrow><mo>Δ</mo><mi>x</mi></mrow></mfrac></mrow></math>';
export function ExperimentRelation({id,response,baseline,value}:{id:ExperimentId;response:ControlledResponse;baseline:ScenarioState;value:number|string}){
 const expression=relations[id],relation=mathRelation(expression)!,rate=controlledFiniteRate(response,baseline,id,value);
 return <div><h3>The selected experiment’s relation</h3><NativeMath expression={expression} display/>
 <p>{relation.behavior}</p><div className={styles.equation} dangerouslySetInnerHTML={{__html:finiteMarkup}}/>
 <p><b>Baseline-to-candidate finite response:</b> {rate.value===null?'Unavailable (categorical, unchanged or missing evidence)':`${rate.value.toFixed(6)} ${rate.unit}`}. Here x is {response.xLabel}; y is {response.yLabel}. This secant compares two full-stay terrain results. It is not an instantaneous derivative, a fitted universal law or a physical terrain slope. Discrete prepared heights cannot establish a continuous height derivative.</p>
 <details><summary>Symbol meanings and units for this relation</summary><dl>{relation.symbols.map(s=><div className={styles.symbolRow} key={s.expression}><dt><NativeMath expression={s.expression}/></dt><dd>{s.meaning} · {s.unit}</dd></div>)}</dl></details></div>;
}
