// Sinh JWT_SECRET, ANON_KEY, SERVICE_ROLE_KEY (HS256) và mật khẩu Postgres ngẫu nhiên.
//   node scripts/gen-keys.mjs >> .env
// ANON_KEY  → NEXT_PUBLIC_SUPABASE_ANON_KEY của web app (công khai được)
// SERVICE_ROLE_KEY → chỉ dùng ở server, KHÔNG đưa vào web app.
import crypto from 'node:crypto';

const secret = process.argv[2] || crypto.randomBytes(48).toString('base64url');
const b64u = (v) => Buffer.from(typeof v === 'string' ? v : JSON.stringify(v)).toString('base64url');
const sign = (payload) => {
  const head = b64u({ alg: 'HS256', typ: 'JWT' });
  const body = b64u(payload);
  const sig = crypto.createHmac('sha256', secret).update(`${head}.${body}`).digest('base64url');
  return `${head}.${body}.${sig}`;
};
const iat = Math.floor(Date.now() / 1000);
const exp = iat + 10 * 365 * 24 * 3600; // 10 năm

console.log(`POSTGRES_PASSWORD=${crypto.randomBytes(24).toString('base64url')}`);
console.log(`JWT_SECRET=${secret}`);
console.log(`ANON_KEY=${sign({ role: 'anon', iss: 'supabase', iat, exp })}`);
console.log(`SERVICE_ROLE_KEY=${sign({ role: 'service_role', iss: 'supabase', iat, exp })}`);
