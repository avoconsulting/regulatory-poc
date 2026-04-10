import fs from "fs/promises";
import path from "path";
// @ts-expect-error — pdf-parse ESM export doesn't have proper default type
import pdfParse from "pdf-parse";
import mammoth from "mammoth";

// ──────────────────────────────────────────────
// Typer
// ──────────────────────────────────────────────

export interface ExtractedDocument {
  filename: string;
  filetype: "pdf" | "docx" | "txt";
  text: string;
  pageCount?: number;
}

// ──────────────────────────────────────────────
// Ekstraksjon
// ──────────────────────────────────────────────

async function extractPdf(filePath: string): Promise<ExtractedDocument> {
  const buffer = await fs.readFile(filePath);
  const data = await pdfParse(buffer);

  return {
    filename: path.basename(filePath),
    filetype: "pdf",
    text: data.text,
    pageCount: data.numpages,
  };
}

async function extractDocx(filePath: string): Promise<ExtractedDocument> {
  const buffer = await fs.readFile(filePath);
  const result = await mammoth.extractRawText({ buffer });

  return {
    filename: path.basename(filePath),
    filetype: "docx",
    text: result.value,
  };
}

async function extractTxt(filePath: string): Promise<ExtractedDocument> {
  const text = await fs.readFile(filePath, "utf-8");

  return {
    filename: path.basename(filePath),
    filetype: "txt",
    text,
  };
}

export async function extractText(filePath: string): Promise<ExtractedDocument> {
  const ext = path.extname(filePath).toLowerCase();

  switch (ext) {
    case ".pdf":
      return extractPdf(filePath);
    case ".docx":
      return extractDocx(filePath);
    case ".txt":
    case ".md":
      return extractTxt(filePath);
    default:
      throw new Error(`Ikke støttet filtype: ${ext} (${filePath})`);
  }
}

// ──────────────────────────────────────────────
// Finn alle dokumenter i en mappe
// ──────────────────────────────────────────────

const SUPPORTED_EXTENSIONS = new Set([".pdf", ".docx", ".txt", ".md"]);

export async function findDocuments(dirPath: string): Promise<string[]> {
  const results: string[] = [];

  async function walk(dir: string) {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        await walk(fullPath);
      } else if (SUPPORTED_EXTENSIONS.has(path.extname(entry.name).toLowerCase())) {
        results.push(fullPath);
      }
    }
  }

  await walk(dirPath);
  return results.sort();
}
