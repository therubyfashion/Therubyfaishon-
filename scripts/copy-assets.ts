import fs from 'fs';
import path from 'path';

const src = 'public/logo.png';
const targets = ['assets/icon.png', 'assets/splash.png', 'assets/icon-only.png', 'assets/icon-foreground.png', 'assets/icon-background.png'];

if (!fs.existsSync('assets')) {
    fs.mkdirSync('assets');
}

targets.forEach(target => {
    try {
        fs.copyFileSync(src, target);
        console.log(`Copied ${src} to ${target}`);
    } catch (err) {
        console.error(`Error copying to ${target}:`, err);
    }
});
