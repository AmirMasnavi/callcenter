# گزارش‌یار کال‌سنتر علم و صنعت آریا

وب‌اپ فارسی و واکنش‌گرا برای ثبت، بررسی و تحلیل گزارش‌های روزانه کال‌سنتر.

## اجرای سریع با Docker

```bash
cp .env.example .env
# حتماً رمزهای فایل .env را تغییر دهید
docker compose up --build
```

سامانه در `http://localhost:8088` در دسترس است. در اولین ورود از حساب ادمین
تعریف‌شده در `.env` استفاده کنید و رمز را تغییر دهید.

### حساب‌های اولیه Docker

| نقش | نام کاربری | رمز موقت پیش‌فرض |
| --- | --- | --- |
| ادمین | `admin` | `ChangeMe123!` |
| مدیر | `manager` | `Demo12345!` |
| ناظر | `supervisor` | `Demo12345!` |
| اپراتور | `operator` | `Demo12345!` |

نام کاربری `callcenter` فقط متعلق به دیتابیس PostgreSQL است و حساب ورود به
اپلیکیشن نیست. تمام حساب‌های بالا در اولین ورود باید رمز موقت را تغییر دهند.
برای محیط production مقدار `DEMO_USERS_ENABLED=false` و رمزهای امن تنظیم کنید.

## توسعه محلی

پیش‌نیازها: Java 21، Maven، Node 22 و PostgreSQL.

```bash
mvn -pl services/api spring-boot:run
cd apps/web
npm install
npm run dev
```

در این حالت، فرانت‌اند از proxy و API محلی در `http://localhost:8080` استفاده
می‌کند. مقدار پیش‌فرض فایل `apps/web/.env.local` باید خالی بماند:

```dotenv
VITE_API_BASE_URL=
```

## انتشار جداگانهٔ Front-end و Back-end

برای انتشار فرانت‌اند و بک‌اند به‌صورت دو سرویس مجزا (برای نمونه در Render)،
متغیرهای زیر را تنظیم کنید.

### Front-end

در تنظیمات Environment Variables فرانت‌اند:

```dotenv
VITE_API_BASE_URL=https://callcenter-tbb6.onrender.com
```

این مقدار باید URL کامل بک‌اند باشد و اسلش پایانی لازم ندارد.

### Back-end

در تنظیمات Environment Variables بک‌اند:

```dotenv
CORS_ALLOWED_ORIGINS=https://asa-callcenter.onrender.com
COOKIE_SECURE=true
```

`CORS_ALLOWED_ORIGINS` باید دقیقاً URL عمومی فرانت‌اند باشد؛ اگر چند محیط
دارید، آن‌ها را با کاما جدا کنید. `VITE_API_BASE_URL` هنگام build در bundle
فرانت‌اند قرار می‌گیرد؛ پس پس از تغییر آن، فرانت‌اند را دوباره deploy کنید.

### بررسی پیش از انتشار

1. ابتدا بک‌اند را deploy کنید و health check آن را در `/actuator/health` باز کنید.
2. URL بک‌اند را در `VITE_API_BASE_URL` فرانت‌اند بگذارید و فرانت‌اند را deploy کنید.
3. URL فرانت‌اند را در `CORS_ALLOWED_ORIGINS` بک‌اند بگذارید و بک‌اند را redeploy کنید.
4. با یک حساب آزمایشی وارد شوید و ایجاد گزارش، بارگذاری تصویر و خروجی CSV را بررسی کنید.

مستندات OpenAPI در `/api-docs` و health check در `/actuator/health` قرار دارد.

## مدل گزارش

هر اپراتور می‌تواند برای هر تاریخ چند گزارش مستقل و دارای عنوان اختیاری ثبت کند.
پیش‌نویس فقط برای خود اپراتور قابل مشاهده است. گزارش ارسال‌شده تا پیش از تأیید
ناظر توسط اپراتور قابل اصلاح است؛ هر اصلاح ثبت و با optimistic locking محافظت
می‌شود. پس از تأیید، فقط ناظر می‌تواند با ثبت دلیل آن را مجدداً اصلاح کند و
مقدارهای قبل و بعد در تاریخچه باقی می‌مانند.

## پشتیبان‌گیری

از volume دیتابیس به‌صورت زمان‌بندی‌شده با `pg_dump` نسخه پشتیبان تهیه کنید. پیش
از هر ارتقا، backup را در یک دیتابیس آزمایشی restore و صحت آن را بررسی کنید.

## انتشار نسخه آزمایشی

### لینک موقت برای تست سریع

پس از اجرای Docker، می‌توان بدون خرید سرور یک آدرس HTTPS موقت ساخت:

```bash
docker compose up -d --build
cloudflared tunnel --url http://localhost:8088
```

آدرس تصادفی `trycloudflare.com` فقط تا زمانی فعال است که کامپیوتر و فرایند
`cloudflared` روشن باشند. این روش فقط برای تست کوتاه‌مدت و با داده غیرواقعی
مناسب است.

### محیط staging پایدار

برای تست چندروزه، یک VPS لینوکسی کوچک با Docker و یک زیردامنه مانند
`callcenter-test.example.com` پیشنهاد می‌شود:

1. کد را روی سرور clone و Docker Engine و Compose Plugin را نصب کنید.
2. از `.env.example` یک `.env` بسازید و حداقل این موارد را تنظیم کنید:

```dotenv
DB_PASSWORD=یک-رمز-تصادفی-طولانی
ADMIN_PASSWORD=یک-رمز-موقت-قوی
DEMO_USERS_ENABLED=false
COOKIE_SECURE=true
APP_PORT=127.0.0.1:8088
```

3. سرویس را با `docker compose up -d --build` اجرا کنید.
4. با Cloudflare Tunnel یک hostname پایدار را به
   `http://localhost:8088` متصل کنید.
5. با حساب ادمین وارد شوید، رمز را تغییر دهید و حساب‌های محدود تسترها را بسازید.
6. پیش از ورود داده واقعی، backup زمان‌بندی‌شده PostgreSQL و محدودیت دسترسی
   کاربران آزمایشی را فعال کنید.
