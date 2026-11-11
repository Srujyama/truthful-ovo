// Two apps share this page. The book (src/book) is what opens. The old screens
// are still here, untouched, for any address that asks for them by name
// (?view=team, ?view=assurance, … or ?old), so old links keep working.
const asked = new URLSearchParams(location.search);
if (asked.has('view') || asked.has('old')) import('./legacy-main.jsx');
else import('./book/main.jsx');
