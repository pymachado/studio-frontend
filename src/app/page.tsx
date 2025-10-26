'use client';

import { Header } from '@/components/header';
import { DashboardStats } from '@/components/dashboard-stats';
import { NftCarousel } from '@/components/nft-carousel';
import { Button } from '@/components/ui/button';
import { PlusCircle } from 'lucide-react';
import { MintNftDialog } from '@/components/mint-nft-dialog';
import { useWallet } from '@solana/wallet-adapter-react';
import { Skeleton } from '@/components/ui/skeleton';
import { useSolana } from '@/hooks/use-solana';
import type { Nft } from '@/hooks/use-solana';

export default function Home() {
  const { connected } = useWallet();
  const { isFetching, nfts, totalBalance, onAction, onMint } = useSolana();

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
        {(isFetching && connected) ? (
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
