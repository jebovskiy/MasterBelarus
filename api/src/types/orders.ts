export type OrderRow = {
  id: string;
  client_id: string;
  category: string;
  description: string;
  price: number | null;
  is_negotiable: boolean;
  address_text: string | null;
  status: 'open' | 'in_progress' | 'completed' | 'cancelled';
  images: string[];
  created_at: string;
  distance_m?: number;
};

export type CreateOrderBody = {
  category: string;
  description: string;
  price?: number | null;
  is_negotiable?: boolean;
  address_text: string;
  lat?: number;
  lng?: number;
  images?: string[];
};
