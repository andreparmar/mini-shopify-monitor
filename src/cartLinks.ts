import type { CartLinksConfig, CheckoutDetails, MonitorConfig, StoreConfig } from "./types";

const DEFAULT_CART_LINKS: CartLinksConfig = { mode: "off", quantity: 1 };

const CHECKOUT_FIELD_MAP: Record<keyof CheckoutDetails, string> = {
  email: "checkout[email]",
  firstName: "checkout[shipping_address][first_name]",
  lastName: "checkout[shipping_address][last_name]",
  address1: "checkout[shipping_address][address1]",
  address2: "checkout[shipping_address][address2]",
  city: "checkout[shipping_address][city]",
  province: "checkout[shipping_address][province]",
  zip: "checkout[shipping_address][zip]",
  country: "checkout[shipping_address][country]",
  phone: "checkout[shipping_address][phone]",
};

function normalizeDomain(storeDomain: string): string {
  return storeDomain.replace(/^https?:\/\//, "").replace(/\/+$/, "");
}

export function buildPlainCartUrl(storeDomain: string, variantId: string | number, quantity = 1): string {
  const domain = normalizeDomain(storeDomain);
  return `https://${domain}/cart/${variantId}:${quantity}`;
}

// Never accepts payment/card data — CheckoutDetails has no such fields, so there is
// nothing for this function to leak even if called with a loosely-typed object.
export function buildPrefilledCartUrl(
  storeDomain: string,
  variantId: string | number,
  quantity: number,
  checkoutDetails: CheckoutDetails
): string {
  const base = buildPlainCartUrl(storeDomain, variantId, quantity);
  const params = new URLSearchParams();

  for (const key of Object.keys(CHECKOUT_FIELD_MAP) as Array<keyof CheckoutDetails>) {
    const value = checkoutDetails[key];
    if (value && value.trim() !== "") {
      params.set(CHECKOUT_FIELD_MAP[key], value);
    }
  }

  const query = params.toString();
  return query ? `${base}?${query}` : base;
}

export function loadCheckoutDetailsFromEnv(): CheckoutDetails {
  return {
    email: process.env.CHECKOUT_EMAIL,
    firstName: process.env.CHECKOUT_FIRST_NAME,
    lastName: process.env.CHECKOUT_LAST_NAME,
    address1: process.env.CHECKOUT_ADDRESS1,
    address2: process.env.CHECKOUT_ADDRESS2,
    city: process.env.CHECKOUT_CITY,
    province: process.env.CHECKOUT_PROVINCE,
    zip: process.env.CHECKOUT_ZIP,
    country: process.env.CHECKOUT_COUNTRY,
    phone: process.env.CHECKOUT_PHONE,
  };
}

export function resolveCartLinksConfig(config: MonitorConfig, store: StoreConfig): CartLinksConfig {
  return store.cartLinks ?? config.cartLinks ?? DEFAULT_CART_LINKS;
}
