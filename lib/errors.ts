/** Errors the engine treats specially. Anything else is retried with backoff. */

export class MissingCredentialError extends Error {
  constructor(
    public provider: string,
    public setup: string,
  ) {
    super(`${provider} is not configured. ${setup}`);
    this.name = "MissingCredentialError";
  }
}

export class BudgetExceededError extends Error {
  constructor(
    public scope: "daily" | "monthly" | "run",
    public capUsd: number,
    public projectedUsd: number,
  ) {
    super(`${scope} budget cap of $${capUsd.toFixed(2)} would be exceeded (projected $${projectedUsd.toFixed(4)}).`);
    this.name = "BudgetExceededError";
  }
}

export class CircuitOpenError extends Error {
  constructor(public provider: string, public until: Date) {
    super(`${provider} circuit is open until ${until.toISOString()} after repeated failures.`);
    this.name = "CircuitOpenError";
  }
}

export class PolicyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PolicyError";
  }
}

/** Errors that should block the run (needs a human) rather than retry. */
export function isBlocking(err: unknown): err is MissingCredentialError | BudgetExceededError | PolicyError {
  return err instanceof MissingCredentialError || err instanceof BudgetExceededError || err instanceof PolicyError;
}

export function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}
