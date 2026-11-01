const puppeteer = require('C:/Users/TI/.gemini/antigravity/brain/baea4923-65fd-4245-b257-e76fb8a7224c/scratch/node_modules/puppeteer-core');
const fs = require('fs');
const path = require('path');

const EDGE_PATH = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const ARTIFACT_DIR = 'C:\\Users\\TI\\.gemini\\antigravity\\brain\\baea4923-65fd-4245-b257-e76fb8a7224c';
const BASE_DIR = __dirname;

const ARTES_PNG = [
  {
    html: 'story_convite_grupo_vip.html',
    out: 'story_convite_grupo_vip.png',
    width: 1080,
    height: 1920,
    scale: 1.5
  },
  {
    html: 'post_x1_consultores.html',
    out: 'post_x1_consultores.png',
    width: 1080,
    height: 1080,
    scale: 2
  },
  {
    html: 'story_revelacao_quarta.html',
    out: 'story_revelacao_quarta.png',
    width: 1080,
    height: 1920,
    scale: 1.5
  }
];

async function executar() {
  console.log('>>> Iniciando Renderização de PNGs e PDF com Link Embutido...');

  const browser = await puppeteer.launch({
    executablePath: EDGE_PATH,
    headless: 'new',
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-gpu',
      '--disable-dev-shm-usage'
    ]
  });

  // 1. Renderiza os PNGs
  for (const item of ARTES_PNG) {
    const htmlPath = path.join(BASE_DIR, item.html);
    const pngPathLocal = path.join(BASE_DIR, item.out);
    const pngPathArtifact = path.join(ARTIFACT_DIR, item.out);

    console.log(`\nRenderizando PNG: ${item.html} -> ${item.out} (${item.width}x${item.height})...`);

    const page = await browser.newPage();
    await page.setViewport({
      width: item.width,
      height: item.height,
      deviceScaleFactor: item.scale
    });

    const fileUrl = 'file:///' + htmlPath.replace(/\\/g, '/');
    await page.goto(fileUrl, { waitUntil: 'networkidle0' });
    await new Promise(r => setTimeout(r, 1000));

    await page.screenshot({
      path: pngPathLocal,
      type: 'png',
      clip: { x: 0, y: 0, width: item.width, height: item.height }
    });

    await page.close();

    fs.copyFileSync(pngPathLocal, pngPathArtifact);
    const stats = fs.statSync(pngPathLocal);
    console.log(`✅ PNG Gerado: ${item.out} (${(stats.size / 1024).toFixed(1)} KB)`);
  }

  // 2. Renderiza o PDF A4 com LINK EMBUTIDO (CLICÁVEL)
  const pdfHtmlPath = path.join(BASE_DIR, 'convite_oficial_grupo_vip_a4.html');
  const pdfLocal = path.join(BASE_DIR, 'convite_oficial_grupo_vip.pdf');
  const pdfArtifact = path.join(ARTIFACT_DIR, 'convite_oficial_grupo_vip.pdf');

  console.log(`\nRenderizando PDF com Link Embutido: convite_oficial_grupo_vip.pdf...`);

  const pagePdf = await browser.newPage();
  await pagePdf.setViewport({ width: 1200, height: 1600 });
  const pdfFileUrl = 'file:///' + pdfHtmlPath.replace(/\\/g, '/');
  await pagePdf.goto(pdfFileUrl, { waitUntil: 'networkidle0' });
  await new Promise(r => setTimeout(r, 1200));

  await pagePdf.pdf({
    path: pdfLocal,
    format: 'A4',
    printBackground: true,
    margin: { top: 0, right: 0, bottom: 0, left: 0 }
  });

  await pagePdf.close();

  fs.copyFileSync(pdfLocal, pdfArtifact);
  const pdfStats = fs.statSync(pdfLocal);
  console.log(`✅ PDF com Link Embutido Gerado: convite_oficial_grupo_vip.pdf (${(pdfStats.size / 1024).toFixed(1)} KB)`);

  await browser.close();
  console.log('\n🎉 TODOS OS ARQUIVOS (PNGs + PDF COM LINK) GERADOS COM SUCESSO!');
}

executar().catch(err => {
  console.error('ERRO na geração:', err);
  process.exit(1);
});
