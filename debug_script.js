const { exec } = require('child_process');

// Run a quick headless node script with puppeteer to open the page and dump console logs
const code = `
const puppeteer = require('/usr/lib/node_modules/puppeteer');
(async () => {
    try {
        const browser = await puppeteer.launch({ args: ['--no-sandbox', '--disable-setuid-sandbox'] });
        const page = await browser.newPage();
        
        page.on('console', msg => console.log('PAGE LOG:', msg.text()));
        page.on('pageerror', error => console.log('PAGE ERROR:', error.message));
        
        await page.goto('http://localhost:8000/star_horde.html');
        await page.click('#start-btn');
        await new Promise(r => setTimeout(r, 6000));
        
        await browser.close();
    } catch(err) {
        console.log("PUPPETEER EXCEPTION:", err);
    }
})();
`;

require('fs').writeFileSync('/tmp/test_pup.js', code);
exec('node /tmp/test_pup.js', (err, stdout, stderr) => {
    console.log("STDOUT:", stdout);
    console.log("STDERR:", stderr);
});
