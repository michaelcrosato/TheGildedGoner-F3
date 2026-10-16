import { ID, WEAPONS, LEVELS } from './content.js';
import { freshProgress } from './simulation.js';
export const SAVE_KEY = `${ID}:save:v1`;
export const SETTINGS_KEY = `${ID}:settings:v1`;
const finite = (n, fallback = 0) => Number.isFinite(n) ? n : fallback;
export function validateSave(raw) {
  if (!raw || raw.version !== 1 || typeof raw !== 'object') return null;
  const p = freshProgress();
  p.level = Object.hasOwn(LEVELS, raw.level) ? raw.level : 'bellwether';
  p.checkpoint = LEVELS[p.level].checkpoints.some(c=>c.id===raw.checkpoint) ? raw.checkpoint : LEVELS[p.level].checkpoints[0]?.id || 'hearth';
  if (raw.worlds && typeof raw.worlds === 'object') for (const [id, state] of Object.entries(raw.worlds).slice(0,100)) {
    if (!Object.hasOwn(LEVELS,id) || !state || typeof state !== 'object') continue;
    p.worlds[id] = { checkpoint: LEVELS[id].checkpoints.some(c=>c.id===state.checkpoint) ? state.checkpoint : LEVELS[id].checkpoints[0]?.id || 'hearth', flags: Array.isArray(state.flags) ? state.flags.filter(x=>typeof x==='string').slice(0,100) : [], kills: Array.isArray(state.kills) ? state.kills.filter(x=>typeof x==='string').slice(0,100) : [], dropped: null };
    if (state.dropped && ['x','y','embers'].every(k=>Number.isFinite(state.dropped[k]))) p.worlds[id].dropped = {x:state.dropped.x,y:state.dropped.y,embers:Math.max(0,state.dropped.embers)};
  }
  for (const key of ['vigor', 'temper']) p[key] = Math.max(0, Math.min(3, Math.floor(finite(raw[key]))));
  for (const key of ['embers', 'deaths', 'elapsed']) p[key] = Math.max(0, Math.min(1e8, finite(raw[key])));
  for (const key of ['inventory', 'flags', 'kills']) p[key] = Array.isArray(raw[key]) ? [...new Set(raw[key].filter(v => typeof v === 'string' && v.length < 60))].slice(0, 100) : [];
  p.weapon = WEAPONS[raw.weapon] && (raw.weapon === 'sword' || p.inventory.includes(raw.weapon)) ? raw.weapon : 'sword';
  if (raw.dropped && ['x', 'y', 'embers'].every(k => Number.isFinite(raw.dropped[k])) && raw.dropped.x > 0 && raw.dropped.x < 832 && raw.dropped.y > 0 && raw.dropped.y < 864) p.dropped = { x: raw.dropped.x, y: raw.dropped.y, embers: Math.max(0, raw.dropped.embers) };
  return p;
}
export class SaveStore {
  constructor(storage) { this.storage = storage; this.available = true; }
  load() { try { return validateSave(JSON.parse(this.storage.getItem(SAVE_KEY))); } catch { this.available = false; return null; } }
  write(progress) { const value = validateSave(progress); if (!value) return false; try { this.storage.setItem(SAVE_KEY, JSON.stringify(value)); return true; } catch { this.available = false; return false; } }
  settings() { try { return JSON.parse(this.storage.getItem(SETTINGS_KEY)) || {}; } catch { return {}; } }
  saveSettings(value) { try { this.storage.setItem(SETTINGS_KEY, JSON.stringify(value)); } catch { this.available = false; } }
}
