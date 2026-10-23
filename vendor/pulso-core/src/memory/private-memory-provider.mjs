import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { invariant } from "../domain/contracts.mjs";

const WORD = /[\p{L}\p{N}_-]{3,}/gu;

function tokens(value) {
  return new Set(String(value || "").toLocaleLowerCase("pt-BR").match(WORD) || []);
}

function markdownFiles(root) {
  if (!existsSync(root)) return [];
  const files = [];
  const visit = directory => {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const path = join(directory, entry.name);
      if (entry.isDirectory()) visit(path);
      else if (entry.isFile() && /\.(md|txt|json)$/i.test(entry.name)) files.push(path);
    }
  };
  visit(root);
  return files.sort();
}

function chunks(text, maxChars) {
  const paragraphs = String(text || "").split(/\n{2,}/);
  const result = [];
  let current = "";
  for (const paragraph of paragraphs) {
    if (current && current.length + paragraph.length + 2 > maxChars) {
      result.push(current);
      current = "";
    }
    if (paragraph.length > maxChars) {
      if (current) result.push(current);
      current = "";
      for (let offset = 0; offset < paragraph.length; offset += maxChars) {
        result.push(paragraph.slice(offset, offset + maxChars));
      }
    } else {
      current = current ? `${current}\n\n${paragraph}` : paragraph;
    }
  }
  if (current) result.push(current);
  return result.filter(Boolean);
}

export class PrivateMemoryProvider {
  constructor({ rootDir, maxResults = 8, chunkChars = 2600 } = {}) {
    invariant(typeof rootDir === "string" && rootDir.trim(), "private_memory_root_required");
    this.rootDir = rootDir;
    this.maxResults = maxResults;
    this.chunkChars = chunkChars;
  }

  async retrieve({ sessionId = null, input = "" } = {}) {
    const query = tokens(input);
    const candidates = [];
    for (const path of markdownFiles(this.rootDir)) {
      const source = relative(this.rootDir, path);
      const modifiedAt = statSync(path).mtime.toISOString();
      chunks(readFileSync(path, "utf8"), this.chunkChars).forEach((content, index) => {
        const contentTokens = tokens(content);
        let score = 0;
        for (const token of query) if (contentTokens.has(token)) score += 1;
        if (/SOUL|USER|IDENTITY/i.test(source)) score += 0.75;
        candidates.push({ source, chunk: index, score, content, modifiedAt });
      });
    }
    const selected = candidates
      .sort((a, b) => b.score - a.score || a.source.localeCompare(b.source) || a.chunk - b.chunk)
      .slice(0, this.maxResults)
      .map(item => Object.freeze({
        source: item.source,
        chunk: item.chunk,
        score: item.score,
        modifiedAt: item.modifiedAt,
        content: item.content,
      }));
    return Object.freeze({
      provider: "private-local-memory",
      sessionId,
      root: this.rootDir,
      retrievedAt: new Date().toISOString(),
      results: selected,
    });
  }
}
