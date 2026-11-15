import type {FlightInputs} from './flight';
import {DEFAULT_LANDING_CONFIGURATION,type LandingConfiguration} from './landing-contract';
export type LandingFlight=FlightInputs&{landing:LandingConfiguration;eastOffsetM:number;northOffsetM:number};
/** First Lander selection configures an illustrative terminal approach; later selections retain edits. */
export function createLandingFlight(current:FlightInputs,reset=false):LandingFlight{
 const prior=current as FlightInputs&Partial<LandingFlight>;
 if(!reset&&current.mode==='descent'&&prior.landing&&prior.eastOffsetM!==undefined&&prior.northOffsetM!==undefined)return {...current,...prior,landing:{...prior.landing}} as LandingFlight;
 return {...current,mode:'descent',altitudeM:300,eastOffsetM:-300,northOffsetM:0,horizontalMps:10,verticalMps:-8,headingDeg:90,pitchDeg:90,finalPitchDeg:90,burnSeconds:150,durationSeconds:180,landing:{...DEFAULT_LANDING_CONFIGURATION}};
}
