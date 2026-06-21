
import * as THREE from 'three';
import { LightProbeGrid } from 'three/addons/lighting/LightProbeGrid.js';

const ddgiUniforms = {
    ddgiTexture: { value: null },
    ddgiMin: { value: new THREE.Vector3() },
    ddgiSize: { value: new THREE.Vector3(1, 1, 1) }, 
    ddgiResolution: { value: new THREE.Vector3() },
    ddgiIntensity: { value: 1.5 },
    ddgiActive: { value: 0.0 } 
};

function injectDDGIShader(material) {
    material.onBeforeCompile = (shader) => {
        shader.uniforms.ddgiTexture = ddgiUniforms.ddgiTexture;
        shader.uniforms.ddgiMin = ddgiUniforms.ddgiMin;
        shader.uniforms.ddgiSize = ddgiUniforms.ddgiSize;
        shader.uniforms.ddgiResolution = ddgiUniforms.ddgiResolution;
        shader.uniforms.ddgiIntensity = ddgiUniforms.ddgiIntensity;
        shader.uniforms.ddgiActive = ddgiUniforms.ddgiActive;

shader.vertexShader = `
            varying vec3 vDDGIWorldPosition;
        ` + shader.vertexShader;
        
        shader.vertexShader = shader.vertexShader.replace(
            '#include <worldpos_vertex>',
            `
            #include <worldpos_vertex>
            vDDGIWorldPosition = worldPosition.xyz;
            `
        );

shader.fragmentShader = `
            varying vec3 vDDGIWorldPosition;
            uniform highp sampler3D ddgiTexture;
            uniform vec3 ddgiMin;
            uniform vec3 ddgiSize;
            uniform vec3 ddgiResolution;
            uniform float ddgiIntensity;
            uniform float ddgiActive;

            vec3 getDDGIIrradiance(vec3 normal, vec3 worldPos) {
                if (ddgiActive < 0.5) return vec3(0.0);

                vec3 uvw = clamp((worldPos - ddgiMin) / ddgiSize, 0.0, 1.0);
                float nz = ddgiResolution.z;
                float paddedSlices = nz + 2.0;
                float atlasDepth = 7.0 * paddedSlices;
                
                float iz = uvw.z * (nz - 1.0);

vec4 t0 = texture(ddgiTexture, vec3(uvw.xy, (0.0 * paddedSlices + 1.0 + iz + 0.5) / atlasDepth));
                vec4 t1 = texture(ddgiTexture, vec3(uvw.xy, (1.0 * paddedSlices + 1.0 + iz + 0.5) / atlasDepth));
                vec4 t2 = texture(ddgiTexture, vec3(uvw.xy, (2.0 * paddedSlices + 1.0 + iz + 0.5) / atlasDepth));
                vec4 t3 = texture(ddgiTexture, vec3(uvw.xy, (3.0 * paddedSlices + 1.0 + iz + 0.5) / atlasDepth));
                vec4 t4 = texture(ddgiTexture, vec3(uvw.xy, (4.0 * paddedSlices + 1.0 + iz + 0.5) / atlasDepth));
                vec4 t5 = texture(ddgiTexture, vec3(uvw.xy, (5.0 * paddedSlices + 1.0 + iz + 0.5) / atlasDepth));
                vec4 t6 = texture(ddgiTexture, vec3(uvw.xy, (6.0 * paddedSlices + 1.0 + iz + 0.5) / atlasDepth));

vec3 c0 = t0.rgb;
                vec3 c1 = vec3(t0.a, t1.rg);
                vec3 c2 = vec3(t1.ba, t2.r);
                vec3 c3 = t2.gba;
                vec3 c4 = t3.rgb;
                vec3 c5 = vec3(t3.a, t4.rg);
                vec3 c6 = vec3(t4.ba, t5.r);
                vec3 c7 = t5.gba;
                vec3 c8 = t6.rgb;

float x = normal.x; float y = normal.y; float z = normal.z;

                vec3 irradiance = c0 * 0.282095;
                irradiance += c1 * (0.488603 * y);
                irradiance += c2 * (0.488603 * z);
                irradiance += c3 * (0.488603 * x);
                irradiance += c4 * (1.092548 * x * y);
                irradiance += c5 * (1.092548 * y * z);
                irradiance += c6 * (0.315392 * (3.0 * z * z - 1.0));
                irradiance += c7 * (1.092548 * x * z);
                irradiance += c8 * (0.546274 * (x * x - y * y));

                return max(irradiance * ddgiIntensity, vec3(0.0));
            }
        ` + shader.fragmentShader;

        shader.fragmentShader = shader.fragmentShader.replace(
            '#include <lights_fragment_maps>',
            `
            #include <lights_fragment_maps>
            #if defined( RE_IndirectDiffuse )
                irradiance += getDDGIIrradiance(geometryNormal, vDDGIWorldPosition);
            #endif
            `
        );
    };
}

class CustomMeshStandardMaterial extends THREE.MeshStandardMaterial {
    constructor(parameters) {
        super(parameters);
        injectDDGIShader(this);
    }
}

const GAME_DURATION   = 60;
const NORMAL_FOV      = 50;
const SCOPE_FOV       = 12;
const RELOAD_DURATION = 2000;
const MOUSE_SENS      = 0.002;
const PITCH_LIMIT     = Math.PI * 0.44;
const YAW_LIMIT       = Math.PI * 0.5;

const NORMAL_NEAR = 0.1, NORMAL_FAR = 500;
const SCOPE_NEAR  = 0.1,   SCOPE_FAR  = 500;

const TARGET_ROWS = [
    { z: -30,  count: 4, points: 100, moveRange: 6  },
    { z: -60,  count: 4, points: 200, moveRange: 10 },
    { z: -90,  count: 3, points: 300, moveRange: 14 },
];

const $ = id => document.getElementById(id);
const el = {
    landing:$('landing-screen'),  hud:$('hud'),
    timer:$('timer'),             score:$('score'),
    crosshair:$('crosshair'),     reload:$('reload-indicator'),
    hitMarker:$('hit-marker'),    scope:$('scope-overlay'),
    gameover:$('gameover-screen'), fScore:$('final-score'),
    fHits:$('final-hits'),        fShots:$('final-shots'),
    fAcc:$('final-accuracy'),     flash:$('muzzle-flash'),
    container:$('game-container'), playBtn:$('play-btn'),
    retryBtn:$('retry-btn'),      menuBtn:$('menu-btn'),
    pause:$('pause-screen'),      resumeBtn:$('resume-btn'),
    pauseRetry:$('pause-retry-btn'),pauseMenu:$('pause-menu-btn'),
};

const state = {
    phase:'menu', score:0, hits:0, shots:0,
    timeLeft:GAME_DURATION, weapon:'ready',
    scoped:false, yaw:0, pitch:-0.02, shake:0,
    timer:null, reloadT:0, paused:false,
};

let scene, camera, renderer, clock;
let targets = [], hitMeshes = [], raycaster, windFlags = [];
let weaponGroup, gunGroup, boltPivot;

const audio = {
    ctx: null,
    buffers: {},
    arrayBuffers: {},
    init(){ 
        this.ctx = new (window.AudioContext || window.webkitAudioContext)(); 
        for (let name in this.arrayBuffers) {
            this.ctx.decodeAudioData(this.arrayBuffers[name], buf => {
                this.buffers[name] = buf;
            }).catch(e => console.log(`Failed to decode ${name}`, e));
        }
        this.arrayBuffers = {};
    },
    resume(){ if(this.ctx?.state==='suspended') this.ctx.resume(); },
    preload() {
        const files = {
            'scope': 'audio/scope.mp3',
            'gunshot': 'audio/gunshot.mp3',
            'bolt': 'audio/bolt.mp3',
            'hit': 'audio/hit.mp3'
        };
        for (let name in files) {
            fetch(files[name]).then(res => {
                if(res.ok) return res.arrayBuffer();
            }).then(ab => { if(ab) this.arrayBuffers[name] = ab; }).catch(e => {});
        }
    },
    play(name, vol=1.0) {
        if (!this.ctx || !this.buffers[name]) return;
        const src = this.ctx.createBufferSource();
        src.buffer = this.buffers[name];
        const g = this.ctx.createGain();
        g.gain.value = vol;
        src.connect(g).connect(this.ctx.destination);
        src.start(0);
    },
    scopePlay() { this.play('scope', 0.5); },
    gunshot() { this.play('gunshot', 1.0); },
    bolt() { this.play('bolt', 0.8); },
    hitPing() { this.play('hit', 1.0); }
};

function hash(x,z){ const v=Math.sin(x*12.9898+z*78.233)*43758.5453; return v-Math.floor(v); }
function smoothNoise(x,z){
    const ix=Math.floor(x),iz=Math.floor(z),fx=x-ix,fz=z-iz;
    const sx=fx*fx*(3-2*fx),sz=fz*fz*(3-2*fz);
    return hash(ix,iz)*(1-sx)*(1-sz)+hash(ix+1,iz)*sx*(1-sz)+hash(ix,iz+1)*(1-sx)*sz+hash(ix+1,iz+1)*sx*sz;
}
function fbm(x,z,oct=4){ let v=0,a=1,f=1,m=0; for(let i=0;i<oct;i++){v+=smoothNoise(x*f,z*f)*a;m+=a;a*=0.5;f*=2;} return v/m; }
function terrainY(x,z){
    
    const hf=Math.max(0,Math.min(1,(-z-95)/30));
    
    let sf=0;
    if(Math.abs(x)>20) sf=Math.min(1, (Math.abs(x)-20)/10);
    
    const bermHeight = Math.max(hf, sf) * 8;
    const noise = fbm(x*0.03+100,z*0.03+100) * 4;
    
    return bermHeight + noise * Math.max(hf, sf) + fbm(x*0.1+50,z*0.1+50)*0.3;
}

function canvasTex(w,h,draw,rx=1,ry=1){
    const c=document.createElement('canvas'); c.width=w; c.height=h;
    draw(c.getContext('2d'),w,h);
    const t=new THREE.CanvasTexture(c);
    t.wrapS=t.wrapT=THREE.RepeatWrapping; t.repeat.set(rx,ry);
    return t;
}

function makeGroundTex(){
    return canvasTex(512,512,(ctx,w,h)=>{
        const img=ctx.createImageData(w,h); const d=img.data;
        for(let i=0;i<w*h;i++){
            const x=i%w,y=(i/w)|0;
            const n1=Math.sin(x*0.08)*0.15+Math.sin(y*0.06+x*0.02)*0.1;
            const base=150+n1*30+Math.random()*40;
            
            d[i*4]=base*0.95; d[i*4+1]=base*0.9; d[i*4+2]=base*0.8; d[i*4+3]=255;
        }
        ctx.putImageData(img,0,0);
        
        for(let i=0;i<2000;i++){
            const x=Math.random()*w,y=Math.random()*h,g=120+Math.random()*40;
            ctx.strokeStyle=`rgba(${g},${g-10},${g-20},0.3)`;
            ctx.lineWidth=1.5; ctx.beginPath(); ctx.moveTo(x,y);
            ctx.lineTo(x+(Math.random()-0.5)*15,y+(Math.random()-0.5)*2); ctx.stroke();
        }
        
        for(let i=0;i<150;i++){
            const g=80+Math.random()*60;
            ctx.fillStyle=`rgba(${g},${g},${g},0.5)`;
            ctx.beginPath(); ctx.arc(Math.random()*w,Math.random()*h,0.5+Math.random()*1.5,0,Math.PI*2); ctx.fill();
        }
    },14,18);
}
function makeWoodTex(){
    return canvasTex(256,256,(ctx,w,h)=>{
        const img=ctx.createImageData(w,h); const d=img.data;
        for(let y=0;y<h;y++){
            const ring=Math.sin(y*0.12)*0.3+Math.sin(y*0.35+1.5)*0.2+Math.sin(y*0.7)*0.08;
            for(let x=0;x<w;x++){
                const grain=Math.sin((y+x*0.3)*0.5)*0.05;
                const base=110+(ring+grain)*70+Math.random()*10;
                const i=(y*w+x)*4;
                d[i]=Math.min(255,base+25); d[i+1]=Math.min(255,base-12); d[i+2]=Math.min(255,base*0.35); d[i+3]=255;
            }
        }
        ctx.putImageData(img,0,0);
        for(let i=0;i<6;i++){
            const cx=20+Math.random()*(w-40),cy=20+Math.random()*(h-40),r=3+Math.random()*5;
            ctx.beginPath(); ctx.arc(cx,cy,r,0,Math.PI*2);
            ctx.fillStyle='rgba(65,35,12,0.5)'; ctx.fill();
            ctx.beginPath(); ctx.arc(cx,cy,r*0.5,0,Math.PI*2);
            ctx.fillStyle='rgba(45,22,8,0.4)'; ctx.fill();
        }
    });
}


function makeSignTex(text){
    return canvasTex(256,128,(ctx,w,h)=>{
        ctx.fillStyle='#e8e8e0'; ctx.fillRect(0,0,w,h);
        ctx.strokeStyle='#444'; ctx.lineWidth=4; ctx.strokeRect(4,4,w-8,h-8);
        ctx.strokeStyle='#888'; ctx.lineWidth=1; ctx.strokeRect(10,10,w-20,h-20);
        ctx.fillStyle='#222';
        ctx.font='bold 56px Arial,sans-serif';
        ctx.textAlign='center'; ctx.textBaseline='middle';
        ctx.fillText(text,w/2,h/2);
    });
}

let tex = {};
function createTextures(){
    const loader = new THREE.TextureLoader();
    tex.ground=makeGroundTex(); tex.wood=makeWoodTex();

tex.metal = loader.load('https://threejs.org/examples/textures/carbon/Carbon.png');
    tex.metal.wrapS = tex.metal.wrapT = THREE.RepeatWrapping; 
    tex.metal.repeat.set(4, 4);

tex.sandbag = loader.load('https://threejs.org/examples/textures/crate.gif');

tex.rock = loader.load('https://threejs.org/examples/textures/planets/moon_1024.jpg');
    tex.rock.wrapS = tex.rock.wrapT = THREE.RepeatWrapping; 
    tex.rock.repeat.set(2, 2);
    tex.sign100=makeSignTex('100 m');
    tex.sign200=makeSignTex('200 m');
    tex.sign300=makeSignTex('300 m');
}

function initScene(){
    scene=new THREE.Scene();
    scene.background=new THREE.Color(0xffb870); 
    scene.fog=new THREE.FogExp2(0xffb870,0.0045); 

    camera=new THREE.PerspectiveCamera(NORMAL_FOV,innerWidth/innerHeight,NORMAL_NEAR,NORMAL_FAR);
    camera.position.set(0,2,0);
    scene.add(camera);

    renderer=new THREE.WebGLRenderer({antialias:true,powerPreference:'high-performance'});
    renderer.setSize(innerWidth,innerHeight);
    renderer.setPixelRatio(1); 
    renderer.shadowMap.enabled=true;
    renderer.shadowMap.type=THREE.PCFSoftShadowMap;
    renderer.toneMapping=THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure=0.85; 
    el.container.appendChild(renderer.domElement);

    clock=new THREE.Clock();
    raycaster=new THREE.Raycaster();

    createTextures();
    buildSky();
    buildTerrain();
    buildLighting();
    buildCubeMapDDGI();
    buildReflections();
    buildEnvironment();
    buildTargets();
    buildWeaponModel();

setTimeout(() => {
        try {
            
            ddgiProbes.bake(renderer, scene, { cubemapSize: 16, near: 0.5, far: 200 });

ddgiUniforms.ddgiTexture.value = ddgiProbes.texture;
            ddgiUniforms.ddgiMin.value.copy(ddgiProbes.boundingBox.min);
            ddgiProbes.boundingBox.getSize(ddgiUniforms.ddgiSize.value);
            ddgiUniforms.ddgiResolution.value.copy(ddgiProbes.resolution);
            ddgiUniforms.ddgiActive.value = 1.0;

envCamera.update(renderer, scene);

const pmremGen = new THREE.PMREMGenerator(renderer);
            const envMap = pmremGen.fromCubemap(envRenderTarget.texture).texture;
            scene.environment = envMap;
            scene.environmentIntensity = 0.25; 
            pmremGen.dispose();
            
            console.log("DDGI & Reflections Baked!");
        } catch(e) {
            console.error("Failed to bake lighting:", e);
        }
    }, 500);
}

function buildSky(){
    
    const sunDirVec=new THREE.Vector3(70,65,35).normalize();
    const geo=new THREE.SphereGeometry(400,32,24);
    const mat=new THREE.ShaderMaterial({
        uniforms:{
            topCol:{value:new THREE.Color(0x3b5998)}, 
            botCol:{value:new THREE.Color(0xffb870)}, 
            sunDir:{value:sunDirVec},
            sunCol:{value:new THREE.Color(0xffddaa)}, 
        },
        vertexShader:`varying vec3 vDir;void main(){vDir=(modelMatrix*vec4(position,1.0)).xyz;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}`,
        fragmentShader:`
            uniform vec3 topCol,botCol,sunDir,sunCol;varying vec3 vDir;
            void main(){
                vec3 d=normalize(vDir);float h=max(d.y,0.0);
                vec3 sky=mix(botCol,topCol,pow(h,0.5));
                float diff=max(dot(d,sunDir),0.0);vec3 diffuse=sunCol*diff*0.10;
                float spec=pow(max(dot(d,sunDir),0.0),1200.0);vec3 specular=sunCol*spec*3.0;
                float glow=pow(max(dot(d,sunDir),0.0),6.0);vec3 halo=sunCol*glow*0.22;
                gl_FragColor=vec4(sky+diffuse+specular+halo,1.0);
            }`,
        side:THREE.BackSide, depthWrite:false,
    });
    scene.add(new THREE.Mesh(geo,mat));
}

function buildTerrain(){
    
    const g=new THREE.PlaneGeometry(60, 140, 30, 70);
    g.rotateX(-Math.PI/2);
    g.translate(0,0,-60); 
    const p=g.attributes.position;
    for(let i=0;i<p.count;i++){
        p.setY(i,terrainY(p.getX(i),p.getZ(i)));
    }
    const cols=new Float32Array(p.count*3);
    const sand=new THREE.Color(0xc2b280); 
    const hillGrass=new THREE.Color(0x6a7b5b); 
    const rock=new THREE.Color(0x707070);
    for(let i=0;i<p.count;i++){
        const x=p.getX(i),z=p.getZ(i),y=p.getY(i);
        const n=fbm(x*0.07+10,z*0.07+10);
        
        let c = new THREE.Color();

const apparentHeight = y + (n - 0.5) * 4.0; 
        
        let hillFactor = Math.max(0, Math.min(1, (apparentHeight - 1.0) / 4.0));

let rockFactor = Math.max(0, Math.min(1, (apparentHeight - 8.0) / 4.0));

        c.copy(sand).lerp(hillGrass, hillFactor);
        if(rockFactor > 0) {
            c.lerp(rock, rockFactor);
        }
        
        cols[i*3]=c.r; cols[i*3+1]=c.g; cols[i*3+2]=c.b;
    }
    g.setAttribute('color',new THREE.BufferAttribute(cols,3));
    g.computeVertexNormals();
    const mesh=new THREE.Mesh(g,new CustomMeshStandardMaterial({
        map:tex.ground,vertexColors:true,roughness:0.92,metalness:0.02,
    }));
    mesh.receiveShadow=true; scene.add(mesh);
}

function buildLighting(){
    
    const sun=new THREE.DirectionalLight(0xffddaa, 1.5); 

sun.position.set(70, 65, 35); sun.castShadow=true;

sun.target.position.set(0, 0, -45);
    scene.add(sun.target);

    sun.shadow.mapSize.set(1024,1024); 
    sun.shadow.camera.near=0.5; sun.shadow.camera.far=250;
    const d=70; 
    sun.shadow.camera.left=-d; sun.shadow.camera.right=d;
    sun.shadow.camera.top=d; sun.shadow.camera.bottom=-d;
    sun.shadow.bias=-0.0001;
    sun.shadow.normalBias=0.05; 
    scene.add(sun);

}

let ddgiProbes;
function buildCubeMapDDGI() {

ddgiProbes = new LightProbeGrid(12.0, 3.6, 110, 10, 3, 10);
    
    ddgiProbes.position.set(0, 2.3, -45);

ddgiProbes.intensity = 1.5;
    
    scene.add(ddgiProbes);
}

let envRenderTarget, envCamera;
function buildReflections() {
    
    envRenderTarget = new THREE.WebGLCubeRenderTarget(256, {
        format: THREE.RGBAFormat,
        generateMipmaps: true,
        minFilter: THREE.LinearMipmapLinearFilter,
    });
    envCamera = new THREE.CubeCamera(0.5, 500, envRenderTarget);
    envCamera.position.set(0, 3, -10); 
    scene.add(envCamera);
}

function mkMesh(geo,mat,x,y,z){
    const m=new THREE.Mesh(geo,mat); m.position.set(x,y,z); return m;
}

function buildEnvironment(){
    const mSand=new CustomMeshStandardMaterial({map:tex.sandbag,roughness:0.95});
    const mWood=new CustomMeshStandardMaterial({map:tex.wood,roughness:0.85});
    const mGreen=new CustomMeshStandardMaterial({color:0x2d5a27,roughness:0.8});
    const mHay=new CustomMeshStandardMaterial({color:0xDAA520,roughness:0.95});
    const mRock=new CustomMeshStandardMaterial({map:tex.rock,roughness:0.9});
    const mConcrete=new CustomMeshStandardMaterial({map:tex.rock,color:0xaaaaaa,roughness:0.85});
    const mBarrel=new CustomMeshStandardMaterial({color:0x8b3a3a,roughness:0.7,metalness:0.3}); 
    const mMetal=new CustomMeshStandardMaterial({map:tex.metal,roughness:0.4,metalness:0.8});

    const add=(geo,mat,x,y,z,ry=0)=>{
        const m=new THREE.Mesh(geo,mat); m.position.set(x,y,z);
        if(ry) m.rotation.y=ry; m.castShadow=m.receiveShadow=true; scene.add(m); return m;
    };

const benchMat=new CustomMeshStandardMaterial({map:tex.wood,color:0x8B6914,roughness:0.75});
    add(new THREE.BoxGeometry(2.5,0.06,0.8),benchMat,0,0.85,0.6);
    const legG=new THREE.BoxGeometry(0.08,0.85,0.08);
    [[-1.1,0.42,0.25],[1.1,0.42,0.25],[-1.1,0.42,0.95],[1.1,0.42,0.95]].forEach(([x,y,z])=>add(legG,benchMat,x,y,z));

const divG=new THREE.BoxGeometry(0.15,0.5,12);
    [-8,8].forEach(x=>add(divG,mConcrete,x,0.25,-4));

const signGeo=new THREE.PlaneGeometry(1.0,0.5);
    [[-25,tex.sign100],[-55,tex.sign200],[-85,tex.sign300]].forEach(([z,signTex])=>{
        const signMat=new CustomMeshStandardMaterial({map:signTex,roughness:0.6});
        
        const sL=new THREE.Mesh(signGeo,signMat);
        sL.position.set(-7,1.1,z); sL.castShadow=true; sL.receiveShadow=true; scene.add(sL);
        
        const sR=new THREE.Mesh(signGeo,signMat);
        sR.position.set(7,1.1,z); sR.castShadow=true; sR.receiveShadow=true; scene.add(sR);
        
        const postG=new THREE.CylinderGeometry(0.03,0.03,1.2,6);
        add(postG,mMetal,-7,0.6,z-0.03); add(postG,mMetal,7,0.6,z-0.03);
    });

const frameMat=new CustomMeshStandardMaterial({color:0x555555,roughness:0.5,metalness:0.7});
    const frameG=new THREE.CylinderGeometry(0.04,0.04,3,6);
    [[-3,1.5,3.5],[3,1.5,3.5],[-3,1.5,5],[3,1.5,5]].forEach(([x,y,z])=>add(frameG,frameMat,x,y,z));
    add(new THREE.BoxGeometry(6.5,0.05,2),frameMat,0,3,4.25);
    const roofMat=new CustomMeshStandardMaterial({color:0x5a6b4b,roughness:0.9,side:THREE.DoubleSide});
    add(new THREE.BoxGeometry(6.3,0.02,1.8),roofMat,0,2.98,4.25);

const ammoMat=new CustomMeshStandardMaterial({color:0x4a5a2a,roughness:0.8});
    add(new THREE.BoxGeometry(0.35,0.2,0.18),ammoMat,1.6,0.1,1.2);
    add(new THREE.BoxGeometry(0.3,0.18,0.16),ammoMat,1.3,0.09,1.4,0.2);

const wallMat=new CustomMeshStandardMaterial({map:tex.metal,roughness:0.2,metalness:0.85,color:0x777777});
    add(new THREE.BoxGeometry(14,3,0.08),wallMat,0,1.5,5.5);

const sideWallG=new THREE.BoxGeometry(0.3,2,20);
    add(sideWallG,mConcrete,-9,1,-5);
    add(sideWallG,mConcrete,9,1,-5);

const stripeMat=new CustomMeshStandardMaterial({color:0xddaa00,roughness:0.7});
    const stripePostG=new THREE.CylinderGeometry(0.04,0.04,1,6);
    [-6,-4,-2,0,2,4,6].forEach(x=>{
        add(stripePostG,stripeMat,x,0.5,-8);
    });
    add(new THREE.BoxGeometry(12.5,0.08,0.04),stripeMat,0,0.85,-8);
    add(new THREE.BoxGeometry(12.5,0.08,0.04),stripeMat,0,0.55,-8);

const sbG=new THREE.BoxGeometry(0.8,0.35,0.4);
    for(let i=0;i<5;i++){add(sbG,mSand,-3.2+i*0.78,0.18,1.2);add(sbG,mSand,-2.8+i*0.78,0.53,1.2);}
    for(let i=0;i<4;i++){add(sbG,mSand,3.2+i*0.78,0.18,0.8,0.15);add(sbG,mSand,3.6+i*0.78,0.53,0.8,0.15);}

const ammoBoxG = new THREE.BoxGeometry(0.35,0.2,0.18);
    const mAmmo = new CustomMeshStandardMaterial({color:0x3a4a2a,roughness:0.8});
    add(ammoBoxG, mAmmo, -0.2, 1.05, 0.6); 
    add(ammoBoxG, mAmmo, 0.2, 1.05, 0.6, 0.2);

const poleG = new THREE.CylinderGeometry(0.04, 0.04, 3, 6);
    const flagG = new THREE.BufferGeometry();
    const fVerts = new Float32Array([0,0,0,  0,0.4,0,  0.8,0.2,0]);
    flagG.setAttribute('position', new THREE.BufferAttribute(fVerts, 3));
    flagG.computeVertexNormals();
    const flagMat = new CustomMeshStandardMaterial({color: 0xff3333, side: THREE.DoubleSide, roughness: 0.8});

    add(poleG, mMetal, 15, 1.5, -75);
    const f1 = new THREE.Mesh(flagG, flagMat); 
    f1.position.set(15, 2.5, -75); 
    scene.add(f1); 
    windFlags.push(f1);

add(new THREE.BoxGeometry(0.8,0.5,0.5),mWood,-2,0.25,2.6);
    add(new THREE.BoxGeometry(0.6,0.45,0.4),mWood,-1.2,0.23,2.9,0.3);
    add(new THREE.BoxGeometry(0.7,0.5,0.5),mWood,5.5,0.25,1.8);

const concG = new THREE.BoxGeometry(2.5, 1.2, 0.6);
    [[-6,-32,0.2],[7,-33,-0.1],[-8,-52,-0.3],[6,-53,0.15], [0, -45, 0]].forEach(([x,z,r])=>{
        add(concG, mConcrete, x, 0.6, z, r);
    });

const barrier=(bx,bz)=>{
        const pg=new THREE.CylinderGeometry(0.05,0.05,1.5,6);
        add(pg,mWood,bx-1,0.75,bz); add(pg,mWood,bx+1,0.75,bz);
        const pk=new THREE.BoxGeometry(2.2,0.1,0.04);
        for(let j=0;j<3;j++) add(pk,mWood,bx,0.4+j*0.4,bz);
    };
    barrier(-8,-15); barrier(10,-22); barrier(-12,-28);

const bG=new THREE.CylinderGeometry(0.35,0.35,1,12);
    [[-6,-12],[-5.5,-13.5],[8,-19],[12,-32],[-10,-42]].forEach(([x,z])=>{
        const b=add(bG,mBarrel,x,0.5,z);
        
        const rimG=new THREE.TorusGeometry(0.35,0.015,6,12);
        const rim1=new THREE.Mesh(rimG,mBarrel); rim1.position.set(x,0.05,z); rim1.rotation.x=Math.PI/2; scene.add(rim1);
        const rim2=new THREE.Mesh(rimG,mBarrel); rim2.position.set(x,0.95,z); rim2.rotation.x=Math.PI/2; scene.add(rim2);
    });

const hG=(()=>{const g=new THREE.CylinderGeometry(0.5,0.5,1.2,10);g.rotateZ(Math.PI/2);return g;})();
    add(hG,mHay,6,0.5,-26,0.3); add(hG,mHay,7,0.5,-27.5,0.1); add(hG,mHay,-7,0.5,-38,-0.2);

[[-20,-97],[-10,-88],[20,-88],[25,-85],
     [-22,-108],[5,-102],[15,-107],[-12,-118],
     [0,-110],[-8,-122]].forEach(([x,z])=>{
        const g=new THREE.Group(), y=terrainY(x,z) - 0.6;
        const trunk=new THREE.Mesh(new THREE.CylinderGeometry(0.12,0.22,2.5,6),mWood);
        trunk.position.y=1.25; trunk.castShadow=true; g.add(trunk);
        [{r:1.8,h:2.2,y:3.2},{r:1.3,h:1.8,y:4.6},{r:0.8,h:1.4,y:5.7}].forEach(l=>{
            const c=new THREE.Mesh(new THREE.ConeGeometry(l.r,l.h,7),mGreen);
            c.position.y=l.y; c.castShadow=true; g.add(c);
        });
        g.position.set(x,y,z); const s=0.8+Math.random()*0.5; g.scale.set(s,s,s); scene.add(g);
    });

const rockPositions = [[-15,-62,1.5],[18,-72,1],[-8,-94,1.8],[15,-92,1.3],[22,-58,0.8]];
    
    const baseRockG = new THREE.DodecahedronGeometry(1, 1);
    const rockInst = new THREE.InstancedMesh(baseRockG, mRock, rockPositions.length);
    rockInst.castShadow = true; rockInst.receiveShadow = true;
    const dummyObj = new THREE.Object3D();
    rockPositions.forEach(([x,z,s], i)=>{
        dummyObj.position.set(x, terrainY(x,z)+s*0.25, z);
        
        dummyObj.scale.set(s*(0.8+Math.random()*0.4), s*(0.6+Math.random()*0.3), s*(0.8+Math.random()*0.4));
        dummyObj.rotation.set(Math.random()*Math.PI, Math.random()*Math.PI, 0);
        dummyObj.updateMatrix();
        rockInst.setMatrixAt(i, dummyObj.matrix);
    });
    scene.add(rockInst);

const casingMat=new CustomMeshStandardMaterial({color:0xc4a020,metalness:0.85,roughness:0.25});
    const casingG=new THREE.CylinderGeometry(0.008,0.008,0.06,6);
    for(let i=0;i<12;i++){
        const m=new THREE.Mesh(casingG,casingMat);
        m.position.set(-1+Math.random()*2,0.03,0.2+Math.random()*1.2);
        m.rotation.set(Math.random()*Math.PI,0,Math.PI/2+Math.random()*0.5); scene.add(m);
    }
}

const sharedTgtGeo = {
    base1: new THREE.CylinderGeometry(0.4,0.5,0.08,8),
    base2: new THREE.CylinderGeometry(0.04,0.04,0.5,6),
    foldPole: new THREE.CylinderGeometry(0.04,0.04,1.5,6),
    torso: new THREE.BoxGeometry(0.55,0.9,0.18),
    head: new THREE.SphereGeometry(0.16,10,10),
    arm: new THREE.BoxGeometry(0.1,0.5,0.12),
    leg: new THREE.BoxGeometry(0.16,0.55,0.16),
    c1: new THREE.CircleGeometry(0.2,16),
    c2: new THREE.CircleGeometry(0.12,16),
    c3: new THREE.CircleGeometry(0.05,16)
};
const sharedTgtMat = {
    mBody: new CustomMeshStandardMaterial({color:0xD0D4D8, metalness:0.75, roughness:0.45}),
    mDark: new CustomMeshStandardMaterial({color:0x7A7D80, metalness:0.8, roughness:0.5}),
    mRed: new CustomMeshStandardMaterial({color:0xFF4444, metalness:0.5, roughness:0.5, side:THREE.DoubleSide}),
    mWhite: new CustomMeshStandardMaterial({color:0xFFFFFF, metalness:0.5, roughness:0.5, side:THREE.DoubleSide}),
    mSteel: new CustomMeshStandardMaterial({color:0x888888, metalness:0.85, roughness:0.4})
};

function createDummy(points){
    const root=new THREE.Group();
    root.userData={points,isTarget:true};
    const {mBody, mDark, mRed, mWhite, mSteel} = sharedTgtMat;
    const g = sharedTgtGeo;

const baseG=new THREE.Group();
    baseG.add(mkMesh(g.base1,mSteel,0,0.04,0));
    baseG.add(mkMesh(g.base2,mSteel,0,0.29,0));
    root.add(baseG);

const foldG=new THREE.Group();
    foldG.position.y=0.5; foldG.name='foldGroup';
    foldG.add(mkMesh(g.foldPole,mSteel,0,0.75,0));
    const torso=new THREE.Mesh(g.torso,mBody);
    torso.position.y=1.05; torso.castShadow=true; foldG.add(torso);
    const head=new THREE.Mesh(g.head,mBody);
    head.position.y=1.65; head.castShadow=true; foldG.add(head);
    foldG.add(mkMesh(g.arm,mBody,-0.33,0.88,0));
    foldG.add(mkMesh(g.arm,mBody,0.33,0.88,0));
    foldG.add(mkMesh(g.leg,mDark,-0.13,0.0,0));
    foldG.add(mkMesh(g.leg,mDark,0.13,0.0,0));

const t1=new THREE.Mesh(g.c1,mWhite); t1.position.set(0,1.05,0.10); foldG.add(t1);
    const t2=new THREE.Mesh(g.c2,mRed);   t2.position.set(0,1.05,0.105); foldG.add(t2); 
    const t3=new THREE.Mesh(g.c3,mWhite); t3.position.set(0,1.05,0.110); foldG.add(t3);
    
    root.add(foldG);

    foldG.traverse(ch=>{if(ch.isMesh){ch.userData.parentTarget=root;hitMeshes.push(ch);}});
    root.matrixAutoUpdate=false;
    return root;
}

function buildTargets(){
    TARGET_ROWS.forEach(row=>{
        const sp=7,sx=-(row.count-1)*sp/2;
        for(let i=0;i<row.count;i++){
            const mesh=createDummy(row.points);
            const bx=sx+i*sp, bz=row.z+(Math.random()-0.5)*4;
            targets.push({
                mesh, baseX:bx, baseZ:bz,
                
                movePos: Math.random()*2-1,         
                moveDir: Math.random()<0.5?1:-1,
                moveBaseSpd: (0.4+Math.random()*0.4) * 0.8,   
                moveRange: row.moveRange*(0.5+Math.random()*0.5),
                points: row.points,
                foldAngle:0, foldState:'up',
                stateTimer:2+Math.random()*5,
                showDur:2.5+Math.random()*4,
                hideDur:0.8+Math.random()*1.5, 
                foldSpd:2+Math.random()*2,
                visible:true,
            });
            scene.add(mesh);
        }
    });
}

const _tempMat = new THREE.Matrix4();

function updateTargets(dt,time){
    const easeZone=0.2;
    targets.forEach(t=>{
        
        t.stateTimer-=dt;
        if(t.foldState==='up'&&t.stateTimer<=0) t.foldState='folding';
        if(t.foldState==='down'&&t.stateTimer<=0) t.foldState='unfolding';
        if(t.foldState==='folding'){
            t.foldAngle-=t.foldSpd*dt;
            if(t.foldAngle<=-Math.PI/2){
                t.foldAngle=-Math.PI/2; t.foldState='down';
                t.stateTimer=t.hideDur+Math.random()*1.5; t.visible=false;
            }
        } else if(t.foldState==='unfolding'){
            t.foldAngle+=t.foldSpd*dt;
            if(t.foldAngle>=0){
                t.foldAngle=0; t.foldState='up';
                t.stateTimer=t.showDur+Math.random()*2; t.visible=true;
            }
        }

const absPos=Math.abs(t.movePos);
        let spdMul=1;
        if(absPos>1-easeZone) spdMul=Math.max(0.05,(1-absPos)/easeZone);
        t.movePos+=t.moveDir*t.moveBaseSpd*spdMul*dt;
        if(t.movePos>=1){t.movePos=1;t.moveDir=-1;}
        else if(t.movePos<=-1){t.movePos=-1;t.moveDir=1;}

        const tx=t.baseX+t.movePos*t.moveRange;
        const tz=t.baseZ;
        const ty=terrainY(tx,tz);

        _tempMat.set(1,0,0,tx, 0,1,0,ty, 0,0,1,tz, 0,0,0,1);
        t.mesh.matrix.copy(_tempMat);
        t.mesh.matrixWorldNeedsUpdate=true;

const foldG=t.mesh.getObjectByName('foldGroup');
        if(foldG){
            const c = Math.cos(t.foldAngle);
            const s = Math.sin(t.foldAngle);

foldG.matrix.set(
                1, 0,  0,   0,
                0, c, -s, 0.5,
                0, s,  c,   0,
                0, 0,  0,   1
            );
            foldG.matrixAutoUpdate = false;
            foldG.matrixWorldNeedsUpdate = true;
        }
    });
}

const GUN_POS       = new THREE.Vector3(0.18, -0.15, -0.45);
const GUN_ROT       = new THREE.Euler(-0.03, -0.06, 0.03);
const BOLT_LOCKED_TGT   = new THREE.Vector3(0.25, -0.11, -0.45);
const BOLT_UNLOCKED_TGT = new THREE.Vector3(0.23, -0.08, -0.45);
const BOLT_PULLED_TGT   = new THREE.Vector3(0.23, -0.08, -0.35);
const FORESTOCK_TARGET  = new THREE.Vector3(0.23, -0.17, -0.60);
const Q_FORESTOCK     = new THREE.Quaternion().setFromEuler(new THREE.Euler(-0.5, -0.6, -0.2));
const Q_BOLT_LOCKED   = new THREE.Quaternion().setFromEuler(new THREE.Euler(-1.0, 0.3, -1.2));
const Q_BOLT_UNLOCKED = new THREE.Quaternion().setFromEuler(new THREE.Euler(-0.7, 0.1, -1.2 + Math.PI/3));

function buildWeaponModel(){
    weaponGroup=new THREE.Group();
    weaponGroup.visible=false;
    camera.add(weaponGroup);

    gunGroup=new THREE.Group();
    gunGroup.position.copy(GUN_POS);
    gunGroup.rotation.copy(GUN_ROT);
    weaponGroup.add(gunGroup);

    const gM=new CustomMeshStandardMaterial({color:0x2a2a2a,roughness:0.3,metalness:0.9});
    const gW=new CustomMeshStandardMaterial({map:tex.wood,color:0x7a5030,roughness:0.7});
    const gD=new CustomMeshStandardMaterial({color:0x1a1a1a,roughness:0.2,metalness:0.95});

    gunGroup.add(mkMesh(new THREE.BoxGeometry(0.04,0.08,0.25),gW,0,-0.01,0.15));
    const sg=new THREE.Mesh(new THREE.BoxGeometry(0.035,0.12,0.06),gW);
    sg.position.set(0,-0.06,0.06); sg.rotation.x=0.3; gunGroup.add(sg);
    gunGroup.add(mkMesh(new THREE.BoxGeometry(0.045,0.055,0.22),gM,0,0.01,-0.02));
    const brl=new THREE.Mesh(new THREE.CylinderGeometry(0.012,0.014,0.35,8),gD);
    brl.rotation.x=Math.PI/2; brl.position.set(0,0.015,-0.28); gunGroup.add(brl);
    const shr=new THREE.Mesh(new THREE.CylinderGeometry(0.018,0.018,0.15,8),gM);
    shr.rotation.x=Math.PI/2; shr.position.set(0,0.015,-0.15); gunGroup.add(shr);
    const scpBody=new THREE.Mesh(new THREE.CylinderGeometry(0.018,0.018,0.18,10),gM);
    scpBody.rotation.x=Math.PI/2; scpBody.position.set(0,0.06,-0.04); gunGroup.add(scpBody);
    const scpLens=new THREE.Mesh(new THREE.CircleGeometry(0.017,10),
        new CustomMeshStandardMaterial({color:0x4488cc,roughness:0.1,metalness:0.3}));
    scpLens.position.set(0,0.06,-0.13); gunGroup.add(scpLens);
    [-0.06,0.02].forEach(z=>{
        const ring=new THREE.Mesh(new THREE.TorusGeometry(0.02,0.005,6,8),gM);
        ring.position.set(0,0.06,z); ring.rotation.y=Math.PI/2; gunGroup.add(ring);
    });
    gunGroup.add(mkMesh(new THREE.BoxGeometry(0.035,0.07,0.06),gM,0,-0.05,0.01));
    gunGroup.add(mkMesh(new THREE.BoxGeometry(0.025,0.035,0.04),gM,0,-0.04,0.04));

    boltPivot=new THREE.Group();
    boltPivot.position.set(0.025,0.025,-0.01);
    gunGroup.add(boltPivot);
    const bH=new THREE.Mesh(new THREE.CylinderGeometry(0.006,0.006,0.035,6),gM);
    bH.rotation.z=Math.PI/2; bH.position.set(0.015,0,0); boltPivot.add(bH);
    boltPivot.add(mkMesh(new THREE.SphereGeometry(0.009,6,6),gD,0.032,0,0));

const skinMat=new CustomMeshStandardMaterial({color:0xd4a574,roughness:0.7});
    const gloveMat=new CustomMeshStandardMaterial({color:0x3a3a2a,roughness:0.8});

    function createHand(isLeft) {
        const handGroup = new THREE.Group();
        handGroup.isLeft = isLeft;
        handGroup.fingers = [];
        
        const palm=new THREE.Mesh(new THREE.BoxGeometry(0.05,0.035,0.06),gloveMat);
        palm.position.set(0,-0.018,0); handGroup.add(palm);
        const fingerGeo=new THREE.BoxGeometry(0.011,0.038,0.013);
        for(let fi=0;fi<4;fi++){
            const finger=new THREE.Mesh(fingerGeo,skinMat);
            finger.position.set(-0.017+fi*0.012,-0.055,0.005);
            finger.rotation.x=0.4; handGroup.add(finger);
            const tip=new THREE.Mesh(new THREE.BoxGeometry(0.010,0.02,0.012),skinMat);
            tip.position.set(0,-0.028,0.005); tip.rotation.x=0.3; finger.add(tip);
            finger.tip = tip;
            handGroup.fingers.push(finger);
        }
        const thumb=new THREE.Mesh(new THREE.BoxGeometry(0.013,0.032,0.014),skinMat);
        
        thumb.position.set(isLeft?-0.032:0.032,-0.035,0.018); 
        thumb.rotation.z=isLeft?0.6:-0.6; thumb.rotation.x=-0.2;
        handGroup.add(thumb);
        const thumbTip=new THREE.Mesh(new THREE.BoxGeometry(0.012,0.018,0.013),skinMat);
        thumbTip.position.set(0,-0.024,0); thumbTip.rotation.z=isLeft?0.3:-0.3; thumb.add(thumbTip);
        thumb.tip = thumbTip;
        handGroup.thumb = thumb;

        weaponGroup.add(handGroup);
        return handGroup;
    }

    rightHand = createHand(false);
}

function setHandGrip(hand, grip) {
    
    const fBase = grip * 1.0; 
    const fTip = grip * 0.75; 
    const tBaseX = -0.4 + grip * 0.5; 
    const tBaseZ = (hand.isLeft ? 0.8 : -0.8) + grip * (hand.isLeft ? -0.5 : 0.5);
    
    for (let f of hand.fingers) {
        f.rotation.x = fBase;
        if (f.tip) f.tip.rotation.x = fTip;
    }
    if (hand.thumb) {
        hand.thumb.rotation.x = tBaseX;
        hand.thumb.rotation.z = tBaseZ;
        if (hand.thumb.tip) {
            hand.thumb.tip.rotation.z = (hand.isLeft ? 0.1 : -0.1) + grip * (hand.isLeft ? 0.5 : -0.5);
            hand.thumb.tip.rotation.x = grip * 0.5;
        }
    }
}

function reloadKeyframe(t, outPos, outRot){
    let grip = 0.4; 
    if(t<0.15){
        
        const p = t/0.15;
        outPos.lerpVectors(FORESTOCK_TARGET, BOLT_LOCKED_TGT, p);
        outRot.slerpQuaternions(Q_FORESTOCK, Q_BOLT_LOCKED, p);
        grip = 0.4 - (p * 0.4); 
        return {boltRot:0, boltZ:0, grip: grip};
    }else if(t<0.30){
        
        const p=(t-0.15)/0.15;
        outPos.lerpVectors(BOLT_LOCKED_TGT, BOLT_UNLOCKED_TGT, p);
        outRot.slerpQuaternions(Q_BOLT_LOCKED, Q_BOLT_UNLOCKED, p);
        grip = p * 1.0; 
        return {boltRot:p * (Math.PI/3), boltZ:0, grip: grip};
    }else if(t<0.50){
        
        const p=(t-0.30)/0.20;
        outPos.lerpVectors(BOLT_UNLOCKED_TGT, BOLT_PULLED_TGT, p);
        outRot.copy(Q_BOLT_UNLOCKED);
        return {boltRot:Math.PI/3, boltZ:p*0.1, grip: 1.0};
    }else if(t<0.70){
        
        const p=(t-0.50)/0.20;
        outPos.lerpVectors(BOLT_PULLED_TGT, BOLT_UNLOCKED_TGT, p);
        outRot.copy(Q_BOLT_UNLOCKED);
        return {boltRot:Math.PI/3, boltZ:0.1 - p*0.1, grip: 1.0};
    }else if(t<0.85){
        
        const p=(t-0.70)/0.15;
        outPos.lerpVectors(BOLT_UNLOCKED_TGT, BOLT_LOCKED_TGT, p);
        outRot.slerpQuaternions(Q_BOLT_UNLOCKED, Q_BOLT_LOCKED, p);
        return {boltRot:Math.PI/3 * (1-p), boltZ:0, grip: 1.0};
    }else{
        
        const p=Math.min(1.0, (t-0.85)/0.15);
        outPos.lerpVectors(BOLT_LOCKED_TGT, FORESTOCK_TARGET, p);
        outRot.slerpQuaternions(Q_BOLT_LOCKED, Q_FORESTOCK, p);
        grip = 1.0 - (p * 0.6); 
        return {boltRot:0, boltZ:0, grip: grip};
    }
}

let rightHand;
function updateWeaponIK(dt){
    if(!rightHand || !weaponGroup.visible) return;

if(state.weapon==='reloading'){
        state.reloadT+=dt/1.8; 
        if(state.reloadT>1) state.reloadT=1;
        const kf=reloadKeyframe(state.reloadT, rightHand.position, rightHand.quaternion);

        boltPivot.rotation.z=kf.boltRot;
        boltPivot.position.z=-0.01+kf.boltZ;
        setHandGrip(rightHand, kf.grip); 
    }else{
        rightHand.position.copy(FORESTOCK_TARGET);
        rightHand.quaternion.copy(Q_FORESTOCK);
        setHandGrip(rightHand, 0.4); 
        
        if(state.reloadT !== 0) {
            state.reloadT=0;
            boltPivot.rotation.z=0;
            boltPivot.position.z=-0.01;
        }
    }
}

function shoot(){
    if(state.weapon!=='ready'||state.phase!=='playing'||state.paused) return;
    state.weapon='firing'; state.shots++;
    audio.gunshot();
    el.flash.classList.remove('hidden');
    setTimeout(()=>el.flash.classList.add('hidden'),80);
    state.shake=0.04; state.pitch-=0.03;

    raycaster.setFromCamera(new THREE.Vector2(0,0),camera);
    const hits=raycaster.intersectObjects(hitMeshes,false);
    if(hits.length>0){
        const parent=hits[0].object.userData.parentTarget;
        if(parent?.userData.isTarget){
            const td=targets.find(t=>t.mesh===parent);
            if(td?.visible){
                state.score+=td.points; state.hits++;
                el.score.textContent=`점수: ${state.score}`;
                showHitMarker();

td.foldState='folding'; 
                td.stateTimer=td.hideDur; 
                td.visible=false;
            }
        }
    }
    if(state.scoped) setTimeout(disengageScope,120);
    setTimeout(()=>{
        state.weapon='reloading'; state.reloadT=0;
        el.reload.classList.remove('hidden'); audio.bolt(); state.shake=0.006;
    },200);
    setTimeout(()=>{state.weapon='ready';el.reload.classList.add('hidden');},RELOAD_DURATION);
}

function showHitMarker(){
    el.hitMarker.classList.remove('hidden');
    el.hitMarker.style.opacity='1'; el.hitMarker.style.transform='translate(-50%,-50%) scale(1.8)';
    setTimeout(()=>{el.hitMarker.style.opacity='0';el.hitMarker.style.transform='translate(-50%,-50%) scale(1)';},80);
    setTimeout(()=>el.hitMarker.classList.add('hidden'),350);
}

function engageScope(){
    audio.scopePlay();
    state.scoped=true;
    camera.fov=SCOPE_FOV; camera.near=SCOPE_NEAR; camera.far=SCOPE_FAR;
    camera.updateProjectionMatrix();
    el.scope.classList.remove('hidden'); el.crosshair.classList.add('hidden');
    if(weaponGroup) weaponGroup.visible=false;
}
function disengageScope(){
    state.scoped=false;
    camera.fov=NORMAL_FOV; camera.near=NORMAL_NEAR; camera.far=NORMAL_FAR;
    camera.updateProjectionMatrix();
    el.scope.classList.add('hidden'); el.crosshair.classList.remove('hidden');
    if(weaponGroup&&state.phase==='playing') weaponGroup.visible=true;
}
function toggleScope(){
    if(state.weapon!=='ready'||state.phase!=='playing'||state.paused) return;
    state.scoped?disengageScope():engageScope();
}

function setupControls(){
    renderer.domElement.addEventListener('click',()=>{
        if(state.phase==='playing'&&!state.paused&&!document.pointerLockElement)
            renderer.domElement.requestPointerLock();
    });
    let skipNextMove=false; 
    document.addEventListener('mousemove',e=>{
        if(document.pointerLockElement!==renderer.domElement||state.phase!=='playing'||state.paused) return;
        if(skipNextMove){ skipNextMove=false; return; }

const clampVal = state.scoped ? 20 : 60;
        let mx = Math.max(-clampVal, Math.min(clampVal, e.movementX));
        let my = Math.max(-clampVal, Math.min(clampVal, e.movementY));
        
        const s=state.scoped?MOUSE_SENS*0.3:MOUSE_SENS;
        state.yaw=Math.max(-YAW_LIMIT,Math.min(YAW_LIMIT,state.yaw-mx*s));
        state.pitch=Math.max(-PITCH_LIMIT,Math.min(PITCH_LIMIT,state.pitch-my*s));
    });
    document.addEventListener('mousedown',e=>{
        if(state.phase!=='playing'||state.paused||document.pointerLockElement!==renderer.domElement) return;
        if(e.button===0) shoot(); else if(e.button===2) toggleScope();
    });
    document.addEventListener('contextmenu',e=>e.preventDefault());
    document.addEventListener('pointerlockchange',()=>{
        if(document.pointerLockElement===renderer.domElement) skipNextMove=true; 
        if(!document.pointerLockElement&&state.phase==='playing'&&!state.paused) pauseGame();
    });
    window.addEventListener('resize',()=>{
        camera.aspect=innerWidth/innerHeight; camera.updateProjectionMatrix();
        renderer.setSize(innerWidth,innerHeight);
    });
}

function pauseGame(){
    if(state.phase!=='playing') return;
    state.paused=true;
    clearInterval(state.timer);
    el.pause.classList.remove('hidden');
    document.body.classList.remove('playing');
    if(state.scoped) disengageScope();
}
function resumeGame(){
    state.paused=false;
    el.pause.classList.add('hidden');
    document.body.classList.add('playing');
    renderer.domElement.requestPointerLock();
    state.timer=setInterval(()=>{
        if(state.paused) return;
        state.timeLeft--; el.timer.textContent=state.timeLeft;
        if(state.timeLeft<=10) el.timer.classList.add('timer-warn');
        if(state.timeLeft<=0) endGame();
    },1000);
}

function startGame(){
    state.phase='playing'; state.score=state.hits=state.shots=0;
    state.timeLeft=GAME_DURATION; state.weapon='ready';
    state.scoped=false; state.yaw=0; state.pitch=-0.02;
    state.shake=0; state.reloadT=0; state.paused=false;

camera.matrixAutoUpdate=true;

    camera.position.set(0,2,4.0); 
    camera.fov=NORMAL_FOV; camera.near=NORMAL_NEAR; camera.far=NORMAL_FAR;
    camera.updateProjectionMatrix();

    el.landing.classList.add('hidden'); el.gameover.classList.add('hidden');
    el.pause.classList.add('hidden');
    el.hud.classList.remove('hidden'); el.crosshair.classList.remove('hidden');
    el.scope.classList.add('hidden'); el.reload.classList.add('hidden');
    el.score.textContent='점수: 0'; el.timer.textContent=GAME_DURATION;
    el.timer.classList.remove('timer-warn');

    document.body.classList.add('playing');
    if(!audio.ctx) audio.init(); audio.resume();
    renderer.domElement.requestPointerLock();

    if(state.timer) clearInterval(state.timer);
    state.timer=setInterval(()=>{
        if(state.paused) return;
        state.timeLeft--; el.timer.textContent=state.timeLeft;
        if(state.timeLeft<=10) el.timer.classList.add('timer-warn');
        if(state.timeLeft<=0) endGame();
    },1000);

    if(weaponGroup) weaponGroup.visible=true;
}

function endGame(){
    state.phase='gameover'; clearInterval(state.timer);
    document.body.classList.remove('playing');
    if(document.pointerLockElement) document.exitPointerLock();
    if(state.scoped) disengageScope();
    el.hud.classList.add('hidden'); el.gameover.classList.remove('hidden');
    el.fScore.textContent=state.score; el.fHits.textContent=state.hits;
    el.fShots.textContent=state.shots;
    el.fAcc.textContent=state.shots>0?Math.round(state.hits/state.shots*100)+'%':'0%';
    el.timer.classList.remove('timer-warn');
    if(weaponGroup) weaponGroup.visible=false;
}

function goToMenu(){
    state.phase='menu'; state.paused=false;
    clearInterval(state.timer);
    document.body.classList.remove('playing');
    if(document.pointerLockElement) document.exitPointerLock();
    if(state.scoped) disengageScope();
    el.hud.classList.add('hidden'); el.gameover.classList.add('hidden');
    el.pause.classList.add('hidden'); el.landing.classList.remove('hidden');
    if(weaponGroup) weaponGroup.visible=false;
}

let gameTime=0;
const _camEuler = new THREE.Euler(0,0,0,'YXZ');
const _E = new THREE.Vector3();
const _T = new THREE.Vector3(0, 2, -50);
const _U = new THREE.Vector3(0, 1, 0);
const _Z = new THREE.Vector3();
const _X = new THREE.Vector3();
const _Y = new THREE.Vector3();

function animate(timestamp){
    requestAnimationFrame(animate);
    const dt=clock.getDelta();
    if(!state.paused) gameTime+=dt;
    if(!state.paused) updateTargets(dt,gameTime);

    if(state.phase==='playing'&&!state.paused){
        _camEuler.set(state.pitch,state.yaw,0,'YXZ');
        camera.quaternion.setFromEuler(_camEuler);
        camera.position.set(0,2,4.0); 

        if(state.shake>0.001){
            camera.rotateX((Math.random()-0.5)*state.shake);
            camera.rotateY((Math.random()-0.5)*state.shake*0.5);
            state.shake*=0.87;
        }
        camera.rotateY(Math.sin(gameTime*1.2)*0.0008);
        camera.rotateX(Math.sin(gameTime*0.9)*0.0004);

        camera.updateMatrixWorld(true);
        updateWeaponIK(dt);
    }else if(state.phase!=='playing'){
        const t=timestamp*0.00012,r=20;

        _E.set(Math.sin(t)*r, 9+Math.sin(t*0.6)*2.5, Math.cos(t)*r*0.45-22);
        _Z.subVectors(_E, _T).normalize();
        _X.crossVectors(_U, _Z).normalize();
        _Y.crossVectors(_Z, _X).normalize();

        camera.matrix.set(
            _X.x, _Y.x, _Z.x, _E.x,
            _X.y, _Y.y, _Z.y, _E.y,
            _X.z, _Y.z, _Z.z, _E.z,
             0,   0,   0,   1
        );

        camera.matrixAutoUpdate = false;
        camera.matrixWorldNeedsUpdate = true;
    }

windFlags.forEach((f, i) => {
        f.rotation.y = Math.sin(timestamp * 0.002 + i) * 0.2;
    });

    renderer.render(scene,camera);
}

el.playBtn.addEventListener('click',startGame);
el.retryBtn.addEventListener('click',startGame);
el.menuBtn.addEventListener('click',goToMenu);
el.resumeBtn.addEventListener('click',resumeGame);
el.pauseRetry.addEventListener('click',()=>{el.pause.classList.add('hidden');startGame();});
el.pauseMenu.addEventListener('click',goToMenu);

initScene();
setupControls();
audio.preload();
animate(0);
