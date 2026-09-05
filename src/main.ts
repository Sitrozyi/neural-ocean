
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

function resize() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}
window.addEventListener('resize', resize);
resize();

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
  return sx >= -margin && sx <= canvas.width + margin && sy >= -margin && sy <= canvas.height + margin;
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
    const isCompact = canvas.height <= 450;
        if (isDnaBankOpen) {
          const bW = isCompact ? 320 : 360, bH = isCompact ? 210 : 230;
          const bX = (canvas.width - bW) / 2, bY = (canvas.height - bH) / 2;

          for (let s = 1; s <= 3; s++) {
            const sy = bY + 34 + (s - 1) * 48;
            if (mx >= bX + bW - 105 && mx <= bX + bW - 63 && my >= sy + 6 && my <= sy + 32) {
              world.saveWorldState(s);
              systemMessage = `スロット ${s} に保存しました`;
              systemMessageTimer = 2.0;
              return;
            }
            if (mx >= bX + bW - 55 && mx <= bX + bW - 13 && my >= sy + 6 && my <= sy + 32) {
              if (world.loadWorldState(s)) {
                systemMessage = `スロット ${s} を復元しました`;
                selectedCreature = null;
              } else {
                systemMessage = `スロット ${s} は空です`;
              }
              systemMessageTimer = 2.0;
              return;
            }
          }
          const botY = bY + bH - 28;
          if (mx >= bX + bW - 75 && mx <= bX + bW - 15 && my >= botY && my <= botY + 22) {
            isDnaBankOpen = false;
            return;
          }
          return;
        }
    if (isCatalogOpen) {
      const isCompact = canvas.height <= 450 || canvas.width < 680;
      const cW = isCompact ? Math.min(canvas.width - 16, 540) : 660;
      const cH = isCompact ? Math.min(canvas.height - 16, 300) : 400;
      const cX = (canvas.width - cW) / 2, cY = (canvas.height - cH) / 2;
      const btnW = isCompact ? 55 : 65;
      const btnH = isCompact ? 20 : 24;
      const btnX = cX + cW - btnW - 12;
      const btnY = cY + cH - btnH - 10;
      if (mx >= btnX && mx <= btnX + btnW && my >= btnY && my <= btnY + btnH) {
        isCatalogOpen = false;
        return;
      }
      const listX = cX + 12;
      const listY = cY + 36;
      const cols = 3;
      const itemW = isCompact ? 68 : 104;
      const itemH = isCompact ? 36 : 48;
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
      const lr = isCompact ? 28 : 34;
      const lx = canvas.width - lr - 15;
      const ly = canvas.height - lr - (isCompact ? 38 : 55);
      if (Math.hypot(mx - lx, my - ly) <= lr + 6) {
        selectedCreature = lm;
        targetCamX = lm.x - canvas.width / (2 * zoom);
        targetCamY = lm.y - canvas.height / (2 * zoom);
        systemMessage = `変異種 #${lm.id} にフォーカス`;
        systemMessageTimer = 2.0;
        return;
      }
    }
    if (isResetConfirming) {
      const dW = 280, dH = 110;
      const dX = (canvas.width - dW) / 2;
      const dY = (canvas.height - dH) / 2;
      if (mx >= dX + 25 && mx <= dX + 125 && my >= dY + 60 && my <= dY + 95) {
        world.initWorld();
        selectedCreature = null;
        isResetConfirming = false;
        isToolMenuOpen = false;
        return;
      }
      if (mx >= dX + 155 && mx <= dX + 255 && my >= dY + 60 && my <= dY + 95) {
        isResetConfirming = false;
        return;
      }
      isResetConfirming = false;
      return;
    }
    const tabW = isCompact ? 140 : 160;
    const tabH = isCompact ? 28 : 36;
    const tabX = (canvas.width - tabW) / 2;
    const tabY = canvas.height - (isCompact ? 34 : 46);

    if (mx >= tabX && mx <= tabX + tabW && my >= tabY && my <= tabY + tabH) {
      isToolMenuOpen = !isToolMenuOpen;
      return;
    }
    if (isToolMenuOpen) {
      const menuW = isCompact ? 160 : 190;
      const itemH = isCompact ? 24 : 30;
      const menuH = itemH * 8 + 10;
      const menuX = (canvas.width - menuW) / 2;
      const menuY = tabY - menuH - 6;

      if (mx >= menuX && mx <= menuX + menuW && my >= menuY && my <= menuY + menuH) {
        const itemIdx = Math.floor((my - (menuY + 5)) / itemH);
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
  idleTimer = 0;
  autoCinematic = false;

  if (e.touches.length === 1) {
    const t = e.touches[0];
    const mx = t.clientX;
    const my = t.clientY;
    const isCompact = canvas.height <= 450;
    const lm = world.latestMutant;
    if (lm && !lm.isDead && selectedCreature?.id !== lm.id) {
      const lr = isCompact ? 28 : 34;
      const lx = canvas.width - lr - 15;
      const ly = canvas.height - lr - (isCompact ? 38 : 55);
      if (Math.hypot(mx - lx, my - ly) <= lr + 8) {
        selectedCreature = lm;
        targetCamX = lm.x - canvas.width / (2 * zoom);
        targetCamY = lm.y - canvas.height / (2 * zoom);
        systemMessage = `変異種 #${lm.id} にフォーカス`;
        systemMessageTimer = 2.0;
        e.preventDefault();
        return;
      }
    }
    if (isResetConfirming) {
      const dW = isCompact ? 250 : 280;
      const dH = isCompact ? 90 : 110;
      const dX = (canvas.width - dW) / 2;
      const dY = (canvas.height - dH) / 2;

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
    const tabW = isCompact ? 140 : 160;
    const tabH = isCompact ? 28 : 36;
    const tabX = (canvas.width - tabW) / 2;
    const tabY = canvas.height - (isCompact ? 34 : 46);

    if (mx >= tabX && mx <= tabX + tabW && my >= tabY && my <= tabY + tabH) {
      isToolMenuOpen = !isToolMenuOpen;
      e.preventDefault();
      return;
    }
    if (isDnaBankOpen || isCatalogOpen) {
      const bW = isCompact ? 320 : 360, bH = isCompact ? 220 : 270;
      const bX = (canvas.width - bW) / 2, bY = (canvas.height - bH) / 2;
      const botY = bY + bH - 32;

      if (isDnaBankOpen) {
        const dW = isCompact ? 320 : 360, dH = isCompact ? 210 : 230;
        const dX = (canvas.width - dW) / 2, dY = (canvas.height - dH) / 2;
        for (let s = 1; s <= 3; s++) {
          const sy = dY + 34 + (s - 1) * 48;
          if (mx >= dX + dW - 105 && mx <= dX + dW - 63 && my >= sy + 6 && my <= sy + 32) {
            world.saveWorldState(s);
            systemMessage = `スロット ${s} 保存完了`;
            systemMessageTimer = 2.0;
            e.preventDefault(); return;
          }
          if (mx >= dX + dW - 55 && mx <= dX + dW - 13 && my >= sy + 6 && my <= sy + 32) {
            if (world.loadWorldState(s)) {
              systemMessage = `スロット ${s} 読込完了`;
              selectedCreature = null;
            } else {
              systemMessage = `スロット ${s} 空`;
            }
            systemMessageTimer = 2.0;
            e.preventDefault(); return;
          }
        }
        if (mx >= dX + dW - 75 && mx <= dX + dW - 15 && my >= dY + dH - 28 && my <= dY + dH - 6) {
          isDnaBankOpen = false;
          e.preventDefault(); return;
        }
      }
      if (mx >= bX + bW - 80 && mx <= bX + bW - 15 && my >= botY && my <= botY + 24) {
        isDnaBankOpen = false;
        isCatalogOpen = false;
        e.preventDefault();
        return;
      }

      if (isCatalogOpen) {
        const cW = isCompact ? Math.min(canvas.width - 16, 540) : 660;
        const cH = isCompact ? Math.min(canvas.height - 16, 300) : 400;
        const cX = (canvas.width - cW) / 2, cY = (canvas.height - cH) / 2;
        const listX = cX + 12;
        const listY = cY + 36;
        const cols = 3;
        const itemW = isCompact ? 68 : 104;
        const itemH = isCompact ? 36 : 48;
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
      }

      e.preventDefault();
      return;
    }
    if (isToolMenuOpen) {
      const menuW = isCompact ? 160 : 190;
      const itemH = isCompact ? 24 : 30;
      const menuH = itemH * 8 + 10;
      const menuX = (canvas.width - menuW) / 2;
      const menuY = tabY - menuH - 6;

      if (mx >= menuX && mx <= menuX + menuW && my >= menuY && my <= menuY + menuH) {
        const itemIdx = Math.floor((my - (menuY + 5)) / itemH);
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
    if (currentTool === 'inspect') {
      isTouchPanning = true;
      touchPanStartX = mx;
      touchPanStartY = my;
      const wp = screenToWorld(mx, my);
      applyGodPower(wp.x, wp.y);
    } else {
      const wp = screenToWorld(mx, my);
      applyGodPower(wp.x, wp.y);
    }
  } else if (e.touches.length === 2) {
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
        ctx.fillStyle = isSilhouette ? '#0f172a' : (isApex ? '#a855f7' : isCarnivore ? '#ef4444' : '#0d9488');
        ctx.strokeStyle = isSilhouette ? '#334155' : 'transparent';
        ctx.beginPath();
        ctx.moveTo(0, -nodeSize * 0.8);
        ctx.lineTo(-nodeSize * 0.6, -nodeSize * (1.6 + (1 - t) * 0.8));
        ctx.lineTo(-nodeSize * 0.8, -nodeSize * 0.6);
        ctx.closePath();
        ctx.fill();
        if (isSilhouette) ctx.stroke();
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
      ctx.fillStyle = isApex ? 'rgba(192, 38, 211, 0.15)' : 'rgba(239, 68, 68, 0.13)';
      ctx.beginPath();
      ctx.arc(c.x, c.y, currentSize * 2.8, 0, Math.PI * 2);
      ctx.fill();
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
        ctx.fillStyle = isSilhouette ? '#0f172a' : 'rgba(168, 85, 247, 0.85)';
        ctx.strokeStyle = isSilhouette ? '#334155' : '#f472b6';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(currentSize * 1.6, side * currentSize * 1.8);
        ctx.lineTo(currentSize * 0.4, side * currentSize * 0.6);
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
    ctx.fillStyle = isSilhouette ? '#0f172a' : '#3b0764';
    ctx.strokeStyle = isSilhouette ? '#334155' : '#d8b4fe';
    ctx.lineWidth = 2.0;
    ctx.beginPath();
    ctx.moveTo(currentSize * 1.8, 0);
    ctx.lineTo(currentSize * 0.6, -currentSize * 1.25);
    ctx.lineTo(-currentSize * 1.2, -currentSize * 1.0);
    ctx.lineTo(-currentSize * 1.5, 0);
    ctx.lineTo(-currentSize * 1.2, currentSize * 1.0);
    ctx.lineTo(currentSize * 0.6, currentSize * 1.25);
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

        ctx.fillStyle = isApex ? '#fef08a' : '#fee2e2';
        ctx.beginPath();
        ctx.ellipse(0, 0, currentSize * 0.35, currentSize * 0.2, 0, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = isApex ? '#7e22ce' : '#dc2626';
        ctx.beginPath();
        ctx.ellipse(currentSize * 0.05, 0, currentSize * 0.14, currentSize * 0.18, 0, 0, Math.PI * 2);
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
      const fangLength = currentSize * (0.55 + c.dna.biteForce * 0.4);
      const fangCount = isApex ? 4 : 3;

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
  ctx.shadowBlur = 0; // 他の描画への影引き継ぎを防止
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
  function drawBrainMonitor(brain: NeuralBrain, startX: number, startY: number) {
    const inLabels = ['エサの気配', 'エサの距離', '天敵の接近', '天敵の距離', '獲物の気配', '獲物の距離', '空腹度', '岩への接近', '短期キオク', '仲間の警報'];
    const outLabels = ['曲がる', '前進', 'ダッシュ', '電撃', '叫ぶ'];

    const colX = [startX + 36, startX + 115, startX + 180];
    const inYStep = 14;
    const hidYStep = 23;
    const outYStep = 26;
    const animTime = world.totalTime * 3.5;
    ctx.font = 'bold 8px monospace';
    ctx.fillStyle = '#38bdf8';
    ctx.fillText('[1.感覚]', colX[0] - 20, startY + 2);
    ctx.fillStyle = '#a855f7';
    ctx.fillText('[2.思考]', colX[1] - 12, startY + 2);
    ctx.fillStyle = '#4ade80';
    ctx.fillText('[3.行動]', colX[2] - 4, startY + 2);
    const inVals = brain.lastInputs;
    const outVals = brain.lastOutputs;
    let thoughtText = 'のんびり遊泳中';
    let thoughtColor = '#94a3b8';

    if (inVals[2] > 0.35 || inVals[3] > 0.4) {
      thoughtText = '天敵から逃走中';
      thoughtColor = '#f43f5e';
    } else if (inVals[9] > 0.4) {
      thoughtText = '警戒態勢!';
      thoughtColor = '#f59e0b';
    } else if (inVals[4] > 0.35) {
      thoughtText = '獲物を追跡中';
      thoughtColor = '#c084fc';
    } else if (inVals[0] > 0.2 || inVals[1] > 0.3) {
      thoughtText = 'エサを探している';
      thoughtColor = '#38bdf8';
    } else if (inVals[8] > 0.4) {
      thoughtText = '探索中';
      thoughtColor = '#a855f7';
    }

    ctx.fillStyle = 'rgba(15, 23, 42, 0.75)';
    ctx.fillRect(startX - 2, startY + 150, 245, 16);
    ctx.strokeStyle = thoughtColor;
    ctx.lineWidth = 1;
    ctx.strokeRect(startX - 2, startY + 150, 245, 16);
    ctx.fillStyle = thoughtColor;
    ctx.font = 'bold 9px monospace';
    ctx.fillText(`状態: ${thoughtText}`, startX + 6, startY + 162);
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

    if (selectedCreature && !selectedCreature.isDead) {
      targetCamX = selectedCreature.x - canvas.width / (2 * zoom);
      targetCamY = selectedCreature.y - canvas.height / (2 * zoom);
    } else if (selectedCreature && selectedCreature.isDead) {
      selectedCreature = null;
    }

    camX += (targetCamX - camX) * 0.1;
    camY += (targetCamY - camY) * 0.1;
    zoom += (targetZoom - zoom) * 0.1;

    world.update(dt);
    sound.update(dt);
        ctx.fillStyle = '#010409';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        ctx.save();
        ctx.scale(zoom, zoom);
        ctx.translate(-camX, -camY);
        const oceanGrad = ctx.createLinearGradient(0, 0, 0, world.height);
        oceanGrad.addColorStop(0, '#041d33');
        oceanGrad.addColorStop(0.45, '#020e1c');
        oceanGrad.addColorStop(1, '#01050a');
        ctx.fillStyle = oceanGrad;
        ctx.fillRect(0, 0, world.width, world.height);
        for (const obs of world.obstacles) {
          if (isInView(obs.x, obs.y, obs.radius + 30)) drawObstacle(obs);
        }
        for (const egg of world.eggs) {
          if (isInView(egg.x, egg.y, 20)) drawEgg(egg);
        }
        for (const p of world.plants) {
          if (!isInView(p.x, p.y, 15)) continue;
          ctx.beginPath();
          if (p.type === 'meat_remains') {
            ctx.fillStyle = '#f43f5e';
            ctx.arc(p.x, p.y, Math.max(3.2, p.size * 1.1), 0, Math.PI * 2);
            ctx.fill();
          } else if (p.type === 'fruit') {
            ctx.fillStyle = '#f59e0b';
            ctx.arc(p.x, p.y, Math.max(3.0, p.size * 1.0), 0, Math.PI * 2);
            ctx.fill();
          } else {
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
        const isCompactH = canvas.height <= 450;
        const barHeight = isCompactH ? 28 : 56;
        ctx.fillStyle = 'rgba(2, 6, 23, 0.9)';
        ctx.fillRect(0, 0, canvas.width, barHeight);
        ctx.strokeStyle = '#1e293b';
        ctx.strokeRect(0, 0, canvas.width, barHeight);

        let herbs = 0, carns = 0, jellies = 0, scavs = 0, larvaCount = 0;
        for (const c of world.creatures) {
          if (c.stage === 'larva') larvaCount++;
          if (c.type === 'solar_jelly') jellies++;
          else if (c.type === 'scavenger') scavs++;
          else if (c.dna.diet > 0.55) carns++;
          else herbs++;
        }

        if (isCompactH) {
          ctx.font = '10px "JetBrains Mono", monospace';
          ctx.fillStyle = '#38bdf8';
          ctx.fillText('BIO-COSMOS', 10, 18);

          ctx.fillStyle = '#4ade80';
          ctx.fillText(`草:${herbs}`, 90, 18);
          ctx.fillStyle = '#34d399';
          ctx.fillText(`海月:${jellies}`, 145, 18);
          ctx.fillStyle = '#f59e0b';
          ctx.fillText(`蟹:${scavs}`, 210, 18);
          ctx.fillStyle = '#f87171';
          ctx.fillText(`肉:${carns}`, 265, 18);
          ctx.fillStyle = '#facc15';
          ctx.fillText(`卵:${world.eggs.length}/稚:${larvaCount}`, 320, 18);
          ctx.fillStyle = '#a855f7';
          ctx.fillText(`Gen.${world.maxGen}`, 425, 18);
          ctx.fillStyle = '#cbd5e1';
          ctx.fillText(`${world.timeScale.toFixed(1)}x`, 485, 18);
        } else {
          ctx.fillStyle = '#38bdf8';
          ctx.font = 'bold 14px "JetBrains Mono", monospace';
          ctx.fillText('BIO-COSMOS // NEURAL ECOSYSTEM SIMULATION', 20, 24);

          ctx.font = '11px "JetBrains Mono", monospace';
          ctx.fillStyle = '#4ade80';
          ctx.fillText(`草食: ${herbs}`, 20, 44);
          ctx.fillStyle = '#34d399';
          ctx.fillText(`クラゲ: ${jellies}`, 105, 44);
          ctx.fillStyle = '#f59e0b';
          ctx.fillText(`掃除屋: ${scavs}`, 200, 44);
          ctx.fillStyle = '#f87171';
          ctx.fillText(`肉食: ${carns}`, 295, 44);
          ctx.fillStyle = '#facc15';
          ctx.fillText(`卵: ${world.eggs.length} / 稚魚: ${larvaCount}`, 385, 44);
          ctx.fillStyle = '#a855f7';
          ctx.fillText(`最高世代: Gen.${world.maxGen}`, 530, 44);
          ctx.fillStyle = '#cbd5e1';
          ctx.fillText(`速度: ${world.timeScale.toFixed(1)}x`, 670, 44);
        }
        if (selectedCreature && !selectedCreature.isDead) {
          const sc = selectedCreature;
          const hudW = isCompactH ? 260 : 340;
          const hudH = isCompactH ? 175 : 350;
          const hudX = canvas.width - hudW - (isCompactH ? 8 : 20);
          const hudY = isCompactH ? 34 : canvas.height - hudH - 75;

          ctx.fillStyle = 'rgba(2, 6, 23, 0.95)';
          ctx.fillRect(hudX, hudY, hudW, hudH);
          ctx.strokeStyle = sc.dna.diet > 0.5 ? '#ef4444' : '#38bdf8';
          ctx.lineWidth = 1.5;
          ctx.strokeRect(hudX, hudY, hudW, hudH);

          const typeIcon = sc.type === 'solar_jelly' ? '[クラゲ]' : sc.type === 'scavenger' ? '[掃除屋]' : sc.type === 'chimera' ? '[頂点怪獣]' : sc.dna.diet > 0.5 ? '[深海サメ]' : '[草食生物]';
          const stageStr = sc.stage === 'larva' ? `稚魚(${(sc.growth * 100).toFixed(0)}%)` : '成体';

          ctx.fillStyle = sc.dna.diet > 0.5 ? '#f87171' : '#38bdf8';
          ctx.font = isCompactH ? 'bold 11px monospace' : 'bold 13px monospace';
          ctx.fillText(`${typeIcon} #${sc.id} (Gen.${sc.generation}) [${stageStr}]`, hudX + 8, hudY + (isCompactH ? 14 : 20));

          if (!isCompactH) {
            const rkStr = sc.dna.rkStrategy > 0.55 ? 'K-戦略 (大卵少産)' : 'r-戦略 (多産小卵)';
            ctx.fillStyle = '#cbd5e1';
            ctx.font = '11px monospace';
            ctx.fillText(`形態: [${stageStr}] | 戦略: [${rkStr}]`, hudX + 12, hudY + 38);
            ctx.fillText(`寿命: ${sc.age.toFixed(1)} / ${sc.dna.maxAge.toFixed(1)}s | 討伐: ${sc.kills} | 子孫: ${sc.children}`, hudX + 12, hudY + 56);
          }
          const barY = isCompactH ? hudY + 20 : hudY + 66;
          ctx.fillStyle = '#1e293b';
          ctx.fillRect(hudX + 8, barY, hudW - 16, isCompactH ? 4 : 6);
          const eRatio = Math.max(0, Math.min(1, sc.energy / sc.maxEnergy));
          ctx.fillStyle = '#10b981';
          ctx.fillRect(hudX + 8, barY, (hudW - 16) * eRatio, isCompactH ? 4 : 6);
          ctx.save();
          if (isCompactH) {
            ctx.translate(hudX + 6, hudY + 28);
            ctx.scale(0.68, 0.68);
            drawBrainMonitor(sc.brain, 20, 0);
          } else {
            ctx.fillStyle = '#a855f7';
            ctx.font = 'bold 11px monospace';
            ctx.fillText('NEURAL BRAIN // 神経網発火モニター', hudX + 12, hudY + 92);
            drawBrainMonitor(sc.brain, hudX + 45, hudY + 95);
          }
          ctx.restore();

          if (autoCinematic && !isCompactH) {
            ctx.fillStyle = '#f59e0b';
            ctx.font = '10px monospace';
            ctx.fillText('オートシネマティック追従中 (操作で解除)', hudX + 12, hudY + hudH - 12);
          }
        }
    const toolLabels: Record<GodTool, string> = {
      inspect: '1. 観察',
      feed_all: '2. 万能餌',
      meteor: '3. 隕石',
      spawn_larva: '4. 稚魚',
      spawn_apex: '5. 頂点怪獣'
    };

    const tabW = 160, tabH = 36;
    const tabX = (canvas.width - tabW) / 2;
    const tabY = canvas.height - 46;
    ctx.fillStyle = isToolMenuOpen ? 'rgba(30, 58, 138, 0.95)' : 'rgba(15, 23, 42, 0.9)';
    ctx.fillRect(tabX, tabY, tabW, tabH);
    ctx.strokeStyle = isToolMenuOpen ? '#38bdf8' : '#475569';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(tabX, tabY, tabW, tabH);

    ctx.fillStyle = '#f8fafc';
    ctx.font = 'bold 12px "JetBrains Mono", monospace';
    ctx.textAlign = 'center';
    ctx.fillText(`[ TOOL: ${toolLabels[currentTool] || 'MENU'} ]`, canvas.width / 2, tabY + 22);
    ctx.textAlign = 'left';
    if (isToolMenuOpen) {
      const menuItems = [
        { id: 'inspect', label: '1. 観察' },
        { id: 'feed_all', label: '2. 万能餌' },
        { id: 'meteor', label: '3. 隕石' },
        { id: 'spawn_larva', label: '4. 稚魚' },
        { id: 'spawn_apex', label: '5. 頂点怪獣' },
        { id: 'dna_bank', label: '6. 水槽セーブ' },
        { id: 'catalog', label: '7. バイオ図鑑' },
        { id: 'reset', label: '8. リセット' }
      ];

      const isCompact = canvas.height <= 450;
      const menuW = isCompact ? 160 : 190;
      const itemH = isCompact ? 24 : 30;
      const menuH = itemH * menuItems.length + 10;
      const menuX = (canvas.width - menuW) / 2;
      const menuY = tabY - menuH - 6;

      ctx.fillStyle = 'rgba(2, 6, 23, 0.96)';
      ctx.fillRect(menuX, menuY, menuW, menuH);
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(menuX, menuY, menuW, menuH);

      menuItems.forEach((item, idx) => {
        const iy = menuY + 5 + idx * itemH;
        const isSelected = currentTool === item.id;
        const isReset = item.id === 'reset';
        const isSpecial = item.id === 'dna_bank' || item.id === 'catalog';

        if (isSelected) {
          ctx.fillStyle = 'rgba(56, 189, 248, 0.2)';
          ctx.fillRect(menuX + 4, iy, menuW - 8, itemH - 2);
        }

        ctx.font = isCompact ? '11px "JetBrains Mono", monospace' : '12px "JetBrains Mono", monospace';
        ctx.fillStyle = isReset ? '#f87171' : isSpecial ? '#a855f7' : isSelected ? '#38bdf8' : '#cbd5e1';
        ctx.fillText(item.label, menuX + 14, iy + (isCompact ? 17 : 20));
      });
    }
    const mutant = world.latestMutant;
    if (mutant && !mutant.isDead && selectedCreature?.id !== mutant.id) {
      const isCompact = canvas.height <= 450;
      const lr = isCompact ? 28 : 34;
      const lx = canvas.width - lr - 15;
      const ly = canvas.height - lr - (isCompact ? 38 : 55);
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
      ctx.clip(); // 円形にクリップ
      ctx.save();
      ctx.translate(lx, ly);
      ctx.scale(1.4, 1.4);
      ctx.translate(-mutant.x, -mutant.y);
      drawCreature(mutant);
      ctx.restore();
      ctx.restore();
      ctx.fillStyle = '#facc15';
      ctx.font = 'bold 9px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('変異種検知', lx, ly - lr - 4);
      ctx.fillStyle = '#38bdf8';
      ctx.fillText('TAP TO JUMP', lx, ly + lr + 11);
      ctx.textAlign = 'left';
    }
    if (world.recentDiscovery) {
      const toastW = 280, toastH = 36;
      const toastX = (canvas.width - toastW) / 2;
      ctx.fillStyle = 'rgba(15, 23, 42, 0.95)';
      ctx.fillRect(toastX, 36, toastW, toastH);
      ctx.strokeStyle = '#facc15';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(toastX, 36, toastW, toastH);

      ctx.fillStyle = '#facc15';
      ctx.font = 'bold 11px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(`新種発見: [${world.recentDiscovery}] 登録!`, canvas.width / 2, 58);
      ctx.textAlign = 'left';
    }
    if (systemMessageTimer > 0) {
      systemMessageTimer -= dt;
      ctx.fillStyle = 'rgba(2, 6, 23, 0.9)';
      ctx.fillRect(canvas.width / 2 - 120, canvas.height - 85, 240, 26);
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 1;
      ctx.strokeRect(canvas.width / 2 - 120, canvas.height - 85, 240, 26);
      ctx.fillStyle = '#38bdf8';
      ctx.font = '11px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(systemMessage, canvas.width / 2, canvas.height - 68);
      ctx.textAlign = 'left';
    }
        if (isDnaBankOpen) {
          const isCompact = canvas.height <= 450;
          const bW = isCompact ? 320 : 360, bH = isCompact ? 210 : 230;
          const bX = (canvas.width - bW) / 2, bY = (canvas.height - bH) / 2;

          ctx.fillStyle = 'rgba(2, 6, 23, 0.98)';
          ctx.fillRect(bX, bY, bW, bH);
          ctx.strokeStyle = '#38bdf8';
          ctx.lineWidth = 2;
          ctx.strokeRect(bX, bY, bW, bH);

          ctx.fillStyle = '#f8fafc';
          ctx.font = 'bold 12px monospace';
          ctx.fillText('SAVE SLOTS // 水槽セーブスロット管理', bX + 14, bY + 22);

          for (let s = 1; s <= 3; s++) {
            const sy = bY + 34 + (s - 1) * 48;
            const summary = world.getSlotSummary(s);

            ctx.fillStyle = 'rgba(15, 23, 42, 0.7)';
            ctx.fillRect(bX + 12, sy, bW - 24, 40);
            ctx.strokeStyle = '#1e293b';
            ctx.lineWidth = 1;
            ctx.strokeRect(bX + 12, sy, bW - 24, 40);

            ctx.fillStyle = '#38bdf8';
            ctx.font = 'bold 11px monospace';
            ctx.fillText(`スロット ${s}`, bX + 18, sy + 16);

            ctx.fillStyle = summary === '空スロット' ? '#64748b' : '#94a3b8';
            ctx.font = '10px monospace';
            ctx.fillText(summary, bX + 18, sy + 32);
            ctx.fillStyle = '#065f46';
            ctx.fillRect(bX + bW - 105, sy + 8, 42, 24);
            ctx.fillStyle = '#34d399';
            ctx.font = '10px monospace';
            ctx.fillText('保存', bX + bW - 96, sy + 24);

            ctx.fillStyle = summary === '空スロット' ? '#1e293b' : '#1e3a8a';
            ctx.fillRect(bX + bW - 55, sy + 8, 42, 24);
            ctx.fillStyle = summary === '空スロット' ? '#475569' : '#60a5fa';
            ctx.fillText('読込', bX + bW - 46, sy + 24);
          }

          const botY = bY + bH - 28;
          ctx.fillStyle = '#334155';
          ctx.fillRect(bX + bW - 75, botY, 60, 20);
          ctx.fillStyle = '#fff';
          ctx.font = '10px monospace';
          ctx.fillText('閉じる', bX + bW - 63, botY + 14);
        }


    if (isCatalogOpen) {
      const isCompact = canvas.height <= 450 || canvas.width < 680;
      const cW = isCompact ? Math.min(canvas.width - 16, 540) : 660;
      const cH = isCompact ? Math.min(canvas.height - 16, 300) : 400;
      const cX = (canvas.width - cW) / 2, cY = (canvas.height - cH) / 2;

      ctx.fillStyle = 'rgba(2, 6, 23, 0.98)';
      ctx.fillRect(cX, cY, cW, cH);
      ctx.strokeStyle = '#facc15';
      ctx.lineWidth = 2;
      ctx.strokeRect(cX, cY, cW, cH);

      const count = world.discoveredSpecies.length;
      ctx.fillStyle = '#facc15';
      ctx.font = 'bold 12px monospace';
      ctx.fillText(`SPECIES CATALOG // バイオ変異図鑑 (${count}/${SPECIES_CATALOG.length})`, cX + 14, cY + 22);

      const listX = cX + 12;
      const listY = cY + 34;
      const cols = 3;
      const itemW = isCompact ? 68 : 104;
      const itemH = isCompact ? 36 : 48;
      const gapX = isCompact ? 4 : 6;
      const gapY = isCompact ? 4 : 6;

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

        ctx.font = isCompact ? '9px monospace' : '10px monospace';
        ctx.fillStyle = isSelected ? '#38bdf8' : isDiscovered ? '#f8fafc' : '#64748b';
        const displayName = isDiscovered ? item.name : '??? 未確認';
        ctx.fillText(displayName, ix + (isCompact ? 3 : 6), iy + (isCompact ? 14 : 18));

        ctx.font = '8px monospace';
        ctx.fillStyle = isDiscovered ? '#94a3b8' : '#475569';
        ctx.fillText(isDiscovered ? item.category : '未発見', ix + (isCompact ? 3 : 6), iy + (isCompact ? 28 : 36));
      });

      const rightX = listX + 3 * (itemW + gapX) + (isCompact ? 6 : 14);
      const rightW = cX + cW - rightX - 12;
      const curItem = SPECIES_CATALOG.find(x => x.id === selectedCatalogId) || SPECIES_CATALOG[0];
      const isCurDiscovered = world.discoveredSpecies.includes(curItem.id);

      const prevH = isCompact ? 86 : 140;
      ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
      ctx.fillRect(rightX, listY, rightW, prevH);
      ctx.strokeStyle = isCurDiscovered ? '#38bdf8' : '#334155';
      ctx.lineWidth = 1;
      ctx.strokeRect(rightX, listY, rightW, prevH);

      drawSpeciesPreview(curItem, isCurDiscovered, rightX + rightW / 2, listY + prevH / 2, isCompact ? 1.1 : 1.7);

      ctx.font = '9px monospace';
      ctx.fillStyle = isCurDiscovered ? '#34d399' : '#f43f5e';
      ctx.fillText(isCurDiscovered ? '[ 観測個体 ]' : '[ シルエット // 未確認 ]', rightX + 8, listY + 16);

      const descY = listY + prevH + (isCompact ? 6 : 12);
      ctx.font = isCompact ? 'bold 10px monospace' : 'bold 12px monospace';
      ctx.fillStyle = isCurDiscovered ? '#facc15' : '#94a3b8';
      ctx.fillText(`${curItem.name} (${curItem.category})`, rightX, descY + (isCompact ? 8 : 12));

      ctx.font = '9px monospace';
      ctx.fillStyle = '#38bdf8';
      ctx.fillText(`発見条件: ${curItem.condition}`, rightX, descY + (isCompact ? 22 : 30));

      ctx.fillStyle = '#cbd5e1';
      if (!isCompact) {
        ctx.fillText(isCurDiscovered ? curItem.desc : '未発見の突然変異種。生態系の中で変異条件を満たすと登録されます。', rightX, descY + 48);

        const pDna = curItem.previewDna;
        const specs = [
          { label: '体長', val: (pDna.size || 6.5) / 16 },
          { label: '遊泳', val: (pDna.speed || 2.5) / 5.5 },
          { label: '装甲', val: (pDna.armor || 0) },
          { label: '猛毒', val: (pDna.poison || 0) },
          { label: '咬合', val: (pDna.biteForce || 0) }
        ];

        const barStartY = descY + 66;
        specs.forEach((sp, sIdx) => {
          const sy = barStartY + sIdx * 14;
          ctx.fillStyle = '#64748b';
          ctx.fillText(sp.label, rightX, sy + 8);
          ctx.fillStyle = '#1e293b';
          ctx.fillRect(rightX + 32, sy, 110, 8);
          ctx.fillStyle = isCurDiscovered ? '#38bdf8' : '#475569';
          ctx.fillRect(rightX + 32, sy, 110 * Math.min(1.0, sp.val), 8);
        });
      }

      const btnW = isCompact ? 55 : 65;
      const btnH = isCompact ? 20 : 24;
      const btnX = cX + cW - btnW - 12;
      const btnY = cY + cH - btnH - 10;
      ctx.fillStyle = '#334155';
      ctx.fillRect(btnX, btnY, btnW, btnH);
      ctx.strokeStyle = '#64748b';
      ctx.lineWidth = 1;
      ctx.strokeRect(btnX, btnY, btnW, btnH);
      ctx.fillStyle = '#fff';
      ctx.font = isCompact ? '10px monospace' : '11px monospace';
      ctx.fillText('閉じる', btnX + (isCompact ? 10 : 14), btnY + (isCompact ? 14 : 16));
    }

    if (isResetConfirming) {
      const dW = 280, dH = 110;
      const dX = (canvas.width - dW) / 2;
      const dY = (canvas.height - dH) / 2;

      ctx.fillStyle = 'rgba(2, 6, 23, 0.98)';
      ctx.fillRect(dX, dY, dW, dH);
      ctx.strokeStyle = '#f87171';
      ctx.lineWidth = 2;
      ctx.strokeRect(dX, dY, dW, dH);

      ctx.fillStyle = '#f8fafc';
      ctx.font = 'bold 12px "JetBrains Mono", monospace';
      ctx.textAlign = 'center';
      ctx.fillText('本当にリセットしますか？', canvas.width / 2, dY + 32);

      ctx.fillStyle = 'rgba(239, 68, 68, 0.85)';
      ctx.fillRect(dX + 25, dY + 60, 100, 35);
      ctx.strokeStyle = '#fca5a5';
      ctx.lineWidth = 1;
      ctx.strokeRect(dX + 25, dY + 60, 100, 35);
      ctx.fillStyle = '#ffffff';
      ctx.fillText('はい', dX + 75, dY + 82);

      ctx.fillStyle = 'rgba(51, 65, 85, 0.85)';
      ctx.fillRect(dX + 155, dY + 60, 100, 35);
      ctx.strokeStyle = '#94a3b8';
      ctx.lineWidth = 1;
      ctx.strokeRect(dX + 155, dY + 60, 100, 35);
      ctx.fillStyle = '#ffffff';
      ctx.fillText('いいえ', dX + 205, dY + 82);

      ctx.textAlign = 'left';
    }

  } catch (err) {
    console.error('Render Loop Error:', err);
  }

  requestAnimationFrame(loop);
}

requestAnimationFrame(loop);
