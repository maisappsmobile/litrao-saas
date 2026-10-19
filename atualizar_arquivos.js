const fs = require('fs');

const produtosJson = fs.readFileSync('C:/Users/TI/.gemini/antigravity/scratch/litrao-do-reset/produtos_base_completos.json', 'utf8');
const produtos = JSON.parse(produtosJson);

console.log("Produtos carregados:", produtos.length);

// 1. ATUALIZAR catalogo.html
let catalogoContent = fs.readFileSync('C:/Users/TI/.gemini/antigravity/scratch/litrao-do-reset/catalogo.html', 'utf8');

// Localiza PRODUTOS_CATALOGO = [ ... ];
const catStartMark = 'const PRODUTOS_CATALOGO = [';
const catEndMark = '];\r\n\r\n        // Páginas da Revista Flipbook';
const catEndMarkLF = '];\n\n        // Páginas da Revista Flipbook';

let catIdxStart = catalogoContent.indexOf(catStartMark);
if (catIdxStart === -1) {
    console.error("Não encontrou const PRODUTOS_CATALOGO = [ em catalogo.html");
    process.exit(1);
}

let catIdxEnd = catalogoContent.indexOf(catEndMark, catIdxStart);
let isLF = false;
if (catIdxEnd === -1) {
    catIdxEnd = catalogoContent.indexOf(catEndMarkLF, catIdxStart);
    isLF = true;
}

if (catIdxEnd === -1) {
    console.error("Não encontrou o fim de PRODUTOS_CATALOGO em catalogo.html");
    process.exit(1);
}

const produtosCatalogoJs = 'const PRODUTOS_CATALOGO = ' + JSON.stringify(produtos, null, 4) + ';';

catalogoContent = catalogoContent.slice(0, catIdxStart) + produtosCatalogoJs + catalogoContent.slice(catIdxEnd + 2); // +2 to skip '];'
fs.writeFileSync('C:/Users/TI/.gemini/antigravity/scratch/litrao-do-reset/catalogo.html', catalogoContent, 'utf8');
console.log("catalogo.html atualizado com sucesso!");

// 2. ATUALIZAR painel.html
let painelContent = fs.readFileSync('C:/Users/TI/.gemini/antigravity/scratch/litrao-do-reset/painel.html', 'utf8');

const painelStartMark = 'const CATALOGO_PRODUTOS_BASE = [';
const painelEndMark = '];\r\n\r\n        let filtroCategoriaCatalogoPainelAtiva';
const painelEndMarkLF = '];\n\n        let filtroCategoriaCatalogoPainelAtiva';

let pIdxStart = painelContent.indexOf(painelStartMark);
if (pIdxStart === -1) {
    console.error("Não encontrou const CATALOGO_PRODUTOS_BASE = [ em painel.html");
    process.exit(1);
}

let pIdxEnd = painelContent.indexOf(painelEndMark, pIdxStart);
if (pIdxEnd === -1) {
    pIdxEnd = painelContent.indexOf(painelEndMarkLF, pIdxStart);
}

if (pIdxEnd === -1) {
    console.error("Não encontrou o fim de CATALOGO_PRODUTOS_BASE em painel.html");
    process.exit(1);
}

const catalogoBaseJs = 'const CATALOGO_PRODUTOS_BASE = ' + JSON.stringify(produtos, null, 4) + ';';

painelContent = painelContent.slice(0, pIdxStart) + catalogoBaseJs + painelContent.slice(pIdxEnd + 2);
fs.writeFileSync('C:/Users/TI/.gemini/antigravity/scratch/litrao-do-reset/painel.html', painelContent, 'utf8');
console.log("painel.html atualizado com CATALOGO_PRODUTOS_BASE!");
