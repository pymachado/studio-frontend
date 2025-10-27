'use client';
import { useEffect, useState, useCallback, useRef } from 'react';
import idl from '@/lib/idl.json';
import { useConnection, useAnchorWallet } from '@solana/wallet-adapter-react';
import { Program, AnchorProvider, BN, Idl } from '@coral-xyz/anchor';
import { toast } from 'react-toastify';
import { PublicKey, SystemProgram, Transaction, Keypair } from '@solana/web3.js';
import { getAssociatedTokenAddress, TOKEN_2022_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID, getAssociatedTokenAddressSync, getMint, TOKEN_PROGRAM_ID } from '@solana/spl-token';
import { createUmi } from '@metaplex-foundation/umi-bundle-defaults';
import { walletAdapterIdentity } from '@metaplex-foundation/umi-signer-wallet-adapters';
import { fetchAssetsByOwner, mplCore, create, ruleSet, getAssetWithProof, transferV1 } from '@metaplex-foundation/mpl-core';
import { generateSigner, Signer } from '@metaplex-foundation/umi';
import { toWeb3JsInstruction, toWeb3JsKeypair } from '@metaplex-foundation/umi-web3js-adapters';

import { Buffer } from 'buffer';
import type { AsimovNftVaults } from '@/lib/types/asimov_nft_vaults';

if (typeof window !== 'undefined') {
    window.Buffer = window.Buffer || Buffer;
}

const PROGRAM_ID = new PublicKey(idl.address);
// This is a placeholder, as the actual mint is defined on contract init.
const ASMV_MINT = new PublicKey("9RYhX3sHYePZw2QGzP3iM25qcC5kqEqiatCvihGDG5DJ");
const DECIMALS = 6;

export interface Nft {
    id: string; 
    name: string;
    mintAddress: string;
    vaultBalance: number;
    imageId: string;
    pda: string;
    uri: string;
    needsInitialization?: boolean;
}

const balanceOf = async (connection: any, tokenAccount: PublicKey) => {
    try {
        const accountInfo = await connection.getTokenAccountBalance(tokenAccount);
        return new BN(accountInfo.value.amount);
    } catch (error: any) {
        if (error.message.includes('could not find account')) {
            return new BN(0);
        }
        throw error;
    }
}


export const useSolana = () => {
    const { connection } = useConnection();
    const wallet = useAnchorWallet();
    const [program, setProgram] = useState<Program<AsimovNftVaults>>();
    const [provider, setProvider] = useState<AnchorProvider | null>(null);
    const [umi, setUmi] = useState<any>(null);

    const [isFetching, setIsFetching] = useState(true);
    const [totalBalance, setTotalBalance] = useState(0);
    const [nfts, setNfts] = useState<Nft[]>([]);
    
    const subscriptionIds = useRef<Map<string, number>>(new Map());

    // Initialize Umi
    useEffect(() => {
        const newUmi = createUmi(connection.rpcEndpoint).use(mplCore());
        setUmi(newUmi);
    }, [connection.rpcEndpoint]);
    
    // Initialize Anchor Program and Umi wallet
    useEffect(() => {
        if (wallet && connection) {
            const provider = new AnchorProvider(connection, wallet, { commitment: 'confirmed' });
            setProvider(provider);
            const programInstance = new Program(idl as Idl, provider);
            setProgram(programInstance as Program<AsimovNftVaults>);

            const newUmiWithWallet = createUmi(connection.rpcEndpoint).use(walletAdapterIdentity(wallet));
            newUmiWithWallet.use(mplCore());
            setUmi(newUmiWithWallet);
        } else {
            setProgram(undefined);
            setProvider(null);
            setNfts([]);
            setTotalBalance(0);
            setIsFetching(false);
        }
    }, [wallet, connection]);

    const uiBalance = (balanceBN: BN | undefined) => {
        if (!balanceBN) return 0;
        const divisor = new BN(10).pow(new BN(DECIMALS));
        const balanceNumber = balanceBN.toNumber() / divisor.toNumber();
        return balanceNumber;
    }
    
    const onInitialize = async (nft: Nft) => {
        if (!program || !wallet || !provider) {
            toast.error("Program or wallet not initialized.");
            throw new Error("Program or wallet not initialized.");
        }

        const nftMintPubkey = new PublicKey(nft.mintAddress);

        try {
            const [founderVaultPda] = PublicKey.findProgramAddressSync(
                [Buffer.from('founder_vault'), nftMintPubkey.toBuffer()],
                program.programId
            );

            const asmvVaultAta = await getAssociatedTokenAddress(ASMV_MINT, founderVaultPda, true, TOKEN_2022_PROGRAM_ID);

            const txSignature = await program.methods
                .initVault(nftMintPubkey, ASMV_MINT)
                .accounts({
                    user: wallet.publicKey,
                    nftMint: nftMintPubkey,
                    asmvMint: ASMV_MINT,
                    founderVault: founderVaultPda,
                    asmvVault: asmvVaultAta,
                    systemProgram: SystemProgram.programId,
                })
                .rpc();
            
            await connection.confirmTransaction(txSignature, 'confirmed');
            toast.success(`Vault for ${nft.name} initialized successfully!`);
            await fetchProgramData();

        } catch (error) {
            console.error('Error initializing vault:', error);
            toast.error(`Failed to initialize vault: ${(error as Error).message}`);
            throw error;
        }
    };


    const fetchProgramData = useCallback(async () => {
        if (!umi || !wallet || !program) return;

        setIsFetching(true);
        
        try {
            const assets = await fetchAssetsByOwner(umi, wallet.publicKey.toString(), { skipDerivePlugins: false });

            const nftDetailsPromises = assets.map(async (asset) => {
                 try {
                    const response = await fetch(asset.uri);
                    if (!response.ok) {
                        throw new Error(`Failed to fetch metadata: ${response.statusText}`);
                    }
                    const metadata = await response.json();
                    return {
                        id: asset.publicKey.toString(),
                        name: asset.name,
                        mintAddress: asset.publicKey.toString(),
                        uri: metadata.image || '',
                        imageUrl: metadata.image,
                    };
                } catch (e) {
                    console.error("Error processing asset metadata:", asset.name, e);
                    return {
                        id: asset.publicKey.toString(),
                        name: asset.name,
                        mintAddress: asset.publicKey.toString(),
                        uri: '',
                        imageUrl: '',
                    };
                }
            });

            const fetchedNftDetails = await Promise.all(nftDetailsPromises);

            const vaultDataPromises = fetchedNftDetails.map(async (nft, index) => {
                const nftMintPubkey = new PublicKey(nft.mintAddress);
                const [founderVaultPda] = PublicKey.findProgramAddressSync(
                    [Buffer.from('founder_vault'), nftMintPubkey.toBuffer()],
                    program.programId
                );

                try {
                    const vaultAccount = await program.account.founderVault.fetch(founderVaultPda);
                    return {
                        ...nft,
                        pda: founderVaultPda.toString(),
                        vaultBalance: uiBalance(vaultAccount.balance as BN),
                        imageId: `mockId${index}`
                    };
                } catch (error) {
                    return {
                        ...nft,
                        pda: founderVaultPda.toString(),
                        vaultBalance: 0,
                        imageId: `mockId${index}`,
                        needsInitialization: true,
                    };
                }
            });

            const allVaultData = await Promise.all(vaultDataPromises);
            const validNfts = allVaultData.filter(v => v !== null) as Nft[];
            
            setNfts(validNfts);

            const total = validNfts.reduce((acc, nft) => acc + nft.vaultBalance, 0);
            setTotalBalance(total);
            
        } catch (error) {
            console.error('Error fetching program data:', error);
            if (error instanceof Error && !error.message.includes('Wallet-adapter')) {
               // toast.error('Failed to fetch wallet data.');
            }
        } finally {
            setIsFetching(false);
        }
    }, [umi, wallet, program]);

    useEffect(() => {
        if(wallet && umi && program) {
            fetchProgramData();
        }
    }, [wallet, umi, program, fetchProgramData]);

    // Subscription logic
    useEffect(() => {
      if (!wallet || !nfts.length || !connection || !fetchProgramData) return;
  
      const subscribeToVaults = async () => {
          nfts.forEach(vault => {
              if (vault.needsInitialization) return;
              const vaultPda = new PublicKey(vault.pda);
              if (!subscriptionIds.current.has(vaultPda.toString())) {
                  const subscriptionId = connection.onAccountChange(
                      vaultPda,
                      async (accountInfo, context) => {
                          console.log(`Account ${vaultPda.toString()} changed at slot ${context.slot}`);
                          await fetchProgramData(); // Refetch vaults al detectar un cambio
                      },
                      {commitment: 'confirmed'}
                  );
                  subscriptionIds.current.set(vaultPda.toString(), subscriptionId);
                  console.log(`Subscribed to ${vaultPda.toString()} with ID ${subscriptionId}`);
              }
          });
      };
  
      subscribeToVaults();
  
      // Limpieza al desmontar
      return () => {
          subscriptionIds.current.forEach((id, pda) => {
              connection.removeAccountChangeListener(id);
              console.log(`Unsubscribed from ${pda} with ID ${id}`);
          });
          subscriptionIds.current.clear();
      };
  }, [wallet, nfts, connection, fetchProgramData]);


    const onAction = async (mint: string, pda: string, amount: number, actionType: 'Deposit' | 'Redeem') => {
        if (!program || !wallet || !provider) {
            toast.error("Program or wallet not initialized.");
            throw new Error("Program or wallet not initialized.");
        }

        const nftMintPubkey = new PublicKey(mint);
        const founderVaultPda = new PublicKey(pda);
        
        try {
            const decimals = (await getMint(connection, ASMV_MINT, undefined, TOKEN_2022_PROGRAM_ID)).decimals;
            const amountInLamports = new BN(amount * (10 ** decimals));

            if (actionType === 'Deposit') {
                const userAsmvAta = getAssociatedTokenAddressSync(ASMV_MINT, wallet.publicKey, false, TOKEN_2022_PROGRAM_ID);
                const balance = await balanceOf(connection, userAsmvAta);
                
                if (balance.lt(amountInLamports)) {
                    toast.error('Insufficient ASMV balance for the deposit.');
                    return;
                }
    
                const asmvVaultAta = getAssociatedTokenAddressSync(
                    ASMV_MINT,
                    founderVaultPda,
                    true,
                    TOKEN_2022_PROGRAM_ID
                );
    
                const depositInstruction = await program.methods
                    .depositSpl(amountInLamports)
                    .accounts({
                        user: provider.publicKey,
                        nftMint: nftMintPubkey,
                        founderVault: founderVaultPda,
                        userAsmvAccount: userAsmvAta,
                        asmvFounderVault: asmvVaultAta,
                        asmvMint: ASMV_MINT,
                        tokenProgram: TOKEN_2022_PROGRAM_ID,
                        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
                        systemProgram: SystemProgram.programId,
                    })
                    .instruction();
    
                const {blockhash} = await connection.getLatestBlockhash('confirmed');
                const tx = new Transaction().add(depositInstruction);
                tx.recentBlockhash = blockhash;
                tx.feePayer = provider.publicKey;
            
                const txSignature = await provider.sendAndConfirm(tx, [], {skipPreflight: true});
                const SOLSCAN_URL = `https://solscan.io/tx/${txSignature}?cluster=devnet`;
                toast.success(
                    <div>
                        Deposited {amount} ASMV successfully!{' '}
                        <a
                            href={SOLSCAN_URL}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{ color: 'blue', textDecoration: 'underline' }}
                        >
                            View on Solscan
                        </a>
                    </div>,
                    { autoClose: 8000, closeOnClick: false }
                );

            } else if (actionType === 'Redeem') {
                
                const asmvVaultAta = getAssociatedTokenAddressSync(
                    ASMV_MINT,
                    founderVaultPda,
                    true,
                    TOKEN_2022_PROGRAM_ID
                );

                const userAsmvAta = getAssociatedTokenAddressSync(
                    ASMV_MINT,
                    wallet.publicKey,
                    false,
                    TOKEN_2022_PROGRAM_ID
                );

                 const redeemInstruction = await program.methods
                    .redeemSpl(amountInLamports)
                    .accounts({
                        user: provider.publicKey,
                        nftMint: nftMintPubkey,
                        founderVault: founderVaultPda,
                        asmvFounderVault: asmvVaultAta,
                        userAsmvAccount: userAsmvAta,
                        asmvMint: ASMV_MINT,
                        tokenProgram: TOKEN_2022_PROGRAM_ID,
                        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
                        systemProgram: SystemProgram.programId,
                    })
                    .instruction();

                const {blockhash} = await connection.getLatestBlockhash('confirmed');
                const tx = new Transaction().add(redeemInstruction);
                tx.recentBlockhash = blockhash;
                tx.feePayer = provider.publicKey;
                

                const txSignature = await provider.sendAndConfirm(tx, [], {skipPreflight: true});
                const SOLSCAN_URL = `https://solscan.io/tx/${txSignature}?cluster=devnet`;
                toast.success(
                    <div>
                        Redeemed {amount} ASMV successfully!{' '}
                        <a
                            href={SOLSCAN_URL}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{ color: 'blue', textDecoration: 'underline' }}
                        >
                            View on Solscan
                        </a>
                    </div>,
                    { autoClose: 8000, closeOnClick: false }
                );

            }

        } catch (error) {
            console.error(`Error during ${actionType}:`, error);
            throw error;
        }
    };
    
    const onMint = async () => {
        if (!wallet || !umi || !program || !provider) {
            toast.error("Wallet or program not connected/initialized.");
            return;
        }
        
        const toastId = toast.loading("Minting NFT and creating vault...");

        try {
            const [counterVaultPda] = PublicKey.findProgramAddressSync(
                [Buffer.from('counter_vault')],
                program.programId
            );

            const counterData = await program.account.counterVault.fetch(counterVaultPda);
            const currentCount = counterData.count;
            
            // Step 1: Mint NFT with UMI
            const assetSigner = generateSigner(umi);
            const umiMintInstructions = await create(umi, {
                asset: assetSigner,
                name: `Founder Pass NFT #${currentCount + 1}`,
                uri: 'https://azure-petite-swan-479.mypinata.cloud/ipfs/bafkreia6jnqssbuegspkuivfg4y4beh5rfamdlafxeo36y2j3hswh3nxly',
                plugins: [
                    {
                        type: 'Royalties',
                        basisPoints: 500,
                        creators: [
                            {
                                address: wallet.publicKey.toString(), // The creator
                                percentage: 100,
                            },
                        ],
                        ruleSet: ruleSet('None'),
                    },
                ],
            }).getInstructions();

            const nftMintAddress = assetSigner.publicKey;
            const web3JsMintInstructions = umiMintInstructions.map(toWeb3JsInstruction);
            const web3JsAssetSigner = toWeb3JsKeypair(assetSigner as Signer);
        
            const tx = new Transaction().add(...web3JsMintInstructions);

            // Step 2: Initialize Vault with Anchor
            const nftMintPubkey = new PublicKey(nftMintAddress);

            const [founderVaultPda] = PublicKey.findProgramAddressSync(
                [Buffer.from('founder_vault'), nftMintPubkey.toBuffer()],
                program.programId
            );

            const asmvVaultAta = getAssociatedTokenAddressSync(
                ASMV_MINT,
                founderVaultPda,
                true,
                TOKEN_2022_PROGRAM_ID
            );
            
            const initVaultInstruction = await program.methods
                .initVault(nftMintPubkey, ASMV_MINT)
                .accounts({
                    user: provider.publicKey,
                    nftMint: nftMintPubkey,
                    asmvMint: ASMV_MINT,
                    founderVault: founderVaultPda,
                    asmvVault: asmvVaultAta,
                    counterVault: counterVaultPda,
                    tokenProgram: TOKEN_2022_PROGRAM_ID,
                    associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
                    systemProgram: SystemProgram.programId,
                }).instruction();

            tx.add(initVaultInstruction);
            
            const { blockhash } = await connection.getLatestBlockhash('confirmed');
            tx.recentBlockhash = blockhash;
            tx.feePayer = provider.publicKey;
            
            const signature = await provider.sendAndConfirm(tx, [web3JsAssetSigner], {skipPreflight: true});
            
            const VAULT_SOLSCAN_URL = `https://solscan.io/tx/${signature}?cluster=devnet`;

            toast.update(toastId, {
                render: <div>
                    NFT minted and vault created!{' '}
                    <a href={VAULT_SOLSCAN_URL} target="_blank" rel="noopener noreferrer" style={{ color: 'blue', textDecoration: 'underline' }}>
                        View on Solscan
                    </a>
                </div>,
                type: 'success',
                isLoading: false,
                autoClose: 8000,
                closeOnClick: false,
            });

            await fetchProgramData();

        } catch (error) {
            console.error('Error creating NFT or vault:', error);
            toast.update(toastId, {
                render: `Error: ${(error as Error).message}`,
                type: 'error',
                isLoading: false,
                autoClose: 5000,
            });
            throw error;
        }
    };

    return { isFetching, totalBalance, nfts, nftCount: nfts.length, onAction, onMint, onInitialize };
};
