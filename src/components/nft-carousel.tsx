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

const mockNfts: Nft[] = [
  { id: '1', name: 'Cyber Orb', mintAddress: 'CybOrb123...', vaultBalance: 500, imageId: 'nft1' },
  { id: '2', name: 'Pixel Samurai', mintAddress: 'PixSam456...', vaultBalance: 1200, imageId: 'nft2' },
  { id: '3', name: 'Astro Cat', mintAddress: 'AsCat789...', vaultBalance: 750, imageId: 'nft3' },
  { id: '4', name: 'Solana Sphere', mintAddress: 'SolSph111...', vaultBalance: 2500, imageId: 'nft4' },
  { id: '5', name: 'Quantum Key', mintAddress: 'QuaKey222...', vaultBalance: 300, imageId: 'nft5' },
];

export function NftCarousel() {
  return (
    <div className="relative">
      <Carousel
        opts={{
          align: 'start',
          loop: true,
        }}
        className="w-full"
      >
        <CarouselContent>
          {mockNfts.map((nft) => (
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
