const { execSync } = require('child_process');

function run(cmd) {
  execSync(cmd, { stdio: 'ignore' });
}

try {
  run('git rev-parse --is-inside-work-tree');
  run('git config filter.stripcomments.clean "node scripts/strip-comments.js %f"');
  run('git config filter.stripcomments.smudge cat');
} catch (err) {
  
  void err;
}
