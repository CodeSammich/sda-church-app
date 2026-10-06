import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

// Every release goes through one organization branch, release-candidate, and
// the release PR's title sets the version (#410). The workflows that run only
// on that PR, the gate on main, and the pending-release labels all key off the
// branch's name, so a rename has to change them together.
const workflowDir = resolve(process.cwd(), '.github/workflows');
const readWorkflow = (file: string) => readFileSync(resolve(workflowDir, file), 'utf8');

describe('release-candidate branch', () => {
  it('is the only release branch any workflow knows', () => {
    for (const file of readdirSync(workflowDir)) {
      expect(`${file}: ${readWorkflow(file)}`).not.toMatch(/release\/(\*|\[|x\b|\d)|'release\/'/);
    }
  });

  it('is the only source the gate on main accepts', () => {
    const gate = readWorkflow('main-release-source-gate.yml');
    expect(gate).toContain('if [[ "$HEAD_REF" != "release-candidate" ]]; then');
    expect(gate).toContain('if [[ "$HEAD_REPOSITORY" != "$REPOSITORY" ]]; then');
    // The Main protection ruleset requires this check name.
    expect(gate).toContain('name: ensure_pr_to_main_from_release_branch');
  });

  it('gets pending-release labels when a feature PR merges into it', () => {
    expect(readWorkflow('pending-release-label.yml'))
      .toContain('if [[ "$BASE_REF" != "release-candidate" ]]; then');
  });

  it('needs a linked issue on PRs into it and into main', () => {
    expect(readWorkflow('pr-linked-issue.yml'))
      .toMatch(/\n    branches:\n      - main\n      - release-candidate\n/);
  });

  it('checks the version files only on the release PR into main', () => {
    const validation = readWorkflow('release-validation.yml');
    const sync = validation.slice(validation.indexOf('\n  sync:\n'));
    expect(sync).toContain("github.event.pull_request.base.ref == 'main'");
    expect(sync).toContain("github.event.pull_request.head.ref == 'release-candidate'");
    expect(sync).toContain('npm run sync-version -- --version "$VERSION"');
  });

  it('may reuse main\'s version only to recover an untagged release', () => {
    const check = readWorkflow('pr-check.yml');
    expect(check).toContain('if [ "$HEAD_REF" != "release-candidate" ]; then');
    expect(check).toContain('refs/tags/v$HEAD_VER');
  });
});
