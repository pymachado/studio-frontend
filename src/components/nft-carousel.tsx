'use client';

import * as React from 'react';
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from '@/components/ui/carousel';
import { NftCard } from '@/components/nft-card';
import type { Nft } from '@/hooks/use-solana';
import { useWallet } from '@solana/wallet-adapter-react';
import { Card, CardContent } from './ui/card';

interface NftCarouselProps {
  nfts: Nft[];
  onAction: (mint: string, pda: string, amount: number, actionType: 'Deposit' | 'Redeem') => Promise<void>;
  onInitialize: (nft: Nft) => Promise<void>;
}

export function NftCarousel({ nfts, onAction, onInitialize }: NftCarouselProps) {
  const { connected } = useWallet();

  if (!connected) {
    return (
      <Card className="flex items-center justify-center py-24 bg-card/50 border-dashed">
        <CardContent className="text-center p-0">
          <p className="text-lg font-medium text-muted-foreground">Please connect your wallet</p>
          <p className="text-sm text-muted-foreground/80">Your NFTs will appear here once you're connected.</p>
        </CardContent>
      </Card>
    );
  }

  if (nfts.length === 0) {
    return (
       <Card className="flex items-center justify-center py-24 bg-card/50 border-dashed">
        <CardContent className="text-center p-0">
          <p className="text-lg font-medium text-muted-foreground">No NFTs found</p>
          <p className="text-sm text-muted-foreground/80">Mint a new NFT to get started.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="relative">
      <Carousel
        opts={{
          align: 'start',
          loop: nfts.length > 2,
        }}
        className="w-full"
      >
        <CarouselContent>
          {nfts.map((nft) => (
            <CarouselItem key={nft.id} className="md:basis-1/2 lg:basis-1/3">
              <div className="p-1 h-full">
                <NftCard nft={nft} onAction={onAction} onInitialize={onInitialize} />
              </div>
            </CarouselItem>
          ))}
        </CarouselContent>
        <CarouselPrevious className="absolute left-[-50px] top-1/2 -translate-y-1/2" />
        <CarouselNext className="absolute right-[-50px] top-1/2 -translate-y-1/2" />
      </Carousel>
    </div>
  );
}
