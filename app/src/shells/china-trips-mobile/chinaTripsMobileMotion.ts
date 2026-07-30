import type { Transition, Variants } from 'motion/react';

/** Shared Motion presets for ChinaTripsMobile — iOS-like, short, springy. */

export const iosSpring: Transition = {
  type: 'spring',
  stiffness: 420,
  damping: 36,
  mass: 0.85,
};

export const iosTween: Transition = {
  duration: 0.28,
  ease: [0.22, 1, 0.36, 1],
};

export const pageVariants: Variants = {
  initial: { opacity: 0, y: 12 },
  animate: {
    opacity: 1,
    y: 0,
    transition: iosTween,
  },
  exit: {
    opacity: 0,
    y: -8,
    transition: { duration: 0.18, ease: 'easeIn' },
  },
};

export const tabPanelVariants: Variants = {
  initial: { opacity: 0, y: 10 },
  animate: {
    opacity: 1,
    y: 0,
    transition: {
      ...iosTween,
      when: 'beforeChildren',
      delayChildren: 0.04,
      staggerChildren: 0.045,
    },
  },
  exit: {
    opacity: 0,
    y: -6,
    transition: { duration: 0.16, ease: 'easeIn' },
  },
};

export const fadeUpItem: Variants = {
  initial: { opacity: 0, y: 14 },
  animate: {
    opacity: 1,
    y: 0,
    transition: iosTween,
  },
};

export const staggerListVariants: Variants = {
  initial: {},
  animate: {
    transition: {
      staggerChildren: 0.04,
      delayChildren: 0.02,
    },
  },
};

export const listRowVariants: Variants = {
  initial: { opacity: 0, y: 10 },
  animate: {
    opacity: 1,
    y: 0,
    transition: iosTween,
  },
};

export const tapScale = { scale: 0.98 };
export const tapScaleSoft = { scale: 0.97 };
