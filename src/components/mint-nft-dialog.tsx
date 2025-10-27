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
import { PlusCircle, Loader2 } from "lucide-react";
import { useState } from "react";
import { toast } from "react-toastify";

interface MintNftDialogProps {
  trigger: React.ReactNode;
  onMint: () => Promise<void>;
}

export function MintNftDialog({ trigger, onMint }: MintNftDialogProps) {
  const [open, setOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    setIsSubmitting(true);
    // The toast is handled inside the onMint function now
    try {
      await onMint();
      setOpen(false);
    } catch (error) {
       // Error toast is also handled inside onMint
       console.error("Minting failed from dialog", error);
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
            <PlusCircle className="h-5 w-5 text-primary" />
            Mint New Founder Pass NFT
          </DialogTitle>
          <DialogDescription>
            This will mint a new Founder Pass NFT and create its associated token vault in a single transaction.
          </DialogDescription>
        </DialogHeader>
        <div className="py-4 text-center text-sm text-muted-foreground">
          <p>The NFT metadata (Name and Image) will be generated automatically based on the current supply.</p>
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="secondary" disabled={isSubmitting}>
              Cancel
            </Button>
          </DialogClose>
          <Button type="button" onClick={handleSubmit} disabled={isSubmitting}>
            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {isSubmitting ? 'Processing...' : 'Mint and Create Vault'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
