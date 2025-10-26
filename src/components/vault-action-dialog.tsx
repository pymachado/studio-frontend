'use client';
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogClose,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { Nft } from "@/hooks/use-solana";
import { ArrowDownCircle, ArrowUpCircle, Loader2 } from "lucide-react";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";

interface VaultActionDialogProps {
  actionType: "Deposit" | "Redeem";
  nft: Nft;
  trigger: React.ReactNode;
  onAction: (mint: string, pda: string, amount: number, actionType: 'Deposit' | 'Redeem') => Promise<void>;
}

export function VaultActionDialog({ actionType, nft, trigger, onAction }: VaultActionDialogProps) {
  const Icon = actionType === 'Deposit' ? ArrowDownCircle : ArrowUpCircle;
  const [amount, setAmount] = useState('');
  const [open, setOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();

  const handleSubmit = async () => {
    const numericAmount = parseFloat(amount);
    if (isNaN(numericAmount) || numericAmount <= 0) {
      toast({
        variant: "destructive",
        title: "Invalid Amount",
        description: "Please enter a positive number.",
      });
      return;
    }
    
    setIsSubmitting(true);
    try {
      await onAction(nft.mintAddress, nft.pda, numericAmount, actionType);
      // Success toast is handled in the useSolana hook
      setOpen(false);
      setAmount('');
    } catch (error) {
       // Error toast is handled in the useSolana hook
       console.error("Action failed in dialog", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="font-headline flex items-center gap-2">
            <Icon className="h-5 w-5 text-primary" />
            {actionType} ASMV
          </DialogTitle>
          <DialogDescription>
            {actionType} ASMV {actionType === 'Deposit' ? 'to' : 'from'} the vault for NFT "{nft.name}".
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="mint-address" className="text-right">
              NFT Mint
            </Label>
            <Input id="mint-address" value={nft.mintAddress} readOnly className="col-span-3 text-xs" />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="amount" className="text-right">
              Amount
            </Label>
            <Input 
              id="amount" 
              type="number" 
              placeholder="0.00 ASMV" 
              className="col-span-3"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              disabled={isSubmitting}
            />
          </div>
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="secondary" disabled={isSubmitting}>
              Cancel
            </Button>
          </DialogClose>
          <Button type="button" onClick={handleSubmit} disabled={isSubmitting}>
            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {isSubmitting ? 'Processing...' : actionType}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
