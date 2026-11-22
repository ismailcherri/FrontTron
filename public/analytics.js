function loadAnalytics({ analytics: id }) {
  const container = /^GTM-[A-Z0-9]+$/.test(id);
  if (!container && !/^(G-|UA-)[A-Z0-9-]+$/.test(id)) return;

  const layer = (window.dataLayer ||= []);
  window.gtag = function () {
    layer.push(arguments);
  };
  // Invite URLs can contain a private room code. Use virtual screen URLs for analytics.
  window.gtag('set', { page_location: location.origin + '/', page_title: 'Lobby' });
  if (container) {
    layer.push({ 'gtm.start': Date.now(), event: 'gtm.js' });
  } else {
    window.gtag('js', new Date());
    window.gtag('config', id, { send_page_view: false });
  }
  const script = document.createElement('script');
  script.async = true;
  const path = container ? 'gtm.js' : 'gtag/js';
  script.src = 'https://www.googletagmanager.com/' + path + '?id=' + id;
  document.head.append(script);

  return (event, params) => {
    if (container) layer.push({ event, ...params });
    else window.gtag('event', event, params);
  };
}

const ready = fetch('/config.json')
  .then((response) => response.json())
  .then(loadAnalytics)
  .catch(() => {});

export function trackEvent(event, screen) {
  const paths = { Lobby: '/', Room: '/room', Match: '/match' };
  const page = {
    page_title: screen,
    page_location: location.origin + paths[screen],
  };
  ready.then((send) => send?.(event, page));
}
