// @ts-nocheck
import * as THREE from 'three';

/*
 * A single, curved surface sampled from measured LOLA elevation grids.
 * World units are kilometres. Map coordinates are lunar south-polar
 * stereographic metres; +X is east and world -Z is map north.
 * No procedural displacement, noise, or invented craters are added.
 */

const DEG = Math.PI / 180;
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const now = () => performance.now();
const MAX_DEM_LAYERS = 6;
const MAX_IMAGE_TILES = 4;

// Heights are packed into two normalized byte channels. Fetch the original
// texels, decode each height, THEN interpolate in high precision. Filtering
// encoded RG8 values can round the high byte before decoding and create false
// terraces many metres tall, even with a highp sampler on some GPUs.
const terrainSamplingGLSL = `
  uniform sampler2D dem0;
  uniform sampler2D dem1;
  uniform sampler2D dem2;
  uniform sampler2D dem3;
  uniform sampler2D dem4;
  uniform sampler2D dem5;
  uniform vec4 demRects[6];
  uniform vec4 demSizes[6];
  uniform vec4 demDecode[6];
  uniform float moonRadius;
  uniform float heightScale;

  bool insideDEM(vec2 p, vec4 r) {
    return p.x >= r.x && p.x <= r.x+r.z && p.y <= r.y && p.y >= r.y-r.w;
  }
  float unpackHeight(vec2 encodedRG, vec4 decode) {
    vec2 bytes=floor(encodedRG*255.0+0.5);
    return (dot(bytes,vec2(256.0,1.0))-32768.0)*decode.x+decode.y;
  }
  vec3 readDEM(sampler2D tex, vec2 p, vec4 r, vec4 size, vec4 decode) {
    vec2 grid=clamp(vec2((p.x-r.x)/r.z,(r.y-p.y)/r.w)*(size.xy-1.0),vec2(0.0),size.xy-1.0);
    vec2 cell=min(floor(grid),size.xy-2.0),f=grid-cell;
    ivec2 pixel=ivec2(cell);
    vec4 a=texelFetch(tex,pixel,0),b=texelFetch(tex,pixel+ivec2(1,0),0);
    vec4 c=texelFetch(tex,pixel+ivec2(0,1),0),d=texelFetch(tex,pixel+ivec2(1,1),0);
    // Stereo holes are excluded before interpolation, with the same fallback
    // and confidence feather used by CPU geometry and elevation inspection.
    if(decode.z>0.5 && (dot(a.rg,a.rg)<0.000001 || dot(b.rg,b.rg)<0.000001 || dot(c.rg,c.rg)<0.000001 || dot(d.rg,d.rg)<0.000001))return vec3(0.0);
    float h=mix(mix(unpackHeight(a.rg,decode),unpackHeight(b.rg,decode),f.x),mix(unpackHeight(c.rg,decode),unpackHeight(d.rg,decode),f.x),f.y);
    float weight=decode.w>0.5?mix(mix(a.b,b.b,f.x),mix(c.b,d.b,f.x),f.y):1.0;
    return vec3(h,1.0,weight);
  }
  vec3 measuredHeight(vec2 p) {
    vec3 sampleValue;
    float sum=0.0, remaining=1.0, spacing=0.0;
    ${Array.from({length: MAX_DEM_LAYERS}, (_, i) => MAX_DEM_LAYERS - 1 - i).map(i => `
    if (demSizes[${i}].w>0.5 && insideDEM(p,demRects[${i}])) {
      sampleValue=readDEM(dem${i},p,demRects[${i}],demSizes[${i}],demDecode[${i}]);
      if (sampleValue.y>0.5 && sampleValue.z>0.001) {
        spacing+=demSizes[${i}].z*sampleValue.z*remaining;
        sum+=sampleValue.x*sampleValue.z*remaining;
        remaining*=1.0-sampleValue.z;
        if(remaining<0.0001)return vec3(sum,spacing,1.0);
      }
    }`).join('')}
    return vec3(0.0,150.0,0.0);
  }
  float neighbourHeight(vec2 p,float fallbackHeight) {
    vec3 sampleValue=measuredHeight(p);
    return sampleValue.z>0.5?sampleValue.x:fallbackHeight;
  }
  vec3 mapToWorldMetres(vec2 p,float h) {
    float t=dot(p,p)/(4.0*moonRadius*moonRadius), q=1.0/(1.0+t);
    float radius=moonRadius+h*heightScale;
    return vec3(p.x*q*radius/moonRadius,radius*(1.0-t)*q-moonRadius,-p.y*q*radius/moonRadius);
  }
  vec2 worldToMapMetres(vec3 point) {
    vec3 radial=point+vec3(0.0,moonRadius,0.0);
    return 2.0*moonRadius*vec2(radial.x,-radial.z)/(length(radial)+radial.y);
  }
  vec3 measuredNormal(vec2 p,float h,vec2 gradient) {
    float r=moonRadius, r2=r*r, t=dot(p,p)/(4.0*r2), q=1.0/(1.0+t), q2=q*q;
    float f=1.0+h*heightScale/r;
    vec3 radial=vec3(p.x*q/r,(1.0-t)*q,-p.y*q/r);
    vec3 east=vec3(q-p.x*p.x*q2/(2.0*r2),-p.x*q2/r,p.x*p.y*q2/(2.0*r2))*f+radial*gradient.x*heightScale;
    vec3 north=vec3(-p.x*p.y*q2/(2.0*r2),-p.y*q2/r,-q+p.y*p.y*q2/(2.0*r2))*f+radial*gradient.y*heightScale;
    return normalize(cross(east,north));
  }
`;

const vertexShader = `
  #include <common>
  #include <logdepthbuf_pars_vertex>
  attribute float elevation;
  attribute float slope;
  attribute vec2 mapXY;
  varying vec3 vNormalW;
  varying vec3 vPositionW;
  varying float vElevation;
  varying float vSlope;
  varying vec2 vMapXY;
  void main() {
    vec4 world = modelMatrix * vec4(position, 1.0);
    vPositionW = world.xyz;
    vNormalW = normalize(mat3(modelMatrix) * normal);
    vElevation = elevation;
    vSlope = slope;
    vMapXY = mapXY;
    gl_Position = projectionMatrix * viewMatrix * world;
    #include <logdepthbuf_vertex>
  }
`;

const fragmentShader = `
  precision highp sampler2D;
  #include <common>
  #include <logdepthbuf_pars_fragment>
  ${terrainSamplingGLSL}
  uniform vec3 sunDirection;
  uniform int displayMode;
  uniform float showContours;
  uniform float contourInterval;
  uniform float detailShading;
  uniform float detailQuality;
  uniform float studioStyle;
  uniform float shadowsEnabled;
  uniform float shadowFloor;
  uniform mat3 sceneToTerrain;
  uniform sampler2D shadowField;
  uniform vec4 shadowRect;
  uniform float shadowReady;
  uniform vec2 shadowTexelSize;
  uniform float imageryEnabled;
  uniform sampler2D image0;
  uniform sampler2D image1;
  uniform sampler2D image2;
  uniform sampler2D image3;
  uniform vec4 imageRects[4];
  uniform vec4 imageSizes[4];
  uniform vec4 imageCoverage;
  varying vec3 vNormalW;
  varying vec3 vPositionW;
  varying float vElevation;
  varying float vSlope;
  varying vec2 vMapXY;

  vec3 elevationColor(float h) {
    float t = clamp((h + 6000.0) / 12000.0, 0.0, 1.0);
    vec3 a = vec3(0.035, 0.075, 0.16);
    vec3 b = vec3(0.055, 0.27, 0.37);
    vec3 c = vec3(0.27, 0.55, 0.50);
    vec3 d = vec3(0.74, 0.67, 0.42);
    vec3 e = vec3(0.91, 0.88, 0.76);
    if (t < 0.25) return mix(a, b, t * 4.0);
    if (t < 0.50) return mix(b, c, (t - 0.25) * 4.0);
    if (t < 0.75) return mix(c, d, (t - 0.50) * 4.0);
    return mix(d, e, (t - 0.75) * 4.0);
  }
  vec3 slopeColor(float s) {
    vec3 a = vec3(0.12, 0.39, 0.31);
    vec3 b = vec3(0.45, 0.63, 0.33);
    vec3 c = vec3(0.85, 0.65, 0.24);
    vec3 d = vec3(0.81, 0.27, 0.15);
    if (s < 5.0) return mix(a, b, s / 5.0);
    if (s < 15.0) return mix(b, c, (s - 5.0) / 10.0);
    return mix(c, d, clamp((s - 15.0) / 20.0, 0.0, 1.0));
  }
  vec4 observedImage(vec2 p) {
    vec2 uv;
    ${Array.from({length: MAX_IMAGE_TILES}, (_, i) => `
    if (imageSizes[${i}].w>0.5 && insideDEM(p,imageRects[${i}])) {
      uv=vec2((p.x-imageRects[${i}].x)/imageRects[${i}].z,(imageRects[${i}].y-p.y)/imageRects[${i}].w);
      return texture2D(image${i},uv);
    }`).join('')}
    return vec4(0.0);
  }
  float terrainShadow(vec2 p) {
    if (shadowsEnabled<0.5 || shadowReady<0.5 || !insideDEM(p,shadowRect)) return 1.0;
    vec2 uv=vec2((p.x-shadowRect.x)/shadowRect.z,(shadowRect.y-p.y)/shadowRect.w);
    vec2 d=shadowTexelSize*0.65;
    float visibility=0.25*(texture2D(shadowField,uv+vec2(-d.x,-d.y)).r+texture2D(shadowField,uv+vec2(d.x,-d.y)).r+
      texture2D(shadowField,uv+vec2(-d.x,d.y)).r+texture2D(shadowField,uv+d).r);
    float edge=min(min(uv.x,1.0-uv.x),min(uv.y,1.0-uv.y));
    return mix(1.0,visibility,smoothstep(0.0,0.035,edge));
  }
  void main() {
    vec3 normalW = normalize(vNormalW);
    vec3 measured=measuredHeight(vMapXY);
    float elevationM=measured.z>0.5 ? measured.x : vElevation;
    float slopeDegrees=vSlope;
    float occlusion=1.0;
    if (detailShading>0.5 && measured.z>0.5) {
      // Match the derivative baseline to the projected pixel footprint. Fine
      // terrain remains crisp close up and does not shimmer when seen far away.
      float footprint=max(length(dFdx(vMapXY)),length(dFdy(vMapXY)));
      float step=max(measured.y,footprint);
      float west=neighbourHeight(vMapXY-vec2(step,0.0),elevationM);
      float east=neighbourHeight(vMapXY+vec2(step,0.0),elevationM);
      float south=neighbourHeight(vMapXY-vec2(0.0,step),elevationM);
      float north=neighbourHeight(vMapXY+vec2(0.0,step),elevationM);
      vec2 gradient=vec2(east-west,north-south)/(2.0*step);
      if(detailQuality>0.5){
        // A symmetric 3x3 derivative gives the measured grid a stable smooth
        // normal without altering any mesh elevation or adding surface detail.
        float nw=neighbourHeight(vMapXY+vec2(-step,step),elevationM);
        float ne=neighbourHeight(vMapXY+vec2(step,step),elevationM);
        float sw=neighbourHeight(vMapXY+vec2(-step,-step),elevationM);
        float se=neighbourHeight(vMapXY+vec2(step,-step),elevationM);
        vec2 diagonal=vec2(ne+se-nw-sw,ne+nw-se-sw)/(4.0*step);
        gradient=mix(gradient,diagonal,0.5);
      }
      normalW=measuredNormal(vMapXY,elevationM,gradient);
      float q=1.0/(1.0+dot(vMapXY,vMapXY)/(4.0*moonRadius*moonRadius));
      slopeDegrees=degrees(atan(length(gradient)/q));
      float fineCavity=max(0.0,(west+east+south+north)*0.25-elevationM)/step;
      float wideCavity=0.0;
      if(detailQuality>0.5){
        float radius=max(12.0,step*5.0);
        float w=neighbourHeight(vMapXY-vec2(radius,0.0),elevationM-gradient.x*radius);
        float e=neighbourHeight(vMapXY+vec2(radius,0.0),elevationM+gradient.x*radius);
        float s=neighbourHeight(vMapXY-vec2(0.0,radius),elevationM-gradient.y*radius);
        float n=neighbourHeight(vMapXY+vec2(0.0,radius),elevationM+gradient.y*radius);
        // Heights above the local tangent plane darken actual concavities;
        // a smooth planar slope remains unaffected at every orientation.
        wideCavity=(max(0.0,w-elevationM+gradient.x*radius)+max(0.0,e-elevationM-gradient.x*radius)+
          max(0.0,s-elevationM+gradient.y*radius)+max(0.0,n-elevationM-gradient.y*radius))/(4.0*radius);
      }
      occlusion=clamp(exp(-1.6*fineCavity-2.0*wideCavity),0.48,1.0);
    }
    float cosine = dot(normalW, normalize(sunDirection));
    float direct = max(cosine, 0.0);
    float shadow=mix(shadowFloor,1.0,terrainShadow(vMapXY));
    // Studio is an explicitly illustrative clay material with a broad fill
    // for inspection. Lunar keeps a directional neutral surface. Both share
    // exactly the same measured geometry, normals and cast terrain shadows.
    vec3 radial=mapToWorldMetres(vMapXY,0.0)+vec3(0.0,moonRadius,0.0);
    vec3 up=normalize(radial);
    vec3 viewDirection=normalize(sceneToTerrain*normalize(cameraPosition-vPositionW));
    vec3 halfDirection=normalize(viewDirection+sunDirection);
    float hemisphere=0.5+0.5*dot(normalW,up);
    float viewFill=0.35+0.65*max(dot(normalW,viewDirection),0.0);
    vec3 albedo=mix(vec3(0.37,0.375,0.385),vec3(0.435,0.425,0.405),studioStyle);
    vec3 ambient=mix(vec3(0.065),vec3(0.83,0.90,1.0)*(0.08+0.10*hemisphere+0.06*viewFill),studioStyle)*occlusion;
    vec3 keyColor=mix(vec3(1.0),vec3(1.035,1.015,0.97),studioStyle);
    vec3 key=keyColor*mix(1.38,1.18,studioStyle)*direct*shadow;
    float specular=mix(0.012,0.045,studioStyle)*pow(max(dot(normalW,halfDirection),0.0),18.0)*shadow*direct;
    vec3 color=albedo*(ambient+key)+keyColor*specular;
    if(displayMode==1 || displayMode==2){
      albedo=displayMode==1?elevationColor(elevationM):slopeColor(slopeDegrees);
      float light=0.43*occlusion+0.80*pow(direct,0.85)*(0.55+0.45*shadow);
      color=albedo*light;
    }
    if (imageryEnabled>0.5 && (displayMode==0 || displayMode==3)) {
      vec4 photo=observedImage(vMapXY);
      float edge=min(min(vMapXY.x-imageCoverage.x,imageCoverage.x+imageCoverage.z-vMapXY.x),min(imageCoverage.y-vMapXY.y,vMapXY.y-imageCoverage.y+imageCoverage.w));
      float feather=smoothstep(0.0,12.0,edge);
      // Photographs already contain the observed Sun and shadows. Preserve
      // their tonal information instead of lighting/shadowing them a second time.
      color=mix(color,photo.rgb,photo.a*feather);
    }
    if (showContours > 0.5) {
      float contour = elevationM / contourInterval;
      float nearest = abs(fract(contour - 0.5) - 0.5);
      float width = max(fwidth(contour), 0.0005);
      float line = 1.0 - smoothstep(width * 0.22, width * 1.1, nearest);
      color = mix(color, vec3(0.76, 0.64, 0.37), line * 0.56);
    }
    gl_FragColor = vec4(color, 1.0);
    #include <logdepthbuf_fragment>
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

const shadowVertexShader = `
  varying vec2 shadowUv;
  void main(){shadowUv=uv;gl_Position=vec4(position.xy,0.0,1.0);}
`;
const shadowFragmentShader = `
  precision highp sampler2D;
  ${terrainSamplingGLSL}
  uniform vec3 sunDirection;
  uniform vec4 shadowRect;
  uniform float shadowSteps;
  uniform float shadowSoftness;
  uniform vec2 shadowTexelSize;
  varying vec2 shadowUv;
  void main(){
    vec2 xy=vec2(shadowRect.x+shadowUv.x*shadowRect.z,shadowRect.y-shadowUv.y*shadowRect.w);
    vec3 local=measuredHeight(xy);
    if(local.z<0.5){gl_FragColor=vec4(1.0);return;}
    vec3 origin=mapToWorldMetres(xy,local.x);
    float footprint=max(shadowRect.z*shadowTexelSize.x,shadowRect.w*shadowTexelSize.y);
    float bias=max(0.35,local.y*0.18);
    float distanceAlong=max(local.y*1.5,footprint*0.70);
    float illumination=1.0;
    for(int i=0;i<24;i++){
      if(float(i)>=shadowSteps || distanceAlong>80000.0)break;
      vec3 ray=origin+sunDirection*distanceAlong;
      vec3 terrain=measuredHeight(worldToMapMetres(ray));
      float rayHeight=length(ray+vec3(0.0,moonRadius,0.0))-moonRadius;
      if(terrain.z>0.5){
        float clearance=(rayHeight+bias-terrain.x*heightScale)/distanceAlong;
        illumination=min(illumination,smoothstep(-shadowSoftness,shadowSoftness,clearance));
        if(illumination<0.001)break;
      }
      distanceAlong*=1.65;
    }
    gl_FragColor=vec4(vec3(illumination),1.0);
  }
`;

export class LunarTerrain {
  constructor(scene, options = {}) {
    this.scene = scene;
    this.options = options;
    this.manifestUrl = options.manifestUrl || './data/manifest.json';
    this.radius = 1737400;
    this.exaggeration = 1;
    this.quality = options.quality || 'balanced';
    this.style = options.style === 'lunar' ? 'lunar' : 'studio';
    this.renderer = options.renderer || null;
    this.imagery = null;
    this.imageTiles = [];
    this.ready = false;
    this.manifest = null;
    this.datasets = [];
    this.meshes = [];
    this.group = new THREE.Group();
    this.group.name = 'Measured lunar terrain';
    scene.add(this.group);
    this.status = {ready: false, loading: true, progress: 0, loadedDatasets: [], triangles: 0};
    this._emptyDEM = new THREE.DataTexture(new Uint8Array([128,0]),1,1,THREE.RGFormat,THREE.UnsignedByteType);
    this._emptyDEM.needsUpdate=true;
    this._emptyImage = new THREE.DataTexture(new Uint8Array([0,0,0,0]),1,1,THREE.RGBAFormat,THREE.UnsignedByteType);
    this._emptyImage.needsUpdate=true;
    this.uniforms = {
      sunDirection: {value: new THREE.Vector3(-0.5, 0.55, 0.67).normalize()},
      displayMode: {value: 0},
      showContours: {value: 0},
      contourInterval: {value: 250},
      moonRadius: {value:this.radius},
      heightScale: {value:1},
      demRects: {value:Array.from({length:MAX_DEM_LAYERS},()=>new THREE.Vector4(0,0,1,1))},
      demSizes: {value:Array.from({length:MAX_DEM_LAYERS},()=>new THREE.Vector4(1,1,150,0))},
      demDecode: {value:Array.from({length:MAX_DEM_LAYERS},()=>new THREE.Vector4(1,0,0,0))},
      detailShading: {value:1},
      detailQuality: {value:this.quality==='high'?1:0},
      studioStyle: {value:this.style==='studio'?1:0},
      shadowsEnabled: {value:1},
      shadowFloor: {value:0.62},
      sceneToTerrain: {value:new THREE.Matrix3()},
      shadowField: {value:this._emptyImage},
      shadowRect: {value:new THREE.Vector4(0,0,1,1)},
      shadowReady: {value:0},
      shadowTexelSize: {value:new THREE.Vector2(1/1024,1/1024)},
      shadowSoftness: {value:this.style==='studio'?0.018:0.00465},
      shadowSteps: {value:this.quality==='high'?24:18},
      imageryEnabled: {value:0},
      imageRects: {value:Array.from({length:MAX_IMAGE_TILES},()=>new THREE.Vector4(0,0,1,1))},
      imageSizes: {value:Array.from({length:MAX_IMAGE_TILES},()=>new THREE.Vector4(1,1,1,0))},
      imageCoverage: {value:new THREE.Vector4(0,0,1,1)},
    };
    for(let i=0;i<MAX_DEM_LAYERS;i++)this.uniforms[`dem${i}`]={value:this._emptyDEM};
    for(let i=0;i<MAX_IMAGE_TILES;i++)this.uniforms[`image${i}`]={value:this._emptyImage};
    this.material = new THREE.ShaderMaterial({
      uniforms: this.uniforms, vertexShader, fragmentShader,
      side: THREE.FrontSide, wireframe: false,
    });
    // Keep the studio grey as authored. The host renderer's filmic curve
    // would otherwise crush the lit close-up back toward black.
    this.material.toneMapped = false;
    this._revision = 0;
    this._cache = new Map();
    this._queue = [];
    this._pending = null;
    this._activeKeys = new Set();
    this._lodBranches = new Set();
    this._loaded = [];
    this._loading = new Set();
    this._lastPlan = -Infinity;
    this._lastStatus = -Infinity;
    this._dirty = true;
    this._disposed = false;
    this._lastCamera = new THREE.Vector3(Infinity, Infinity, Infinity);
    this._lastTarget = new THREE.Vector3(Infinity, Infinity, Infinity);
    this._focus = new THREE.Vector3();
    this._frustum = new THREE.Frustum();
    this._matrix = new THREE.Matrix4();
    this._scratchVector = new THREE.Vector3();
    this._abort = new AbortController();
    this._shadowDirty = true;
    this._lastShadow = -Infinity;
    this._shadowCentre = new THREE.Vector2(Infinity,Infinity);
    this._shadowSpan = 0;
    if(this.renderer)this._setupShadowField();
  }

  async init() {
    try {
      const response = await fetch(this.manifestUrl, {signal: this._abort.signal});
      if (!response.ok) throw new Error(`Terrain manifest could not be loaded (HTTP ${response.status}).`);
      this.manifest = await response.json();
      this.radius = this.manifest.radius || this.manifest.referenceRadius || this.manifest.referenceRadiusM || this.radius;
      this.uniforms.moonRadius.value=this.radius;
      const list = this.manifest.datasets;
      if (!Array.isArray(list) || !list.length) throw new Error('No measured elevation grids were found in the terrain manifest.');
      this.datasets = list.map((data, index) => {
        const spacing = Number(data.spacing ?? data.dx);
        const width = Number(data.width), height = Number(data.height);
        const xMin = Number(data.xMin), yMax = Number(data.yMax);
        if (![spacing, width, height, xMin, yMax].every(Number.isFinite) || spacing <= 0 || width < 2 || height < 2) {
          throw new Error(`Invalid grid coordinates for ${data.id || index}.`);
        }
        return {...data, id: data.id || `grid-${index}`, name: data.name || data.id || `Grid ${index + 1}`,
          spacing, width, height, xMin, yMax,
          xMax: xMin + (width - 1) * spacing,
          yMin: yMax - (height - 1) * spacing,
          nativeSpacing: Number(data.nativeSpacing || spacing),
          scale: Number(data.scale ?? 1), offset: Number(data.offset || 0),
          nodata: Number(data.nodata ?? -32768), loaded: false, failed: false,
        };
      }).sort((a, b) => b.spacing - a.spacing);
      if(this.datasets.length>MAX_DEM_LAYERS)throw new Error(`At most ${MAX_DEM_LAYERS} elevation layers are supported.`);
      this.datasets.forEach((data,index)=>{data.textureSlot=index;});
      this.overview = this.datasets[0];
      this.bounds = {xMin: this.overview.xMin, xMax: this.overview.xMax,
        yMin: this.overview.yMin, yMax: this.overview.yMax};
      await this._loadDataset(this.overview);
      if (this._disposed) return this;
      const root = this._node(0, 0, 0);
      const mesh = this._buildTile(root);
      const key = this._key(root);
      this._cache.set(key, {mesh, used: now(), node: root});
      this._activeKeys = new Set([key]);
      this.meshes = [mesh];
      this.group.add(mesh);
      mesh.visible = true;
      this.ready = true;
      this._dirty = true;
      this._emit({ready: true, progress: 1, loading: false, meshSpacing: root.step}, true);
      return this;
    } catch (error) {
      if (this._disposed) return this;
      this._emit({ready: false, loading: false, error: error.message}, true);
      throw error;
    }
  }

  _emit(patch = {}, force = false) {
    this.status = {...this.status, ...patch,
      loadedDatasets: this.datasets.filter(d => d.loaded).map(d => d.id),
      loadingDatasets: [...this._loading],
    };
    if (force || now() - this._lastStatus > 120) {
      this._lastStatus = now();
      this.options.onStatus?.({...this.status});
    }
  }

  async _loadDataset(dataset) {
    if(dataset.loaded || dataset.failed || this._disposed)return;
    if(dataset.loadingPromise)return dataset.loadingPromise;
    dataset.loadingPromise=this._loadDatasetInternal(dataset);
    return dataset.loadingPromise;
  }

  async _loadDatasetInternal(dataset) {
    if (dataset.loaded || dataset.failed || this._disposed) return;
    this._loading.add(dataset.id);
    this._emit({loading: true, progress: 0, loadingName: dataset.name}, true);
    try {
      if(dataset.blendMaskFile){
        const centreX=(dataset.xMin+dataset.xMax)/2,centreY=(dataset.yMin+dataset.yMax)/2;
        const underlay=this.datasets.filter(d=>d.spacing>dataset.spacing && !d.failed && this._contains(d,centreX,centreY))
          .sort((a,b)=>a.spacing-b.spacing)[0];
        if(underlay && !underlay.loaded)await this._loadDataset(underlay);
      }
      const base = new URL(this.manifestUrl, location.href);
      const url = new URL(dataset.file, base).href;
      const response = await fetch(url, {signal: this._abort.signal});
      if (!response.ok) throw new Error(`${dataset.name} could not be loaded (HTTP ${response.status}).`);
      let buffer;
      const length = Number(response.headers.get('content-length') || dataset.compressedBytes || 0);
      if (response.body) {
        const reader = response.body.getReader();
        const chunks = [];
        let bytes = 0;
        for (;;) {
          const {value, done} = await reader.read();
          if (done) break;
          chunks.push(value); bytes += value.byteLength;
          this._emit({progress: length ? Math.min(bytes / length, 0.98) : 0,
            loadedBytes: bytes, totalBytes: length, loadingName: dataset.name});
        }
        const merged = new Uint8Array(bytes);
        let offset = 0;
        for (const chunk of chunks) {merged.set(chunk, offset); offset += chunk.byteLength;}
        buffer = merged.buffer;
      } else buffer = await response.arrayBuffer();
      const magic = new Uint8Array(buffer, 0, Math.min(2, buffer.byteLength));
      if (magic[0] === 0x1f && magic[1] === 0x8b) {
        if (!('DecompressionStream' in globalThis)) throw new Error('This browser cannot decompress the elevation grids. Please use an up-to-date browser.');
        buffer = await new Response(new Blob([buffer]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer();
      }
      const expected = dataset.width * dataset.height * 2;
      if (buffer.byteLength !== expected) throw new Error(`The ${dataset.name} grid is incomplete: expected ${expected} bytes, received ${buffer.byteLength}.`);
      dataset.values = new Int16Array(buffer);
      // All supported browser platforms are little-endian; retain a portable
      // path for the raw, explicitly little-endian scientific data format.
      if (new Uint8Array(new Uint16Array([1]).buffer)[0] !== 1) {
        const view = new DataView(buffer), decoded = new Int16Array(dataset.width * dataset.height);
        for (let i = 0; i < decoded.length; i++) decoded[i] = view.getInt16(i * 2, true);
        dataset.values = decoded;
      }
      if(dataset.blendMaskFile){
        const maskBuffer=await this._readCompressed(new URL(dataset.blendMaskFile,base).href,dataset.width*dataset.height);
        dataset.blendWeights=new Uint8Array(maskBuffer);
      }
      this._createHeightTexture(dataset);
      dataset.loaded = true;
      this._loaded = this.datasets.filter(d => d.loaded).sort((a, b) => a.spacing - b.spacing);
      this._revision++;
      this._dirty = true;
      this._queue = [];
      this._pending = null;
      this._shadowDirty=true;
      this._emit({progress: 1, error: null}, true);
    } catch (error) {
      if (this._disposed) return;
      dataset.failed = true;
      dataset.error = error.message;
      this._emit({error: error.message}, true);
      if (dataset === this.overview) throw error;
    } finally {
      this._loading.delete(dataset.id);
      this._emit({loading: this._loading.size > 0}, true);
    }
  }

  async _readCompressed(url,expectedBytes){
    const response=await fetch(url,{signal:this._abort.signal});
    if(!response.ok)throw new Error(`Terrain detail file could not be loaded (HTTP ${response.status}).`);
    let buffer=await response.arrayBuffer();
    const header=new Uint8Array(buffer,0,Math.min(2,buffer.byteLength));
    if(header[0]===0x1f && header[1]===0x8b){
      if(!('DecompressionStream' in globalThis))throw new Error('This browser cannot decompress the elevation detail.');
      buffer=await new Response(new Blob([buffer]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer();
    }
    if(buffer.byteLength!==expectedBytes)throw new Error('A terrain detail file has an unexpected sample count.');
    return buffer;
  }

  _createHeightTexture(data){
    const limit=Math.max(256,Math.min(this.renderer?.capabilities.maxTextureSize||4096,4096));
    const reduction=Math.max(1,Math.ceil(Math.max(data.width,data.height)/limit));
    const width=Math.ceil((data.width-1)/reduction)+1,height=Math.ceil((data.height-1)/reduction)+1;
    const channels=data.blendWeights?4:2;
    const bytes=new Uint8Array(width*height*channels);
    for(let row=0;row<height;row++){
      const sourceRow=Math.round(row*(data.height-1)/(height-1))*data.width;
      for(let col=0;col<width;col++){
        const source=sourceRow+Math.round(col*(data.width-1)/(width-1));
        const encoded=data.values[source]+32768,offset=(row*width+col)*channels;
        bytes[offset]=(encoded>>>8)&255;bytes[offset+1]=encoded&255;
        if(channels===4){bytes[offset+2]=data.blendWeights[source];bytes[offset+3]=255;}
      }
    }
    const texture=new THREE.DataTexture(bytes,width,height,channels===4?THREE.RGBAFormat:THREE.RGFormat,THREE.UnsignedByteType);
    texture.minFilter=texture.magFilter=THREE.NearestFilter;
    texture.wrapS=texture.wrapT=THREE.ClampToEdgeWrapping;
    texture.generateMipmaps=false;texture.flipY=false;texture.unpackAlignment=1;
    texture.colorSpace=THREE.NoColorSpace;texture.needsUpdate=true;
    data.heightTexture=texture;
    const slot=data.textureSlot,spacing=Math.max((data.xMax-data.xMin)/(width-1),(data.yMax-data.yMin)/(height-1));
    this.uniforms[`dem${slot}`].value=texture;
    this.uniforms.demRects.value[slot].set(data.xMin,data.yMax,data.xMax-data.xMin,data.yMax-data.yMin);
    this.uniforms.demSizes.value[slot].set(width,height,spacing,1);
    this.uniforms.demDecode.value[slot].set(data.scale,data.offset,data.nodataSamples>0?1:0,data.blendWeights?1:0);
  }

  _blendWeight(data,x,y){
    if(!data.blendWeights)return 1;
    const u=clamp((x-data.xMin)/data.spacing,0,data.width-1),v=clamp((data.yMax-y)/data.spacing,0,data.height-1);
    const col=Math.min(Math.floor(u),data.width-2),row=Math.min(Math.floor(v),data.height-2),tx=u-col,ty=v-row,i=row*data.width+col;
    const a=data.blendWeights;
    return ((a[i]*(1-tx)+a[i+1]*tx)*(1-ty)+(a[i+data.width]*(1-tx)+a[i+data.width+1]*tx)*ty)/255;
  }

  _contains(data, x, y, margin = 0) {
    return x >= data.xMin - margin && x <= data.xMax + margin &&
      y >= data.yMin - margin && y <= data.yMax + margin;
  }

  _height(data, x, y) {
    const u = clamp((x - data.xMin) / data.spacing, 0, data.width - 1);
    const v = clamp((data.yMax - y) / data.spacing, 0, data.height - 1);
    const col = Math.min(Math.floor(u), data.width - 2);
    const row = Math.min(Math.floor(v), data.height - 2);
    const tx = u - col, ty = v - row, index = row * data.width + col;
    const a = data.values[index], b = data.values[index + 1];
    const c = data.values[index + data.width], d = data.values[index + data.width + 1];
    if (a === data.nodata || b === data.nodata || c === data.nodata || d === data.nodata) return null;
    return ((a * (1 - tx) + b * tx) * (1 - ty) + (c * (1 - tx) + d * tx) * ty) * data.scale + data.offset;
  }

  _sample(x, y, start=0) {
    for (let i=start;i<this._loaded.length;i++) {
      const data=this._loaded[i];
      if (!this._contains(data, x, y, 0.0001)) continue;
      const elevation = this._height(data, x, y);
      if (elevation !== null){
        const weight=this._blendWeight(data,x,y);
        if(weight<0.0001)continue;
        if(weight<0.9999){
          const lower=this._sample(x,y,i+1);
          if(lower)return {elevation:lower.elevation*(1-weight)+elevation*weight,data,blendWeight:weight,underlyingData:lower.data};
        }
        return {elevation,data,blendWeight:1};
      }
    }
    return null;
  }

  _gradient(data, x, y) {
    const step = data.spacing;
    const xa = Math.max(data.xMin, x - step), xb = Math.min(data.xMax, x + step);
    const ya = Math.max(data.yMin, y - step), yb = Math.min(data.yMax, y + step);
    const west = this._sample(xa,y)?.elevation, east = this._sample(xb,y)?.elevation;
    const south = this._sample(x,ya)?.elevation, north = this._sample(x,yb)?.elevation;
    return {
      dx: Number.isFinite(west) && Number.isFinite(east) ? (east - west) / Math.max(1, xb - xa) : 0,
      dy: Number.isFinite(south) && Number.isFinite(north) ? (north - south) / Math.max(1, yb - ya) : 0,
    };
  }

  getElevation(x, y) {
    const sample = this._sample(x, y);
    if (!sample) return null;
    const {data, elevation} = sample;
    const gradient = this._gradient(data, x, y);
    const q = 1 / (1 + (x * x + y * y) / (4 * this.radius * this.radius));
    return {x, y, elevation, height: elevation, spacing: data.spacing,
      nativeSpacing: data.nativeSpacing, dataset: data.id, datasetName: data.name,
      slope: Math.atan(Math.hypot(gradient.dx, gradient.dy) / q) / DEG,
      sourceUrl: data.sourceUrl, sourcePage: data.sourcePage};
  }

  toWorld(x, y, elevation) {
    if (elevation === undefined) elevation = this._sample(x, y)?.elevation ?? 0;
    const r = this.radius, h = elevation * this.exaggeration;
    const t = (x * x + y * y) / (4 * r * r), q = 1 / (1 + t), factor = 1 + h / r;
    return new THREE.Vector3(x * q * factor / 1000,
      ((r + h) * (1 - t) * q - r) / 1000,
      -y * q * factor / 1000);
  }

  fromWorld(point) {
    const X = point.x * 1000, Y = point.y * 1000 + this.radius, Z = point.z * 1000;
    const length = Math.hypot(X, Y, Z);
    const horizontal = Math.hypot(X, Z);
    const angle = Math.atan2(horizontal, Y);
    const rho = 2 * this.radius * Math.tan(angle / 2);
    const x = horizontal > 1e-10 ? rho * X / horizontal : 0;
    const y = horizontal > 1e-10 ? -rho * Z / horizontal : 0;
    const lon = horizontal > 1e-10 ? Math.atan2(x, y) / DEG : 0;
    return {x, y, elevation: (length - this.radius) / this.exaggeration,
      lat: -90 + angle / DEG, lon: ((lon % 360) + 360) % 360};
  }

  _node(level, ix, iy) {
    const divisions = 2 ** level;
    const w = (this.bounds.xMax - this.bounds.xMin) / divisions;
    const h = (this.bounds.yMax - this.bounds.yMin) / divisions;
    return {level, ix, iy, xMin: this.bounds.xMin + ix * w,
      xMax: this.bounds.xMin + (ix + 1) * w,
      yMax: this.bounds.yMax - iy * h, yMin: this.bounds.yMax - (iy + 1) * h,
      width: w, height: h, step: Math.max(w, h) / 64};
  }

  _key(node) {return `${this._revision}/${node.level}/${node.ix}/${node.iy}`;}

  _minimumSpacing(node) {
    let spacing = this.overview.spacing;
    for (const data of this._loaded) {
      if (data.xMax >= node.xMin && data.xMin <= node.xMax && data.yMax >= node.yMin && data.yMin <= node.yMax) {
        spacing = Math.min(spacing, data.spacing);
      }
    }
    return spacing;
  }

  _select(camera, threshold) {
    const leaves = [];
    const viewport = this.options.viewportHeight?.() || Math.min(globalThis.innerHeight || 900, 1400);
    const pixelScale = viewport / (2 * Math.tan((camera.fov || 55) * DEG / 2));
    camera.updateMatrixWorld();
    this._matrix.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
    this._frustum.setFromProjectionMatrix(this._matrix);
    const visit = node => {
      const x = (node.xMin + node.xMax) / 2, y = (node.yMin + node.yMax) / 2;
      const p = this.toWorld(x, y);
      const radius = Math.hypot(node.width, node.height) / 2000 + Math.min(8, node.width / 5000);
      const visible = this._frustum.intersectsSphere(new THREE.Sphere(p, radius));
      const nearestX = clamp(this._cameraXY.x, node.xMin, node.xMax);
      const nearestY = clamp(this._cameraXY.y, node.yMin, node.yMax);
      const nearest = this.toWorld(nearestX, nearestY);
      const distance = Math.max(0.008, camera.position.distanceTo(nearest));
      const screenError = (node.step / 1000) * pixelScale / distance;
      const native = this._minimumSpacing(node);
      // Separate split and merge thresholds prevent a tile from repeatedly
      // changing resolution during small camera movements near a boundary.
      const wasSplit=this._lodBranches.has(`${node.level}/${node.ix}/${node.iy}`);
      const splitThreshold=threshold*(wasSplit?0.84:1.08);
      if (visible && node.level < 12 && node.step > native * 0.99 && screenError > splitThreshold) {
        for (let iy = 0; iy < 2; iy++) for (let ix = 0; ix < 2; ix++) {
          visit(this._node(node.level + 1, node.ix * 2 + ix, node.iy * 2 + iy));
        }
      } else leaves.push(node);
    };
    visit(this._node(0, 0, 0));
    return leaves;
  }

  _plan(camera, target) {
    this._cameraXY = this.fromWorld(camera.position);
    let threshold = this.quality === 'high' ? 0.95 : 1.8;
    const maxTiles = this.quality === 'high' ? 288 : 150;
    let nodes = this._select(camera, threshold);
    let lowerThreshold=threshold;
    for (let i = 0; nodes.length > maxTiles && i < 16; i++) {
      lowerThreshold=threshold;
      threshold *= 1.3;
      nodes = this._select(camera, threshold);
    }
    // Fit the last split threshold to the existing budget instead of leaving
    // up to a quarter of it unused after a coarse multiplicative search.
    if(lowerThreshold<threshold && nodes.length<=maxTiles){
      for(let i=0;i<5;i++){
        const middle=(lowerThreshold+threshold)*0.5;
        const candidate=this._select(camera,middle);
        if(candidate.length<=maxTiles){threshold=middle;nodes=candidate;}
        else lowerThreshold=middle;
      }
    }
    const focus = this.fromWorld(target);
    const focusSpacing=this._sample(focus.x,focus.y)?.data.spacing;
    const viewport=this.options.viewportHeight?.()||Math.min(globalThis.innerHeight||900,1400);
    const nativePixels=focusSpacing/1000*viewport/(2*Math.tan((camera.fov||55)*DEG/2)*Math.max(0.008,camera.position.distanceTo(target)));
    if(nativePixels>1){
      // Reserve any remaining capacity for the inspected surface. Sampling
      // below the DEM interval only interpolates its measured elevations.
      for(let depth=0;depth<12 && nodes.length+3<=maxTiles;depth++){
        const index=nodes.findIndex(n=>focus.x>=n.xMin && focus.x<=n.xMax && focus.y>=n.yMin && focus.y<=n.yMax);
        if(index<0)break;
        const node=nodes[index];
        if(node.step<=focusSpacing || node.level>=12)break;
        const children=[];
        for(let iy=0;iy<2;iy++)for(let ix=0;ix<2;ix++)children.push(this._node(node.level+1,node.ix*2+ix,node.iy*2+iy));
        nodes.splice(index,1,...children);
      }
    }
    const keys = nodes.map(node => this._key(node));
    const signature = keys.join('|');
    if (this._pending?.signature === signature) return;
    if (!this._pending && keys.length === this._activeKeys.size && keys.every(k => this._activeKeys.has(k))) return;
    nodes.sort((a, b) => {
      const ax = (a.xMin + a.xMax) / 2 - focus.x, ay = (a.yMin + a.yMax) / 2 - focus.y;
      const bx = (b.xMin + b.xMax) / 2 - focus.x, by = (b.yMin + b.yMax) / 2 - focus.y;
      return ax * ax + ay * ay - bx * bx - by * by;
    });
    this._pending = {keys, signature, revision: this._revision, nodes};
    this._queue = nodes.filter(node => !this._cache.has(this._key(node)));
    if (!this._queue.length) this._activate();
  }

  _buildTile(node) {
    const count = 64, side = count + 1, surfaceCount = side * side;
    const border = [];
    for (let c = 0; c <= count; c++) border.push(c);
    for (let r = 1; r <= count; r++) border.push(r * side + count);
    for (let c = count - 1; c >= 0; c--) border.push(count * side + c);
    for (let r = count - 1; r >= 1; r--) border.push(r * side);
    const total = surfaceCount + border.length;
    const positions = new Float32Array(total * 3), normals = new Float32Array(total * 3);
    const elevations = new Float32Array(total), slopes = new Float32Array(total);
    const mapCoordinates = new Float32Array(total * 2);
    const R = this.radius, R2 = R * R, exaggeration = this.exaggeration;
    for (let row = 0; row <= count; row++) {
      const y = node.yMax - row * node.height / count;
      for (let col = 0; col <= count; col++) {
        const x = node.xMin + col * node.width / count;
        const i = row * side + col, k = i * 3;
        mapCoordinates[i*2]=x;mapCoordinates[i*2+1]=y;
        const sample = this._sample(x, y);
        const h = sample?.elevation ?? 0;
        const {dx, dy} = sample ? this._gradient(sample.data, x, y) : {dx: 0, dy: 0};
        const t = (x * x + y * y) / (4 * R2), q = 1 / (1 + t), q2 = q * q;
        const f = 1 + h * exaggeration / R;
        const rx = x * q / R, ry = (1 - t) * q, rz = -y * q / R;
        positions[k] = x * q * f / 1000;
        positions[k + 1] = ((R + h * exaggeration) * ry - R) / 1000;
        positions[k + 2] = -y * q * f / 1000;
        const ex = (q - x * x * q2 / (2 * R2)) * f + rx * dx * exaggeration;
        const ey = -x * q2 / R * f + ry * dx * exaggeration;
        const ez = x * y * q2 / (2 * R2) * f + rz * dx * exaggeration;
        const nx = -x * y * q2 / (2 * R2) * f + rx * dy * exaggeration;
        const ny = -y * q2 / R * f + ry * dy * exaggeration;
        const nz = (-q + y * y * q2 / (2 * R2)) * f + rz * dy * exaggeration;
        let normalX = ey * nz - ez * ny, normalY = ez * nx - ex * nz, normalZ = ex * ny - ey * nx;
        const normalLength = Math.hypot(normalX, normalY, normalZ) || 1;
        normals[k] = normalX / normalLength;
        normals[k + 1] = normalY / normalLength;
        normals[k + 2] = normalZ / normalLength;
        elevations[i] = h;
        slopes[i] = Math.atan(Math.hypot(dx, dy) / q) / DEG;
      }
    }
    // Downward skirts conceal cracks between adjacent mesh LODs. They do not
    // displace the measured surface or contribute to height/slope inspection.
    const skirt = Math.max(0.002, Math.min(3, node.step * 2 / 1000));
    for (let j = 0; j < border.length; j++) {
      const original = border[j], duplicate = surfaceCount + j;
      const a = original * 3, b = duplicate * 3;
      const radialX = positions[a], radialY = positions[a + 1] + R / 1000, radialZ = positions[a + 2];
      const length = Math.hypot(radialX, radialY, radialZ);
      positions[b] = positions[a] - skirt * radialX / length;
      positions[b + 1] = positions[a + 1] - skirt * radialY / length;
      positions[b + 2] = positions[a + 2] - skirt * radialZ / length;
      normals[b] = normals[a]; normals[b + 1] = normals[a + 1]; normals[b + 2] = normals[a + 2];
      elevations[duplicate] = elevations[original]; slopes[duplicate] = slopes[original];
      mapCoordinates[duplicate*2]=mapCoordinates[original*2];mapCoordinates[duplicate*2+1]=mapCoordinates[original*2+1];
    }
    const indices = new Uint16Array(count * count * 6 + border.length * 6);
    let out = 0;
    for (let row = 0; row < count; row++) for (let col = 0; col < count; col++) {
      const a = row * side + col, b = a + 1, c = a + side, d = c + 1;
      indices[out++] = a; indices[out++] = c; indices[out++] = b;
      indices[out++] = b; indices[out++] = c; indices[out++] = d;
    }
    for (let j = 0; j < border.length; j++) {
      const next = (j + 1) % border.length;
      const a = border[j], b = border[next], c = surfaceCount + j, d = surfaceCount + next;
      indices[out++] = a; indices[out++] = b; indices[out++] = c;
      indices[out++] = b; indices[out++] = d; indices[out++] = c;
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
    geometry.setAttribute('elevation', new THREE.BufferAttribute(elevations, 1));
    geometry.setAttribute('slope', new THREE.BufferAttribute(slopes, 1));
    geometry.setAttribute('mapXY', new THREE.BufferAttribute(mapCoordinates,2));
    geometry.setIndex(new THREE.BufferAttribute(indices, 1));
    geometry.computeBoundingSphere(); geometry.computeBoundingBox();
    const mesh = new THREE.Mesh(geometry, this.material);
    mesh.name = `LOLA terrain ${node.level}/${node.ix}/${node.iy}`;
    mesh.userData = {node, terrainSurfaceIndices: count * count * 6};
    mesh.visible = false;
    return mesh;
  }

  _activate() {
    if (!this._pending || this._pending.revision !== this._revision) return;
    if (!this._pending.keys.every(key => this._cache.has(key))) return;
    for (const mesh of this.meshes) mesh.visible = false;
    this._activeKeys = new Set(this._pending.keys);
    this.meshes = this._pending.keys.map(key => {
      const cached = this._cache.get(key); cached.used = now(); cached.mesh.visible = true;
      return cached.mesh;
    });
    const focus = this.fromWorld(this._focus);
    const focusNode = this._pending.nodes.find(n => focus.x >= n.xMin && focus.x <= n.xMax && focus.y >= n.yMin && focus.y <= n.yMax);
    const triangles = this.meshes.reduce((n, m) => n + m.geometry.index.count / 3, 0);
    this._lodBranches.clear();
    for(const node of this._pending.nodes){
      for(let level=0;level<node.level;level++){
        const shift=node.level-level;
        this._lodBranches.add(`${level}/${node.ix>>shift}/${node.iy>>shift}`);
      }
    }
    this._pending = null;
    this._emit({triangles, tiles: this.meshes.length, meshSpacing: focusNode?.step}, true);
    this._trimCache();
  }

  _trimCache() {
    const maximum = this.quality === 'high' ? 380 : 215;
    const free = [...this._cache].filter(([key]) => !this._activeKeys.has(key) && !this._pending?.keys.includes(key));
    free.sort((a, b) => a[1].used - b[1].used);
    for (const [key, item] of free) {
      if (this._cache.size <= maximum && key.startsWith(`${this._revision}/`)) break;
      this.group.remove(item.mesh); item.mesh.geometry.dispose(); this._cache.delete(key);
    }
  }

  _loadForFocus(camera, target) {
    const focus = this.fromWorld(target);
    const distance = camera.position.distanceTo(target) * 1000;
    const candidates = this.datasets.filter(data => {
      if (data.loaded || data.failed || this._loading.has(data.id)) return false;
      const margin = Math.min(distance * 0.3, 20000);
      const limit = data.spacing <= 2 ? 14000 : data.spacing <= 5 ? 34000 : data.spacing <= 20 ? 110000 : 280000;
      return distance < limit && this._contains(data, focus.x, focus.y, margin);
    }).sort((a, b) => a.spacing - b.spacing);
    while (this._loading.size < 2 && candidates.length) this._loadDataset(candidates.shift());
  }

  update(camera, target) {
    if (!this.ready || this._disposed) return;
    target = target || this._focus;
    this._focus.copy(target);
    const time = now();
    if (time - this._lastPlan > 180) {
      this._loadForFocus(camera, target);
      const moved = camera.position.distanceToSquared(this._lastCamera) > 0.000001 || target.distanceToSquared(this._lastTarget) > 0.000001;
      if (this._dirty || moved) {
        this._plan(camera, target);
        this._lastCamera.copy(camera.position); this._lastTarget.copy(target);
        this._dirty = false;
      }
      const info = this.getElevation(this.fromWorld(target).x, this.fromWorld(target).y);
      const imageInfo=this.getImageryInfo(this.fromWorld(target).x,this.fromWorld(target).y);
      this._emit({spacing: info?.spacing, nativeSpacing: info?.nativeSpacing, dataset: info?.dataset, datasetName: info?.datasetName,
        imageryAvailableAtFocus:imageInfo.available,imagerySpacing:imageInfo.spacing});
      this._lastPlan = time;
    }
    const start = now();
    while (this._queue.length && now() - start < 6) {
      const node = this._queue.shift(), key = this._key(node);
      if (this._cache.has(key)) continue;
      const mesh = this._buildTile(node);
      this._cache.set(key, {node, mesh, used: now()});
      this.group.add(mesh);
    }
    if (this._pending && !this._queue.length) this._activate();
    this._updateShadowField(camera,target,time);
  }

  setExaggeration(factor) {
    factor = clamp(Number(factor) || 1, 0.25, 5);
    if (factor === this.exaggeration) return;
    this.exaggeration = factor; this._revision++; this._dirty = true;
    this.uniforms.heightScale.value=factor;this._shadowDirty=true;
    this._queue = []; this._pending = null;
    this._emit({exaggeration: factor}, true);
  }

  setMode(mode) {
    this.mode = mode;
    this.uniforms.displayMode.value = ({surface: 0, elevation: 1, slope: 2, imagery:3})[mode] ?? 0;
    this.uniforms.imageryEnabled.value=mode==='imagery'?1:0;
  }

  setStyle(style) {
    this.style=style==='lunar'?'lunar':'studio';
    this.uniforms.studioStyle.value=this.style==='studio'?1:0;
    this.uniforms.shadowSoftness.value=this.style==='studio'?0.018:0.00465;
    this._shadowDirty=true;
    this._emit({style:this.style},true);
  }

  setSun(azimuthDeg, elevationDeg) {
    const az = Number(azimuthDeg) * DEG, el = Number(elevationDeg) * DEG;
    if (!Number.isFinite(az) || !Number.isFinite(el)) return;
    this.uniforms.sunDirection.value.set(Math.sin(az) * Math.cos(el), Math.sin(el), -Math.cos(az) * Math.cos(el));
    this._shadowDirty=true;
  }

  setContours(show, interval = 250) {
    this.uniforms.showContours.value = show ? 1 : 0;
    this.uniforms.contourInterval.value = Math.max(10, Number(interval) || 250);
  }

  setQuality(quality) {
    this.quality = quality === 'high' ? 'high' : 'balanced';
    this.uniforms.shadowSteps.value=this.quality==='high'?24:18;
    this.uniforms.detailQuality.value=this.quality==='high'?1:0;
    this._shadowDirty=true;
    this._dirty = true;
  }

  setShadows(enabled){
    this.uniforms.shadowsEnabled.value=enabled?1:0;
    if(enabled)this._shadowDirty=true;
    this._emit({shadows:!!enabled});
  }

  setDetailShading(enabled){
    this.uniforms.detailShading.value=enabled?1:0;
    this._emit({detailShading:!!enabled});
  }

  setImagery(enabled){
    this.uniforms.imageryEnabled.value=enabled?1:0;
    this._emit({imageryEnabled:!!enabled});
  }

  _setupShadowField(){
    const resolution=Math.min(1024,this.renderer.capabilities.maxTextureSize||1024);
    this.uniforms.shadowTexelSize.value.set(1/resolution,1/resolution);
    this.shadowTarget=new THREE.WebGLRenderTarget(resolution,resolution,{format:THREE.RGBAFormat,type:THREE.UnsignedByteType,
      minFilter:THREE.LinearFilter,magFilter:THREE.LinearFilter,depthBuffer:false,stencilBuffer:false});
    this.shadowTarget.texture.colorSpace=THREE.NoColorSpace;
    this.shadowMaterial=new THREE.ShaderMaterial({uniforms:this.uniforms,vertexShader:shadowVertexShader,fragmentShader:shadowFragmentShader,depthTest:false,depthWrite:false});
    this.shadowScene=new THREE.Scene();
    this.shadowQuad=new THREE.Mesh(new THREE.PlaneGeometry(2,2),this.shadowMaterial);
    this.shadowQuad.frustumCulled=false;this.shadowScene.add(this.shadowQuad);
    this.shadowCamera=new THREE.OrthographicCamera(-1,1,1,-1,0,1);
    this.uniforms.shadowField.value=this.shadowTarget.texture;
  }

  _updateShadowField(camera,target,time){
    if(!this.renderer || !this.shadowTarget || this.uniforms.shadowsEnabled.value<0.5)return;
    const focus=this.fromWorld(target),distance=camera.position.distanceTo(target)*1000;
    const wanted=Math.min(409600,Math.max(1024,1024*2**Math.ceil(Math.log2(Math.max(1,distance*1.9/1024)))));
    const drift=Math.hypot(focus.x-this._shadowCentre.x,focus.y-this._shadowCentre.y);
    const needs=this._shadowDirty || wanted!==this._shadowSpan || drift>this._shadowSpan*0.17;
    if(!needs || time-this._lastShadow<180)return;
    const snap=wanted/16,cx=Math.round(focus.x/snap)*snap,cy=Math.round(focus.y/snap)*snap;
    this.uniforms.shadowRect.value.set(cx-wanted/2,cy+wanted/2,wanted,wanted);
    const previous=this.renderer.getRenderTarget();
    const previousAutoClear=this.renderer.autoClear;
    try{
      this.renderer.setRenderTarget(this.shadowTarget);this.renderer.autoClear=true;
      this.renderer.render(this.shadowScene,this.shadowCamera);
      this.uniforms.shadowReady.value=1;
      this._shadowCentre.set(cx,cy);this._shadowSpan=wanted;this._shadowDirty=false;this._lastShadow=time;
    } finally{
      this.renderer.setRenderTarget(previous);this.renderer.autoClear=previousAutoClear;
    }
  }

  async loadImagery(manifestUrl='./data/imagery/manifest.json'){
    if(this._imageryPromise)return this._imageryPromise;
    this._imageryPromise=(async()=>{
      this._emit({imageryLoading:true,imageryLoaded:false,imageryError:null},true);
      try{
        const response=await fetch(manifestUrl,{signal:this._abort.signal});
        if(!response.ok)throw new Error(`Orbital imagery manifest could not be loaded (HTTP ${response.status}).`);
        const manifest=await response.json();
        this.imagery=manifest.imagery||manifest;
        const tiles=this.imagery.tiles;
        if(!Array.isArray(tiles)||!tiles.length||tiles.length>MAX_IMAGE_TILES)throw new Error('Orbital imagery tile metadata is invalid.');
        const base=new URL(manifestUrl,location.href),loader=new THREE.TextureLoader();
        this.imageTiles=tiles.map((tile,index)=>({...tile,index,loaded:false,spacing:Number(tile.spacing||tile.nativeSpacing||1)}));
        const coverage=this.imagery.edgeBounds||{
          xMin:Math.min(...this.imageTiles.map(t=>t.xMin-t.spacing/2)),
          xMax:Math.max(...this.imageTiles.map(t=>t.xMin+(t.width-.5)*t.spacing)),
          yMax:Math.max(...this.imageTiles.map(t=>t.yMax+t.spacing/2)),
          yMin:Math.min(...this.imageTiles.map(t=>t.yMax-(t.height-.5)*t.spacing))};
        this.uniforms.imageCoverage.value.set(coverage.xMin,coverage.yMax,coverage.xMax-coverage.xMin,coverage.yMax-coverage.yMin);
        await Promise.all(this.imageTiles.map(async tile=>{
          const texture=await loader.loadAsync(new URL(tile.file,base).href);
          if(this._disposed){texture.dispose();return;}
          const limit=this.renderer?.capabilities.maxTextureSize||4096;
          if(Math.max(texture.image.width,texture.image.height)>limit){texture.dispose();throw new Error('This graphics processor cannot display the full-resolution imagery tiles.');}
          texture.flipY=false;texture.colorSpace=THREE.SRGBColorSpace;
          texture.minFilter=THREE.LinearMipmapLinearFilter;texture.magFilter=THREE.LinearFilter;
          texture.generateMipmaps=true;texture.anisotropy=Math.min(16,this.renderer?.capabilities.getMaxAnisotropy?.()||4);
          texture.wrapS=texture.wrapT=THREE.ClampToEdgeWrapping;texture.needsUpdate=true;
          tile.texture=texture;tile.loaded=true;
          const x=tile.xMin-tile.spacing/2,y=tile.yMax+tile.spacing/2,w=tile.width*tile.spacing,h=tile.height*tile.spacing;
          tile.edgeBounds={xMin:x,xMax:x+w,yMax:y,yMin:y-h};
          this.uniforms[`image${tile.index}`].value=texture;
          this.uniforms.imageRects.value[tile.index].set(x,y,w,h);
          this.uniforms.imageSizes.value[tile.index].set(tile.width,tile.height,tile.spacing,1);
          this._emit({imageryLoaded:this.imageTiles.every(t=>t.loaded),imageryTilesLoaded:this.imageTiles.filter(t=>t.loaded).length},true);
        }));
        this._emit({imageryLoading:false,imageryLoaded:true,imageryError:null},true);
        return this.imagery;
      }catch(error){
        this._emit({imageryLoading:false,imageryLoaded:false,imageryError:error.message},true);
        throw error;
      }
    })();
    return this._imageryPromise;
  }

  getImageryInfo(x,y){
    const tile=this.imageTiles.find(t=>t.loaded && x>=t.edgeBounds.xMin && x<=t.edgeBounds.xMax && y<=t.edgeBounds.yMax && y>=t.edgeBounds.yMin);
    return tile?{available:true,spacing:tile.spacing,name:this.imagery.name,tile:tile.id,sourcePage:this.imagery.sourcePage}:{available:false,spacing:null};
  }

  // Intersect the measured height field instead of millions of display
  // triangles. Consequently inspection always uses the finest loaded DEM,
  // independent of the current mesh LOD or invisible seam skirts.
  pick(raycaster) {
    if (!this.ready) return null;
    const ray = raycaster.ray || raycaster;
    if (!ray?.origin || !ray?.direction) return null;
    const bound = this.bounds;
    const min = [bound.xMin / 1000 - 1, -55, -bound.yMax / 1000 - 1];
    const max = [bound.xMax / 1000 + 1, 55, -bound.yMin / 1000 + 1];
    const origins = [ray.origin.x, ray.origin.y, ray.origin.z];
    const directions = [ray.direction.x, ray.direction.y, ray.direction.z];
    let near = 0, far = Number.isFinite(raycaster.far) ? raycaster.far : 2500;
    for (let a = 0; a < 3; a++) {
      if (Math.abs(directions[a]) < 1e-12) {
        if (origins[a] < min[a] || origins[a] > max[a]) return null;
      } else {
        let ta = (min[a] - origins[a]) / directions[a], tb = (max[a] - origins[a]) / directions[a];
        if (ta > tb) [ta, tb] = [tb, ta];
        near = Math.max(near, ta); far = Math.min(far, tb);
        if (near > far) return null;
      }
    }
    const point = this._scratchVector;
    const residual = t => {
      ray.at(t, point);
      const coords = this.fromWorld(point), data = this._sample(coords.x, coords.y);
      return data ? {difference: (coords.elevation - data.elevation) * this.exaggeration, coords, data} : null;
    };
    let previousT = near, previous = residual(near), distance = near;
    for (let i = 0; i < 2400 && distance <= far; i++) {
      const result = residual(distance);
      if (result && previous && previous.difference >= 0 && result.difference <= 0) {
        let lo = previousT, hi = distance;
        for (let j = 0; j < 17; j++) {
          const middle = (lo + hi) / 2, sample = residual(middle);
          if (sample && sample.difference > 0) lo = middle; else hi = middle;
        }
        const final = residual((lo + hi) / 2);
        if (!final) return null;
        const info = this.getElevation(final.coords.x, final.coords.y);
        return {...info, lat: final.coords.lat, lon: final.coords.lon,
          point: this.toWorld(info.x, info.y, info.elevation), distance: (lo + hi) / 2};
      }
      previousT = distance; previous = result;
      const minimumStep=result?clamp(result.data.data.spacing*0.00025,0.00035,0.02):0.3;
      const step = result ? clamp(Math.abs(result.difference) * 0.00023, minimumStep, 1.5) : 0.3;
      distance += step;
    }
    return null;
  }

  dispose() {
    this._disposed = true; this._abort.abort();
    for (const item of this._cache.values()) item.mesh.geometry.dispose();
    this._cache.clear(); this.material.dispose(); this.scene.remove(this.group);
    this.datasets.forEach(data => {data.heightTexture?.dispose();delete data.values;delete data.blendWeights;});
    this.imageTiles.forEach(tile=>tile.texture?.dispose());
    this.shadowQuad?.geometry.dispose();this.shadowMaterial?.dispose();this.shadowTarget?.dispose();
    this._emptyDEM.dispose();this._emptyImage.dispose();
    this.meshes = []; this.ready = false;
  }
}
