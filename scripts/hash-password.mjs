#!/usr/bin/env node
/**
 * Ry-Mark password hash generator — `npm run hash:password`.
 *
 * Behavior (per project specification):
 * - Prompts the administrator twice for a password with masked input
 *   (raw terminal mode; the plaintext is never echoed or written anywhere).
 * - Generates a cryptographically secure random salt.
 * - Produces the exact hash format the runtime verifier expects
 *   (scripts/lib/password-hash.mjs, verified against shared/auth-core by tests).
 * - Prints ONLY the resulting hash.
 * - Works on Windows, Linux and macOS (Node >= 20, no dependencies).
 *
 * The output must be stored as an encrypted Cloudflare secret / environment
 * variable named PASSWORD_HASH. It must never be committed to the repository.
 */
import { stdin as input, stdout as output } from "node:process";
import { emitWarning } from "node:process";
import { DEFAULT_ITERATIONS, hashPassword } from "./lib/password-hash.mjs";

const isTty = input.isTTY;

function warn(message) {
  emitWarning(message);
}

/**
 * Reads one line of hidden input using raw terminal mode.
 * Supports backspace (0x7f / 0x08), Ctrl+U (clear), Ctrl+C (abort) and Enter.
 * UTF-8 multibyte characters are supported by accumulating raw bytes.
 */
function readHiddenLine(promptText) {
  return new Promise((resolve, reject) => {
    if (!isTty) {
      reject(new Error("No interactive terminal available."));
      return;
    }

    output.write(promptText);
    const wasRaw = input.isRaw;
    input.setRawMode(true);
    input.resume();

    let bytes = [];
    let closed = false;

    const cleanup = () => {
      if (closed) return;
      closed = true;
      input.setRawMode(wasRaw);
      input.pause();
      input.removeListener("data", onData);
    };

    const onData = (chunk) => {
      // chunk may contain several bytes; process individually.
      for (const byte of Uint8Array.from(chunk)) {
        if (byte === 0x03) {
          // Ctrl+C — abort without printing anything sensitive.
          cleanup();
          output.write("\n");
          reject(new Error("Cancelled by user."));
          return;
        }
        if (byte === 0x0d || byte === 0x0a) {
          // Enter — end of input.
          cleanup();
          output.write("\n");
          try {
            resolve(new TextDecoder("utf-8", { fatal: false }).decode(new Uint8Array(bytes)));
          } catch (error) {
            reject(error);
          }
          return;
        }
        if (byte === 0x7f || byte === 0x08) {
          // Backspace.
          if (bytes.length > 0) bytes.pop();
          continue;
        }
        if (byte === 0x15) {
          // Ctrl+U — clear line.
          bytes = [];
          continue;
        }
        // Ignore other control characters; accept printable + UTF-8 bytes.
        if (byte >= 0x20) {
          bytes.push(byte);
          output.write("*");
        }
      }
    };

    input.on("data", onData);
  });
}

async function main() {
  console.log("Ry-Mark password hash generator");
  console.log("-------------------------------");
  console.log("The password will not be displayed. Press Ctrl+C to cancel.\n");

  let password;
  let confirmation;

  if (isTty) {
    password = await readHiddenLine("Password: ");
    confirmation = await readHiddenLine("Confirm password: ");
  } else {
    // Non-interactive fallback (e.g. piped input) for scripted setups.
    warn("Warning: non-interactive input; password is read from stdin.");
    const chunks = [];
    for await (const chunk of input) chunks.push(chunk);
    password = Buffer.concat(chunks).toString("utf8").replace(/\r?\n$/, "");
    confirmation = password;
  }

  if (password.length < 8) {
    console.error("\nError: the password must be at least 8 characters long.");
    process.exit(1);
  }
  if (password !== confirmation) {
    console.error("\nError: the passwords do not match.");
    process.exit(1);
  }

  const hash = await hashPassword(password, DEFAULT_ITERATIONS);
  // The plaintext password is never logged or written to disk.
  console.log("\nDone. Store the following value as an encrypted secret named PASSWORD_HASH:\n");
  console.log(hash);
  console.log(
    "\nSee docs/PASSWORD-SETUP.md for where to place it (Cloudflare dashboard, " +
      "`wrangler pages secret put`, or the .env file for self-hosted deployments).",
  );
}

main().catch((error) => {
  console.error(`\n${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
