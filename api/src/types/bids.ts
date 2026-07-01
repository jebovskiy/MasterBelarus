export type BidRow = {
  id: string;
  order_id: string;
  master_id: string;
  proposed_price: number | null;
  comment: string | null;
  created_at: string;
};

export type CreateBidBody = {
  proposed_price?: number | null;
  comment?: string;
};
