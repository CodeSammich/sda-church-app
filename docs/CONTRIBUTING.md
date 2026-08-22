# Contributing & Release Workflow

## Release & Versioning

This project uses **Semantic Versioning** (npm SemVer Guide). For release pull requests,
the version in the PR title is the source of truth. Release CI synchronizes that version
to `package.json`, `package-lock.json`, `app.json`, and `public/sw.js` after merge.

### Two-stage release process

Changes reach production through two distinct pull requests. Do not open a feature PR
directly against `main`.

- **Any contributor** may fork the repository, branch from the active release branch, and
  open the first PR from their fork into that release branch.
- **Code maintainers only** create and merge the second PR from the primary repository's
  release branch into `main`. Contributors do not need write access to `main` or permission
  to perform this release step.

Release branch creation is currently a manual, code-maintainer action. No workflow creates
`release/x.y.z` automatically. This is intentional: starting a release chooses the version
and production scope and should remain an explicit decision.

1. A maintainer creates `release/x.y.z` from the primary repository's `main` branch. If
   the release branch does not exist, ask a maintainer to create it.
2. Create the feature branch from that release branch, then push it to your fork:

   ```bash
   git fetch upstream
   git switch -c feature/your-feature upstream/release/0.26.0
   git push -u origin feature/your-feature
   ```

3. Open the feature PR from the fork's feature branch into the primary repository's
   matching `release/x.y.z` branch. Start its title with the matching version in the form
   `Release x.y.z: Brief description`, complete the PR template, and wait for all checks
   and reviews.
4. After all planned feature PRs are merged, a code maintainer opens the release PR from
   `release/x.y.z` into `main`. Only maintainers perform this second stage; contributors
   should not retarget their feature PRs to `main`.
5. The merge to `main` triggers version synchronization, tagging, and deployment.

### Future release-branch automation

If release creation is automated later, begin with a maintainer-run local helper that:

1. validates the requested semantic version;
2. confirms the release branch and version tag do not already exist;
3. starts from the current primary-repository `main` branch;
4. creates the release branch and synchronizes all version files; and
5. stops before committing or pushing so the maintainer can review the result.

Only consider a manually dispatched GitHub Actions workflow after that helper has been used
successfully for multiple releases. The workflow must perform release validation itself:
pushes made with the standard `GITHUB_TOKEN` generally do not trigger another workflow run.
Do not create release branches automatically from dates, issue activity, or feature merges.

### Pull request format and issue closing

Every feature and release PR must follow `.github/pull_request_template.md`:

- Start the PR title with the exact release version, for example
  `Release 0.26.0: Add bulletin navigation`. When the destination branch is named
  `release/x.y.z`, the title version must match it.
- Describe the user-visible and technical changes under **Description**.
- Put issue references under **Related issues**, one per line, using a supported closing
  keyword such as `Closes #133`.
- Complete the automated and applicable Android/iOS testing items. Only check a platform
  after it has actually been tested on the version named by the template.

GitHub closes linked issues only when the closing reference reaches the default branch.
Therefore, `Closes #133` in a feature PR to `release/x.y.z` links the work but does not
close the issue when that feature PR merges. Release automation adds the `pending release`
label to show that the fix is merged and awaiting the production release. The maintainer
must copy all closing references from the included feature PRs into the final
`release/x.y.z` → `main` PR.
This is the code maintainer's responsibility, not the fork contributor's. Merging that
final PR into `main` closes the issues. Do not rely on a reviewer to repair the merge
commit message at the last moment.

## Branch Protection & Workflow

```
main (stable)
  ↑
  └─ release/0.2.0 (release candidate)
       ↑
       └─ feature/awesome-feature (work in progress)
```

### Branch Rules

#### `main` Branch

- **Protected branch** — Cannot push directly
- **Requires PR** — All changes must come through a pull request
- **Requires PR reviews** — Pull requests must be approved before merge
- **Requires checks to pass** — CI/CD checks must pass
- **Source**: Only from `release/**` branches
- **Auto-tag on merge** — Automatically creates semantic version tags

#### `release/*` Branches

- **Source**: Created from `main` for each release
- **Naming convention**: `release/*` (e.g., `release/0.8.2` or `release/v1-beta`)
- **Purpose**: Prepare the release and validate the version bump
- **PR validation**:
  - Requires a `Release x.y.z` PR title and compares it with a `release/x.y.z`
    destination branch when applicable.
  - After merge, automatically synchronizes `package.json`, `package-lock.json`,
    `app.json`, and `public/sw.js` from the merged PR title.

#### Feature/Work Branches

- **Naming convention**: `feature/`, `bugfix/`, `chore/`, `docs/`, etc.
- **Source**: Branch from the active `release/*` branch
- **PR target**: The matching release branch in the primary repository
- **Never target `main` directly**: Only the final release PR targets `main`

### Pull Request Workflow

1. Branch from the active `release/x.y.z` branch.
2. Make and verify the changes, then commit them clearly.
3. Push to the fork and open a PR into the matching primary-repository release branch.
4. Follow the PR template, including Related issues and the testing checklist.
5. Merge the feature PR after checks and review pass; its issues remain open at this stage.
6. A code maintainer aggregates the feature PRs and their closing references in the final
   release PR to `main`.
7. Merge the release PR after its checks and review pass. GitHub closes the referenced
   issues, and the deployment workflow creates the release tag.

### Automated Checks

#### `Release - PR Version Sync` (`.github/workflows/release-validation.yml`)

- **Validate PR title**: Requires `Release x.y.z` and ensures it matches a
  `release/x.y.z` destination branch when applicable.
- **Auto-Sync after merge**: Uses the merged PR title to synchronize `package.json`,
  `package-lock.json`, `app.json`, and `public/sw.js` on the release branch.

#### `Issues - Pending Release Label` (`.github/workflows/pending-release-label.yml`)

- Adds `pending release` to issues referenced with `Closes #<issue>` when a PR merges
  into a `release/x.y.z` branch, including PRs submitted from forks.
- Removes the label when the issue closes after the final release reaches `main`.

#### `Deploy and Tag` (`.github/workflows/deploy.yml`)

- **Final Validation**: Ensures the merged version is unique.
- **Automated Tagging**: Creates a new Git tag (e.g., `v0.8.2`) matching the `package.json` version.

### Example feature workflow

```bash
# Start from the active release branch in the primary repository
git fetch upstream
git switch -c feature/bulletin-navigation upstream/release/0.26.0

# After implementation and verification, push to the fork
git push -u origin feature/bulletin-navigation
```

Then open the feature PR into `upstream/release/0.26.0` with a title beginning
`Release 0.26.0:`. A maintainer later opens the
separate `release/0.26.0` → `main` PR and repeats its closing issue references there.
