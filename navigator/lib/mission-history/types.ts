export type MissionSource={id:string;title:string;url:string;publisher:string;country:string;language:string;translationNote?:string};
export type Sourced<T>={value:T|null;sourceIds:string[];note?:string};
export type MissionHistoryRecord={
 id:string;siteIds:string[];name:string;
 operator:Sourced<string>;sponsors:Sourced<string[]>;representing:Sourced<string[]>;model:Sourced<string>;missionDates:Sourced<string>;
 objectives:Sourced<string[]>;outcome:Sourced<{landing:string;science:string}>;discoveries:Sourced<string[]>;innovations:Sourced<string[]>;
 exploration:{summary:Sourced<string>;distanceKm:Sourced<number>;areaKm2:Sourced<number>;route?:{type:'LineString';coordinates:[number,number][]};routeSourceIds?:string[]};
 publicSummary:Sourced<string>;educatorNotes:Sourced<string>;plannerNotes:Sourced<string>;
 sources:MissionSource[];
};
