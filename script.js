// ===================================
// CONFIGURAÇÃO
// ===================================

const GOOGLE_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbxo_47Cq6RziLR1ov2QqLEQVGCfARz_FrJ2EfNTeu_tmKfOAyuIRhrHCNcfJFula6rF/exec';
const SITE_URL = 'https://feduardo.github.io/quizdesafio';
const EBOOK_LINK = 'https://www.amazon.com.br/dp/B0G1L2J49T';
const LIVRO_FISICO_LINK = 'https://www.amazon.com.br/dp/SEU_CODIGO_FISICO';

// ===================================
// VARIÁVEIS GLOBAIS
// ===================================

let perguntas = [];
let sessionId = '';
let perguntaAtual = 0;
let pontuacao = 0;
let respostasUsuario = [];
let timer;
let tempoRestante = 30;
let tempoTotalInicio = 0;
let tempoTotalSegundos = 0;
const TEMPO_POR_PERGUNTA = 30;

// ===================================
// ELEMENTOS DO DOM
// ===================================

const sections = {
    intro: document.getElementById('intro-section'),
    quiz: document.getElementById('quiz-section'),
    form: document.getElementById('form-section'),
    result: document.getElementById('result-section')
};

const elements = {
    startBtn: document.getElementById('start-btn'),
    questionCounter: document.getElementById('question-counter'),
    progressFill: document.getElementById('progress-fill'),
    timerDisplay: document.getElementById('timer'),
    questionText: document.getElementById('question-text'),
    optionsContainer: document.getElementById('options-container'),
    userForm: document.getElementById('user-form'),
    tempScore: document.getElementById('temp-score'),
    finalScore: document.getElementById('final-score'),
    resultTitle: document.getElementById('result-title'),
    resultMessage: document.getElementById('result-message'),
    resultEmoji: document.getElementById('result-emoji'),
    scoreMotivation: document.getElementById('score-motivation'),
    loadingOverlay: document.getElementById('loading-overlay')
};

// ===================================
// FUNÇÕES DE NAVEGAÇÃO
// ===================================

function mostrarSecao(secaoNome) {
    Object.values(sections).forEach(secao => secao.classList.remove('active'));
    sections[secaoNome].classList.add('active');
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

// ===================================
// INICIAR QUIZ
// ===================================

elements.startBtn.addEventListener('click', async () => {
    elements.startBtn.disabled = true;
    elements.startBtn.textContent = 'Carregando perguntas...';
    
    try {
        // Gerar ID único para esta sessão
        sessionId = 'quiz_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
        
        console.log('🔄 Carregando perguntas... Session:', sessionId);
        
        // Carregar perguntas do backend
        const response = await fetch(GOOGLE_SCRIPT_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                action: 'getQuestions',
                session: sessionId
            })
        });
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const data = await response.json();
        console.log('✅ Resposta recebida:', data);
        
        if (data.status === 'success' && data.perguntas) {
            perguntas = data.perguntas;
            perguntaAtual = 0;
            pontuacao = 0;
            respostasUsuario = [];
            tempoTotalInicio = Date.now();
            
            console.log(`📝 ${perguntas.length} perguntas carregadas`);
            
            mostrarSecao('quiz');
            exibirPergunta();
        } else {
            throw new Error(data.message || 'Falha ao carregar perguntas');
        }
    } catch (error) {
        console.error('❌ Erro ao carregar perguntas:', error);
        
        let mensagemErro = 'Erro ao carregar o quiz.\n\n';
        
        if (error.message.includes('Failed to fetch')) {
            mensagemErro += 'Possíveis causas:\n' +
                          '1. Problema de conexão com a internet\n' +
                          '2. Google Apps Script não foi implantado corretamente\n' +
                          '3. URL do script está incorreta\n\n' +
                          'Verifique o console (F12) para mais detalhes.';
        } else {
            mensagemErro += error.message;
        }
        
        alert(mensagemErro);
        elements.startBtn.disabled = false;
        elements.startBtn.textContent = 'Começar o Desafio';
    }
});

// ===================================
// EXIBIR PERGUNTA
// ===================================

function exibirPergunta() {
    if (perguntaAtual >= perguntas.length) {
        finalizarQuiz();
        return;
    }

    const pergunta = perguntas[perguntaAtual];
    
    // Atualizar contador e progresso
    elements.questionCounter.textContent = `Pergunta ${perguntaAtual + 1} de ${perguntas.length}`;
    const progresso = ((perguntaAtual + 1) / perguntas.length) * 100;
    elements.progressFill.style.width = `${progresso}%`;
    
    // Exibir pergunta
    elements.questionText.textContent = pergunta.pergunta;
    
    // Limpar e criar opções
    elements.optionsContainer.innerHTML = '';
    pergunta.opcoes.forEach((opcao, index) => {
        const button = document.createElement('button');
        button.className = 'option-btn';
        button.textContent = opcao;
        button.addEventListener('click', () => selecionarResposta(index));
        elements.optionsContainer.appendChild(button);
    });
    
    // Iniciar timer
    iniciarTimer();
}

// ===================================
// TIMER
// ===================================

function iniciarTimer() {
    tempoRestante = TEMPO_POR_PERGUNTA;
    atualizarTimerDisplay();
    
    timer = setInterval(() => {
        tempoRestante--;
        atualizarTimerDisplay();
        
        if (tempoRestante <= 10) {
            elements.timerDisplay.classList.add('warning');
        }
        
        if (tempoRestante <= 0) {
            clearInterval(timer);
            selecionarResposta(null);
        }
    }, 1000);
}

function atualizarTimerDisplay() {
    elements.timerDisplay.textContent = `⏱️ ${tempoRestante}s`;
}

function pararTimer() {
    clearInterval(timer);
    elements.timerDisplay.classList.remove('warning');
}

// ===================================
// SELECIONAR RESPOSTA
// ===================================

async function selecionarResposta(indiceEscolhido) {
    pararTimer();
    
    const pergunta = perguntas[perguntaAtual];
    const opcoes = elements.optionsContainer.querySelectorAll('.option-btn');
    
    // Desabilitar todas as opções
    opcoes.forEach(btn => btn.disabled = true);
    
    try {
        console.log(`🔍 Validando resposta ${indiceEscolhido} para pergunta ${perguntaAtual}`);
        
        // Validar resposta no backend
        const response = await fetch(GOOGLE_SCRIPT_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                action: 'validateAnswer',
                session: sessionId,
                perguntaIndex: perguntaAtual,
                respostaIndex: indiceEscolhido
            })
        });
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }
        
        const data = await response.json();
        
        if (data.status !== 'success') {
            throw new Error(data.message || 'Erro ao validar resposta');
        }
        
        const respostaCorreta = data.correto;
        const indiceCorreto = data.respostaCorreta;
        
        console.log(`${respostaCorreta ? '✅' : '❌'} Resposta ${respostaCorreta ? 'correta' : 'incorreta'}`);
        
        // Registrar resposta
        respostasUsuario.push({
            pergunta: pergunta.pergunta,
            escolhida: indiceEscolhido !== null ? pergunta.opcoes[indiceEscolhido] : 'Não respondeu',
            correta: pergunta.opcoes[indiceCorreto],
            acertou: respostaCorreta
        });
        
        if (respostaCorreta) {
            pontuacao++;
        }
        
        // Mostrar feedback visual
        if (indiceEscolhido !== null) {
            opcoes[indiceEscolhido].classList.add(respostaCorreta ? 'correct' : 'incorrect');
        }
        opcoes[indiceCorreto].classList.add('correct');
        
    } catch (error) {
        console.error('❌ Erro ao validar resposta:', error);
        alert('Erro ao validar resposta. Continuando para próxima pergunta...');
    }
    
    // Avançar para próxima pergunta após 2 segundos
    setTimeout(() => {
        perguntaAtual++;
        exibirPergunta();
    }, 2000);
}

// ===================================
// FINALIZAR QUIZ
// ===================================

function finalizarQuiz() {
    // Calcular tempo total
    const tempoTotalMs = Date.now() - tempoTotalInicio;
    tempoTotalSegundos = Math.floor(tempoTotalMs / 1000);
    
    const minutos = Math.floor(tempoTotalSegundos / 60);
    const segundos = tempoTotalSegundos % 60;
    const tempoFormatado = minutos > 0 
        ? `${minutos}min ${segundos}s` 
        : `${segundos}s`;
    
    console.log(`⏱️ Quiz finalizado em ${tempoFormatado}`);
    
    elements.tempScore.textContent = pontuacao;
    mostrarSecao('form');
}

// ===================================
// ENVIAR FORMULÁRIO
// ===================================

elements.userForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const username = document.getElementById('username').value.trim();
    const email = document.getElementById('email').value.trim();
    
    // Validação básica
    if (!username || !email) {
        alert('Por favor, preencha todos os campos!');
        return;
    }
    
    if (username.length < 3) {
        alert('O nome deve ter pelo menos 3 caracteres!');
        return;
    }
    
    // Mostrar loading
    elements.loadingOverlay.classList.add('active');
    
    try {
        // Calcular tempo formatado
        const minutos = Math.floor(tempoTotalSegundos / 60);
        const segundos = tempoTotalSegundos % 60;
        const tempoFormatado = minutos > 0 
            ? `${minutos}min ${segundos}s` 
            : `${segundos}s`;
        
        // Preparar dados para envio
        const dados = {
            action: 'submitResults',
            nome: username,
            email: email,
            pontuacao: pontuacao,
            total: perguntas.length,
            percentual: ((pontuacao / perguntas.length) * 100).toFixed(1),
            data: new Date().toISOString(),
            tempoSegundos: tempoTotalSegundos,
            tempoFormatado: tempoFormatado,
            respostas: respostasUsuario
        };
        
        console.log('📤 Enviando resultados:', dados);
        
        // Enviar para Google Sheets
        const response = await fetch(GOOGLE_SCRIPT_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(dados)
        });
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }
        
        const result = await response.json();
        console.log('✅ Dados enviados com sucesso!', result);
        
        // Salvar no localStorage como backup
        salvarResultadoLocal(dados);
        
        // Exibir resultado
        exibirResultado(username);
        
    } catch (error) {
        console.error('❌ Erro ao enviar dados:', error);
        
        // Salvar localmente mesmo com erro
        salvarResultadoLocal({
            nome: username,
            email: email,
            pontuacao: pontuacao,
            total: perguntas.length,
            data: new Date().toISOString()
        });
        
        // Mostrar aviso mas continuar
        console.warn('⚠️ Resultado salvo localmente. Erro ao enviar para servidor.');
        
        // Continuar para resultado
        exibirResultado(username);
    } finally {
        elements.loadingOverlay.classList.remove('active');
    }
});

// ===================================
// SALVAR NO LOCALSTORAGE
// ===================================

function salvarResultadoLocal(dados) {
    try {
        const resultadosAnteriores = JSON.parse(localStorage.getItem('quizResultados')) || [];
        resultadosAnteriores.push(dados);
        localStorage.setItem('quizResultados', JSON.stringify(resultadosAnteriores));
        console.log('💾 Resultado salvo no localStorage');
    } catch (error) {
        console.error('❌ Erro ao salvar no localStorage:', error);
    }
}

// ===================================
// EXIBIR RESULTADO
// ===================================

function exibirResultado(username) {
    mostrarSecao('result');
    
    elements.finalScore.textContent = pontuacao;
    
    const percentual = (pontuacao / perguntas.length) * 100;
    
    // Personalizar mensagem baseada no desempenho
    if (percentual === 100) {
        elements.resultEmoji.textContent = '🏆';
        elements.resultTitle.textContent = 'PERFEITO!';
        elements.resultMessage.textContent = `${username}, você arrasou! Nota máxima! Você está entre os melhores!`;
        elements.scoreMotivation.textContent = '🔥 Com o livro completo, você dominará totalmente o assunto!';
    } else if (percentual >= 80) {
        elements.resultEmoji.textContent = '🎉';
        elements.resultTitle.textContent = 'Excelente!';
        elements.resultMessage.textContent = `${username}, parabéns! Você está muito bem preparado!`;
        elements.scoreMotivation.textContent = '📈 Treine mais 490 questões no livro e chegue à perfeição!';
    } else if (percentual >= 60) {
        elements.resultEmoji.textContent = '👍';
        elements.resultTitle.textContent = 'Bom trabalho!';
        elements.resultMessage.textContent = `${username}, você está no caminho certo!`;
        elements.scoreMotivation.textContent = '📚 Com nosso livro, você alcançará a excelência!';
    } else if (percentual >= 40) {
        elements.resultEmoji.textContent = '💪';
        elements.resultTitle.textContent = 'Continue Praticando!';
        elements.resultMessage.textContent = `${username}, você tem potencial! Precisa treinar mais.`;
        elements.scoreMotivation.textContent = '🎯 Nosso livro tem 500 questões para você dominar o conteúdo!';
    } else {
        elements.resultEmoji.textContent = '📖';
        elements.resultTitle.textContent = 'Não desista!';
        elements.resultMessage.textContent = `${username}, todos começam de algum lugar. Vamos estudar juntos!`;
        elements.scoreMotivation.textContent = '🚀 Comece pelo básico com nosso livro e evolua rapidamente!';
    }
    
    // Atualizar links dos livros
    const ebookBtn = document.querySelector('.btn-primary[href*="amazon"]');
    const fisicoBtn = document.querySelector('.btn-secondary[href*="amazon"]');
    
    if (ebookBtn) ebookBtn.href = EBOOK_LINK;
    if (fisicoBtn) fisicoBtn.href = LIVRO_FISICO_LINK;
}

// ===================================
// REINICIAR QUIZ
// ===================================

function reiniciarQuiz() {
    perguntaAtual = 0;
    pontuacao = 0;
    respostasUsuario = [];
    mostrarSecao('intro');
}

// ===================================
// FUNÇÕES DE COMPARTILHAMENTO
// ===================================

function compartilharWhatsApp() {
    const texto = `Acabei de fazer o Quiz Desafio e acertei ${pontuacao} de ${perguntas.length} perguntas! 🎯 Será que você consegue fazer melhor? Teste agora: ${SITE_URL}`;
    const url = `https://wa.me/?text=${encodeURIComponent(texto)}`;
    window.open(url, '_blank');
}

function compartilharTwitter() {
    const texto = `Acabei de fazer o Quiz Desafio e acertei ${pontuacao} de ${perguntas.length}! 🎯 Você consegue fazer melhor?`;
    const url = `https://twitter.com/intent/tweet?text=${encodeURIComponent(texto)}&url=${encodeURIComponent(SITE_URL)}`;
    window.open(url, '_blank');
}

function copiarLink() {
    navigator.clipboard.writeText(SITE_URL).then(() => {
        alert('Link copiado para a área de transferência! 📋');
    }).catch(err => {
        console.error('Erro ao copiar:', err);
        const textarea = document.createElement('textarea');
        textarea.value = SITE_URL;
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
        alert('Link copiado! 📋');
    });
}

// ===================================
// LOGS PARA DEBUG
// ===================================

console.log('✅ Quiz carregado com sucesso!');
console.log(`⏱️ Tempo por pergunta: ${TEMPO_POR_PERGUNTA}s`);
console.log('🔗 Google Script URL:', GOOGLE_SCRIPT_URL);
console.log('📝 Versão: 2.1 - CORS Corrigido');