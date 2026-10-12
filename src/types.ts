export interface Product {
  id: string;
  name: string;
  description: string;
  /** English name. Empty or missing means the shop shows `name`. */
  name_en?: string | null;
  description_en?: string | null;
  price: number;
  imageUrl: string;
  category: string;
  stock: number;
  created_at: string;
}

export interface Order {
  id: string;
  customer_email: string;
  total_amount: number;
  status: 'pending' | 'paid' | 'processing' | 'shipped' | 'delivered' | 'canceled';
  shipping_address: string;
  created_at: string;
}

export interface OrderItem {
  id: string;
  order_id: string;
  product_id: string;
  quantity: number;
  price: number;
  product_name?: string;
}

export interface OrderWithItems extends Order {
  items: OrderItem[];
}

export interface CartItem extends Product {
  cartQuantity: number;
}
