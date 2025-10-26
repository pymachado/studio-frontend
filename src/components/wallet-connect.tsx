'use client';

import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { useWallet } from '@solana/wallet-adapter-react';
import { Wallet } from 'lucide-react';

export function WalletConnect() {
  const { connected } = useWallet();

  return (
    <WalletMultiButton style={{
        backgroundColor: 'hsl(var(--primary))',
        color: 'hsl(var(--primary-foreground))',
        borderRadius: 'var(--radius)',
        height: '2.5rem',
        paddingLeft: '1rem',
        paddingRight: '1rem',
        fontSize: '0.875rem',
        fontWeight: '500',
    }}>
      {!connected && <Wallet className="mr-2 h-4 w-4" />}
    </WalletMultiButton>
  );
}