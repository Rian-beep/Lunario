import type {VisualMoonDevice} from './visual-moon';
/** Explicit peak texture budget; unknown-memory devices never authorize the 8K tier. */
export function visualMoonDevice(maxTextureSize:number,maxAnisotropy:number,memoryGb:number|undefined,offline:boolean):VisualMoonDevice{
 return {maxTextureSize:offline?Math.min(4096,maxTextureSize):maxTextureSize,maxAnisotropy,textureBudgetMiB:!offline&&Number.isFinite(memoryGb)&&memoryGb!>=8?512:128};
}
