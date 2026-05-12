# Quantum Vault

Quantum Vault by [Project Eleven](https://projecteleven.com/) provides sensible quantum security on Bitcoin & Ethereum today.

Built for the quantum era, Quantum Vault keeps BTC and ETH protected behind hash functions, monitors for public key exposure, and warns you when a vault becomes vulnerable.

Quantum Vault is a practical first step to reduce exposure today while the ecosystem moves toward full post-quantum security.

> This is a reference implementation rather than a production wallet. The code has been audited by Cure53.

## Install

1. Download `chrome-extension.zip` from the latest [release](https://github.com/p-11/quantum-vault/releases) and unzip it.
2. Open `chrome://extensions/`, toggle **Developer mode** on, click **Load unpacked**, and select the unzipped folder.

Works on Chrome and other Chromium browsers (Brave, Edge, Arc).

## Build From Source

Requires [Node.js](https://nodejs.org/en) and [pnpm](https://pnpm.io/).

```sh
git clone https://github.com/p-11/quantum-vault.git
cd quantum-vault
cp .env.example .env   # fill in the values
pnpm install
pnpm build:dev         # output in build/
```

Then load `build/` as an unpacked extension. See `.env.example` for the required environment variables.

For local development with HMR: `pnpm dev`.

## Issues

File bugs on [GitHub Issues](https://github.com/p-11/quantum-vault/issues). For security disclosures, contact Project Eleven directly.

## License

[MIT](./LICENSE)
