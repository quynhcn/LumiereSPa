"""End-to-end tests for SpaFlow against a real Postgres (RLS) + PostgREST + auth gateway.
Run: python3 test_e2e.py   → prints a result table, screenshots on failure in ./fail/
"""
import json, os, re, sys, time, traceback, datetime as dt, concurrent.futures, urllib.request
import psycopg2
from playwright.sync_api import sync_playwright, expect

BASE = 'http://localhost:3300'
API = 'http://localhost:54321'
ANON = open(os.path.join(os.path.dirname(__file__), 'anon.key')).read().strip()
REF_KEY = 'sb-localhost-auth-token'
TZ = 'Asia/Ho_Chi_Minh'
SVC_BODY = '11111111-0000-0000-0000-000000000001'
SVC_NECK = '11111111-0000-0000-0000-000000000002'
SVC_HEAD = '11111111-0000-0000-0000-000000000004'
LAN = '22222222-0000-0000-0000-000000000001'
PW = 'matkhau123'

os.makedirs('fail', exist_ok=True)
os.makedirs('shots', exist_ok=True)
results = []
console_errors = {}


def sql(q, args=None, fetch=True):
    c = psycopg2.connect(host=os.environ.get('PGHOST', '/var/tmp/pgtest'), port=int(os.environ.get('PGPORT', 5439)), user='postgres', dbname='spa')
    c.autocommit = True
    with c.cursor() as cur:
        cur.execute(q, args)
        out = cur.fetchall() if fetch and cur.description else None
    c.close()
    return out


def day(offset):
    return (dt.datetime.now() + dt.timedelta(days=offset)).strftime('%Y-%m-%d')


TOMORROW, D2, D3 = day(1), day(2), day(3)


def api(method, path, token=None, body=None):
    req = urllib.request.Request(API + path, method=method, data=json.dumps(body).encode() if body is not None else None)
    req.add_header('apikey', ANON)
    req.add_header('Authorization', f'Bearer {token or ANON}')
    req.add_header('Content-Type', 'application/json')
    req.add_header('Prefer', 'return=representation')
    try:
        with urllib.request.urlopen(req) as r:
            txt = r.read().decode()
            return r.status, (json.loads(txt) if txt else None)
    except urllib.error.HTTPError as e:
        txt = e.read().decode()
        return e.code, (json.loads(txt) if txt else None)


def token_for(email):
    s, d = api('POST', '/auth/v1/token?grant_type=password', body={'email': email, 'password': PW})
    return d['access_token']


class T:
    """Test case context manager — records pass/fail and screenshots the page on failure."""
    def __init__(self, tid, name, page=None):
        self.tid, self.name, self.page = tid, name, page

    def __enter__(self):
        return self

    def __exit__(self, et, ev, tb):
        if et is None:
            results.append((self.tid, self.name, 'PASS', ''))
        else:
            msg = f'{et.__name__}: {(str(ev).splitlines() or [""])[0][:220]}'
            results.append((self.tid, self.name, 'FAIL', msg))
            if self.page:
                try:
                    self.page.screenshot(path=f'fail/{self.tid}.png', full_page=True)
                except Exception:
                    pass
        print(f"[{results[-1][2]}] {self.tid} {self.name} {results[-1][3]}", flush=True)
        return True  # keep running other tests


def new_page(browser, name, width=1280, height=900, mobile=False):
    ctx = browser.new_context(viewport={'width': width, 'height': height}, timezone_id=TZ, locale='vi-VN',
                              is_mobile=mobile, has_touch=mobile)
    page = ctx.new_page()
    page.set_default_timeout(10000)
    errs = console_errors.setdefault(name, [])
    page.on('console', lambda m: errs.append(m.text[:200]) if m.type == 'error' else None)
    page.on('pageerror', lambda e: errs.append('PAGEERROR ' + str(e)[:200]))
    return ctx, page


def toast(page, text):
    expect(page.locator('[data-sonner-toast]').filter(has_text=text).first).to_be_visible()


def login(page, email, password=PW, path='/sign-in'):
    page.goto(BASE + path)
    page.fill('#sign-in-email', email)
    page.fill('#sign-in-password', password)
    page.click('form button[type=submit]')


def signup(page, name, phone, email, password=PW):
    page.goto(BASE + '/signup')
    page.fill('#su-name', name)
    page.fill('#su-phone', phone)
    page.fill('#su-email', email)
    page.fill('#su-password', password)
    page.click('form button[type=submit]')


def pick_date(page, key):
    page.fill('#booking-date', key)


def slot_buttons(page):
    page.wait_for_selector('text=Khung giờ còn trống')
    page.wait_for_function("!document.body.innerText.includes('Đang tìm khung giờ')")
    return [t.strip() for t in page.locator('div.grid button').all_inner_texts() if re.fullmatch(r'\d\d:\d\d', t.strip())]


def run():
    with sync_playwright() as p:
        b = p.chromium.launch()

        # ── Setup accounts: admin + staff (Lan) + unlinked staff ─────────────
        for email in ('admin@spa.vn', 'lan.staff@spa.vn', 'nolink@spa.vn'):
            api('POST', '/auth/v1/signup', body={'email': email, 'password': PW, 'data': {'name': email.split('@')[0], 'phone': '0900000000'}})
        sql("update profiles set role='admin' where email='admin@spa.vn'", fetch=False)
        sql("update profiles set role='staff', staff_id=%s where email='lan.staff@spa.vn'", (LAN,), fetch=False)
        sql("update profiles set role='staff' where email='nolink@spa.vn'", fetch=False)

        # ════════════════ GUEST ════════════════
        ctx, g = new_page(b, 'guest')
        with T('G1', 'Trang chủ SSR hiển thị 4 dịch vụ + CTA', g):
            g.goto(BASE + '/')
            expect(g.locator('#dich-vu a[href^="/booking?service="]')).to_have_count(4)
            expect(g.get_by_role('link', name='Đặt lịch ngay').first).to_be_visible()
        with T('G2', 'Bấm dịch vụ khi chưa đăng nhập → vào thẳng bước chọn nhân viên (không bắt đăng nhập)', g):
            g.locator(f'a[href="/booking?service={SVC_BODY}"]').click()
            expect(g.get_by_role('heading', name='Chọn nhân viên')).to_be_visible()
            expect(g.get_by_text('Vui lòng đăng nhập')).to_have_count(0)
        with T('G3', 'Khách vãng lai vào /admin, /staff, /account bị chặn', g):
            for path in ('/admin', '/staff', '/account', '/admin/customers'):
                g.goto(BASE + path)
                expect(g.get_by_text('Vui lòng đăng nhập')).to_be_visible()
                assert g.locator('text=Tổng quan').count() == 0 or path != '/admin'
        with T('G4', 'Sai mật khẩu → báo lỗi tiếng Việt', g):
            login(g, 'admin@spa.vn', 'sai-mat-khau')
            toast(g, 'Email hoặc mật khẩu không đúng')
        with T('G5', 'API anon: không đọc được khách/lịch hẹn/profile, không đặt lịch được', None):
            s, d = api('GET', '/rest/v1/customers?select=*'); assert d == [], d
            s, d = api('GET', '/rest/v1/appointments?select=*'); assert d == [], d
            s, d = api('GET', '/rest/v1/profiles?select=*'); assert s in (401, 403) or d == [], (s, d)
            s, d = api('POST', '/rest/v1/services', body={'name': 'hack', 'duration_min': 10, 'price': 1})
            assert s in (401, 403), (s, d)
            s, d = api('POST', '/rest/v1/rpc/book_appointment', body={'p_service_id': SVC_BODY, 'p_staff_id': None, 'p_date': TOMORROW, 'p_time': '10:00', 'p_name': 'x', 'p_phone': '0901234567', 'p_email': '', 'p_notes': ''})
            assert s in (401, 403, 400, 404), (s, d)
            s, d = api('POST', '/rest/v1/rpc/get_available_slots', body={'p_service_id': SVC_BODY, 'p_staff_id': None, 'p_date': TOMORROW})
            assert s == 200 and len(d) > 5, (s, d)
        with T('G6', 'Landing: dải ưu đãi, mục Ưu đãi/Gói/Quà tặng, Đội ngũ, JSON-LD DaySpa, robots & sitemap', g):
            g.goto(BASE + '/')
            expect(g.get_by_text(re.compile('Giảm 10%.*lần đặt lịch online đầu tiên'))).to_be_visible()
            expect(g.locator('#uu-dai').get_by_text('Gói 5 buổi massage body')).to_be_visible()
            expect(g.locator('#uu-dai').get_by_text('Thẻ quà tặng', exact=True)).to_be_visible()
            expect(g.locator('#doi-ngu').get_by_text('Nguyễn Thu Lan')).to_be_visible()
            expect(g.locator('#doi-ngu').get_by_text('Cổ vai gáy').first).to_be_visible()
            ld = json.loads(g.locator('script[type="application/ld+json"]').inner_text())
            assert ld['@type'] == 'DaySpa' and len(ld['hasOfferCatalog']['itemListElement']) == 4 and 'aggregateRating' not in ld, ld
            assert 'Disallow: /admin' in g.request.get(BASE + '/robots.txt').text()
            assert '<loc>' in g.request.get(BASE + '/sitemap.xml').text()
            assert 'zalo.me' in (g.locator('#lien-he').get_by_role('link', name=re.compile('Zalo')).get_attribute('href') or '')
        with T('G7', 'Khách chưa đăng nhập để lại SĐT ở mục Liên hệ → lưu vào leads', g):
            g.goto(BASE + '/#lien-he')
            g.fill('#contact-lead-name', 'Ngọc Hân'); g.fill('#contact-lead-phone', '0977 111 222')
            g.select_option('#contact-lead-interest', 'Thẻ quà tặng')
            g.fill('#contact-lead-note', 'Gọi sau 18h')
            g.get_by_role('button', name='Gọi lại cho tôi').click()
            expect(g.get_by_text('Cảm ơn Hân!')).to_be_visible()
            assert sql("select name, interest, note, status from leads") == [('Ngọc Hân', 'Thẻ quà tặng', 'Gọi sau 18h', 'new')]
        with T('G8', 'Nút "Đặt lịch với Lan" → trang đặt lịch nhớ kỹ thuật viên', g):
            g.goto(BASE + '/')
            href = g.locator('#doi-ngu').get_by_role('link', name=re.compile('Đặt lịch với Lan')).get_attribute('href')
            assert href == f'/booking?staff={LAN}', href
        with T('G10', 'Giữ chỗ 10 phút: người giữ vẫn thấy giờ, người khác không; nhả giữ chỗ → trống lại', None):
            h1, h2 = '00000000-0000-4000-8000-0000000000a1', '00000000-0000-4000-8000-0000000000b2'
            st, d = api('POST', '/rest/v1/rpc/hold_slot', body={'p_service_id': SVC_NECK, 'p_staff_id': LAN, 'p_date': day(6), 'p_time': '10:00', 'p_holder': h1})
            assert st == 200 and d[0]['staff_id'] == LAN, (st, d)
            sees = lambda h: any(x['slot_time'] == '10:00' for x in api('POST', '/rest/v1/rpc/get_available_slots', body={'p_service_id': SVC_NECK, 'p_staff_id': LAN, 'p_date': day(6), 'p_holder': h})[1])
            assert sees(h1) and not sees(h2)
            api('POST', '/rest/v1/rpc/release_hold', body={'p_holder': h1})
            assert sees(h2)
        ctx.close()

        # ── Guest books with SMS code (no account yet) ──
        ctx, gx = new_page(b, 'guest-otp')
        with T('G9', 'Khách mới đặt lịch không cần tài khoản: chọn giờ (được giữ chỗ) → SĐT → mã SMS sai báo lỗi → mã đúng → đặt xong, giảm 10%', gx):
            gx.goto(f'{BASE}/booking?service={SVC_NECK}')
            gx.get_by_role('button', name=re.compile('Bất kỳ nhân viên')).click()
            gx.get_by_role('button', name='Tiếp tục').click()
            pick_date(gx, D3); slot_buttons(gx)
            gx.locator('div.grid button', has_text='11:00').first.click()
            gx.get_by_role('button', name='Tiếp tục').click()
            expect(gx.locator('aside').get_by_text(re.compile('Đang giữ chỗ cho bạn đến'))).to_be_visible()
            assert sql("select count(*) from slot_holds where expires_at > now()")[0][0] == 1
            expect(gx.locator('aside').get_by_text(re.compile('Khách mới được giảm 10%'))).to_be_visible()
            gx.fill('#bk-name', 'Phạm Khách Mới'); gx.fill('#bk-phone', '0933 444 555')
            gx.locator('aside').get_by_role('button', name='Gửi mã xác minh SMS').click()
            expect(gx.locator('#bk-otp')).to_be_visible()
            gx.fill('#bk-otp', '000000')
            gx.locator('aside').get_by_role('button', name='Xác minh & đặt lịch').click()
            toast(gx, 'Mã xác minh không đúng')
            gx.fill('#bk-otp', '123456')
            gx.locator('aside').get_by_role('button', name='Xác minh & đặt lịch').click()
            expect(gx.get_by_role('heading', name='Đặt lịch thành công')).to_be_visible()
            r = sql("""select c.name, a.price, a.discount_reason, a.source, u.phone_confirmed_at is not null
                     from appointments a join customers c on c.id=a.customer_id join auth.users u on u.id=c.user_id where u.phone='84933444555'""")
            assert r == [('Phạm Khách Mới', 225000, 'first_visit', 'online', True)], r
            assert sql("select count(*) from slot_holds")[0][0] == 0
            gx.goto(BASE + '/account')
            expect(gx.get_by_role('heading', name='Phạm Khách Mới')).to_be_visible()
        ctx.close()
        ctx, gy = new_page(b, 'guest-phone-login')
        with T('G11', 'Đăng nhập bằng số điện thoại + mã SMS (khách đã đặt bằng SĐT)', gy):
            gy.goto(BASE + '/sign-in')
            gy.get_by_role('tab', name='Số điện thoại').click()
            gy.fill('#sign-in-phone', '0933444555')
            gy.get_by_role('button', name='Gửi mã qua SMS').click()
            gy.fill('#sign-in-otp', '123456')
            gy.get_by_role('button', name='Xác minh & đăng nhập').click()
            toast(gy, 'Đăng nhập thành công')
            gy.goto(BASE + '/account')
            expect(gy.get_by_role('heading', name='Phạm Khách Mới')).to_be_visible()
        ctx.close()

        # ════════════════ CUSTOMER A ════════════════
        ctx, a = new_page(b, 'customerA')
        with T('C1', 'Đăng ký: SĐT sai / mật khẩu ngắn bị chặn', a):
            signup(a, 'Khách A', '123', 'khacha@test.vn')
            toast(a, 'Số điện thoại không hợp lệ')
            a.fill('#su-phone', '0901 111 111'); a.fill('#su-password', '123'); a.click('form button[type=submit]')
            toast(a, 'Mật khẩu phải có ít nhất 8 ký tự')
        with T('C2', 'Đăng ký thành công → /account, trigger tạo customer gắn user_id', a):
            a.fill('#su-password', PW); a.click('form button[type=submit]')
            a.wait_for_url('**/account')
            expect(a.get_by_role('heading', name='Khách A')).to_be_visible()
            rows = sql("select c.name, c.phone from customers c join auth.users u on u.id=c.user_id where u.email='khacha@test.vn'")
            assert rows == [('Khách A', '0901 111 111')], rows
        with T('C3', 'Khách vào /admin, /staff bị chuyển về /account', a):
            a.goto(BASE + '/admin'); a.wait_for_url('**/account')
            a.goto(BASE + '/staff'); a.wait_for_url('**/account')
        with T('C4', 'Đặt lịch đầy đủ: chọn nhân viên cụ thể (Lan) 10:00 ngày mai', a):
            a.goto(f'{BASE}/booking?service={SVC_BODY}')
            expect(a.get_by_role('heading', name='Chọn nhân viên')).to_be_visible()
            a.get_by_role('button', name=re.compile('Nguyễn Thu Lan')).click()
            a.get_by_role('button', name='Tiếp tục').click()
            pick_date(a, TOMORROW)
            slots = slot_buttons(a)
            assert '10:00' in slots and '12:00' not in slots and '11:30' not in slots, slots
            a.locator('div.grid button', has_text='10:00').first.click()
            a.get_by_role('button', name='Tiếp tục').click()
            expect(a.locator('#bk-name')).to_have_value('Khách A')
            expect(a.locator('#bk-phone')).to_have_value('0901 111 111')
            expect(a.locator('aside').get_by_text(re.compile('Ưu đãi lần đầu'))).to_be_visible()
            a.locator('aside').get_by_role('button', name='Xác nhận đặt lịch').click()
            expect(a.get_by_role('heading', name='Đặt lịch thành công')).to_be_visible()
            expect(a.locator('dd', has_text='Nguyễn Thu Lan')).to_be_visible()
            expect(a.get_by_text('405.000')).to_be_visible()
            r = sql("select a.price, a.list_price, a.discount_amount, a.status, s.name, to_char(a.start_time at time zone 'Asia/Ho_Chi_Minh','YYYY-MM-DD HH24:MI') from appointments a join staff s on s.id=a.staff_id join customers c on c.id=a.customer_id join auth.users u on u.id=c.user_id where u.email='khacha@test.vn'")
            assert r == [(405000, 450000, 45000, 'confirmed', 'Nguyễn Thu Lan', f'{TOMORROW} 10:00')], r
        with T('C5', 'Slot 10:00 của Lan biến mất; "Bất kỳ" vẫn còn 10:00 (2 người khác rảnh)', a):
            s, d = api('POST', '/rest/v1/rpc/get_available_slots', body={'p_service_id': SVC_BODY, 'p_staff_id': LAN, 'p_date': TOMORROW})
            assert '10:00' not in [x['slot_time'] for x in d] and '09:30' not in [x['slot_time'] for x in d], d[:4]
            s, d = api('POST', '/rest/v1/rpc/get_available_slots', body={'p_service_id': SVC_BODY, 'p_staff_id': None, 'p_date': TOMORROW})
            ten = [x for x in d if x['slot_time'] == '10:00'][0]
            assert ten['staff_count'] == 2, ten
        with T('C6', '"Bất kỳ nhân viên" 10:00 → được xếp cho người rảnh (không phải Lan)', a):
            a.get_by_role('button', name='Đặt lịch mới').click()
            a.get_by_role('button', name=re.compile('Massage body thư giãn')).click()
            a.get_by_role('button', name='Tiếp tục').click()
            a.get_by_role('button', name=re.compile('Bất kỳ nhân viên')).click()
            a.get_by_role('button', name='Tiếp tục').click()
            pick_date(a, TOMORROW); slot_buttons(a)
            a.locator('div.grid button', has_text='10:00').first.click()
            a.get_by_role('button', name='Tiếp tục').click()
            a.locator('aside').get_by_role('button', name='Xác nhận đặt lịch').click()
            expect(a.get_by_role('heading', name='Đặt lịch thành công')).to_be_visible()
            staff_shown = a.locator('dd').nth(1).inner_text()
            assert staff_shown in ('Trần Ngọc Mai', 'Lê Minh Hòa'), staff_shown
        with T('C7', 'Đặt nhanh bằng câu nói: "Chiều mai 3 giờ massage cổ vai gáy, nhẹ tay"', a):
            a.goto(BASE + '/booking')
            a.get_by_role('button', name=re.compile('Đặt nhanh bằng một câu')).click()
            a.fill('textarea', 'Chiều mai 3 giờ massage cổ vai gáy, nhẹ tay')
            a.get_by_role('button', name='Phân tích').click()
            expect(a.get_by_text('Massage cổ vai gáy').first).to_be_visible()
            a.get_by_role('button', name='Dùng thông tin này').click()
            expect(a.get_by_role('heading', name='Thông tin của bạn')).to_be_visible()
            expect(a.locator('#bk-notes')).to_have_value(re.compile('nhẹ tay'))
            aside = a.locator('aside')
            expect(aside.locator('dd', has_text='15:00')).to_be_visible()
            aside.get_by_role('button', name='Xác nhận đặt lịch').click()
            expect(a.get_by_role('heading', name='Đặt lịch thành công')).to_be_visible()
            r = sql("select a.price, a.notes, to_char(a.start_time at time zone 'Asia/Ho_Chi_Minh','YYYY-MM-DD HH24:MI') from appointments a join customers c on c.id=a.customer_id join auth.users u on u.id=c.user_id where u.email='khacha@test.vn' and a.service_id=%s", (SVC_NECK,))
            assert r == [(250000, 'Thích nhẹ tay', f'{TOMORROW} 15:00')], r
        with T('C8', 'Câu nói với giờ nghỉ trưa (12h) → quay lại bước chọn giờ + gợi ý giờ gần nhất', a):
            a.goto(BASE + '/booking')
            a.get_by_role('button', name=re.compile('Đặt nhanh bằng một câu')).click()
            a.fill('textarea', 'mai 12 giờ trưa massage body')
            a.get_by_role('button', name='Phân tích').click()
            a.get_by_role('button', name='Dùng thông tin này').click()
            expect(a.get_by_role('heading', name='Chọn ngày và giờ')).to_be_visible()
            expect(a.get_by_text('12:00 không còn trống')).to_be_visible()
        with T('C9', 'Trang tài khoản: 3 lịch sắp tới, sửa hồ sơ (SĐT sai bị chặn, đúng thì lưu)', a):
            a.goto(BASE + '/account')
            expect(a.get_by_text('Massage cổ vai gáy').first).to_be_visible()
            a.get_by_role('button', name='Sửa hồ sơ').click()
            a.fill('#p-phone', 'abc'); a.get_by_role('button', name='Lưu').click()
            toast(a, 'số điện thoại hợp lệ')
            a.fill('#p-phone', '0901111112'); a.get_by_role('button', name='Lưu').click()
            toast(a, 'Đã cập nhật')
            assert sql("select phone from customers where name='Khách A'") == [('0901111112',)]
        with T('C17', 'Khách tự hủy lịch (còn >2 tiếng) từ trang Tài khoản; <2 tiếng hoặc lịch người khác bị chặn', a):
            tok = token_for('khacha@test.vn')
            st, d = api('POST', '/rest/v1/rpc/book_appointment', tok, {'p_service_id': SVC_BODY, 'p_staff_id': None, 'p_date': D3, 'p_time': '11:00', 'p_name': 'Khách A', 'p_phone': '0901111112', 'p_email': '', 'p_notes': ''})
            assert st == 200, d
            code = d[0]['booking_code']
            a.goto(BASE + '/account')
            row = a.locator('div.rounded-xl', has_text=code)
            row.get_by_role('button', name='Hủy lịch').click()
            a.get_by_role('alertdialog').get_by_role('button', name='Hủy lịch').click()
            toast(a, 'Đã hủy lịch hẹn')
            assert sql("select status::text from appointments where booking_code=%s", (code,)) == [('cancelled',)]
            soon = sql("""insert into appointments (customer_id, staff_id, service_id, start_time, end_time, price, duration_min)
                select c.id, %s, %s, now() + interval '1 hour', now() + interval '2 hours', 450000, 60
                from customers c join auth.users u on u.id=c.user_id where u.email='khacha@test.vn' returning id::text""", (LAN, SVC_BODY))[0][0]
            st, d = api('POST', '/rest/v1/rpc/cancel_my_appointment', tok, {'p_id': soon})
            assert 'TOO_LATE' in json.dumps(d), d
            a.goto(BASE + '/account')
            expect(a.get_by_role('button', name='Hủy lịch').first).to_be_visible()  # other upcoming bookings stay cancellable
            sql("delete from appointments where id=%s", (soon,), fetch=False)
        with T('C19', 'Đánh giá: lịch hoàn thành → nút "Đánh giá buổi hẹn" → 5 sao + nhận xét → hiện trong đánh giá công khai', a):
            apt = sql("""update appointments set status='completed' where id = (select a.id from appointments a join customers c on c.id=a.customer_id
                        join auth.users u on u.id=c.user_id where u.email='khacha@test.vn' and a.service_id=%s and a.status='confirmed' order by a.start_time limit 1) returning id::text""", (SVC_NECK,))
            assert apt, 'no appointment to complete'
            a.goto(BASE + '/account')
            a.get_by_role('button', name='Đánh giá buổi hẹn').first.click()
            a.get_by_role('radio', name='5 sao').click()
            a.get_by_label('Nhận xét').fill('Kỹ thuật viên nhẹ tay, phòng rất thơm.')
            a.get_by_role('button', name='Gửi đánh giá').click()
            toast(a, 'Cảm ơn bạn đã đánh giá')
            try:
                expect(a.get_by_text(re.compile('^Bạn đã đánh giá'))).to_be_visible()
                st, d = api('POST', '/rest/v1/rpc/get_public_reviews', body={'p_limit': 5})
                assert d and d[0]['author'] == 'A' and d[0]['rating'] == 5 and 'phone' not in d[0], d
            finally:
                sql("update appointments set status='confirmed' where id=%s", (apt[0][0],), fetch=False)
        with T('C20', 'Khách cũ (đã có lịch) đăng nhập → không còn dải "Giảm 10% lần đầu" trên trang chủ', a):
            a.goto(BASE + '/')
            expect(a.get_by_role('link', name='Đặt lịch ngay').first).to_be_visible()
            a.wait_for_timeout(800)
            expect(a.get_by_label('Ẩn thông báo ưu đãi')).to_have_count(0)
        with T('C21', 'Khách tự đổi giờ: "Đổi giờ" → chọn ngày/giờ mới → giữ mã, ghi lịch sử; đổi tối đa 2 lần', a):
            a.goto(BASE + '/account')
            a.get_by_role('button', name='Đổi giờ').last.click()
            dlg = a.get_by_role('dialog')
            dlg.locator('#rs-date').fill(day(6))
            dlg.get_by_role('group', name='Giờ còn trống').get_by_role('button').first.click()
            dlg.get_by_role('button', name=re.compile('^Đổi sang')).click()
            toast(a, 'Đã đổi sang')
            r = sql("""select to_char(a.start_time at time zone 'Asia/Ho_Chi_Minh','YYYY-MM-DD'), a.reminded_at, l.note from appointments a
                     join appointment_logs l on l.appointment_id=a.id and l.note is not null where a.reschedule_count=1""")
            assert len(r) == 1 and r[0][0] == day(6) and r[0][1] is None and r[0][2].startswith('Đổi giờ:'), r
        with T('C22', 'Quà lần sau: lịch "Hoàn thành" tự tặng mã giảm 10%/30 ngày → hiện ở Tài khoản → dùng khi đặt', a):
            code, pct, days = sql("""select g.code, g.percent_off, g.expires_at - current_date from gift_cards g join customers c on c.id=g.customer_id
                                   join auth.users u on u.id=c.user_id where u.email='khacha@test.vn' and g.kind='percent'""")[0]
            assert (pct, days) == (10, 30), (pct, days)
            a.goto(BASE + '/account')
            expect(a.get_by_role('heading', name=re.compile('Quà & ưu đãi của bạn'))).to_be_visible()
            assert a.get_by_role('link', name='Đặt lịch dùng mã').get_attribute('href') == f'/booking?gift={code}'
            a.goto(f'{BASE}/booking?service={SVC_NECK}&gift={code}')
            a.get_by_role('button', name=re.compile('Bất kỳ nhân viên')).click()
            a.get_by_role('button', name='Tiếp tục').click()
            pick_date(a, day(7)); slot_buttons(a)
            a.locator('div.grid button', has_text='10:00').first.click()
            a.get_by_role('button', name='Tiếp tục').click()
            expect(a.locator('aside').get_by_text('Mã quay lại (−10%)')).to_be_visible()
            a.locator('aside').get_by_role('button', name='Xác nhận đặt lịch').click()
            expect(a.get_by_role('heading', name='Đặt lịch thành công')).to_be_visible()
            assert sql("select a.price, a.discount_reason from appointments a join gift_cards g on g.id=a.gift_card_id where g.code=%s", (code,)) == [(225000, 'return_visit')]
            assert sql("select sessions_left from gift_cards where code=%s", (code,)) == [(0,)]
        tokA = token_for('khacha@test.vn')
        with T('C10', 'API khách: không tự nâng quyền, không ghi trực tiếp lịch/dịch vụ, chỉ thấy dữ liệu mình', None):
            uid = sql("select id::text from auth.users where email='khacha@test.vn'")[0][0]
            api('PATCH', f'/rest/v1/profiles?id=eq.{uid}', tokA, {'role': 'admin'})
            assert sql("select role from profiles where id=%s", (uid,)) == [('customer',)]
            s, d = api('PATCH', '/rest/v1/services?id=neq.00000000-0000-0000-0000-000000000000', tokA, {'price': 0})
            assert sql("select min(price) from services")[0][0] > 0
            s, d = api('POST', '/rest/v1/appointments', tokA, {'customer_id': sql("select id::text from customers where user_id=%s", (uid,))[0][0], 'staff_id': LAN, 'service_id': SVC_BODY, 'start_time': f'{D2}T10:00:00+07:00', 'end_time': f'{D2}T11:00:00+07:00', 'price': 0, 'duration_min': 60})
            assert s in (401, 403), (s, d)
            s, d = api('GET', '/rest/v1/customers?select=id', tokA); assert len(d) == 1, d
            s, d = api('GET', '/rest/v1/appointment_logs?select=*', tokA); assert d == [], d
            s, d = api('DELETE', '/rest/v1/staff?id=eq.' + LAN, tokA)
            assert sql("select count(*) from staff where id=%s", (LAN,))[0][0] == 1
        with T('C11', 'Chuyển hướng an toàn: ?redirect=//evil.com bị bỏ qua', None):
            c2, p2 = new_page(b, 'redirect')
            login(p2, 'khacha@test.vn', path='/sign-in?redirect=//evil.com')
            p2.wait_for_url('**/account')
            c2.close()
        with T('C12', 'Đăng xuất từ header → về trang chủ, hiện nút Đăng nhập', a):
            a.goto(BASE + '/account')
            a.locator('header').get_by_role('button', name=re.compile('^Tài khoản của')).click()
            a.get_by_role('menuitem', name='Đăng xuất').click()
            a.wait_for_url(BASE + '/')
            expect(a.locator('header').get_by_role('button', name=re.compile('Đăng nhập')).first).to_be_visible()
        with T('H1', 'Header: khách → [Đăng nhập][Đặt lịch]; đăng nhập → avatar menu, không còn link Tài khoản/Đăng xuất rời', a):
            a.goto(BASE + '/')
            hdr = a.locator('header')
            expect(hdr.get_by_role('button', name='Đăng nhập')).to_be_visible()
            login(a, 'khacha@test.vn'); a.wait_for_url('**/account')
            a.goto(BASE + '/')
            btn = hdr.get_by_role('button', name=re.compile('^Tài khoản của'))
            expect(btn).to_be_visible()
            assert hdr.get_by_role('button', name=re.compile('Đăng xuất')).count() == 0
            assert hdr.get_by_role('link', name=re.compile('^Tài khoản$')).count() == 0
            # nav links must not be covered by the right-hand slot at 1280px
            lh = hdr.get_by_role('link', name='Liên hệ').bounding_box()
            assert lh['x'] + lh['width'] < btn.bounding_box()['x'], (lh, btn.bounding_box())
            btn.click()
            expect(a.get_by_role('menuitem', name=re.compile('Lịch hẹn & tài khoản'))).to_be_visible()
            a.keyboard.press('Escape')
            expect(a.get_by_role('menu')).to_have_count(0)
        ctx.close()

        # ════════════════ CUSTOMER B + RACE ════════════════
        ctx, bb = new_page(b, 'customerB')
        with T('C13', 'Khách B đăng ký, đăng nhập từ link dịch vụ → quay về đúng bước chọn nhân viên', bb):
            signup(bb, 'Khách B', '0902222222', 'khachb@test.vn'); bb.wait_for_url('**/account')
            bb.locator('header').get_by_role('button', name=re.compile('^Tài khoản của')).click()
            bb.get_by_role('menuitem', name='Đăng xuất').click(); bb.wait_for_url(BASE + '/')
            bb.goto(f'{BASE}/sign-in?redirect=' + urllib.request.quote(f'/booking?service={SVC_BODY}', safe=''))
            bb.fill('#sign-in-email', 'khachb@test.vn'); bb.fill('#sign-in-password', PW); bb.click('form button[type=submit]')
            expect(bb.get_by_role('heading', name='Chọn nhân viên')).to_be_visible()
        with T('C14', 'B không thấy lịch hẹn của A', None):
            s, d = api('GET', '/rest/v1/appointments?select=id', token_for('khachb@test.vn')); assert d == [], d
        with T('C15', 'Race: A và B cùng đặt Lan 14:00 ngày kia cùng lúc → chỉ 1 thành công', None):
            ta, tb = token_for('khacha@test.vn'), token_for('khachb@test.vn')
            body = lambda n, ph: {'p_service_id': SVC_BODY, 'p_staff_id': LAN, 'p_date': D2, 'p_time': '14:00', 'p_name': n, 'p_phone': ph, 'p_email': '', 'p_notes': ''}
            with concurrent.futures.ThreadPoolExecutor(2) as ex:
                f1 = ex.submit(api, 'POST', '/rest/v1/rpc/book_appointment', ta, body('Khách A', '0901111112'))
                f2 = ex.submit(api, 'POST', '/rest/v1/rpc/book_appointment', tb, body('Khách B', '0902222222'))
                outs = [f1.result(), f2.result()]
            ok = [o for o in outs if o[0] == 200]
            bad = [o for o in outs if o[0] != 200]
            assert len(ok) == 1 and 'SLOT_UNAVAILABLE' in json.dumps(bad[0][1]), outs
        with T('C16', 'UI: đặt đúng slot vừa bị lấy → toast lỗi + quay lại chọn giờ', bb):
            # B's page still on staff step for body massage; pick Lan, D2, but 14:00 now taken → emulate stale page by opening slots then booking it via API first
            bb.get_by_role('button', name=re.compile('Nguyễn Thu Lan')).click()
            bb.get_by_role('button', name='Tiếp tục').click()
            pick_date(bb, D2); slots = slot_buttons(bb)
            assert '14:00' not in slots, slots
            bb.locator('div.grid button', has_text='16:00').first.click()
            api('POST', '/rest/v1/rpc/book_appointment', token_for('khacha@test.vn'), {'p_service_id': SVC_BODY, 'p_staff_id': LAN, 'p_date': D2, 'p_time': '16:00', 'p_name': 'Khách A', 'p_phone': '0901111112', 'p_email': '', 'p_notes': ''})
            bb.get_by_role('button', name='Tiếp tục').click()
            bb.locator('aside').get_by_role('button', name='Xác nhận đặt lịch').click()
            toast(bb, 'vừa có người đặt')
            expect(bb.get_by_role('heading', name='Chọn ngày và giờ')).to_be_visible()
        with T('C18', 'Thẻ quà tặng: nhập mã khi đặt lịch → trừ tiền, số dư thẻ giảm; mã sai báo lỗi', bb):
            sql("insert into gift_cards (code, kind, initial_value, balance) values ('SFTEST100', 'value', 100000, 100000)", fetch=False)
            bb.goto(f'{BASE}/booking?service={SVC_NECK}')
            bb.get_by_role('button', name=re.compile('Bất kỳ nhân viên')).click()
            bb.get_by_role('button', name='Tiếp tục').click()
            pick_date(bb, D3); slot_buttons(bb)
            bb.locator('div.grid button', has_text='13:00').first.click()
            bb.get_by_role('button', name='Tiếp tục').click()
            bb.fill('#bk-gift', 'SAIMA'); bb.get_by_role('button', name='Áp dụng').click()
            expect(bb.get_by_text('Mã quà tặng không tồn tại.')).to_be_visible()
            bb.fill('#bk-gift', 'sftest100'); bb.get_by_role('button', name='Áp dụng').click()
            expect(bb.locator('aside').get_by_text('Thẻ quà tặng')).to_be_visible()
            bb.locator('aside').get_by_role('button', name='Xác nhận đặt lịch').click()
            expect(bb.get_by_role('heading', name='Đặt lịch thành công')).to_be_visible()
            r = sql("select a.list_price, a.discount_amount, a.gift_amount, a.price from appointments a join gift_cards g on g.id=a.gift_card_id where g.code='SFTEST100'")
            assert len(r) == 1 and r[0][0] == 250000 and r[0][2] == 100000 and r[0][3] == 250000 - r[0][1], r  # price = list − first-visit discount; 100k of it prepaid by card
            assert sql("select balance from gift_cards where code='SFTEST100'") == [(0,)]
        with T('C23', 'Khách bỏ hẹn ≥ 2 lần tự đặt → lịch "Chờ xác nhận" + thông báo spa sẽ gọi', bb):
            ids = [r[0] for r in sql("""insert into appointments (customer_id, staff_id, service_id, start_time, end_time, status, price, duration_min)
                select c.id, %s, %s, now() - (n || ' days')::interval, now() - (n || ' days')::interval + interval '30 min', 'no_show', 250000, 30
                from customers c join auth.users u on u.id=c.user_id, generate_series(3, 4) n where u.email='khachb@test.vn' returning id::text""", (LAN, SVC_NECK))]
            assert len(ids) == 2, ids
            try:
                bb.goto(f'{BASE}/booking?service={SVC_HEAD}')
                bb.get_by_role('button', name=re.compile('Bất kỳ nhân viên')).click()
                bb.get_by_role('button', name='Tiếp tục').click()
                pick_date(bb, day(8)); slot_buttons(bb)
                bb.locator('div.grid button', has_text='15:00').first.click()
                bb.get_by_role('button', name='Tiếp tục').click()
                bb.locator('aside').get_by_role('button', name='Xác nhận đặt lịch').click()
                expect(bb.get_by_role('heading', name=re.compile('chờ xác nhận'))).to_be_visible()
                expect(bb.get_by_text(re.compile('Spa đã nhận lịch và sẽ gọi cho bạn'))).to_be_visible()
                assert sql("select status::text from appointments where start_time = %s::timestamp at time zone 'Asia/Ho_Chi_Minh'", (f'{day(8)} 15:00',)) == [('pending',)]
            finally:
                sql("delete from appointments where id = any(%s::uuid[])", (ids,), fetch=False)
        ctx.close()

        # ════════════════ MOBILE CUSTOMER ════════════════
        ctx, m = new_page(b, 'mobile', 390, 844, mobile=True)
        with T('M1', 'Mobile: mở menu → Đăng nhập mở dialog (không biến mất)', m):
            m.goto(BASE + '/')
            m.get_by_role('button', name='Mở menu').click()
            m.get_by_role('button', name='Đăng nhập').click()
            expect(m.get_by_role('dialog')).to_be_visible()
            m.fill('#login-dialog-email', 'khachb@test.vn'); m.fill('#login-dialog-password', PW)
            m.get_by_role('dialog').locator('button[type=submit]').click()
            m.wait_for_url('**/account')
        with T('M2', 'Mobile: đặt lịch hoàn chỉnh, nút xác nhận nằm trong khối tóm tắt dưới form', m):
            m.goto(f'{BASE}/booking?service={SVC_NECK}')
            m.get_by_role('button', name=re.compile('Bất kỳ nhân viên')).click()
            m.get_by_role('button', name='Tiếp tục').click()
            pick_date(m, D3); slot_buttons(m)
            m.locator('div.grid button', has_text='09:00').first.click()
            m.get_by_role('button', name='Tiếp tục').click()
            btn = m.get_by_role('button', name='Xác nhận đặt lịch').locator('visible=true')
            btn.first.click()
            expect(m.get_by_role('heading', name='Đặt lịch thành công')).to_be_visible()
        ctx.close()

        # ════════════════ STAFF ════════════════
        ctx, s = new_page(b, 'staff')
        with T('S1', 'Nhân viên đăng nhập → /staff, chỉ thấy lịch của mình', s):
            login(s, 'lan.staff@spa.vn'); s.wait_for_url('**/staff')
            expect(s.get_by_role('heading', name='Nguyễn Thu Lan')).to_be_visible()
            tok = token_for('lan.staff@spa.vn')
            st, d = api('GET', '/rest/v1/appointments?select=staff_id', tok)
            assert d and all(x['staff_id'] == LAN for x in d), d
        with T('S2', 'Chuyển sang ngày mai, check-in lịch 10:00 → log ghi email nhân viên', s):
            s.locator('button:has(svg.lucide-chevron-right)').first.click()
            card = s.locator('div.rounded-xl', has_text='Khách A').filter(has_text='10:00').first
            expect(card).to_be_visible()
            card.get_by_role('button', name='Check-in', exact=True).click()
            toast(s, 'Đã chuyển sang')
            r = sql("select l.old_status::text, l.new_status::text, l.changed_by from appointment_logs l join appointments a on a.id=l.appointment_id where a.staff_id=%s", (LAN,))
            assert ('confirmed', 'checked_in', 'lan.staff@spa.vn') in r, r
        with T('S6', 'Nhân viên: lịch tương lai không có nút "Khách không đến"; hủy phải xác nhận', s):
            before = sql("select count(*) from appointments where staff_id=%s and status='cancelled'", (LAN,))[0][0]
            card = s.locator('div.rounded-xl', has_text='Khách A').filter(has_text='10:00').first
            assert card.get_by_role('button', name='Khách không đến').count() == 0
            card.get_by_role('button', name='Hủy lịch').click()
            expect(s.get_by_role('alertdialog')).to_be_visible()
            s.get_by_role('alertdialog').get_by_role('button', name='Quay lại').click()
            s.wait_for_timeout(500)
            assert sql("select count(*) from appointments where staff_id=%s and status='cancelled'", (LAN,))[0][0] == before
        with T('S3', 'Nhân viên vào /admin bị chuyển về /staff', s):
            s.goto(BASE + '/admin'); s.wait_for_url('**/staff')
        with T('S4', 'Nhân viên không sửa được lịch của người khác (API)', None):
            other = sql("select id::text from appointments where staff_id<>%s limit 1", (LAN,))[0][0]
            api('PATCH', f'/rest/v1/appointments?id=eq.{other}', token_for('lan.staff@spa.vn'), {'status': 'cancelled'})
            assert sql("select status::text from appointments where id=%s", (other,))[0][0] != 'cancelled'
        ctx.close()
        ctx, s2 = new_page(b, 'staff-unlinked')
        with T('S5', 'Tài khoản staff chưa liên kết → thông báo rõ ràng', s2):
            login(s2, 'nolink@spa.vn'); s2.wait_for_url('**/staff')
            expect(s2.get_by_text('Tài khoản chưa liên kết nhân viên')).to_be_visible()
        ctx.close()

        # ════════════════ ADMIN ════════════════
        ctx, ad = new_page(b, 'admin')
        with T('A1', 'Admin đăng nhập qua dialog ở trang chủ → /admin dashboard', ad):
            ad.goto(BASE + '/')
            ad.locator('header').get_by_role('button', name='Đăng nhập').first.click()
            ad.fill('#login-dialog-email', 'admin@spa.vn'); ad.fill('#login-dialog-password', PW)
            ad.get_by_role('dialog').locator('button[type=submit]').click()
            ad.wait_for_url('**/admin')
            expect(ad.get_by_role('heading', name='Tổng quan', exact=True)).to_be_visible()
            expect(ad.locator('.recharts-surface')).to_be_visible()
        with T('A2', 'Danh sách lịch hẹn (Sắp tới) + tìm theo mã', ad):
            ad.goto(BASE + '/admin/appointments')
            expect(ad.get_by_text('Khách A').first).to_be_visible()
            code = sql("select booking_code from appointments where service_id=%s", (SVC_NECK,))[0][0]
            ad.get_by_placeholder('Tìm theo tên, SĐT, mã lịch hẹn...').fill(code)
            expect(ad.locator('a[href^="/admin/appointments/"]')).to_have_count(1)
        with T('A3', 'Chi tiết lịch: đổi trạng thái → Hủy qua hộp xác nhận → log hiển thị, slot được giải phóng', ad):
            ad.locator('a[href^="/admin/appointments/"]').first.click()
            ad.get_by_role('button', name='Hủy lịch', exact=True).click()
            ad.get_by_role('alertdialog').get_by_role('button', name='Hủy lịch').click()
            toast(ad, 'Đã chuyển sang: Đã hủy')
            expect(ad.get_by_text('Lịch sử thay đổi')).to_be_visible()
            st, d = api('POST', '/rest/v1/rpc/get_available_slots', body={'p_service_id': SVC_NECK, 'p_staff_id': None, 'p_date': TOMORROW})
            assert any(x['slot_time'] == '15:00' and x['staff_count'] == 3 for x in d), d
        with T('A4', 'Dịch vụ: thêm mới → hiện trên trang chủ sau revalidate/booking', ad):
            ad.goto(BASE + '/admin/services')
            ad.get_by_role('button', name='Thêm dịch vụ').click()
            ad.fill('#name', 'Xông hơi thảo mộc'); ad.fill('#duration', '40'); ad.fill('#price', '180000')
            ad.get_by_role('dialog').get_by_role('button', name=re.compile('Lưu|Tạo|Thêm')).last.click()
            toast(ad, 'Đã tạo dịch vụ mới')
            expect(ad.get_by_text('Xông hơi thảo mộc')).to_be_visible()
        with T('A5', 'Dịch vụ: xóa dịch vụ đã có lịch hẹn → báo lỗi dễ hiểu', ad):
            card = ad.locator('div.card-base', has_text='Massage cổ vai gáy').first
            card.locator('button:has(svg.lucide-trash2)').click()
            ad.get_by_role('alertdialog').get_by_role('button', name=re.compile('Xóa')).click()
            toast(ad, 'đã có lịch hẹn nên không thể xóa')
        with T('A6', 'Nhân viên: thêm mới + gán dịch vụ', ad):
            ad.goto(BASE + '/admin/staff')
            ad.get_by_role('button', name='Thêm nhân viên').click()
            ad.fill('#name', 'Phạm Thị Hương'); ad.fill('#phone', '0911000009')
            ad.get_by_role('dialog').get_by_role('button', name=re.compile('Lưu|Thêm')).last.click()
            toast(ad, 'Đã thêm nhân viên mới')
            card = ad.locator('div.card-base', has_text='Phạm Thị Hương').first
            card.get_by_role('button', name='Xông hơi thảo mộc').click()
            ad.wait_for_timeout(800)
            assert sql("select count(*) from staff_services ss join staff s on s.id=ss.staff_id where s.name='Phạm Thị Hương'")[0][0] == 1
        with T('A7', 'Lịch làm việc: thêm ca cho nhân viên mới → có slot; thêm ngày nghỉ → hết slot', ad):
            ad.goto(BASE + '/admin/schedules')
            ad.get_by_role('button', name=re.compile('Phạm Thị Hương')).click()
            dow = (dt.datetime.now() + dt.timedelta(days=2)).isoweekday() % 7
            ad.locator('div.rounded-xl').filter(has_text=['Chủ Nhật', 'Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7'][dow]).get_by_role('button', name='Thêm giờ').click()
            ad.wait_for_timeout(800)
            svc = sql("select id::text from services where name='Xông hơi thảo mộc'")[0][0]
            st, d = api('POST', '/rest/v1/rpc/get_available_slots', body={'p_service_id': svc, 'p_staff_id': None, 'p_date': D2})
            assert len(d) > 5, d
            ad.get_by_role('button', name=re.compile('^Thêm$')).click()
            ad.fill('#to-date', D2); ad.fill('#to-reason', 'Phép')
            ad.get_by_role('dialog').get_by_role('button', name=re.compile('Thêm|Lưu')).last.click()
            toast(ad, 'Đã thêm ngày nghỉ')
            st, d = api('POST', '/rest/v1/rpc/get_available_slots', body={'p_service_id': svc, 'p_staff_id': None, 'p_date': D2})
            assert d == [], d
        with T('A8', 'Lịch làm việc: giờ kết thúc < giờ bắt đầu → báo lỗi rõ, không lưu', ad):
            row = ad.locator('div.rounded-xl').filter(has=ad.locator('select')).first
            before = sql("select end_time::text from staff_schedules s join staff t on t.id=s.staff_id where t.name='Phạm Thị Hương'")
            row.locator('select').nth(1).select_option('07:00')
            toast(ad, 'Giờ kết thúc phải sau giờ bắt đầu')
            assert sql("select end_time::text from staff_schedules s join staff t on t.id=s.staff_id where t.name='Phạm Thị Hương'") == before
        with T('A9', 'Khách hàng: thêm khách mới + mở trang chi tiết', ad):
            ad.goto(BASE + '/admin/customers')
            ad.get_by_role('button', name=re.compile('Thêm khách')).click()
            ad.fill('#c-name', 'Khách Vãng Lai'); ad.fill('#c-phone', '0909999999')
            ad.get_by_role('dialog').get_by_role('button', name=re.compile('Thêm|Lưu')).last.click()
            expect(ad.get_by_text('Khách Vãng Lai')).to_be_visible()
            ad.get_by_text('Khách A').first.click()
            expect(ad.get_by_text('Lịch sử đặt lịch')).to_be_visible()
        with T('A10', 'Lễ tân đặt hộ khách theo SĐT (khách đã có) từ /booking', ad):
            ad.goto(f'{BASE}/booking?service={SVC_NECK}')
            ad.get_by_role('button', name=re.compile('Bất kỳ nhân viên')).click()
            ad.get_by_role('button', name='Tiếp tục').click()
            pick_date(ad, D3); slot_buttons(ad)
            ad.locator('div.grid button', has_text='11:00').first.click()
            ad.get_by_role('button', name='Tiếp tục').click()
            expect(ad.get_by_role('heading', name='Thông tin khách hàng')).to_be_visible()
            ad.fill('#bk-name', 'Khách Vãng Lai'); ad.fill('#bk-phone', '0909999999')
            ad.locator('aside').get_by_role('button', name='Xác nhận đặt lịch').click()
            expect(ad.get_by_role('heading', name='Đặt lịch thành công')).to_be_visible()
            r = sql("select c.name, c.user_id from appointments a join customers c on c.id=a.customer_id where c.phone='0909999999'")
            assert r == [('Khách Vãng Lai', None)], r
            assert sql("select count(*) from customers c join profiles p on p.id=c.user_id where p.role<>'customer'")[0][0] == 0, 'team accounts listed as customers'
        with T('A11', 'Lịch: xem Ngày / Tuần / Tháng không lỗi', ad):
            ad.goto(BASE + '/admin/calendar')
            for v in ('Ngày', 'Tuần', 'Tháng'):
                ad.get_by_role('button', name=v, exact=True).click(); ad.wait_for_timeout(400)
        with T('A13', 'Lịch tuần: 2 lịch cùng giờ (10:00 ngày mai) hiện cạnh nhau, không đè; lịch đã hủy không hiện', ad):
            ad.goto(BASE + '/admin/calendar')
            ad.get_by_role('button', name='Tuần', exact=True).click(); ad.wait_for_timeout(800)
            if dt.datetime.now().weekday() == 6:  # Sunday → tomorrow is next week (Monday-first)
                ad.locator('button:has(svg.lucide-chevron-right)').first.click(); ad.wait_for_timeout(800)
            ids = [r[0] for r in sql("select id::text from appointments where status<>'cancelled' and (start_time at time zone 'Asia/Ho_Chi_Minh')::date=%s and to_char(start_time at time zone 'Asia/Ho_Chi_Minh','HH24:MI')='10:00'", (TOMORROW,))]
            assert len(ids) >= 2, ids
            boxes = [ad.locator(f'a[href="/admin/appointments/{i}"]').bounding_box() for i in ids]
            assert all(boxes), boxes
            assert boxes[0]['x'] + boxes[0]['width'] <= boxes[1]['x'] + 1 or boxes[1]['x'] + boxes[1]['width'] <= boxes[0]['x'] + 1, boxes
            cancelled = sql("select id::text from appointments where status='cancelled'")
            assert all(ad.locator(f'a[href="/admin/appointments/{c[0]}"]').count() == 0 for c in cancelled)
        with T('A14', 'Dịch vụ: công tắc Ẩn → dịch vụ biến mất khỏi trang đặt lịch; bật lại → hiện lại', ad):
            ad.goto(BASE + '/admin/services')
            card = ad.locator('div.card-base', has_text='Gội đầu dưỡng sinh').first
            card.get_by_role('switch').click()
            toast(ad, 'Đã ẩn')
            assert sql("select is_active from services where name='Gội đầu dưỡng sinh'") == [(False,)]
            ad.goto(BASE + '/booking'); ad.wait_for_timeout(1500)
            assert ad.get_by_role('button', name=re.compile('Gội đầu dưỡng sinh')).count() == 0
            ad.goto(BASE + '/admin/services')
            ad.locator('div.card-base', has_text='Gội đầu dưỡng sinh').first.get_by_role('switch').click()
            toast(ad, 'Đã hiện')
        with T('A15', 'Lịch làm việc: "Áp dụng cả tuần" → đủ 7 ngày cùng giờ', ad):
            ad.goto(BASE + '/admin/schedules')
            ad.get_by_role('button', name=re.compile('Phạm Thị Hương')).click()
            ad.get_by_role('button', name='Áp dụng cả tuần').first.click()
            toast(ad, 'Đã áp dụng cho cả tuần')
            r = sql("select count(*), count(distinct (start_time, end_time)) from staff_schedules s join staff t on t.id=s.staff_id where t.name='Phạm Thị Hương'")
            assert r == [(7, 1)], r
        with T('A16', 'Dashboard: tách "Đã thu" và "Dự kiến"', ad):
            ad.goto(BASE + '/admin')
            expect(ad.get_by_text('Đã thu hôm nay')).to_be_visible()
            expect(ad.get_by_text(re.compile('Dự kiến cả ngày'))).to_be_visible()
        with T('A17', 'Ưu đãi & quà tặng: tắt/bật ưu đãi lần đầu, tạo gói, phát hành thẻ mệnh giá', ad):
            ad.goto(BASE + '/admin/promotions')
            ad.get_by_role('switch', name='Bật ưu đãi lần đầu').click()
            toast(ad, 'Đã lưu ưu đãi')
            assert sql("select first_visit_enabled from app_settings") == [(False,)]
            ad.get_by_role('switch', name='Bật ưu đãi lần đầu').click()
            ad.wait_for_timeout(500)
            assert sql("select first_visit_enabled from app_settings") == [(True,)]
            ad.get_by_role('button', name='Thêm gói').click()
            ad.fill('#pk-name', 'Gói 10 buổi cổ vai gáy'); ad.select_option('#pk-svc', SVC_NECK)
            ad.fill('#pk-ses', '10'); ad.fill('#pk-price', '2000000')
            expect(ad.get_by_text(re.compile('tiết kiệm 20%'))).to_be_visible()
            ad.get_by_role('button', name='Lưu gói').click()
            toast(ad, 'Đã lưu gói liệu trình')
            ad.get_by_role('button', name='Thẻ mệnh giá').click()
            ad.get_by_role('button', name='1.000.000 ₫').click()
            ad.fill('#gc-rn', 'Mẹ Hoa'); ad.fill('#gc-rp', '0988777666')
            ad.get_by_role('button', name=re.compile('Phát hành')).click()
            toast(ad, 'Đã phát hành thẻ SF')
            assert sql("select kind, initial_value, balance, recipient_name, created_by from gift_cards where recipient_name='Mẹ Hoa'") == [('value', 1000000, 1000000, 'Mẹ Hoa', 'admin@spa.vn')]
        with T('A18', 'Yêu cầu tư vấn: badge ở menu, đổi trạng thái → Đã gọi', ad):
            ad.goto(BASE + '/admin/leads')
            expect(ad.locator('aside').get_by_label(re.compile('yêu cầu mới'))).to_be_visible()
            expect(ad.get_by_text('Ngọc Hân')).to_be_visible()
            ad.get_by_label('Trạng thái').first.select_option('contacted')
            toast(ad, 'Đã gọi')
            assert sql("select status, handled_by from leads") == [('contacted', 'admin@spa.vn')]
        with T('A19', 'Đánh giá: admin ẩn đánh giá → không còn trong danh sách công khai', ad):
            ad.goto(BASE + '/admin/reviews')
            ad.get_by_role('switch', name='Hiển thị đánh giá').first.click()
            toast(ad, 'Đã ẩn')
            st, d = api('POST', '/rest/v1/rpc/get_public_reviews', body={'p_limit': 5})
            assert d == [], d
        with T('A20', 'Dashboard: hàng đợi "Cần nhắc lịch" → bấm "Đã nhắc" ghi reminded_at', ad):
            ad.goto(BASE + '/admin')
            q = ad.locator('section', has=ad.get_by_role('heading', name=re.compile('Cần nhắc lịch')))
            expect(q).to_be_visible()
            n = q.get_by_role('button', name='Đã nhắc').count()
            if n == 0:
                raise AssertionError('queue empty — expected tomorrow appointments within 24h')
            q.get_by_role('button', name='Đã nhắc').first.click()
            ad.wait_for_timeout(600)
            assert sql("select count(*) from appointments where reminded_at is not null")[0][0] == 1
        with T('A21', 'Nhân viên: sửa hồ sơ (thế mạnh, năm KN, giới thiệu)', ad):
            ad.goto(BASE + '/admin/staff')
            ad.get_by_role('button', name='Sửa Lê Minh Hòa').click()
            ad.fill('#specialties', 'Massage body, Đá nóng'); ad.fill('#years', '5'); ad.fill('#bio', 'Lực tay chắc, hợp khách thích mạnh tay.')
            ad.get_by_role('dialog').get_by_role('button', name=re.compile('Lưu')).last.click()
            toast(ad, 'Đã cập nhật nhân viên')
            assert sql("select specialties, years_experience from staff where name='Lê Minh Hòa'") == [(['Massage body', 'Đá nóng'], 5)]
        with T('A22', 'Bán gói 5 buổi → thẻ theo buổi; đặt lịch bằng thẻ: doanh thu = giá gói/buổi (380k), khách trả 0đ; hủy → hoàn buổi', ad):
            ad.goto(BASE + '/admin/promotions')
            ad.get_by_role('button', name=re.compile('Bán gói')).first.click()
            ad.fill('#gc-rn', 'Chị Gói'); ad.fill('#gc-rp', '0909000111')
            ad.get_by_role('dialog').get_by_role('button', name=re.compile('Phát hành')).click()
            toast(ad, 'Đã phát hành thẻ SF')
            code, sv = sql("select code, session_value from gift_cards where recipient_name='Chị Gói'")[0]
            assert sv == 380000, sv
            tb = token_for('khachb@test.vn')
            st, d = api('POST', '/rest/v1/rpc/book_appointment', tb, {'p_service_id': SVC_BODY, 'p_staff_id': None, 'p_date': day(5), 'p_time': '11:00',
                        'p_name': 'Khách B', 'p_phone': '0902222222', 'p_email': '', 'p_notes': '', 'p_gift_code': code.lower()})
            assert st == 200 and d[0]['total'] == 0 and d[0]['discount_reason'] == 'package', (st, d)
            aid, price, gift = sql("select a.id::text, a.price, a.gift_amount from appointments a join gift_cards g on g.id=a.gift_card_id where g.code=%s", (code,))[0]
            assert (price, gift) == (380000, 380000), (price, gift)
            assert sql("select sessions_left from gift_cards where code=%s", (code,)) == [(4,)]
            st, _ = api('POST', '/rest/v1/rpc/cancel_my_appointment', tb, {'p_id': aid}); assert st in (200, 204), st
            assert sql("select sessions_left from gift_cards where code=%s", (code,)) == [(5,)]
        with T('A23', 'Yêu cầu tư vấn → "Đặt lịch hộ" điền sẵn tên/SĐT → đặt xong: lời nhắn cho lễ tân, yêu cầu chuyển "Đã đặt lịch"', ad):
            ad.goto(BASE + '/admin/leads?')
            ad.get_by_role('button', name='Tất cả', exact=True).click()
            ad.get_by_role('link', name='Đặt lịch hộ').first.click()
            ad.get_by_role('button', name=re.compile('Massage cổ vai gáy')).first.click()
            ad.get_by_role('button', name='Tiếp tục').click()
            ad.get_by_role('button', name=re.compile('Bất kỳ nhân viên')).click()
            ad.get_by_role('button', name='Tiếp tục').click()
            pick_date(ad, day(4)); slot_buttons(ad)
            ad.locator('div.grid button', has_text='09:00').first.click()
            ad.get_by_role('button', name='Tiếp tục').click()
            expect(ad.locator('#bk-name')).to_have_value('Ngọc Hân')
            ad.locator('aside').get_by_role('button', name='Xác nhận đặt lịch').click()
            expect(ad.get_by_text(re.compile('Đã giữ chỗ cho Ngọc Hân'))).to_be_visible()
            expect(ad.get_by_role('button', name='Về yêu cầu tư vấn')).to_be_visible()
            assert sql("select status from leads where name='Ngọc Hân'") == [('booked',)]
            assert sql("select a.source, a.discount_amount from appointments a join customers c on c.id=a.customer_id where c.phone='0977 111 222'") == [('front_desk', 0)]
        with T('A24', 'Xin đánh giá & gửi quà: lịch vừa hoàn thành hiện trong hàng đợi → gửi → khách mở link (không đăng nhập) chấm sao, thấy mã quà', ad):
            apt = sql("""update appointments set status='completed' where id = (select a.id from appointments a join customers c on c.id=a.customer_id
                         join auth.users u on u.id=c.user_id where u.email='khachb@test.vn' and a.status='confirmed' order by a.start_time limit 1) returning id::text""")[0][0]
            ad.goto(BASE + '/admin')
            q = ad.locator('section', has=ad.get_by_role('heading', name=re.compile('Xin đánh giá')))
            expect(q.get_by_text('Khách B')).to_be_visible()
            q.locator('li', has_text='Khách B').get_by_role('button', name='Đã gửi').click()
            ad.wait_for_timeout(800)
            tok = sql("select token::text from review_requests where appointment_id=%s and sent_at is not null", (apt,))[0][0]
            code = sql("select code from gift_cards where source_appointment_id=%s", (apt,))[0][0]
            rctx, rv = new_page(b, 'review-link')
            try:
                rv.goto(f'{BASE}/review/{tok}')
                expect(rv.get_by_role('heading', name=re.compile('buổi hẹn thế nào'))).to_be_visible()
                expect(rv.get_by_text(code)).to_be_visible()
                rv.get_by_role('radio', name='4 sao').click()
                rv.get_by_label('Nhận xét').fill('Ổn, sẽ quay lại.')
                rv.get_by_role('button', name='Gửi đánh giá').click()
                expect(rv.get_by_role('heading', name=re.compile('Cảm ơn'))).to_be_visible()
            finally:
                rctx.close()
            assert sql("select rating, comment from reviews where appointment_id=%s", (apt,)) == [(4, 'Ổn, sẽ quay lại.')]
            sql("update appointments set status='confirmed' where id=%s", (apt,), fetch=False)
        with T('A25', 'Lễ tân tick "Áp dụng ưu đãi lần đầu" cho khách mới → giảm 10%; SĐT đã từng đặt → không giảm', None):
            tad = token_for('admin@spa.vn')
            body = lambda t: {'p_service_id': SVC_NECK, 'p_staff_id': None, 'p_date': day(9), 'p_time': t, 'p_name': 'Khách Gọi Điện',
                              'p_phone': '0966 777 888', 'p_email': '', 'p_notes': '', 'p_apply_first_visit': True}
            st, d = api('POST', '/rest/v1/rpc/book_appointment', tad, body('10:00'))
            assert st == 200 and d[0]['discount_reason'] == 'first_visit' and d[0]['total'] == 225000, (st, d)
            st, d = api('POST', '/rest/v1/rpc/book_appointment', tad, body('11:00'))
            assert st == 200 and d[0]['discount_amount'] == 0, (st, d)
        with T('A12', 'Đăng xuất từ sidebar admin', ad):
            ad.goto(BASE + '/admin')
            ad.get_by_role('button', name='Đăng xuất').click()
            ad.wait_for_url(BASE + '/')
        ctx.close()

        # ════════════════ ADMIN MOBILE ════════════════
        ctx, am = new_page(b, 'admin-mobile', 390, 844, mobile=True)
        with T('M3', 'Admin mobile: thanh điều hướng dưới đáy + lịch mặc định xem theo Ngày', am):
            login(am, 'admin@spa.vn'); am.wait_for_url('**/admin')
            nav = am.get_by_role('navigation', name='Điều hướng nhanh')
            expect(nav).to_be_visible()
            nav.get_by_role('link', name='Lịch', exact=True).click(); am.wait_for_url('**/admin/calendar')
            am.wait_for_timeout(800)
            assert 'bg-primary' in (am.get_by_role('button', name='Ngày', exact=True).get_attribute('class') or '')
            nav.get_by_role('button', name='Thêm').click()
            expect(am.locator('aside').get_by_role('link', name='Khách hàng', exact=True)).to_be_visible()
        with T('M5', 'Trang chủ mobile: thanh Gọi / Zalo / Đặt lịch cố định dưới đáy', am):
            am.goto(BASE + '/')
            bar = am.get_by_role('navigation', name='Liên hệ nhanh')
            expect(bar).to_be_visible()
            assert bar.get_by_role('link', name=re.compile('Gọi')).get_attribute('href').startswith('tel:')
            expect(bar.get_by_role('link', name=re.compile('Đặt lịch'))).to_be_visible()
        with T('M4', 'Trang chủ mobile: dịch vụ vuốt ngang, không tràn trang', am):
            am.goto(BASE + '/')
            expect(am.get_by_text('Vuốt ngang để xem thêm dịch vụ')).to_be_visible()
            assert am.evaluate('document.documentElement.scrollWidth') <= 391
        ctx.close()

        # ════════════════ TIMEZONE ════════════════
        ctx, z = new_page(b, 'tz')
        with T('Z1', 'Múi giờ: 06:30 sáng giờ VN → trang Staff & min ngày đặt lịch là HÔM NAY', z):
            now_vn = dt.datetime.now().replace(hour=6, minute=30, second=0, microsecond=0)
            z.clock.install(time=now_vn)
            login(z, 'lan.staff@spa.vn'); z.wait_for_url('**/staff')
            expect(z.get_by_text('Hôm nay', exact=True)).to_be_visible()
            z.goto(f'{BASE}/booking?service={SVC_BODY}')
            z.get_by_role('button', name=re.compile('Bất kỳ nhân viên')).click()
            z.get_by_role('button', name='Tiếp tục').click()
            assert z.locator('#booking-date').get_attribute('min') == now_vn.strftime('%Y-%m-%d')
        ctx.close()
        b.close()


results_note = []
if __name__ == '__main__':
    try:
        run()
    except Exception:
        traceback.print_exc()
    print('\n==== SUMMARY ====')
    for r in results:
        print(f'{r[2]:4} {r[0]:4} {r[1]}  {r[3]}')
    print(f"\n{sum(1 for r in results if r[2]=='PASS')}/{len(results)} passed")
    print('\nNotes:', *results_note, sep='\n  ')
    print('\nConsole errors:')
    for k, v in console_errors.items():
        uniq = sorted(set(v))
        if uniq:
            print(' ', k, uniq[:8])
    json.dump({'results': results, 'notes': results_note, 'console': {k: sorted(set(v)) for k, v in console_errors.items()}}, open('results.json', 'w'), ensure_ascii=False, indent=1)
