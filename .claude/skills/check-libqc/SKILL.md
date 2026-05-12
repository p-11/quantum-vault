---
name: check-libqc
description: >-
  Search the sibling `libqc` SDK for public exports, chain resolvers, storage interfaces,
  and type definitions before implementing or modifying anything in quantum-vault that
  consumes the SDK. Use to verify API field semantics and exported surface.
argument-hint: '[search-term or feature-name]'
---

# Check libqc

quantum-vault consumes `@project-eleven/libqc` as a pinned published package (see `package.json`). SDK removals or renames break the extension at build time or, worse, at runtime. Verify the SDK surface before assuming a function/type exists.

## Repo Path

For source-level verification, `libqc` must be checked out as a sibling of this repo in the same parent directory. All commands below assume you run them from the `quantum-vault` repo root, so `../libqc` always resolves to the SDK checkout. The installed version in `node_modules` must match `package.json` (enforced by `pnpm verify:libqc-source`); do not substitute with `file:`/`link:`/`workspace:` overrides.

| Repo  | Location (relative to quantum-vault repo root) |
| ----- | ---------------------------------------------- |
| libqc | `../libqc`                                     |

## What to Search (per layer)

| Layer                  | Path                 | What to find                                      |
| ---------------------- | -------------------- | ------------------------------------------------- |
| Public API             | `src/index.ts`       | The SDK boundary. Everything the extension consumes exits through here. |
| Chain dispatch         | `src/chain/`         | `getChainKind`, chain registries, chain unions    |
| Resolvers              | `src/*/resolver.ts`  | Resolver contracts (input -> output)              |
| Resolver implementations | `src/*/resolvers/`  | Per-kind implementations (`evm.ts`, `solana.ts`, `bitcoin.ts`) |
| Storage                | `src/state.ts`       | Encrypted vault persistence + storage interfaces  |
| Validators / AA        | `src/zeroDev/`       | Account abstraction, validator configuration      |
| Shared types           | `src/types/`         | `Chain`, `ChainKind`, `CoinKey`, `AccountCoinKey` |
| Crypto                 | `src/cryptography/`  | Key derivation, encryption, AES-GCM + scrypt      |

## Usage

```
/check-libqc [search-term]
```

## Search Strategy

### 1. Verify the export exists

Always start at the SDK boundary:

```bash
# Show all exports
rg -n "^export " ../libqc/src/index.ts
# Search for a specific name in the boundary
rg -n "<search-term>" ../libqc/src/index.ts
```

If the name is not exported from `src/index.ts`, it is not part of the public API and quantum-vault must not import it directly. Either add the export (and own the compatibility) or find an alternative.

### 2. Find the chain-dispatch seam

```bash
rg -n "<search-term>" ../libqc/src/chain/
rg -n "resolver" ../libqc/src/
```

### 3. Read the resolver contract

```bash
rg -n "type .*Resolver" ../libqc/src/**/resolver.ts
```

Verify the input and output shapes the quantum-vault consumer needs to pass and handle.

### 4. Check storage surface

```bash
rg -n "Storage" ../libqc/src/state.ts
```

Confirm serialization expectations for anything that lands in `chrome.storage.local`.

## Output

Report:

1. **Exported name** - does it exist on `src/index.ts`?
2. **Type signatures** - exact input/output types
3. **Field semantics** - for each numeric/discriminated field, what does it mean? (e.g., per-unit vs total, raw vs decoded)
4. **Chain coverage** - which chain kinds have a resolver; which throw on unsupported
5. **Security sensitivity** - is this function in the vault/crypto/AA path? If yes, flag for extra review.
6. **Version / file** - which files define the surface so the caller can verify on the current SDK version

## Rules

- Never infer field meaning from the field name alone - open the resolver implementation
- Never reach past `src/index.ts` from quantum-vault application code (deep imports forbidden)
- If the SDK is missing an export you need, the orchestrator must decide: add it to libqc (new PR) or route around it in quantum-vault
- When changing libqc public API, re-run `pnpm build:dev` and `pnpm test:unit` in quantum-vault against the updated sibling
