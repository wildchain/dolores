#!/usr/bin/env node
// Post-build script: rewrites @dolores/* path aliases in compiled JS output.
// tsc emits these aliases literally; Node.js can't resolve them without help.
// This script replaces internal @dolores/* imports (those whose compiled output
// exists in dist/) with relative paths. Workspace packages like @dolores/solana-utils
// that live in node_modules are left untouched.

const fs = require('fs');
const path = require('path');

const distDir = path.resolve(__dirname, 'dist');

function fixFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  const fileDir = path.dirname(filePath);

  const updated = content.replace(/require\(["']@dolores\/([^"']+)["']\)/g, (match, modulePath) => {
    // Check if there's a compiled file for this internal module
    const candidates = [
      path.join(distDir, modulePath + '.js'),
      path.join(distDir, modulePath, 'index.js'),
    ];

    const resolvedSrc = candidates.find(c => fs.existsSync(c));
    if (!resolvedSrc) {
      // Not an internal module — leave for node_modules resolution
      return match;
    }

    // Compute relative path from the current file to the resolved dist file (without .js)
    const withoutExt = resolvedSrc.replace(/\.js$/, '');
    let rel = path.relative(fileDir, withoutExt);
    if (!rel.startsWith('.')) rel = './' + rel;
    return `require("${rel}")`;
  });

  if (updated !== content) {
    fs.writeFileSync(filePath, updated, 'utf8');
  }
}

function walkDir(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walkDir(full);
    } else if (entry.name.endsWith('.js')) {
      fixFile(full);
    }
  }
}

walkDir(distDir);
console.log('fix-aliases: path aliases rewritten in dist/');
