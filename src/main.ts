
import { EcosystemWorld, Creature, Obstacle, Egg, SPECIES_CATALOG, DNA, SpeciesCatalogItem, NeuralBrain } from './simulator';
const canvas = document.getElementById('screen') as HTMLCanvasElement;
const ctx = canvas.getContext('2d')!;
class BioSoundEngine {
  ctx: AudioContext | null = null;
  private bubbleTimer = 2.0;

  init() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      this.ctx = new AudioCtx();
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
  }

  update(dt: number) {
    if (!this.ctx) return;
    this.bubbleTimer -= dt;
    if (this.bubbleTimer <= 0) {
      this.bubbleTimer = 3.0 + Math.random() * 4.0;
      this.playGentleBubble();
    }
  }

  private playGentleBubble() {
    if (!this.ctx) return;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    const now = this.ctx.currentTime;
    const freq = 280 + Math.random() * 120;
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
  const k = e.key.toLowerCase();
  keysDown[k] = true;
  idleTimer = 0;
  autoCinematic = false;

  if (k === '1') { currentTool = 'inspect'; isToolMenuOpen = false; }
  if (k === '2') { currentTool = 'feed_all'; isToolMenuOpen = false; }
  if (k === '3') { currentTool = 'meteor'; isToolMenuOpen = false; }
  if (k === '4') { currentTool = 'spawn_larva'; isToolMenuOpen = false; }
  if (k === '5') { currentTool = 'spawn_apex'; isToolMenuOpen = false; }
  if (k === '6') { isResetConfirming = true; isToolMenuOpen = false; }
  if (k === 't') { isToolMenuOpen = !isToolMenuOpen; isResetConfirming = false; }

  if (k === 'z') world.timeScale = 0;
  if (k === 'x') world.timeScale = 0.5;
  if (k === 'c') world.timeScale = 1.0;
  if (k === 'v') world.timeScale = 2.5;
  if (k === 'b') world.timeScale = 6.0;
  if (k === 'p') world.timeScale = world.timeScale === 0 ? 1.0 : 0;

  if (k === ' ') {
    selectedCreature = null;
    targetCamX = world.width / 2 - canvas.width / (2 * zoom);
    targetCamY = world.height / 2 - canvas.height / (2 * zoom);
  }
});

window.addEventListener('keyup', (e) => {
  keysDown[e.key.toLowerCase()] = false;
});

canvas.addEventListener('wheel', (e) => {
  e.preventDefault();
  idleTimer = 0;
  autoCinematic = false;
  const zoomFactor = e.deltaY < 0 ? 1.15 : 0.87;
  targetZoom = Math.min(3.2, Math.max(0.25, targetZoom * zoomFactor));
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
    for (let i = 0; i < 4; i++) {
      world.spawnPlant(wx + (Math.random() - 0.5) * 50, wy + (Math.random() - 0.5) * 50, 'algae');
      world.spawnPlant(wx + (Math.random() - 0.5) * 50, wy + (Math.random() - 0.5) * 50, 'meat_remains');
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
    const lm = world.latestMutant;
    if (lm && !lm.isDead && selectedCreature?.id !== lm.id) {
      const lr = isCompact ? 26 : 34;
      const lx = viewW - lr - 15;
      const ly = viewH - lr - (isCompact ? 36 : 55);
      if (Math.hypot(mx - lx, my - ly) <= lr + 6) {
        selectedCreature = lm;
        targetCamX = lm.x - viewW / (2 * zoom);
        targetCamY = lm.y - viewH / (2 * zoom);
        systemMessage = `Focus: Mutant #${lm.id}`;
        systemMessageTimer = 2.0;
        return;
      }
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

    const lm = world.latestMutant;
    if (lm && !lm.isDead && selectedCreature?.id !== lm.id) {
      const lr = isCompact ? 26 : 34;
      const lx = viewW - lr - 15;
      const ly = viewH - lr - (isCompact ? 36 : 55);
      if (Math.hypot(mx - lx, my - ly) <= lr + 8) {
        selectedCreature = lm;
        targetCamX = lm.x - viewW / (2 * zoom);
        targetCamY = lm.y - viewH / (2 * zoom);
        systemMessage = `Focus: Mutant #${lm.id}`;
        systemMessageTimer = 2.0;
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
      const factor = dist / touchStartDist;
      targetZoom = Math.min(3.2, Math.max(0.25, touchStartZoom * factor));
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
  const bellScaleX = 1.0 + pulse * 0.2;
  const bellScaleY = 1.0 - pulse * 0.15;
  const currentSize = c.dna.size * (0.35 + 0.65 * c.growth);
  const isLarva = c.stage === 'larva';
  const tentacleCount = isLarva ? 3 : 5;
  ctx.lineWidth = isLarva ? 1 : 1.5;
  for (let t = 0; t < tentacleCount; t++) {
    const offY = (t - (tentacleCount - 1) / 2) * (currentSize * 0.45);
    const wave = Math.sin(c.pulsePhase * 1.5 + t * 0.8) * (currentSize * 0.6);
    ctx.strokeStyle = isSilhouette ? '#334155' : 'rgba(74, 222, 128, 0.6)';
    ctx.beginPath();
    ctx.moveTo(-currentSize * 0.5, offY);
    ctx.bezierCurveTo(
      -currentSize * 1.8, offY + wave * 0.5,
      -currentSize * 2.8, offY - wave,
      -currentSize * 3.8, offY + wave * 1.5
    );
    ctx.stroke();
  }
  ctx.save();
  ctx.scale(bellScaleX, bellScaleY);
  ctx.fillStyle = isSilhouette ? '#0f172a' : (isLarva ? 'rgba(52, 211, 153, 0.25)' : 'rgba(52, 211, 153, 0.45)');
  ctx.strokeStyle = isSilhouette ? '#334155' : '#4ade80';
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.arc(0, 0, currentSize * 1.4, -Math.PI / 2, Math.PI / 2);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  if (!isSilhouette) {
    ctx.fillStyle = '#4ade80';
    ctx.beginPath();
    ctx.arc(currentSize * 0.2, 0, currentSize * 0.5, 0, Math.PI * 2);
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
  const [r, g, b] = c.dna.color;
  const isLarva = c.stage === 'larva';
  ctx.strokeStyle = isSilhouette ? '#334155' : `rgba(${r}, ${g}, ${b}, 0.8)`;
  ctx.lineWidth = isLarva ? 1 : 2;
  for (let side = -1; side <= 1; side += 2) {
    for (let l = 0; l < 4; l++) {
      const legOffset = (l - 1.5) * (currentSize * 0.5);
      const legWave = Math.sin(c.legPhase + l * 1.2) * (currentSize * 0.4) * side;
      ctx.beginPath();
      ctx.moveTo(legOffset, side * currentSize * 0.8);
      ctx.lineTo(legOffset + legWave, side * (currentSize * 1.6 + Math.abs(legWave)));
      ctx.stroke();
    }
  }
  if (!isLarva) {
    ctx.fillStyle = isSilhouette ? '#0f172a' : '#f59e0b';
    ctx.strokeStyle = isSilhouette ? '#334155' : '#d97706';
    ctx.lineWidth = 1;
    for (let side = -1; side <= 1; side += 2) {
      ctx.beginPath();
      ctx.moveTo(currentSize * 1.1, side * currentSize * 0.4);
      ctx.lineTo(currentSize * 1.8, side * currentSize * 0.8);
      ctx.lineTo(currentSize * 1.4, side * currentSize * 0.2);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }
  }
  const plateCount = isLarva ? 2 : 4;
  for (let p = plateCount - 1; p >= 0; p--) {
    const t = p / plateCount;
    const px = (p - 1.5) * (currentSize * 0.55);
    const pWidth = currentSize * (1.3 - t * 0.5);
    const pHeight = currentSize * (1.1 - t * 0.4);

    ctx.fillStyle = isSilhouette ? '#0f172a' : `rgb(${r},${g},${b})`;
    ctx.strokeStyle = isSilhouette ? '#334155' : '#d97706';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.ellipse(px, 0, pWidth, pHeight, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }

  ctx.restore();
}

function drawLeviathan(c: Creature, isSilhouette = false) {
  ctx.save();
  const currentSize = c.dna.size * (0.35 + 0.65 * c.growth);
  const [r, g, b] = c.dna.color;

  if (!isSilhouette) {
    ctx.save();
    const glowGrad = ctx.createRadialGradient(c.x, c.y, currentSize * 0.5, c.x, c.y, currentSize * 3.6);
    glowGrad.addColorStop(0, 'rgba(6, 182, 212, 0.22)');
    glowGrad.addColorStop(0.5, 'rgba(14, 116, 144, 0.1)');
    glowGrad.addColorStop(1, 'rgba(2, 6, 23, 0)');
    ctx.fillStyle = glowGrad;
    ctx.beginPath();
    ctx.arc(c.x, c.y, currentSize * 3.6, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  if (c.tailNodes.length > 1) {
    for (let i = c.tailNodes.length - 1; i >= 1; i--) {
      const node = c.tailNodes[i];
      const prev = c.tailNodes[i - 1];
      const t = i / c.tailNodes.length;
      const nodeSize = currentSize * (1.35 - t * 0.78);
      const segAngle = Math.atan2(node.y - prev.y, node.x - prev.x);
      const wave = Math.sin(c.finPhase + i * 0.75) * (currentSize * 0.4 * (1 - t));

      ctx.save();
      ctx.translate(node.x, node.y);
      ctx.rotate(segAngle);

      if (i === c.tailNodes.length - 1) {
        ctx.fillStyle = isSilhouette ? '#0f172a' : 'rgba(6, 182, 212, 0.85)';
        ctx.strokeStyle = isSilhouette ? '#334155' : '#38bdf8';
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.bezierCurveTo(-nodeSize * 2.8, -nodeSize * 3.8 + wave, -nodeSize * 4.8, -nodeSize * 2.0 + wave, -nodeSize * 6.0, wave);
        ctx.bezierCurveTo(-nodeSize * 4.8, nodeSize * 2.0 + wave, -nodeSize * 2.8, nodeSize * 3.8 + wave, 0, 0);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = isSilhouette ? '#0f172a' : '#082f49';
        ctx.beginPath();
        ctx.moveTo(0, -nodeSize * 0.45);
        ctx.lineTo(-nodeSize * 6.5, wave);
        ctx.lineTo(0, nodeSize * 0.45);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      }

      for (let s = -1; s <= 1; s += 2) {
        ctx.fillStyle = isSilhouette ? '#0f172a' : 'rgba(14, 116, 144, 0.75)';
        ctx.strokeStyle = isSilhouette ? '#334155' : '#06b6d4';
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.moveTo(-nodeSize * 0.2, s * nodeSize * 0.6);
        ctx.lineTo(-nodeSize * 1.8, s * nodeSize * (1.6 + (1 - t) * 0.9));
        ctx.lineTo(nodeSize * 0.4, s * nodeSize * 0.4);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      }

      if (i % 2 === 1) {
        ctx.fillStyle = isSilhouette ? '#0f172a' : '#0284c7';
        ctx.strokeStyle = isSilhouette ? '#334155' : '#67e8f9';
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.moveTo(nodeSize * 0.2, -nodeSize * 0.5);
        ctx.lineTo(-nodeSize * 1.3, -nodeSize * (2.6 + (1 - t) * 1.5));
        ctx.lineTo(-nodeSize * 0.7, -nodeSize * 0.3);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      }

      ctx.fillStyle = isSilhouette ? '#0f172a' : `rgb(${Math.max(5, r - i * 3)}, ${Math.max(15, g - i * 5)}, ${Math.max(35, b - i * 7)})`;
      ctx.strokeStyle = isSilhouette ? '#334155' : '#38bdf8';
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.moveTo(nodeSize * 1.15, 0);
      ctx.lineTo(0, -nodeSize * 0.95);
      ctx.lineTo(-nodeSize * 1.25, 0);
      ctx.lineTo(0, nodeSize * 0.95);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      if (!isSilhouette) {
        ctx.fillStyle = '#67e8f9';
        ctx.beginPath();
        ctx.arc(0, 0, Math.max(1.6, nodeSize * 0.24), 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.restore();
    }
  }

  ctx.save();
  ctx.translate(c.x, c.y);
  ctx.rotate(c.angle);

  const finFlap = Math.sin(c.finPhase * 0.9) * 0.25;
  for (let side = -1; side <= 1; side += 2) {
    ctx.save();
    ctx.translate(-currentSize * 0.1, side * currentSize * 0.85);
    ctx.rotate(side * (0.65 + finFlap));

    ctx.fillStyle = isSilhouette ? '#0f172a' : 'rgba(14, 116, 144, 0.85)';
    ctx.strokeStyle = isSilhouette ? '#334155' : '#38bdf8';
    ctx.lineWidth = 2.0;

    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(currentSize * 2.8, side * currentSize * 3.0);
    ctx.lineTo(currentSize * 1.3, side * currentSize * 2.3);
    ctx.lineTo(currentSize * 0.8, side * currentSize * 1.6);
    ctx.lineTo(-currentSize * 0.2, side * currentSize * 0.6);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    if (!isSilhouette) {
      ctx.strokeStyle = '#67e8f9';
      ctx.lineWidth = 1.3;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(currentSize * 2.0, side * currentSize * 2.2);
      ctx.moveTo(0, 0);
      ctx.lineTo(currentSize * 1.1, side * currentSize * 1.5);
      ctx.stroke();
    }
    ctx.restore();
  }

  for (let s = -1; s <= 1; s += 2) {
    ctx.fillStyle = isSilhouette ? '#0f172a' : '#0369a1';
    ctx.strokeStyle = isSilhouette ? '#334155' : '#67e8f9';
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.moveTo(currentSize * 0.3, s * currentSize * 0.6);
    ctx.quadraticCurveTo(currentSize * 1.6, s * currentSize * 2.4, currentSize * 3.2, s * currentSize * 1.9);
    ctx.lineTo(currentSize * 1.2, s * currentSize * 0.7);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = isSilhouette ? '#0f172a' : '#0284c7';
    ctx.beginPath();
    ctx.moveTo(-currentSize * 0.2, s * currentSize * 0.5);
    ctx.quadraticCurveTo(currentSize * 0.8, s * currentSize * 1.7, currentSize * 1.9, s * currentSize * 1.4);
    ctx.lineTo(currentSize * 0.4, s * currentSize * 0.4);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }

  ctx.fillStyle = isSilhouette ? '#0f172a' : '#082f49';
  ctx.strokeStyle = isSilhouette ? '#334155' : '#38bdf8';
  ctx.lineWidth = 2.4;
  ctx.beginPath();
  ctx.moveTo(currentSize * 2.8, 0);
  ctx.lineTo(currentSize * 1.5, -currentSize * 1.25);
  ctx.lineTo(-currentSize * 0.9, -currentSize * 1.35);
  ctx.lineTo(-currentSize * 1.9, -currentSize * 0.8);
  ctx.lineTo(-currentSize * 2.1, 0);
  ctx.lineTo(-currentSize * 1.9, currentSize * 0.8);
  ctx.lineTo(-currentSize * 0.9, currentSize * 1.35);
  ctx.lineTo(currentSize * 1.5, currentSize * 1.25);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  if (!isSilhouette) {
    ctx.fillStyle = '#0f172a';
    ctx.strokeStyle = '#0284c7';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(currentSize * 1.9, 0);
    ctx.lineTo(currentSize * 0.6, -currentSize * 0.75);
    ctx.lineTo(-currentSize * 0.6, 0);
    ctx.lineTo(currentSize * 0.6, currentSize * 0.75);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    const waveW = Math.sin(c.finPhase * 1.2) * (currentSize * 0.35);
    for (let s = -1; s <= 1; s += 2) {
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(currentSize * 2.2, s * currentSize * 0.4);
      ctx.bezierCurveTo(
        currentSize * 0.6, s * currentSize * 2.0 + waveW,
        -currentSize * 1.0, s * currentSize * 2.4 - waveW,
        -currentSize * 3.0, s * currentSize * 2.2 + waveW
      );
      ctx.stroke();
    }

    for (let s = -1; s <= 1; s += 2) {
      ctx.save();
      ctx.translate(currentSize * 1.2, s * currentSize * 0.68);
      ctx.rotate(s * 0.2);

      ctx.fillStyle = '#67e8f9';
      ctx.beginPath();
      ctx.ellipse(0, 0, currentSize * 0.48, currentSize * 0.25, 0, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#082f49';
      ctx.beginPath();
      ctx.ellipse(0, 0, currentSize * 0.13, currentSize * 0.23, 0, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(currentSize * 0.09, -currentSize * 0.06, currentSize * 0.06, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    ctx.fillStyle = '#f8fafc';
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 1.0;
    const fangCount = 6;
    for (let f = 0; f < fangCount; f++) {
      const fx = currentSize * (1.35 + f * 0.23);
      const fyTop = -currentSize * (0.46 - f * 0.06);
      const fyBot = currentSize * (0.46 - f * 0.06);
      const fLen = currentSize * (0.55 + Math.sin(f * 0.8) * 0.28);

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

  ctx.restore();
  ctx.restore();
}
function drawManta(c: Creature, isSilhouette = false) {
  ctx.save();
  ctx.translate(c.x, c.y);
  ctx.rotate(c.angle);

  const currentSize = c.dna.size * (0.35 + 0.65 * c.growth);
  const flap = Math.sin(c.finPhase * 0.7) * 0.28;

  ctx.fillStyle = isSilhouette ? '#0f172a' : '#031728';
  ctx.strokeStyle = isSilhouette ? '#334155' : '#38bdf8';
  ctx.lineWidth = 1.8;

  ctx.beginPath();
  ctx.moveTo(currentSize * 1.8, 0);
  ctx.lineTo(currentSize * 0.5, -currentSize * (2.8 + flap * 2.0));
  ctx.lineTo(-currentSize * 1.2, -currentSize * (1.8 + flap * 1.2));
  ctx.lineTo(-currentSize * 1.8, 0);
  ctx.lineTo(-currentSize * 1.2, currentSize * (1.8 + flap * 1.2));
  ctx.lineTo(currentSize * 0.5, currentSize * (2.8 + flap * 2.0));
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  if (!isSilhouette) {
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.6)';
    ctx.lineWidth = 1.2;
    for (let s = -1; s <= 1; s += 2) {
      for (let g = 0; g < 3; g++) {
        const gx = -currentSize * 0.4 + g * currentSize * 0.4;
        ctx.beginPath();
        ctx.moveTo(gx, s * currentSize * 0.4);
        ctx.lineTo(gx - currentSize * 0.3, s * currentSize * 1.2);
        ctx.stroke();
      }
    }

    ctx.fillStyle = '#38bdf8';
    for (let s = -1; s <= 1; s += 2) {
      ctx.beginPath();
      ctx.moveTo(currentSize * 1.7, s * currentSize * 0.35);
      ctx.quadraticCurveTo(currentSize * 2.6, s * currentSize * 0.7, currentSize * 2.4, s * currentSize * 0.2);
      ctx.closePath();
      ctx.fill();
    }
  }

  const whipWave = Math.sin(c.finPhase * 1.1) * currentSize * 0.4;
  ctx.strokeStyle = isSilhouette ? '#334155' : '#38bdf8';
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.moveTo(-currentSize * 1.8, 0);
  ctx.quadraticCurveTo(-currentSize * 3.5, whipWave, -currentSize * 5.2, whipWave * 1.6);
  ctx.stroke();

  ctx.restore();
}

function drawCleanerShrimp(c: Creature, isSilhouette = false) {
  ctx.save();
  ctx.translate(c.x, c.y);
  ctx.rotate(c.angle);

  const currentSize = c.dna.size * (0.35 + 0.65 * c.growth);
  const legWave = Math.sin(c.legPhase) * currentSize * 0.3;

  ctx.strokeStyle = isSilhouette ? '#334155' : '#ffffff';
  ctx.lineWidth = 1.0;
  for (let s = -1; s <= 1; s += 2) {
    ctx.beginPath();
    ctx.moveTo(currentSize * 1.2, s * currentSize * 0.2);
    ctx.quadraticCurveTo(currentSize * 2.2, s * currentSize * 1.8 + legWave, currentSize * 3.0, s * currentSize * 2.2);
    ctx.stroke();
  }

  ctx.fillStyle = isSilhouette ? '#0f172a' : '#f472b6';
  ctx.strokeStyle = isSilhouette ? '#334155' : '#fda4af';
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.ellipse(0, 0, currentSize * 1.4, currentSize * 0.65, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  if (!isSilhouette) {
    ctx.fillStyle = '#ffffff';
    for (let b = -1; b <= 1; b++) {
      ctx.fillRect(b * currentSize * 0.6 - 1.5, -currentSize * 0.6, 3, currentSize * 1.2);
    }
  }

  ctx.restore();
}

function drawWhaleFall(p: Plant) {
  ctx.save();
  ctx.translate(p.x, p.y);

  ctx.fillStyle = 'rgba(14, 116, 144, 0.25)';
  ctx.beginPath();
  ctx.arc(0, 0, p.size * 1.4, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = 'rgba(226, 232, 240, 0.85)';
  ctx.lineWidth = 2.2;
  ctx.beginPath();
  ctx.moveTo(-p.size * 1.1, 0);
  ctx.lineTo(p.size * 1.1, 0);
  ctx.stroke();

  const ribCount = 5;
  for (let i = 0; i < ribCount; i++) {
    const rx = (i - (ribCount - 1) / 2) * (p.size * 0.45);
    const rHeight = p.size * (0.9 - Math.abs(i - 2) * 0.2);
    ctx.beginPath();
    ctx.moveTo(rx, -rHeight);
    ctx.quadraticCurveTo(rx + 4, 0, rx, rHeight);
    ctx.stroke();
  }

  ctx.fillStyle = '#38bdf8';
  ctx.beginPath();
  ctx.arc(0, 0, p.size * 0.25, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

function drawKelp(kelp: Kelp) {
  ctx.save();
  ctx.strokeStyle = 'rgba(16, 185, 129, 0.55)';
  ctx.lineWidth = 4.0;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(kelp.nodes[0].x, kelp.nodes[0].y);
  for (let s = 1; s < kelp.nodes.length; s++) {
    ctx.lineTo(kelp.nodes[s].x, kelp.nodes[s].y);
  }
  ctx.stroke();

  ctx.fillStyle = 'rgba(52, 211, 153, 0.4)';
  for (let s = 1; s < kelp.nodes.length; s++) {
    const n = kelp.nodes[s];
    const prev = kelp.nodes[s - 1];
    const ang = Math.atan2(n.y - prev.y, n.x - prev.x);
    for (let side = -1; side <= 1; side += 2) {
      ctx.save();
      ctx.translate(n.x, n.y);
      ctx.rotate(ang + side * 0.8);
      ctx.beginPath();
      ctx.ellipse(12, 0, 14, 5, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
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
  const isGold = (d: DNA) => d.color[0] >= 210 && d.color[1] >= 160 && d.color[2] <= 80;
  if (!isSilhouette && c.dna.camouflage > 0.35 && !isApex) {
    ctx.globalAlpha = Math.max(0.22, 1.0 - c.dna.camouflage * 0.72);
  }
  const parts = c.dna.parts || [];
  if (c.tailNodes.length > 1) {
    for (let i = c.tailNodes.length - 1; i >= 1; i--) {
      const node = c.tailNodes[i];
      const prev = c.tailNodes[i - 1];
      const t = i / c.tailNodes.length;
      const nodeSize = currentSize * (1.15 - t * 0.65);

      const wave = Math.sin(c.finPhase + i * 0.85) * (currentSize * 0.45 * (1 - t));
      const segAngle = Math.atan2(node.y - prev.y, node.x - prev.x);

      ctx.save();
      ctx.translate(node.x, node.y);
      ctx.rotate(segAngle);
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
          ctx.lineTo(-nodeSize * 3.0, -nodeSize * 2.2 + wave);
          ctx.lineTo(-nodeSize * 1.5, 0);
          ctx.lineTo(-nodeSize * 3.0, nodeSize * 2.2 + wave);
          ctx.closePath();
          ctx.fill();
        } else if (parts.includes('prop_jet')) {
          ctx.fillStyle = '#f97316';
          ctx.fillRect(-nodeSize * 2.0, -nodeSize * 0.6, nodeSize * 1.8, nodeSize * 1.2);
        } else {
          ctx.fillStyle = isSilhouette ? '#0f172a' : `rgba(${r}, ${g}, ${b}, 0.85)`;
          ctx.beginPath();
          ctx.moveTo(0, 0);
          ctx.lineTo(-nodeSize * 2.2, -nodeSize * 1.8 + wave);
          ctx.lineTo(-nodeSize * 1.4, 0);
          ctx.lineTo(-nodeSize * 2.2, nodeSize * 1.8 + wave);
          ctx.closePath();
          ctx.fill();
        }
      }
      ctx.fillStyle = isSilhouette ? '#0f172a' : `rgba(${r}, ${g}, ${b}, ${isLarva ? 0.4 : 0.9 - t * 0.25})`;
      ctx.strokeStyle = isSilhouette ? '#334155' : 'transparent';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(0, 0, Math.max(1.2, nodeSize), 0, Math.PI * 2);
      ctx.fill();
      if (isSilhouette) ctx.stroke();
      if ((isCarnivore || isApex || c.dna.segments >= 6) && !isLarva && i % 2 === 1) {
        ctx.fillStyle = isSilhouette ? '#0f172a' : (isApex ? '#06b6d4' : isCarnivore ? '#ef4444' : '#0d9488');
        ctx.strokeStyle = isSilhouette ? '#334155' : (isApex ? '#67e8f9' : 'transparent');
        ctx.lineWidth = isApex ? 1.5 : 1;
        ctx.beginPath();
        ctx.moveTo(0, -nodeSize * 0.8);
        ctx.lineTo(-nodeSize * (isApex ? 1.0 : 0.6), -nodeSize * (isApex ? 2.4 + (1 - t) * 1.2 : 1.6 + (1 - t) * 0.8));
        ctx.lineTo(-nodeSize * 0.8, -nodeSize * 0.6);
        ctx.closePath();
        ctx.fill();
        if (isApex || isSilhouette) ctx.stroke();
      }

      ctx.restore();
    }
  }
  if (!isSilhouette && !isLarva) {
    if (isGold(c.dna)) {
      ctx.fillStyle = 'rgba(251, 191, 36, 0.2)';
      ctx.beginPath();
      ctx.arc(c.x, c.y, currentSize * 2.6, 0, Math.PI * 2);
      ctx.fill();
    } else if (c.dna.electricShock > 0.5) {
      ctx.strokeStyle = 'rgba(250, 204, 21, 0.45)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(c.x, c.y, currentSize * 2.2, 0, Math.PI * 2);
      ctx.stroke();
    } else if (isCarnivore) {
      if (isApex) {
        ctx.fillStyle = 'rgba(14, 165, 233, 0.16)';
        ctx.beginPath();
        ctx.arc(c.x, c.y, currentSize * 3.2, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = 'rgba(56, 189, 248, 0.5)';
        ctx.lineWidth = 1.8;
        ctx.beginPath();
        ctx.arc(c.x, c.y, currentSize * 2.4, 0, Math.PI * 2);
        ctx.stroke();
      } else {
        ctx.fillStyle = 'rgba(239, 68, 68, 0.13)';
        ctx.beginPath();
        ctx.arc(c.x, c.y, currentSize * 2.8, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }
  if (c.dna.isCrystal && !isSilhouette) {
    ctx.shadowColor = '#38bdf8';
    ctx.shadowBlur = 8;
  }
  ctx.save();
  ctx.translate(c.x, c.y);
  ctx.rotate(c.angle);
  if (!isLarva && !isSilhouette) {
    if (parts.includes('body_spikes')) {
      ctx.fillStyle = '#ef4444';
      for (let sp = -1; sp <= 1; sp += 2) {
        ctx.beginPath();
        ctx.moveTo(-currentSize * 0.2, sp * currentSize * 0.7);
        ctx.lineTo(-currentSize * 0.5, sp * currentSize * 1.5);
        ctx.lineTo(currentSize * 0.2, sp * currentSize * 0.7);
        ctx.fill();
      }
    }
    if (parts.includes('body_fin')) {
      ctx.fillStyle = 'rgba(52, 211, 153, 0.7)';
      for (let sp = -1; sp <= 1; sp += 2) {
        ctx.beginPath();
        ctx.ellipse(0, sp * currentSize * 1.1, currentSize * 0.8, currentSize * 0.3, sp * 0.3, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    if (parts.includes('body_symbiont')) {
      ctx.strokeStyle = '#facc15';
      ctx.lineWidth = 1;
      ctx.strokeRect(-currentSize * 0.5, -currentSize * 0.5, currentSize, currentSize);
    }
  }
  if (!isLarva && !isSilhouette) {
    if (parts.includes('head_horn') || isApex) {
      ctx.fillStyle = isApex ? '#0284c7' : '#e2e8f0';
      ctx.strokeStyle = isApex ? '#67e8f9' : '#94a3b8';
      ctx.lineWidth = 1.5;
      for (let s = -1; s <= 1; s += 2) {
        ctx.beginPath();
        ctx.moveTo(currentSize * 0.6, s * currentSize * 0.5);
        ctx.quadraticCurveTo(currentSize * 1.8, s * currentSize * 1.6, currentSize * 2.5, s * currentSize * 1.3);
        ctx.lineTo(currentSize * 1.0, s * currentSize * 0.4);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      }
    }
    if (parts.includes('head_beak')) {
      ctx.fillStyle = '#f59e0b';
      ctx.beginPath();
      ctx.moveTo(currentSize * 1.2, -currentSize * 0.3);
      ctx.lineTo(currentSize * 2.2, 0);
      ctx.lineTo(currentSize * 1.2, currentSize * 0.3);
      ctx.closePath();
      ctx.fill();
    }
    if (parts.includes('head_angler')) {
      ctx.strokeStyle = '#22d3ee';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(currentSize * 0.8, 0);
      ctx.quadraticCurveTo(currentSize * 1.6, -currentSize * 1.2, currentSize * 2.0, -currentSize * 0.6);
      ctx.stroke();
      ctx.fillStyle = '#67e8f9';
      ctx.beginPath();
      ctx.arc(currentSize * 2.0, -currentSize * 0.6, 3, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  if (!isLarva) {
    const finFlap = Math.sin(c.finPhase * 0.8) * 0.18;
    for (let side = -1; side <= 1; side += 2) {
      ctx.save();
      ctx.translate(-currentSize * 0.2, side * currentSize * 0.7);
      ctx.rotate(side * (0.55 + finFlap));

      if (isApex) {
        ctx.fillStyle = isSilhouette ? '#0f172a' : 'rgba(14, 116, 144, 0.85)';
        ctx.strokeStyle = isSilhouette ? '#334155' : '#38bdf8';
        ctx.lineWidth = 1.8;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(currentSize * 2.0, side * currentSize * 2.2);
        ctx.lineTo(currentSize * 0.3, side * currentSize * 0.7);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      } else if (isCarnivore) {
        ctx.fillStyle = isSilhouette ? '#0f172a' : `rgb(${r}, ${g}, ${b})`;
        ctx.strokeStyle = isSilhouette ? '#334155' : '#fca5a5';
        ctx.lineWidth = 1.0;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(currentSize * 1.2, side * currentSize * 1.4);
        ctx.lineTo(currentSize * 0.2, side * currentSize * 0.4);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      } else {
        ctx.fillStyle = isSilhouette ? '#0f172a' : `rgba(${r}, ${g}, ${b}, 0.75)`;
        ctx.strokeStyle = isSilhouette ? '#334155' : 'rgba(255, 255, 255, 0.5)';
        ctx.lineWidth = 1.0;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(currentSize * 0.9, side * currentSize * 1.1);
        ctx.lineTo(currentSize * 0.1, side * currentSize * 0.4);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      }
      ctx.restore();
    }
  }
  if (c.dna.armor > 0.45 && !isLarva) {
    ctx.strokeStyle = isSilhouette ? '#334155' : '#38bdf8';
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.arc(0, 0, currentSize * 1.3, -Math.PI * 0.7, Math.PI * 0.7);
    ctx.stroke();
  }
  if (isApex && !isLarva) {
    ctx.fillStyle = isSilhouette ? '#0f172a' : '#082f49';
    ctx.strokeStyle = isSilhouette ? '#334155' : '#38bdf8';
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    ctx.moveTo(currentSize * 2.2, 0);
    ctx.lineTo(currentSize * 0.8, -currentSize * 1.35);
    ctx.lineTo(-currentSize * 1.3, -currentSize * 1.1);
    ctx.lineTo(-currentSize * 1.7, 0);
    ctx.lineTo(-currentSize * 1.3, currentSize * 1.1);
    ctx.lineTo(currentSize * 0.8, currentSize * 1.35);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  } else if (isCarnivore && !isLarva) {
    ctx.fillStyle = isSilhouette ? '#0f172a' : `rgb(${r}, ${g}, ${b})`;
    ctx.strokeStyle = isSilhouette ? '#334155' : '#fca5a5';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(currentSize * 1.9, 0);
    ctx.lineTo(currentSize * 0.4, -currentSize * 0.95);
    ctx.lineTo(-currentSize * 1.4, -currentSize * 0.75);
    ctx.lineTo(-currentSize * 1.5, 0);
    ctx.lineTo(-currentSize * 1.4, currentSize * 0.75);
    ctx.lineTo(currentSize * 0.4, currentSize * 0.95);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  } else {
    ctx.strokeStyle = isSilhouette ? '#334155' : 'rgba(255, 255, 255, 0.75)';
    ctx.lineWidth = isLarva ? 0.8 : 1.2;
    ctx.fillStyle = isSilhouette ? '#0f172a' : (isLarva ? `rgba(${r},${g},${b}, 0.45)` : `rgb(${r},${g},${b})`);
    ctx.beginPath();
    ctx.ellipse(0, 0, currentSize * 1.4, currentSize * 0.9, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }
  if ((c.dna.size >= 12.0 || isApex) && !isLarva) {
    ctx.fillStyle = isSilhouette ? '#0f172a' : '#c084fc';
    ctx.strokeStyle = isSilhouette ? '#334155' : '#ffffff';
    ctx.lineWidth = 1.2;
    for (let side = -1; side <= 1; side += 2) {
      ctx.beginPath();
      ctx.moveTo(currentSize * 0.2, side * currentSize * 0.8);
      ctx.lineTo(currentSize * 1.1, side * currentSize * 1.8);
      ctx.lineTo(-currentSize * 0.3, side * currentSize * 1.1);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }
  }
  if (c.dna.photosynthesis > 0.55 && !isLarva) {
    ctx.strokeStyle = isSilhouette ? '#334155' : '#22d3ee';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(currentSize * 1.2, 0);
    ctx.quadraticCurveTo(currentSize * 2.0, -currentSize * 1.2, currentSize * 2.3, -currentSize * 0.4);
    ctx.stroke();

    ctx.fillStyle = isSilhouette ? '#0f172a' : '#38bdf8';
    ctx.beginPath();
    ctx.arc(currentSize * 2.3, -currentSize * 0.4, currentSize * 0.3, 0, Math.PI * 2);
    ctx.fill();
    if (isSilhouette) ctx.stroke();
  }
  if (c.dna.poison > 0.4 && !isLarva) {
    ctx.fillStyle = isSilhouette ? '#0f172a' : '#c084fc';
    ctx.strokeStyle = isSilhouette ? '#334155' : '#e9d5ff';
    ctx.lineWidth = 1.0;
    for (let s = -1; s <= 1; s += 2) {
      ctx.beginPath();
      ctx.moveTo(-currentSize * 0.5, s * currentSize * 0.8);
      ctx.lineTo(-currentSize * 0.1, s * currentSize * 1.6);
      ctx.lineTo(currentSize * 0.2, s * currentSize * 0.8);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }
  }
  if (!isSilhouette) {
    const eyeOffset = currentSize * (isCarnivore ? 0.48 : 0.45);
    const eyeX = currentSize * (isCarnivore ? 0.75 : 0.7);

    if ((isCarnivore || isApex) && !isLarva) {
      for (let side = -1; side <= 1; side += 2) {
        ctx.save();
        ctx.translate(eyeX, side * eyeOffset);
        ctx.rotate(side * 0.25);

        ctx.fillStyle = isApex ? '#38bdf8' : '#fee2e2';
        ctx.beginPath();
        ctx.ellipse(0, 0, currentSize * 0.38, currentSize * 0.22, 0, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = isApex ? '#0369a1' : '#dc2626';
        ctx.beginPath();
        ctx.ellipse(currentSize * 0.05, 0, currentSize * 0.16, currentSize * 0.2, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
    } else {
      const eyeSize = isLarva ? currentSize * 0.45 : (c.dna.senseRadius > 240 ? currentSize * 0.4 : Math.max(1.8, currentSize * 0.26));
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(eyeX, -eyeOffset, eyeSize, 0, Math.PI * 2);
      ctx.arc(eyeX, eyeOffset, eyeSize, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#0284c7';
      ctx.beginPath();
      ctx.arc(eyeX + currentSize * 0.1, -eyeOffset, eyeSize * 0.65, 0, Math.PI * 2);
      ctx.arc(eyeX + currentSize * 0.1, eyeOffset, eyeSize * 0.65, 0, Math.PI * 2);
      ctx.fill();
    }
    if (isCarnivore && !isLarva) {
      ctx.fillStyle = '#ffffff';
      ctx.strokeStyle = '#f87171';
      ctx.lineWidth = 0.8;
      const fangLength = currentSize * (0.65 + c.dna.biteForce * 0.45);
      const fangCount = isApex ? 5 : 3;

      for (let f = 0; f < fangCount; f++) {
        const fx = currentSize * (1.1 + f * 0.22);
        const fyTop = -currentSize * (0.35 - f * 0.08);
        const fyBot = currentSize * (0.35 - f * 0.08);

        ctx.beginPath();
        ctx.moveTo(fx - currentSize * 0.1, fyTop);
        ctx.lineTo(fx, fyTop + fangLength);
        ctx.lineTo(fx + currentSize * 0.1, fyTop);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(fx - currentSize * 0.1, fyBot);
        ctx.lineTo(fx, fyBot - fangLength);
        ctx.lineTo(fx + currentSize * 0.1, fyBot);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
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
    vx: 0,
    vy: 0,
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
    reproCooldown: 0
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

      ctx.strokeStyle = '#facc15';
      ctx.beginPath();
      ctx.arc(c.x, c.y, c.dna.size * (0.35 + 0.65 * c.growth) + 10, 0, Math.PI * 2);
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

    let thoughtText = 'Cruising';
    let thoughtColor = '#94a3b8';

    if (inVals[2] > 0.35 || inVals[3] > 0.4) {
      thoughtText = 'Fleeing Predator';
      thoughtColor = '#f43f5e';
    } else if (inVals[9] > 0.4) {
      thoughtText = 'Alert!';
      thoughtColor = '#f59e0b';
    } else if (inVals[4] > 0.35) {
      thoughtText = 'Hunting Prey';
      thoughtColor = '#c084fc';
    } else if (inVals[0] > 0.2 || inVals[1] > 0.3) {
      thoughtText = 'Searching Food';
      thoughtColor = '#38bdf8';
    } else if (inVals[8] > 0.4) {
      thoughtText = 'Exploring';
      thoughtColor = '#a855f7';
    }

    if (isCompactView) {
      ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
      ctx.fillRect(startX, startY, 195, 16);
      ctx.strokeStyle = thoughtColor;
      ctx.lineWidth = 1;
      ctx.strokeRect(startX, startY, 195, 16);
      ctx.fillStyle = thoughtColor;
      ctx.font = 'bold 9px monospace';
      ctx.fillText(`State: ${thoughtText}`, startX + 4, startY + 11);

      const compactOuts = [
        { label: 'Steer', val: Math.abs(outVals[0] || 0) },
        { label: 'Thrust', val: outVals[1] || 0 },
        { label: 'Sprint', val: outVals[2] || 0 },
        { label: 'Shock', val: outVals[3] || 0 }
      ];
      compactOuts.forEach((item, idx) => {
        const bx = startX + (idx % 2) * 98;
        const by = startY + 22 + Math.floor(idx / 2) * 16;
        ctx.fillStyle = '#94a3b8';
        ctx.font = '8px monospace';
        ctx.fillText(item.label, bx, by + 8);
        ctx.fillStyle = '#1e293b';
        ctx.fillRect(bx + 22, by + 1, 65, 8);
        ctx.fillStyle = item.val > 0.5 ? '#4ade80' : '#0284c7';
        ctx.fillRect(bx + 22, by + 1, 65 * Math.max(0, Math.min(1, item.val)), 8);
      });
      return;
    }

    const inLabels = ['Food Dir', 'Food Dist', 'Threat Dir', 'Threat Dist', 'Prey Dir', 'Prey Dist', 'Energy', 'Obstacle', 'Memory', 'Signal'];
    const outLabels = ['Steer', 'Thrust', 'Sprint', 'Shock', 'Signal'];

    const colX = [startX + 36, startX + 115, startX + 180];
    const inYStep = 14;
    const hidYStep = 23;
    const outYStep = 26;
    const animTime = world.totalTime * 3.5;
    ctx.font = 'bold 8px monospace';
    ctx.fillStyle = '#38bdf8';
    ctx.fillText('[1.INPUT]', colX[0] - 20, startY + 2);
    ctx.fillStyle = '#a855f7';
    ctx.fillText('[2.HIDDEN]', colX[1] - 12, startY + 2);
    ctx.fillStyle = '#4ade80';
    ctx.fillText('[3.OUTPUT]', colX[2] - 4, startY + 2);

    ctx.fillStyle = 'rgba(15, 23, 42, 0.75)';
    ctx.fillRect(startX - 2, startY + 150, 245, 16);
    ctx.strokeStyle = thoughtColor;
    ctx.lineWidth = 1;
    ctx.strokeRect(startX - 2, startY + 150, 245, 16);
    ctx.fillStyle = thoughtColor;
    ctx.font = 'bold 9px monospace';
    ctx.fillText(`State: ${thoughtText}`, startX + 6, startY + 162);
    for (let h = 0; h < brain.hiddenSize; h++) {
      const hy = startY + 18 + h * hidYStep;
      for (let i = 0; i < brain.inputSize; i++) {
        const iy = startY + 12 + i * inYStep;
        const w = brain.weightsIH[h][i];
        const inAct = Math.abs(inVals[i] || 0);
        const intensity = Math.abs(w) * inAct;

        if (intensity > 0.09) {
          const isMajor = intensity > 0.35;
          ctx.strokeStyle = isMajor
            ? (w > 0 ? '#38bdf8' : '#f43f5e')
            : (w > 0 ? 'rgba(56, 189, 248, 0.25)' : 'rgba(244, 63, 94, 0.25)');
          ctx.lineWidth = isMajor ? 2.0 : 0.8;
          ctx.beginPath();
          ctx.moveTo(colX[0], iy);
          ctx.lineTo(colX[1], hy);
          ctx.stroke();
          if (isMajor) {
            const pt = (animTime + i * 0.25) % 1.0;
            ctx.fillStyle = '#ffffff';
            ctx.beginPath();
            ctx.arc(colX[0] + (colX[1] - colX[0]) * pt, iy + (hy - iy) * pt, 1.6, 0, Math.PI * 2);
            ctx.fill();
          }
        }
      }
    }

    for (let o = 0; o < brain.outputSize; o++) {
      const oy = startY + 18 + o * outYStep;
      for (let h = 0; h < brain.hiddenSize; h++) {
        const hy = startY + 18 + h * hidYStep;
        const w = brain.weightsHO[o][h];
        const hAct = Math.abs(brain.lastHidden[h] || 0);
        const intensity = Math.abs(w) * hAct;

        if (intensity > 0.09) {
          const isMajor = intensity > 0.35;
          ctx.strokeStyle = isMajor
            ? (w > 0 ? '#4ade80' : '#f43f5e')
            : (w > 0 ? 'rgba(74, 222, 128, 0.25)' : 'rgba(244, 63, 94, 0.25)');
          ctx.lineWidth = isMajor ? 2.0 : 0.8;
          ctx.beginPath();
          ctx.moveTo(colX[1], hy);
          ctx.lineTo(colX[2], oy);
          ctx.stroke();
        }
      }
    }
    for (let i = 0; i < brain.inputSize; i++) {
      const iy = startY + 12 + i * inYStep;
      const act = inVals[i] || 0;
      const absAct = Math.abs(act);
      const isFiring = absAct > 0.25;

      ctx.fillStyle = isFiring ? '#38bdf8' : '#334155';
      ctx.beginPath();
      ctx.arc(colX[0], iy, isFiring ? 4.0 : 2.5, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = isFiring ? '#f8fafc' : '#64748b';
      ctx.font = isFiring ? 'bold 8px monospace' : '8px monospace';
      ctx.fillText(inLabels[i], colX[0] - 34, iy + 3);
    }
    for (let h = 0; h < brain.hiddenSize; h++) {
      const hy = startY + 18 + h * hidYStep;
      const act = brain.lastHidden[h] || 0;
      const absAct = Math.abs(act);
      const isFiring = absAct > 0.25;

      ctx.fillStyle = isFiring ? (act > 0 ? '#38bdf8' : '#f43f5e') : '#334155';
      ctx.beginPath();
      ctx.arc(colX[1], hy, isFiring ? 4.5 : 2.8, 0, Math.PI * 2);
      ctx.fill();
    }
    for (let o = 0; o < brain.outputSize; o++) {
      const oy = startY + 18 + o * outYStep;
      const act = outVals[o] || 0;
      const isAction = act > 0.55;

      ctx.fillStyle = isAction ? '#4ade80' : '#334155';
      ctx.beginPath();
      ctx.arc(colX[2], oy, isAction ? 4.5 : 2.8, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#1e293b';
      ctx.fillRect(colX[2] + 7, oy - 3, 34, 6);
      ctx.fillStyle = isAction ? '#4ade80' : '#0284c7';
      ctx.fillRect(colX[2] + 7, oy - 3, 34 * Math.max(0, Math.min(1, act)), 6);

      ctx.fillStyle = isAction ? '#f8fafc' : '#94a3b8';
      ctx.font = isAction ? 'bold 8px monospace' : '8px monospace';
      ctx.fillText(outLabels[o], colX[2] + 45, oy + 3);
    }
  }
function drawLightCurtain(w: number, h: number, time: number) {
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 0, w, h);
  ctx.clip();

  const rayCount = 6;
  for (let i = 0; i < rayCount; i++) {
    const t = time * 0.35 + i * 1.4;
    const sway1 = Math.sin(t) * 60;
    const sway2 = Math.cos(t * 0.7 + i) * 50;
    const normX = (i + 0.5) / rayCount;
    const topX = normX * w + sway1;
    const topW = 30 + Math.sin(t * 1.1) * 12;
    const botX = topX + 80 + sway2;
    const botW = 90 + Math.cos(t * 0.8) * 25;

    const grad = ctx.createLinearGradient(topX, 0, botX, h * 0.88);
    const alpha = 0.022 + Math.sin(t * 1.3) * 0.01;
    grad.addColorStop(0, `rgba(56, 189, 248, ${alpha * 2.0})`);
    grad.addColorStop(0.4, `rgba(45, 212, 191, ${alpha * 1.2})`);
    grad.addColorStop(1, 'rgba(1, 4, 9, 0)');

    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.moveTo(topX - topW / 2, 0);
    ctx.lineTo(topX + topW / 2, 0);
    ctx.lineTo(botX + botW / 2, h * 0.88);
    ctx.lineTo(botX - botW / 2, h * 0.88);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
}

let lastTime = performance.now();

function loop(time: number) {
  try {
    const dt = (time - lastTime) / 1000;
    lastTime = time;

    idleTimer += dt;
    if (idleTimer > 10.0 && !selectedCreature) {
      autoCinematic = true;
      let best: Creature | null = null;
      let maxScore = -1;
      for (const c of world.creatures) {
        const score = c.generation * 10 + c.kills * 20;
        if (score > maxScore) {
          maxScore = score;
          best = c;
        }
      }
      selectedCreature = best;
    }

    const viewW = window.innerWidth;
    const viewH = window.innerHeight;

    if (selectedCreature && !selectedCreature.isDead) {
      targetCamX = selectedCreature.x - viewW / (2 * zoom);
      targetCamY = selectedCreature.y - viewH / (2 * zoom);
    } else if (selectedCreature && selectedCreature.isDead) {
      selectedCreature = null;
    }

    camX += (targetCamX - camX) * 0.1;
    camY += (targetCamY - camY) * 0.1;
    zoom += (targetZoom - zoom) * 0.1;

    world.update(dt);
    sound.update(dt);

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = '#010409';
    ctx.fillRect(0, 0, viewW, viewH);

    ctx.save();
    ctx.scale(zoom, zoom);
    ctx.translate(-camX, -camY);
    const oceanGrad = ctx.createLinearGradient(0, 0, 0, world.height);
    oceanGrad.addColorStop(0, '#041d33');
    oceanGrad.addColorStop(0.45, '#020e1c');
    oceanGrad.addColorStop(1, '#01050a');
    ctx.fillStyle = oceanGrad;
    ctx.fillRect(0, 0, world.width, world.height);
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
    for (const p of world.plants) {
      if (!isInView(p.x, p.y, p.size + 20)) continue;
      if (p.type === 'whale_fall') {
        drawWhaleFall(p);
      } else if (p.type === 'meat_remains') {
        ctx.beginPath();
        ctx.fillStyle = '#f43f5e';
        ctx.arc(p.x, p.y, Math.max(3.2, p.size * 1.1), 0, Math.PI * 2);
        ctx.fill();
      } else if (p.type === 'fruit') {
        ctx.beginPath();
        ctx.fillStyle = '#f59e0b';
        ctx.arc(p.x, p.y, Math.max(3.0, p.size * 1.0), 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.beginPath();
        ctx.fillStyle = 'rgba(16, 185, 129, 0.42)';
        ctx.arc(p.x, p.y, p.size * 0.95, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    for (const c of world.creatures) {
      if (isInView(c.x, c.y, 80)) drawCreature(c);
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
    const barHeight = isMobile ? (isPortrait ? 38 : 26) : 56;

    ctx.fillStyle = 'rgba(2, 6, 23, 0.9)';
    ctx.fillRect(0, 0, viewW, barHeight);
    ctx.strokeStyle = '#1e293b';
    ctx.strokeRect(0, 0, viewW, barHeight);

    let herbs = 0, carns = 0, jellies = 0, scavs = 0, larvaCount = 0;
    for (const c of world.creatures) {
      if (c.stage === 'larva') larvaCount++;
      if (c.type === 'solar_jelly') jellies++;
      else if (c.type === 'scavenger') scavs++;
      else if (c.dna.diet > 0.55) carns++;
      else herbs++;
    }

    if (isMobile) {
      ctx.font = '9px "JetBrains Mono", monospace';
      if (isPortrait) {
        ctx.fillStyle = '#38bdf8';
        ctx.fillText('NEURAL-OCEAN', 8, 15);
        ctx.fillStyle = '#4ade80';
        ctx.fillText(`Herb:${herbs}`, 82, 15);
        ctx.fillStyle = '#34d399';
        ctx.fillText(`Jelly:${jellies}`, 128, 15);
        ctx.fillStyle = '#f59e0b';
        ctx.fillText(`Scav:${scavs}`, 178, 15);
        ctx.fillStyle = '#f87171';
        ctx.fillText(`Carn:${carns}`, 226, 15);

        ctx.fillStyle = '#facc15';
        ctx.fillText(`Eggs:${world.eggs.length}/Larvae:${larvaCount}`, 8, 30);
        ctx.fillStyle = '#a855f7';
        ctx.fillText(`Gen.${world.maxGen}`, 128, 30);
        ctx.fillStyle = '#cbd5e1';
        ctx.fillText(`${world.timeScale.toFixed(1)}x`, viewW - 35, 30);
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
        ctx.fillText(`Gen.${world.maxGen}`, Math.min(viewW - 75, 410), 17);
        ctx.fillStyle = '#cbd5e1';
        ctx.fillText(`${world.timeScale.toFixed(1)}x`, viewW - 35, 17);
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
      ctx.fillStyle = '#cbd5e1';
      ctx.fillText(`Speed: ${world.timeScale.toFixed(1)}x`, 710, 44);
    }

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

      const typeIcon = sc.type === 'solar_jelly' ? '[JELLY]' : sc.type === 'scavenger' ? '[SCAVENGER]' : sc.type === 'chimera' ? '[APEX LEVIATHAN]' : sc.type === 'manta' ? '[ABYSS MANTA]' : sc.type === 'cleaner_shrimp' ? '[CLEANER SHRIMP]' : sc.dna.diet > 0.5 ? '[CARNIVORE]' : '[HERBIVORE]';
      const stageStr = sc.stage === 'larva' ? `Larva (${(sc.growth * 100).toFixed(0)}%)` : 'Adult';

      ctx.fillStyle = sc.dna.diet > 0.5 ? '#f87171' : '#38bdf8';
      ctx.font = isMobile ? 'bold 10px monospace' : 'bold 13px monospace';
      ctx.fillText(`${typeIcon} #${sc.id} (Gen.${sc.generation}) [${stageStr}]`, hudX + 8, hudY + (isMobile ? 12 : 20));

      if (!isMobile) {
        const rkStr = sc.dna.rkStrategy > 0.55 ? 'K-Strategy (Fewer/Larger)' : 'r-Strategy (Many/Smaller)';
        ctx.fillStyle = '#cbd5e1';
        ctx.font = '11px monospace';
        ctx.fillText(`Stage: [${stageStr}] | Strat: [${rkStr}]`, hudX + 12, hudY + 38);
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

    const mutant = world.latestMutant;
    if (mutant && !mutant.isDead && selectedCreature?.id !== mutant.id) {
      const lr = isMobile ? 26 : 34;
      const lx = viewW - lr - 15;
      const ly = viewH - lr - (isMobile ? 36 : 55);
      const pulse = 0.5 + Math.sin(world.totalTime * 6) * 0.5;
      ctx.save();
      ctx.beginPath();
      ctx.arc(lx, ly, lr + 3, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(250, 204, 21, ${0.4 + pulse * 0.6})`;
      ctx.lineWidth = 2.5;
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(lx, ly, lr, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(2, 6, 23, 0.9)';
      ctx.fill();
      ctx.clip();
      ctx.save();
      ctx.translate(lx, ly);
      ctx.scale(1.4, 1.4);
      ctx.translate(-mutant.x, -mutant.y);
      drawCreature(mutant);
      ctx.restore();
      ctx.restore();
      ctx.fillStyle = '#facc15';
      ctx.font = 'bold 8px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('MUTANT DETECTED', lx, ly - lr - 3);
      ctx.fillStyle = '#38bdf8';
      ctx.fillText('TAP TO VIEW', lx, ly + lr + 10);
      ctx.textAlign = 'left';
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
