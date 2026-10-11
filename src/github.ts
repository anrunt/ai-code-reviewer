import { Octokit } from 'octokit';
import { z } from 'zod';

const repositorySchema = z.object({
  owner: z.object({
    login: z.string().min(1),
  }),
  name: z.string().min(1),
});

const shaSchema = z.string().regex(/^[0-9a-f]{40}$/i);

const pullRequestSchema = z.object({
  number: z.number().int().positive(),
  html_url: z.url(),
  title: z.string(),
  body: z.string().nullable(),
  base: z.object({
    sha: shaSchema,
    repo: repositorySchema,
  }),
  head: z.object({
    sha: shaSchema,
    repo: repositorySchema.nullable(),
  }),
  changed_files: z.number().int().nonnegative(),
  additions: z.number().int().nonnegative(),
  deletions: z.number().int().nonnegative(),
});

export async function getPullRequest({
  token,
  owner,
  repo,
  prNumber,
}: {
  token: string;
  owner: string;
  repo: string;
  prNumber: number;
}) {
  const octokit = new Octokit({
    auth: token,
    throttle: {
      onRateLimit: () => false,
      onSecondaryRateLimit: () => false,
    },
  });

  const response = await octokit.rest.pulls.get({
    owner,
    repo,
    pull_number: prNumber,
  });

  return pullRequestSchema.parse(response.data);
}
