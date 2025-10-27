'use client';
import { useEffect, useState, useCallback, useRef } from 'react';
import idl from '@/lib/idl.json';
import { useConnection, useAnchorWallet } from '@solana/wallet-adapter-react';
import { Program, AnchorProvider, BN } from '@coral-xyz/anchor';
import { toast } from 'react-toastify';
import { PublicKey, SystemProgram, Transaction } from '@solana/web3.js';
import { getAssociatedTokenAddress, createAssociatedTokenAccountInstruction, TOKEN_PROGRAM_ID, getMint, getAccount, ASSOCIATED_TOKEN_PROGRAM_ID } from '@solana/spl-token';
import { createUmi } from '@metaplex-foundation/umi-bundle-defaults';
import { walletAdapterIdentity } from '@metaplex-foundation/umi-signer-wallet-adapters';
import { fetchAssetsByOwner, mplCore } from '@metaplex-foundation/mpl-core';
import { Buffer } from 'buffer';
import type { AsimovNftVaults } from '@/lib/types/asimov_nft_vaults';

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
    needsInitialization?: boolean;
}

async function balanceOf(connection: any, ata: PublicKey) {
    try {
       const ataInfo = await getAccount(connection, ata, 'confirmed');
        return new BN(ataInfo.amount);
    } catch (error: any) {
        console.error("Error fetching balance:", error);
        if (error.name === 'TokenAccountNotFoundError') {
            return new BN(0); // Return 0 if ATA doesn't exist
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
            const programInstance = new Program(idl as any, provider);
            setProgram(programInstance);

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

            const asmvVaultAta = await getAssociatedTokenAddress(ASMV_MINT, founderVaultPda, true);

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
            const assets = await fetchAssetsByOwner(umi, wallet.publicKey);

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
               toast.error('Failed to fetch wallet data.');
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
        if (!program || nfts.length === 0 || !wallet) return;

        const newSubscriptions = new Map<string, number>();

        nfts.forEach(nft => {
            if (nft.needsInitialization) return;

            const pda = new PublicKey(nft.pda);
            if (subscriptionIds.current.has(pda.toString())) {
                newSubscriptions.set(pda.toString(), subscriptionIds.current.get(pda.toString())!);
                subscriptionIds.current.delete(pda.toString());
            } else {
                const subId = program.provider.connection.onAccountChange(
                    pda,
                    (accountInfo) => {
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

        subscriptionIds.current.forEach((subId, pda) => {
            program.provider.connection.removeAccountChangeListener(subId);
        });

        subscriptionIds.current = newSubscriptions;

        return () => {
            subscriptionIds.current.forEach((subId) => {
                program.provider.connection.removeAccountChangeListener(subId);
            });
            subscriptionIds.current.clear();
        };

    }, [program, nfts, wallet]);


    const onAction = async (mint: string, pda: string, amount: number, actionType: 'Deposit' | 'Redeem') => {
        if (!program || !wallet || !provider) {
            toast.error("Program or wallet not initialized.");
            throw new Error("Program or wallet not initialized.");
        }

        try {
            if (actionType === 'Deposit') {
                 if (!amount || amount <= 0) {
                    console.error('Invalid amount');
                    toast.error('Please enter a valid positive amount.');
                    return;
                }

                console.log('Program initialized, Program ID:', program.programId.toString());

                const decimals = (await getMint(connection, ASMV_MINT)).decimals;
                console.log('Token decimals:', decimals);

                const amountInLamports = new BN(amount * (10 ** decimals));
                console.log('Amount to deposit (in smallest unit):', amountInLamports.toString());

                const userAsmvAta = await getAssociatedTokenAddress(ASMV_MINT, wallet.publicKey);
                let balance;
                try {
                    balance = await balanceOf(connection, userAsmvAta);
                    console.log('User ASMV balance:', balance.toString());
                } catch (error: any) {
                    if (error.name === 'TokenAccountNotFoundError') {
                        balance = new BN(0);
                        console.warn('User ASMV ATA not found, balance set to 0');
                    } else {
                        throw error;
                    }
                }
                if (balance.lt(amountInLamports)) {
                    toast.error('Insufficient ASMV balance for the deposit.');
                    return;
                }

                const nftMintPubkey = new PublicKey(mint);
                const [founderVaultPda] = PublicKey.findProgramAddressSync(
                    [Buffer.from('founder_vault'), nftMintPubkey.toBuffer()],
                    program.programId
                );
                console.log('Founder Vault PDA:', founderVaultPda.toString());

                const asmvVaultAta = await getAssociatedTokenAddress(
                    ASMV_MINT,
                    founderVaultPda,
                    true
                );
                console.log('ASMV Vault ATA:', asmvVaultAta.toString());

                console.log('Deriving user_asmv_ata...');
                console.log('User ASMV ATA (re-derived):', userAsmvAta.toString());

                console.log('Preparing transaction...');
                const depositInstruction = await program.methods
                    .depositSpl(amountInLamports)
                    .accounts({
                        user: provider.publicKey,
                        nftMint: nftMintPubkey,
                        founderVault: founderVaultPda,
                        userAsmvAccount: userAsmvAta,
                        asmvFounderVault: asmvVaultAta,
                        asmvMint: ASMV_MINT,
                        tokenProgram: TOKEN_PROGRAM_ID,
                        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
                        systemProgram: SystemProgram.programId,
                    })
                    .instruction();

                const {blockhash} = await connection.getLatestBlockhash('confirmed');
                const tx = new Transaction();
                tx.add(depositInstruction);
                tx.recentBlockhash = blockhash;
                tx.feePayer = wallet.publicKey;

                const txSignature = await provider.sendAndConfirm(tx, [], {skipPreflight: true});
                    
                console.log('Transaction successful with signature:', txSignature);
                const solscanUrl = `https://solscan.io/tx/${txSignature}?cluster=devnet`;
    
                toast.success(
                    <div>
                        <span>{`Deposited ${amount} ASMV successfully! `}</span>
                        <a href={solscanUrl} target="_blank" rel="noopener noreferrer" style={{ color: 'blue', textDecoration: 'underline' }}>
                            View on Solscan
                        </a>
                    </div>,
                    { autoClose: 8000, closeOnClick: false }
                );

            } else { // Redeem
                const lamports = new BN(amount * (10 ** DECIMALS));
                const nftMint = new PublicKey(mint);
                const founderVault = new PublicKey(pda);
                let txSignature;
                const userAsmvAccount = await getAssociatedTokenAddress(ASMV_MINT, wallet.publicKey);
                const asmvFounderVault = await getAssociatedTokenAddress(ASMV_MINT, founderVault, true);
                
                const userAsmvAccountInfo = await connection.getAccountInfo(userAsmvAccount);
                const instructions = [];
                if (!userAsmvAccountInfo) {
                    instructions.push(
                        createAssociatedTokenAccountInstruction(
                            wallet.publicKey,
                            userAsmvAccount, 
                            wallet.publicKey, 
                            ASMV_MINT
                        )
                    );
                }

                 const redeemTx = await program.methods
                    .redeemSpl(lamports)
                    .accounts({
                        user: wallet.publicKey,
                        founderVault: founderVault,
                        nftMint: nftMint,
                        asmvMint: ASMV_MINT,
                        asmvFounderVault: asmvFounderVault,
                        userAsmvAccount: userAsmvAccount,
                    })
                    .instruction();
                instructions.push(redeemTx);
            

                const { blockhash } = await connection.getLatestBlockhash();
                const tx = new Transaction({
                    recentBlockhash: blockhash,
                    feePayer: wallet.publicKey,
                }).add(...instructions);
                
                const signedTx = await wallet.signTransaction(tx);
                txSignature = await connection.sendRawTransaction(signedTx.serialize());
                await connection.confirmTransaction(txSignature, 'confirmed');

                const solscanUrl = `https://solscan.io/tx/${txSignature}?cluster=devnet`;
                toast.success(
                    <div>
                        <span>{`Redeemed ${amount} ASMV successfully! `}</span>
                        <a href={solscanUrl} target="_blank" rel="noopener noreferrer" style={{ color: 'blue', textDecoration: 'underline' }}>
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
    
    const onMint = async (name: string, uri: string) => {
        if (!program || !wallet) {
            throw new Error("Wallet or Program not connected.");
        }
        
        console.log("Simulating mint for:", name, uri);
        
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        await fetchProgramData();
    };

    return { isFetching, totalBalance, nfts, nftCount: nfts.length, onAction, onMint, onInitialize };
};
