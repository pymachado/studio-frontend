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
import type { Nft } from "./nft-card";
import { ArrowDownCircle, ArrowUpCircle } from "lucide-react";

interface VaultActionDialogProps {
  actionType: "Deposit" | "Redeem";
  nft: Nft;
  trigger: React.ReactNode;
}

export function VaultActionDialog({ actionType, nft, trigger }: VaultActionDialogProps) {
  const Icon = actionType === 'Deposit' ? ArrowDownCircle : ArrowUpCircle;

  return (
    <Dialog>
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
            <Input id="mint-address" value={nft.mintAddress} readOnly className="col-span-3" />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="amount" className="text-right">
              Amount
            </Label>
            <Input id="amount" type="number" placeholder="0.00 ASMV" className="col-span-3" />
          </div>
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="secondary">
              Cancel
            </Button>
          </DialogClose>
          <Button type="submit">{actionType}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
