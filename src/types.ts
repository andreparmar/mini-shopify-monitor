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
