import { CodeBlock } from '../../../types';
import { BinaryReader } from '../binaryReader';
import { BinaryWriter } from '../binaryWriter';
import {
  ENV_ID_SWITCHYARD,
  ENV_VERSION_SWITCHYARD,
  ENV_VERSION_SWITCHYARD_V2,
  OP_SWITCHYARD_SCRAP_ITEM,
  OP_SWITCHYARD_SEND_NEXT,
  OP_SWITCHYARD_SWITCH_LEFT,
  OP_SWITCHYARD_SWITCH_RIGHT,
} from '../types';
import {
  DockExpectedItemSpec,
  DockId,
  DockSpec,
  EXTENDED_COLOR_TO_PALETTE_IDX,
  ITEM_COLOR_FROM_INDEX,
  ITEM_COLOR_FROM_PALETTE_IDX,
  ITEM_COLOR_INDEX,
  ITEM_ICON_FROM_INDEX,
  ITEM_ICON_INDEX,
  ItemColor,
  ItemIcon,
  SwitchState,
  SwitchyardItem,
  SwitchyardScrapRule,
  SwitchyardState,
} from '../../../simulations/switchyard/types';
import { createInitialSwitchyardState } from '../../../simulations/switchyard/physics';

export {
  ENV_ID_SWITCHYARD,
  ENV_VERSION_SWITCHYARD,
  ENV_VERSION_SWITCHYARD_V2,
  OP_SWITCHYARD_SWITCH_LEFT,
  OP_SWITCHYARD_SWITCH_RIGHT,
  OP_SWITCHYARD_SEND_NEXT,
  OP_SWITCHYARD_SCRAP_ITEM,
};

const TARGET_TO_CODE: Record<string, number> = {
  DOCK_A: 1,
  DOCK_B: 2,
  DOCK_C: 3,
  SWITCH_B: 4,
  SCRAP: 5,
};

const CODE_TO_TARGET: Record<number, string | undefined> = {
  0: undefined,
  1: 'DOCK_A',
  2: 'DOCK_B',
  3: 'DOCK_C',
  4: 'SWITCH_B',
  5: 'SCRAP',
};

function isLegacyFourColor(c?: ItemColor): c is 'RED' | 'BLUE' | 'GREEN' | 'YELLOW' {
  return c === 'RED' || c === 'BLUE' || c === 'GREEN' || c === 'YELLOW';
}

/**
 * Returns ENV_VERSION_SWITCHYARD (1) when state fits the lossless v1 wire format,
 * or ENV_VERSION_SWITCHYARD_V2 (2) when v2 capabilities (0-switch, extended colors,
 * targets, scrapRule, quotas, weights, or expectedItems) are present.
 */
export function getSwitchyardSerializationVersion(state?: SwitchyardState): number {
  if (!state) return ENV_VERSION_SWITCHYARD;
  if (state.switches.length === 0) return ENV_VERSION_SWITCHYARD_V2;
  if (state.switches.some((s) => Boolean(s.leftTarget || s.rightTarget))) {
    return ENV_VERSION_SWITCHYARD_V2;
  }
  if ((state.scrapRule && state.scrapRule !== 'damaged_only') || state.scrapExpectedDamagedOnly === false) {
    return ENV_VERSION_SWITCHYARD_V2;
  }
  const items = state.initialQueue ?? state.queue ?? [];
  if (items.some((i) => !isLegacyFourColor(i.color) || i.weight !== undefined)) {
    return ENV_VERSION_SWITCHYARD_V2;
  }
  const specs = state.initialDockSpecs ?? state.docks.map((d) => d.spec);
  if (
    specs.some(
      (sp) =>
        (sp.acceptColor && !isLegacyFourColor(sp.acceptColor)) ||
        sp.quota !== undefined ||
        sp.minWeight !== undefined ||
        sp.maxWeight !== undefined ||
        (sp.expectedItems && sp.expectedItems.length > 0)
    )
  ) {
    return ENV_VERSION_SWITCHYARD_V2;
  }
  return ENV_VERSION_SWITCHYARD;
}

function writeSwitchyardStateV1(writer: BinaryWriter, s: SwitchyardState): void {
  const isTwoSwitches = s.switches.length >= 2;
  const swA = s.switches[0];
  const swB = s.switches[1];

  let flags = 0;
  if (isTwoSwitches) flags |= 0x01;
  if (swA?.initialDirection === 'RIGHT') flags |= 0x02;
  if (swB?.initialDirection === 'RIGHT') flags |= 0x04;
  writer.writeUint8(flags);

  const items = s.initialQueue?.length ? s.initialQueue : s.queue;
  writer.writeVLE(items.length);
  for (const item of items) {
    const colorIdx = isLegacyFourColor(item.color) ? ITEM_COLOR_INDEX[item.color] : 0;
    const iconIdx = ITEM_ICON_INDEX[item.icon] ?? 0;
    const byte = (colorIdx & 0x03) | ((iconIdx & 0x03) << 2) | (item.damaged ? 0x10 : 0);
    writer.writeUint8(byte);
  }

  const dockCount = Math.min(3, Math.max(2, s.docks.length));
  writer.writeUint8(dockCount);
  for (let i = 0; i < dockCount; i++) {
    const spec = s.initialDockSpecs?.[i] ?? s.docks[i]?.spec ?? { dockId: i === 0 ? 'DOCK_A' : i === 1 ? 'DOCK_B' : 'DOCK_C' };
    let dockFlags = 0;
    if (spec.acceptColor) dockFlags |= 0x01;
    if (spec.acceptIcon) dockFlags |= 0x02;
    if (spec.rejectDamaged) dockFlags |= 0x04;
    if (spec.acceptColor && isLegacyFourColor(spec.acceptColor)) {
      dockFlags |= (ITEM_COLOR_INDEX[spec.acceptColor] & 0x03) << 3;
    }
    if (spec.acceptIcon) {
      dockFlags |= (ITEM_ICON_INDEX[spec.acceptIcon] & 0x03) << 5;
    }
    writer.writeUint8(dockFlags);
  }
}

function readSwitchyardStateV1(reader: BinaryReader): SwitchyardState {
  const flags = reader.readUint8();
  const isTwoSwitches = (flags & 0x01) !== 0;
  const dirA = (flags & 0x02) !== 0 ? 'RIGHT' : 'LEFT';
  const dirB = (flags & 0x04) !== 0 ? 'RIGHT' : 'LEFT';

  const switches: SwitchState[] = [
    { id: 'A', direction: dirA, initialDirection: dirA },
    ...(isTwoSwitches ? [{ id: 'B' as const, direction: dirB as 'LEFT' | 'RIGHT', initialDirection: dirB as 'LEFT' | 'RIGHT' }] : []),
  ];

  const queueLen = reader.readVLE();
  const queue: SwitchyardItem[] = [];
  for (let i = 0; i < queueLen; i++) {
    const b = reader.readUint8();
    const color = ITEM_COLOR_FROM_INDEX[b & 0x03] ?? 'RED';
    const icon = ITEM_ICON_FROM_INDEX[(b >> 2) & 0x03] ?? 'CRATE';
    const damaged = (b & 0x10) !== 0;
    queue.push({ id: `c${i + 1}`, color, icon, damaged });
  }

  const dockCount = reader.readUint8();
  const dockIds: Array<Exclude<DockId, 'SCRAP'>> = ['DOCK_A', 'DOCK_B', 'DOCK_C'];
  const dockSpecs: DockSpec[] = [];
  for (let i = 0; i < dockCount; i++) {
    const df = reader.readUint8();
    const hasColor = (df & 0x01) !== 0;
    const hasIcon = (df & 0x02) !== 0;
    const rejectDamaged = (df & 0x04) !== 0;
    const acceptColor = hasColor ? ITEM_COLOR_FROM_INDEX[(df >> 3) & 0x03] : undefined;
    const acceptIcon = hasIcon ? ITEM_ICON_FROM_INDEX[(df >> 5) & 0x03] : undefined;
    dockSpecs.push({
      dockId: dockIds[i] ?? 'DOCK_A',
      ...(acceptColor ? { acceptColor } : {}),
      ...(acceptIcon ? { acceptIcon } : {}),
      rejectDamaged,
    });
  }

  return createInitialSwitchyardState({
    switches,
    initialQueue: queue,
    queue,
    initialDockSpecs: dockSpecs,
  });
}

function writeSwitchyardStateV2(writer: BinaryWriter, s: SwitchyardState): void {
  const switches = s.switches.slice(0, 2);
  writer.writeUint8(switches.length);

  const scrapCode = s.scrapRule === 'any' ? 1 : s.scrapRule === 'none' ? 2 : 0;
  const globalFlags =
    (scrapCode & 0x03) | (s.scrapExpectedDamagedOnly !== false ? 0x04 : 0);
  writer.writeUint8(globalFlags);

  for (const sw of switches) {
    const leftCode = sw.leftTarget ? TARGET_TO_CODE[sw.leftTarget] ?? 0 : 0;
    const rightCode = sw.rightTarget ? TARGET_TO_CODE[sw.rightTarget] ?? 0 : 0;
    const swByte =
      (sw.initialDirection === 'RIGHT' ? 0x01 : 0) |
      ((leftCode & 0x07) << 1) |
      ((rightCode & 0x07) << 4);
    writer.writeUint8(swByte);
  }

  const items = s.initialQueue?.length ? s.initialQueue : s.queue;
  writer.writeVLE(items.length);
  for (const item of items) {
    const paletteIdx = EXTENDED_COLOR_TO_PALETTE_IDX[item.color] ?? 1;
    const iconIdx = ITEM_ICON_INDEX[item.icon] ?? 0;
    const hasWeight = item.weight !== undefined;
    const byte =
      (paletteIdx & 0x0f) |
      ((iconIdx & 0x03) << 4) |
      (item.damaged ? 0x40 : 0) |
      (hasWeight ? 0x80 : 0);
    writer.writeUint8(byte);
    if (hasWeight) {
      writer.writeVLE(Math.max(0, Math.round(item.weight ?? 1)));
    }
  }

  const specs = s.initialDockSpecs?.length ? s.initialDockSpecs : s.docks.map((d) => d.spec);
  writer.writeVLE(specs.length);
  for (const spec of specs) {
    const dockIdx = spec.dockId === 'DOCK_B' ? 1 : spec.dockId === 'DOCK_C' ? 2 : 0;
    const hasColor = Boolean(spec.acceptColor);
    const hasIcon = Boolean(spec.acceptIcon);
    const hasQuota = spec.quota !== undefined;
    const hasWeights = spec.minWeight !== undefined || spec.maxWeight !== undefined;
    const hasExpected = Boolean(spec.expectedItems && spec.expectedItems.length > 0);
    const dockByte =
      (dockIdx & 0x03) |
      (spec.rejectDamaged ? 0x04 : 0) |
      (hasColor ? 0x08 : 0) |
      (hasIcon ? 0x10 : 0) |
      (hasQuota ? 0x20 : 0) |
      (hasWeights ? 0x40 : 0) |
      (hasExpected ? 0x80 : 0);
    writer.writeUint8(dockByte);

    if (hasColor && spec.acceptColor) {
      writer.writeUint8(EXTENDED_COLOR_TO_PALETTE_IDX[spec.acceptColor] ?? 1);
    }
    if (hasIcon && spec.acceptIcon) {
      writer.writeUint8(ITEM_ICON_INDEX[spec.acceptIcon] ?? 0);
    }
    if (hasQuota) {
      writer.writeVLE(Math.max(0, Math.round(spec.quota!)));
    }
    if (hasWeights) {
      writer.writeVLE(spec.minWeight !== undefined ? spec.minWeight + 1 : 0);
      writer.writeVLE(spec.maxWeight !== undefined ? spec.maxWeight + 1 : 0);
    }
    if (hasExpected && spec.expectedItems) {
      writer.writeVLE(spec.expectedItems.length);
      for (const exp of spec.expectedItems) {
        const expFlags =
          (exp.color ? 0x01 : 0) |
          (exp.icon ? 0x02 : 0) |
          (exp.damaged !== undefined ? 0x04 : 0) |
          (exp.damaged ? 0x08 : 0);
        writer.writeUint8(expFlags);
        if (exp.color) writer.writeUint8(EXTENDED_COLOR_TO_PALETTE_IDX[exp.color] ?? 1);
        if (exp.icon) writer.writeUint8(ITEM_ICON_INDEX[exp.icon] ?? 0);
      }
    }
  }
}

function readSwitchyardStateV2(reader: BinaryReader): SwitchyardState {
  const switchCount = Math.min(2, reader.readUint8());
  const globalFlags = reader.readUint8();
  const scrapCode = globalFlags & 0x03;
  const scrapRule: SwitchyardScrapRule =
    scrapCode === 1 ? 'any' : scrapCode === 2 ? 'none' : 'damaged_only';
  const scrapExpectedDamagedOnly = (globalFlags & 0x04) !== 0;

  const switches: SwitchState[] = [];
  for (let i = 0; i < switchCount; i++) {
    const swByte = reader.readUint8();
    const dir = (swByte & 0x01) !== 0 ? 'RIGHT' : 'LEFT';
    const leftTarget = CODE_TO_TARGET[(swByte >> 1) & 0x07];
    const rightTarget = CODE_TO_TARGET[(swByte >> 4) & 0x07];
    switches.push({
      id: i === 0 ? 'A' : 'B',
      direction: dir,
      initialDirection: dir,
      ...(leftTarget ? { leftTarget } : {}),
      ...(rightTarget ? { rightTarget } : {}),
    });
  }

  const queueLen = reader.readVLE();
  const queue: SwitchyardItem[] = [];
  for (let i = 0; i < queueLen; i++) {
    const b = reader.readUint8();
    const color = ITEM_COLOR_FROM_PALETTE_IDX[b & 0x0f] ?? 'RED';
    const icon = ITEM_ICON_FROM_INDEX[(b >> 4) & 0x03] ?? 'CRATE';
    const damaged = (b & 0x40) !== 0;
    const hasWeight = (b & 0x80) !== 0;
    const weight = hasWeight ? reader.readVLE() : undefined;
    queue.push({
      id: `c${i + 1}`,
      color,
      icon,
      damaged,
      ...(weight !== undefined ? { weight } : {}),
    });
  }

  const dockCount = reader.readVLE();
  const dockIds: Array<Exclude<DockId, 'SCRAP'>> = ['DOCK_A', 'DOCK_B', 'DOCK_C'];
  const dockSpecs: DockSpec[] = [];
  for (let i = 0; i < dockCount; i++) {
    const db = reader.readUint8();
    const dockId = dockIds[db & 0x03] ?? 'DOCK_A';
    const rejectDamaged = (db & 0x04) !== 0;
    const hasColor = (db & 0x08) !== 0;
    const hasIcon = (db & 0x10) !== 0;
    const hasQuota = (db & 0x20) !== 0;
    const hasWeights = (db & 0x40) !== 0;
    const hasExpected = (db & 0x80) !== 0;

    const acceptColor = hasColor ? ITEM_COLOR_FROM_PALETTE_IDX[reader.readUint8()] : undefined;
    const acceptIcon: ItemIcon | undefined = hasIcon
      ? ITEM_ICON_FROM_INDEX[reader.readUint8()]
      : undefined;
    const quota = hasQuota ? reader.readVLE() : undefined;
    let minWeight: number | undefined;
    let maxWeight: number | undefined;
    if (hasWeights) {
      const minRaw = reader.readVLE();
      const maxRaw = reader.readVLE();
      minWeight = minRaw > 0 ? minRaw - 1 : undefined;
      maxWeight = maxRaw > 0 ? maxRaw - 1 : undefined;
    }

    let expectedItems: DockExpectedItemSpec[] | undefined;
    if (hasExpected) {
      const expLen = reader.readVLE();
      expectedItems = [];
      for (let k = 0; k < expLen; k++) {
        const ef = reader.readUint8();
        const color = (ef & 0x01) !== 0 ? ITEM_COLOR_FROM_PALETTE_IDX[reader.readUint8()] : undefined;
        const icon = (ef & 0x02) !== 0 ? ITEM_ICON_FROM_INDEX[reader.readUint8()] : undefined;
        const damaged = (ef & 0x04) !== 0 ? (ef & 0x08) !== 0 : undefined;
        expectedItems.push({
          ...(color ? { color } : {}),
          ...(icon ? { icon } : {}),
          ...(damaged !== undefined ? { damaged } : {}),
        });
      }
    }

    dockSpecs.push({
      dockId,
      ...(acceptColor ? { acceptColor } : {}),
      ...(acceptIcon ? { acceptIcon } : {}),
      rejectDamaged,
      ...(quota !== undefined ? { quota } : {}),
      ...(minWeight !== undefined ? { minWeight } : {}),
      ...(maxWeight !== undefined ? { maxWeight } : {}),
      ...(expectedItems ? { expectedItems } : {}),
    });
  }

  return createInitialSwitchyardState({
    switches,
    initialQueue: queue,
    queue,
    initialDockSpecs: dockSpecs,
    scrapRule,
    scrapExpectedDamagedOnly,
  });
}

export function writeSwitchyardState(
  writer: BinaryWriter,
  state?: SwitchyardState,
  version: number = ENV_VERSION_SWITCHYARD
): void {
  const s = state ?? createInitialSwitchyardState();
  if (version >= ENV_VERSION_SWITCHYARD_V2) {
    writeSwitchyardStateV2(writer, s);
    return;
  }
  writeSwitchyardStateV1(writer, s);
}

export function readSwitchyardState(
  reader: BinaryReader,
  version: number = ENV_VERSION_SWITCHYARD
): SwitchyardState {
  if (version >= ENV_VERSION_SWITCHYARD_V2) {
    return readSwitchyardStateV2(reader);
  }
  return readSwitchyardStateV1(reader);
}

export function getSwitchyardOpcodeForBlock(block: CodeBlock): number {
  switch (block.type) {
    case 'SWITCH_LEFT':
      return OP_SWITCHYARD_SWITCH_LEFT;
    case 'SWITCH_RIGHT':
      return OP_SWITCHYARD_SWITCH_RIGHT;
    case 'SEND_NEXT':
      return OP_SWITCHYARD_SEND_NEXT;
    case 'SCRAP_ITEM':
      return OP_SWITCHYARD_SCRAP_ITEM;
    default:
      throw new Error(`Unsupported Switchyard block type: ${block.type}`);
  }
}

export function getSwitchyardParamVarFlags(
  _opcode: number,
  _params?: Record<string, any>
): { param0IsVar: boolean; param1IsVar: boolean } {
  return { param0IsVar: false, param1IsVar: false };
}

export function writeSwitchyardParams(
  writer: BinaryWriter,
  opcode: number,
  params?: Record<string, any>,
  _paramVarMask?: number
): void {
  if (opcode === OP_SWITCHYARD_SWITCH_LEFT || opcode === OP_SWITCHYARD_SWITCH_RIGHT) {
    const junction = String(params?.junction ?? 'A').trim().toUpperCase() === 'B' ? 1 : 0;
    writer.writeUint8(junction);
  }
}

export function readSwitchyardBlock(
  reader: BinaryReader,
  opcode: number,
  _paramVarMask?: number
): { type: CodeBlock['type']; params?: Record<string, any> } {
  switch (opcode) {
    case OP_SWITCHYARD_SWITCH_LEFT: {
      const j = reader.readUint8();
      return { type: 'SWITCH_LEFT', params: { junction: j === 1 ? 'B' : 'A' } };
    }
    case OP_SWITCHYARD_SWITCH_RIGHT: {
      const j = reader.readUint8();
      return { type: 'SWITCH_RIGHT', params: { junction: j === 1 ? 'B' : 'A' } };
    }
    case OP_SWITCHYARD_SEND_NEXT:
      return { type: 'SEND_NEXT' };
    case OP_SWITCHYARD_SCRAP_ITEM:
      return { type: 'SCRAP_ITEM' };
    default:
      throw new Error(`Unsupported Switchyard opcode: 0x${opcode.toString(16)}`);
  }
}
