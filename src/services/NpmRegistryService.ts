// src/services/NpmRegistryService.ts
// ─────────────────────────────────────────────────────────────────────────────
// Service for fetching and caching package versions from the npm registry.
// ─────────────────────────────────────────────────────────────────────────────

import * as https from 'https';
import { Logger } from '../core/logger';

export class NpmRegistryService {
  private _versionCache = new Map<string, string | null>();
  private _pendingRequests = new Map<string, Promise<string | null>>();

  /**
   * Fetches the latest version of a package from the npm registry.
   * Caches the result in-memory so subsequent calls for the same package are instant.
   */
  public async getLatestVersion(packageName: string): Promise<string | null> {
    if (this._versionCache.has(packageName)) {
      return this._versionCache.get(packageName) ?? null;
    }

    if (this._pendingRequests.has(packageName)) {
      return this._pendingRequests.get(packageName)!;
    }

    const promise = this._fetchFromRegistry(packageName)
      .then(version => {
        this._versionCache.set(packageName, version);
        this._pendingRequests.delete(packageName);
        return version;
      })
      .catch(err => {
        Logger.warn('NpmRegistryService', `Failed to fetch version for ${packageName}`, err);
        this._versionCache.set(packageName, null);
        this._pendingRequests.delete(packageName);
        return null;
      });

    this._pendingRequests.set(packageName, promise);
    return promise;
  }

  private _fetchFromRegistry(packageName: string): Promise<string | null> {
    return new Promise((resolve, reject) => {
      // Use the minimal dist-tags endpoint which is fast and lightweight
      const url = `https://registry.npmjs.org/-/package/${encodeURIComponent(packageName)}/dist-tags`;

      https.get(url, (res) => {
        if (res.statusCode !== 200) {
          // 404 means package not found (maybe private or typo)
          res.resume();
          if (res.statusCode === 404) {
            resolve(null);
          } else {
            reject(new Error(`Status Code: ${res.statusCode}`));
          }
          return;
        }

        let rawData = '';
        res.on('data', (chunk) => { rawData += chunk; });
        res.on('end', () => {
          try {
            const parsedData = JSON.parse(rawData) as { latest?: string };
            resolve(parsedData.latest ?? null);
          } catch (e) {
            reject(e);
          }
        });
      }).on('error', (e) => {
        reject(e);
      });
    });
  }

  public clearCache(): void {
    this._versionCache.clear();
    this._pendingRequests.clear();
  }
}
