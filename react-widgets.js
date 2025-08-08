(function () {
  const { createElement: h, useState, useEffect } = React;

  // 1) Tiny badge that reads current theme and toggles on click (directly toggles body class)
  function ReactBadge() {
    const [dark, setDark] = useState(document.body.classList.contains('dark-mode'));

    useEffect(() => {
      // 1) On mount, initialize from system/browser preference
      try {
        if (window.matchMedia) {
          const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
          document.body.classList.toggle('dark-mode', !!prefersDark);
          setDark(!!prefersDark);
        }
      } catch (_) {}

      // 2) Keep local state in sync with body class (when user toggles)
      const onChange = () => setDark(document.body.classList.contains('dark-mode'));
      // Observe mutations to body class to stay in sync
      const obs = new MutationObserver(() => onChange());
      obs.observe(document.body, { attributes: true, attributeFilter: ['class'] });
      return () => {
        obs.disconnect();
      };
    }, []);

    const toggle = () => {
      if (typeof window.toggleDarkMode === 'function') {
        window.toggleDarkMode();
      } else {
        document.body.classList.toggle('dark-mode');
      }
    };

    return h(
      'div',
      { className: 'react-badge', role: 'note', title: 'Defaults to browser theme' },
      h('span', null, 'Theme - '),
      h(
        'button',
        { className: 'react-badge-btn', onClick: toggle },
        dark ? 'Switch to Light' : 'Switch to Dark'
      )
    );
  }

  // 2) Footer with year and GitHub link rendered by React
  function ReactFooter() {
    const year = new Date().getFullYear();
    return h(
      'footer',
      { className: 'react-footer', role: 'contentinfo' },
      h('small', null, `\u00A9 ${year} MealApp · `),
      h(
        'a',
        { href: 'https://github.com/ibac03/MealApp', target: '_blank', rel: 'noreferrer' },
        'GitHub'
      )
    );
  }

  // Mount points are optional; only render if present
  const badgeRootEl = document.getElementById('reactBadge');
  if (badgeRootEl && window.ReactDOM?.createRoot) {
    ReactDOM.createRoot(badgeRootEl).render(h(ReactBadge));
  }

  const footerRootEl = document.getElementById('reactFooter');
  if (footerRootEl && window.ReactDOM?.createRoot) {
    ReactDOM.createRoot(footerRootEl).render(h(ReactFooter));
  }
})();
