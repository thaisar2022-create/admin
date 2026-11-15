# THAISAR Admin Portal — Standalone

THAISAR (ထိုင်းစာ) Thai Language School အတွက် admin web app — standalone version.
Muse artifact ထဲက Admin Portal ကို download လုပ်လို့ရအောင်၊ GitHub ပေါ် တင်လို့ရအောင်၊
Cloudflare Pages မှာ deploy လုပ်လို့ရအောင် ပြန်ဆောက်ထားတာပါ။
Supabase ကို တိုက်ရိုက် ဖတ်တယ် / ရေးတယ်။

Standalone version of the THAISAR Admin Portal (originally a Muse artifact).
Reads and writes Supabase directly, so it can be downloaded, pushed to GitHub,
or deployed on Cloudflare Pages.

## ဘာတွေ ပါလဲ / Features

- **ဒက်ရှ်ဘုတ် (Dashboard)** — pending / approved / rejected order အရေအတွက်၊ အတည်ပြုပြီး စုစုပေါင်း ဝင်ငွေ။
- **အော်ဒါများ (Orders)** — Supabase `public.orders` က customer order တွေ အသစ်ဆုံး အရင် ပြတယ်။
  Approve / Reject / pending ပြန်ထားတာ Supabase ထဲ တိုက်ရိုက် ပြန်ရေးတယ်။
  **“Supabase မှ အသစ်ဆွဲရန်”** ခလုတ်က အသစ် order တွေ ချက်ချင်း ဆွဲယူပေးတယ်။
  ⚠️ Order အသစ် မှတ်တမ်းတင်တဲ့ form မပါဘူး (ဖျက်ထားတာ) — order တွေက customer site ကနေပဲ ဝင်တယ်။
- **ကျောင်းသားများ (Students)** — ဖုန်းနံပါတ်အလိုက် စုထားတယ်၊ Member tier နဲ့ လျှော့ဈေးပြတယ်။
  Member 0% (0 order) · Silver 3% (1) · Gold 5% (3) · Diamond 8% (5) — အတည်ပြုပြီး order အရေအတွက်အလိုက် တွက်တယ်။
- **ဈေးနှုန်းနှင့် ပုံများ (Prices & Images)** — သင်တန်းတိုင်း / mode တိုင်းမှာ Original Price + Promotion Price
  ပြင်လို့ရတယ် (သိမ်းပြီးရင် customer site registration.thaisar.org မှာ တစ်ခါတည်း ပေါ်မယ်)။
  Course ပုံနဲ့ per-mode poster တင်တာ / link နဲ့ သိမ်းတာ / ဖျက်တာ ရတယ် — poster တွေက
  Supabase Storage (`thaisar-uploads` bucket, `course-posters/`) ထဲ တင်ပြီး URL ကို
  `course_images` + `course_catalog` ထဲ သိမ်းတယ်။
  **Batch နံပါတ်** ပဲ ထပ်ပြီး ပြင်လို့ရတယ်။ အတန်းချိန် / ဆရာမနာမည် / စတင်ရက် ဆိုတဲ့
  data field တွေ လုံးဝ မပါဘူး — အဲဒါတွေက poster ပုံထဲမှာပဲ ပါတယ်။
- **ဈေးပြောင်းလဲမှု မှတ်တမ်း (Price history)** — ဈေးပြောင်းတိုင်း မှတ်တမ်း (ဒီ browser မှာပဲ သိမ်းတယ်)။
- Offering အသစ် / Course အသစ် ထည့်လို့ရတယ်။

## စတင်နည်း / Getting started

```bash
npm install
cp .env.example .env
# .env ထဲမှာ VITE_SUPABASE_ANON_KEY ကို ကိုယ့် Supabase publishable (anon) key နဲ့ ဖြည့်ပါ
npm run dev
```

- `npm run dev` — ဖွံ့ဖြိုးရေး server (http://localhost:5173)
- `npm run build` — production build (`dist/` ထွက်တယ်)
- `npm run preview` — build ပြီးသား `dist/` ကို စမ်းကြည့်တာ

## .env — အရေးကြီးတယ် / Important

```env
VITE_SUPABASE_URL=https://xqxdcijfyayssdasvpxs.supabase.co
VITE_SUPABASE_ANON_KEY=YOUR_PUBLISHABLE_KEY_HERE
```

- Publishable (anon) key ပဲ ထည့်ပါ — Supabase Dashboard → Project Settings → API Keys →
  **Publishable key** ကို ကူးယူပါ။
- **service_role key, Personal Access Token, BOT_TOKEN တို့ကို လုံးဝ မထည့်ပါနဲ့** —
  အဲဒါတွေ ထည့်မိရင် လူတိုင်း data ကို ပြင်လို့ရသွားမယ်။ `.env` က git ထဲ မပါဘူး (`.gitignore` ထဲ ရှိပြီးသား)။
- Key မထည့်ရသေးရင် app က fallback ဈေးနှုန်းတွေပဲ ပြပြီး order တွေ မပေါ်သေးဘူး။

## Cloudflare Pages မှာ deploy လုပ်နည်း

1. ဒီ code ကို GitHub repo အသစ်ထဲ push လုပ်ပါ။
2. Cloudflare Dashboard → Workers & Pages → Create → Pages → Connect to Git:
   repo ကို ရွေးပါ။
3. Build settings:
   - **Framework preset:** Vite
   - **Build command:** `npm run build`
   - **Build output directory:** `dist`
   - **Environment variables:** `VITE_SUPABASE_URL` (= အထက်က URL) နဲ့
     `VITE_SUPABASE_ANON_KEY` (= ကိုယ့် publishable key) ကို Pages → Settings →
     Environment variables ထဲ ထည့်ပါ။
4. Deploy လုပ်ပါ — Pages link တစ်ခု ရမယ်။

## Data — Supabase

- Project: `thaisar2022@gmail.com's Project` (`xqxdcijfyayssdasvpxs`)
- Tables: `public.orders` (enrolments) · `public.courses` (3) · `public.course_catalog` (9)
  · `public.course_images` (5 posters)
- Storage bucket: `thaisar-uploads` (public) — posters `course-posters/<mode>.jpg`
- Poster ရှိပြီးသား: TMM Zoom / Yangon / Mandalay, TLS Zoom / Yangon။
  TLS Mandalay, TMM Video, TLS Video, စာအုပ်ပုံတို့ မရှိသေးဘူး — placeholder ပြတယ်။
- Batch နံပါတ်က Supabase မှာ column မရှိလို့ ဒီ browser ရဲ့ localStorage ထဲမှာပဲ သိမ်းတယ်။
  Browser ပြောင်းရင် batch နံပါတ်တွေ ပြန်ထည့်ရမယ်။

## Tech

Vite + React 19 + TypeScript + @supabase/supabase-js. No backend of its own —
the browser talks to Supabase directly with the publishable key.
