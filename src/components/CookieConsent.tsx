import { useState, useEffect } from 'react';
import { Colors } from '@/constants/theme';
import './CookieConsent.css';

/**
 * Cookie Consent Banner
 *
 * Shows a non-intrusive bottom banner on first visit asking user to accept/decline cookies.
 * Stores preference in localStorage under `canopy_cookie_consent` with value 'accepted' or 'declined'.
 * Preference is checked before initializing GA4.
 */
export default function CookieConsent() {
  const [isVisible, setIsVisible] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);

  useEffect(() => {
    // Check if user has already made a choice
    const consent = localStorage.getItem('canopy_cookie_consent');
    if (!consent) {
      // No preference stored — show banner with animation
      setIsVisible(true);
      setIsAnimating(true);
    }
  }, []);

  const handleAccept = () => {
    localStorage.setItem('canopy_cookie_consent', 'accepted');
    dismissBanner();
  };

  const handleDecline = () => {
    localStorage.setItem('canopy_cookie_consent', 'declined');
    dismissBanner();
  };

  const dismissBanner = () => {
    setIsAnimating(false);
    setTimeout(() => setIsVisible(false), 300); // Match CSS transition duration
  };

  if (!isVisible) return null;

  return (
    <div className={`cookie-consent-banner ${isAnimating ? 'cookie-consent-visible' : 'cookie-consent-hidden'}`}>
      <div className="cookie-consent-content">
        <div className="cookie-consent-text">
          <p>
            We use cookies and analytics to enhance your experience and understand how you interact with our site.
          </p>
        </div>
        <div className="cookie-consent-buttons">
          <button
            className="cookie-consent-btn cookie-consent-decline"
            onClick={handleDecline}
            aria-label="Decline cookies"
          >
            Decline
          </button>
          <button
            className="cookie-consent-btn cookie-consent-accept"
            onClick={handleAccept}
            aria-label="Accept cookies"
          >
            Accept
          </button>
        </div>
      </div>
    </div>
  );
}
