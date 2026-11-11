import { WorkspaceState } from '../../types';
import { CurriculumActivity, createCurriculumBlock } from './types';

function buildLogoWorkspace(types: string[], idPrefix: string): WorkspaceState {
  return {
    MAIN: types.map((type, idx) =>
      createCurriculumBlock(type, undefined, undefined, `${idPrefix}_${idx + 1}`)
    ),
    F1: [],
    F2: [],
    F3: [],
  };
}

/**
 * Module 1 Turtle LOGO creative activities (`1.6`, `1.7`, and Creative Capstone `1B`).
 * All Module 1 LOGO activities run in parameterless mode (`allowActionParams: false`,
 * `allowRepeatBadges: false`): each motion block moves a fixed 50px step or turns 90°.
 */
export const MODULE_1_LOGO_ACTIVITIES: CurriculumActivity[] = [
  {
    id: '1.6',
    moduleId: 'module-1',
    version: 1,
    format: 'sandbox',
    simId: 'turtle',
    icon: '🐢',
    title: 'First Continuous Line Drawings',
    concept: 'Continuous Path Drawing (Fixed Steps & 90° Turns)',
    description:
      'Every Forward and Backward block glides the turtle 50 pixels while its pen leaves an ink trail. Turn Left and Turn Right pivot the turtle 90 degrees in place.',
    hint: 'Try running the starter square, then load a variation card or mix Forward, Backward, and 90° turns to invent your own continuous line art.',
    palette: {
      allowedSimBlocks: [
        'FORWARD',
        'BACKWARD',
        'MOVE_FWD',
        'MOVE_BACK',
        'TURN_LEFT',
        'TURN_RIGHT',
      ],
      allowedControlBlocks: [],
      allowedScopes: ['MAIN'],
      allowRepeatBadges: false,
      allowActionParams: false,
      allowVariables: false,
    },
    starterWorkspace: buildLogoWorkspace(
      [
        'FORWARD',
        'TURN_RIGHT',
        'FORWARD',
        'TURN_RIGHT',
        'FORWARD',
        'TURN_RIGHT',
        'FORWARD',
      ],
      'm1_6_starter'
    ),
    variations: [
      {
        id: '1.6-stairs',
        title: 'Rising Stairs',
        icon: '🪜',
        workspace: buildLogoWorkspace(
          [
            'FORWARD',
            'TURN_RIGHT',
            'FORWARD',
            'TURN_LEFT',
            'FORWARD',
            'TURN_RIGHT',
            'FORWARD',
          ],
          'm1_6_stairs'
        ),
      },
      {
        id: '1.6-plus',
        title: 'Plus Sign',
        icon: '➕',
        workspace: buildLogoWorkspace(
          [
            'FORWARD',
            'BACKWARD',
            'TURN_RIGHT',
            'FORWARD',
            'BACKWARD',
            'TURN_RIGHT',
            'FORWARD',
            'BACKWARD',
            'TURN_RIGHT',
            'FORWARD',
            'BACKWARD',
          ],
          'm1_6_plus'
        ),
      },
      {
        id: '1.6-spiral',
        title: 'Square Spiral',
        icon: '🌀',
        workspace: buildLogoWorkspace(
          [
            'FORWARD',
            'FORWARD',
            'TURN_RIGHT',
            'FORWARD',
            'FORWARD',
            'TURN_RIGHT',
            'FORWARD',
            'FORWARD',
            'TURN_RIGHT',
            'FORWARD',
            'TURN_RIGHT',
            'FORWARD',
          ],
          'm1_6_spiral'
        ),
      },
    ],
  },
  {
    id: '1.7',
    moduleId: 'module-1',
    version: 1,
    format: 'sandbox',
    simId: 'turtle',
    icon: '✒️',
    title: 'Lifting & Lowering the Pen',
    concept: 'State Toggling (Pen Up vs. Pen Down)',
    description:
      'Pen Up lifts the turtle pen so it can travel across the canvas without leaving ink. Pen Down lowers the pen again to start a separate line or shape.',
    hint: 'Use Pen Up before moving across an empty gap, then place Pen Down before drawing your next mark.',
    palette: {
      allowedSimBlocks: [
        'FORWARD',
        'BACKWARD',
        'MOVE_FWD',
        'MOVE_BACK',
        'TURN_LEFT',
        'TURN_RIGHT',
        'PEN_UP',
        'PEN_DOWN',
      ],
      allowedControlBlocks: [],
      allowedScopes: ['MAIN'],
      allowRepeatBadges: false,
      allowActionParams: false,
      allowVariables: false,
    },
    starterWorkspace: buildLogoWorkspace(
      [
        'TURN_RIGHT',
        'FORWARD',
        'PEN_UP',
        'TURN_RIGHT',
        'FORWARD',
        'TURN_RIGHT',
        'PEN_DOWN',
        'FORWARD',
      ],
      'm1_7_starter'
    ),
    variations: [
      {
        id: '1.7-dashes',
        title: 'Three Dashes',
        icon: '➖',
        workspace: buildLogoWorkspace(
          [
            'FORWARD',
            'PEN_UP',
            'FORWARD',
            'PEN_DOWN',
            'FORWARD',
            'PEN_UP',
            'FORWARD',
            'PEN_DOWN',
            'FORWARD',
          ],
          'm1_7_dashes'
        ),
      },
      {
        id: '1.7-window',
        title: 'Post & Window',
        icon: '🪟',
        workspace: buildLogoWorkspace(
          [
            'FORWARD',
            'PEN_UP',
            'TURN_RIGHT',
            'FORWARD',
            'PEN_DOWN',
            'FORWARD',
            'TURN_RIGHT',
            'FORWARD',
            'TURN_RIGHT',
            'FORWARD',
            'TURN_RIGHT',
            'FORWARD',
          ],
          'm1_7_window'
        ),
      },
      {
        id: '1.7-initials',
        title: 'Letters L & I',
        icon: '🔤',
        workspace: buildLogoWorkspace(
          [
            'FORWARD',
            'BACKWARD',
            'BACKWARD',
            'TURN_RIGHT',
            'FORWARD',
            'PEN_UP',
            'FORWARD',
            'TURN_LEFT',
            'PEN_DOWN',
            'FORWARD',
            'FORWARD',
          ],
          'm1_7_initials'
        ),
      },
    ],
  },
  {
    id: '1B',
    moduleId: 'module-1',
    version: 1,
    format: 'capstone',
    capstoneType: 'creative',
    simId: 'turtle',
    icon: '🎨',
    title: 'Postcard Sketch',
    concept: 'Creative Synthesis — Multi-Part Parameterless LOGO Sketch',
    description:
      'Combine fixed steps, 90° turns, Pen Up, and Pen Down to compose a multi-part postcard illustration.',
    hint: 'Load any variation card for inspiration, or remix the starter arch and flagpole into your own postcard scene.',
    palette: {
      allowedSimBlocks: [
        'FORWARD',
        'BACKWARD',
        'MOVE_FWD',
        'MOVE_BACK',
        'TURN_LEFT',
        'TURN_RIGHT',
        'PEN_UP',
        'PEN_DOWN',
      ],
      allowedControlBlocks: [],
      allowedScopes: ['MAIN'],
      allowRepeatBadges: false,
      allowActionParams: false,
      allowVariables: false,
    },
    starterWorkspace: buildLogoWorkspace(
      [
        'FORWARD',
        'TURN_RIGHT',
        'FORWARD',
        'TURN_RIGHT',
        'FORWARD',
        'PEN_UP',
        'TURN_LEFT',
        'FORWARD',
        'TURN_LEFT',
        'PEN_DOWN',
        'FORWARD',
        'FORWARD',
      ],
      'm1_1b_starter'
    ),
    variations: [
      {
        id: '1B-robot-face',
        title: 'Boxy Robot Face',
        icon: '🤖',
        workspace: buildLogoWorkspace(
          [
            'FORWARD',
            'PEN_UP',
            'TURN_RIGHT',
            'FORWARD',
            'TURN_RIGHT',
            'PEN_DOWN',
            'FORWARD',
            'PEN_UP',
            'FORWARD',
            'TURN_RIGHT',
            'PEN_DOWN',
            'FORWARD',
          ],
          'm1_1b_robot_face'
        ),
      },
      {
        id: '1B-photo-frame',
        title: 'Camera Frame',
        icon: '🖼️',
        workspace: buildLogoWorkspace(
          [
            'FORWARD',
            'TURN_RIGHT',
            'FORWARD',
            'PEN_UP',
            'FORWARD',
            'TURN_RIGHT',
            'FORWARD',
            'PEN_DOWN',
            'FORWARD',
            'TURN_RIGHT',
            'FORWARD',
          ],
          'm1_1b_photo_frame'
        ),
      },
      {
        id: '1B-letters-ti',
        title: 'Initials T & I',
        icon: '✉️',
        workspace: buildLogoWorkspace(
          [
            'FORWARD',
            'FORWARD',
            'TURN_LEFT',
            'FORWARD',
            'BACKWARD',
            'BACKWARD',
            'PEN_UP',
            'BACKWARD',
            'TURN_LEFT',
            'PEN_DOWN',
            'FORWARD',
            'FORWARD',
          ],
          'm1_1b_letters_ti'
        ),
      },
    ],
  },
];
