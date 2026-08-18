/**
 * Server-only LegiScan Pull API client.
 *
 * Rules this client enforces so nothing else has to think about them:
 *   - the API key is never placed in a log line, error message or thrown object
 *   - every HTTP attempt (including retries) is charged to the query budget
 *   - a LegiScan `status: "ERROR"` body is turned into a typed error, not silently
 *     treated as success
 *   - responses are validated before any caller sees them
 */

import { getLegiscanApiKey } from '@/lib/env';
import { QueryBudget, QueryBudgetExceededError } from './budget';
import { envelopeSchema } from './schemas';

if (typeof window !== 'undefined') {
  throw new Error('The LegiScan client is server-only and must not be bundled for the browser.');
}

export const LEGISCAN_BASE_URL = 'https://api.legiscan.com/';

export type LegiScanErrorCode =
  | 'config'
  | 'network'
  | 'http'
  | 'api'
  | 'parse'
  | 'budget'
  | 'timeout';

export class LegiScanError extends Error {
  readonly code: LegiScanErrorCode;
  readonly operation: string;
  readonly httpStatus?: number;
  /** LegiScan's own alert text, when supplied. Never contains our key. */
  readonly alert?: string;

  constructor(
    code: LegiScanErrorCode,
    operation: string,
    message: string,
    options: { httpStatus?: number; alert?: string; cause?: unknown } = {},
  ) {
    super(message, { cause: options.cause });
    this.name = 'LegiScanError';
    this.code = code;
    this.operation = operation;
    this.httpStatus = options.httpStatus;
    this.alert = options.alert;
  }

  /** Safe to persist in sync_runs.errors. */
  toStructured(): { stage: string; message: string } {
    return {
      stage: `legiscan:${this.operation}`,
      message: this.alert ? `${this.code}: ${this.message} (${this.alert})` : `${this.code}: ${this.message}`,
    };
  }
}

export type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

export interface LegiScanClientOptions {
  apiKey?: string;
  budget?: QueryBudget;
  fetchImpl?: FetchLike;
  baseUrl?: string;
  maxRetries?: number;
  retryDelayMs?: number;
  timeoutMs?: number;
  /** Receives redacted diagnostic lines. Defaults to no output. */
  logger?: (message: string) => void;
}

/** Alert strings LegiScan uses when an account is out of queries or throttled. */
const BUDGET_ALERT_PATTERNS = [/limit/i, /exceed/i, /quota/i, /throttl/i, /suspend/i];

export class LegiScanClient {
  private readonly apiKey: string;
  private readonly fetchImpl: FetchLike;
  private readonly baseUrl: string;
  private readonly maxRetries: number;
  private readonly retryDelayMs: number;
  private readonly timeoutMs: number;
  private readonly logger: (message: string) => void;
  readonly budget: QueryBudget;

  constructor(options: LegiScanClientOptions = {}) {
    this.apiKey = options.apiKey ?? getLegiscanApiKey();
    this.fetchImpl = options.fetchImpl ?? ((input, init) => fetch(input, init));
    this.baseUrl = options.baseUrl ?? LEGISCAN_BASE_URL;
    this.maxRetries = options.maxRetries ?? 2;
    this.retryDelayMs = options.retryDelayMs ?? 750;
    this.timeoutMs = options.timeoutMs ?? 30_000;
    this.logger = options.logger ?? (() => {});
    this.budget =
      options.budget ?? new QueryBudget({ maxQueriesPerRun: Number.MAX_SAFE_INTEGER });
  }

  get queriesUsed(): number {
    return this.budget.used;
  }

  /**
   * Performs one API operation and returns the parsed JSON body after checking
   * LegiScan's status field. Callers validate the payload shape themselves.
   */
  async call(
    operation: string,
    params: Record<string, string | number | undefined> = {},
  ): Promise<unknown> {
    const url = this.buildUrl(operation, params);
    const redacted = this.describeRequest(operation, params);

    let lastError: unknown;

    for (let attempt = 0; attempt <= this.maxRetries; attempt += 1) {
      // Charged before the attempt: LegiScan counts the request, not our success.
      try {
        this.budget.consume(1);
      } catch (error) {
        if (error instanceof QueryBudgetExceededError) {
          throw new LegiScanError('budget', operation, error.message, { cause: error });
        }
        throw error;
      }

      try {
        const response = await this.fetchImpl(url, {
          method: 'GET',
          headers: { Accept: 'application/json' },
          signal: AbortSignal.timeout(this.timeoutMs),
        });

        if (!response.ok) {
          // 5xx and 429 are worth another attempt; 4xx are not.
          if ((response.status >= 500 || response.status === 429) && attempt < this.maxRetries) {
            lastError = new LegiScanError(
              'http',
              operation,
              `LegiScan returned HTTP ${response.status}`,
              { httpStatus: response.status },
            );
            this.logger(`${redacted} -> HTTP ${response.status}, retrying`);
            await delay(this.retryDelayMs * (attempt + 1));
            continue;
          }
          throw new LegiScanError(
            'http',
            operation,
            `LegiScan returned HTTP ${response.status}`,
            { httpStatus: response.status },
          );
        }

        let body: unknown;
        try {
          body = await response.json();
        } catch (error) {
          throw new LegiScanError('parse', operation, 'LegiScan returned invalid JSON', {
            cause: error,
          });
        }

        const envelope = envelopeSchema.safeParse(body);
        if (!envelope.success) {
          throw new LegiScanError(
            'parse',
            operation,
            'LegiScan response did not include a recognizable status envelope',
          );
        }

        if (envelope.data.status !== 'OK') {
          const alert = envelope.data.alert?.message ?? undefined;
          const isBudget = alert ? BUDGET_ALERT_PATTERNS.some((p) => p.test(alert)) : false;
          throw new LegiScanError(
            isBudget ? 'budget' : 'api',
            operation,
            `LegiScan reported status ${envelope.data.status}`,
            { alert: alert ?? undefined },
          );
        }

        this.logger(`${redacted} -> OK (${this.budget.used} queries used this run)`);
        return body;
      } catch (error) {
        if (error instanceof LegiScanError) {
          // Budget and API-level failures are final.
          if (error.code === 'budget' || error.code === 'api' || error.code === 'parse') throw error;
          lastError = error;
        } else if (isAbortError(error)) {
          lastError = new LegiScanError('timeout', operation, 'LegiScan request timed out', {
            cause: error,
          });
        } else {
          lastError = new LegiScanError('network', operation, 'Could not reach LegiScan', {
            cause: error,
          });
        }

        if (attempt < this.maxRetries) {
          this.logger(`${redacted} -> transient failure, retrying`);
          await delay(this.retryDelayMs * (attempt + 1));
          continue;
        }
      }
    }

    if (lastError instanceof LegiScanError) throw lastError;
    throw new LegiScanError('network', operation, 'LegiScan request failed', {
      cause: lastError,
    });
  }

  private buildUrl(
    operation: string,
    params: Record<string, string | number | undefined>,
  ): string {
    const search = new URLSearchParams();
    search.set('key', this.apiKey);
    search.set('op', operation);
    for (const [name, value] of Object.entries(params)) {
      if (value === undefined || value === null || value === '') continue;
      search.set(name, String(value));
    }
    return `${this.baseUrl}?${search.toString()}`;
  }

  /** Builds a log-safe description that cannot leak the key. */
  private describeRequest(
    operation: string,
    params: Record<string, string | number | undefined>,
  ): string {
    const safe = Object.entries(params)
      .filter(([, value]) => value !== undefined && value !== '')
      .map(([name, value]) => `${name}=${String(value).slice(0, 80)}`)
      .join('&');
    return `legiscan ${operation}${safe ? `?${safe}` : ''}`;
  }
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isAbortError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'name' in error &&
    (error as { name?: string }).name === 'TimeoutError'
  ) || (
    typeof error === 'object' &&
    error !== null &&
    'name' in error &&
    (error as { name?: string }).name === 'AbortError'
  );
}
