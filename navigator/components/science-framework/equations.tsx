import React, { type ReactNode } from 'react';
import type { EquationId } from '../../lib/science-framework';
type MathProps = React.HTMLAttributes<MathMLElement> & {children?:ReactNode; xmlns?:string; display?:'block'|'inline'; columnalign?:string; width?:string};
// React's HTML JSX types omit MathML; these local tags emit native elements without global type augmentation.
const element = (tag:string) => function MathElement(props:MathProps) { return React.createElement(tag,props); };
const Math = element('math');
const Mi = element('mi');
const Mo = element('mo');
const Mn = element('mn');
const Mtext = element('mtext');
const Mrow = element('mrow');
const Msub = element('msub');
const Msup = element('msup');
const Mfrac = element('mfrac');
const Msqrt = element('msqrt');
const Mtable = element('mtable');
const Mtr = element('mtr');
const Mtd = element('mtd');
const Munder = element('munder');
const Mover = element('mover');
const Mspace = element('mspace');
const sub = (base:string, index:string) => <Msub><Mi>{base}</Mi><Mtext>{index}</Mtext></Msub>;
const frac = (top:ReactNode, bottom:ReactNode) => <Mfrac><Mrow>{top}</Mrow><Mrow>{bottom}</Mrow></Mfrac>;
const sq = (value:ReactNode) => <Msup><Mrow>{value}</Mrow><Mn>2</Mn></Msup>;
const H = <Mrow><Mi>H</Mi><Mo>(</Mo><Mi>A</Mi><Mo>;</Mo><Mi>h</Mi><Mo>)</Mo></Mrow>;
const rows = (...children:ReactNode[]) => <Mtable columnalign="left">{children.map((child,i)=><Mtr key={i}><Mtd>{child}</Mtd></Mtr>)}</Mtable>;
export function ScienceEquation({id}:{id:EquationId}) {
  let content:ReactNode;
  let label:string;
  switch(id) {
    case 'location': label='Local radial unit vector from latitude and east longitude'; content=<Mrow><Mi>u</Mi><Mo>=</Mo><Mo>(</Mo><Mi>cos</Mi><Mi>φ</Mi><Mi>cos</Mi><Mi>λ</Mi><Mo>,</Mo><Mi>cos</Mi><Mi>φ</Mi><Mi>sin</Mi><Mi>λ</Mi><Mo>,</Mo><Mi>sin</Mi><Mi>φ</Mi><Mo>)</Mo></Mrow>; break;
    case 'epoch': label='Sample time equals start time plus index times forcing interval'; content=<Mrow>{sub('t','i')}<Mo>=</Mo>{sub('t','0')}<Mo>+</Mo><Mi>i</Mi><Mi>Δt</Mi></Mrow>; break;
    case 'ephemeris': label='Solar angular radius is half the source angular diameter'; content=<Mrow>{sub('ρ','s')}<Mo>=</Mo>{frac(sub('θ','s'),<Mn>2</Mn>)}</Mrow>; break;
    case 'direction': label='Earth topocentric vector subtracts lunar site radius; elevation and azimuth use the local basis'; content=rows(<Mrow>{sub('e','s')}<Mo>=</Mo><Mi>arcsin</Mi><Mo>(</Mo><Mi>sin</Mi><Mi>φ</Mi><Mi>sin</Mi>{sub('φ','s')}<Mo>+</Mo><Mi>cos</Mi><Mi>φ</Mi><Mi>cos</Mi>{sub('φ','s')}<Mi>cos</Mi><Mo>(</Mo>{sub('λ','s')}<Mo>−</Mo><Mi>λ</Mi><Mo>)</Mo><Mo>)</Mo></Mrow>,<Mrow>{sub('v','Earth')}<Mo>=</Mo><Mi>Δ</Mi>{sub('u','Earth')}<Mo>−</Mo><Mi>R</Mi><Mi>u</Mi></Mrow>,<Mrow><Mi>e</Mi><Mo>=</Mo><Mi>atan2</Mi><Mo>(</Mo>{sub('v','up')}<Mo>,</Mo><Msqrt>{sq(sub('v','east'))}<Mo>+</Mo>{sq(sub('v','north'))}</Msqrt><Mo>)</Mo></Mrow>,<Mrow><Mi>A</Mi><Mo>=</Mo><Mi>atan2</Mi><Mo>(</Mo>{sub('v','east')}<Mo>,</Mo>{sub('v','north')}<Mo>)</Mo></Mrow>); break;
    case 'height': label='Observer, array and antenna horizons use their own heights'; content=<Mrow>{sub('H','o')}<Mo>=</Mo><Mi>H</Mi><Mo>(</Mo><Mi>A</Mi><Mo>;</Mo>{sub('h','o')}<Mo>)</Mo><Mo>,</Mo>{sub('H','a')}<Mo>=</Mo><Mi>H</Mi><Mo>(</Mo><Mi>A</Mi><Mo>;</Mo>{sub('h','a')}<Mo>)</Mo><Mo>,</Mo>{sub('H','n')}<Mo>=</Mo><Mi>H</Mi><Mo>(</Mo><Mi>A</Mi><Mo>;</Mo>{sub('h','n')}<Mo>)</Mo></Mrow>; break;
    case 'terrain': label='Decoded elevation equals scale times encoded sample plus offset, retaining nodata as unavailable'; content=<Mrow><Mi>z</Mi><Mo>=</Mo><Mi>a</Mi><Mi>DN</Mi><Mo>+</Mo><Mi>b</Mi></Mrow>; break;
    case 'horizon': label='Spherical ray horizon is the maximum elevation over sampled distances'; content=<Mrow>{H}<Mo>=</Mo><Munder><Mi>max</Mi><Mi>d</Mi></Munder><Mi>atan2</Mi><Mo>(</Mo><Mo>(</Mo><Mi>R</Mi><Mo>+</Mo>{sub('z','d')}<Mo>)</Mo><Mi>cos</Mi><Mo>(</Mo>{frac(<Mi>d</Mi>,<Mi>R</Mi>)}<Mo>)</Mo><Mo>−</Mo><Mo>(</Mo><Mi>R</Mi><Mo>+</Mo>{sub('z','0')}<Mo>+</Mo><Mi>h</Mi><Mo>)</Mo><Mo>,</Mo><Mo>(</Mo><Mi>R</Mi><Mo>+</Mo>{sub('z','d')}<Mo>)</Mo><Mi>sin</Mi><Mo>(</Mo>{frac(<Mi>d</Mi>,<Mi>R</Mi>)}<Mo>)</Mo><Mo>)</Mo></Mrow>; break;
    case 'disk': label='For clearance c between minus one and one, visible solar disk is one minus its blocked circular segment; outside this interval it is zero or one'; content=rows(<Mrow><Mi>c</Mi><Mo>=</Mo>{frac(<Mrow>{sub('e','s')}<Mo>−</Mo>{H}</Mrow>,sub('ρ','s'))}</Mrow>,<Mrow><Mi>f</Mi><Mo>=</Mo><Mn>1</Mn><Mo>−</Mo>{frac(<Mrow><Mi>arccos</Mi><Mi>c</Mi><Mo>−</Mo><Mi>c</Mi><Msqrt><Mn>1</Mn><Mo>−</Mo>{sq(<Mi>c</Mi>)}</Msqrt></Mrow>,<Mi>π</Mi>)}<Mspace width="1em"/><Mtext>for −1 &lt; c &lt; 1; f = 0 at c ≤ −1, f = 1 at c ≥ 1</Mtext></Mrow>); break;
    case 'sunlit': label='Time sunlit counts positive visible-disk samples; exposure averages the disk fraction'; content=rows(<Mrow><Mi>q</Mi><Mo>=</Mo>{frac(<Mrow><Mo>∑</Mo>{sub('𝟙','f > 0')}</Mrow>,<Mi>N</Mi>)}</Mrow>,<Mrow><Mover><Mi>f</Mi><Mo>¯</Mo></Mover><Mo>=</Mo>{frac(<Mrow><Mo>∑</Mo>{sub('f','i')}</Mrow>,<Mi>N</Mi>)}</Mrow>); break;
    case 'incidence': label='Fixed-panel incidence is the nonnegative dot product of Sun direction and panel normal'; content=<Mrow><Mi>C</Mi><Mo>=</Mo><Mi>max</Mi><Mo>(</Mo><Mn>0</Mn><Mo>,</Mo><Mi>sin</Mi><Mi>e</Mi><Mi>cos</Mi><Mi>β</Mi><Mo>+</Mo><Mi>cos</Mi><Mi>e</Mi><Mi>sin</Mi><Mi>β</Mi><Mi>cos</Mi><Mo>(</Mo><Mi>A</Mi><Mo>−</Mo><Mi>α</Mi><Mo>)</Mo><Mo>)</Mo></Mrow>; break;
    case 'power': label='Power equals irradiance times area times efficiency times retained fraction times incidence times visible disk'; content=<Mrow><Mi>P</Mi><Mo>=</Mo><Mi>S</Mi><Mi>B</Mi><Mi>η</Mi><Mo>(</Mo><Mn>1</Mn><Mo>−</Mo><Mi>ℓ</Mi><Mo>)</Mo><Mi>C</Mi><Mi>f</Mi></Mrow>; break;
    case 'energy': label='Energy changes by efficiency-adjusted charging or discharging, capped on the bus and bounded by capacity'; content=rows(<Mrow>{sub('Q','c')}<Mo>=</Mo><Mi>min</Mi><Mo>(</Mo><Mi>max</Mi><Mo>(</Mo><Mi>P</Mi><Mo>−</Mo><Mi>L</Mi><Mo>,</Mo><Mn>0</Mn><Mo>)</Mo><Mo>,</Mo>{sub('P','c')}<Mo>)</Mo></Mrow>,<Mrow>{sub('Q','d')}<Mo>=</Mo><Mi>min</Mi><Mo>(</Mo><Mi>max</Mi><Mo>(</Mo><Mi>L</Mi><Mo>−</Mo><Mi>P</Mi><Mo>,</Mo><Mn>0</Mn><Mo>)</Mo><Mo>,</Mo>{sub('P','d')}<Mo>)</Mo></Mrow>,<Mrow>{sub('E','next')}<Mo>=</Mo><Mi>clamp</Mi><Mo>(</Mo><Mi>E</Mi><Mo>+</Mo><Mo>(</Mo>{sub('η','c')}{sub('Q','c')}<Mo>−</Mo>{frac(sub('Q','d'),sub('η','d'))}<Mo>)</Mo><Mi>Δt</Mi><Mo>,</Mo><Mn>0</Mn><Mo>,</Mo>{sub('C','b')}<Mo>)</Mo></Mrow>); break;
    case 'reserve': label='Reserve is capacity times reserve fraction; falling crossing time is energy above reserve divided by negative storage rate'; content=rows(<Mrow>{sub('E','r')}<Mo>=</Mo><Mi>r</Mi>{sub('C','b')}</Mrow>,<Mrow><Mi>τ</Mi><Mo>=</Mo>{frac(<Mrow><Mi>E</Mi><Mo>−</Mo>{sub('E','r')}</Mrow>,<Mrow><Mo>−</Mo><Mover><Mi>E</Mi><Mo>˙</Mo></Mover></Mrow>)}<Mspace width="1em"/><Mtext>for a falling segment crossing reserve</Mtext></Mrow>); break;
    case 'earth-disk': label='Earth angular radius is arcsine of reference radius over range; centre and limb have different thresholds'; content=rows(<Mrow>{sub('ρ','e')}<Mo>=</Mo><Mi>arcsin</Mi><Mo>(</Mo>{frac(sub('R','e'),<Mi>Δ</Mi>)}<Mo>)</Mo></Mrow>,<Mrow><Mtext>centre: </Mtext>{sub('e','e')}<Mo>&gt;</Mo><Mi>H</Mi><Mo>;</Mo><Mspace width="1em"/><Mtext>any limb: </Mtext>{sub('e','e')}<Mo>+</Mo>{sub('ρ','e')}<Mo>&gt;</Mo><Mi>H</Mi></Mrow>); break;
    case 'contact': label='Contact requires Earth centre strictly above terrain and absolute antenna minimum'; content=<Mrow><Mi>V</Mi><Mo>=</Mo><Mo>[</Mo>{sub('e','e')}<Mo>&gt;</Mo><Mi>max</Mi><Mo>(</Mo>{sub('H','n')}<Mo>,</Mo>{sub('e','min')}<Mo>)</Mo><Mo>]</Mo></Mrow>; break;
    case 'radio': label='Free-space loss is twenty log ten of four pi range frequency over light speed; link margin subtracts required energy per bit to noise'; content=rows(<Mrow>{sub('L','fs')}<Mo>=</Mo><Mn>20</Mn>{sub('log','10')}<Mo>(</Mo>{frac(<Mrow><Mn>4</Mn><Mi>π</Mi><Mi>Δ</Mi>{sub('f','RF')}</Mrow>,<Mi>c</Mi>)}<Mo>)</Mo></Mrow>,<Mrow>{sub('P','r,dBW')}<Mo>=</Mo><Mn>10</Mn>{sub('log','10')}{sub('P','t,W')}<Mo>+</Mo>{sub('G','t')}<Mo>+</Mo>{sub('G','r')}<Mo>−</Mo>{sub('L','other')}<Mo>−</Mo>{sub('L','fs')}</Mrow>,<Mrow><Mi>M</Mi><Mo>=</Mo>{sub('P','r,dBW')}<Mo>−</Mo><Mn>10</Mn>{sub('log','10')}<Mo>(</Mo><Mi>k</Mi>{sub('T','n')}<Mo>)</Mo><Mo>−</Mo><Mn>10</Mn>{sub('log','10')}{sub('R','b')}<Mo>−</Mo>{sub('(Eb/N₀)','required,dB')}</Mrow>); break;
    case 'station': label='Delivered data integrates bit rate only over usable and allocated intervals; station elevation alone does not establish either'; content=<Mrow><Mi>D</Mi><Mo>=</Mo><Mo>∫</Mo>{sub('R','b')}<Mo>(</Mo><Mi>t</Mi><Mo>)</Mo>{sub('𝟙','usable')}{sub('I','alloc')}<Mo>(</Mo><Mi>t</Mi><Mo>)</Mo><Mi>d</Mi><Mi>t</Mi></Mrow>; break;
    case 'duration': label='Longest dark or blackout duration is the longest contiguous false run times sample interval within the selected stay'; content=<Mrow>{sub('D','max')}<Mo>=</Mo><Munder><Mi>max</Mi><Mtext>in-window dark runs</Mtext></Munder><Mo>∑</Mo><Mi>Δt</Mi><Mo>;</Mo><Mspace width="1em"/>{sub('B','max')}<Mo>=</Mo><Munder><Mi>max</Mi><Mtext>in-window no-contact runs</Mtext></Munder><Mo>∑</Mo><Mi>Δt</Mi></Mrow>; break;
    case 'flight': label='Central gravity uses lunar GM; propellant mass flow and ideal delta-v use standard gravity and specific impulse'; content=rows(<Mrow><Mi>g</Mi><Mo>=</Mo>{frac(<Mi>μ</Mi>,sq(<Mrow><Mo>|</Mo><Mi>r</Mi><Mo>|</Mo></Mrow>))}<Mo>;</Mo><Mspace width="1em"/><Mover><Mi>v</Mi><Mo>˙</Mo></Mover><Mo>=</Mo><Mo>−</Mo>{frac(<Mrow><Mi>μ</Mi><Mi>r</Mi></Mrow>,<Msup><Mrow><Mo>|</Mo><Mi>r</Mi><Mo>|</Mo></Mrow><Mn>3</Mn></Msup>)}<Mo>+</Mo>{frac(<Mi>F</Mi>,<Mi>m</Mi>)}</Mrow>,<Mrow><Mover><Mi>m</Mi><Mo>˙</Mo></Mover><Mo>=</Mo><Mo>−</Mo>{frac(<Mi>F</Mi>,<Mrow>{sub('I','sp')}{sub('g','0')}</Mrow>)}<Mo>;</Mo><Mspace width="1em"/><Mi>Δv</Mi><Mo>=</Mo>{sub('I','sp')}{sub('g','0')}<Mi>ln</Mi><Mo>(</Mo>{frac(sub('m','initial'),sub('m','final'))}<Mo>)</Mo></Mrow>,<Mrow><Mtext>Configured Moon-fixed frame adds </Mtext><Mo>−</Mo><Mn>2</Mn><Mi>ω</Mi><Mo>×</Mo><Mi>v</Mi><Mo>−</Mo><Mi>ω</Mi><Mo>×</Mo><Mo>(</Mo><Mi>ω</Mi><Mo>×</Mo><Mi>r</Mi><Mo>)</Mo></Mrow>); break;
    case 'slope': label='Slope is arctangent of the magnitude of the height gradient, estimated by central differences'; content=rows(<Mrow><Mi>σ</Mi><Mo>=</Mo><Mi>arctan</Mi><Mo>|</Mo><Mi>∇z</Mi><Mo>|</Mo></Mrow>,<Mrow>{frac(<Mrow><Mi>∂z</Mi></Mrow>,<Mi>∂x</Mi>)}<Mo>≈</Mo>{frac(<Mrow><Mi>z</Mi><Mo>(</Mo><Mi>x</Mi><Mo>+</Mo><Mi>δx</Mi><Mo>)</Mo><Mo>−</Mo><Mi>z</Mi><Mo>(</Mo><Mi>x</Mi><Mo>−</Mo><Mi>δx</Mi><Mo>)</Mo></Mrow>,<Mrow><Mn>2</Mn><Mi>δx</Mi></Mrow>)}</Mrow>); break;
    case 'comparison': label='Minimum constraint margin is actual minus limit; maximum constraint margin is limit minus actual'; content=<Mrow>{sub('C','minimum')}<Mo>=</Mo><Mi>actual</Mi><Mo>−</Mo><Mi>limit</Mi><Mo>;</Mo><Mspace width="1em"/>{sub('C','maximum')}<Mo>=</Mo><Mi>limit</Mi><Mo>−</Mo><Mi>actual</Mi></Mrow>; break;
    case 'ranking': label='Regional score is a weighted mean of clamped normalized utilities times one hundred; missing positive-weight components make it unavailable'; content=<Mrow><Mi>U</Mi><Mo>=</Mo><Mn>100</Mn>{frac(<Mrow><Mo>∑</Mo>{sub('w','i')}<Mi>clamp</Mi><Mo>(</Mo>{sub('u','i')}<Mo>,</Mo><Mn>0</Mn><Mo>,</Mo><Mn>1</Mn><Mo>)</Mo></Mrow>,<Mrow><Mo>∑</Mo>{sub('w','i')}</Mrow>)}</Mrow>; break;
    case 'render': label='Image tile sampling halves each level; output sampling is not effective source resolution'; content=<Mrow><Mi>s</Mi><Mo>=</Mo>{frac(<Mn>8561.953125</Mn>,<Msup><Mn>2</Mn><Mi>level</Mi></Msup>)}<Mspace width="1em"/><Mtext>m/px; mesh segments n ∈ &#123;384, 640&#125;</Mtext></Mrow>; break;
  }
  return <Math xmlns="http://www.w3.org/1998/Math/MathML" display="block" aria-label={label}>{content}</Math>;
}

/** Authored symbol definitions use the same native notation as the equations. */
export function ScienceSymbols({id}:{id:EquationId}) {
  const simple = (value:string) => <Mi>{value}</Mi>;
  let definitions: [ReactNode,string][];
  switch(id) {
    case 'location': definitions=[[simple('φ'),'latitude'],[simple('λ'),'east longitude'],[simple('R'),'reference lunar radius']]; break;
    case 'epoch': definitions=[[simple('t'),'UTC epoch'],[simple('Δt'),'forcing interval'],[simple('i'),'sample index']]; break;
    case 'ephemeris': definitions=[[sub('φ','s'),'subsolar latitude'],[sub('λ','s'),'subsolar longitude'],[sub('φ','e'),'sub-Earth latitude'],[sub('λ','e'),'sub-Earth longitude'],[simple('Δ'),'Earth range'],[sub('ρ','s'),'solar angular radius'],[sub('θ','s'),'solar angular diameter']]; break;
    case 'direction': definitions=[[simple('A'),'azimuth'],[simple('e'),'elevation'],[simple('v'),'topocentric vector'],[simple('u'),'radial up'],[simple('E'),'east basis'],[simple('N'),'north basis']]; break;
    case 'height': definitions=[[sub('h','o'),'display observer'],[sub('h','a'),'solar array'],[sub('h','n'),'antenna']]; break;
    case 'terrain': definitions=[[simple('z'),'surface height'],[simple('DN'),'encoded sample'],[simple('a'),'scale'],[simple('b'),'offset']]; break;
    case 'horizon': definitions=[[H,'skyline elevation'],[simple('z'),'terrain height'],[simple('d'),'ray distance'],[simple('R'),'lunar radius']]; break;
    case 'disk': definitions=[[simple('f'),'visible disk fraction'],[simple('c'),'normalized centre clearance'],[sub('e','s'),'solar elevation'],[sub('ρ','s'),'solar angular radius']]; break;
    case 'sunlit': definitions=[[simple('q'),'time-sunlit fraction'],[<Mover key="symbol"><Mi>f</Mi><Mo>¯</Mo></Mover>,'mean visible disk'],[simple('N'),'known samples']]; break;
    case 'incidence': definitions=[[simple('C'),'incidence'],[simple('β'),'array tilt from horizontal'],[simple('α'),'array azimuth']]; break;
    case 'power': definitions=[[simple('P'),'power'],[simple('S'),'irradiance'],[simple('B'),'array area'],[simple('η'),'efficiency'],[simple('ℓ'),'loss fraction']]; break;
    case 'energy': definitions=[[simple('E'),'stored energy'],[simple('L'),'load'],[sub('η','c'),'charge efficiency'],[sub('η','d'),'discharge efficiency'],[sub('P','c'),'charge bus cap'],[sub('P','d'),'discharge bus cap'],[sub('C','b'),'capacity'],[sub('Q','c'),'charge input power'],[sub('Q','d'),'bus discharge power']]; break;
    case 'reserve': definitions=[[sub('E','r'),'reserve energy'],[simple('r'),'reserve fraction'],[simple('τ'),'crossing time'],[<Mover key="symbol"><Mi>E</Mi><Mo>˙</Mo></Mover>,'storage rate']]; break;
    case 'earth-disk': definitions=[[sub('e','e'),'Earth centre elevation'],[sub('ρ','e'),'angular radius'],[sub('R','e'),'Earth radius'],[simple('Δ'),'range']]; break;
    case 'contact': definitions=[[simple('V'),'geometric contact'],[sub('e','min'),'absolute antenna elevation minimum'],[sub('H','n'),'antenna skyline']]; break;
    case 'radio': definitions=[[sub('L','fs'),'free-space loss'],[sub('f','RF'),'carrier frequency'],[sub('P','t'),'transmit power'],[sub('G','t'),'transmit gain'],[sub('G','r'),'receive gain'],[sub('T','n'),'noise temperature'],[sub('R','b'),'bit rate'],[simple('M'),'margin'],[simple('c'),'light speed'],[simple('k'),'Boltzmann constant'],[sub('L','other'),'entered losses']]; break;
    case 'station': definitions=[[sub('e','GS'),'station elevation'],[sub('I','alloc'),'allocation indicator'],[simple('D'),'delivered data'],[sub('R','b'),'bit rate']]; break;
    case 'duration': definitions=[[sub('D','max'),'longest dark run'],[sub('B','max'),'longest geometric blackout'],[simple('Δt'),'forcing interval']]; break;
    case 'flight': definitions=[[simple('μ'),'lunar GM'],[simple('r'),'position'],[simple('g'),'local gravity'],[simple('F'),'thrust'],[simple('m'),'mass'],[sub('I','sp'),'specific impulse'],[sub('g','0'),'standard gravity'],[simple('v'),'velocity'],[simple('t'),'elapsed flight time'],[simple('ω'),'lunar spin']]; break;
    case 'slope': definitions=[[simple('σ'),'regional slope'],[simple('∇z'),'terrain gradient'],[simple('δx'),'east spacing'],[simple('δy'),'north spacing']]; break;
    case 'comparison': definitions=[[sub('C','j'),'constraint margin'],[simple('x'),'scenario inputs'],[simple('j'),'requirement index']]; break;
    case 'ranking': definitions=[[simple('U'),'score'],[sub('w','i'),'chosen weight'],[sub('u','i'),'normalized component'],[simple('T'),'stay duration'],[sub('σ','0'),'slope ranking scale']]; break;
    case 'render': definitions=[[simple('s'),'source / output sampling'],[simple('ε'),'screen-space error'],[simple('n'),'mesh segments']]; break;
  }
  return <span>{definitions.map(([symbol,name],i)=><React.Fragment key={name}>{i ? '; ' : ''}<Math xmlns="http://www.w3.org/1998/Math/MathML" display="inline" aria-label={name}>{symbol}</Math> {name}</React.Fragment>)}</span>;
}
