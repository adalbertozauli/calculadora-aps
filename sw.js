/* =====================================================================
   SERVICE WORKER – faz a Calculadora APS funcionar SEM INTERNET.

   Como funciona:
   - Na primeira vez que a página abre (com internet), este arquivo guarda
     no celular uma cópia dos arquivos da lista ARQUIVOS.
   - Depois, sempre que a página pede um arquivo:
       * com internet  → busca a versão mais nova no site e atualiza a cópia;
       * sem internet (ou internet muito lenta, > 4 s) → usa a cópia guardada.
   - Nenhum dado de paciente é guardado: só os arquivos do próprio site.

   Para manutenção:
   - Mudou só o calculadora-aps.html? Não precisa mexer aqui: a cópia se
     atualiza sozinha na próxima vez que abrir com internet.
   - Acrescentou ou renomeou arquivos? Atualize a lista ARQUIVOS e troque
     o número da VERSAO (ex.: v1 → v2), para o celular refazer a cópia.
   ===================================================================== */

const VERSAO = "calculadora-aps-v1";

const ARQUIVOS = [
  "./",
  "index.html",
  "calculadora-aps.html",
  "manifest.webmanifest",
  "icones/apple-touch-icon.png",
  "icones/icone-192.png",
  "icones/icone-512.png",
  "icones/icone-maskable-512.png"
];

// Tempo máximo esperando a internet antes de usar a cópia guardada
const ESPERA_MAXIMA_MS = 4000;

// 1) Instalação: guarda a cópia de todos os arquivos
self.addEventListener("install", function (evento) {
  evento.waitUntil(
    caches.open(VERSAO).then(function (cache) { return cache.addAll(ARQUIVOS); })
  );
  self.skipWaiting();   // passa a valer já, sem esperar fechar as abas
});

// 2) Ativação: apaga cópias de versões antigas
self.addEventListener("activate", function (evento) {
  evento.waitUntil(
    caches.keys().then(function (nomes) {
      return Promise.all(nomes
        .filter(function (nome) { return nome !== VERSAO; })
        .map(function (nome) { return caches.delete(nome); }));
    }).then(function () { return self.clients.claim(); })
  );
});

// 3) Cada pedido de arquivo: tenta a internet primeiro; se falhar, usa a cópia
self.addEventListener("fetch", function (evento) {
  const pedido = evento.request;
  // Só cuida de leituras (GET) do próprio site
  if (pedido.method !== "GET" || new URL(pedido.url).origin !== self.location.origin) return;

  evento.respondWith(
    buscarNaInternet(pedido)
      .then(function (resposta) {
        // Deu certo: atualiza a cópia guardada para a próxima vez
        if (resposta && resposta.ok) {
          const copia = resposta.clone();
          caches.open(VERSAO).then(function (cache) { cache.put(pedido, copia); });
        }
        return resposta;
      })
      .catch(function () {
        // Sem internet: usa a cópia (ignora "?v=..." no endereço)
        return caches.match(pedido, { ignoreSearch: true }).then(function (guardado) {
          if (guardado) return guardado;
          // Página não guardada? Abre a calculadora
          if (pedido.mode === "navigate") return caches.match("calculadora-aps.html");
          return Response.error();
        });
      })
  );
});

// Busca na internet, mas desiste depois de ESPERA_MAXIMA_MS (sinal fraco)
function buscarNaInternet(pedido) {
  return new Promise(function (resolver, rejeitar) {
    const relogio = setTimeout(function () { rejeitar(new Error("demorou")); }, ESPERA_MAXIMA_MS);
    fetch(pedido).then(
      function (r) { clearTimeout(relogio); resolver(r); },
      function (e) { clearTimeout(relogio); rejeitar(e); }
    );
  });
}
