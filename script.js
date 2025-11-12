// ===================================
// CONFIGURAÇÃO SUPABASE
// ===================================

const SUPABASE_URL = 'https://xzxirbhraowknpgypnvx.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh6eGlyYmhyYW93a25wZ3lwbnZ4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjI5NzY4MTMsImV4cCI6MjA3ODU1MjgxM30.AnbjQL0ut79NMsu2OyQYV2s5jBCMojBQ_ctVBdCQNy0';

// ⚠️ IMPORTANTE: Estas credenciais SÃO SEGURAS de expor!
// - SUPABASE_KEY é a chave PÚBLICA (anon key)
// - Respostas corretas estão protegidas por RLS + PostgreSQL Functions
// - Validação acontece NO SERVIDOR, não aqui

const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// Links
const SITE_URL = 'https://feduardo.github.io/quizdesafio';
const EBOOK_LINK = 'https://www.amazon.com.br/dp/B0G1L2J49T';
const LIVRO_FISICO_LINK = 'https://www.amazon.com.br/dp/SEU_CODIGO_FISICO';

// ===================================
// VARIÁVEIS GLOBAIS
// ===================================

let perguntas = [];
let perguntaAtual = 0;
let pontuacao = 0;
let respostasUsuario = [];
let sessionId = '';
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
        // Gerar session ID único (mais robusto)
        sessionId = `quiz_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        
        console.log('🔄 Carregando perguntas do Supabase (via PostgreSQL Function)...');
        
        // Buscar perguntas usando PostgreSQL Function (SEM resposta_correta)
        const { data, error } = await supabase.rpc('buscar_perguntas');
        
        if (error) {
            throw error;
        }
        
        if (!data || data.length === 0) {
            throw new Error('Nenhuma pergunta encontrada. Verifique se você executou o SQL de configuração.');
        }
        
        // Transformar para formato usado no código
        perguntas = data.map(p => ({
            id: p.id,
            pergunta: p.pergunta,
            opcoes: [p.opcao_a, p.opcao_b, p.opcao_c, p.opcao_d]
        }));
        
        console.log(`✅ ${perguntas.length} perguntas carregadas (respostas protegidas)`);
        
        // Criar sessão no backend
        const { error: sessionError } = await supabase
            .from('sessoes_quiz')
            .insert([{ 
                session_id: sessionId,
                ip_address: await getIpAddress()
            }]);
        
        if (sessionError) {
            console.warn('⚠️ Erro ao criar sessão:', sessionError);
            // Continua mesmo sem sessão (para não bloquear usuário)
        } else {
            console.log('✅ Sessão criada:', sessionId);
        }
        
        // Iniciar quiz
        perguntaAtual = 0;
        pontuacao = 0;
        respostasUsuario = [];
        tempoTotalInicio = Date.now();
        
        mostrarSecao('quiz');
        exibirPergunta();
        
    } catch (error) {
        console.error('❌ Erro ao carregar perguntas:', error);
        
        let mensagem = 'Erro ao carregar o quiz.\n\n';
        
        if (error.message.includes('buscar_perguntas')) {
            mensagem += 'A função PostgreSQL "buscar_perguntas" não foi encontrada.\n' +
                       'Certifique-se de executar o SQL de configuração no Supabase.';
        } else {
            mensagem += error.message;
        }
        
        alert(mensagem);
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
// SELECIONAR RESPOSTA (VALIDAÇÃO SEGURA NO SERVIDOR)
// ===================================

async function selecionarResposta(indiceEscolhido) {
    pararTimer();
    
    const pergunta = perguntas[perguntaAtual];
    const opcoes = elements.optionsContainer.querySelectorAll('.option-btn');
    
    // Desabilitar todas as opções
    opcoes.forEach(btn => btn.disabled = true);
    
    try {
        console.log(`🔍 Validando resposta no servidor (PostgreSQL Function)...`);
        
        // Chamar PostgreSQL Function para validar (SERVIDOR)
        const { data, error } = await supabase.rpc('validar_resposta', {
            p_session_id: sessionId,
            p_pergunta_id: pergunta.id,
            p_resposta_index: indiceEscolhido
        });
        
        if (error) {
            throw error;
        }
        
        if (data.error) {
            throw new Error(data.error);
        }
        
        const acertou = data.correto;
        const indiceCorreto = data.resposta_correta;
        const pontuacaoAtual = data.pontuacao_atual || pontuacao;
        
        console.log(`${acertou ? '✅' : '❌'} Resposta ${acertou ? 'correta' : 'incorreta'} | Pontuação: ${pontuacaoAtual}`);
        
        // Atualizar pontuação local
        pontuacao = pontuacaoAtual;
        
        // Registrar resposta
        respostasUsuario.push({
            pergunta: pergunta.pergunta,
            escolhida: indiceEscolhido !== null ? pergunta.opcoes[indiceEscolhido] : 'Não respondeu',
            correta: pergunta.opcoes[indiceCorreto],
            acertou: acertou
        });
        
        // Mostrar feedback visual
        if (indiceEscolhido !== null) {
            opcoes[indiceEscolhido].classList.add(acertou ? 'correct' : 'incorrect');
        }
        opcoes[indiceCorreto].classList.add('correct');
        
    } catch (error) {
        console.error('❌ Erro ao validar resposta:', error);
        alert(`Erro ao validar resposta: ${error.message}\n\nVerifique sua conexão e tente novamente.`);
        
        // Em caso de erro, permitir continuar (experiência do usuário)
        if (indiceEscolhido !== null) {
            opcoes[indiceEscolhido].classList.add('incorrect');
        }
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

async function finalizarQuiz() {
    // Calcular tempo total
    const tempoTotalMs = Date.now() - tempoTotalInicio;
    tempoTotalSegundos = Math.floor(tempoTotalMs / 1000);
    
    const minutos = Math.floor(tempoTotalSegundos / 60);
    const segundos = tempoTotalSegundos % 60;
    const tempoFormatado = minutos > 0 
        ? `${minutos}min ${segundos}s` 
        : `${segundos}s`;
    
    console.log(`⏱️ Quiz finalizado em ${tempoFormatado}`);
    console.log(`🎯 Pontuação: ${pontuacao}/${perguntas.length}`);
    
    // Marcar sessão como finalizada (previne múltiplas tentativas)
    try {
        await supabase
            .from('sessoes_quiz')
            .update({ 
                finalizado: true,
                finalizado_at: new Date().toISOString()
            })
            .eq('session_id', sessionId);
        
        console.log('✅ Sessão finalizada');
    } catch (error) {
        console.warn('⚠️ Erro ao finalizar sessão:', error);
    }
    
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
        
        // Preparar dados
        const dados = {
            nome: username,
            email: email,
            pontuacao: pontuacao,
            total: perguntas.length,
            percentual: parseFloat(((pontuacao / perguntas.length) * 100).toFixed(1)),
            tempo_segundos: tempoTotalSegundos,
            tempo_formatado: tempoFormatado,
            session_id: sessionId,
            ip_address: await getIpAddress(),
            user_agent: navigator.userAgent
        };
        
        console.log('📤 Salvando resultado no Supabase:', dados);
        
        // Inserir resultado
        const { data, error } = await supabase
            .from('resultados_quiz')
            .insert([dados])
            .select();
        
        if (error) {
            throw error;
        }
        
        console.log('✅ Resultado salvo com sucesso!', data);
        
        // Backup local
        salvarResultadoLocal(dados);
        
        // Exibir resultado
        exibirResultado(username);
        
    } catch (error) {
        console.error('❌ Erro ao salvar resultado:', error);
        
        // Salvar localmente mesmo com erro
        salvarResultadoLocal({
            nome: username,
            email: email,
            pontuacao: pontuacao,
            total: perguntas.length
        });
        
        alert('⚠️ Não foi possível salvar no servidor.\nSeu resultado foi registrado localmente.');
        exibirResultado(username);
        
    } finally {
        elements.loadingOverlay.classList.remove('active');
    }
});

// ===================================
// FUNÇÕES AUXILIARES
// ===================================

async function getIpAddress() {
    try {
        const response = await fetch('https://api.ipify.org?format=json');
        const data = await response.json();
        return data.ip;
    } catch (error) {
        console.warn('⚠️ Não foi possível obter IP:', error);
        return null;
    }
}

function salvarResultadoLocal(dados) {
    try {
        const resultadosAnteriores = JSON.parse(localStorage.getItem('quizResultados')) || [];
        resultadosAnteriores.push({
            ...dados,
            data: new Date().toISOString()
        });
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
    
    // Personalizar mensagem
    if (percentual === 100) {
        elements.resultEmoji.textContent = '🏆';
        elements.resultTitle.textContent = 'PERFEITO!';
        elements.resultMessage.textContent = `${username}, você arrasou! Nota máxima!`;
        elements.scoreMotivation.textContent = '🔥 Com o livro completo, você dominará totalmente o assunto!';
    } else if (percentual >= 80) {
        elements.resultEmoji.textContent = '🎉';
        elements.resultTitle.textContent = 'Excelente!';
        elements.resultMessage.textContent = `${username}, parabéns! Você está muito bem!`;
        elements.scoreMotivation.textContent = '📈 Treine mais 490 questões no livro!';
    } else if (percentual >= 60) {
        elements.resultEmoji.textContent = '👍';
        elements.resultTitle.textContent = 'Bom trabalho!';
        elements.resultMessage.textContent = `${username}, você está no caminho certo!`;
        elements.scoreMotivation.textContent = '📚 Com nosso livro, você alcançará a excelência!';
    } else if (percentual >= 40) {
        elements.resultEmoji.textContent = '💪';
        elements.resultTitle.textContent = 'Continue Praticando!';
        elements.resultMessage.textContent = `${username}, você tem potencial!`;
        elements.scoreMotivation.textContent = '🎯 Nosso livro tem 500 questões!';
    } else {
        elements.resultEmoji.textContent = '📖';
        elements.resultTitle.textContent = 'Não desista!';
        elements.resultMessage.textContent = `${username}, todos começam de algum lugar!`;
        elements.scoreMotivation.textContent = '🚀 Comece pelo básico com nosso livro!';
    }
    
    // Atualizar links
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
    perguntas = [];
    mostrarSecao('intro');
}

// ===================================
// COMPARTILHAMENTO
// ===================================

function compartilharWhatsApp() {
    const texto = `Acabei de fazer o Quiz Desafio e acertei ${pontuacao} de ${perguntas.length} perguntas! 🎯 Teste agora: ${SITE_URL}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(texto)}`, '_blank');
}

function compartilharTwitter() {
    const texto = `Acertei ${pontuacao} de ${perguntas.length} no Quiz Desafio! 🎯`;
    window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(texto)}&url=${encodeURIComponent(SITE_URL)}`, '_blank');
}

function copiarLink() {
    navigator.clipboard.writeText(SITE_URL).then(() => {
        alert('Link copiado! 📋');
    }).catch(() => {
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
// VERIFICAÇÃO INICIAL
// ===================================

if (SUPABASE_URL === 'https://SEU_PROJETO.supabase.co') {
    console.error('⚠️ CONFIGURE SUPABASE_URL e SUPABASE_KEY!');
} else {
    console.log('✅ Quiz Seguro carregado!');
    console.log('🔐 Respostas protegidas por PostgreSQL Functions');
    console.log('⚡ Validação server-side');
}

console.log(`📝 ${TEMPO_POR_PERGUNTA}s por pergunta`);