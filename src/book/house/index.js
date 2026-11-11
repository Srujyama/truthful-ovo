// Truthful's cover and the pages only the cover links to.
// The shell (src/book/shell/BookApp.jsx) loads this file if it exists:
//   Home   the cover, at "#/"
//   pages  extra pages, routed and listed in Find
import Home from './Home.jsx';

export default {
  Home,
  pages: [
    { page: 'how', label: 'How it works', said: 'how the book works, what a coin means', load: () => import('./pages/How.jsx') },
  ],
};
