// 30-minute slots, 9:30 AM -> 7:00 PM (19 slots), per the requirements sheet.
export const SLOT_COUNT = 19;
const START_MIN = 9 * 60 + 30;
const fmt = (m) => {
  const h = Math.floor(m / 60), mm = String(m % 60).padStart(2, '0');
  return `${((h + 11) % 12) + 1}:${mm}`;
};
export const SLOTS = Array.from({ length: SLOT_COUNT }, (_, i) => {
  const s = START_MIN + i * 30, e = s + 30;
  const ampm = e / 60 >= 12 && e / 60 < 24 ? 'PM' : 'AM';
  return { index: i, label: `${fmt(s)} - ${fmt(e)} ${ampm}` };
});
export const HOURS_PER_SLOT = 0.5;
