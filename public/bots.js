// Shared by the room UI and the authoritative room controller.
export const drivingSchema = 'fronttron-steering-v1';
export const botLimit = 3;
export const difficulties = {
  easy: { label: 'Easy', method: 'Reactive', description: 'Turns away from nearby danger.' },
  normal: {
    label: 'Normal',
    method: 'Planner',
    description: 'Looks ahead to line up gaps and pickups.',
  },
  hard: {
    label: 'Hard',
    method: 'Tactician',
    description: 'Contests open territory and predicts rival paths.',
  },
  mimic: {
    label: 'Mimic',
    method: 'Imitation',
    description: 'Copies steering learned from tactical driving examples.',
  },
  reinforcement: {
    label: 'Apex',
    method: 'Reinforcement learning',
    description: 'Chooses escape routes using a policy trained to win rounds.',
  },
};
