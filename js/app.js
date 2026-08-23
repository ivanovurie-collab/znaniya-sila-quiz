        // --- APP VERSION ---
        // Single source of truth for the version shown in the tab title and the main-menu badge —
        // bump this on every real content/feature change instead of editing those strings by hand.
        const APP_VERSION = '5.3';

        // --- GAME PERSISTENT STATE ---
        let playerData = {
            callsign: 'Курсант Иванов',
            avatar: '🪖',
            tokens: 100,
            xp: 0,
            level: 1,
            unlockedAvatars: ['🪖', '🏅'],
            inventory: { perk5050: 1, perkTime: 2, streakFreeze: 0 },
            hasUnseenQuestReward: false,
            photo: null,
            photoFreeUsed: false,
            friends: [],
            redeemedCodes: [],
            settings: {
                screenShake: true,
                haptic: true,
                timerDuration: 20,
                autoAdvance: false
            },
            stats: {
                totalGames: 0,
                totalTokensEarned: 0,
                bossesDefeated: 0,
                defusalsWon: 0
            },
            quests: [
                { id: 'q1', text: 'Завершить 2 боя', target: 2, current: 0, reward: 40, done: false, claimed: false },
                { id: 'q2', text: 'Сделать комбо x3', target: 1, current: 0, reward: 60, done: false, claimed: false },
                { id: 'q3', text: 'Победить Босса', target: 1, current: 0, reward: 100, done: false, claimed: false },
                { id: 'q4', text: 'Разминировать бомбу', target: 1, current: 0, reward: 75, done: false, claimed: false }
            ],
            // Consecutive-day play streak. lastPlayedDate is a 'YYYY-MM-DD' local-date string.
            streak: {
                current: 0,
                longest: 0,
                lastPlayedDate: null
            },
            // Rotating daily mission set. Regenerated from DAILY_QUEST_POOL whenever the local date changes.
            dailyQuests: {
                date: null,
                list: []
            },
            // One shared bonus question per calendar day (same pick for everyone, deterministic by date).
            dailyQuestion: {
                date: null,
                questionId: null,
                answered: false,
                wasCorrect: false
            },
            // IDs (ALL_QUESTIONS[].id) of questions the cadet has answered incorrectly and not yet redeemed.
            missedQuestions: [],
            // One entry per completed (non-practice) battle, oldest first — powers the weekly progress chart.
            gameHistory: [],
            // Player-authored question drafts. status: 'pending' | 'approved' | 'rejected'.
            // 'materialized' marks approved submissions already merged into ALL_QUESTIONS on this device.
            submittedQuestions: [],
            // Free daily reward chest — one open per local calendar day.
            dailyChest: { date: null, opened: false },
            // Shown once on a brand-new profile; existing saves are migrated to true (see loadPlayerData).
            onboardingSeen: false,
            // type: 'preset' (value: default/desert/night/jungle) | 'image' | 'video' (value: data URL)
            background: { type: 'preset', value: 'default' },
            // Metadata only — the actual uploaded audio file lives in IndexedDB (see saveBlob/loadBlob).
            // Every uploaded track is kept (see customMusicTracks); this just remembers which one
            // was last selected, so it's ready (not autoplaying) again after a reload.
            customMusic: { activeId: null },
            customMusicTracks: [],
            // 0-100, controls how see-through .hud-card panels are so a custom background shows through.
            uiOpacity: 100,
            // First custom background (photo or video) is free; every change after that costs tokens.
            customBgFreeUsed: false,
            // Per-discipline accuracy, e.g. { rhbz: { correct: 12, total: 15 }, ... } — every answered
            // question counts, in any mode, so it reflects genuine competency, not just battle results.
            disciplineStats: {},
            // Per-discipline, per-topic accuracy, e.g. { tactics: { 'Наступление': { correct: 4, total: 5 } } }.
            // Mirrors disciplineStats but one level deeper, for the topic breakdown in the profile.
            topicStats: {},
            // unlockedStageIndex: highest CAMPAIGN_STAGES index the player may currently play.
            // completedStages: { stageId: { bestAccuracy } } — first clear grants the stage reward once.
            campaign: { unlockedStageIndex: 0, completedStages: {}, qualificationEarned: false },
            unlockedFrames: ['none'],
            activeFrame: 'none',
            earnedMedals: [],
            maxComboEver: 0
        };

        // --- DAILY QUEST POOL ---
        // Each local day, 3 of these are picked at random for playerData.dailyQuests.list.
        // 'type' is matched against updateDailyQuestProgress() calls scattered through the game loop.
        const DAILY_QUEST_POOL = [
            { type: 'games',          text: 'Завершить 2 боя',                          target: 2,  reward: 20 },
            { type: 'games',          text: 'Завершить 3 боя',                          target: 3,  reward: 30 },
            { type: 'correct',        text: 'Ответить верно на 8 вопросов',             target: 8,  reward: 25 },
            { type: 'correct',        text: 'Ответить верно на 15 вопросов',            target: 15, reward: 40 },
            { type: 'comboX2',        text: 'Набрать серию комбо x1.5',                 target: 1,  reward: 15 },
            { type: 'comboX3',        text: 'Набрать серию комбо x2.0',                 target: 1,  reward: 25 },
            { type: 'bossWin',        text: 'Победить Босса-Экзаменатора',              target: 1,  reward: 35 },
            { type: 'defusal',        text: 'Успешно разминировать бомбу',              target: 1,  reward: 20 },
            { type: 'scoreInGame',    text: 'Набрать 80+ очков за один бой',            target: 80, reward: 30 },
            { type: 'accuracy80',     text: 'Закончить бой с точностью от 80%',         target: 1,  reward: 30 },
            { type: 'disc:rhbz',      text: 'Сыграть бой по дисциплине «РХБЗ»',         target: 1,  reward: 20 },
            { type: 'disc:tactics',   text: 'Сыграть бой по дисциплине «Тактика»',      target: 1,  reward: 20 },
            { type: 'disc:gear',      text: 'Сыграть бой по «Вооружение & Экипировка»', target: 1,  reward: 20 },
            { type: 'disc:btv',       text: 'Сыграть бой по «Бронетехнике»',            target: 1,  reward: 20 },
            { type: 'disc:fire',      text: 'Сыграть бой по «Огневой подготовке»',      target: 1,  reward: 20 },
            { type: 'disc:svyaz',     text: 'Сыграть бой по дисциплине «Связь»',        target: 1,  reward: 20 },
            { type: 'disc:ustav',     text: 'Сыграть бой по «Уставам и званиям»',       target: 1,  reward: 20 },
            { type: 'disc:engineer', text: 'Сыграть бой по «Инженерной подготовке»',    target: 1,  reward: 20 }
        ];

        const AVATAR_SHOP = [
            { id: '🪖', name: 'Пехотинец', price: 0 },
            { id: '🏅', name: 'Офицер', price: 0 },
            { id: '🥷', name: 'Спецназ', price: 80 },
            { id: '🚁', name: 'Авиатор', price: 120 },
            { id: '🪂', name: 'Десантник', price: 150 },
            { id: '⚓', name: 'Морпех', price: 180 },
            { id: '🚀', name: 'Ракетчик', price: 200 },
            { id: '🎯', name: 'Снайпер', price: 250 },
            { id: '🤖', name: 'Боевой Дрон', price: 300 },
            { id: '🦁', name: 'Лев Гвардии', price: 400 },
            { id: '🏵️', name: 'Специалист', price: 0, campaignLocked: true },
            { id: '🐺', name: 'Волк', price: 0, rankLocked: true, rankTitle: 'КАПИТАН' },
            { id: '🦅', name: 'Орёл', price: 0, rankLocked: true, rankTitle: 'ГЕНЕРАЛ-МАЙОР' },
            { id: '🐉', name: 'Дракон', price: 0, rankLocked: true, rankTitle: 'ГЕНЕРАЛ АРМИИ' }
        ];

        // Cosmetic borders around the avatar, unlocked as one-time rank rewards (see RANKS).
        const PROFILE_FRAMES = [
            { id: 'none', name: 'Без рамки', style: '' },
            { id: 'bronze', name: 'Бронзовая', style: 'border: 3px solid #cd7f32; box-shadow: 0 0 10px rgba(205,127,50,0.7);' },
            { id: 'silver', name: 'Серебряная', style: 'border: 3px solid #c0c0c0; box-shadow: 0 0 10px rgba(192,192,192,0.7);' },
            { id: 'gold', name: 'Золотая', style: 'border: 3px solid #ffd700; box-shadow: 0 0 14px rgba(255,215,0,0.8);' },
            { id: 'purple', name: 'Генеральская', style: 'border: 3px solid #a855f7; box-shadow: 0 0 16px rgba(168,85,247,0.8);' }
        ];

        // Pending Purchase Item Reference
        let pendingItemToBuy = null;

        // Audio State
        let gameMode = 'solo';
        let selectedDiscipline = 'all';
        let selectedDifficulty = 'all';
        // --- Custom training config (see customTrainingModal / startStudyQuiz) ---
        let selectedTopic = 'all';
        let selectedQuestionCount = 10;
        let studyTimerEnabled = false;
        let studyExplanationsEnabled = true;
        let currentQuestions = [];
        let currentQIndex = 0;
        // Maps displayed answer position -> original index in q.options, reshuffled per question
        // so the correct answer never sits in a predictable slot.
        let currentOptionOrder = [];
        let dailyQuestionOptionOrder = [];
        // Per-discipline correct/total for the battle currently in progress — reset at the start of
        // every quiz-start function, read by renderBattleBreakdown() when that battle ends.
        let battleDisciplineBreakdown = {};
        // Same idea, one level deeper: battleTopicBreakdown[category][topic] = { correct, total }.
        let battleTopicBreakdown = {};
        let score = 0;
        let scoreP2 = 0;
        let comboStreak = 0;
        let maxCombo = 0;
        let correctCount = 0;
        let bossHp = 100;
        let timerInterval = null;
        let timeLeft = 20;
        let autoAdvanceTimeout = null;
        let isMuted = false;
        let audioCtx = null;
        let volFx = 0.8;
        let volMusic = 0.5;

        // Fisher-Yates shuffle — returns a new array, leaves the input untouched.
        function shuffleArray(arr) {
            const a = arr.slice();
            for (let i = a.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [a[i], a[j]] = [a[j], a[i]];
            }
            return a;
        }

        // Music player HTML elements
        let customAudioElement = new Audio();
        customAudioElement.loop = true;
        let synthMusicInterval = null;

        // --- EXTENDED QUESTION BANK (WITH GEAR & WEAPONS) ---

        // Stable IDs used to track per-question mistakes and pick the daily question — based on array position,
        // so appending new questions to the end never disturbs existing IDs.
        ALL_QUESTIONS.forEach((q, i) => { q.id = i; });

        // --- PLAYER-SUBMITTED QUESTIONS ---
        // Local-device only: this app has no backend, so a submission never leaves the browser it was
        // created in. The realistic path is: cadet submits -> copies the JSON -> sends it to the
        // instructor via chat -> instructor pastes it into their own copy of the game and approves it
        // there. "Approved" only ever means "approved on this specific device".
        const DISCIPLINE_LABELS = {
            gear: 'Вооружение & Экипировка',
            rhbz: 'РХБЗ',
            tactics: 'Тактика',
            btv: 'Бронетехника',
            fire: 'Огневая подготовка',
            svyaz: 'Связь',
            ustav: 'Уставы и звания',
            engineer: 'Инженерная подготовка'
        };

        // --- CAMPAIGN "КУРСАНТ → СПЕЦИАЛИСТ" ---
        // A linear sequence of stages; each unlocks the next only once cleared at requiredAccuracy.
        // The final "exam" stage mixes every discipline at a higher bar and grants the exclusive
        // qualification avatar reward on top of the usual token/XP payout.
        const CAMPAIGN_STAGES = [
            { id: 'basic', title: 'БАЗОВАЯ ПОДГОТОВКА', icon: '🪖', discipline: 'all', difficulty: 'private', requiredAccuracy: 70, questionCount: 10, rewardTokens: 40, rewardXp: 30 },
            { id: 'gear', title: 'ВООРУЖЕНИЕ И ЭКИПИРОВКА', icon: '🔫', discipline: 'gear', difficulty: 'all', requiredAccuracy: 70, questionCount: 10, rewardTokens: 50, rewardXp: 40 },
            { id: 'rhbz', title: 'РХБЗ', icon: '🛡️', discipline: 'rhbz', difficulty: 'all', requiredAccuracy: 70, questionCount: 10, rewardTokens: 50, rewardXp: 40 },
            { id: 'tactics', title: 'ТАКТИКА', icon: '⚔️', discipline: 'tactics', difficulty: 'all', requiredAccuracy: 70, questionCount: 10, rewardTokens: 50, rewardXp: 40 },
            { id: 'btv', title: 'БРОНЕТЕХНИКА', icon: '🚜', discipline: 'btv', difficulty: 'all', requiredAccuracy: 70, questionCount: 10, rewardTokens: 50, rewardXp: 40 },
            { id: 'fire', title: 'ОГНЕВАЯ ПОДГОТОВКА', icon: '🎯', discipline: 'fire', difficulty: 'all', requiredAccuracy: 70, questionCount: 10, rewardTokens: 50, rewardXp: 40 },
            { id: 'svyaz', title: 'СВЯЗЬ', icon: '📡', discipline: 'svyaz', difficulty: 'all', requiredAccuracy: 70, questionCount: 10, rewardTokens: 50, rewardXp: 40 },
            { id: 'ustav', title: 'УСТАВЫ И ЗВАНИЯ', icon: '📘', discipline: 'ustav', difficulty: 'all', requiredAccuracy: 70, questionCount: 10, rewardTokens: 50, rewardXp: 40 },
            { id: 'engineer', title: 'ИНЖЕНЕРНАЯ ПОДГОТОВКА', icon: '🔧', discipline: 'engineer', difficulty: 'all', requiredAccuracy: 70, questionCount: 10, rewardTokens: 50, rewardXp: 40 },
            { id: 'exam', title: 'ЭКЗАМЕН НА КВАЛИФИКАЦИЮ', icon: '🎖️', discipline: 'all', difficulty: 'all', requiredAccuracy: 80, questionCount: 15, rewardTokens: 150, rewardXp: 120, isFinal: true }
        ];
        const CAMPAIGN_QUALIFICATION_AVATAR = '🏵️';

        let activeCampaignStageIndex = null;

        function openCampaignModal() {
            renderCampaignStages();
            openModal('campaignModal');
        }

        function renderCampaignStages() {
            const list = document.getElementById('campaignStagesList');
            if (!list) return;
            const campaign = playerData.campaign || { unlockedStageIndex: 0, completedStages: {} };

            list.innerHTML = '';
            CAMPAIGN_STAGES.forEach((stage, idx) => {
                const isUnlocked = idx <= campaign.unlockedStageIndex;
                const record = campaign.completedStages[stage.id];
                const isCompleted = !!(record && record.completed);

                const box = document.createElement('div');
                box.className = `p-2.5 rounded-xl border flex items-center justify-between space-x-2 ${
                    isCompleted ? 'bg-lime-950/30 border-lime-500/50' : isUnlocked ? 'bg-slate-900/80 border-purple-500/40' : 'bg-slate-950/60 border-slate-800 opacity-60'
                }`;

                const statusIcon = isCompleted ? '✅' : isUnlocked ? stage.icon : '🔒';
                const subtitle = isCompleted
                    ? `Лучший результат: ${record.bestAccuracy}%`
                    : isUnlocked
                        ? `Нужно ${stage.requiredAccuracy}% · ${stage.questionCount} вопросов`
                        : 'Пройдите предыдущий этап';

                box.innerHTML = `
                    <div class="flex items-center space-x-2 min-w-0">
                        <span class="text-lg shrink-0">${statusIcon}</span>
                        <div class="min-w-0">
                            <div class="font-military text-[11px] ${isUnlocked ? 'text-slate-200' : 'text-slate-500'} truncate">${idx + 1}. ${stage.title}${stage.isFinal ? ' 🎖️' : ''}</div>
                            <div class="text-[9px] text-slate-400">${subtitle}</div>
                        </div>
                    </div>
                    ${isUnlocked ? `
                        <div class="flex items-center space-x-1 shrink-0">
                            <button onclick="openStageStudy(${idx})" title="Изучение" class="w-7 h-7 rounded-lg bg-slate-800 border border-lime-500/40 text-lime-300 text-xs flex items-center justify-center">📖</button>
                            <button onclick="openStageTraining(${idx})" title="Тренировка" class="w-7 h-7 rounded-lg bg-slate-800 border border-indigo-500/40 text-indigo-300 text-xs flex items-center justify-center">🎯</button>
                            <button onclick="startCampaignStage(${idx})" title="Контроль" class="btn-amber-glow px-2 py-1.5 rounded-lg font-military text-[9px] uppercase">${isCompleted ? 'ПОВТОР' : 'КОНТРОЛЬ'}</button>
                        </div>
                    ` : ''}
                `;
                list.appendChild(box);
            });
        }

        // Shared by "Изучение" (full pool, ungraded), "Тренировка" (study mode) and "Контроль" (graded) —
        // the graded run additionally slices to questionCount and shuffles.
        function getCampaignStagePool(stage) {
            let pool = stage.discipline === 'all' ? [...ALL_QUESTIONS] : ALL_QUESTIONS.filter(q => q.category === stage.discipline);
            if (stage.difficulty && stage.difficulty !== 'all') {
                const byDiff = pool.filter(q => q.difficulty === stage.difficulty);
                if (byDiff.length > 0) pool = byDiff;
            }
            if (pool.length === 0) pool = [...ALL_QUESTIONS];
            return pool;
        }

        // --- Изучение: ungraded flashcard review of the stage's full question pool ---
        let stageStudyPool = [];
        let stageStudyIndex = 0;
        let stageStudyStageIndex = null;

        function openStageStudy(index) {
            const stage = CAMPAIGN_STAGES[index];
            if (!stage) return;
            playSound('click');
            closeModal('campaignModal');

            stageStudyPool = getCampaignStagePool(stage);
            stageStudyIndex = 0;
            stageStudyStageIndex = index;
            renderStageStudyCard();
            openModal('stageStudyModal');
        }

        function renderStageStudyCard() {
            const body = document.getElementById('stageStudyBody');
            if (!body || stageStudyPool.length === 0) return;
            const q = stageStudyPool[stageStudyIndex];
            const stage = CAMPAIGN_STAGES[stageStudyStageIndex];

            document.getElementById('stageStudyTitle').innerText = `ИЗУЧЕНИЕ: ${stage.title}`;
            document.getElementById('stageStudyProgress').innerText = `${stageStudyIndex + 1} / ${stageStudyPool.length}`;
            body.innerHTML = `
                <div class="text-slate-200 font-military text-xs leading-snug">${q.question}</div>
                <div class="p-2.5 rounded-lg bg-lime-950/30 border border-lime-500/40 text-lime-300 text-xs font-military">
                    ✅ ${q.options[q.correct]}
                </div>
                <p class="text-[11px] text-slate-400 leading-snug">${q.explanation}</p>
            `;
        }

        function stageStudyNav(delta) {
            if (stageStudyPool.length === 0) return;
            playSound('click');
            stageStudyIndex = Math.max(0, Math.min(stageStudyPool.length - 1, stageStudyIndex + delta));
            renderStageStudyCard();
        }

        // --- Тренировка: same untimed, no-penalty practice mode used elsewhere, just pre-filtered
        // to this stage's discipline/difficulty instead of whatever was picked on the Setup screen ---
        function openStageTraining(index) {
            const stage = CAMPAIGN_STAGES[index];
            if (!stage) return;
            closeModal('campaignModal');
            selectedDiscipline = stage.discipline;
            selectedDifficulty = stage.difficulty || 'all';
            startStudyQuiz();
        }

        function startCampaignStage(index) {
            const stage = CAMPAIGN_STAGES[index];
            const campaign = playerData.campaign || { unlockedStageIndex: 0 };
            if (!stage || index > campaign.unlockedStageIndex) {
                playSound('wrong');
                return;
            }
            playSound('click');
            closeModal('campaignModal');
            battleDisciplineBreakdown = {};
            battleTopicBreakdown = {};

            const pool = getCampaignStagePool(stage);
            pool.sort(() => Math.random() - 0.5);

            activeCampaignStageIndex = index;
            practiceMode = null;
            gameMode = 'solo';
            selectedDiscipline = stage.discipline;
            selectedDifficulty = stage.difficulty || 'all';
            currentQuestions = pool.slice(0, stage.questionCount || QUIZ_LENGTH);

            currentQIndex = 0;
            score = 0;
            scoreP2 = 0;
            comboStreak = 0;
            maxCombo = 0;
            correctCount = 0;
            bossHp = 100;

            playerData.stats.totalGames = (playerData.stats.totalGames || 0) + 1;
            savePlayerData();

            showQuestionScreen();
        }

        // Called from finishQuiz() once accuracy is known for a battle started via startCampaignStage().
        function processCampaignStageResult(accuracy) {
            const stageIndex = activeCampaignStageIndex;
            const stage = CAMPAIGN_STAGES[stageIndex];
            activeCampaignStageIndex = null;
            if (!stage) return;

            if (!playerData.campaign) playerData.campaign = { unlockedStageIndex: 0, completedStages: {}, qualificationEarned: false };
            const campaign = playerData.campaign;
            const passed = accuracy >= stage.requiredAccuracy;
            const prevRecord = campaign.completedStages[stage.id];
            const isFirstClear = passed && !prevRecord;

            const banner = document.getElementById('campaignResultBanner');

            if (passed) {
                if (!prevRecord || accuracy > prevRecord.bestAccuracy) {
                    campaign.completedStages[stage.id] = { bestAccuracy: accuracy, completed: true };
                }
                if (stageIndex === campaign.unlockedStageIndex && stageIndex < CAMPAIGN_STAGES.length - 1) {
                    campaign.unlockedStageIndex = stageIndex + 1;
                }
                if (isFirstClear) {
                    playerData.tokens += stage.rewardTokens;
                    playerData.xp += stage.rewardXp;
                    playerData.stats.totalTokensEarned = (playerData.stats.totalTokensEarned || 0) + stage.rewardTokens;
                }
                if (stage.isFinal && !campaign.qualificationEarned) {
                    campaign.qualificationEarned = true;
                    if (!playerData.unlockedAvatars.includes(CAMPAIGN_QUALIFICATION_AVATAR)) {
                        playerData.unlockedAvatars.push(CAMPAIGN_QUALIFICATION_AVATAR);
                    }
                }
                savePlayerData();

                if (banner) {
                    banner.classList.remove('hidden');
                    banner.className = 'p-2.5 rounded-xl border bg-lime-950/50 border-lime-500/50 text-center space-y-1 font-mono';
                    banner.innerHTML = `
                        <div class="font-military text-lime-400 text-sm">✅ ЭТАП ПРОЙДЕН: ${stage.title}</div>
                        ${isFirstClear ? `<div class="text-[11px] text-amber-300">+${stage.rewardTokens} 🪖 +${stage.rewardXp} XP</div>` : '<div class="text-[10px] text-slate-400">Награда уже была получена ранее.</div>'}
                        ${stage.isFinal ? '<div class="text-[11px] text-amber-300 font-military">🎖️ КВАЛИФИКАЦИЯ ПОЛУЧЕНА! Открыт эксклюзивный аватар «Специалист».</div>' : '<div class="text-[10px] text-slate-400">Открыт следующий этап кампании!</div>'}
                    `;
                }
                spawnFireworks();
                if (stage.isFinal) hapticFeedback([40, 30, 40, 30, 60]);
            } else {
                savePlayerData();
                if (banner) {
                    banner.classList.remove('hidden');
                    banner.className = 'p-2.5 rounded-xl border bg-red-950/40 border-red-500/40 text-center space-y-1 font-mono';
                    banner.innerHTML = `
                        <div class="font-military text-red-400 text-sm">❌ ЭТАП НЕ ПРОЙДЕН</div>
                        <div class="text-[11px] text-slate-300">Нужно ${stage.requiredAccuracy}%, у тебя ${accuracy}%</div>
                        <div class="text-[10px] text-slate-400">Можно попробовать снова в любое время.</div>
                    `;
                }
            }
        }

        // Not real security (it's client-side code, trivially readable) — just a light deterrent so
        // cadets don't casually self-approve their own submissions.
        const INSTRUCTOR_ACCESS_CODE = 'КОМАНДИР';

        // Merges locally-approved submissions into the live question bank. Idempotent via `materialized`
        // so a submission is appended to ALL_QUESTIONS exactly once, even across reloads.
        function applyApprovedCustomQuestions() {
            if (!Array.isArray(playerData.submittedQuestions)) return;
            let changed = false;
            playerData.submittedQuestions.forEach(sub => {
                if (sub.status === 'approved' && !sub.materialized) {
                    ALL_QUESTIONS.push({
                        id: ALL_QUESTIONS.length,
                        category: sub.category,
                        categoryName: DISCIPLINE_LABELS[sub.category] || sub.category,
                        difficulty: 'private',
                        question: sub.question,
                        options: sub.options.slice(),
                        correct: sub.correct,
                        explanation: sub.explanation,
                        custom: true,
                        authorName: sub.authorName
                    });
                    sub.materialized = true;
                    changed = true;
                }
            });
            if (changed) savePlayerData();
        }

        function openSubmitQuestionModal() {
            document.getElementById('subqMessage').innerText = '';
            renderMySubmissionsList();
            openModal('submitQuestionModal');
        }

        function renderMySubmissionsList() {
            const container = document.getElementById('mySubmissionsContainer');
            if (!container) return;
            const subs = playerData.submittedQuestions || [];

            if (subs.length === 0) {
                container.innerHTML = '<div class="text-[10px] text-slate-500 py-2">Заявок пока нет — предложите первый вопрос выше.</div>';
                return;
            }

            const statusLabel = { pending: '⏳ На проверке', approved: '✅ Принят', rejected: '❌ Отклонён' };
            const statusClass = { pending: 'text-amber-400', approved: 'text-lime-400', rejected: 'text-red-400' };

            container.innerHTML = '';
            subs.slice().reverse().forEach(sub => {
                const box = document.createElement('div');
                box.className = 'p-2 rounded-lg bg-slate-900/80 border border-slate-800 space-y-1';
                box.innerHTML = `
                    <div class="text-slate-200 text-[11px] leading-snug">${sub.question}</div>
                    <div class="flex items-center justify-between">
                        <span class="${statusClass[sub.status] || 'text-slate-400'} text-[10px] font-military">${statusLabel[sub.status] || sub.status}</span>
                        ${sub.status === 'pending' ? `<button onclick="copySubmissionJSON('${sub.id}')" class="text-[9px] bg-indigo-950 text-indigo-300 border border-indigo-500/40 px-1.5 py-0.5 rounded">📤 Для инструктора</button>` : ''}
                    </div>
                `;
                container.appendChild(box);
            });
        }

        function submitQuestion() {
            const msgEl = document.getElementById('subqMessage');
            const category = document.getElementById('subqDiscipline').value;
            const question = document.getElementById('subqQuestion').value.trim();
            const options = [0, 1, 2, 3].map(i => document.getElementById(`subqOpt${i}`).value.trim());
            const explanation = document.getElementById('subqExplanation').value.trim();
            const correctRadio = document.querySelector('input[name="subqCorrect"]:checked');
            const correct = correctRadio ? parseInt(correctRadio.value) : 0;

            if (!question || options.some(o => !o) || !explanation) {
                msgEl.className = 'text-[10px] font-mono min-h-[14px] text-red-400';
                msgEl.innerText = '⚠ Заполните вопрос, все 4 варианта и пояснение.';
                playSound('wrong');
                return;
            }

            const submission = {
                id: 'sq_' + Date.now(),
                authorName: playerData.callsign,
                category, question, options, correct, explanation,
                status: 'pending',
                materialized: false,
                createdAt: getTodayDateStr()
            };

            playerData.submittedQuestions.push(submission);
            savePlayerData();

            msgEl.className = 'text-[10px] font-mono min-h-[14px] text-lime-400';
            msgEl.innerText = '✅ Заявка сохранена! Скопируйте её ниже и отправьте инструктору.';
            playSound('correct');
            hapticFeedback([30, 30, 30]);

            document.getElementById('subqQuestion').value = '';
            [0, 1, 2, 3].forEach(i => document.getElementById(`subqOpt${i}`).value = '');
            document.getElementById('subqExplanation').value = '';

            renderMySubmissionsList();
        }

        function copySubmissionJSON(id) {
            const sub = (playerData.submittedQuestions || []).find(s => s.id === id);
            if (!sub) return;
            const payload = JSON.stringify({
                authorName: sub.authorName, category: sub.category, question: sub.question,
                options: sub.options, correct: sub.correct, explanation: sub.explanation
            });

            const done = () => {
                showFloatingText('ЗАЯВКА СКОПИРОВАНА', window.innerWidth / 2 - 100, window.innerHeight / 2, '#84cc16');
                playSound('correct');
            };

            if (navigator.clipboard && navigator.clipboard.writeText) {
                navigator.clipboard.writeText(payload).then(done).catch(() => {
                    window.prompt('Скопируйте текст заявки вручную:', payload);
                });
            } else {
                window.prompt('Скопируйте текст заявки вручную:', payload);
            }
        }

        function openInstructorPanel() {
            playSound('click');
            const code = window.prompt('Код доступа инструктора:');
            if (code === null) return;
            if (code.trim().toUpperCase() !== INSTRUCTOR_ACCESS_CODE) {
                playSound('wrong');
                showFloatingText('НЕВЕРНЫЙ КОД', window.innerWidth / 2 - 70, window.innerHeight / 2, '#ef4444');
                return;
            }
            document.getElementById('importSubqMessage').innerText = '';
            renderInstructorQueue();
            openModal('instructorModal');
        }

        function renderInstructorQueue() {
            const container = document.getElementById('instructorQueueContainer');
            if (!container) return;
            const pending = (playerData.submittedQuestions || []).filter(s => s.status === 'pending');

            if (pending.length === 0) {
                container.innerHTML = '<div class="text-[10px] text-slate-500 py-2">Нет заявок на рассмотрении.</div>';
                return;
            }

            container.innerHTML = '';
            pending.forEach(sub => {
                const box = document.createElement('div');
                box.className = 'p-2.5 rounded-lg bg-slate-950/80 border border-slate-800 space-y-1.5';
                const optionsHtml = sub.options.map((opt, idx) =>
                    `<div class="${idx === sub.correct ? 'text-lime-400 font-bold' : 'text-slate-400'}">${idx === sub.correct ? '✓ ' : '• '}${opt}</div>`
                ).join('');
                box.innerHTML = `
                    <div class="text-[9px] text-indigo-300 uppercase">${DISCIPLINE_LABELS[sub.category] || sub.category} · от ${sub.authorName}</div>
                    <div class="text-slate-200 text-[11px]">${sub.question}</div>
                    <div class="text-[10px] space-y-0.5">${optionsHtml}</div>
                    <div class="text-[10px] text-slate-500 italic">${sub.explanation}</div>
                    <div class="flex space-x-1.5 pt-1">
                        <button onclick="approveSubmission('${sub.id}')" class="btn-green-glow flex-1 py-1.5 rounded font-military text-[10px] uppercase">✓ Одобрить</button>
                        <button onclick="rejectSubmission('${sub.id}')" class="flex-1 py-1.5 rounded bg-red-950/60 border border-red-500/40 text-red-400 font-military text-[10px] uppercase">✖ Отклонить</button>
                    </div>
                `;
                container.appendChild(box);
            });
        }

        function approveSubmission(id) {
            const sub = (playerData.submittedQuestions || []).find(s => s.id === id);
            if (!sub) return;
            sub.status = 'approved';
            savePlayerData();
            applyApprovedCustomQuestions();
            playSound('correct');
            spawnFireworks();
            renderInstructorQueue();
        }

        function rejectSubmission(id) {
            const sub = (playerData.submittedQuestions || []).find(s => s.id === id);
            if (!sub) return;
            sub.status = 'rejected';
            savePlayerData();
            playSound('click');
            renderInstructorQueue();
        }

        function importSubmission() {
            const textarea = document.getElementById('importSubqText');
            const msgEl = document.getElementById('importSubqMessage');
            const raw = textarea.value.trim();
            if (!raw) return;

            let parsed;
            try {
                parsed = JSON.parse(raw);
            } catch (e) {
                msgEl.className = 'text-[10px] font-mono min-h-[14px] text-red-400';
                msgEl.innerText = '❌ Не удалось разобрать текст — проверьте, что скопирована вся заявка целиком.';
                playSound('wrong');
                return;
            }

            if (!parsed || !parsed.question || !Array.isArray(parsed.options) || parsed.options.length !== 4 || typeof parsed.correct !== 'number' || !parsed.explanation || !parsed.category) {
                msgEl.className = 'text-[10px] font-mono min-h-[14px] text-red-400';
                msgEl.innerText = '❌ В заявке не хватает данных.';
                playSound('wrong');
                return;
            }

            playerData.submittedQuestions.push({
                id: 'sq_' + Date.now(),
                authorName: parsed.authorName || 'Курсант',
                category: parsed.category,
                question: parsed.question,
                options: parsed.options,
                correct: parsed.correct,
                explanation: parsed.explanation,
                status: 'pending',
                materialized: false,
                createdAt: getTodayDateStr()
            });
            savePlayerData();

            msgEl.className = 'text-[10px] font-mono min-h-[14px] text-lime-400';
            msgEl.innerText = '✅ Заявка импортирована и добавлена в очередь ниже.';
            playSound('correct');
            textarea.value = '';
            renderInstructorQueue();
        }

        function loadPlayerData() {
            const saved = localStorage.getItem('vitu_quiz_data_v45');
            if (saved) {
                try { 
                    const parsed = JSON.parse(saved);
                    playerData = { ...playerData, ...parsed };
                    if (!playerData.stats) playerData.stats = { totalGames: 0, totalTokensEarned: 0, bossesDefeated: 0, defusalsWon: 0 };
                    playerData.settings = { screenShake: true, haptic: true, timerDuration: 20, autoAdvance: false, ...(parsed.settings || {}) };
                    if (!Array.isArray(playerData.redeemedCodes)) playerData.redeemedCodes = [];
                    if (!Array.isArray(playerData.friends)) playerData.friends = [];
                    if (typeof playerData.photoFreeUsed !== 'boolean') playerData.photoFreeUsed = !!playerData.photo;

                    // Migration: quests completed under the old auto-reward system are marked claimed
                    // so their tokens aren't granted a second time under the new manual-claim system.
                    if (Array.isArray(playerData.quests)) {
                        playerData.quests.forEach(q => {
                            if (q.done && typeof q.claimed !== 'boolean') q.claimed = true;
                            if (typeof q.claimed !== 'boolean') q.claimed = false;
                        });
                    }

                    // Migration: older saves won't have streak / dailyQuests yet — backfill safe defaults.
                    if (!playerData.streak || typeof playerData.streak !== 'object') {
                        playerData.streak = { current: 0, longest: 0, lastPlayedDate: null };
                    }
                    if (!playerData.dailyQuests || typeof playerData.dailyQuests !== 'object' || !Array.isArray(playerData.dailyQuests.list)) {
                        playerData.dailyQuests = { date: null, list: [] };
                    }
                    if (!playerData.dailyQuestion || typeof playerData.dailyQuestion !== 'object') {
                        playerData.dailyQuestion = { date: null, questionId: null, answered: false, wasCorrect: false };
                    }
                    if (!Array.isArray(playerData.missedQuestions)) playerData.missedQuestions = [];
                    // Migration: older saves stored missedQuestions as a flat array of question ids.
                    // Upgrade each into an SRS entry, due today so nothing is silently lost.
                    if (playerData.missedQuestions.length > 0 && typeof playerData.missedQuestions[0] !== 'object') {
                        const todayStr = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}-${String(new Date().getDate()).padStart(2, '0')}`;
                        playerData.missedQuestions = playerData.missedQuestions.map(id => ({ id, stage: 0, dueDate: todayStr }));
                    }
                    if (!Array.isArray(playerData.gameHistory)) playerData.gameHistory = [];
                    if (!Array.isArray(playerData.submittedQuestions)) playerData.submittedQuestions = [];
                    if (!playerData.dailyChest || typeof playerData.dailyChest !== 'object') {
                        playerData.dailyChest = { date: null, opened: false };
                    }
                    // Existing players already know the app — only brand-new profiles see onboarding.
                    if (typeof playerData.onboardingSeen !== 'boolean') playerData.onboardingSeen = true;
                    if (!playerData.background || typeof playerData.background !== 'object') {
                        playerData.background = { type: 'preset', value: 'default' };
                    }
                    // Migration: an earlier build stored one track as {name} under a fixed IndexedDB
                    // key. Flag it so prepareSavedMusic() can move it into the new track list.
                    let legacyMusicName = null;
                    if (playerData.customMusic && typeof playerData.customMusic === 'object' && playerData.customMusic.name && !playerData.customMusic.activeId) {
                        legacyMusicName = playerData.customMusic.name;
                    }
                    if (!playerData.customMusic || typeof playerData.customMusic !== 'object') {
                        playerData.customMusic = { activeId: null };
                    } else if (!('activeId' in playerData.customMusic)) {
                        playerData.customMusic = { activeId: null };
                    }
                    if (!Array.isArray(playerData.customMusicTracks)) playerData.customMusicTracks = [];
                    if (legacyMusicName) playerData._legacyMusicName = legacyMusicName;
                    if (typeof playerData.uiOpacity !== 'number') playerData.uiOpacity = 100;
                    if (typeof playerData.customBgFreeUsed !== 'boolean') {
                        // Players who already had a custom background from an older build keep it free.
                        playerData.customBgFreeUsed = playerData.background && playerData.background.type !== 'preset';
                    }
                    if (!playerData.disciplineStats || typeof playerData.disciplineStats !== 'object') {
                        playerData.disciplineStats = {};
                    }
                    if (!playerData.topicStats || typeof playerData.topicStats !== 'object') {
                        playerData.topicStats = {};
                    }
                    if (!playerData.campaign || typeof playerData.campaign !== 'object') {
                        playerData.campaign = { unlockedStageIndex: 0, completedStages: {}, qualificationEarned: false };
                    }
                    if (!Array.isArray(playerData.unlockedFrames)) playerData.unlockedFrames = ['none'];
                    if (typeof playerData.activeFrame !== 'string') playerData.activeFrame = 'none';
                    if (!Array.isArray(playerData.earnedMedals)) playerData.earnedMedals = [];
                    if (typeof playerData.maxComboEver !== 'number') playerData.maxComboEver = 0;
                } catch(e){}
            }
            applyApprovedCustomQuestions();
            checkDailyReset();
            checkDailyQuestion();
            checkDailyChest();
            applyBackground();
            applyUiOpacity();
            prepareSavedMusic();
            updateProfileUI();
            updateQuestPingIndicator();
            if (!playerData.onboardingSeen) showOnboarding();
        }

        function savePlayerData() {
            localStorage.setItem('vitu_quiz_data_v45', JSON.stringify(playerData));
            updateProfileUI();
        }

        function resetPlayerData() {
            localStorage.removeItem('vitu_quiz_data_v45');
            location.reload();
        }

        // Progress lives only in this browser's localStorage — export/import lets a cadet
        // carry rank, medals and stats across devices or survive a cache clear.
        function exportPlayerData() {
            savePlayerData();
            const payload = {
                app: 'znaniya-sila-quiz',
                exportedAt: new Date().toISOString(),
                data: playerData
            };
            const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const dateStr = getTodayDateStr();
            const a = document.createElement('a');
            a.href = url;
            a.download = `znaniya-sila-progress-${dateStr}.json`;
            document.body.appendChild(a);
            a.click();
            a.remove();
            URL.revokeObjectURL(url);
        }

        function importPlayerData(event) {
            const file = event.target.files && event.target.files[0];
            event.target.value = '';
            if (!file) return;
            const reader = new FileReader();
            reader.onload = () => {
                let importedData;
                try {
                    const parsed = JSON.parse(reader.result);
                    importedData = parsed && parsed.data && typeof parsed.data === 'object' ? parsed.data : parsed;
                    if (!importedData || typeof importedData !== 'object' || !('callsign' in importedData)) {
                        throw new Error('unrecognized format');
                    }
                } catch (e) {
                    alert('Не удалось прочитать файл резервной копии. Убедитесь, что выбран правильный файл.');
                    return;
                }
                if (!confirm('Загрузить сохранённый прогресс? Текущий прогресс в этом браузере будет заменён.')) return;
                localStorage.setItem('vitu_quiz_data_v45', JSON.stringify(importedData));
                location.reload();
            };
            reader.readAsText(file);
        }

        function updateProfileUI() {
            document.getElementById('headerTokensDisplay').innerText = playerData.tokens;
            renderAvatarInto('mainAvatarDisplay', true);
            document.getElementById('mainCallsignDisplay').innerText = playerData.callsign;
            updateDailyQuestionButtonUI();
            updateDailyChestButtonUI();
            updateReviewButtonUI();
            renderWeakSpotCallout();

            const rankInfo = getPlayerRankInfo();
            document.getElementById('mainRankDisplay').innerText = `РАНГ: ${rankInfo.icon} ${rankInfo.title}`;

            const xpLabel = rankInfo.isMaxRank
                ? `${playerData.xp} XP (МАКС. ЗВАНИЕ)`
                : rankInfo.blockedByRequirement
                    ? `XP есть — не хватает: ${rankInfo.nextReqText}`
                    : `${rankInfo.xpIntoRank} / ${rankInfo.xpIntoRank + rankInfo.xpToNext} XP до ${rankInfo.next.icon} ${rankInfo.next.title}`;
            document.getElementById('mainXpVal').innerText = xpLabel;
            document.getElementById('mainXpBar').style.width = `${rankInfo.progressPct}%`;

            // Daily Streak Row
            const streakRow = document.getElementById('menuStreakRow');
            if (streakRow) {
                const st = playerData.streak || { current: 0, longest: 0, lastPlayedDate: null };
                if (st.current > 0) {
                    streakRow.classList.remove('hidden');
                    const streakTextEl = document.getElementById('menuStreakText');
                    const streakHintEl = document.getElementById('menuStreakHint');
                    if (streakTextEl) streakTextEl.innerText = `Серия: ${st.current} ${pluralDays(st.current)} подряд`;
                    if (streakHintEl) {
                        const playedToday = st.lastPlayedDate === getTodayDateStr();
                        streakHintEl.innerText = playedToday ? '✓ сегодня выполнено' : 'сыграй сегодня!';
                        streakHintEl.className = playedToday ? 'text-lime-400 font-semibold' : 'text-amber-400 font-semibold';
                    }
                } else {
                    streakRow.classList.add('hidden');
                }
            }

            // Modal Profile Updates
            renderAvatarInto('profileAvatarBig', true);
            document.getElementById('inputCallsign').value = playerData.callsign;
            document.getElementById('profileRankText').innerText = `РАНГ: ${rankInfo.icon} ${rankInfo.title}`;
            document.getElementById('profileLevelText').innerText = rankInfo.isMaxRank
                ? `Высшее звание достигнуто • ${playerData.xp} XP всего`
                : rankInfo.blockedByRequirement
                    ? `Звание ${rankInfo.index + 1} из ${rankInfo.total} • ждёт: ${rankInfo.nextReqText}`
                    : `Звание ${rankInfo.index + 1} из ${rankInfo.total} • ${rankInfo.xpToNext} XP до повышения`;

            updateNameChangeLockState();
            const removeBtn = document.getElementById('btnRemovePhoto');
            if (removeBtn) removeBtn.classList.toggle('hidden', !playerData.photo);

            document.getElementById('profStatGames').innerText = playerData.stats.totalGames || 0;
            document.getElementById('profStatTokens').innerText = `${playerData.stats.totalTokensEarned || 0} 🪖`;
            document.getElementById('profStatBosses').innerText = `${playerData.stats.bossesDefeated || 0} 👹`;
            document.getElementById('profStatDefusals').innerText = `${playerData.stats.defusalsWon || 0} 💣`;

            renderArmoryAvatars();
            renderQuestsUI();
            renderAchievementsInProfile();
            renderProgressChart();
            renderDisciplineStats();
            renderFramePicker();
            renderSettingsUI();
        }

        // Renders either the player's uploaded photo or their emoji avatar into a target element
        function renderAvatarInto(elementId, applyFrame) {
            const el = document.getElementById(elementId);
            if (!el) return;
            if (playerData.photo) {
                el.innerHTML = `<img src="${playerData.photo}" class="w-full h-full object-cover rounded-lg" alt="avatar">`;
            } else {
                el.innerHTML = '';
                el.innerText = playerData.avatar;
            }
            if (applyFrame) applyAvatarFrameStyle(el);
        }

        // Frame styles only ever set border + box-shadow, so we can target just those two inline
        // properties without disturbing any other inline styles the element might carry.
        function applyAvatarFrameStyle(el) {
            const frame = PROFILE_FRAMES.find(f => f.id === (playerData.activeFrame || 'none')) || PROFILE_FRAMES[0];
            if (frame.id === 'none') {
                el.style.border = '';
                el.style.boxShadow = '';
                return;
            }
            const borderMatch = frame.style.match(/border:\s*([^;]+);/);
            const shadowMatch = frame.style.match(/box-shadow:\s*([^;]+);/);
            el.style.border = borderMatch ? borderMatch[1] : '';
            el.style.boxShadow = shadowMatch ? shadowMatch[1] : '';
        }

        function updateNameChangeLockState() {
            const input = document.getElementById('inputCallsign');
            const saveBtn = document.getElementById('btnSaveCallsign');
            const lockNote = document.getElementById('callsignLockNote');
            if (!input) return;

            const unlocked = playerData.xp >= NAME_CHANGE_UNLOCK_XP;
            input.disabled = !unlocked;
            if (saveBtn) saveBtn.disabled = !unlocked;
            input.classList.toggle('opacity-50', !unlocked);
            input.classList.toggle('cursor-not-allowed', !unlocked);
            if (saveBtn) saveBtn.classList.toggle('opacity-40', !unlocked);

            if (lockNote) {
                if (unlocked) {
                    lockNote.classList.add('hidden');
                } else {
                    lockNote.classList.remove('hidden');
                    lockNote.innerText = `🔒 Смена позывного откроется по достижении звания ЕФРЕЙТОР (${NAME_CHANGE_UNLOCK_XP} XP). Осталось: ${Math.max(0, NAME_CHANGE_UNLOCK_XP - playerData.xp)} XP`;
                }
            }
        }

        // --- MILITARY RANK LADDER (мотивационная система званий) ---
        // Most ranks are XP-only, same as before. A handful of milestone ranks additionally require
        // something you can't just grind XP for (games played, a streak, a campaign stage) and hand
        // out a one-time unique reward (an avatar or profile frame) the first time you reach them.
        const RANKS = [
            { minXp: 0,    title: 'КУРСАНТ',              icon: '🪖' },
            { minXp: 150,  title: 'ЕФРЕЙТОР',             icon: '🎖️' },
            { minXp: 350,  title: 'МЛ. СЕРЖАНТ',          icon: '🥉', requirements: { minGames: 5 }, reqText: 'Сыграть 5 боёв' },
            { minXp: 600,  title: 'СЕРЖАНТ',              icon: '🥈' },
            { minXp: 900,  title: 'СТАРШИНА',             icon: '🥇', requirements: { minStreak: 3 }, reqText: 'Серия 3 дня подряд', reward: { frame: 'bronze' } },
            { minXp: 1250, title: 'МЛ. ЛЕЙТЕНАНТ',        icon: '⭐', requirements: { campaignStageId: 'basic' }, reqText: 'Пройти этап кампании «Базовая подготовка»' },
            { minXp: 1650, title: 'ЛЕЙТЕНАНТ',            icon: '⭐⭐' },
            { minXp: 2100, title: 'СТ. ЛЕЙТЕНАНТ',        icon: '⭐⭐⭐', requirements: { minDisciplinesAbove: { count: 3, threshold: 70 } }, reqText: '3 дисциплины с точностью от 70%' },
            { minXp: 2600, title: 'КАПИТАН',              icon: '🌟', requirements: { campaignUnlockedAtLeast: 5 }, reqText: 'Дойти до середины кампании', reward: { avatar: '🐺' } },
            { minXp: 3200, title: 'МАЙОР',                icon: '🌟🌟', requirements: { minBosses: 1 }, reqText: 'Победить Босса-Экзаменатора' },
            { minXp: 3900, title: 'ПОДПОЛКОВНИК',         icon: '🌟🌟🌟', requirements: { minStreak: 7 }, reqText: 'Серия 7 дней подряд', reward: { frame: 'silver' } },
            { minXp: 4700, title: 'ПОЛКОВНИК',            icon: '🦅', requirements: { qualificationEarned: true }, reqText: 'Получить квалификацию в Кампании', reward: { frame: 'gold' } },
            { minXp: 5600, title: 'ГЕНЕРАЛ-МАЙОР',        icon: '👑', requirements: { minGames: 50 }, reqText: 'Сыграть 50 боёв', reward: { avatar: '🦅' } },
            { minXp: 6600, title: 'ГЕНЕРАЛ-ЛЕЙТЕНАНТ',    icon: '👑👑', requirements: { avgAccuracyAbove: 80 }, reqText: 'Средняя точность от 80% по всем дисциплинам' },
            { minXp: 7700, title: 'ГЕНЕРАЛ-ПОЛКОВНИК',    icon: '👑👑👑', requirements: { minDisciplinesAbove: { count: 8, threshold: 75 } }, reqText: 'Все 8 дисциплин с точностью от 75%' },
            { minXp: 9000, title: 'ГЕНЕРАЛ АРМИИ',        icon: '🔱', requirements: { campaignFullyComplete: true }, reqText: 'Пройти кампанию полностью', reward: { frame: 'purple', avatar: '🐉' } }
        ];

        // Minimum XP required before a cadet has "earned the right" to change callsign
        const NAME_CHANGE_UNLOCK_XP = RANKS[1].minXp; // ЕФРЕЙТОР

        function disciplinesAtOrAbove(threshold, minSample) {
            minSample = minSample || 5;
            return Object.keys(DISCIPLINE_LABELS).filter(cat => {
                const s = playerData.disciplineStats && playerData.disciplineStats[cat];
                return s && s.total >= minSample && (s.correct / s.total) * 100 >= threshold;
            }).length;
        }

        function disciplineAccuracyAtOrAbove(cat, threshold, minSample) {
            minSample = minSample || 10;
            const s = playerData.disciplineStats && playerData.disciplineStats[cat];
            return !!(s && s.total >= minSample && (s.correct / s.total) * 100 >= threshold);
        }

        function totalQuestionsAnswered() {
            return Object.values(playerData.disciplineStats || {}).reduce((sum, s) => sum + s.total, 0);
        }

        function hasFlawlessGame() {
            return (playerData.gameHistory || []).some(g => g.accuracy === 100 && g.totalQuestions >= 10);
        }

        // --- MEDALS (permanent, checked automatically after each battle — see checkMedals) ---
        const MEDALS = [
            { id: 'first_battle',     icon: '🥉', name: 'Первый бой',            desc: 'Завершить свой первый бой',                     check: () => (playerData.stats.totalGames || 0) >= 1 },
            { id: 'sharpshooter',     icon: '🥈', name: 'Меткий стрелок',        desc: 'Набрать комбо x5 за один бой',                   check: () => (playerData.maxComboEver || 0) >= 5 },
            { id: 'excellent',        icon: '🥇', name: 'Отличник подготовки',   desc: 'Точность 90%+ хотя бы в одной дисциплине',       check: () => disciplinesAtOrAbove(90, 10) >= 1 },
            { id: 'rhbz_master',      icon: '🛡️', name: 'Знаток РХБЗ',           desc: 'Точность 90%+ по РХБЗ',                          check: () => disciplineAccuracyAtOrAbove('rhbz', 90) },
            { id: 'mechanic',         icon: '🚜', name: 'Механик',               desc: 'Точность 90%+ по Бронетехнике',                  check: () => disciplineAccuracyAtOrAbove('btv', 90) },
            { id: 'signalman',        icon: '📡', name: 'Связист',               desc: 'Точность 90%+ по Связи',                         check: () => disciplineAccuracyAtOrAbove('svyaz', 90) },
            { id: 'hundred_questions', icon: '🎖️', name: '100 вопросов',         desc: 'Ответить на 100 вопросов суммарно',              check: () => totalQuestionsAnswered() >= 100 },
            { id: 'thirty_days',      icon: '🔥', name: '30 дней подряд',        desc: 'Серия входов 30 дней подряд',                    check: () => (playerData.streak.longest || 0) >= 30 },
            { id: 'flawless',         icon: '💀', name: 'Без ошибок',            desc: 'Пройти бой из 10+ вопросов со 100% точностью',   check: () => hasFlawlessGame() },
            { id: 'expert',           icon: '👑', name: 'Эксперт',               desc: 'Получить квалификацию в Кампании',               check: () => !!(playerData.campaign && playerData.campaign.qualificationEarned) }
        ];

        function checkMedals() {
            if (!Array.isArray(playerData.earnedMedals)) playerData.earnedMedals = [];
            const newlyEarned = [];
            MEDALS.forEach(m => {
                if (!playerData.earnedMedals.includes(m.id) && m.check()) {
                    playerData.earnedMedals.push(m.id);
                    newlyEarned.push(m);
                }
            });
            if (newlyEarned.length > 0) {
                savePlayerData();
                newlyEarned.forEach((m, i) => {
                    setTimeout(() => showFloatingText(`🏅 МЕДАЛЬ: ${m.name}`, window.innerWidth / 2 - 95, window.innerHeight / 2 + 60 + i * 34, '#eab308'), 500 + i * 450);
                });
                playSound('correct');
                spawnFireworks();
            }
            return newlyEarned;
        }

        function openMedalsModal() {
            renderMedalsModal();
            openModal('medalsModal');
        }

        function renderMedalsModal() {
            const box = document.getElementById('medalsList');
            if (!box) return;
            const earned = playerData.earnedMedals || [];
            box.innerHTML = '';
            MEDALS.forEach(m => {
                const isEarned = earned.includes(m.id);
                const row = document.createElement('div');
                row.className = `p-2.5 rounded-xl border flex items-center space-x-2.5 ${isEarned ? 'bg-amber-950/30 border-amber-500/40' : 'bg-slate-950/60 border-slate-800 opacity-60'}`;
                row.innerHTML = `
                    <span class="text-2xl shrink-0">${isEarned ? m.icon : '🔒'}</span>
                    <div class="min-w-0">
                        <div class="font-military text-[11px] ${isEarned ? 'text-amber-300' : 'text-slate-400'}">${m.name}</div>
                        <div class="text-[9px] text-slate-500">${m.desc}</div>
                    </div>
                `;
                box.appendChild(row);
            });
        }

        function averageDisciplineAccuracy() {
            const cats = Object.keys(DISCIPLINE_LABELS).filter(c => playerData.disciplineStats && playerData.disciplineStats[c] && playerData.disciplineStats[c].total > 0);
            if (cats.length === 0) return 0;
            const sum = cats.reduce((acc, c) => acc + (playerData.disciplineStats[c].correct / playerData.disciplineStats[c].total) * 100, 0);
            return sum / cats.length;
        }

        // Checked only for the PLAYER's own rank (see getPlayerRankInfo) — never used for friends,
        // who only have a name+xp and no tracked stats to evaluate requirements against.
        function checkRankRequirements(rank) {
            const req = rank.requirements;
            if (!req) return true;
            if (req.minGames && (playerData.stats.totalGames || 0) < req.minGames) return false;
            if (req.minStreak && (playerData.streak.longest || 0) < req.minStreak) return false;
            if (req.minBosses && (playerData.stats.bossesDefeated || 0) < req.minBosses) return false;
            if (req.campaignStageId) {
                const rec = playerData.campaign && playerData.campaign.completedStages[req.campaignStageId];
                if (!rec || !rec.completed) return false;
            }
            if (req.campaignUnlockedAtLeast && (playerData.campaign ? playerData.campaign.unlockedStageIndex : 0) < req.campaignUnlockedAtLeast) return false;
            if (req.qualificationEarned && !(playerData.campaign && playerData.campaign.qualificationEarned)) return false;
            if (req.campaignFullyComplete && (!playerData.campaign || playerData.campaign.unlockedStageIndex < CAMPAIGN_STAGES.length - 1 || !playerData.campaign.qualificationEarned)) return false;
            if (req.minDisciplinesAbove && disciplinesAtOrAbove(req.minDisciplinesAbove.threshold) < req.minDisciplinesAbove.count) return false;
            if (req.avgAccuracyAbove && averageDisciplineAccuracy() < req.avgAccuracyAbove) return false;
            return true;
        }

        // Plain XP-only lookup — used for the friends leaderboard, where we only know a name and an
        // xp number, not any of the stats the milestone requirements above need.
        function getRankInfo(xp) {
            let idx = 0;
            for (let i = 0; i < RANKS.length; i++) {
                if (xp >= RANKS[i].minXp) idx = i; else break;
            }
            const current = RANKS[idx];
            const next = RANKS[idx + 1] || null;
            const xpIntoRank = xp - current.minXp;
            const xpForRank = next ? (next.minXp - current.minXp) : 1;
            const progressPct = next ? Math.min(100, Math.round((xpIntoRank / xpForRank) * 100)) : 100;
            return {
                index: idx,
                total: RANKS.length,
                title: current.title,
                icon: current.icon,
                next: next,
                xpIntoRank,
                xpToNext: next ? (next.minXp - xp) : 0,
                progressPct,
                isMaxRank: !next
            };
        }

        // The player's actual rank: XP threshold AND every milestone requirement up to that point
        // must hold. A rank whose XP is met but requirement isn't blocks any rank after it too —
        // you can't skip ahead on XP alone.
        function getPlayerRankInfo() {
            const xp = playerData.xp;
            let idx = 0;
            for (let i = 0; i < RANKS.length; i++) {
                if (xp >= RANKS[i].minXp && checkRankRequirements(RANKS[i])) idx = i;
                else break;
            }
            const current = RANKS[idx];
            const next = RANKS[idx + 1] || null;
            const xpIntoRank = xp - current.minXp;
            const xpForRank = next ? (next.minXp - current.minXp) : 1;
            const progressPct = next ? Math.min(100, Math.round((xpIntoRank / xpForRank) * 100)) : 100;
            const blockedByRequirement = !!(next && xp >= next.minXp && !checkRankRequirements(next));
            return {
                index: idx,
                total: RANKS.length,
                title: current.title,
                icon: current.icon,
                next: next,
                xpIntoRank,
                xpToNext: next ? Math.max(0, next.minXp - xp) : 0,
                progressPct,
                isMaxRank: !next,
                blockedByRequirement,
                nextReqText: next ? next.reqText : null
            };
        }

        function getRankTitleByXp(xp) {
            return getRankInfo(xp).title;
        }

        // Grants every reward attached to ranks strictly between fromIndex and toIndex (inclusive of
        // toIndex) — covers the rare case of clearing several milestone ranks in a single XP gain.
        // Returns human-readable notes for the results-screen floating text.
        function grantRankRewards(fromIndex, toIndex) {
            const notes = [];
            for (let i = fromIndex + 1; i <= toIndex; i++) {
                const rank = RANKS[i];
                if (!rank || !rank.reward) continue;
                if (rank.reward.avatar && !playerData.unlockedAvatars.includes(rank.reward.avatar)) {
                    playerData.unlockedAvatars.push(rank.reward.avatar);
                    const item = AVATAR_SHOP.find(a => a.id === rank.reward.avatar);
                    notes.push(`🎁 НОВЫЙ АВАТАР: ${item ? item.name : rank.reward.avatar}`);
                }
                if (rank.reward.frame && !playerData.unlockedFrames.includes(rank.reward.frame)) {
                    playerData.unlockedFrames.push(rank.reward.frame);
                    const frame = PROFILE_FRAMES.find(f => f.id === rank.reward.frame);
                    notes.push(`🖼️ НОВАЯ РАМКА: ${frame ? frame.name : rank.reward.frame}`);
                }
            }
            if (notes.length > 0) savePlayerData();
            return notes;
        }

        function updateCallsign(val) {
            if (playerData.xp < NAME_CHANGE_UNLOCK_XP) return;
            if (val && val.trim().length > 0) {
                playerData.callsign = val.trim().slice(0, 18);
                savePlayerData();
            }
        }

        function saveCallsign() {
            if (playerData.xp < NAME_CHANGE_UNLOCK_XP) {
                playSound('wrong');
                return;
            }
            const input = document.getElementById('inputCallsign');
            if (input) updateCallsign(input.value);
            playSound('correct');
        }

        // Reads an uploaded image, downsizes it to a square thumbnail, and stores it as the player's avatar photo
        const PHOTO_UPLOAD_COST = 100;

        function triggerPhotoUpload() {
            playSound('click');
            const msgEl = document.getElementById('photoConfirmMessage');

            if (!playerData.photoFreeUsed) {
                msgEl.innerHTML = `Первая загрузка фото — <span class="text-lime-400 font-bold">бесплатно!</span><br>Каждая следующая смена фото будет стоить <span class="text-amber-400 font-bold">${PHOTO_UPLOAD_COST} 🪖</span>. Выбрать фото из галереи?`;
                openModal('photoConfirmModal');
                return;
            }

            if (playerData.tokens < PHOTO_UPLOAD_COST) {
                playSound('wrong');
                showFloatingText(`НУЖНО ${PHOTO_UPLOAD_COST} 🪖 НА СМЕНУ ФОТО!`, window.innerWidth / 2 - 100, window.innerHeight / 2, '#ef4444');
                return;
            }

            msgEl.innerHTML = `Смена фото стоит <span class="text-amber-400 font-bold">${PHOTO_UPLOAD_COST} 🪖</span> жетонов. Списать и выбрать новое фото?`;
            openModal('photoConfirmModal');
        }

        function proceedPhotoUpload() {
            closeModal('photoConfirmModal');
            document.getElementById('photoUploadInput').click();
        }

        function handleProfilePhotoUpload(event) {
            const file = event.target.files[0];
            if (!file || !file.type.startsWith('image/')) return;

            const reader = new FileReader();
            reader.onload = (e) => {
                const img = new Image();
                img.onload = () => {
                    const SIZE = 160;
                    const canvas = document.createElement('canvas');
                    canvas.width = SIZE;
                    canvas.height = SIZE;
                    const ctx2d = canvas.getContext('2d');

                    // Center-crop to a square before resizing
                    const side = Math.min(img.width, img.height);
                    const sx = (img.width - side) / 2;
                    const sy = (img.height - side) / 2;
                    ctx2d.drawImage(img, sx, sy, side, side, 0, 0, SIZE, SIZE);

                    playerData.photo = canvas.toDataURL('image/jpeg', 0.85);

                    if (!playerData.photoFreeUsed) {
                        playerData.photoFreeUsed = true;
                        showFloatingText('ФОТО УСТАНОВЛЕНО (БЕСПЛАТНО)', window.innerWidth / 2 - 100, window.innerHeight / 2, '#84cc16');
                    } else {
                        playerData.tokens -= PHOTO_UPLOAD_COST;
                        showFloatingText(`ФОТО ОБНОВЛЕНО! -${PHOTO_UPLOAD_COST} 🪖`, window.innerWidth / 2 - 90, window.innerHeight / 2, '#84cc16');
                    }

                    savePlayerData();
                    playSound('correct');
                };
                img.onerror = () => playSound('wrong');
                img.src = e.target.result;
            };
            reader.onerror = () => playSound('wrong');
            reader.readAsDataURL(file);

            // Allow re-selecting the same file later
            event.target.value = '';
        }

        function removeProfilePhoto() {
            playerData.photo = null;
            savePlayerData();
            playSound('click');
        }

        function renderArmoryAvatars() {
            const grid = document.getElementById('armoryAvatarsGrid');
            if (!grid) return;
            grid.innerHTML = '';

            AVATAR_SHOP.forEach(item => {
                const isUnlocked = playerData.unlockedAvatars.includes(item.id);
                const isSelected = playerData.avatar === item.id;
                
                const card = document.createElement('div');
                card.className = `p-2 rounded-xl border text-center flex flex-col items-center justify-between cursor-pointer transition-all ${
                    isSelected ? 'border-2 border-lime-400 bg-lime-950/80 shadow-[0_0_10px_rgba(132,204,22,0.4)]' : 
                    isUnlocked ? 'border-slate-700 bg-slate-900/60' : 'border-slate-800 bg-slate-950/60 opacity-60'
                }`;

                card.onclick = () => selectOrPromptBuyAvatar(item);

                card.innerHTML = `
                    <div class="text-2xl">${item.id}</div>
                    <div class="font-military text-[9px] text-slate-200 mt-1">${item.name}</div>
                    <div class="mt-1">
                        ${isSelected ? '<span class="text-[8px] bg-lime-500 text-slate-950 px-1 rounded font-bold">АКТИВЕН</span>' :
                          isUnlocked ? '<span class="text-[8px] text-lime-400 font-mono">ВЫБРАТЬ</span>' :
                          item.campaignLocked ? '<span class="text-[8px] bg-purple-950 text-purple-300 px-1 rounded border border-purple-500/40">🗺️ Кампания</span>' :
                          item.rankLocked ? `<span class="text-[8px] bg-indigo-950 text-indigo-300 px-1 rounded border border-indigo-500/40">🎖️ ${item.rankTitle}</span>` :
                          `<span class="text-[8px] bg-amber-950 text-amber-300 px-1 rounded border border-amber-500/40">${item.price} 🪖</span>`}
                    </div>
                `;
                grid.appendChild(card);
            });
        }

        // Confirmation Modal Prompt when purchasing skins
        function selectOrPromptBuyAvatar(item) {
            playSound('click');
            if (playerData.unlockedAvatars.includes(item.id)) {
                playerData.avatar = item.id;
                playerData.photo = null;
                savePlayerData();
            } else if (item.campaignLocked) {
                playSound('wrong');
                showFloatingText('НУЖНО ПРОЙТИ ЭКЗАМЕН В КАМПАНИИ', window.innerWidth / 2 - 140, window.innerHeight / 2, '#a855f7');
            } else if (item.rankLocked) {
                playSound('wrong');
                showFloatingText(`НУЖНО ЗВАНИЕ: ${item.rankTitle}`, window.innerWidth / 2 - 110, window.innerHeight / 2, '#818cf8');
            } else {
                // Open Purchase Confirmation Modal
                pendingItemToBuy = item;
                document.getElementById('buyConfirmIcon').innerText = item.id;
                document.getElementById('buyConfirmItemName').innerText = item.name;
                document.getElementById('buyConfirmPrice').innerText = item.price;
                openModal('buyConfirmModal');
            }
        }

        function confirmPurchase() {
            closeModal('buyConfirmModal');
            if (!pendingItemToBuy) return;

            const item = pendingItemToBuy;
            if (playerData.tokens >= item.price) {
                playerData.tokens -= item.price;
                playerData.unlockedAvatars.push(item.id);
                playerData.avatar = item.id;
                playerData.photo = null;
                playSound('correct');
                spawnFireworks();
                savePlayerData();
                showFloatingText(`КУПЛЕНО: ${item.name}!`, window.innerWidth / 2 - 60, window.innerHeight / 2, '#84cc16');
            } else {
                playSound('wrong');
                showFloatingText(`НЕДОСТАТОЧНО ЖЕТОНОВ!`, window.innerWidth / 2 - 80, window.innerHeight / 2, '#ef4444');
            }
            pendingItemToBuy = null;
        }

        function buyPerk(perkKey, price) {
            playSound('click');
            if (playerData.tokens >= price) {
                playerData.tokens -= price;
                playerData.inventory[perkKey] = (playerData.inventory[perkKey] || 0) + 1;
                playSound('correct');
                savePlayerData();
            } else {
                playSound('wrong');
            }
        }

        // --- DAILY STREAK & DAILY MISSIONS ---
        // Uses the player's local calendar day, not UTC, so resets line up
        // with when the cadet actually sees "a new day" on their device.

        function getTodayDateStr() {
            const d = new Date();
            return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        }

        function daysBetweenDateStrs(a, b) {
            const d1 = new Date(a + 'T00:00:00');
            const d2 = new Date(b + 'T00:00:00');
            return Math.round((d2 - d1) / 86400000);
        }

        function getTimeUntilMidnightStr() {
            const now = new Date();
            const midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 0);
            const diffMs = Math.max(0, midnight - now);
            const h = Math.floor(diffMs / 3600000);
            const m = Math.floor((diffMs % 3600000) / 60000);
            return `обновление через ${h}ч ${m}м`;
        }

        // Russian pluralisation for "день / дня / дней"
        function pluralDays(n) {
            const abs = Math.abs(n) % 100;
            const last = abs % 10;
            if (abs > 10 && abs < 20) return 'дней';
            if (last === 1) return 'день';
            if (last >= 2 && last <= 4) return 'дня';
            return 'дней';
        }

        // Bonus tokens for the Nth consecutive day (streakDay is 1-indexed, the value AFTER incrementing).
        function getStreakBonus(streakDay) {
            const earlyTable = [10, 12, 15, 18, 22, 26]; // days 1-6
            if (streakDay >= 30) return 100;
            if (streakDay >= 14) return 70;
            if (streakDay >= 7) return 50;
            return earlyTable[Math.min(streakDay, earlyTable.length) - 1] || 10;
        }

        // Regenerates the daily mission set whenever the local date has changed since the set was created.
        // Safe to call as often as needed — it's a no-op once today's set already exists.
        function checkDailyReset() {
            const today = getTodayDateStr();
            if (!playerData.dailyQuests || playerData.dailyQuests.date !== today) {
                const pool = [...DAILY_QUEST_POOL].sort(() => Math.random() - 0.5);
                const picked = pool.slice(0, 3).map((tpl, i) => ({
                    id: `d${i + 1}_${today}`,
                    type: tpl.type,
                    text: tpl.text,
                    target: tpl.target,
                    current: 0,
                    reward: tpl.reward,
                    done: false,
                    claimed: false
                }));
                playerData.dailyQuests = { date: today, list: picked };
                savePlayerData();
            }
        }

        // Call once per completed battle (from finishQuiz). Returns whether TODAY was newly credited,
        // so the caller can show a streak-bonus banner only on the first game of a new day.
        function updateStreak() {
            const today = getTodayDateStr();
            const st = playerData.streak;

            if (st.lastPlayedDate === today) {
                return { creditedToday: false, current: st.current, usedFreeze: false };
            }

            let usedFreeze = false;
            if (st.lastPlayedDate) {
                const gap = daysBetweenDateStrs(st.lastPlayedDate, today);
                const missedDays = gap - 1;
                const freezesAvailable = playerData.inventory.streakFreeze || 0;

                if (gap === 1) {
                    st.current = st.current + 1;
                } else if (missedDays > 0 && freezesAvailable >= missedDays) {
                    playerData.inventory.streakFreeze -= missedDays;
                    st.current = st.current + 1;
                    usedFreeze = true;
                } else {
                    st.current = 1;
                }
            } else {
                st.current = 1; // first battle ever
            }

            st.lastPlayedDate = today;
            if (st.current > st.longest) st.longest = st.current;

            return { creditedToday: true, current: st.current, usedFreeze };
        }

        // Adds progress to the first not-yet-done active daily quest matching `type`. Idempotent once done.
        function updateDailyQuestProgress(type, amount = 1) {
            if (!playerData.dailyQuests || !Array.isArray(playerData.dailyQuests.list)) return;
            const q = playerData.dailyQuests.list.find(item => item.type === type && !item.done);
            if (!q) return;

            q.current = Math.min(q.target, q.current + amount);
            if (q.current >= q.target) {
                q.done = true;
                playerData.hasUnseenQuestReward = true;
                showFloatingText('ЕЖЕДНЕВНОЕ ЗАДАНИЕ ВЫПОЛНЕНО!', window.innerWidth / 2 - 115, window.innerHeight / 2, '#818cf8');
                playSound('correct');
                updateQuestPingIndicator();
            }
            savePlayerData();
        }

        // Game-end daily quest checks (called once from finishQuiz, after score/accuracy are known).
        function evaluateGameEndDailyQuests(finalScore, finalAccuracy) {
            updateDailyQuestProgress('games', 1);
            if (selectedDiscipline !== 'all') updateDailyQuestProgress('disc:' + selectedDiscipline, 1);
            if (gameMode === 'boss' && bossHp <= 0) updateDailyQuestProgress('bossWin', 1);

            if (playerData.dailyQuests && Array.isArray(playerData.dailyQuests.list)) {
                let changed = false;
                playerData.dailyQuests.list.forEach(q => {
                    if (q.done) return;
                    if (q.type === 'scoreInGame' && finalScore >= q.target) { q.current = q.target; q.done = true; playerData.hasUnseenQuestReward = true; changed = true; }
                    if (q.type === 'accuracy80' && finalAccuracy >= 80) { q.current = q.target; q.done = true; playerData.hasUnseenQuestReward = true; changed = true; }
                });
                if (changed) { savePlayerData(); updateQuestPingIndicator(); }
            }
        }

        function renderDailyQuestsUI() {
            checkDailyReset();
            const container = document.getElementById('dailyQuestsContainer');
            if (container) {
                container.innerHTML = '';
                playerData.dailyQuests.list.forEach(q => {
                    const claimable = q.done && !q.claimed;
                    const box = document.createElement('div');
                    box.className = `p-3 rounded-xl border flex items-center justify-between ${
                        claimable ? 'bg-amber-950/40 border-amber-500/60' :
                        q.done ? 'bg-indigo-950/50 border-indigo-500/40' : 'bg-slate-950/80 border-slate-800'
                    }`;

                    let rightHtml;
                    if (claimable) {
                        rightHtml = `<button onclick="claimDailyQuestReward('${q.id}')" class="btn-amber-glow px-2.5 py-1.5 rounded-lg font-military text-[10px] uppercase animate-combo">🎁 ЗАБРАТЬ +${q.reward}</button>`;
                    } else if (q.claimed) {
                        rightHtml = '<span class="text-xs text-lime-400 font-bold">ПОЛУЧЕНО ✓</span>';
                    } else {
                        rightHtml = `<span class="text-xs bg-amber-950 text-amber-300 px-2 py-1 rounded border border-amber-500/40">+${q.reward} 🪖</span>`;
                    }

                    box.innerHTML = `
                        <div>
                            <div class="font-military text-slate-200">${q.text}</div>
                            <div class="text-[10px] text-indigo-300">Прогресс: ${q.current} / ${q.target}</div>
                        </div>
                        <div>${rightHtml}</div>
                    `;
                    container.appendChild(box);
                });
            }

            const timerEl = document.getElementById('dailyQuestsResetTimer');
            if (timerEl) timerEl.innerText = getTimeUntilMidnightStr();

            const streakTextEl = document.getElementById('questsStreakText');
            if (streakTextEl) streakTextEl.innerText = `Серия: ${playerData.streak.current} ${pluralDays(playerData.streak.current)}`;
            const streakBestEl = document.getElementById('questsStreakBest');
            if (streakBestEl) streakBestEl.innerText = `Рекорд: ${playerData.streak.longest}`;
            const freezeEl = document.getElementById('questsStreakFreezeCount');
            if (freezeEl) freezeEl.innerText = `❄️ ${playerData.inventory.streakFreeze || 0}`;
        }

        function claimDailyQuestReward(questId) {
            const q = playerData.dailyQuests.list.find(item => item.id === questId);
            if (!q || !q.done || q.claimed) return;

            q.claimed = true;
            playerData.tokens += q.reward;
            playerData.stats.totalTokensEarned = (playerData.stats.totalTokensEarned || 0) + q.reward;
            savePlayerData();

            playSound('correct');
            spawnFireworks();
            showFloatingText(`+${q.reward} 🪖 ЕЖЕДНЕВНАЯ НАГРАДА!`, window.innerWidth / 2 - 100, window.innerHeight / 2, '#818cf8');
            hapticFeedback([30, 30, 30]);

            renderDailyQuestsUI();
            const stillHasUnclaimed = playerData.quests.some(item => item.done && !item.claimed) ||
                playerData.dailyQuests.list.some(item => item.done && !item.claimed);
            playerData.hasUnseenQuestReward = stillHasUnclaimed;
            savePlayerData();
            updateQuestPingIndicator();
        }

        // --- QUESTION OF THE DAY ---
        // Same question for every cadet on a given local date — picked deterministically from the date
        // string, so no backend is needed to keep everyone "in sync" for the day.
        function getDailyQuestionId(dateStr) {
            let hash = 0;
            for (let i = 0; i < dateStr.length; i++) { hash = (hash * 31 + dateStr.charCodeAt(i)) >>> 0; }
            return hash % ALL_QUESTIONS.length;
        }

        function checkDailyQuestion() {
            const today = getTodayDateStr();
            if (!playerData.dailyQuestion || playerData.dailyQuestion.date !== today) {
                playerData.dailyQuestion = { date: today, questionId: getDailyQuestionId(today), answered: false, wasCorrect: false };
                savePlayerData();
            }
        }

        const DAILY_QUESTION_REWARD_TOKENS = 40;
        const DAILY_QUESTION_REWARD_XP = 20;

        function openDailyQuestion() {
            checkDailyQuestion();
            renderDailyQuestionBody();
            openModal('dailyQuestionModal');
        }

        function renderDailyQuestionBody() {
            const body = document.getElementById('dailyQuestionBody');
            if (!body) return;
            const q = ALL_QUESTIONS.find(item => item.id === playerData.dailyQuestion.questionId);
            if (!q) { body.innerHTML = ''; return; }

            if (playerData.dailyQuestion.answered) {
                const wasCorrect = playerData.dailyQuestion.wasCorrect;
                body.innerHTML = `
                    <div class="text-slate-200 font-military text-xs leading-snug">${q.question}</div>
                    <div class="p-2.5 rounded-lg border ${wasCorrect ? 'bg-lime-950/40 border-lime-500/50 text-lime-300' : 'bg-red-950/30 border-red-500/40 text-red-300'} text-xs font-military">
                        ${wasCorrect ? `✅ ВЕРНО! +${DAILY_QUESTION_REWARD_TOKENS} 🪖 +${DAILY_QUESTION_REWARD_XP} XP` : `❌ Правильный ответ: ${q.options[q.correct]}`}
                    </div>
                    <p class="text-[11px] text-slate-400 leading-snug">${q.explanation}</p>
                    <p class="text-[10px] text-slate-500">Новый вопрос дня — завтра.</p>
                    <button onclick="closeModal('dailyQuestionModal')" class="btn-green-glow py-2.5 w-full rounded-lg font-military text-xs uppercase mt-1">ЗАКРЫТЬ</button>
                `;
            } else {
                dailyQuestionOptionOrder = shuffleArray(q.options.map((_, i) => i));
                const optionsHtml = dailyQuestionOptionOrder.map((origIdx, dispIdx) => `
                    <button onclick="answerDailyQuestion(${dispIdx})" class="btn-tactical-option w-full p-3 rounded-lg text-left text-xs font-military flex items-center justify-between cursor-pointer">
                        <span class="text-slate-100 pr-2">${q.options[origIdx]}</span>
                        <span class="text-[10px] font-mono text-slate-500 shrink-0">#${dispIdx + 1}</span>
                    </button>
                `).join('');
                body.innerHTML = `
                    <div class="text-amber-300 text-[10px] font-mono uppercase">Награда: +${DAILY_QUESTION_REWARD_TOKENS} 🪖 +${DAILY_QUESTION_REWARD_XP} XP</div>
                    <div class="text-slate-200 font-military text-xs leading-snug">${q.question}</div>
                    <div class="space-y-1.5 pt-1">${optionsHtml}</div>
                `;
            }
        }

        function answerDailyQuestion(selectedIndex) {
            if (playerData.dailyQuestion.answered) return;
            const q = ALL_QUESTIONS.find(item => item.id === playerData.dailyQuestion.questionId);
            if (!q) return;

            const isCorrect = dailyQuestionOptionOrder[selectedIndex] === q.correct;
            playerData.dailyQuestion.answered = true;
            playerData.dailyQuestion.wasCorrect = isCorrect;

            if (isCorrect) {
                playerData.tokens += DAILY_QUESTION_REWARD_TOKENS;
                playerData.xp += DAILY_QUESTION_REWARD_XP;
                playerData.stats.totalTokensEarned = (playerData.stats.totalTokensEarned || 0) + DAILY_QUESTION_REWARD_TOKENS;
                clearMistake(q);
                playSound('correct');
                spawnFireworks();
                hapticFeedback([30]);
            } else {
                recordMistake(q);
                playSound('wrong');
                hapticFeedback([50, 40, 50]);
            }

            savePlayerData();
            renderDailyQuestionBody();
            updateDailyQuestionButtonUI();
        }

        function updateDailyQuestionButtonUI() {
            const dot = document.getElementById('dailyQuestionPingDot');
            const dotStatic = document.getElementById('dailyQuestionPingDotStatic');
            if (!dot || !dotStatic) return;
            const answered = playerData.dailyQuestion && playerData.dailyQuestion.answered;
            dot.classList.toggle('hidden', !!answered);
            dotStatic.classList.toggle('hidden', !!answered);
        }

        // --- DAILY FREE CHEST ---
        const DAILY_CHEST_REWARDS = [
            { type: 'tokens', min: 15, max: 30, weight: 45, label: t => `+${t} 🪖 Жетонов` },
            { type: 'tokens', min: 40, max: 70, weight: 15, label: t => `+${t} 🪖 Жетонов — крупная удача!` },
            { type: 'perk5050', amount: 1, weight: 20, label: () => '+1 🎯 Подсказка 50/50' },
            { type: 'perkTime', amount: 1, weight: 20, label: () => '+1 ⏳ Подсказка +10с' }
        ];

        function checkDailyChest() {
            const today = getTodayDateStr();
            if (!playerData.dailyChest || playerData.dailyChest.date !== today) {
                playerData.dailyChest = { date: today, opened: false };
                savePlayerData();
            }
        }

        function updateDailyChestButtonUI() {
            const dot = document.getElementById('dailyChestPingDot');
            const dotStatic = document.getElementById('dailyChestPingDotStatic');
            const label = document.getElementById('btnDailyChestLabel');
            const btn = document.getElementById('btnDailyChest');
            if (!dot || !dotStatic) return;
            const opened = playerData.dailyChest && playerData.dailyChest.opened;
            dot.classList.toggle('hidden', !!opened);
            dotStatic.classList.toggle('hidden', !!opened);
            if (label) label.innerText = opened ? 'СУНДУК ОТКРЫТ' : 'СУНДУК ДНЯ';
            if (btn) btn.classList.toggle('opacity-60', !!opened);
        }

        function openDailyChest() {
            checkDailyChest();
            const body = document.getElementById('dailyChestBody');

            if (playerData.dailyChest.opened) {
                body.innerHTML = `
                    <div class="text-4xl">📭</div>
                    <p class="text-slate-300">Сундук на сегодня уже открыт.</p>
                    <p class="text-[10px] text-slate-500">Новый сундук — завтра.</p>
                    <button onclick="closeModal('dailyChestModal')" class="btn-green-glow py-2.5 w-full rounded-lg font-military text-xs uppercase mt-1">ЗАКРЫТЬ</button>
                `;
                openModal('dailyChestModal');
                return;
            }

            body.innerHTML = `
                <div class="text-5xl animate-bounce">🎁</div>
                <p class="text-slate-300">Один сундук в сутки — бесплатная награда!</p>
                <button onclick="claimDailyChest()" class="btn-amber-glow py-3 w-full rounded-lg font-military text-sm uppercase">ОТКРЫТЬ</button>
            `;
            openModal('dailyChestModal');
        }

        function claimDailyChest() {
            const pool = DAILY_CHEST_REWARDS;
            const totalWeight = pool.reduce((s, r) => s + r.weight, 0);
            let roll = Math.random() * totalWeight;
            let reward = pool[0];
            for (const r of pool) {
                if (roll < r.weight) { reward = r; break; }
                roll -= r.weight;
            }

            let rewardText;
            if (reward.type === 'tokens') {
                const amount = Math.floor(reward.min + Math.random() * (reward.max - reward.min + 1));
                playerData.tokens += amount;
                playerData.stats.totalTokensEarned = (playerData.stats.totalTokensEarned || 0) + amount;
                rewardText = reward.label(amount);
            } else {
                playerData.inventory[reward.type] = (playerData.inventory[reward.type] || 0) + reward.amount;
                rewardText = reward.label();
            }

            playerData.dailyChest.opened = true;
            savePlayerData();

            playSound('correct');
            spawnFireworks();
            hapticFeedback([30, 30, 30]);
            updateDailyChestButtonUI();

            const body = document.getElementById('dailyChestBody');
            body.innerHTML = `
                <div class="text-5xl">🏅</div>
                <p class="text-amber-300 font-military text-sm">${rewardText}</p>
                <p class="text-[10px] text-slate-500">Новый сундук — завтра.</p>
                <button onclick="closeModal('dailyChestModal')" class="btn-green-glow py-2.5 w-full rounded-lg font-military text-xs uppercase mt-1">ЗАКРЫТЬ</button>
            `;
        }

        // --- ONBOARDING (shown once on a brand-new profile) ---
        const ONBOARDING_STEPS = [
            {
                icon: '🛡️',
                title: 'ДОБРО ПОЖАЛОВАТЬ, КУРСАНТ!',
                text: '«Знания — Сила» — тренажёр по военной подготовке. Отвечай на вопросы, зарабатывай опыт (XP) и жетоны 🪖, расти в звании.'
            },
            {
                icon: '🎒',
                title: 'ЖЕТОНЫ И СНАРЯЖЕНИЕ',
                text: 'За жетоны покупай скины и подсказки (50/50, +10 секунд) в «Снабжении». Подсказки помогают в трудных вопросах.'
            },
            {
                icon: '🔥',
                title: 'ЗАХОДИ КАЖДЫЙ ДЕНЬ',
                text: 'Вопрос дня, Сундук и Серия дают бонусы за ежедневную активность. Пропустишь день — серия прервётся (если нет заморозки)!'
            },
            {
                icon: '📖',
                title: 'УЧИСЬ БЕЗ СПЕШКИ',
                text: 'В «Учебном режиме» нет таймера и штрафов. «Работа над ошибками» повторяет то, где ты ошибся. Удачи, боец!'
            }
        ];

        let onboardingStepIndex = 0;

        function renderOnboardingStep() {
            const step = ONBOARDING_STEPS[onboardingStepIndex];
            const body = document.getElementById('onboardingBody');
            body.innerHTML = `
                <div class="text-5xl">${step.icon}</div>
                <div class="font-military text-sm text-lime-400 uppercase">${step.title}</div>
                <p class="text-slate-300 leading-snug">${step.text}</p>
            `;

            const dotsEl = document.getElementById('onboardingDots');
            dotsEl.innerHTML = ONBOARDING_STEPS.map((_, i) =>
                `<span class="w-1.5 h-1.5 rounded-full ${i === onboardingStepIndex ? 'bg-lime-400' : 'bg-slate-700'}"></span>`
            ).join('');

            const nextBtn = document.getElementById('onboardingNextBtn');
            const isLast = onboardingStepIndex === ONBOARDING_STEPS.length - 1;
            nextBtn.innerHTML = isLast ? 'НАЧАТЬ СЛУЖБУ ▶' : 'ДАЛЕЕ ▶';
        }

        function showOnboarding() {
            onboardingStepIndex = 0;
            renderOnboardingStep();
            openModal('onboardingModal');
        }

        function onboardingNext() {
            playSound('click');
            if (onboardingStepIndex < ONBOARDING_STEPS.length - 1) {
                onboardingStepIndex++;
                renderOnboardingStep();
            } else {
                skipOnboarding();
            }
        }

        function skipOnboarding() {
            playSound('click');
            playerData.onboardingSeen = true;
            savePlayerData();
            closeModal('onboardingModal');
        }

        // --- MISTAKE TRACKING & PRACTICE MODES (no timer, no rewards, doesn't touch quests/streak) ---
        // null = normal battle, 'review' = missed-questions drill, 'study' = untimed practice by discipline/difficulty.
        let practiceMode = null;

        // --- PER-DISCIPLINE ACCURACY (drives the profile breakdown and the "weak discipline" hint) ---
        function recordDisciplineStat(category, isCorrect, topic) {
            if (!playerData.disciplineStats) playerData.disciplineStats = {};
            if (!playerData.disciplineStats[category]) playerData.disciplineStats[category] = { correct: 0, total: 0 };
            playerData.disciplineStats[category].total++;
            if (isCorrect) playerData.disciplineStats[category].correct++;

            if (!topic) return;
            if (!playerData.topicStats) playerData.topicStats = {};
            if (!playerData.topicStats[category]) playerData.topicStats[category] = {};
            if (!playerData.topicStats[category][topic]) playerData.topicStats[category][topic] = { correct: 0, total: 0 };
            playerData.topicStats[category][topic].total++;
            if (isCorrect) playerData.topicStats[category][topic].correct++;
        }

        // --- SPACED REPETITION (mini-SRS) for missed questions ---
        // Each entry is { id, stage, dueDate }. A miss resets the question to stage 0 (due tomorrow).
        // A correct answer advances it to the next interval; passing the last interval (14 days)
        // correctly removes it from the queue entirely — the question counts as mastered.
        const SRS_INTERVALS_DAYS = [1, 3, 7, 14];

        function addDaysToDateStr(dateStr, days) {
            const d = new Date(dateStr + 'T00:00:00');
            d.setDate(d.getDate() + days);
            return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        }

        function recordMistake(q) {
            if (!Array.isArray(playerData.missedQuestions)) playerData.missedQuestions = [];
            const dueDate = addDaysToDateStr(getTodayDateStr(), SRS_INTERVALS_DAYS[0]);
            const existing = playerData.missedQuestions.find(m => m.id === q.id);
            if (existing) {
                existing.stage = 0;
                existing.dueDate = dueDate;
            } else {
                playerData.missedQuestions.push({ id: q.id, stage: 0, dueDate });
            }
        }

        function clearMistake(q) {
            if (!Array.isArray(playerData.missedQuestions)) return;
            const entry = playerData.missedQuestions.find(m => m.id === q.id);
            if (!entry) return;
            if (entry.stage >= SRS_INTERVALS_DAYS.length - 1) {
                // Passed the final (14-day) interval correctly — treat as mastered, drop from the queue.
                playerData.missedQuestions = playerData.missedQuestions.filter(m => m.id !== q.id);
            } else {
                entry.stage += 1;
                entry.dueDate = addDaysToDateStr(getTodayDateStr(), SRS_INTERVALS_DAYS[entry.stage]);
            }
        }

        function getDueMissedQuestions() {
            const today = getTodayDateStr();
            return (playerData.missedQuestions || []).filter(m => m.dueDate <= today);
        }

        function updateReviewButtonUI() {
            const label = document.getElementById('btnReviewMistakesLabel');
            const btn = document.getElementById('btnReviewMistakes');
            const dueCount = getDueMissedQuestions().length;
            const totalCount = (playerData.missedQuestions || []).length;
            if (label) label.innerText = dueCount > 0 ? `ОШИБКИ (${dueCount})` : (totalCount > 0 ? `ОШИБКИ (0 из ${totalCount})` : 'ОШИБКИ (0)');
            if (btn) btn.classList.toggle('opacity-50', dueCount === 0);
        }

        function startReviewQuiz() {
            const due = getDueMissedQuestions();
            if (due.length === 0) {
                playSound('wrong');
                const total = (playerData.missedQuestions || []).length;
                showFloatingText(total > 0 ? 'СЛЕДУЮЩЕЕ ПОВТОРЕНИЕ ЕЩЁ НЕ ПОДОШЛО' : 'НЕТ ОШИБОК ДЛЯ ПОВТОРЕНИЯ', window.innerWidth / 2 - 130, window.innerHeight / 2, '#f59e0b');
                return;
            }
            playSound('click');
            battleDisciplineBreakdown = {};
            battleTopicBreakdown = {};

            practiceMode = 'review';
            gameMode = 'solo';
            currentQuestions = due.map(m => ALL_QUESTIONS.find(q => q.id === m.id)).filter(Boolean);
            currentQuestions.sort(() => Math.random() - 0.5);

            currentQIndex = 0;
            score = 0;
            scoreP2 = 0;
            comboStreak = 0;
            maxCombo = 0;
            correctCount = 0;
            bossHp = 100;

            showQuestionScreen();
        }

        // Untimed practice through the currently selected discipline/topic/difficulty — no rewards,
        // no effect on quests or streak, purely for learning. Entered via customTrainingModal (or
        // the weak-spot recovery flow further down, which bypasses this and builds its own pool).
        function startStudyQuiz() {
            playSound('click');
            closeModal('customTrainingModal');
            battleDisciplineBreakdown = {};
            battleTopicBreakdown = {};

            let pool = selectedDiscipline === 'all'
                ? [...ALL_QUESTIONS]
                : ALL_QUESTIONS.filter(q => q.category === selectedDiscipline);

            if (selectedTopic !== 'all') {
                const byTopic = pool.filter(q => q.topic === selectedTopic);
                if (byTopic.length > 0) pool = byTopic;
            }

            if (selectedDifficulty !== 'all') {
                const byDifficulty = pool.filter(q => q.difficulty === selectedDifficulty);
                if (byDifficulty.length > 0) pool = byDifficulty;
            }

            if (pool.length === 0) pool = [...ALL_QUESTIONS];
            pool.sort(() => Math.random() - 0.5);

            practiceMode = 'study';
            gameMode = 'solo';
            currentQuestions = pool.slice(0, selectedQuestionCount);

            currentQIndex = 0;
            score = 0;
            scoreP2 = 0;
            comboStreak = 0;
            maxCombo = 0;
            correctCount = 0;
            bossHp = 100;

            showQuestionScreen();
        }

        // --- CUSTOM TRAINING MODAL ---
        function renderTrainingTopicOptions() {
            const wrap = document.getElementById('trainingTopicWrap');
            const select = document.getElementById('trainingTopic');
            if (!wrap || !select) return;

            const topics = selectedDiscipline === 'all'
                ? []
                : Array.from(new Set(ALL_QUESTIONS.filter(q => q.category === selectedDiscipline).map(q => q.topic).filter(Boolean)));

            if (topics.length === 0) {
                wrap.classList.add('hidden');
                selectedTopic = 'all';
                return;
            }

            wrap.classList.remove('hidden');
            select.innerHTML = '<option value="all">Все темы</option>' +
                topics.map(t => `<option value="${t}">${t}</option>`).join('');
            select.value = topics.includes(selectedTopic) ? selectedTopic : 'all';
            selectedTopic = select.value;
        }

        function setTrainingDiscipline(disc) {
            selectedDiscipline = disc;
            selectedTopic = 'all';
            renderTrainingTopicOptions();
        }

        function toggleStudyTimer() {
            studyTimerEnabled = !studyTimerEnabled;
            document.getElementById('toggleStudyTimer').classList.toggle('on', studyTimerEnabled);
            playSound('click');
        }

        function toggleStudyExplanations() {
            studyExplanationsEnabled = !studyExplanationsEnabled;
            document.getElementById('toggleStudyExplanations').classList.toggle('on', studyExplanationsEnabled);
            playSound('click');
        }

        function openCustomTrainingModal() {
            document.getElementById('trainingDiscipline').value = selectedDiscipline;
            renderTrainingTopicOptions();
            document.getElementById('trainingDifficulty').value = selectedDifficulty;
            document.getElementById('trainingCount').value = String(selectedQuestionCount);
            document.getElementById('toggleStudyTimer').classList.toggle('on', studyTimerEnabled);
            document.getElementById('toggleStudyExplanations').classList.toggle('on', studyExplanationsEnabled);

            const banner = document.getElementById('trainingWeakSpotBanner');
            if (banner) banner.classList.add('hidden');

            openModal('customTrainingModal');
            playSound('click');
        }

        function finishPracticeQuiz() {
            const mode = practiceMode;
            practiceMode = null;
            showScreen('screenResults');

            const totalQuestions = currentQuestions.length;
            const accuracy = totalQuestions > 0 ? Math.min(100, Math.round((correctCount / totalQuestions) * 100)) : 0;

            document.getElementById('resScore').innerText = score;
            document.getElementById('resAccuracy').innerText = `${accuracy}%`;
            document.getElementById('resCorrect').innerText = `${correctCount}/${totalQuestions}`;
            document.getElementById('resMaxCombo').innerText = `x${maxCombo}`;
            document.getElementById('earnedTokens').innerText = 0;
            document.getElementById('earnedXp').innerText = 0;
            document.getElementById('streakBanner').classList.add('hidden');

            document.getElementById('rankIcon').innerText = mode === 'review' ? '📖' : '🎓';
            document.getElementById('rankTitle').innerText = mode === 'review' ? 'ПОВТОРЕНИЕ ЗАВЕРШЕНО' : 'ЗАНЯТИЕ ЗАВЕРШЕНО';

            if (accuracy >= 70) spawnFireworks();
            updateReviewButtonUI();
        }

        function renderQuestsUI() {
            const container = document.getElementById('questsContainer');
            if (!container) return;
            container.innerHTML = '';

            playerData.quests.forEach(q => {
                const claimable = q.done && !q.claimed;
                const box = document.createElement('div');
                box.className = `p-3 rounded-xl border flex items-center justify-between ${
                    claimable ? 'bg-amber-950/40 border-amber-500/60' :
                    q.done ? 'bg-indigo-950/50 border-indigo-500/40' : 'bg-slate-950/80 border-slate-800'
                }`;

                let rightHtml;
                if (claimable) {
                    rightHtml = `<button onclick="claimQuestReward('${q.id}')" class="btn-amber-glow px-2.5 py-1.5 rounded-lg font-military text-[10px] uppercase animate-combo">🎁 ЗАБРАТЬ +${q.reward}</button>`;
                } else if (q.claimed) {
                    rightHtml = '<span class="text-xs text-lime-400 font-bold">ПОЛУЧЕНО ✓</span>';
                } else {
                    rightHtml = `<span class="text-xs bg-amber-950 text-amber-300 px-2 py-1 rounded border border-amber-500/40">+${q.reward} 🪖</span>`;
                }

                box.innerHTML = `
                    <div>
                        <div class="font-military text-slate-200">${q.text}</div>
                        <div class="text-[10px] text-indigo-300">Прогресс: ${q.current} / ${q.target}</div>
                    </div>
                    <div>${rightHtml}</div>
                `;
                container.appendChild(box);
            });
        }

        // Monday-anchored week bucket key for a given Date, used to group gameHistory entries.
        function getWeekStartDate(d) {
            const date = new Date(d);
            const day = date.getDay(); // 0 = Sunday
            const diff = (day === 0 ? 6 : day - 1);
            date.setDate(date.getDate() - diff);
            date.setHours(0, 0, 0, 0);
            return date;
        }

        function renderProgressChart() {
            const box = document.getElementById('progressChartBox');
            if (!box) return;

            const history = playerData.gameHistory || [];
            if (history.length === 0) {
                box.innerHTML = '<div class="text-[10px] text-slate-500 font-mono py-4 text-center">Сыграйте несколько боёв, чтобы увидеть свой прогресс здесь.</div>';
                return;
            }

            const WEEKS = 8;
            const todayWeekStart = getWeekStartDate(new Date());
            const buckets = [];
            for (let i = WEEKS - 1; i >= 0; i--) {
                const ws = new Date(todayWeekStart);
                ws.setDate(ws.getDate() - i * 7);
                buckets.push({ weekStart: ws, sum: 0, count: 0 });
            }

            history.forEach(rec => {
                const recWeekStart = getWeekStartDate(new Date(rec.date + 'T00:00:00'));
                const bucket = buckets.find(b => b.weekStart.getTime() === recWeekStart.getTime());
                if (bucket) {
                    bucket.sum += rec.accuracy;
                    bucket.count++;
                }
            });

            const W = 300, H = 110, padBottom = 18, padTop = 12;
            const barGap = 6;
            const barWidth = (W - barGap * (WEEKS - 1)) / WEEKS;
            const chartH = H - padBottom - padTop;

            let bars = '';
            buckets.forEach((b, i) => {
                const x = i * (barWidth + barGap);
                const avg = b.count > 0 ? Math.round(b.sum / b.count) : null;
                const barH = avg !== null ? Math.max(2, (avg / 100) * chartH) : 0;
                const y = H - padBottom - barH;
                const label = `${String(b.weekStart.getDate()).padStart(2, '0')}.${String(b.weekStart.getMonth() + 1).padStart(2, '0')}`;

                if (avg !== null) {
                    bars += `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${barWidth.toFixed(1)}" height="${barH.toFixed(1)}" rx="2" fill="#84cc16" opacity="0.9"/>`;
                    bars += `<text x="${(x + barWidth / 2).toFixed(1)}" y="${Math.max(9, y - 3).toFixed(1)}" font-size="9" text-anchor="middle" fill="#d9f99d" font-family="monospace">${avg}%</text>`;
                } else {
                    bars += `<rect x="${x.toFixed(1)}" y="${(H - padBottom - 2).toFixed(1)}" width="${barWidth.toFixed(1)}" height="2" fill="#334155"/>`;
                }
                bars += `<text x="${(x + barWidth / 2).toFixed(1)}" y="${H - 4}" font-size="8" text-anchor="middle" fill="#64748b" font-family="monospace">${label}</text>`;
            });

            bars += `<line x1="0" y1="${(H - padBottom).toFixed(1)}" x2="${W}" y2="${(H - padBottom).toFixed(1)}" stroke="#334155" stroke-width="1"/>`;

            box.innerHTML = `<svg viewBox="0 0 ${W} ${H}" width="100%" height="${H}" xmlns="http://www.w3.org/2000/svg">${bars}</svg>`;
        }

        function renderFramePicker() {
            const wrap = document.getElementById('framePickerBox');
            const row = document.getElementById('framePickerRow');
            if (!wrap || !row) return;

            const unlocked = playerData.unlockedFrames || ['none'];
            if (unlocked.length <= 1) {
                wrap.classList.add('hidden');
                return;
            }
            wrap.classList.remove('hidden');
            row.innerHTML = '';
            unlocked.forEach(frameId => {
                const frame = PROFILE_FRAMES.find(f => f.id === frameId);
                if (!frame) return;
                const isActive = (playerData.activeFrame || 'none') === frameId;
                const swatch = document.createElement('button');
                swatch.onclick = () => selectProfileFrame(frameId);
                swatch.className = `w-8 h-8 rounded-lg bg-slate-900 flex items-center justify-center text-[8px] font-mono ${isActive ? 'ring-2 ring-lime-400' : ''}`;
                swatch.style.cssText = frame.style || 'border: 1px solid #475569;';
                swatch.title = frame.name;
                swatch.innerText = frame.id === 'none' ? '∅' : '';
                row.appendChild(swatch);
            });
        }

        function selectProfileFrame(frameId) {
            if (!(playerData.unlockedFrames || []).includes(frameId)) return;
            playerData.activeFrame = frameId;
            savePlayerData();
            renderFramePicker();
            playSound('click');
        }

        // Shared by the profile breakdown and the post-battle "Разбор боя" card so both agree on
        // what counts as a weak spot: lowest accuracy among disciplines with enough of a sample.
        function getWeakestDiscipline(minSample, threshold) {
            minSample = minSample || 5;
            threshold = threshold === undefined ? 75 : threshold;
            const rows = Object.keys(DISCIPLINE_LABELS).map(cat => {
                const s = playerData.disciplineStats && playerData.disciplineStats[cat];
                const total = s ? s.total : 0;
                const pct = total > 0 ? (s.correct / total) * 100 : null;
                return { cat, label: DISCIPLINE_LABELS[cat], pct, total };
            }).filter(r => r.total >= minSample);
            rows.sort((a, b) => a.pct - b.pct);
            return (rows.length > 0 && rows[0].pct < threshold) ? rows[0] : null;
        }

        // Same idea one level deeper: the weakest topic inside a single discipline, using all-time
        // topicStats (not just the battle that just ended) so it's a stable, low-noise recommendation.
        function getWeakestTopicIn(cat, minSample, threshold) {
            minSample = minSample || 3;
            threshold = threshold === undefined ? 75 : threshold;
            const topics = (playerData.topicStats && playerData.topicStats[cat]) || {};
            const rows = Object.keys(topics).map(topic => {
                const t = topics[topic];
                return { topic, pct: (t.correct / t.total) * 100, total: t.total };
            }).filter(r => r.total >= minSample);
            rows.sort((a, b) => a.pct - b.pct);
            return (rows.length > 0 && rows[0].pct < threshold) ? rows[0] : null;
        }

        // Finer-grained 4-band colour used inside the topic breakdown (the discipline bar above it
        // keeps its own 3-band scheme so its look doesn't change for players who never expand it).
        function topicAccuracyColor(pct) {
            return pct >= 80 ? '#84cc16' : pct >= 65 ? '#eab308' : pct >= 50 ? '#f97316' : '#ef4444';
        }
        function topicAccuracyDot(pct) {
            return pct >= 80 ? '🟢' : pct >= 65 ? '🟡' : pct >= 50 ? '🟠' : '🔴';
        }

        // --- KNOWLEDGE REFERENCE (СПРАВОЧНИК) ---
        // Three-level browse: disciplines -> topics -> a short read-only card (see TOPIC_REFERENCE
        // in questions.js). Reached either from the main menu or via "ИЗУЧИТЬ ТЕМУ" after an answer.
        let referenceView = { level: 'disciplines', cat: null, topic: null };

        function openReferenceModal(cat, topic) {
            if (cat && topic) referenceView = { level: 'card', cat, topic };
            else if (cat) referenceView = { level: 'topics', cat, topic: null };
            else referenceView = { level: 'disciplines', cat: null, topic: null };
            renderReferenceModal();
            openModal('referenceModal');
            playSound('click');
        }

        function referenceGoTopics(cat) {
            referenceView = { level: 'topics', cat, topic: null };
            renderReferenceModal();
        }

        function referenceGoCard(cat, topic) {
            referenceView = { level: 'card', cat, topic };
            renderReferenceModal();
        }

        function referenceBack() {
            if (referenceView.level === 'card') referenceGoTopics(referenceView.cat);
            else {
                referenceView = { level: 'disciplines', cat: null, topic: null };
                renderReferenceModal();
            }
        }

        function renderReferenceModal() {
            const body = document.getElementById('referenceBody');
            const backBtn = document.getElementById('referenceBackBtn');
            const title = document.getElementById('referenceHeaderTitle');
            if (!body) return;

            if (referenceView.level === 'disciplines') {
                backBtn.classList.add('hidden');
                title.innerText = 'СПРАВОЧНИК';
                body.innerHTML = Object.keys(TOPIC_REFERENCE).map(cat => `
                    <button onclick="referenceGoTopics('${cat}')" class="w-full flex items-center justify-between py-2.5 px-3 rounded-lg bg-slate-900/80 border border-slate-800 text-left active:scale-95 transition-all">
                        <span class="text-xs font-military text-slate-200">📁 ${DISCIPLINE_LABELS[cat] || cat}</span>
                        <span class="text-slate-500 text-xs">▸</span>
                    </button>
                `).join('');
            } else if (referenceView.level === 'topics') {
                backBtn.classList.remove('hidden');
                const cat = referenceView.cat;
                title.innerText = DISCIPLINE_LABELS[cat] || cat;
                const topics = TOPIC_REFERENCE[cat] || {};
                body.innerHTML = Object.keys(topics).map(topic => `
                    <button onclick="referenceGoCard('${cat}', ${JSON.stringify(topic)})" class="w-full flex items-center justify-between py-2.5 px-3 rounded-lg bg-slate-900/80 border border-slate-800 text-left active:scale-95 transition-all">
                        <span class="text-[11px] font-mono text-slate-300">${topic}</span>
                        <span class="text-slate-500 text-xs">▸</span>
                    </button>
                `).join('');
            } else if (referenceView.level === 'card') {
                backBtn.classList.remove('hidden');
                const { cat, topic } = referenceView;
                title.innerText = topic;
                const text = (TOPIC_REFERENCE[cat] && TOPIC_REFERENCE[cat][topic]) || 'Материал по этой теме скоро появится.';
                const inRecovery = recoveryContext && recoveryContext.cat === cat && recoveryContext.topic === topic;
                const recoveryBtnHtml = inRecovery
                    ? `<button onclick="launchRecoveryQuiz()" class="btn-amber-glow w-full py-2.5 rounded-lg font-military text-xs uppercase mt-1">▶ НАЧАТЬ ВОПРОСЫ</button>`
                    : '';
                body.innerHTML = `
                    <div class="text-[9px] font-mono text-slate-500 uppercase">${DISCIPLINE_LABELS[cat] || cat}</div>
                    <p class="text-[12px] text-slate-300 leading-relaxed font-mono bg-slate-950/60 border border-slate-800 rounded-lg p-3">${text}</p>
                    ${recoveryBtnHtml}
                `;
            }
        }

        // --- WEAK-SPOT RECOVERY ---
        // Detected via the same disciplineStats/topicStats already powering the profile breakdown.
        // Flow: show the topic's reference card first, then an escalating 5 easy / 5 medium / 3 hard
        // run through that topic (falling back to the wider discipline where the topic itself is too
        // small), finishing on the normal results screen as the "mini-control" readout.
        let recoveryContext = null;

        function startWeakSpotRecovery(cat, topic) {
            recoveryContext = { cat, topic };
            openReferenceModal(cat, topic);
        }

        function buildRecoveryPool(cat, topic) {
            const targets = [['private', 5], ['sergeant', 5], ['officer', 3]];
            const usedIds = new Set();
            const result = [];
            targets.forEach(([diff, n]) => {
                let pool = ALL_QUESTIONS.filter(q => q.category === cat && q.topic === topic && q.difficulty === diff && !usedIds.has(q.id));
                if (pool.length < n) {
                    const wider = ALL_QUESTIONS.filter(q => q.category === cat && q.difficulty === diff && !usedIds.has(q.id) && q.topic !== topic);
                    pool = pool.concat(wider);
                }
                pool.sort(() => Math.random() - 0.5);
                const picked = pool.slice(0, n);
                picked.forEach(q => usedIds.add(q.id));
                result.push(...picked);
            });
            if (result.length < 13) {
                const remaining = ALL_QUESTIONS.filter(q => q.category === cat && !usedIds.has(q.id));
                remaining.sort(() => Math.random() - 0.5);
                result.push(...remaining.slice(0, 13 - result.length));
            }
            return result;
        }

        function launchRecoveryQuiz() {
            const ctx = recoveryContext;
            recoveryContext = null;
            if (!ctx) return;
            closeModal('referenceModal');
            playSound('click');

            battleDisciplineBreakdown = {};
            battleTopicBreakdown = {};
            practiceMode = 'study';
            gameMode = 'solo';
            studyTimerEnabled = false;
            studyExplanationsEnabled = true;
            currentQuestions = buildRecoveryPool(ctx.cat, ctx.topic);

            currentQIndex = 0;
            score = 0;
            scoreP2 = 0;
            comboStreak = 0;
            maxCombo = 0;
            correctCount = 0;
            bossHp = 100;

            showQuestionScreen();
        }

        // Surfaced on the main menu's "Прогресс" tab — see updateProfileUI.
        function renderWeakSpotCallout() {
            const box = document.getElementById('weakSpotCallout');
            const textEl = document.getElementById('weakSpotCalloutText');
            if (!box || !textEl) return;

            const weak = getWeakestDiscipline();
            if (!weak) { box.classList.add('hidden'); return; }
            const weakTopic = getWeakestTopicIn(weak.cat);

            if (weakTopic) {
                textEl.innerText = `${weak.label} → ${weakTopic.topic} — ${Math.round(weakTopic.pct)}%`;
                box.dataset.cat = weak.cat;
                box.dataset.topic = weakTopic.topic;
                box.classList.remove('hidden');
            } else {
                // No single topic stands out yet (too little per-topic data) — still flag the discipline.
                box.classList.add('hidden');
            }
        }

        function startWeakSpotRecoveryFromCallout() {
            const box = document.getElementById('weakSpotCallout');
            if (!box || !box.dataset.cat || !box.dataset.topic) return;
            startWeakSpotRecovery(box.dataset.cat, box.dataset.topic);
        }

        // Set right after an answer (see handleAnswer) so "ИЗУЧИТЬ ТЕМУ" knows which topic to open.
        let lastAnsweredQuestion = null;
        function openReferenceFromLastQuestion() {
            if (!lastAnsweredQuestion || !lastAnsweredQuestion.topic) return;
            openReferenceModal(lastAnsweredQuestion.category, lastAnsweredQuestion.topic);
        }

        // Which discipline rows currently have their topic list expanded — UI-only, not persisted.
        const expandedDisciplineTopics = new Set();

        function toggleDisciplineTopics(cat) {
            if (expandedDisciplineTopics.has(cat)) expandedDisciplineTopics.delete(cat);
            else expandedDisciplineTopics.add(cat);
            renderDisciplineStats();
        }

        function renderDisciplineStats() {
            const box = document.getElementById('disciplineStatsBox');
            const hintBox = document.getElementById('weakDisciplineHint');
            if (!box) return;

            const stats = playerData.disciplineStats || {};
            const topicStats = playerData.topicStats || {};
            const rows = Object.keys(DISCIPLINE_LABELS).map(cat => {
                const s = stats[cat];
                const total = s ? s.total : 0;
                const pct = total > 0 ? Math.round((s.correct / total) * 100) : null;
                const topics = Object.keys(topicStats[cat] || {}).map(topic => {
                    const t = topicStats[cat][topic];
                    return { topic, total: t.total, pct: Math.round((t.correct / t.total) * 100) };
                }).sort((a, b) => b.total - a.total);
                return { cat, label: DISCIPLINE_LABELS[cat], pct, total, topics };
            }).filter(r => r.total > 0);

            if (rows.length === 0) {
                box.innerHTML = '<div class="text-[10px] text-slate-500 py-2 text-center font-mono">Сыграйте несколько боёв, чтобы увидеть точность по дисциплинам.</div>';
                if (hintBox) hintBox.classList.add('hidden');
                return;
            }

            box.innerHTML = '';
            rows.forEach(r => {
                const isWeak = r.pct < 70 && r.total >= 5;
                const color = r.pct >= 85 ? '#84cc16' : r.pct >= 70 ? '#eab308' : '#ef4444';
                const hasTopics = r.topics.length > 0;
                const isExpanded = expandedDisciplineTopics.has(r.cat);
                const row = document.createElement('div');
                row.className = 'space-y-0.5';

                const topicRowsHtml = r.topics.map(t => `
                    <div class="flex justify-between text-[9px] font-mono pl-3">
                        <span class="text-slate-400">└ ${t.topic}</span>
                        <span style="color:${topicAccuracyColor(t.pct)}">${t.pct}% ${topicAccuracyDot(t.pct)}</span>
                    </div>
                `).join('');

                row.innerHTML = `
                    <div class="flex justify-between text-[10px] font-mono ${hasTopics ? 'cursor-pointer' : ''}" ${hasTopics ? `onclick="toggleDisciplineTopics('${r.cat}')"` : ''}>
                        <span class="text-slate-300">${hasTopics ? (isExpanded ? '▾ ' : '▸ ') : ''}${r.label}${isWeak ? ' ⚠️' : ''}</span>
                        <span style="color:${color}" class="font-bold">${r.pct}%</span>
                    </div>
                    <div class="w-full h-1.5 bg-slate-900 rounded-full overflow-hidden border border-slate-800">
                        <div style="width:${r.pct}%; background:${color};" class="h-full transition-all"></div>
                    </div>
                    ${isExpanded ? `<div class="space-y-0.5 pt-0.5">${topicRowsHtml}</div>` : ''}
                `;
                box.appendChild(row);
            });

            if (hintBox) {
                const weak = getWeakestDiscipline();
                if (weak) {
                    hintBox.classList.remove('hidden');
                    hintBox.innerText = `⚠️ Твоя слабая дисциплина — ${weak.label} (${Math.round(weak.pct)}%). Рекомендуется тренировка в Учебном режиме.`;
                } else {
                    hintBox.classList.add('hidden');
                }
            }
        }

        function renderBattleBreakdown() {
            const box = document.getElementById('battleBreakdownBox');
            const rowsEl = document.getElementById('battleBreakdownRows');
            const weakBox = document.getElementById('battleWeakSpotBox');
            if (!box) return;

            const cats = Object.keys(battleDisciplineBreakdown);
            if (cats.length === 0) {
                box.classList.add('hidden');
                return;
            }
            box.classList.remove('hidden');

            rowsEl.innerHTML = '';
            cats.forEach(cat => {
                const s = battleDisciplineBreakdown[cat];
                const pct = Math.round((s.correct / s.total) * 100);
                const isGood = pct >= 70;
                const row = document.createElement('div');
                row.className = 'space-y-0.5';

                const topics = battleTopicBreakdown[cat] || {};
                const topicRowsHtml = Object.keys(topics).map(topic => {
                    const t = topics[topic];
                    const tpct = Math.round((t.correct / t.total) * 100);
                    return `
                        <div class="flex items-center justify-between text-[10px] font-mono pl-3">
                            <span class="text-slate-500">└ ${topic}</span>
                            <span style="color:${topicAccuracyColor(tpct)}">${t.correct}/${t.total} ${topicAccuracyDot(tpct)}</span>
                        </div>
                    `;
                }).join('');

                row.innerHTML = `
                    <div class="flex items-center justify-between text-[11px] font-mono">
                        <span class="text-slate-300">${DISCIPLINE_LABELS[cat] || cat}</span>
                        <span class="${isGood ? 'text-lime-400' : 'text-red-400'} font-bold">${s.correct}/${s.total} ${isGood ? '🟢' : '🔴'}</span>
                    </div>
                    ${topicRowsHtml}
                `;
                rowsEl.appendChild(row);
            });

            const weak = getWeakestDiscipline();
            if (weak) {
                const weakTopic = getWeakestTopicIn(weak.cat);
                const topicSuffix = weakTopic ? ` — особенно тема «${weakTopic.topic}» (${Math.round(weakTopic.pct)}%)` : '';
                weakBox.classList.remove('hidden');
                weakBox.innerHTML = `
                    <div class="text-amber-400 font-military text-xs">⚠️ Слабое место: ${weak.label} — ${Math.round(weak.pct)}%${topicSuffix}</div>
                    <button onclick="trainWeakDiscipline('${weak.cat}')" class="btn-amber-glow py-2 px-4 rounded-lg font-military text-[11px] uppercase">ТРЕНИРОВАТЬ СЛАБОЕ МЕСТО</button>
                `;
            } else {
                weakBox.classList.add('hidden');
            }
        }

        function trainWeakDiscipline(cat) {
            selectedDiscipline = cat;
            selectedDifficulty = 'all';
            startStudyQuiz();
        }

        function renderAchievementsInProfile() {
            const container = document.getElementById('profileAchievementsContainer');
            if (!container) return;
            container.innerHTML = '';

            playerData.quests.forEach(q => {
                const item = document.createElement('div');
                item.className = "flex items-center justify-between p-2 rounded bg-slate-900/80 border border-slate-800 text-[11px]";
                item.innerHTML = `
                    <div class="flex items-center space-x-2">
                        <span>${q.done ? '🏅' : '🔒'}</span>
                        <span class="${q.done ? 'text-lime-300' : 'text-slate-500'} font-military">${q.text}</span>
                    </div>
                    <span class="${q.done ? 'text-lime-400 font-bold' : 'text-slate-600'}">${q.done ? 'ВЫПОЛНЕНО' : `${q.current}/${q.target}`}</span>
                `;
                container.appendChild(item);
            });
        }

        // --- FRIENDS LEADERBOARD (local-only stub — real sync comes with a backend later) ---
        function renderFriendsLeaderboard() {
            const container = document.getElementById('friendsLeaderboardContainer');
            if (!container) return;

            const entries = [
                {
                    name: `${playerData.callsign} (ВЫ)`,
                    xp: playerData.xp,
                    avatar: playerData.photo ? null : playerData.avatar,
                    photo: playerData.photo,
                    isSelf: true,
                    id: null
                },
                ...playerData.friends.map(f => ({ name: f.name, xp: f.xp, avatar: '🎖️', photo: null, isSelf: false, id: f.id }))
            ].sort((a, b) => b.xp - a.xp);

            container.innerHTML = '';
            entries.forEach((entry, idx) => {
                const rankInfo = getRankInfo(entry.xp);
                const medal = idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : `#${idx + 1}`;

                const row = document.createElement('div');
                row.className = `flex items-center justify-between p-2 rounded-lg border ${
                    entry.isSelf ? 'bg-lime-950/50 border-lime-500/50' : 'bg-slate-900/70 border-slate-800'
                }`;

                const avatarHtml = entry.photo
                    ? `<img src="${entry.photo}" class="w-7 h-7 object-cover rounded shrink-0" alt="avatar">`
                    : `<span class="text-lg shrink-0">${entry.avatar}</span>`;

                row.innerHTML = `
                    <div class="flex items-center space-x-2 min-w-0">
                        <span class="w-6 text-center shrink-0">${medal}</span>
                        ${avatarHtml}
                        <div class="min-w-0">
                            <div class="truncate ${entry.isSelf ? 'text-lime-300' : 'text-slate-200'} font-military text-[11px]">${entry.name}</div>
                            <div class="text-[9px] text-amber-400">${rankInfo.icon} ${rankInfo.title}</div>
                        </div>
                    </div>
                    <div class="flex items-center space-x-1.5 shrink-0">
                        <span class="text-[10px] text-slate-400">${entry.xp} XP</span>
                        ${entry.id ? `<button onclick="removeFriend('${entry.id}')" class="text-red-400 text-[10px] px-1">✖</button>` : ''}
                    </div>
                `;
                container.appendChild(row);
            });
        }

        function addFriend() {
            const nameInput = document.getElementById('inputFriendName');
            const scoreInput = document.getElementById('inputFriendScore');
            const name = (nameInput.value || '').trim().slice(0, 18);
            const xp = Math.max(0, parseInt(scoreInput.value) || 0);

            if (!name) {
                playSound('wrong');
                return;
            }

            playerData.friends.push({ id: 'f_' + Date.now(), name, xp });
            savePlayerData();
            renderFriendsLeaderboard();
            playSound('correct');

            nameInput.value = '';
            scoreInput.value = '';
        }

        function removeFriend(id) {
            playerData.friends = playerData.friends.filter(f => f.id !== id);
            savePlayerData();
            renderFriendsLeaderboard();
            playSound('click');
        }

        function updateQuestProgress(questId, amount = 1) {
            const q = playerData.quests.find(item => item.id === questId);
            if (q && !q.done) {
                q.current += amount;
                if (q.current >= q.target) {
                    q.done = true;
                    playerData.hasUnseenQuestReward = true;
                    showFloatingText(`ЗАДАНИЕ ВЫПОЛНЕНО! Заберите награду`, window.innerWidth / 2 - 100, window.innerHeight / 2, '#818cf8');
                    playSound('correct');
                    spawnFireworks();
                    updateQuestPingIndicator();
                }
                savePlayerData();
            }
        }

        // Player must manually claim the reward for a completed quest
        function claimQuestReward(questId) {
            const q = playerData.quests.find(item => item.id === questId);
            if (!q || !q.done || q.claimed) return;

            q.claimed = true;
            playerData.tokens += q.reward;
            playerData.stats.totalTokensEarned = (playerData.stats.totalTokensEarned || 0) + q.reward;
            savePlayerData();

            playSound('correct');
            spawnFireworks();
            showFloatingText(`+${q.reward} 🪖 НАГРАДА ЗАБРАНА!`, window.innerWidth / 2 - 90, window.innerHeight / 2, '#84cc16');
            hapticFeedback([30, 30, 30]);

            renderQuestsUI();
            const stillHasUnclaimed = playerData.quests.some(item => item.done && !item.claimed);
            playerData.hasUnseenQuestReward = stillHasUnclaimed;
            savePlayerData();
            updateQuestPingIndicator();
        }

        function updateQuestPingIndicator() {
            const dot = document.getElementById('questPingDot');
            const dotStatic = document.getElementById('questPingDotStatic');
            if (!dot || !dotStatic) return;
            const hasUnclaimed = playerData.quests.some(q => q.done && !q.claimed) ||
                (playerData.dailyQuests && Array.isArray(playerData.dailyQuests.list) && playerData.dailyQuests.list.some(q => q.done && !q.claimed));
            if (hasUnclaimed) {
                dot.classList.remove('hidden');
                dotStatic.classList.remove('hidden');
            } else {
                dot.classList.add('hidden');
                dotStatic.classList.add('hidden');
            }
        }

        // Simple mobile haptic feedback wrapper, respects the player's setting
        function hapticFeedback(pattern) {
            if (playerData.settings && playerData.settings.haptic && navigator.vibrate) {
                try { navigator.vibrate(pattern); } catch(e) {}
            }
        }

        // Main-menu tab switcher — keeps the entry screen from showing every button at once.
        function setMenuTab(tab) {
            const tabs = { play: 'menuTabPlay', progress: 'menuTabProgress', more: 'menuTabMore' };
            Object.keys(tabs).forEach(key => {
                const panel = document.getElementById(tabs[key]);
                const btn = document.getElementById('menuTabBtn' + key.charAt(0).toUpperCase() + key.slice(1));
                if (panel) panel.classList.toggle('hidden', key !== tab);
                if (btn) btn.classList.toggle('active', key === tab);
            });
            playSound('click');
        }

        function showScreen(screenId) {
            playSound('click');
            const screens = ['screenMenu', 'screenSetup', 'screenQuiz', 'screenResults'];
            screens.forEach(id => {
                const el = document.getElementById(id);
                if (el) el.classList.add('hidden');
            });
            const target = document.getElementById(screenId);
            if (target) {
                target.classList.remove('hidden');
                target.classList.remove('screen-deploy');
                // Force reflow so the animation replays every time the screen is shown
                void target.offsetWidth;
                target.classList.add('screen-deploy');
            }
        }

        function selectGameMode(mode) {
            gameMode = mode;
            playSound('click');

            const mSolo = document.getElementById('modeSolo');
            const mBoss = document.getElementById('modeBoss');
            const mPvp = document.getElementById('modePvp');

            [mSolo, mBoss, mPvp].forEach(el => {
                if (el) el.className = "cursor-pointer border border-slate-700 bg-slate-900/60 p-2 rounded-lg flex flex-col items-center justify-center text-center space-y-1 active:scale-95 transition-all";
            });

            if (mode === 'solo') {
                if (mSolo) mSolo.className = "cursor-pointer border-2 border-lime-500 bg-lime-950/60 p-2 rounded-lg flex flex-col items-center justify-center text-center space-y-1 active:scale-95 transition-all";
            } else if (mode === 'boss') {
                if (mBoss) mBoss.className = "cursor-pointer border-2 border-purple-500 bg-purple-950/80 p-2 rounded-lg flex flex-col items-center justify-center text-center space-y-1 active:scale-95 transition-all";
            } else if (mode === 'pvp') {
                if (mPvp) mPvp.className = "cursor-pointer border-2 border-red-500 bg-red-950/60 p-2 rounded-lg flex flex-col items-center justify-center text-center space-y-1 active:scale-95 transition-all";
            }
        }

        function setDiscipline(disc) {
            selectedDiscipline = disc;
            playSound('click');

            const buttons = document.querySelectorAll('.setup-disc-btn');
            buttons.forEach(btn => {
                if (btn.getAttribute('data-disc') === disc) {
                    btn.className = "setup-disc-btn border-2 border-amber-500 bg-amber-950/40 py-2 px-2 rounded-lg font-military text-amber-300 flex items-center justify-start space-x-2 active:scale-95 transition-all";
                } else {
                    btn.className = "setup-disc-btn border border-slate-700 bg-slate-900/60 py-2 px-2 rounded-lg font-military text-slate-300 flex items-center justify-start space-x-2 active:scale-95 transition-all";
                }
            });
        }

        function setDifficulty(diff) {
            selectedDifficulty = diff;
            playSound('click');

            const buttons = document.querySelectorAll('.setup-diff-btn');
            buttons.forEach(btn => {
                if (btn.getAttribute('data-diff') === diff) {
                    btn.className = "setup-diff-btn border-2 border-amber-500 bg-amber-950/40 py-2 px-1 rounded-lg font-military text-amber-300 flex flex-col items-center justify-center space-y-0.5 active:scale-95 transition-all";
                } else {
                    btn.className = "setup-diff-btn border border-slate-700 bg-slate-900/60 py-2 px-1 rounded-lg font-military text-slate-300 flex flex-col items-center justify-center space-y-0.5 active:scale-95 transition-all";
                }
            });
        }

        const QUIZ_LENGTH = 10;

        // The boss ("ГЕНЕРАЛ-ЭКЗАМЕНАТОР") draws more questions from disciplines/topics the player
        // is weak in, instead of a flat random pool — so it acts as a real final check on genuine
        // gaps rather than just another quiz. Disciplines/topics with too little data (or none)
        // get a neutral mid-range weight so they still show up without dominating the fight.
        function buildAdaptiveBossPool(discipline, difficulty, length) {
            const MIN_SAMPLE = 3;
            const NEUTRAL_WEIGHT = 45;
            const categories = discipline === 'all' ? Object.keys(DISCIPLINE_LABELS) : [discipline];

            const buckets = [];
            categories.forEach(cat => {
                const topicsInCat = new Set(ALL_QUESTIONS.filter(q => q.category === cat).map(q => q.topic).filter(Boolean));
                if (topicsInCat.size === 0) {
                    const s = playerData.disciplineStats && playerData.disciplineStats[cat];
                    const acc = (s && s.total >= MIN_SAMPLE) ? (s.correct / s.total) * 100 : NEUTRAL_WEIGHT;
                    buckets.push({ cat, topic: null, weight: Math.max(5, 100 - acc) });
                } else {
                    topicsInCat.forEach(topic => {
                        const s = playerData.topicStats && playerData.topicStats[cat] && playerData.topicStats[cat][topic];
                        const acc = (s && s.total >= MIN_SAMPLE) ? (s.correct / s.total) * 100 : NEUTRAL_WEIGHT;
                        buckets.push({ cat, topic, weight: Math.max(5, 100 - acc) });
                    });
                }
            });

            const pickedIds = new Set();
            const result = [];

            for (let i = 0; i < length && buckets.length > 0; i++) {
                const totalWeight = buckets.reduce((sum, b) => sum + b.weight, 0);
                const roll = Math.random() * totalWeight;
                let acc = 0, chosenIdx = buckets.length - 1;
                for (let j = 0; j < buckets.length; j++) {
                    acc += buckets[j].weight;
                    if (roll <= acc) { chosenIdx = j; break; }
                }
                const bucket = buckets[chosenIdx];
                let candidates = ALL_QUESTIONS.filter(q =>
                    q.category === bucket.cat &&
                    (bucket.topic ? q.topic === bucket.topic : true) &&
                    (difficulty === 'all' || q.difficulty === difficulty) &&
                    !pickedIds.has(q.id)
                );
                if (candidates.length === 0) {
                    buckets.splice(chosenIdx, 1);
                    i--;
                    continue;
                }
                const picked = candidates[Math.floor(Math.random() * candidates.length)];
                pickedIds.add(picked.id);
                result.push(picked);
            }

            if (result.length < length) {
                const remaining = ALL_QUESTIONS.filter(q => !pickedIds.has(q.id));
                remaining.sort(() => Math.random() - 0.5);
                result.push(...remaining.slice(0, length - result.length));
            }

            return result;
        }

        function startQuiz() {
            playSound('click');
            practiceMode = null;
            activeCampaignStageIndex = null;
            battleDisciplineBreakdown = {};
            battleTopicBreakdown = {};

            let pool;
            if (gameMode === 'boss') {
                pool = buildAdaptiveBossPool(selectedDiscipline, selectedDifficulty, QUIZ_LENGTH);
            } else {
                pool = selectedDiscipline === 'all'
                    ? [...ALL_QUESTIONS]
                    : ALL_QUESTIONS.filter(q => q.category === selectedDiscipline);

                if (selectedDifficulty !== 'all') {
                    const byDifficulty = pool.filter(q => q.difficulty === selectedDifficulty);
                    if (byDifficulty.length > 0) pool = byDifficulty;
                }

                if (pool.length === 0) pool = [...ALL_QUESTIONS];
                pool.sort(() => Math.random() - 0.5);
                pool = pool.slice(0, QUIZ_LENGTH);
            }
            currentQuestions = pool;

            currentQIndex = 0;
            score = 0;
            scoreP2 = 0;
            comboStreak = 0;
            maxCombo = 0;
            correctCount = 0;
            bossHp = 100;

            playerData.stats.totalGames = (playerData.stats.totalGames || 0) + 1;
            savePlayerData();

            showQuestionScreen();
        }

        function showQuestionScreen() {
            showScreen('screenQuiz');
            const q = currentQuestions[currentQIndex];

            document.getElementById('hudQuestionProgress').innerText = `${currentQIndex + 1} / ${currentQuestions.length}`;
            if (practiceMode === 'review') {
                document.getElementById('hudDisciplineBadge').innerText = '📖 ПОВТОРЕНИЕ ОШИБОК';
            } else if (practiceMode === 'study') {
                document.getElementById('hudDisciplineBadge').innerText = `🎓 ${q.categoryName} · УЧЕБНЫЙ`;
            } else if (q.custom) {
                document.getElementById('hudDisciplineBadge').innerText = `${q.categoryName} · ✍️ ${q.authorName}`;
            } else {
                const diffLabel = { private: 'РЯДОВОЙ', sergeant: 'СЕРЖАНТ', officer: 'ОФИЦЕР' }[q.difficulty] || '';
                document.getElementById('hudDisciplineBadge').innerText = diffLabel ? `${q.categoryName} · ${diffLabel}` : q.categoryName;
            }
            document.getElementById('questionText').innerText = q.question;

            renderAvatarInto('playerAvatarDisplay');
            document.getElementById('p1ScoreNameDisplay').innerText = playerData.callsign;
            document.getElementById('p1ScoreValDisplay').innerText = `${score} б.`;

            updatePerkBadges();

            const bossContainer = document.getElementById('bossHpContainer');
            if (gameMode === 'boss') {
                bossContainer.classList.remove('hidden');
                document.getElementById('bossHpText').innerText = `${bossHp} / 100 HP`;
                document.getElementById('bossHpBar').style.width = `${bossHp}%`;
            } else {
                bossContainer.classList.add('hidden');
            }

            const comboBanner = document.getElementById('comboBanner');
            if (comboStreak >= 2) {
                comboBanner.classList.remove('hidden');
                comboBanner.innerText = `🔥 КОМБО x${comboStreak >= 3 ? '2.0' : '1.5'}`;
            } else {
                comboBanner.classList.add('hidden');
            }

            document.getElementById('explanationBox').classList.add('hidden');

            const qFrame = document.getElementById('questionCardFrame');
            qFrame.classList.remove('unit-roll-in');
            void qFrame.offsetWidth;
            qFrame.classList.add('unit-roll-in');

            const grid = document.getElementById('answersGrid');
            grid.innerHTML = '';

            currentOptionOrder = shuffleArray(q.options.map((_, i) => i));
            currentOptionOrder.forEach((origIdx, dispIdx) => {
                const btn = document.createElement('button');
                btn.className = "btn-tactical-option w-full p-3 rounded-lg text-left text-xs font-military flex items-center justify-between answer-btn cursor-pointer unit-roll-in";
                btn.style.animationDelay = `${0.06 * dispIdx}s`;
                btn.id = `answerBtn_${dispIdx}`;
                btn.onclick = (e) => handleAnswer(dispIdx, e);
                btn.innerHTML = `
                    <span class="fill-sweep"></span>
                    <span class="text-slate-100 pr-2">${q.options[origIdx]}</span>
                    <span class="text-[10px] font-mono text-slate-500 shrink-0">#${dispIdx + 1}</span>
                `;
                grid.appendChild(btn);
            });

            // Review is always untimed; study mode respects the timer toggle from customTrainingModal.
            const forceUntimed = practiceMode === 'review' || (practiceMode === 'study' && !studyTimerEnabled);
            if (forceUntimed) {
                clearInterval(timerInterval);
                const timerEl = document.getElementById('hudTimer');
                timerEl.innerText = '∞';
                timerEl.classList.remove('timer-critical');
            } else {
                startTimer();
            }
        }

        // If the player is out of a perk mid-battle, spend tokens on the spot instead of forcing a
        // trip back to the menu shop — same prices as the Armory. Returns false (and refuses) if the
        // player can't afford it either.
        const PERK_PRICES = { perk5050: 50, perkTime: 30 };

        function consumeOrBuyPerk(perkKey) {
            if ((playerData.inventory[perkKey] || 0) > 0) {
                playerData.inventory[perkKey]--;
                savePlayerData();
                return true;
            }
            const price = PERK_PRICES[perkKey];
            if (playerData.tokens < price) {
                playSound('wrong');
                showFloatingText(`НУЖНО ${price} 🪖!`, window.innerWidth / 2 - 65, window.innerHeight / 2, '#ef4444');
                return false;
            }
            playerData.tokens -= price;
            savePlayerData();
            showFloatingText(`-${price} 🪖 КУПЛЕНО`, window.innerWidth / 2 - 70, window.innerHeight / 2 - 60, '#f59e0b');
            return true;
        }

        function updatePerkBadges() {
            const b5050 = document.getElementById('badgePerk5050');
            const bTime = document.getElementById('badgePerkTime');
            const n5050 = playerData.inventory.perk5050 || 0;
            const nTime = playerData.inventory.perkTime || 0;
            if (b5050) b5050.innerText = n5050 > 0 ? n5050 : `${PERK_PRICES.perk5050}🪖`;
            if (bTime) bTime.innerText = nTime > 0 ? nTime : `${PERK_PRICES.perkTime}🪖`;
        }

        function usePerk5050() {
            if (!consumeOrBuyPerk('perk5050')) return;
            playSound('boom');

            const q = currentQuestions[currentQIndex];
            let hiddenCount = 0;
            currentOptionOrder.forEach((origIdx, dispIdx) => {
                if (origIdx !== q.correct && hiddenCount < 2) {
                    const btn = document.getElementById(`answerBtn_${dispIdx}`);
                    if (btn) {
                        btn.style.visibility = 'hidden';
                        hiddenCount++;
                    }
                }
            });

            updatePerkBadges();
        }

        function usePerkTime() {
            if (!consumeOrBuyPerk('perkTime')) return;
            playSound('correct');

            timeLeft += 10;
            document.getElementById('hudTimer').innerText = timeLeft;
            updatePerkBadges();
        }

        function handleAnswer(selectedIndex, event) {
            clearInterval(timerInterval);

            const q = currentQuestions[currentQIndex];
            const selectedOriginalIdx = currentOptionOrder[selectedIndex];
            const correctDisplayIdx = currentOptionOrder.indexOf(q.correct);
            const isCorrect = selectedOriginalIdx === q.correct;
            recordDisciplineStat(q.category, isCorrect, q.topic);
            if (!battleDisciplineBreakdown[q.category]) battleDisciplineBreakdown[q.category] = { correct: 0, total: 0 };
            battleDisciplineBreakdown[q.category].total++;
            if (isCorrect) battleDisciplineBreakdown[q.category].correct++;
            if (q.topic) {
                if (!battleTopicBreakdown[q.category]) battleTopicBreakdown[q.category] = {};
                if (!battleTopicBreakdown[q.category][q.topic]) battleTopicBreakdown[q.category][q.topic] = { correct: 0, total: 0 };
                battleTopicBreakdown[q.category][q.topic].total++;
                if (isCorrect) battleTopicBreakdown[q.category][q.topic].correct++;
            }
            const expBox = document.getElementById('explanationBox');
            const expHeader = document.getElementById('explanationHeader');
            const expText = document.getElementById('explanationText');

            const clickX = event ? event.clientX : window.innerWidth / 2;
            const clickY = event ? event.clientY : window.innerHeight / 2;

            const btns = document.querySelectorAll('.answer-btn');
            btns.forEach((btn, idx) => {
                btn.disabled = true;
                const fillEl = btn.querySelector('.fill-sweep');
                if (idx === correctDisplayIdx) {
                    btn.classList.add('locked-correct', 'border-2');
                    if (fillEl) fillEl.style.transitionDelay = idx === selectedIndex ? '0s' : '0.15s';
                } else if (idx === selectedIndex && !isCorrect) {
                    btn.classList.add('locked-wrong', 'border-2');
                } else {
                    btn.style.transition = 'opacity 0.35s ease 0.15s';
                    btn.style.opacity = '0.45';
                }
            });

            if (isCorrect) {
                correctCount++;
                comboStreak++;
                if (comboStreak > maxCombo) maxCombo = comboStreak;
                clearMistake(q);

                if (!practiceMode) {
                    if (comboStreak >= 3) updateQuestProgress('q2', 1);
                    updateDailyQuestProgress('correct', 1);
                    if (comboStreak === 2) updateDailyQuestProgress('comboX2', 1);
                    if (comboStreak >= 3) updateDailyQuestProgress('comboX3', 1);
                }

                let multiplier = comboStreak >= 3 ? 2.0 : (comboStreak === 2 ? 1.5 : 1.0);
                const pts = Math.round(10 * multiplier);
                score += pts;

                playSound('correct');
                spawnSparks(clickX, clickY);
                showFloatingText(`+${pts} БАЛЛОВ!`, clickX, clickY, '#84cc16');
                hapticFeedback([30]);

                if (gameMode === 'boss') {
                    const dmg = 20 * multiplier;
                    bossHp = Math.max(0, bossHp - dmg);
                    document.getElementById('bossHpText').innerText = `${bossHp} / 100 HP`;
                    document.getElementById('bossHpBar').style.width = `${bossHp}%`;
                    showFloatingText(`УРОН БОССУ -${dmg}!`, window.innerWidth / 2, 140, '#a855f7');

                    if (playerData.settings.screenShake) {
                        const bodyLayer = document.getElementById('bodyFxLayer');
                        bodyLayer.classList.remove('boss-impact-shake', 'flash-purple');
                        void bodyLayer.offsetWidth;
                        bodyLayer.classList.add('boss-impact-shake', 'flash-purple');
                    }
                    spawnSparks(window.innerWidth / 2, 140);

                    if (bossHp <= 0) {
                        updateQuestProgress('q3', 1);
                        updateDailyQuestProgress('bossWin', 1);
                        playerData.stats.bossesDefeated = (playerData.stats.bossesDefeated || 0) + 1;
                        spawnFireworks();
                    }
                }

                expHeader.className = "flex items-center justify-between font-military text-xs uppercase text-lime-400";
                expHeader.innerHTML = `<span><span class="mr-1">✅</span> ВЕРНО!</span><span class="text-amber-400 font-bold">+${pts} БАЛЛОВ</span>`;
            } else {
                comboStreak = 0;
                recordMistake(q);
                playSound('wrong');
                if (playerData.settings.screenShake) triggerScreenFlash();
                showFloatingText(`ПРОМАХ!`, clickX, clickY, '#ef4444');
                hapticFeedback([50, 40, 50]);

                expHeader.className = "flex items-center space-x-2 font-military text-xs uppercase text-red-400";
                expHeader.innerHTML = `<span>❌</span><span>ОШИБКА!</span>`;
            }

            if (practiceMode === 'study' && !studyExplanationsEnabled) {
                expText.classList.add('hidden');
            } else {
                expText.classList.remove('hidden');
                expText.innerText = q.explanation;
            }
            expBox.classList.remove('hidden');

            lastAnsweredQuestion = q;
            const studyBtn = document.getElementById('btnStudyTopic');
            if (studyBtn) {
                const hasTopic = q.topic && TOPIC_REFERENCE[q.category] && TOPIC_REFERENCE[q.category][q.topic];
                studyBtn.classList.toggle('hidden', !hasTopic);
            }

            document.getElementById('p1ScoreValDisplay').innerText = `${score} б.`;
            savePlayerData();

            if (playerData.settings.autoAdvance) {
                clearTimeout(autoAdvanceTimeout);
                autoAdvanceTimeout = setTimeout(() => nextQuestion(), 1800);
            }
        }

        function nextQuestion() {
            clearTimeout(autoAdvanceTimeout);
            currentQIndex++;
            if (currentQIndex < currentQuestions.length && (gameMode !== 'boss' || bossHp > 0)) {
                showQuestionScreen();
            } else {
                finishQuiz();
            }
        }

        function surrenderQuiz() {
            clearInterval(timerInterval);
            playSound('wrong');
            finishQuiz();
        }

        function finishQuiz() {
            if (practiceMode) { finishPracticeQuiz(); return; }

            showScreen('screenResults');
            updateQuestProgress('q1', 1);

            const campaignBanner = document.getElementById('campaignResultBanner');
            if (campaignBanner) campaignBanner.classList.add('hidden');
            const battleBreakdownBox = document.getElementById('battleBreakdownBox');
            if (battleBreakdownBox) battleBreakdownBox.classList.add('hidden');

            const totalQuestions = currentQuestions.length;
            const accuracy = totalQuestions > 0 ? Math.min(100, Math.round((correctCount / totalQuestions) * 100)) : 0;

            if (activeCampaignStageIndex !== null) processCampaignStageResult(accuracy);

            playerData.gameHistory.push({ date: getTodayDateStr(), accuracy, correctCount, totalQuestions });
            if (playerData.gameHistory.length > 200) playerData.gameHistory = playerData.gameHistory.slice(-200);

            checkDailyReset();
            evaluateGameEndDailyQuests(score, accuracy);
            const streakResult = updateStreak();
            const streakBonus = streakResult.creditedToday ? getStreakBonus(streakResult.current) : 0;

            // Rewards are based on actual correct answers, not the combo-inflated score,
            // so a short quiz can't out-earn a long one just from multiplier luck.
            const earnedTokens = (correctCount * 6) + (accuracy === 100 ? 15 : accuracy >= 80 ? 8 : 0) + streakBonus;
            const earnedXp = (correctCount * 12) + (maxCombo * 3);

            if (maxCombo > (playerData.maxComboEver || 0)) playerData.maxComboEver = maxCombo;

            const rankBefore = getPlayerRankInfo();

            playerData.tokens += earnedTokens;
            playerData.stats.totalTokensEarned = (playerData.stats.totalTokensEarned || 0) + earnedTokens;
            playerData.xp += earnedXp;
            playerData.level = Math.floor(playerData.xp / 100) + 1;
            savePlayerData();

            const rankAfter = getPlayerRankInfo();
            const gotPromoted = rankAfter.index > rankBefore.index;
            const rankRewardNotes = gotPromoted ? grantRankRewards(rankBefore.index, rankAfter.index) : [];

            if (accuracy >= 70 || gotPromoted) spawnFireworks();

            document.getElementById('resScore').innerText = score;
            document.getElementById('resAccuracy').innerText = `${accuracy}%`;
            document.getElementById('resCorrect').innerText = `${correctCount}/${totalQuestions}`;
            document.getElementById('resMaxCombo').innerText = `x${maxCombo}`;
            document.getElementById('earnedTokens').innerText = earnedTokens;
            document.getElementById('earnedXp').innerText = earnedXp;

            const streakBanner = document.getElementById('streakBanner');
            if (streakBanner) {
                if (streakResult.creditedToday && streakBonus > 0) {
                    const bTextEl = document.getElementById('streakBannerText');
                    const bBonusEl = document.getElementById('streakBannerBonus');
                    const freezeNote = streakResult.usedFreeze ? ' ❄️ Заморозка спасла серию!' : '';
                    if (bTextEl) bTextEl.innerText = `Серия: ${streakResult.current} ${pluralDays(streakResult.current)} подряд!${freezeNote}`;
                    if (bBonusEl) bBonusEl.innerText = `+${streakBonus} 🪖`;
                    streakBanner.classList.remove('hidden');
                } else {
                    streakBanner.classList.add('hidden');
                }
            }

            const rankIcon = document.getElementById('rankIcon');
            const rankTitle = document.getElementById('rankTitle');

            if (gotPromoted) {
                rankIcon.innerText = rankAfter.icon;
                rankTitle.innerText = `ПОВЫШЕНИЕ! ${rankAfter.title}`;
                rankIcon.classList.add('animate-combo');
                setTimeout(() => showFloatingText(`🎖️ НОВОЕ ЗВАНИЕ: ${rankAfter.title}!`, window.innerWidth / 2 - 100, window.innerHeight / 2 - 40, '#eab308'), 250);
                rankRewardNotes.forEach((note, i) => {
                    setTimeout(() => showFloatingText(note, window.innerWidth / 2 - 110, window.innerHeight / 2 + 20, '#a855f7'), 700 + i * 500);
                });
            } else if (gameMode === 'boss' && bossHp <= 0) {
                rankIcon.innerText = "⚔️";
                rankTitle.innerText = "БОСС ПОВЕРЖЕН!";
            } else if (accuracy >= 90) {
                rankIcon.innerText = "⭐️⭐️⭐️⭐️⭐️";
                rankTitle.innerText = "ОТЛИЧНЫЙ РЕЗУЛЬТАТ!";
            } else if (accuracy >= 70) {
                rankIcon.innerText = "⭐️⭐️";
                rankTitle.innerText = "ХОРОШИЙ БОЙ!";
            } else {
                rankIcon.innerText = rankAfter.icon;
                rankTitle.innerText = rankAfter.title;
            }

            checkMedals();
            renderBattleBreakdown();
        }

        // --- MINI-GAME DEFUSAL (WITH -25 TOKEN LOSS PENALTY) ---
        let safeWireIndex = 0;
        function startMiniGameDefusal() {
            safeWireIndex = Math.floor(Math.random() * 3);
            openModal('defusalModal');
        }

        function chooseWire(idx) {
            closeModal('defusalModal');
            if (idx === safeWireIndex) {
                playerData.tokens += 50;
                playerData.stats.totalTokensEarned = (playerData.stats.totalTokensEarned || 0) + 50;
                playerData.stats.defusalsWon = (playerData.stats.defusalsWon || 0) + 1;
                updateQuestProgress('q4', 1);
                updateDailyQuestProgress('defusal', 1);
                savePlayerData();
                playSound('correct');
                spawnFireworks();
                showFloatingText(`БОМБА ОБЕЗВРЕЖЕНА! +50 🪖`, window.innerWidth / 2 - 80, window.innerHeight / 2, '#84cc16');
            } else {
                // LOSS PENALTY: Deduct 25 tokens
                const penalty = 25;
                playerData.tokens = Math.max(0, playerData.tokens - penalty);
                savePlayerData();
                playSound('boom');
                triggerScreenFlash();
                showFloatingText(`ВЗРЫВ! -25 🪖 ЖЕТОНОВ`, window.innerWidth / 2 - 80, window.innerHeight / 2, '#ef4444');
            }
        }

        function showFloatingText(text, x, y, color) {
            const el = document.createElement('div');
            el.className = 'floating-text text-sm font-bold';
            el.style.left = `${x}px`;
            el.style.top = `${y}px`;
            el.style.color = color;
            el.innerText = text;
            document.body.appendChild(el);
            setTimeout(() => el.remove(), 1100);
        }

        function triggerScreenFlash() {
            const layer = document.getElementById('bodyFxLayer');
            layer.classList.add('flash-red');
            setTimeout(() => layer.classList.remove('flash-red'), 450);
        }

        // Canvas Particle FX
        const canvas = document.getElementById('vfxCanvas');
        const ctx = canvas.getContext('2d');
        let particles = [];

        function resizeCanvas() {
            canvas.width = window.innerWidth;
            canvas.height = window.innerHeight;
        }
        window.addEventListener('resize', resizeCanvas);
        resizeCanvas();

        function spawnSparks(x, y) {
            for (let i = 0; i < 20; i++) {
                particles.push({
                    x: x, y: y,
                    vx: (Math.random() - 0.5) * 8,
                    vy: (Math.random() - 0.5) * 8,
                    life: 1, color: '#84cc16'
                });
            }
        }

        function spawnFireworks() {
            for (let i = 0; i < 60; i++) {
                particles.push({
                    x: window.innerWidth / 2,
                    y: window.innerHeight / 2,
                    vx: (Math.random() - 0.5) * 14,
                    vy: (Math.random() - 0.5) * 14,
                    life: 1, color: Math.random() > 0.5 ? '#f59e0b' : '#a855f7'
                });
            }
        }

        function updateVfx() {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            particles.forEach((p, index) => {
                p.x += p.vx;
                p.y += p.vy;
                p.life -= 0.02;
                ctx.fillStyle = p.color;
                ctx.globalAlpha = Math.max(0, p.life);
                ctx.beginPath();
                ctx.arc(p.x, p.y, 3, 0, Math.PI * 2);
                ctx.fill();

                if (p.life <= 0) particles.splice(index, 1);
            });
            requestAnimationFrame(updateVfx);
        }
        requestAnimationFrame(updateVfx);

        // --- TIMER LOGIC ---
        function startTimer() {
            clearInterval(timerInterval);
            timeLeft = playerData.settings.timerDuration || 20;
            const timerEl = document.getElementById('hudTimer');
            timerEl.innerText = timeLeft;
            timerEl.classList.remove('timer-critical');

            timerInterval = setInterval(() => {
                timeLeft--;
                timerEl.innerText = timeLeft;

                if (timeLeft <= 5 && timeLeft > 0) {
                    playSound('tick');
                    timerEl.classList.add('timer-critical');
                }

                if (timeLeft <= 0) {
                    clearInterval(timerInterval);
                    timerEl.classList.remove('timer-critical');
                    handleAnswer(-1);
                }
            }, 1000);
        }

        function restartQuiz() {
            startQuiz();
        }

        // --- SHARE RESULT CARD ---
        function generateShareCardDataURL() {
            const canvas = document.createElement('canvas');
            const W = 600, H = 400;
            canvas.width = W;
            canvas.height = H;
            const ctx = canvas.getContext('2d');

            const grad = ctx.createLinearGradient(0, 0, W, H);
            grad.addColorStop(0, '#0a140b');
            grad.addColorStop(1, '#050a07');
            ctx.fillStyle = grad;
            ctx.fillRect(0, 0, W, H);

            ctx.strokeStyle = '#84cc16';
            ctx.lineWidth = 3;
            ctx.strokeRect(6, 6, W - 12, H - 12);

            ctx.textAlign = 'center';
            ctx.fillStyle = '#f59e0b';
            ctx.font = 'bold 28px sans-serif';
            ctx.fillText('ЗНАНИЯ — СИЛА', W / 2, 50);

            ctx.fillStyle = '#84cc16';
            ctx.font = '14px monospace';
            ctx.fillText('[ ТАКТИЧЕСКИЙ РАПОРТ ]', W / 2, 74);

            ctx.font = '64px sans-serif';
            ctx.fillText(playerData.avatar, W / 2, 150);

            const rankInfo = getRankInfo(playerData.xp);
            ctx.fillStyle = '#e2e8f0';
            ctx.font = 'bold 22px sans-serif';
            ctx.fillText(playerData.callsign, W / 2, 188);
            ctx.fillStyle = '#fbbf24';
            ctx.font = '15px monospace';
            ctx.fillText(`${rankInfo.icon} ${rankInfo.title}`, W / 2, 212);

            const statY = 270;
            const stats = [
                { label: 'БАЛЛЫ', value: document.getElementById('resScore').innerText, color: '#fbbf24' },
                { label: 'ТОЧНОСТЬ', value: document.getElementById('resAccuracy').innerText, color: '#84cc16' },
                { label: 'МАКС КОМБО', value: document.getElementById('resMaxCombo').innerText, color: '#fbbf24' }
            ];
            const colW = W / stats.length;
            stats.forEach((s, i) => {
                const cx = colW * i + colW / 2;
                ctx.fillStyle = '#94a3b8';
                ctx.font = '11px monospace';
                ctx.fillText(s.label, cx, statY);
                ctx.fillStyle = s.color;
                ctx.font = 'bold 26px sans-serif';
                ctx.fillText(s.value, cx, statY + 34);
            });

            ctx.fillStyle = '#64748b';
            ctx.font = '11px monospace';
            ctx.fillText('ВИТУ ВА МТО · Курсантский тренажёр', W / 2, H - 20);

            return canvas.toDataURL('image/png');
        }

        async function shareResult() {
            playSound('click');
            const dataUrl = generateShareCardDataURL();
            const shareText = `Я набрал ${document.getElementById('resScore').innerText} очков и точность ${document.getElementById('resAccuracy').innerText} в «Знания — Сила»! 🎖️`;

            try {
                if (navigator.share) {
                    const blob = await (await fetch(dataUrl)).blob();
                    const file = new File([blob], 'rezultat.png', { type: 'image/png' });
                    if (navigator.canShare && navigator.canShare({ files: [file] })) {
                        await navigator.share({ files: [file], title: 'Знания — Сила', text: shareText });
                        return;
                    }
                    await navigator.share({ text: shareText });
                    return;
                }
            } catch (e) {
                if (e && e.name === 'AbortError') return; // player cancelled the native share sheet
            }

            const win = window.open();
            if (win) {
                win.document.write(`<title>Результат</title><body style="margin:0;background:#050a07;display:flex;align-items:center;justify-content:center;height:100vh;"><img src="${dataUrl}" style="max-width:100%;"></body>`);
            } else {
                showFloatingText('РАЗРЕШИТЕ ВСПЛЫВАЮЩИЕ ОКНА', window.innerWidth / 2 - 110, window.innerHeight / 2, '#ef4444');
            }
        }

        // --- AUDIO SYNTHESIZER & MUSIC PLAYER ENGINE ---
        function initAudio() {
            if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
            if (audioCtx.state === 'suspended') audioCtx.resume();
        }

        // Soft-attack tone helper — ramping gain up from near-zero (instead of jumping straight to
        // peak) avoids the harsh "click" transient that made the old raw sawtooth/square SFX unpleasant.
        function playTone(freq, time, duration, opts) {
            opts = opts || {};
            const osc = audioCtx.createOscillator();
            const gain = audioCtx.createGain();
            osc.type = opts.wave || 'sine';
            osc.frequency.setValueAtTime(freq, time);
            if (opts.glideTo) osc.frequency.exponentialRampToValueAtTime(opts.glideTo, time + duration);

            let node = osc;
            if (opts.lowpass) {
                const filter = audioCtx.createBiquadFilter();
                filter.type = 'lowpass';
                filter.frequency.setValueAtTime(opts.lowpass, time);
                osc.connect(filter);
                node = filter;
            }

            const peak = (opts.peak || 0.2) * volFx;
            gain.gain.setValueAtTime(0.0001, time);
            gain.gain.exponentialRampToValueAtTime(peak, time + (opts.attack || 0.012));
            gain.gain.exponentialRampToValueAtTime(0.0001, time + duration);

            node.connect(gain);
            gain.connect(audioCtx.destination);
            osc.start(time);
            osc.stop(time + duration + 0.02);
        }

        function playSound(type) {
            if (isMuted || !audioCtx) return;

            try {
                const now = audioCtx.currentTime;

                if (type === 'click') {
                    playTone(680, now, 0.07, { wave: 'sine', peak: 0.14, lowpass: 3000 });
                } else if (type === 'correct') {
                    // Мягкий восходящий аккорд вместо резкой смены частоты на лету
                    playTone(523.25, now, 0.22, { wave: 'triangle', peak: 0.22, lowpass: 4000 });
                    playTone(659.25, now + 0.07, 0.28, { wave: 'triangle', peak: 0.2, lowpass: 4000 });
                } else if (type === 'wrong') {
                    // Приглушённое нисходящее "у-у" вместо резкого sawtooth-жужжания
                    playTone(300, now, 0.32, { wave: 'triangle', glideTo: 130, peak: 0.2, attack: 0.02, lowpass: 900 });
                } else if (type === 'boom') {
                    // Фильтрованный шумовой всплеск + низкий синус — звучит как приглушённый взрыв,
                    // а не как пронзительный square-сигнал.
                    const buf = getNoiseBuffer();
                    if (buf) {
                        const src = audioCtx.createBufferSource();
                        src.buffer = buf;
                        const filter = audioCtx.createBiquadFilter();
                        filter.type = 'lowpass';
                        filter.frequency.setValueAtTime(600, now);
                        const gain = audioCtx.createGain();
                        gain.gain.setValueAtTime(0.32 * volFx, now);
                        gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.35);
                        src.connect(filter);
                        filter.connect(gain);
                        gain.connect(audioCtx.destination);
                        src.start(now);
                        src.stop(now + 0.4);
                    }
                    playTone(90, now, 0.32, { wave: 'sine', glideTo: 35, peak: 0.3, attack: 0.005 });
                } else if (type === 'tick') {
                    playTone(1000, now, 0.045, { wave: 'sine', peak: 0.09 });
                }
            } catch (e) {}
        }

        // Custom Music Upload & Audio Handling
        // --- SAVED CUSTOM MUSIC (persisted in IndexedDB so it survives a reload, not just this tab) ---
        // Every uploaded track gets its own IndexedDB record (keyed by a generated id), so the
        // player can build up a whole library instead of overwriting the one saved track each time.
        const MUSIC_DB_NAME = 'vitu_quiz_music_store';
        const MUSIC_DB_STORE = 'tracks';
        let currentMusicObjectUrl = null;

        function openMusicDB() {
            return new Promise((resolve, reject) => {
                if (!window.indexedDB) { reject(new Error('IndexedDB unavailable')); return; }
                const req = indexedDB.open(MUSIC_DB_NAME, 1);
                req.onupgradeneeded = () => { req.result.createObjectStore(MUSIC_DB_STORE); };
                req.onsuccess = () => resolve(req.result);
                req.onerror = () => reject(req.error);
            });
        }

        async function saveMusicTrackBlob(id, blob) {
            const db = await openMusicDB();
            return new Promise((resolve, reject) => {
                const tx = db.transaction(MUSIC_DB_STORE, 'readwrite');
                tx.objectStore(MUSIC_DB_STORE).put(blob, id);
                tx.oncomplete = () => resolve();
                tx.onerror = () => reject(tx.error);
            });
        }

        async function loadMusicTrackBlob(id) {
            const db = await openMusicDB();
            return new Promise((resolve, reject) => {
                const tx = db.transaction(MUSIC_DB_STORE, 'readonly');
                const req = tx.objectStore(MUSIC_DB_STORE).get(id);
                req.onsuccess = () => resolve(req.result || null);
                req.onerror = () => reject(req.error);
            });
        }

        async function deleteMusicTrackBlob(id) {
            try {
                const db = await openMusicDB();
                await new Promise((resolve, reject) => {
                    const tx = db.transaction(MUSIC_DB_STORE, 'readwrite');
                    tx.objectStore(MUSIC_DB_STORE).delete(id);
                    tx.oncomplete = () => resolve();
                    tx.onerror = () => reject(tx.error);
                });
            } catch (e) {}
        }

        // Mutes/restores the live-wallpaper video's own audio depending on whether the player has
        // foreground music (preset march or a custom track) actively playing — a live wallpaper's
        // sound is ambient and should yield to music the player deliberately chose, not layer under it.
        function updateVideoAudioDucking() {
            const videoLayer = document.getElementById('customBgVideo');
            if (!videoLayer || !videoLayer.src) return;
            const musicActive = !!synthMusicInterval || (customAudioElement.src && !customAudioElement.paused);
            videoLayer.muted = musicActive;
            if (!musicActive) videoLayer.volume = volMusic;
        }
        customAudioElement.addEventListener('play', updateVideoAudioDucking);
        customAudioElement.addEventListener('pause', updateVideoAudioDucking);
        customAudioElement.addEventListener('ended', updateVideoAudioDucking);

        // Called on app load: wires up whichever track was last playing (if any) without autoplaying —
        // browsers block audio autoplay before the player has interacted with the page anyway.
        async function prepareSavedMusic() {
            if (!Array.isArray(playerData.customMusicTracks)) playerData.customMusicTracks = [];

            // Migration: move an old single-track save (key 'current') into the new track list.
            if (playerData._legacyMusicName) {
                try {
                    const legacyBlob = await loadMusicTrackBlob('current');
                    if (legacyBlob) {
                        const newId = 'trk_' + Date.now() + '_migrated';
                        await saveMusicTrackBlob(newId, legacyBlob);
                        await deleteMusicTrackBlob('current');
                        playerData.customMusicTracks.push({ id: newId, name: playerData._legacyMusicName });
                        playerData.customMusic = { activeId: newId };
                    }
                } catch (e) {}
                delete playerData._legacyMusicName;
                savePlayerData();
            }

            const activeId = playerData.customMusic && playerData.customMusic.activeId;
            if (activeId) {
                try {
                    const blob = await loadMusicTrackBlob(activeId);
                    if (blob) {
                        if (currentMusicObjectUrl) URL.revokeObjectURL(currentMusicObjectUrl);
                        currentMusicObjectUrl = URL.createObjectURL(blob);
                        customAudioElement.src = currentMusicObjectUrl;
                        customAudioElement.volume = volMusic;
                    } else {
                        playerData.customMusic = { activeId: null };
                        savePlayerData();
                    }
                } catch (e) {}
            }
            renderSavedMusicUI();
        }

        function renderSavedMusicUI() {
            const list = document.getElementById('savedMusicList');
            if (!list) return;
            const tracks = playerData.customMusicTracks || [];
            const activeId = playerData.customMusic && playerData.customMusic.activeId;

            list.classList.toggle('hidden', tracks.length === 0);
            list.innerHTML = '';
            tracks.forEach(track => {
                const isActive = track.id === activeId;
                const isPlaying = isActive && customAudioElement.src && !customAudioElement.paused;
                const row = document.createElement('div');
                row.className = `bg-slate-900/80 border rounded-lg p-2 flex items-center justify-between space-x-2 ${isActive ? 'border-lime-500/60' : 'border-slate-800'}`;
                row.innerHTML = `
                    <div class="min-w-0">
                        <div class="text-lime-300 font-military text-[11px] truncate">${track.name}</div>
                    </div>
                    <div class="flex items-center space-x-1.5 shrink-0">
                        <button onclick="toggleMusicTrack('${track.id}')" class="w-8 h-8 rounded-lg bg-lime-950 border border-lime-500/50 text-lime-300 flex items-center justify-center">${isPlaying ? '⏸️' : '▶️'}</button>
                        <button onclick="deleteMusicTrack('${track.id}')" class="w-8 h-8 rounded-lg bg-red-950/60 border border-red-500/40 text-red-400 flex items-center justify-center">🗑️</button>
                    </div>
                `;
                list.appendChild(row);
            });
        }

        async function toggleMusicTrack(id) {
            initAudio();
            playSound('click');
            const activeId = playerData.customMusic && playerData.customMusic.activeId;

            if (activeId === id && customAudioElement.src && !customAudioElement.paused) {
                customAudioElement.pause();
                renderSavedMusicUI();
                return;
            }

            if (synthMusicInterval) {
                clearInterval(synthMusicInterval);
                synthMusicInterval = null;
                updateMusicButtonUI();
            }

            if (activeId === id && customAudioElement.src) {
                customAudioElement.volume = volMusic;
                customAudioElement.play().catch(() => {});
                renderSavedMusicUI();
                return;
            }

            try {
                const blob = await loadMusicTrackBlob(id);
                if (!blob) return;
                if (currentMusicObjectUrl) URL.revokeObjectURL(currentMusicObjectUrl);
                currentMusicObjectUrl = URL.createObjectURL(blob);
                customAudioElement.src = currentMusicObjectUrl;
                customAudioElement.volume = volMusic;
                customAudioElement.play().catch(() => {});
                playerData.customMusic = { activeId: id };
                savePlayerData();
                renderSavedMusicUI();
            } catch (e) {}
        }

        async function deleteMusicTrack(id) {
            const activeId = playerData.customMusic && playerData.customMusic.activeId;
            if (activeId === id) {
                customAudioElement.pause();
                customAudioElement.removeAttribute('src');
                if (currentMusicObjectUrl) {
                    URL.revokeObjectURL(currentMusicObjectUrl);
                    currentMusicObjectUrl = null;
                }
                playerData.customMusic = { activeId: null };
                updateVideoAudioDucking();
            }
            await deleteMusicTrackBlob(id);
            playerData.customMusicTracks = (playerData.customMusicTracks || []).filter(t => t.id !== id);
            savePlayerData();
            renderSavedMusicUI();
            playSound('click');
        }

        async function handleCustomMusicUpload(e) {
            const file = e.target.files[0];
            if (!file) return;

            const id = 'trk_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8);
            try {
                await saveMusicTrackBlob(id, file);
            } catch (err) {
                showFloatingText('НЕ УДАЛОСЬ СОХРАНИТЬ ТРЕК', window.innerWidth / 2 - 110, window.innerHeight / 2, '#ef4444');
                playSound('wrong');
                e.target.value = '';
                return;
            }

            if (!Array.isArray(playerData.customMusicTracks)) playerData.customMusicTracks = [];
            playerData.customMusicTracks.push({ id, name: file.name });

            if (currentMusicObjectUrl) URL.revokeObjectURL(currentMusicObjectUrl);
            currentMusicObjectUrl = URL.createObjectURL(file);
            customAudioElement.src = currentMusicObjectUrl;
            customAudioElement.volume = volMusic;
            customAudioElement.play().catch(() => {});

            if (synthMusicInterval) {
                clearInterval(synthMusicInterval);
                synthMusicInterval = null;
                updateMusicButtonUI();
            }

            playerData.customMusic = { activeId: id };
            savePlayerData();
            renderSavedMusicUI();
            playSound('correct');
            e.target.value = '';
        }

        // --- PROCEDURAL MILITARY MARCH (layered kick/snare/bass/lead, pure Web Audio, no assets) ---
        let noiseBuffer = null;
        function getNoiseBuffer() {
            if (!noiseBuffer && audioCtx) {
                const len = Math.floor(audioCtx.sampleRate * 0.15);
                noiseBuffer = audioCtx.createBuffer(1, len, audioCtx.sampleRate);
                const data = noiseBuffer.getChannelData(0);
                for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
            }
            return noiseBuffer;
        }

        function playKick(time) {
            const osc = audioCtx.createOscillator();
            const gain = audioCtx.createGain();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(120, time);
            osc.frequency.exponentialRampToValueAtTime(45, time + 0.12);
            gain.gain.setValueAtTime(0.5 * volMusic, time);
            gain.gain.exponentialRampToValueAtTime(0.001, time + 0.18);
            osc.connect(gain);
            gain.connect(audioCtx.destination);
            osc.start(time);
            osc.stop(time + 0.2);
        }

        function playSnare(time) {
            const buf = getNoiseBuffer();
            if (!buf) return;
            const src = audioCtx.createBufferSource();
            src.buffer = buf;
            const filter = audioCtx.createBiquadFilter();
            filter.type = 'bandpass';
            filter.frequency.value = 1800;
            const gain = audioCtx.createGain();
            gain.gain.setValueAtTime(0.35 * volMusic, time);
            gain.gain.exponentialRampToValueAtTime(0.001, time + 0.12);
            src.connect(filter);
            filter.connect(gain);
            gain.connect(audioCtx.destination);
            src.start(time);
            src.stop(time + 0.15);
        }

        function playBassNote(freq, time) {
            const osc = audioCtx.createOscillator();
            const gain = audioCtx.createGain();
            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(freq, time);
            gain.gain.setValueAtTime(0.16 * volMusic, time);
            gain.gain.exponentialRampToValueAtTime(0.001, time + 0.22);
            osc.connect(gain);
            gain.connect(audioCtx.destination);
            osc.start(time);
            osc.stop(time + 0.25);
        }

        function playLeadNote(freq, time) {
            const osc = audioCtx.createOscillator();
            const gain = audioCtx.createGain();
            osc.type = 'triangle';
            osc.frequency.setValueAtTime(freq, time);
            gain.gain.setValueAtTime(0.12 * volMusic, time);
            gain.gain.exponentialRampToValueAtTime(0.001, time + 0.3);
            osc.connect(gain);
            gain.connect(audioCtx.destination);
            osc.start(time);
            osc.stop(time + 0.32);
        }

        function updateMusicButtonUI() {
            const icon = document.getElementById('btnPresetMusicIcon');
            const label = document.getElementById('btnPresetMusicLabel');
            const playing = !!synthMusicInterval;
            if (icon) icon.innerText = playing ? '⏹️' : '▶️';
            if (label) label.innerText = playing ? 'Выключить Военный Марш' : 'Включить Военный Марш';
        }

        function playPresetMusic() {
            initAudio();
            if (customAudioElement.src) {
                customAudioElement.pause();
            }

            if (synthMusicInterval) {
                clearInterval(synthMusicInterval);
                synthMusicInterval = null;
                updateMusicButtonUI();
                updateVideoAudioDucking();
                showFloatingText("МУЗЫКА ВЫКЛЮЧЕНА", window.innerWidth / 2 - 60, window.innerHeight / 2, '#f59e0b');
                return;
            }

            // 16th-note grid at 120 BPM. Kick on the quarters, snare backbeat, bass walks the original
            // note progression on 8th notes, and a short bugle-call lead motif plays once every 4 bars.
            const bassLine = [110, null, 110, null, 146.83, null, 130.81, null, 110, null, 110, null, 164.81, null, 146.83, null];
            const leadMotif = [523.25, null, 659.25, null, 783.99, null, null, null];
            const kickSteps = [0, 4, 8, 12];
            const snareSteps = [4, 12];

            let step = 0;
            let loopCount = 0;

            synthMusicInterval = setInterval(() => {
                if (isMuted || !audioCtx) return;
                try {
                    const now = audioCtx.currentTime;
                    if (kickSteps.includes(step)) playKick(now);
                    if (snareSteps.includes(step)) playSnare(now);

                    const bassNote = bassLine[step];
                    if (bassNote) playBassNote(bassNote, now);

                    if (loopCount % 4 === 0 && step < leadMotif.length) {
                        const leadNote = leadMotif[step];
                        if (leadNote) playLeadNote(leadNote, now);
                    }

                    step = (step + 1) % 16;
                    if (step === 0) loopCount++;
                } catch(err){}
            }, 125);

            updateMusicButtonUI();
            updateVideoAudioDucking();
            showFloatingText("ВОЕННЫЙ МАРШ ВКЛЮЧЕН", window.innerWidth / 2 - 70, window.innerHeight / 2, '#84cc16');
        }

        function updateMusicVolume(val) {
            volMusic = parseInt(val) / 100;
            customAudioElement.volume = volMusic;
            const videoLayer = document.getElementById('customBgVideo');
            if (videoLayer && !videoLayer.muted) videoLayer.volume = volMusic;
            document.getElementById('valVolMusic').innerText = `${Math.round(volMusic * 100)}%`;
        }

        function openModal(id) {
            playSound('click');
            const modal = document.getElementById(id);
            if (modal) modal.classList.remove('hidden');

            if (id === 'questsModal') {
                renderQuestsUI();
                renderDailyQuestsUI();
            }

            if (id === 'friendsModal') {
                renderFriendsLeaderboard();
            }

            if (id === 'settingsModal') {
                renderSettingsUI();
            }

            if (id === 'backgroundModal') {
                renderBackgroundOptionsUI();
            }

            if (id === 'musicModal') {
                renderSavedMusicUI();
            }
        }

        function closeModal(id) {
            playSound('click');
            const modal = document.getElementById(id);
            if (modal) modal.classList.add('hidden');
        }

        function toggleSetting(key) {
            playerData.settings[key] = !playerData.settings[key];
            savePlayerData();
            renderSettingsUI();
            playSound('click');
        }

        function setTimerDuration(sec) {
            playerData.settings.timerDuration = sec;
            savePlayerData();
            renderSettingsUI();
            playSound('click');
        }

        function renderSettingsUI() {
            applyUiOpacity();
            const s = playerData.settings;
            const shakeBtn = document.getElementById('toggleScreenShake');
            const hapticBtn = document.getElementById('toggleHaptic');
            const autoBtn = document.getElementById('toggleAutoAdvance');
            if (shakeBtn) shakeBtn.classList.toggle('on', !!s.screenShake);
            if (hapticBtn) hapticBtn.classList.toggle('on', !!s.haptic);
            if (autoBtn) autoBtn.classList.toggle('on', !!s.autoAdvance);

            document.querySelectorAll('.timer-dur-btn').forEach(btn => {
                const dur = parseInt(btn.dataset.dur);
                const active = dur === s.timerDuration;
                btn.className = `timer-dur-btn py-1.5 rounded-lg border font-military text-[10px] transition-all ${
                    active ? 'border-lime-400 bg-lime-950 text-lime-300' : 'border-slate-700 bg-slate-900/60 text-slate-400'
                }`;
            });
        }

        // --- BACKGROUND CUSTOMIZATION (presets, own photo, or a looping "live wallpaper" video) ---
        // Custom images/video are stored as Blobs in IndexedDB, not inside playerData/localStorage —
        // localStorage caps out around 5-10MB total per origin, nowhere near enough for a video.
        // IndexedDB's quota is device-dependent but typically hundreds of MB to GB, so it's the only
        // realistic place to put a "live wallpaper".
        const BG_IMAGE_MAX_BYTES = 20 * 1024 * 1024;
        const BG_VIDEO_MAX_BYTES = 100 * 1024 * 1024;
        const BG_PRESET_CLASSES = ['military-bg', 'military-bg-desert', 'military-bg-night', 'military-bg-jungle'];
        const BG_DB_NAME = 'vitu_quiz_bg_store';
        const BG_DB_STORE = 'background';
        const BG_DB_KEY = 'current';
        let currentBgObjectUrl = null;

        function openBgDB() {
            return new Promise((resolve, reject) => {
                if (!window.indexedDB) { reject(new Error('IndexedDB unavailable')); return; }
                const req = indexedDB.open(BG_DB_NAME, 1);
                req.onupgradeneeded = () => { req.result.createObjectStore(BG_DB_STORE); };
                req.onsuccess = () => resolve(req.result);
                req.onerror = () => reject(req.error);
            });
        }

        async function saveBgBlob(type, blob) {
            const db = await openBgDB();
            return new Promise((resolve, reject) => {
                const tx = db.transaction(BG_DB_STORE, 'readwrite');
                tx.objectStore(BG_DB_STORE).put({ type, blob }, BG_DB_KEY);
                tx.oncomplete = () => resolve();
                tx.onerror = () => reject(tx.error);
            });
        }

        async function loadBgBlob() {
            const db = await openBgDB();
            return new Promise((resolve, reject) => {
                const tx = db.transaction(BG_DB_STORE, 'readonly');
                const req = tx.objectStore(BG_DB_STORE).get(BG_DB_KEY);
                req.onsuccess = () => resolve(req.result || null);
                req.onerror = () => reject(req.error);
            });
        }

        async function clearBgBlob() {
            try {
                const db = await openBgDB();
                await new Promise((resolve, reject) => {
                    const tx = db.transaction(BG_DB_STORE, 'readwrite');
                    tx.objectStore(BG_DB_STORE).delete(BG_DB_KEY);
                    tx.oncomplete = () => resolve();
                    tx.onerror = () => reject(tx.error);
                });
            } catch (e) {}
        }

        async function applyBackground() {
            const bg = playerData.background || { type: 'preset', value: 'default' };
            const body = document.body;
            const imgLayer = document.getElementById('customBgImage');
            const videoLayer = document.getElementById('customBgVideo');

            body.classList.remove(...BG_PRESET_CLASSES);
            imgLayer.classList.add('hidden');
            imgLayer.style.backgroundImage = '';
            videoLayer.classList.add('hidden');
            videoLayer.pause();
            videoLayer.removeAttribute('src');
            videoLayer.load();
            if (currentBgObjectUrl) {
                URL.revokeObjectURL(currentBgObjectUrl);
                currentBgObjectUrl = null;
            }

            if (bg.type === 'image' || bg.type === 'video') {
                // Migration: an older build of this app stored the file as an inline data: URL
                // directly in localStorage. Move it into IndexedDB the first time we see it.
                if (typeof bg.value === 'string' && bg.value.indexOf('data:') === 0) {
                    try {
                        const resp = await fetch(bg.value);
                        const blob = await resp.blob();
                        await saveBgBlob(bg.type, blob);
                        playerData.background = { type: bg.type, value: null };
                        savePlayerData();
                    } catch (e) {}
                }

                try {
                    const record = await loadBgBlob();
                    if (record && record.blob) {
                        currentBgObjectUrl = URL.createObjectURL(record.blob);
                        if (record.type === 'video') {
                            videoLayer.src = currentBgObjectUrl;
                            videoLayer.volume = isMuted ? 0 : volMusic;
                            videoLayer.muted = false;
                            videoLayer.classList.remove('hidden');
                            // Browsers often block autoplay-with-sound before any user gesture on the
                            // page. If that happens, fall back to a muted autoplay — the first tap
                            // anywhere in the app (see the bottom of the script) then unmutes it.
                            videoLayer.play().catch(() => {
                                videoLayer.muted = true;
                                videoLayer.play().catch(() => {});
                            });
                            updateVideoAudioDucking();
                        } else {
                            imgLayer.style.backgroundImage = `url(${currentBgObjectUrl})`;
                            imgLayer.classList.remove('hidden');
                        }
                        return;
                    }
                } catch (e) {}

                // Blob missing/unreadable (e.g. cleared browser data) — fall back to the default theme.
                playerData.background = { type: 'preset', value: 'default' };
                savePlayerData();
            }

            const key = playerData.background.value === 'default' ? 'military-bg' : `military-bg-${playerData.background.value}`;
            body.classList.add(BG_PRESET_CLASSES.includes(key) ? key : 'military-bg');
        }

        function renderBackgroundOptionsUI() {
            const bg = playerData.background || { type: 'preset', value: 'default' };
            document.querySelectorAll('.bg-preset-btn').forEach(btn => {
                const isActive = bg.type === 'preset' && btn.dataset.bg === bg.value;
                btn.className = `bg-preset-btn p-2 rounded-lg border flex flex-col items-center space-y-1 ${
                    isActive ? 'border-2 border-lime-500 bg-slate-900/60' : 'border-slate-700 bg-slate-900/60'
                }`;
            });
        }

        function setBackgroundPreset(key) {
            playerData.background = { type: 'preset', value: key };
            savePlayerData();
            applyBackground();
            renderBackgroundOptionsUI();
            clearBgBlob();
            playSound('click');
        }

        function resetBackgroundToDefault() {
            setBackgroundPreset('default');
            document.getElementById('bgUploadMessage').innerText = '';
        }

        // First custom background (photo or video) is free; every change after that costs tokens —
        // charged only once the file is actually saved, so a failed upload never costs anything.
        const CUSTOM_BG_IMAGE_PRICE = 80;
        const CUSTOM_BG_VIDEO_PRICE = 150;

        function canAffordCustomBg(price, msgEl) {
            if (!playerData.customBgFreeUsed) return true;
            if (playerData.tokens < price) {
                msgEl.className = 'text-[10px] font-mono min-h-[14px] text-red-400';
                msgEl.innerText = `⚠ Смена фона стоит ${price} 🪖 — жетонов не хватает.`;
                playSound('wrong');
                return false;
            }
            return true;
        }

        async function handleBackgroundImageUpload(event) {
            const file = event.target.files[0];
            const msgEl = document.getElementById('bgUploadMessage');
            if (!file || !file.type.startsWith('image/')) return;

            if (file.size > BG_IMAGE_MAX_BYTES) {
                msgEl.className = 'text-[10px] font-mono min-h-[14px] text-red-400';
                msgEl.innerText = `⚠ Файл слишком большой (максимум ${Math.round(BG_IMAGE_MAX_BYTES / 1024 / 1024)} МБ). Выберите фото поменьше.`;
                playSound('wrong');
                event.target.value = '';
                return;
            }

            if (!canAffordCustomBg(CUSTOM_BG_IMAGE_PRICE, msgEl)) { event.target.value = ''; return; }

            try {
                await saveBgBlob('image', file);
                const wasFree = !playerData.customBgFreeUsed;
                if (!wasFree) playerData.tokens -= CUSTOM_BG_IMAGE_PRICE;
                playerData.customBgFreeUsed = true;
                playerData.background = { type: 'image', value: null };
                savePlayerData();
                await applyBackground();
                renderBackgroundOptionsUI();
                msgEl.className = 'text-[10px] font-mono min-h-[14px] text-lime-400';
                msgEl.innerText = wasFree ? '✅ Фон обновлён (первая смена бесплатно)!' : `✅ Фон обновлён! -${CUSTOM_BG_IMAGE_PRICE} 🪖`;
                playSound('correct');
            } catch (err) {
                msgEl.className = 'text-[10px] font-mono min-h-[14px] text-red-400';
                msgEl.innerText = '❌ Браузер не дал сохранить это фото. Попробуйте файл поменьше.';
                playSound('wrong');
            }
            event.target.value = '';
        }

        async function handleBackgroundVideoUpload(event) {
            const file = event.target.files[0];
            const msgEl = document.getElementById('bgUploadMessage');
            if (!file || !file.type.startsWith('video/')) return;

            if (file.size > BG_VIDEO_MAX_BYTES) {
                msgEl.className = 'text-[10px] font-mono min-h-[14px] text-red-400';
                msgEl.innerText = `⚠ Видео слишком большое (максимум ${Math.round(BG_VIDEO_MAX_BYTES / 1024 / 1024)} МБ).`;
                playSound('wrong');
                event.target.value = '';
                return;
            }

            if (!canAffordCustomBg(CUSTOM_BG_VIDEO_PRICE, msgEl)) { event.target.value = ''; return; }

            msgEl.className = 'text-[10px] font-mono min-h-[14px] text-slate-400';
            msgEl.innerText = '⏳ Сохраняем видео...';

            try {
                await saveBgBlob('video', file);
                const wasFree = !playerData.customBgFreeUsed;
                if (!wasFree) playerData.tokens -= CUSTOM_BG_VIDEO_PRICE;
                playerData.customBgFreeUsed = true;
                playerData.background = { type: 'video', value: null };
                savePlayerData();
                await applyBackground();
                renderBackgroundOptionsUI();
                msgEl.className = 'text-[10px] font-mono min-h-[14px] text-lime-400';
                msgEl.innerText = wasFree ? '✅ Живые обои включены (первая смена бесплатно)!' : `✅ Живые обои включены! -${CUSTOM_BG_VIDEO_PRICE} 🪖`;
                playSound('correct');
            } catch (err) {
                msgEl.className = 'text-[10px] font-mono min-h-[14px] text-red-400';
                msgEl.innerText = '❌ Браузер не дал сохранить это видео. Попробуйте файл покороче.';
                playSound('wrong');
            }
            event.target.value = '';
        }

        // --- GIFT CODES ---
        const GIFT_CODES = {
            'ДЕНЬЗНАНИЙ':  { tokens: 50 },
            'ПОБЕДА80':    { tokens: 80 },
            'ВИТУСТАРТ':   { tokens: 30, xp: 20 },
            'КУРСАНТ2026': { perk5050: 1, perkTime: 1 }
        };

        function redeemGiftCode() {
            const input = document.getElementById('inputGiftCode');
            const msgEl = document.getElementById('giftCodeMessage');
            const code = (input.value || '').trim().toUpperCase();

            if (!code) return;

            if (playerData.redeemedCodes.includes(code)) {
                msgEl.className = 'text-[10px] font-mono min-h-[14px] text-red-400';
                msgEl.innerText = '⚠ Этот код уже был активирован ранее.';
                playSound('wrong');
                return;
            }

            const reward = GIFT_CODES[code];
            if (!reward) {
                msgEl.className = 'text-[10px] font-mono min-h-[14px] text-red-400';
                msgEl.innerText = '❌ Код не найден. Проверьте написание.';
                playSound('wrong');
                return;
            }

            const parts = [];
            if (reward.tokens) { playerData.tokens += reward.tokens; parts.push(`+${reward.tokens} 🪖`); }
            if (reward.xp) { playerData.xp += reward.xp; parts.push(`+${reward.xp} XP`); }
            if (reward.perk5050) { playerData.inventory.perk5050 = (playerData.inventory.perk5050 || 0) + reward.perk5050; parts.push(`+${reward.perk5050} 50/50`); }
            if (reward.perkTime) { playerData.inventory.perkTime = (playerData.inventory.perkTime || 0) + reward.perkTime; parts.push(`+${reward.perkTime} ⏱️`); }

            playerData.redeemedCodes.push(code);
            savePlayerData();

            msgEl.className = 'text-[10px] font-mono min-h-[14px] text-lime-400';
            msgEl.innerText = `✅ Активировано: ${parts.join(', ')}`;
            playSound('correct');
            spawnFireworks();
            showFloatingText(`🎁 ${parts.join(', ')}`, window.innerWidth / 2 - 80, window.innerHeight / 2, '#eab308');
            input.value = '';
        }

        function updateSettings() {
            const fXVal = document.getElementById('sliderVolFx');
            if (fXVal) {
                volFx = parseInt(fXVal.value) / 100;
                document.getElementById('valVolFx').innerText = `${Math.round(volFx * 100)}%`;
            }
        }

        // Lets a custom background photo/video show through the HUD panels instead of being hidden
        // behind a near-opaque card everywhere.
        function applyUiOpacity() {
            const pct = typeof playerData.uiOpacity === 'number' ? playerData.uiOpacity : 100;
            const alpha = (pct / 100) * 0.98;
            document.documentElement.style.setProperty('--hud-panel-alpha', alpha.toFixed(2));
            const label = document.getElementById('valUiOpacity');
            const slider = document.getElementById('sliderUiOpacity');
            if (label) label.innerText = `${pct}%`;
            if (slider) slider.value = pct;
        }

        function updateUiOpacity(val) {
            playerData.uiOpacity = parseInt(val);
            applyUiOpacity();
            savePlayerData();
        }

        // --- INIT ---
        document.title = `Знания — Сила: Курсантский Квиз v${APP_VERSION} (Tactical Profile & Audio)`;
        const versionBadgeEl = document.getElementById('appVersionBadge');
        if (versionBadgeEl) versionBadgeEl.innerText = `ТАКТИЧЕСКИЙ СИМУЛЯТОР V${APP_VERSION}`;
        setMenuTab('play');

        window.addEventListener('load', () => { loadPlayerData(); });
        window.addEventListener('touchstart', () => { initAudio(); }, { once: true });
        window.addEventListener('click', () => {
            initAudio();
            // The first tap anywhere counts as the user gesture browsers require before allowing
            // audio — use it to unmute a live-wallpaper video that had to autoplay muted.
            updateVideoAudioDucking();
        }, { once: true });
