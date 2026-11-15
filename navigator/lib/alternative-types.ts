import type {AssessmentResult} from './planning-types';
import type {ScenarioState} from './scenario';
export type AlternativeCriteria={minSunFraction:number|null;minContactFraction:number|null;maxDarkHours:number|null;maxBlackoutHours:number|null;maxSlopeDeg:number|null;minBatteryWh:number;maxUnmetWh:number};
export type AlternativeCandidate={id:string;name:string;lat:number;lon:number;siteId:string;custom:ScenarioState['custom'];distanceKm:number};
export type AlternativeMetrics={sunFraction:number|null;contactFraction:number|null;longestDarkHours:number|null;longestBlackoutHours:number|null;generatedWh:number|null;minBatteryWh:number|null;unmetWh:number|null;slopeDeg:number|null;knownFraction:number};
export type AlternativeResult={key:string;candidate:AlternativeCandidate;offsetDays:number;state:ScenarioState;assessment?:AssessmentResult;status:'meets'|'fails'|'unknown'|'outside'|'conditional';violations:string[];unknowns:string[];metrics:AlternativeMetrics;deltas:Partial<Record<keyof AlternativeMetrics,number|null>>};
