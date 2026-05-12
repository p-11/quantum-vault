import type { OnboardingStep } from './onboarding-screen';

type IllustrationCircle = {
  x: number;
  y: number;
  size: number;
  highlighted?: boolean;
};

// Circle coordinates mirror the Figma onboarding frames
// (360 x 600 popup coordinate space, stroke weight 1).
// Source: Thrya-UI node ids 14:8426 (step 1), 14:9646 (step 2), 14:9671 (step 3).
const circlesByStep: Record<OnboardingStep, readonly IllustrationCircle[]> = {
  'quantum-safe': [
    { x: 83, y: 278, size: 194 },
    { x: 103, y: 298, size: 154 },
    { x: 124, y: 319, size: 112 },
    { x: 142, y: 337, size: 76, highlighted: true }
  ],
  deposit: [
    { x: 83, y: 278, size: 194 },
    { x: 103, y: 278, size: 154 },
    { x: 124, y: 278, size: 112 },
    { x: 142, y: 278, size: 76, highlighted: true }
  ],
  withdrawals: [
    { x: 83, y: 278, size: 194 },
    { x: 103, y: 278, size: 194 },
    { x: 123, y: 278, size: 194 },
    { x: 63, y: 278, size: 194 },
    { x: 43, y: 278, size: 194, highlighted: true }
  ]
};

const viewBoxWidth = 360;
const viewBoxHeight = 600;

// 1.5px matches what Lucide/Heroicons ship for the same aesthetic: a 1px
// Figma stroke aliases visibly at the 12 and 6 o'clock tangent points of a
// circle at standard DPR (too little sub-pixel area for the rasterizer to
// smooth). 1.5 renders as a smooth anti-aliased curve and is visually
// near-identical to 1px in weight.
const circleStrokeWidth = 1.5;

type OnboardingIllustrationProps = {
  step: OnboardingStep;
};

export const OnboardingIllustration = ({
  step
}: OnboardingIllustrationProps) => (
  <svg
    className='pointer-events-none absolute inset-0 h-full w-full'
    viewBox={`0 0 ${viewBoxWidth} ${viewBoxHeight}`}
    preserveAspectRatio='xMidYMid meet'
    shapeRendering='geometricPrecision'
    fill='none'
    aria-hidden='true'
  >
    {circlesByStep[step].map(circle => {
      const radius = circle.size / 2;
      return (
        <circle
          key={`${circle.x}-${circle.y}-${circle.size}`}
          cx={circle.x + radius}
          cy={circle.y + radius}
          r={radius}
          stroke={
            circle.highlighted
              ? 'var(--color-success)'
              : 'var(--color-foreground)'
          }
          strokeWidth={circleStrokeWidth}
        />
      );
    })}
  </svg>
);
