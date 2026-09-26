"""Minimal Supabase-compatible gateway for E2E tests.

/auth/v1/*  -> GoTrue-like auth implemented here (users in auth.users, triggers fire for real)
/rest/v1/*  -> proxied to a real PostgREST (RLS enforced by Postgres)
"""
import hashlib, json, time, uuid, urllib.request, urllib.error, os
from http.server import ThreadingHTTPServer, BaseHTTPRequestHandler
from urllib.parse import urlparse, parse_qs
import jwt, psycopg2

SECRET = 'e2e-super-secret-jwt-token-with-at-least-32-characters'
PGRST = 'http://127.0.0.1:3001'
DB = dict(host=os.environ.get('PGHOST', '/var/tmp/pgtest'), port=int(os.environ.get('PGPORT', 5439)), user='postgres', dbname='spa')
CONFIRM_EMAIL = os.environ.get('CONFIRM_EMAIL') == '1'


def db():
    c = psycopg2.connect(**DB)
    c.autocommit = True
    return c


def hash_pw(pw):
    return hashlib.sha256(pw.encode()).hexdigest()


OTPS = {}  # phone digits -> code (fixed 123456 in tests)
OTP_CODE = '123456'


def digits(p):
    return ''.join(ch for ch in (p or '') if ch.isdigit())


def user_obj(row):
    uid, email, meta, created = row[:4]
    phone = row[4] if len(row) > 4 else None
    return {"id": str(uid), "aud": "authenticated", "role": "authenticated", "email": email, "phone": phone or '',
            "email_confirmed_at": created.isoformat(), "user_metadata": meta or {}, "app_metadata": {"provider": "email"},
            "identities": [], "created_at": created.isoformat(), "updated_at": created.isoformat()}


def session_for(row):
    uid, email = str(row[0]), row[1]
    now = int(time.time())
    token = jwt.encode({"sub": uid, "email": email, "role": "authenticated", "aud": "authenticated",
                        "iat": now, "exp": now + 3600}, SECRET, algorithm='HS256')
    return {"access_token": token, "token_type": "bearer", "expires_in": 3600, "expires_at": now + 3600,
            "refresh_token": "rt-" + uid, "user": user_obj(row)}


class H(BaseHTTPRequestHandler):
    protocol_version = 'HTTP/1.1'

    def log_message(self, *a):
        pass

    def cors(self):
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Headers', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET,POST,PATCH,PUT,DELETE,OPTIONS')
        self.send_header('Access-Control-Expose-Headers', 'Content-Range, Content-Profile')

    def send(self, code, body=None, headers=None):
        data = b'' if body is None else (body if isinstance(body, bytes) else json.dumps(body).encode())
        self.send_response(code)
        self.cors()
        for k, v in (headers or {}).items():
            self.send_header(k, v)
        if body is not None and not (headers and 'Content-Type' in headers):
            self.send_header('Content-Type', 'application/json')
        self.send_header('Content-Length', str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def do_OPTIONS(self):
        self.send(204)

    def body(self):
        n = int(self.headers.get('Content-Length') or 0)
        return self.rfile.read(n) if n else b''

    def route(self):
        u = urlparse(self.path)
        if u.path.startswith('/rest/v1'):
            return self.proxy(u)
        if u.path.startswith('/auth/v1'):
            return self.auth(u)
        self.send(404, {"msg": "not found"})

    do_GET = do_POST = do_PATCH = do_PUT = do_DELETE = do_HEAD = route

    # ── PostgREST proxy ─────────────────────────────────────────
    def proxy(self, u):
        target = PGRST + u.path[len('/rest/v1'):] + (('?' + u.query) if u.query else '')
        body = self.body()
        req = urllib.request.Request(target, data=body if body else None, method=self.command)
        for k in ('Authorization', 'Content-Type', 'Accept', 'Prefer', 'Range', 'Content-Profile', 'Accept-Profile'):
            if self.headers.get(k):
                req.add_header(k, self.headers[k])
        try:
            with urllib.request.urlopen(req) as r:
                code, data, hdrs = r.status, r.read(), r.headers
        except urllib.error.HTTPError as e:
            code, data, hdrs = e.code, e.read(), e.headers
        out = {'Content-Type': hdrs.get('Content-Type', 'application/json')}
        if hdrs.get('Content-Range'):
            out['Content-Range'] = hdrs['Content-Range']
        if code >= 400:
            print('REST', code, self.command, u.path, u.query[:120], data[:200], flush=True)
        if self.command == 'HEAD':
            self.send_response(code); self.cors()
            for k, v in out.items(): self.send_header(k, v)
            self.send_header('Content-Length', '0'); self.end_headers(); return
        self.send(code, data, out)

    # ── Auth ────────────────────────────────────────────────────
    def bearer_user(self):
        a = self.headers.get('Authorization', '')
        try:
            claims = jwt.decode(a.split(' ', 1)[1], SECRET, algorithms=['HS256'], audience='authenticated')
            return claims['sub']
        except Exception:
            return None

    def fetch_user(self, cur, where, arg):
        cur.execute(f"select id, email, raw_user_meta_data, created_at, phone from auth.users where {where}", (arg,))
        return cur.fetchone()

    def auth(self, u):
        path = u.path[len('/auth/v1'):]
        q = parse_qs(u.query)
        raw = self.body()
        data = json.loads(raw) if raw else {}
        with db() as c, c.cursor() as cur:
            if path == '/signup' and self.command == 'POST':
                email = (data.get('email') or '').strip().lower()
                if len(data.get('password') or '') < 6:
                    return self.send(422, {"code": 422, "error_code": "weak_password", "msg": "Password should be at least 6 characters."})
                if self.fetch_user(cur, 'email = %s', email):
                    return self.send(422, {"code": 422, "error_code": "user_already_exists", "msg": "User already registered"})
                meta = (data.get('data') or {})
                cur.execute("insert into auth.users (email, encrypted_password, raw_user_meta_data) values (%s,%s,%s) returning id, email, raw_user_meta_data, created_at",
                            (email, hash_pw(data['password']), json.dumps(meta)))
                row = cur.fetchone()
                if CONFIRM_EMAIL:
                    return self.send(200, user_obj(row))
                return self.send(200, session_for(row))
            if path == '/token' and self.command == 'POST':
                gt = q.get('grant_type', [''])[0]
                if gt == 'password':
                    email = (data.get('email') or '').strip().lower()
                    cur.execute("select id, email, raw_user_meta_data, created_at, encrypted_password from auth.users where email = %s", (email,))
                    r = cur.fetchone()
                    if not r or r[4] != hash_pw(data.get('password') or ''):
                        print('AUTH 400 invalid credentials', email, flush=True)
                        return self.send(400, {"code": 400, "error_code": "invalid_credentials", "msg": "Invalid login credentials"})
                    return self.send(200, session_for(r[:4]))
                if gt == 'refresh_token':
                    uid = (data.get('refresh_token') or '')[3:]
                    r = self.fetch_user(cur, 'id::text = %s', uid)
                    if not r:
                        return self.send(400, {"code": 400, "error_code": "refresh_token_not_found", "msg": "Invalid Refresh Token"})
                    return self.send(200, session_for(r))
            if path == '/user' and self.command == 'GET':
                uid = self.bearer_user()
                r = uid and self.fetch_user(cur, 'id::text = %s', uid)
                if not r:
                    return self.send(401, {"code": 401, "msg": "invalid JWT"})
                return self.send(200, user_obj(r))
            if path == '/otp' and self.command == 'POST':
                phone = digits(data.get('phone'))
                if len(phone) < 10:
                    return self.send(400, {"code": 400, "error_code": "validation_failed", "msg": "Invalid phone number format"})
                if not self.fetch_user(cur, 'phone = %s', phone):
                    cur.execute("insert into auth.users (phone, raw_user_meta_data) values (%s, %s)", (phone, json.dumps(data.get('data') or {})))
                OTPS[phone] = OTP_CODE
                print('OTP sent', phone, flush=True)
                return self.send(200, {"message_id": "e2e"})
            if path == '/verify' and self.command == 'POST':
                phone = digits(data.get('phone'))
                if data.get('type') != 'sms' or OTPS.get(phone) != data.get('token'):
                    return self.send(403, {"code": 403, "error_code": "otp_expired", "msg": "Token has expired or is invalid"})
                OTPS.pop(phone, None)
                cur.execute("update auth.users set phone_confirmed_at = coalesce(phone_confirmed_at, now()) where phone = %s", (phone,))
                return self.send(200, session_for(self.fetch_user(cur, 'phone = %s', phone)))
            if path == '/logout':
                return self.send(204)
        print('AUTH 404', self.command, path, flush=True)
        self.send(404, {"msg": f"auth route {path} not implemented"})


if __name__ == '__main__':
    print('anon key:', jwt.encode({"role": "anon", "iss": "supabase", "iat": 1700000000, "exp": 4102444800}, SECRET, algorithm='HS256'))
    ThreadingHTTPServer(('0.0.0.0', 54321), H).serve_forever()
