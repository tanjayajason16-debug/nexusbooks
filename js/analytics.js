/**
 * Vercel Web Analytics
 * Initializes analytics tracking for the application
 */
(function() {
  // Initialize Vercel Analytics queue
  window.va = window.va || function() {
    (window.vaq = window.vaq || []).push(arguments);
  };

  // Auto-inject analytics script when deployed on Vercel
  // The script will be automatically provided by Vercel's platform
  // For local development, this will log to console in development mode
  
  // The script tag will be injected by Vercel's build system with a unique path
  // Format: /_vercel/insights/script.js
  if (typeof window !== 'undefined' && !window.vai) {
    var script = document.createElement('script');
    script.defer = true;
    script.src = '/_vercel/insights/script.js';
    document.head.appendChild(script);
    window.vai = true;
  }
})();
