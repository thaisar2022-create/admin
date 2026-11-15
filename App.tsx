import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase, isSupabaseConfigured, STORAGE_BUCKET } from './supabase';
import logoUrl from './logo.png';
import { COURSE_META, FALLBACK_OFFERINGS, MODE_LABELS, formatKyat, tierFor } from './data';
import type { CatalogRow, CourseRow, ImageRow, Offering, OrderRow, PriceChange, StudentAgg } from './types';

type Tab = 'dashboard' | 'orders' | 'students' | 'prices' | 'history';

const BATCH_KEY = 'thaisar-admin-batches';
const HISTORY_KEY = 'thaisar-admin-price-history';

function loadJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function saveJson(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // storage unavailable - ignore
  }
}

function posterKey(o: Offering) {
  return `${o.courseCode}:${o.mode}`;
}

export default function App() {
  const [tab, setTab] = useState<Tab>('dashboard');
  const [offerings, setOfferings] = useState<Offering[]>(FALLBACK_OFFERINGS);
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [courseCovers, setCourseCovers] = useState<Record<string, string | null>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [batches, setBatches] = useState<Record<string, string>>(() => loadJson(BATCH_KEY, {}));
  const [priceHistory, setPriceHistory] = useState<PriceChange[]>(() => loadJson(HISTORY_KEY, []));
  const [priceDrafts, setPriceDrafts] = useState<Record<string, { original: string; promo: string }>>({});
  const [posterUrlDrafts, setPosterUrlDrafts] = useState<Record<string, string>>({});
  const [coverUrlDrafts, setCoverUrlDrafts] = useState<Record<string, string>>({});
  const [newOffering, setNewOffering] = useState({ courseId: 'speaking', mode: 'zoom', original: '', promo: '' });
  const [newCourse, setNewCourse] = useState({ id: '', name: '' });
  const [liveCatalog, setLiveCatalog] = useState(false);

  const loadAll = useCallback(async () => {
    if (!supabase) {
      setOfferings(FALLBACK_OFFERINGS);
      setLiveCatalog(false);
      return;
    }
    setLoading(true);
    setError('');
    try {
      const [coursesRes, catalogRes, imagesRes, ordersRes] = await Promise.all([
        supabase.from('courses').select('id,name,image_url,prices'),
        supabase.from('course_catalog').select('course_id,course_code,mode,original_price_kyat,promo_price_kyat,image_url'),
        supabase.from('course_images').select('course_code,mode,image_url'),
        supabase.from('orders').select('*').order('created_at', { ascending: false }),
      ]);
      const err = coursesRes.error || catalogRes.error || imagesRes.error || ordersRes.error;
      if (err) throw new Error(err.message);
      const courses = (coursesRes.data ?? []) as CourseRow[];
      const catalog = (catalogRes.data ?? []) as CatalogRow[];
      const images = (imagesRes.data ?? []) as ImageRow[];
      const covers: Record<string, string | null> = {};
      const names: Record<string, string> = {};
      for (const c of courses) {
        covers[c.id] = c.image_url;
        names[c.id] = c.name;
      }
      setCourseCovers(covers);
      const modeImages: Record<string, string> = {};
      for (const row of images) {
        if (row.image_url) modeImages[`${String(row.course_code).toUpperCase()}:${row.mode}`] = row.image_url;
      }
      for (const row of catalog) {
        const key = `${row.course_code}:${row.mode}`;
        if (row.image_url && !modeImages[key]) modeImages[key] = row.image_url;
      }
      const merged: Offering[] = catalog.map((row) => ({
        courseId: row.course_id,
        courseCode: row.course_code,
        courseName: names[row.course_id] || COURSE_META[row.course_id]?.name || row.course_id,
        mode: row.mode as Offering['mode'],
        original: row.original_price_kyat,
        promo: row.promo_price_kyat,
        imageUrl: modeImages[`${row.course_code}:${row.mode}`] || null,
      }));
      setOfferings(merged.length > 0 ? merged : FALLBACK_OFFERINGS);
      setLiveCatalog(merged.length > 0);
      setOrders((ordersRes.data ?? []) as OrderRow[]);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setOfferings(FALLBACK_OFFERINGS);
      setLiveCatalog(false);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const refreshOrders = useCallback(async () => {
    if (!supabase) return;
    setLoading(true);
    try {
      const { data, error: err } = await supabase.from('orders').select('*').order('created_at', { ascending: false });
      if (err) throw new Error(err.message);
      setOrders((data ?? []) as OrderRow[]);
      setNotice('Supabase မှ အသစ် order တွေ ဆွဲယူပြီးပြီ။');
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  const stats = useMemo(() => {
    const pending = orders.filter((o) => o.status === 'pending').length;
    const approved = orders.filter((o) => o.status === 'approved').length;
    const rejected = orders.filter((o) => o.status === 'rejected').length;
    const revenue = orders.filter((o) => o.status === 'approved').reduce((s, o) => s + Number(o.total || 0), 0);
    return { pending, approved, rejected, revenue, total: orders.length };
  }, [orders]);

  const students = useMemo<StudentAgg[]>(() => {
    const map = new Map<string, StudentAgg>();
    for (const o of orders) {
      const phone = (o.customer_phone || '—').trim();
      const cur = map.get(phone) || { phone, name: o.student_name || '', telegram: o.telegram_username || '', approvedCount: 0, totalSpent: 0, tier: 'Member', discountPct: 0 };
      if (o.status === 'approved') {
        cur.approvedCount += 1;
        cur.totalSpent += Number(o.total || 0);
      }
      if (!cur.name && o.student_name) cur.name = o.student_name;
      if (!cur.telegram && o.telegram_username) cur.telegram = o.telegram_username;
      map.set(phone, cur);
    }
    return [...map.values()].map((s) => ({ ...s, ...tierFor(s.approvedCount) })).sort((a, b) => b.totalSpent - a.totalSpent);
  }, [orders]);

  const filteredOrders = statusFilter === 'all' ? orders : orders.filter((o) => o.status === statusFilter);

  async function setOrderStatus(order: OrderRow, status: 'approved' | 'rejected' | 'pending') {
    if (!supabase) {
      setError('Supabase မချိတ်ရသေးပါ — .env မှာ anon key ထည့်ပေးပါ။');
      return;
    }
    const { error: err } = await supabase.from('orders').update({ status }).eq('id', order.id);
    if (err) {
      setError(err.message);
      return;
    }
    setOrders((prev) => prev.map((o) => (o.id === order.id ? { ...o, status } : o)));
    setNotice(`Order ${order.id} ကို ${status} အဖြစ် ပြောင်းပြီးပြီ။`);
  }

  function setBatch(key: string, value: string) {
    const next = { ...batches, [key]: value };
    setBatches(next);
    saveJson(BATCH_KEY, next);
  }

  async function savePrice(o: Offering) {
    const draft = priceDrafts[posterKey(o)];
    const original = draft ? Number(draft.original) : o.original;
    const promo = draft ? Number(draft.promo) : o.promo;
    if (!supabase) {
      setError('Supabase မချိတ်ရသေးပါ — .env မှာ anon key ထည့်ပေးပါ။');
      return;
    }
    if (!Number.isFinite(original) || !Number.isFinite(promo) || original <= 0 || promo <= 0) {
      setError('ဈေးနှုန်း မှန်ကန်အောင် ထည့်ပေးပါ။');
      return;
    }
    const { error: err } = await supabase
      .from('course_catalog')
      .update({ original_price_kyat: original, promo_price_kyat: promo })
      .eq('course_id', o.courseId)
      .eq('mode', o.mode);
    if (err) {
      setError(err.message);
      return;
    }
    const { data: courseRows } = await supabase.from('courses').select('prices').eq('id', o.courseId).single();
    const prices = { ...((courseRows as { prices?: Record<string, { original: number; promo: number }> } | null)?.prices || {}) };
    prices[o.mode] = { original, promo };
    await supabase.from('courses').update({ prices }).eq('id', o.courseId);
    const changes: PriceChange[] = [];
    if (original !== o.original) changes.push({ at: new Date().toISOString(), courseCode: o.courseCode, mode: o.mode, field: 'original', oldPrice: o.original, newPrice: original });
    if (promo !== o.promo) changes.push({ at: new Date().toISOString(), courseCode: o.courseCode, mode: o.mode, field: 'promo', oldPrice: o.promo, newPrice: promo });
    if (changes.length > 0) {
      const next = [...changes, ...priceHistory].slice(0, 200);
      setPriceHistory(next);
      saveJson(HISTORY_KEY, next);
    }
    setOfferings((prev) => prev.map((x) => (posterKey(x) === posterKey(o) ? { ...x, original, promo } : x)));
    setPriceDrafts((prev) => {
      const next = { ...prev };
      delete next[posterKey(o)];
      return next;
    });
    setNotice(`${o.courseCode} ${MODE_LABELS[o.mode]} ဈေး သိမ်းပြီးပြီ — customer site မှာ တစ်ခါတည်း ပေါ်မယ်။`);
  }

  async function applyPosterUrl(o: Offering, url: string | null) {
    if (!supabase) {
      setError('Supabase မချိတ်ရသေးပါ — .env မှာ anon key ထည့်ပေးပါ။');
      return;
    }
    const key = `${o.courseCode}:${o.mode}`;
    if (url) {
      const { error: err } = await supabase.from('course_images').upsert({ course_code: key, mode: o.mode, image_url: url });
      if (err) {
        setError(err.message);
        return;
      }
    } else {
      await supabase.from('course_images').update({ image_url: null }).eq('course_code', key);
    }
    await supabase.from('course_catalog').update({ image_url: url }).eq('course_id', o.courseId).eq('mode', o.mode);
    setOfferings((prev) => prev.map((x) => (posterKey(x) === posterKey(o) ? { ...x, imageUrl: url } : x)));
    setNotice(url ? 'Poster သိမ်းပြီးပြီ — customer site မှာ တစ်ခါတည်း ပေါ်မယ်။' : 'Poster ဖျက်ပြီးပြီ။');
  }

  async function uploadPoster(o: Offering, file: File) {
    if (!supabase) {
      setError('Supabase မချိတ်ရသေးပါ — .env မှာ anon key ထည့်ပေးပါ။');
      return;
    }
    const path = `course-posters/${o.courseCode.toLowerCase()}-${o.mode}.jpg`;
    const { error: err } = await supabase.storage.from(STORAGE_BUCKET).upload(path, file, { upsert: true, contentType: file.type || 'image/jpeg' });
    if (err) {
      setError(`Upload မအောင်ပါ: ${err.message} — ပုံ link ကို အောက်က အကွက်မှာ paste လုပ်ပြီး သိမ်းနိုင်ပါတယ်။`);
      return;
    }
    const { data } = supabase.storage.from(STORAGE_BUCKET).getPublicUrl(path);
    await applyPosterUrl(o, data.publicUrl);
  }

  async function applyCourseCover(courseId: string, url: string | null) {
    if (!supabase) {
      setError('Supabase မချိတ်ရသေးပါ — .env မှာ anon key ထည့်ပေးပါ။');
      return;
    }
    const { error: err } = await supabase.from('courses').update({ image_url: url }).eq('id', courseId);
    if (err) {
      setError(err.message);
      return;
    }
    setCourseCovers((prev) => ({ ...prev, [courseId]: url }));
    setNotice(url ? 'Course ပုံ သိမ်းပြီးပြီ။' : 'Course ပုံ ဖျက်ပြီးပြီ။');
  }

  async function uploadCourseCover(courseId: string, file: File) {
    if (!supabase) return;
    const path = `course-covers/${courseId}.jpg`;
    const { error: err } = await supabase.storage.from(STORAGE_BUCKET).upload(path, file, { upsert: true, contentType: file.type || 'image/jpeg' });
    if (err) {
      setError(`Upload မအောင်ပါ: ${err.message}`);
      return;
    }
    const { data } = supabase.storage.from(STORAGE_BUCKET).getPublicUrl(path);
    await applyCourseCover(courseId, data.publicUrl);
  }

  async function addOffering() {
    if (!supabase) {
      setError('Supabase မချိတ်ရသေးပါ။');
      return;
    }
    const original = Number(newOffering.original);
    const promo = Number(newOffering.promo);
    if (!Number.isFinite(original) || !Number.isFinite(promo) || original <= 0 || promo <= 0) {
      setError('ဈေးနှုန်း မှန်ကန်အောင် ထည့်ပေးပါ။');
      return;
    }
    const meta = COURSE_META[newOffering.courseId];
    const { error: err } = await supabase.from('course_catalog').insert({
      course_id: newOffering.courseId,
      course_code: meta?.code || newOffering.courseId,
      mode: newOffering.mode,
      original_price_kyat: original,
      promo_price_kyat: promo,
      image_url: null,
    });
    if (err) {
      setError(err.message);
      return;
    }
    setNewOffering({ courseId: 'speaking', mode: 'zoom', original: '', promo: '' });
    setNotice('Offering အသစ် ထည့်ပြီးပြီ။');
    loadAll();
  }

  async function addCourse() {
    if (!supabase) {
      setError('Supabase မချိတ်ရသေးပါ။');
      return;
    }
    if (!newCourse.id.trim() || !newCourse.name.trim()) {
      setError('Course ID နဲ့ နာမည် ထည့်ပေးပါ။');
      return;
    }
    const { error: err } = await supabase.from('courses').insert({ id: newCourse.id.trim(), name: newCourse.name.trim(), image_url: null, prices: {} });
    if (err) {
      setError(err.message);
      return;
    }
    setNewCourse({ id: '', name: '' });
    setNotice('Course အသစ် ထည့်ပြီးပြီ။');
    loadAll();
  }

  const coursesGrouped = useMemo(() => {
    const groups = new Map<string, Offering[]>();
    for (const o of offerings) {
      const list = groups.get(o.courseId) || [];
      list.push(o);
      groups.set(o.courseId, list);
    }
    return [...groups.entries()];
  }, [offerings]);

  return (
    <div>
      <header>
        <img className="logo" src={logoUrl} alt="Thaisar logo" />
        <div>
          <h1>THAISAR Admin Portal</h1>
          <p>ထိုင်းစာ — Thai Language School · Admin</p>
        </div>
        <div className="motto">တကယ်တတ်ချင်တဲ့သူတိုင်းကို အမှန်တတ်အောင်သင်ပေးတာ “ထိုင်းစာ”</div>
      </header>

      <nav className="tabs">
        <button className={tab === 'dashboard' ? 'active' : ''} onClick={() => setTab('dashboard')}>ဒက်ရှ်ဘုတ်</button>
        <button className={tab === 'orders' ? 'active' : ''} onClick={() => setTab('orders')}>အော်ဒါများ ({orders.length})</button>
        <button className={tab === 'students' ? 'active' : ''} onClick={() => setTab('students')}>ကျောင်းသားများ</button>
        <button className={tab === 'prices' ? 'active' : ''} onClick={() => setTab('prices')}>ဈေးနှုန်းနှင့် ပုံများ</button>
        <button className={tab === 'history' ? 'active' : ''} onClick={() => setTab('history')}>ဈေးပြောင်းလဲမှု မှတ်တမ်း</button>
      </nav>

      <main>
        {!isSupabaseConfigured && (
          <div className="banner">
            <strong>Supabase မချိတ်ရသေးပါ။</strong> .env.example ကို .env အဖြစ် ကူးပြီး
            VITE_SUPABASE_ANON_KEY (publishable key) ထည့်ပေးပါ။ အဲဒီအထိ အောက်က ဈေးနှုန်းတွေက
            fallback စာရင်းပဲ ပြထားတာပါ — order အသစ်တွေ မပေါ်သေးဘူး။
          </div>
        )}
        {liveCatalog && <p className="muted">Supabase မှ live data ဖတ်နေသည် · {offerings.length} offerings · {orders.length} orders</p>}
        {loading && <p className="muted">ဆွဲယူနေသည်…</p>}
        {error && <div className="banner err">{error} <button className="btn ghost small" onClick={() => setError('')}>ပိတ်မယ်</button></div>}
        {notice && <div className="banner">{notice} <button className="btn ghost small" onClick={() => setNotice('')}>ပိတ်မယ်</button></div>}

        {tab === 'dashboard' && (
          <div>
            <div className="stats">
              <div className="stat"><div className="num">{stats.pending}</div><div className="label">စောင့်နေသော order</div></div>
              <div className="stat"><div className="num">{stats.approved}</div><div className="label">အတည်ပြုပြီး</div></div>
              <div className="stat"><div className="num">{stats.rejected}</div><div className="label">ပယ်ချပြီး</div></div>
              <div className="stat"><div className="num">{formatKyat(stats.revenue)}</div><div className="label">အတည်ပြုပြီး စုစုပေါင်း ဝင်ငွေ</div></div>
            </div>
            <div className="card">
              <h2>စောင့်နေသော order များ</h2>
              {orders.filter((o) => o.status === 'pending').length === 0 && <p className="muted">စောင့်နေသော order မရှိပါ။</p>}
              {orders.filter((o) => o.status === 'pending').slice(0, 5).map((o) => (
                <div key={o.id} className="row" style={{ padding: '6px 0', borderBottom: '1px solid var(--line)' }}>
                  <strong>{o.id}</strong><span>{o.label || ''}</span><span>{formatKyat(o.total)}</span>
                  <span className="spacer" />
                  <button className="btn ok small" onClick={() => setOrderStatus(o, 'approved')}>အတည်ပြုမယ်</button>
                  <button className="btn danger small" onClick={() => setOrderStatus(o, 'rejected')}>ပယ်ချမယ်</button>
                </div>
              ))}
              <p><button className="btn ghost" onClick={() => setTab('orders')}>အော်ဒါအားလုံး ကြည့်မယ် →</button></p>
            </div>
          </div>
        )}

        {tab === 'orders' && (
          <div className="card">
            <div className="row">
              <h2 style={{ margin: 0 }}>အော်ဒါများ (Supabase)</h2>
              <span className="spacer" />
              <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                <option value="all">အားလုံး</option>
                <option value="pending">စောင့်နေသည်</option>
                <option value="approved">အတည်ပြုပြီး</option>
                <option value="rejected">ပယ်ချပြီး</option>
              </select>
              <button className="btn" onClick={refreshOrders} disabled={loading || !isSupabaseConfigured}>Supabase မှ အသစ်ဆွဲရန်</button>
            </div>
            <p className="muted">Customer site (registration.thaisar.org) က စာရင်းသွင်းတဲ့ order တွေ — အသစ်ဆုံး အရင်ပြထားသည်။ Approve / Reject လုပ်ရင် Supabase ထဲ တိုက်ရိုက် ပြန်ရေးသည်။</p>
            {filteredOrders.length === 0 && <p className="muted">Order မရှိပါ။</p>}
            <table>
              <thead><tr><th>Order</th><th>ကျောင်းသား</th><th>သင်တန်း</th><th>စုစုပေါင်း</th><th>Status</th><th>လုပ်ဆောင်ချက်</th></tr></thead>
              <tbody>
                {filteredOrders.map((o) => (
                  <tr key={o.id}>
                    <td><strong>{o.id}</strong><br /><span className="muted">{o.created_at ? new Date(o.created_at).toLocaleString() : ''}</span></td>
                    <td>{o.student_name || '—'}<br /><span className="muted">{o.customer_phone || ''} {o.telegram_username || ''}</span></td>
                    <td>{o.label || o.item_id || '—'}<br /><span className="muted">{o.book_included ? 'စာအုပ်ပါတယ် · ' : ''}{o.payment_method || ''}</span><br />
                      {o.slip_url && <a href={o.slip_url} target="_blank" rel="noreferrer">ငွေလွှဲ screenshot</a>}
                      {!o.slip_url && o.drive_file_url && <a href={o.drive_file_url} target="_blank" rel="noreferrer">ငွေလွှဲ screenshot</a>}
                    </td>
                    <td>{formatKyat(o.total)}</td>
                    <td><span className={`pill ${o.status || 'pending'}`}>{o.status || 'pending'}</span></td>
                    <td>
                      <div className="row">
                        {o.status !== 'approved' && <button className="btn ok small" onClick={() => setOrderStatus(o, 'approved')}>အတည်ပြုမယ်</button>}
                        {o.status !== 'rejected' && <button className="btn danger small" onClick={() => setOrderStatus(o, 'rejected')}>ပယ်ချမယ်</button>}
                        {o.status !== 'pending' && <button className="btn ghost small" onClick={() => setOrderStatus(o, 'pending')}>pending ပြန်ထားမယ်</button>}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {tab === 'students' && (
          <div className="card">
            <h2>ကျောင်းသားများ</h2>
            <p className="muted">ဖုန်းနံပါတ်အလိုက် စုထားသည်။ Member tier က အတည်ပြုပြီး order အရေအတွက်အလိုက် တွက်သည် — Member 0% (0), Silver 3% (1), Gold 5% (3), Diamond 8% (5)။</p>
            {students.length === 0 && <p className="muted">ကျောင်းသား မရှိသေးပါ။</p>}
            <table>
              <thead><tr><th>ဖုန်း</th><th>နာမည်</th><th>Telegram</th><th>Tier</th><th>လျှော့ဈေး</th><th>အတည်ပြုပြီး order</th><th>စုစုပေါင်း သုံးငွေ</th></tr></thead>
              <tbody>
                {students.map((s) => (
                  <tr key={s.phone}>
                    <td>{s.phone}</td><td>{s.name || '—'}</td><td>{s.telegram || '—'}</td>
                    <td>{s.tier}</td><td>{s.discountPct}%</td><td>{s.approvedCount}</td><td>{formatKyat(s.totalSpent)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {tab === 'prices' && (
          <div>
            {coursesGrouped.map(([courseId, list]) => (
              <div className="card" key={courseId}>
                <h2>{list[0]?.courseName || courseId}</h2>
                <p className="muted">{COURSE_META[courseId]?.detail || ''}</p>
                <div className="poster-wrap">
                  {courseCovers[courseId] ? <img className="poster" src={courseCovers[courseId] || ''} alt="course cover" /> : <div className="placeholder">Course ပုံ<br />မရှိသေးပါ</div>}
                  <div>
                    <div className="row">
                      <label className="btn ghost small" style={{ cursor: 'pointer' }}>ပုံတင်မယ်
                        <input type="file" accept="image/*" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadCourseCover(courseId, f); }} />
                      </label>
                      <button className="btn danger small" onClick={() => applyCourseCover(courseId, null)} disabled={!courseCovers[courseId]}>ပုံ ဖျက်မယ်</button>
                    </div>
                    <div className="row" style={{ marginTop: 8 }}>
                      <input type="url" placeholder="ပုံ link paste လုပ်ပါ" value={coverUrlDrafts[courseId] || ''} onChange={(e) => setCoverUrlDrafts((p) => ({ ...p, [courseId]: e.target.value }))} style={{ width: 280 }} />
                      <button className="btn small" onClick={() => { const u = (coverUrlDrafts[courseId] || '').trim(); if (u) applyCourseCover(courseId, u); }}>Link နဲ့ သိမ်းမယ်</button>
                    </div>
                  </div>
                </div>
                {list.map((o) => {
                  const key = posterKey(o);
                  const draft = priceDrafts[key] || { original: String(o.original), promo: String(o.promo) };
                  return (
                    <div className="offering" key={key}>
                      <h3>{o.courseCode} · {MODE_LABELS[o.mode] || o.mode}</h3>
                      <div className="poster-wrap">
                        {o.imageUrl ? <img className="poster" src={o.imageUrl} alt="poster" /> : <div className="placeholder">Poster<br />မရှိသေးပါ</div>}
                        <div style={{ flex: 1, minWidth: 260 }}>
                          <div className="row">
                            <label>Original <input type="number" value={draft.original} onChange={(e) => setPriceDrafts((p) => ({ ...p, [key]: { ...draft, original: e.target.value } }))} /></label>
                            <label>Promotion <input type="number" value={draft.promo} onChange={(e) => setPriceDrafts((p) => ({ ...p, [key]: { ...draft, promo: e.target.value } }))} /></label>
                            <button className="btn small" onClick={() => savePrice(o)}>ဈေး သိမ်းမယ်</button>
                          </div>
                          <p className="muted">ကောက်ခံမယ့် ဈေးက Promotion ဈေးပါ။ သိမ်းပြီးရင် customer site မှာ တစ်ခါတည်း ပေါ်မယ်။</p>
                          <div className="row">
                            <label>Batch နံပါတ် <input type="text" placeholder="ဥပမာ Batch 5" value={batches[key] || ''} onChange={(e) => setBatch(key, e.target.value)} style={{ width: 140 }} /></label>
                            <span className="muted">အတန်းချိန် / ဆရာမနာမည် / စတင်ရက်က poster ပုံထဲမှာပဲ ပါတယ် — ဒီမှာ မထည့်ပါ။</span>
                          </div>
                          <div className="row" style={{ marginTop: 8 }}>
                            <label className="btn ghost small" style={{ cursor: 'pointer' }}>Poster တင်မယ်
                              <input type="file" accept="image/*" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadPoster(o, f); }} />
                            </label>
                            <button className="btn danger small" onClick={() => applyPosterUrl(o, null)} disabled={!o.imageUrl}>Poster ဖျက်မယ်</button>
                          </div>
                          <div className="row" style={{ marginTop: 8 }}>
                            <input type="url" placeholder="Poster link paste လုပ်ပါ" value={posterUrlDrafts[key] || ''} onChange={(e) => setPosterUrlDrafts((p) => ({ ...p, [key]: e.target.value }))} style={{ width: 280 }} />
                            <button className="btn small" onClick={() => { const u = (posterUrlDrafts[key] || '').trim(); if (u) applyPosterUrl(o, u); }}>Link နဲ့ သိမ်းမယ်</button>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ))}

            <div className="grid2">
              <div className="card">
                <h2>Offering အသစ် ထည့်ရန်</h2>
                <div className="row">
                  <select value={newOffering.courseId} onChange={(e) => setNewOffering((p) => ({ ...p, courseId: e.target.value }))}>
                    {Object.entries(COURSE_META).map(([id, m]) => <option key={id} value={id}>{m.code} — {m.name}</option>)}
                  </select>
                  <select value={newOffering.mode} onChange={(e) => setNewOffering((p) => ({ ...p, mode: e.target.value }))}>
                    {['zoom', 'video', 'yangon', 'mandalay', 'delivery'].map((m) => <option key={m} value={m}>{MODE_LABELS[m]}</option>)}
                  </select>
                </div>
                <div className="row" style={{ marginTop: 8 }}>
                  <input type="number" placeholder="Original" value={newOffering.original} onChange={(e) => setNewOffering((p) => ({ ...p, original: e.target.value }))} />
                  <input type="number" placeholder="Promotion" value={newOffering.promo} onChange={(e) => setNewOffering((p) => ({ ...p, promo: e.target.value }))} />
                  <button className="btn" onClick={addOffering}>ထည့်မယ်</button>
                </div>
              </div>
              <div className="card">
                <h2>Course အသစ် ထည့်ရန်</h2>
                <div className="row">
                  <input type="text" placeholder="Course ID (ဥပမာ speaking)" value={newCourse.id} onChange={(e) => setNewCourse((p) => ({ ...p, id: e.target.value }))} />
                  <input type="text" placeholder="Course နာမည်" value={newCourse.name} onChange={(e) => setNewCourse((p) => ({ ...p, name: e.target.value }))} />
                  <button className="btn" onClick={addCourse}>ထည့်မယ်</button>
                </div>
              </div>
            </div>
          </div>
        )}

        {tab === 'history' && (
          <div className="card">
            <h2>ဈေးပြောင်းလဲမှု မှတ်တမ်း</h2>
            <p className="muted">ဒီ browser မှာ သိမ်းထားတဲ့ မှတ်တမ်းပါ။</p>
            {priceHistory.length === 0 && <p className="muted">ဈေးပြောင်းလဲမှု မရှိသေးပါ။</p>}
            <table>
              <thead><tr><th>အချိန်</th><th>သင်တန်း</th><th>အမျိုးအစား</th><th>ဈေးအဟောင်း</th><th>ဈေးအသစ်</th></tr></thead>
              <tbody>
                {priceHistory.map((h, i) => (
                  <tr key={i}>
                    <td>{new Date(h.at).toLocaleString()}</td>
                    <td>{h.courseCode} · {MODE_LABELS[h.mode] || h.mode}</td>
                    <td>{h.field === 'original' ? 'Original' : 'Promotion'}</td>
                    <td>{formatKyat(h.oldPrice)}</td>
                    <td>{formatKyat(h.newPrice)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>
      <footer>THAISAR Admin Portal (standalone) · Data: Supabase xqxdcijfyayssdasvpxs · Customer site: registration.thaisar.org</footer>
    </div>
  );
}
