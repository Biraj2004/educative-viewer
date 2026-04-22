#!/usr/bin/env python3
"""
setup.py — one-time EducativeViewer server setup

Steps:
  1. Generate RSA-2048 key pair and write keys to .env
  2. Prompt for required .env values (DB paths, JWT secret, invite codes)
  3. Start app.py

Run once before the first server start:
  python setup.py
"""
from __future__ import annotations

import re
import subprocess
import sys
from pathlib import Path

ENV_PATH = Path(__file__).resolve().parent / ".env"
ENV_EXAMPLE_PATH = Path(__file__).resolve().parent / ".env.example"

PLACEHOLDER_PATTERNS = re.compile(
    r"^(?:"
    r"/path/to/"              # path placeholders
    r"|your[-_]"             # your-xxx / your_xxx prefixes
    r"|(?:changeme|change-me|CHANGEME)$"  # exact changeme only, not changeme-dev-secret
    r")",
    re.IGNORECASE,
)


# ── Helpers ───────────────────────────────────────────────────────────────────

def _header(title: str) -> None:
    line = "─" * (len(title) + 4)
    print(f"\n┌{line}┐")
    print(f"│  {title}  │")
    print(f"└{line}┘")


def _is_placeholder(value: str) -> bool:
    return not value or bool(PLACEHOLDER_PATTERNS.match(value.strip()))


def _parse_env(path: Path) -> dict[str, str]:
    """Return key→value mapping from a .env-style file."""
    result: dict[str, str] = {}
    if not path.exists():
        return result
    for raw in path.read_text(encoding="utf-8").splitlines():
        line = raw.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, _, val = line.partition("=")
        val = val.strip()
        if len(val) >= 2 and val[0] == val[-1] and val[0] in ('"', "'"):
            val = val[1:-1]
        result[key.strip()] = val
    return result


def _write_env(path: Path, updates: dict[str, str]) -> None:
    """Update matching keys in-place, preserving comments and ordering."""
    if not path.exists():
        path.write_text(
            "\n".join(f"{k}={v}" for k, v in updates.items()) + "\n",
            encoding="utf-8",
        )
        return

    lines = path.read_text(encoding="utf-8").splitlines()
    written: set[str] = set()
    out: list[str] = []

    for line in lines:
        stripped = line.strip()
        if not stripped or stripped.startswith("#") or "=" not in stripped:
            out.append(line)
            continue
        key = stripped.partition("=")[0].strip()
        if key in updates:
            out.append(f"{key}={updates[key]}")
            written.add(key)
        else:
            out.append(line)

    # Append any keys that were not already in the file
    for key, val in updates.items():
        if key not in written:
            out.append(f"{key}={val}")

    path.write_text("\n".join(out) + "\n", encoding="utf-8")


# ── Step 1: RSA key generation ────────────────────────────────────────────────

def generate_rsa_keys() -> tuple[str, str]:
    """Generate RSA-2048 key pair. Returns (private_key_oneliner, public_key_oneliner)."""
    try:
        from cryptography.hazmat.primitives import serialization
        from cryptography.hazmat.primitives.asymmetric import rsa
    except ImportError:
        print("[ERROR] 'cryptography' package not found. Run: pip install cryptography")
        sys.exit(1)

    private_key = rsa.generate_private_key(public_exponent=65537, key_size=2048)

    private_pem = private_key.private_bytes(
        encoding=serialization.Encoding.PEM,
        format=serialization.PrivateFormat.TraditionalOpenSSL,
        encryption_algorithm=serialization.NoEncryption(),
    ).decode("utf-8")

    public_pem = private_key.public_key().public_bytes(
        encoding=serialization.Encoding.PEM,
        format=serialization.PublicFormat.SubjectPublicKeyInfo,
    ).decode("utf-8")

    # Collapse to single-line with literal \n so it fits in a .env value
    to_oneliner = lambda pem: pem.strip().replace("\n", "\\n")  # noqa: E731
    return to_oneliner(private_pem), to_oneliner(public_pem)


def step_rsa(env_vars: dict[str, str]) -> str:
    """Ensure RSA_PRIVATE_KEY is set in .env. Returns the public key one-liner."""
    _header("RSA Key Generation")

    existing_private = env_vars.get("RSA_PRIVATE_KEY", "").strip()
    if existing_private and not _is_placeholder(existing_private):
        print("[+] RSA_PRIVATE_KEY already set — skipping generation.")
        # Derive public key from the stored private key so we can show it
        try:
            from cryptography.hazmat.primitives import serialization
            from cryptography.hazmat.primitives.serialization import load_pem_private_key
            pem_bytes = existing_private.replace("\\n", "\n").encode()
            priv = load_pem_private_key(pem_bytes, password=None)
            pub_oneliner = priv.public_key().public_bytes(
                encoding=serialization.Encoding.PEM,
                format=serialization.PublicFormat.SubjectPublicKeyInfo,
            ).decode().strip().replace("\n", "\\n")
            print(f"\n  [i] Public key (for client .env.local):\n      {pub_oneliner}\n")
            return pub_oneliner
        except Exception:
            print("[!] Could not derive public key from stored private key.")
            return ""

    print("[*] Generating RSA-2048 key pair...")
    private_oneliner, public_oneliner = generate_rsa_keys()

    _write_env(ENV_PATH, {"RSA_PRIVATE_KEY": private_oneliner})
    env_vars["RSA_PRIVATE_KEY"] = private_oneliner

    print("[+] RSA_PRIVATE_KEY written to .env")
    print(f"\n  [i] Public key (paste into client/.env.local as NEXT_PUBLIC_RSA_PUBLIC_KEY):")
    print(f"      {public_oneliner}\n")
    return public_oneliner


# ── Step 2: Interactive env setup ─────────────────────────────────────────────

def _prompt(label: str, current: str, required: bool = True, sensitive: bool = False) -> str:
    """Prompt for a single env value. Returns the (possibly unchanged) value."""
    display = (current[:4] + "***") if sensitive and len(current) > 4 else current

    if _is_placeholder(current):
        print(f"\n  [!] {label} is not configured")
        if required:
            val = ""
            while not val:
                val = input(f"      Enter value for {label}: ").strip()
                if not val:
                    print("      [!] Value cannot be empty.")
            return val
        else:
            val = input(f"      Enter value for {label} (Enter to skip): ").strip()
            return val  # may be empty — that's fine for optional fields
    else:
        val = input(f"  {label.ljust(30)} = {display}\n      New value (Enter to keep): ").strip()
        return val or current


def _prompt_sqlite_auth(env_vars: dict[str, str], updates: dict[str, str]) -> None:
    _header("Auth DB — SQLite")
    updates["AUTH_DB_ENGINE"] = "sqlite"
    updates["AUTH_SQLITE_DB_PATH"] = _prompt(
        "AUTH_SQLITE_DB_PATH", env_vars.get("AUTH_SQLITE_DB_PATH", "")
    )


def _prompt_oracle_auth(env_vars: dict[str, str], updates: dict[str, str]) -> None:
    _header("Auth DB — Oracle ADW")
    print("  Configure Oracle connection for the auth (users) database.\n")
    updates["AUTH_DB_ENGINE"] = "oracle"

    updates["ORACLE_USER"]     = _prompt("ORACLE_USER",     env_vars.get("ORACLE_USER", ""))
    updates["ORACLE_PASSWORD"] = _prompt("ORACLE_PASSWORD", env_vars.get("ORACLE_PASSWORD", ""), sensitive=True)
    updates["ORACLE_DSN"]      = _prompt(
        "ORACLE_DSN (TNS service name)", env_vars.get("ORACLE_DSN", ""),
        required=True,
    )
    updates["ORACLE_WALLET_DIR"] = _prompt(
        "ORACLE_WALLET_DIR (path to wallet folder)", env_vars.get("ORACLE_WALLET_DIR", "")
    )
    updates["ORACLE_WALLET_PASSWORD"] = _prompt(
        "ORACLE_WALLET_PASSWORD", env_vars.get("ORACLE_WALLET_PASSWORD", ""),
        required=False, sensitive=True,
    )

    # Pool
    pool_min_raw = _prompt(
        "ORACLE_POOL_MIN", env_vars.get("ORACLE_POOL_MIN", "1"), required=False
    )
    pool_max_raw = _prompt(
        "ORACLE_POOL_MAX", env_vars.get("ORACLE_POOL_MAX", "5"), required=False
    )
    updates["ORACLE_POOL_MIN"] = pool_min_raw or "1"
    updates["ORACLE_POOL_MAX"] = pool_max_raw or "5"

    # Thick mode
    thick_current = env_vars.get("ORACLE_THICK_MODE", "0")
    thick_display = "yes" if thick_current == "1" else "no"
    thick_input = input(f"\n  Use Oracle Instant Client (thick mode)? [y/N, current: {thick_display}]: ").strip().lower()
    if thick_input == "":
        updates["ORACLE_THICK_MODE"] = thick_current
    else:
        updates["ORACLE_THICK_MODE"] = "1" if thick_input in ("y", "yes") else "0"

    if updates["ORACLE_THICK_MODE"] == "1":
        updates["ORACLE_LIB_DIR"] = _prompt(
            "ORACLE_LIB_DIR (Instant Client path)", env_vars.get("ORACLE_LIB_DIR", ""),
            required=False,
        )


def step_env(env_vars: dict[str, str]) -> None:
    updates: dict[str, str] = {}

    # ── Auth DB engine choice ─────────────────────────────────────────────────
    _header("Auth Database Engine")
    current_engine = env_vars.get("AUTH_DB_ENGINE", "sqlite").strip().lower()
    print(f"  Which engine stores user / auth data?")
    print(f"    1) SQLite  (local file — simple, recommended for personal use)")
    print(f"    2) Oracle  (Oracle Autonomous Database / ADW)")
    print(f"  Current: {current_engine}\n")

    engine_input = input("  Choose [1/2, Enter to keep current]: ").strip()
    if engine_input == "1":
        chosen_engine = "sqlite"
    elif engine_input == "2":
        chosen_engine = "oracle"
    else:
        chosen_engine = current_engine  # keep existing

    if chosen_engine == "oracle":
        _prompt_oracle_auth(env_vars, updates)
    else:
        _prompt_sqlite_auth(env_vars, updates)

    # ── Course DB (always SQLite) ────────────────────────────────────────────
    _header("Course Database (SQLite)")
    updates["COURSE_DB_ENGINE"] = "sqlite"
    updates["COURSE_SQLITE_DB_PATH"] = _prompt(
        "COURSE_SQLITE_DB_PATH", env_vars.get("COURSE_SQLITE_DB_PATH", "")
    )

    # ── Shared fields ────────────────────────────────────────────────────────
    _header("Auth / JWT Settings")
    updates["JWT_SECRET"]    = _prompt("JWT_SECRET",    env_vars.get("JWT_SECRET", ""),    sensitive=True)
    updates["INVITE_CODES"]  = _prompt("INVITE_CODES",  env_vars.get("INVITE_CODES", ""),  required=True)

    _write_env(ENV_PATH, updates)
    env_vars.update(updates)
    print("\n[+] .env saved.")



# ── Step 3: Start server ──────────────────────────────────────────────────────

def step_start() -> None:
    _header("Starting Server")
    print("[*] Running: python app.py\n")
    try:
        subprocess.run([sys.executable, "app.py"], check=True)
    except KeyboardInterrupt:
        print("\n[*] Server stopped.")
    except subprocess.CalledProcessError as exc:
        print(f"[ERROR] app.py exited with code {exc.returncode}")
        sys.exit(exc.returncode)


# ── Entry point ───────────────────────────────────────────────────────────────

def main() -> None:
    print("\n┌────────────────────────────────────┐")
    print("│   EducativeViewer Server Setup     │")
    print("└────────────────────────────────────┘")

    # Ensure .env exists
    if not ENV_PATH.exists():
        if ENV_EXAMPLE_PATH.exists():
            import shutil
            shutil.copy(ENV_EXAMPLE_PATH, ENV_PATH)
            print("[+] Created .env from .env.example")
        else:
            ENV_PATH.touch()
            print("[+] Created empty .env")

    env_vars = _parse_env(ENV_PATH)

    public_key = step_rsa(env_vars)
    step_env(env_vars)

    if public_key:
        print("\n" + "=" * 60)
        print("  Copy this public key into client/.env.local:")
        print(f"  NEXT_PUBLIC_RSA_PUBLIC_KEY={public_key}")
        print("=" * 60)

    answer = input("\nStart the server now? [Y/n]: ").strip().lower()
    if answer in ("", "y", "yes"):
        step_start()
    else:
        print("[*] Setup complete. Run 'python app.py' when ready.")


if __name__ == "__main__":
    main()
