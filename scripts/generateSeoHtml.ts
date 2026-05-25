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

type RootConfig = {
  locale: Locale;
  meta: {
    title: string;
    description: string;
  };
};

type SeoConfig = {
  siteUrl: string;
  defaultLocale: Locale;
  locales: Locale[];
  root: RootConfig;
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
  return `${siteUrl.replace(/\/$/, "")}${pagePath(locale, page)}`;
}

function rootUrl(): string {
  return seoConfig.siteUrl.endsWith("/")
    ? seoConfig.siteUrl
    : `${seoConfig.siteUrl}/`;
}

function outputPath(locale: Locale, page: PageId): string {
  const { pages } = seoConfig;
  const slug = pages[page].slug;
  return slug
    ? path.join(rootDir, "locales", locale, slug, "index.html")
    : path.join(rootDir, "locales", locale, "index.html");
}

function xmlEscape(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function alternateLinks(page: PageId): string {
  const { defaultLocale, locales } = seoConfig;
  const links = locales.map((locale) => {
    const href = pageUrl(locale, page);
    return `    <link rel="alternate" hreflang="${escapeHtml(locale)}" href="${escapeHtml(href)}" />`;
  });
  const xDefault = page === "home" ? rootUrl() : pageUrl(defaultLocale, page);
  links.push(
    `    <link rel="alternate" hreflang="x-default" href="${escapeHtml(xDefault)}" />`,
  );
  return links.join("\n");
}

function rootAlternateLinks(): string {
  const links = seoConfig.locales.map((locale) => {
    const href = pageUrl(locale, "home");
    return `    <link rel="alternate" hreflang="${escapeHtml(locale)}" href="${escapeHtml(href)}" />`;
  });
  links.push(
    `    <link rel="alternate" hreflang="x-default" href="${escapeHtml(rootUrl())}" />`,
  );
  return links.join("\n");
}

function jsonLdScript(data: Record<string, unknown>): string {
  return `    <script type="application/ld+json">${JSON.stringify(data)}</script>`;
}

function softwareApplicationJsonLd(
  name: string,
  description: string,
  url: string,
): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name,
    applicationCategory: "MultimediaApplication",
    operatingSystem: "Web",
    url,
    description,
    offers: {
      "@type": "Offer",
      price: "0",
      priceCurrency: "USD",
    },
  };
}

function insertJsonLd(html: string, data: Record<string, unknown>): string {
  return replaceRequired(
    html,
    /  <\/head>/,
    `${jsonLdScript(data)}\n  </head>`,
    "head close",
  );
}

function alternateUrls(page: PageId): { hreflang: string; href: string }[] {
  const alternates = seoConfig.locales.map((locale) => ({
    hreflang: locale,
    href: pageUrl(locale, page),
  }));
  alternates.push({
    hreflang: "x-default",
    href: page === "home" ? rootUrl() : pageUrl(seoConfig.defaultLocale, page),
  });
  return alternates;
}

function rootAlternateUrls(): { hreflang: string; href: string }[] {
  const alternates = seoConfig.locales.map((locale) => ({
    hreflang: locale,
    href: pageUrl(locale, "home"),
  }));
  alternates.push({
    hreflang: "x-default",
    href: rootUrl(),
  });
  return alternates;
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

function normalizeTemplate(html: string): string {
  return html
    .replace(
      /\n    <script type="application\/ld\+json">.*?<\/script>/gs,
      "",
    )
    .replace(
      /\n    <script src="https:\/\/cdn\.jsdelivr\.net\/npm\/eruda"><\/script>\n    <script>\n      \/\/ eruda\.init\(\);\n    <\/script>/g,
      "",
    );
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
    /    <meta property="og:locale" content="[^"]*" \/>/,
    `    <meta property="og:locale" content="${escapeHtml(locale)}" />`,
    "og:locale",
  );
  html = replaceRequired(
    html,
    /    <meta name="twitter:title" content="[^"]*" \/>/,
    `    <meta name="twitter:title" content="${escapeHtml(meta.title)}" />`,
    "twitter:title",
  );
  html = replaceRequired(
    html,
    /    <meta name="twitter:description" content="[^"]*" \/>/,
    `    <meta name="twitter:description" content="${escapeHtml(meta.description)}" />`,
    "twitter:description",
  );
  return insertJsonLd(
    html,
    softwareApplicationJsonLd(meta.title, meta.description, canonical),
  );
}

function renderRootHtml(template: string): string {
  const { root } = seoConfig;
  let html = template;
  html = replaceRequired(
    html,
    /<html lang="[^"]*">/,
    `<html lang="${escapeHtml(root.locale)}">`,
    "html lang",
  );
  html = replaceRequired(
    html,
    /    <title>.*<\/title>/,
    `    <title>${escapeHtml(root.meta.title)}</title>`,
    "title",
  );
  html = replaceRequired(
    html,
    /    <meta name="description" content="[^"]*" \/>/,
    `    <meta name="description" content="${escapeHtml(root.meta.description)}" />`,
    "description",
  );
  html = replaceRequired(
    html,
    /    <link rel="canonical" href="[^"]*" \/>/,
    `    <link rel="canonical" href="${escapeHtml(rootUrl())}" />`,
    "canonical",
  );
  html = replaceRequired(
    html,
    /(?:    <link rel="alternate" hreflang="[^"]*" href="[^"]*" \/>\n)+/,
    `${rootAlternateLinks()}\n`,
    "alternate links",
  );
  html = replaceRequired(
    html,
    /    <meta property="og:title" content="[^"]*" \/>/,
    `    <meta property="og:title" content="${escapeHtml(root.meta.title)}" />`,
    "og:title",
  );
  html = replaceRequired(
    html,
    /    <meta property="og:description" content="[^"]*" \/>/,
    `    <meta property="og:description" content="${escapeHtml(root.meta.description)}" />`,
    "og:description",
  );
  html = replaceRequired(
    html,
    /    <meta property="og:url" content="[^"]*" \/>/,
    `    <meta property="og:url" content="${escapeHtml(rootUrl())}" />`,
    "og:url",
  );
  html = replaceRequired(
    html,
    /    <meta property="og:locale" content="[^"]*" \/>/,
    `    <meta property="og:locale" content="${escapeHtml(root.locale)}" />`,
    "og:locale",
  );
  html = replaceRequired(
    html,
    /    <meta name="twitter:title" content="[^"]*" \/>/,
    `    <meta name="twitter:title" content="${escapeHtml(root.meta.title)}" />`,
    "twitter:title",
  );
  html = replaceRequired(
    html,
    /    <meta name="twitter:description" content="[^"]*" \/>/,
    `    <meta name="twitter:description" content="${escapeHtml(root.meta.description)}" />`,
    "twitter:description",
  );
  return insertJsonLd(
    html,
    softwareApplicationJsonLd(root.meta.title, root.meta.description, rootUrl()),
  );
}

function renderSitemapUrl(
  loc: string,
  alternates: { hreflang: string; href: string }[],
): string {
  const alternateLinks = alternates
    .map(
      ({ hreflang, href }) =>
        `    <xhtml:link rel="alternate" hreflang="${xmlEscape(hreflang)}" href="${xmlEscape(href)}" />`,
    )
    .join("\n");

  return `  <url>\n    <loc>${xmlEscape(loc)}</loc>\n${alternateLinks}\n  </url>`;
}

function renderSitemap(pageIds: PageId[]): string {
  const urls = [
    renderSitemapUrl(rootUrl(), rootAlternateUrls()),
    ...seoConfig.locales.flatMap((locale) =>
      pageIds.map((page) =>
        renderSitemapUrl(pageUrl(locale, page), alternateUrls(page)),
      ),
    ),
  ].join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n${urls}\n</urlset>\n`;
}

function renderRobotsTxt(): string {
  return `User-agent: *\nAllow: /\n\nSitemap: ${rootUrl()}sitemap.xml\n`;
}

async function main(): Promise<void> {
  seoConfig = JSON.parse(await readFile(seoConfigPath, "utf8")) as SeoConfig;
  const template = normalizeTemplate(await readFile(templatePath, "utf8"));
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
    renderRootHtml(template),
    "utf8",
  );

  await writeFile(
    path.join(rootDir, "public", "sitemap.xml"),
    renderSitemap(pageIds),
    "utf8",
  );
  await writeFile(
    path.join(rootDir, "public", "robots.txt"),
    renderRobotsTxt(),
    "utf8",
  );

  console.log(
    `Generated ${locales.length * pageIds.length + 1} SEO HTML files, sitemap.xml, and robots.txt.`,
  );
}

main();
