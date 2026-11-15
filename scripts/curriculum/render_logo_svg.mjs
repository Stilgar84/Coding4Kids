#!/usr/bin/env node
/**
 * Deterministic Static SVG Renderer & CLI for Turtle LOGO Course Documentation.
 *
 * Usage:
 *   node scripts/curriculum/render_logo_svg.mjs <input.json|input.pseudo> <output.svg> [--check]
 *   node scripts/curriculum/render_logo_svg.mjs --batch <manifest.json> [--check]
 *   node scripts/curriculum/render_logo_svg.mjs --print-pseudo <input.json>
 *   node scripts/curriculum/render_logo_svg.mjs --print-ast <input.pseudo>
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  DEFAULT_ARC_ANGLE,
  DEFAULT_ARC_RADIUS,
  DEFAULT_STEP_DISTANCE,
  countScopesFlatBlocks,
  executeProgram,
  formatPseudocode,
  normalizeProgramSpec,
  parsePseudocode,
  resolveColorLiteral,
} from './lib/sim_core.mjs';

export const DEFAULT_CANVAS_BOUNDS = { halfWidth: 300, halfHeight: 240 };

function normalizeHeading(degrees) {
  let h = degrees % 360;
  if (h < 0) h += 360;
  return Number(h.toFixed(6));
}

function getArcCenter(x, y, heading, radius, isRight) {
  const startRad = (heading * Math.PI) / 180;
  const normalAngle = isRight ? startRad + Math.PI / 2 : startRad - Math.PI / 2;
  const cx = Number((x + radius * Math.sin(normalAngle)).toFixed(4));
  const cy = Number((y - radius * Math.cos(normalAngle)).toFixed(4));
  return { cx, cy };
}

/**
 * Convert a LOGO ARC segment into a deterministic SVG path string.
 */
export function getArcSvgPath(p) {
  if (
    Math.abs(p.sweepAngle) < 0.0001 ||
    (p.fromX === p.toX && p.fromY === p.toY && Math.abs(p.sweepAngle) < 360)
  ) {
    return `M ${p.fromX} ${p.fromY}`;
  }
  const isRight = p.sweepAngle > 0;
  const sweepFlag = isRight ? 1 : 0;
  const isFullCircle = Math.abs(p.sweepAngle) >= 360;

  if (isFullCircle) {
    const { cx, cy } = getArcCenter(p.fromX, p.fromY, p.startHeading, p.radius, isRight);
    const midX = Number((2 * cx - p.fromX).toFixed(4));
    const midY = Number((2 * cy - p.fromY).toFixed(4));
    return `M ${p.fromX} ${p.fromY} A ${p.radius} ${p.radius} 0 0 ${sweepFlag} ${midX} ${midY} A ${p.radius} ${p.radius} 0 0 ${sweepFlag} ${p.fromX} ${p.fromY}`;
  }

  const largeArcFlag = Math.abs(p.sweepAngle) > 180 ? 1 : 0;
  return `M ${p.fromX} ${p.fromY} A ${p.radius} ${p.radius} 0 ${largeArcFlag} ${sweepFlag} ${p.toX} ${p.toY}`;
}

/**
 * Measure ink-only bounding box across drawn LINE and ARC paths (`scaleWarning < 160px`).
 */
export function measureInkBounds(paths) {
  if (!Array.isArray(paths) || paths.length === 0) {
    return { minX: 0, maxX: 0, minY: 0, maxY: 0, inkWidth: 0, inkHeight: 0, inkMaxSpan: 0 };
  }
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  const expand = (x, y) => {
    if (Number.isFinite(x) && Number.isFinite(y)) {
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
  };
  for (const p of paths) {
    if (p.type === 'LINE') {
      expand(p.fromX, p.fromY);
      expand(p.toX, p.toY);
    } else if (p.type === 'ARC') {
      expand(p.fromX, p.fromY);
      expand(p.toX, p.toY);
      const steps = 16;
      const isRight = p.sweepAngle > 0;
      const { cx, cy } = getArcCenter(p.fromX, p.fromY, p.startHeading, p.radius, isRight);
      for (let i = 1; i < steps; i++) {
        const fraction = i / steps;
        const currentHeading = (p.startHeading + fraction * p.sweepAngle) * (Math.PI / 180);
        const arcNormal = isRight ? currentHeading - Math.PI / 2 : currentHeading + Math.PI / 2;
        expand(cx + p.radius * Math.sin(arcNormal), cy - p.radius * Math.cos(arcNormal));
      }
    }
  }
  if (!Number.isFinite(minX)) {
    return { minX: 0, maxX: 0, minY: 0, maxY: 0, inkWidth: 0, inkHeight: 0, inkMaxSpan: 0 };
  }
  const inkWidth = Math.round(maxX - minX);
  const inkHeight = Math.round(maxY - minY);
  return {
    minX: Math.round(minX),
    maxX: Math.round(maxX),
    minY: Math.round(minY),
    maxY: Math.round(maxY),
    inkWidth,
    inkHeight,
    inkMaxSpan: Math.max(inkWidth, inkHeight),
  };
}

function updateBoundingBox(paths, turtles, canvasBounds, showCanvasBounds) {
  let minX = -100;
  let maxX = 100;
  let minY = -100;
  let maxY = 100;

  for (const t of turtles) {
    minX = Math.min(minX, t.robot.x - 20);
    maxX = Math.max(maxX, t.robot.x + 20);
    minY = Math.min(minY, t.robot.y - 20);
    maxY = Math.max(maxY, t.robot.y + 20);
  }

  if (showCanvasBounds && canvasBounds) {
    minX = Math.min(minX, -canvasBounds.halfWidth);
    maxX = Math.max(maxX, canvasBounds.halfWidth);
    minY = Math.min(minY, -canvasBounds.halfHeight);
    maxY = Math.max(maxY, canvasBounds.halfHeight);
  }

  for (const p of paths) {
    if (p.type === 'LINE') {
      minX = Math.min(minX, p.fromX, p.toX);
      maxX = Math.max(maxX, p.fromX, p.toX);
      minY = Math.min(minY, p.fromY, p.toY);
      maxY = Math.max(maxY, p.fromY, p.toY);
    } else if (p.type === 'ARC') {
      minX = Math.min(minX, p.fromX, p.toX);
      maxX = Math.max(maxX, p.fromX, p.toX);
      const steps = 16;
      const isRight = p.sweepAngle > 0;
      const { cx, cy } = getArcCenter(p.fromX, p.fromY, p.startHeading, p.radius, isRight);
      for (let i = 1; i < steps; i++) {
        const fraction = i / steps;
        const currentHeading = (p.startHeading + fraction * p.sweepAngle) * (Math.PI / 180);
        const arcNormal = isRight ? currentHeading - Math.PI / 2 : currentHeading + Math.PI / 2;
        const px = cx + p.radius * Math.sin(arcNormal);
        const py = cy - p.radius * Math.cos(arcNormal);
        minX = Math.min(minX, px);
        maxX = Math.max(maxX, px);
        minY = Math.min(minY, py);
        maxY = Math.max(maxY, py);
      }
    }
  }

  return {
    minX: Math.round(minX - 40),
    minY: Math.round(minY - 40),
    maxX: Math.round(maxX + 40),
    maxY: Math.round(maxY + 40),
  };
}

function makeTurtleState(basePose = {}, defaultHide = false) {
  return {
    robot: {
      x: Number(basePose.x ?? 0),
      y: Number(basePose.y ?? 0),
      heading: normalizeHeading(Number(basePose.heading ?? 0)),
    },
    penDown: basePose.penDown !== undefined ? Boolean(basePose.penDown) : true,
    penColor: resolveColorLiteral(basePose.penColor ?? 0),
    penWidth: Number(basePose.penWidth ?? 6),
    hideTurtle: Boolean(basePose.hideTurtle ?? defaultHide),
  };
}

/**
 * Simulate a Turtle LOGO program (single or multi-worker, Frame-1 static preview).
 */
export function simulateLogo(rawSpec) {
  const { scopes, source } = normalizeProgramSpec(rawSpec);
  const rawObj = typeof rawSpec === 'object' && rawSpec !== null ? rawSpec : {};
  const canvasBounds = source.canvasBounds ?? rawObj.canvasBounds ?? DEFAULT_CANVAS_BOUNDS;
  const showCanvasBounds = Boolean(source.showCanvasBounds ?? rawObj.showCanvasBounds);
  const hideTurtle = Boolean(source.hideTurtle ?? rawObj.hideTurtle);
  const startPose = source.startPose ?? rawObj.startPose ?? {};
  const pointer = source.pointer ?? rawObj.pointer ?? { x: 0, y: 0, down: false };

  const workerKeys = ['MAIN_1', 'MAIN_2', 'MAIN_3', 'MAIN_4'].filter(
    (k) => Array.isArray(scopes[k]) && scopes[k].length > 0
  );
  const primaryTabs = workerKeys.length > 0 ? workerKeys : ['MAIN'];

  const paths = [];
  const turtles = new Map();
  let forkSeq = 0;

  for (const tabKey of primaryTabs) {
    const customPose = (source.workerPoses && source.workerPoses[tabKey]) || startPose;
    turtles.set(tabKey, makeTurtleState(customPose, hideTurtle));
  }

  const getTurtle = (wId) => {
    if (!turtles.has(wId)) turtles.set(wId, makeTurtleState(startPose, hideTurtle));
    return turtles.get(wId);
  };

  const envHooks = {
    resolveSensor(sensorName, { workerId }) {
      const t = getTurtle(workerId);
      if (sensorName === '$x') return Math.round(t.robot.x);
      if (sensorName === '$y') return Math.round(t.robot.y);
      if (sensorName === '$heading') return Math.round(normalizeHeading(t.robot.heading));
      if (sensorName === '$pointerX') return Number(pointer.x ?? 0);
      if (sensorName === '$pointerY') return Number(pointer.y ?? 0);
      if (sensorName === '$pointerDown') return pointer.down ? 1 : 0;
      return undefined;
    },
    evalSensor(cond, { workerId }) {
      const t = getTurtle(workerId);
      if (cond.sensor === 'insideCanvas') {
        return (
          Math.abs(t.robot.x) <= canvasBounds.halfWidth + 1e-6 &&
          Math.abs(t.robot.y) <= canvasBounds.halfHeight + 1e-6
        );
      }
      if (cond.sensor === '$pointerDown') return Boolean(pointer.down);
      throw new Error(`Unsupported LOGO sensor: ${cond.sensor}`);
    },
    onFork(fnName, nextArgs, { workerId: parentId, depth, execList, tape }) {
      const parent = getTurtle(parentId);
      const forkId = `${parentId}_fork_${++forkSeq}`;
      turtles.set(forkId, {
        robot: { ...parent.robot },
        penDown: parent.penDown,
        penColor: parent.penColor,
        penWidth: parent.penWidth,
        hideTurtle: true, // forked worker fades out on completion; strokes remain
      });
      if (tape && tape.workerHeads) {
        tape.workerHeads[forkId] = tape.workerHeads[parentId] ?? 1;
      }
      const target = scopes[fnName];
      if (!target) throw new Error(`Missing helper scope for FORK: ${fnName}`);
      execList(target, depth + 1, nextArgs, forkId);
    },
    execOp(op, block, { workerId, resolveNumber, resolveColorParam }) {
      const t = getTurtle(workerId);
      const moveForward = (distance) => {
        const rad = (t.robot.heading * Math.PI) / 180;
        const newX = Number((t.robot.x + distance * Math.sin(rad)).toFixed(4));
        const newY = Number((t.robot.y - distance * Math.cos(rad)).toFixed(4));
        if (t.penDown) {
          paths.push({
            type: 'LINE',
            fromX: t.robot.x,
            fromY: t.robot.y,
            toX: newX,
            toY: newY,
            color: t.penColor,
            width: t.penWidth,
          });
        }
        t.robot.x = newX;
        t.robot.y = newY;
      };
      const doArc = (radius, angle, direction) => {
        const isRight = direction === 'RIGHT';
        const sweepAngle = isRight ? angle : -angle;
        const startHeading = t.robot.heading;
        const { cx, cy } = getArcCenter(t.robot.x, t.robot.y, startHeading, radius, isRight);
        const endHeading = normalizeHeading(startHeading + sweepAngle);
        const endRad = (endHeading * Math.PI) / 180;
        const endNormalAngle = isRight ? endRad - Math.PI / 2 : endRad + Math.PI / 2;
        const toX = Number((cx + radius * Math.sin(endNormalAngle)).toFixed(4));
        const toY = Number((cy - radius * Math.cos(endNormalAngle)).toFixed(4));
        if (t.penDown) {
          paths.push({
            type: 'ARC',
            fromX: t.robot.x,
            fromY: t.robot.y,
            toX,
            toY,
            radius,
            startHeading,
            sweepAngle,
            color: t.penColor,
            width: t.penWidth,
          });
        }
        t.robot.x = toX;
        t.robot.y = toY;
        t.robot.heading = endHeading;
      };

      switch (op) {
        case 'FORWARD':
        case 'MOVE_FWD':
          moveForward(resolveNumber(block.length ?? block.distance, DEFAULT_STEP_DISTANCE));
          break;
        case 'BACKWARD':
        case 'MOVE_BACK':
          moveForward(-resolveNumber(block.length ?? block.distance, DEFAULT_STEP_DISTANCE));
          break;
        case 'TURN_LEFT':
          t.robot.heading = normalizeHeading(t.robot.heading - resolveNumber(block.angle, 90));
          break;
        case 'TURN_RIGHT':
          t.robot.heading = normalizeHeading(t.robot.heading + resolveNumber(block.angle, 90));
          break;
        case 'ARC_LEFT':
          doArc(
            resolveNumber(block.radius, DEFAULT_ARC_RADIUS),
            resolveNumber(block.angle, DEFAULT_ARC_ANGLE),
            'LEFT'
          );
          break;
        case 'ARC_RIGHT':
          doArc(
            resolveNumber(block.radius, DEFAULT_ARC_RADIUS),
            resolveNumber(block.angle, DEFAULT_ARC_ANGLE),
            'RIGHT'
          );
          break;
        case 'PEN_UP':
          t.penDown = false;
          break;
        case 'PEN_DOWN':
          t.penDown = true;
          break;
        case 'SET_PEN_COLOR':
          t.penColor = resolveColorParam(block.color);
          break;
        case 'SET_PEN_WIDTH':
          t.penWidth = resolveNumber(block.width, 6);
          break;
        case 'TELEPORT':
          t.robot = {
            x: Number(resolveNumber(block.x, 0).toFixed(4)),
            y: Number(resolveNumber(block.y, 0).toFixed(4)),
            heading: normalizeHeading(resolveNumber(block.heading, 0)),
          };
          break;
        case 'HIDE_TURTLE':
          t.hideTurtle = true;
          break;
        case 'SHOW_TURTLE':
          t.hideTurtle = false;
          break;
        case 'CLEAR_CANVAS':
          paths.length = 0;
          break;
        default:
          throw new Error(`Unsupported LOGO op: ${op}`);
      }
    },
  };

  let sharedRuntime = null;
  for (const tabKey of primaryTabs) {
    const { runtime, execList } = executeProgram({
      scopes,
      initialVars: source.initialVars ?? rawObj.initialVars,
      tape: source.tape ?? rawObj.tape,
      previewInput: source.previewInput ?? rawObj.previewInput ?? 1,
      previewFrame: source.previewFrame ?? rawObj.previewFrame ?? 1,
      fps: source.fps ?? rawObj.fps ?? 10,
      seed: source.seed ?? rawObj.seed ?? 42,
      workerId: tabKey,
      envHooks,
      initialRuntime: sharedRuntime || undefined,
    });
    sharedRuntime = runtime;
    execList(scopes[tabKey] || [], 0, {}, tabKey);
    if (sharedRuntime.status !== 'OK') break;
  }

  const visibleTurtles = primaryTabs
    .map((k) => ({ id: k, ...turtles.get(k) }))
    .filter((t) => !t.hideTurtle);
  const primaryTurtle = turtles.get(primaryTabs[0]);
  const counts = countScopesFlatBlocks(scopes);
  const inkBounds = measureInkBounds(paths);

  return {
    paths,
    primaryTurtle,
    visibleTurtles,
    canvasBounds,
    showCanvasBounds,
    flatBlocksByScope: counts.byScope,
    totalFlatBlocks: counts.total,
    finalPose: primaryTurtle.robot,
    penDown: primaryTurtle.penDown,
    penColor: primaryTurtle.penColor,
    penWidth: primaryTurtle.penWidth,
    pathCount: paths.length,
    stepsExecuted: sharedRuntime?.steps ?? 0,
    status: sharedRuntime?.status ?? 'OK',
    errorDetail: sharedRuntime?.errorDetail ?? null,
    inkBounds,
    scaleWarning: inkBounds.inkMaxSpan > 0 && inkBounds.inkMaxSpan < 160,
  };
}

/**
 * Render static Frame-1 `<svg>` XML (zero `<animate>` tags) plus metrics from a LOGO spec.
 */
export function renderLogoSvg(rawSpec) {
  const sim = simulateLogo(rawSpec);
  const bounds = updateBoundingBox(
    sim.paths,
    sim.visibleTurtles.length > 0 ? sim.visibleTurtles : [sim.primaryTurtle],
    sim.canvasBounds,
    sim.showCanvasBounds
  );
  const minX = bounds.minX;
  const maxX = bounds.maxX;
  const minY = bounds.minY;
  const maxY = bounds.maxY;

  const spanX = Math.max(80, maxX - minX);
  const spanY = Math.max(80, maxY - minY);
  const padding = 20;

  const width = Number((spanX + padding * 2).toFixed(2));
  const height = Number((spanY + padding * 2).toFixed(2));
  const originX = Number((-minX + padding).toFixed(2));
  const originY = Number((-minY + padding).toFixed(2));

  const elements = [
    `<rect width="${width}" height="${height}" fill="#ffffff" rx="8" stroke="#e2e8f0" stroke-width="1" />`,
    `<g transform="translate(${originX}, ${originY})">`,
  ];

  if (sim.showCanvasBounds && sim.canvasBounds) {
    const hw = sim.canvasBounds.halfWidth;
    const hh = sim.canvasBounds.halfHeight;
    elements.push(
      `<rect x="${-hw}" y="${-hh}" width="${hw * 2}" height="${hh * 2}" fill="none" stroke="#cbd5e1" stroke-width="1.5" stroke-dasharray="6 4" rx="4" />`
    );
  }

  elements.push(
    `<line x1="-8" y1="0" x2="8" y2="0" stroke="#cbd5e1" stroke-width="1" stroke-dasharray="2 2" />`,
    `<line x1="0" y1="-8" x2="0" y2="8" stroke="#cbd5e1" stroke-width="1" stroke-dasharray="2 2" />`
  );

  for (const p of sim.paths) {
    if (p.type === 'LINE') {
      elements.push(
        `<line x1="${p.fromX}" y1="${p.fromY}" x2="${p.toX}" y2="${p.toY}" stroke="${
          p.color || '#0f172a'
        }" stroke-width="${p.width || 2}" stroke-linecap="round" />`
      );
    } else if (p.type === 'ARC') {
      const d = getArcSvgPath(p);
      elements.push(
        `<path d="${d}" fill="none" stroke="${p.color || '#0f172a'}" stroke-width="${
          p.width || 2
        }" stroke-linecap="round" />`
      );
    }
  }

  const WORKER_MARKER_FILL = ['#10b981', '#3b82f6', '#8b5cf6', '#f97316'];
  sim.visibleTurtles.forEach((t, idx) => {
    const fill = t.penDown ? WORKER_MARKER_FILL[idx % WORKER_MARKER_FILL.length] : '#d1fae5';
    const dash = t.penDown ? '' : ' stroke-dasharray="2 2"';
    elements.push(
      `<g transform="translate(${t.robot.x}, ${t.robot.y}) rotate(${t.robot.heading})"><polygon points="0,-9 6,6 -6,6" fill="${fill}" stroke="#047857" stroke-width="1.5"${dash} /></g>`
    );
  });

  elements.push('</g>');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">${elements.join(
    ''
  )}</svg>\n`;

  return {
    svg,
    metrics: {
      flatBlocksByScope: sim.flatBlocksByScope,
      totalFlatBlocks: sim.totalFlatBlocks,
      finalPose: sim.finalPose,
      penDown: sim.penDown,
      penColor: sim.penColor,
      penWidth: sim.penWidth,
      pathCount: sim.pathCount,
      stepsExecuted: sim.stepsExecuted,
      status: sim.status,
      errorDetail: sim.errorDetail,
      inkBounds: sim.inkBounds,
      scaleWarning: sim.scaleWarning,
    },
  };
}

function readSpecInput(filePath) {
  const raw = fs.readFileSync(filePath, 'utf8').replace(/^\uFEFF/, '');
  if (filePath.endsWith('.json')) return JSON.parse(raw);
  const trimmed = raw.trim();
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) return JSON.parse(trimmed);
  return trimmed;
}

function runCli() {
  const args = process.argv.slice(2);
  const checkOnly = args.includes('--check');
  const cleanArgs = args.filter((a) => a !== '--check');

  if (cleanArgs[0] === '--print-pseudo' && cleanArgs[1]) {
    const spec = readSpecInput(cleanArgs[1]);
    const { scopes, signatures } = normalizeProgramSpec(spec);
    process.stdout.write(`${formatPseudocode(scopes, signatures)}\n`);
    return;
  }

  if (cleanArgs[0] === '--print-ast' && cleanArgs[1]) {
    const raw = fs.readFileSync(cleanArgs[1], 'utf8').replace(/^\uFEFF/, '');
    const parsed = parsePseudocode(raw);
    process.stdout.write(`${JSON.stringify(parsed, null, 2)}\n`);
    return;
  }

  if (cleanArgs[0] === '--batch' && cleanArgs[1]) {
    const manifestPath = path.resolve(cleanArgs[1]);
    const manifestDir = path.dirname(manifestPath);
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8').replace(/^\uFEFF/, ''));
    const entries = Array.isArray(manifest) ? manifest : manifest.items || [];
    const results = [];
    for (const item of entries) {
      const outPath = path.isAbsolute(item.out)
        ? item.out
        : item.out.startsWith('docs/') && fs.existsSync(path.join(process.cwd(), 'docs'))
        ? path.resolve(process.cwd(), item.out)
        : path.resolve(manifestDir, item.out);
      const { svg, metrics } = renderLogoSvg(item);
      if (!checkOnly) {
        fs.mkdirSync(path.dirname(outPath), { recursive: true });
        fs.writeFileSync(outPath, svg, 'utf8');
      }
      results.push({ out: item.out, ...metrics });
      if (metrics.status !== 'OK') {
        throw new Error(`Render failed for ${item.out}: ${metrics.status} (${metrics.errorDetail})`);
      }
    }
    process.stdout.write(`${JSON.stringify(results, null, 2)}\n`);
    return;
  }

  const [inputPath, outputPath] = cleanArgs;
  if (!inputPath || !outputPath) {
    console.error(
      'Usage:\n' +
        '  node scripts/curriculum/render_logo_svg.mjs <input.json|input.pseudo> <output.svg> [--check]\n' +
        '  node scripts/curriculum/render_logo_svg.mjs --batch <manifest.json> [--check]\n' +
        '  node scripts/curriculum/render_logo_svg.mjs --print-pseudo <input.json>\n' +
        '  node scripts/curriculum/render_logo_svg.mjs --print-ast <input.pseudo>'
    );
    process.exit(1);
  }

  const spec = readSpecInput(inputPath);
  const { svg, metrics } = renderLogoSvg(spec);
  if (!checkOnly) {
    fs.mkdirSync(path.dirname(path.resolve(outputPath)), { recursive: true });
    fs.writeFileSync(outputPath, svg, 'utf8');
  }
  console.log(JSON.stringify({ svgPath: outputPath, ...metrics }));
  if (metrics.status !== 'OK') {
    process.exit(1);
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) {
  runCli();
}
