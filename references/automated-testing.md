# Automated Testing

It's important to not just add tests with mocks, but write E2E tests that use wallets that most closely simulate a real environment.

## Throw-away wallets

Throw-away [testing wallets](./testing-wallets.md) can be spun up for use in test frameworks (jest, vitest, playwright etc)

Each test can create brand new wallet(s) as required to ensure reproducable results.

### Code Example

The below example allows for temporary networking errors and is reusable as a fixture helper.

```ts
type TestWallet = { nwcUrl: string; lightningAddress: string };

async function createTestWallet({
  retries = 4,
  delayMs = 500,
  balance = 10000,
}: {
  retries?: number;
  delayMs?: number;
  balance?: number;
} = {}): Promise<TestWallet> {
  let lastError: Error | undefined;
  for (let i = 0; i < retries; i++) {
    try {
      const response = await fetch(`https://faucet.nwc.dev?balance=${balance}`, { method: "POST" });
      if (!response.ok) {
        throw new Error(`Faucet request failed: ${response.status} ${await response.text()}`);
      }
      const nwcUrl = (await response.text()).trim();
      const lud16Match = nwcUrl.match(/lud16=([^&\s]+)/);
      if (!lud16Match) {
        throw new Error(`No lud16 found in NWC URL: ${nwcUrl}`);
      }
      const lightningAddress = decodeURIComponent(lud16Match[1]);
      return { nwcUrl, lightningAddress };
    } catch (error) {
      lastError = error as Error;
      if (i < retries - 1) {
        await new Promise((r) => setTimeout(r, delayMs * (i + 1)));
      }
    }
  }
  throw lastError ?? new Error("Failed to create test wallet after retries");
}
```

#### Fixture patterns (Jest/Vitest/Playwright)

- Create a fresh wallet per test (or per suite) to avoid state bleed and flakiness.
- Expose `nwcUrl` via env or in-memory fixtures; never log or print the secret.
- In Playwright E2E, pass `nwcUrl` to the app via query param or `page.evaluate` to set it in localStorage/sessionStorage as a setup step.
- Add a top-up helper for balance-sensitive flows: `POST https://faucet.nwc.dev/wallets/<username>/topup?amount=...`.
- Cover failure cases with real flows (insufficient balance, expired invoice, rate limit) and not just mocks.
