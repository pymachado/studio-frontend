'use client';

import { Header } from '@/components/header';
import { DashboardStats } from '@/components/dashboard-stats';
import { NftCarousel } from '@/components/nft-carousel';
import { Button } from '@/components/ui/button';
import { PlusCircle } from 'lucide-react';
import { MintNftDialog } from '@/components/mint-nft-dialog';

export default function Home() {
  const nfts = [
    {
      id: 'nft1',
      name: 'Solana Sphere',
      mintAddress: '...',
      vaultBalance: 1250.75,
      imageId: 'nft1',
      pda: '...',
    },
    {
      id: 'nft2',
      name: 'Pixel Samurai',
      mintAddress: '...',
      vaultBalance: 830.00,
      imageId: 'nft2',
      pda: '...',
    },
    {
      id: 'nft3',
      name: 'Astro Cat',
      mintAddress: '...',
      vaultBalance: 4200.50,
      imageId: 'nft3',
      pda: '...',
    },
  ];

  return (
    <div className="flex flex-col min-h-screen">
      <Header />
      <main className="flex-1 container mx-auto px-4 py-8 space-y-8">
        <DashboardStats totalBalance={6281.25} nftCount={3} />

        <div className="flex justify-between items-center">
          <h2 className="text-3xl font-headline font-bold">Your NFTs</h2>
          <MintNftDialog onMint={async (name, uri) => console.log('Minting', name, uri)} trigger={
            <Button variant="secondary" className="bg-accent text-accent-foreground hover:bg-accent/90">
              <PlusCircle className="mr-2 h-4 w-4" /> Mint NFT
            </Button>
          } />
        </div>

        <NftCarousel nfts={nfts} />
      </main>
    </div>
  );
}
