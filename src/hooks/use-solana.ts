// This file is intentionally left blank as part of the revert.

// A simple interface to prevent breaking other components that import it.
export interface Nft {
  id: string;
  name: string;
  mintAddress: string;
  vaultBalance: number;
  imageId: string;
  pda: string;
}
