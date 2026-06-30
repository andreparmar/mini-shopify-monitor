export interface ShopifyVariant {
  id: number;
  title: string;
  available: boolean;
  price: string;
  sku: string;
  product_id: number;
  featured_image: {
    src: string;
  } | null;
}

export interface ShopifyProduct {
  id: number;
  title: string;
  handle: string;
  images: Array<{ src: string }>;
  variants: ShopifyVariant[];
}

export interface ShopifyProductsResponse {
  products: ShopifyProduct[];
}

export interface VariantState {
  available: boolean;
  productTitle: string;
  variantTitle: string;
  price: string;
  imageUrl: string;
  productUrl: string;
  availableVariants: number;
  totalVariants: number;
}

export type StateMap = Record<string, VariantState>;

// Config types

export type Target =
  | { type: "all" }
  | { type: "handle"; value: string }
  | { type: "variant_id"; value: string }
  | { type: "keywords"; include: string[]; exclude: string[] };

export interface StoreConfig {
  name: string;
  url: string;
  intervalSeconds: number;
  targets: Target[];
}

export interface MonitorConfig {
  stores: StoreConfig[];
}
