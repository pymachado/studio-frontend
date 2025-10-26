import Image from 'next/image';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { VaultActionDialog } from '@/components/vault-action-dialog';
import { PlaceHolderImages, type ImagePlaceholder } from '@/lib/placeholder-images';
import { Button } from './ui/button';

export type Nft = {
  id: string;
  name: string;
  mintAddress: string;
  vaultBalance: number;
  imageId: string;
};

interface NftCardProps {
  nft: Nft;
}

export function NftCard({ nft }: NftCardProps) {
  const image: ImagePlaceholder | undefined = PlaceHolderImages.find(p => p.id === nft.imageId);

  return (
    <Card className="flex flex-col h-full shadow-lg hover:shadow-xl transition-shadow duration-300">
      <CardHeader>
        <CardTitle className="font-headline tracking-tight">{nft.name}</CardTitle>
      </CardHeader>
      <CardContent className="flex-grow space-y-4">
        {image && (
          <div className="aspect-square relative w-full rounded-lg overflow-hidden border">
             <Image
              src={image.imageUrl}
              alt={image.description}
              fill
              className="object-cover transition-transform duration-300 group-hover:scale-105"
              data-ai-hint={image.imageHint}
            />
          </div>
        )}
        <div>
          <p className="text-sm text-muted-foreground">Vault Balance</p>
          <p className="text-xl font-bold text-primary">{nft.vaultBalance.toLocaleString()} ASMV</p>
        </div>
      </CardContent>
      <CardFooter className="flex justify-between gap-2">
        <VaultActionDialog
          actionType="Deposit"
          nft={nft}
          trigger={
            <Button variant="outline" className="w-full">
              Deposit
            </Button>
          }
        />
        <VaultActionDialog
          actionType="Redeem"
          nft={nft}
          trigger={
            <Button variant="outline" className="w-full">
              Redeem
            </Button>
          }
        />
      </CardFooter>
    </Card>
  );
}
