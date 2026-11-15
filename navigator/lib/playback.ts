export type PlaybackOptions={startPosition:number;endPosition:number;startWallMs:number;ratePerSecond:number;reducedMotion?:boolean};
export type PlaybackSample={position:number;complete:boolean};
export type PlaybackClock={sample:(nowWallMs:number)=>PlaybackSample;positionAt:(nowWallMs:number)=>number};
const finite=(name:string,value:number)=>{if(!Number.isFinite(value))throw new RangeError(`${name} must be a finite number.`);};
/** Convert physical hours per wall second to catalog sample positions per wall second. */
export function environmentPlaybackRate(hoursPerSecond:number,catalogStepHours:number):number{
 finite('Playback hours per second',hoursPerSecond);finite('Catalog step hours',catalogStepHours);
 if(hoursPerSecond<=0||catalogStepHours<=0)throw new RangeError('Playback speed and catalog step hours must be above zero.');
 const rate=hoursPerSecond/catalogStepHours;finite('Converted playback rate',rate);if(rate<=0)throw new RangeError('Converted playback rate is below the supported numeric range.');return rate;
}
/** Pure wall-clock anchor: rendering cadence never changes elapsed simulated time. */
export function createPlaybackClock(options:PlaybackOptions):PlaybackClock{
 const {startPosition,endPosition,startWallMs,ratePerSecond,reducedMotion=false}=options;
 finite('Start position',startPosition);finite('End position',endPosition);finite('Start wall time',startWallMs);finite('Playback rate',ratePerSecond);
 if(endPosition<startPosition)throw new RangeError('End position must be at or after the start position.');
 if(!Number.isFinite(endPosition-startPosition))throw new RangeError('Playback position range exceeds the supported numeric range.');
 if(ratePerSecond<=0)throw new RangeError('Playback rate must be above zero; pause by stopping the caller’s frame loop.');
 if(typeof reducedMotion!=='boolean')throw new TypeError('Reduced motion must be a boolean.');
 const elapsed=(nowWallMs:number)=>{finite('Current wall time',nowWallMs);const value=Math.max(0,nowWallMs-startWallMs);finite('Elapsed wall time',value);return value;};
 const atElapsed=(elapsedMs:number)=>Math.min(endPosition,startPosition+(elapsedMs/1000)*ratePerSecond);
 const positionAt=(nowWallMs:number)=>atElapsed(elapsed(nowWallMs));
 return {positionAt,sample(nowWallMs){const elapsedMs=elapsed(nowWallMs),continuous=atElapsed(elapsedMs),complete=continuous>=endPosition;return {position:complete?endPosition:reducedMotion?atElapsed(Math.floor(elapsedMs/1000)*1000):continuous,complete};}};
}
