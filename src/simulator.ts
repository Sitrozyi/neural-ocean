export type CreatureType = 'herbivore' | 'carnivore' | 'scavenger' | 'solar_jelly' | 'chimera' | 'manta' | 'cleaner_shrimp' | 'anglerfish' | 'nautilus';
export type LifeStage = 'larva' | 'adult';
export type ActionState = 'forage' | 'avoid' | 'rest' | 'court' | 'idle';

export type PartGene =
  | 'prop_ribbon' | 'prop_fork' | 'prop_jet' | 'prop_paddle'
  | 'head_jaw' | 'head_horn' | 'head_angler' | 'head_beak'
  | 'body_spikes' | 'body_fin' | 'body_symbiont' | 'body_ink';

export interface InternalDrive {
  hunger: number;
  fatigue: number;
  reproductiveUrge: number;
  socialNeed: number;
}

export interface Detritus {
  x: number;
  y: number;
  z: number;
  mass: number;
  vx: number;
  vy: number;
  vz: number;
  age: number;
  source: 'feces' | 'carcass' | 'plant_litter';
}

export class Swarm {
  id: number;
  members: Creature[] = [];
  centroid: { x: number; y: number; z: number } = { x: 0, y: 0, z: 0 };
  velocity: { x: number; y: number; z: number } = { x: 0, y: 0, z: 0 };
  cohesion = 0.18;
  separation = 0.95;
  alignment = 0.35;
  scatterTimer = 0;
  scatterOrigin: { x: number; y: number; z: number } = { x: 0, y: 0, z: 0 };

  constructor(id: number) {
    this.id = id;
  }

  update(dt: number, threats: Creature[]) {
    this.members = this.members.filter(m => !m.isDead);
    if (this.members.length === 0) return;

    let cx = 0, cy = 0, cz = 0;
    let vx = 0, vy = 0, vz = 0;
    for (const m of this.members) {
      cx += m.x;
      cy += m.y;
      cz += m.z;
      vx += m.vx;
      vy += m.vy;
      vz += m.vz;
    }
    const count = this.members.length;
    this.centroid = { x: cx / count, y: cy / count, z: cz / count };
    this.velocity = { x: vx / count, y: vy / count, z: vz / count };

    let nearestThreat: Creature | null = null;
    let minThreatDist = 180;
    for (const t of threats) {
      if (t.isDead || t.dna.diet <= 0.55) continue;
      const d = Math.hypot(t.x - this.centroid.x, t.y - this.centroid.y);
      if (d < minThreatDist) {
        minThreatDist = d;
        nearestThreat = t;
      }
    }

    if (nearestThreat && this.scatterTimer <= 0) {
      this.scatterTimer = 1.6;
      this.scatterOrigin = { x: nearestThreat.x, y: nearestThreat.y, z: nearestThreat.z };
    }

    if (this.scatterTimer > 0) {
      this.scatterTimer -= dt;
    }
  }
  applyToMembers(dt: number) {
      if (this.members.length === 0) return;
      const isScattering = this.scatterTimer > 0.6;

      for (const m of this.members) {
        if (m.currentAction === 'rest') continue;

        if (isScattering) {
          const dx = m.x - this.scatterOrigin.x;
          const dy = m.y - this.scatterOrigin.y;
          const scatterAngle = Math.atan2(dy, dx) + (Math.sin(m.id * 13) * 0.25);
          let diff = scatterAngle - m.angle;
          while (diff < -Math.PI) diff += Math.PI * 2;
          while (diff > Math.PI) diff -= Math.PI * 2;
          m.angle += diff * Math.min(1, dt * 5.0);
          m.sprintTimer = 0.5;
          m.vz += (Math.random() - 0.5) * 0.02;
        } else {
          const cohAngle = Math.atan2(this.centroid.y - m.y, this.centroid.x - m.x);
          let diffCoh = cohAngle - m.angle;
          while (diffCoh < -Math.PI) diffCoh += Math.PI * 2;
          while (diffCoh > Math.PI) diffCoh -= Math.PI * 2;

          const aliAngle = Math.atan2(this.velocity.y, this.velocity.x);
          let diffAli = aliAngle - m.angle;
          while (diffAli < -Math.PI) diffAli += Math.PI * 2;
          while (diffAli > Math.PI) diffAli -= Math.PI * 2;

          let sepX = 0, sepY = 0;
          let denseCount = 0;
          for (const other of this.members) {
            if (other.id === m.id) continue;
            const d = Math.hypot(other.x - m.x, other.y - m.y);
            if (d < 55 && d > 0.001) {
              denseCount++;
              const force = (55 - d) / 55;
              sepX -= ((other.x - m.x) / d) * force * 1.8;
              sepY -= ((other.y - m.y) / d) * force * 1.8;
            }
          }
          let sepDiff = 0;
          if (Math.hypot(sepX, sepY) > 0.01) {
            const sepAngle = Math.atan2(sepY, sepX);
            sepDiff = sepAngle - m.angle;
            while (sepDiff < -Math.PI) sepDiff += Math.PI * 2;
            while (sepDiff > Math.PI) sepDiff -= Math.PI * 2;
          }
          const dynamicCoh = denseCount > 4 ? 0.05 : 0.28;
          const swarmSteer = diffCoh * dynamicCoh + diffAli * 0.62 + sepDiff * 0.95;
          m.angle += Math.max(-0.06, Math.min(0.06, swarmSteer * 0.25));

          const zDiff = this.centroid.z - m.z;
          m.vz += zDiff * 0.03 * dt * 60;
        }
      }
    }

}

export class NeuralBrain {
  inputSize = 10;
  hiddenSize = 6;
  outputSize = 5;

  weightsIH: number[][];
  biasH: number[];
  weightsHO: number[][];
  biasO: number[];

  memory = 0;
  learnFlash = 0;

  lastInputs: number[] = new Array(10).fill(0);
  lastHidden: number[] = new Array(6).fill(0);
  lastOutputs: number[] = new Array(5).fill(0);

  constructor(copyFrom?: NeuralBrain, mutationRate = 0.15) {
    this.weightsIH = [];
    this.biasH = [];
    this.weightsHO = [];
    this.biasO = [];

    if (copyFrom) {
      for (let h = 0; h < this.hiddenSize; h++) {
        this.weightsIH[h] = [];
        for (let i = 0; i < this.inputSize; i++) {
          let w = copyFrom.weightsIH[h] ? copyFrom.weightsIH[h][i] || 0 : 0;
          if (Math.random() < mutationRate) w += (Math.random() - 0.5) * 0.5;
          this.weightsIH[h][i] = Math.max(-2, Math.min(2, w));
        }
        let bh = copyFrom.biasH[h] || 0;
        if (Math.random() < mutationRate) bh += (Math.random() - 0.5) * 0.4;
        this.biasH[h] = Math.max(-1, Math.min(1, bh));
      }

      for (let o = 0; o < this.outputSize; o++) {
        this.weightsHO[o] = [];
        for (let h = 0; h < this.hiddenSize; h++) {
          let w = copyFrom.weightsHO[o] ? copyFrom.weightsHO[o][h] || 0 : 0;
          if (Math.random() < mutationRate) w += (Math.random() - 0.5) * 0.5;
          this.weightsHO[o][h] = Math.max(-2, Math.min(2, w));
        }
        let bo = copyFrom.biasO[o] || 0;
        if (Math.random() < mutationRate) bo += (Math.random() - 0.5) * 0.4;
        this.biasO[o] = Math.max(-1, Math.min(1, bo));
      }
    } else {
      for (let h = 0; h < this.hiddenSize; h++) {
        this.weightsIH[h] = [];
        for (let i = 0; i < this.inputSize; i++) {
          this.weightsIH[h][i] = (Math.random() - 0.5) * 1.5;
        }
        this.biasH[h] = (Math.random() - 0.5) * 0.5;
      }
      for (let o = 0; o < this.outputSize; o++) {
        this.weightsHO[o] = [];
        for (let h = 0; h < this.hiddenSize; h++) {
          this.weightsHO[o][h] = (Math.random() - 0.5) * 1.5;
        }
        this.biasO[o] = (Math.random() - 0.5) * 0.5;
      }
    }
  }

  forward(inputs: number[]): number[] {
    inputs[8] = this.memory;
    for (let i = 0; i < this.inputSize; i++) this.lastInputs[i] = inputs[i] || 0;

    for (let h = 0; h < this.hiddenSize; h++) {
      let sum = this.biasH[h];
      for (let i = 0; i < this.inputSize; i++) {
        sum += this.lastInputs[i] * this.weightsIH[h][i];
      }
      this.lastHidden[h] = Math.tanh(sum);
    }

    for (let o = 0; o < this.outputSize; o++) {
      let sum = this.biasO[o];
      for (let h = 0; h < this.hiddenSize; h++) {
        sum += this.lastHidden[h] * this.weightsHO[o][h];
      }
      if (o === 0) this.lastOutputs[o] = Math.tanh(sum);
      else this.lastOutputs[o] = 1 / (1 + Math.exp(-sum));
    }

    this.memory = this.memory * 0.82 + (this.lastHidden[0] || 0) * 0.18;
    return this.lastOutputs;
  }

  applyHebb(rate: number) {
    this.learnFlash = rate;
    for (let o = 0; o < this.outputSize; o++) {
      const outVal = this.lastOutputs[o];
      for (let h = 0; h < this.hiddenSize; h++) {
        this.weightsHO[o][h] = Math.max(-2, Math.min(2, this.weightsHO[o][h] + this.lastHidden[h] * outVal * rate));
      }
    }
    for (let h = 0; h < this.hiddenSize; h++) {
      const hidVal = this.lastHidden[h];
      for (let i = 0; i < this.inputSize; i++) {
        this.weightsIH[h][i] = Math.max(-2, Math.min(2, this.weightsIH[h][i] + this.lastInputs[i] * hidVal * rate * 0.5));
      }
    }
  }
}

export interface DNA {
  speed: number;
  turnSpeed: number;
  senseRadius: number;
  size: number;
  color: [number, number, number];
  reproEnergy: number;
  metabolism: number;
  mutationRate: number;
  maxAge: number;
  camouflage: number;
  diet: number;
  segments: number;
  poison: number;
  poisonResist: number;
  armor: number;
  biteForce: number;
  electricShock: number;
  photosynthesis: number;
  scavengerDrive: number;
  rkStrategy: number;
  parts: PartGene[];
  isAncient?: boolean;
  isCrystal?: boolean;
}

export interface TailNode {
  x: number;
  y: number;
}

export interface Egg {
  id: number;
  type: CreatureType;
  x: number;
  y: number;
  z: number;
  dna: DNA;
  brain: NeuralBrain;
  generation: number;
  parentId: number | null;
  size: number;
  energy: number;
  hatchTimer: number;
  maxHatchTime: number;
}

export interface Creature {
  id: number;
  type: CreatureType;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  angle: number;
  energy: number;
  maxEnergy: number;
  age: number;
  stage: LifeStage;
  growth: number;
  generation: number;
  parentId: number | null;
  dna: DNA;
  brain: NeuralBrain;
  children: number;
  kills: number;
  plantsEaten: number;
  isDead: boolean;
  tailNodes: TailNode[];
  finPhase: number;
  pulsePhase: number;
  legPhase: number;
  sprintTimer: number;
  stunTimer: number;
  poisonTimer: number;
  electricCooldown: number;
  reproCooldown: number;
  warningSignal: number;
  currentAction: ActionState;
  internalDrive: InternalDrive;
  swarmId?: number | null;
  biteAnimTimer?: number;
  lungeTimer?: number;
  shellRetractTimer?: number;
  anglerLurePhase?: number;
}

export interface Plant {
  id: number;
  x: number;
  y: number;
  z: number;
  energy: number;
  size: number;
  maxSize: number;
  type: 'algae' | 'fruit' | 'meat_remains' | 'whale_fall' | 'marine_snow' | 'deep_coral' | 'biolume_plankton' | 'hydro_spore' | 'bacteria_mat';
  stage?: 'flesh' | 'reef' | 'mineral';
  stageTimer?: number;
}

export interface KelpNode {
  x: number;
  y: number;
}

export type VegetationType = 'giant_kelp' | 'sea_fern';

export interface Kelp {
  id: number;
  type: VegetationType;
  baseX: number;
  baseY: number;
  height: number;
  segmentCount: number;
  nodes: KelpNode[];
  phase: number;
  color?: string;
}

export interface HydrothermalVent {
  id: number;
  x: number;
  y: number;
  height: number;
  width: number;
  craterWidth: number;
  bubbleTimer: number;
  temperature: number;
}

export interface ColossalShadow {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  speed: number;
  length: number;
  angle: number;
  targetAngle: number;
  turnTimer: number;
  phase: number;
  nodes: { x: number; y: number }[];
}

export interface CoralBranch {
  angle: number;
  length: number;
  color: string;
  subBranches?: { angle: number; length: number }[];
}

export interface RockVertex {
  angle: number;
  radius: number;
}

export interface Obstacle {
  id: number;
  x: number;
  y: number;
  radius: number;
  type: 'rock' | 'coral_reef';
  passableSize: number;
  branches?: CoralBranch[];
  rockVertices?: RockVertex[];
  glowColor: string;
}

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  color: string;
  size: number;
  life: number;
  maxLife: number;
  type?: 'spark' | 'smoke' | 'shockwave' | 'bubble' | 'poison_cloud' | 'electric_arc';
}

export interface Shockwave {
  x: number;
  y: number;
  radius: number;
  maxRadius: number;
  color: string;
  life: number;
}

export interface SpeciesCatalogItem {
  id: string;
  name: string;
  category: string;
  condition: string;
  desc: string;
  previewDna: Partial<DNA>;
}

export const SPECIES_CATALOG: SpeciesCatalogItem[] = [
  {
    id: 'titan',
    name: 'Titan Horn',
    category: 'Megafauna',
    condition: 'Size >= 14',
    desc: 'Massive armored behemoth dominating deep waters.',
    previewDna: { size: 14.5, color: [45, 185, 150], diet: 0.2, segments: 6, armor: 0.5 }
  },
  {
    id: 'swift',
    name: 'Swift Fin',
    category: 'Speedster',
    condition: 'Speed >= 4.5',
    desc: 'Streamlined agile swimmer darting through open currents.',
    previewDna: { speed: 4.8, size: 5.5, color: [56, 189, 248], diet: 0.3, segments: 5, turnSpeed: 0.18 }
  },
  {
    id: 'venom',
    name: 'Abyss Viper',
    category: 'Venomous',
    condition: 'Poison >= 0.75',
    desc: 'Carries potent neurotoxin in its dorsal spines.',
    previewDna: { size: 7.2, color: [168, 85, 247], poison: 0.85, diet: 0.4, segments: 6 }
  },
  {
    id: 'aegis',
    name: 'Aegis Shell',
    category: 'Armored',
    condition: 'Armor >= 0.8',
    desc: 'Heavy layered plates repelling predator fangs.',
    previewDna: { size: 8.2, color: [56, 189, 248], armor: 0.88, diet: 0.15, segments: 4 }
  },
  {
    id: 'elder',
    name: 'Deep Elder',
    category: 'Ancient',
    condition: 'Lifespan >= 100',
    desc: 'Resilient lineage enduring across generations.',
    previewDna: { size: 9.0, color: [148, 163, 184], maxAge: 120, diet: 0.25, segments: 5 }
  },
  {
    id: 'reaper',
    name: 'Reaper Leviathan',
    category: 'Apex Predator',
    condition: 'Kills >= 8',
    desc: 'Frenzied hunter ruling the top of the food chain.',
    previewDna: { size: 12.5, color: [239, 68, 68], diet: 0.95, biteForce: 0.9, segments: 6 }
  },
  {
    id: 'photon',
    name: 'Photon Jelly',
    category: 'Photosynthetic',
    condition: 'Photosynthesis >= 0.75',
    desc: 'Floating organism fueled directly by light energy.',
    previewDna: { size: 7.5, color: [52, 211, 153], photosynthesis: 0.85, diet: 0.0 }
  },
  {
    id: 'aurum',
    name: 'Golden Morph',
    category: 'Legendary',
    condition: 'Golden Color',
    desc: 'Ultra-rare genetic mutation with radiant golden glow.',
    previewDna: { size: 7.0, color: [245, 158, 11], diet: 0.3, segments: 5 }
  },
  {
    id: 'brood',
    name: 'Brood Mother',
    category: 'Prolific',
    condition: 'r-Strategy <= 0.15',
    desc: 'Spawns dense egg clusters to rapidly populate waters.',
    previewDna: { size: 6.8, color: [244, 114, 182], rkStrategy: 0.1, diet: 0.1, segments: 4 }
  },
  {
    id: 'phantom',
    name: 'Phantom Seeker',
    category: 'Camouflage',
    condition: 'Camouflage >= 0.75',
    desc: 'Translucent tissue blending seamlessly with the dark.',
    previewDna: { size: 6.0, color: [100, 116, 139], camouflage: 0.85, diet: 0.35, segments: 4 }
  },
  {
    id: 'dynamo',
    name: 'Electro Dynamo',
    category: 'Electric',
    condition: 'Electric Shock >= 0.75',
    desc: 'Emits high-voltage pulses to paralyze nearby threats.',
    previewDna: { size: 7.8, color: [250, 204, 21], electricShock: 0.88, diet: 0.45, segments: 5 }
  },
  {
    id: 'abyss_eye',
    name: 'Abyss Eye',
    category: 'Wide Sensor',
    condition: 'Sense Radius >= 260',
    desc: 'High-sensitivity organs detecting distant movements.',
    previewDna: { size: 6.8, color: [14, 165, 233], senseRadius: 280, diet: 0.2, segments: 4 }
  },
  {
    id: 'needle_jaw',
    name: 'Needle Jaw',
    category: 'Biter',
    condition: 'Bite Force >= 0.85',
    desc: 'Sharp needle teeth capable of puncturing thick shells.',
    previewDna: { size: 8.8, color: [225, 29, 72], biteForce: 0.92, diet: 0.9, segments: 5 }
  },
  {
    id: 'crimson_beast',
    name: 'Crimson Chimera',
    category: 'Apex Chimera',
    condition: 'Carnivore & Size >= 11',
    desc: 'Crimson giant dominating the ocean territory.',
    previewDna: { size: 12.0, color: [190, 18, 60], diet: 0.9, biteForce: 0.8, segments: 7 }
  },
  {
    id: 'crawler',
    name: 'Abyss Scavenger',
    category: 'Benthic',
    condition: 'Scavenger & Armor >= 0.7',
    desc: 'Armored bottom-dweller consuming organic remains.',
    previewDna: { size: 6.0, color: [217, 119, 6], scavengerDrive: 0.95, armor: 0.8, diet: 0.1 }
  },
  {
    id: 'siren',
    name: 'Phantom Siren',
    category: 'Agile Swimmer',
    condition: 'Turn Speed >= 0.22',
    desc: 'Exceptional maneuverability ribbon fins avoiding attacks.',
    previewDna: { speed: 3.6, turnSpeed: 0.25, size: 5.8, color: [192, 132, 252], diet: 0.2, segments: 5 }
  },
  {
    id: 'leviathan',
    name: 'Ancestral Orochi',
    category: 'Serpentine',
    condition: '7 Segments & Size >= 10',
    desc: 'Seven-segmented serpentine ancient ruler of the abyss.',
    previewDna: { size: 10.8, color: [13, 148, 136], segments: 7, diet: 0.65 }
  },
  {
    id: 'biolume',
    name: 'Abyss Lantern',
    category: 'Bioluminescent',
    condition: 'Cyan Glow & Photosyn >= 0.6',
    desc: 'Bioluminescent lure aiding photosynthesis and attraction.',
    previewDna: { size: 6.6, color: [34, 211, 238], photosynthesis: 0.75, diet: 0.15, segments: 4 }
  }
];

export interface DnaBankSlot {
  name: string;
  type: CreatureType;
  dna: DNA;
  gen: number;
}

export class SpatialGrid<T extends { x: number; y: number }> {
  cellSize: number;
  cols: number;
  rows: number;
  buckets: Map<number, T[]> = new Map();

  constructor(width: number, height: number, cellSize: number) {
    this.cellSize = cellSize;
    this.cols = Math.ceil(width / cellSize);
    this.rows = Math.ceil(height / cellSize);
  }

  clear() {
    this.buckets.clear();
  }

  private getKey(cx: number, cy: number): number {
    return cy * this.cols + cx;
  }

  insert(item: T) {
    const cx = Math.max(0, Math.min(this.cols - 1, Math.floor(item.x / this.cellSize)));
    const cy = Math.max(0, Math.min(this.rows - 1, Math.floor(item.y / this.cellSize)));
    const key = this.getKey(cx, cy);
    let bucket = this.buckets.get(key);
    if (!bucket) {
      bucket = [];
      this.buckets.set(key, bucket);
    }
    bucket.push(item);
  }

  query(x: number, y: number, radius: number): T[] {
    const minCx = Math.max(0, Math.floor((x - radius) / this.cellSize));
    const maxCx = Math.min(this.cols - 1, Math.floor((x + radius) / this.cellSize));
    const minCy = Math.max(0, Math.floor((y - radius) / this.cellSize));
    const maxCy = Math.min(this.rows - 1, Math.floor((y + radius) / this.cellSize));

    const result: T[] = [];
    const r2 = radius * radius;

    for (let cy = minCy; cy <= maxCy; cy++) {
      for (let cx = minCx; cx <= maxCx; cx++) {
        const bucket = this.buckets.get(this.getKey(cx, cy));
        if (bucket) {
          for (let i = 0; i < bucket.length; i++) {
            const item = bucket[i];
            const dx = item.x - x;
            const dy = item.y - y;
            if (dx * dx + dy * dy <= r2) {
              result.push(item);
            }
          }
        }
      }
    }
    return result;
  }
}

export class EcosystemWorld {
  width = 3200;
  height = 2000;
  creatures: Creature[] = [];
  eggs: Egg[] = [];
  plants: Plant[] = [];
  detritus: Detritus[] = [];
  swarms: Swarm[] = [];
  obstacles: Obstacle[] = [];
  particles: Particle[] = [];
  shockwaves: Shockwave[] = [];

  nextId = 1;
  nextSwarmId = 1;
  totalTime = 0;
  timeScale = 1.0;

  discoveredSpecies: string[] = [];
  dnaBank: DnaBankSlot[] = [];
  recentDiscovery: string | null = null;
  discoveryTimer = 0;
  latestMutant: Creature | null = null;
  mutantAlertTimer = 0;

  creatureGrid: SpatialGrid<Creature>;
  plantGrid: SpatialGrid<Plant>;

  historyHerb: number[] = [];
  historyCarn: number[] = [];
  historyPlant: number[] = [];
  maxGen = 1;
  historyTimer = 0;
  kelps: Kelp[] = [];
  hydrothermalVents: HydrothermalVent[] = [];
  colossalShadow: ColossalShadow = {
    x: 1600,
    y: 1100,
    z: 0.88,
    vx: 15,
    vy: 0,
    speed: 15,
    length: 850,
    angle: 0,
    targetAngle: 0,
    turnTimer: 3.0,
    phase: 0,
    nodes: []
  };
  naturalSpawnTimer = 0;

  deepNutrients = 1.0;
  entropyMap: Float32Array = new Float32Array(20 * 20);
  entropyMaxPos: { x: number; y: number } = { x: 1600, y: 1000 };
  entropyPeakValue = 0;
  recentPredations: { x: number; y: number; time: number }[] = [];

  getLightIntensity(z: number): number {
    return Math.exp(-Math.max(0, Math.min(1, z)) * 2.8);
  }

  getFlowVector(x: number, y: number, z: number): { u: number; v: number; w: number } {
    const kx = 0.0012;
    const ky = 0.0015;
    const t = this.totalTime * 0.05;
    const u = -Math.cos(x * kx + t * 0.4) * Math.sin(y * ky + t * 0.3) * 0.42 + 0.12;
    const v = Math.sin(x * kx + t * 0.4) * Math.cos(y * ky + t * 0.3) * 0.35 + Math.sin(t * 0.2 + x * 0.0005) * 0.08;
    const w = Math.sin(x * 0.0015 + t * 0.15) * 0.0006 * (1.0 - z * 0.3);

    return { u, v, w };
  }

  spawnDetritus(x: number, y: number, z: number, mass = 1.0, source: 'feces' | 'carcass' | 'plant_litter' = 'feces') {
    if (this.detritus.length >= 3000) return;
    const clampedMass = Math.max(0.5, Math.min(5.0, mass));
    const vz = 0.0006 + Math.random() * 0.0014;
    this.detritus.push({
      x: Math.max(10, Math.min(this.width - 10, x + (Math.random() - 0.5) * 8)),
      y: Math.max(10, Math.min(this.height - 10, y + (Math.random() - 0.5) * 8)),
      z: Math.max(0, Math.min(1, z)),
      mass: clampedMass,
      vx: (Math.random() - 0.5) * 0.25,
      vy: (Math.random() - 0.5) * 0.25,
      vz,
      age: 0,
      source
    });
  }

  constructor() {
    this.creatureGrid = new SpatialGrid<Creature>(this.width, this.height, 90);
    this.plantGrid = new SpatialGrid<Plant>(this.width, this.height, 80);
    this.loadCatalogFromStorage();
    this.loadDnaBankFromStorage();
    const lastSlot = parseInt(localStorage.getItem('biocosmos_last_slot') || '1', 10);
    if (!this.loadWorldState(lastSlot) && !this.loadWorldState(1)) {
      this.initWorld();
    }
  }

  initWorld() {
    this.creatures = [];
    this.eggs = [];
    this.plants = [];
    this.detritus = [];
    this.swarms = [];
    this.obstacles = [];
    this.particles = [];
    this.shockwaves = [];
    this.kelps = [];
    this.hydrothermalVents = [];
    this.historyHerb = [];
    this.historyCarn = [];
    this.historyPlant = [];
    this.maxGen = 1;
    this.totalTime = 0;
    this.naturalSpawnTimer = 0;
    this.deepNutrients = 1.0;
    this.entropyMap.fill(0);
    this.recentPredations = [];

    const startX = this.width * 0.48;
    const startY = this.height * 0.54;
    const initNodes: { x: number; y: number }[] = [];
    const nodeCount = 15;
    const nodeSpacing = 58;
    for (let i = 0; i < nodeCount; i++) {
      initNodes.push({ x: startX - i * nodeSpacing, y: startY });
    }

    this.colossalShadow = {
      x: startX,
      y: startY,
      z: 0.90,
      vx: 14,
      vy: 0,
      speed: 14,
      length: nodeCount * nodeSpacing,
      angle: 0.05,
      targetAngle: 0.05,
      turnTimer: 3.5,
      phase: 0,
      nodes: initNodes
    };
    const grandVentX = this.width * 0.625;
    const grandVentY = this.height - 10;
    const grandVentH = 120;
    const grandVentW = 320;

    this.hydrothermalVents = [{
      id: this.nextId++,
      x: grandVentX,
      y: grandVentY,
      height: grandVentH,
      width: grandVentW,
      craterWidth: 50,
      bubbleTimer: 0.35,
      temperature: 0.7
    }];

    const zones = [
      { startX: this.width * 0.02, width: this.width * 0.48, count: 28 }, // Left 50%: Continuous Dense Kelp Forest
      { startX: this.width * 0.75, width: this.width * 0.23, count: 14 }  // Right 25%: Secondary Forest (50% to 75% is completely empty void)
    ];

    for (const z of zones) {
      for (let k = 0; k < z.count; k++) {
        const norm = k / Math.max(1, z.count - 1);
        const bx = z.startX + norm * z.width + (Math.random() - 0.5) * 18;
        const by = this.height - 15 - Math.random() * 50;
        const isBlue = Math.random() < 0.35;
        const vType: VegetationType = isBlue ? 'sea_fern' : 'giant_kelp';

        const kHeight = isBlue
          ? (140 + Math.random() * 150)
          : (220 + Math.random() * 260);
        const segs = isBlue ? 5 : 6;

        const nodes: KelpNode[] = [];
        for (let s = 0; s <= segs; s++) {
          nodes.push({ x: bx, y: by - (kHeight / segs) * s });
        }

        this.kelps.push({
          id: this.nextId++,
          type: vType,
          baseX: bx,
          baseY: by,
          height: kHeight,
          segmentCount: segs,
          nodes,
          phase: Math.random() * Math.PI * 2,
          color: isBlue ? '#06b6d4' : '#059669'
        });
      }
    }
    this.obstacles = [];

        const spawnCenters = [
          { x: this.width * 0.25, y: this.height * 0.45, radius: 280 },
          { x: this.width * 0.65, y: this.height * 0.50, radius: 280 }
        ];

        for (let i = 0; i < 110; i++) {
          const py = Math.random() * this.height;
          const px = Math.random() * this.width;
          let pType: Plant['type'] = 'algae';
          if (py < this.height * 0.35) {
            pType = Math.random() < 0.65 ? 'biolume_plankton' : (Math.random() < 0.2 ? 'fruit' : 'marine_snow');
          } else if (py < this.height * 0.7) {
            pType = Math.random() < 0.5 ? 'biolume_plankton' : (Math.random() < 0.25 ? 'algae' : 'marine_snow');
          } else {
            pType = Math.random() < 0.4 ? 'deep_coral' : (Math.random() < 0.3 ? 'hydro_spore' : 'marine_snow');
          }
          this.spawnPlant(px, py, pType);
        }

        for (let i = 0; i < 55; i++) {
          const b = spawnCenters[i % 2];
          const ang = Math.random() * Math.PI * 2;
          const d = Math.random() * (b.radius * 0.7);
          this.spawnCreature('herbivore', b.x + Math.cos(ang) * d, b.y + Math.sin(ang) * d, 1, undefined, undefined, 'adult');
        }
        for (let i = 0; i < 10; i++) {
          this.spawnCreature('solar_jelly', Math.random() * this.width, Math.random() * (this.height * 0.35), 1, undefined, undefined, 'adult');
        }
        for (let i = 0; i < 14; i++) {
          const scavY = this.height * 0.72 + Math.random() * (this.height * 0.24);
          this.spawnCreature('scavenger', Math.random() * this.width, scavY, 1, undefined, undefined, 'adult');
        }
        for (let i = 0; i < 4; i++) {
          const outX = Math.random() < 0.5 ? Math.random() * (this.width * 0.25) : this.width * 0.75 + Math.random() * (this.width * 0.25);
          const outY = this.height * (0.28 + Math.random() * 0.42);
          this.spawnCreature('carnivore', outX, outY, 1, undefined, undefined, 'adult');
        }
        for (let i = 0; i < 2; i++) {
          this.spawnCreature('manta', this.width * (0.3 + i * 0.4), this.height * 0.35, 1, undefined, undefined, 'adult');
        }
        for (let i = 0; i < 14; i++) {
          this.spawnCreature('cleaner_shrimp', Math.random() * this.width, this.height * (0.55 + Math.random() * 0.3), 1, undefined, undefined, 'adult');
        }
        for (let i = 0; i < 6; i++) {
          const angY = this.height * (0.80 + (i % 4) * 0.04) + (Math.random() - 0.5) * 30;
          this.spawnCreature('anglerfish', (this.width / 6) * (i + 0.5), angY, 1, undefined, undefined, 'adult');
        }
  }

  createDefaultDNA(type: CreatureType): DNA {
      const base: DNA = {
        speed: 1.4,
        turnSpeed: 0.08,
        senseRadius: 140,
        size: 5.2,
        color: [40, 190, 160],
        reproEnergy: 130,
        metabolism: 0.10,
        mutationRate: 0.14,
        maxAge: 75,
        camouflage: 0.1,
        diet: 0.05,
        segments: 4,
        poison: 0,
        poisonResist: 0,
        armor: 0,
        biteForce: 0.1,
        electricShock: 0,
        photosynthesis: 0,
        scavengerDrive: 0,
        rkStrategy: 0.5,
        parts: []
      };

      if (type === 'herbivore') {
        base.speed = 1.35 + Math.random() * 0.25;
        base.size = 5.0 + Math.random() * 1.2;
        base.color = [40 + Math.random() * 30, 200 + Math.random() * 40, 160 + Math.random() * 40];
        base.poison = Math.random() < 0.25 ? 0.7 : 0;
        base.armor = Math.random() < 0.2 ? 0.6 : 0;
        base.rkStrategy = Math.random() < 0.5 ? 0.25 : 0.75;
        base.parts = ['prop_fork', Math.random() < 0.4 ? 'body_symbiont' : 'body_fin'];
      } else if (type === 'carnivore') {
            base.speed = 1.4;
            base.turnSpeed = 0.045;
            base.senseRadius = 240;
            base.size = 7.6 + Math.random() * 1.0;
            base.color = [225, 29, 72];
            base.diet = 0.95;
            base.metabolism = 0.045;
            base.reproEnergy = 280;
            base.biteForce = 0.85;
            base.segments = 5;
            base.rkStrategy = 0.85;
            base.parts = ['head_jaw', 'prop_fork', 'body_fin'];
          } else if (type === 'scavenger') {
        base.speed = 1.05;
        base.senseRadius = 200;
        base.size = 4.8;
        base.color = [217, 119, 6];
        base.scavengerDrive = 0.95;
        base.diet = 0.05;
        base.armor = 0.35;
        base.rkStrategy = 0.45;
        base.parts = ['prop_paddle', 'head_beak'];
      } else if (type === 'solar_jelly') {
        base.speed = 0.65;
        base.senseRadius = 75;
        base.size = 7.0;
        base.color = [52, 211, 153];
        base.photosynthesis = 0.85;
        base.metabolism = 0.05;
        base.reproEnergy = 170;
        base.electricShock = 0.6;
        base.maxAge = 60;
        base.rkStrategy = 0.4;
        base.parts = ['head_angler', 'body_symbiont'];
      } else if (type === 'chimera') {
        base.speed = 2.2;
        base.turnSpeed = 0.035;
        base.senseRadius = 380;
        base.size = 36.0;
        base.color = [3, 20, 48];
        base.diet = 1.0;
        base.metabolism = 0.12;
        base.reproEnergy = 720;
        base.maxAge = 500;
        base.poison = 0.95;
        base.poisonResist = 1.0;
        base.armor = 0.98;
        base.biteForce = 1.0;
        base.electricShock = 0.92;
        base.segments = 12;
        base.mutationRate = 0.0;
        base.rkStrategy = 0.98;
        base.parts = ['head_horn', 'head_jaw', 'prop_ribbon', 'body_spikes'];
      } else if (type === 'manta') {
        base.speed = 1.15;
        base.turnSpeed = 0.06;
        base.senseRadius = 260;
        base.size = 17.0;
        base.color = [30, 64, 125];
        base.diet = 0.0;
        base.metabolism = 0.11;
        base.reproEnergy = 260;
        base.maxAge = 160;
        base.armor = 0.65;
        base.segments = 4;
        base.rkStrategy = 0.88;
        base.parts = ['body_fin', 'prop_ribbon'];
      } else if (type === 'cleaner_shrimp') {
        base.speed = 0.95;
        base.turnSpeed = 0.16;
        base.senseRadius = 130;
        base.size = 3.8;
        base.color = [244, 114, 182];
        base.diet = 0.0;
        base.scavengerDrive = 0.85;
        base.metabolism = 0.08;
        base.reproEnergy = 190;
        base.maxAge = 85;
        base.armor = 0.35;
        base.segments = 4;
        base.rkStrategy = 0.35;
        base.parts = ['head_beak', 'body_symbiont'];
      } else if (type === 'anglerfish') {
        base.speed = 0.65;
        base.turnSpeed = 0.04;
        base.senseRadius = 260;
        base.size = 15.0;
        base.color = [15, 23, 42];
        base.diet = 0.95;
        base.metabolism = 0.02;
        base.reproEnergy = 260;
        base.maxAge = 240;
        base.biteForce = 1.0;
        base.armor = 0.65;
        base.segments = 3;
        base.rkStrategy = 0.85;
        base.parts = ['head_angler', 'head_jaw'];
      } else if (type === 'nautilus') {
        base.speed = 0.85;
        base.turnSpeed = 0.08;
        base.senseRadius = 150;
        base.size = 7.5;
        base.color = [241, 245, 249];
        base.diet = 0.1;
        base.scavengerDrive = 0.85;
        base.metabolism = 0.05;
        base.reproEnergy = 150;
        base.maxAge = 180;
        base.armor = 0.98;
        base.segments = 3;
        base.rkStrategy = 0.8;
        base.parts = ['head_beak', 'body_fin'];
      }
      return base;
    }

    mutateDNA(parentDNA: DNA): DNA {
        if (parentDNA.parts?.includes('head_horn') && parentDNA.size >= 22.0) {
          return { ...parentDNA, size: 36.0, color: [3, 20, 48], segments: 12, turnSpeed: 0.035, reproEnergy: 720, mutationRate: 0.0 };
        }

    const m = parentDNA.mutationRate;
    const mutateVal = (val: number, delta: number, min: number, max: number) => {
      if (Math.random() < m) {
        val += (Math.random() - 0.5) * delta;
      }
      return Math.max(min, Math.min(max, val));
    };

    let newColor: [number, number, number] = [
      Math.floor(mutateVal(parentDNA.color[0], 40, 10, 255)),
      Math.floor(mutateVal(parentDNA.color[1], 40, 10, 255)),
      Math.floor(mutateVal(parentDNA.color[2], 40, 10, 255))
    ];

    let speed = mutateVal(parentDNA.speed, 0.3, 0.6, 3.2);
    let turnSpeed = mutateVal(parentDNA.turnSpeed, 0.02, 0.03, 0.18);
    let senseRadius = mutateVal(parentDNA.senseRadius, 35, 50, 260);
    let size = mutateVal(parentDNA.size, 0.8, 3.5, 9.5);
    let reproEnergy = mutateVal(parentDNA.reproEnergy, 25, 90, 240);
    let metabolism = mutateVal(parentDNA.metabolism, 0.03, 0.04, 0.3);
    let mutationRate = mutateVal(parentDNA.mutationRate, 0.03, 0.02, 0.3);
    let maxAge = mutateVal(parentDNA.maxAge, 10, 20, 140);
    let camouflage = mutateVal(parentDNA.camouflage, 0.12, 0.0, 0.95);
    let diet = mutateVal(parentDNA.diet, 0.04, 0.0, parentDNA.diet < 0.4 ? 0.35 : 1.0);
    let segments = Math.round(mutateVal(parentDNA.segments, 0.6, 3, 5));
    let poison = mutateVal(parentDNA.poison, 0.2, 0.0, 1.0);
    let poisonResist = mutateVal(parentDNA.poisonResist, 0.2, 0.0, 1.0);
    let armor = mutateVal(parentDNA.armor, 0.2, 0.0, 1.0);
    let biteForce = mutateVal(parentDNA.biteForce, 0.2, 0.0, 1.0);
    let electricShock = mutateVal(parentDNA.electricShock, 0.2, 0.0, 1.0);
    let photosynthesis = mutateVal(parentDNA.photosynthesis, 0.2, 0.0, 1.0);
    let scavengerDrive = mutateVal(parentDNA.scavengerDrive, 0.2, 0.0, 1.0);
    let rkStrategy = mutateVal(parentDNA.rkStrategy, 0.2, 0.0, 1.0);

    let parts: PartGene[] = [...(parentDNA.parts || [])];
    if (Math.random() < m) {
      const allParts: PartGene[] = [
        'prop_ribbon', 'prop_fork', 'prop_jet', 'prop_paddle',
        'head_jaw', 'head_horn', 'head_angler', 'head_beak',
        'body_spikes', 'body_fin', 'body_symbiont', 'body_ink'
      ];
      const p = allParts[Math.floor(Math.random() * allParts.length)];
      if (!parts.includes(p)) parts.push(p);
      else parts = parts.filter(x => x !== p);
    }

    let isAncient = false;
    let isCrystal = false;
    if (Math.random() < 0.002) {
      isCrystal = true;
      armor = 0.95;
      newColor = [224, 242, 254];
      camouflage = 0.8;
    } else if (Math.random() < 0.08) {
      const traitType = Math.floor(Math.random() * 12);
      if (traitType === 0) size = Math.min(17.5, size + 4.5);
      else if (traitType === 1) speed = Math.min(5.2, speed + 1.8);
      else if (traitType === 2) poison = Math.min(0.95, poison + 0.6);
      else if (traitType === 3) armor = Math.min(0.95, armor + 0.6);
      else if (traitType === 4) newColor = [245, 180, 20];
      else if (traitType === 5) electricShock = Math.min(0.95, electricShock + 0.6);
      else if (traitType === 6) senseRadius = Math.min(300, senseRadius + 90);
      else if (traitType === 7) biteForce = Math.min(0.95, biteForce + 0.6);
      else if (traitType === 8) segments = 7;
      else if (traitType === 9) camouflage = Math.min(0.92, camouflage + 0.6);
      else if (traitType === 10) turnSpeed = Math.min(0.28, turnSpeed + 0.12);
      else if (traitType === 11) photosynthesis = Math.min(0.9, photosynthesis + 0.6);
    }

    return {
      speed,
      turnSpeed,
      senseRadius,
      size,
      color: newColor,
      reproEnergy,
      metabolism,
      mutationRate,
      maxAge,
      camouflage,
      diet,
      segments,
      poison,
      poisonResist,
      armor,
      biteForce,
      electricShock,
      photosynthesis,
      scavengerDrive,
      rkStrategy,
      parts,
      isAncient,
      isCrystal
    };
  }

  layEggs(parent: Creature) {
    const isChimera = parent.type === 'chimera';
    const isK = parent.dna.rkStrategy > 0.55 || isChimera;
    const eggCount = isChimera ? 1 : isK ? (Math.random() < 0.7 ? 1 : 2) : (3 + Math.floor(Math.random() * 3));
    const eggSize = isChimera ? parent.dna.size * 0.35 : isK ? parent.dna.size * 0.45 : parent.dna.size * 0.25;
    const hatchTime = isChimera ? 14.0 : isK ? 4.0 : 6.5;

    for (let e = 0; e < eggCount; e++) {
      const offX = parent.x + (Math.random() - 0.5) * 25;
      const offY = parent.y + (Math.random() - 0.5) * 25;
      const mutatedDNA = this.mutateDNA(parent.dna);
      const mutatedBrain = new NeuralBrain(parent.brain, mutatedDNA.mutationRate);

      this.eggs.push({
        id: this.nextId++,
        type: parent.type,
        x: Math.max(20, Math.min(this.width - 20, offX)),
        y: Math.max(20, Math.min(this.height - 20, offY)),
        z: Math.max(0, Math.min(1, parent.z + (Math.random() - 0.5) * 0.05)),
        dna: mutatedDNA,
        brain: mutatedBrain,
        generation: parent.generation + 1,
        parentId: parent.id,
        size: eggSize,
        energy: isK ? 60 : 30,
        hatchTimer: 0,
        maxHatchTime: hatchTime
      });

      this.addParticle(offX, offY, 0, -0.5, '#fef08a', 2.5, 0.5, 'bubble');
    }
  }

  checkSpeciesDiscovery(c: Creature) {
    const d = c.dna;
    const isGold = d.color[0] >= 210 && d.color[1] >= 160 && d.color[2] <= 80;
    const isBlueBio = d.color[0] <= 80 && d.color[1] >= 180 && d.color[2] >= 200 && d.photosynthesis >= 0.6;

    const checks: { id: string; ok: boolean }[] = [
      { id: 'titan', ok: d.size >= 14.0 },
      { id: 'swift', ok: d.speed >= 4.5 },
      { id: 'venom', ok: d.poison >= 0.75 },
      { id: 'aegis', ok: d.armor >= 0.8 },
      { id: 'elder', ok: d.maxAge >= 100 },
      { id: 'reaper', ok: c.kills >= 8 },
      { id: 'photon', ok: d.photosynthesis >= 0.75 },
      { id: 'aurum', ok: isGold },
      { id: 'brood', ok: d.rkStrategy <= 0.15 },
      { id: 'phantom', ok: d.camouflage >= 0.75 },
      { id: 'dynamo', ok: d.electricShock >= 0.75 },
      { id: 'abyss_eye', ok: d.senseRadius >= 260 },
      { id: 'needle_jaw', ok: d.biteForce >= 0.85 },
      { id: 'crimson_beast', ok: d.diet >= 0.7 && d.size >= 11.0 },
      { id: 'crawler', ok: d.scavengerDrive >= 0.6 && d.armor >= 0.7 },
      { id: 'siren', ok: d.turnSpeed >= 0.22 },
      { id: 'leviathan', ok: d.segments >= 7 && d.size >= 10.0 },
      { id: 'biolume', ok: isBlueBio }
    ];

    for (const item of checks) {
      if (item.ok) {
        if (!this.discoveredSpecies.includes(item.id)) {
          this.discoveredSpecies.push(item.id);
          const catalogItem = SPECIES_CATALOG.find(x => x.id === item.id);
          this.recentDiscovery = catalogItem ? catalogItem.name : item.id;
          this.discoveryTimer = 5.0;
          this.saveCatalogToStorage();
        }
        this.latestMutant = c;
        this.mutantAlertTimer = 16.0;
      }
    }
  }

  saveCatalogToStorage() {
    try {
      localStorage.setItem('biocosmos_catalog', JSON.stringify(this.discoveredSpecies));
    } catch (_) {}
  }

  loadCatalogFromStorage() {
    try {
      const data = localStorage.getItem('biocosmos_catalog');
      if (data) {
        const parsed = JSON.parse(data);
        if (Array.isArray(parsed)) this.discoveredSpecies = parsed;
      }
    } catch (_) {}
  }

  saveDnaBankToStorage() {
    try {
      localStorage.setItem('biocosmos_dnabank', JSON.stringify(this.dnaBank));
    } catch (_) {}
  }

  loadDnaBankFromStorage() {
    try {
      const data = localStorage.getItem('biocosmos_dnabank');
      if (data) {
        const parsed = JSON.parse(data);
        if (Array.isArray(parsed)) this.dnaBank = parsed;
      }
    } catch (_) {}
  }

  exportUrlHash(): string {
    const compact = {
      t: Math.round(this.totalTime),
      g: this.maxGen,
      b: this.dnaBank.slice(0, 3).map(s => ({ n: s.name, t: s.type, d: s.dna, g: s.gen }))
    };
    return encodeURIComponent(btoa(JSON.stringify(compact)));
  }

  importUrlHash(hash: string): boolean {
    try {
      const raw = atob(decodeURIComponent(hash.replace('#', '')));
      const d = JSON.parse(raw);
      if (d && d.b && Array.isArray(d.b)) {
        this.dnaBank = d.b.map((x: any) => ({ name: x.n, type: x.t, dna: x.d, gen: x.g }));
        this.saveDnaBankToStorage();
        return true;
      }
    } catch (_) {}
    return false;
  }

  saveWorldState(slot = 1): boolean {
    try {
      const state = {
        savedAt: new Date().toLocaleTimeString().slice(0, 5),
        totalTime: this.totalTime,
        maxGen: this.maxGen,
        creatures: this.creatures.map(c => ({
          type: c.type, x: c.x, y: c.y, z: c.z, energy: c.energy, maxEnergy: c.maxEnergy,
          age: c.age, stage: c.stage, growth: c.growth, generation: c.generation,
          kills: c.kills, children: c.children, dna: c.dna
        })),
        plants: this.plants.map(p => ({
          x: p.x, y: p.y, z: p.z, energy: p.energy, size: p.size, maxSize: p.maxSize, type: p.type
        }))
      };
      localStorage.setItem(`biocosmos_slot_${slot}`, JSON.stringify(state));
      localStorage.setItem('biocosmos_last_slot', slot.toString());
      return true;
    } catch (_) {
      return false;
    }
  }

  loadWorldState(slot = 1): boolean {
    try {
      const raw = localStorage.getItem(`biocosmos_slot_${slot}`) || (slot === 1 ? localStorage.getItem('biocosmos_world_state') : null);
      if (!raw) return false;
      const state = JSON.parse(raw);
      this.initWorld();
      this.creatures = [];
      this.plants = [];
      this.totalTime = state.totalTime || 0;
      this.maxGen = state.maxGen || 1;

      for (const p of state.plants) {
        this.plants.push({
          id: this.nextId++, x: p.x, y: p.y, z: p.z ?? (p.y / this.height), energy: p.energy, size: p.size, maxSize: p.maxSize, type: p.type
        });
      }
      for (const sc of state.creatures) {
        const c = this.spawnCreature(sc.type, sc.x, sc.y, sc.generation, sc.dna, undefined, sc.stage, null, sc.z);
        c.energy = sc.energy;
        c.maxEnergy = sc.maxEnergy;
        c.age = sc.age;
        c.growth = sc.growth;
        c.kills = sc.kills || 0;
        c.children = sc.children || 0;
      }
      const legacyCarns = this.creatures.filter(c => c.dna.diet > 0.55 && c.type !== 'chimera' && c.type !== 'anglerfish');
      if (legacyCarns.length > 4) {
        for (let i = 4; i < legacyCarns.length; i++) {
          legacyCarns[i].isDead = true;
        }
        this.creatures = this.creatures.filter(c => !c.isDead);
      }

      this.obstacles = [];
      localStorage.setItem('biocosmos_last_slot', slot.toString());
      return true;
    } catch (_) {
      return false;
    }
  }

  getSlotSummary(slot: number): string {
    try {
      const raw = localStorage.getItem(`biocosmos_slot_${slot}`) || (slot === 1 ? localStorage.getItem('biocosmos_world_state') : null);
      if (!raw) return 'Empty Slot';
      const d = JSON.parse(raw);
      return `Gen.${d.maxGen || 1} (${d.creatures?.length || 0} orgs) ${d.savedAt || ''}`;
    } catch (_) {
      return 'Empty Slot';
    }
  }

  spawnCreature(type: CreatureType, x: number, y: number, gen: number, parentDNA?: DNA, parentBrain?: NeuralBrain, stage: LifeStage = 'larva', parentId: number | null = null, initialZ?: number): Creature {
    const dna = parentDNA ? this.mutateDNA(parentDNA) : this.createDefaultDNA(type);
    const brain = new NeuralBrain(parentBrain, dna.mutationRate);

    let resolvedType = type;
    if (parentDNA) {
      if (type === 'manta' || type === 'cleaner_shrimp' || type === 'chimera' || type === 'anglerfish' || type === 'nautilus') {
        resolvedType = type;
      } else if (dna.photosynthesis > 0.55) resolvedType = 'solar_jelly';
      else if (dna.scavengerDrive > 0.55) resolvedType = 'scavenger';
      else if (dna.diet > 0.65) resolvedType = 'carnivore';
      else resolvedType = 'herbivore';
    }

    let spawnZ = initialZ !== undefined ? initialZ : (
      resolvedType === 'solar_jelly' ? 0.05 + Math.random() * 0.25 :
      resolvedType === 'scavenger' ? 0.8 + Math.random() * 0.18 :
      resolvedType === 'chimera' ? 0.6 + Math.random() * 0.35 :
      resolvedType === 'manta' ? 0.25 + Math.random() * 0.4 :
      resolvedType === 'cleaner_shrimp' ? 0.4 + Math.random() * 0.3 :
      resolvedType === 'anglerfish' ? 0.88 :
      resolvedType === 'nautilus' ? 0.45 + Math.random() * 0.35 :
      resolvedType === 'carnivore' ? 0.35 + Math.random() * 0.5 :
      0.2 + Math.random() * 0.45
    );

    const ang = Math.random() * Math.PI * 2;
    const isAdult = stage === 'adult';
    const growth = isAdult ? 1.0 : 0.1;
    const currentSize = dna.size * (0.35 + 0.65 * growth);
    const maxE = currentSize * 22 + 40;

    const nodes: TailNode[] = [];
    const segCount = dna.segments || 4;
    const segDist = currentSize * 0.75;
    for (let i = 0; i < segCount; i++) {
      nodes.push({
        x: x - Math.cos(ang) * (i * segDist),
        y: y - Math.sin(ang) * (i * segDist)
      });
    }

    const c: Creature = {
      id: this.nextId++,
      type: resolvedType,
      x: Math.max(20, Math.min(this.width - 20, x)),
      y: Math.max(20, Math.min(this.height - 20, y)),
      z: Math.max(0, Math.min(1, spawnZ)),
      vx: Math.cos(ang) * dna.speed,
      vy: Math.sin(ang) * dna.speed,
      vz: 0,
      angle: ang,
      energy: maxE * 0.7,
      maxEnergy: maxE,
      age: 0,
      stage,
      growth,
      generation: gen,
      parentId,
      dna,
      brain,
      children: 0,
      kills: 0,
      plantsEaten: 0,
      isDead: false,
      tailNodes: nodes,
      finPhase: Math.random() * 20,
      pulsePhase: Math.random() * Math.PI * 2,
      legPhase: Math.random() * 20,
      sprintTimer: 0,
      stunTimer: 0,
      poisonTimer: 0,
      electricCooldown: 0,
      reproCooldown: resolvedType === 'chimera' ? 45.0 : 8.0,
      warningSignal: 0,
      currentAction: 'idle',
      internalDrive: {
        hunger: 0.2,
        fatigue: 0.0,
        reproductiveUrge: 0.0,
        socialNeed: 0.5
      },
      biteAnimTimer: 0,
      lungeTimer: 0,
      shellRetractTimer: 0,
      anglerLurePhase: Math.random() * Math.PI * 2
    };

    this.creatures.push(c);
    this.maxGen = Math.max(this.maxGen, gen);
    return c;
  }

  spawnPlant(x: number, y: number, type: Plant['type'] = 'algae', z?: number) {
    if (type === 'meat_remains' || type === 'whale_fall') {
      let carcassCount = 0;
      for (let i = 0; i < this.plants.length; i++) {
        const pt = this.plants[i].type;
        if (pt === 'meat_remains' || pt === 'whale_fall') {
          carcassCount++;
        }
      }
      if (carcassCount >= 5) return;
    }

    if (this.plants.length >= 200 && type !== 'whale_fall') return;
    let energy = 28 + Math.random() * 18;
    let size = 2.5;
    let maxSize = 5.0 + Math.random() * 2.5;
    let pZ = z !== undefined ? z : 0.2;

    if (type === 'fruit') {
      energy = 55 + Math.random() * 20;
      maxSize = 6.5;
      pZ = z ?? (0.1 + Math.random() * 0.25);
    } else if (type === 'meat_remains') {
      energy = 75 + Math.random() * 35;
      size = 6.5;
      maxSize = 11.0;
      pZ = z ?? Math.min(1.0, (y / this.height) * 0.6 + 0.3);
    } else if (type === 'whale_fall') {
      energy = 950;
      size = 48.0;
      maxSize = 56.0;
      pZ = z ?? 0.3;
    } else if (type === 'marine_snow') {
      energy = 16 + Math.random() * 12;
      size = 1.4;
      maxSize = 2.2;
      pZ = z ?? (0.5 + Math.random() * 0.45);
    } else if (type === 'deep_coral') {
      energy = 38 + Math.random() * 18;
      size = 3.5;
      maxSize = 7.5;
      pZ = z ?? (0.85 + Math.random() * 0.14);
    } else if (type === 'biolume_plankton') {
      energy = 22 + Math.random() * 14;
      size = 2.0;
      maxSize = 4.2;
      pZ = z ?? (0.15 + Math.random() * 0.35);
    } else if (type === 'hydro_spore') {
      energy = 50 + Math.random() * 25;
      size = 3.0;
      maxSize = 5.8;
      pZ = z ?? (0.75 + Math.random() * 0.2);
    } else if (type === 'bacteria_mat') {
      energy = 35 + this.deepNutrients * 12;
      size = 3.8;
      maxSize = 7.0;
      pZ = z ?? (0.88 + Math.random() * 0.1);
    } else {
      pZ = z ?? Math.min(0.35, (y / this.height) * 0.35 + Math.random() * 0.05);
    }

    this.plants.push({
      id: this.nextId++,
      x: Math.max(15, Math.min(this.width - 15, x)),
      y: Math.max(15, Math.min(this.height - 15, y)),
      z: Math.max(0, Math.min(1, pZ)),
      energy,
      size,
      maxSize,
      type,
      stage: type === 'whale_fall' ? 'flesh' : undefined,
      stageTimer: type === 'whale_fall' ? 0 : undefined
    });
  }

  addParticle(x: number, y: number, vx: number, vy: number, color: string, size: number, life: number, type: 'spark' | 'smoke' | 'shockwave' | 'bubble' | 'poison_cloud' | 'electric_arc' = 'spark') {
    if (this.particles.length < 400) {
      this.particles.push({ x, y, vx, vy, color, size, life, maxLife: life, type });
    }
  }

  addShockwave(x: number, y: number, maxRadius: number, color: string) {
    this.shockwaves.push({
      x,
      y,
      radius: 5,
      maxRadius,
      color,
      life: 1.0
    });
  }

  update(rawDt: number) {
    const dt = Math.min(rawDt, 0.08) * this.timeScale;
    if (dt <= 0) return;
    this.totalTime += dt;

    this.creatureGrid.clear();
    for (let i = 0; i < this.creatures.length; i++) {
      this.creatureGrid.insert(this.creatures[i]);
    }
    this.plantGrid.clear();
    for (let i = 0; i < this.plants.length; i++) {
      this.plantGrid.insert(this.plants[i]);
    }
    const cs = this.colossalShadow;
    cs.phase += dt * 0.55;
    cs.turnTimer -= dt;

    if (cs.turnTimer <= 0) {
      cs.turnTimer = 6.0 + Math.random() * 8.0;
      const marginX = this.width * 0.18;
      const marginY = this.height * 0.22;
      if (cs.x < marginX || cs.x > this.width - marginX || cs.y < marginY || cs.y > this.height - marginY) {
        cs.targetAngle = Math.atan2(this.height * 0.58 - cs.y, this.width * 0.5 - cs.x) + (Math.random() - 0.5) * 0.4;
      } else {
        cs.targetAngle += (Math.random() - 0.5) * 1.1;
      }
    }

    let angleDiff = cs.targetAngle - cs.angle;
    while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
    while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
    cs.angle += angleDiff * Math.min(1.0, dt * 0.35);

    cs.z = 0.75 + Math.sin(cs.phase * 0.25) * 0.15;
    const currentSpeed = cs.speed * (0.85 + Math.sin(cs.phase * 0.4) * 0.15);
    cs.vx = Math.cos(cs.angle) * currentSpeed;
    cs.vy = Math.sin(cs.angle) * currentSpeed;

    cs.x += cs.vx * dt;
    cs.y += cs.vy * dt;

    if (cs.x < -cs.length) cs.x = this.width + cs.length * 0.5;
    if (cs.x > this.width + cs.length) cs.x = -cs.length * 0.5;
    if (cs.y < this.height * 0.25) cs.y = this.height * 0.25;
    if (cs.y > this.height - 80) cs.y = this.height - 80;

    if (cs.nodes.length === 0) {
      const nodeCount = 15;
      for (let n = 0; n < nodeCount; n++) cs.nodes.push({ x: cs.x, y: cs.y });
    }
    cs.nodes[0] = { x: cs.x, y: cs.y };
    const segSpacing = 58;
    for (let n = 1; n < cs.nodes.length; n++) {
      const prev = cs.nodes[n - 1];
      const curr = cs.nodes[n];
      const dx = curr.x - prev.x;
      const dy = curr.y - prev.y;
      const d = Math.hypot(dx, dy) || 0.001;
      curr.x = prev.x + (dx / d) * segSpacing;
      curr.y = prev.y + (dy / d) * segSpacing;
    }
    for (let v = 0; v < this.hydrothermalVents.length; v++) {
      const vent = this.hydrothermalVents[v];
      vent.bubbleTimer -= dt;

      if (vent.bubbleTimer <= 0) {
        vent.bubbleTimer = 0.3 + Math.random() * 0.4;
        const emitX = vent.x + (Math.random() - 0.5) * (vent.craterWidth * 0.6);
        const emitY = vent.y - vent.height + 6;
        const bubbleVx = (Math.random() - 0.5) * 0.2 + Math.sin(this.totalTime * 1.2) * 0.15;
        const bubbleVy = -0.55 - Math.random() * 0.45;
        const bubbleColor = Math.random() < 0.4 ? 'rgba(56, 189, 248, 0.45)' : 'rgba(251, 191, 36, 0.4)';
        this.addParticle(emitX, emitY, bubbleVx, bubbleVy, bubbleColor, 1.2 + Math.random() * 1.4, 4.0 + Math.random() * 3.0, 'bubble');
        if (Math.random() < 0.35) {
          const hazeVx = (Math.random() - 0.5) * 0.25;
          const hazeVy = -0.35 - Math.random() * 0.3;
          this.addParticle(emitX, emitY, hazeVx, hazeVy, 'rgba(15, 23, 42, 0.25)', 3.0 + Math.random() * 2.5, 3.0 + Math.random() * 2.0, 'smoke');
        }
      }
    }
    for (let i = this.detritus.length - 1; i >= 0; i--) {
      const d = this.detritus[i];
      const flow = this.getFlowVector(d.x, d.y, d.z);
      d.vx = d.vx * 0.94 + (Math.random() - 0.5) * 0.08;
      d.vy = d.vy * 0.94 + (Math.random() - 0.5) * 0.08;

      d.x += (d.vx + flow.u * 0.45) * dt * 60;
      d.y += (d.vy + flow.v * 0.45) * dt * 60;
      d.z += (d.vz + flow.w) * dt * 60;
      d.age += dt;
      if (d.x < 0) d.x += this.width;
      if (d.x > this.width) d.x -= this.width;

      if (d.z >= 0.96) {
        this.deepNutrients = Math.min(8.0, this.deepNutrients + d.mass * 0.03);
      }

      if (d.age > 50 || d.z >= 1.0 || d.y < 0 || d.y > this.height) {
        this.detritus.splice(i, 1);
      }
    }
    if (this.deepNutrients > 1.6 && Math.random() < 0.04 * dt * 60) {
      const upX = Math.random() * this.width;
      const flow = this.getFlowVector(upX, this.height * 0.5, 0.5);
      if (flow.w < 0) {
        this.spawnPlant(upX, Math.random() * (this.height * 0.32), 'biolume_plankton', 0.1 + Math.random() * 0.15);
        this.deepNutrients = Math.max(0.5, this.deepNutrients - 0.06);
      }
    }
    if (this.deepNutrients > 1.8 && this.plants.length < 480 && Math.random() < 0.08 * dt * 60) {
      const bx = Math.random() * this.width;
      const by = this.height * 0.72 + Math.random() * (this.height * 0.25);
      this.spawnPlant(bx, by, 'bacteria_mat', 0.88 + Math.random() * 0.1);
      this.deepNutrients = Math.max(0.5, this.deepNutrients - 0.3);
    }

    for (const kelp of this.kelps) {
      const segLen = kelp.height / kelp.segmentCount;
      for (let s = 1; s <= kelp.segmentCount; s++) {
        const sway = Math.sin(this.totalTime * 1.4 + kelp.phase + s * 0.4) * (s * 4.5);
        kelp.nodes[s].x = kelp.baseX + sway;
        kelp.nodes[s].y = kelp.baseY - s * segLen;
      }
      if (Math.random() < 0.003 && this.plants.length < 450) {
        this.spawnPlant(kelp.baseX + (Math.random() - 0.5) * 40, kelp.baseY - Math.random() * kelp.height * 0.7, 'algae');
      }
    }

    this.naturalSpawnTimer += dt;
    if (this.naturalSpawnTimer >= 12.0) {
      this.naturalSpawnTimer = 0;
      const leviathans = this.creatures.filter(c => c.type === 'chimera');
      if (leviathans.length === 0 && Math.random() < 0.18) {
        const edgeX = Math.random() < 0.5 ? 40 : this.width - 40;
        const edgeY = Math.random() * this.height;
        this.spawnCreature('chimera', edgeX, edgeY, 1, undefined, undefined, 'adult');
        this.addShockwave(edgeX, edgeY, 160, 'rgba(56, 189, 248, 0.7)');
      }
      const mantas = this.creatures.filter(c => c.type === 'manta');
      if (mantas.length < 2 && Math.random() < 0.35) {
        const edgeX = Math.random() < 0.5 ? 50 : this.width - 50;
        this.spawnCreature('manta', edgeX, this.height * (0.2 + Math.random() * 0.6), 1, undefined, undefined, 'adult');
      }
      const shrimps = this.creatures.filter(c => c.type === 'cleaner_shrimp');
      if (shrimps.length < 10 && Math.random() < 0.45) {
        const coralObs = this.obstacles.filter(o => o.type === 'coral_reef');
        const targetObs = coralObs.length > 0 ? coralObs[Math.floor(Math.random() * coralObs.length)] : null;
        const sx = targetObs ? targetObs.x + (Math.random() - 0.5) * 90 : Math.random() * this.width;
        const sy = targetObs ? targetObs.y + (Math.random() - 0.5) * 90 : Math.random() * this.height;
        this.spawnCreature('cleaner_shrimp', sx, sy, 1, undefined, undefined, 'adult');
      }
    }

    this.historyTimer += dt;
    if (this.historyTimer >= 0.8) {
      this.historyTimer = 0;
      let herbs = 0, carns = 0;
      for (const c of this.creatures) {
        if (c.dna.diet > 0.6) carns++;
        else herbs++;
      }
      this.historyHerb.push(herbs);
      this.historyCarn.push(carns);
      this.historyPlant.push(this.plants.length);

      if (this.historyHerb.length > 90) {
        this.historyHerb.shift();
        this.historyCarn.shift();
        this.historyPlant.shift();
      }
    }

    for (let i = this.eggs.length - 1; i >= 0; i--) {
      const egg = this.eggs[i];
      egg.hatchTimer += dt;

      if (egg.hatchTimer >= egg.maxHatchTime) {
        const c = this.spawnCreature(egg.type, egg.x, egg.y, egg.generation, egg.dna, egg.brain, 'larva', egg.parentId, egg.z);
        c.energy = egg.energy;
        this.addShockwave(egg.x, egg.y, 25, 'rgba(254, 240, 138, 0.6)');
        this.eggs.splice(i, 1);
      }
    }

    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.x += p.vx * dt * 60;
      p.y += p.vy * dt * 60;
      p.life -= dt;
      if (p.life <= 0) this.particles.splice(i, 1);
    }
    for (let i = this.shockwaves.length - 1; i >= 0; i--) {
      const sw = this.shockwaves[i];
      sw.radius += (sw.maxRadius - sw.radius) * dt * 9;
      sw.life -= dt * 2.2;
      if (sw.life <= 0) this.shockwaves.splice(i, 1);
    }

    if (this.plants.length < 150 && Math.random() < 0.22) {
      const sy = Math.random() * this.height;
      const sx = Math.random() * this.width;
      let pType: Plant['type'] = 'algae';
      if (sy < this.height * 0.35) {
        pType = Math.random() < 0.65 ? 'biolume_plankton' : (Math.random() < 0.2 ? 'fruit' : 'marine_snow');
      } else if (sy < this.height * 0.7) {
        pType = Math.random() < 0.5 ? 'biolume_plankton' : (Math.random() < 0.25 ? 'algae' : 'marine_snow');
      } else {
        pType = Math.random() < 0.4 ? 'deep_coral' : (Math.random() < 0.35 ? 'hydro_spore' : 'marine_snow');
      }
      this.spawnPlant(sx, sy, pType);
    }
    for (const p of this.plants) {
      if (p.size < p.maxSize) p.size += dt * 0.5;

      if (p.type === 'whale_fall') {
        p.stageTimer = (p.stageTimer || 0) + dt;
        const targetFloorY = this.height - 40 - ((p.id * 19) % 30);
        if (p.y < targetFloorY) {
          p.y += 18.0 * dt;
          p.z = Math.min(0.98, (p.z || 0.3) + 0.035 * dt);
        }
        if (p.stage === 'flesh' && (p.energy <= 240 || p.stageTimer >= 180)) {
          p.stage = 'reef';
          p.stageTimer = 0;
          p.size = 50.0;
          p.maxSize = 50.0;
          p.energy = 450;
        }
        else if (p.stage === 'reef') {
          if (Math.random() < 0.025 * dt * 60 && this.plants.length < 500) {
            this.spawnPlant(p.x + (Math.random() - 0.5) * 90, p.y + (Math.random() - 0.5) * 45, 'biolume_plankton', p.z);
          }
          if (p.stageTimer >= 360) {
            p.stage = 'mineral';
            p.stageTimer = 0;
            p.size = 46.0;
          }
        }
      }

      if (p.type === 'marine_snow') {
        const flow = this.getFlowVector(p.x, p.y, p.z || 0.5);
        p.y += (12 + (p.id % 7)) * dt;
        p.x += (flow.u * 14 + Math.sin(this.totalTime * 1.2 + p.id) * 6) * dt;

        if (p.x < 0) p.x += this.width;
        if (p.x > this.width) p.x -= this.width;
        if (p.y >= this.height - 15) {
          p.y = 20 + Math.random() * 40;
          p.x = Math.random() * this.width;
        }
      }
    }

    let currentJellyCount = 0;
    for (const c of this.creatures) {
      if (c.type === 'solar_jelly') currentJellyCount++;
    }
    const solarShadingFactor = Math.max(0.05, 1.0 - (currentJellyCount / 15));
    const totalPop = this.creatures.length;
    const overpopFactor = totalPop > 200 ? (totalPop / 200) : 1.0;

    for (let i = this.creatures.length - 1; i >= 0; i--) {
      const c = this.creatures[i];
      if (!c || c.isDead) continue;

      c.age += dt;
      c.finPhase += dt * (c.dna.speed * 2.2);
      c.pulsePhase += dt * 1.5;
      c.legPhase += dt * (c.dna.speed * 4.0);

      if (c.sprintTimer > 0) c.sprintTimer -= dt;
      if (c.electricCooldown > 0) c.electricCooldown -= dt;
      if (c.reproCooldown > 0) c.reproCooldown -= dt;
      if (c.biteAnimTimer && c.biteAnimTimer > 0) c.biteAnimTimer -= dt;
      if (c.lungeTimer && c.lungeTimer > 0) c.lungeTimer -= dt;
      if (c.shellRetractTimer && c.shellRetractTimer > 0) c.shellRetractTimer -= dt;

      if (c.stage === 'larva') {
        c.growth += dt * 0.12;
        if (c.growth >= 1.0) {
          c.growth = 1.0;
          c.stage = 'adult';
          this.addParticle(c.x, c.y, 0, -1, '#38bdf8', 3, 0.6, 'bubble');
        }
      }

      const currentSize = c.dna.size * (0.35 + 0.65 * c.growth);
      c.maxEnergy = currentSize * 22 + 40;
      if (Math.random() < 0.035 * dt * 60) {
        this.spawnDetritus(c.x, c.y, c.z, 0.3 + currentSize * 0.08, 'feces');
      }

      let inKelp = false;
      for (const kelp of this.kelps) {
        if (Math.abs(c.x - kelp.baseX) < 45 && c.y >= kelp.baseY - kelp.height && c.y <= kelp.baseY + 20) {
          inKelp = true;
          break;
        }
      }
      const isHiddenInKelp = inKelp && currentSize < 8.5;

      if (c.stunTimer > 0) {
        c.stunTimer -= dt;
        continue;
      }

      if (c.poisonTimer > 0) {
        c.poisonTimer -= dt;
        const poisonDmg = (1.0 - c.dna.poisonResist) * 22 * dt;
        c.energy -= poisonDmg;
        this.addParticle(c.x, c.y, 0, -1, '#c084fc', 2, 0.4, 'poison_cloud');
      }
      if (c.dna.photosynthesis > 0.2) {
        const gainedSolar = c.dna.photosynthesis * 8.5 * solarShadingFactor * this.getLightIntensity(c.z) * dt;
        c.energy = Math.min(c.maxEnergy, c.energy + gainedSolar);
      }
      c.internalDrive.hunger = Math.max(0, Math.min(1, 1 - (c.energy / c.maxEnergy)));
      c.internalDrive.reproductiveUrge = (c.stage === 'adult' && c.reproCooldown <= 0 && c.energy >= c.dna.reproEnergy * 0.8)
        ? Math.min(1, c.energy / c.dna.reproEnergy)
        : 0;

      if (c.currentAction === 'rest') {
        c.internalDrive.fatigue = Math.max(0, c.internalDrive.fatigue - dt * 0.12);
        if (c.internalDrive.fatigue <= 0.15 || c.internalDrive.hunger > 0.65) {
          c.currentAction = 'idle';
        }
      } else {
        c.internalDrive.fatigue = Math.min(1, c.internalDrive.fatigue + dt * (c.sprintTimer > 0 ? 0.08 : 0.022));
        if (c.internalDrive.hunger > 0.6) {
          c.currentAction = 'forage';
        } else if (c.internalDrive.fatigue > 0.85 && c.internalDrive.hunger < 0.45) {
          c.currentAction = 'rest';
        } else if (c.internalDrive.reproductiveUrge > 0.65) {
          c.currentAction = 'court';
        } else {
          c.currentAction = 'idle';
        }
      }

      const speedCost = (c.dna.speed * (c.sprintTimer > 0 ? 1.35 : 1.0)) ** 2 * 0.005;
      const sizeCost = (currentSize ** 1.2) * 0.007;
      const restingFactor = c.currentAction === 'rest' ? 0.35 : 1.0;
      const totalCost = (c.dna.metabolism + speedCost + sizeCost) * dt * 7.5 * overpopFactor * restingFactor;
      c.energy -= totalCost;

      if (c.energy <= 0 || c.age >= c.dna.maxAge) {
        c.isDead = true;
        this.spawnDetritus(c.x, c.y, c.z, 2.5 + currentSize * 0.3, 'carcass');
        if (c.type === 'chimera' || c.type === 'manta' || currentSize >= 15.0) {
          this.spawnPlant(c.x, c.y, 'whale_fall', 0.95);
          this.addShockwave(c.x, c.y, 100, 'rgba(56, 189, 248, 0.6)');
          for (let sn = 0; sn < 8; sn++) {
            this.spawnPlant(c.x + (Math.random() - 0.5) * 60, c.y + (Math.random() - 0.5) * 30, 'marine_snow', 0.85);
            this.spawnDetritus(c.x + (Math.random() - 0.5) * 50, c.y + (Math.random() - 0.5) * 30, c.z, 1.8, 'carcass');
          }
        } else {
          this.spawnPlant(c.x, c.y, 'meat_remains', c.z);
          const snowCount = 3 + Math.floor(Math.random() * 3);
          for (let sn = 0; sn < snowCount; sn++) {
            this.spawnPlant(c.x + (Math.random() - 0.5) * 40, c.y + (Math.random() - 0.5) * 20, 'marine_snow', c.z);
          }
        }
        for (let k = 0; k < 6; k++) {
          this.addParticle(c.x, c.y, (Math.random() - 0.5) * 2, (Math.random() - 0.5) * 2, `rgb(${c.dna.color.join(',')})`, 3, 0.8);
        }
        continue;
      }

      const nearbyCreatures = this.creatureGrid.query(c.x, c.y, c.dna.senseRadius);
      const nearbyPlants = this.plantGrid.query(c.x, c.y, c.dna.senseRadius);
      if (c.type === 'anglerfish') {
        c.anglerLurePhase = (c.anglerLurePhase || 0) + dt * 2.2;
        c.angle = Math.cos(c.angle) >= 0 ? 0 : Math.PI;

        const facingRight = Math.cos(c.angle) >= 0;
        const escaDist = currentSize * 2.2;
        const escaX = c.x + (facingRight ? escaDist : -escaDist);
        const escaY = c.y - currentSize * 0.4;

        for (const prey of nearbyCreatures) {
          if (prey.id !== c.id && !prey.isDead && (prey.type === 'herbivore' || prey.type === 'scavenger' || prey.stage === 'larva')) {
            const distToEsca = Math.hypot(prey.x - escaX, prey.y - escaY);
            const mouthX = c.x + (facingRight ? currentSize * 1.2 : -currentSize * 1.2);
            const distToMouth = Math.hypot(prey.x - mouthX, prey.y - c.y);
            if (distToEsca < 220) {
              const lureAngle = Math.atan2(escaY - prey.y, escaX - prey.x);
              let diff = lureAngle - prey.angle;
              while (diff < -Math.PI) diff += Math.PI * 2;
              while (diff > Math.PI) diff -= Math.PI * 2;
              prey.angle += diff * Math.min(1.0, dt * 5.0);

              const pullForce = ((220 - distToEsca) / 220) * 1.6 * dt * 60;
              prey.x += Math.cos(lureAngle) * pullForce;
              prey.y += Math.sin(lureAngle) * pullForce;
            }
            if (distToMouth < currentSize * 1.8 || distToEsca < currentSize * 1.4) {
              c.biteAnimTimer = 0.6;
              const gainedEnergy = prey.energy * 0.95 + 95;
              c.energy = Math.min(c.maxEnergy, c.energy + gainedEnergy);
              c.kills++;
              c.brain.applyHebb(0.08);
              prey.isDead = true;

              this.recentPredations.push({ x: prey.x, y: prey.y, time: this.totalTime });
              this.spawnDetritus(prey.x, prey.y, prey.z, 2.0, 'carcass');
              this.addShockwave(c.x, c.y, 80, 'rgba(34, 211, 238, 0.8)');
              for (let k = 0; k < 8; k++) {
                this.addParticle(prey.x, prey.y, (Math.random() - 0.5) * 4, (Math.random() - 0.5) * 4, '#f43f5e', 3.5, 0.6);
              }
              break;
            }
          }
        }
      }
      if (nearbyCreatures.length > 4 && c.type !== 'chimera') {
        let avgX = 0, avgY = 0;
        for (let k = 0; k < nearbyCreatures.length; k++) {
          avgX += nearbyCreatures[k].x;
          avgY += nearbyCreatures[k].y;
        }
        avgX /= nearbyCreatures.length;
        avgY /= nearbyCreatures.length;
        const pushDx = c.x - avgX;
        const pushDy = c.y - avgY;
        const pDist = Math.hypot(pushDx, pushDy) || 0.001;
        const burstForce = Math.min(8.5, (nearbyCreatures.length - 3) * 0.75);
        c.x += (pushDx / pDist) * burstForce;
        c.y += (pushDy / pDist) * burstForce;
        c.angle = Math.atan2(pushDy, pushDx) + (Math.sin(c.id * 9) * 0.4);
      }

      let closestPlantAngle = 0, closestPlantDist = 1.0;
      let closestThreatAngle = 0, closestThreatDist = 1.0;
      let closestPreyAngle = 0, closestPreyDist = 1.0;
      let closestObstacleDist = 1.0;

      let minPD = Infinity;
      for (const p of nearbyPlants) {
        const d = Math.hypot(p.x - c.x, p.y - c.y);
        if (d < minPD) {
          minPD = d;
          let pAng = Math.atan2(p.y - c.y, p.x - c.x) - c.angle;
          while (pAng < -Math.PI) pAng += Math.PI * 2;
          while (pAng > Math.PI) pAng -= Math.PI * 2;
          closestPlantAngle = pAng / Math.PI;
          closestPlantDist = d / c.dna.senseRadius;

          const isScavengerFood = p.type === 'meat_remains' || p.type === 'whale_fall' || p.type === 'marine_snow' || p.type === 'bacteria_mat';
          const canEat = c.dna.photosynthesis < 0.6 && (c.type !== 'scavenger' || isScavengerFood || c.energy < c.maxEnergy * 0.25);
          const eatRadius = c.type === 'manta' ? currentSize * 1.8 + p.size : currentSize + p.size + 3;
          if (d < eatRadius && canEat) {
            if (p.type === 'whale_fall') {
              if (p.stage === 'flesh') {
                const bite = Math.min(p.energy, 24);
                p.energy -= bite;
                c.energy = Math.min(c.maxEnergy, c.energy + bite * (c.type === 'scavenger' ? 1.4 : 1.1));
                c.plantsEaten++;
                c.brain.applyHebb(0.04);
                this.addParticle(p.x, p.y, (Math.random() - 0.5) * 3, -1, '#f43f5e', 2.5, 0.5);
              } else if (p.stage === 'reef') {
                c.energy = Math.min(c.maxEnergy, c.energy + 12 * dt);
                c.plantsEaten++;
                c.brain.applyHebb(0.02);
                this.addParticle(p.x, p.y, (Math.random() - 0.5) * 2, -0.8, '#38bdf8', 1.8, 0.4);
              }
            } else {
              const energyGain = (c.type === 'scavenger' && !isScavengerFood) ? p.energy * 0.3 : p.energy * (c.type === 'scavenger' && p.type === 'meat_remains' ? 1.5 : 1.0);
              c.energy = Math.min(c.maxEnergy, c.energy + energyGain);
              c.plantsEaten++;
              c.brain.applyHebb(0.04);
              this.addParticle(p.x, p.y, 0, -1, p.type === 'meat_remains' ? '#f59e0b' : '#4ade80', 2.5, 0.4);
              const pIdx = this.plants.indexOf(p);
              if (pIdx !== -1) this.plants.splice(pIdx, 1);
            }
          }
        }
      }

      let minTD = Infinity, minPrD = Infinity;
      const isCarnivore = c.dna.diet > 0.6;
      const isStarving = c.energy < c.maxEnergy * 0.35;
      const isLeviathan = c.type === 'chimera';
      if (isLeviathan && (!c.lungeTimer || c.lungeTimer <= 0)) {
        let nearbyPreyCount = 0;
        let clusterCenterX = 0;
        let clusterCenterY = 0;
        for (const prey of nearbyCreatures) {
          if (prey.id !== c.id && !prey.isDead && (prey.type === 'herbivore' || prey.type === 'scavenger' || prey.stage === 'larva')) {
            nearbyPreyCount++;
            clusterCenterX += prey.x;
            clusterCenterY += prey.y;
          }
        }
        if (nearbyPreyCount >= 3) {
          c.lungeTimer = 1.6;
          c.biteAnimTimer = 1.6;
          clusterCenterX /= nearbyPreyCount;
          clusterCenterY /= nearbyPreyCount;
          c.angle = Math.atan2(clusterCenterY - c.y, clusterCenterX - c.x);
          this.addShockwave(c.x, c.y, 140, 'rgba(6, 182, 212, 0.75)');
        }
      }

      for (const other of nearbyCreatures) {
        if (other.id === c.id || other.isDead) continue;
        const d = Math.hypot(other.x - c.x, other.y - c.y);
        const otherSize = other.dna.size * (0.35 + 0.65 * other.growth);
        const minDist = (currentSize + otherSize) * 1.75 + 8;
        if (d < minDist && d > 0.001) {
          const overlap = (minDist - d);
          const nx = (c.x - other.x) / d;
          const ny = (c.y - other.y) / d;
          c.x += nx * overlap * 0.45;
          c.y += ny * overlap * 0.45;
          other.x -= nx * overlap * 0.45;
          other.y -= ny * overlap * 0.45;
        } else if (d <= 0.001) {
          const randAng = Math.random() * Math.PI * 2;
          c.x += Math.cos(randAng) * 14;
          c.y += Math.sin(randAng) * 14;
        }

        let relAng = Math.atan2(other.y - c.y, other.x - c.x) - c.angle;
        while (relAng < -Math.PI) relAng += Math.PI * 2;
        while (relAng > Math.PI) relAng -= Math.PI * 2;
        if ((other.type === 'anglerfish' || other.dna.parts?.includes('head_angler')) && !isCarnivore && d < c.dna.senseRadius * 0.85) {
          c.angle += (relAng) * 0.08;
        }
        if (c.type === 'nautilus' && (other.dna.diet > 0.6 || other.type === 'chimera' || other.type === 'anglerfish') && d < 75) {
          c.shellRetractTimer = 2.5;
        }
        if (other.type === 'solar_jelly' && c.dna.parts?.includes('body_symbiont') && d < 60) {
          c.energy = Math.min(c.maxEnergy, c.energy + 2.0 * dt);
        }

        if (other.dna.diet > 0.6 && !isCarnivore && d < minTD) {
          if (other.type !== 'anglerfish' || d < 45) {
            minTD = d;
            closestThreatAngle = relAng / Math.PI;
            closestThreatDist = d / c.dna.senseRadius;
          }
          if (c.dna.parts?.includes('body_ink') && d < 45 && Math.random() < 0.2) {
            for (let k = 0; k < 5; k++) {
              this.addParticle(c.x, c.y, (Math.random() - 0.5) * 2, (Math.random() - 0.5) * 2, '#0f172a', 6, 1.2, 'smoke');
            }
            other.stunTimer = 0.6;
          }
        }

        if (c.type === 'cleaner_shrimp' && other.id !== c.id && d < 45) {
          if (other.poisonTimer > 0) {
            other.poisonTimer = Math.max(0, other.poisonTimer - dt * 4.0);
            c.energy = Math.min(c.maxEnergy, c.energy + 5.0 * dt);
            this.addParticle(other.x, other.y, 0, -0.5, '#38bdf8', 2, 0.3, 'bubble');
          } else {
            other.energy = Math.min(other.maxEnergy, other.energy + 3.5 * dt);
            c.energy = Math.min(c.maxEnergy, c.energy + 2.8 * dt);
          }
        }

        let otherInKelp = false;
        for (const kelp of this.kelps) {
          if (Math.abs(other.x - kelp.baseX) < 45 && other.y >= kelp.baseY - kelp.height && other.y <= kelp.baseY + 20) {
            otherInKelp = true;
            break;
          }
        }
        let inWhaleShelter = false;
        for (const wp of this.plants) {
          if (wp.type === 'whale_fall' && wp.stage === 'mineral' && Math.hypot(other.x - wp.x, other.y - wp.y) < 65) {
            inWhaleShelter = true;
            break;
          }
        }
        const otherHidden = (otherInKelp || inWhaleShelter) && (other.dna.size * (0.35 + 0.65 * other.growth)) < 8.5;

        const isEdible = (other.type === 'herbivore' || other.type === 'scavenger' || other.stage === 'larva' || (isStarving && other.type === 'solar_jelly')) && other.type !== 'cleaner_shrimp';
        if (isCarnivore && isEdible && d < minPrD && !otherHidden && (other.dna.camouflage < 0.65 || Math.random() < 0.15)) {
          minPrD = d;
          closestPreyAngle = relAng / Math.PI;
          closestPreyDist = d / c.dna.senseRadius;

          const otherSize = other.dna.size * (0.35 + 0.65 * other.growth);
          if (d < currentSize + otherSize + 32) {
            c.biteAnimTimer = Math.max(c.biteAnimTimer || 0, 0.45);
          }

          const isLunging = isLeviathan && (c.lungeTimer || 0) > 0;
          const swallowRadius = isLunging ? currentSize * 2.6 : (currentSize + otherSize + 4);

          if (d < swallowRadius) {
            c.biteAnimTimer = Math.max(c.biteAnimTimer || 0, 0.4);
            const isNautilusRetracted = other.type === 'nautilus' && (other.shellRetractTimer || 0) > 0;
            const armorBlock = isNautilusRetracted ? 1.0 : Math.max(0, other.dna.armor - c.dna.biteForce);

            if (isNautilusRetracted || (armorBlock > 0.4 && Math.random() < armorBlock)) {
              c.stunTimer = 0.9;
              c.brain.applyHebb(-0.06);
              this.addParticle(other.x, other.y, 0, 0, '#facc15', 5, 0.5, 'spark');
            } else {
              const gainedEnergy = other.energy * 0.95 + 95;
              c.energy = Math.min(c.maxEnergy, c.energy + gainedEnergy);
              c.kills++;
              if (c.type !== 'chimera') {
                c.reproCooldown = Math.max(0, c.reproCooldown - 2.5);
              }
              c.brain.applyHebb(0.06);
              other.isDead = true;

              this.recentPredations.push({ x: other.x, y: other.y, time: this.totalTime });
              this.spawnDetritus(other.x, other.y, other.z, 2.0, 'carcass');

              if (other.dna.poison > 0.35 && c.dna.poisonResist < 0.6) {
                c.poisonTimer = 8.0;
                c.brain.applyHebb(-0.08);
              }

              for (let k = 0; k < 10; k++) {
                this.addParticle(other.x, other.y, (Math.random() - 0.5) * 4, (Math.random() - 0.5) * 4, '#f43f5e', 3.5, 0.6);
              }
            }
          }
        }
      }

      for (const obs of this.obstacles) {
        const d = Math.hypot(obs.x - c.x, obs.y - c.y);
        if (d < obs.radius + currentSize + 40) {
          closestObstacleDist = Math.min(closestObstacleDist, d / (obs.radius + 40));
          if (d < obs.radius + currentSize && currentSize > obs.passableSize) {
            const push = (obs.radius + currentSize - d);
            c.x += ((c.x - obs.x) / (d + 0.1)) * push;
            c.y += ((c.y - obs.y) / (d + 0.1)) * push;
            c.vx *= -0.5;
            c.vy *= -0.5;
            c.brain.applyHebb(-0.02);
          }
        }
      }

      let maxPeerSignal = 0;
      for (const other of nearbyCreatures) {
        if (other.id !== c.id && (other.warningSignal || 0) > maxPeerSignal) {
          maxPeerSignal = other.warningSignal;
        }
      }

      const brainInputs = [
        closestPlantAngle,
        1.0 - closestPlantDist,
        closestThreatAngle,
        1.0 - closestThreatDist,
        closestPreyAngle,
        1.0 - closestPreyDist,
        c.energy / c.maxEnergy,
        1.0 - closestObstacleDist,
        c.brain.memory,
        maxPeerSignal
      ];

      const [outSteer, outThrottle, outSprint, outAbility, outSignal] = c.brain.forward(brainInputs);
      c.warningSignal = outSignal || 0;

      let boidsSteer = 0;
      let panicSprint = false;

      if (c.dna.diet <= 0.55 && c.type === 'herbivore') {
        if (minTD < 0.85 || maxPeerSignal > 0.5) {
          boidsSteer = -closestThreatAngle * 2.0;
          panicSprint = true;
        } else {
          let flockCount = 0;
          let avgSin = 0, avgCos = 0;
          let centerX = 0, centerY = 0;
          let sepX = 0, sepY = 0;

          for (const other of nearbyCreatures) {
            if (other.id === c.id || other.dna.diet > 0.55) continue;
            const dist = Math.hypot(other.x - c.x, other.y - c.y);
            if (dist < c.dna.senseRadius * 0.6) {
              flockCount++;
              avgSin += Math.sin(other.angle);
              avgCos += Math.cos(other.angle);
              centerX += other.x;
              centerY += other.y;
              if (dist < currentSize * 5.5 && dist > 0) {
                const force = (currentSize * 5.5 - dist) / (currentSize * 5.5);
                sepX -= ((other.x - c.x) / dist) * force;
                sepY -= ((other.y - c.y) / dist) * force;
              }
            }
          }

          if (flockCount > 0) {
            centerX /= flockCount;
            centerY /= flockCount;
            const cohAngle = Math.atan2(centerY - c.y, centerX - c.x);
            const aliAngle = Math.atan2(avgSin, avgCos);

            let diffCoh = cohAngle - c.angle;
            while (diffCoh < -Math.PI) diffCoh += Math.PI * 2;
            while (diffCoh > Math.PI) diffCoh -= Math.PI * 2;

            let diffAli = aliAngle - c.angle;
            while (diffAli < -Math.PI) diffAli += Math.PI * 2;
            while (diffAli > Math.PI) diffAli -= Math.PI * 2;
            const dynamicBoidCoh = flockCount > 5 ? 0.0 : (0.12 * (1 - flockCount / 6));
            let combined = diffCoh * dynamicBoidCoh + diffAli * 0.35;
            if (Math.hypot(sepX, sepY) > 0.02) {
              const sepAngle = Math.atan2(sepY, sepX);
              let diffSep = sepAngle - c.angle;
              while (diffSep < -Math.PI) diffSep += Math.PI * 2;
              while (diffSep > Math.PI) diffSep -= Math.PI * 2;
              combined += diffSep * 2.4;
            }
            boidsSteer = Math.max(-1.0, Math.min(1.0, combined));
          }
        }
      }

      const finalSteer = boidsSteer !== 0 ? (outSteer * 0.15 + boidsSteer * 0.85) : outSteer;

      if (c.type === 'chimera') {
        const maxSteerDelta = 0.022;
        const clampedSteer = Math.max(-maxSteerDelta, Math.min(maxSteerDelta, finalSteer * c.dna.turnSpeed));
        c.angle += clampedSteer;
      } else if (c.type === 'anglerfish') {
        if (Math.abs(finalSteer) > 0.35) {
          c.angle = finalSteer > 0 ? 0 : Math.PI;
        }
      } else {
        const maxSteerDelta = c.dna.diet > 0.6 ? 0.035 : 0.048;
        const clampedSteer = Math.max(-maxSteerDelta, Math.min(maxSteerDelta, finalSteer * c.dna.turnSpeed));
        c.angle += clampedSteer;
      }

      if ((outSprint > 0.6 || panicSprint) && c.energy > 30) {
        c.sprintTimer = panicSprint ? 0.7 : 0.4;
      }

      if (outAbility > 0.6 && c.dna.electricShock > 0.3 && c.electricCooldown <= 0) {
        c.electricCooldown = 6.0;
        this.addShockwave(c.x, c.y, 75, 'rgba(250, 204, 21, 0.8)');
        for (const other of nearbyCreatures) {
          if (other.id !== c.id && Math.hypot(other.x - c.x, other.y - c.y) < 70) {
            other.stunTimer = 2.2;
            for (let k = 0; k < 6; k++) {
              this.addParticle(other.x, other.y, (Math.random() - 0.5) * 3, (Math.random() - 0.5) * 3, '#facc15', 3, 0.4, 'electric_arc');
            }
          }
        }
      }
      const isNight = (this.totalTime % 3600) < 1800;
      if (c.dna.diet > 0.6) {
        const targetZ = isNight ? 0.75 : 0.45;
        c.vz += (targetZ - c.z) * 0.002 * dt * 60;
      } else if (c.type === 'solar_jelly') {
        c.vz += (0.1 - c.z) * 0.003 * dt * 60;
        if (nearbyCreatures.length > 3) {
          c.pulsePhase += dt * 4.0;
          c.x += Math.cos(c.angle) * 2.2 * dt * 60;
          c.y += Math.sin(c.angle) * 2.2 * dt * 60;
        }
      } else if (c.type === 'scavenger') {
        c.vz += (0.9 - c.z) * 0.004 * dt * 60;
      } else if (c.type === 'anglerfish') {
        c.vz += (0.88 - c.z) * 0.005 * dt * 60;
      } else if (c.type === 'nautilus') {
        const buoyancyTargetZ = 0.35 + Math.sin(this.totalTime * 0.25 + c.id) * 0.35;
        c.vz += (buoyancyTargetZ - c.z) * 0.003 * dt * 60;
      } else {
        const targetZ = isNight ? 0.2 : 0.5;
        c.vz += (targetZ - c.z) * 0.002 * dt * 60;
      }

      if (c.type === 'scavenger') {
        const targetBenthicY = this.height * 0.85;
        if (c.y < targetBenthicY) {
          c.vy += 0.85 * dt * 60;
          let downAngle = Math.PI / 2;
          let diffDown = downAngle - c.angle;
          while (diffDown < -Math.PI) diffDown += Math.PI * 2;
          while (diffDown > Math.PI) diffDown -= Math.PI * 2;
          c.angle += diffDown * 0.08;
        }
      }

      if (c.type === 'anglerfish') {
        const yOffset = (((c.id * 47) % 100) / 100 - 0.5) * 140;
        const targetBenthicY = Math.min(this.height - 35, Math.max(this.height * 0.78, this.height * 0.86 + yOffset));
        c.y += (targetBenthicY - c.y) * 0.04 * dt * 60;
        c.vy = 0;
        c.angle = Math.cos(c.angle) >= 0 ? 0 : Math.PI;
      }

      const isResting = c.currentAction === 'rest';
      const isLungingSpeed = (c.type === 'chimera' && (c.lungeTimer || 0) > 0) ? 2.8 : 1.0;
      const isAnglerSnapping = c.type === 'anglerfish' && (c.biteAnimTimer || 0) > 0;
      const anglerSpeedMod = c.type === 'anglerfish' ? (isAnglerSnapping ? 3.5 : 0.45) : 1.0;
      const nautilusMod = (c.type === 'nautilus' && (c.shellRetractTimer || 0) > 0) ? 0.05 : 1.0;

      const throttleSpeed = isResting
        ? (c.dna.speed * 0.05)
        : (c.dna.speed * (0.3 + 0.7 * outThrottle) * (c.sprintTimer > 0 ? 1.45 : 1.0) * isLungingSpeed * anglerSpeedMod * nautilusMod);

      const targetVx = Math.cos(c.angle) * throttleSpeed;
      const targetVy = c.type === 'anglerfish' ? 0 : Math.sin(c.angle) * throttleSpeed;
      const glideRate = c.dna.diet > 0.6 ? 0.05 : 0.08;
      c.vx += (targetVx - c.vx) * glideRate * dt * 60;
      c.vy += (targetVy - c.vy) * glideRate * dt * 60;

      const maxVz = c.dna.speed * 0.35 * 0.01;
      c.vz = Math.max(-maxVz, Math.min(maxVz, c.vz));

      const flow = this.getFlowVector(c.x, c.y, c.z);
      const flowAlignment = (c.vx * flow.u + c.vy * flow.v);
      if (flowAlignment > 0.1) {
        c.energy = Math.min(c.maxEnergy, c.energy + 0.4 * dt);
      }

      c.x += (c.vx + flow.u * 0.25) * dt * 60;
      c.y += (c.vy + flow.v * 0.25) * dt * 60;
      c.z += (c.vz + flow.w) * dt * 60;
      c.z = Math.max(0.0, Math.min(1.0, c.z));

      const pad = 20;
      if (c.x < pad) { c.x = pad; c.angle = Math.PI - c.angle; }
      if (c.x > this.width - pad) { c.x = this.width - pad; c.angle = Math.PI - c.angle; }
      if (c.y < pad) { c.y = pad; c.angle = -c.angle; }
      if (c.y > this.height - pad) { c.y = this.height - pad; c.angle = -c.angle; }

      if (c.tailNodes.length > 0) {
        c.tailNodes[0].x = c.x;
        c.tailNodes[0].y = c.y;
        const segDist = currentSize * 0.75;
        for (let j = 1; j < c.tailNodes.length; j++) {
          const prev = c.tailNodes[j - 1];
          const curr = c.tailNodes[j];
          const dx = curr.x - prev.x;
          const dy = curr.y - prev.y;
          const dist = Math.hypot(dx, dy) || 0.001;
          curr.x = prev.x + (dx / dist) * segDist;
          curr.y = prev.y + (dy / dist) * segDist;
        }
      }

      const isJelly = c.type === 'solar_jelly';
      const isScav = c.type === 'scavenger';
      const isChimera = c.type === 'chimera';
      const isShrimp = c.type === 'cleaner_shrimp';
      const isAngler = c.type === 'anglerfish';
      const isRedCarn = c.dna.diet > 0.6 && !isChimera && !isAngler;
      const currentCarnCount = this.creatures.filter(x => x.dna.diet > 0.6 && x.type !== 'chimera' && x.type !== 'anglerfish').length + this.eggs.filter(x => x.dna.diet > 0.6 && x.type !== 'chimera' && x.type !== 'anglerfish').length;
      const currentScavCount = this.creatures.filter(x => x.type === 'scavenger').length;
      const currentChimeraCount = this.creatures.filter(x => x.type === 'chimera').length + this.eggs.filter(x => x.type === 'chimera').length;
      const currentShrimpCount = this.creatures.filter(x => x.type === 'cleaner_shrimp').length + this.eggs.filter(x => x.type === 'cleaner_shrimp').length;
      const currentAnglerCount = this.creatures.filter(x => x.type === 'anglerfish').length + this.eggs.filter(x => x.type === 'anglerfish').length;
      const totalLoad = totalPop + this.eggs.length;
      const allowBreed = isChimera
        ? (currentChimeraCount < 2 && totalLoad < 220)
        : isRedCarn
        ? (currentCarnCount < 5 && totalLoad < 220)
        : isShrimp
        ? (currentShrimpCount < 16 && totalLoad < 220)
        : isAngler
        ? (currentAnglerCount < 6 && totalLoad < 220)
        : isJelly
        ? (currentJellyCount < 15 && totalLoad < 220)
        : isScav
        ? (currentScavCount < 30 && totalLoad < 220)
        : (totalLoad < 220);

      if (c.stage === 'adult' && allowBreed && c.reproCooldown <= 0 && c.energy >= c.dna.reproEnergy) {
        c.energy *= 0.35;
        c.reproCooldown = isChimera ? 50.0 : isShrimp ? 25.0 : 8.0;
        c.children++;
        this.layEggs(c);
      }

      this.checkSpeciesDiscovery(c);
    }
    this.swarms = this.swarms.filter(s => {
      s.members = s.members.filter(m => !m.isDead);
      return s.members.length >= 2;
    });

    const unassignedHerbs = this.creatures.filter(c => c.type === 'herbivore' && !c.isDead && !this.swarms.some(s => s.members.includes(c)));
    for (let h = 0; h < unassignedHerbs.length; h++) {
      const c1 = unassignedHerbs[h];
      const cluster = unassignedHerbs.filter(c2 => Math.hypot(c2.x - c1.x, c2.y - c1.y) < 110);
      if (cluster.length >= 3) {
        const newSwarm = new Swarm(this.nextSwarmId++);
        newSwarm.members = cluster;
        this.swarms.push(newSwarm);
      }
    }

    for (const s of this.swarms) {
      s.update(dt, this.creatures);
      s.applyToMembers(dt);
    }
    this.entropyMap.fill(0);
    this.recentPredations = this.recentPredations.filter(p => (this.totalTime - p.time) <= 5.0);

    const cellW = this.width / 20;
    const cellH = this.height / 20;

    for (const pred of this.recentPredations) {
      const cx = Math.max(0, Math.min(19, Math.floor(pred.x / cellW)));
      const cy = Math.max(0, Math.min(19, Math.floor(pred.y / cellH)));
      this.entropyMap[cy * 20 + cx] += 0.5;
    }

    for (const s of this.swarms) {
      const cx = Math.max(0, Math.min(19, Math.floor(s.centroid.x / cellW)));
      const cy = Math.max(0, Math.min(19, Math.floor(s.centroid.y / cellH)));
      this.entropyMap[cy * 20 + cx] += s.members.length * 0.3 * (s.scatterTimer > 0 ? 2.0 : 1.0);
    }

    for (const d of this.detritus) {
      if (d.z > 0.8) {
        const cx = Math.max(0, Math.min(19, Math.floor(d.x / cellW)));
        const cy = Math.max(0, Math.min(19, Math.floor(d.y / cellH)));
        this.entropyMap[cy * 20 + cx] += 0.02 * 0.2;
      }
    }

    let maxE = 0;
    let bestCell = { cx: 10, cy: 10 };
    for (let idx = 0; idx < 400; idx++) {
      if (this.entropyMap[idx] > maxE) {
        maxE = this.entropyMap[idx];
        bestCell = { cx: idx % 20, cy: Math.floor(idx / 20) };
      }
    }
    this.entropyPeakValue = maxE;
    this.entropyMaxPos = {
      x: (bestCell.cx + 0.5) * cellW,
      y: (bestCell.cy + 0.5) * cellH
    };
    const mineralWhales = this.plants.filter(p => p.type === 'whale_fall' && p.stage === 'mineral');
    if (mineralWhales.length > 3) {
      const oldestMineral = mineralWhales[0];
      const pIdx = this.plants.indexOf(oldestMineral);
      if (pIdx !== -1) this.plants.splice(pIdx, 1);
    }

    this.creatures = this.creatures.filter(c => !c.isDead);

    if (this.discoveryTimer > 0) {
      this.discoveryTimer -= dt;
      if (this.discoveryTimer <= 0) this.recentDiscovery = null;
    }
    if (this.mutantAlertTimer > 0) {
      this.mutantAlertTimer -= dt;
      if (this.mutantAlertTimer <= 0 || (this.latestMutant && this.latestMutant.isDead)) {
        this.latestMutant = null;
      }
    }

    if (this.creatures.filter(c => c.type === 'herbivore').length < 8) {
      this.spawnCreature('herbivore', Math.random() * this.width, Math.random() * this.height, 1, undefined, undefined, 'adult');
    }
    if (this.creatures.filter(c => c.dna.diet > 0.6 && c.type !== 'chimera' && c.type !== 'anglerfish').length < 4) {
      this.spawnCreature('carnivore', Math.random() * this.width, this.height * (0.3 + Math.random() * 0.4), 1, undefined, undefined, 'adult');
    }
    if (this.creatures.filter(c => c.type === 'scavenger').length < 5) {
      const scavY = this.height * 0.75 + Math.random() * (this.height * 0.22);
      this.spawnCreature('scavenger', Math.random() * this.width, scavY, 1, undefined, undefined, 'adult');
    }
    if (this.creatures.filter(c => c.type === 'solar_jelly').length < 5) {
      this.spawnCreature('solar_jelly', Math.random() * this.width, Math.random() * (this.height * 0.35), 1, undefined, undefined, 'adult');
    }
    if (this.creatures.filter(c => c.type === 'cleaner_shrimp').length < 6) {
          this.spawnCreature('cleaner_shrimp', Math.random() * this.width, this.height * (0.6 + Math.random() * 0.25), 1, undefined, undefined, 'adult');
        }
        const currentRedCarns = this.creatures.filter(c => c.dna.diet > 0.55 && c.type !== 'chimera' && c.type !== 'anglerfish' && !c.isDead);
        if (currentRedCarns.length > 4) {
          for (let k = 4; k < currentRedCarns.length; k++) {
            currentRedCarns[k].isDead = true;
          }
        } else if (currentRedCarns.length < 3) {
          this.spawnCreature('carnivore', Math.random() * this.width, this.height * (0.3 + Math.random() * 0.4), 1, undefined, undefined, 'adult');
        }
    if (this.creatures.filter(c => c.type === 'anglerfish').length < 4) {
      const angY = this.height * (0.80 + Math.random() * 0.12);
      this.spawnCreature('anglerfish', Math.random() * this.width, angY, 1, undefined, undefined, 'adult');
    }
  }

  applyMeteor(wx: number, wy: number, radius = 140) {
    this.addShockwave(wx, wy, radius * 1.5, 'rgba(249, 115, 22, 0.8)');
    for (let i = this.detritus.length - 1; i >= 0; i--) {
      if (Math.hypot(this.detritus[i].x - wx, this.detritus[i].y - wy) < radius) {
        this.detritus.splice(i, 1);
      }
    }
    for (let i = this.creatures.length - 1; i >= 0; i--) {
      const c = this.creatures[i];
      if (Math.hypot(c.x - wx, c.y - wy) < radius) {
        c.isDead = true;
        this.spawnPlant(c.x, c.y, 'meat_remains');
        this.spawnDetritus(c.x, c.y, c.z, 3.0, 'carcass');
        this.creatures.splice(i, 1);
      }
    }
    for (let i = this.eggs.length - 1; i >= 0; i--) {
      if (Math.hypot(this.eggs[i].x - wx, this.eggs[i].y - wy) < radius) {
        this.eggs.splice(i, 1);
      }
    }
    for (let i = this.plants.length - 1; i >= 0; i--) {
      if (Math.hypot(this.plants[i].x - wx, this.plants[i].y - wy) < radius) {
        this.plants.splice(i, 1);
      }
    }
    for (let k = 0; k < 50; k++) {
      const ang = Math.random() * Math.PI * 2;
      const spd = 2 + Math.random() * 8;
      this.addParticle(wx, wy, Math.cos(ang) * spd, Math.sin(ang) * spd, '#f97316', 5, 1.0, 'smoke');
    }
  }
}
