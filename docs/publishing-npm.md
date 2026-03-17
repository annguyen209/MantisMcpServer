# Publishing `@annguyen209/mantis-mcp-server` to npm

This guide explains how to publish `MantisMcpServer` as an npm package and keep the release flow predictable.

## What this repo already supports

The repo is already configured for npm packaging:

- npm package name: `@annguyen209/mantis-mcp-server`
- CLI entrypoint: `mantis-mcp-server`
- publishable package files are constrained through `package.json -> files`
- `prepack` builds the bundle automatically
- `pack:check` previews the published tarball
- VS Code can launch the package with `npx` while still using `stdio`

## Before your first publish

### 1. Decide the license

The package currently uses:

- `UNLICENSED`

If you plan to publish publicly to npm, replace this with the license you actually want to ship, for example:

- `MIT`
- `Apache-2.0`
- `BSD-3-Clause`

### 2. Confirm the package name is available

The package name is currently:

- `@annguyen209/mantis-mcp-server`

Before publishing publicly, verify that the name is available on npm.

### 3. Log in locally to npm

Make sure your npm account can publish the package.

### 4. Configure npm trusted publishing (recommended)

For GitHub Actions publishing, prefer npm trusted publishing instead of storing `NPM_TOKEN`.

In npm package settings, add this GitHub repository/workflow as a trusted publisher for:

- `@annguyen209/mantis-mcp-server`

This repository workflow already requests:

- `id-token: write`

which is required for trusted publishing with provenance.

## Local release checklist

Before publishing, run:

- `npm test`
- `npm run build`
- `npm run pack:check`

These should all pass cleanly.

## Versioning flow

Use semver:

- patch: `1.0.0 -> 1.0.1`
- minor: `1.0.0 -> 1.1.0`
- major: `1.0.0 -> 2.0.0`

Bump the version in `package.json` before tagging a release.

## Publish options

### Option 1: GitHub Actions publish by tag

This repo includes a workflow at:

- `.github/workflows/publish-npm.yml`

It publishes when you push a tag matching:

- `v*.*.*`

Examples:

- `v1.0.1`
- `v1.2.0`
- `v2.0.0`

### Recommended release sequence

1. update `package.json` version
2. run tests and packaging checks locally
3. commit the version change
4. create a git tag matching the package version with a leading `v`
5. push the branch and the tag

Example flow:

```text
Update package.json to 1.0.1
Commit changes
Tag: v1.0.1
Push branch
Push tag
```

The workflow then:

- installs dependencies with `npm ci`
- runs tests
- builds the bundle
- publishes to npm with trusted publishing + provenance

### Option 2: Manual publish from your machine

If you prefer to publish locally:

1. ensure you are logged into npm
2. run validation checks
3. publish

Typical local flow:

```text
npm test
npm run build
npm run pack:check
npm publish
```

## VS Code usage after publish

Once published, VS Code should normally launch the package with `npx`.

Example MCP config:

```json
{
  "mcpServers": {
    "mantis-rest": {
      "command": "npx",
      "args": ["-y", "@annguyen209/mantis-mcp-server"],
      "env": {
        "MANTIS_BASE_URL": "https://mantis.example.com/api/rest",
        "MANTIS_USE_INDEX_PHP": "true",
        "MANTIS_API_TOKEN": "YOUR_REAL_TOKEN_HERE"
      }
    }
  }
}
```

This still uses `stdio`; npm just changes the delivery mechanism.

## Troubleshooting

### Publish fails with authentication errors

Check:

- the npm account has access to the package name/scope

If you see this specific error:

- `E403 ... Two-factor authentication or granular access token with bypass 2fa enabled is required`

you are publishing with a token that does not satisfy npm's 2FA policy.

Fix options:

1. **Recommended:** use npm trusted publishing for GitHub Actions (no `NPM_TOKEN` needed).
2. Use a publish-capable npm token that explicitly supports your account's 2FA policy (automation/granular token with bypass 2FA enabled).

### Publish fails because the version already exists

npm does not allow re-publishing the same version.

Fix:

- bump the version in `package.json`
- create a new tag
- publish again

### Workflow tag version and package version do not match

Keep these aligned:

- `package.json` version `1.0.1`
- git tag `v1.0.1`

That avoids confusion and release archaeology later.

## Recommended next improvements

Optional future improvements:

- add a changelog
- add automated release notes
- add provenance/signing requirements for npm publish
- add a second workflow for GitHub Packages if you want private internal distribution
