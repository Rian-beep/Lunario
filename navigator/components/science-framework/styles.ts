export const scienceFrameworkStyles = `
.science-framework { color:var(--mission-ink); background:var(--mission-cream); border:2px solid var(--mission-ink); box-shadow:var(--mission-shadow); margin:1rem 0; font-family:inherit; font-size:14px; line-height:1.55; min-width:0; overflow-wrap:anywhere; }
.science-framework * { box-sizing:border-box; }
.science-framework header { display:flex; align-items:flex-start; justify-content:space-between; gap:.75rem; background:var(--mission-title); padding:.8rem; border-bottom:2px solid var(--mission-ink); }
.science-framework [data-slot="button"] { min-height:44px; padding:.4rem .7rem; border:1px solid var(--mission-ink); color:var(--mission-ink); background:var(--mission-cream); font:inherit; cursor:pointer; }
.science-framework [data-slot="button"]:focus-visible { outline:3px solid var(--ring); outline-offset:3px; }
.science-framework h2,.science-framework h3,.science-framework h4,.science-framework p { margin:0 0 .6rem; }
.science-framework h2 { font-size:1.2rem; line-height:1.3; }
.science-framework h3 { font-size:1rem; }
.science-framework h4 { font-size:.95rem; }
.science-framework .sf-body { padding:.8rem; }
.science-framework .sf-kicker { font-size:.8rem; font-weight:750; letter-spacing:.035em; }
.science-framework .sf-card { margin:.8rem 0; border:1px solid var(--mission-ink); background:var(--card); }
.science-framework summary { padding:.7rem; cursor:pointer; font-weight:700; min-height:44px; }
.science-framework details[open] > summary { border-bottom:1px solid var(--mission-ink); background:var(--mission-selected); }
.science-framework .sf-content { padding:.75rem; }
.science-framework .sf-grid { display:grid; grid-template-columns:repeat(auto-fit,minmax(min(100%,19rem),1fr)); gap:.7rem; }
.science-framework dl { display:grid; grid-template-columns:minmax(5rem,1fr) minmax(0,2fr); gap:.4rem .7rem; margin:0; }
.science-framework dt { font-weight:700; }
.science-framework dd { margin:0; min-width:0; }
.science-framework code { font-family:var(--font-geist-mono),monospace; font-size:.85em; white-space:normal; }
.science-framework a { color:var(--mission-link); text-decoration:underline; text-underline-offset:.16em; }
.science-framework a:focus-visible,.science-framework summary:focus-visible { outline:3px solid var(--ring); outline-offset:3px; }
.science-framework ul,.science-framework ol { padding-inline-start:1.3rem; margin:.5rem 0; }
.science-framework li { margin:.35rem 0; }
.science-framework .sf-pipeline { border:1px solid var(--mission-ink); padding:.7rem; background:var(--mission-cream); }
.science-framework .sf-pipeline ol { list-style:none; padding:0; }
.science-framework .sf-pipeline li { border-left:3px solid var(--mission-ink); padding:.2rem .5rem; }
.science-framework .sf-dependency { display:block; font-size:.85em; }
.science-framework .sf-note { padding:.7rem; border-left:4px solid var(--mission-ink); background:var(--mission-warning-bg); }
.science-framework .sf-finding { border-top:1px solid var(--mission-ink); padding:.7rem 0; }
.science-framework .sf-status { display:inline-block; padding:.1rem .45rem; border:1px solid var(--mission-ink); background:var(--mission-cream); font-weight:750; margin-bottom:.5rem; }
.science-framework .sf-equation { max-width:100%; overflow:auto; padding:.6rem 0; }
.science-framework math { font-size:1.05em; margin:.4rem 0; }
.science-framework .sf-variable { scroll-margin-top:1rem; }
.science-framework .sf-muted { font-size:.88em; }
@media(max-width:480px) { .science-framework header { flex-wrap:wrap; } .science-framework dl { grid-template-columns:1fr; gap:.15rem; } .science-framework dd { margin-bottom:.65rem; } }
`;
