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
  variantId: string;
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

export type CartLinkMode = "off" | "cart" | "checkout";

export interface CartLinksConfig {
  mode: CartLinkMode;
  quantity: number;
}

export interface StoreConfig {
  name: string;
  url: string;
  intervalSeconds: number;
  targets: Target[];
  cartLinks?: CartLinksConfig;
}

export interface MonitorConfig {
  stores: StoreConfig[];
  cartLinks?: CartLinksConfig;
}

// Shipping details used to build a pre-filled checkout link.
// Intentionally has no payment/card fields — only add fields here that are safe to
// carry in a Shopify cart permalink query string.
export interface CheckoutDetails {
  email?: string;
  firstName?: string;
  lastName?: string;
  address1?: string;
  address2?: string;
  city?: string;
  province?: string;
  zip?: string;
  country?: string;
  phone?: string;
}
