// src/core/registry.ts
// ─────────────────────────────────────────────────────────────────────────────
// Lightweight service registry (DI container).
// All services are instantiated once in extension.ts and registered here.
// Other modules call Registry.get() to retrieve singletons.
// ─────────────────────────────────────────────────────────────────────────────

// We use constructor functions as keys, so we need a generic constructor type.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Constructor<T> = new (...args: any[]) => T;

/**
 * Typed service registry.
 *
 * @example
 * // Registration (in extension.ts)
 * Registry.register(ProjectScanner, new ProjectScanner());
 *
 * @example
 * // Retrieval (anywhere)
 * const scanner = Registry.get(ProjectScanner);
 */
export class Registry {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private static readonly _services = new Map<Constructor<any>, unknown>();

  /** Register a singleton service instance */
  static register<T>(token: Constructor<T>, instance: T): void {
    Registry._services.set(token, instance);
  }

  /**
   * Retrieve a registered service instance.
   * Throws if the service has not been registered.
   */
  static get<T>(token: Constructor<T>): T {
    const instance = Registry._services.get(token);
    if (instance === undefined) {
      throw new Error(
        `[Registry] Service not registered: ${token.name}. ` +
        `Ensure it is registered in extension.ts before use.`,
      );
    }
    return instance as T;
  }

  /** Check if a service is registered (useful in tests) */
  static has<T>(token: Constructor<T>): boolean {
    return Registry._services.has(token);
  }

  /** Clear all services — use only in tests */
  static _reset(): void {
    Registry._services.clear();
  }
}
