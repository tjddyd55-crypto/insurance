/** Schedule display SSOT, mirrored verbatim in insurance and insurance-mobile.
 * Display categories never change API/filter keys, permissions or navigation.
 */
export const SCHEDULE_ITEM_COLORS = {
  onefc_event: { light: { background: '#dcfce7', foreground: '#166534', border: '#16a34a' }, dark: { background: '#143b28', foreground: '#bbf7d0', border: '#22c55e' } },
  onefc_todo: { light: { background: '#ede9fe', foreground: '#5b21b6', border: '#7c3aed' }, dark: { background: '#30204f', foreground: '#ddd6fe', border: '#a78bfa' } },
  google: { light: { background: '#eff6ff', foreground: '#2563eb', border: '#2563eb' }, dark: { background: '#172d4b', foreground: '#93c5fd', border: '#60a5fa' } },
  customer_alert: { light: { background: '#fff7d6', foreground: '#92400e', border: '#d97706' }, dark: { background: 'rgba(255,187,0,0.14)', foreground: '#fde68a', border: '#fbbf24' } },
  car_expiry: { light: { background: '#dbeafe', foreground: '#1e40af', border: '#1e40af' }, dark: { background: 'rgba(30,58,138,0.5)', foreground: '#bfdbfe', border: '#93c5fd' } },
  insurance_age: { light: { background: '#f1f5f9', foreground: '#6b7280', border: '#9ca3af' }, dark: { background: '#2a313c', foreground: '#9aa5b1', border: '#6b7785' } },
} as const;

export const SCHEDULE_COMPLETED_OPACITY = 0.5;
export type ScheduleColorItem = { source: string; origin?: string; type?: string; status?: string };

export function scheduleItemColorKey(item: ScheduleColorItem): keyof typeof SCHEDULE_ITEM_COLORS {
  if (item.source === 'onefc_todo') return 'onefc_todo';
  if (item.source === 'google_task') return 'google';
  if (item.origin === 'onefc') return 'onefc_event';
  if (item.source === 'google') return 'google';
  return item.type === 'car_expiry' || item.type === 'insurance_age' ? item.type : 'customer_alert';
}

export function scheduleItemAppearance(item: ScheduleColorItem, mode: 'light' | 'dark' = 'light') {
  const done = (item.source === 'onefc_todo' || item.source === 'google_task') && item.status === 'completed';
  return {
    ...SCHEDULE_ITEM_COLORS[scheduleItemColorKey(item)][mode],
    opacity: done ? SCHEDULE_COMPLETED_OPACITY : 1,
    textDecorationLine: done ? 'line-through' as const : 'none' as const,
  };
}

/** CSS adapter keeps the same palette available to all Web view components. */
export function scheduleItemCssVariables(item: ScheduleColorItem) {
  const light = scheduleItemAppearance(item);
  const dark = scheduleItemAppearance(item, 'dark');
  return {
    '--schedule-item-bg-light': light.background,
    '--schedule-item-fg-light': light.foreground,
    '--schedule-item-border-light': light.border,
    '--schedule-item-bg-dark': dark.background,
    '--schedule-item-fg-dark': dark.foreground,
    '--schedule-item-border-dark': dark.border,
    '--schedule-item-opacity': String(light.opacity),
    '--schedule-item-decoration': light.textDecorationLine,
  };
}
