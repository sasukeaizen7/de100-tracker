import { createPublicKey, verify, JsonWebKey } from 'node:crypto';
import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { AppConfig, CONFIG } from '../config';

const JWKS_URL = 'https://www.googleapis.com/oauth2/v3/certs';
const ISSUERS = ['accounts.google.com', 'https://accounts.google.com'];

// Google sign-in via the OAuth authorization-code flow (confidential client).
@Injectable()
export class GoogleService {
  private keys: { fetchedAt: number; byKid: Map<string, JsonWebKey> } | null = null;

  constructor(@Inject(CONFIG) private readonly config: AppConfig) {}

  get enabled() {
    return this.config.google !== null;
  }

  private get redirectUri() {
    return `${this.config.apiPublicUrl}/auth/google/callback`;
  }

  authorizeUrl(state: string) {
    const url = new URL('https://accounts.google.com/o/oauth2/v2/auth');
    url.search = new URLSearchParams({
      client_id: this.config.google!.clientId,
      redirect_uri: this.redirectUri,
      response_type: 'code',
      scope: 'openid email profile',
      state,
      prompt: 'select_account',
    }).toString();
    return url.href;
  }

  // Exchanges the code and returns the verified identity from the ID token.
  async exchange(code: string): Promise<{ email: string; name: string | null }> {
    const res = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code, client_id: this.config.google!.clientId, client_secret: this.config.google!.clientSecret,
        redirect_uri: this.redirectUri, grant_type: 'authorization_code',
      }),
    });
    if (!res.ok) throw new UnauthorizedException('Google sign-in failed');
    const { id_token: idToken } = (await res.json()) as { id_token?: string };
    if (!idToken) throw new UnauthorizedException('Google sign-in failed');

    const claims = await this.verifyIdToken(idToken);
    if (!claims.email || claims.email_verified !== true) throw new UnauthorizedException('Your Google email is not verified');
    return { email: String(claims.email), name: typeof claims.name === 'string' ? claims.name : null };
  }

  private async verifyIdToken(token: string): Promise<Record<string, unknown>> {
    const [h, p, s] = token.split('.');
    const header = JSON.parse(Buffer.from(h, 'base64url').toString());
    if (header.alg !== 'RS256') throw new UnauthorizedException('Unexpected token algorithm');

    const jwk = await this.key(header.kid);
    const valid = verify('RSA-SHA256', Buffer.from(`${h}.${p}`), createPublicKey({ key: jwk, format: 'jwk' }), Buffer.from(s, 'base64url'));
    if (!valid) throw new UnauthorizedException('Invalid Google token');

    const claims = JSON.parse(Buffer.from(p, 'base64url').toString());
    const now = Date.now() / 1000;
    if (!ISSUERS.includes(claims.iss) || claims.aud !== this.config.google!.clientId || !(claims.exp > now)) {
      throw new UnauthorizedException('Invalid Google token');
    }
    return claims;
  }

  private async key(kid: string): Promise<JsonWebKey> {
    const stale = !this.keys || Date.now() - this.keys.fetchedAt > 3_600_000;
    if (stale || !this.keys!.byKid.has(kid)) {
      const { keys } = (await (await fetch(JWKS_URL)).json()) as { keys: (JsonWebKey & { kid: string })[] };
      this.keys = { fetchedAt: Date.now(), byKid: new Map(keys.map((k) => [k.kid, k])) };
    }
    const jwk = this.keys!.byKid.get(kid);
    if (!jwk) throw new UnauthorizedException('Unknown Google signing key');
    return jwk;
  }
}
