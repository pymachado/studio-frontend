'use client';

import { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import idl from '@/lib/idl.json';
import { useConnection, useAnchorWallet } from '@solana/wallet-adapter-react';
import { Program, AnchorProvider, setProvider, BN } from '@coral-xyz/anchor';
import { useToast } from '@/hooks/use-toast';
import { PublicKey, SystemProgram } from '@solana/web3.js';
import { createUmi } from '@metaplex-foundation/umi-bundle-defaults';
import { walletAdapterIdentity } from '@metaplex-foundation/umi-signer-wallet-adapters';
import { fetchAllDigitalAssetByOwner, mintV1, fetchDigitalAsset } from '@metaplex-foundation/mpl-token-metadata';
import { generateSigner, percentAmount, some } from '@metaplex-foundation/umi';

import { Buffer } from 'buffer';
import { Nft } from '@/components/nft-card';
import { getAssociatedTokenAddress, TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID } from '@solana/spl-token';
import { PlaceHolderImages } from '@/lib/placeholder-images';

if (typeof window !== 'undefined') {
    window.Buffer = window.Buffer || Buffer;
}

const PROGRAM_ID = new PublicKey(idl.address);
const ASMV_MINT = new PublicKey("G9tt98aT2sV6Ta2C3S5tVmJv3sW2ctEa5i3g6Y2jCCaT");
const DECIMALS = 6;


export const useSolana = () => {
    const { connection } = useConnection();
    const wallet = useAnchorWallet();
    const { toast } = useToast();
    
    const [program, setProgram] = useState<Program<any> | null>(null);
    const [umi, setUmi] = useState<any | null>(null);

    const [nfts, setNfts] = useState<Nft[]>([]);
    const [totalAsmvBalance, setTotalAsmvBalance] = useState(0);
    const [nftCount, setNftCount] = useState(0);
    const subscriptionIds = useRef(new Map<string, number>());
    
    // Initialize Umi and Program
    useEffect(() => {
        const newUmi = createUmi(connection.rpcEndpoint);
        setUmi(newUmi);

        if (wallet) {
            const provider = new AnchorProvider(connection, wallet, { commitment: 'confirmed' });
            setProvider(provider);
            const programInstance = new Program(idl as any, PROGRAM_ID, provider);
            setProgram(programInstance);
            newUmi.use(walletAdapterIdentity(wallet));
        } else {
            setProgram(null);
        }
    }, [connection.rpcEndpoint, wallet]);
    
    const uiBalance = useCallback((balanceBN: BN) => {
        if (!balanceBN) return 0;
        const divisor = new BN(10).pow(new BN(DECIMALS));
        const whole = balanceBN.div(divisor).toNumber();
        const fractionBN = balanceBN.mod(divisor);
        const fraction = fractionBN.toNumber() / Math.pow(10, DECIMALS);
        return whole + fraction;
    }, []);

    const toLamports = useCallback((uiAmount: number) => {
        return new BN(uiAmount * Math.pow(10, DECIMALS));
    }, []);

    const fetchVaults = useCallback(async (programInstance: Program<any>, nftMints: PublicKey[]) => {
        if (!wallet || nftMints.length === 0) return { vaults: [], totalBalance: 0 };
        
        const vaultPromises = nftMints.map(async (nftMint) => {
            try {
                const [founderVaultPda] = PublicKey.findProgramAddressSync(
                    [Buffer.from('founder_vault'), nftMint.toBuffer()],
                    programInstance.programId
                );

                const vaultData = await programInstance.account.founderVault.fetch(founderVaultPda);
                return {
                    nftMint: vaultData.nftMint.toString(),
                    asmvMint: vaultData.asmvMint.toString(),
                    balance: new BN(vaultData.balance),
                    pda: founderVaultPda.toString()
                };
            } catch (err) {
                return null;
            }
        });

        const results = await Promise.all(vaultPromises);
        const validVaults = results.filter(vault => vault !== null);
        
        const totalAsmv = validVaults.reduce((acc, vault) => acc.add(vault!.balance), new BN(0));
        const totalAsmvUi = uiBalance(totalAsmv);

        return { vaults: validVaults, totalBalance: totalAsmvUi };

    }, [wallet, uiBalance]);

    const fetchData = useCallback(async () => {
        if (!umi || !wallet || !program) return;
        
        try {
            const assets = await fetchAllDigitalAssetByOwner(umi, wallet.publicKey);
            const mintAssets = assets.map(asset => new PublicKey(asset.mint.publicKey));
            setNftCount(assets.length);

            const { vaults, totalBalance } = await fetchVaults(program, mintAssets);
            
            const nftData = assets.map((asset, index) => {
                const vault = vaults.find(v => v!.nftMint === asset.mint.publicKey.toString());
                const imageId = PlaceHolderImages[index % PlaceHolderImages.length].id;
                return {
                    id: asset.mint.publicKey.toString(),
                    name: asset.metadata.name,
                    mintAddress: asset.mint.publicKey.toString(),
                    vaultBalance: vault ? uiBalance(vault.balance) : 0,
                    imageId: imageId,
                    pda: vault ? vault.pda : ''
                };
            });

            setNfts(nftData);
            setTotalAsmvBalance(totalBalance);

            // Subscribe to vault changes
            vaults.forEach(vault => {
                if (!vault) return;
                const vaultPda = new PublicKey(vault.pda);
                if (!subscriptionIds.current.has(vault.pda)) {
                    const subscriptionId = connection.onAccountChange(
                        vaultPda,
                        async () => {
                           console.log(`Account ${vault!.pda} changed, refetching data.`);
                           await fetchData();
                        },
                        { commitment: 'confirmed' }
                    );
                    subscriptionIds.current.set(vault.pda, subscriptionId);
                }
            });

        } catch (error) {
            console.error('Error fetching data:', error);
            toast({ variant: 'destructive', title: 'Error', description: 'Failed to fetch wallet data.' });
        }
    }, [umi, wallet, program, fetchVaults, uiBalance, connection, toast]);


    useEffect(() => {
        if (wallet && program && umi) {
          fetchData();
        } else {
          // Clear data when wallet disconnects
          setNfts([]);
          setTotalAsmvBalance(0);
          setNftCount(0);
        }

        // Cleanup subscriptions on component unmount
        return () => {
            subscriptionIds.current.forEach((id, pda) => {
                connection.removeAccountChangeListener(id);
                console.log(`Unsubscribed from ${pda}`);
            });
            subscriptionIds.current.clear();
        };
    }, [wallet, program, umi, fetchData]);


    const handleDeposit = async (mint: string, pda: string, amount: number) => {
        if (!program || !wallet) throw new Error('Program or wallet not initialized');

        const nftMint = new PublicKey(mint);
        const founderVault = new PublicKey(pda);
        const depositAmount = toLamports(amount);

        const userAsmvAccount = await getAssociatedTokenAddress(ASMV_MINT, wallet.publicKey);
        const asmvFounderVault = await getAssociatedTokenAddress(ASMV_MINT, founderVault, true);

        await program.methods.depositSpl(depositAmount)
            .accounts({
                user: wallet.publicKey,
                nftMint,
                founderVault,
                userAsmvAccount,
                asmvFounderVault,
                asmvMint: ASMV_MINT,
                tokenProgram: TOKEN_PROGRAM_ID,
                associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
                systemProgram: SystemProgram.programId,
            })
            .rpc();
        
        await fetchData(); // Refetch data to update UI
    };
    
    const handleRedeem = async (mint: string, pda: string, amount: number) => {
        if (!program || !wallet) throw new Error('Program or wallet not initialized');
        
        const nftMint = new PublicKey(mint);
        const founderVault = new PublicKey(pda);
        const redeemAmount = toLamports(amount);

        const userAsmvAccount = await getAssociatedTokenAddress(ASMV_MINT, wallet.publicKey);
        const asmvFounderVault = await getAssociatedTokenAddress(ASMV_MINT, founderVault, true);

        await program.methods.redeemSpl(redeemAmount)
            .accounts({
                user: wallet.publicKey,
                founderVault,
                nftMint,
                asmvMint: ASMV_MINT,
                asmvFounderVault,
                userAsmvAccount,
                tokenProgram: TOKEN_PROGRAM_ID,
                associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
                systemProgram: SystemProgram.programId,
            })
            .rpc();
        
        await fetchData(); // Refetch data to update UI
    };

    const handleMintNft = async (name: string, uri: string) => {
        if (!umi || !wallet) throw new Error("UMI or wallet not initialized");

        toast({ title: "Minting NFT...", description: "Please wait." });
        const mint = generateSigner(umi);

        await mintV1(umi, {
            mint,
            name: name,
            uri: uri,
            sellerFeeBasisPoints: percentAmount(0),
            tokenStandard: 0, // NonFungible
        }).sendAndConfirm(umi);
        
        const nftMint = new PublicKey(mint.publicKey);
        
        // After minting, we need to initialize the vault for this new NFT
        if (program) {
            const [founderVault] = PublicKey.findProgramAddressSync(
                [Buffer.from('founder_vault'), nftMint.toBuffer()],
                program.programId
            );
            const asmvVault = await getAssociatedTokenAddress(ASMV_MINT, founderVault, true);
            
            const [counterVault] = PublicKey.findProgramAddressSync(
                [Buffer.from('counter_vault')],
                program.programId
            );

            try {
                // Initialize the program first if needed (this might only need to be run once)
                // This will fail if already initialized, so we wrap it in a try-catch
                try {
                  await program.methods.initProgram().accounts({
                    counterVault,
                    user: wallet.publicKey,
                    systemProgram: SystemProgram.programId,
                  }).rpc();
                  toast({ title: "Program Initialized", description: "This is a one-time setup." });
                } catch(e) {
                  console.log("Program likely already initialized.");
                }


                await program.methods
                    .initVault(nftMint, ASMV_MINT)
                    .accounts({
                        user: wallet.publicKey,
                        nftMint,
                        asmvMint: ASMV_MINT,
                        founderVault,
                        asmvVault,
                        counterVault,
                        tokenProgram: TOKEN_PROGRAM_ID,
                        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
                        systemProgram: SystemProgram.programId,
                    })
                    .rpc();
                 toast({ title: "Vault Initialized", description: `Vault for ${name} is ready.` });
            } catch(e: any) {
                console.error("Error initializing vault:", e);
                // Vault might already exist, which is okay.
                if (!e.toString().includes("already in use")) {
                   toast({ variant: "destructive", title: "Vault Init Failed", description: e.message });
                }
            }
        }

        await fetchData();
        toast({ title: "Success", description: `NFT "${name}" minted successfully!` });
    };

    return { nfts, totalAsmvBalance, nftCount, handleDeposit, handleRedeem, handleMintNft };
};
