import { SignJWT, jwtVerify } from 'jose';

const JWT_SECRET = process.env.JWT_SECRET || 'fallback_secret_for_local_development_only';
const encodedSecret = new TextEncoder().encode(JWT_SECRET);

export interface SessionPayload {
  id: string;
  email: string;
  role: string;
}

export async function signToken(payload: SessionPayload): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('7d')
    .sign(encodedSecret);
}

export async function verifyToken(token: string): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, encodedSecret);
    return payload as unknown as SessionPayload;
  } catch (error) {
    return null;
  }
}
