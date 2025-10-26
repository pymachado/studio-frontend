'use client';

import { Header } from '@/components/header';
import { DashboardStats } from '@/components/dashboard-stats';
import { NftCarousel } from '@/components/nft-carousel';
import { Button } from '@/components/ui/button';
import { PlusCircle } from 'lucide-react';
import { MintNftDialog } from '@/components/mint-nft-dialog';
import { useWallet } from '@solana/wallet-adapter-react';
import { Skeleton } from '@/components/ui/skeleton';
import { useState, useEffect } from 'react';
import type { Nft } from '@/hooks/use-solana';
import { PlaceHolderImages } from '@/lib/placeholder-images';

export default function Home() {
  const { connected } = useWallet();
  const [isFetching, setIsFetching] = useState(true);
  const [nfts, setNfts] = useState<Nft[]>([]);
  const [totalBalance, setTotalBalance] = useState(0);

  useEffect(() => {
    if (connected) {
      // Simulate fetching data
      setTimeout(() => {
        const mockNfts = PlaceHolderImages.map((p, i) => ({
          id: p.id,
          name: p.description,
          mintAddress: `mockMint${i + 1}`,
          vaultBalance: Math.random() * 10,
          imageId: p.id,
          pda: `mockPda${i + 1}`,
          uri: p.imageUrl,
        }));
        setNfts(mockNfts);
        setTotalBalance(mockNfts.reduce((sum, nft) => sum + nft.vaultBalance, 0));
        setIsFetching(false);
      }, 1500);
    } else {
      setIsFetching(false);
      setNfts([]);
      setTotalBalance(0);
    }
  }, [connected]);


  const onMint = async (name: string, uri: string) => {
    console.log("Simulating mint:", name, uri);
    // In a real app, this would trigger a blockchain transaction.
    // For now, we just add a new mock NFT.
    const newId = `nft${nfts.length + 1}`;
    const newNft: Nft = {
      id: newId,
      name: name,
      mintAddress: `mockMint${nfts.length + 1}`,
      vaultBalance: 0,
      imageId: PlaceHolderImages[nfts.length % PlaceHolderImages.length].id,
      pda: `mockPda${nfts.length + 1}`,
      uri: uri,
    };
    setNfts(prev => [...prev, newNft]);
  };

  const onAction = async (mint: string, pda: string, amount: number, actionType: 'Deposit' | 'Redeem') => {
    console.log("Simulating action:", { mint, pda, amount, actionType });
    // Simulate updating the vault balance
    setNfts(prevNfts => prevNfts.map(nft => {
      if (nft.mintAddress === mint) {
        const newBalance = actionType === 'Deposit'
          ? nft.vaultBalance + amount
          : Math.max(0, nft.vaultBalance - amount);
        return { ...nft, vaultBalance: newBalance };
      }
      return nft;
    }));
    // Recalculate total balance
    setTotalBalance(prev => actionType === 'Deposit' ? prev + amount : Math.max(0, prev - amount));
  };


  const LoadingSkeleton = () => (
    <div className="space-y-8">
      <div className="grid gap-6 md:grid-cols-2">
        <Skeleton className="h-[120px] w-full" />
        <Skeleton className="h-[120px] w-full" />
      </div>
      <div className="flex justify-between items-center">
        <Skeleton className="h-9 w-48" />
        <Skeleton className="h-10 w-32" />
      </div>
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
        <Skeleton className="h-[450px] w-full" />
        <Skeleton className="h-[450px] w-full" />
        <Skeleton className="h-[450px] w-full" />
      </div>
    </div>
  );

  return (
    <div className="flex flex-col min-h-screen">
      <Header />
      <main className="flex-1 container mx-auto px-4 py-8 space-y-8">
        {isFetching && connected ? (
          <LoadingSkeleton />
        ) : (
          <>
            <DashboardStats totalBalance={totalBalance} nftCount={nfts.length} />

            <div className="flex justify-between items-center">
              <h2 className="text-3xl font-headline font-bold">Your NFTs</h2>
              <MintNftDialog onMint={onMint} trigger={
                <Button variant="secondary" className="bg-accent text-accent-foreground hover:bg-accent/90">
                  <PlusCircle className="mr-2 h-4 w-4" /> Mint NFT
                </Button>
              } />
            </div>

            <NftCarousel nfts={nfts} onAction={onAction} />
          </>
        )}
      </main>
    </div>
  );
}
