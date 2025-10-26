'use client';
import { useEffect, useState, useCallback, useRef } from 'react';
import idl from '@/lib/idl.json';
import { useConnection, useAnchorWallet } from '@solana/wallet-adapter-react';
import { Program, AnchorProvider, setProvider, BN } from '@project-serum/anchor';
import { toast } from 'react-toastify';
import { PublicKey, SystemProgram } from '@solana/web3.js';
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
            const programInstance = new Program(idl as any, PROGRAM_ID, provider);
            setProgram(programInstance);

            const newUmiWithWallet = createUmi(connection.rpcEndpoint).use(walletAdapterIdentity(wallet));
            newUmiWithWallet.use(mplCore());
            setUmi(newUmiWithWallet);
        } else {
            setProgram(null);
            setProvider(null);
            setNfts([]);
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
            const assets = await fetchAssetsByOwner(umi, wallet.publicKey);
            console.log(`Found ${assets.length} assets.`);

            const nftDetailsPromises = assets.map(async (asset) => {
                 try {
                    const metadata = await fetch(asset.uri).then(res => res.json());
                    return {
                        id: asset.publicKey.toString(),
                        name: asset.name,
                        mintAddress: asset.publicKey.toString(),
                        uri: asset.uri,
                        imageUrl: metadata.image,
                    };
                } catch (e) {
                    console.error("Error processing asset metadata:", asset.name, e);
                    return { // Fallback if URI fetch fails
                        id: asset.publicKey.toString(),
                        name: asset.name,
                        mintAddress: asset.publicKey.toString(),
                        uri: asset.uri,
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
                        imageId: `mockId${index}` // Using index for mock id
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
            
            if (assets.length > 0 && nfts.length === 0) {
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

    // Subscription logic
    useEffect(() => {
        if (!program || nfts.length === 0) return;

        const newSubscriptions = new Map<string, number>();

        nfts.forEach(nft => {
            const pda = new PublicKey(nft.pda);
            if (subscriptionIds.current.has(pda.toString())) {
                // Keep existing subscription
                newSubscriptions.set(pda.toString(), subscriptionIds.current.get(pda.toString())!);
                subscriptionIds.current.delete(pda.toString());
            } else {
                // Create new subscription
                console.log(`Subscribing to PDA: ${pda.toString()}`)
                const subId = program.provider.connection.onAccountChange(
                    pda,
                    (accountInfo) => {
                        console.log(`Account change detected for ${pda.toString()}`);
                        const updatedVault = program.coder.accounts.decode('FounderVault', accountInfo.data);
                        
                        setNfts(prevNfts => {
                            const newNfts = prevNfts.map(n => {
                                if (n.pda === pda.toString()) {
                                    return { ...n, vaultBalance: uiBalance(updatedVault.balance) };
                                }
                                return n;
                            });
                            const newTotal = newNfts.reduce((acc, nft) => acc + nft.vaultBalance, 0);
                            setTotalBalance(newTotal);
                            return newNfts;
                        });
                    },
                    "confirmed"
                );
                newSubscriptions.set(pda.toString(), subId);
            }
        });

        // Unsubscribe from old PDAs
        subscriptionIds.current.forEach((subId, pda) => {
            console.log(`Unsubscribing from old PDA: ${pda}`);
            program.provider.connection.removeAccountChangeListener(subId);
        });

        // Update the ref to the new subscriptions
        subscriptionIds.current = newSubscriptions;

        // Cleanup on component unmount
        return () => {
            console.log("Cleaning up subscriptions");
            subscriptionIds.current.forEach((subId, pda) => {
                console.log(`Unsubscribing from ${pda}`);
                program.provider.connection.removeAccountChangeListener(subId);
            });
            subscriptionIds.current.clear();
        };

    }, [program, nfts]);


    const onAction = async (mint: string, pda: string, amount: number, actionType: 'Deposit' | 'Redeem') => {
        if (!program || !wallet || !provider) {
            toast.error("Program or wallet not initialized.");
            throw new Error("Program or wallet not initialized.");
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
            
            await connection.confirmTransaction(txSignature, 'confirmed');

        } catch (error) {
            console.error(`Error during ${actionType}:`, error);
            throw error;
        }
    };
    
    const onMint = async (name: string, uri: string) => {
        if (!program || !wallet) {
            throw new Error("Wallet or Program not connected.");
        }
        
        console.log("Simulating mint for:", name, uri);
        
        // This is a placeholder. In a real app, you would mint the NFT
        // and then call `init_vault` on your program.
        
        await fetchProgramData();
    };

    return { isFetching, totalBalance, nfts, nftCount: nfts.length, onAction, onMint };
};
