// Copy index.html to 404.html so deep links like /learn/entanglement work on GitHub Pages.
import { copyFileSync } from 'node:fs';
copyFileSync('dist/index.html', 'dist/404.html');
