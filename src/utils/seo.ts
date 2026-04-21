/**
 * SEO utilities — dynamic canonical URL, Open Graph, Twitter Card, and
 * BreadcrumbList structured data for the Canopy SPA.
 */

import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { trackPageView } from './analytics';

const BASE_URL = 'https://canopyhome.app';
const DEFAULT_OG_IMAGE = '/og/canopy-default.png';
const LEGACY_OG_IMAGE_FALLBACK = '/canopy-watercolor-logo.png';
const BREADCRUMB_SCRIPT_ID = 'canopy-breadcrumb-jsonld';

/**
 * Updates the canonical URL and og:url meta tag on every route change.
 * Call once in App.tsx (inside BrowserRouter).
 */
export function useCanonical() {
  const { pathname } = useLocation();

  useEffect(() => {
    const url = `${BASE_URL}${pathname === '/' ? '/' : pathname.replace(/\/+$/, '')}`;

    // Canonical link
    let link = document.querySelector<HTMLLinkElement>('link[rel="canonical"]');
    if (!link) {
      link = document.createElement('link');
      link.rel = 'canonical';
      document.head.appendChild(link);
    }
    link.href = url;

    // og:url
    const ogUrl = document.querySelector<HTMLMetaElement>('meta[property="og:url"]');
    if (ogUrl) ogUrl.content = url;

    // GA4 page view
    trackPageView(pathname);
  }, [pathname]);
}

/** Crumb trail entry for BreadcrumbList JSON-LD. */
interface Crumb {
  name: string;
  path: string;
}

/** Page-specific meta overrides */
interface PageMeta {
  title?: string;
  description?: string;
  /**
   * Absolute-from-root path to a per-route OG image (1200x630 recommended).
   * Falls back to DEFAULT_OG_IMAGE, then to the watercolor logo if that
   * asset doesn't ship yet.
   */
  ogImage?: string;
  /**
   * BreadcrumbList trail rendered as schema.org JSON-LD. Omit for the
   * Landing page (no breadcrumbs at the root).
   */
  breadcrumbs?: Crumb[];
}

const PAGE_META: Record<string, PageMeta> = {
  '/': {
    title: 'Canopy — Smart Home Maintenance',
    description:
      'Track equipment, manage maintenance tasks, get weather alerts, and keep your home in peak condition with AI-powered insights.',
    ogImage: '/og/canopy-landing.png',
  },
  '/for-agents': {
    title: 'Canopy for Real Estate Agents — Gift Home Maintenance to Buyers',
    description:
      'Give your buyers the gift of organized home maintenance. Create client gift codes, track engagement, and build lasting relationships after closing.',
    ogImage: '/og/canopy-agents.png',
    breadcrumbs: [
      { name: 'Home', path: '/' },
      { name: 'For Real Estate Agents', path: '/for-agents' },
    ],
  },
  '/for-pros': {
    title: 'Canopy for Service Providers — Grow Your Home Maintenance Business',
    description:
      'Join the Canopy network as a certified pro. Get matched with homeowners, manage visits, and grow your service business.',
    ogImage: '/og/canopy-pros.png',
    breadcrumbs: [
      { name: 'Home', path: '/' },
      { name: 'For Service Providers', path: '/for-pros' },
    ],
  },
  '/apply-pro': {
    title: 'Apply as a Pro — Canopy Home',
    description:
      "Apply to join the Canopy provider network. We're looking for skilled, reliable home maintenance professionals in Tulsa.",
    ogImage: '/og/canopy-pros.png',
    breadcrumbs: [
      { name: 'Home', path: '/' },
      { name: 'For Service Providers', path: '/for-pros' },
      { name: 'Apply', path: '/apply-pro' },
    ],
  },
  '/signup': {
    title: 'Sign Up — Canopy Home',
    description: 'Create your free Canopy account and start organizing your home maintenance today.',
    breadcrumbs: [
      { name: 'Home', path: '/' },
      { name: 'Sign Up', path: '/signup' },
    ],
  },
  '/login': {
    title: 'Log In — Canopy Home',
    description: 'Sign in to your Canopy account to manage your home maintenance, equipment, and tasks.',
    breadcrumbs: [
      { name: 'Home', path: '/' },
      { name: 'Log In', path: '/login' },
    ],
  },
  '/support': {
    title: 'Support — Canopy Home',
    description: 'Get help with your Canopy account, report bugs, or contact our support team.',
    breadcrumbs: [
      { name: 'Home', path: '/' },
      { name: 'Support', path: '/support' },
    ],
  },
  '/sale-prep-preview': {
    title: 'Selling Soon? The Canopy Sale Prep Playbook — Canopy Home',
    description:
      '5 categories of pre-listing prep tasks for Tulsa home sellers: curb appeal, systems check, documents, deep clean, and marketing-ready photos.',
    ogImage: '/og/canopy-sale-prep.png',
    breadcrumbs: [
      { name: 'Home', path: '/' },
      { name: 'Sale Prep Preview', path: '/sale-prep-preview' },
    ],
  },
  '/security': {
    title: 'Security & Privacy — Canopy Home',
    description:
      'How Canopy protects your home data: bank-level encryption, PIN-protected notes, row-level isolation, export/delete on demand, no data sale, full audit trail.',
    ogImage: '/og/canopy-security.png',
    breadcrumbs: [
      { name: 'Home', path: '/' },
      { name: 'Security & Privacy', path: '/security' },
    ],
  },
  '/testimonial/submit': {
    title: 'Share Your Canopy Story — Canopy Home',
    description:
      'Share a sentence or two about your experience with Canopy. Helps other Tulsa homeowners figure out whether Canopy is right for them.',
    breadcrumbs: [
      { name: 'Home', path: '/' },
      { name: 'Share a Testimonial', path: '/testimonial/submit' },
    ],
  },
  '/terms': {
    title: 'Terms of Service — Canopy Home',
    breadcrumbs: [
      { name: 'Home', path: '/' },
      { name: 'Terms of Service', path: '/terms' },
    ],
  },
  '/privacy': {
    title: 'Privacy Policy — Canopy Home',
    breadcrumbs: [
      { name: 'Home', path: '/' },
      { name: 'Privacy Policy', path: '/privacy' },
    ],
  },
  '/cancellation-policy': {
    title: 'Cancellation Policy — Canopy Home',
    breadcrumbs: [
      { name: 'Home', path: '/' },
      { name: 'Cancellation Policy', path: '/cancellation-policy' },
    ],
  },
};

/** Resolve which image URL to surface for the current route, with fallbacks. */
function resolveOgImage(meta: PageMeta | undefined): string {
  if (meta?.ogImage) return `${BASE_URL}${meta.ogImage}`;
  // Production will serve DEFAULT_OG_IMAGE once the per-route PNGs ship;
  // until then we keep the watercolor logo so social unfurls never break.
  return `${BASE_URL}${LEGACY_OG_IMAGE_FALLBACK}`;
}

/**
 * Upsert a <meta> tag in <head>, creating it if missing. Returns the node.
 */
function upsertMeta(attr: 'name' | 'property', key: string): HTMLMetaElement {
  let tag = document.querySelector<HTMLMetaElement>(`meta[${attr}="${key}"]`);
  if (!tag) {
    tag = document.createElement('meta');
    tag.setAttribute(attr, key);
    document.head.appendChild(tag);
  }
  return tag;
}

/**
 * Inject or replace the per-route BreadcrumbList JSON-LD script. If no
 * crumbs, removes any prior breadcrumb script (so the Landing root stays clean).
 */
function syncBreadcrumbJsonLd(crumbs?: Crumb[]): void {
  const existing = document.getElementById(BREADCRUMB_SCRIPT_ID);
  if (!crumbs || crumbs.length === 0) {
    if (existing) existing.remove();
    return;
  }
  const payload = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: crumbs.map((c, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: c.name,
      item: `${BASE_URL}${c.path === '/' ? '/' : c.path.replace(/\/+$/, '')}`,
    })),
  };
  const json = JSON.stringify(payload);
  if (existing) {
    if (existing.textContent !== json) existing.textContent = json;
    return;
  }
  const script = document.createElement('script');
  script.id = BREADCRUMB_SCRIPT_ID;
  script.type = 'application/ld+json';
  script.textContent = json;
  document.head.appendChild(script);
}

/**
 * Sets page title, description, OG/Twitter image, and BreadcrumbList based
 * on the current route. Call once in App.tsx (inside BrowserRouter).
 */
export function usePageMeta() {
  const { pathname } = useLocation();

  useEffect(() => {
    // Normalize trailing slashes for lookup (except root).
    const lookupPath = pathname === '/' ? '/' : pathname.replace(/\/+$/, '');
    const meta = PAGE_META[lookupPath];

    // --- Title ---
    if (meta?.title) {
      document.title = meta.title;
    } else if (!lookupPath.startsWith('/a/')) {
      // Reset to default for pages without specific meta; preserve the
      // dynamic agent-microsite titles which set their own doc.title.
      document.title = 'Canopy — Smart Home Maintenance';
    }

    // --- Description ---
    const description =
      meta?.description ??
      'Canopy Home — smart home maintenance tracking, weather alerts, equipment management, and seasonal task reminders for homeowners.';
    const descTag = upsertMeta('name', 'description');
    const ogDesc = upsertMeta('property', 'og:description');
    const twDesc = upsertMeta('name', 'twitter:description');
    descTag.content = description;
    ogDesc.content = description;
    twDesc.content = description;

    // --- OG title + Twitter title ---
    const effectiveTitle = meta?.title ?? document.title;
    const ogTitle = upsertMeta('property', 'og:title');
    const twTitle = upsertMeta('name', 'twitter:title');
    ogTitle.content = effectiveTitle;
    twTitle.content = effectiveTitle;

    // --- OG image + Twitter image (per-route, with fallback) ---
    const imageUrl = resolveOgImage(meta);
    const ogImg = upsertMeta('property', 'og:image');
    const twImg = upsertMeta('name', 'twitter:image');
    ogImg.content = imageUrl;
    twImg.content = imageUrl;
    // Ensure Twitter card type is summary_large_image (already set in
    // index.html, but upsert defensively for robustness).
    const twCard = upsertMeta('name', 'twitter:card');
    if (!twCard.content) twCard.content = 'summary_large_image';

    // --- BreadcrumbList JSON-LD ---
    syncBreadcrumbJsonLd(meta?.breadcrumbs);
  }, [pathname]);
}
