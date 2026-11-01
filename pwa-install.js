/**
 * pwa-install.js - Sistema Inteligente de Instalação de Atalho / App (PWA)
 * Para Clientes (Litrão & Catálogo) e Consultores (Painel Administrativo)
 */

(function () {
    // 1. Registro do Service Worker
    if ('serviceWorker' in navigator) {
        window.addEventListener('load', () => {
            navigator.serviceWorker.register('/sw.js').catch((err) => {
                console.warn('Registro do Service Worker ignorado ou com erro:', err);
            });
        });
    }

    // 2. Detecção de Ambiente
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
    let deferredPrompt = null;

    // Se já estiver rodando como App instalado, não exibe banners de instalação
    if (isStandalone) {
        console.log('[PWA] Aplicativo rodando em modo nativo standalone.');
        return;
    }

    // 3. Captura o evento nativo beforeinstallprompt (Android / Chrome / Edge)
    window.addEventListener('beforeinstallprompt', (e) => {
        e.preventDefault();
        deferredPrompt = e;
        mostrarElementosInstalacao();
    });

    // 4. Criação e Injeção do Banner Flutuante de Instalação e Modal iOS
    window.addEventListener('DOMContentLoaded', () => {
        injetarBannerEModalPWA();
        vincularBotoesInstalacaoExistentes();
    });

    function mostrarElementosInstalacao() {
        const isPainel = window.location.pathname.toLowerCase().includes('painel') || window.location.href.toLowerCase().includes('painel');
        const banner = document.getElementById('pwa-floating-banner');
        // No painel do consultor NUNCA exibe banner flutuante automático para não atrapalhar o trabalho
        if (banner && !isPainel && !localStorage.getItem('pwa_banner_dismissed')) {
            banner.classList.remove('hidden');
        }
        document.querySelectorAll('.btn-instalar-app-trigger').forEach(el => {
            el.classList.remove('hidden');
        });
    }

    function vincularBotoesInstalacaoExistentes() {
        document.querySelectorAll('.btn-instalar-app-trigger').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                iniciarInstalacaoApp();
            });
        });
    }

    function injetarBannerEModalPWA() {
        if (document.getElementById('pwa-floating-banner')) return;

        const isPainel = window.location.pathname.toLowerCase().includes('painel') || window.location.href.toLowerCase().includes('painel');
        const nomeApp = isPainel ? 'Painel do Consultor' : 'App Litrão do Reset';
        const subtituloApp = isPainel 
            ? 'Tenha o painel na tela inicial do seu celular como um app rápido!' 
            : 'Adicione nosso app na tela inicial para pedir seus Litrões com 1 toque!';

        // Banner Flutuante Inferior - Responsivo e seguro para telas de qualquer largura
        const banner = document.createElement('div');
        banner.id = 'pwa-floating-banner';
        banner.className = 'fixed bottom-4 left-3 right-3 sm:left-auto sm:right-5 sm:max-w-sm z-50 bg-gradient-to-r from-slate-900 via-emerald-950 to-slate-900 text-white p-3 sm:p-4 rounded-2xl sm:rounded-3xl shadow-2xl border-2 border-emerald-400/50 flex items-center justify-between gap-2 sm:gap-3 backdrop-blur-md hidden max-w-[calc(100vw-1.5rem)] box-border overflow-hidden transition-all duration-300';
        banner.innerHTML = `
            <div class="flex items-center space-x-2.5 sm:space-x-3 min-w-0 flex-1">
                <div class="w-10 h-10 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl bg-white p-1 shadow-md flex-shrink-0 flex items-center justify-center overflow-hidden">
                    <img src="/app-icon.png" alt="App" class="w-full h-full object-contain rounded-lg sm:rounded-xl" onerror="this.src='/reset-icon.png'">
                </div>
                <div class="min-w-0 flex-1">
                    <span class="bg-emerald-500/30 text-emerald-300 text-[9px] sm:text-[10px] font-black uppercase px-2 py-0.5 rounded-full inline-block">
                        Atalho no Celular
                    </span>
                    <h5 class="text-xs sm:text-sm font-black text-white truncate">${nomeApp}</h5>
                    <p class="text-[10px] sm:text-[11px] text-gray-300 truncate">${subtituloApp}</p>
                </div>
            </div>
            <div class="flex items-center space-x-1 sm:space-x-1.5 flex-shrink-0">
                <button type="button" id="btn-pwa-banner-install" class="bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-600 hover:to-green-700 text-white font-black px-3 py-2 sm:px-3.5 sm:py-2.5 rounded-xl text-xs shadow-md transition transform hover:scale-105 cursor-pointer whitespace-nowrap">
                    <i class="fa-solid fa-download mr-1"></i> Instalar
                </button>
                <button type="button" id="btn-pwa-banner-close" class="text-gray-400 hover:text-white p-1.5 sm:p-2 rounded-xl transition cursor-pointer text-sm" title="Fechar">
                    <i class="fa-solid fa-xmark"></i>
                </button>
            </div>
        `;

        // Modal Passo a Passo para iPhone / iPad (iOS Safari)
        const modalIOS = document.createElement('div');
        modalIOS.id = 'pwa-modal-ios';
        modalIOS.className = 'fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4 hidden';
        modalIOS.innerHTML = `
            <div class="bg-white rounded-3xl max-w-sm w-full p-6 text-center shadow-2xl border-2 border-emerald-400 relative animate-fade-in">
                <button type="button" id="btn-fechar-modal-ios" class="absolute top-4 right-4 text-gray-400 hover:text-gray-600 text-lg font-bold p-1 cursor-pointer">
                    <i class="fa-solid fa-xmark"></i>
                </button>
                
                <div class="w-16 h-16 rounded-3xl bg-emerald-100 text-emerald-800 flex items-center justify-center mx-auto mb-3 shadow-sm border border-emerald-300">
                    <i class="fa-brands fa-apple text-3xl"></i>
                </div>
                
                <span class="bg-emerald-100 text-emerald-900 text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full inline-block mb-1">
                    Instalar no iPhone / iPad
                </span>
                
                <h4 class="text-lg font-black text-gray-900 leading-tight mb-2">
                    Como instalar este App no seu iPhone:
                </h4>
                
                <p class="text-xs text-gray-600 mb-4 leading-relaxed">
                    Siga os 3 passos simples abaixo para colocar o ícone na sua tela inicial:
                </p>

                <div class="space-y-3 text-left text-xs bg-slate-50 p-4 rounded-2xl border border-gray-100 mb-5">
                    <div class="flex items-start gap-2.5">
                        <span class="w-6 h-6 rounded-full bg-blue-600 text-white font-black text-xs flex items-center justify-center flex-shrink-0 mt-0.5">1</span>
                        <div>
                            Toque no botão de <strong>Compartilhar</strong> <i class="fa-solid fa-arrow-up-from-bracket text-blue-600 mx-1"></i> na barra inferior do Safari.
                        </div>
                    </div>
                    <div class="flex items-start gap-2.5">
                        <span class="w-6 h-6 rounded-full bg-emerald-600 text-white font-black text-xs flex items-center justify-center flex-shrink-0 mt-0.5">2</span>
                        <div>
                            Role as opções e toque em <strong class="text-emerald-800">"Adicionar à Tela de Início"</strong> <i class="fa-regular fa-square-plus text-emerald-600 mx-1"></i>.
                        </div>
                    </div>
                    <div class="flex items-start gap-2.5">
                        <span class="w-6 h-6 rounded-full bg-purple-600 text-white font-black text-xs flex items-center justify-center flex-shrink-0 mt-0.5">3</span>
                        <div>
                            Toque em <strong>"Adicionar"</strong> no canto superior direito. Pronto!
                        </div>
                    </div>
                </div>

                <button type="button" id="btn-entendi-modal-ios" class="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-black py-3 rounded-xl text-xs uppercase tracking-wider shadow-md transition cursor-pointer">
                    Entendi, vou instalar agora!
                </button>
            </div>
        `;

        document.body.appendChild(banner);
        document.body.appendChild(modalIOS);

        // Ações do Banner
        document.getElementById('btn-pwa-banner-install').addEventListener('click', iniciarInstalacaoApp);
        document.getElementById('btn-pwa-banner-close').addEventListener('click', () => {
            banner.classList.add('hidden');
            localStorage.setItem('pwa_banner_dismissed', 'true');
        });

        // Some automaticamente quando o usuário rola a página para não atrapalhar
        let scrollTimer = null;
        window.addEventListener('scroll', () => {
            if (!banner || banner.classList.contains('hidden')) return;
            banner.style.opacity = '0';
            banner.style.transform = 'translateY(25px)';
            banner.style.pointerEvents = 'none';

            clearTimeout(scrollTimer);
            scrollTimer = setTimeout(() => {
                // Se o usuário estiver no topo e não fechou, restaura suavemente
                if (window.scrollY < 200 && !localStorage.getItem('pwa_banner_dismissed')) {
                    banner.style.opacity = '1';
                    banner.style.transform = 'translateY(0)';
                    banner.style.pointerEvents = 'auto';
                }
            }, 1800);
        }, { passive: true });

        // Ações do Modal iOS
        document.getElementById('btn-fechar-modal-ios').addEventListener('click', () => {
            modalIOS.classList.add('hidden');
        });
        document.getElementById('btn-entendi-modal-ios').addEventListener('click', () => {
            modalIOS.classList.add('hidden');
        });

        // Exibe o banner após 3 segundos caso não esteja em standalone, não seja no painel e não tenha sido fechado
        setTimeout(() => {
            if (!isPainel && !localStorage.getItem('pwa_banner_dismissed')) {
                banner.classList.remove('hidden');
            }
        }, 3000);
    }

    // 5. Função Principal Disparada pelo Usuário
    window.iniciarInstalacaoApp = function () {
        if (isIOS) {
            // No iOS, abre o guia ilustrado
            const modal = document.getElementById('pwa-modal-ios');
            if (modal) modal.classList.remove('hidden');
            return;
        }

        if (deferredPrompt) {
            // No Android / Chrome / Edge, abre o prompt nativo de instalação
            deferredPrompt.prompt();
            deferredPrompt.userChoice.then((choiceResult) => {
                if (choiceResult.outcome === 'accepted') {
                    console.log('[PWA] Usuário aceitou a instalação do aplicativo.');
                    localStorage.setItem('pwa_banner_dismissed', 'true');
                    const banner = document.getElementById('pwa-floating-banner');
                    if (banner) banner.classList.add('hidden');
                }
                deferredPrompt = null;
            });
        } else {
            // Caso o navegador não tenha disparado o prompt ainda ou seja Desktop
            alert("Para adicionar à tela inicial ou instalar o aplicativo:\n\n1. Toque nos 3 pontinhos (⋮) do menu do seu navegador no topo direito.\n2. Escolha 'Instalar aplicativo' ou 'Adicionar à tela inicial'.");
        }
    };

})();
