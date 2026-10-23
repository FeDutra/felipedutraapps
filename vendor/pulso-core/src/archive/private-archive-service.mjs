import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { extname, join, relative, resolve, sep } from "node:path";
import { invariant } from "../domain/contracts.mjs";

const SEARCHABLE = new Set([".md", ".txt", ".json", ".jsonl"]);

function queryTerms(value) {
  return [...new Set(String(value || "")
    .toLocaleLowerCase("pt-BR")
    .match(/[\p{L}\p{N}_-]{2,}/gu) || [])];
}

function searchableFiles(root, scopes) {
  if (!existsSync(root)) return [];
  const allowedRoots = scopes.length
    ? scopes.map(scope => resolve(root, scope))
    : [resolve(root)];
  const files = [];
  for (const allowed of allowedRoots) {
    if (!allowed.startsWith(`${resolve(root)}${sep}`) && allowed !== resolve(root)) continue;
    if (!existsSync(allowed)) continue;
    const visit = directory => {
      for (const entry of readdirSync(directory, { withFileTypes: true })) {
        const absolute = join(directory, entry.name);
        if (entry.isDirectory()) visit(absolute);
        else if (entry.isFile() && SEARCHABLE.has(extname(entry.name).toLowerCase())) files.push(absolute);
      }
    };
    const entry = statSync(allowed);
    if (entry.isDirectory()) visit(allowed);
    else if (entry.isFile()) files.push(allowed);
  }
  return [...new Set(files)].sort();
}

function snippetFor(text, terms, radius = 360) {
  const lower = text.toLocaleLowerCase("pt-BR");
  const positions = terms.map(term => lower.indexOf(term)).filter(position => position >= 0);
  if (!positions.length) return null;
  const start = Math.max(0, Math.min(...positions) - radius);
  const end = Math.min(text.length, start + radius * 2);
  return text.slice(start, end).replace(/\s+/g, " ").trim();
}

export class PrivateArchiveService {
  constructor({ rootDir, maxFileBytes = 64 * 1024 * 1024 } = {}) {
    invariant(typeof rootDir === "string" && rootDir.trim(), "private_archive_root_required");
    this.rootDir = resolve(rootDir);
    this.maxFileBytes = maxFileBytes;
  }

  status() {
    const manifestPath = join(this.rootDir, "manifest.json");
    if (!existsSync(manifestPath)) return { configured: false, root: this.rootDir, files: 0, bytes: 0 };
    const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
    return {
      configured: true,
      root: this.rootDir,
      generatedAt: manifest.generatedAt || null,
      files: Number(manifest?.totals?.files || 0),
      bytes: Number(manifest?.totals?.bytes || 0),
    };
  }

  search({ query, limit = 20, scopes = [] } = {}) {
    const terms = queryTerms(query);
    invariant(terms.length > 0, "archive_search_query_required");
    const boundedLimit = Math.max(1, Math.min(Number(limit) || 20, 100));
    const safeScopes = Array.isArray(scopes)
      ? scopes.map(value => String(value)).filter(value => /^(sessions|skills)(\/[^.][^/]*)*$|^automations\.json$|^runtime-catalog\.json$/.test(value))
      : [];
    const matches = [];
    let scannedFiles = 0;
    let skippedFiles = 0;
    for (const file of searchableFiles(this.rootDir, safeScopes)) {
      const size = statSync(file).size;
      if (size > this.maxFileBytes) {
        skippedFiles += 1;
        continue;
      }
      scannedFiles += 1;
      const text = readFileSync(file, "utf8");
      const lower = text.toLocaleLowerCase("pt-BR");
      const score = terms.reduce((sum, term) => sum + (lower.includes(term) ? 1 : 0), 0);
      if (!score) continue;
      matches.push({
        source: relative(this.rootDir, file),
        score,
        bytes: size,
        modifiedAt: statSync(file).mtime.toISOString(),
        snippet: snippetFor(text, terms),
      });
    }
    return {
      provider: "private-local-archive",
      query: String(query),
      scopes: safeScopes,
      scannedFiles,
      skippedFiles,
      results: matches
        .sort((a, b) => b.score - a.score || a.source.localeCompare(b.source))
        .slice(0, boundedLimit),
    };
  }
}
