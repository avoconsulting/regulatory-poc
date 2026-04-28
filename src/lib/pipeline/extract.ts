import fs from "fs/promises";
import path from "path";
import { PDFParse } from "pdf-parse";
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
  const parser = new PDFParse({ data: buffer });
  try {
    const result = await parser.getText();
    return {
      filename: path.basename(filePath),
      filetype: "pdf",
      text: result.text,
      pageCount: result.total,
    };
  } finally {
    await parser.destroy();
  }
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

// Mapper som er interne/organisatoriske — skal ikke i kunnskapsbasen.
// Sammenlikning gjøres mot trimmet, lowercase navn (pga. trailing spaces og æøå).
const SKIP_FOLDERS = new Set([
  "rag.arkitektur",
  "vektordatabase.organisering",
  "url.kilde arealplaner.norge",
  "visualisering av scenarier",
]);

function shouldSkipFolder(name: string): boolean {
  return SKIP_FOLDERS.has(name.trim().toLowerCase());
}

export async function findDocuments(dirPath: string): Promise<string[]> {
  const results: string[] = [];

  async function walk(dir: string) {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isDirectory() && shouldSkipFolder(entry.name)) continue;

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
