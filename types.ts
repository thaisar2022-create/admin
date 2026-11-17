export type Mode = 'zoom' | 'video' | 'yangon' | 'mandalay' | 'delivery';

/** Single-level price — on the customer site it is both original and promotion price. */
export interface LevelPrice {
  promo: number;
  original: number;
}

/** One mode's price in courses.prices JSONB. `levels` holds Level 1 / Level 2
 *  prices for live modes (zoom/yangon/mandalay); Video has no levels. */
export interface ModePrice {
  original: number;
  promo: number;
  levels?: { L1?: LevelPrice; L2?: LevelPrice };
}

export interface CourseRow {
  id: string;
  name: string;
  image_url: string | null;
  prices: Record<string, ModePrice>;
}

export interface CatalogRow {
  course_id: string;
  course_code: string;
  mode: string;
  original_price_kyat: number;
  promo_price_kyat: number;
  image_url: string | null;
}

export interface ImageRow {
  course_code: string;
  mode: string;
  image_url: string | null;
}

export interface OrderRow {
  id: string;
  kind: string | null;
  item_id: string | null;
  label: string | null;
  status: string | null;
  total: number | null;
  book_included: boolean | null;
  payment_method: string | null;
  student_name: string | null;
  customer_phone: string | null;
  telegram_username: string | null;
  slip_url: string | null;
  drive_file_url: string | null;
  created_at: string | null;
}

export interface Offering {
  courseId: string;
  courseCode: string;
  courseName: string;
  mode: Mode;
  original: number;
  promo: number;
  imageUrl: string | null;
}

export interface PriceChange {
  at: string;
  courseCode: string;
  mode: string;
  field: 'original' | 'promo' | 'level1' | 'level2';
  oldPrice: number;
  newPrice: number;
}

export interface StudentAgg {
  phone: string;
  name: string;
  telegram: string;
  approvedCount: number;
  totalSpent: number;
  tier: string;
  discountPct: number;
}
