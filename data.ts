import type { Offering } from './types';

/**
 * Fallback catalog — used only when Supabase cannot be reached (e.g. the
 * anon key is not set yet). Prices match the live Supabase course_catalog
 * rows verified 2026-11-15. Supabase data always wins when available.
 */
export const FALLBACK_OFFERINGS: Offering[] = [
  { courseId: 'speaking', courseCode: 'TMM', courseName: 'TMM ထိုင်းစကားပြောသီးသန့်', mode: 'zoom', original: 300000, promo: 250000, imageUrl: null },
  { courseId: 'speaking', courseCode: 'TMM', courseName: 'TMM ထိုင်းစကားပြောသီးသန့်', mode: 'video', original: 150000, promo: 70000, imageUrl: null },
  { courseId: 'speaking', courseCode: 'TMM', courseName: 'TMM ထိုင်းစကားပြောသီးသန့်', mode: 'yangon', original: 400000, promo: 350000, imageUrl: null },
  { courseId: 'speaking', courseCode: 'TMM', courseName: 'TMM ထိုင်းစကားပြောသီးသန့်', mode: 'mandalay', original: 400000, promo: 350000, imageUrl: null },
  { courseId: 'skills', courseCode: 'TLS', courseName: 'TLS Thai Language Special', mode: 'zoom', original: 400000, promo: 350000, imageUrl: null },
  { courseId: 'skills', courseCode: 'TLS', courseName: 'TLS Thai Language Special', mode: 'video', original: 200000, promo: 100000, imageUrl: null },
  { courseId: 'skills', courseCode: 'TLS', courseName: 'TLS Thai Language Special', mode: 'yangon', original: 600000, promo: 500000, imageUrl: null },
  { courseId: 'skills', courseCode: 'TLS', courseName: 'TLS Thai Language Special', mode: 'mandalay', original: 600000, promo: 500000, imageUrl: null },
  { courseId: 'practical-thai', courseCode: 'BOOK', courseName: 'လက်တွေ့အသုံးချ ထိုင်းဘာသာစကားစာအုပ်', mode: 'delivery', original: 150000, promo: 75000, imageUrl: null },
];

export const MODE_LABELS: Record<string, string> = {
  zoom: 'Zoom',
  video: 'Video',
  yangon: 'Yangon',
  mandalay: 'Mandalay',
  delivery: 'Delivery',
};

export const COURSE_META: Record<string, { code: string; name: string; detail: string }> = {
  speaking: { code: 'TMM', name: 'TMM ထိုင်းစကားပြောသီးသန့်', detail: 'Thai Speaking Only · Beginner L1+2 · 20 days' },
  skills: { code: 'TLS', name: 'TLS Thai Language Special', detail: '4 Skills + Grammar · Beginner L1+2 · 50 days' },
  'practical-thai': { code: 'BOOK', name: 'လက်တွေ့အသုံးချ ထိုင်းဘာသာစကားစာအုပ်', detail: 'Practical Thai · Self-study · 11 lessons' },
};

/** Member tiers — discount from the number of APPROVED orders per phone. */
export function tierFor(approvedCount: number): { tier: string; discountPct: number } {
  if (approvedCount >= 5) return { tier: 'Diamond', discountPct: 8 };
  if (approvedCount >= 3) return { tier: 'Gold', discountPct: 5 };
  if (approvedCount >= 1) return { tier: 'Silver', discountPct: 3 };
  return { tier: 'Member', discountPct: 0 };
}

export function formatKyat(n: number | null | undefined): string {
  if (n == null || Number.isNaN(Number(n))) return '—';
  return Number(n).toLocaleString('en-US') + ' Ks';
}
