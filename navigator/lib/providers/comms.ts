/** Evidence channels cannot certify one another. No attenuation or allocation is inferred. */
export function commsInferenceSummary(){return [
 {id:'lunar-los',title:'Lunar line of sight',state:'separate-model',explanation:'Use the existing antenna-height terrain assessment for Moon-side obstruction. A solar reading does not change that calculation.'},
 {id:'station-geometry',title:'Earth-station geometry',state:'separate-model',explanation:'Use the existing dated DSN geometry view. A station above its geometric horizon is not a scheduled contact.'},
 {id:'weather-context',title:'Station weather and solar context',state:'context-only',explanation:'Dated weather and current X-rays are context. No band-specific attenuation, antenna outage or delivered data capacity is inferred.'},
 {id:'allocation',title:'Scheduled ground support',state:'not-assessed',explanation:'No mission-specific station booking, compatible radio configuration or service allocation is connected. Support availability remains unassessed.'},
] as const;}
