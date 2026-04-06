/**
 * SEO utilities -dynamic canonical URL, Open Graph, and structured data
 * for the Canopy SPA.
 */

import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { trackPageView } from './analytics';

const BASE_URL = 'https://canopyhome.app';

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
    let ogUrl = document.querySelector<HTMLMetaElement>('meta[property="og:url"]');
    if (ogUrl) ogUrl.content = url;

    // GA4 page view
    trackPageView(pathname);
  }, [pathname]);
}

/** Page-specific meta overrides */
interface PageMeta {
  title?: string;
  description?: string;
}

const PAGE_META: Record<string, PageMeta> = {
  '/': {
    title: 'Canopy - Smart Home Maintenance',
    description: 'Track equipment, manage maintenance tasks, get weather alerts, and keep your home in peak condition with AI-powered insights.',
  },
  '/for-agents': {
    title: 'Canopy for Real Estate Agents - Gift Home Maintenance to Buyers',
    description: 'Give your buyers the gift of organized home maintenance. Create client gift codes, track engagement, and build lasting relationships after closing.',
  },
  '/for-pros': {
    title: 'Canopy for Service Providers - Grow Your Home Maintenance Business',
    description: 'Join the Canopy network as a certified pro. Get matched with homeowners, manage visits, and grow your service business.',
  },
  '/signup': {
    title: 'Sign Up - Canopy Home',
    description: 'Create your free Canopy account and start organizing your home maintenance today.',
  },
  '/login': {
    title: 'Log In - Canopy Home',
    description: 'Sign in to your Canopy account to manage your home maintenance, equipment, and tasks.',
  },
  '/support': {
    title: 'Support - Canopy Home',
    description: 'Get help with your Canopy account, report bugs, or contact our support team.',
  },
  '/apply-pro': {
    title: 'Apply as a Pro - Canopy Home',
    description: 'Apply to join the Canopy provider network. We\'re looking for skilled, reliable home maintenance professionals in Tulsa.',
  },
  '/terms': {
    title: 'Terms of Service - Canopy Home',
  },
  '/privacy': {
    title: 'Privacy Policy - Canopy Home',
  },
};

/**
 * Sets page title and meta description based on the current route.
 * Call once in App.tsx (inside BrowserRouter).
 */
export function usePageMeta() {
  const { pathname } = useLocation();

  useEffect(() => {
    const meta = PAGE_META[pathname];
    if (meta?.title) {
      document.title = meta.title;
    } else if (!pathname.startsWith('/a/')) {
      // Reset to default for pages without specific meta
      document.title = 'Canopy - Smart Home Maintenance';
    }

    if (meta?.description) {
      const descTag = document.querySelector<HTMLMetaElement>('meta[name="description"]');
      const ogDesc = document.querySelector<HTMLMetaElement>('meta[property="og:description"]');
      if (descTag) descTag.content = meta.description;
      if (ogDesc) ogDesc.content = meta.description;
    }
  }, [pathname]);
}
