
import { EcosystemWorld, Creature, Obstacle, Egg, SPECIES_CATALOG, DNA, SpeciesCatalogItem, NeuralBrain, Detritus, Plant, Kelp, HydrothermalVent, ColossalShadow } from './simulator';
const canvas = document.getElementById('screen') as HTMLCanvasElement;
const ctx = canvas.getContext('2d')!;
class BioSoundEngine {
  ctx: AudioContext | null = null;
  private bubbleTimer = 2.0;
  private whaleTimer = 10.0;
  private isDroneActive = false;

  init() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      this.ctx = new AudioCtx();
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
    if (!this.isDroneActive && this.ctx) {
      this.isDroneActive = true;
      this.startOceanDrone();
    }
  }

  update(dt: number) {
    if (!this.ctx) return;
    this.bubbleTimer -= dt;
    if (this.bubbleTimer <= 0) {
      this.bubbleTimer = 3.0 + Math.random() * 4.5;
      this.playGentleBubble();
    }

    this.whaleTimer -= dt;
    if (this.whaleTimer <= 0) {
      this.whaleTimer = 22.0 + Math.random() * 26.0;
      this.playWhaleSong();
    }
  }

  private startOceanDrone() {
    if (!this.ctx) return;
    try {
      const osc1 = this.ctx.createOscillator();
      const osc2 = this.ctx.createOscillator();
      const filter = this.ctx.createBiquadFilter();
      const gain = this.ctx.createGain();

      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(46, this.ctx.currentTime);
      osc2.type = 'triangle';
      osc2.frequency.setValueAtTime(50, this.ctx.currentTime);

      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(85, this.ctx.currentTime);

      gain.gain.setValueAtTime(0.0001, this.ctx.currentTime);
      gain.gain.linearRampToValueAtTime(0.016, this.ctx.currentTime + 4.0);

      osc1.connect(filter);
      osc2.connect(filter);
      filter.connect(gain);
      gain.connect(this.ctx.destination);

      osc1.start();
      osc2.start();
    } catch (_) {}
  }

  private playWhaleSong() {
    if (!this.ctx) return;
    try {
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const filter = this.ctx.createBiquadFilter();
      const gain = this.ctx.createGain();

      const baseFreq = 80 + Math.random() * 60;
      osc.type = 'sine';
      osc.frequency.setValueAtTime(baseFreq, now);
      osc.frequency.exponentialRampToValueAtTime(baseFreq * (1.35 + Math.random() * 0.3), now + 2.0);
      osc.frequency.exponentialRampToValueAtTime(baseFreq * 0.88, now + 4.2);

      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(200, now);

      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.linearRampToValueAtTime(0.014, now + 1.2);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 4.5);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(now);
      osc.stop(now + 4.6);
    } catch (_) {}
  }

  private playGentleBubble() {
    if (!this.ctx) return;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    const now = this.ctx.currentTime;
    const freq = 260 + Math.random() * 130;
    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, now);
    osc.frequency.exponentialRampToValueAtTime(freq * 1.5, now + 0.06);

    g.gain.setValueAtTime(0.0001, now);
    g.gain.linearRampToValueAtTime(0.012, now + 0.015);
    g.gain.exponentialRampToValueAtTime(0.0001, now + 0.06);

    osc.connect(g);
    g.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + 0.07);
  }
}
const sound = new BioSoundEngine();
let isDnaBankOpen = false;
let isCatalogOpen = false;
let selectedCatalogId: string = 'titan';
let systemMessage = '';
let systemMessageTimer = 0;

let dpr = 1;
function resize() {
  dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.floor(window.innerWidth * dpr);
  canvas.height = Math.floor(window.innerHeight * dpr);
}
window.addEventListener('resize', resize);
resize();

let hasRequestedFullscreen = false;
function requestFullscreenAndLandscape() {
  if (hasRequestedFullscreen) return;
  hasRequestedFullscreen = true;
  const isTouch = ('ontouchstart' in window) || navigator.maxTouchPoints > 0;
  if (!isTouch) return;

  const docEl = document.documentElement as any;
  const reqFs = docEl.requestFullscreen || docEl.webkitRequestFullscreen || docEl.mozRequestFullScreen || docEl.msRequestFullscreen;
  if (reqFs && !document.fullscreenElement) {
    reqFs.call(docEl).then(() => {
      try {
        const orientation = screen.orientation || (screen as any).mozOrientation || (screen as any).msOrientation;
        if (orientation && orientation.lock) {
          orientation.lock('landscape').catch(() => {});
        }
      } catch (_) {}
    }).catch(() => {});
  }
}

let touchHoldTimer: any = null;
let touchHoldStartX = 0;
let touchHoldStartY = 0;

const world = new EcosystemWorld();
if (window.location.hash.length > 5) {
  world.importUrlHash(window.location.hash);
}

let camX = world.width / 2 - window.innerWidth / 2;
let camY = world.height / 2 - window.innerHeight / 2;
let targetCamX = camX;
let targetCamY = camY;
let zoom = 0.85;
let targetZoom = 0.85;

let isPanning = false;
let panStartX = 0;
let panStartY = 0;
let isMouseDown = false;
let mouseScreenX = 0;
let mouseScreenY = 0;
let idleTimer = 0;
let autoCinematic = false;

export type GodTool = 'inspect' | 'feed_all' | 'meteor' | 'spawn_larva' | 'spawn_apex';

let currentTool: GodTool = 'inspect';
let isToolMenuOpen = false;
let isResetConfirming = false;
let selectedCreature: Creature | null = null;
const keysDown: Record<string, boolean> = {};

window.addEventListener('keydown', (e) => {
  sound.init();
  const k = e.key ? e.key.toLowerCase() : '';
  const code = e.code || '';
  keysDown[k] = true;
  if (code) keysDown[code.toLowerCase()] = true;
  idleTimer = 0;
  autoCinematic = false;

  const is1 = k === '1' || k === '１' || code === 'Digit1' || code === 'Numpad1';
  const is2 = k === '2' || k === '２' || code === 'Digit2' || code === 'Numpad2';
  const is3 = k === '3' || k === '３' || code === 'Digit3' || code === 'Numpad3';
  const is4 = k === '4' || k === '４' || code === 'Digit4' || code === 'Numpad4';
  const is5 = k === '5' || k === '５' || code === 'Digit5' || code === 'Numpad5';
  const is6 = k === '6' || k === '６' || code === 'Digit6' || code === 'Numpad6';
  const is7 = k === '7' || k === '７' || code === 'Digit7' || code === 'Numpad7';
  const is8 = k === '8' || k === '８' || code === 'Digit8' || code === 'Numpad8';

  if (is1) { currentTool = 'inspect'; isToolMenuOpen = false; isDnaBankOpen = false; isCatalogOpen = false; isResetConfirming = false; }
  if (is2) { currentTool = 'feed_all'; isToolMenuOpen = false; isDnaBankOpen = false; isCatalogOpen = false; isResetConfirming = false; }
  if (is3) { currentTool = 'meteor'; isToolMenuOpen = false; isDnaBankOpen = false; isCatalogOpen = false; isResetConfirming = false; }
  if (is4) { currentTool = 'spawn_larva'; isToolMenuOpen = false; isDnaBankOpen = false; isCatalogOpen = false; isResetConfirming = false; }
  if (is5) { currentTool = 'spawn_apex'; isToolMenuOpen = false; isDnaBankOpen = false; isCatalogOpen = false; isResetConfirming = false; }
  if (is6) { isDnaBankOpen = !isDnaBankOpen; isCatalogOpen = false; isToolMenuOpen = false; isResetConfirming = false; }
  if (is7) { isCatalogOpen = !isCatalogOpen; isDnaBankOpen = false; isToolMenuOpen = false; isResetConfirming = false; }
  if (is8) { isResetConfirming = true; isToolMenuOpen = false; isDnaBankOpen = false; isCatalogOpen = false; }

  if (k === 't' || code === 'KeyT') {
    isToolMenuOpen = !isToolMenuOpen;
    isResetConfirming = false;
    isDnaBankOpen = false;
    isCatalogOpen = false;
  }
  if (k === 'escape' || code === 'Escape') {
    isToolMenuOpen = false;
    isDnaBankOpen = false;
    isCatalogOpen = false;
    isResetConfirming = false;
    selectedCreature = null;
  }

  if (k === 'z' || code === 'KeyZ') world.timeScale = 0;
  if (k === 'x' || code === 'KeyX') world.timeScale = 0.5;
  if (k === 'c' || code === 'KeyC') world.timeScale = 1.0;
  if (k === 'v' || code === 'KeyV') world.timeScale = 2.5;
  if (k === 'b' || code === 'KeyB') world.timeScale = 6.0;
  if (k === 'p' || code === 'KeyP') world.timeScale = world.timeScale === 0 ? 1.0 : 0;

  if (k === ' ' || code === 'Space') {
    selectedCreature = null;
    targetCamX = world.width / 2 - canvas.width / (2 * zoom);
    targetCamY = world.height / 2 - canvas.height / (2 * zoom);
  }
});

window.addEventListener('keyup', (e) => {
  const k = e.key ? e.key.toLowerCase() : '';
  const code = e.code ? e.code.toLowerCase() : '';
  if (k) keysDown[k] = false;
  if (code) keysDown[code] = false;
});

canvas.addEventListener('wheel', (e) => {
  e.preventDefault();
  idleTimer = 0;
  autoCinematic = false;
  const minZoom = Math.max(window.innerWidth / world.width, window.innerHeight / world.height);
  const zoomFactor = e.deltaY < 0 ? 1.15 : 0.87;
  targetZoom = Math.min(3.2, Math.max(minZoom, targetZoom * zoomFactor));
}, { passive: false });

function screenToWorld(sx: number, sy: number) {
  return {
    x: sx / zoom + camX,
    y: sy / zoom + camY
  };
}
function isInView(wx: number, wy: number, radius = 60): boolean {
  const margin = radius * zoom;
  const sx = (wx - camX) * zoom;
  const sy = (wy - camY) * zoom;
  return sx >= -margin && sx <= window.innerWidth + margin && sy >= -margin && sy <= window.innerHeight + margin;
}

function applyGodPower(wx: number, wy: number) {
  if (currentTool === 'inspect') {
    let nearest: Creature | null = null;
    let minDist = 45 / zoom;
    for (const c of world.creatures) {
      const dist = Math.hypot(c.x - wx, c.y - wy);
      if (dist < minDist) {
        minDist = dist;
        nearest = c;
      }
    }
    selectedCreature = nearest;
  } else if (currentTool === 'feed_all') {
    for (let i = 0; i < 3; i++) {
      world.spawnPlant(wx + (Math.random() - 0.5) * 50, wy + (Math.random() - 0.5) * 50, 'algae');
      world.spawnPlant(wx + (Math.random() - 0.5) * 50, wy + (Math.random() - 0.5) * 50, 'meat_remains');
      world.spawnPlant(wx + (Math.random() - 0.5) * 50, wy + (Math.random() - 0.5) * 50, 'marine_snow');
      world.spawnPlant(wx + (Math.random() - 0.5) * 50, wy + (Math.random() - 0.5) * 50, 'biolume_plankton');
    }
  } else if (currentTool === 'meteor') {
    world.applyMeteor(wx, wy, 130);
  } else if (currentTool === 'spawn_larva') {
    const type = Math.random() < 0.8 ? 'herbivore' : 'carnivore';
    world.spawnCreature(type, wx, wy, 1, undefined, undefined, 'larva');
  } else if (currentTool === 'spawn_apex') {
    world.spawnCreature('chimera', wx, wy, 1, undefined, undefined, 'adult');
    world.addShockwave(wx, wy, 180, 'rgba(56, 189, 248, 0.85)');
  }
}

canvas.addEventListener('mousedown', (e) => {
  sound.init();
  idleTimer = 0;
  autoCinematic = false;
  mouseScreenX = e.clientX;
  mouseScreenY = e.clientY;

  if (e.button === 1 || (e.button === 0 && keysDown[' '])) {
    isPanning = true;
    panStartX = e.clientX;
    panStartY = e.clientY;
    return;
  }

  if (e.button === 0) {
    const mx = e.clientX;
    const my = e.clientY;
    const viewW = window.innerWidth;
    const viewH = window.innerHeight;
    const isCompact = viewW <= 768 || viewH <= 500;
    const tCtrlX = isCompact ? viewW - 136 : viewW - 198;
    const tCtrlY = isCompact ? 6 : 16;
    const tBtnW = isCompact ? 28 : 40;
    const tBtnH = isCompact ? 20 : 24;
    const tGap = isCompact ? 4 : 6;
    const timeSpeeds = [0, 1.0, 2.5, 5.0];

    for (let sIdx = 0; sIdx < timeSpeeds.length; sIdx++) {
      const bx = tCtrlX + sIdx * (tBtnW + tGap);
      if (mx >= bx && mx <= bx + tBtnW && my >= tCtrlY && my <= tCtrlY + tBtnH) {
        world.timeScale = timeSpeeds[sIdx];
        return;
      }
    }

    if (isDnaBankOpen) {
      const bW = isCompact ? 300 : 360, bH = isCompact ? 190 : 230;
      const bX = (viewW - bW) / 2, bY = (viewH - bH) / 2;

      for (let s = 1; s <= 3; s++) {
        const sy = bY + 28 + (s - 1) * (isCompact ? 42 : 48);
        if (mx >= bX + bW - 100 && mx <= bX + bW - 60 && my >= sy + 6 && my <= sy + 28) {
          world.saveWorldState(s);
          systemMessage = `Saved to Slot ${s}`;
          systemMessageTimer = 2.0;
          return;
        }
        if (mx >= bX + bW - 52 && mx <= bX + bW - 12 && my >= sy + 6 && my <= sy + 28) {
          if (world.loadWorldState(s)) {
            systemMessage = `Loaded Slot ${s}`;
            selectedCreature = null;
          } else {
            systemMessage = `Slot ${s} is empty`;
          }
          systemMessageTimer = 2.0;
          return;
        }
      }
      const botY = bY + bH - 26;
      if (mx >= bX + bW - 70 && mx <= bX + bW - 12 && my >= botY && my <= botY + 18) {
        isDnaBankOpen = false;
        return;
      }
      return;
    }
    if (isCatalogOpen) {
      const cW = isCompact ? Math.min(viewW - 16, 520) : 660;
      const cH = isCompact ? Math.min(viewH - 16, 280) : 400;
      const cX = (viewW - cW) / 2, cY = (viewH - cH) / 2;
      const btnW = isCompact ? 50 : 65;
      const btnH = isCompact ? 18 : 24;
      const btnX = cX + cW - btnW - 10;
      const btnY = cY + cH - btnH - 8;
      if (mx >= btnX && mx <= btnX + btnW && my >= btnY && my <= btnY + btnH) {
        isCatalogOpen = false;
        return;
      }
      const listX = cX + 10;
      const listY = cY + 28;
      const cols = 3;
      const itemW = isCompact ? 64 : 104;
      const itemH = isCompact ? 32 : 48;
      const gapX = isCompact ? 4 : 6;
      const gapY = isCompact ? 4 : 6;

      for (let idx = 0; idx < SPECIES_CATALOG.length; idx++) {
        const c = idx % cols;
        const r = Math.floor(idx / cols);
        const ix = listX + c * (itemW + gapX);
        const iy = listY + r * (itemH + gapY);
        if (mx >= ix && mx <= ix + itemW && my >= iy && my <= iy + itemH) {
          selectedCatalogId = SPECIES_CATALOG[idx].id;
          return;
        }
      }
      return;
    }
    if (isResetConfirming) {
      const dW = 260, dH = 100;
      const dX = (viewW - dW) / 2;
      const dY = (viewH - dH) / 2;
      if (mx >= dX + 20 && mx <= dX + 115 && my >= dY + 52 && my <= dY + 84) {
        world.initWorld();
        selectedCreature = null;
        isResetConfirming = false;
        isToolMenuOpen = false;
        return;
      }
      if (mx >= dX + 145 && mx <= dX + 240 && my >= dY + 52 && my <= dY + 84) {
        isResetConfirming = false;
        return;
      }
      isResetConfirming = false;
      return;
    }
    const tabW = isCompact ? 130 : 160;
    const tabH = isCompact ? 26 : 36;
    const tabX = (viewW - tabW) / 2;
    const tabY = viewH - (isCompact ? 30 : 46);

    if (mx >= tabX && mx <= tabX + tabW && my >= tabY && my <= tabY + tabH) {
      isToolMenuOpen = !isToolMenuOpen;
      return;
    }
    if (isToolMenuOpen) {
      const menuW = isCompact ? 150 : 190;
      const itemH = isCompact ? 22 : 30;
      const menuH = itemH * 8 + 8;
      const menuX = (viewW - menuW) / 2;
      const menuY = tabY - menuH - 4;

      if (mx >= menuX && mx <= menuX + menuW && my >= menuY && my <= menuY + menuH) {
        const itemIdx = Math.floor((my - (menuY + 4)) / itemH);
        if (itemIdx === 0) { currentTool = 'inspect'; isToolMenuOpen = false; }
        else if (itemIdx === 1) { currentTool = 'feed_all'; isToolMenuOpen = false; }
        else if (itemIdx === 2) { currentTool = 'meteor'; isToolMenuOpen = false; }
        else if (itemIdx === 3) { currentTool = 'spawn_larva'; isToolMenuOpen = false; }
        else if (itemIdx === 4) { currentTool = 'spawn_apex'; isToolMenuOpen = false; }
        else if (itemIdx === 5) { isDnaBankOpen = true; isToolMenuOpen = false; }
        else if (itemIdx === 6) { isCatalogOpen = true; isToolMenuOpen = false; }
        else if (itemIdx === 7) { isResetConfirming = true; isToolMenuOpen = false; }
        return;
      } else {
        isToolMenuOpen = false;
      }
    }
    isMouseDown = true;
    const wp = screenToWorld(e.clientX, e.clientY);
    applyGodPower(wp.x, wp.y);
  }
});

window.addEventListener('mousemove', (e) => {
  idleTimer = 0;
  mouseScreenX = e.clientX;
  mouseScreenY = e.clientY;

  if (isPanning) {
    targetCamX -= (e.clientX - panStartX) / zoom;
    targetCamY -= (e.clientY - panStartY) / zoom;
    panStartX = e.clientX;
    panStartY = e.clientY;
    return;
  }
  if (isMouseDown && currentTool !== 'inspect' && currentTool !== 'meteor') {
    const wp = screenToWorld(e.clientX, e.clientY);
    applyGodPower(wp.x, wp.y);
  }
});

window.addEventListener('mouseup', () => {
  isPanning = false;
  isMouseDown = false;
});
canvas.addEventListener('contextmenu', (e) => e.preventDefault());
let touchStartDist = 0;
let touchStartZoom = zoom;
let touchPanStartX = 0;
let touchPanStartY = 0;
let isTouchPanning = false;

canvas.addEventListener('touchstart', (e) => {
  sound.init();
  requestFullscreenAndLandscape();
  idleTimer = 0;
  autoCinematic = false;

  const viewW = window.innerWidth;
  const viewH = window.innerHeight;
  const isCompact = viewW <= 768 || viewH <= 500;

  if (e.touches.length === 1) {
    const t = e.touches[0];
    const mx = t.clientX;
    const my = t.clientY;
    const tCtrlX = isCompact ? viewW - 136 : viewW - 198;
    const tCtrlY = isCompact ? 6 : 16;
    const tBtnW = isCompact ? 28 : 40;
    const tBtnH = isCompact ? 20 : 24;
    const tGap = isCompact ? 4 : 6;
    const timeSpeeds = [0, 1.0, 2.5, 5.0];

    for (let sIdx = 0; sIdx < timeSpeeds.length; sIdx++) {
      const bx = tCtrlX + sIdx * (tBtnW + tGap);
      if (mx >= bx && mx <= bx + tBtnW && my >= tCtrlY && my <= tCtrlY + tBtnH) {
        world.timeScale = timeSpeeds[sIdx];
        e.preventDefault();
        return;
      }
    }


    if (isResetConfirming) {
      const dW = isCompact ? 250 : 280;
      const dH = isCompact ? 90 : 110;
      const dX = (viewW - dW) / 2;
      const dY = (viewH - dH) / 2;

      if (mx >= dX + 15 && mx <= dX + dW / 2 - 10 && my >= dY + dH - 45 && my <= dY + dH - 5) {
        world.initWorld();
        selectedCreature = null;
        isResetConfirming = false;
        isToolMenuOpen = false;
        e.preventDefault();
        return;
      }
      if (mx >= dX + dW / 2 + 10 && mx <= dX + dW - 15 && my >= dY + dH - 45 && my <= dY + dH - 5) {
        isResetConfirming = false;
        e.preventDefault();
        return;
      }
      isResetConfirming = false;
      e.preventDefault();
      return;
    }
    const tabW = isCompact ? 130 : 160;
    const tabH = isCompact ? 26 : 36;
    const tabX = (viewW - tabW) / 2;
    const tabY = viewH - (isCompact ? 30 : 46);

    if (mx >= tabX && mx <= tabX + tabW && my >= tabY && my <= tabY + tabH) {
      isToolMenuOpen = !isToolMenuOpen;
      e.preventDefault();
      return;
    }
    if (isDnaBankOpen) {
      const dW = isCompact ? 300 : 360, dH = isCompact ? 190 : 230;
      const dX = (viewW - dW) / 2, dY = (viewH - dH) / 2;
      for (let s = 1; s <= 3; s++) {
        const sy = dY + 28 + (s - 1) * (isCompact ? 42 : 48);
        if (mx >= dX + dW - 105 && mx <= dX + dW - 63 && my >= sy + 4 && my <= sy + 30) {
          world.saveWorldState(s);
          systemMessage = `Saved Slot ${s}`;
          systemMessageTimer = 2.0;
          e.preventDefault(); return;
        }
        if (mx >= dX + dW - 55 && mx <= dX + dW - 13 && my >= sy + 4 && my <= sy + 30) {
          if (world.loadWorldState(s)) {
            systemMessage = `Loaded Slot ${s}`;
            selectedCreature = null;
          } else {
            systemMessage = `Slot ${s} empty`;
          }
          systemMessageTimer = 2.0;
          e.preventDefault(); return;
        }
      }
      const botY = dY + dH - 26;
      if (mx >= dX + dW - 76 && mx <= dX + dW - 6 && my >= botY - 6 && my <= botY + 24) {
        isDnaBankOpen = false;
        e.preventDefault(); return;
      }
      e.preventDefault();
      return;
    }

    if (isCatalogOpen) {
      const cW = isCompact ? Math.min(viewW - 16, 520) : 660;
      const cH = isCompact ? Math.min(viewH - 16, 280) : 400;
      const cX = (viewW - cW) / 2, cY = (viewH - cH) / 2;
      const btnW = isCompact ? 50 : 65;
      const btnH = isCompact ? 18 : 24;
      const btnX = cX + cW - btnW - 10;
      const btnY = cY + cH - btnH - 8;

      if (mx >= btnX - 6 && mx <= btnX + btnW + 6 && my >= btnY - 6 && my <= btnY + btnH + 6) {
        isCatalogOpen = false;
        e.preventDefault();
        return;
      }

      const listX = cX + 10;
      const listY = cY + 28;
      const cols = 3;
      const itemW = isCompact ? 64 : 104;
      const itemH = isCompact ? 32 : 48;
      const gapX = isCompact ? 4 : 6;
      const gapY = isCompact ? 4 : 6;

      for (let idx = 0; idx < SPECIES_CATALOG.length; idx++) {
        const c = idx % cols;
        const r = Math.floor(idx / cols);
        const ix = listX + c * (itemW + gapX);
        const iy = listY + r * (itemH + gapY);
        if (mx >= ix && mx <= ix + itemW && my >= iy && my <= iy + itemH) {
          selectedCatalogId = SPECIES_CATALOG[idx].id;
          e.preventDefault();
          return;
        }
      }
      e.preventDefault();
      return;
    }

    if (isToolMenuOpen) {
      const menuW = isCompact ? 150 : 190;
      const itemH = isCompact ? 22 : 30;
      const menuH = itemH * 8 + 8;
      const menuX = (viewW - menuW) / 2;
      const menuY = tabY - menuH - 4;

      if (mx >= menuX && mx <= menuX + menuW && my >= menuY && my <= menuY + menuH) {
        const itemIdx = Math.floor((my - (menuY + 4)) / itemH);
        if (itemIdx === 0) { currentTool = 'inspect'; isToolMenuOpen = false; }
        else if (itemIdx === 1) { currentTool = 'feed_all'; isToolMenuOpen = false; }
        else if (itemIdx === 2) { currentTool = 'meteor'; isToolMenuOpen = false; }
        else if (itemIdx === 3) { currentTool = 'spawn_larva'; isToolMenuOpen = false; }
        else if (itemIdx === 4) { currentTool = 'spawn_apex'; isToolMenuOpen = false; }
        else if (itemIdx === 5) { isDnaBankOpen = true; isToolMenuOpen = false; }
        else if (itemIdx === 6) { isCatalogOpen = true; isToolMenuOpen = false; }
        else if (itemIdx === 7) { isResetConfirming = true; isToolMenuOpen = false; }
        e.preventDefault();
        return;
      } else {
        isToolMenuOpen = false;
      }
    }

    if (selectedCreature) {
      selectedCreature = null;
    }

    isTouchPanning = true;
    touchPanStartX = mx;
    touchPanStartY = my;
    touchHoldStartX = mx;
    touchHoldStartY = my;

    if (touchHoldTimer) {
      clearTimeout(touchHoldTimer);
      touchHoldTimer = null;
    }

    if (currentTool === 'inspect') {
      touchHoldTimer = setTimeout(() => {
        const wp = screenToWorld(mx, my);
        applyGodPower(wp.x, wp.y);
        if (navigator.vibrate) navigator.vibrate(30);
      }, 300);
    } else {
      const wp = screenToWorld(mx, my);
      applyGodPower(wp.x, wp.y);
    }
  } else if (e.touches.length === 2) {
    if (touchHoldTimer) {
      clearTimeout(touchHoldTimer);
      touchHoldTimer = null;
    }
    isTouchPanning = false;
    const t1 = e.touches[0];
    const t2 = e.touches[1];
    touchStartDist = Math.hypot(t1.clientX - t2.clientX, t1.clientY - t2.clientY);
    touchStartZoom = targetZoom;
    touchPanStartX = (t1.clientX + t2.clientX) / 2;
    touchPanStartY = (t1.clientY + t2.clientY) / 2;
  }
  e.preventDefault();
}, { passive: false });

canvas.addEventListener('touchmove', (e) => {
  idleTimer = 0;
  if (e.touches.length === 1) {
    const t = e.touches[0];
    const mx = t.clientX;
    const my = t.clientY;

    if (touchHoldTimer && Math.hypot(mx - touchHoldStartX, my - touchHoldStartY) > 10) {
      clearTimeout(touchHoldTimer);
      touchHoldTimer = null;
    }

    if (isTouchPanning) {
      targetCamX -= (mx - touchPanStartX) / zoom;
      targetCamY -= (my - touchPanStartY) / zoom;
      touchPanStartX = mx;
      touchPanStartY = my;
    } else if (currentTool !== 'inspect' && currentTool !== 'meteor') {
      const wp = screenToWorld(mx, my);
      applyGodPower(wp.x, wp.y);
    }
  } else if (e.touches.length === 2) {
    if (touchHoldTimer) {
      clearTimeout(touchHoldTimer);
      touchHoldTimer = null;
    }
    const t1 = e.touches[0];
    const t2 = e.touches[1];
    const dist = Math.hypot(t1.clientX - t2.clientX, t1.clientY - t2.clientY);
    if (touchStartDist > 0) {
      const minZoom = Math.max(viewW / world.width, viewH / world.height);
      const factor = dist / touchStartDist;
      targetZoom = Math.min(3.2, Math.max(minZoom, touchStartZoom * factor));
    }
    const midX = (t1.clientX + t2.clientX) / 2;
    const midY = (t1.clientY + t2.clientY) / 2;
    targetCamX -= (midX - touchPanStartX) / zoom;
    targetCamY -= (midY - touchPanStartY) / zoom;
    touchPanStartX = midX;
    touchPanStartY = midY;
  }
  e.preventDefault();
}, { passive: false });

canvas.addEventListener('touchend', (e) => {
  if (touchHoldTimer) {
    clearTimeout(touchHoldTimer);
    touchHoldTimer = null;
  }
  if (e.touches.length === 0) {
    isTouchPanning = false;
    touchStartDist = 0;
  } else if (e.touches.length === 1) {
    touchStartDist = 0;
    touchPanStartX = e.touches[0].clientX;
    touchPanStartY = e.touches[0].clientY;
  }
});
function drawEgg(egg: Egg) {
  ctx.save();
  ctx.translate(egg.x, egg.y);
  const pulse = Math.sin(world.totalTime * 4 + egg.id) * 0.15;
  const r = egg.size * (1 + pulse);

  ctx.fillStyle = 'rgba(254, 240, 138, 0.45)';
  ctx.strokeStyle = '#fef08a';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = '#f59e0b';
  ctx.beginPath();
  ctx.arc(0, 0, r * 0.45, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}
function drawSolarJelly(c: Creature, isSilhouette = false) {
  ctx.save();
  ctx.translate(c.x, c.y);
  ctx.rotate(c.angle);

  const pulse = Math.sin(c.pulsePhase);
  const bellScaleX = 1.0 + pulse * 0.18;
  const bellScaleY = 1.0 - pulse * 0.12;
  const currentSize = c.dna.size * (0.35 + 0.65 * c.growth);
  const isLarva = c.stage === 'larva';
  const tentacleCount = isLarva ? 3 : 6;

  for (let t = 0; t < tentacleCount; t++) {
    const normT = (t - (tentacleCount - 1) / 2) / Math.max(1, tentacleCount - 1);
    const startY = normT * (currentSize * 0.75);
    const wave1 = Math.sin(c.pulsePhase * 1.6 + t * 0.9) * (currentSize * 0.5);
    const wave2 = Math.cos(c.pulsePhase * 1.2 + t * 1.1) * (currentSize * 0.65);

    ctx.strokeStyle = isSilhouette
      ? '#334155'
      : `rgba(52, 211, 153, ${0.35 + 0.3 * (1 - Math.abs(normT))})`;
    ctx.lineWidth = isLarva ? 0.9 : 1.3;
    ctx.beginPath();
    ctx.moveTo(-currentSize * 0.3, startY);
    ctx.bezierCurveTo(
      -currentSize * 1.6, startY + wave1,
      -currentSize * 2.8, startY - wave2,
      -currentSize * 4.2, startY + wave1 * 1.4
    );
    ctx.stroke();

    if (!isSilhouette && t % 2 === 0) {
      ctx.fillStyle = 'rgba(110, 231, 183, 0.7)';
      ctx.beginPath();
      ctx.arc(-currentSize * 4.2, startY + wave1 * 1.4, 1.3, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  ctx.save();
  ctx.scale(bellScaleX, bellScaleY);

  ctx.fillStyle = isSilhouette
    ? '#0f172a'
    : (isLarva ? 'rgba(52, 211, 153, 0.22)' : 'rgba(16, 185, 129, 0.32)');
  ctx.strokeStyle = isSilhouette ? '#334155' : 'rgba(110, 231, 183, 0.85)';
  ctx.lineWidth = 1.3;

  ctx.beginPath();
  ctx.moveTo(currentSize * 1.5, 0);
  ctx.bezierCurveTo(currentSize * 1.4, currentSize * 1.2, -currentSize * 0.1, currentSize * 1.35, -currentSize * 0.35, currentSize * 0.85);
  const lobes = 4;
  for (let i = 0; i <= lobes; i++) {
    const py = currentSize * 0.85 - (i / lobes) * (currentSize * 1.7);
    const px = -currentSize * 0.35 + (i % 2 === 0 ? -currentSize * 0.15 : currentSize * 0.05);
    ctx.lineTo(px, py);
  }
  ctx.bezierCurveTo(-currentSize * 0.1, -currentSize * 1.35, currentSize * 1.4, -currentSize * 1.2, currentSize * 1.5, 0);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  if (!isSilhouette) {
    const coreGrad = ctx.createRadialGradient(currentSize * 0.2, 0, 1, currentSize * 0.2, 0, currentSize * 0.85);
    coreGrad.addColorStop(0, 'rgba(255, 255, 255, 0.9)');
    coreGrad.addColorStop(0.35, 'rgba(52, 211, 153, 0.7)');
    coreGrad.addColorStop(1, 'rgba(5, 150, 105, 0)');
    ctx.fillStyle = coreGrad;
    ctx.beginPath();
    ctx.arc(currentSize * 0.2, 0, currentSize * 0.8, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();

  ctx.restore();
}
function drawScavenger(c: Creature, isSilhouette = false) {
  ctx.save();
  ctx.translate(c.x, c.y);
  ctx.rotate(c.angle);

  const currentSize = c.dna.size * (0.35 + 0.65 * c.growth);
  const isLarva = c.stage === 'larva';

  ctx.strokeStyle = isSilhouette ? '#334155' : 'rgba(180, 100, 30, 0.85)';
  ctx.lineWidth = isLarva ? 0.9 : 1.4;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  const legCount = isLarva ? 3 : 5;
  for (let side = -1; side <= 1; side += 2) {
    for (let l = 0; l < legCount; l++) {
      const normL = (l - (legCount - 1) / 2) * (currentSize * 0.45);
      const phase = c.legPhase + l * 1.1 + (side === 1 ? Math.PI : 0);
      const jointX = normL + Math.cos(phase) * (currentSize * 0.3);
      const jointY = side * (currentSize * 0.85 + Math.abs(Math.sin(phase)) * (currentSize * 0.25));
      const tipX = jointX - currentSize * 0.2 + Math.cos(phase) * (currentSize * 0.25);
      const tipY = side * (currentSize * 1.5 + Math.sin(phase) * (currentSize * 0.3));

      ctx.beginPath();
      ctx.moveTo(normL, side * currentSize * 0.45);
      ctx.lineTo(jointX, jointY);
      ctx.lineTo(tipX, tipY);
      ctx.stroke();
    }
  }

  if (!isLarva) {
    ctx.strokeStyle = isSilhouette ? '#334155' : 'rgba(217, 119, 6, 0.7)';
    ctx.lineWidth = 1.0;
    const antWave = Math.sin(c.legPhase * 0.8) * 0.15;
    for (let side = -1; side <= 1; side += 2) {
      ctx.beginPath();
      ctx.moveTo(currentSize * 1.2, side * currentSize * 0.25);
      ctx.quadraticCurveTo(currentSize * 2.1, side * (currentSize * 0.85 + antWave * currentSize), currentSize * 2.7, side * (currentSize * 1.2));
      ctx.stroke();
    }
  }

  const plateCount = isLarva ? 2 : 5;
  for (let p = plateCount - 1; p >= 0; p--) {
    const t = p / plateCount;
    const px = (p - (plateCount - 1) / 2) * (currentSize * 0.52);
    const pWidth = currentSize * (1.22 - t * 0.42);
    const pHeight = currentSize * (1.02 - t * 0.32);

    ctx.fillStyle = isSilhouette ? '#0f172a' : `rgb(${Math.floor(135 - p * 7)}, ${Math.floor(75 - p * 5)}, ${Math.floor(28 - p * 3)})`;
    ctx.strokeStyle = isSilhouette ? '#334155' : '#d97706';
    ctx.lineWidth = 1.2;

    ctx.beginPath();
    ctx.ellipse(px, 0, pWidth, pHeight, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    if (!isSilhouette) {
      ctx.strokeStyle = 'rgba(251, 191, 36, 0.35)';
      ctx.lineWidth = 0.9;
      ctx.beginPath();
      ctx.arc(px, 0, pHeight * 0.45, -Math.PI * 0.4, Math.PI * 0.4);
      ctx.stroke();
    }
  }

  if (!isSilhouette) {
    ctx.fillStyle = '#06b6d4';
    for (let side = -1; side <= 1; side += 2) {
      ctx.beginPath();
      ctx.arc(currentSize * 1.05, side * currentSize * 0.4, Math.max(1.2, currentSize * 0.15), 0, Math.PI * 2);
      ctx.fill();
    }
  }

  ctx.restore();
}
function drawLeviathan(c: Creature, isSilhouette = false) {
  ctx.save();
  const currentSize = c.dna.size * (0.46 + 0.54 * c.growth);
  const isLunging = (c.lungeTimer || 0) > 0;
  const mouthGape = Math.min(1.0, (c.biteAnimTimer || 0) * 1.8);
  const warning = c.warningSignal || 0;
  const bristle = isLunging ? 1.0 : Math.min(1.0, warning * 1.6);
  if (!isSilhouette) {
    const auraRadius = currentSize * (isLunging ? 5.2 : 3.8);
    const glowGrad = ctx.createRadialGradient(c.x, c.y, currentSize * 0.3, c.x, c.y, auraRadius);
    glowGrad.addColorStop(0, isLunging ? 'rgba(56, 189, 248, 0.42)' : 'rgba(6, 182, 212, 0.28)');
    glowGrad.addColorStop(0.35, isLunging ? 'rgba(14, 116, 144, 0.24)' : 'rgba(2, 44, 84, 0.16)');
    glowGrad.addColorStop(0.7, 'rgba(1, 15, 36, 0.08)');
    glowGrad.addColorStop(1, 'rgba(0, 2, 6, 0)');
    ctx.fillStyle = glowGrad;
    ctx.beginPath();
    ctx.arc(c.x, c.y, auraRadius, 0, Math.PI * 2);
    ctx.fill();
  }
  if (c.tailNodes.length > 1) {
    const totalSegs = c.tailNodes.length;
    if (!isSilhouette) {
      for (let i = totalSegs - 1; i >= 1; i--) {
        const node = c.tailNodes[i];
        const prev = c.tailNodes[i - 1];
        const t = i / totalSegs;
        const segAngle = Math.atan2(node.y - prev.y, node.x - prev.x);
        const nodeSize = currentSize * (1.25 - t * 0.7);
        const wave = Math.sin(c.finPhase * 1.2 + i * 0.55) * (nodeSize * 0.35);

        ctx.save();
        ctx.translate(node.x, node.y);
        ctx.rotate(segAngle);

        for (let s = -1; s <= 1; s += 2) {
          const frillW = nodeSize * (1.5 + (1 - t) * 1.1 + bristle * 0.5);
          const frillH = nodeSize * (1.1 + (1 - t) * 0.7 + bristle * 0.4);
          ctx.save();
          ctx.scale(1, s);

          const frillGrad = ctx.createLinearGradient(0, 0, -frillW * 0.8, frillH);
          frillGrad.addColorStop(0, isLunging ? 'rgba(56, 189, 248, 0.48)' : 'rgba(14, 165, 233, 0.35)');
          frillGrad.addColorStop(0.5, 'rgba(2, 44, 84, 0.22)');
          frillGrad.addColorStop(1, 'rgba(1, 10, 28, 0)');

          ctx.fillStyle = frillGrad;
          ctx.beginPath();
          ctx.moveTo(nodeSize * 0.35, nodeSize * 0.35);
          ctx.bezierCurveTo(0, frillH * 0.8 + wave, -frillW * 0.6, frillH * 1.1 + wave, -frillW, frillH * 0.5 + wave);
          ctx.quadraticCurveTo(-nodeSize * 0.8, nodeSize * 0.3, -nodeSize * 0.5, nodeSize * 0.2);
          ctx.closePath();
          ctx.fill();

          ctx.strokeStyle = 'rgba(186, 230, 253, 0.45)';
          ctx.lineWidth = 0.85;
          ctx.beginPath();
          ctx.moveTo(nodeSize * 0.2, nodeSize * 0.35);
          ctx.quadraticCurveTo(-frillW * 0.4, frillH * 0.8 + wave, -frillW * 0.9, frillH * 0.5 + wave);
          ctx.stroke();

          ctx.restore();
        }
        ctx.restore();
      }
    }
    for (let i = totalSegs - 1; i >= 1; i--) {
      const node = c.tailNodes[i];
      const prev = c.tailNodes[i - 1];
      const t = i / totalSegs;
      const nodeSize = currentSize * (1.25 - t * 0.7);
      const segAngle = Math.atan2(node.y - prev.y, node.x - prev.x);
      const tailWave = Math.sin(c.finPhase * 1.1 + i * 0.45) * (nodeSize * 0.3);

      ctx.save();
      ctx.translate(node.x, node.y);
      ctx.rotate(segAngle);
      if (i === totalSegs - 1) {
        ctx.fillStyle = isSilhouette ? '#0f172a' : '#010814';
        ctx.strokeStyle = isSilhouette ? '#334155' : (isLunging ? '#7dd3fc' : '#38bdf8');
        ctx.lineWidth = 2.4;

        const tailSpread = 1.0 + bristle * 0.35;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.bezierCurveTo(-nodeSize * 2.2, (-nodeSize * 3.6 + tailWave) * tailSpread, -nodeSize * 5.0, (-nodeSize * 3.2 + tailWave) * tailSpread, -nodeSize * 7.2, (-nodeSize * 1.8 + tailWave) * tailSpread);
        ctx.lineTo(-nodeSize * 4.2, tailWave);
        ctx.lineTo(-nodeSize * (8.2 + bristle * 1.5), tailWave);
        ctx.lineTo(-nodeSize * 4.2, tailWave);
        ctx.bezierCurveTo(-nodeSize * 5.0, (nodeSize * 3.2 + tailWave) * tailSpread, -nodeSize * 2.2, (nodeSize * 3.6 + tailWave) * tailSpread, 0, 0);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        if (!isSilhouette) {
          ctx.strokeStyle = 'rgba(56, 189, 248, 0.85)';
          ctx.lineWidth = 1.5;
          for (let ray = -3; ray <= 3; ray++) {
            ctx.beginPath();
            ctx.moveTo(0, 0);
            ctx.quadraticCurveTo(-nodeSize * 3.2, (ray * nodeSize * 0.75 + tailWave) * tailSpread, -nodeSize * 6.5, (ray * nodeSize * 0.4 + tailWave) * tailSpread);
            ctx.stroke();
          }
        }
      }
      for (let s = -1; s <= 1; s += 2) {
        const spineAngle = (-0.35 + bristle * 0.6) * s;
        const spineLength = nodeSize * (1.2 + (1 - t) * 0.8 + bristle * 0.9);
        const spineWidth = nodeSize * 0.3;

        ctx.save();
        ctx.translate(-nodeSize * 0.2, s * nodeSize * 0.45);
        ctx.rotate(spineAngle);

        ctx.fillStyle = isSilhouette ? '#0f172a' : '#010c1c';
        ctx.strokeStyle = isSilhouette ? '#334155' : (bristle > 0.4 ? '#38bdf8' : '#0284c7');
        ctx.lineWidth = 1.6;

        ctx.beginPath();
        ctx.moveTo(-spineWidth * 0.6, 0);
        ctx.quadraticCurveTo(-spineWidth * 0.2, s * spineLength * 0.6, 0, s * spineLength); // 鋭い針先
        ctx.quadraticCurveTo(spineWidth * 0.4, s * spineLength * 0.5, spineWidth * 0.6, 0);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        if (!isSilhouette && bristle > 0.2) {
          ctx.strokeStyle = '#e0f2fe';
          ctx.lineWidth = 1.0;
          ctx.beginPath();
          ctx.moveTo(0, 0);
          ctx.lineTo(0, s * spineLength * 0.95);
          ctx.stroke();
        }
        ctx.restore();
      }
      ctx.fillStyle = isSilhouette
        ? '#0f172a'
        : `rgb(${Math.max(1, 3 - i)}, ${Math.max(6, 14 - i)}, ${Math.max(18, 38 - i * 2)})`;
      ctx.strokeStyle = isSilhouette ? '#334155' : (bristle > 0.4 ? '#38bdf8' : '#0369a1');
      ctx.lineWidth = 2.0;

      ctx.beginPath();
      ctx.ellipse(0, 0, nodeSize * 1.18, nodeSize * 0.88, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      if (!isSilhouette) {
        const pulse = 0.7 + Math.sin(c.finPhase * 1.5 - i * 0.4) * 0.3;
        ctx.fillStyle = '#38bdf8';
        ctx.globalAlpha = pulse;
        ctx.beginPath();
        ctx.arc(0, 0, Math.max(2.0, nodeSize * 0.25), 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(0, 0, Math.max(0.9, nodeSize * 0.1), 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1.0;
      }

      ctx.restore();
    }
  }
  ctx.save();
  ctx.translate(c.x, c.y);
  ctx.rotate(c.angle);
  const finFlap = Math.sin(c.finPhase * 0.85) * (isLunging ? 0.38 : 0.2);
  const finSpread = 0.35 + finFlap + bristle * 0.3; // 威嚇時に外側へ張り出す
  for (let side = -1; side <= 1; side += 2) {
    ctx.save();
    ctx.translate(-currentSize * 0.35, side * currentSize * 0.78);
    ctx.scale(1, side);
    ctx.rotate(finSpread);

    if (!isSilhouette) {
      const wingGrad = ctx.createLinearGradient(0, 0, currentSize * 0.5, currentSize * 3.2);
      wingGrad.addColorStop(0, 'rgba(2, 28, 64, 0.95)');
      wingGrad.addColorStop(0.6, 'rgba(3, 75, 125, 0.45)');
      wingGrad.addColorStop(1, 'rgba(2, 6, 23, 0)');
      ctx.fillStyle = wingGrad;
    } else {
      ctx.fillStyle = '#0f172a';
    }
    ctx.strokeStyle = isSilhouette ? '#334155' : (bristle > 0.4 ? '#7dd3fc' : '#38bdf8');
    ctx.lineWidth = 2.2;

    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.bezierCurveTo(currentSize * 1.4, currentSize * 0.9, currentSize * 0.9, currentSize * 2.9, -currentSize * 1.1, currentSize * 3.1);
    ctx.lineTo(-currentSize * 0.5, currentSize * 2.2);
    ctx.lineTo(-currentSize * 1.3, currentSize * 2.3);
    ctx.bezierCurveTo(-currentSize * 1.1, currentSize * 1.2, -currentSize * 0.7, currentSize * 0.5, -currentSize * 0.3, 0);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    if (!isSilhouette) {
      ctx.strokeStyle = 'rgba(56, 189, 248, 0.85)';
      ctx.lineWidth = 1.3;
      for (let r = 1; r <= 3; r++) {
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.quadraticCurveTo(currentSize * 0.5 * r, currentSize * 0.95 * r, -currentSize * 0.38 * r, currentSize * 1.0 * r);
        ctx.stroke();
      }
    }
    ctx.restore();
  }
  for (let side = -1; side <= 1; side += 2) {
    ctx.save();
    ctx.fillStyle = isSilhouette ? '#0f172a' : '#010814';
    ctx.strokeStyle = isSilhouette ? '#334155' : '#67e8f9';
    ctx.lineWidth = 2.2;

    const hornSpread = 1.0 + bristle * 0.35;
    ctx.beginPath();
    ctx.moveTo(currentSize * 0.45, side * currentSize * 0.6);
    ctx.bezierCurveTo(-currentSize * 0.7, (side * currentSize * 1.5) * hornSpread, -currentSize * 2.0, (side * currentSize * 1.9) * hornSpread, -currentSize * 3.1, (side * currentSize * 2.0) * hornSpread);
    ctx.lineTo(-currentSize * 2.2, (side * currentSize * 1.6) * hornSpread);
    ctx.bezierCurveTo(-currentSize * 2.8, (side * currentSize * 2.5) * hornSpread, -currentSize * 3.5, (side * currentSize * 2.8) * hornSpread, -currentSize * 4.2, (side * currentSize * 3.0) * hornSpread);
    ctx.lineTo(-currentSize * 2.4, (side * currentSize * 1.7) * hornSpread);
    ctx.bezierCurveTo(-currentSize * 1.3, side * currentSize * 1.1, -currentSize * 0.25, side * currentSize * 0.55, currentSize * 0.15, side * currentSize * 0.4);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    if (!isSilhouette) {
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.75)';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(currentSize * 0.25, side * currentSize * 0.5);
      ctx.quadraticCurveTo(-currentSize * 1.6, (side * currentSize * 1.7) * hornSpread, -currentSize * 4.0, (side * currentSize * 2.9) * hornSpread);
      ctx.stroke();
    }
    ctx.restore();
  }
  if (!isSilhouette) {
    for (let side = -1; side <= 1; side += 2) {
      const wWave1 = Math.sin(c.finPhase * 1.35 + side) * currentSize * 0.45;
      const wWave2 = Math.cos(c.finPhase * 1.05 + side) * currentSize * 0.55;

      ctx.strokeStyle = 'rgba(56, 189, 248, 0.95)';
      ctx.lineWidth = 1.9;
      ctx.beginPath();
      ctx.moveTo(currentSize * 1.7, side * currentSize * 0.35);
      ctx.bezierCurveTo(
        currentSize * 3.0, side * currentSize * 1.1 + wWave1,
        currentSize * 4.6, side * currentSize * 1.8 + wWave2,
        currentSize * 6.2, side * currentSize * 0.9 + wWave1
      );
      ctx.stroke();

      ctx.strokeStyle = 'rgba(224, 242, 254, 0.7)';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(currentSize * 1.4, side * currentSize * 0.5);
      ctx.bezierCurveTo(
        currentSize * 2.6, side * currentSize * 1.4 - wWave2,
        currentSize * 4.2, side * currentSize * 1.9 - wWave1,
        currentSize * 4.8, side * currentSize * 1.5 + wWave2
      );
      ctx.stroke();
    }
  }
  ctx.fillStyle = isSilhouette ? '#0f172a' : '#010814';
  ctx.strokeStyle = isSilhouette ? '#334155' : (bristle > 0.4 ? '#7dd3fc' : '#38bdf8');
  ctx.lineWidth = 2.6;

  ctx.beginPath();
  ctx.moveTo(currentSize * 2.0, 0); // 鋭角な吻端
  ctx.lineTo(currentSize * 1.3, -currentSize * 0.9);
  ctx.lineTo(-currentSize * 0.7, -currentSize * 1.05);
  ctx.lineTo(-currentSize * 1.8, 0);
  ctx.lineTo(-currentSize * 0.7, currentSize * 1.05);
  ctx.lineTo(currentSize * 1.3, currentSize * 0.9);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  if (!isSilhouette) {
    ctx.fillStyle = '#021634';
    ctx.strokeStyle = '#0284c7';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(currentSize * 1.4, 0);
    ctx.lineTo(currentSize * 0.7, -currentSize * 0.5);
    ctx.lineTo(-currentSize * 0.45, 0);
    ctx.lineTo(currentSize * 0.7, currentSize * 0.5);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    for (let s = -1; s <= 1; s += 2) {
      const slitX = currentSize * 0.8;
      const slitY = s * currentSize * 0.45;
      const pulse = 0.6 + Math.sin(c.finPhase * 2.0 + s) * 0.4;

      ctx.strokeStyle = `rgba(56, 189, 248, ${pulse})`;
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.moveTo(slitX + currentSize * 0.3, slitY - s * currentSize * 0.08);
      ctx.lineTo(slitX - currentSize * 0.2, slitY);
      ctx.lineTo(slitX - currentSize * 0.4, slitY + s * currentSize * 0.12);
      ctx.stroke();
    }
    if (mouthGape > 0.05) {
      const coreRadius = currentSize * (0.9 + mouthGape * 0.8);
      const coreGrad = ctx.createRadialGradient(currentSize * 1.6, 0, 1, currentSize * 1.6, 0, coreRadius);
      coreGrad.addColorStop(0, 'rgba(255, 255, 255, 1.0)');
      coreGrad.addColorStop(0.3, 'rgba(56, 189, 248, 0.9)');
      coreGrad.addColorStop(0.7, 'rgba(6, 182, 212, 0.35)');
      coreGrad.addColorStop(1, 'rgba(2, 6, 23, 0)');
      ctx.fillStyle = coreGrad;
      ctx.beginPath();
      ctx.arc(currentSize * 1.6, 0, coreRadius, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  const mandBaseX = currentSize * 1.6;
  const mandOpenAngle = mouthGape * 0.65;

  for (let s = -1; s <= 1; s += 2) {
    ctx.save();
    ctx.translate(mandBaseX, s * currentSize * 0.3);
    ctx.rotate(s * mandOpenAngle);

    ctx.fillStyle = isSilhouette ? '#0f172a' : '#010814';
    ctx.strokeStyle = isSilhouette ? '#334155' : (bristle > 0.4 ? '#7dd3fc' : '#38bdf8');
    ctx.lineWidth = 2.6;
    ctx.beginPath();
    ctx.moveTo(0, s * currentSize * 0.28);
    ctx.bezierCurveTo(
      currentSize * 1.0, s * currentSize * 0.9,
      currentSize * 2.2, s * currentSize * 1.0,
      currentSize * 2.7, 0
    );
    ctx.bezierCurveTo(
      currentSize * 1.9, s * currentSize * 0.38,
      currentSize * 1.1, s * currentSize * 0.12,
      0, -s * currentSize * 0.16
    );
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    if (!isSilhouette) {
      ctx.fillStyle = '#f8fafc';
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 1.1;

      const innerTeeth = [
        { tx: currentSize * 0.75, ty: s * currentSize * 0.2, len: currentSize * 0.35, ang: -s * 0.5 },
        { tx: currentSize * 1.4, ty: s * currentSize * 0.24, len: currentSize * 0.46, ang: -s * 0.7 },
        { tx: currentSize * 2.0, ty: s * currentSize * 0.16, len: currentSize * 0.38, ang: -s * 0.95 }
      ];

      for (const t of innerTeeth) {
        ctx.save();
        ctx.translate(t.tx, t.ty);
        ctx.rotate(t.ang);
        ctx.beginPath();
        ctx.moveTo(-currentSize * 0.07, 0);
        ctx.lineTo(0, -t.len);
        ctx.lineTo(currentSize * 0.07, 0);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        ctx.restore();
      }
      ctx.strokeStyle = '#e0f2fe';
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.moveTo(currentSize * 0.25, s * currentSize * 0.32);
      ctx.bezierCurveTo(
        currentSize * 1.1, s * currentSize * 0.8,
        currentSize * 2.0, s * currentSize * 0.85,
        currentSize * 2.6, 0
      );
      ctx.stroke();
    }
    ctx.restore();
  }

  ctx.restore(); // 頭部ローカル座標系の復元
  ctx.restore(); // 関数全体の復元
}

function drawManta(c: Creature, isSilhouette = false) {
  ctx.save();
  ctx.translate(c.x, c.y);
  ctx.rotate(c.angle);

  const currentSize = c.dna.size * (0.35 + 0.65 * c.growth);
  const flap = Math.sin(c.finPhase * 0.7);
  const wingtipOffset = flap * currentSize * 0.65;

  ctx.fillStyle = isSilhouette ? '#0f172a' : '#081d34';
  ctx.strokeStyle = isSilhouette ? '#334155' : '#38bdf8';
  ctx.lineWidth = 1.8;

  ctx.beginPath();
  ctx.moveTo(currentSize * 2.1, 0);
  ctx.bezierCurveTo(
    currentSize * 1.5, -currentSize * 1.6,
    currentSize * 0.6, -currentSize * 2.8 - wingtipOffset,
    -currentSize * 0.2, -currentSize * 3.2 - wingtipOffset
  );
  ctx.bezierCurveTo(
    -currentSize * 0.8, -currentSize * 2.0 - wingtipOffset * 0.6,
    -currentSize * 1.2, -currentSize * 0.9,
    -currentSize * 1.8, 0
  );
  ctx.bezierCurveTo(
    -currentSize * 1.2, currentSize * 0.9,
    -currentSize * 0.8, currentSize * 2.0 + wingtipOffset * 0.6,
    -currentSize * 0.2, currentSize * 3.2 + wingtipOffset
  );
  ctx.bezierCurveTo(
    currentSize * 0.6, currentSize * 2.8 + wingtipOffset,
    currentSize * 1.5, currentSize * 1.6,
    currentSize * 2.1, 0
  );
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  if (!isSilhouette) {
    ctx.fillStyle = '#0e7490';
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 1.2;
    for (let s = -1; s <= 1; s += 2) {
      ctx.beginPath();
      ctx.moveTo(currentSize * 1.8, s * currentSize * 0.25);
      ctx.quadraticCurveTo(currentSize * 2.6, s * currentSize * 0.6, currentSize * 2.4, s * currentSize * 0.1);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }

    ctx.strokeStyle = 'rgba(56, 189, 248, 0.55)';
    ctx.lineWidth = 1.3;
    for (let ch = -1; ch <= 2; ch++) {
      const cx = -currentSize * 0.5 + ch * currentSize * 0.5;
      ctx.beginPath();
      ctx.moveTo(cx + currentSize * 0.3, 0);
      ctx.lineTo(cx, -currentSize * 0.9);
      ctx.moveTo(cx + currentSize * 0.3, 0);
      ctx.lineTo(cx, currentSize * 0.9);
      ctx.stroke();
    }

    ctx.fillStyle = '#67e8f9';
    for (let s = -1; s <= 1; s += 2) {
      ctx.beginPath();
      ctx.arc(currentSize * 1.4, s * currentSize * 0.7, Math.max(1.5, currentSize * 0.14), 0, Math.PI * 2);
      ctx.fill();
    }
  }

  const whipWave1 = Math.sin(c.finPhase * 1.1) * currentSize * 0.4;
  const whipWave2 = Math.cos(c.finPhase * 1.1) * currentSize * 0.6;
  ctx.strokeStyle = isSilhouette ? '#334155' : '#38bdf8';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(-currentSize * 1.8, 0);
  ctx.bezierCurveTo(
    -currentSize * 3.2, whipWave1,
    -currentSize * 4.6, whipWave2,
    -currentSize * 6.2, whipWave1 * 1.8
  );
  ctx.stroke();

  ctx.restore();
}

function drawCleanerShrimp(c: Creature, isSilhouette = false) {
  ctx.save();
  ctx.translate(c.x, c.y);
  ctx.rotate(c.angle);

  const currentSize = c.dna.size * (0.35 + 0.65 * c.growth);
  const antWave = Math.sin(c.legPhase * 0.9) * currentSize * 0.35;

  ctx.strokeStyle = isSilhouette ? '#334155' : 'rgba(255, 255, 255, 0.85)';
  ctx.lineWidth = 1.0;
  for (let s = -1; s <= 1; s += 2) {
    ctx.beginPath();
    ctx.moveTo(currentSize * 1.4, s * currentSize * 0.2);
    ctx.bezierCurveTo(
      currentSize * 2.4, s * (currentSize * 1.4 + antWave),
      currentSize * 3.4, s * (currentSize * 2.2 - antWave),
      currentSize * 4.6, s * (currentSize * 2.6)
    );
    ctx.stroke();
  }

  const segCount = 4;
  for (let s = segCount - 1; s >= 0; s--) {
    const st = s / segCount;
    const sx = (s - 1.2) * (currentSize * 0.45);
    const sy = Math.sin(st * Math.PI * 0.8) * (currentSize * 0.25);
    const sW = currentSize * (0.9 - st * 0.35);
    const sH = currentSize * (0.65 - st * 0.25);

    ctx.fillStyle = isSilhouette ? '#0f172a' : (s % 2 === 0 ? '#f472b6' : 'rgba(255, 255, 255, 0.9)');
    ctx.strokeStyle = isSilhouette ? '#334155' : '#fda4af';
    ctx.lineWidth = 1.0;
    ctx.beginPath();
    ctx.ellipse(sx, sy, sW, sH, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }

  ctx.fillStyle = isSilhouette ? '#0f172a' : 'rgba(244, 114, 182, 0.8)';
  ctx.strokeStyle = isSilhouette ? '#334155' : '#fda4af';
  ctx.beginPath();
  ctx.moveTo(-currentSize * 1.4, 0);
  ctx.lineTo(-currentSize * 2.3, -currentSize * 0.5);
  ctx.lineTo(-currentSize * 2.0, 0);
  ctx.lineTo(-currentSize * 2.3, currentSize * 0.5);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  if (!isSilhouette) {
    ctx.fillStyle = '#0f172a';
    ctx.beginPath();
    ctx.arc(currentSize * 1.2, -currentSize * 0.3, Math.max(1.2, currentSize * 0.18), 0, Math.PI * 2);
    ctx.arc(currentSize * 1.2, currentSize * 0.3, Math.max(1.2, currentSize * 0.18), 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(currentSize * 1.25, -currentSize * 0.32, Math.max(0.6, currentSize * 0.08), 0, Math.PI * 2);
    ctx.arc(currentSize * 1.25, currentSize * 0.28, Math.max(0.6, currentSize * 0.08), 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();
}

function drawAnglerfish(c: Creature, isSilhouette = false) {
  ctx.save();
  ctx.translate(c.x, c.y);

  const isFacingLeft = Math.cos(c.angle) < 0;
  if (isFacingLeft) {
    ctx.scale(-1, 1);
  }

  const currentSize = c.dna.size * (0.4 + 0.6 * c.growth);
  const biteGape = Math.min(1.0, (c.biteAnimTimer || 0) * 2.5);
  const lurePhase = c.anglerLurePhase || (world.totalTime * 2.2);
  const swayX = Math.cos(lurePhase * 1.2) * (currentSize * 0.3);
  const swayY = Math.sin(lurePhase) * (currentSize * 0.5);

  const stalkStartX = currentSize * 0.7;
  const stalkStartY = -currentSize * 0.85;
  const escaX = currentSize * 2.5 + swayX;
  const escaY = -currentSize * 1.3 + swayY;
  ctx.strokeStyle = isSilhouette ? '#334155' : '#0ea5e9';
  ctx.lineWidth = 1.8;
  ctx.beginPath();
  ctx.moveTo(stalkStartX, stalkStartY);
  ctx.quadraticCurveTo(currentSize * 1.3, -currentSize * 2.4, escaX, escaY);
  ctx.stroke();
  if (!isSilhouette) {
    const pulse = 0.75 + Math.sin(lurePhase * 2.5) * 0.25;
    const escaGrad = ctx.createRadialGradient(escaX, escaY, 2, escaX, escaY, currentSize * 1.8);
    escaGrad.addColorStop(0, `rgba(255, 255, 255, ${1.0 * pulse})`);
    escaGrad.addColorStop(0.25, `rgba(34, 211, 238, ${0.9 * pulse})`);
    escaGrad.addColorStop(0.65, `rgba(6, 182, 212, ${0.35 * pulse})`);
    escaGrad.addColorStop(1, 'rgba(2, 6, 23, 0)');
    ctx.fillStyle = escaGrad;
    ctx.beginPath();
    ctx.arc(escaX, escaY, currentSize * 1.8, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(escaX, escaY, 3.2, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = isSilhouette ? '#0f172a' : '#030814';
  ctx.strokeStyle = isSilhouette ? '#334155' : '#0ea5e9';
  ctx.lineWidth = 2.0;

  const jawSpread = biteGape * currentSize * 1.1;
  ctx.beginPath();
  ctx.moveTo(currentSize * 1.6, -currentSize * 0.5 - jawSpread); // Upper jaw
  ctx.quadraticCurveTo(currentSize * 0.5, -currentSize * 1.4, -currentSize * 1.1, -currentSize * 0.9);
  ctx.lineTo(-currentSize * 1.8, 0);
  ctx.lineTo(-currentSize * 1.1, currentSize * 0.9);
  ctx.quadraticCurveTo(currentSize * 0.5, currentSize * 1.4, currentSize * 1.5, currentSize * 0.5 + jawSpread); // Lower jaw
  if (biteGape > 0.05) {
    ctx.lineTo(currentSize * 0.4, 0); // Open oral cavern
  }
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  if (!isSilhouette) {
    ctx.fillStyle = '#f0fdf4';
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 0.8;
    const fCount = 6;
    for (let f = 0; f < fCount; f++) {
      const fx = currentSize * (0.75 + f * 0.16);
      const fyTop = -currentSize * 0.45 - jawSpread;
      const fyBot = currentSize * 0.45 + jawSpread;
      const fLen = currentSize * (0.5 + Math.sin(f * 0.8) * 0.2 + biteGape * 0.3);
      ctx.beginPath();
      ctx.moveTo(fx, fyTop);
      ctx.lineTo(fx + 2, fyTop + fLen);
      ctx.lineTo(fx + 4, fyTop);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(fx, fyBot);
      ctx.lineTo(fx + 2, fyBot - fLen);
      ctx.lineTo(fx + 4, fyBot);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }
    ctx.fillStyle = '#334155';
    ctx.beginPath();
    ctx.arc(currentSize * 0.65, -currentSize * 0.65, 2.2, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = isSilhouette ? '#0f172a' : 'rgba(14, 116, 144, 0.6)';
  ctx.beginPath();
  ctx.moveTo(-currentSize * 1.8, 0);
  ctx.lineTo(-currentSize * 2.6, -currentSize * 0.7);
  ctx.lineTo(-currentSize * 2.2, 0);
  ctx.lineTo(-currentSize * 2.6, currentSize * 0.7);
  ctx.closePath();
  ctx.fill();

  ctx.restore();
}

function drawNautilus(c: Creature, isSilhouette = false) {
  ctx.save();
  ctx.translate(c.x, c.y);
  ctx.rotate(c.angle);

  const currentSize = c.dna.size * (0.35 + 0.65 * c.growth);
  const isRetracted = (c.shellRetractTimer || 0) > 0;
  const retractOffset = isRetracted ? -currentSize * 0.45 : 0;
  if (!isRetracted) {
    ctx.strokeStyle = isSilhouette ? '#334155' : 'rgba(251, 146, 60, 0.85)';
    ctx.lineWidth = 1.2;
    const wave = Math.sin(world.totalTime * 4.5 + c.id) * 0.25;

    for (let t = -3; t <= 3; t++) {
      const ty = t * (currentSize * 0.14);
      ctx.beginPath();
      ctx.moveTo(currentSize * 0.8, ty);
      ctx.quadraticCurveTo(currentSize * 1.5, ty + wave * currentSize, currentSize * 2.2, ty + t * 2);
      ctx.stroke();
    }
  }
  ctx.fillStyle = isSilhouette ? '#0f172a' : '#f8fafc';
  ctx.strokeStyle = isSilhouette ? '#334155' : '#ea580c';
  ctx.lineWidth = 1.8;

  ctx.beginPath();
  ctx.ellipse(0, 0, currentSize * 1.2, currentSize * 0.95, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  if (!isSilhouette) {
    ctx.strokeStyle = '#c2410c';
    ctx.lineWidth = 2.0;
    for (let s = 1; s <= 6; s++) {
      const ang = (s / 7) * Math.PI * 1.3 - 0.4;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.quadraticCurveTo(Math.cos(ang) * (currentSize * 0.7), Math.sin(ang) * (currentSize * 0.7), Math.cos(ang) * (currentSize * 1.15), Math.sin(ang) * (currentSize * 0.92));
      ctx.stroke();
    }
    ctx.fillStyle = '#7c2d12';
    ctx.beginPath();
    ctx.arc(currentSize * 0.5 + retractOffset, -currentSize * 0.2, currentSize * 0.45, -0.6, 0.8);
    ctx.closePath();
    ctx.fill();
    if (!isRetracted) {
      ctx.fillStyle = '#0f172a';
      ctx.beginPath();
      ctx.arc(currentSize * 0.4, currentSize * 0.25, currentSize * 0.18, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#38bdf8';
      ctx.beginPath();
      ctx.arc(currentSize * 0.42, currentSize * 0.23, 1.2, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  ctx.restore();
}

function drawWhaleFall(p: Plant) {
  ctx.save();
  ctx.translate(p.x, p.y);

  const stage = p.stage || 'flesh';
  const currentSize = p.size;

  if (stage === 'flesh') {
    const pulse = 1.0 + Math.sin(world.totalTime * 2.0 + p.id) * 0.03;
    ctx.scale(pulse, pulse);
    const auraGrad = ctx.createRadialGradient(0, 0, currentSize * 0.2, 0, 0, currentSize * 1.8);
    auraGrad.addColorStop(0, 'rgba(159, 18, 57, 0.45)');
    auraGrad.addColorStop(0.5, 'rgba(76, 5, 25, 0.2)');
    auraGrad.addColorStop(1, 'rgba(2, 6, 23, 0)');
    ctx.fillStyle = auraGrad;
    ctx.beginPath();
    ctx.arc(0, 0, currentSize * 1.8, 0, Math.PI * 2);
    ctx.fill();
    const fleshGrad = ctx.createRadialGradient(-currentSize * 0.3, -currentSize * 0.2, 5, 0, 0, currentSize * 1.4);
    fleshGrad.addColorStop(0, '#be123c');
    fleshGrad.addColorStop(0.5, '#881337');
    fleshGrad.addColorStop(1, '#4c0519');
    ctx.fillStyle = fleshGrad;
    ctx.strokeStyle = '#f43f5e';
    ctx.lineWidth = 2.4;

    ctx.beginPath();
    ctx.moveTo(-currentSize * 1.3, 0);
    ctx.bezierCurveTo(-currentSize * 1.1, -currentSize * 0.7, -currentSize * 0.3, -currentSize * 0.9, currentSize * 0.4, -currentSize * 0.75);
    ctx.bezierCurveTo(currentSize * 1.2, -currentSize * 0.6, currentSize * 1.4, 0, currentSize * 1.2, currentSize * 0.55);
    ctx.bezierCurveTo(currentSize * 0.6, currentSize * 0.9, -currentSize * 0.6, currentSize * 0.85, -currentSize * 1.3, 0);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#9f1239';
    ctx.beginPath();
    ctx.ellipse(-currentSize * 0.35, currentSize * 0.2, currentSize * 0.55, currentSize * 0.32, 0.2, 0, Math.PI * 2);
    ctx.fill();

    ctx.beginPath();
    ctx.ellipse(currentSize * 0.4, -currentSize * 0.15, currentSize * 0.48, currentSize * 0.28, -0.25, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#fff1f2';
    ctx.lineWidth = 3.2;
    ctx.lineCap = 'round';
    for (let r = -3; r <= 3; r++) {
      const rx = r * (currentSize * 0.26);
      const rHeight = currentSize * (0.85 - Math.abs(r) * 0.1);
      ctx.beginPath();
      ctx.moveTo(rx, -rHeight * 0.2);
      ctx.quadraticCurveTo(rx + 8, -rHeight * 0.6, rx + 4, -rHeight);
      ctx.stroke();

      ctx.fillStyle = '#fda4af';
      ctx.beginPath();
      ctx.arc(rx + 4, -rHeight, 2.5, 0, Math.PI * 2);
      ctx.fill();
    }
  } else if (stage === 'reef') {
    ctx.strokeStyle = '#f8fafc';
    ctx.lineWidth = 4.2;
    ctx.beginPath();
    ctx.moveTo(-currentSize * 1.35, 0);
    ctx.lineTo(currentSize * 1.35, 0);
    ctx.stroke();

    const ribCount = 8;
    for (let i = 0; i < ribCount; i++) {
      const rx = (i - (ribCount - 1) / 2) * (currentSize * 0.32);
      const rh = currentSize * (0.95 - Math.abs(i - 3.5) * 0.12);

      ctx.strokeStyle = 'rgba(226, 232, 240, 0.95)';
      ctx.lineWidth = 3.2;
      ctx.beginPath();
      ctx.moveTo(rx, -rh);
      ctx.quadraticCurveTo(rx + 10, 0, rx, rh);
      ctx.stroke();
      if (i % 2 === 0) {
        ctx.fillStyle = '#06b6d4';
        ctx.beginPath();
        ctx.arc(rx, -rh, 4.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#67e8f9';
        ctx.lineWidth = 1.2;
        ctx.stroke();
      } else {
        ctx.fillStyle = '#ec4899';
        ctx.beginPath();
        ctx.arc(rx, rh, 4.0, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#f472b6';
        ctx.lineWidth = 1.2;
        ctx.stroke();
      }
    }

    const reefGlow = ctx.createRadialGradient(0, 0, 10, 0, 0, currentSize * 1.6);
    reefGlow.addColorStop(0, 'rgba(6, 182, 212, 0.35)');
    reefGlow.addColorStop(0.6, 'rgba(236, 72, 153, 0.15)');
    reefGlow.addColorStop(1, 'rgba(2, 6, 23, 0)');
    ctx.fillStyle = reefGlow;
    ctx.beginPath();
    ctx.arc(0, 0, currentSize * 1.6, 0, Math.PI * 2);
    ctx.fill();
  } else {
    ctx.strokeStyle = '#94a3b8';
    ctx.lineWidth = 5.0;
    ctx.beginPath();
    ctx.moveTo(-currentSize * 1.3, 8);
    ctx.quadraticCurveTo(0, -currentSize * 1.15, currentSize * 1.3, 8);
    ctx.stroke();

    ctx.fillStyle = '#334155';
    for (let r = -3; r <= 3; r++) {
      const rx = r * (currentSize * 0.34);
      ctx.beginPath();
      ctx.ellipse(rx, 0, 6.5, currentSize * 0.55, 0.12 * r, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#64748b';
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }
    const sanctuaryGrad = ctx.createRadialGradient(0, 0, 5, 0, 0, currentSize * 1.6);
    sanctuaryGrad.addColorStop(0, 'rgba(56, 189, 248, 0.28)');
    sanctuaryGrad.addColorStop(0.7, 'rgba(14, 116, 144, 0.12)');
    sanctuaryGrad.addColorStop(1, 'rgba(2, 6, 23, 0)');
    ctx.fillStyle = sanctuaryGrad;
    ctx.beginPath();
    ctx.arc(0, 0, currentSize * 1.6, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = 'rgba(56, 189, 248, 0.6)';
    ctx.lineWidth = 1.4;
    ctx.setLineDash([6, 6]);
    ctx.beginPath();
    ctx.arc(0, 0, currentSize * 1.5, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  ctx.restore();
}

function drawKelp(kelp: Kelp) {
  ctx.save();

  if (kelp.type === 'sea_fern') {
    ctx.strokeStyle = 'rgba(6, 182, 212, 0.65)';
    ctx.lineWidth = 3.2;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(kelp.nodes[0].x, kelp.nodes[0].y);
    for (let s = 1; s < kelp.nodes.length; s++) {
      ctx.lineTo(kelp.nodes[s].x, kelp.nodes[s].y);
    }
    ctx.stroke();

    for (let s = 1; s < kelp.nodes.length; s++) {
      const n = kelp.nodes[s];
      const prev = kelp.nodes[s - 1];
      const ang = Math.atan2(n.y - prev.y, n.x - prev.x);
      for (let side = -1; side <= 1; side += 2) {
        ctx.save();
        ctx.translate(n.x, n.y);
        ctx.rotate(ang + side * 0.9);

        ctx.strokeStyle = 'rgba(34, 211, 238, 0.55)';
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(15, 0);
        ctx.stroke();

        ctx.fillStyle = '#67e8f9';
        ctx.beginPath();
        ctx.arc(15, 0, 2.2, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
    }
  } else {
    ctx.strokeStyle = 'rgba(16, 185, 129, 0.65)';
    ctx.lineWidth = 4.2;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(kelp.nodes[0].x, kelp.nodes[0].y);
    for (let s = 1; s < kelp.nodes.length; s++) {
      ctx.lineTo(kelp.nodes[s].x, kelp.nodes[s].y);
    }
    ctx.stroke();

    ctx.fillStyle = 'rgba(52, 211, 153, 0.45)';
    for (let s = 1; s < kelp.nodes.length; s++) {
      const n = kelp.nodes[s];
      const prev = kelp.nodes[s - 1];
      const ang = Math.atan2(n.y - prev.y, n.x - prev.x);
      for (let side = -1; side <= 1; side += 2) {
        ctx.save();
        ctx.translate(n.x, n.y);
        ctx.rotate(ang + side * 0.78);
        ctx.beginPath();
        ctx.ellipse(13, 0, 15, 5.5, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
    }
  }

  ctx.restore();
}
function drawFishCreature(c: Creature, isSilhouette = false) {
  ctx.save();
  const [r, g, b] = c.dna.color;
  const currentSize = c.dna.size * (0.35 + 0.65 * c.growth);
  const isCarnivore = c.dna.diet > 0.55;
  const isApex = c.type === 'chimera';
  const isLarva = c.stage === 'larva';

  if (!isSilhouette && c.dna.camouflage > 0.35 && !isApex) {
    ctx.globalAlpha = Math.max(0.22, 1.0 - c.dna.camouflage * 0.72);
  }
  const parts = c.dna.parts || [];
  if (c.tailNodes.length > 1) {
    for (let i = c.tailNodes.length - 1; i >= 1; i--) {
      const node = c.tailNodes[i];
      const prev = c.tailNodes[i - 1];
      const t = i / c.tailNodes.length;
      const segAngle = Math.atan2(node.y - prev.y, node.x - prev.x);

      ctx.save();
      ctx.translate(node.x, node.y);
      ctx.rotate(segAngle);

      if (isCarnivore && !isLarva) {
        const nodeSize = currentSize * (1.1 - t * 0.65);
        const wave = Math.sin(c.finPhase + i * 0.85) * (currentSize * 0.25 * (1 - t));
        if (i === c.tailNodes.length - 1) {
          ctx.fillStyle = isSilhouette ? '#0f172a' : 'rgba(225, 29, 72, 0.85)';
          ctx.strokeStyle = isSilhouette ? '#334155' : '#fda4af';
          ctx.lineWidth = 1.2;
          ctx.beginPath();
          ctx.moveTo(0, 0);
          ctx.lineTo(-nodeSize * 2.8, -nodeSize * 2.2 + wave);
          ctx.lineTo(-nodeSize * 1.8, 0);
          ctx.lineTo(-nodeSize * 2.4, nodeSize * 1.8 + wave);
          ctx.closePath();
          ctx.fill();
          ctx.stroke();
        }
        ctx.fillStyle = isSilhouette ? '#0f172a' : `rgba(${r}, ${g}, ${b}, ${0.85 - t * 0.25})`;
        ctx.strokeStyle = isSilhouette ? '#334155' : 'rgba(253, 164, 175, 0.4)';
        ctx.lineWidth = 1.0;
        ctx.beginPath();
        ctx.ellipse(0, 0, nodeSize * 1.05, nodeSize * 0.75, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      } else {
        const nodeSize = currentSize * (1.15 - t * 0.68);
        const wave = Math.sin(c.finPhase + i * 0.85) * (currentSize * 0.35 * (1 - t));

        if (i === c.tailNodes.length - 1) {
          if (parts.includes('prop_ribbon')) {
            ctx.fillStyle = isSilhouette ? '#0f172a' : 'rgba(192, 132, 252, 0.85)';
            ctx.beginPath();
            ctx.moveTo(0, 0);
            ctx.bezierCurveTo(-nodeSize * 2.0, -nodeSize * 3.0 + wave, -nodeSize * 3.5, -nodeSize * 1.5 + wave, -nodeSize * 4.2, wave);
            ctx.bezierCurveTo(-nodeSize * 3.5, nodeSize * 1.5 + wave, -nodeSize * 2.0, nodeSize * 3.0 + wave, 0, 0);
            ctx.fill();
          } else if (parts.includes('prop_fork')) {
            ctx.fillStyle = isSilhouette ? '#0f172a' : `rgb(${r}, ${g}, ${b})`;
            ctx.beginPath();
            ctx.moveTo(0, 0);
            ctx.bezierCurveTo(-nodeSize * 1.5, -nodeSize * 2.2 + wave, -nodeSize * 2.8, -nodeSize * 2.0 + wave, -nodeSize * 3.0, -nodeSize * 2.2 + wave);
            ctx.lineTo(-nodeSize * 1.4, 0);
            ctx.bezierCurveTo(-nodeSize * 2.8, nodeSize * 2.0 + wave, -nodeSize * 1.5, nodeSize * 2.2 + wave, -nodeSize * 3.0, nodeSize * 2.2 + wave);
            ctx.closePath();
            ctx.fill();
          } else if (parts.includes('prop_jet')) {
            ctx.fillStyle = '#f97316';
            ctx.fillRect(-nodeSize * 1.8, -nodeSize * 0.5, nodeSize * 1.6, nodeSize * 1.0);
          } else {
            ctx.fillStyle = isSilhouette ? '#0f172a' : `rgba(${r}, ${g}, ${b}, 0.85)`;
            ctx.beginPath();
            ctx.moveTo(0, 0);
            ctx.bezierCurveTo(-nodeSize * 1.2, -nodeSize * 1.8 + wave, -nodeSize * 2.0, -nodeSize * 1.5 + wave, -nodeSize * 2.4, -nodeSize * 1.6 + wave);
            ctx.lineTo(-nodeSize * 1.3, 0);
            ctx.bezierCurveTo(-nodeSize * 2.0, nodeSize * 1.5 + wave, -nodeSize * 1.2, nodeSize * 1.8 + wave, -nodeSize * 2.4, nodeSize * 1.6 + wave);
            ctx.closePath();
            ctx.fill();
          }
        }

        ctx.fillStyle = isSilhouette ? '#0f172a' : `rgba(${r}, ${g}, ${b}, ${isLarva ? 0.35 : 0.9 - t * 0.22})`;
        ctx.strokeStyle = isSilhouette ? '#334155' : 'transparent';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.ellipse(0, 0, Math.max(1.2, nodeSize * 1.1), Math.max(1.0, nodeSize * 0.85), 0, 0, Math.PI * 2);
        ctx.fill();
        if (isSilhouette) ctx.stroke();
      }

      ctx.restore();
    }
  }

  if (c.dna.isCrystal && !isSilhouette) {
    ctx.shadowColor = '#38bdf8';
    ctx.shadowBlur = 8;
  }

  ctx.save();
  ctx.translate(c.x, c.y);
  ctx.rotate(c.angle);

  if (isCarnivore && !isLarva) {
    const finFlap = Math.sin(c.finPhase * 0.8) * 0.2;
    for (let side = -1; side <= 1; side += 2) {
      ctx.save();
      ctx.translate(-currentSize * 0.1, side * currentSize * 0.8);
      ctx.rotate(side * (0.65 + finFlap));

      ctx.fillStyle = isSilhouette ? '#0f172a' : 'rgba(190, 18, 60, 0.9)';
      ctx.strokeStyle = isSilhouette ? '#334155' : '#fda4af';
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(currentSize * 2.2, side * currentSize * 2.4);
      ctx.lineTo(currentSize * 1.1, side * currentSize * 1.8);
      ctx.lineTo(currentSize * 0.6, side * currentSize * 1.2);
      ctx.lineTo(-currentSize * 0.2, side * currentSize * 0.5);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      if (!isSilhouette) {
        ctx.strokeStyle = '#f43f5e';
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(currentSize * 1.8, side * currentSize * 1.9);
        ctx.moveTo(0, 0);
        ctx.lineTo(currentSize * 0.9, side * currentSize * 1.3);
        ctx.stroke();
      }
      ctx.restore();
    }
    const mouthGape = Math.min(1.0, (c.biteAnimTimer || 0) * 2.6);
    const upperJawY = -currentSize * (1.2 + mouthGape * 0.55);
    const lowerJawY = currentSize * (1.2 + mouthGape * 0.55);
    ctx.fillStyle = isSilhouette ? '#0f172a' : `rgb(${r}, ${g}, ${b})`;
    ctx.strokeStyle = isSilhouette ? '#334155' : '#fda4af';
    ctx.lineWidth = 2.0;
    ctx.beginPath();
    ctx.moveTo(currentSize * (2.8 - mouthGape * 0.3), -mouthGape * currentSize * 0.6); // Upper rostrum
    ctx.lineTo(currentSize * 1.5, upperJawY);
    ctx.lineTo(-currentSize * 0.9, -currentSize * 1.25);
    ctx.lineTo(-currentSize * 1.9, -currentSize * 0.7);
    ctx.lineTo(-currentSize * 2.0, 0);
    ctx.lineTo(-currentSize * 1.9, currentSize * 0.7);
    ctx.lineTo(-currentSize * 0.9, currentSize * 1.25);
    ctx.lineTo(currentSize * 1.5, lowerJawY);
    ctx.lineTo(currentSize * (2.6 - mouthGape * 0.3), mouthGape * currentSize * 0.6); // Lower jaw
    if (mouthGape > 0.05) {
      ctx.lineTo(currentSize * 1.0, 0); // Open oral cavity indentation
    }
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    if (!isSilhouette) {
      ctx.fillStyle = 'rgba(15, 23, 42, 0.4)';
      ctx.strokeStyle = '#991b1b';
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.moveTo(currentSize * 1.8, 0);
      ctx.lineTo(currentSize * 0.5, -currentSize * 0.7);
      ctx.lineTo(-currentSize * 0.6, 0);
      ctx.lineTo(currentSize * 0.5, currentSize * 0.7);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.strokeStyle = '#fda4af';
      ctx.lineWidth = 1.4;
      ctx.lineCap = 'round';
      for (let g = 0; g < 4; g++) {
        const gx = currentSize * (0.2 + g * 0.28);
        for (let s = -1; s <= 1; s += 2) {
          ctx.beginPath();
          ctx.moveTo(gx, s * currentSize * 0.4);
          ctx.lineTo(gx - currentSize * 0.1, s * currentSize * 0.8);
          ctx.stroke();
        }
      }
      for (let s = -1; s <= 1; s += 2) {
        ctx.save();
        ctx.translate(currentSize * 1.2, s * currentSize * 0.65);
        ctx.rotate(s * 0.2);

        ctx.fillStyle = '#050811';
        ctx.beginPath();
        ctx.ellipse(0, 0, currentSize * 0.42, currentSize * 0.22, 0, 0, Math.PI * 2);
        ctx.fill();

        const eyeGrad = ctx.createRadialGradient(0, 0, 0.2, 0, 0, currentSize * 0.4);
        eyeGrad.addColorStop(0, '#fde047');
        eyeGrad.addColorStop(0.35, '#ea580c');
        eyeGrad.addColorStop(0.75, '#991b1b');
        eyeGrad.addColorStop(1, '#450a0a');
        ctx.fillStyle = eyeGrad;
        ctx.beginPath();
        ctx.ellipse(0, 0, currentSize * 0.38, currentSize * 0.18, 0, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#020617';
        ctx.beginPath();
        ctx.ellipse(0, 0, currentSize * 0.1, currentSize * 0.16, 0, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(currentSize * 0.1, -currentSize * 0.05, Math.max(0.6, currentSize * 0.05), 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
      ctx.fillStyle = '#ffffff';
      ctx.strokeStyle = '#fda4af';
      ctx.lineWidth = 0.8;
      const fangCount = 5;
      for (let f = 0; f < fangCount; f++) {
        const fx = currentSize * (1.3 + f * 0.25);
        const fyTop = -currentSize * (0.42 - f * 0.06) - mouthGape * currentSize * 0.45;
        const fyBot = currentSize * (0.42 - f * 0.06) + mouthGape * currentSize * 0.45;
        const fLen = currentSize * (0.45 + Math.sin(f * 0.8) * 0.2 + mouthGape * 0.25);

        ctx.beginPath();
        ctx.moveTo(fx - currentSize * 0.08, fyTop);
        ctx.lineTo(fx, fyTop + fLen);
        ctx.lineTo(fx + currentSize * 0.08, fyTop);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(fx - currentSize * 0.08, fyBot);
        ctx.lineTo(fx, fyBot - fLen);
        ctx.lineTo(fx + currentSize * 0.08, fyBot);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      }
    }
  } else if (isApex && !isLarva) {
    ctx.fillStyle = isSilhouette ? '#0f172a' : '#082f49';
    ctx.strokeStyle = isSilhouette ? '#334155' : '#38bdf8';
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.moveTo(currentSize * 2.2, 0);
    ctx.quadraticCurveTo(currentSize * 1.2, -currentSize * 1.3, -currentSize * 1.2, -currentSize * 1.0);
    ctx.lineTo(-currentSize * 1.6, 0);
    ctx.lineTo(-currentSize * 1.2, currentSize * 1.0);
    ctx.quadraticCurveTo(currentSize * 1.2, currentSize * 1.3, currentSize * 2.2, 0);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  } else {
    if (!isLarva) {
      const finFlap = Math.sin(c.finPhase * 0.8) * 0.16;
      for (let side = -1; side <= 1; side += 2) {
        ctx.save();
        ctx.translate(-currentSize * 0.15, side * currentSize * 0.65);
        ctx.rotate(side * (0.5 + finFlap));
        ctx.fillStyle = isSilhouette ? '#0f172a' : `rgba(${r}, ${g}, ${b}, 0.75)`;
        ctx.strokeStyle = isSilhouette ? '#334155' : 'rgba(255, 255, 255, 0.45)';
        ctx.lineWidth = 0.9;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.quadraticCurveTo(currentSize * 0.5, side * currentSize * 0.9, currentSize * 1.0, side * currentSize * 1.15);
        ctx.lineTo(currentSize * 0.1, side * currentSize * 0.35);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        ctx.restore();
      }
    }

    let bodyInflate = 1.0;
    if (c.stomachLumps && c.stomachLumps.length > 0) {
      bodyInflate += c.stomachLumps.reduce((acc, lump) => acc + lump.mass * 0.25, 0);
    }

    ctx.strokeStyle = isSilhouette ? '#334155' : 'rgba(255, 255, 255, 0.65)';
    ctx.lineWidth = isLarva ? 0.8 : 1.2;
    ctx.fillStyle = isSilhouette ? '#0f172a' : (isLarva ? `rgba(${r},${g},${b}, 0.4)` : `rgb(${r},${g},${b})`);
    ctx.beginPath();
    ctx.moveTo(currentSize * 1.6, 0);
    ctx.quadraticCurveTo(currentSize * 0.5, -currentSize * 0.9 * bodyInflate, -currentSize * 1.2, -currentSize * 0.65);
    ctx.lineTo(-currentSize * 1.4, 0);
    ctx.lineTo(-currentSize * 1.2, currentSize * 0.65 * bodyInflate);
    ctx.quadraticCurveTo(currentSize * 0.5, currentSize * 0.9 * bodyInflate, currentSize * 1.6, 0);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    if (!isSilhouette) {
      const eyeX = currentSize * 0.72;
      const eyeY = currentSize * 0.4;
      const eyeRadius = isLarva ? currentSize * 0.32 : Math.max(1.8, currentSize * 0.22);

      for (let side = -1; side <= 1; side += 2) {
        ctx.save();
        ctx.translate(eyeX, side * eyeY);

        ctx.fillStyle = '#090d16';
        ctx.beginPath();
        ctx.arc(0, 0, eyeRadius + 0.7, 0, Math.PI * 2);
        ctx.fill();

        const eyeGrad = ctx.createRadialGradient(0, 0, 0.5, 0, 0, eyeRadius);
        if (isCarnivore) {
          eyeGrad.addColorStop(0, '#fde047');
          eyeGrad.addColorStop(0.45, '#ea580c');
          eyeGrad.addColorStop(1, '#7f1d1d');
        } else {
          eyeGrad.addColorStop(0, '#a7f3d0');
          eyeGrad.addColorStop(0.5, '#06b6d4');
          eyeGrad.addColorStop(1, '#0c4a6e');
        }
        ctx.fillStyle = eyeGrad;
        ctx.beginPath();
        ctx.arc(0, 0, eyeRadius, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#020617';
        ctx.beginPath();
        ctx.arc(eyeRadius * 0.2, 0, eyeRadius * 0.48, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(eyeRadius * 0.35, -eyeRadius * 0.25, Math.max(0.6, eyeRadius * 0.26), 0, Math.PI * 2);
        ctx.arc(-eyeRadius * 0.15, eyeRadius * 0.3, Math.max(0.4, eyeRadius * 0.14), 0, Math.PI * 2);
        ctx.fill();

        ctx.restore();
      }
    }
  }

  ctx.restore();
  ctx.restore();
  ctx.shadowBlur = 0;
}

function drawSpeciesPreview(catalogItem: SpeciesCatalogItem, isDiscovered: boolean, cx: number, cy: number, scale: number) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(scale, scale);

  const previewDna: DNA = {
    speed: catalogItem.previewDna.speed || 2.5,
    turnSpeed: catalogItem.previewDna.turnSpeed || 0.12,
    senseRadius: catalogItem.previewDna.senseRadius || 140,
    size: catalogItem.previewDna.size || 6.5,
    color: catalogItem.previewDna.color || [40, 190, 160],
    reproEnergy: 140,
    metabolism: 0.14,
    mutationRate: 0.14,
    maxAge: catalogItem.previewDna.maxAge || 65,
    camouflage: catalogItem.previewDna.camouflage || 0.0,
    diet: catalogItem.previewDna.diet || 0.1,
    segments: catalogItem.previewDna.segments || 4,
    poison: catalogItem.previewDna.poison || 0,
    poisonResist: 0.5,
    armor: catalogItem.previewDna.armor || 0,
    biteForce: catalogItem.previewDna.biteForce || 0.2,
    electricShock: catalogItem.previewDna.electricShock || 0,
    photosynthesis: catalogItem.previewDna.photosynthesis || 0,
    scavengerDrive: catalogItem.previewDna.scavengerDrive || 0,
    rkStrategy: catalogItem.previewDna.rkStrategy || 0.5
  };

  const segCount = previewDna.segments || 4;
  const nodes: { x: number; y: number }[] = [];
  for (let i = 0; i < segCount; i++) {
    nodes.push({ x: -i * (previewDna.size * 0.7), y: 0 });
  }

  const dummyCreature: Creature = {
    id: 9999,
    type: previewDna.photosynthesis > 0.6 ? 'solar_jelly' : previewDna.scavengerDrive > 0.6 ? 'scavenger' : (catalogItem.id === 'reaper' || catalogItem.id === 'crimson_beast') ? 'chimera' : 'herbivore',
    x: 0,
    y: 0,
    z: 0.5,
    vx: 0,
    vy: 0,
    vz: 0,
    angle: 0,
    energy: 100,
    maxEnergy: 100,
    age: 10,
    stage: 'adult',
    growth: 1.0,
    generation: 1,
    parentId: null,
    dna: previewDna,
    brain: new NeuralBrain(),
    children: 0,
    kills: 0,
    plantsEaten: 0,
    isDead: false,
    tailNodes: nodes,
    finPhase: world.totalTime * 4,
    pulsePhase: world.totalTime * 2.5,
    legPhase: world.totalTime * 6,
    sprintTimer: 0,
    stunTimer: 0,
    poisonTimer: 0,
    electricCooldown: 0,
    reproCooldown: 0,
    warningSignal: 0,
    currentAction: 'idle',
    internalDrive: { hunger: 0, fatigue: 0, reproductiveUrge: 0, socialNeed: 0 }
  };

  if (dummyCreature.type === 'solar_jelly') {
      drawSolarJelly(dummyCreature, !isDiscovered);
    } else if (dummyCreature.type === 'scavenger') {
      drawScavenger(dummyCreature, !isDiscovered);
    } else if (dummyCreature.type === 'chimera') {
      drawLeviathan(dummyCreature, !isDiscovered);
    } else {
      drawFishCreature(dummyCreature, !isDiscovered);
    }

    ctx.restore();
  }

  function drawCreature(c: Creature) {
    if (selectedCreature?.id === c.id) {
      ctx.save();
      ctx.strokeStyle = c.dna.diet > 0.5 ? 'rgba(244, 63, 94, 0.4)' : 'rgba(56, 189, 248, 0.4)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(c.x, c.y, c.dna.senseRadius, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
    if (c.type === 'solar_jelly') {
      drawSolarJelly(c);
    } else if (c.type === 'scavenger') {
      drawScavenger(c);
    } else if (c.type === 'chimera') {
      drawLeviathan(c);
    } else if (c.type === 'manta') {
      drawManta(c);
    } else if (c.type === 'cleaner_shrimp') {
      drawCleanerShrimp(c);
    } else if (c.type === 'anglerfish') {
      drawAnglerfish(c);
    } else if (c.type === 'nautilus') {
      drawNautilus(c);
    } else {
      drawFishCreature(c);
    }
  }

  function drawObstacle(obs: Obstacle) {
    ctx.save();
    ctx.translate(obs.x, obs.y);

    if (obs.type === 'coral_reef' && obs.branches) {
      ctx.fillStyle = 'rgba(15, 23, 42, 0.45)';
      ctx.beginPath();
      ctx.arc(0, 0, obs.radius * 0.9, 0, Math.PI * 2);
      ctx.fill();

      for (const b of obs.branches) {
        ctx.strokeStyle = b.color;
        ctx.lineWidth = 4.5;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(0, 0);
        const bx = Math.cos(b.angle) * b.length;
        const by = Math.sin(b.angle) * b.length;
        ctx.lineTo(bx, by);
        ctx.stroke();

        if (b.subBranches) {
          ctx.lineWidth = 2.5;
          for (const sb of b.subBranches) {
            ctx.beginPath();
            ctx.moveTo(bx, by);
            const sbx = bx + Math.cos(sb.angle) * sb.length;
            const sby = by + Math.sin(sb.angle) * sb.length;
            ctx.lineTo(sbx, sby);
            ctx.stroke();

            ctx.fillStyle = 'rgba(254, 205, 211, 0.6)';
            ctx.beginPath();
            ctx.arc(sbx, sby, 2.5, 0, Math.PI * 2);
            ctx.fill();
          }
        }
      }
    } else if (obs.rockVertices) {
      ctx.fillStyle = '#080d1a';
      ctx.strokeStyle = '#1e293b';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      obs.rockVertices.forEach((v, idx) => {
        const vx = Math.cos(v.angle) * v.radius;
        const vy = Math.sin(v.angle) * v.radius;
        if (idx === 0) ctx.moveTo(vx, vy);
        else ctx.lineTo(vx, vy);
      });
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }

    ctx.restore();
  }
  function drawBrainMonitor(brain: NeuralBrain, startX: number, startY: number, isCompactView = false) {
    const inVals = brain.lastInputs;
    const outVals = brain.lastOutputs;

    let thoughtText = 'CRUISING';
    let thoughtColor = '#38bdf8';
    let thoughtGlow = 'rgba(56, 189, 248, 0.2)';

    if (inVals[2] > 0.35 || inVals[3] > 0.4) {
      thoughtText = 'FLEEING THREAT';
      thoughtColor = '#f43f5e';
      thoughtGlow = 'rgba(244, 63, 94, 0.25)';
    } else if (inVals[4] > 0.35 || inVals[5] > 0.4) {
      thoughtText = 'HUNTING PREY';
      thoughtColor = '#c084fc';
      thoughtGlow = 'rgba(192, 132, 252, 0.25)';
    } else if (inVals[9] > 0.45) {
      thoughtText = 'SWARM ALERT';
      thoughtColor = '#f59e0b';
      thoughtGlow = 'rgba(245, 158, 11, 0.25)';
    } else if (inVals[0] > 0.2 || inVals[1] > 0.3) {
      thoughtText = 'FORAGING FOOD';
      thoughtColor = '#34d399';
      thoughtGlow = 'rgba(52, 211, 153, 0.25)';
    } else if (outVals[3] > 0.6) {
      thoughtText = 'ELECTRIC SHOCK';
      thoughtColor = '#facc15';
      thoughtGlow = 'rgba(250, 204, 21, 0.3)';
    }

    const animTime = world.totalTime * 4.0;

    if (isCompactView) {
      ctx.fillStyle = thoughtGlow;
      ctx.fillRect(startX, startY, 194, 18);
      ctx.strokeStyle = thoughtColor;
      ctx.lineWidth = 1;
      ctx.strokeRect(startX, startY, 194, 18);

      ctx.fillStyle = thoughtColor;
      ctx.beginPath();
      ctx.arc(startX + 9, startY + 9, 3, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 9px monospace';
      ctx.fillText(`THOUGHT: ${thoughtText}`, startX + 18, startY + 12);

      const netY = startY + 23;
      const colX = [startX + 18, startX + 97, startX + 176];

      for (let h = 0; h < brain.hiddenSize; h++) {
        const hy = netY + 4 + h * 6;
        for (let i = 0; i < brain.inputSize; i += 2) {
          const iy = netY + 2 + i * 3.5;
          const w = brain.weightsIH[h][i];
          const inAct = Math.abs(inVals[i] || 0);
          if (inAct > 0.2 && Math.abs(w) > 0.2) {
            ctx.strokeStyle = w > 0 ? 'rgba(56, 189, 248, 0.5)' : 'rgba(244, 63, 94, 0.5)';
            ctx.lineWidth = 0.8;
            ctx.beginPath();
            ctx.moveTo(colX[0], iy);
            ctx.lineTo(colX[1], hy);
            ctx.stroke();

            const pt = (animTime + i * 0.2 + h * 0.15) % 1.0;
            ctx.fillStyle = '#ffffff';
            ctx.beginPath();
            ctx.arc(colX[0] + (colX[1] - colX[0]) * pt, iy + (hy - iy) * pt, 1.0, 0, Math.PI * 2);
            ctx.fill();
          }
        }
      }

      for (let o = 0; o < brain.outputSize; o++) {
        const oy = netY + 5 + o * 7;
        for (let h = 0; h < brain.hiddenSize; h++) {
          const hy = netY + 4 + h * 6;
          const w = brain.weightsHO[o][h];
          const hAct = Math.abs(brain.lastHidden[h] || 0);
          if (hAct > 0.2 && Math.abs(w) > 0.2) {
            ctx.strokeStyle = w > 0 ? 'rgba(74, 222, 128, 0.5)' : 'rgba(244, 63, 94, 0.5)';
            ctx.lineWidth = 0.8;
            ctx.beginPath();
            ctx.moveTo(colX[1], hy);
            ctx.lineTo(colX[2], oy);
            ctx.stroke();
          }
        }
      }

      for (let i = 0; i < brain.inputSize; i++) {
        const iy = netY + 2 + i * 3.5;
        const act = Math.abs(inVals[i] || 0);
        ctx.fillStyle = act > 0.25 ? '#38bdf8' : '#1e293b';
        ctx.beginPath();
        ctx.arc(colX[0], iy, act > 0.25 ? 2.0 : 1.2, 0, Math.PI * 2);
        ctx.fill();
      }
      for (let h = 0; h < brain.hiddenSize; h++) {
        const hy = netY + 4 + h * 6;
        const act = Math.abs(brain.lastHidden[h] || 0);
        ctx.fillStyle = act > 0.25 ? '#a855f7' : '#1e293b';
        ctx.beginPath();
        ctx.arc(colX[1], hy, act > 0.25 ? 2.2 : 1.4, 0, Math.PI * 2);
        ctx.fill();
      }
      for (let o = 0; o < brain.outputSize; o++) {
        const oy = netY + 5 + o * 7;
        const act = outVals[o] || 0;
        ctx.fillStyle = act > 0.5 ? '#4ade80' : '#1e293b';
        ctx.beginPath();
        ctx.arc(colX[2], oy, act > 0.5 ? 2.2 : 1.4, 0, Math.PI * 2);
        ctx.fill();
      }
      return;
    }

    const cardW = 296;
    const cardX = startX - 33;
    const cardY = startY + 5;

    ctx.fillStyle = thoughtGlow;
    ctx.fillRect(cardX, cardY, cardW, 26);
    ctx.strokeStyle = thoughtColor;
    ctx.lineWidth = 1.5;
    ctx.strokeRect(cardX, cardY, cardW, 26);

    const pulseRadius = 4 + Math.sin(animTime * 2.0) * 1.2;
    ctx.fillStyle = thoughtColor;
    ctx.beginPath();
    ctx.arc(cardX + 14, cardY + 13, pulseRadius, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#f8fafc';
    ctx.font = 'bold 12px monospace';
    ctx.fillText(`CURRENT INTENTION : ${thoughtText}`, cardX + 26, cardY + 17);

    const colX = [cardX + 28, cardX + 148, cardX + 268];
    const inYStep = 17;
    const hidYStep = 27;
    const outYStep = 32;
    const netStartY = cardY + 38;

    for (let h = 0; h < brain.hiddenSize; h++) {
      const hy = netStartY + 14 + h * hidYStep;
      for (let i = 0; i < brain.inputSize; i++) {
        const iy = netStartY + 6 + i * inYStep;
        const w = brain.weightsIH[h][i];
        const inAct = Math.abs(inVals[i] || 0);
        const intensity = Math.abs(w) * inAct;

        if (intensity > 0.06) {
          const isFiring = intensity > 0.3;
          ctx.strokeStyle = w > 0
            ? `rgba(56, 189, 248, ${Math.min(0.9, 0.15 + intensity * 0.9)})`
            : `rgba(244, 63, 94, ${Math.min(0.9, 0.15 + intensity * 0.9)})`;
          ctx.lineWidth = isFiring ? 2.0 : 0.8;
          ctx.beginPath();
          ctx.moveTo(colX[0], iy);
          ctx.lineTo(colX[1], hy);
          ctx.stroke();

          if (isFiring) {
            const pt = (animTime + i * 0.28 + h * 0.18) % 1.0;
            const px = colX[0] + (colX[1] - colX[0]) * pt;
            const py = iy + (hy - iy) * pt;
            ctx.fillStyle = '#ffffff';
            ctx.beginPath();
            ctx.arc(px, py, 2.0, 0, Math.PI * 2);
            ctx.fill();

            ctx.fillStyle = w > 0 ? 'rgba(56, 189, 248, 0.4)' : 'rgba(244, 63, 94, 0.4)';
            ctx.beginPath();
            ctx.arc(px, py, 4.0, 0, Math.PI * 2);
            ctx.fill();
          }
        }
      }
    }

    for (let o = 0; o < brain.outputSize; o++) {
      const oy = netStartY + 20 + o * outYStep;
      for (let h = 0; h < brain.hiddenSize; h++) {
        const hy = netStartY + 14 + h * hidYStep;
        const w = brain.weightsHO[o][h];
        const hAct = Math.abs(brain.lastHidden[h] || 0);
        const intensity = Math.abs(w) * hAct;

        if (intensity > 0.06) {
          const isFiring = intensity > 0.3;
          ctx.strokeStyle = w > 0
            ? `rgba(74, 222, 128, ${Math.min(0.9, 0.15 + intensity * 0.9)})`
            : `rgba(244, 63, 94, ${Math.min(0.9, 0.15 + intensity * 0.9)})`;
          ctx.lineWidth = isFiring ? 2.0 : 0.8;
          ctx.beginPath();
          ctx.moveTo(colX[1], hy);
          ctx.lineTo(colX[2], oy);
          ctx.stroke();

          if (isFiring) {
            const pt = (animTime + h * 0.24 + o * 0.2) % 1.0;
            const px = colX[1] + (colX[2] - colX[1]) * pt;
            const py = hy + (oy - hy) * pt;
            ctx.fillStyle = '#ffffff';
            ctx.beginPath();
            ctx.arc(px, py, 2.0, 0, Math.PI * 2);
            ctx.fill();
          }
        }
      }
    }

    for (let i = 0; i < brain.inputSize; i++) {
      const iy = netStartY + 6 + i * inYStep;
      const act = Math.abs(inVals[i] || 0);
      const isFiring = act > 0.25;

      if (isFiring) {
        ctx.fillStyle = 'rgba(56, 189, 248, 0.35)';
        ctx.beginPath();
        ctx.arc(colX[0], iy, 7.0 * act, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.fillStyle = isFiring ? '#38bdf8' : '#1e293b';
      ctx.beginPath();
      ctx.arc(colX[0], iy, isFiring ? 4.5 : 2.8, 0, Math.PI * 2);
      ctx.fill();

      if (isFiring) {
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(colX[0], iy, 1.8, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    for (let h = 0; h < brain.hiddenSize; h++) {
      const hy = netStartY + 14 + h * hidYStep;
      const act = brain.lastHidden[h] || 0;
      const absAct = Math.abs(act);
      const isFiring = absAct > 0.25;

      if (isFiring) {
        ctx.fillStyle = act > 0 ? 'rgba(56, 189, 248, 0.35)' : 'rgba(244, 63, 94, 0.35)';
        ctx.beginPath();
        ctx.arc(colX[1], hy, 8.0 * absAct, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.fillStyle = isFiring ? (act > 0 ? '#38bdf8' : '#f43f5e') : '#1e293b';
      ctx.beginPath();
      ctx.arc(colX[1], hy, isFiring ? 5.0 : 3.0, 0, Math.PI * 2);
      ctx.fill();

      if (isFiring) {
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(colX[1], hy, 2.0, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    for (let o = 0; o < brain.outputSize; o++) {
      const oy = netStartY + 20 + o * outYStep;
      const act = outVals[o] || 0;
      const isFiring = act > 0.5;

      if (isFiring) {
        const ringSize = 6.0 + ((animTime * 6.0 + o) % 8.0);
        ctx.strokeStyle = `rgba(74, 222, 128, ${Math.max(0, 1.0 - ringSize / 14)})`;
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.arc(colX[2], oy, ringSize, 0, Math.PI * 2);
        ctx.stroke();

        ctx.fillStyle = 'rgba(74, 222, 128, 0.35)';
        ctx.beginPath();
        ctx.arc(colX[2], oy, 8.0 * act, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.fillStyle = isFiring ? '#4ade80' : '#1e293b';
      ctx.beginPath();
      ctx.arc(colX[2], oy, isFiring ? 5.2 : 3.0, 0, Math.PI * 2);
      ctx.fill();

      if (isFiring) {
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(colX[2], oy, 2.2, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }
  function drawColossalShadow(shadow: ColossalShadow, time: number) {
    if (!shadow.nodes || shadow.nodes.length < 2) return;
    ctx.save();

    const head = shadow.nodes[0];
    const depthAlpha = Math.max(0.12, Math.min(0.32, 0.72 - (shadow.z || 0.9) * 0.45));
    ctx.globalAlpha = depthAlpha;
    const auraGrad = ctx.createRadialGradient(head.x, head.y, 40, head.x, head.y, 480);
    auraGrad.addColorStop(0, 'rgba(6, 42, 82, 0.22)');
    auraGrad.addColorStop(0.45, 'rgba(2, 20, 48, 0.12)');
    auraGrad.addColorStop(0.85, 'rgba(1, 8, 22, 0.04)');
    auraGrad.addColorStop(1, 'rgba(0, 2, 6, 0)');
    ctx.fillStyle = auraGrad;
    ctx.beginPath();
    ctx.arc(head.x, head.y, 480, 0, Math.PI * 2);
    ctx.fill();
    if (shadow.nodes.length > 3) {
      const wingNode = shadow.nodes[2];
      const prevNode = shadow.nodes[1];
      const segAng = Math.atan2(prevNode.y - wingNode.y, prevNode.x - wingNode.x);
      const flap = Math.sin(shadow.phase * 0.7) * 0.15;

      for (let side = -1; side <= 1; side += 2) {
        ctx.save();
        ctx.translate(wingNode.x, wingNode.y);
        ctx.rotate(segAng + side * (Math.PI * 0.5 + 0.35 + flap));

        const wingSpan = 380;
        const wingGrad = ctx.createLinearGradient(0, 0, 0, side * wingSpan);
        wingGrad.addColorStop(0, 'rgba(3, 18, 42, 0.75)');
        wingGrad.addColorStop(0.5, 'rgba(4, 28, 62, 0.4)');
        wingGrad.addColorStop(0.85, 'rgba(6, 182, 212, 0.12)');
        wingGrad.addColorStop(1, 'rgba(56, 189, 248, 0)');

        ctx.fillStyle = wingGrad;
        ctx.strokeStyle = 'rgba(56, 189, 248, 0.2)';
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.bezierCurveTo(45, side * (wingSpan * 0.38), 110, side * (wingSpan * 0.72), 175, side * wingSpan);
        ctx.bezierCurveTo(120, side * (wingSpan * 0.82), 65, side * (wingSpan * 0.65), 35, side * (wingSpan * 0.45));
        ctx.bezierCurveTo(10, side * (wingSpan * 0.35), -25, side * (wingSpan * 0.22), -45, side * (wingSpan * 0.1));
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        ctx.strokeStyle = 'rgba(34, 211, 238, 0.16)';
        ctx.lineWidth = 1.0;
        for (let r = 1; r <= 4; r++) {
          const rt = r / 5;
          ctx.beginPath();
          ctx.moveTo(0, 0);
          ctx.quadraticCurveTo(35 * rt, side * (wingSpan * 0.45) * rt, 175 * rt, side * wingSpan * rt);
          ctx.stroke();
        }
        ctx.restore();
      }
    }
    for (let i = shadow.nodes.length - 1; i >= 1; i--) {
      const node = shadow.nodes[i];
      const prev = shadow.nodes[i - 1];
      const t = i / shadow.nodes.length;
      const segAngle = Math.atan2(prev.y - node.y, prev.x - node.x);
      const nodeRadius = (1.0 - t * 0.65) * 62;

      ctx.save();
      ctx.translate(node.x, node.y);
      ctx.rotate(segAngle);
      if (i === shadow.nodes.length - 1) {
        const tailWave = Math.sin(shadow.phase + i * 0.38) * 20;
        ctx.fillStyle = 'rgba(2, 14, 34, 0.82)';
        ctx.strokeStyle = 'rgba(56, 189, 248, 0.28)';
        ctx.lineWidth = 1.6;

        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.bezierCurveTo(-95, -155 + tailWave, -195, -130 + tailWave, -275, -75 + tailWave);
        ctx.bezierCurveTo(-205, 0 + tailWave, -205, 0 + tailWave, -275, 75 + tailWave);
        ctx.bezierCurveTo(-195, 130 + tailWave, -95, 155 + tailWave, 0, 0);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        ctx.strokeStyle = 'rgba(6, 182, 212, 0.2)';
        ctx.lineWidth = 1.1;
        for (let fr = -3; fr <= 3; fr++) {
          ctx.beginPath();
          ctx.moveTo(0, 0);
          ctx.quadraticCurveTo(-130, fr * 36 + tailWave, -265, fr * 20 + tailWave);
          ctx.stroke();
        }
      }
      for (let s = -1; s <= 1; s += 2) {
        ctx.fillStyle = 'rgba(2, 12, 28, 0.65)';
        ctx.strokeStyle = 'rgba(14, 116, 144, 0.22)';
        ctx.lineWidth = 1.1;
        ctx.beginPath();
        ctx.moveTo(0, s * nodeRadius * 0.5);
        ctx.lineTo(-nodeRadius * 0.8, s * (nodeRadius * 1.5 + (1 - t) * 26));
        ctx.lineTo(nodeRadius * 0.4, s * nodeRadius * 0.3);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      }
      ctx.fillStyle = 'rgba(2, 12, 28, 0.82)';
      ctx.strokeStyle = 'rgba(14, 116, 144, 0.24)';
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.ellipse(0, 0, nodeRadius * 1.15, nodeRadius * 0.9, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = 'rgba(56, 189, 248, 0.28)';
      ctx.beginPath();
      ctx.arc(0, 0, Math.max(2.5, (1 - t) * 8.5), 0, Math.PI * 2);
      ctx.fill();

      ctx.restore();
    }
    const headAngle = shadow.angle;
    ctx.save();
    ctx.translate(head.x, head.y);
    ctx.rotate(headAngle);

    ctx.fillStyle = 'rgba(2, 12, 28, 0.88)';
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.32)';
    ctx.lineWidth = 1.8;

    ctx.beginPath();
    ctx.moveTo(125, 0); // Slender Rostrum
    ctx.bezierCurveTo(85, -58, 12, -72, -50, -56);
    ctx.lineTo(-80, 0);
    ctx.lineTo(-50, 56);
    ctx.bezierCurveTo(12, 72, 85, 58, 125, 0);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    for (let s = -1; s <= 1; s += 2) {
      ctx.fillStyle = 'rgba(3, 18, 42, 0.8)';
      ctx.strokeStyle = 'rgba(56, 189, 248, 0.28)';
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.moveTo(28, s * 38);
      ctx.quadraticCurveTo(-18, s * 105, -105, s * 125);
      ctx.quadraticCurveTo(-38, s * 72, -16, s * 38);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      const tendrilWave = Math.sin(shadow.phase * 1.4 + s) * 14;
      ctx.strokeStyle = 'rgba(56, 189, 248, 0.28)';
      ctx.lineWidth = 1.1;
      ctx.beginPath();
      ctx.moveTo(95, s * 22);
      ctx.bezierCurveTo(145, s * 45 + tendrilWave, 180, s * 20 - tendrilWave, 235, s * 35);
      ctx.stroke();
      ctx.fillStyle = 'rgba(34, 211, 238, 0.75)';
      ctx.beginPath();
      ctx.ellipse(52, s * 28, 8, 3.2, s * 0.2, 0, Math.PI * 2);
      ctx.fill();

      const eyeGlow = ctx.createRadialGradient(52, s * 28, 1, 52, s * 28, 24);
      eyeGlow.addColorStop(0, 'rgba(56, 189, 248, 0.45)');
      eyeGlow.addColorStop(1, 'rgba(2, 6, 23, 0)');
      ctx.fillStyle = eyeGlow;
      ctx.beginPath();
      ctx.arc(52, s * 28, 24, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
    ctx.restore();
  }



function drawHydrothermalVent(vent: HydrothermalVent) {
  ctx.save();
  ctx.translate(vent.x, vent.y);

  const halfW = vent.width * 0.5;
  const peakH = vent.height;
  const crW = vent.craterWidth * 0.5;
  const moundGrad = ctx.createLinearGradient(0, -peakH, 0, 0);
  moundGrad.addColorStop(0, '#0f172a');
  moundGrad.addColorStop(0.45, '#070d18');
  moundGrad.addColorStop(1, '#020617');

  ctx.fillStyle = moundGrad;
  ctx.strokeStyle = '#1e293b';
  ctx.lineWidth = 1.8;

  ctx.beginPath();
  ctx.moveTo(-halfW, 0);
  ctx.bezierCurveTo(-halfW * 0.72, -peakH * 0.18, -halfW * 0.42, -peakH * 0.7, -crW * 1.35, -peakH);
  ctx.lineTo(-crW, -peakH + 8); // Gentle crater dip
  ctx.quadraticCurveTo(0, -peakH + 12, crW, -peakH + 8);
  ctx.lineTo(crW * 1.35, -peakH);
  ctx.bezierCurveTo(halfW * 0.42, -peakH * 0.7, halfW * 0.72, -peakH * 0.18, halfW, 0);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.strokeStyle = 'rgba(30, 41, 59, 0.75)';
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(-halfW * 0.65, -peakH * 0.22);
  ctx.quadraticCurveTo(0, -peakH * 0.38, halfW * 0.55, -peakH * 0.26);
  ctx.moveTo(-halfW * 0.4, -peakH * 0.52);
  ctx.quadraticCurveTo(0, -peakH * 0.62, halfW * 0.35, -peakH * 0.55);
  ctx.stroke();
  ctx.strokeStyle = 'rgba(217, 119, 6, 0.28)';
  ctx.lineWidth = 1.0;
  ctx.beginPath();
  ctx.moveTo(-crW * 0.6, -peakH + 9);
  ctx.lineTo(-crW * 0.3, -peakH * 0.6);
  ctx.lineTo(-crW * 0.5, -peakH * 0.35);
  ctx.moveTo(crW * 0.5, -peakH + 9);
  ctx.lineTo(crW * 0.2, -peakH * 0.55);
  ctx.stroke();
  const craterGlow = ctx.createRadialGradient(0, -peakH + 8, 2, 0, -peakH + 8, crW * 1.8);
  craterGlow.addColorStop(0, 'rgba(245, 158, 11, 0.35)');
  craterGlow.addColorStop(0.45, 'rgba(14, 116, 144, 0.18)');
  craterGlow.addColorStop(1, 'rgba(2, 6, 23, 0)');
  ctx.fillStyle = craterGlow;
  ctx.beginPath();
  ctx.arc(0, -peakH + 8, crW * 1.8, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(254, 240, 138, 0.5)';
  ctx.beginPath();
  ctx.ellipse(0, -peakH + 9, crW * 0.65, 3.0, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

function drawLightCurtain(w: number, h: number, time: number) {
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 0, w, h);
  ctx.clip();
  ctx.globalCompositeOperation = 'screen';
  const ambientH = h * 0.45;
  const ambientGrad = ctx.createLinearGradient(0, 0, 0, ambientH);
  ambientGrad.addColorStop(0.0, 'rgba(56, 189, 248, 0.12)');
  ambientGrad.addColorStop(0.3, 'rgba(20, 184, 166, 0.05)');
  ambientGrad.addColorStop(0.7, 'rgba(6, 78, 119, 0.015)');
  ambientGrad.addColorStop(1.0, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = ambientGrad;
  ctx.fillRect(0, 0, w, ambientH);
  const sourceCenterX = w * 0.5;
  const beamConfigs = [
    { baseOffset: -0.42, width: 85, depth: 0.65, speed: 0.35, phase: 0.0, intensity: 0.8 },
    { baseOffset: -0.32, width: 140, depth: 0.82, speed: 0.28, phase: 1.4, intensity: 1.0 },
    { baseOffset: -0.22, width: 60, depth: 0.55, speed: 0.45, phase: 2.8, intensity: 0.6 },
    { baseOffset: -0.12, width: 110, depth: 0.75, speed: 0.32, phase: 0.8, intensity: 0.9 },
    { baseOffset: -0.03, width: 160, depth: 0.88, speed: 0.22, phase: 3.5, intensity: 1.1 },
    { baseOffset:  0.08, width: 95, depth: 0.70, speed: 0.38, phase: 2.1, intensity: 0.75 },
    { baseOffset:  0.18, width: 150, depth: 0.85, speed: 0.26, phase: 4.6, intensity: 1.05 },
    { baseOffset:  0.28, width: 70, depth: 0.60, speed: 0.42, phase: 1.9, intensity: 0.65 },
    { baseOffset:  0.38, width: 130, depth: 0.78, speed: 0.30, phase: 5.2, intensity: 0.95 },
    { baseOffset:  0.48, width: 90, depth: 0.62, speed: 0.36, phase: 3.1, intensity: 0.7 }
  ];

  for (let i = 0; i < beamConfigs.length; i++) {
    const cfg = beamConfigs[i];
    const wave1 = Math.sin(time * cfg.speed + cfg.phase);
    const wave2 = Math.cos(time * (cfg.speed * 0.7) + cfg.phase * 1.5);
    const shimmer = 0.75 + wave1 * 0.18 + wave2 * 0.07;

    const originX = sourceCenterX + (cfg.baseOffset * w) + (wave1 * 30);
    const originY = 0; // 水面ライン（y=0）から下向きに放射

    const centerNorm = (originX - sourceCenterX) / (w * 0.5);
    const naturalSpreadAngle = centerNorm * 0.22;
    const swayAngle = Math.sin(time * 0.25 + cfg.phase) * 0.04;
    const beamAngle = naturalSpreadAngle + swayAngle;

    const beamLength = h * cfg.depth * (0.9 + wave2 * 0.1);
    const beamWidth = cfg.width * (0.9 + wave1 * 0.15);
    const currentAlpha = 0.042 * cfg.intensity * shimmer;

    ctx.save();
    ctx.translate(originX, originY);
    ctx.rotate(beamAngle);

    const scaleX = beamWidth / beamLength;
    ctx.scale(scaleX, 1.0);

    const radial = ctx.createRadialGradient(0, 0, 0, 0, beamLength * 0.25, beamLength);
    radial.addColorStop(0.0, `rgba(224, 242, 254, ${currentAlpha * 2.8})`);
    radial.addColorStop(0.18, `rgba(56, 189, 248, ${currentAlpha * 1.8})`);
    radial.addColorStop(0.45, `rgba(20, 184, 166, ${currentAlpha * 0.9})`);
    radial.addColorStop(0.72, `rgba(6, 78, 119, ${currentAlpha * 0.3})`);
    radial.addColorStop(1.0, 'rgba(0, 0, 0, 0)');

    ctx.fillStyle = radial;
    ctx.beginPath();
    ctx.arc(0, 0, beamLength, 0, Math.PI);
    ctx.closePath();
    ctx.fill();

    ctx.restore();
  }
  ctx.strokeStyle = 'rgba(224, 242, 254, 0.05)';
  ctx.lineWidth = 1.2;
  const bands = 4;
  for (let b = 0; b < bands; b++) {
    const baseY = 8 + b * 16;
    const bSpeed = 0.8 + b * 0.25;
    ctx.beginPath();
    for (let x = 0; x <= w; x += 25) {
      const cy = baseY +
        Math.sin(x * 0.02 + time * bSpeed + b) * 5 +
        Math.cos(x * 0.035 - time * (bSpeed * 0.6)) * 3;
      if (x === 0) ctx.moveTo(x, cy);
      else ctx.lineTo(x, cy);
    }
    ctx.stroke();
  }

  ctx.restore();
}

let lastTime = performance.now();

function loop(time: number) {
  try {
    const dt = (time - lastTime) / 1000;
    lastTime = time;

    idleTimer += dt;
    const viewW = window.innerWidth;
    const viewH = window.innerHeight;

    if (idleTimer > 10.0 && !selectedCreature) {
      autoCinematic = true;
    }
    const minZoom = Math.max(viewW / world.width, viewH / world.height);
    targetZoom = Math.min(3.2, Math.max(minZoom, targetZoom));

    if (selectedCreature && !selectedCreature.isDead) {
      targetCamX = selectedCreature.x - viewW / (2 * zoom);
      targetCamY = selectedCreature.y - viewH / (2 * zoom);
    } else {
      if (selectedCreature && selectedCreature.isDead) {
        selectedCreature = null;
      }
      if (autoCinematic && !isPanning && !isMouseDown) {
        const driftT = world.totalTime * 0.025;
        const driftX = (Math.sin(driftT * 0.6) * 0.42 + 0.5) * (world.width - viewW / zoom);
        const driftY = (Math.cos(driftT * 0.45) * 0.32 + 0.58) * (world.height - viewH / zoom);
        targetCamX += (driftX - targetCamX) * 0.0025;
        targetCamY += (driftY - targetCamY) * 0.0025;
        targetZoom += (Math.max(minZoom, 0.72) - targetZoom) * 0.002;
      }
    }
    const maxCamX = Math.max(0, world.width - viewW / zoom);
    const maxCamY = Math.max(0, world.height - viewH / zoom);
    targetCamX = Math.max(0, Math.min(maxCamX, targetCamX));
    targetCamY = Math.max(0, Math.min(maxCamY, targetCamY));

    camX += (targetCamX - camX) * 0.04;
    camY += (targetCamY - camY) * 0.04;
    zoom += (targetZoom - zoom) * 0.04;

    camX = Math.max(0, Math.min(maxCamX, camX));
    camY = Math.max(0, Math.min(maxCamY, camY));

    world.update(dt);
    sound.update(dt);

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = '#010409';
    ctx.fillRect(0, 0, viewW, viewH);

    ctx.save();
    ctx.scale(zoom, zoom);
    ctx.translate(-camX, -camY);
    const oceanGrad = ctx.createLinearGradient(0, 0, 0, world.height);
    oceanGrad.addColorStop(0.00, '#031b38'); // Moody upper twilight blue
    oceanGrad.addColorStop(0.12, '#021226'); // Mesopelagic transition
    oceanGrad.addColorStop(0.28, '#010b18'); // Midnight deep twilight
    oceanGrad.addColorStop(0.48, '#01060e'); // Deep bathypelagic dark zone
    oceanGrad.addColorStop(0.72, '#000308'); // Abyssal boundary
    oceanGrad.addColorStop(1.00, '#000103'); // Abyssal benthic pitch black void
    ctx.fillStyle = oceanGrad;
    ctx.fillRect(0, 0, world.width, world.height);
    drawColossalShadow(world.colossalShadow, world.totalTime);

    ctx.save();
    ctx.fillStyle = '#010307';
    ctx.strokeStyle = '#0f172a';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(0, world.height);
    const segW = world.width / 63;
    for (let s = 0; s < 64; s++) {
      const sx = s * segW;
      const sy = world.height - 18 - (world.sediment[s] || 0);
      if (s === 0) {
        ctx.lineTo(sx, sy);
      } else {
        const prevX = (s - 1) * segW;
        const prevY = world.height - 18 - (world.sediment[s - 1] || 0);
        ctx.quadraticCurveTo(prevX, prevY, (prevX + sx) * 0.5, (prevY + sy) * 0.5);
      }
    }
    ctx.lineTo(world.width, world.height);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();

    const thermoclineY = world.height * 0.48;
    for (const vent of world.hydrothermalVents) {
      if (isInView(vent.x, vent.y - vent.height / 2, vent.height + 60)) {
        drawHydrothermalVent(vent);
      }
    }

    for (const kelp of world.kelps) {
      if (isInView(kelp.baseX, kelp.baseY - kelp.height / 2, kelp.height / 2 + 50)) {
        drawKelp(kelp);
      }
    }
    for (const obs of world.obstacles) {
      if (isInView(obs.x, obs.y, obs.radius + 30)) drawObstacle(obs);
    }
    for (const egg of world.eggs) {
      if (isInView(egg.x, egg.y, 20)) drawEgg(egg);
    }
    const focusZ = 0.5 + Math.sin(world.totalTime * 0.07) * 0.32;

    for (const p of world.plants) {
      if (!isInView(p.x, p.y, p.size + 20)) continue;
      const thermoDistP = Math.abs(p.y - thermoclineY);
      const isShimmeringP = thermoDistP < 140;
      if (isShimmeringP) {
        ctx.save();
        const pShimmer = Math.sin(world.totalTime * 3.6 + p.y * 0.04) * (3.5 * (1.0 - thermoDistP / 140));
        ctx.translate(pShimmer, 0);
      }

      if (p.type === 'whale_fall') {
        drawWhaleFall(p);
      } else if (p.type === 'meat_remains') {
        ctx.save();
        ctx.translate(p.x, p.y);
        const mSize = Math.max(5.5, p.size * 1.2);
        ctx.fillStyle = '#9f1239';
        ctx.strokeStyle = '#f43f5e';
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.moveTo(-mSize * 0.9, -mSize * 0.4);
        ctx.lineTo(mSize * 0.4, -mSize * 0.85);
        ctx.lineTo(mSize * 0.95, 0.1);
        ctx.lineTo(mSize * 0.3, mSize * 0.85);
        ctx.lineTo(-mSize * 0.7, mSize * 0.6);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = '#fff1f2';
        ctx.beginPath();
        ctx.arc(0, 0, mSize * 0.32, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      } else if (p.type === 'fruit') {
        ctx.beginPath();
        ctx.fillStyle = '#f59e0b';
        ctx.arc(p.x, p.y, Math.max(3.0, p.size * 1.0), 0, Math.PI * 2);
        ctx.fill();
      } else if (p.type === 'marine_snow') {
        ctx.save();
        const snowPulse = 0.5 + Math.sin(world.totalTime * 3 + p.id) * 0.3;
        ctx.fillStyle = `rgba(224, 242, 254, ${0.45 + snowPulse * 0.35})`;
        ctx.beginPath();
        ctx.arc(p.x, p.y, Math.max(1.2, p.size), 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      } else if (p.type === 'deep_coral') {
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.fillStyle = 'rgba(236, 72, 153, 0.7)';
        ctx.beginPath();
        ctx.arc(0, 0, p.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#f472b6';
        ctx.lineWidth = 1;
        for (let a = 0; a < 4; a++) {
          const ang = (a * Math.PI) / 2 + world.totalTime * 0.5;
          ctx.beginPath();
          ctx.moveTo(0, 0);
          ctx.lineTo(Math.cos(ang) * (p.size * 1.4), Math.sin(ang) * (p.size * 1.4));
          ctx.stroke();
        }
        ctx.restore();
      } else if (p.type === 'biolume_plankton') {
        ctx.save();
        ctx.translate(p.x, p.y);
        const glow = 0.6 + Math.sin(world.totalTime * 4 + p.id) * 0.4;
        ctx.fillStyle = `rgba(34, 211, 238, ${glow * 0.8})`;
        ctx.beginPath();
        ctx.arc(0, 0, p.size * 1.1, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(0, 0, p.size * 0.4, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      } else if (p.type === 'hydro_spore') {
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.fillStyle = '#f97316';
        ctx.beginPath();
        ctx.arc(0, 0, p.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#fdba74';
        ctx.lineWidth = 1.2;
        ctx.stroke();
        ctx.restore();
      } else if (p.type === 'bacteria_mat') {
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.fillStyle = 'rgba(16, 185, 129, 0.35)';
        ctx.beginPath();
        ctx.ellipse(0, 0, p.size * 1.8, p.size * 0.8, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#34d399';
        ctx.lineWidth = 1;
        ctx.stroke();
        ctx.fillStyle = '#6ee7b7';
        ctx.beginPath();
        ctx.arc(0, 0, p.size * 0.4, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      } else {
        ctx.beginPath();
        ctx.fillStyle = 'rgba(16, 185, 129, 0.42)';
        ctx.arc(p.x, p.y, p.size * 0.95, 0, Math.PI * 2);
        ctx.fill();
      }

      if (isShimmeringP) {
        ctx.restore();
      }
    }

    const sortedCreatures = [...world.creatures].sort((a, b) => b.z - a.z);
    for (const c of sortedCreatures) {
      if (!isInView(c.x, c.y, 80)) continue;

      ctx.save();
      const depthDiff = Math.abs((c.z || 0.5) - focusZ);
      const dofAlpha = Math.max(0.32, 1.0 - depthDiff * 0.75);
      ctx.globalAlpha = dofAlpha;
      const thermoDistC = Math.abs(c.y - thermoclineY);
      if (thermoDistC < 140) {
        const cShimmer = Math.sin(world.totalTime * 3.8 + c.y * 0.04) * (4.0 * (1.0 - thermoDistC / 140));
        ctx.translate(cShimmer, 0);
      }

      drawCreature(c);
      ctx.restore();
    }
    for (const pt of world.particles) {
      const radius = Math.max(0, pt.size * (pt.life / Math.max(0.001, pt.maxLife)));
      if (radius <= 0) continue;
      ctx.fillStyle = pt.color;
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, radius, 0, Math.PI * 2);
      ctx.fill();
    }
    for (const sw of world.shockwaves) {
      const radius = Math.max(0, sw.radius);
      if (radius <= 0 || sw.life <= 0) continue;
      ctx.strokeStyle = sw.color;
      ctx.lineWidth = Math.max(0.1, 3 * sw.life);
      ctx.beginPath();
      ctx.arc(sw.x, sw.y, radius, 0, Math.PI * 2);
      ctx.stroke();
    }
    drawLightCurtain(world.width, world.height, world.totalTime);
    ctx.save();
    for (let fg = 0; fg < 12; fg++) {
      const fgTime = world.totalTime * 0.15 + fg * 123.45;
      const fgX = (Math.sin(fgTime * 0.4) * 0.5 + 0.5) * world.width;
      const fgY = ((world.totalTime * 18 + fg * 220) % world.height);
      const fgRadius = 14 + (fg % 5) * 8;
      const fgGrad = ctx.createRadialGradient(fgX, fgY, 1, fgX, fgY, fgRadius);
      fgGrad.addColorStop(0, 'rgba(224, 242, 254, 0.18)');
      fgGrad.addColorStop(0.5, 'rgba(56, 189, 248, 0.08)');
      fgGrad.addColorStop(1, 'rgba(2, 6, 23, 0)');
      ctx.fillStyle = fgGrad;
      ctx.beginPath();
      ctx.arc(fgX, fgY, fgRadius, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();

    const edgeFade = 220;
    const gTop = ctx.createLinearGradient(0, 0, 0, edgeFade);
    gTop.addColorStop(0, '#010409');
    gTop.addColorStop(1, 'rgba(1, 4, 9, 0)');
    ctx.fillStyle = gTop;
    ctx.fillRect(0, 0, world.width, edgeFade);
    const gBot = ctx.createLinearGradient(0, world.height - edgeFade, 0, world.height);
    gBot.addColorStop(0, 'rgba(1, 4, 9, 0)');
    gBot.addColorStop(1, '#010409');
    ctx.fillStyle = gBot;
    ctx.fillRect(0, world.height - edgeFade, world.width, edgeFade);
    const gLeft = ctx.createLinearGradient(0, 0, edgeFade, 0);
    gLeft.addColorStop(0, '#010409');
    gLeft.addColorStop(1, 'rgba(1, 4, 9, 0)');
    ctx.fillStyle = gLeft;
    ctx.fillRect(0, 0, edgeFade, world.height);
    const gRight = ctx.createLinearGradient(world.width - edgeFade, 0, world.width, 0);
    gRight.addColorStop(0, 'rgba(1, 4, 9, 0)');
    gRight.addColorStop(1, '#010409');
    ctx.fillStyle = gRight;
    ctx.fillRect(world.width - edgeFade, 0, edgeFade, world.height);

    ctx.restore();

    const isMobile = viewW <= 768 || viewH <= 500;
    const isPortrait = viewW < viewH;
    const barHeight = isMobile ? (isPortrait ? 42 : 30) : 60;

    let herbs = 0, carns = 0, jellies = 0, scavs = 0, larvaCount = 0;
    for (const c of world.creatures) {
      if (c.stage === 'larva') larvaCount++;
      if (c.type === 'solar_jelly') jellies++;
      else if (c.type === 'scavenger') scavs++;
      else if (c.dna.diet > 0.55) carns++;
      else herbs++;
    }
    if (world.timeScale === 0) {
      const pauseVignette = ctx.createRadialGradient(viewW * 0.5, viewH * 0.5, viewW * 0.15, viewW * 0.5, viewH * 0.5, viewW * 0.75);
      pauseVignette.addColorStop(0.0, 'rgba(14, 116, 144, 0.03)');
      pauseVignette.addColorStop(0.6, 'rgba(2, 44, 84, 0.22)');
      pauseVignette.addColorStop(1.0, 'rgba(2, 6, 23, 0.55)');
      ctx.fillStyle = pauseVignette;
      ctx.fillRect(0, 0, viewW, viewH);

      ctx.fillStyle = 'rgba(56, 189, 248, 0.85)';
      ctx.font = isMobile ? 'bold 10px monospace' : 'bold 12px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('[ PAUSED - INSPECT MODE ]', viewW * 0.5, isMobile ? 54 : 80);
      ctx.textAlign = 'left';
    }
    if (autoCinematic) {
      const letterboxH = isMobile ? 16 : 32;
      ctx.fillStyle = 'rgba(2, 6, 23, 0.45)';
      ctx.fillRect(0, 0, viewW, letterboxH);
      ctx.fillRect(0, viewH - letterboxH, viewW, letterboxH);
    }

    if (isMobile) {
      ctx.font = '9px "JetBrains Mono", monospace';
      if (isPortrait) {
        ctx.fillStyle = '#38bdf8';
        ctx.fillText('NEURAL-OCEAN', 8, 15);
        ctx.fillStyle = '#4ade80';
        ctx.fillText(`H:${herbs}`, 84, 15);
        ctx.fillStyle = '#34d399';
        ctx.fillText(`J:${jellies}`, 118, 15);
        ctx.fillStyle = '#f59e0b';
        ctx.fillText(`S:${scavs}`, 150, 15);
        ctx.fillStyle = '#f87171';
        ctx.fillText(`C:${carns}`, 182, 15);

        ctx.fillStyle = '#facc15';
        ctx.fillText(`Eggs:${world.eggs.length}/Larvae:${larvaCount}`, 8, 28);
        ctx.fillStyle = '#a855f7';
        ctx.fillText(`Gen.${world.maxGen}`, 128, 28);
      } else {
        ctx.fillStyle = '#38bdf8';
        ctx.fillText('NEURAL-OCEAN', 8, 17);
        ctx.fillStyle = '#4ade80';
        ctx.fillText(`Herb:${herbs}`, 84, 17);
        ctx.fillStyle = '#34d399';
        ctx.fillText(`Jelly:${jellies}`, 130, 17);
        ctx.fillStyle = '#f59e0b';
        ctx.fillText(`Scav:${scavs}`, 180, 17);
        ctx.fillStyle = '#f87171';
        ctx.fillText(`Carn:${carns}`, 228, 17);
        ctx.fillStyle = '#facc15';
        ctx.fillText(`Eggs:${world.eggs.length}/Larvae:${larvaCount}`, 274, 17);
        ctx.fillStyle = '#a855f7';
        ctx.fillText(`Gen.${world.maxGen}`, Math.min(viewW - 150, 410), 17);
      }
    } else {
      ctx.fillStyle = '#38bdf8';
      ctx.font = 'bold 14px "JetBrains Mono", monospace';
      ctx.fillText('NEURAL-OCEAN', 20, 24);

      ctx.font = '11px "JetBrains Mono", monospace';
      ctx.fillStyle = '#4ade80';
      ctx.fillText(`Herbivores: ${herbs}`, 20, 44);
      ctx.fillStyle = '#34d399';
      ctx.fillText(`Jellies: ${jellies}`, 130, 44);
      ctx.fillStyle = '#f59e0b';
      ctx.fillText(`Scavengers: ${scavs}`, 220, 44);
      ctx.fillStyle = '#f87171';
      ctx.fillText(`Carnivores: ${carns}`, 330, 44);
      ctx.fillStyle = '#facc15';
      ctx.fillText(`Eggs: ${world.eggs.length} / Larvae: ${larvaCount}`, 440, 44);
      ctx.fillStyle = '#a855f7';
      ctx.fillText(`Max Gen: ${world.maxGen}`, 600, 44);
    }
    const totalAdults = Math.max(1, herbs + jellies + scavs + carns);
    const barX = isMobile ? 8 : 20;
    const barY = isMobile ? (isPortrait ? 33 : 23) : 50;
    const barW = isMobile ? (isPortrait ? viewW - 150 : Math.min(viewW - 160, 260)) : 520;
    const barH = isMobile ? 3 : 4;

    ctx.fillStyle = 'rgba(15, 23, 42, 0.8)';
    ctx.fillRect(barX, barY, barW, barH);

    const wHerb = (herbs / totalAdults) * barW;
    const wJelly = (jellies / totalAdults) * barW;
    const wScav = (scavs / totalAdults) * barW;
    const wCarn = (carns / totalAdults) * barW;

    let curBX = barX;
    ctx.fillStyle = '#4ade80';
    ctx.fillRect(curBX, barY, wHerb, barH);
    curBX += wHerb;

    ctx.fillStyle = '#34d399';
    ctx.fillRect(curBX, barY, wJelly, barH);
    curBX += wJelly;

    ctx.fillStyle = '#f59e0b';
    ctx.fillRect(curBX, barY, wScav, barH);
    curBX += wScav;

    ctx.fillStyle = '#f87171';
    ctx.fillRect(curBX, barY, wCarn, barH);
    const timeOptions = [
      { label: '||', speed: 0 },
      { label: '1x', speed: 1.0 },
      { label: '2x', speed: 2.5 },
      { label: '5x', speed: 5.0 }
    ];

    const tCtrlX = isMobile ? viewW - 136 : viewW - 198;
    const tCtrlY = isMobile ? 6 : 16;
    const tBtnW = isMobile ? 28 : 40;
    const tBtnH = isMobile ? 20 : 24;
    const tGap = isMobile ? 4 : 6;

    timeOptions.forEach((opt, idx) => {
      const bx = tCtrlX + idx * (tBtnW + tGap);
      const isActive = opt.speed === 0 ? (world.timeScale === 0) : (Math.abs(world.timeScale - opt.speed) < 0.2);

      ctx.fillStyle = isActive ? 'rgba(56, 189, 248, 0.28)' : 'rgba(15, 23, 42, 0.85)';
      ctx.fillRect(bx, tCtrlY, tBtnW, tBtnH);
      ctx.strokeStyle = isActive ? '#38bdf8' : '#334155';
      ctx.lineWidth = isActive ? 1.5 : 1.0;
      ctx.strokeRect(bx, tCtrlY, tBtnW, tBtnH);

      ctx.fillStyle = isActive ? '#38bdf8' : '#94a3b8';
      ctx.font = isMobile ? 'bold 8px monospace' : 'bold 10px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(opt.label, bx + tBtnW * 0.5, tCtrlY + (isMobile ? 13 : 16));
      ctx.textAlign = 'left';
    });

    if (selectedCreature && !selectedCreature.isDead) {
      const sc = selectedCreature;
      const hudW = isMobile ? Math.min(210, viewW - 20) : 320;
      const hudH = isMobile ? 100 : 330;
      const hudX = isMobile ? 10 : (viewW - hudW - 20);
      const hudY = isMobile ? (barHeight + 6) : (viewH - hudH - 65);

      ctx.fillStyle = 'rgba(2, 6, 23, 0.95)';
      ctx.fillRect(hudX, hudY, hudW, hudH);
      ctx.strokeStyle = sc.dna.diet > 0.5 ? '#ef4444' : '#38bdf8';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(hudX, hudY, hudW, hudH);

      const typeIcon = sc.type === 'solar_jelly' ? '[JELLY]' : sc.type === 'scavenger' ? '[SCAVENGER]' : sc.type === 'chimera' ? '[APEX LEVIATHAN]' : sc.type === 'manta' ? '[ABYSS MANTA]' : sc.type === 'cleaner_shrimp' ? '[CLEANER SHRIMP]' : sc.type === 'anglerfish' ? '[ABYSSAL ANGLER]' : sc.type === 'nautilus' ? '[ANCIENT NAUTILUS]' : sc.dna.diet > 0.5 ? '[CARNIVORE]' : '[HERBIVORE]';
      const stageStr = sc.stage === 'larva' ? `Larva (${(sc.growth * 100).toFixed(0)}%)` : 'Adult';
      const actionStr = sc.currentAction ? sc.currentAction.toUpperCase() : 'IDLE';
      const depthStr = `Depth:${((sc.z || 0) * 100).toFixed(0)}%`;

      ctx.fillStyle = sc.dna.diet > 0.5 ? '#f87171' : '#38bdf8';
      ctx.font = isMobile ? 'bold 10px monospace' : 'bold 13px monospace';
      ctx.fillText(`${typeIcon} #${sc.id} (Gen.${sc.generation}) [${actionStr}]`, hudX + 8, hudY + (isMobile ? 12 : 20));

      if (!isMobile) {
        const rkStr = sc.dna.rkStrategy > 0.55 ? 'K-Strat' : 'r-Strat';
        ctx.fillStyle = '#cbd5e1';
        ctx.font = '11px monospace';
        ctx.fillText(`Stage: [${stageStr}] | [${depthStr}] | [${rkStr}]`, hudX + 12, hudY + 38);
        ctx.fillText(`Age: ${sc.age.toFixed(1)}/${sc.dna.maxAge.toFixed(1)}s | Kills: ${sc.kills} | Offspring: ${sc.children}`, hudX + 12, hudY + 56);
      }

      const barY = isMobile ? hudY + 18 : hudY + 66;
      ctx.fillStyle = '#1e293b';
      ctx.fillRect(hudX + 8, barY, hudW - 16, isMobile ? 4 : 6);
      const eRatio = Math.max(0, Math.min(1, sc.energy / sc.maxEnergy));
      ctx.fillStyle = '#10b981';
      ctx.fillRect(hudX + 8, barY, (hudW - 16) * eRatio, isMobile ? 4 : 6);

      if (isMobile) {
        drawBrainMonitor(sc.brain, hudX + 8, hudY + 28, true);
      } else {
        ctx.fillStyle = '#a855f7';
        ctx.font = 'bold 11px monospace';
        ctx.fillText('NEURAL BRAIN // ACTIVATION MONITOR', hudX + 12, hudY + 92);
        drawBrainMonitor(sc.brain, hudX + 45, hudY + 95, false);
      }

      if (autoCinematic && !isMobile) {
        ctx.fillStyle = '#f59e0b';
        ctx.font = '10px monospace';
        ctx.fillText('Cinematic Tracking (Interact to cancel)', hudX + 12, hudY + hudH - 12);
      }
    }

    const toolLabels: Record<GodTool, string> = {
      inspect: '1. Inspect',
      feed_all: '2. Feed All',
      meteor: '3. Meteor',
      spawn_larva: '4. Spawn Larva',
      spawn_apex: '5. Spawn Apex'
    };

    const tabW = isMobile ? 130 : 160;
    const tabH = isMobile ? 26 : 36;
    const tabX = (viewW - tabW) / 2;
    const tabY = viewH - (isMobile ? 30 : 46);
    ctx.fillStyle = isToolMenuOpen ? 'rgba(30, 58, 138, 0.95)' : 'rgba(15, 23, 42, 0.9)';
    ctx.fillRect(tabX, tabY, tabW, tabH);
    ctx.strokeStyle = isToolMenuOpen ? '#38bdf8' : '#475569';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(tabX, tabY, tabW, tabH);

    ctx.fillStyle = '#f8fafc';
    ctx.font = isMobile ? 'bold 10px "JetBrains Mono", monospace' : 'bold 12px "JetBrains Mono", monospace';
    ctx.textAlign = 'center';
    ctx.fillText(`[ TOOL: ${toolLabels[currentTool] || 'MENU'} ]`, viewW / 2, tabY + (isMobile ? 17 : 22));
    ctx.textAlign = 'left';

    if (isToolMenuOpen) {
      const menuItems = [
        { id: 'inspect', label: '1. Inspect' },
        { id: 'feed_all', label: '2. Feed All' },
        { id: 'meteor', label: '3. Meteor' },
        { id: 'spawn_larva', label: '4. Spawn Larva' },
        { id: 'spawn_apex', label: '5. Spawn Apex' },
        { id: 'dna_bank', label: '6. Save Slots' },
        { id: 'catalog', label: '7. Species Catalog' },
        { id: 'reset', label: '8. Reset World' }
      ];

      const menuW = isMobile ? 150 : 190;
      const itemH = isMobile ? 22 : 30;
      const menuH = itemH * menuItems.length + 8;
      const menuX = (viewW - menuW) / 2;
      const menuY = tabY - menuH - 4;

      ctx.fillStyle = 'rgba(2, 6, 23, 0.96)';
      ctx.fillRect(menuX, menuY, menuW, menuH);
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(menuX, menuY, menuW, menuH);

      menuItems.forEach((item, idx) => {
        const iy = menuY + 4 + idx * itemH;
        const isSelected = currentTool === item.id;
        const isReset = item.id === 'reset';
        const isSpecial = item.id === 'dna_bank' || item.id === 'catalog';

        if (isSelected) {
          ctx.fillStyle = 'rgba(56, 189, 248, 0.2)';
          ctx.fillRect(menuX + 4, iy, menuW - 8, itemH - 2);
        }

        ctx.font = isMobile ? '10px "JetBrains Mono", monospace' : '12px "JetBrains Mono", monospace';
        ctx.fillStyle = isReset ? '#f87171' : isSpecial ? '#a855f7' : isSelected ? '#38bdf8' : '#cbd5e1';
        ctx.fillText(item.label, menuX + 10, iy + (isMobile ? 15 : 20));
      });
    }



    if (world.recentDiscovery) {
      const toastW = 280, toastH = 34;
      const toastX = (viewW - toastW) / 2;
      ctx.fillStyle = 'rgba(15, 23, 42, 0.95)';
      ctx.fillRect(toastX, 32, toastW, toastH);
      ctx.strokeStyle = '#facc15';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(toastX, 32, toastW, toastH);

      ctx.fillStyle = '#facc15';
      ctx.font = 'bold 11px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(`DISCOVERY: [${world.recentDiscovery}] REGISTERED!`, viewW / 2, 53);
      ctx.textAlign = 'left';
    }

    if (systemMessageTimer > 0) {
      systemMessageTimer -= dt;
      ctx.fillStyle = 'rgba(2, 6, 23, 0.9)';
      ctx.fillRect(viewW / 2 - 120, viewH - 75, 240, 24);
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 1;
      ctx.strokeRect(viewW / 2 - 120, viewH - 75, 240, 24);
      ctx.fillStyle = '#38bdf8';
      ctx.font = '10px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(systemMessage, viewW / 2, viewH - 59);
      ctx.textAlign = 'left';
    }

    if (isDnaBankOpen) {
      const bW = isMobile ? 300 : 360, bH = isMobile ? 190 : 230;
      const bX = (viewW - bW) / 2, bY = (viewH - bH) / 2;

      ctx.fillStyle = 'rgba(2, 6, 23, 0.98)';
      ctx.fillRect(bX, bY, bW, bH);
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 2;
      ctx.strokeRect(bX, bY, bW, bH);

      ctx.fillStyle = '#f8fafc';
      ctx.font = 'bold 11px monospace';
      ctx.fillText('SAVE SLOTS // WORLD SAVE MANAGER', bX + 12, bY + 18);

      for (let s = 1; s <= 3; s++) {
        const sy = bY + 28 + (s - 1) * (isMobile ? 42 : 48);
        const summary = world.getSlotSummary(s);

        ctx.fillStyle = 'rgba(15, 23, 42, 0.7)';
        ctx.fillRect(bX + 10, sy, bW - 20, isMobile ? 36 : 40);
        ctx.strokeStyle = '#1e293b';
        ctx.lineWidth = 1;
        ctx.strokeRect(bX + 10, sy, bW - 20, isMobile ? 36 : 40);

        ctx.fillStyle = '#38bdf8';
        ctx.font = 'bold 10px monospace';
        ctx.fillText(`Slot ${s}`, bX + 14, sy + 14);

        ctx.fillStyle = summary === 'Empty Slot' ? '#64748b' : '#94a3b8';
        ctx.font = '9px monospace';
        ctx.fillText(summary, bX + 14, sy + 28);
        ctx.fillStyle = '#065f46';
        ctx.fillRect(bX + bW - 100, sy + 6, 40, 22);
        ctx.fillStyle = '#34d399';
        ctx.font = '9px monospace';
        ctx.fillText('Save', bX + bW - 92, sy + 20);

        ctx.fillStyle = summary === 'Empty Slot' ? '#1e293b' : '#1e3a8a';
        ctx.fillRect(bX + bW - 52, sy + 6, 40, 22);
        ctx.fillStyle = summary === 'Empty Slot' ? '#475569' : '#60a5fa';
        ctx.fillText('Load', bX + bW - 44, sy + 20);
      }

      const botY = bY + bH - 26;
      ctx.fillStyle = '#334155';
      ctx.fillRect(bX + bW - 70, botY, 58, 18);
      ctx.fillStyle = '#fff';
      ctx.font = '9px monospace';
      ctx.fillText('Close', bX + bW - 55, botY + 13);
    }

    if (isCatalogOpen) {
      const cW = isMobile ? Math.min(viewW - 16, 520) : 660;
      const cH = isMobile ? Math.min(viewH - 16, 280) : 400;
      const cX = (viewW - cW) / 2, cY = (viewH - cH) / 2;

      ctx.fillStyle = 'rgba(2, 6, 23, 0.98)';
      ctx.fillRect(cX, cY, cW, cH);
      ctx.strokeStyle = '#facc15';
      ctx.lineWidth = 2;
      ctx.strokeRect(cX, cY, cW, cH);

      const count = world.discoveredSpecies.length;
      ctx.fillStyle = '#facc15';
      ctx.font = 'bold 11px monospace';
      ctx.fillText(`SPECIES CATALOG // MUTATION ARCHIVE (${count}/${SPECIES_CATALOG.length})`, cX + 12, cY + 18);

      const listX = cX + 10;
      const listY = cY + 28;
      const cols = 3;
      const itemW = isMobile ? 64 : 104;
      const itemH = isMobile ? 32 : 48;
      const gapX = isMobile ? 4 : 6;
      const gapY = isMobile ? 4 : 6;

      SPECIES_CATALOG.forEach((item, idx) => {
        const isDiscovered = world.discoveredSpecies.includes(item.id);
        const isSelected = selectedCatalogId === item.id;
        const col = idx % cols;
        const row = Math.floor(idx / cols);
        const ix = listX + col * (itemW + gapX);
        const iy = listY + row * (itemH + gapY);

        ctx.fillStyle = isSelected
          ? 'rgba(56, 189, 248, 0.25)'
          : isDiscovered
          ? 'rgba(30, 41, 59, 0.7)'
          : 'rgba(15, 23, 42, 0.8)';
        ctx.fillRect(ix, iy, itemW, itemH);

        ctx.strokeStyle = isSelected ? '#38bdf8' : isDiscovered ? '#475569' : '#1e293b';
        ctx.lineWidth = isSelected ? 1.8 : 1.0;
        ctx.strokeRect(ix, iy, itemW, itemH);

        ctx.font = isMobile ? '8px monospace' : '10px monospace';
        ctx.fillStyle = isSelected ? '#38bdf8' : isDiscovered ? '#f8fafc' : '#64748b';
        const displayName = isDiscovered ? item.name : '??? Unknown';
        ctx.fillText(displayName, ix + 3, iy + (isMobile ? 12 : 18));

        ctx.font = '7px monospace';
        ctx.fillStyle = isDiscovered ? '#94a3b8' : '#475569';
        ctx.fillText(isDiscovered ? item.category : 'Undiscovered', ix + 3, iy + (isMobile ? 24 : 36));
      });

      const rightX = listX + 3 * (itemW + gapX) + (isMobile ? 6 : 14);
      const rightW = cX + cW - rightX - 10;
      const curItem = SPECIES_CATALOG.find(x => x.id === selectedCatalogId) || SPECIES_CATALOG[0];
      const isCurDiscovered = world.discoveredSpecies.includes(curItem.id);

      const prevH = isMobile ? 70 : 140;
      ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
      ctx.fillRect(rightX, listY, rightW, prevH);
      ctx.strokeStyle = isCurDiscovered ? '#38bdf8' : '#334155';
      ctx.lineWidth = 1;
      ctx.strokeRect(rightX, listY, rightW, prevH);

      drawSpeciesPreview(curItem, isCurDiscovered, rightX + rightW / 2, listY + prevH / 2, isMobile ? 1.0 : 1.7);

      ctx.font = '8px monospace';
      ctx.fillStyle = isCurDiscovered ? '#34d399' : '#f43f5e';
      ctx.fillText(isCurDiscovered ? '[ OBSERVED ]' : '[ UNKNOWN ]', rightX + 6, listY + 12);

      const descY = listY + prevH + (isMobile ? 4 : 12);
      ctx.font = isMobile ? 'bold 9px monospace' : 'bold 12px monospace';
      ctx.fillStyle = isCurDiscovered ? '#facc15' : '#94a3b8';
      ctx.fillText(`${curItem.name}`, rightX, descY + (isMobile ? 8 : 12));

      ctx.font = '8px monospace';
      ctx.fillStyle = '#38bdf8';
      ctx.fillText(`Req: ${curItem.condition}`, rightX, descY + (isMobile ? 20 : 30));

      const btnW = isMobile ? 50 : 65;
      const btnH = isMobile ? 18 : 24;
      const btnX = cX + cW - btnW - 10;
      const btnY = cY + cH - btnH - 8;
      ctx.fillStyle = '#334155';
      ctx.fillRect(btnX, btnY, btnW, btnH);
      ctx.strokeStyle = '#64748b';
      ctx.lineWidth = 1;
      ctx.strokeRect(btnX, btnY, btnW, btnH);
      ctx.fillStyle = '#fff';
      ctx.font = isMobile ? '9px monospace' : '11px monospace';
      ctx.fillText('Close', btnX + (isMobile ? 8 : 14), btnY + (isMobile ? 12 : 16));
    }

    if (isResetConfirming) {
          const dW = 260, dH = 100;
          const dX = (viewW - dW) / 2;
          const dY = (viewH - dH) / 2;

          ctx.fillStyle = 'rgba(2, 6, 23, 0.98)';
          ctx.fillRect(dX, dY, dW, dH);
          ctx.strokeStyle = '#f87171';
          ctx.lineWidth = 2;
          ctx.strokeRect(dX, dY, dW, dH);

          ctx.fillStyle = '#f8fafc';
          ctx.font = 'bold 11px "JetBrains Mono", monospace';
          ctx.textAlign = 'center';
          ctx.fillText('Reset the ecosystem?', viewW / 2, dY + 28);

          ctx.fillStyle = 'rgba(239, 68, 68, 0.85)';
          ctx.fillRect(dX + 20, dY + 52, 95, 32);
          ctx.strokeStyle = '#fca5a5';
          ctx.lineWidth = 1;
          ctx.strokeRect(dX + 20, dY + 52, 95, 32);
          ctx.fillStyle = '#ffffff';
          ctx.fillText('Yes', dX + 67, dY + 72);

          ctx.fillStyle = 'rgba(51, 65, 85, 0.85)';
          ctx.fillRect(dX + 145, dY + 52, 95, 32);
          ctx.strokeStyle = '#94a3b8';
          ctx.lineWidth = 1;
          ctx.strokeRect(dX + 145, dY + 52, 95, 32);
          ctx.fillStyle = '#ffffff';
          ctx.fillText('No', dX + 192, dY + 72);

          ctx.textAlign = 'left';
        }
      } catch (err) {
        console.error('Render Loop Error:', err);
      }

      requestAnimationFrame(loop);
    }

    requestAnimationFrame(loop);
