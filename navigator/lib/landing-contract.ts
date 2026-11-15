/** Numerical preview configuration, not published spacecraft acceptance limits. */
export type LandingConfiguration={
 guidance:'manual'|'target-landing'; targetRadiusM:number; maxVerticalMps:number;
 maxHorizontalMps:number; maxTiltDeg:number; breakupEnergyJ:number;
 friction:number; restitution:number; contactPreviewSeconds:number;
};
export const DEFAULT_LANDING_CONFIGURATION:Readonly<LandingConfiguration>=Object.freeze({guidance:'target-landing',targetRadiusM:20,maxVerticalMps:2,maxHorizontalMps:1,maxTiltDeg:15,breakupEnergyJ:100000,friction:.8,restitution:.1,contactPreviewSeconds:12});
export type LandingContact={
 timeS:number;eastM:number;northM:number;yM:number;
 velocityMps:[number,number,number];massKg:number;
 terrainHeightM:number|null;terrainKnown:boolean;slopeDeg:number|null;
 tiltDeg:number;headingDeg:number;targetErrorM:number;
};
export type LandingOutcome={
 state:'within-assumed-limits'|'outside-assumed-limits'|'unresolved';reasons:string[];
 verticalMps:number|null;horizontalMps:number|null;tiltDeg:number|null;targetErrorM:number|null;
};
export type LandingDynamicsReadout={
 phase:'contact'|'broken'|'settled'|'unsupported';elapsedContactS:number;
 speedMps:number;verticalMps:number;eastM:number;northM:number;yM:number;fragmentCount:number;
 note:string;
};
/** Optional rotating local frame for the assisted terminal model; legacy calls stay compatible. */
export type LandingEnvironment={latitudeDeg:number;rotationRateRadS?:number};
