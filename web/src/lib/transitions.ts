import type { Transition } from 'framer-motion';

/**
 * Standard bottom sheet transition — type: tween (not spring) for perf on low-end.
 * Ease: Material Design standard deceleration curve.
 */
export const sheetTransition: Transition = {
  type: 'tween',
  duration: 0.25,
  ease: [0.4, 0, 0.2, 1],
};
