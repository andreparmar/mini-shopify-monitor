import { test } from "node:test";
import assert from "node:assert/strict";
import { buildPlainCartUrl, buildPrefilledCartUrl } from "./cartLinks";
import type { CheckoutDetails } from "./types";

test("buildPlainCartUrl defaults quantity to 1", () => {
  assert.equal(buildPlainCartUrl("example.com", 123), "https://example.com/cart/123:1");
});

test("buildPlainCartUrl uses the given quantity", () => {
  assert.equal(buildPlainCartUrl("example.com", 123, 3), "https://example.com/cart/123:3");
});

test("buildPlainCartUrl strips protocol and trailing slash from the domain", () => {
  assert.equal(buildPlainCartUrl("https://example.com/", 123), "https://example.com/cart/123:1");
  assert.equal(buildPlainCartUrl("http://example.com", 123), "https://example.com/cart/123:1");
});

test("buildPrefilledCartUrl includes all provided fields, URL-encoded", () => {
  const details: CheckoutDetails = {
    email: "jane doe+test@example.com",
    firstName: "Jane",
    lastName: "O'Doe",
    address1: "123 Main St, Apt #4",
    city: "New York",
    province: "NY",
    zip: "10001",
    country: "US",
    phone: "+1 555-123-4567",
  };

  const url = buildPrefilledCartUrl("example.com", 123, 1, details);
  const [base, query] = url.split("?");
  const params = new URLSearchParams(query);

  assert.equal(base, "https://example.com/cart/123:1");
  assert.equal(params.get("checkout[email]"), "jane doe+test@example.com");
  assert.equal(params.get("checkout[shipping_address][first_name]"), "Jane");
  assert.equal(params.get("checkout[shipping_address][last_name]"), "O'Doe");
  assert.equal(params.get("checkout[shipping_address][address1]"), "123 Main St, Apt #4");
  assert.equal(params.get("checkout[shipping_address][city]"), "New York");
  assert.equal(params.get("checkout[shipping_address][province]"), "NY");
  assert.equal(params.get("checkout[shipping_address][zip]"), "10001");
  assert.equal(params.get("checkout[shipping_address][country]"), "US");
  assert.equal(params.get("checkout[shipping_address][phone]"), "+1 555-123-4567");

  // Spaces and special characters must actually be percent/plus-encoded on the wire
  assert.ok(url.includes("New%20York") || url.includes("New+York"));
});

test("buildPrefilledCartUrl skips empty, undefined, and whitespace-only fields", () => {
  const details: CheckoutDetails = {
    email: "jane@example.com",
    firstName: "",
    lastName: undefined,
    address2: "   ",
  };

  const url = buildPrefilledCartUrl("example.com", 123, 1, details);
  const params = new URLSearchParams(url.split("?")[1]);

  assert.equal(params.get("checkout[email]"), "jane@example.com");
  assert.equal(params.has("checkout[shipping_address][first_name]"), false);
  assert.equal(params.has("checkout[shipping_address][last_name]"), false);
  assert.equal(params.has("checkout[shipping_address][address2]"), false);
});

test("buildPrefilledCartUrl with no fields set returns the bare cart URL", () => {
  const url = buildPrefilledCartUrl("example.com", 123, 1, {});
  assert.equal(url, "https://example.com/cart/123:1");
});

test("buildPrefilledCartUrl never emits payment-shaped data even if passed loosely-typed extras", () => {
  const details = {
    email: "jane@example.com",
    cardNumber: "4111111111111111",
    cardCvc: "123",
  } as CheckoutDetails;

  const url = buildPrefilledCartUrl("example.com", 123, 1, details);

  assert.ok(!url.includes("4111111111111111"));
  assert.ok(!url.includes("cardNumber"));
  assert.ok(!url.includes("cardCvc"));
});
