import * as cheerio from 'cheerio';
import crypto from 'node:crypto';
import dns from 'node:dns/promises';
import { URL } from 'node:url';

export interface FetchResult {
  requestedUrl: string;
  finalUrl: string;
  httpStatus: number;
  contentHash: string;
  extractedText: string;
  rawContent: string;
  publishedDate: string | null;
  title: string;
  parserVersion: string;
}

export function isPrivateOrInternalHost(hostname: string): boolean {
  const lower = hostname.toLowerCase();
  if (
    lower === 'localhost' ||
    lower.endsWith('.localhost') ||
    lower === '127.0.0.1' ||
    lower === '0.0.0.0' ||
    lower === '::1' ||
    lower.startsWith('10.') ||
    lower.startsWith('192.168.') ||
    lower.startsWith('169.254.')
  ) {
    return true;
  }

  // Check 172.16.0.0 - 172.31.255.255
  if (lower.startsWith('172.')) {
    const parts = lower.split('.');
    if (parts.length >= 2) {
      const second = parseInt(parts[1], 10);
      if (second >= 16 && second <= 31) return true;
    }
  }

  return false;
}

export function isSyntheticDomain(hostname: string): boolean {
  const lower = hostname.toLowerCase();
  return (
    lower === 'synthetic.local' ||
    lower.endsWith('.synthetic.local') ||
    lower.endsWith('.mock.local') ||
    lower === 'mock.local'
  );
}

export async function validateSafeUrl(urlStr: string): Promise<URL> {
  const parsed = new URL(urlStr);
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error(`Forbidden protocol: ${parsed.protocol}. Only HTTP and HTTPS are permitted.`);
  }

  // Synthetic local domains used in demo datasets and testing
  if (isSyntheticDomain(parsed.hostname)) {
    return parsed;
  }

  if (isPrivateOrInternalHost(parsed.hostname)) {
    throw new Error(`Target host is an internal or private address: ${parsed.hostname}`);
  }

  // Resolve IP to check for DNS rebinding to private IPs
  try {
    const addresses = await dns.lookup(parsed.hostname, { all: true });
    for (const addr of addresses) {
      if (isPrivateOrInternalHost(addr.address)) {
        throw new Error(`Hostname resolves to private IP address: ${addr.address}`);
      }
    }
  } catch (err: any) {
    if (err.message.includes('private')) throw err;
    // Non-resolvable or synthetic mock domains in tests
  }

  return parsed;
}

export function extractCleanReadableText(html: string): { text: string; title: string; publishedDate: string | null } {
  const $ = cheerio.load(html);

  // Remove scripts, styles, forms, iframes, navigation, footer, cookie modals
  $(
    'script, style, noscript, svg, nav, footer, header, form, iframe, [role="banner"], [role="navigation"], [class*="cookie"], [id*="cookie"], [class*="modal"], [class*="banner"]'
  ).remove();

  const title =
    $('title').text().trim() ||
    $('h1').first().text().trim() ||
    $('meta[property="og:title"]').attr('content') ||
    'Extracted Document';

  const publishedDate =
    $('meta[property="article:published_time"]').attr('content') ||
    $('meta[name="date"]').attr('content') ||
    $('time').first().attr('datetime') ||
    null;

  // Extract structured text from main or body
  const mainSelector = $('main, article, #content, .content, body');
  const paragraphs: string[] = [];

  mainSelector.find('h1, h2, h3, h4, p, li, tr').each((_, el) => {
    const text = $(el).text().replace(/\s+/g, ' ').trim();
    if (text.length > 5 && !paragraphs.includes(text)) {
      paragraphs.push(text);
    }
  });

  const text = paragraphs.length > 0 ? paragraphs.join('\n\n') : $('body').text().replace(/\s+/g, ' ').trim();

  return {
    text: text.slice(0, 100000), // Bound max text
    title: title.slice(0, 200),
    publishedDate: publishedDate ? publishedDate.slice(0, 50) : null,
  };
}

export function getSyntheticContent(parsed: URL): { content: string; title: string; publishedDate: string | null } {
  const host = parsed.hostname.toLowerCase();
  const path = parsed.pathname.toLowerCase();

  // 1. NovaFlow Sources
  if (host.includes('novaflow')) {
    if (path.includes('pricing')) {
      return {
        title: 'NovaFlow Official Pricing & Tier Matrix',
        publishedDate: '2026-09-15',
        content: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>NovaFlow Official Pricing & Tier Matrix</title>
</head>
<body>
  <h1>NovaFlow Transparent Enterprise Pricing</h1>
  <p>Autonomous Enterprise Intelligence at Scale. Stop triaging incidents manually.</p>
  <div class="pricing-card">
    <h2>Enterprise Tier</h2>
    <p>Enterprise Tier: ₹35,000 / month flat subscription</p>
    <p>Enterprise Tier revised to ₹35,000 / month flat fee (reduced from ₹50,000/month). Unlocks dedicated cluster telemetry, enterprise single-sign on, and 24/7 SLA. OmniAgent AI included at zero additional cost.</p>
    <ul>
      <li>Unlimited agent nodes</li>
      <li>Full OmniAgent root-cause automation</li>
      <li>Sub-second incident remediation playbooks</li>
    </ul>
  </div>
  <div class="pricing-card">
    <h2>Pro Tier</h2>
    <p>Pro Tier: ₹15,000 / month</p>
    <p>For growing engineering teams requiring full telemetry pipelines.</p>
  </div>
  <div class="pricing-card">
    <h2>Starter Tier</h2>
    <p>Starter Tier: ₹5,000 / month</p>
    <p>Core log collection and anomaly metrics for independent projects.</p>
  </div>
</body>
</html>`,
      };
    }

    if (path.includes('changelog')) {
      return {
        title: 'NovaFlow Product Releases & Changelog',
        publishedDate: '2026-09-24',
        content: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>NovaFlow Product Releases & Changelog</title>
</head>
<body>
  <h1>NovaFlow Product Releases & Changelog</h1>
  <article>
    <h2>Release v3.6: Self-Healing Playbooks for Cloud Workloads</h2>
    <time datetime="2026-09-24">September 24, 2026</time>
    <p>Introducing Self-Healing Playbooks. OmniAgent can now trigger automated canary rollbacks and node cordon routines with 1-click approvals.</p>
  </article>
  <article>
    <h2>Release v3.5: OmniAgent Multi-Cloud Distributed Tracing</h2>
    <time datetime="2026-08-12">August 12, 2026</time>
    <p>Deep correlation between Kubernetes ingress errors and back-end database slow queries.</p>
  </article>
  <article>
    <h2>Release v3.0: Core Telemetry Engine</h2>
    <time datetime="2026-04-18">April 18, 2026</time>
    <p>Rolling out NovaFlow Engine v3.0 with real-time stream ingestion and sub-second anomaly detection.</p>
  </article>
</body>
</html>`,
      };
    }

    if (path.includes('rss') || path.includes('feed') || path.includes('news')) {
      return {
        title: 'NovaFlow Newsroom & Press Releases',
        publishedDate: '2026-07-12',
        content: `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>NovaFlow Newsroom & Press Releases</title>
    <link>https://novaflow.synthetic.local/news</link>
    <description>Official press releases and announcements from NovaFlow</description>
    <item>
      <title>NovaFlow Partners with Hyperscale AI for Enterprise Agent Infrastructure</title>
      <link>https://novaflow.synthetic.local/news/hyperscale-ai-partnership</link>
      <description>Strategic foundation model partnership with Hyperscale AI to integrate sovereign on-prem reasoning models for regulated enterprise clients.</description>
      <pubDate>Sun, 12 Jul 2026 10:00:00 GMT</pubDate>
    </item>
  </channel>
</rss>`,
      };
    }

    if (path.includes('careers') || path.includes('jobs')) {
      return {
        title: 'NovaFlow Engineering Careers',
        publishedDate: '2026-08-20',
        content: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>NovaFlow Engineering Careers</title>
</head>
<body>
  <h1>Careers at NovaFlow</h1>
  <p>Join us building the autonomous intelligence platform for modern cloud operations.</p>
  <article>
    <h2>Staff LLM Security & Agent Alignment Researcher</h2>
    <p>Location: Bangalore / San Francisco / Remote</p>
    <p>NovaFlow expands its security group with a role dedicated to adversarial prompt testing and agent safety in mission-critical infrastructure.</p>
  </article>
  <article>
    <h2>Principal Distributed AI Inference Engineer</h2>
    <p>Location: Bangalore / Remote</p>
    <p>Build low-latency inference pipelines directly inside our telemetry stream.</p>
  </article>
</body>
</html>`,
      };
    }
  }

  // 2. OrbitStack Sources
  if (host.includes('orbitstack')) {
    if (path.includes('pricing')) {
      return {
        title: 'OrbitStack Pricing Tier Page',
        publishedDate: '2026-08-15',
        content: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>OrbitStack Pricing Tier Page</title>
</head>
<body>
  <h1>OrbitStack Predictable Cloud Observability Pricing</h1>
  <div class="pricing-card">
    <h2>Pro Tier</h2>
    <p>Pro Tier: $299 / month flat rate</p>
    <p>Pro Tier: $299 / month flat rate for engineering squads. 30-day distributed trace history, high-cardinality indexing, and CLI integrations.</p>
  </div>
  <div class="pricing-card">
    <h2>Starter Tier</h2>
    <p>Starter Tier: $49 / month</p>
    <p>For independent developers and prototype services.</p>
  </div>
</body>
</html>`,
      };
    }

    if (path.includes('dev-log') || path.includes('changelog')) {
      return {
        title: 'OrbitStack Dev Log',
        publishedDate: '2026-08-04',
        content: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>OrbitStack Dev Log</title>
</head>
<body>
  <h1>OrbitStack Developer Log</h1>
  <article>
    <h2>GraphQL Distributed Query Visualizer</h2>
    <time datetime="2026-08-04">August 4, 2026</time>
    <p>Visualize distributed GraphQL federated subgraphs and resolve n+1 bottlenecks with 1-click traces.</p>
  </article>
  <article>
    <h2>OpenTelemetry Native Exporter GA</h2>
    <time datetime="2026-05-14">May 14, 2026</time>
    <p>Zero-vendor-lockin OpenTelemetry v1.2 exporter released with native gRPC streaming to any OTLP collector.</p>
  </article>
</body>
</html>`,
      };
    }
  }

  // 3. PulseWorks Sources
  if (host.includes('pulseworks')) {
    if (path.includes('pricing')) {
      return {
        title: 'PulseWorks Plans',
        publishedDate: '2026-09-01',
        content: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>PulseWorks Plans</title>
</head>
<body>
  <h1>PulseWorks Enterprise Compliance Observability</h1>
  <div class="tier">
    <h2>Enterprise Tier</h2>
    <p>Enterprise Tier: $1,200 / month flat rate</p>
    <p>Enterprise Tier: $1,200 / month flat rate. Automated HIPAA, SOC2, and ISO27001 log analytics and immutable audit trails.</p>
  </div>
  <div class="tier">
    <h2>Compliance Plus Tier</h2>
    <p>Compliance Plus Tier: $2,500 / month flat rate</p>
    <p>Continuous evidence collection and automated audit reporting for healthcare and financial institutions.</p>
  </div>
</body>
</html>`,
      };
    }

    if (path.includes('feed') || path.includes('rss') || path.includes('news')) {
      return {
        title: 'PulseWorks Enterprise Security Blog',
        publishedDate: '2026-06-08',
        content: `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>PulseWorks Enterprise Security Blog</title>
    <link>https://pulseworks.synthetic.local</link>
    <description>Enterprise compliance, telemetry and security audit log updates</description>
    <item>
      <title>PulseWorks Achieves FedRAMP Moderate In-Process Milestone</title>
      <link>https://pulseworks.synthetic.local/news/fedramp-milestone</link>
      <description>PulseWorks receives official sponsor agency sign-off and enters formal PMO review for FedRAMP Moderate authorization.</description>
      <pubDate>Mon, 08 Jun 2026 14:00:00 GMT</pubDate>
    </item>
  </channel>
</rss>`,
      };
    }
  }

  // Generic fallback for any other synthetic URL
  if (path.endsWith('.xml') || path.includes('feed') || path.includes('rss')) {
    return {
      title: `${host} RSS Feed`,
      publishedDate: '2026-09-28',
      content: `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>${host} Feed</title>
    <link>https://${host}</link>
    <description>Synthetic feed updates</description>
    <item>
      <title>Product and Platform Updates</title>
      <link>https://${host}${path}</link>
      <description>Latest system enhancements and architectural upgrades deployed.</description>
      <pubDate>Mon, 28 Sep 2026 04:00:00 GMT</pubDate>
    </item>
  </channel>
</rss>`,
    };
  }

  return {
    title: `${host} - Updates`,
    publishedDate: '2026-09-28',
    content: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>${host} Documentation & Updates</title>
</head>
<body>
  <h1>${host}</h1>
  <p>Operational updates and verified platform telemetry.</p>
</body>
</html>`,
  };
}

export function getSyntheticResponse(urlStr: string, parsed: URL): FetchResult {
  const { content, title, publishedDate } = getSyntheticContent(parsed);
  const contentHash = crypto.createHash('sha256').update(content).digest('hex');
  const { text } = extractCleanReadableText(content);

  return {
    requestedUrl: urlStr,
    finalUrl: urlStr,
    httpStatus: 200,
    contentHash,
    extractedText: text,
    rawContent: content.slice(0, 200000),
    publishedDate: publishedDate || '2026-09-28',
    title: title || `${parsed.hostname} Page`,
    parserVersion: 'v1.2-cheerio-synthetic',
  };
}

export async function fetchPublicUrl(urlStr: string): Promise<FetchResult> {
  const validated = await validateSafeUrl(urlStr);

  // Return synthetic mock response for synthetic local domains
  if (isSyntheticDomain(validated.hostname)) {
    return getSyntheticResponse(urlStr, validated);
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 9000);

  const response = await fetch(validated.toString(), {
    method: 'GET',
    headers: {
      'User-Agent': 'CompetitorLensBot/1.0 (+https://competitorlens.local/bot)',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
    signal: controller.signal,
    redirect: 'follow',
  });
  clearTimeout(timeout);

  // Verify final URL after redirect
  const finalUrl = response.url;
  await validateSafeUrl(finalUrl);

  const contentType = response.headers.get('content-type') || '';
  if (!contentType.includes('text') && !contentType.includes('xml') && !contentType.includes('json')) {
    throw new Error(`Unsupported content type: ${contentType}. Must be HTML, XML, or JSON.`);
  }

  const rawContent = await response.text();
  const contentHash = crypto.createHash('sha256').update(rawContent).digest('hex');
  const { text, title, publishedDate } = extractCleanReadableText(rawContent);

  return {
    requestedUrl: urlStr,
    finalUrl,
    httpStatus: response.status,
    contentHash,
    extractedText: text,
    rawContent: rawContent.slice(0, 200000), // bound storage
    publishedDate,
    title,
    parserVersion: 'v1.2-cheerio',
  };
}

export function parseRssFeed(feedXml: string): Array<{
  title: string;
  link: string;
  description: string;
  pubDate: string | null;
}> {
  const $ = cheerio.load(feedXml, { xmlMode: true });
  const items: Array<{ title: string; link: string; description: string; pubDate: string | null }> = [];

  $('item, entry').each((_, el) => {
    const title = $(el).find('title').text().trim();
    let link = $(el).find('link').text().trim();
    if (!link) {
      link = $(el).find('link').attr('href') || '';
    }
    const description =
      $(el).find('description').text().trim() ||
      $(el).find('content').text().trim() ||
      $(el).find('summary').text().trim();
    const pubDate =
      $(el).find('pubDate').text().trim() ||
      $(el).find('published').text().trim() ||
      $(el).find('updated').text().trim() ||
      null;

    if (title && (link || description)) {
      items.push({
        title,
        link,
        description: description.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim(),
        pubDate,
      });
    }
  });

  return items;
}
