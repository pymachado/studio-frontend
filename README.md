# ASIMOV VAULT MANAGER - Documentación Técnica

Bienvenido al gestor de bóvedas de ASIMOV, una aplicación descentralizada (dApp) construida sobre la blockchain de Solana. Esta aplicación permite a los usuarios gestionar "Founder Pass NFTs" y sus bóvedas de tokens asociadas de una manera segura e intuitiva.

## Tecnologías Principales

-   **Frontend**: Next.js, React, TypeScript
-   **UI/Estilos**: ShadCN UI, Tailwind CSS
-   **Blockchain**: Solana
-   **Smart Contracts**: Anchor Framework
-   **Interacción NFT**: Metaplex UMI (Unified Metaplex Interface)
-   **Conexión de Wallet**: Solana Wallet Adapter

---

## Flujo General de la Aplicación

El dashboard está diseñado para ser la interfaz principal de interacción con el programa (smart contract) desplegado en la Devnet de Solana. Toda la lógica de negocio y comunicación con la blockchain está centralizada en el hook `src/hooks/use-solana.tsx`.

### 1. Conexión de la Wallet

La aplicación comienza solicitando al usuario que conecte su wallet de Solana (como Phantom, Solflare, etc.).

-   **Cómo funciona**: Utilizamos el conjunto de librerías de `@solana/wallet-adapter-react`. El componente `WalletProvider` envuelve la aplicación y proporciona el contexto necesario para que el botón `WalletConnect` gestione el flujo de conexión.
-   Una vez conectado, el hook `useAnchorWallet` nos proporciona el objeto `wallet`, que es esencial para firmar transacciones y autenticar al usuario ante el programa.

### 2. Carga del Dashboard y Datos del Usuario

Una vez que la wallet está conectada, el dashboard cobra vida.

-   **Cómo funciona**:
    1.  La función `fetchProgramData` en `use-solana.tsx` se activa.
    2.  Utiliza la función `fetchAssetsByOwner` de Metaplex UMI para consultar la blockchain y obtener una lista de todos los NFTs que pertenecen a la dirección de la wallet conectada.
    3.  Para cada NFT encontrado, la aplicación intenta obtener la cuenta de su bóveda asociada (`FounderVault`), que es una PDA (Program Derived Address) derivada del mint del NFT.
    4.  Si la bóveda existe, se muestra su saldo de tokens `ASMV`. Si no existe, se muestra un botón para "Inicializar Bóveda".
    5.  Se suman los saldos de todas las bóvedas para mostrar el "Balance Total" y se cuenta el número de NFTs para la estadística "NFTs Owned".

### 3. Funcionalidades Principales

#### a. Acuñar (Mint) un Nuevo NFT Founder Pass

Esta es la funcionalidad más compleja y robusta de la demo, ya que combina dos operaciones (crear un NFT y crear su bóveda) en **una sola transacción atómica**.

-   **Función Clave**: `onMint()` en `src/hooks/use-solana.tsx`.
-   **Mecanismo de Minteo**:
    1.  **Contador Global**: Antes de crear el NFT, la función consulta una cuenta PDA global llamada `counter_vault` en el programa. Esta cuenta lleva un registro de cuántos NFTs se han creado, lo que permite asignar un ID único al nuevo NFT (ej: "Founder Pass NFT #5").
    2.  **Creación de Instrucciones (UMI)**: Se utiliza la función `create` de Metaplex UMI para generar las instrucciones de blockchain necesarias para crear un nuevo Core NFT. En esta fase se define su metadata:
        *   **Nombre**: Se genera dinámicamente usando el contador (ej: `Founder Pass NFT #${count + 1}`).
        *   **URI**: La imagen y otros metadatos apuntan a una URL fija en IPFS.
        *   **Royalties (5%)**: Se configura un plugin de `Royalties` con `basisPoints: 500`. Esto graba permanentemente una regalía del 5% en el NFT, que se pagará al creador en todas las ventas secundarias en marketplaces compatibles.
    3.  **Creación de Instrucciones (Anchor)**: Simultáneamente, se generan las instrucciones para llamar a la función `init_vault` del programa Anchor. Esta instrucción crea la cuenta `FounderVault` (una PDA) asociada al NFT que se está a punto de crear.
    4.  **Transacción Atómica**: Las instrucciones de UMI y Anchor se empaquetan en una única transacción de Solana. La transacción requiere dos firmas: la del usuario (que paga las tasas) y la del `assetSigner` (una nueva keypair generada para ser la dirección del NFT).
    5.  **Confirmación**: La transacción se envía y confirma. Si alguna de las dos operaciones falla (el minteo o la creación de la bóveda), la transacción entera se revierte, garantizando que nunca exista un NFT sin su bóveda correspondiente.

#### b. Depositar Tokens (Deposit)

Permite al dueño de un NFT depositar tokens `ASMV` en la bóveda de ese NFT.

-   **Función Clave**: `onAction(..., actionType: 'Deposit')`
-   **Cómo funciona**:
    1.  El usuario introduce una cantidad.
    2.  La función llama a la instrucción `depositSpl` del programa Anchor.
    3.  El programa verifica que el firmante de la transacción sea el dueño del NFT asociado a la bóveda.
    4.  Se ejecuta una transferencia de tokens `ASMV` desde la wallet del usuario a la cuenta de tokens de la bóveda (que es controlada por el programa).

#### c. Canjear Tokens (Redeem)

Permite al dueño de un NFT retirar los tokens `ASMV` de su bóveda.

-   **Función Clave**: `onAction(..., actionType: 'Redeem')`
-   **Cómo funciona**:
    1.  El usuario introduce una cantidad.
    2.  La función llama a la instrucción `redeemSpl` del programa.
    3.  Tras verificar la propiedad del NFT, el programa (actuando como autoridad de la bóveda) firma la transferencia de tokens desde la bóveda de vuelta a la wallet del usuario.

#### d. Inicializar Bóveda

Esta función es para el caso de uso en que un usuario adquiere un NFT en un mercado secundario y la bóveda no fue creada durante el minteo inicial.

-   **Función Clave**: `onInitialize()`
-   **Cómo funciona**: Llama a la misma instrucción `init_vault` que se usa durante el minteo, pero en una transacción separada. Esto permite a cualquier nuevo propietario crear la bóveda para su NFT si no existe.

### 4. Actualizaciones en Tiempo Real (Suscripciones)

Para que la UI refleje el estado de la blockchain sin necesidad de recargar la página, se utilizan WebSockets de Solana.

-   **Suscripción a Cambios en la Bóveda**:
    -   El hook se suscribe a los cambios en cada cuenta `FounderVault` del usuario.
    -   Cuando el saldo de una bóveda cambia (por un depósito o canje), el listener se activa y llama a `fetchProgramData()` para recargar toda la información y actualizar la UI.

-   **Manejo de Transferencias de NFT (Sincronización Automática)**:
    -   Este es un mecanismo clave para mantener la consistencia de los datos en tiempo real. El hook también se suscribe a la **cuenta de token del NFT** que está en la wallet del usuario.
    -   Si el usuario transfiere o vende el NFT, esa cuenta de token se cierra (su `data` se vuelve `null`).
    -   El listener detecta este cambio, entiende que el NFT ya no pertenece al usuario, y dispara `fetchProgramData()`. Esto elimina el NFT de la vista del usuario y le impide interactuar con una bóveda que ya no le corresponde.
