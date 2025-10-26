'use client';
import { useEffect, useState, useCallback, useRef } from 'react';
import idl from '@/lib/idl.json';
import { useConnection, useAnchorWallet } from '@solana/wallet-adapter-react';
import { Program, AnchorProvider, setProvider, BN } from '@coral-xyz/anchor';
import { toast } from 'react-toastify';
import { PublicKey, SystemProgram, Transaction } from '@solana/web3.js';
import { getAssociatedTokenAddress } from '@solana/spl-token';
import { createUmi } from '@metaplex-foundation/umi-bundle-defaults';
import { walletAdapterIdentity } from '@metaplex-foundation/umi-signer-wallet-adapters';
import { fetchAssetsByOwner, mplCore } from '@metaplex-foundation/mpl-core';
import { Buffer } from 'buffer';

if (typeof window !== 'undefined') {
    window.Buffer = window.Buffer || Buffer;
}

const PROGRAM_ID = new PublicKey(idl.address);
const ASMV_MINT = new PublicKey("G9ttBfF3a2Mkw5bH31aQk2y532mJgA6G4rj6sA2a7x95");
const DECIMALS = 6;

export interface Nft {
    id: string;
    name: string;
    mintAddress: string;
    vaultBalance: number;
    imageId: string;
    pda: string;
    uri: string;
}

export const useSolana = () => {
    const { connection } = useConnection();
    const wallet = useAnchorWallet();
    const [program, setProgram] = useState<Program<typeof idl> | null>(null);
    const [provider, setProvider] = useState<AnchorProvider | null>(null);
    const [umi, setUmi] = useState<any>(null);

    const [isFetching, setIsFetching] = useState(true);
    const [totalBalance, setTotalBalance] = useState(0);
    const [nfts, setNfts] = useState<Nft[]>([]);
    const [nftCount, setNftCount] = useState(0);

    const vaultSubscriptionIds = useRef<Map<string, number>>(new Map());

    // Initialize Umi
    useEffect(() => {
        const newUmi = createUmi(connection.rpcEndpoint).use(mplCore());
        setUmi(newUmi);
    }, [connection.rpcEndpoint]);
    
    // Initialize Anchor Program and Umi wallet
    useEffect(() => {
        if (wallet && connection && umi) {
            const provider = new AnchorProvider(connection, wallet, { commitment: 'confirmed' });
            setProvider(provider);
            const programInstance = new Program(idl as any, PROGRAM_ID, provider);
            setProgram(programInstance);

            const newUmiWithWallet = createUmi(connection.rpcEndpoint).use(walletAdapterIdentity(wallet));
            newUmiWithWallet.use(mplCore());
            setUmi(newUmiWithWallet);
        } else {
            setProgram(null);
            setProvider(null);
            setNfts([]);
            setNftCount(0);
            setTotalBalance(0);
            setIsFetching(false);
        }
    }, [wallet, connection]);


    const uiBalance = (balanceBN: BN) => {
        if (!balanceBN) return 0;
        const divisor = new BN(10).pow(new BN(DECIMALS));
        const balanceNumber = balanceBN.toNumber() / divisor.toNumber();
        return balanceNumber;
    }

    const fetchProgramData = useCallback(async () => {
        if (!umi || !wallet || !program) return;

        setIsFetching(true);
        console.log('Fetching data for wallet:', wallet.publicKey.toString());
        
        try {
            // 1. Fetch NFTs owned by the wallet
            const assets = await fetchAssetsByOwner(umi, wallet.publicKey);
            console.log(`Found ${assets.length} assets.`);
            
            const nftDetailsPromises = assets.map(async (asset) => {
                try {
                    return {
                        id: asset.publicKey.toString(),
                        name: asset.name,
                        mintAddress: asset.publicKey.toString(),
                        uri: asset.uri,
                    };
                } catch (e) {
                    console.error("Error processing asset metadata:", e);
                    return null;
                }
            });

            const fetchedNftDetails = (await Promise.all(nftDetailsPromises)).filter(Boolean) as any[];

            // 2. Find PDAs and fetch vault data for each NFT
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
                        imageId: `nft${(index % 5) + 1}`,
                    };
                } catch (error) {
                    // It's normal for a vault not to exist yet if it hasn't been initialized.
                    return {
                        ...nft,
                        pda: founderVaultPda.toString(),
                        vaultBalance: 0,
                        imageId: `nft${(index % 5) + 1}`,
                        needsInitialization: true, // Flag to indicate vault needs creation
                    };
                }
            });

            const allVaultData = await Promise.all(vaultDataPromises);
            const validNfts = allVaultData.filter(v => v !== null) as Nft[];
            
            setNfts(validNfts);
            setNftCount(validNfts.length);

            const total = validNfts.reduce((acc, nft) => acc + nft.vaultBalance, 0);
            setTotalBalance(total);
            
            if (assets.length > 0 && nfts.length === 0) { // Only show initial load toast
              toast.success(`Loaded ${assets.length} NFTs and their vaults.`);
            }

        } catch (error) {
            console.error('Error fetching program data:', error);
            toast.error('Failed to fetch wallet data.');
        } finally {
            setIsFetching(false);
        }
    }, [umi, wallet, program]);

    useEffect(() => {
        if(wallet && umi && program) {
            fetchProgramData();
        }
    }, [wallet, umi, program, fetchProgramData]);


    const onAction = async (mint: string, pda: string, amount: number, actionType: 'Deposit' | 'Redeem') => {
        if (!program || !wallet || !provider) {
            toast.error("Program or wallet not initialized.");
            return;
        }

        const nftMint = new PublicKey(mint);
        const founderVault = new PublicKey(pda);
        const lamports = new BN(amount * (10 ** DECIMALS));

        try {
            let txSignature;
            const userAsmvAccount = await getAssociatedTokenAddress(ASMV_MINT, wallet.publicKey);
            const asmvFounderVault = await getAssociatedTokenAddress(ASMV_MINT, founderVault, true);

            if (actionType === 'Deposit') {
                console.log('Depositing:', {
                    user: wallet.publicKey.toString(),
                    nftMint: nftMint.toString(),
                    founderVault: founderVault.toString(),
                    userAsmvAccount: userAsmvAccount.toString(),
                    asmvFounderVault: asmvFounderVault.toString(),
                    asmvMint: ASMV_MINT.toString(),
                })
                txSignature = await program.methods
                    .depositSpl(lamports)
                    .accounts({
                        user: wallet.publicKey,
                        nftMint: nftMint,
                        founderVault: founderVault,
                        userAsmvAccount: userAsmvAccount,
                        asmvFounderVault: asmvFounderVault,
                        asmvMint: ASMV_MINT,
                        systemProgram: SystemProgram.programId,
                    })
                    .rpc();
            } else { // Redeem
                 txSignature = await program.methods
                    .redeemSpl(lamports)
                    .accounts({
                        user: wallet.publicKey,
                        founderVault: founderVault,
                        nftMint: nftMint,
                        asmvMint: ASMV_MINT,
                        asmvFounderVault: asmvFounderVault,
                        userAsmvAccount: userAsmvAccount,
                        systemProgram: SystemProgram.programId,
                    })
                    .rpc();
            }
            
            const toastId = toast.loading("Processing transaction...");
            await connection.confirmTransaction(txSignature, 'confirmed');
            toast.update(toastId, { render: `${actionType} successful!`, type: "success", isLoading: false, autoClose: 5000 });

            // Refetch data to update UI
            await fetchProgramData();

        } catch (error) {
            console.error(`Error during ${actionType}:`, error);
            toast.error(`${actionType} failed: ${(error as Error).message}`);
        }
    };
    
    const onMint = async (name: string, uri: string) => {
        if (!program || !wallet) {
            toast.error("Wallet or Program not connected.");
            return;
        }
        const toastId = toast.loading("Minting NFT... this can take a moment.");
        
        // This is a placeholder for actual minting logic.
        // In a real app, you would use UMI or another library to create and mint the NFT.
        // For now, we'll just simulate the creation and vault initialization.
        
        try {
            // Because we can't actually mint, we can't get a new mint address.
            // We will just show a success message and refetch the (unchanged) data.
            console.log("Simulating mint for:", name, uri);
            
            // In a real scenario, after minting you would get a new `nftMint` PublicKey
            // and then call the `init_vault` instruction.
            /*
            const [founderVaultPda] = PublicKey.findProgramAddressSync(
                [Buffer.from('founder_vault'), nftMint.toBuffer()],
                program.programId
            );
            const asmvVault = await getAssociatedTokenAddress(ASMV_MINT, founderVaultPda, true);

            const tx = await program.methods.initVault()
                .accounts({
                    user: wallet.publicKey,
                    nftMint: nftMint,
                    asmvMint: ASMV_MINT,
                    founderVault: founderVaultPda,
                    asmvVault: asmvVault,
                    // counterVault might need to be handled if it's per-user or global
                })
                .rpc();
            await connection.confirmTransaction(tx, 'confirmed');
            */

            toast.update(toastId, { render: "NFT Minted (Simulated)!", type: "success", isLoading: false, autoClose: 5000 });
            
            await fetchProgramData();

        } catch (error) {
            console.error("Minting failed:", error);
            toast.update(toastId, { render: `Minting failed: ${(error as Error).message}`, type: "error", isLoading: false, autoClose: 5000 });
        }
    };


    return { isFetching, totalBalance, nfts, nftCount, onAction, onMint };
};
