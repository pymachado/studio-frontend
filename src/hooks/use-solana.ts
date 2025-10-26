'use client';
import { useEffect, useState, useCallback, useRef } from 'react';
import idl from '@/lib/idl.json';
import { useConnection, useAnchorWallet } from '@solana/wallet-adapter-react';
import { Program, AnchorProvider, setProvider, BN } from '@coral-xyz/anchor';
import { useToast } from '@/hooks/use-toast';
import { PublicKey, SystemProgram, Transaction, } from '@solana/web3.js';
import { fetchAllDigitalAssetByOwner } from '@metaplex-foundation/mpl-token-metadata';
import { createUmi } from '@metaplex-foundation/umi-bundle-defaults';
import { walletAdapterIdentity } from '@metaplex-foundation/umi-signer-wallet-adapters';
import { TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID, getAssociatedTokenAddress } from '@solana/spl-token';
import { Buffer } from 'buffer';

if (typeof window !== 'undefined') {
    window.Buffer = window.Buffer || Buffer;
}

const PROGRAM_ID = new PublicKey(idl.address);
const ASMV_MINT = new PublicKey("5M2j4a5n3s2a5a2j4a5n3s2a5a2j4a5n3s2a5a2j4a5n"); // Replace with your ASMV mint address

export interface Nft {
  id: string;
  name: string;
  mintAddress: string;
  vaultBalance: number;
  imageId: string;
  pda: string;
}

export const useSolana = () => {
    const { connection } = useConnection();
    const wallet = useAnchorWallet();
    const { toast } = useToast();
    const [program, setProgram] = useState<Program<any> | null>(null);
    const [umi, setUmi] = useState<any>(null);
    const [nfts, setNfts] = useState<Nft[]>([]);
    const [totalBalance, setTotalBalance] = useState(0);
    const [nftCount, setNftCount] = useState(0);
    const [isFetching, setIsFetching] = useState(true);
    const vaultSubscriptionIds = useRef<Map<string, number>>(new Map());

    const uiBalance = (balanceBN: BN, decimals = 6) => {
        if (!balanceBN) return 0;
        const divisor = new BN(10).pow(new BN(decimals));
        const balance = balanceBN.toNumber() / divisor.toNumber();
        return balance;
    };

    useEffect(() => {
        if (wallet && connection) {
            const provider = new AnchorProvider(connection, wallet, { commitment: 'confirmed' });
            setProvider(provider);
            const programInstance = new Program(idl as any, PROGRAM_ID, provider);
            setProgram(programInstance);

            const newUmi = createUmi(connection.rpcEndpoint).use(walletAdapterIdentity(wallet));
            setUmi(newUmi);
        } else {
            setProgram(null);
            setUmi(null);
        }
    }, [wallet, connection]);


    const fetchNftsAndVaults = useCallback(async () => {
        if (!umi || !wallet || !program) {
            setIsFetching(false);
            return;
        };

        setIsFetching(true);
        console.log('Fetching NFTs for wallet:', wallet.publicKey.toBase58());

        try {
            const assets = await fetchAllDigitalAssetByOwner(umi, wallet.publicKey);
            console.log(`Fetched ${assets.length} assets.`);
            setNftCount(assets.length);

            const nftDataPromises = assets.map(async (asset, index) => {
                try {
                    const [founderVaultPda] = PublicKey.findProgramAddressSync(
                        [Buffer.from('founder_vault'), new PublicKey(asset.publicKey).toBuffer()],
                        program.programId
                    );

                    let vaultBalance = 0;
                    try {
                        const vaultAccount = await program.account.founderVault.fetch(founderVaultPda);
                        vaultBalance = uiBalance(vaultAccount.balance);
                    } catch (e) {
                        // Vault might not be initialized, so balance is 0
                    }

                    return {
                        id: asset.publicKey.toString(),
                        name: asset.metadata.name,
                        mintAddress: asset.publicKey.toString(),
                        vaultBalance: vaultBalance,
                        imageId: `nft${(index % 5) + 1}`,
                        pda: founderVaultPda.toString(),
                    };
                } catch (error) {
                    console.error('Error processing asset:', asset.publicKey.toString(), error);
                    return null;
                }
            });

            const settledNftData = await Promise.all(nftDataPromises);
            const validNfts = settledNftData.filter((nft): nft is Nft => nft !== null);

            setNfts(validNfts);

            const total = validNfts.reduce((acc, nft) => acc + nft.vaultBalance, 0);
            setTotalBalance(total);

            // Subscribe to vault changes
            validNfts.forEach(nft => subscribeToVaultChanges(new PublicKey(nft.pda)));

        } catch (error) {
            console.error('Error fetching NFTs and Vaults:', error);
            toast({
                variant: 'destructive',
                title: 'Error Fetching Data',
                description: 'Could not fetch your NFTs and vault balances.',
            });
        } finally {
            setIsFetching(false);
        }
    }, [umi, wallet, program, toast]);

    const subscribeToVaultChanges = useCallback((vaultPda: PublicKey) => {
        if (!program || vaultSubscriptionIds.current.has(vaultPda.toBase58())) {
            return;
        }

        console.log('Subscribing to vault changes for:', vaultPda.toBase58());
        const subscriptionId = program.provider.connection.onAccountChange(
            vaultPda,
            (accountInfo) => {
                 console.log('Vault data changed for:', vaultPda.toBase58());
                 fetchNftsAndVaults(); // Refetch all data on change
            },
            'confirmed'
        );
        vaultSubscriptionIds.current.set(vaultPda.toBase58(), subscriptionId);

    }, [program, fetchNftsAndVaults]);


    useEffect(() => {
        if (program && umi && wallet) {
            fetchNftsAndVaults();
        } else {
             // Clear NFTs if wallet disconnects
            setNfts([]);
            setTotalBalance(0);
            setNftCount(0);
            setIsFetching(false);
        }

        // Cleanup subscriptions on component unmount or when wallet changes
        return () => {
            vaultSubscriptionIds.current.forEach((subId, pda) => {
                console.log('Unsubscribing from vault:', pda);
                connection.removeAccountChangeListener(subId);
            });
            vaultSubscriptionIds.current.clear();
        };
    }, [program, umi, wallet, fetchNftsAndVaults, connection]);


    const onAction = async (mint: string, pda: string, amount: number, actionType: 'Deposit' | 'Redeem') => {
        if (!program || !wallet) {
            toast({
                variant: "destructive",
                title: "Wallet not connected",
                description: "Please connect your wallet to perform this action.",
            });
            return;
        }
        
        const lamports = new BN(amount * (10 ** 6)); // Assuming 6 decimals for ASMV
        const nftMint = new PublicKey(mint);
        const founderVault = new PublicKey(pda);

        try {

             const userAsmvAccount = await getAssociatedTokenAddress(
                ASMV_MINT,
                wallet.publicKey
            );

            const [asmvFounderVault] = PublicKey.findProgramAddressSync(
                [founderVault.toBuffer(), TOKEN_PROGRAM_ID.toBuffer(), ASMV_MINT.toBuffer()],
                ASSOCIATED_TOKEN_PROGRAM_ID
            );
            
            const instructionName = actionType === 'Deposit' ? 'depositSpl' : 'redeemSpl';

            await program.methods
                .depositSpl(lamports)
                .accounts({
                    user: wallet.publicKey,
                    nftMint: nftMint,
                    founderVault: founderVault,
                    userAsmvAccount: userAsmvAccount,
                    asmvFounderVault: asmvFounderVault,
                    asmvMint: ASMV_MINT,
                    tokenProgram: TOKEN_PROGRAM_ID,
                    associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
                    systemProgram: SystemProgram.programId,
                })
                .rpc();

            toast({
                title: 'Success!',
                description: `${actionType} of ${amount} ASMV successful.`,
            });
            
            await fetchNftsAndVaults();

        } catch (error) {
            console.error(`${actionType} failed:`, error);
            toast({
                variant: "destructive",
                title: "Transaction Failed",
                description: (error as Error).message || `Could not ${actionType.toLowerCase()} ASMV.`,
            });
            throw error; // Re-throw to be caught in the dialog
        }
    };
    
    const onMint = async (name: string, uri: string) => {
        // Minting logic will be implemented here
        console.log("Minting NFT with:", { name, uri });
         toast({
            title: 'Minting in Progress',
            description: `Minting of "${name}" has started.`,
        });
        // You'll need to implement the actual minting transaction logic here
    };

    return { nfts, totalBalance, nftCount, isFetching, onAction, onMint };
};
