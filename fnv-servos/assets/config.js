/* =========================================================
   FOGO NA VILA · CONFIGURAÇÃO
   Tudo o que você pode querer mudar fica aqui.
   Depois de editar, publique e peça para recarregar a página.
   ========================================================= */
const CONFIG = {

  /* Meta total de servos (aparece no Mural dos Convocados) */
  metaMural: 101,   // 100 servos + Jesus, o 1º convocado

  /* Emoji de cada setor. O nome precisa ser igual ao cadastrado no banco. */
  setores: {
    "Pulseiras e QR Codes": "🎟️",
    "Revista": "🛡️",
    "Guarda-volumes": "🎒",
    "Alimentos": "🍞",
    "Fogo na Vila Store": "🛍️",
    "Manutenção": "🧰",
    "Recepção da porta": "🚪",
    "Lanche de Servos e Convidados": "🥪",
    "Venda dos churrasquinhos": "🍢",
    "Venda de Refrigerante e Salgado": "🥤",
    "Palco e instrumentação": "🎸",
    "Intercessão": "🙏",
    "Enfermaria": "🩺",
    "Coordenação do Pátio": "📋"
  },

  /* Perguntas do quiz: [pergunta, [[emoji, resposta], ...]] — sempre 4 respostas */
  perguntas: [
    ["Chegou no Fogo na Vila. Qual é a sua vibe?", [["🔥", "Já quero botar a mão na massa"], ["😎", "Observo e organizo tudo"], ["🙏", "Começo orando"], ["🤝", "Saio cumprimentando geral"]]],
    ["Seu superpoder escondido é...", [["⚡", "Agilidade"], ["🧠", "Organização"], ["💬", "Comunicação"], ["🛡️", "Firmeza"]]],
    ["Fila gigante na entrada. Você...", [["🏃", "Resolve rapidinho"], ["😄", "Anima a galera"], ["📋", "Organiza a fila"], ["👀", "Fica de olho em tudo"]]],
    ["Seus amigos te chamam quando precisam de alguém que...", [["🧰", "Resolve qualquer coisa"], ["🍔", "Cuida da comida"], ["🎤", "Fala bem com as pessoas"], ["🫶", "Cuida de quem precisa"]]],
    ["3 da manhã na vigília. Você está...", [["🔋", "100%, essa é minha hora"], ["☕", "No café, mas firme"], ["🙌", "No altar, adorando"], ["🧭", "Vendo se tá tudo certo"]]],
    ["Qual emoji te representa?", [["🔥", "Intenso"], ["💪", "Forte"], ["🙏", "Consagrado"], ["😂", "Alegria pura"]]],
    ["Se o evento fosse um time, você seria...", [["⚽", "Atacante: linha de frente"], ["🧤", "Goleiro: ninguém passa"], ["🎯", "Meio-campo: faz girar"], ["📣", "Torcida: anima geral"]]],
    ["Deu um imprevisto. Você...", [["🛠️", "Arregaça as mangas"], ["🧘", "Mantém a calma"], ["📞", "Chama quem resolve"], ["🙏", "Ora e age"]]],
    ["O que mais te enche de alegria num evento?", [["👥", "Ver a galera chegando"], ["✨", "Tudo funcionando"], ["🍽️", "Todo mundo bem servido"], ["🔥", "Ver Deus agindo"]]],
    ["Pronto pra ser convocado pro Fogo na Vila?", [["🔥", "Nasci pronto"], ["🙌", "Eis-me aqui, envia-me"], ["💯", "Bora fazer história"], ["🚀", "Pode mandar a missão"]]]
  ],

  /* Mensagem padrão de cobrança no painel ({nome} e {link} são trocados sozinhos) */
  mensagemCobranca: "A paz do Senhor, *{nome}*! 🔥\n\nVocê foi *convocado* para servir no *Fogo na Vila*, a maior vigília de Vila Velha.\n\nResponda as 10 perguntas rapidinho e descubra *a função que foi preparada para você*:\n\n👉 {link}\n\n📲 Use o seu número de WhatsApp.\n⏰ *Só até hoje, 23h59!*"
};
