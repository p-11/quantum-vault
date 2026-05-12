export const statusBadgeKinds = ['safe', 'vulnerable', 'withdrawn'] as const;

export type StatusBadgeKind = (typeof statusBadgeKinds)[number];
