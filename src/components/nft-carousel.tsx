'use client';

import * as React from 'react';
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from '@/components/ui/carousel';
import { NftCard, type Nft } from '@/components/nft-card';
import { useWallet } from '@solana/wallet-adapter-react';
import { Card, CardContent } from './ui/card';

interface NftCarouselProps {
  nfts: Nft[];
}

export function NftCarousel({ nfts }: NftCarouselProps) {
  const { connected } = useWallet();

  if (!connected) {
    return (
      <Card className="flex items-center justify-center py-12">
        <CardContent>
          <p className="text-muted-foreground">Please connect your wallet to see your NFTs.</p>
        </CardContent>
      </Card>
    );
  }

  if (nfts.length === 0) {
    return (
       <Card className="flex items-center justify-center py-12">
        <CardContent>
          <p className="text-muted-foreground">No NFTs found in your wallet.</p>
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
                <NftCard nft={nft} />
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
