import { Header } from '@/components/header';
import { DashboardStats } from '@/components/dashboard-stats';
import { NftCarousel } from '@/components/nft-carousel';
import { Button } from '@/components/ui/button';
import { PlusCircle } from 'lucide-react';

export default function Home() {
  return (
    <div className="flex flex-col min-h-screen">
      <Header />
      <main className="flex-1 container mx-auto px-4 py-8 space-y-8">
        <DashboardStats />

        <div className="flex justify-between items-center">
          <h2 className="text-3xl font-headline font-bold">Your NFTs</h2>
          <Button variant="secondary" className="bg-accent text-accent-foreground hover:bg-accent/90">
            <PlusCircle className="mr-2 h-4 w-4" /> Mint NFT
          </Button>
        </div>

        <NftCarousel />
      </main>
    </div>
  );
}
