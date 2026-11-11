# Connect the pipeline

## 1. Install and check

From this repository’s root:

```sh
npm ci
npm run format:check
npm test
npm run check
npm run package
npm run verify:bundle
```

Commit `package-lock.json` with the project. Publish this folder as the repository root, not the parent job-hunt workspace. This repository already has its GitHub remote configured.

## 2. Choose your theme source

For this portfolio demo, keep the included minimal `theme/` folder and use a development store.

For a real store, replace the demo contents with a complete copy of that store’s actual theme. Keep a backup outside this project and review the changes before committing. Do not layer demo files over a client’s theme. Retain `theme/.theme-check.yml`, or adopt the existing theme’s check configuration deliberately.

Do not commit `config/settings_data.json`: it contains store-specific settings. This project ignores it and excludes it from bundles. JSON templates and section groups also contain merchant-edited settings; decide who owns them before deploying.

## 3. Create dedicated targets

In a development store, create an unpublished staging theme and a separate production demo theme. Bootstrap the demo themes with the complete source so the homepage templates exist. Replace the example domain:

```sh
npx shopify theme push --path theme --unpublished --store your-store.myshopify.com
```

Repeat to create the second theme. Name them clearly in Shopify, then list the IDs:

```sh
npx shopify theme list --store your-store.myshopify.com
```

For an existing real store, create an unpublished copy of the actual theme for staging. Do not bootstrap it with this demo theme. Ensure staging contains the templates and settings needed for realistic previews.

The release workflow updates an existing theme. It does not automatically publish an unpublished theme.

## 4. Create the deployment credential

Use Shopify’s Theme Access app to generate a deployment password. Store it only as a GitHub environment secret. Use separate passwords for staging and production where possible, and rotate or revoke access when needed.

## 5. Set GitHub environments

Open repository **Settings → Environments**. Create `staging` and `production`. In each, configure:

| Kind              | Name                       | Value                                                          |
| ----------------- | -------------------------- | -------------------------------------------------------------- |
| Variable          | `SHOPIFY_STORE`            | Exact `example.myshopify.com` domain, without `https://`       |
| Variable          | `SHOPIFY_THEME_ID`         | Numeric target theme ID for this environment                   |
| Secret            | `SHOPIFY_CLI_THEME_TOKEN`  | Theme Access password                                          |
| Optional variable | `MANAGE_THEME_EDITOR_JSON` | `true` only when templates and section groups are owned by Git |

Use different theme IDs when both environments share a store. Separate staging and production stores are supported by setting their respective domains and credentials.

For production, configure required reviewers where supported, restrict deployment branches to `main`, and disable self-approval if your team requires independent review. Without environment protection a dispatched workflow can proceed immediately. Protect `main` and require **Theme quality** before merging.

## 6. Enable staging

Under **Settings → Secrets and variables → Actions → Variables**, add repository variable `ENABLE_STAGING=true`.

Push the completed project to `main`. Open **Actions → Theme CI**. Checks should pass and staging should deploy. Check the staging theme preview in Shopify and the deployment summary in GitHub.

## 7. Release a tested build

Open the successful main push run and copy the number after `/actions/runs/` in its URL. Dispatch **Release or rollback** from `main`, enter that run ID, type the production theme ID, and select live updates only if the production target is live. Approve the deployment if prompted and inspect the result.

Use an earlier successful run ID to roll back. Runs created before bundle manifests were added are incompatible: create a new main push run first.

## Everyday work

```sh
git switch -c update-banner
```

Edit theme source, then:

```sh
npm run format
npm test
npm run check
git add .
git commit -m "Update promotional banner"
git push -u origin update-banner
```

Open a pull request, merge after checks, preview staging, then promote the successful CI build. If the heading was already saved in the theme editor, changing its schema default may not affect the preview. Edit a visible markup/style change for the demo, or deliberately manage saved JSON settings through Git.

## Troubleshooting

| Problem                          | Check                                                                            |
| -------------------------------- | -------------------------------------------------------------------------------- |
| CI fails before install          | Commit `package-lock.json`                                                       |
| Staging skipped                  | Repository variable `ENABLE_STAGING` must be `true`                              |
| Staging rejected as stale        | Let the latest main push run finish                                              |
| Theme not found                  | Store domain, theme ID, and credential access                                    |
| Production confirmation rejected | Enter the configured production theme ID exactly                                 |
| Live theme blocked               | Use staging unpublished; explicitly opt in only for production live updates      |
| Layout/template change missing   | Default policy preserves JSON; review ownership before enabling JSON deployment  |
| Old files remain after release   | `--nodelete` is intentional; review a separate cleanup                           |
| Cannot download release bundle   | Run must be successful main push CI, with an unexpired manifest-bearing artifact |
