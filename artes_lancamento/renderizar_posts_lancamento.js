const puppeteer = require('C:/Users/TI/.gemini/antigravity/brain/baea4923-65fd-4245-b257-e76fb8a7224c/scratch/node_modules/puppeteer-core');
const fs = require('fs');
const path = require('path');

const EDGE_PATH = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const ARTIFACT_DIR = 'C:\\Users\\TI\\.gemini\\antigravity\\brain\\baea4923-65fd-4245-b257-e76fb8a7224c';
const BASE_DIR = __dirname;

const ARTES = [
  {
    html: 'story_convite_grupo_vip.html',
    png: 'story_convite_grupo_vip.png',
    width: 1080,
    height: 1920,
    scale: 1.5
  },
  {
    html: 'post_x1_consultores.html',
    png: 'post_x1_consultores.png',
    width: 1080,
    height: 1080,
    scale: 2
  },
  {
    html: 'story_revelacao_quarta.html',
    png: 'story_revelacao_quarta.png',
    width: 1080,
    height: 1920,
    scale: 1.5
  }
];

async function renderizarTodas() {
  console.log('>>> Iniciando renderização das Artes de Lançamento...');

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

  for (const item of ARTES) {
    const htmlPath = path.join(BASE_DIR, item.html);
    const pngPathLocal = path.join(BASE_DIR, item.png);
    const pngPathArtifact = path.join(ARTIFACT_DIR, item.png);

    console.log(`\nRenderizando: ${item.html} -> ${item.png} (${item.width}x${item.height})...`);

    const page = await browser.newPage();
    await page.setViewport({
      width: item.width,
      height: item.height,
      deviceScaleFactor: item.scale
    });

    const fileUrl = 'file:///' + htmlPath.replace(/\\/g, '/');
    await page.goto(fileUrl, { waitUntil: 'networkidle0' });

    // Espera fontes e estilos carregarem completamente
    await new Promise(r => setTimeout(r, 1000));

    await page.screenshot({
      path: pngPathLocal,
      type: 'png',
      clip: {
        x: 0,
        y: 0,
        width: item.width,
        height: item.height
      }
    });

    await page.close();

    // Copia para o diretório de artefatos
    fs.copyFileSync(pngPathLocal, pngPathArtifact);

    const stats = fs.statSync(pngPathLocal);
    console.log(`✅ Sucesso: ${item.png} (${(stats.size / 1024).toFixed(1)} KB)`);
  }

  await browser.close();
  console.log('\n🎉 TODAS AS ARTES FORAM GERADAS COM SUCESSO!');
}

renderizarTodas().catch(err => {
  console.error('ERRO na renderização:', err);
  process.exit(1);
});
