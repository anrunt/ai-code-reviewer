import { parseArgs } from 'node:util';
import { z } from 'zod';

let args: ReturnType<typeof parseArgs>;

try {
  args = parseArgs({
    allowPositionals: true,
    strict: true,
    options: {
      help: {
        type: 'boolean',
        short: 'h',
      },
    },
  });

} catch (error) {
  const message = error instanceof Error
    ? error.message
    : "Failed to parse command-line arguments.";

  console.error(`Error: ${message}`);
  console.error("Run pnpm dev --help for usage.");
  process.exit(1);
}

if (args.values.help) {
  console.log(`
      Usage: pnpm dev review <PR_URL>
      Commands:
      review <PR_URL>  Validate a GitHub pull request URL and print its owner, repo, and number.

      Options:
      -h, --help      Show this help message.

      Example:
      pnpm dev review https://github.com/octocat/hello-world/pull/123

      V1 does not publish anything to GitHub.`
  );
  process.exit(0);
}

const { positionals } = args;

if (positionals.length !== 2) {
  console.error("Usage: pnpm dev review <pr_url>");
  process.exit(1);
}

if (positionals[0] !== "review") {
  console.error("Usage: pnpm dev review <pr_url>");
  process.exit(1);
}

const [, pr_url] = positionals;
const urlResult = z.url({ error: "Invalid URL." }).safeParse(pr_url);

if (!urlResult.success) {
  console.error(urlResult.error.issues[0]?.message ?? "Invalid URL.");
  process.exit(1);
}

const prUrl = new URL(urlResult.data);

if (prUrl.protocol !== "https:") {
  console.error("URL must use HTTPS.");
  process.exit(1);
}

if (prUrl.host !== "github.com") {
  console.error("URL must point to github.com without a non-standard port.");
  process.exit(1);
}

const pathError = "Expected a pull request URL in the format https://github.com/owner/repo/pull/number.";
const numberError = "Pull request number must be a positive safe integer.";

const prPathSchema = z.tuple([
  z.literal("", { error: pathError }),
  z.string({ error: pathError }).min(1, { error: pathError }),
  z.string({ error: pathError }).min(1, { error: pathError }),
  z.literal("pull", { error: pathError }),
  z.string({ error: numberError })
    .regex(/^[0-9]+$/, { error: numberError })
    .transform((value) => Number(value))
    .refine((value) => Number.isSafeInteger(value) && value > 0, {
      error: numberError,
    }),
], { error: pathError });

const pathResult = prPathSchema.safeParse(prUrl.pathname.split("/"));

if (!pathResult.success) {
  console.error(pathResult.error.issues[0]?.message ?? pathError);
  process.exit(1);
}

const [, owner, repo, , prNumber] = pathResult.data;

console.log(`Owner: ${owner}`);
console.log(`Repo: ${repo}`);
console.log(`PR Number: ${prNumber}`);
