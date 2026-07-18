#!/usr/bin/env python3
import json
import os
import re
import subprocess
import sys
import urllib.request
from collections import Counter

try:
    import questionary
except ImportError:
    print("Installing questionary...")
    subprocess.check_call([sys.executable, "-m", "pip", "install", "questionary", "-q"])
    import questionary

REPO_ROOT = os.path.dirname(os.path.abspath(__file__))
CONFIG_PATH = os.path.join(REPO_ROOT, "config.json")
ENV_PATH = os.path.join(REPO_ROOT, ".env")


# ── Config helpers ────────────────────────────────────────────────────────────

def load_config():
    with open(CONFIG_PATH) as f:
        return json.load(f)

def save_config(config):
    with open(CONFIG_PATH, "w") as f:
        json.dump(config, f, indent=2)
        f.write("\n")
    print("  ✓ config.json saved")


# ── Target helpers ────────────────────────────────────────────────────────────

def format_target(target):
    t = target["type"]
    if t == "all":
        return "All products"
    if t == "handle":
        return f"Handle: {target['value']}"
    if t == "variant_id":
        return f"Variant ID: {target['value']}"
    if t == "keywords":
        inc = " ".join(target.get("include", []))
        exc = " ".join(f"-{k}" for k in target.get("exclude", []))
        kws = " ".join(p for p in [inc, exc] if p)
        return f"Keywords: {kws}"
    if t == "product_type":
        return f"Product type: {target['value']}"
    return str(target)

def parse_keywords(raw):
    tokens = [t.strip() for t in raw.replace(",", " ").split() if t.strip()]
    include = [t for t in tokens if not t.startswith("-")]
    exclude = [t.lstrip("-") for t in tokens if t.startswith("-")]
    return include, exclude


# ── Catalog discovery ────────────────────────────────────────────────────────

CATEGORY_STOPWORDS = {
    "the", "a", "an", "of", "for", "with", "and", "in", "on", "by", "to", "new",
    "s", "m", "l", "xl", "xs", "xxl", "xxs", "2xl", "3xl", "os",
}

def fetch_products_json(store_url):
    url = f"{store_url.rstrip('/')}/products.json?limit=250"
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0 (compatible; restock-monitor/1.0)"})
    with urllib.request.urlopen(req, timeout=15) as resp:
        return json.loads(resp.read().decode())

def tokenize_title(title):
    words = re.findall(r"[a-zA-Z']+", title.lower())
    return [w for w in words if w not in CATEGORY_STOPWORDS and len(w) > 2]

def discover_categories(store_url):
    print(f"\n  Fetching catalog from {store_url}...")
    try:
        data = fetch_products_json(store_url)
    except Exception as e:
        print(f"  ✗ Failed to fetch products.json: {e}")
        return None

    products = data.get("products", [])
    if not products:
        print("  ✗ No products found")
        return None

    print(f"  ✓ Found {len(products)} products\n")

    type_counts = Counter((p.get("product_type") or "").strip() for p in products if (p.get("product_type") or "").strip())

    token_counts = Counter()
    for p in products:
        for tok in set(tokenize_title(p.get("title", ""))):
            token_counts[tok] += 1

    choices = []

    if type_counts:
        for name, count in type_counts.most_common():
            choices.append(questionary.Choice(f"[product type] {name}  ({count} products)", value=("product_type", name)))

    for word, count in token_counts.most_common(30):
        if count >= 2:
            choices.append(questionary.Choice(f"[title word] {word}  ({count} products)", value=("word", word)))

    if not choices:
        print("  No clear categories found — this catalog's titles/types are too varied to group automatically.")
        return None

    selected = questionary.checkbox(
        "Select categories to monitor (space to toggle, enter to confirm):",
        choices=choices,
    ).ask()

    if not selected:
        return None

    return selected

def build_targets_from_selection(selected):
    targets = []
    include_words = []

    for kind, value in selected:
        if kind == "product_type":
            targets.append({"type": "product_type", "value": value})
        elif kind == "word":
            include_words.append(value)

    if include_words:
        exclude_raw = questionary.text(
            "Exclude any words from those title matches? (optional, space separated):",
            default="",
        ).ask()
        exclude_words = [w.strip() for w in (exclude_raw or "").split() if w.strip()]
        targets.append({"type": "keywords", "include": include_words, "exclude": exclude_words})

    return targets


# ── Cart link helpers ──────────────────────────────────────────────────────────

CART_LINK_LABELS = {"off": "Off", "cart": "Cart", "checkout": "Cart & Checkout"}
CART_LINK_CHOICES = ["Off", "Cart", "Cart & Checkout"]
CART_LINK_FROM_LABEL = {v: k for k, v in CART_LINK_LABELS.items()}

def format_cart_links(cart_links):
    if not cart_links:
        return "(inherits global)"
    mode = cart_links.get("mode", "off")
    qty = cart_links.get("quantity", 1)
    return f"{CART_LINK_LABELS.get(mode, mode)}  (qty {qty})"

def prompt_cart_links(current):
    current_mode = (current or {}).get("mode", "off")
    current_qty = (current or {}).get("quantity", 1)

    mode_choice = questionary.select(
        "Cart link mode:",
        choices=CART_LINK_CHOICES,
        default=CART_LINK_LABELS.get(current_mode, "Off"),
    ).ask()
    if not mode_choice:
        return None

    mode = CART_LINK_FROM_LABEL[mode_choice]

    qty_raw = questionary.text("Cart quantity:", default=str(current_qty)).ask()
    try:
        quantity = max(1, int(qty_raw))
    except Exception:
        quantity = 1

    return {"mode": mode, "quantity": quantity}


# ── Add store ─────────────────────────────────────────────────────────────────

def add_store(config):
    print()
    name = questionary.text("Store name (slug, e.g. alexzono):").ask()
    if not name:
        return

    if any(s["name"] == name.strip() for s in config["stores"]):
        print(f"  ✗ Store '{name}' already exists.")
        return

    url = questionary.text("Store URL (e.g. https://alexzono.com):").ask()
    if not url:
        return

    interval_raw = questionary.text("Poll interval in seconds:", default="30").ask()
    try:
        interval = max(5, int(interval_raw))
    except Exception:
        interval = 30

    config["stores"].append({
        "name": name.strip(),
        "url": url.strip().rstrip("/"),
        "intervalSeconds": interval,
        "targets": [{"type": "all"}],
    })
    save_config(config)
    print(f"  ✓ Store '{name}' added — monitoring all products every {interval}s")


# ── Delete store ──────────────────────────────────────────────────────────────

def delete_store(config):
    if not config["stores"]:
        print("  No stores configured.")
        return

    choice = questionary.select(
        "Select store to delete:",
        choices=[s["name"] for s in config["stores"]] + ["← Back"],
    ).ask()

    if not choice or choice == "← Back":
        return

    confirmed = questionary.confirm(f"Delete '{choice}'?", default=False).ask()
    if confirmed:
        config["stores"] = [s for s in config["stores"] if s["name"] != choice]
        save_config(config)
        print(f"  ✓ Store '{choice}' deleted")


# ── Edit store ────────────────────────────────────────────────────────────────

def add_target(store):
    target_type = questionary.select(
        "Target type:",
        choices=["All products", "Handle", "Variant ID", "Product type", "Keywords", "Discover from catalog", "← Back"],
    ).ask()

    if not target_type or target_type == "← Back":
        return

    if target_type == "All products":
        store["targets"] = [t for t in store["targets"] if t["type"] != "all"]
        store["targets"].insert(0, {"type": "all"})
        print("  ✓ Set to monitor all products")

    elif target_type == "Handle":
        value = questionary.text("Product handle (e.g. some-product-slug):").ask()
        if value and value.strip():
            store["targets"].append({"type": "handle", "value": value.strip()})
            print(f"  ✓ Added handle: {value.strip()}")

    elif target_type == "Variant ID":
        value = questionary.text("Variant ID (numeric):").ask()
        if value and value.strip():
            store["targets"].append({"type": "variant_id", "value": value.strip()})
            print(f"  ✓ Added variant ID: {value.strip()}")

    elif target_type == "Product type":
        value = questionary.text("Product type (exact match, e.g. Hats):").ask()
        if value and value.strip():
            store["targets"].append({"type": "product_type", "value": value.strip()})
            print(f"  ✓ Added product type: {value.strip()}")

    elif target_type == "Keywords":
        print("  Enter keywords to match. Prefix with - to exclude. e.g.  hat trucker -kids -youth")
        raw = questionary.text("Keywords:").ask()
        if raw and raw.strip():
            include, exclude = parse_keywords(raw)
            store["targets"].append({"type": "keywords", "include": include, "exclude": exclude})
            inc_str = ", ".join(include) if include else "—"
            exc_str = ", ".join(exclude) if exclude else "—"
            print(f"  ✓ Added keywords  include: [{inc_str}]  exclude: [{exc_str}]")

    elif target_type == "Discover from catalog":
        selected = discover_categories(store["url"])
        if not selected:
            return
        new_targets = build_targets_from_selection(selected)
        if not new_targets:
            return
        store["targets"].extend(new_targets)
        for t in new_targets:
            print(f"  ✓ Added: {format_target(t)}")


def remove_target(store):
    if not store["targets"]:
        print("  No targets to remove.")
        return

    choices = [format_target(t) for t in store["targets"]] + ["← Back"]
    choice = questionary.select("Select target to remove:", choices=choices).ask()

    if not choice or choice == "← Back":
        return

    idx = next(i for i, t in enumerate(store["targets"]) if format_target(t) == choice)
    store["targets"].pop(idx)
    print(f"  ✓ Removed: {choice}")


def change_interval(store):
    val = questionary.text(
        "New poll interval in seconds:",
        default=str(store["intervalSeconds"]),
    ).ask()
    try:
        store["intervalSeconds"] = max(5, int(val))
        print(f"  ✓ Interval set to {store['intervalSeconds']}s")
    except Exception:
        print("  ✗ Invalid number — unchanged")


def edit_store_cart_links(store):
    current = store.get("cartLinks")
    action = questionary.select(
        "Cart links for this store:",
        choices=["Set override", "Clear override (use global)", "← Back"],
    ).ask()

    if not action or action == "← Back":
        return

    if action == "Clear override (use global)":
        store.pop("cartLinks", None)
        print("  ✓ Cleared override — this store now inherits the global cart link setting")
        return

    result = prompt_cart_links(current)
    if result:
        store["cartLinks"] = result
        print(f"  ✓ Store cart links set to: {format_cart_links(result)}")


def toggle_new_product_alerts(store):
    current = store.get("notifyNewProducts", True)
    choice = questionary.select(
        f"New-drop alerts (currently {'On' if current else 'Off'}):",
        choices=["On", "Off", "← Back"],
    ).ask()

    if not choice or choice == "← Back":
        return

    store["notifyNewProducts"] = (choice == "On")
    print(f"  ✓ New-drop alerts set to: {choice}")


def edit_store(store):
    while True:
        new_drops_state = "On" if store.get("notifyNewProducts", True) else "Off"
        print(f"\n  Store: {store['name']}  ({store['url']})  every {store['intervalSeconds']}s")
        print(f"  Cart links: {format_cart_links(store.get('cartLinks'))}")
        print(f"  New drops:  {new_drops_state}")
        print("  Targets:")
        for i, t in enumerate(store["targets"]):
            print(f"    {i + 1}. {format_target(t)}")

        action = questionary.select(
            "Action:",
            choices=["Add target", "Remove target", "Change interval", "Cart links override", "New-drop alerts", "← Back"],
        ).ask()

        if not action or action == "← Back":
            break
        elif action == "Add target":
            add_target(store)
        elif action == "Remove target":
            remove_target(store)
        elif action == "Change interval":
            change_interval(store)
        elif action == "Cart links override":
            edit_store_cart_links(store)
        elif action == "New-drop alerts":
            toggle_new_product_alerts(store)


def edit_menu(config):
    if not config["stores"]:
        print("  No stores configured.")
        return

    choice = questionary.select(
        "Select store to edit:",
        choices=[s["name"] for s in config["stores"]] + ["← Back"],
    ).ask()

    if not choice or choice == "← Back":
        return

    store = next(s for s in config["stores"] if s["name"] == choice)
    edit_store(store)
    save_config(config)


# ── Global cart links ─────────────────────────────────────────────────────────

def edit_global_cart_links(config):
    current = config.get("cartLinks")
    print(f"\n  Current global cart links: {format_cart_links(current)}")
    print("  (Per-store overrides take precedence — set via Edit store → Cart links override)")

    result = prompt_cart_links(current)
    if result:
        config["cartLinks"] = result
        save_config(config)
        print(f"  ✓ Global cart links set to: {format_cart_links(result)}")


# ── Shipping info (local .env, synced to Railway variables — never committed) ──

CHECKOUT_FIELDS = [
    ("CHECKOUT_EMAIL", "Email"),
    ("CHECKOUT_FIRST_NAME", "First name"),
    ("CHECKOUT_LAST_NAME", "Last name"),
    ("CHECKOUT_ADDRESS1", "Address line 1"),
    ("CHECKOUT_ADDRESS2", "Address line 2"),
    ("CHECKOUT_CITY", "City"),
    ("CHECKOUT_PROVINCE", "Province/State (2-letter, e.g. NY)"),
    ("CHECKOUT_ZIP", "ZIP/Postal code"),
    ("CHECKOUT_COUNTRY", "Country (2-letter, e.g. US)"),
    ("CHECKOUT_PHONE", "Phone"),
]

def read_env_file():
    values = {}
    if os.path.exists(ENV_PATH):
        with open(ENV_PATH) as f:
            for line in f:
                line = line.strip()
                if not line or line.startswith("#") or "=" not in line:
                    continue
                key, _, val = line.partition("=")
                values[key.strip()] = val.strip()
    return values

def write_env_file(updates):
    lines = []
    seen = set()

    if os.path.exists(ENV_PATH):
        with open(ENV_PATH) as f:
            for line in f:
                raw = line.rstrip("\n")
                stripped = raw.strip()
                if stripped and not stripped.startswith("#") and "=" in stripped:
                    key = stripped.split("=", 1)[0].strip()
                    if key in updates:
                        lines.append(f"{key}={updates[key]}")
                        seen.add(key)
                        continue
                lines.append(raw)

    for key, val in updates.items():
        if key not in seen:
            lines.append(f"{key}={val}")

    with open(ENV_PATH, "w") as f:
        f.write("\n".join(lines) + "\n")

    print("  ✓ .env saved locally (gitignored — never committed)")

def format_shipping_summary(env):
    filled = sum(1 for key, _ in CHECKOUT_FIELDS if env.get(key))
    return f"{filled}/{len(CHECKOUT_FIELDS)} fields set"

def edit_shipping_info():
    env = read_env_file()
    print(f"\n  Shipping info — {format_shipping_summary(env)}")
    print("  Stored only in local .env (gitignored). Leave blank to clear a field.\n")

    updates = {}
    for key, label in CHECKOUT_FIELDS:
        current = env.get(key, "")
        val = questionary.text(f"{label}:", default=current).ask()
        if val is None:
            print("  Cancelled — no changes saved")
            return
        updates[key] = val.strip()

    write_env_file(updates)

    sync = questionary.confirm("Sync these values to Railway now?", default=True).ask()
    if sync:
        sync_shipping_to_railway(updates)

def sync_shipping_to_railway(values=None):
    if values is None:
        values = read_env_file()

    # Railway's CLI rejects `KEY=` with an empty value in `variable set`, so blank
    # fields have to go through `variable delete` instead to actually clear them.
    non_empty = [(key, values.get(key, "").strip()) for key, _ in CHECKOUT_FIELDS if values.get(key, "").strip()]
    empty_keys = [key for key, _ in CHECKOUT_FIELDS if not values.get(key, "").strip()]

    if non_empty:
        pairs = [f"{key}={val}" for key, val in non_empty]
        print("  Syncing to Railway (skipping auto-deploy)...")
        result = subprocess.run(
            ["railway", "variable", "set", *pairs, "--skip-deploys"],
            capture_output=True, text=True, cwd=REPO_ROOT,
        )
        if result.returncode != 0:
            print(f"  ✗ Sync failed:\n{result.stderr.strip()}")
            return
        print(f"  ✓ Railway variables updated ({len(non_empty)} field(s))")

    if empty_keys:
        existing = subprocess.run(
            ["railway", "variable", "list", "--kv"],
            capture_output=True, text=True, cwd=REPO_ROOT,
        )
        existing_keys = set()
        if existing.returncode == 0:
            for line in existing.stdout.splitlines():
                if "=" in line:
                    existing_keys.add(line.split("=", 1)[0])

        cleared = 0
        for key in empty_keys:
            if key in existing_keys:
                subprocess.run(
                    ["railway", "variable", "delete", key],
                    capture_output=True, text=True, cwd=REPO_ROOT,
                )
                cleared += 1
        if cleared:
            print(f"  ✓ Cleared {cleared} blank field(s) on Railway")

    redeploy = questionary.confirm("Redeploy now to apply?", default=True).ask()
    if redeploy:
        rd = subprocess.run(
            ["railway", "redeploy", "--yes"],
            capture_output=True, text=True, cwd=REPO_ROOT,
        )
        if rd.returncode == 0:
            print("  ✓ Redeploy triggered")
        else:
            print(f"  ✗ Redeploy failed:\n{rd.stderr.strip()}")


# ── Push to Railway ───────────────────────────────────────────────────────────

def push_to_railway():
    print()

    # Check if config.json has uncommitted changes
    status = subprocess.run(
        ["git", "status", "--porcelain", "config.json"],
        capture_output=True, text=True, cwd=REPO_ROOT,
    )
    has_changes = bool(status.stdout.strip())

    if has_changes:
        msg = questionary.text(
            "Commit message:", default="Update monitor config"
        ).ask()
        if not msg:
            return

        subprocess.run(["git", "add", "config.json"], cwd=REPO_ROOT)
        commit = subprocess.run(
            ["git", "commit", "-m", msg],
            capture_output=True, text=True, cwd=REPO_ROOT,
        )
        if commit.returncode != 0:
            print(f"  ✗ Commit failed:\n{commit.stderr.strip()}")
            return
        print(f"  ✓ Committed: {msg}")
    else:
        print("  config.json unchanged — pushing existing commits")

    push = subprocess.run(
        ["git", "push", "origin", "master"],
        capture_output=True, text=True, cwd=REPO_ROOT,
    )
    if push.returncode == 0:
        print("  ✓ Pushed — Railway is redeploying")
    else:
        print(f"  ✗ Push failed:\n{push.stderr.strip()}")


# ── Main loop ─────────────────────────────────────────────────────────────────

def main():
    while True:
        config = load_config()
        n = len(config["stores"])
        store_label = ", ".join(s["name"] for s in config["stores"]) if n else "none"

        print(f"\n── Shopify Monitor  [{n} store{'s' if n != 1 else ''}: {store_label}] ──")

        action = questionary.select(
            "What would you like to do?",
            choices=["Add store", "Edit store", "Delete store", "Cart link settings", "Shipping info", "Push to Railway", "Exit"],
        ).ask()

        if not action or action == "Exit":
            print("Bye.")
            break
        elif action == "Add store":
            add_store(config)
        elif action == "Edit store":
            edit_menu(config)
        elif action == "Delete store":
            delete_store(config)
        elif action == "Cart link settings":
            edit_global_cart_links(config)
        elif action == "Shipping info":
            edit_shipping_info()
        elif action == "Push to Railway":
            push_to_railway()


if __name__ == "__main__":
    main()
