#!/usr/bin/env python3
import json
import os
import subprocess
import sys

try:
    import questionary
except ImportError:
    print("Installing questionary...")
    subprocess.check_call([sys.executable, "-m", "pip", "install", "questionary", "-q"])
    import questionary

CONFIG_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "config.json")


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
    return str(target)

def parse_keywords(raw):
    tokens = [t.strip() for t in raw.replace(",", " ").split() if t.strip()]
    include = [t for t in tokens if not t.startswith("-")]
    exclude = [t.lstrip("-") for t in tokens if t.startswith("-")]
    return include, exclude


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
        choices=["All products", "Handle", "Variant ID", "Keywords", "← Back"],
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

    elif target_type == "Keywords":
        print("  Enter keywords to match. Prefix with - to exclude. e.g.  hat trucker -kids -youth")
        raw = questionary.text("Keywords:").ask()
        if raw and raw.strip():
            include, exclude = parse_keywords(raw)
            store["targets"].append({"type": "keywords", "include": include, "exclude": exclude})
            inc_str = ", ".join(include) if include else "—"
            exc_str = ", ".join(exclude) if exclude else "—"
            print(f"  ✓ Added keywords  include: [{inc_str}]  exclude: [{exc_str}]")


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


def edit_store(store):
    while True:
        print(f"\n  Store: {store['name']}  ({store['url']})  every {store['intervalSeconds']}s")
        print("  Targets:")
        for i, t in enumerate(store["targets"]):
            print(f"    {i + 1}. {format_target(t)}")

        action = questionary.select(
            "Action:",
            choices=["Add target", "Remove target", "Change interval", "← Back"],
        ).ask()

        if not action or action == "← Back":
            break
        elif action == "Add target":
            add_target(store)
        elif action == "Remove target":
            remove_target(store)
        elif action == "Change interval":
            change_interval(store)


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


# ── Push to Railway ───────────────────────────────────────────────────────────

def push_to_railway():
    print()
    repo_root = os.path.dirname(os.path.abspath(__file__))

    # Check if config.json has uncommitted changes
    status = subprocess.run(
        ["git", "status", "--porcelain", "config.json"],
        capture_output=True, text=True, cwd=repo_root,
    )
    has_changes = bool(status.stdout.strip())

    if has_changes:
        msg = questionary.text(
            "Commit message:", default="Update monitor config"
        ).ask()
        if not msg:
            return

        subprocess.run(["git", "add", "config.json"], cwd=repo_root)
        commit = subprocess.run(
            ["git", "commit", "-m", msg],
            capture_output=True, text=True, cwd=repo_root,
        )
        if commit.returncode != 0:
            print(f"  ✗ Commit failed:\n{commit.stderr.strip()}")
            return
        print(f"  ✓ Committed: {msg}")
    else:
        print("  config.json unchanged — pushing existing commits")

    push = subprocess.run(
        ["git", "push", "origin", "master"],
        capture_output=True, text=True, cwd=repo_root,
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
            choices=["Add store", "Edit store", "Delete store", "Push to Railway", "Exit"],
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
        elif action == "Push to Railway":
            push_to_railway()


if __name__ == "__main__":
    main()
