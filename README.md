# Alby Bitcoin Builder Skill

Turn your favorite agent into a bitcoin app builder.

Generate lightning-powered apps, payment flows, and wallet logic in minutes - ready to test and ship, without even needing a wallet.

Before you start, try **[Alby Sandbox](https://sandbox.albylabs.com)** to see what you can build!

This repository contains an [agent skill](https://agentskills.io/specification) that helps agents use the [Alby JS SDK](https://github.com/getAlby/js-sdk) and [Alby Lightning Tools](https://github.com/getAlby/js-lightning-tools).

> Also check out our **[Wallet CLI skill](https://github.com/getAlby/alby-cli-skill)**

## Getting Started

### 🚀 Install with single command

`npx skills add getAlby/builder-skill`

### Manual Install

[Download](https://github.com/getAlby/alby-agent-skill/archive/refs/heads/master.zip) this repository and extract it, then follow instructions for your specific agent.

> Double check the skill is activated by asking your agent "What Skills are available?". It should include "Alby Agent Skill"

### Claude Code

Make a `.claude/skills` folder in your project and put the extracted skills folder there ([see other options](https://code.claude.com/docs/en/skills#where-skills-live))

### Gemini CLI

Make a `.gemini/skills` folder in your project and put the extracted skills folder there ([see other options](https://geminicli.com/docs/cli/skills/#skill-discovery-tiers))

### Roo Code

Make a `.roo/skills` folder in your project and put the extracted skills folder there ([see other options](https://docs.roocode.com/features/skills#1-choose-a-location))

## Test / Dummy Wallets

Alby Agent skill has the knowledge to create dummy wallets for testing. You can build and test your app end-to-end without creating a wallet. Once you are ready, the agent skill can also help you setup a wallet to use in production.

## Example prompts

> Explore more prompts in the **[Alby Sandbox](https://sandbox.albylabs.com)**

### Console Apps

#### Listen to received payments and send a payment to a lightning address with USD amounts

> Use the Alby Bitcoin Payments Agent Skill to create a TypeScript console app that when receives a notification of an incoming payment, sends $0.10 USD to <hello@getalby.com>. The NWC_URL is in the .env file.

<img width="699" height="496" alt="image" src="https://github.com/user-attachments/assets/66c7dd1f-54ae-4f5d-9830-dd032cfb9e1b" />

#### Conditionally receive payments (NOTE: only supported by Alby Hub)

> Use the Alby Bitcoin Payments Agent Skill to create a TypeScript console app that creates a hold invoice of $1 and asks the user to provide a lightning address and choose heads or tails. Once the hold invoice is accepted, flip a coin. If the user guessed correctly, cancel the hold invoice and pay the user $1 to their lightning address. If the user guessed incorrectly, settle the hold invoice. The NWC_URL is in the .env file.

<img width="947" height="654" alt="image" src="https://github.com/user-attachments/assets/530fccff-33fe-4e68-8998-20f3649cfe7c" />

### Frontend Apps

#### Streamer QR page with payment notifications

> Use the Alby Bitcoin Payments Agent Skill to create a single-page HTML app that listens to incoming payments, and each time one comes in, shows a confetti animation and the payment amount and message. It should also have a QR code of the receiving lightning address that should be displayed on the corner of the screen so people watching can easily send payments. When I first open the page it should prompt me for a NWC connection secret so it can connect to my wallet to listen for payments, and also extract the lightning address from the NWC connection secret for the QR code.

<img width="1432" height="806" alt="image" src="https://github.com/user-attachments/assets/979a3034-99ac-4481-8e32-9750486eb996" />

### Testing

#### Example test for a backend or console app

> Use the Alby Bitcoin Payments Agent Skill to create a TypeScript console app where Alice creates an invoice and Bob pays it. Write tests for it using jest.

#### Example test for a frontend app (vitest + Playwright)

> Use the Alby Bitcoin Payments Agent Skill to create a Vite TypeScript React app where a user can connect their wallet and then purchase fake cat pictures (simple canvas art) with a single click. Each picture costs 5000 sats. Show the total the shop has earned and their remaining stock of cat pictures. There should only be 21. Write tests for the app using vitest and playwright. Also take screenshots and review the screenshots.

## Development

Examples are hand-written, but lack the necessary typing information. Types are copied directly from the referenced projects using [this script](./regenerate-types.sh)
