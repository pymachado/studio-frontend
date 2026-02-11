# ASIMOV VAULT MANAGER - Technical Documentation

Welcome to the ASIMOV Vault Manager, a decentralized application (dApp) built on the Solana blockchain. This application allows users to manage "Founder Pass NFTs" and their associated token vaults in a secure and intuitive way.

## Core Technologies

-   **Frontend**: Next.js, React, TypeScript
-   **UI/Styling**: ShadCN UI, Tailwind CSS
-   **Blockchain**: Solana
-   **Smart Contracts**: Anchor Framework
-   **NFT Interaction**: Metaplex UMI (Unified Metaplex Interface)
-   **Wallet Connection**: Solana Wallet Adapter

---

## General Application Flow

The dashboard is designed to be the main interface for interacting with the smart contract deployed on the Solana Devnet. All business logic and communication with the blockchain are centralized in the `src/hooks/use-solana.tsx` hook.

### 1. Wallet Connection

The application begins by asking the user to connect their Solana wallet (such as Phantom, Solflare, etc.).

-   **How it works**: We use the `@solana/wallet-adapter-react` library set. The `WalletProvider` component wraps the application and provides the necessary context for the `WalletConnect` button to manage the connection flow.
-   Once connected, the `useAnchorWallet` hook provides us with the `wallet` object, which is essential for signing transactions and authenticating the user with the program.

### 2. Dashboard Loading and User Data

Once the wallet is connected, the dashboard comes to life.

-   **How it works**:
    1.  The `fetchProgramData` function in `use-solana.tsx` is triggered.
    2.  It uses the `fetchAssetsByOwner` function from Metaplex UMI to query the blockchain and get a list of all NFTs owned by the connected wallet address.
    3.  For each NFT found, the application attempts to fetch its associated vault account (`FounderVault`), which is a PDA (Program Derived Address) derived from the NFT's mint.
    4.  If the vault exists, its `ASMV` token balance is displayed. If it doesn't exist, a button to "Initialize Vault" is shown.
    5.  The balances of all vaults are summed to display the "Total Balance," and the number of NFTs is counted for the "NFTs Owned" statistic.

### 3. Core Features

#### a. Minting a New Founder Pass NFT

This is the most complex and robust feature of the demo, as it combines two operations (creating an NFT and creating its vault) into **a single atomic transaction**.

-   **Key Function**: `onMint()` in `src/hooks/use-solana.tsx`.
-   **Minting Mechanism**:
    1.  **Global Counter**: Before creating the NFT, the function queries a global PDA account called `counter_vault` in the program. This account keeps track of how many NFTs have been created, allowing for a unique ID to be assigned to the new NFT (e.g., "Founder Pass NFT #5").
    2.  **Instruction Creation (UMI)**: The `create` function from Metaplex UMI is used to generate the necessary blockchain instructions to create a new Core NFT. Its metadata is defined in this phase:
        *   **Name**: Generated dynamically using the counter (e.g., `Founder Pass NFT #${count + 1}`).
        *   **URI**: The image and other metadata point to a fixed URL on IPFS.
        *   **Royalties (5%)**: A `Royalties` plugin is configured with `basisPoints: 500`. This permanently records a 5% royalty on the NFT, which will be paid to the creator on all secondary sales in compatible marketplaces.
    3.  **Instruction Creation (Anchor)**: Simultaneously, instructions are generated to call the `init_vault` function of the Anchor program. This instruction creates the `FounderVault` account (a PDA) associated with the NFT that is about to be created.
    4.  **Atomic Transaction**: The UMI and Anchor instructions are bundled into a single Solana transaction. The transaction requires two signatures: the user's (who pays the fees) and the `assetSigner`'s (a new keypair generated to be the NFT's address).
    5.  **Confirmation**: The transaction is sent and confirmed. If either of the two operations fails (the mint or the vault creation), the entire transaction is reverted, ensuring that an NFT never exists without its corresponding vault.

#### b. Deposit Tokens

Allows an NFT owner to deposit `ASMV` tokens into that NFT's vault.

-   **Key Function**: `onAction(..., actionType: 'Deposit')`
-   **How it works**:
    1.  The user enters an amount.
    2.  The function calls the `depositSpl` instruction of the Anchor program.
    3.  The program verifies that the transaction signer is the owner of the NFT associated with the vault.
    4.  A transfer of `ASMV` tokens is executed from the user's wallet to the vault's token account (which is controlled by the program).

#### c. Redeem Tokens

Allows an NFT owner to withdraw `ASMV` tokens from their vault.

-   **Key Function**: `onAction(..., actionType: 'Redeem')`
-   **How it works**:
    1.  The user enters an amount.
    2.  The function calls the `redeemSpl` instruction of the program.
    3.  After verifying NFT ownership, the program (acting as the vault's authority) signs the token transfer from the vault back to the user's wallet.

#### d. Initialize Vault

This function is for the use case where a user acquires an NFT on a secondary market and the vault was not created during the initial minting.

-   **Key Function**: `onInitialize()`
-   **How it works**: It calls the same `init_vault` instruction used during minting, but in a separate transaction. This allows any new owner to create the vault for their NFT if it doesn't exist.

### 4. Real-Time Updates (Subscriptions)

To ensure the UI reflects the state of the blockchain without needing a page reload, Solana WebSockets are used.

-   **Subscription to Vault Changes**:
    -   The hook subscribes to changes in each of the user's `FounderVault` accounts.
    -   When a vault's balance changes (due to a deposit or redeem), the listener is triggered and calls `fetchProgramData()` to reload all information and update the UI.

-   **Handling NFT Transfers (Automatic Synchronization)**:
    -   This is a key mechanism for maintaining real-time data consistency. The hook also subscribes to the **NFT's token account** in the user's wallet.
    -   If the user transfers or sells the NFT, that token account is closed (its `data` becomes `null`).
    -   The listener detects this change, understands that the NFT no longer belongs to the user, and triggers `fetchProgramData()`. This removes the NFT from the user's view and prevents them from interacting with a vault they no longer own.