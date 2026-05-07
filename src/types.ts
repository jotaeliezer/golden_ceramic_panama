export interface Product {
  id: string;
  name: string;
  description: string;
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
  status: 'pending' | 'processing' | 'shipped' | 'delivered';
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
