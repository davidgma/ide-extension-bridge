/**
 * Dynamic Favicon Hook.
 * Switches the browser tab favicon between black (no active bridge) and deep red (#dc2626,
 * bridge connected) while preserving the SVG favicon for modern browsers and a 32x32 PNG
 * alternate icon as a legacy fallback. Does not depend on file saved/dirty state.
 *
 * Official Documentation:
 * - React useEffect: https://react.dev/reference/react/useEffect
 * - HTML <link rel="icon"> on MDN: https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Attributes/rel#icon
 * - SVG Favicons on MDN: https://developer.mozilla.org/en-US/docs/Web/SVG
 */

import { useEffect } from 'react';

const INACTIVE_SVG_HREF = '/favicon.svg';
const ACTIVE_SVG_HREF = '/favicon-active.svg';
const INACTIVE_PNG_HREF = '/favicon.png';
const ACTIVE_PNG_HREF = '/favicon-active.png';

/**
 * Finds an existing <link> element in document.head by id, or creates and appends one
 * if it is not yet present. Keeping the PNG <link> before the SVG <link> ensures modern
 * browsers choose the crisp SVG while older browsers fall back to the PNG.
 */
function ensureFaviconLink(
  id: string,
  rel: string,
  type: string,
  href: string,
  sizes?: string
): HTMLLinkElement {
  let link = document.getElementById(id) as HTMLLinkElement | null;
  if (!link) {
    link = document.createElement('link');
    link.id = id;
    link.rel = rel;
    link.type = type;
    if (sizes) {
      link.sizes = sizes;
    }
    document.head.appendChild(link);
  }
  if (link.getAttribute('href') !== href) {
    link.setAttribute('href', href);
  }
  return link;
}

/**
 * Synchronizes the page favicon with the active Clockie H2 extension bridge state.
 *
 * @param isBridgeActive - True when the extension bridge is connected; false otherwise.
 */
export function useDynamicFavicon(isBridgeActive: boolean): void {
  useEffect(() => {
    const targetSvgHref = isBridgeActive ? ACTIVE_SVG_HREF : INACTIVE_SVG_HREF;
    const targetPngHref = isBridgeActive ? ACTIVE_PNG_HREF : INACTIVE_PNG_HREF;

    // Update the legacy PNG fallback first, then the primary SVG icon so modern browsers
    // continue to prioritize the vector icon when refreshing the tab bar.
    ensureFaviconLink('favicon-png', 'alternate icon', 'image/png', targetPngHref, '32x32');
    ensureFaviconLink('favicon-svg', 'icon', 'image/svg+xml', targetSvgHref);
  }, [isBridgeActive]);
}
