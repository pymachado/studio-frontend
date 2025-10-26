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
import { PlusCircle } from "lucide-react";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";

interface MintNftDialogProps {
  trigger: React.ReactNode;
  onMint: (name: string, uri: string) => Promise<void>;
}

export function MintNftDialog({ trigger, onMint }: MintNftDialogProps) {
  const [name, setName] = useState('');
  const [uri, setUri] = useState('');
  const [open, setOpen] = useState(false);
  const { toast } = useToast();

  const handleSubmit = async () => {
    if (!name || !uri) {
      toast({
        variant: "destructive",
        title: "Missing Information",
        description: "Please provide both a name and a URI for the NFT.",
      });
      return;
    }
    
    try {
      await onMint(name, uri);
      setOpen(false);
      setName('');
      setUri('');
    } catch (error) {
       toast({
        variant: "destructive",
        title: "Minting Failed",
        description: (error as Error).message || "An unknown error occurred during minting.",
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="font-headline flex items-center gap-2">
            <PlusCircle className="h-5 w-5 text-primary" />
            Mint New NFT
          </DialogTitle>
          <DialogDescription>
            Create a new NFT by providing its metadata.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="nft-name" className="text-right">
              Name
            </Label>
            <Input 
              id="nft-name" 
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., 'Solana Sphere'" 
              className="col-span-3" 
            />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="nft-uri" className="text-right">
              Metadata URI
            </Label>
            <Input 
              id="nft-uri" 
              placeholder="https://example.com/nft.json" 
              className="col-span-3"
              value={uri}
              onChange={(e) => setUri(e.target.value)}
            />
          </div>
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="secondary">
              Cancel
            </Button>
          </DialogClose>
          <Button type="button" onClick={handleSubmit}>Mint NFT</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
