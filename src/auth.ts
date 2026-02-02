import * as os from 'os';
import type { AuthToken } from './types';
import { SmsApiClient, SmsApiError } from './api-client';
import { logger } from './utils';
import {
  clearTokenFile,
  ensureConfigDir,
  loadTokenFromFile,
  saveTokenToFile,
} from './token.storage';

export class AuthManager {
  private client: SmsApiClient;
  private token: AuthToken | null = null;

  constructor(authUrl: string) {
    this.client = new SmsApiClient(authUrl);
  }

  async init(): Promise<boolean> {
    try {
      await ensureConfigDir();
      this.token = await loadTokenFromFile();

      if (this.token) {
        if (this.shouldRefreshToken()) {
          await this.refreshToken();
        } else {
          this.client.setAccessToken(this.token.access_token);
        }
        return true;
      }
      return false;
    } catch (err) {
      logger.error('Failed to initialize auth', err);
      return false;
    }
  }

  private shouldRefreshToken(): boolean {
    if (!this.token) {return false;}
    const expiresAt = new Date(this.token.expires_at);
    const oneHourFromNow = new Date(Date.now() + 60 * 60 * 1000);
    return expiresAt < oneHourFromNow;
  }

  async clearToken(): Promise<void> {
    await clearTokenFile();
    this.token = null;
    this.client.setAccessToken('');
  }

  async exchangePairingCode(
    tempToken: string,
    pairingCode: string,
  ): Promise<void> {
    const deviceFingerprint = this.getDeviceFingerprint();
    const token = await this.client.exchangePairingCode(
      tempToken,
      pairingCode,
      deviceFingerprint,
    );
    await this.saveToken(token);
  }

  private async saveToken(token: AuthToken): Promise<void> {
    await saveTokenToFile(token);
    this.token = token;
    this.client.setAccessToken(token.access_token);
  }

  async refreshToken(): Promise<void> {
    if (!this.token) {
      throw new Error('No token to refresh');
    }

    this.client.setAccessToken(this.token.access_token);

    try {
      const newToken = await this.client.refreshToken();
      await this.saveToken(newToken);
    } catch (err) {
      if (err instanceof SmsApiError && err.error.error === 'token_expired') {
        logger.warn('Token expired, user needs to re-authenticate');
        await this.clearToken();
      }
      throw err;
    }
  }

  async logout(): Promise<void> {
    if (this.token) {
      try {
        await this.client.logout();
      } catch {
        logger.warn('Logout API call failed, clearing local token anyway');
      }
    }
    await this.clearToken();
  }

  isAuthenticated(): boolean {
    return this.token !== null;
  }

  getPhone(): string | null {
    return this.token?.phone ?? null;
  }

  getClient(): SmsApiClient {
    return this.client;
  }

  private getDeviceFingerprint(): string {
    const hostname = os.hostname();
    const { username } = os.userInfo();
    const data = `${hostname}-${username}`;

    let hash = 0;
    for (let i = 0; i < data.length; i++) {
      const char = data.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash;
    }
    return `device-${Math.abs(hash).toString(16)}`;
  }
}
