'use client';

import Image from 'next/image';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { VaultActionDialog } from '@/components/vault-action-dialog';
import { Button } from './ui/button';
import type { Nft } from '@/hooks/use-solana';
import { useState } from 'react';
import { toast } from 'react-toastify';
import { Loader2 } from 'lucide-react';

interface NftCardProps {
  nft: Nft;
  onAction: (mint: string, pda: string, amount: number, actionType: 'Deposit' | 'Redeem') => Promise<void>;
  onInitialize: (nft: Nft) => Promise<void>;
}

export function NftCard({ nft, onAction, onInitialize }: NftCardProps) {
  const [isInitializing, setIsInitializing] = useState(false);

  const handleInitialize = async () => {
    setIsInitializing(true);
    const toastId = toast.loading("Initializing vault...");
    try {
      await onInitialize(nft);
      toast.update(toastId, { render: "Vault initialized!", type: "success", isLoading: false, autoClose: 5000 });
    } catch(error) {
      toast.update(toastId, { render: `Initialization failed: ${(error as Error).message}`, type: "error", isLoading: false, autoClose: 5000 });
    } finally {
      setIsInitializing(false);
    }
  };

  return (
    <Card className="flex flex-col h-full shadow-lg hover:shadow-xl transition-shadow duration-300 bg-card">
      <CardHeader>
        <CardTitle className="font-headline tracking-tight truncate">{nft.name}</CardTitle>
      </CardHeader>
      <CardContent className="flex-grow space-y-4">
        <div className="aspect-square relative w-full rounded-lg overflow-hidden border">
            {nft.uri ? (
                 <Image
                  src={nft.uri}
                  alt={nft.name}
                  fill
                  className="object-cover transition-transform duration-300 group-hover:scale-105"
                />
            ) : (
                <div className="w-full h-full bg-muted flex items-center justify-center">
                    <p className="text-muted-foreground text-sm">No Image</p>
                </div>
            )}
        </div>
        <div>
          <p className="text-sm text-muted-foreground">Vault Balance</p>
          <p className="text-xl font-bold text-primary">{nft.vaultBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 6 })} ASMV</p>
        </div>
      </CardContent>
      <CardFooter className="flex justify-between gap-2">
        {nft.needsInitialization ? (
          <Button onClick={handleInitialize} disabled={isInitializing} className="w-full">
            {isInitializing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Initialize Vault
          </Button>
        ) : (
          <>
            <VaultActionDialog
              actionType="Deposit"
              nft={nft}
              onAction={onAction}
              trigger={
                <Button variant="outline" className="w-full">
                  Deposit
                </Button>
              }
            />
            <VaultActionDialog
              actionType="Redeem"
              nft={nft}
              onAction={onAction}
              trigger={
                <Button variant="outline" className="w-full">
                  Redeem
                </Button>
              }
            />
          </>
        )}
      </CardFooter>
    </Card>
  );
}
