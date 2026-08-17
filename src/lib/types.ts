export interface Bread {
  id: string;
  name: string;
  description: string;
  weight_g: number;
  price: number;
  photo_url: string | null;
  active: boolean;
  available_in_tava: boolean;
  created_at: string;
}

export interface OrderItem {
  bread_id: string;
  name: string;
  price: number;
  qty: number;
  la_tava?: boolean;
  row_total: number;
}

export interface OrderInfo {
  code: string;
  name: string;
  phone: string;
  address: string;
  notes: string;
  items: OrderItem[];
  total: number;
  created_at: string;
  accepted_at: string | null;
  delivered_at: string | null;
}

export interface PublicConfig {
  banner: string | null;
  ordering_open: boolean;
}

export interface DeliveredOrder {
  code: string;
  total: number;
  created_at: string;
  delivered_at: string | null;
}

export interface AdminData {
  banner: string | null;
  ordering_open: boolean;
  production: Record<string, number>;
  production_tava: Record<string, number>;
  pending: OrderInfo[];
  delivered: DeliveredOrder[];
  breads: Bread[];
}
