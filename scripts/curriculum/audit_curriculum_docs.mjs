#!/usr/bin/env node
/**
 * Curriculum Documentation Auditor for `docs/curriculum/`.
 *
 * Usage:
 *   node scripts/curriculum/audit_curriculum_docs.mjs [mod1 mod2 ...] [--strict-stage2] [--json]
 *
 * Checks per module directory:
 * - Broken relative markdown / HTML image links (`brokenLinks`)
 * - Unreferenced SVG assets in module folder (`orphanSvgs`)
 * - Animated SVG tags `<animate*>` violating static Frame-1 rule (`animatedSvgs`)
 * - Arc-sampled SVG ink span < 160px (`tinySvgs`)
 * - Unfinished Stage-1 placeholders like `[Img 1]` (`stage1Placeholders`)
 * - Malformed ```json``` blocks (`jsonErrors`, with JSONC comment fallback `jsoncBlocks`)
 * - AST flat block counts (`countScopesFlatBlocks`) and optional `slotCap` consistency
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { countScopesFlatBlocks } from './lib/sim_core.mjs';

const DEFAULT_ROOT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const IGNORED_STROKE_COLORS = new Set(['#cbd5e1', '#e2e8f0', '#f1f5f9', 'none', 'transparent']);
const TURTLE_FILL_COLORS = new Set(['#10b981', '#3b82f6', '#8b5cf6', '#f97316', '#d1fae5']);

function toPosixRel(baseDir, targetPath) {
  return path.relative(baseDir, targetPath).replace(/\\/g, '/');
}

function collectFilesRecursive(dirPath, extSet, out = []) {
  if (!fs.existsSync(dirPath)) return out;
  const entries = fs.readdirSync(dirPath, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name));
  for (const entry of entries) {
    const full = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      collectFilesRecursive(full, extSet, out);
    } else if (entry.isFile()) {
      const ext = path.extname(entry.name).toLowerCase();
      if (extSet.has(ext)) out.push(full);
    }
  }
  return out;
}

function stripJsonComments(text) {
  let out = '';
  let inString = false;
  let escaped = false;
  let i = 0;
  while (i < text.length) {
    const ch = text[i];
    const next = text[i + 1];
    if (inString) {
      out += ch;
      if (escaped) {
        escaped = false;
      } else if (ch === '\\') {
        escaped = true;
      } else if (ch === '"') {
        inString = false;
      }
      i += 1;
      continue;
    }
    if (ch === '"') {
      inString = true;
      out += ch;
      i += 1;
      continue;
    }
    if (ch === '/' && next === '/') {
      while (i < text.length && text[i] !== '\n' && text[i] !== '\r') i += 1;
      continue;
    }
    if (ch === '/' && next === '*') {
      i += 2;
      while (i < text.length && !(text[i] === '*' && text[i + 1] === '/')) {
        if (text[i] === '\n') out += '\n';
        i += 1;
      }
      i += 2;
      continue;
    }
    out += ch;
    i += 1;
  }
  return out;
}

function getLineNumberAt(text, index) {
  let line = 1;
  for (let i = 0; i < index && i < text.length; i += 1) {
    if (text[i] === '\n') line += 1;
  }
  return line;
}

/**
 * Strip fenced code blocks and inline code spans while keeping line numbers aligned.
 */
function maskCodeForMarkdownScan(markdown) {
  let masked = markdown.replace(/^[ \t]*(```+|~~~+)[^\r\n]*\r?\n[\s\S]*?^[ \t]*\1[ \t]*$/gm, (match) =>
    match.replace(/[^\r\n]/g, ' ')
  );
  masked = masked.replace(/`[^`\r\n]+`/g, (match) => ' '.repeat(match.length));
  return masked;
}

function extractRelativeLinks(markdown, mdFile) {
  const masked = maskCodeForMarkdownScan(markdown);
  const links = [];

  const mdLinkRe = /!?\[[^\]]*\]\(([^)\r\n]+)\)/g;
  let m;
  while ((m = mdLinkRe.exec(masked)) !== null) {
    let rawTarget = m[1].trim();
    // Strip optional markdown title: (path "title")
    const titleMatch = rawTarget.match(/^(\S+)\s+["'][\s\S]*["']$/);
    if (titleMatch) rawTarget = titleMatch[1];
    if (rawTarget.startsWith('<') && rawTarget.endsWith('>')) {
      rawTarget = rawTarget.slice(1, -1).trim();
    }
    links.push({ target: rawTarget, line: getLineNumberAt(markdown, m.index) });
  }

  const imgSrcRe = /<img\b[^>]*\bsrc=["']([^"']+)["']/gi;
  while ((m = imgSrcRe.exec(masked)) !== null) {
    links.push({ target: m[1].trim(), line: getLineNumberAt(markdown, m.index) });
  }

  const results = [];
  for (const item of links) {
    const clean = item.target;
    if (
      !clean ||
      clean.startsWith('#') ||
      /^(https?:|mailto:|file:|data:|javascript:)/i.test(clean)
    ) {
      continue;
    }
    const withoutFragment = clean.split('#')[0].split('?')[0];
    if (!withoutFragment) continue;
    let decoded = withoutFragment;
    try {
      decoded = decodeURIComponent(withoutFragment);
    } catch {
      // keep raw
    }
    const resolved = path.resolve(path.dirname(mdFile), decoded);
    results.push({
      target: clean,
      resolved,
      line: item.line,
      exists: fs.existsSync(resolved),
    });
  }
  return results;
}

function parseSvgAttrMap(attrText) {
  const attrs = {};
  const attrRe = /([a-zA-Z_:][-a-zA-Z0-9_:.]*)\s*=\s*(?:"([^"]*)"|'([^']*)')/g;
  let m;
  while ((m = attrRe.exec(attrText)) !== null) {
    attrs[m[1]] = m[2] !== undefined ? m[2] : m[3];
  }
  return attrs;
}

function parseTransformOps(transformStr) {
  const ops = [];
  if (!transformStr) return ops;
  const fnRe = /(translate|scale|rotate)\s*\(([^)]*)\)/g;
  let m;
  while ((m = fnRe.exec(transformStr)) !== null) {
    const nums = (m[2].match(/[-+]?(?:\d*\.\d+|\d+)(?:e[-+]?\d+)?/gi) || []).map(Number);
    ops.push({ type: m[1], nums });
  }
  return ops;
}

function applyTransformPoint(x, y, transformStack) {
  let px = x;
  let py = y;
  for (let i = transformStack.length - 1; i >= 0; i -= 1) {
    const ops = transformStack[i];
    for (let j = ops.length - 1; j >= 0; j -= 1) {
      const op = ops[j];
      if (op.type === 'translate') {
        px += op.nums[0] || 0;
        py += op.nums[1] || 0;
      } else if (op.type === 'scale') {
        const sx = op.nums[0] ?? 1;
        const sy = op.nums[1] ?? sx;
        px *= sx;
        py *= sy;
      } else if (op.type === 'rotate') {
        const deg = op.nums[0] || 0;
        const cx = op.nums[1] || 0;
        const cy = op.nums[2] || 0;
        const rad = (deg * Math.PI) / 180;
        const dx = px - cx;
        const dy = py - cy;
        px = cx + dx * Math.cos(rad) - dy * Math.sin(rad);
        py = cy + dx * Math.sin(rad) + dy * Math.cos(rad);
      }
    }
  }
  return [px, py];
}

function vectorAngle(ux, uy, vx, vy) {
  const dot = ux * vx + uy * vy;
  const len = Math.hypot(ux, uy) * Math.hypot(vx, vy);
  if (len === 0) return 0;
  const ratio = Math.max(-1, Math.min(1, dot / len));
  const ang = Math.acos(ratio);
  return ux * vy - uy * vx < 0 ? -ang : ang;
}

function sampleSvgArc(x1, y1, rxIn, ryIn, phiDeg, largeArcFlag, sweepFlag, x2, y2, addPoint) {
  addPoint(x1, y1);
  addPoint(x2, y2);
  let rx = Math.abs(rxIn);
  let ry = Math.abs(ryIn);
  if (rx < 1e-6 || ry < 1e-6 || (Math.abs(x1 - x2) < 1e-6 && Math.abs(y1 - y2) < 1e-6)) {
    return;
  }
  const phi = ((phiDeg % 360) * Math.PI) / 180;
  const cosPhi = Math.cos(phi);
  const sinPhi = Math.sin(phi);
  const dx2 = (x1 - x2) / 2;
  const dy2 = (y1 - y2) / 2;
  const x1p = cosPhi * dx2 + sinPhi * dy2;
  const y1p = -sinPhi * dx2 + cosPhi * dy2;

  const lambda = (x1p * x1p) / (rx * rx) + (y1p * y1p) / (ry * ry);
  if (lambda > 1) {
    const s = Math.sqrt(lambda);
    rx *= s;
    ry *= s;
  }

  const rx2 = rx * rx;
  const ry2 = ry * ry;
  const x1p2 = x1p * x1p;
  const y1p2 = y1p * y1p;
  const num = Math.max(0, rx2 * ry2 - rx2 * y1p2 - ry2 * x1p2);
  const den = rx2 * y1p2 + ry2 * x1p2;
  const factor = (largeArcFlag === sweepFlag ? -1 : 1) * Math.sqrt(den === 0 ? 0 : num / den);
  const cxp = factor * ((rx * y1p) / ry);
  const cyp = factor * (-(ry * x1p) / rx);

  const cx = cosPhi * cxp - sinPhi * cyp + (x1 + x2) / 2;
  const cy = sinPhi * cxp + cosPhi * cyp + (y1 + y2) / 2;

  const ux = (x1p - cxp) / rx;
  const uy = (y1p - cyp) / ry;
  const vx = (-x1p - cxp) / rx;
  const vy = (-y1p - cyp) / ry;

  const theta1 = vectorAngle(1, 0, ux, uy);
  let dTheta = vectorAngle(ux, uy, vx, vy);
  if (!sweepFlag && dTheta > 0) dTheta -= 2 * Math.PI;
  if (sweepFlag && dTheta < 0) dTheta += 2 * Math.PI;

  const steps = 16;
  for (let i = 1; i < steps; i += 1) {
    const t = theta1 + (i / steps) * dTheta;
    const cosT = Math.cos(t);
    const sinT = Math.sin(t);
    const px = cx + cosPhi * rx * cosT - sinPhi * ry * sinT;
    const py = cy + sinPhi * rx * cosT + cosPhi * ry * sinT;
    addPoint(px, py);
  }
}

function sampleSvgPathData(d, addPoint) {
  if (!d) return;
  const tokens = d.match(/[a-zA-Z]|[-+]?(?:\d*\.\d+|\d+)(?:e[-+]?\d+)?/g);
  if (!tokens) return;

  let i = 0;
  let cmd = '';
  let x = 0;
  let y = 0;
  let startX = 0;
  let startY = 0;

  const readNum = () => {
    const val = Number(tokens[i]);
    i += 1;
    return Number.isFinite(val) ? val : 0;
  };
  const isNumberToken = (tok) => tok !== undefined && !/^[a-zA-Z]$/.test(tok);

  while (i < tokens.length) {
    if (/^[a-zA-Z]$/.test(tokens[i])) {
      cmd = tokens[i];
      i += 1;
    }
    switch (cmd) {
      case 'M':
      case 'm': {
        const rel = cmd === 'm';
        const nx = readNum() + (rel ? x : 0);
        const ny = readNum() + (rel ? y : 0);
        x = nx;
        y = ny;
        startX = x;
        startY = y;
        addPoint(x, y);
        cmd = rel ? 'l' : 'L';
        break;
      }
      case 'L':
      case 'l': {
        while (isNumberToken(tokens[i])) {
          const rel = cmd === 'l';
          x = readNum() + (rel ? x : 0);
          y = readNum() + (rel ? y : 0);
          addPoint(x, y);
        }
        break;
      }
      case 'H':
      case 'h': {
        while (isNumberToken(tokens[i])) {
          x = readNum() + (cmd === 'h' ? x : 0);
          addPoint(x, y);
        }
        break;
      }
      case 'V':
      case 'v': {
        while (isNumberToken(tokens[i])) {
          y = readNum() + (cmd === 'v' ? y : 0);
          addPoint(x, y);
        }
        break;
      }
      case 'A':
      case 'a': {
        while (isNumberToken(tokens[i])) {
          const rel = cmd === 'a';
          const rx = readNum();
          const ry = readNum();
          const xRot = readNum();
          const largeArc = readNum() !== 0;
          const sweep = readNum() !== 0;
          const nx = readNum() + (rel ? x : 0);
          const ny = readNum() + (rel ? y : 0);
          sampleSvgArc(x, y, rx, ry, xRot, largeArc, sweep, nx, ny, addPoint);
          x = nx;
          y = ny;
        }
        break;
      }
      case 'C':
      case 'c': {
        while (isNumberToken(tokens[i])) {
          const rel = cmd === 'c';
          const x1 = readNum() + (rel ? x : 0);
          const y1 = readNum() + (rel ? y : 0);
          const x2 = readNum() + (rel ? x : 0);
          const y2 = readNum() + (rel ? y : 0);
          const nx = readNum() + (rel ? x : 0);
          const ny = readNum() + (rel ? y : 0);
          addPoint(x1, y1);
          addPoint(x2, y2);
          addPoint(nx, ny);
          x = nx;
          y = ny;
        }
        break;
      }
      case 'Q':
      case 'q': {
        while (isNumberToken(tokens[i])) {
          const rel = cmd === 'q';
          const x1 = readNum() + (rel ? x : 0);
          const y1 = readNum() + (rel ? y : 0);
          const nx = readNum() + (rel ? x : 0);
          const ny = readNum() + (rel ? y : 0);
          addPoint(x1, y1);
          addPoint(nx, ny);
          x = nx;
          y = ny;
        }
        break;
      }
      case 'S':
      case 's':
      case 'T':
      case 't': {
        const isQuad = cmd === 'T' || cmd === 't';
        while (isNumberToken(tokens[i])) {
          const rel = cmd === 's' || cmd === 't';
          if (!isQuad) {
            const cx2 = readNum() + (rel ? x : 0);
            const cy2 = readNum() + (rel ? y : 0);
            addPoint(cx2, cy2);
          }
          const nx = readNum() + (rel ? x : 0);
          const ny = readNum() + (rel ? y : 0);
          addPoint(nx, ny);
          x = nx;
          y = ny;
        }
        break;
      }
      case 'Z':
      case 'z': {
        x = startX;
        y = startY;
        addPoint(x, y);
        cmd = '';
        break;
      }
      default:
        i += 1;
        break;
    }
  }
}

/**
 * Inspect an SVG string for `<animate*>` tags and ink bounding span.
 * Ignores canvas backdrop rects, `#cbd5e1`/`#e2e8f0`/`#f1f5f9` grid/axis strokes,
 * and turtle marker `<polygon>` triangles.
 */
export function inspectSvgMetrics(svgContent) {
  const hasAnimation = /<animate(?:Transform|Motion)?\b/i.test(svgContent);
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  let inkElements = 0;

  const transformStack = [];
  const expandLocal = (lx, ly) => {
    const [tx, ty] = applyTransformPoint(lx, ly, transformStack);
    if (Number.isFinite(tx) && Number.isFinite(ty)) {
      if (tx < minX) minX = tx;
      if (tx > maxX) maxX = tx;
      if (ty < minY) minY = ty;
      if (ty > maxY) maxY = ty;
    }
  };

  const tagRe = /<\/?([a-zA-Z][a-zA-Z0-9:-]*)([^>]*)>/g;
  let m;
  let skipFirstBackdrop = true;
  while ((m = tagRe.exec(svgContent)) !== null) {
    const rawTag = m[0];
    const tag = m[1].toLowerCase();
    const attrText = m[2];
    const isClosing = rawTag.startsWith('</');
    const isSelfClosing = rawTag.endsWith('/>');

    if (tag === 'g') {
      if (isClosing) {
        transformStack.pop();
      } else {
        const attrs = parseSvgAttrMap(attrText);
        if (!isSelfClosing) {
          transformStack.push(parseTransformOps(attrs.transform));
        }
      }
      continue;
    }

    if (isClosing) continue;
    const attrs = parseSvgAttrMap(attrText);
    const stroke = (attrs.stroke || '').trim().toLowerCase();
    const fill = (attrs.fill || '').trim().toLowerCase();

    if (tag === 'rect') {
      const rx = Number(attrs.x ?? 0);
      const ry = Number(attrs.y ?? 0);
      const rw = Number(attrs.width ?? 0);
      const rh = Number(attrs.height ?? 0);
      const isBackdrop =
        (skipFirstBackdrop && rx === 0 && ry === 0 && (fill === '#ffffff' || fill === 'white' || stroke === '#e2e8f0')) ||
        IGNORED_STROKE_COLORS.has(stroke) ||
        attrs['stroke-dasharray'] === '6 4';
      skipFirstBackdrop = false;
      if (isBackdrop || rw <= 0 || rh <= 0) continue;
      inkElements += 1;
      expandLocal(rx, ry);
      expandLocal(rx + rw, ry + rh);
      continue;
    }

    if (IGNORED_STROKE_COLORS.has(stroke) && (fill === '' || fill === 'none')) {
      continue;
    }

    if (tag === 'line') {
      if (IGNORED_STROKE_COLORS.has(stroke)) continue;
      inkElements += 1;
      expandLocal(Number(attrs.x1 ?? 0), Number(attrs.y1 ?? 0));
      expandLocal(Number(attrs.x2 ?? 0), Number(attrs.y2 ?? 0));
    } else if (tag === 'path') {
      if (IGNORED_STROKE_COLORS.has(stroke) && (!fill || fill === 'none')) continue;
      inkElements += 1;
      sampleSvgPathData(attrs.d, expandLocal);
    } else if (tag === 'circle') {
      const cx = Number(attrs.cx ?? 0);
      const cy = Number(attrs.cy ?? 0);
      const r = Math.abs(Number(attrs.r ?? 0));
      if (r <= 0) continue;
      inkElements += 1;
      expandLocal(cx - r, cy - r);
      expandLocal(cx + r, cy + r);
    } else if (tag === 'ellipse') {
      const cx = Number(attrs.cx ?? 0);
      const cy = Number(attrs.cy ?? 0);
      const rx = Math.abs(Number(attrs.rx ?? 0));
      const ry = Math.abs(Number(attrs.ry ?? 0));
      if (rx <= 0 || ry <= 0) continue;
      inkElements += 1;
      expandLocal(cx - rx, cy - ry);
      expandLocal(cx + rx, cy + ry);
    } else if (tag === 'polyline' || tag === 'polygon') {
      const isTurtleMarker =
        tag === 'polygon' &&
        (stroke === '#047857' || stroke === '#065f46' || TURTLE_FILL_COLORS.has(fill));
      if (isTurtleMarker) continue;
      const nums = (attrs.points || '').match(/[-+]?(?:\d*\.\d+|\d+)(?:e[-+]?\d+)?/gi);
      if (!nums || nums.length < 4) continue;
      inkElements += 1;
      for (let i = 0; i + 1 < nums.length; i += 2) {
        expandLocal(Number(nums[i]), Number(nums[i + 1]));
      }
    }
  }

  if (!Number.isFinite(minX)) {
    return {
      hasAnimation,
      inkElements,
      inkWidth: 0,
      inkHeight: 0,
      inkMaxSpan: 0,
    };
  }
  const inkWidth = Math.round(maxX - minX);
  const inkHeight = Math.round(maxY - minY);
  return {
    hasAnimation,
    inkElements,
    inkWidth,
    inkHeight,
    inkMaxSpan: Math.max(inkWidth, inkHeight),
  };
}

function isAstLikeObject(parsed) {
  if (!parsed || typeof parsed !== 'object') return false;
  if (Array.isArray(parsed)) {
    return parsed.length > 0 && typeof parsed[0]?.op === 'string';
  }
  return Boolean(
    Array.isArray(parsed.MAIN) ||
      Array.isArray(parsed.MAIN_1) ||
      Array.isArray(parsed.F1) ||
      Array.isArray(parsed.blocks) ||
      parsed.solution ||
      parsed.initial
  );
}

function extractScopesCandidate(obj) {
  if (!obj || typeof obj !== 'object') return null;
  if (Array.isArray(obj)) return { MAIN: obj };
  if (Array.isArray(obj.blocks)) return { MAIN: obj.blocks };
  const scopes = {};
  for (const key of ['MAIN', 'MAIN_1', 'MAIN_2', 'MAIN_3', 'MAIN_4', 'F1', 'F2', 'F3', 'F4', 'ON_TAP', 'ON_KEY', 'ON_COLLISION']) {
    if (Array.isArray(obj[key])) scopes[key] = obj[key];
  }
  return Object.keys(scopes).length > 0 ? scopes : null;
}

function inspectJsonBlocks(markdown, relMdPath) {
  const fenceRe = /^[ \t]*```json\b[^\r\n]*\r?\n([\s\S]*?)^[ \t]*```[ \t]*$/gm;
  const stats = {
    jsonBlocks: 0,
    jsoncBlocks: 0,
    ellipsisSnippets: 0,
    jsonErrors: [],
    astSpecsChecked: 0,
    slotCapMismatches: [],
  };

  let m;
  while ((m = fenceRe.exec(markdown)) !== null) {
    const startLine = getLineNumberAt(markdown, m.index);
    const raw = m[1];
    let parsed;
    try {
      parsed = JSON.parse(raw);
      stats.jsonBlocks += 1;
    } catch (strictErr) {
      const stripped = stripJsonComments(raw);
      try {
        parsed = JSON.parse(stripped);
        stats.jsoncBlocks += 1;
      } catch (jsoncErr) {
        if (/(?:^|\s|,|\[|\{)\.\.\.(?:\s|,|\]|\}|$)/m.test(stripped)) {
          stats.ellipsisSnippets += 1;
          continue;
        }
        stats.jsonErrors.push({
          file: relMdPath,
          line: startLine,
          error: jsoncErr.message,
        });
        continue;
      }
    }

    if (isAstLikeObject(parsed)) {
      stats.astSpecsChecked += 1;
      const candidate = parsed.solution ? extractScopesCandidate(parsed.solution) : extractScopesCandidate(parsed);
      if (candidate) {
        const counts = countScopesFlatBlocks(candidate);
        if (typeof parsed.slotCap === 'number' && counts.total > parsed.slotCap) {
          stats.slotCapMismatches.push({
            file: relMdPath,
            line: startLine,
            totalFlatBlocks: counts.total,
            slotCap: parsed.slotCap,
          });
        }
      }
    }
  }
  return stats;
}

/**
 * Audit curriculum modules under `docs/curriculum/`.
 */
export function auditCurriculumDocs({
  rootDir = DEFAULT_ROOT_DIR,
  modules = null,
  strictStage2 = false,
} = {}) {
  const curriculumDir = path.join(rootDir, 'docs', 'curriculum');
  if (!fs.existsSync(curriculumDir)) {
    throw new Error(`Curriculum directory not found: ${curriculumDir}`);
  }

  let moduleNames;
  if (Array.isArray(modules) && modules.length > 0) {
    moduleNames = [...modules];
  } else {
    moduleNames = fs
      .readdirSync(curriculumDir, { withFileTypes: true })
      .filter((e) => e.isDirectory() && e.name !== 'svg')
      .map((e) => e.name)
      .sort();
  }

  // Also index SVG links from curriculum/overview.md so overview links count as references
  const globalSvgRefs = new Set();
  const overviewPath = path.join(curriculumDir, 'overview.md');
  if (fs.existsSync(overviewPath)) {
    const ovText = fs.readFileSync(overviewPath, 'utf8');
    for (const l of extractRelativeLinks(ovText, overviewPath)) {
      if (l.exists && l.resolved.toLowerCase().endsWith('.svg')) {
        globalSvgRefs.add(path.normalize(l.resolved));
      }
    }
  }

  const perModule = [];
  const totals = {
    modulesScanned: 0,
    mdFiles: 0,
    svgFiles: 0,
    jsonBlocks: 0,
    jsoncBlocks: 0,
    ellipsisSnippets: 0,
    astSpecsChecked: 0,
    brokenLinks: 0,
    orphanSvgs: 0,
    animatedSvgs: 0,
    tinySvgs: 0,
    stage1Placeholders: 0,
    jsonErrors: 0,
    slotCapMismatches: 0,
    missingModules: 0,
  };

  for (const modName of moduleNames) {
    const modDir = path.join(curriculumDir, modName);
    if (!fs.existsSync(modDir) || !fs.statSync(modDir).isDirectory()) {
      totals.missingModules += 1;
      perModule.push({
        module: modName,
        missing: true,
        mdFiles: 0,
        svgFiles: 0,
        brokenLinks: [],
        orphanSvgs: [],
        animatedSvgs: [],
        tinySvgs: [],
        stage1Placeholders: [],
        jsonErrors: [],
        slotCapMismatches: [],
      });
      continue;
    }

    totals.modulesScanned += 1;
    const mdFiles = collectFilesRecursive(modDir, new Set(['.md']));
    const svgFiles = collectFilesRecursive(modDir, new Set(['.svg']));
    totals.mdFiles += mdFiles.length;
    totals.svgFiles += svgFiles.length;

    const brokenLinks = [];
    const referencedSvgs = new Set(globalSvgRefs);
    const stage1Placeholders = [];
    const jsonErrors = [];
    const slotCapMismatches = [];
    let modJsonBlocks = 0;
    let modJsoncBlocks = 0;
    let modEllipsisSnippets = 0;
    let modAstSpecsChecked = 0;

    for (const mdFile of mdFiles) {
      const relMd = toPosixRel(rootDir, mdFile);
      const mdText = fs.readFileSync(mdFile, 'utf8');

      for (const link of extractRelativeLinks(mdText, mdFile)) {
        if (!link.exists) {
          brokenLinks.push({ file: relMd, line: link.line, target: link.target });
        } else if (link.resolved.toLowerCase().endsWith('.svg')) {
          referencedSvgs.add(path.normalize(link.resolved));
        }
      }

      const masked = maskCodeForMarkdownScan(mdText);
      const placeholderRe = /\[Img\s+\d+[^\]]*\]/gi;
      let pm;
      while ((pm = placeholderRe.exec(masked)) !== null) {
        stage1Placeholders.push({
          file: relMd,
          line: getLineNumberAt(mdText, pm.index),
          text: pm[0],
        });
      }

      const jStats = inspectJsonBlocks(mdText, relMd);
      modJsonBlocks += jStats.jsonBlocks;
      modJsoncBlocks += jStats.jsoncBlocks;
      modEllipsisSnippets += jStats.ellipsisSnippets;
      modAstSpecsChecked += jStats.astSpecsChecked;
      jsonErrors.push(...jStats.jsonErrors);
      slotCapMismatches.push(...jStats.slotCapMismatches);
    }

    const orphanSvgs = [];
    const animatedSvgs = [];
    const tinySvgs = [];

    for (const svgFile of svgFiles) {
      const relSvg = toPosixRel(rootDir, svgFile);
      if (!referencedSvgs.has(path.normalize(svgFile))) {
        orphanSvgs.push(relSvg);
      }
      const svgContent = fs.readFileSync(svgFile, 'utf8');
      const metrics = inspectSvgMetrics(svgContent);
      if (metrics.hasAnimation) {
        animatedSvgs.push(relSvg);
      }
      if (metrics.inkElements > 0 && metrics.inkMaxSpan < 160) {
        tinySvgs.push({
          file: relSvg,
          inkWidth: metrics.inkWidth,
          inkHeight: metrics.inkHeight,
          inkMaxSpan: metrics.inkMaxSpan,
        });
      }
    }

    totals.jsonBlocks += modJsonBlocks;
    totals.jsoncBlocks += modJsoncBlocks;
    totals.ellipsisSnippets += modEllipsisSnippets;
    totals.astSpecsChecked += modAstSpecsChecked;
    totals.brokenLinks += brokenLinks.length;
    totals.orphanSvgs += orphanSvgs.length;
    totals.animatedSvgs += animatedSvgs.length;
    totals.tinySvgs += tinySvgs.length;
    totals.stage1Placeholders += stage1Placeholders.length;
    totals.jsonErrors += jsonErrors.length;
    totals.slotCapMismatches += slotCapMismatches.length;

    perModule.push({
      module: modName,
      missing: false,
      mdFiles: mdFiles.length,
      svgFiles: svgFiles.length,
      jsonBlocks: modJsonBlocks,
      jsoncBlocks: modJsoncBlocks,
      ellipsisSnippets: modEllipsisSnippets,
      astSpecsChecked: modAstSpecsChecked,
      brokenLinks,
      orphanSvgs,
      animatedSvgs,
      tinySvgs,
      stage1Placeholders,
      jsonErrors,
      slotCapMismatches,
    });
  }

  const strictFailureCount =
    totals.missingModules +
    totals.brokenLinks +
    totals.orphanSvgs +
    totals.animatedSvgs +
    totals.tinySvgs +
    totals.stage1Placeholders +
    totals.jsonErrors +
    totals.slotCapMismatches;

  return {
    strictStage2,
    passed: strictStage2 ? strictFailureCount === 0 : totals.missingModules === 0 && totals.jsonErrors === 0,
    totals,
    modules: perModule,
  };
}

function formatTextReport(report) {
  const lines = [
    `Curriculum Docs Audit (${report.strictStage2 ? 'strict-stage2' : 'standard'}) — ${
      report.passed ? 'PASS' : 'FAIL'
    }`,
    `Scanned ${report.totals.modulesScanned} modules, ${report.totals.mdFiles} md files, ${report.totals.svgFiles} svgs`,
    `JSON blocks: ${report.totals.jsonBlocks} strict + ${report.totals.jsoncBlocks} jsonc + ${report.totals.ellipsisSnippets} ellipsis | ASTs checked: ${report.totals.astSpecsChecked}`,
    `Issues: brokenLinks=${report.totals.brokenLinks}, orphanSvgs=${report.totals.orphanSvgs}, animatedSvgs=${report.totals.animatedSvgs}, tinySvgs=${report.totals.tinySvgs}, stage1Placeholders=${report.totals.stage1Placeholders}, jsonErrors=${report.totals.jsonErrors}, slotCapMismatches=${report.totals.slotCapMismatches}`,
  ];

  for (const mod of report.modules) {
    if (mod.missing) {
      lines.push(`  [MISSING] ${mod.module}`);
      continue;
    }
    const issueCount =
      mod.brokenLinks.length +
      mod.orphanSvgs.length +
      mod.animatedSvgs.length +
      mod.tinySvgs.length +
      mod.stage1Placeholders.length +
      mod.jsonErrors.length +
      mod.slotCapMismatches.length;
    const tag = issueCount === 0 ? 'OK' : `ISSUES(${issueCount})`;
    lines.push(
      `  - ${mod.module}: ${tag} (md=${mod.mdFiles}, svg=${mod.svgFiles}, json=${mod.jsonBlocks}+${mod.jsoncBlocks}c)`
    );
    for (const b of mod.brokenLinks) lines.push(`      brokenLink ${b.file}:${b.line} -> ${b.target}`);
    for (const o of mod.orphanSvgs) lines.push(`      orphanSvg ${o}`);
    for (const a of mod.animatedSvgs) lines.push(`      animatedSvg ${a}`);
    for (const t of mod.tinySvgs) {
      lines.push(`      tinySvg ${t.file} (${t.inkWidth}x${t.inkHeight}, maxSpan=${t.inkMaxSpan}px < 160px)`);
    }
    for (const p of mod.stage1Placeholders) lines.push(`      placeholder ${p.file}:${p.line} ${p.text}`);
    for (const j of mod.jsonErrors) lines.push(`      jsonError ${j.file}:${j.line} ${j.error}`);
    for (const s of mod.slotCapMismatches) {
      lines.push(`      slotCapMismatch ${s.file}:${s.line} (${s.totalFlatBlocks} > ${s.slotCap})`);
    }
  }
  return lines.join('\n');
}

function runCli() {
  const args = process.argv.slice(2);
  let strictStage2 = false;
  let jsonOut = false;
  const modules = [];

  for (const arg of args) {
    if (arg === '--strict-stage2') strictStage2 = true;
    else if (arg === '--json') jsonOut = true;
    else if (arg === '-h' || arg === '--help') {
      console.log('Usage: node scripts/curriculum/audit_curriculum_docs.mjs [mod1 mod2 ...] [--strict-stage2] [--json]');
      process.exit(0);
    } else if (!arg.startsWith('--')) {
      modules.push(arg);
    } else {
      console.error(`Unknown flag: ${arg}`);
      process.exit(1);
    }
  }

  const report = auditCurriculumDocs({
    modules: modules.length > 0 ? modules : null,
    strictStage2,
  });

  if (jsonOut) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    console.log(formatTextReport(report));
  }

  if (strictStage2 && !report.passed) {
    process.exit(1);
  }
}

const isCli =
  process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));

if (isCli) {
  runCli();
}
