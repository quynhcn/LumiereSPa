"""Report elements wider than the mobile viewport (horizontal scroll culprits)."""
import sys, re
from playwright.sync_api import sync_playwright
BASE='http://localhost:3300'; PW='matkhau123'
JS = """() => { const W = innerWidth, out = [];
 for (const el of document.querySelectorAll('body *')) { const r = el.getBoundingClientRect();
   if (r.right > W + 1 && r.width > 0 && ![...el.children].some(c => c.getBoundingClientRect().right > W + 1))
     out.push(el.tagName + '.' + (el.className?.baseVal ?? el.className).toString().slice(0,90) + ' right=' + Math.round(r.right)); }
 return [document.documentElement.scrollWidth, out.slice(0,6)]; }"""
pages = [('admin@spa.vn', ['/admin','/admin/calendar','/admin/appointments','/admin/services','/admin/staff','/admin/schedules','/admin/customers','/admin/leads','/admin/promotions','/admin/reviews']),
         ('lan.staff@spa.vn', ['/staff']), ('khacha@test.vn', ['/account','/booking']), (None, ['/','/sign-in','/signup'])]
with sync_playwright() as p:
    b = p.chromium.launch()
    for user, paths in pages:
        ctx = b.new_context(viewport={'width':390,'height':844}, is_mobile=True, has_touch=True, timezone_id='Asia/Ho_Chi_Minh', locale='vi-VN')
        pg = ctx.new_page()
        if user:
            pg.goto(BASE+'/sign-in'); pg.fill('#sign-in-email', user); pg.fill('#sign-in-password', PW); pg.click('form button[type=submit]')
            pg.wait_for_url(re.compile(r'/(account|staff|admin)'))
        for path in paths:
            pg.goto(BASE+path); pg.wait_for_timeout(1500)
            sw, els = pg.evaluate(JS)
            print(('OVERFLOW ' if sw > 391 else 'ok       ') + path, sw, els if sw > 391 else '')
            if path in ('/admin/customers',):
                pg.locator('a[href^="/admin/customers/"]').first.click(); pg.wait_for_timeout(1500)
                sw, els = pg.evaluate(JS); print(('OVERFLOW ' if sw > 391 else 'ok       ') + 'customer detail', sw, els if sw > 391 else '')
            if path == '/admin/appointments':
                pg.locator('a[href^="/admin/appointments/"]').first.click(); pg.wait_for_timeout(1500)
                sw, els = pg.evaluate(JS); print(('OVERFLOW ' if sw > 391 else 'ok       ') + 'appointment detail', sw, els if sw > 391 else '')
        ctx.close()
    b.close()
