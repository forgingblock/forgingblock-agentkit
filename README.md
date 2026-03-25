# ForgingBlock AI Payment Agent

This repository demonstrates how to build an **AI-powered crypto payment agent** using:

* **ForgingBlock payment APIs**
* **Coinbase AgentKit**
* **Privy embedded wallets**
* **OpenAI models**

The agent can:

* create orders
* resolve checkout links into blockchain transactions
* execute payments
* verify payment status

This project is a **reference implementation** showing how AI agents can interact with ForgingBlock crypto payment infrastructure.

## Quick Demo

#### Create Order

![Create Order](img/order.png)

#### AI Payment Flow

![AI Payment Flow](img/payment.gif)

#### WooCommerce AI Agent Buy

![Woocommerce](img/woocommerce.gif)

# Installation

Clone the repository:

```sh
git clone https://github.com/forgingblock/forgingblock-agentkit.git
cd forgingblock-agentkit
```

Install dependencies:

```sh
npm install
```

# Environment Setup

Create a `.env` file in the project root.

Example:

```env
OPENAI_API_KEY=

PRIVY_APP_ID=
PRIVY_APP_SECRET=

FB_API_KEY=

NETWORK_ID=base-mainnet
```

## OPENAI_API_KEY

API key used for the AI model.

## PRIVY_APP_ID

## PRIVY_APP_SECRET

Credentials for **Privy embedded wallets**.

You could create in [Privy dashboard](https://dashboard.privy.io/):

## FB_API_KEY (optional)

Merchant API key used to create orders.

Create an API key in the [dashboard](https://dash.forgingblock.io):

**Dashboard → Account Settings → Integrations → API Token**

If this variable is **not defined**, the agent can still perform payments but cannot create orders.

## NETWORK_ID

Network used by the wallet provider.

Example:

```
NETWORK_ID=base-mainnet
```

# Run the Development Server

Start the development server:

```sh
npm run dev
```

Open the application:

```
http://localhost:3000
```

# Architecture Overview

```
User / AI Agent
        │
        ▼
Next.js Agent API
(app/api/agent)
        │
        ▼
AgentKit Tools
(create_order / create_payment / verify_payment)
        │
        ▼
ForgingBlock API
(api.forgingblock.io)
        │
        ▼
Blockchain (Base / EVM networks)
```

---

# Hybrid Execution Model

```
User Input
   │
   ├── WooCommerce URL ───────────────┐
   │                                 ▼
   │                         woo_prepare_checkout
   │                                 │
   │                                 ▼
   │                         create_payment (forced)
   │                                 │
   │                                 ▼
   │                         Store Payment State
   │                                 │
   │                                 ▼
   │                         Execute / Confirm
   │
   └── ForgingBlock Checkout ────────┐
                                     ▼
                              generateText (LLM)
                                     │
                        ┌────────────┴────────────┐
                        ▼                         ▼
               toolResults present        toolResults missing
                        │                         │
                        ▼                         ▼
               create_payment OK        fallback → extract invoice
                        │                         │
                        ▼                         ▼
                     Store State         force create_payment
                        │                         │
                        └───────────────┬─────────┘
                                        ▼
                                 Execute Payment
```

---

# Wallet Support

This example uses Privy embedded wallets, but AgentKit supports multiple wallet providers.

---

# System Prompt Behavior

## Payment Resolution

Agent attempts to call:

```
create_payment
```

If tool call is missing, fallback extracts invoice and retries.

---

## WooCommerce Checkout

Flow:

1. detect URL
2. call:

```
woo_prepare_checkout
```

3. call:

```
create_payment
```

---

## Payment Confirmation

Supports:

Manual confirmation OR auto execution based on intent.

---

## Transaction Execution

Uses:

```
ERC20ActionProvider_transfer
```

---

## Payment Verification

```
verify_payment
```

Status:

```
completed
```

---

# Available Agent Actions

## create_order

Creates new order.

## create_payment

Returns:

- invoiceId
- invoiceUrl
- network
- token
- amount
- recommendedTx
- verifyUrl

## verify_payment

Checks payment status.

---

# Example Flow

```
checkout → create_payment → confirm/auto → transfer → verify → completed
```

---

# Chat Session Storage

In-memory. Use Redis in production.

---

# Production Improvements

This project can be extended with:

### Persistent Session Storage

- **Redis**
- **PostgreSQL**

### Payment Webhooks

API Reference [Webhook callback](https://forgingblock.readme.io/reference/payment-callback) section:

Handle events such as:
invoice `completed`
invoice `partially_paid`

---

# Disclaimer

This repository is an **example implementation** demonstrating how AI agents can integrate with the ForgingBlock payment infrastructure.

It is intended for experimentation and developer reference.

Production deployments should include additional security, validation, and persistence layers.
