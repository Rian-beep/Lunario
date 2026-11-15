import {heightAt,type TerrainData} from './terrain';
/** Mesh sampling policy, never a claim of new measured resolution. */
export function terrainDetailPolicy(data:TerrainData|null,lat:number,lon:number,cameraRangeKm:number,previous=384){
 const sample=data?heightAt(data,lat,lon,true):null;
 const spacingM=sample?Math.max(sample.stepM,sample.inputPixelM):null;
 const close=Number.isFinite(cameraRangeKm)&&cameraRangeKm>=0&&cameraRangeKm<(previous===640?5:2);
 return{segments:spacingM!==null&&spacingM<=80&&close?640:384,spacingM,measuredCloseView:spacingM!==null&&Number.isFinite(cameraRangeKm)&&cameraRangeKm<50};
}
