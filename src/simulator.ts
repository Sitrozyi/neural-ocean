export type CreatureType = 'herbivore' | 'carnivore' | 'scavenger' | 'solar_jelly' | 'chimera';
export type LifeStage = 'larva' | 'adult';

export type PartGene =
  | 'prop_ribbon' | 'prop_fork' | 'prop_jet' | 'prop_paddle'
  | 'head_jaw' | 'head_horn' | 'head_angler' | 'head_beak'
  | 'body_spikes' | 'body_fin' | 'body_symbiont' | 'body_ink';

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
  vx: number;
  vy: number;
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
}

export interface Plant {
  id: number;
  x: number;
  y: number;
  energy: number;
  size: number;
  maxSize: number;
  type: 'algae' | 'fruit' | 'meat_remains';
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
    name: 'タイタンホーン',
    category: '巨大角種',
    condition: '体サイズ14以上',
    desc: '巨大な頭角と圧倒的体躯を誇る深海の巨獣。高い生命力と装甲で敵を圧倒する。',
    previewDna: { size: 14.5, color: [45, 185, 150], diet: 0.2, segments: 6, armor: 0.5 }
  },
  {
    id: 'swift',
    name: '迅雷フィン',
    category: '高速突撃種',
    condition: '遊泳速度4.5以上',
    desc: '流線型の推進ヒレを進化させ、海中を矢のように疾走する俊足の遊泳者。',
    previewDna: { speed: 4.8, size: 5.5, color: [56, 189, 248], diet: 0.3, segments: 5, turnSpeed: 0.18 }
  },
  {
    id: 'venom',
    name: 'アビスバイパー',
    category: '猛毒棘種',
    condition: '猛毒0.75以上',
    desc: '高濃度の神経毒を背鰭の棘に蓄えた危険種。捕食者を返り討ちにする。',
    previewDna: { size: 7.2, color: [168, 85, 247], poison: 0.85, diet: 0.4, segments: 6 }
  },
  {
    id: 'aegis',
    name: '金剛シェル',
    category: '重装甲種',
    condition: '装甲0.8以上',
    desc: '外敵の牙をことごとく弾き返す重層甲殻プレートを纏った鉄壁の魚。',
    previewDna: { size: 8.2, color: [56, 189, 248], armor: 0.88, diet: 0.15, segments: 4 }
  },
  {
    id: 'elder',
    name: '深海の長老',
    category: '長寿古代種',
    condition: '最大寿命100以上',
    desc: '過酷な淘汰を何世代にもわたり生き延びる強靭な古代遺伝子保持者。',
    previewDna: { size: 9.0, color: [148, 163, 184], maxAge: 120, diet: 0.25, segments: 5 }
  },
  {
    id: 'reaper',
    name: '冥王リヴァイアサン',
    category: '狂乱捕食種',
    condition: '討伐数8以上',
    desc: '無数の獲物を屠り生態系の頂点に君臨する狂乱の深海覇者。',
    previewDna: { size: 12.5, color: [239, 68, 68], diet: 0.95, biteForce: 0.9, segments: 6 }
  },
  {
    id: 'photon',
    name: 'フォトンクラゲ',
    category: '共生光化種',
    condition: '光合成0.75以上',
    desc: '体内に葉緑素を高密度共生させ、光エネルギーのみで生存可能な浮遊生命。',
    previewDna: { size: 7.5, color: [52, 211, 153], photosynthesis: 0.85, diet: 0.0 }
  },
  {
    id: 'aurum',
    name: '黄金変異種',
    category: '伝説黄金種',
    condition: '黄金色の体色',
    desc: '極めて稀な色素突然変異によって黄金の輝きを放つ神秘の個体。',
    previewDna: { size: 7.0, color: [245, 158, 11], diet: 0.3, segments: 5 }
  },
  {
    id: 'brood',
    name: '群生マザー',
    category: '多産母胎種',
    condition: '多産r戦略(0.15以下)',
    desc: '一度に無数の卵塊を産み落とし、広大な海域を子孫で埋め尽くす母胎。',
    previewDna: { size: 6.8, color: [244, 114, 182], rkStrategy: 0.1, diet: 0.1, segments: 4 }
  },
  {
    id: 'phantom',
    name: 'ファントムシーカー',
    category: '深淵擬態種',
    condition: '擬態度0.75以上',
    desc: '半透明の体組織で背景の深淵に同化し、敵や獲物の目を完全に欺く幽霊魚。',
    previewDna: { size: 6.0, color: [100, 116, 139], camouflage: 0.85, diet: 0.35, segments: 4 }
  },
  {
    id: 'dynamo',
    name: '雷帝エレクトロ',
    category: '帯電放電種',
    condition: '放電能力0.75以上',
    desc: '高圧放電パルスで周囲の遊泳生物を麻痺させ捕食・防衛を行う発電魚。',
    previewDna: { size: 7.8, color: [250, 204, 21], electricShock: 0.88, diet: 0.45, segments: 5 }
  },
  {
    id: 'abyss_eye',
    name: '深淵の千里眼',
    category: '広域知覚種',
    condition: '感知半径260以上',
    desc: '超高感度の感覚器官により、広大な暗黒水域のあらゆる動体を捉える。',
    previewDna: { size: 6.8, color: [14, 165, 233], senseRadius: 280, diet: 0.2, segments: 4 }
  },
  {
    id: 'needle_jaw',
    name: '鬼牙ニードル',
    category: '強顎咬合種',
    condition: '咬合力0.85以上',
    desc: '重装甲をも噛み砕く無数の針状牙を備えた肉食凶暴種。',
    previewDna: { size: 8.8, color: [225, 29, 72], biteForce: 0.92, diet: 0.9, segments: 5 }
  },
  {
    id: 'crimson_beast',
    name: '紅蓮のキメラ',
    category: '紅蓮頂点種',
    condition: '肉食かつ体サイズ11以上',
    desc: '深紅の巨大な体と巨大ブレードフィンで海域を制圧する巨獣。',
    previewDna: { size: 12.0, color: [190, 18, 60], diet: 0.9, biteForce: 0.8, segments: 7 }
  },
  {
    id: 'crawler',
    name: '深海スカベンジャー',
    category: '装甲底生種',
    condition: '掃除屋かつ装甲0.7以上',
    desc: '頑強な甲殻と強靭なハサミで海底に沈む有機物を解体・摂食する掃除屋。',
    previewDna: { size: 6.0, color: [217, 119, 6], scavengerDrive: 0.95, armor: 0.8, diet: 0.1 }
  },
  {
    id: 'siren',
    name: '幻惑セイレーン',
    category: '高機動旋回種',
    condition: '旋回速度0.22以上',
    desc: '驚異的な旋回性能とリボンフィンで捕食者の追撃を瞬時に回避する。',
    previewDna: { speed: 3.6, turnSpeed: 0.25, size: 5.8, color: [192, 132, 252], diet: 0.2, segments: 5 }
  },
  {
    id: 'leviathan',
    name: '始祖竜オロチ',
    category: '多節巨竜種',
    condition: '体節数7かつ体長10以上',
    desc: '7つの節球が連なる長大な龍体をくねらせ、深海の主として君臨する古代種。',
    previewDna: { size: 10.8, color: [13, 148, 136], segments: 7, diet: 0.65 }
  },
  {
    id: 'biolume',
    name: '深海ランタン',
    category: '生物発光種',
    condition: '青色発光体かつ光合成0.6以上',
    desc: '頭部に青白い自家発光器を備え、暗黒の深海で光合成と誘引を行う神秘種。',
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
  obstacles: Obstacle[] = [];
  particles: Particle[] = [];
  shockwaves: Shockwave[] = [];

  nextId = 1;
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
    this.obstacles = [];
    this.particles = [];
    this.shockwaves = [];
    this.historyHerb = [];
    this.historyCarn = [];
    this.historyPlant = [];
    this.maxGen = 1;
    this.totalTime = 0;

    const biomeCenters = [
      { x: this.width * 0.28, y: this.height * 0.45, type: 'coral', radius: 420 },
      { x: this.width * 0.72, y: this.height * 0.60, type: 'coral', radius: 380 },
      { x: this.width * 0.50, y: this.height * 0.25, type: 'rock',  radius: 320 }
    ];

    for (let i = 0; i < 24; i++) {
      const isCoral = i < 16;
      const targetBiome = isCoral ? (i % 2 === 0 ? biomeCenters[0] : biomeCenters[1]) : biomeCenters[2];

      const clusterAngle = Math.random() * Math.PI * 2;
      const clusterDist = Math.random() * targetBiome.radius * 0.85;
      const obsX = targetBiome.x + Math.cos(clusterAngle) * clusterDist;
      const obsY = targetBiome.y + Math.sin(clusterAngle) * clusterDist;
      const rad = 40 + Math.random() * 45;

      let branches: CoralBranch[] | undefined;
      let rockVertices: RockVertex[] | undefined;

      if (isCoral) {
        branches = [];
        const count = 5 + Math.floor(Math.random() * 3);
        for (let b = 0; b < count; b++) {
          const ang = (b / count) * Math.PI * 2 + (Math.random() - 0.5) * 0.35;
          branches.push({
            angle: ang,
            length: rad * (0.65 + Math.random() * 0.35),
            color: Math.random() < 0.5 ? 'rgba(225, 29, 72, 0.75)' : 'rgba(14, 165, 233, 0.75)',
            subBranches: [
              { angle: ang - 0.38, length: rad * 0.3 },
              { angle: ang + 0.38, length: rad * 0.3 }
            ]
          });
        }
      } else {
        rockVertices = [];
        const vCount = 8;
        for (let v = 0; v < vCount; v++) {
          rockVertices.push({
            angle: (v / vCount) * Math.PI * 2,
            radius: rad * (0.75 + Math.random() * 0.4)
          });
        }
      }

      this.obstacles.push({
        id: this.nextId++,
        x: Math.max(80, Math.min(this.width - 80, obsX)),
        y: Math.max(80, Math.min(this.height - 80, obsY)),
        radius: rad,
        type: isCoral ? 'coral_reef' : 'rock',
        passableSize: 6.8,
        branches,
        rockVertices,
        glowColor: isCoral ? '#f43f5e' : '#0284c7'
      });
    }

    for (let i = 0; i < 260; i++) {
      if (Math.random() < 0.75) {
        const b = biomeCenters[Math.floor(Math.random() * 2)];
        const ang = Math.random() * Math.PI * 2;
        const d = Math.random() * b.radius;
        this.spawnPlant(b.x + Math.cos(ang) * d, b.y + Math.sin(ang) * d, 'algae');
      } else {
        this.spawnPlant(Math.random() * this.width, Math.random() * this.height, 'algae');
      }
    }

    for (let i = 0; i < 55; i++) {
      const b = biomeCenters[i % 2];
      const ang = Math.random() * Math.PI * 2;
      const d = Math.random() * (b.radius * 0.7);
      this.spawnCreature('herbivore', b.x + Math.cos(ang) * d, b.y + Math.sin(ang) * d, 1, undefined, undefined, 'adult');
    }
    for (let i = 0; i < 16; i++) {
      this.spawnCreature('solar_jelly', Math.random() * this.width, Math.random() * (this.height * 0.45), 1, undefined, undefined, 'adult');
    }
    for (let i = 0; i < 14; i++) {
      const b = biomeCenters[2];
      this.spawnCreature('scavenger', b.x + (Math.random() - 0.5) * 200, b.y + (Math.random() - 0.5) * 200, 1, undefined, undefined, 'adult');
    }
    for (let i = 0; i < 10; i++) {
      const outX = Math.random() < 0.5 ? Math.random() * (this.width * 0.2) : this.width * 0.8 + Math.random() * (this.width * 0.2);
      const outY = Math.random() * this.height;
      this.spawnCreature('carnivore', outX, outY, 1, undefined, undefined, 'adult');
    }
  }

  createDefaultDNA(type: CreatureType): DNA {
    const base: DNA = {
      speed: 2.3,
      turnSpeed: 0.12,
      senseRadius: 135,
      size: 5.2,
      color: [40, 190, 160],
      reproEnergy: 140,
      metabolism: 0.14,
      mutationRate: 0.14,
      maxAge: 65,
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
      base.speed = 2.4 + Math.random() * 0.4;
      base.size = 5.0 + Math.random() * 1.2;
      base.color = [40 + Math.random() * 30, 200 + Math.random() * 40, 160 + Math.random() * 40];
      base.poison = Math.random() < 0.25 ? 0.7 : 0;
      base.armor = Math.random() < 0.2 ? 0.6 : 0;
      base.rkStrategy = Math.random() < 0.5 ? 0.25 : 0.75;
      base.parts = ['prop_fork', Math.random() < 0.4 ? 'body_symbiont' : 'body_fin'];
    } else if (type === 'carnivore') {
      base.speed = 3.1 + Math.random() * 0.3;
      base.senseRadius = 175;
      base.size = 8.5 + Math.random() * 1.5;
      base.color = [245, 50, 60];
      base.diet = 0.95;
      base.metabolism = 0.26;
      base.reproEnergy = 210;
      base.biteForce = 0.5;
      base.segments = 5;
      base.rkStrategy = 0.8;
      base.parts = ['head_jaw', 'prop_jet', 'body_spikes'];
    } else if (type === 'scavenger') {
      base.speed = 1.8;
      base.senseRadius = 240;
      base.size = 4.8;
      base.color = [217, 119, 6];
      base.scavengerDrive = 0.95;
      base.diet = 0.1;
      base.armor = 0.85;
      base.rkStrategy = 0.3;
      base.parts = ['prop_paddle', 'head_beak'];
    } else if (type === 'solar_jelly') {
      base.speed = 1.1;
      base.senseRadius = 75;
      base.size = 7.0;
      base.color = [52, 211, 153];
      base.photosynthesis = 0.85;
      base.metabolism = 0.06;
      base.reproEnergy = 190;
      base.electricShock = 0.6;
      base.maxAge = 50;
      base.rkStrategy = 0.4;
      base.parts = ['head_angler', 'body_symbiont'];
    } else if (type === 'chimera') {
      base.speed = 3.6;
      base.turnSpeed = 0.2;
      base.senseRadius = 250;
      base.size = 13.0;
      base.color = [192, 38, 211];
      base.diet = 1.0;
      base.metabolism = 0.35;
      base.reproEnergy = 300;
      base.poison = 0.8;
      base.poisonResist = 0.9;
      base.armor = 0.7;
      base.biteForce = 0.9;
      base.electricShock = 0.6;
      base.segments = 7;
      base.rkStrategy = 0.9;
      base.parts = ['head_horn', 'head_jaw', 'prop_ribbon', 'body_spikes'];
    }
    return base;
  }

  mutateDNA(parentDNA: DNA): DNA {
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

    let speed = mutateVal(parentDNA.speed, 0.5, 1.0, 5.5);
    let turnSpeed = mutateVal(parentDNA.turnSpeed, 0.04, 0.04, 0.3);
    let senseRadius = mutateVal(parentDNA.senseRadius, 35, 50, 320);
    let size = mutateVal(parentDNA.size, 1.3, 3.2, 18.0);
    let reproEnergy = mutateVal(parentDNA.reproEnergy, 25, 90, 360);
    let metabolism = mutateVal(parentDNA.metabolism, 0.03, 0.04, 0.5);
    let mutationRate = mutateVal(parentDNA.mutationRate, 0.03, 0.02, 0.4);
    let maxAge = mutateVal(parentDNA.maxAge, 10, 20, 160);
    let camouflage = mutateVal(parentDNA.camouflage, 0.12, 0.0, 0.95);
    let diet = mutateVal(parentDNA.diet, 0.08, 0.0, 1.0);
    let segments = Math.round(mutateVal(parentDNA.segments, 0.8, 3, 7));
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
    if (Math.random() < 0.001) {
      isAncient = true;
      size = Math.min(22.0, size * 3.5);
      maxAge *= 2.5;
      newColor = [220, 38, 38];
      parts = ['head_horn', 'head_jaw', 'prop_ribbon', 'body_spikes'];
    } else if (Math.random() < 0.002) {
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
    const isK = parent.dna.rkStrategy > 0.55;
    const eggCount = isK ? (Math.random() < 0.7 ? 1 : 2) : (3 + Math.floor(Math.random() * 3));
    const eggSize = isK ? parent.dna.size * 0.45 : parent.dna.size * 0.25;
    const hatchTime = isK ? 4.0 : 6.5;

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
          type: c.type, x: c.x, y: c.y, energy: c.energy, maxEnergy: c.maxEnergy,
          age: c.age, stage: c.stage, growth: c.growth, generation: c.generation,
          kills: c.kills, children: c.children, dna: c.dna
        })),
        plants: this.plants.map(p => ({
          x: p.x, y: p.y, energy: p.energy, size: p.size, maxSize: p.maxSize, type: p.type
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
          id: this.nextId++, x: p.x, y: p.y, energy: p.energy, size: p.size, maxSize: p.maxSize, type: p.type
        });
      }
      for (const sc of state.creatures) {
        const c = this.spawnCreature(sc.type, sc.x, sc.y, sc.generation, sc.dna, undefined, sc.stage);
        c.energy = sc.energy;
        c.maxEnergy = sc.maxEnergy;
        c.age = sc.age;
        c.growth = sc.growth;
        c.kills = sc.kills || 0;
        c.children = sc.children || 0;
      }
      localStorage.setItem('biocosmos_last_slot', slot.toString());
      return true;
    } catch (_) {
      return false;
    }
  }

  getSlotSummary(slot: number): string {
    try {
      const raw = localStorage.getItem(`biocosmos_slot_${slot}`) || (slot === 1 ? localStorage.getItem('biocosmos_world_state') : null);
      if (!raw) return '空スロット';
      const d = JSON.parse(raw);
      return `Gen.${d.maxGen || 1} (${d.creatures?.length || 0}匹) ${d.savedAt || ''}`;
    } catch (_) {
      return '空スロット';
    }
  }

  spawnCreature(type: CreatureType, x: number, y: number, gen: number, parentDNA?: DNA, parentBrain?: NeuralBrain, stage: LifeStage = 'larva', parentId: number | null = null): Creature {
    const dna = parentDNA ? this.mutateDNA(parentDNA) : this.createDefaultDNA(type);
    const brain = new NeuralBrain(parentBrain, dna.mutationRate);

    let resolvedType = type;
    if (parentDNA) {
      if (dna.photosynthesis > 0.55) resolvedType = 'solar_jelly';
      else if (dna.scavengerDrive > 0.55) resolvedType = 'scavenger';
      else if (dna.diet > 0.65) resolvedType = 'carnivore';
      else resolvedType = 'herbivore';
    }

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
      vx: Math.cos(ang) * dna.speed,
      vy: Math.sin(ang) * dna.speed,
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
      reproCooldown: 8.0,
      warningSignal: 0
    };

    this.creatures.push(c);
    this.maxGen = Math.max(this.maxGen, gen);
    return c;
  }

  spawnPlant(x: number, y: number, type: 'algae' | 'fruit' | 'meat_remains' = 'algae') {
    if (this.plants.length >= 450) return;
    let energy = 28 + Math.random() * 18;
    let size = 2.5;
    let maxSize = 5.0 + Math.random() * 2.5;

    if (type === 'fruit') {
      energy = 55 + Math.random() * 20;
      maxSize = 6.5;
    } else if (type === 'meat_remains') {
      energy = 45 + Math.random() * 25;
      maxSize = 6.0;
    }

    this.plants.push({
      id: this.nextId++,
      x: Math.max(15, Math.min(this.width - 15, x)),
      y: Math.max(15, Math.min(this.height - 15, y)),
      energy,
      size,
      maxSize,
      type
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
        const c = this.spawnCreature(egg.type, egg.x, egg.y, egg.generation, egg.dna, egg.brain, 'larva', egg.parentId);
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

    if (this.plants.length < 300 && Math.random() < 0.45) {
      if (this.plants.length > 0 && Math.random() < 0.72) {
        const parentPlant = this.plants[Math.floor(Math.random() * this.plants.length)];
        const offAng = Math.random() * Math.PI * 2;
        const offDist = 15 + Math.random() * 65;
        this.spawnPlant(parentPlant.x + Math.cos(offAng) * offDist, parentPlant.y + Math.sin(offAng) * offDist, 'algae');
      } else {
        this.spawnPlant(Math.random() * this.width, Math.random() * this.height, 'algae');
      }
    }
    for (const p of this.plants) {
      if (p.size < p.maxSize) p.size += dt * 0.5;
    }

    let currentJellyCount = 0;
    for (const c of this.creatures) {
      if (c.type === 'solar_jelly') currentJellyCount++;
    }
    const solarShadingFactor = Math.max(0.05, 1.0 - (currentJellyCount / 35));
    const totalPop = this.creatures.length;
    const overpopFactor = totalPop > 200 ? (totalPop / 200) : 1.0;

    for (let i = this.creatures.length - 1; i >= 0; i--) {
      const c = this.creatures[i];
      if (!c || c.isDead) continue;

      c.age += dt;
      c.finPhase += dt * (c.dna.speed * 4.5);
      c.pulsePhase += dt * 2.5;
      c.legPhase += dt * (c.dna.speed * 8.0);

      if (c.sprintTimer > 0) c.sprintTimer -= dt;
      if (c.electricCooldown > 0) c.electricCooldown -= dt;
      if (c.reproCooldown > 0) c.reproCooldown -= dt;

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
        const gainedSolar = c.dna.photosynthesis * 8.5 * solarShadingFactor * dt;
        c.energy = Math.min(c.maxEnergy, c.energy + gainedSolar);
      }

      const speedCost = (c.dna.speed * (c.sprintTimer > 0 ? 1.5 : 1.0)) ** 2 * 0.009;
      const sizeCost = (currentSize ** 1.35) * 0.012;
      const totalCost = (c.dna.metabolism + speedCost + sizeCost) * dt * 11 * overpopFactor;
      c.energy -= totalCost;

      if (c.energy <= 0 || c.age >= c.dna.maxAge) {
        c.isDead = true;
        this.spawnPlant(c.x, c.y, 'meat_remains');
        for (let k = 0; k < 6; k++) {
          this.addParticle(c.x, c.y, (Math.random() - 0.5) * 2, (Math.random() - 0.5) * 2, `rgb(${c.dna.color.join(',')})`, 3, 0.8);
        }
        continue;
      }

      const nearbyCreatures = this.creatureGrid.query(c.x, c.y, c.dna.senseRadius);
      const nearbyPlants = this.plantGrid.query(c.x, c.y, c.dna.senseRadius);

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

          if (d < currentSize + p.size + 3 && c.dna.photosynthesis < 0.6) {
            c.energy = Math.min(c.maxEnergy, c.energy + p.energy * (c.type === 'scavenger' && p.type === 'meat_remains' ? 1.5 : 1.0));
            c.plantsEaten++;
            c.brain.applyHebb(0.04);
            this.addParticle(p.x, p.y, 0, -1, p.type === 'meat_remains' ? '#f59e0b' : '#4ade80', 2.5, 0.4);
            const pIdx = this.plants.indexOf(p);
            if (pIdx !== -1) this.plants.splice(pIdx, 1);
          }
        }
      }

      let minTD = Infinity, minPrD = Infinity;
      const isCarnivore = c.dna.diet > 0.6;
      const isStarving = c.energy < c.maxEnergy * 0.35;

      for (const other of nearbyCreatures) {
        if (other.id === c.id || other.isDead) continue;
        const d = Math.hypot(other.x - c.x, other.y - c.y);
        let relAng = Math.atan2(other.y - c.y, other.x - c.x) - c.angle;
        while (relAng < -Math.PI) relAng += Math.PI * 2;
        while (relAng > Math.PI) relAng -= Math.PI * 2;

        if (other.dna.parts?.includes('head_angler') && !isCarnivore && d < c.dna.senseRadius * 0.8) {
          c.angle += (relAng) * 0.05;
        }
        if (other.type === 'solar_jelly' && c.dna.parts?.includes('body_symbiont') && d < 60) {
          c.energy = Math.min(c.maxEnergy, c.energy + 2.0 * dt);
        }

        if (other.dna.diet > 0.6 && !isCarnivore && d < minTD) {
          minTD = d;
          closestThreatAngle = relAng / Math.PI;
          closestThreatDist = d / c.dna.senseRadius;
          if (c.dna.parts?.includes('body_ink') && d < 45 && Math.random() < 0.2) {
            for (let k = 0; k < 5; k++) {
              this.addParticle(c.x, c.y, (Math.random() - 0.5) * 2, (Math.random() - 0.5) * 2, '#0f172a', 6, 1.2, 'smoke');
            }
            other.stunTimer = 0.6;
          }
        }

        const isEdible = other.type === 'herbivore' || other.stage === 'larva' || (isStarving && other.type === 'solar_jelly');
        if (isCarnivore && isEdible && d < minPrD) {
          minPrD = d;
          closestPreyAngle = relAng / Math.PI;
          closestPreyDist = d / c.dna.senseRadius;

          const otherSize = other.dna.size * (0.35 + 0.65 * other.growth);
          if (d < currentSize + otherSize + 4) {
            const armorBlock = Math.max(0, other.dna.armor - c.dna.biteForce);
            if (armorBlock > 0.4 && Math.random() < armorBlock) {
              c.stunTimer = 0.8;
              c.brain.applyHebb(-0.06);
              this.addParticle(c.x, c.y, 0, 0, '#38bdf8', 4, 0.4, 'spark');
            } else {
              const gainedEnergy = other.energy * 0.85 + 70;
              c.energy = Math.min(c.maxEnergy, c.energy + gainedEnergy);
              c.kills++;
              c.brain.applyHebb(0.05);
              other.isDead = true;

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
            if (dist < c.dna.senseRadius * 0.7) {
              flockCount++;
              avgSin += Math.sin(other.angle);
              avgCos += Math.cos(other.angle);
              centerX += other.x;
              centerY += other.y;
              if (dist < currentSize * 2.5 && dist > 0) {
                sepX -= (other.x - c.x) / dist;
                sepY -= (other.y - c.y) / dist;
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

            let combined = diffCoh * 0.35 + diffAli * 0.45;
            if (Math.hypot(sepX, sepY) > 0.1) {
              const sepAngle = Math.atan2(sepY, sepX);
              let diffSep = sepAngle - c.angle;
              while (diffSep < -Math.PI) diffSep += Math.PI * 2;
              while (diffSep > Math.PI) diffSep -= Math.PI * 2;
              combined += diffSep * 0.6;
            }
            boidsSteer = Math.max(-1.0, Math.min(1.0, combined));
          }
        }
      }

      const finalSteer = boidsSteer !== 0 ? (outSteer * 0.3 + boidsSteer * 0.7) : outSteer;
      c.angle += finalSteer * c.dna.turnSpeed;

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

      const throttleSpeed = c.dna.speed * (0.3 + 0.7 * outThrottle) * (c.sprintTimer > 0 ? 1.45 : 1.0);
      c.vx = Math.cos(c.angle) * throttleSpeed;
      c.vy = Math.sin(c.angle) * throttleSpeed;

      c.x += c.vx * dt * 60;
      c.y += c.vy * dt * 60;

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
      const allowBreed = isJelly ? (currentJellyCount < 35) : (totalPop < 220);

      if (c.stage === 'adult' && allowBreed && c.reproCooldown <= 0 && c.energy >= c.dna.reproEnergy) {
        c.energy *= 0.35;
        c.reproCooldown = 8.0;
        c.children++;
        this.layEggs(c);
      }

      this.checkSpeciesDiscovery(c);
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
    if (this.creatures.filter(c => c.dna.diet > 0.6).length < 2) {
      this.spawnCreature('carnivore', Math.random() * this.width, Math.random() * this.height, 1, undefined, undefined, 'adult');
    }
  }

  applyMeteor(wx: number, wy: number, radius = 140) {
    this.addShockwave(wx, wy, radius * 1.5, 'rgba(249, 115, 22, 0.8)');
    for (let i = this.creatures.length - 1; i >= 0; i--) {
      const c = this.creatures[i];
      if (Math.hypot(c.x - wx, c.y - wy) < radius) {
        c.isDead = true;
        this.spawnPlant(c.x, c.y, 'meat_remains');
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
