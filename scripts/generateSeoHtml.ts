import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

type Locale = string;
type PageId = string;

type PageConfig = {
  slug: string;
  meta: Record<
    Locale,
    {
      title: string;
      description: string;
    }
  >;
};

type SeoConfig = {
  siteUrl: string;
  defaultLocale: Locale;
  locales: Locale[];
  pages: Record<PageId, PageConfig>;
};

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");
const seoConfigPath = path.join(rootDir, "src/app/i18n/seoPages.json");
const templatePath = path.join(rootDir, "index.html");

let seoConfig: SeoConfig;

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function pagePath(locale: Locale, page: PageId): string {
  const { pages } = seoConfig;
  const slug = pages[page].slug;
  return slug ? `/${locale}/${slug}` : `/${locale}`;
}

function pageUrl(locale: Locale, page: PageId): string {
  const { siteUrl } = seoConfig;
  return `${siteUrl}${pagePath(locale, page)}`;
}

function outputPath(locale: Locale, page: PageId): string {
  const { pages } = seoConfig;
  const slug = pages[page].slug;
  return slug
    ? path.join(rootDir, "locales", locale, slug, "index.html")
    : path.join(rootDir, "locales", locale, "index.html");
}

function alternateLinks(page: PageId): string {
  const { defaultLocale, locales } = seoConfig;
  const links = locales.map((locale) => {
    const href = pageUrl(locale, page);
    return `    <link rel="alternate" hreflang="${escapeHtml(locale)}" href="${escapeHtml(href)}" />`;
  });
  links.push(
    `    <link rel="alternate" hreflang="x-default" href="${escapeHtml(pageUrl(defaultLocale, page))}" />`,
  );
  return links.join("\n");
}

function replaceRequired(
  html: string,
  pattern: RegExp,
  replacement: string,
  label: string,
): string {
  if (!pattern.test(html)) {
    throw new Error(`Missing ${label} in index.html template.`);
  }
  return html.replace(pattern, replacement);
}

function renderHtml(template: string, locale: Locale, page: PageId): string {
  const { pages } = seoConfig;
  const meta = pages[page].meta[locale];
  const canonical = pageUrl(locale, page);

  if (!meta) {
    throw new Error(`Missing SEO meta for ${locale}/${page}.`);
  }

  let html = template;
  html = replaceRequired(
    html,
    /<html lang="[^"]*">/,
    `<html lang="${escapeHtml(locale)}">`,
    "html lang",
  );
  html = replaceRequired(
    html,
    /    <title>.*<\/title>/,
    `    <title>${escapeHtml(meta.title)}</title>`,
    "title",
  );
  html = replaceRequired(
    html,
    /    <meta name="description" content="[^"]*" \/>/,
    `    <meta name="description" content="${escapeHtml(meta.description)}" />`,
    "description",
  );
  html = replaceRequired(
    html,
    /    <link rel="canonical" href="[^"]*" \/>/,
    `    <link rel="canonical" href="${escapeHtml(canonical)}" />`,
    "canonical",
  );
  html = replaceRequired(
    html,
    /(?:    <link rel="alternate" hreflang="[^"]*" href="[^"]*" \/>\n)+/,
    `${alternateLinks(page)}\n`,
    "alternate links",
  );
  html = replaceRequired(
    html,
    /    <meta property="og:title" content="[^"]*" \/>/,
    `    <meta property="og:title" content="${escapeHtml(meta.title)}" />`,
    "og:title",
  );
  html = replaceRequired(
    html,
    /    <meta property="og:description" content="[^"]*" \/>/,
    `    <meta property="og:description" content="${escapeHtml(meta.description)}" />`,
    "og:description",
  );
  html = replaceRequired(
    html,
    /    <meta property="og:url" content="[^"]*" \/>/,
    `    <meta property="og:url" content="${escapeHtml(canonical)}" />`,
    "og:url",
  );
  html = replaceRequired(
    html,
    /window\.lang = "[^"]*";/,
    `window.lang = "${escapeHtml(locale)}";`,
    "window.lang",
  );
  return html;
}

async function main(): Promise<void> {
  seoConfig = JSON.parse(await readFile(seoConfigPath, "utf8")) as SeoConfig;
  const template = await readFile(templatePath, "utf8");
  const { defaultLocale, locales, pages } = seoConfig;
  const pageIds = Object.keys(pages);

  for (const locale of locales) {
    for (const page of pageIds) {
      const htmlPath = outputPath(locale, page);
      await mkdir(path.dirname(htmlPath), { recursive: true });
      await writeFile(htmlPath, renderHtml(template, locale, page), "utf8");
    }
  }

  await writeFile(
    path.join(rootDir, "index.html"),
    renderHtml(template, defaultLocale, "home"),
    "utf8",
  );

  console.log(
    `Generated ${locales.length * pageIds.length + 1} SEO HTML files.`,
  );
}

main();
