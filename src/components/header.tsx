import { WalletConnect } from '@/components/wallet-connect';

export function Header() {
  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-16 items-center justify-between">
        <h1 className="text-2xl font-bold font-headline tracking-tight">Solana Vault Manager</h1>
        <WalletConnect />
      </div>
    </header>
  );
}
