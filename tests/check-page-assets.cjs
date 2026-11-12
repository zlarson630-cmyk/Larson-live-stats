const fs=require('node:fs');const path=require('node:path');const assert=require('node:assert/strict');
const pages=['schedule','games','view','volleyball','wrestling'];
for(const page of pages){
 const html=fs.readFileSync(page+'.html','utf8');
 const css='assets/css/'+page+'.css',js='assets/js/'+page+'.js';
 assert.ok((html.includes('href="'+css+'"')||html.includes('href="'+css+'?')),page+' stylesheet missing');
 assert.ok((html.includes('src="'+js+'"')||html.includes('src="'+js+'?')),page+' script missing');
 assert.ok(fs.existsSync(css)&&fs.existsSync(js),page+' asset not found');
 assert.ok(!/<script>([\s\S]*?)<\/script>/i.test(html),page+' contains inline script');
 assert.ok(!/<style>([\s\S]*?)<\/style>/i.test(html),page+' contains inline style');
 console.log('Validated '+page+' page assets');
}
