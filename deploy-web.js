const child_process = require('child_process');
const path = require('path');

// Get arguments passed to this script (e.g., '--increment')
console.log(process.argv);
const args = process.argv.slice(2);
console.log(args);
const incrementFlag = args.includes('--increment') ? '--increment' : '';

// Command to run sync-version.js, passing the increment flag if present
const syncVersionCommand =
  `node "${path.resolve(__dirname, 'sync-version.js')}" ${incrementFlag}`.trim();

// Full deployment command sequence
const fullDeploymentCommand = `
  ${syncVersionCommand} &&
  rm -rf dist &&
  npx expo export --platform web --clear &&
  npx gh-pages -d dist --dotfiles
`
  .replace(/\s+/g, ' ')
  .trim(); // Clean up extra whitespace

console.log(`Executing deployment command: ${fullDeploymentCommand}`);

try {
  child_process.execSync(fullDeploymentCommand, { stdio: 'inherit' });
  console.log('Deployment completed successfully.');
} catch (error) {
  console.error('Deployment failed:', error.message);
  process.exit(1);
}
